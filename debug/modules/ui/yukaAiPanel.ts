import * as THREE from 'three';
import { createStyledButton } from '../ai/yukaUICommon';
import { YukaAIControls } from '../ai/yukaAIControls';
import { YukaDebugger } from '../ai/yukaDebugger';
import { YukaSteeringDebug } from '../ai/yukaSteeringDebug';
import { YukaStateMachineDebug } from '../ai/yukaStateMachineDebug';
import { YukaPathEditor } from '../ai/yukaPathEditor';
import { YukaNavMeshHelper } from '../ai/yukaNavMeshHelper';
import { getNavMeshHelper } from '../ai/aiNavMeshManager';
import { getAgents, getSelectedAgent, selectAgent, spawnAgent, removeAgent, onAgentChange } from '../ai/agentService';
import { on as onEvent, emit as emitEvent } from '../ai/eventBus';
import { setIsYukaSystemPaused, getIsYukaSystemPaused, yukaTime } from '../ai/yukaManager';
import { setAgentAIControlled } from '../ai/yukaController';
import { getAILoadedChunkKeys } from '../ai/aiTerrainManager';
import { visualizeNavMeshPolygons, clearNavMeshDebug } from '../ai/navMeshDebugger';
import { getActiveChunkMeshesForCollision } from '../ui/isolatedTerrainViewer';
import { initializeWorkerPool, requestNavMeshPathfinding, requestNavMeshClosestPoint } from '../workers/navMeshWorkerPool';

declare global {
    interface Window {
        isolatedTerrainViewer?: any;
    }
}

let yukaPanelInstance: HTMLElement | null = null;
let yukaControls: YukaAIControls | null = null;
let yukaDebugger: YukaDebugger | null = null;
let steeringDebug: YukaSteeringDebug | null = null;
let stateMachineDebug: YukaStateMachineDebug | null = null;
let pathEditor: YukaPathEditor | null = null;

// --- Agent Info Section Elements ---
let agentInfoSpans: Record<string, HTMLElement> = {};
let agentMaxSpeedInput: HTMLInputElement | null = null;
let agentMassInput: HTMLInputElement | null = null;
let agentTeleportInputs: { x: HTMLInputElement, y: HTMLInputElement, z: HTMLInputElement } | null = null;
let agentTeleportButton: HTMLElement | null = null;

// --- Steering Section Elements ---
let steeringBehaviorSelect: HTMLSelectElement | null = null;
let addBehaviorButtonElement: HTMLButtonElement | null = null;

// --- NEW REFERENCES FOR TERRAIN/NAVMESH DEBUG ---
let chunkKeysDisplay: HTMLElement | null = null;
let chunkCountDisplay: HTMLElement | null = null;
let navMeshVizActive = false; // Track navmesh visualization state
let navMeshStatsDisplay: HTMLElement | null = null; // Reference for NavMesh stats display

// --- NEW REFERENCE FOR PATHFINDING ---
let pathPointsList: HTMLElement | null = null;

// --- STORE SCENE REFERENCE ---
let sceneRef: THREE.Scene | null = null;
let cameraRef: THREE.Camera | null = null;
let rendererRef: THREE.WebGLRenderer | null = null;

let terrainLoaderRetryCount = 0;
const MAX_TERRAIN_LOADER_RETRIES = 50; // 5 seconds total with 100ms interval

let selectedAgentUUID: string | null = null;

// Create a mapping from behavior type strings to their required parameters for UI generation
const behaviorParameters: { [key: string]: { label: string; type: string; optional?: boolean; options?: string[]; defaultValue?: any }[] } = {
    'ArriveBehavior': [
        { label: 'Target X', type: 'number', defaultValue: 0 },
        { label: 'Target Y', type: 'number', defaultValue: 0 },
        { label: 'Target Z', type: 'number', defaultValue: -10 },
        { label: 'Deceleration', type: 'number', defaultValue: 3 },
        { label: 'Tolerance', type: 'number', defaultValue: 0 },
    ],
    'SeekBehavior': [
        { label: 'Target X', type: 'number', defaultValue: 0 },
        { label: 'Target Y', type: 'number', defaultValue: 0 },
        { label: 'Target Z', type: 'number', defaultValue: -10 },
    ],
    'FleeBehavior': [
        { label: 'Threat X', type: 'number', defaultValue: 0 },
        { label: 'Threat Y', type: 'number', defaultValue: 0 },
        { label: 'Threat Z', type: 'number', defaultValue: 10 },
        { label: 'Panic Distance', type: 'number', defaultValue: 10 },
    ],
    'WanderBehavior': [
        { label: 'Radius', type: 'number', defaultValue: 1 },
        { label: 'Distance', type: 'number', defaultValue: 5 },
        { label: 'Jitter', type: 'number', defaultValue: 5 },
    ],
    'PursuitBehavior': [
        { label: 'Evader', type: 'select', options: [], optional: false }, // Options will be populated with other agent UUIDs
        { label: 'Prediction Factor', type: 'number', defaultValue: 1 },
    ],
    'EvadeBehavior': [
        { label: 'Pursuer', type: 'select', options: [], optional: false }, // Options will be populated with other agent UUIDs
        { label: 'Panic Distance', type: 'number', defaultValue: 10 },
        { label: 'Prediction Factor', type: 'number', defaultValue: 1 },
    ],
    'OffsetPursuitBehavior': [
        { label: 'Leader', type: 'select', options: [], optional: false }, // Options will be populated with other agent UUIDs
        { label: 'Offset X', type: 'number', defaultValue: 5 },
        { label: 'Offset Y', type: 'number', defaultValue: 0 },
        { label: 'Offset Z', type: 'number', defaultValue: 5 },
    ],
    'InterposeBehavior': [
        { label: 'Entity 1', type: 'select', options: [], optional: false }, // Options will be populated with other agent UUIDs
        { label: 'Entity 2', type: 'select', options: [], optional: false }, // Options will be populated with other agent UUIDs
        { label: 'Deceleration', type: 'number', defaultValue: 3 },
    ],
    'SeparationBehavior': [], // No constructor parameters, uses neighborhoodRadius property
    'AlignmentBehavior': [], // No constructor parameters, uses neighborhoodRadius property
    'CohesionBehavior': [], // No constructor parameters, uses neighborhoodRadius property
    'ObstacleAvoidanceBehavior': [], // Requires an array of obstacles, which might be complex to set up via basic UI
};

// Add common properties that can be configured after creation
const commonBehaviorProperties: { label: string; property: string; type: string; defaultValue?: any }[] = [
    { label: 'Weight', property: 'weight', type: 'number', defaultValue: 1 },
    { label: 'Active', property: 'active', type: 'checkbox', defaultValue: true },
];

// Add behavior-specific properties
const specificBehaviorProperties: { [key: string]: { label: string; property: string; type: string; defaultValue?: any }[] } = {
    'SeparationBehavior': [
        { label: 'Neighborhood Radius', property: 'neighborhoodRadius', type: 'number', defaultValue: 10 },
    ],
    'AlignmentBehavior': [
        { label: 'Neighborhood Radius', property: 'neighborhoodRadius', type: 'number', defaultValue: 10 },
    ],
    'CohesionBehavior': [
        { label: 'Neighborhood Radius', property: 'neighborhoodRadius', type: 'number', defaultValue: 10 },
    ],
    'ObstacleAvoidanceBehavior': [
        { label: 'Braking Weight', property: 'brakingWeight', type: 'number', defaultValue: 0.2 },
        { label: 'DBox Min Length', property: 'dBoxMinLength', type: 'number', defaultValue: 4 },
        // Obstacles property is complex and may require a different UI approach
    ],
};

export interface YukaAIPanelOptions {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    agent: any;
    navMesh: any;
    chunkMeshes: Record<string, THREE.Mesh>;
    container?: HTMLElement;
    spawnAgent?: () => Promise<any>;
}

// Helper function to create a collapsible section
function createCollapsibleSection(title: string, contentHtml: string | HTMLElement): HTMLElement {
    const section = document.createElement('section');
    section.style.cssText = `
        margin-bottom: 10px;
        border: 1px solid rgba(70,80,90,0.5);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(30,35,40,0.7);
    `;

    const header = document.createElement('h3');
    header.style.cssText = `
        margin: 0;
        padding: 12px 15px;
        background: rgba(50,60,70,0.9);
        color: #c0c0c0;
        cursor: pointer;
        font-size: 1.1em;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
        user-select: none;
    `;
    header.textContent = title;

    const indicator = document.createElement('span');
    indicator.style.cssText = `
        font-size: 1.2em;
        transition: transform 0.2s ease;
    `;
    indicator.textContent = '▼'; // Down arrow initially
    header.appendChild(indicator);

    const content = document.createElement('div');
    content.style.cssText = `
        padding: 15px;
        border-top: 1px solid rgba(70,80,90,0.5);
        display: block; /* Start open */
    `;
    if (typeof contentHtml === 'string') {
        content.innerHTML = contentHtml;
    } else {
        content.appendChild(contentHtml);
    }

    header.onclick = () => {
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        indicator.style.transform = isVisible ? 'rotate(-90deg)' : 'rotate(0deg)'; // Rotate arrow
    };

    section.appendChild(header);
    section.appendChild(content);

    return section;
}

export function createYukaAIPanel(container: HTMLElement, options: YukaAIPanelOptions): HTMLElement {
    if (yukaPanelInstance) {
        yukaPanelInstance.style.display = '';
        // Ensure sections are correctly displayed on re-show
        yukaPanelInstance.querySelectorAll('section > div').forEach((content: any) => {
             content.style.display = 'block'; // Keep sections open on re-show
        });
         yukaPanelInstance.querySelectorAll('section > h3 span').forEach((indicator: any) => {
             indicator.style.transform = 'rotate(0deg)';
        });

        return yukaPanelInstance;
    }
    // Panel container
    const panel = document.createElement('div');
    panel.id = 'yuka-ai-panel';
    panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 420px;
        max-height: 95vh;
        overflow-y: auto;
        background: rgba(25, 28, 32, 0.98);
        color: #e0e0e0;
        padding: 10px; /* Reduced padding here */
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        font-family: 'Roboto Mono', monospace, sans-serif;
        font-size: 14px;
        line-height: 1.6;
        z-index: 1001;
        border: 1.5px solid rgba(70,80,90,0.85);
    `;
    container.appendChild(panel);
    yukaPanelInstance = panel;

    // Store scene reference
    sceneRef = options.scene;
    cameraRef = options.camera;
    rendererRef = options.renderer;

    // Defensive check for agent
    const hasAgent = !!(options.agent && options.agent.uuid);
    if (!hasAgent) {
        console.warn('[YukaAIPanel] No valid agent found. UI will be shown, but agent-dependent controls will be disabled.');
    }

    // --- Agent Management Section ---
    const agentManagementContent = document.createElement('div');
    createAgentManagementSectionContent(agentManagementContent); // Create content in a separate function
    panel.appendChild(createCollapsibleSection('Agent Management', agentManagementContent));

    // --- General Controls Section ---
     const generalControlsContent = document.createElement('div');
     createGeneralControlsSectionContent(generalControlsContent);
     panel.appendChild(createCollapsibleSection('General Controls', generalControlsContent));

    // --- Agent Info Section ---
     const agentInfoContent = document.createElement('div');
     const agentInfoElements = createAgentInfoSectionContent(agentInfoContent, hasAgent); // Call and get returned elements
     agentInfoSpans = agentInfoElements.infoSpans; // Store in module-level variables
     agentMaxSpeedInput = agentInfoElements.maxSpeedInput;
     agentMassInput = agentInfoElements.massInput;
     agentTeleportInputs = agentInfoElements.teleportInputs;
     agentTeleportButton = agentInfoElements.teleportButton;
     panel.appendChild(createCollapsibleSection('Agent Info', agentInfoContent));

    // --- Navigation Mesh Section ---
    const navMeshContent = document.createElement('div');
    createNavigationMeshSectionContent(navMeshContent, options); // Create content in a separate function, pass options for chunkMeshes/scene
    panel.appendChild(createCollapsibleSection('Navigation Mesh', navMeshContent));

    // --- Terrain Chunks / NavMesh Debug Section ---
    const terrainDebugContent = document.createElement('div');
    createTerrainDebugSectionContent(terrainDebugContent); // Create content in a separate function
    panel.appendChild(createCollapsibleSection('Terrain Chunks / NavMesh Debug', terrainDebugContent));

    // --- Pathfinding Section ---
    const pathfindingContent = document.createElement('div');
    createPathfindingSectionContent(pathfindingContent); // Create content in a separate function
    panel.appendChild(createCollapsibleSection('Pathfinding', pathfindingContent));

    // --- Steering Section ---
    const steeringContent = document.createElement('div');
    const steeringElements = createSteeringSectionContent(steeringContent); // Call and get returned elements
    steeringBehaviorSelect = steeringElements.behaviorSelect; // Store in module-level variables
    addBehaviorButtonElement = steeringElements.addBehaviorButton; // Store in module-level variables
    panel.appendChild(createCollapsibleSection('Steering', steeringContent));

    // --- State Machine Section ---
    const stateMachineContent = document.createElement('div');
    createStateMachineSectionContent(stateMachineContent);
    panel.appendChild(createCollapsibleSection('State Machine', stateMachineContent));

    // --- State Management Section ---
    const stateManagementSection = createCollapsibleSection('State Management', createStateManagementSectionContent(panel));
    panel.appendChild(stateManagementSection);

    // --- Debug/Logs Section ---
    const debugLogContent = createDebugLogSectionContent(document.createElement('div'));
    panel.appendChild(createCollapsibleSection('DebugLogs', debugLogContent));

    // --- Setup AI modules with delayed initialization ---
    // setupAIModules is now called in the onAgentChange listener when the first agent is selected.

    // Start chunk keys update
    startChunkKeysUpdate();
    // Force an immediate update
    updateChunkKeysDisplay();

    return panel;
}

export function toggleYukaAIPanel(container: HTMLElement, options: YukaAIPanelOptions) {
    if (!yukaPanelInstance) {
        createYukaAIPanel(container, options);
    }
    
    if (yukaPanelInstance!.style.display === 'none') {
        // Show panel and initialize components
        yukaPanelInstance!.style.display = '';
        console.log('[YukaAIPanel] Panel shown. Attempting to update chunk keys display.');
        updateChunkKeysDisplay(); // **Explicitly update chunk display when showing panel**
        if (yukaControls) yukaControls.update(); // Refresh controls
        if (yukaDebugger) yukaDebugger.updateIAPanel(); // Refresh debugger
        terrainLoaderRetryCount = 0; // Reset retry count when showing panel
        startChunkKeysUpdate();
    } else {
        // Hide panel and cleanup components
        yukaPanelInstance!.style.display = 'none';
        // Hide debug visualizations
        if (steeringDebug) {
            steeringDebug.toggleForces(false);
            steeringDebug.toggleBehaviors(false);
        }
        if (stateMachineDebug) {
            stateMachineDebug.toggleCurrentStateVisibility(false);
            stateMachineDebug.toggleGraphVisibility(false);
        }
        // Recreate path editor with disabled options
        if (pathEditor) {
            pathEditor = new YukaPathEditor(options.agent, options.scene, { 
                enableUI: false, 
                enableHandles: false, 
                camera: options.camera, 
                domElement: options.renderer.domElement
            });
        }
        // Clear navmesh visualization and stop chunk keys update
        if (sceneRef) clearNavMeshDebug(sceneRef);
        navMeshVizActive = false;
        stopChunkKeysUpdate();
    }
}

// Modularize Agent Management section content creation
function createAgentManagementSectionContent(container: HTMLElement) {
    // Agent dropdown
    const agentSelect = document.createElement('select');
    agentSelect.style.cssText = 'margin-bottom:8px; width: 100%; padding: 6px; background: #222; color: #fff; border-radius: 5px;';
    function updateAgentDropdown(agents: any[], selected: any) {
        agentSelect.innerHTML = '';
        agents.forEach((agent: any) => {
            if (!agent) return;
            const opt = document.createElement('option');
            opt.value = agent.uuid;
            opt.text = agent.name || agent.uuid;
            if (selected && agent.uuid === selected.uuid) opt.selected = true;
            agentSelect.appendChild(opt);
        });
    }
    agentSelect.onchange = (e) => {
        const agents = getAgents();
        const selectedAgent = agents.find((a: any) => a && a.uuid === agentSelect.value) || null;
        selectAgent(selectedAgent);
        emitEvent('agentSelected', selectedAgent);

        // Check if agent is selected and modules need setup
        if (selectedAgent && !yukaControls) { // Check yukaControls as a proxy for other modules
            if (sceneRef && cameraRef && rendererRef) {
                console.log('[YukaAIPanel] Agent selected for the first time, setting up AI modules.');
                setupAIModules(sceneRef, cameraRef, rendererRef); // Call setup with stored references
            } else {
                 console.warn('[YukaAIPanel] Cannot setup AI modules: Missing scene, camera, or renderer references.');
            }
        }
    };
    container.appendChild(agentSelect);
    // Spawn/Remove buttons
    const spawnButton = createStyledButton('Spawn Agent', async () => {
        try {
            // Get the required parameters from the panel's references
            if (!sceneRef || !cameraRef || !rendererRef?.domElement) {
                console.error('[YukaAIPanel] Missing required parameters for spawning agent');
                return;
            }
            const agent = await spawnAgent(sceneRef, cameraRef, rendererRef.domElement);
            if (agent) {
                console.log('[YukaAIPanel] Spawn Agent button triggered spawn and selection:', agent.name);
            } else {
                console.error('[YukaAIPanel] Failed to spawn agent via Agent Management button.');
            }
        } catch (error) {
            console.error('[YukaAIPanel] Error spawning agent via Agent Management button:', error);
        }
    });
    // Add the unique ID back to this specific spawn button
    spawnButton.id = 'spawn-agent-button';
    // Add some margin to separate it from the dropdown
    spawnButton.style.marginRight = '8px';
    container.appendChild(spawnButton);

    const removeBtn = createStyledButton('Remove Agent', () => {
        const selected = getSelectedAgent();
        if (selected) {
            removeAgent(selected);
            emitEvent('agentRemoved', selected);
            console.log('[YukaAIPanel] Removed agent:', selected.name);
        } else {
            console.warn('[YukaAIPanel] No agent selected to remove via Agent Management button.');
        }
    });
    container.appendChild(removeBtn);

    // --- Add Follow Agent button ---
    const followBtn = createStyledButton('Follow Agent', () => {
        const selected = getSelectedAgent();
        if (selected) {
            // Call the modified setCameraToFollowAgent in isolatedTerrainViewer
            if (window.isolatedTerrainViewer && typeof window.isolatedTerrainViewer.setCameraToFollowAgent === 'function') {
                window.isolatedTerrainViewer.setCameraToFollowAgent(selected);
                console.log('[YukaAIPanel] Follow Agent button clicked for agent:', selected.name || selected.uuid);
            } else {
                console.warn('[YukaAIPanel] isolatedTerrainViewer.setCameraToFollowAgent not available.');
            }
        } else {
            console.warn('[YukaAIPanel] No agent selected to follow.');
        }
    });
    followBtn.style.marginLeft = '8px';
    container.appendChild(followBtn);
    // Subscribe to agent changes
    onAgentChange(updateAgentDropdown);
    // Initial population
    updateAgentDropdown(getAgents(), getSelectedAgent());
}

// Modularize General Controls section content creation
function createGeneralControlsSectionContent(container: HTMLElement) {
    // Pause/Resume
    const pauseBtn = createStyledButton(getIsYukaSystemPaused() ? 'Resume' : 'Pause', () => {
        setIsYukaSystemPaused(!getIsYukaSystemPaused());
        pauseBtn.innerText = getIsYukaSystemPaused() ? 'Resume' : 'Pause';
    });
    pauseBtn.title = 'Pause or resume the Yuka AI system';
    container.appendChild(pauseBtn);
    // AI/Player Toggle
    const aiPlayerToggleBtn = createStyledButton('AI/Player Toggle', () => {
        const agent = getSelectedAgent();
        if (agent) {
            setAgentAIControlled((agent as any).uuid, !agent.isUnderAIControl());
        }
    });
    aiPlayerToggleBtn.title = 'Toggle between AI and player control for the selected agent';
    container.appendChild(aiPlayerToggleBtn);
    // Update button state on agent change
    function updateButtons() {
        const agent = getSelectedAgent();
        aiPlayerToggleBtn.disabled = !agent;
    }
    onAgentChange(updateButtons);
    updateButtons();

    // --- Time Scale Control ---
    const timeScaleDiv = document.createElement('div');
    timeScaleDiv.style.cssText = `
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed rgba(255,255,255,0.05);
    `;
    const timeScaleLabel = document.createElement('span');
    timeScaleLabel.innerText = 'Time Scale:';
    timeScaleLabel.style.color = '#a7c0c9';
    timeScaleDiv.appendChild(timeScaleLabel);

    const timeScaleValue = document.createElement('span');
    timeScaleValue.style.cssText = `
        margin-left: 8px;
        font-weight: bold;
        color: #e0e0e0;
    `;
    // Check if yukaTime and its timeScale property are available
    timeScaleValue.innerText = (yukaTime && (yukaTime as any).timeScale !== undefined) ? `${(yukaTime as any).timeScale.toFixed(2)}x` : 'Loading...';
    timeScaleDiv.appendChild(timeScaleValue);

    const timeScaleSlider = document.createElement('input');
    timeScaleSlider.type = 'range';
    timeScaleSlider.min = '0.1'; // Minimum time scale (e.g., slow motion)
    timeScaleSlider.max = '3.0'; // Maximum time scale (e.g., fast forward)
    timeScaleSlider.step = '0.01'; // Granularity
    // Set initial value if yukaTime and its timeScale are available
    timeScaleSlider.value = (yukaTime && (yukaTime as any).timeScale !== undefined) ? (yukaTime as any).timeScale.toString() : '1.0';
    timeScaleSlider.style.cssText = `
        width: 100%;
        margin-top: 5px;
    `;

    timeScaleSlider.oninput = () => {
        const scale = parseFloat(timeScaleSlider.value);
        // Assuming yukaTime is accessible globally or via yukaManager
        if (yukaTime) {
            (yukaTime as any).timeScale = scale;
            timeScaleValue.innerText = `${scale.toFixed(2)}x`;
        } else {
            console.warn('[YukaAIPanel] yukaTime not available to set time scale.');
        }
    };

    timeScaleDiv.appendChild(timeScaleSlider);
    container.appendChild(timeScaleDiv);

    // Disable slider initially if yukaTime or its timeScale are not available
    if (!yukaTime || (yukaTime as any).timeScale === undefined) {
        timeScaleSlider.disabled = true;
    }

     // Consider adding an event listener or a mechanism to enable the slider
     // and update the value display once yukaTime is confirmed to be initialized.
     // This is left as a potential future improvement for a fully reactive UI.
}

// Modularize Agent Info section content creation
function createAgentInfoSectionContent(container: HTMLElement, hasAgent: boolean) {
    // Info fields
    const infoFields = ['Name', 'UUID', 'Position', 'Velocity', 'Animation', 'State', 'Controlled By'];
    const infoSpansLocal: Record<string, HTMLElement> = {}; // Use a local variable
    infoFields.forEach(field => {
        const row = document.createElement('div');
        row.style.cssText = `
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            margin-bottom: 4px;
            border-bottom: 1px dashed rgba(255,255,255,0.05);
            padding-bottom: 4px;
        `;
        const label = document.createElement('span');
        label.innerText = field + ':';
        label.style.color = '#a7c0c9';
        label.style.textAlign = 'right';
        const value = document.createElement('span');
        value.innerText = '-';
        value.style.fontWeight = 'bold';
        value.style.color = '#e0e0e0';
        value.style.textAlign = 'left';
        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
        infoSpansLocal[field] = value;
    });
    // Editable fields
    const maxSpeedInput = document.createElement('input');
    maxSpeedInput.type = 'number';
    maxSpeedInput.step = '0.1';
    maxSpeedInput.classList.add('yuka-ui-button');
    maxSpeedInput.style.width = '60px';
    maxSpeedInput.style.marginLeft = '8px';
    maxSpeedInput.style.background = '#333';
    maxSpeedInput.style.color = '#fff';
    maxSpeedInput.style.border = '1px solid #555';
    maxSpeedInput.style.padding = '4px';
    maxSpeedInput.style.borderRadius = '4px';
    maxSpeedInput.title = 'Edit agent max speed';
    maxSpeedInput.onchange = () => {
        const agent = getSelectedAgent();
        if (agent) (agent as any).maxSpeed = parseFloat(maxSpeedInput.value);
    };
    const massInput = document.createElement('input');
    massInput.type = 'number';
    massInput.step = '0.1';
    massInput.classList.add('yuka-ui-button');
    massInput.style.width = '60px';
    massInput.style.marginLeft = '8px';
    massInput.style.background = '#333';
    massInput.style.color = '#fff';
    massInput.style.border = '1px solid #555';
    massInput.style.padding = '4px';
    massInput.style.borderRadius = '4px';
    massInput.title = 'Edit agent mass';
    massInput.onchange = () => {
        const agent = getSelectedAgent();
        if (agent) (agent as any).mass = parseFloat(massInput.value);
    };
    const editableRow = document.createElement('div');
    editableRow.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        align-items: center;
    `;
    editableRow.innerHTML = '<span>Edit Max Speed:</span>';
    editableRow.appendChild(maxSpeedInput);
    container.appendChild(editableRow);
    const editableRow2 = document.createElement('div');
    editableRow2.style.cssText = `
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        align-items: center;
    `;
    editableRow2.innerHTML = '<span>Edit Mass:</span>';
    editableRow2.appendChild(massInput);
    container.appendChild(editableRow2);
    
    // Teleport Controls
    const teleportDiv = document.createElement('div');
    teleportDiv.style.cssText = `
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed rgba(255,255,255,0.05);
    `;
    const teleportLabel = document.createElement('span');
    teleportLabel.innerText = 'Teleport To:';
    teleportLabel.style.color = '#a7c0c9';
    teleportDiv.appendChild(teleportLabel);

    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
        display: flex;
        gap: 5px;
        margin-top: 5px;
    `;

    const createCoordInput = (placeholder: string, disabled: boolean) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.placeholder = placeholder;
        input.classList.add('yuka-ui-button');
        input.style.flexGrow = '1';
        input.style.background = '#333';
        input.style.color = '#fff';
        input.style.border = '1px solid #555';
        input.style.padding = '4px';
        input.style.borderRadius = '4px';
        input.style.textAlign = 'center';
        input.disabled = disabled;
        return input;
    };

    const teleportInputX = createCoordInput('X', !hasAgent);
    const teleportInputY = createCoordInput('Y', !hasAgent);
    const teleportInputZ = createCoordInput('Z', !hasAgent);

    inputContainer.appendChild(teleportInputX);
    inputContainer.appendChild(teleportInputY);
    inputContainer.appendChild(teleportInputZ);
    teleportDiv.appendChild(inputContainer);

    const teleportButton = createStyledButton('Teleport', () => {
        const agent = getSelectedAgent();
        if (agent) {
            const x = parseFloat(teleportInputX.value);
            const y = parseFloat(teleportInputY.value);
            const z = parseFloat(teleportInputZ.value);
            if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                // Assuming agent has a method to set position, e.g., agent.position.set(x, y, z)
                // Note: In this project, position updates are often handled by the physics system
                // We might need a specific method in aiAgentManager or IsolatedYukaCharacter
                // For now, let's log and assume a method will be added or found.
                 console.log(`[YukaAIPanel] Attempting to teleport agent ${agent.uuid} to (${x}, ${y}, ${z})`);
                 // TODO: Implement actual teleport logic in aiAgentManager or IsolatedYukaCharacter
                 // Example: (agent as any).position.set(x, y, z); 
                 // Need to also update the physics state if applicable.
                 emitEvent('teleportAgent', { agentUUID: agent.uuid, position: { x, y, z } });
            } else {
                console.warn('[YukaAIPanel] Invalid coordinates for teleport.');
            }
        } else {
            console.warn('[YukaAIPanel] No agent selected to teleport.');
        }
    });
    teleportButton.style.marginTop = '8px';
    teleportButton.disabled = !hasAgent;
    teleportDiv.appendChild(teleportButton);

    container.appendChild(teleportDiv);
    
    // Disable inputs if no agent
    maxSpeedInput.disabled = !hasAgent;
    massInput.disabled = !hasAgent;
    
    // Return elements to be stored at module level
    return { infoSpans: infoSpansLocal, maxSpeedInput, massInput, teleportInputs: { x: teleportInputX, y: teleportInputY, z: teleportInputZ }, teleportButton };
}

// Moved updateInfo function to module level
function updateInfo(spans: Record<string, HTMLElement>, maxSpeedIn: HTMLInputElement | null, massIn: HTMLInputElement | null) {
        const agent: any = getSelectedAgent();
        if (agent) {
        spans['Name'].innerText = agent.name || '-';
        spans['UUID'].innerText = agent.uuid || '-';
        spans['Position'].innerText = agent.position ? `${agent.position.x.toFixed(2)}, ${agent.position.y.toFixed(2)}, ${agent.position.z.toFixed(2)}` : '-';
        spans['Velocity'].innerText = agent.velocity ? `${agent.velocity.x.toFixed(2)}, ${agent.velocity.y.toFixed(2)}, ${agent.velocity.z.toFixed(2)}` : '-';
        spans['Animation'].innerText = agent.currentAnimation || '-';
        spans['State'].innerText = agent.stateMachine && agent.stateMachine.currentState && agent.stateMachine.currentState.getName ? agent.stateMachine.currentState.getName() : '-';
        spans['Controlled By'].innerText = agent.isUnderAIControl ? (agent.isUnderAIControl() ? 'AI' : 'Player') : '-';
        if (maxSpeedIn) maxSpeedIn.value = (agent as any).maxSpeed !== undefined ? (agent as any).maxSpeed.toFixed(2) : '';
        if (massIn) massIn.value = (agent as any).mass !== undefined ? (agent as any).mass.toFixed(2) : '';
        } else {
        Object.values(spans).forEach((span: any) => (span.innerText = '-'));
        if (maxSpeedIn) maxSpeedIn.value = '';
        if (massIn) massIn.value = '';
    }
}

// Modularize Navigation Mesh section content creation
function createNavigationMeshSectionContent(container: HTMLElement, options: YukaAIPanelOptions) {
     const navMeshBtn = createStyledButton('Show/Hide NavMesh', () => {
        yukaDebugger?.toggleNavMesh();
    });
    container.appendChild(navMeshBtn);
    const regenNavMeshBtn = createStyledButton('Regenerate NavMesh', () => {
        // Use the passed options for scene and chunkMeshes
        const currentNavMeshHelper = getNavMeshHelper(options.scene);
        currentNavMeshHelper?.generateNavMesh(options.chunkMeshes, 45, true).catch(error => {
                    console.error('[YukaAiPanel] NavMesh generation failed:', error);
                });
    });
    container.appendChild(regenNavMeshBtn);
    const navMeshStats = document.createElement('div');
    navMeshStats.style.cssText = `
        margin-top: 8px;
        color: #a7c0c9;
    `;
    navMeshStats.innerText = 'Regions: -';
    container.appendChild(navMeshStats);

    // Capture reference for updates
    navMeshStatsDisplay = navMeshStats;

    // NOTE: Need to add update logic for navMeshStats
}

// Modularize Terrain Chunks / NavMesh Debug section content creation
function createTerrainDebugSectionContent(container: HTMLElement) {
    // Loaded Chunk Keys Display
    const chunkKeysDiv = document.createElement('div');
    chunkKeysDiv.style.cssText = `
        margin-top: 8px;
        color: #e0e0e0;
    `;
    chunkKeysDiv.innerHTML = '<strong>Loaded Chunks:</strong> <span class="chunk-count">0</span> chunks - <span class="chunk-keys">None</span>';
    chunkKeysDisplay = chunkKeysDiv.querySelector('.chunk-keys') || document.createElement('span'); // Get or create span for keys
    chunkCountDisplay = chunkKeysDiv.querySelector('.chunk-count') || document.createElement('span'); // Get or create span for count
    if (!chunkKeysDiv.querySelector('.chunk-keys')) chunkKeysDiv.appendChild(chunkKeysDisplay);
    if (!chunkKeysDiv.querySelector('.chunk-count')) chunkKeysDiv.appendChild(chunkCountDisplay);
    container.appendChild(chunkKeysDiv);

    // Toggle Chunk Wireframe Button with checkbox
    const wireframeContainer = document.createElement('div');
    wireframeContainer.style.cssText = `
        display: flex;
        align-items: center;
        margin-top: 8px;
        margin-bottom: 8px;
    `;

    const wireframeCheckbox = document.createElement('input');
    wireframeCheckbox.type = 'checkbox';
    wireframeCheckbox.style.marginRight = '8px';
    wireframeCheckbox.onchange = (e) => {
        const enabled = (e.target as HTMLInputElement).checked;
        console.log('[YukaAIPanel] Toggling wireframe via IsolatedTerrainViewer:', enabled);
        if (window.isolatedTerrainViewer?.setWireframeEnabled) {
            window.isolatedTerrainViewer.setWireframeEnabled(enabled);
        } else {
            console.warn('[YukaAIPanel] window.isolatedTerrainViewer.setWireframeEnabled not available.');
        }
    };

    const wireframeLabel = document.createElement('label');
    wireframeLabel.textContent = 'Toggle Chunk Wireframe';
    wireframeLabel.style.cursor = 'pointer';
    wireframeLabel.style.color = '#e0e0e0';

    wireframeContainer.appendChild(wireframeCheckbox);
    wireframeContainer.appendChild(wireframeLabel);
    container.appendChild(wireframeContainer);

    // Toggle NavMesh Visualization Button
    const toggleNavMeshVizBtn = createStyledButton('Show NavMesh Viz', () => {
        const currentNavMeshHelper = getNavMeshHelper();
        if (!currentNavMeshHelper || !sceneRef) {
            console.warn('[YukaAIPanel] NavMesh helper or Scene not available for visualization.');
            return;
        }
        if (navMeshVizActive) {
            clearNavMeshDebug(sceneRef);
            navMeshVizActive = false;
            toggleNavMeshVizBtn.innerText = 'Show NavMesh Viz';
        } else {
            // Force update the nav mesh with visualization
            const activeChunkMeshes = getActiveChunkMeshesForCollision();
            if (activeChunkMeshes) {
                currentNavMeshHelper.update(activeChunkMeshes, true);
            } else {
                console.warn('[YukaAIPanel] No active chunk meshes available for NavMesh visualization update.');
            }
            navMeshVizActive = true;
            toggleNavMeshVizBtn.innerText = 'Hide NavMesh Viz';
        }
    });
    container.appendChild(toggleNavMeshVizBtn);

    // Note: Need to ensure updateChunkKeysDisplay can still access chunkKeysDisplay and chunkCountDisplay
}

// Modularize Pathfinding section content creation
function createPathfindingSectionContent(container: HTMLElement) {
    const showPathBtn = createStyledButton('Show/Hide Path', () => {
        yukaControls?.togglePathViz();
    });
    container.appendChild(showPathBtn);
    const setDestBtn = createStyledButton('Set Destination', () => {
        yukaControls?.toggleSetDestination();
    });
    container.appendChild(setDestBtn);
    const clickToMoveBtn = createStyledButton('Click-to-Move', () => {
        yukaControls?.toggleClickToMove();
    });
    container.appendChild(clickToMoveBtn);
    const pathPointsListElement = document.createElement('div'); // Use a distinct name to avoid conflict if needed later
    pathPointsListElement.style.cssText = `
        margin-top: 8px;
        color: #a7c0c9;
    `;
    pathPointsListElement.innerText = 'Path Points: -';
    container.appendChild(pathPointsListElement);

    // Assign to the module-level variable
    pathPointsList = pathPointsListElement;

    // NOTE: Need to ensure update logic for pathPointsList exists and is called
}

// Modularize Steering section content creation
function createSteeringSectionContent(container: HTMLElement) {
    const toggleForcesBtn = createStyledButton('Toggle Force Arrows', () => {
        if (steeringDebug) {
            const current = (steeringDebug as any).options?.showForces ?? false;
            steeringDebug.toggleForces(!current);
        }
    });
    container.appendChild(toggleForcesBtn);
    const toggleBehaviorsBtn = createStyledButton('Toggle Behaviors', () => {
        if (steeringDebug) {
            const current = (steeringDebug as any).options?.showBehaviors ?? false;
            steeringDebug.toggleBehaviors(!current);
        }
    });
    container.appendChild(toggleBehaviorsBtn);
    const behaviorsList = document.createElement('div');
    behaviorsList.style.cssText = `
        margin-top: 8px;
        color: #a7c0c9;
    `;
    behaviorsList.innerText = 'Behaviors: -';
    container.appendChild(behaviorsList);

    // --- Add Behavior Control ---
    const addBehaviorDiv = document.createElement('div');
    addBehaviorDiv.style.cssText = `
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px dashed rgba(255,255,255,0.05);
        display: flex;
        gap: 5px;
        align-items: center;
    `;

    const behaviorSelect = document.createElement('select');
    behaviorSelect.style.cssText = 'flex-grow: 1; padding: 6px; background: #222; color: #fff; border-radius: 5px; border: 1px solid #555;';

    // Populate dropdown with common Yuka behaviors (add more as needed)
    const availableBehaviors = [
        { value: 'ArriveBehavior', text: 'Arrive' },
        { value: 'SeekBehavior', text: 'Seek' },
        { value: 'FleeBehavior', text: 'Flee' },
        { value: 'WanderBehavior', text: 'Wander' },
        { value: 'PursuitBehavior', text: 'Pursuit' },
        { value: 'EvadeBehavior', text: 'Evade' },
        // Add more behaviors here
    ];

    availableBehaviors.forEach(behavior => {
        const option = document.createElement('option');
        option.value = behavior.value;
        option.text = behavior.text;
        behaviorSelect.appendChild(option);
    });

    const addBehaviorButton = createStyledButton('Add', () => {
        const agent = getSelectedAgent();
        const behaviorType = behaviorSelect.value;
        if (agent && behaviorType) {
            console.log(`[YukaAIPanel] Attempting to add behavior ${behaviorType} to agent ${agent.uuid}`);
            // Emit event to add the behavior - actual logic handled elsewhere
            emitEvent('addSteeringBehavior', { agentUUID: agent.uuid, behaviorType: behaviorType });
        } else if (!agent) {
            console.warn('[YukaAIPanel] No agent selected to add behavior.');
        } else {
            console.warn('[YukaAIPanel] No behavior type selected.');
        }
    });
    addBehaviorButton.classList.add('yuka-ui-button');
    addBehaviorButton.style.width = 'auto';
    addBehaviorButton.style.padding = '6px 12px';

    addBehaviorDiv.appendChild(behaviorSelect);
    addBehaviorDiv.appendChild(addBehaviorButton);
    container.appendChild(addBehaviorDiv);

    // Disable controls if no agent selected (handled by onAgentChange listener)
    behaviorSelect.disabled = !getSelectedAgent();
    addBehaviorButton.disabled = !getSelectedAgent();

    // NOTE: Need to ensure update logic for behaviorsList exists and is called

    // Return elements to be stored at module level
    return { behaviorSelect, addBehaviorButton };
}

// Modularize State Machine section content creation
function createStateMachineSectionContent(container: HTMLElement) {
    const toggleCurrentStateBtn = createStyledButton('Toggle Current State', () => {
        if (stateMachineDebug) stateMachineDebug.toggleCurrentStateVisibility(!(stateMachineDebug as any).options.showCurrentState);
    });
    container.appendChild(toggleCurrentStateBtn);
    const toggleGraphBtn = createStyledButton('Toggle State Graph', () => {
        if (stateMachineDebug) stateMachineDebug.toggleGraphVisibility(!(stateMachineDebug as any).options.showGraph);
    });
    container.appendChild(toggleGraphBtn);
    const stateInfo = document.createElement('div');
    stateInfo.style.cssText = `
        margin-top: 8px;
        color: #a7c0c9;
    `;
    stateInfo.innerText = 'Current State: -';
    container.appendChild(stateInfo);

     // NOTE: Need to ensure update logic for stateInfo exists and is called
}

// Modularize Debug/Logs section content creation
function createDebugLogSectionContent(container: HTMLElement): HTMLElement {
    container.innerHTML = `
        <div style="background: #18c20; padding: 10px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
            Debug logs will appear here...
        </div>
    `;
    return container;
}

// --- Chunk Keys Update Functions ---
let chunkKeysUpdateInterval: number | null = null;

function updateChunkKeysDisplay() {
    try {
        let chunkMeshes: Record<string, any> = {};
        // Prefer the global IsolatedTerrainViewer's active chunk meshes
        if (window.isolatedTerrainViewer?.getActiveChunkMeshesForCollision) {
            chunkMeshes = window.isolatedTerrainViewer.getActiveChunkMeshesForCollision();
        } else if (window.isolatedTerrainViewer?.currentChunkMeshesForCollision) {
            // Fallback: If getActiveChunkMeshesForCollision is not yet available, use the directly stored reference.
            // This might happen during initialization.
            chunkMeshes = window.isolatedTerrainViewer.currentChunkMeshesForCollision;
        } else if (window.isolatedTerrainViewer?.terrainLoader?.getChunkMeshes) {
            // Fallback: If neither of the above are available, try the terrainLoader
            chunkMeshes = window.isolatedTerrainViewer.terrainLoader.getChunkMeshes();
        }
        // Only count/display chunks with a real mesh
        const meshKeys = Object.keys(chunkMeshes).filter(key => chunkMeshes[key]);
        const chunkCount = meshKeys.length;

        // Update count display
        if (chunkCountDisplay) {
            chunkCountDisplay.textContent = `${chunkCount}`;
            // Visual feedback based on chunk count
            if (chunkCount === 0) {
                chunkCountDisplay.style.color = 'red';
            } else if (chunkCount > 0) { // Check if any chunks are loaded
                chunkCountDisplay.style.color = 'lightgreen'; // Indicate chunks are loaded
            } else if (chunkCount > 100) {
                chunkCountDisplay.style.color = 'orange';
            } else {
                chunkCountDisplay.style.color = 'blue';
            }
        }

        // Update keys display
        if (chunkKeysDisplay) {
            if (meshKeys.length === 0) {
                chunkKeysDisplay.textContent = 'None';
            } else {
                // Show first 3 chunks and count of remaining
                const firstThree = meshKeys.slice(0, 3);
                const remaining = meshKeys.length - 3;
                const displayText = firstThree.join(', ') + (remaining > 0 ? ` + ${remaining} more` : '');
                chunkKeysDisplay.textContent = displayText;
            }
        }
         console.log('[YukaAIPanel] updateChunkKeysDisplay: Found and displayed', chunkCount, 'chunks.');
    } catch (error) {
        console.error('[YukaAIPanel] Error updating chunk display:', error);
    }
}

function startChunkKeysUpdate() {
    if (chunkKeysUpdateInterval) return;
    terrainLoaderRetryCount = 0; // Reset retry count when starting updates
    updateChunkKeysDisplay(); // Initial update
    chunkKeysUpdateInterval = window.setInterval(updateChunkKeysDisplay, 100); // Update more frequently
}

function stopChunkKeysUpdate() {
    if (chunkKeysUpdateInterval) {
        window.clearInterval(chunkKeysUpdateInterval);
        chunkKeysUpdateInterval = null;
    }
}

// --- SETUP AI MODULES WITH DELAYED INITIALIZATION ---
const setupAIModules = (scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
    // Initialize worker pool if not already initialized
    initializeWorkerPool();

    // Initialize YukaAIControls
    yukaControls = new YukaAIControls(
        getSelectedAgent(),
        scene,
        null, // We'll handle nav mesh data through the worker pool
        camera,
        renderer,
        { container: yukaPanelInstance || undefined }
    );

    // Initialize YukaDebugger
    yukaDebugger = new YukaDebugger(
        getSelectedAgent(),
        scene,
        null, // We'll handle nav mesh data through the worker pool
        camera,
        renderer,
        yukaPanelInstance || undefined
    );

    // Initialize YukaSteeringDebug
    steeringDebug = new YukaSteeringDebug(
        getSelectedAgent(),
        scene,
        { showForces: false, showBehaviors: false }
    );

    // Initialize YukaStateMachineDebug
    stateMachineDebug = new YukaStateMachineDebug(
        getSelectedAgent(),
        camera as THREE.PerspectiveCamera,
        renderer.domElement,
        scene,
        { showGraph: false, showCurrentState: false }
    );

    // Initialize YukaPathEditor
    pathEditor = new YukaPathEditor(
        getSelectedAgent(),
        scene,
        { 
            enableUI: false, 
            enableHandles: false, 
            camera: camera, 
            domElement: renderer.domElement 
        }
    );

    // Start chunk keys update
    startChunkKeysUpdate();
};

// --- Live Update Logic for Dynamic Sections ---
let pathPointsUpdateInterval: number | null = null;
let behaviorsUpdateInterval: number | null = null;
let stateInfoUpdateInterval: number | null = null;

function updatePathPointsList() {
    if (!pathPointsList) return;
    const agent = getSelectedAgent();
    const activePathData = (agent && (agent as any).activePathData) ? (agent as any).activePathData : null;
    if (activePathData && Array.isArray(activePathData.path)) {
        const path = activePathData.path;
        const idx = activePathData.currentIndex ?? 0;
        pathPointsList.innerText = `Path Points: ${path.length} (Current: ${idx + 1})`;
    } else {
        pathPointsList.innerText = 'Path Points: -';
    }
}

function updateBehaviorsList() {
    const steeringContent = document.querySelector('#yuka-ai-panel .Steering') || document.body;
    const behaviorsList = steeringContent.querySelector('div[style*="Behaviors"]') as HTMLElement;
    if (!behaviorsList) return;
    const agent = getSelectedAgent();
    if (agent && agent.steering && Array.isArray(agent.steering.behaviors)) {
        const active = agent.steering.behaviors.filter((b: any) => b.active).map((b: any) => b.constructor.name);
        behaviorsList.innerText = active.length ? `Behaviors: ${active.join(', ')}` : 'Behaviors: None';
    } else {
        behaviorsList.innerText = 'Behaviors: -';
    }
}

function updateStateInfo() {
    const stateMachineContent = document.querySelector('#yuka-ai-panel .StateMachine') || document.body;
    const stateInfo = stateMachineContent.querySelector('div[style*="Current State"]') as HTMLElement;
    if (!stateInfo) return;
    const agent = getSelectedAgent();
    if (agent && agent.stateMachine && agent.stateMachine.currentState) {
        stateInfo.innerText = `Current State: ${agent.stateMachine.currentState.getName ? agent.stateMachine.currentState.getName() : agent.stateMachine.currentState.constructor.name}`;
    } else {
        stateInfo.innerText = 'Current State: -';
    }
}

function updateNavMeshStats(data: { regionsCount: number }) {
    if (navMeshStatsDisplay) {
        navMeshStatsDisplay.innerText = `Regions: ${data.regionsCount}`;
    }
}

// Debug Log Panel logic
let logPanelRef: HTMLElement | null = null;
function appendToDebugLog(msg: string) {
    if (!logPanelRef) return;
    logPanelRef.innerText += `\n${msg}`;
    logPanelRef.scrollTop = logPanelRef.scrollHeight;
}
(function() {
    // ... existing code ...
    (window as any).appendToYukaDebugLog = appendToDebugLog;
    // ... existing code ...
})();

// Hook up log panel ref after creation
setTimeout(() => {
    const debugLogContent = document.querySelector('#yuka-ai-panel .DebugLogs') || document.body;
    logPanelRef = debugLogContent.querySelector('div[style*="background: #18c20"]') as HTMLElement;
    // Initial log message
    appendToDebugLog('Yuka AI Panel Debug Logs:');
}, 100);

// Subscribe to events
onAgentChange((agents, selected) => {
    // Update info sections that depend on selected agent
    updateInfo(agentInfoSpans, agentMaxSpeedInput, agentMassInput);

    updatePathPointsList(); // Update path points display
    updateBehaviorsList(); // Update behaviors list
    updateStateInfo(); // Update state info

    // Enable/disable teleport inputs and button based on selected agent
    const hasAgent = !!selected;
    if (agentTeleportInputs) {
        agentTeleportInputs.x.disabled = !hasAgent;
        agentTeleportInputs.y.disabled = !hasAgent;
        agentTeleportInputs.z.disabled = !hasAgent;
    }
    if (agentTeleportButton) {
        (agentTeleportButton as HTMLButtonElement).disabled = !hasAgent;
    }

    // Enable/disable steering behavior controls using module-level variables
    if (steeringBehaviorSelect) steeringBehaviorSelect.disabled = !hasAgent;
    if (addBehaviorButtonElement) addBehaviorButtonElement.disabled = !hasAgent;
});

onEvent('pathUpdated', updatePathPointsList); // Subscribe to path updated event
onEvent('pathCleared', updatePathPointsList); // Subscribe to path cleared event
onEvent('yukaAgentStateChanged', updateStateInfo); // Subscribe to state changes
onEvent('navMeshGenerated', updateNavMeshStats); // Subscribe to nav mesh generated event
onEvent('agentAIControlChanged', () => { // Subscribe to AI control changes
    // Re-run updateInfo using module-level variables
    updateInfo(agentInfoSpans, agentMaxSpeedInput, agentMassInput);
});

// Remove polling as event-driven updates are in place
if (pathPointsUpdateInterval) clearInterval(pathPointsUpdateInterval);
pathPointsUpdateInterval = null;
if (behaviorsUpdateInterval) clearInterval(behaviorsUpdateInterval);
behaviorsUpdateInterval = null;
if (stateInfoUpdateInterval) clearInterval(stateInfoUpdateInterval);
stateInfoUpdateInterval = null;

// Optionally, listen for log events (already done)
// onEvent && onEvent('log', appendToDebugLog);

// Cleanup intervals on panel cleanup
const oldCleanup = baseCleanupYukaAIPanel;
function cleanupYukaAIPanelWithIntervals() {
    // Polling intervals are removed, so no intervals to clear here anymore
    oldCleanup();
}
export { cleanupYukaAIPanelWithIntervals as cleanupYukaAIPanel };

// Insert the original cleanup logic as a new function:
function baseCleanupYukaAIPanel() {
    if (yukaPanelInstance && yukaPanelInstance.parentElement) {
        yukaPanelInstance.parentElement.removeChild(yukaPanelInstance);
    }
    yukaPanelInstance = null;
    yukaControls = null;
    yukaDebugger = null;
    steeringDebug = null;
    stateMachineDebug = null;
    pathEditor = null;
    // Clear navmesh visualization and stop chunk keys update
    if (sceneRef) clearNavMeshDebug(sceneRef);
    navMeshVizActive = false;
    stopChunkKeysUpdate();

    // Clear stored scene reference
    sceneRef = null;
    cameraRef = null;
    rendererRef = null;
}

function createStateManagementSectionContent(container: HTMLElement) {
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="state-controls" style="display: flex; gap: 5px; margin-bottom: 10px;">
            <button id="setIdleState" style="flex: 1; padding: 5px; background: #444; border: 1px solid #666; color: white; cursor: pointer;">Idle</button>
            <button id="setPatrolState" style="flex: 1; padding: 5px; background: #444; border: 1px solid #666; color: white; cursor: pointer;">Patrol</button>
            <button id="setChaseState" style="flex: 1; padding: 5px; background: #444; border: 1px solid #666; color: white; cursor: pointer;">Chase</button>
            <button id="setFleeState" style="flex: 1; padding: 5px; background: #444; border: 1px solid #666; color: white; cursor: pointer;">Flee</button>
        </div>
        <div id="stateTargetInputs" style="display: none; background: #333; padding: 10px; border-radius: 3px; margin-top: 10px;">
            <h4 style="margin: 0 0 10px 0; color: #e0e0e0;">Target Position</h4>
            <div style="display: flex; gap: 5px; margin-bottom: 5px;">
                <input type="number" id="targetX" placeholder="X" step="0.1" style="width: 60px; padding: 3px;">
                <input type="number" id="targetY" placeholder="Y" step="0.1" style="width: 60px; padding: 3px;">
                <input type="number" id="targetZ" placeholder="Z" step="0.1" style="width: 60px; padding: 3px;">
            </div>
            <button id="confirmTarget" style="width: 100%; padding: 5px; background: #444; border: 1px solid #666; color: white; cursor: pointer;">Set Target</button>
        </div>
    `;

    let currentState: string | null = null;

    function showTargetInputs(show: boolean) {
        const targetDiv = content.querySelector('#stateTargetInputs') as HTMLElement;
        if (targetDiv) {
            targetDiv.style.display = show ? 'block' : 'none';
        }
    }

    function setAgentState(state: string) {
        if (!selectedAgentUUID) {
            console.warn('[YukaAIPanel] No agent selected');
            return;
        }

        currentState = state;
        const needsTarget = state === 'chase' || state === 'flee';
        showTargetInputs(needsTarget);

        if (!needsTarget) {
            emitEvent('setAgentState', {
                agentUUID: selectedAgentUUID,
                state: state
            });
        }
    }

    // Add click handlers for state buttons
    content.querySelector('#setIdleState')?.addEventListener('click', () => setAgentState('idle'));
    content.querySelector('#setPatrolState')?.addEventListener('click', () => setAgentState('patrol'));
    content.querySelector('#setChaseState')?.addEventListener('click', () => setAgentState('chase'));
    content.querySelector('#setFleeState')?.addEventListener('click', () => setAgentState('flee'));

    // Add click handler for target confirmation
    content.querySelector('#confirmTarget')?.addEventListener('click', () => {
        if (!selectedAgentUUID || !currentState) return;

        const x = parseFloat((content.querySelector('#targetX') as HTMLInputElement).value);
        const y = parseFloat((content.querySelector('#targetY') as HTMLInputElement).value);
        const z = parseFloat((content.querySelector('#targetZ') as HTMLInputElement).value);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.warn('[YukaAIPanel] Invalid target coordinates');
            return;
        }

        emitEvent('setAgentState', {
            agentUUID: selectedAgentUUID,
            state: currentState,
            target: { x, y, z }
        });

        showTargetInputs(false);
    });

    return content;
}