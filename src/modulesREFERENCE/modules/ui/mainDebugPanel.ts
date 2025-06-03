import * as THREE from 'three'; // Keep for potential future use
import Stats from 'stats.js'; // Import Stats type if needed, or just query DOM

// Import functions to call from buttons
import { showDebugPreview } from './debugPreview'; // Assuming relative path is correct
import { clearAllSavedTerrain } from '../../storageUtils_debug'; // Adjust path as needed

// Import functions to populate sections (ASSUMED FILES)
import { populateGenerationControls } from './debugGenerationPanel'; // Kept for generation section
import {
    initIsolatedViewer,
    cleanupIsolatedViewer,
    generateIsolatedTerrain,
    setupIsolatedEditing,
    resetIsolatedView // <-- Import the new reset function
} from './isolatedTerrainViewer'; // Import isolated viewer functions

// Import CSS (Vite handles this)
// import '../styles/debugPanel.css'; <<< NO - CSS linked in HTML

// Interface for the new dependencies object for mining debug
interface MiningDebugDependencies {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    loadedChunks: any; // Use more specific type if available (LoadedChunks)
    noiseLayers: any; // Use more specific type if available (NoiseLayers)
    seed: any; // Use more specific type if available (Seed)
    compInfo: any; // Use specific type (PlanetCompositionInfo)
    initFn: Function; // Type for initTerrainEditor
    cleanupFn: Function; // Type for cleanupTerrainEditor
}

// --- Module State ---
let isVisible = false;
let panelContainer: HTMLElement | null = null;
let debugSection: HTMLElement | null = null;
let generationSection: HTMLElement | null = null;
let statsPanel: HTMLElement | null = null; // To store reference to stats panel
let isolatedEditorOverlay: HTMLDivElement | null = null; // Track the overlay element

// --- Helper Function for Adding Tooltips --- 
function addTooltip(element: HTMLElement, text: string) {
    if (text) {
        element.title = text;
    }
}

// --- Helper Function for creating controls (Moved from debugMiningPanel) ---
function createSliderControl(label: string, min: string, max: string, step: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'slider-control-row'; // Class used by CSS

    const labelEl = document.createElement('label'); 
    labelEl.textContent = label;
    
    const inputEl = document.createElement('input');
    inputEl.type = 'range';
    inputEl.min = min;
    inputEl.max = max;
    inputEl.step = step;
    inputEl.value = value;
    // TODO: Add event listener

    row.appendChild(labelEl);
    row.appendChild(inputEl);
    return row;
}

// --- Helper Function for Button Styling ---
/* REMOVED styleDebugButton function */

// Add style for full-width buttons (use base styleDebugButton)
const fullWidthButtonStyle = {
    // Inherits from styleDebugButton now applied directly
    margin: '10px 0 8px 0', // Adjust margin
};
// ---------------------------------------

// --- Function to create and show the overlay --- 
function launchIsolatedEditorOverlay(miningDeps: MiningDebugDependencies) {
    if (isolatedEditorOverlay) {
        console.warn("Isolated editor overlay already exists.");
        return; // Prevent multiple overlays
    }

    // Create Overlay Div
    isolatedEditorOverlay = document.createElement('div');
    isolatedEditorOverlay.id = 'isolated-editor-overlay';
    
    // Create Header/Title Bar
    const header = document.createElement('div');
    header.id = 'isolated-editor-header';
    const title = document.createElement('h4');
    title.textContent = 'Isolated Terrain Editor';
    header.appendChild(title);
    const closeButton = document.createElement('button');
    closeButton.id = 'isolated-editor-close-button'; // ID used by CSS
    closeButton.innerText = '×';
    // Styles applied via CSS ID
    closeButton.onclick = () => {
        console.log("Closing isolated editor overlay...");
        try {
            cleanupIsolatedViewer();
        } catch (error) {
            console.error("Error during isolated viewer cleanup:", error);
        }
        if (isolatedEditorOverlay && isolatedEditorOverlay.parentElement) {
            isolatedEditorOverlay.parentElement.removeChild(isolatedEditorOverlay);
        }
        isolatedEditorOverlay = null;
    };
    header.appendChild(closeButton);
    isolatedEditorOverlay.appendChild(header);

    // --- Create Main Content Area (Side Panel + Canvas) --- 
    const editorContentArea = document.createElement('div');
    editorContentArea.id = 'isolated-editor-content-area'; // ID for CSS flex row layout
    isolatedEditorOverlay.appendChild(editorContentArea);

    // --- Create Utilities Side Panel --- 
    const editorUtilitiesPanel = document.createElement('div');
    editorUtilitiesPanel.id = 'isolated-editor-utilities-panel'; // ID for CSS styling
    editorContentArea.appendChild(editorUtilitiesPanel);

    // --- Add Controls to Utilities Panel ---
    const utilsTitle = document.createElement('h5'); 
    utilsTitle.textContent = 'Editor Controls';
    editorUtilitiesPanel.appendChild(utilsTitle);

    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset View';
    addTooltip(resetButton, 'Reset camera to default top-down view');
    resetButton.id = 'isolated-editor-reset-button'; // Keep ID if needed
    // Onclick will be attached later after appending to DOM
    editorUtilitiesPanel.appendChild(resetButton);

    editorUtilitiesPanel.appendChild(createSliderControl('Brush Size', '1', '10', '1', '3'));
    editorUtilitiesPanel.appendChild(createSliderControl('Strength', '0.1', '1.0', '0.1', '0.5'));

    const modeButton = document.createElement('button');
    modeButton.textContent = 'Mode: Add';
    addTooltip(modeButton, "Toggle between Add and Remove modes (Not implemented yet)");
    // TODO: Add click handler
    editorUtilitiesPanel.appendChild(modeButton);

    // --- NEW Mining Depth Button ---
    const depthButton = document.createElement('button');
    depthButton.textContent = 'MiningDepth';
    addTooltip(depthButton, "Adjust mining depth (Not implemented yet)");
    // TODO: Add click handler
    editorUtilitiesPanel.appendChild(depthButton);

    // --- NEW Yuka AI Panel Button ---
    const yukaAiPanelButton = document.createElement('button');
    yukaAiPanelButton.textContent = 'Yuka AI Panel';
    addTooltip(yukaAiPanelButton, "Toggle Yuka AI controls");
    yukaAiPanelButton.id = 'isolated-editor-yuka-ai-button';
    editorUtilitiesPanel.appendChild(yukaAiPanelButton);

    // --- NEW Yuka AI Panel ---
    const yukaAiPanel = document.createElement('div');
    yukaAiPanel.id = 'isolated-editor-yuka-ai-panel';
    // Ensure the panel is hidden by default with !important to override any other styles
    yukaAiPanel.style.cssText = `
        display: none !important;
        border: 1px solid #4a5568;
        padding: 10px;
        margin-top: 10px;
        background-color: rgba(0, 0, 0, 0.1);
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
    `;

    const yukaPanelTitle = document.createElement('h6');
    yukaPanelTitle.textContent = 'Yuka AI Controls';
    yukaPanelTitle.style.marginTop = '0';
    yukaPanelTitle.style.marginBottom = '10px';
    yukaAiPanel.appendChild(yukaPanelTitle);

    const spawnAgentButton = document.createElement('button');
    spawnAgentButton.textContent = 'Spawn Basic Agent';
    addTooltip(spawnAgentButton, "Spawn a Yuka agent (Not implemented yet)");
    spawnAgentButton.onclick = () => {
        if (window.isolatedTerrainViewer && typeof window.isolatedTerrainViewer.spawnBasicYukaAgent === 'function') {
            window.isolatedTerrainViewer.spawnBasicYukaAgent();
        } else {
            console.warn('spawnBasicYukaAgent function not found on isolatedTerrainViewer');
        }
    };
    yukaAiPanel.appendChild(spawnAgentButton);

    const setGoalButton = document.createElement('button');
    setGoalButton.textContent = 'Set Random Goal';
    setGoalButton.style.marginLeft = '5px';
    addTooltip(setGoalButton, "Set a random goal for selected agent (Not implemented yet)");
    setGoalButton.onclick = () => {
        if (window.isolatedTerrainViewer && typeof window.isolatedTerrainViewer.setRandomYukaGoal === 'function') {
            window.isolatedTerrainViewer.setRandomYukaGoal();
        } else {
            console.warn('setRandomYukaGoal function not found on isolatedTerrainViewer');
        }
    };
    yukaAiPanel.appendChild(setGoalButton);

    editorUtilitiesPanel.appendChild(yukaAiPanel); // Add Yuka panel to the utilities panel

    yukaAiPanelButton.onclick = () => {
        const isVisible = yukaAiPanel.style.display === 'block' || yukaAiPanel.style.visibility === 'visible';
        
        if (isVisible) {
            // Hide the panel
            yukaAiPanel.style.display = 'none';
            yukaAiPanel.style.visibility = 'hidden';
            yukaAiPanel.style.opacity = '0';
            yukaAiPanelButton.textContent = 'Yuka AI Panel';
        } else {
            // Show the panel
            yukaAiPanel.style.display = 'block';
            yukaAiPanel.style.visibility = 'visible';
            yukaAiPanel.style.opacity = '1';
            yukaAiPanelButton.textContent = 'Hide Yuka AI Panel';
        }
    };
    // --- End Utilities Panel Controls ---

    // --- Dynamically Create Mining Log Panel ---
    const logPanel = document.createElement('div');
    logPanel.id = 'mining-log-panel'; // Keep the ID for potential styling/selection
    // Apply styles directly (or use CSS classes if preferred)
    logPanel.style.height = '150px'; // Example height
    logPanel.style.overflowY = 'scroll';
    logPanel.style.border = '1px solid #4a5568';
    logPanel.style.padding = '8px';
    logPanel.style.marginTop = '15px'; // Add some space
    logPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    logPanel.style.fontFamily = 'monospace';
    logPanel.style.fontSize = '0.8em';
    logPanel.style.color = '#cbd5e0';
    const logTitle = document.createElement('strong');
    logTitle.textContent = 'Mining Log:';
    logPanel.appendChild(logTitle);
    logPanel.appendChild(document.createElement('br')); // Line break after title
    // editorUtilitiesPanel.appendChild(logPanel); // <<< REMOVE: Don't add to side panel
    // --- End Dynamic Creation ---

    // --- Create Container for the 3D Canvas --- (Now inside content area)
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'isolated-viewer-canvas-container'; // ID used by CSS
    editorContentArea.appendChild(viewerContainer); // Add next to utilities

    // --- Create Status Bar (Bottom) --- 
    const statusBar = document.createElement('div');
    statusBar.id = 'isolated-editor-status-bar';
    const statusText = document.createElement('span');
    statusText.id = 'isolated-editor-status-text';
    statusText.textContent = 'Initializing...';
    statusBar.appendChild(statusText);
    // REMOVED Reset Button from status bar

    // <<< APPEND logPanel and statusBar to overlay in correct order >>>
    isolatedEditorOverlay.appendChild(logPanel); // Add log panel *before* status bar
    isolatedEditorOverlay.appendChild(statusBar); 

    // <<< Apply positioning styles to logPanel >>>
    Object.assign(logPanel.style, {
        position: 'absolute',
        bottom: '30px', // Position above the status bar (assuming status bar is ~30px high)
        left: '0',
        right: '0',
        height: '150px', // Keep height, or adjust as needed
        margin: '0 10px', // Add horizontal margin instead of full width
        width: 'calc(100% - 20px)', // Adjust width for margin
        backgroundColor: 'rgba(10, 10, 20, 0.75)', // Darker, less transparent background
        zIndex: '100', // Ensure it's above content area
        boxSizing: 'border-box', // Include padding/border in width/height
        fontSize: '1.0em', // <<< Increased base font size for the panel
        padding: '12px' // <<< Increased padding
    });

    // Append overlay to body
    document.body.appendChild(isolatedEditorOverlay);

    // --- Get references and attach handlers --- 
    const actualStatusElement = document.getElementById('isolated-editor-status-text');
    const actualResetButton = document.getElementById('isolated-editor-reset-button'); // Find it in the side panel now
    // const actualLogPanel = document.getElementById('mining-log-panel'); // <<< NO LONGER NEEDED - Use direct reference

    if (actualResetButton) {
        actualResetButton.onclick = resetIsolatedView;
    } else {
        console.error("Could not find the reset button element after adding it to DOM!");
    }
    if (!actualStatusElement) {
        console.error("Could not find the status text element after adding it to DOM!");
    }
    // if (!actualLogPanel) { // <<< REMOVE check for log panel from DOM
    //     console.error("Could not find the mining log panel element ('mining-log-panel') after adding it to DOM!");
    // }
    // --------------------------------------------------------------------

    // Initialize the viewer inside the dedicated container
    try {
        console.log("MainPanel: Initializing isolated viewer inside overlay...");
        initIsolatedViewer(viewerContainer);

        console.log("MainPanel: Generating isolated terrain...");
        generateIsolatedTerrain({
           noiseLayers: miningDeps.noiseLayers,
           seed: miningDeps.seed,
           compInfo: miningDeps.compInfo
        });

        console.log("MainPanel: Isolated terrain generated. Setting up editing...");
        // if (actualStatusElement && actualLogPanel) { // <<< UPDATE: Use direct reference to logPanel
        if (actualStatusElement && logPanel) { 
            setupIsolatedEditing(
                actualStatusElement as HTMLElement, 
                logPanel, // <<< PASS the created logPanel element directly
                (affectedKeys) => {
                 console.log(`MainPanel: Isolated edit affected chunks: ${affectedKeys.join(', ')}`);
             });
        } else {
            console.error("MainPanel: Cannot set up editing - status element not found or log panel failed to create."); // <<< Updated message
        }
        console.log("Isolated editor launched successfully with status bar.");

    } catch (error: any) {
        console.error("MainPanel: Error during isolated viewer setup:", error);
        // Optionally remove overlay on error or show error message
        if (isolatedEditorOverlay && isolatedEditorOverlay.parentElement) {
            isolatedEditorOverlay.parentElement.removeChild(isolatedEditorOverlay);
        }
        isolatedEditorOverlay = null;
    }
}

/**
 * Creates the HTML elements for the main debug panel UI (initially hidden).
 * Populates sections with controls and info.
 */
export function createMainDebugPanelUI(
    planetType: string,
    seed: number | string,
    offset: THREE.Vector3,
    miningDeps: MiningDebugDependencies
) {
    // --- Prevent Duplicates: Remove existing panel first ---
    const existingPanel = document.getElementById('main-debug-panel');
    if (existingPanel) {
        console.warn("Removing existing main debug panel before creating a new one.");
        existingPanel.remove();
    }
    panelContainer = null; // Reset state
    // ------------------------------------------------------

    if (panelContainer) return; // Already created in this call

    // *** DETAILED DEPENDENCY CHECK ***
    console.log("[MainDebugPanel] Received miningDeps:", miningDeps); // Log received dependencies
    let dependenciesValid = true;
    if (!miningDeps) {
        console.error("[MainDebugPanel] FATAL: miningDeps object was not provided!");
        dependenciesValid = false;
    } else {
        const requiredKeys: (keyof MiningDebugDependencies)[] = [
            'scene', 'camera', 'loadedChunks', 'noiseLayers', 
            'seed', 'compInfo', 'initFn', 'cleanupFn'
        ];
        for (const key of requiredKeys) {
            if (!(key in miningDeps) || miningDeps[key] === undefined || miningDeps[key] === null) {
                console.error(`[MainDebugPanel] FATAL: Missing or invalid dependency in miningDeps: '${key}'`);
                dependenciesValid = false;
            }
        }
    }
    if (!dependenciesValid) {
        // Optionally, you could prevent panel creation or show an error message here
        // For now, we'll let it proceed but the button click will fail.
        console.error("[MainDebugPanel] Panel created, but 'Generate Isolated Terrain' button will fail due to missing dependencies.");
    }
    // *** END DETAILED CHECK ***

    if (panelContainer) return; // Already created in this call

    console.log("[MainDebugPanel] Received miningDeps:", miningDeps); // Log received dependencies

    // Main Panel Container
    panelContainer = document.createElement('div');
    panelContainer.id = 'main-debug-panel'; // ID used by CSS
    // Styles applied via CSS ID

    // Title
    const title = document.createElement('h3');
    title.id = 'main-debug-panel-title'; // Use ID for specific title styles if needed, or rely on parent
    title.innerText = 'Main Debug Panel';
    // Styles applied via CSS ID or parent
    panelContainer.appendChild(title);

    // --- Content Scroll Area ---
    const contentScrollArea = document.createElement('div');
    contentScrollArea.id = 'main-debug-content-scroll-area'; // ID used by CSS
    // Styles applied via CSS ID
    panelContainer.appendChild(contentScrollArea);

    // --- Create Section Containers (Append to contentScrollArea) ---
    debugSection = document.createElement('div');
    debugSection.id = 'main-debug-section-debug';
    debugSection.classList.add('debug-section-container');
    const debugTitle = document.createElement('h4');
    debugTitle.classList.add('debug-section-header', 'debug-section-header-first');
    debugTitle.innerText = 'Debug Tools';
    debugSection.appendChild(debugTitle);
    contentScrollArea.appendChild(debugSection);

    generationSection = document.createElement('div');
    generationSection.id = 'main-debug-section-generation';
    generationSection.classList.add('debug-section-container');
    const generationTitle = document.createElement('h4');
    generationTitle.classList.add('debug-section-header');
    generationTitle.innerText = 'Generation Info';
    generationSection.appendChild(generationTitle);
    contentScrollArea.appendChild(generationSection);

    // --- Populate Debug Section --- Use CSS Classes for Buttons ---
    const shaderPreviewButton = document.createElement('button');
    shaderPreviewButton.classList.add('debug-button');
    shaderPreviewButton.innerText = 'Show Planet Shader Preview';
    addTooltip(shaderPreviewButton, 'Open a modal to preview the current planet material on a test mesh');
    shaderPreviewButton.onclick = () => { showDebugPreview(); };
    debugSection.appendChild(shaderPreviewButton);

    // --- Button to Launch the Mining Editor Overlay --- 
    const launchMiningEditorButton = document.createElement('button');
    launchMiningEditorButton.id = 'launch-mining-editor-button'; // New ID
    launchMiningEditorButton.classList.add('debug-button');
    addTooltip(launchMiningEditorButton, "Open a separate window to test terrain generation and editing in isolation");
    launchMiningEditorButton.textContent = 'Launch Mining Editor'; // Renamed Text
    launchMiningEditorButton.onclick = () => {
        // Directly call the function to launch the overlay
        launchIsolatedEditorOverlay(miningDeps);
    };
    debugSection.appendChild(launchMiningEditorButton); // Add it to the debug tools section

    const clearButton = document.createElement('button');
    clearButton.classList.add('debug-button', 'debug-button-destructive');
    addTooltip(clearButton, "Permanently delete all saved terrain edits from browser storage");
    clearButton.textContent = 'Clear Saved Terrain Edits';
    clearButton.onclick = () => {
        if (confirm('Are you sure you want to delete ALL saved terrain edits? This cannot be undone.')) {
            clearAllSavedTerrain();
            alert('Saved terrain edits cleared. Reloading page...');
            window.location.reload();
        }
    };
    debugSection.appendChild(clearButton);

    // --- Populate Generation Section --- Use CSS Classes ---
    const generationDebugButton = document.createElement('button');
    generationDebugButton.classList.add('debug-button');
    generationDebugButton.innerText = 'Show Generation Debug Controls';
    addTooltip(generationDebugButton, 'Load controls related to noise generation parameters (currently placeholder)');
    generationDebugButton.onclick = () => {
        let dynamicControlsContainer = generationSection!.querySelector('.dynamic-gen-controls');
        if (!dynamicControlsContainer) {
            dynamicControlsContainer = document.createElement('div');
            dynamicControlsContainer.className = 'dynamic-gen-controls'; // Class used by CSS
            generationSection!.appendChild(dynamicControlsContainer);
        } else {
            dynamicControlsContainer.innerHTML = ''; // Clear previous
        }
        populateGenerationControls(dynamicControlsContainer as HTMLElement);
        generationDebugButton.style.display = 'none';
    };
    generationSection.insertBefore(generationDebugButton, generationSection.children[1]); // Insert before static info

    const planetInfo = document.createElement('p');
    planetInfo.classList.add('debug-info-text');
    planetInfo.innerHTML = `Type: <strong>${planetType}</strong>`;
    generationSection.appendChild(planetInfo);

    const seedInfo = document.createElement('p');
    seedInfo.classList.add('debug-info-text');
    seedInfo.innerHTML = `Seed: <strong style="word-break: break-all;">${String(seed)}</strong>`;
    generationSection.appendChild(seedInfo);

    const offsetInfo = document.createElement('p');
    offsetInfo.classList.add('debug-info-text');
    offsetInfo.innerHTML = `Offset: <strong>[${offset.toArray().map(v => v.toFixed(1)).join(', ')}]</strong>`;
    generationSection.appendChild(offsetInfo);

    const clearTerrainButton = document.createElement('button');
    clearTerrainButton.classList.add('debug-button', 'debug-button-destructive');
    addTooltip(clearTerrainButton, 'WARNING: Deletes all locally stored terrain data and reloads the page!');
    clearTerrainButton.innerText = 'Clear Saved Terrain & Reload';
    clearTerrainButton.onclick = () => {
        if (confirm('Clear all saved terrain data and reload the page?')) {
            clearAllSavedTerrain(); 
            location.reload();
        }
    };
    generationSection.appendChild(clearTerrainButton);

    // Close Button (for main panel)
    const closeButton = document.createElement('button');
    closeButton.id = 'main-debug-panel-close-button'; // ID used by CSS
    closeButton.innerText = '×';
    addTooltip(closeButton, 'Close Debug Panel');
    // Styles applied via CSS ID
    closeButton.onclick = hideMainDebugPanel;
    panelContainer.appendChild(closeButton);

    document.body.appendChild(panelContainer);
    console.log("Main Debug Panel UI created - Mining tools launch separate overlay.");
}

/**
 * Makes the main debug panel UI visible.
 */
export function showMainDebugPanel() {
    if (!panelContainer) {
        console.error("Main Debug Panel not created yet. Call createMainDebugPanelUI first.");
        return;
    }
    panelContainer.style.display = 'flex'; // Ensure it displays as flex
    isVisible = true;
    console.log("Showing Main Debug Panel.");
}

/**
 * Hides the main debug panel UI. (Only changes display)
 */
export function hideMainDebugPanel() {
    if (panelContainer) {
        panelContainer.style.display = 'none';
    }
    isVisible = false;
    console.log("Hiding Main Debug Panel.");
}

/**
 * Toggles the visibility of the main debug panel.
 */
export function toggleMainDebugPanel() {
    // Check if panel exists. If not, we can't toggle.
    // This relies on createMainDebugPanelUI being called during app init.
    if (!panelContainer) {
        console.error("Cannot toggle Main Debug Panel: It has not been created.");
        return;
    }
    if (isVisible) {
        hideMainDebugPanel();
    } else {
        showMainDebugPanel();
    }
}

/**
 * Cleans up resources used by the main debug panel.
 */
export function cleanupMainDebugPanelUI() {
    // Cleanup isolated viewer overlay if it exists when main panel is closed
    if (isolatedEditorOverlay) {
        console.warn("Main panel cleaned up while isolated editor was still open. Closing editor.");
        try {
            cleanupIsolatedViewer(); 
        } catch (error) {
            console.error("Error during isolated viewer cleanup triggered by main panel cleanup:", error);
        }
        if (isolatedEditorOverlay.parentElement) {
            isolatedEditorOverlay.parentElement.removeChild(isolatedEditorOverlay);
        }
        isolatedEditorOverlay = null;
    }

    if (panelContainer) {
        if (panelContainer.parentElement) {
            panelContainer.parentElement.removeChild(panelContainer);
        }
        panelContainer = null;
    }
    debugSection = null;
    generationSection = null;
    statsPanel = null; // Clear stats panel reference
    console.log("Cleaned up Main Debug Panel UI resources.");
}

// Add functions here later to populate the different sections if needed
// e.g., export function addDebugControl(...) {}
// e.g., export function updateMiningInfo(...) {}
// e.g., export function setGenerationStatus(...) {}