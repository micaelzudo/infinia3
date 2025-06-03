import * as THREE from 'three';
import { getSelectedAgent, getAgents, onAgentChange, spawnAgent, removeAgent, selectAgent } from './agentService';
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';
import { getIsYukaSystemPaused, setIsYukaSystemPaused, isDebugMode, setDebugMode } from './yukaManager';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

export class YukaAIControls {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private agent: IsolatedYukaCharacter | null;
    private navMesh: any;
    private chunkMeshes: Record<string, THREE.Mesh>;
    private sections: Map<string, HTMLElement> = new Map();
    private updateInterval: number | null = null;
    // References to agent info display elements
    private agentNameElement: HTMLElement | null = null;
    private agentUUIDElement: HTMLElement | null = null;
    private agentPositionElement: HTMLElement | null = null;
    private agentVelocityElement: HTMLElement | null = null;
    private agentAnimationElement: HTMLElement | null = null;
    private agentStateElement: HTMLElement | null = null;
    private agentControlledByElement: HTMLElement | null = null;
    private currentSelectedAgent: IsolatedYukaCharacter | null = null;
    private agentChangeListener: ((agents: IsolatedYukaCharacter[], selected: IsolatedYukaCharacter | null) => void) | null = null;

    constructor(scene: THREE.Scene, camera: THREE.Camera, agent: IsolatedYukaCharacter | null, navMesh: any, chunkMeshes: Record<string, THREE.Mesh>) {
        this.scene = scene;
        this.camera = camera;
        this.agent = agent;
        this.navMesh = navMesh;
        this.chunkMeshes = chunkMeshes;

        this.container = document.createElement('div');
        this.container.id = 'yuka-ai-controls';
        this.initializeContainer();
        this.initializeControls();

        // Initialize agent change listener
        this.agentChangeListener = (agents, selected) => {
            this.currentSelectedAgent = selected;
            console.log('[YukaAIControls Listener] Agent change detected. Selected:', selected);
            this.update(); // Trigger UI update when selected agent changes
        };
        onAgentChange(this.agentChangeListener);

        // Perform initial selection check and UI update
        this.currentSelectedAgent = getSelectedAgent();
        console.log('[YukaAIControls Constructor] Initial selected agent check:', this.currentSelectedAgent);
        this.update(); // Initial UI update

        this.startUpdateLoop(); // Start the update loop
    }

    private initializeContainer(): void {
        this.container.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background-color: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            color: white;
            font-family: 'Roboto Mono', monospace;
            font-size: 14px;
            z-index: 1000;
            min-width: 300px;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
    }

    private createSection(title: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'control-section';
        section.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background-color: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        `;

        const header = document.createElement('h3');
        header.textContent = title;
        header.style.cssText = `
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #4CAF50;
        `;
        section.appendChild(header);

        this.sections.set(title, section);
        return section;
    }

    private initializeControls(): void {
        // System Controls Section
        const systemSection = this.createSection('System Controls');
        this.initializeSystemControls(systemSection);
        this.container.appendChild(systemSection);

        // Agent Controls Section
        const agentSection = this.createSection('Agent Controls');
        this.initializeAgentControls(agentSection);
        this.container.appendChild(agentSection);

        // Navigation Controls Section
        const navSection = this.createSection('Navigation Controls');
        this.initializeNavigationControls(navSection);
        this.container.appendChild(navSection);

        // Debug Controls Section
        const debugSection = this.createSection('Debug Controls');
        this.initializeDebugControls(debugSection);
        this.container.appendChild(debugSection);

        // Agent Info Section - Initialize and store references
        const agentInfoSection = this.createSection('Agent Info');
        this.initializeAgentInfoDisplay(agentInfoSection);
        this.container.appendChild(agentInfoSection);
    }

    private initializeSystemControls(section: HTMLElement): void {
        // Pause/Resume Button
        const pauseButton = createStyledButton(
            getIsYukaSystemPaused() ? 'Resume System' : 'Pause System',
            () => {
                setIsYukaSystemPaused(!getIsYukaSystemPaused());
                pauseButton.textContent = getIsYukaSystemPaused() ? 'Resume System' : 'Pause System';
            }
        );
        section.appendChild(pauseButton);

        // Debug Mode Toggle
        const debugButton = createStyledButton(
            isDebugMode() ? 'Disable Debug' : 'Enable Debug',
            () => {
                setDebugMode(!isDebugMode());
                debugButton.textContent = isDebugMode() ? 'Disable Debug' : 'Enable Debug';
            }
        );
        section.appendChild(debugButton);
    }

    private initializeAgentControls(section: HTMLElement): void {
        // Spawn Agent Button
        const spawnAgentButton = createStyledButton('Spawn Agent', async () => {
            console.log('[YukaAIControls] Spawn Agent button clicked.');
            // Assuming spawnAgent needs the scene and chunkMeshes for initialization
            // Adjust arguments based on actual spawnAgent signature if needed.
            const newAgent = await spawnAgent(this.scene, this.chunkMeshes);
            if (newAgent) {
                // Explicitly select the agent after spawning via the UI button
                selectAgent(newAgent);
                console.log('[YukaAIControls] spawnAgent call completed. New agent:', newAgent.name);
                console.log('[YukaAIControls] Spawned and selected agent:', newAgent.name);
            }
        });
        section.appendChild(spawnAgentButton);

        // Remove Agent Button
        const removeAgentButton = createStyledButton('Remove Agent', () => {
            const selectedAgent = this.currentSelectedAgent; // Use the stored selected agent
            if (selectedAgent) {
                removeAgent(selectedAgent);
                console.log('[YukaAIControls] Removed selected agent:', selectedAgent.name);
            } else {
                console.warn('[YukaAIControls] No agent selected to remove.');
            }
        });
        section.appendChild(removeAgentButton);

        // AI Control Toggle
        const aiControlButton = createStyledButton('Toggle AI Control', () => {
            const selectedAgent = getSelectedAgent();
            if (selectedAgent) {
                selectedAgent.setAIControlled(!selectedAgent.aiControlled);
                aiControlButton.textContent = selectedAgent.aiControlled ? 'Disable AI Control' : 'Enable AI Control';
            }
        });
        section.appendChild(aiControlButton);

        // Movement Speed Control
        const speedControl = this.createSliderControl('Movement Speed', 1, 10, 5, (value) => {
            const selectedAgent = getSelectedAgent();
            if (selectedAgent) {
                selectedAgent.maxSpeed = value;
            }
        });
        section.appendChild(speedControl);

        // Rotation Speed Control
        const rotationControl = this.createSliderControl('Rotation Speed', 1, 10, 5, (value) => {
            const selectedAgent = getSelectedAgent();
            if (selectedAgent) {
                // Use the rotation speed from the vehicle
                (selectedAgent as any).rotationSpeed = value;
            }
        });
        section.appendChild(rotationControl);

        // Behavior Selection
        const behaviorSelect = document.createElement('select');
        behaviorSelect.style.cssText = `
            width: 100%;
            margin-top: 10px;
            padding: 5px;
            background-color: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        `;
        behaviorSelect.innerHTML = `
            <option value="wander">Wander</option>
            <option value="seek">Seek</option>
            <option value="arrive">Arrive</option>
            <option value="follow">Follow</option>
        `;
        behaviorSelect.onchange = () => {
            const selectedAgent = getSelectedAgent();
            if (selectedAgent) {
                selectedAgent.activateBehavior(behaviorSelect.value);
            }
        };
        section.appendChild(behaviorSelect);
    }

    private initializeNavigationControls(section: HTMLElement): void {
        // Path Visualization Toggle
        const pathVizButton = createStyledButton('Toggle Path Visualization', () => {
            // Implement path visualization toggle
        });
        section.appendChild(pathVizButton);

        // NavMesh Visualization Toggle
        const navMeshVizButton = createStyledButton('Toggle NavMesh Visualization', () => {
            // Implement navmesh visualization toggle
        });
        section.appendChild(navMeshVizButton);
    }

    private initializeAgentInfoDisplay(section: HTMLElement): void {
        this.agentNameElement = this.createLabelValuePair(section, 'Name:', 'agent-name');
        this.agentUUIDElement = this.createLabelValuePair(section, 'UUID:', 'agent-uuid');
        this.agentPositionElement = this.createLabelValuePair(section, 'Position:', 'agent-position');
        this.agentVelocityElement = this.createLabelValuePair(section, 'Velocity:', 'agent-velocity');
        this.agentAnimationElement = this.createLabelValuePair(section, 'Animation:', 'agent-animation');
        this.agentStateElement = this.createLabelValuePair(section, 'State:', 'agent-state');
        this.agentControlledByElement = this.createLabelValuePair(section, 'Controlled By:', 'agent-controlled-by');
    }

    private initializeDebugControls(section: HTMLElement): void {
        // Debug Visualization Toggles
        const debugOptions = [
            { name: 'Show Forces', id: 'forces' },
            { name: 'Show Behaviors', id: 'behaviors' },
            { name: 'Show State Machine', id: 'stateMachine' },
            { name: 'Show Path', id: 'path' }
        ];

        debugOptions.forEach(option => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `debug-${option.id}`;
            checkbox.style.marginRight = '5px';

            const label = document.createElement('label');
            label.htmlFor = `debug-${option.id}`;
            label.textContent = option.name;
            label.style.cssText = `
                display: block;
                margin: 5px 0;
                color: #e0e0e0;
            `;

            const container = document.createElement('div');
            container.appendChild(checkbox);
            container.appendChild(label);
            section.appendChild(container);
        });
    }

    private createSliderControl(label: string, min: number, max: number, defaultValue: number, onChange: (value: number) => void): HTMLElement {
        const container = document.createElement('div');
        container.style.marginTop = '10px';

        const labelElement = document.createElement('label');
        labelElement.textContent = label;
        labelElement.style.display = 'block';
        labelElement.style.marginBottom = '5px';
        container.appendChild(labelElement);

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min.toString();
        slider.max = max.toString();
        slider.value = defaultValue.toString();
        slider.style.width = '100%';
        slider.oninput = () => onChange(parseFloat(slider.value));
        container.appendChild(slider);

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = defaultValue.toString();
        valueDisplay.style.marginLeft = '10px';
        container.appendChild(valueDisplay);

        return container;
    }

    private startUpdateLoop(): void {
        this.updateInterval = window.setInterval(() => {
            this.update();
        }, 100);
    }

    public update(): void {
        const selectedAgent = this.currentSelectedAgent;

        // Ensure all required elements are initialized before attempting to update
        if (this.agentNameElement && this.agentUUIDElement && this.agentPositionElement && this.agentVelocityElement && this.agentAnimationElement && this.agentStateElement && this.agentControlledByElement) {
            if (selectedAgent) {
                // Update UI elements with selected agent's data
                this.agentNameElement.textContent = selectedAgent.name || '-';
                this.agentUUIDElement.textContent = selectedAgent.uuid || '-';
                this.agentPositionElement.textContent = `(${selectedAgent.position.x.toFixed(2)}, ${selectedAgent.position.y.toFixed(2)}, ${selectedAgent.position.z.toFixed(2)})`;
                this.agentVelocityElement.textContent = `(${selectedAgent.velocity.x.toFixed(2)}, ${selectedAgent.velocity.y.toFixed(2)}, ${selectedAgent.velocity.z.toFixed(2)})`;
                this.agentAnimationElement.textContent = (selectedAgent as any)._currentAnimation || '-'; // Assuming _currentAnimation holds the animation name
                this.agentStateElement.textContent = (selectedAgent as any).stateMachine.currentState?.constructor.name || '-';
                this.agentControlledByElement.textContent = selectedAgent.isUnderAIControl() ? 'AI' : 'Player';
            } else {
                // Clear UI elements if no agent is selected
                this.agentNameElement.textContent = '-';
                this.agentUUIDElement.textContent = '-';
                this.agentPositionElement.textContent = '-';
                this.agentVelocityElement.textContent = '-';
                this.agentAnimationElement.textContent = '-';
                this.agentStateElement.textContent = '-';
                this.agentControlledByElement.textContent = '-';
            }
        } else {
            console.error('AI Info display elements not initialized!'); // Log an error if elements are missing
        }
    }

    // Helper to create labeled value pairs if they don't exist (basic implementation)
    private createLabelValuePair(parent: HTMLElement, labelText: string, valueId: string): HTMLElement {
        const container = document.createElement('div');
        container.style.marginBottom = '5px';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = labelText;
        labelSpan.style.fontWeight = 'bold';
        labelSpan.style.marginRight = '5px';
        container.appendChild(labelSpan);

        const valueSpan = document.createElement('span');
        valueSpan.id = valueId;
        valueSpan.textContent = '-'; // Initial placeholder
        container.appendChild(valueSpan);

        parent.appendChild(container);
        return valueSpan; // Return the element that will display the value
    }

    public getContainer(): HTMLElement {
        return this.container;
    }

    public dispose(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.agentChangeListener = null as any;
        if (this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        // Dispose other resources if necessary
    }
} 