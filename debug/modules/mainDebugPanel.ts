console.log('[MainDebugPanel-DIAGNOSTIC] SCRIPT EXECUTION STARTED.'); // New top-level log

import * as THREE from 'three'; // Keep for potential future use
import Stats from 'stats.js'; // Import Stats type if needed, or just query DOM

// Import functions to call from buttons
import { showDebugPreview } from './ui/debugPreview'; // Correct relative path
import { clearAllSavedTerrain } from '../../storageUtils_debug'; // Adjust path as needed

// Import functions to populate sections (ASSUMED FILES)
import { populateGenerationControls } from './debugGenerationPanel'; // Kept for generation section
import { createMiningPanelTab, updateMiningPanelTab, type MiningTabDependencies } from './miningPanelTab'; // Import mining panel tab and MiningTabDependencies. THIS IS THE ONE TO USE.
import {
    initIsolatedViewer,
    cleanupIsolatedViewer,
    generateIsolatedTerrain,
    setupIsolatedEditing,
    resetIsolatedView // <-- Import the new reset function
} from './isolatedTerrainViewer'; // Import isolated viewer functions
import { CHUNK_SIZE } from '../../constants_debug'; // Import CHUNK_SIZE

// Import CSS (Vite handles this)
// import '../styles/debugPanel.css'; <<< NO - CSS linked in HTML

// Import utility functions
import { getElementByIdOrThrow, createSectionTitle, createTabs, updateSectionVisibility, setupTabbedSections } from './uiDebugUtils';
import { toggleProceduralGenerationPanel } from './proceduralGenerationPanel'; 
import { toggleInternalGridControlsPanel } from './internalGridControlsPanel';
import { toggleYukaAIPanel } from './yukaAiPanel'; // Added import

// Interface for the new dependencies object for mining debug
interface MiningDebugDependencies {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    loadedChunks: any; // Use more specific type if available (LoadedChunks)
    noiseLayers: any; // Use more specific type if available (NoiseLayers)
    seed: any; // Use more specific type if available (Seed)
    compInfo: any; // Use specific type (PlanetCompositionInfo)
    noiseScale?: number; // <<< ADDED
    planetOffset?: THREE.Vector3; // <<< ADDED (Was missing before too)
    initFn: Function; // Type for initTerrainEditor
    cleanupFn: Function; // Type for cleanupTerrainEditor
}

// --- Module State ---
let isVisible = false;
let panelContainer: HTMLElement | null = null;
let debugSection: HTMLElement | null = null;
let generationSection: HTMLElement | null = null;
let miningTabSection: HTMLElement | null = null; // Module-scoped variable
let statsPanel: HTMLElement | null = null; // To store reference to stats panel
let isolatedEditorOverlay: HTMLDivElement | null = null; // Track the overlay element
let miningPanelTabContent: HTMLElement | null = null; // Keep track of the content
let miningPanelContentWrapper: HTMLElement | null = null; // Wrapper for mining tab's dynamic content
let uiState: { activeTab: string } = { activeTab: 'debug' }; // Default to debug tab active
let tabButtonsContainer: HTMLElement | null = null; // Assume this is created elsewhere or manage it
let tabSectionsContainer: HTMLElement | null = null; // Assume this is created elsewhere or manage it

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
    inputEl.id = `slider-${label.replace(/\s+/g, '_')}`; // Create ID based on label

    // Add value display
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(inputEl);
    row.appendChild(valueDisplay);
    return row;
}

// --- Helper Function for creating dropdown controls ---
function createDropdownControl(label: string, options: string[], defaultValue: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'dropdown-control-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const selectEl = document.createElement('select');
    selectEl.id = `dropdown-${label.replace(/\s+/g, '_')}`;

    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.toLowerCase();
        optionEl.textContent = option;
        if (option.toLowerCase() === defaultValue.toLowerCase()) {
            optionEl.selected = true;
        }
        selectEl.appendChild(optionEl);
    });

    row.appendChild(labelEl);
    row.appendChild(selectEl);
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
export function launchIsolatedEditorOverlay(miningDeps: MiningDebugDependencies, debugControllerInstance: any) {
    if (isolatedEditorOverlay) {
        console.warn("Isolated editor overlay already exists.");
        return; // Prevent multiple overlays
    }

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
    resetButton.id = 'isolated-editor-reset-button';
    editorUtilitiesPanel.appendChild(resetButton);

    // *** Add Spawn Button HERE ***
    const spawnButton = document.createElement('button');
    spawnButton.textContent = 'Spawn on Terrain';
    spawnButton.id = 'isolated-editor-spawn-button';
    addTooltip(spawnButton, 'Enter first-person mode at the center of this chunk');
    spawnButton.onclick = () => {
        console.log("Spawn on Terrain button clicked");
        if (debugControllerInstance) {
            debugControllerInstance.spawnPlayerOnTerrain(); 
        }
    };
    editorUtilitiesPanel.appendChild(spawnButton);

    // --- Spawn Third Person Button ---
    const spawnThirdPersonButton = document.createElement('button');
    spawnThirdPersonButton.textContent = 'Spawn Third Person';
    spawnThirdPersonButton.id = 'isolated-editor-spawn-third-person-button';
    addTooltip(spawnThirdPersonButton, 'Enter third-person mode');
    spawnThirdPersonButton.onclick = () => {
        console.log("Spawn Third Person button clicked");
        if (debugControllerInstance && typeof debugControllerInstance.enterThirdPersonMode === 'function') {
            debugControllerInstance.enterThirdPersonMode(); 
        } else if (debugControllerInstance) {
            alert("enterThirdPersonMode() not yet implemented on debugController");
        } else {
            alert("Debug controller not available.");
        }
    };
    editorUtilitiesPanel.appendChild(spawnThirdPersonButton);
    // --- End Spawn Third Person Button ---

    // --- NEW Yuka AI Panel Button ---
    const yukaAiPanelButton = document.createElement('button');
    yukaAiPanelButton.textContent = 'Toggle Yuka AI Panel';
    addTooltip(yukaAiPanelButton, "Opens or closes the Yuka AI control panel.");
    yukaAiPanelButton.id = 'toggle-yuka-ai-panel-button'; // Unique ID
    yukaAiPanelButton.onclick = () => {
        console.log("Toggle Yuka AI Panel button clicked.");
        toggleYukaAIPanel();
    };
    editorUtilitiesPanel.appendChild(yukaAiPanelButton);
    // --- End Yuka AI Panel Button ---

    // Add brush size slider
    editorUtilitiesPanel.appendChild(createSliderControl('Brush Size', '1', '10', '1', '3'));

    // Add brush strength slider
    editorUtilitiesPanel.appendChild(createSliderControl('Strength', '0.1', '1.0', '0.1', '0.5'));

    // Add brush shape dropdown
    editorUtilitiesPanel.appendChild(createDropdownControl('Brush Shape', ['Sphere', 'Cube', 'Cylinder'], 'Sphere'));

    // Add verticality slider
    editorUtilitiesPanel.appendChild(createSliderControl('Verticality', '1', '40', '1', '20'));

    // Add mode toggle button
    const modeButton = document.createElement('button');
    modeButton.id = 'mining-mode-button';
    modeButton.textContent = 'Mode: Add';
    modeButton.className = 'mode-add'; // For styling
    addTooltip(modeButton, "Toggle between Add and Remove modes");

    // Add click handler to toggle mode
    modeButton.onclick = () => {
        // This will be connected to the isolatedTerrainViewer's editBrushMode
        // The actual mode change will happen in the event handler in isolatedTerrainViewer.ts
        console.log("Mode button clicked - will be handled by isolatedTerrainViewer.ts");
    };

    editorUtilitiesPanel.appendChild(modeButton);

    // Add internal grid visualizer toggle button
    const gridButton = document.createElement('button');
    gridButton.id = 'internal-grid-button';
    gridButton.textContent = 'Show Internal Grid';
    gridButton.className = 'grid-hidden'; // For styling
    addTooltip(gridButton, "Toggle internal material grid visualizer");

    // Add click handler to toggle internal grid
    gridButton.onclick = () => {
        // This will be connected to the isolatedTerrainViewer's toggleInternalGridVisualizer
        // The actual toggle will happen in the event handler in isolatedTerrainViewer.ts
        // console.log("Grid button clicked - will be handled by isolatedTerrainViewer.ts");
        console.log("Toggle Internal Grid Controls Panel button clicked.");
        toggleInternalGridControlsPanel(); // <-- Actually call the function
    };

    editorUtilitiesPanel.appendChild(gridButton);
    // --- End Utilities Panel Controls ---

    // --- Dynamically Create Mining Log Panel ---
    const logPanel = document.createElement('div');
    logPanel.id = 'mining-log-panel';
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
    viewerContainer.id = 'isolated-viewer-canvas-container';
    editorContentArea.appendChild(viewerContainer); // Canvas container added to content area, next to utilities

    // --- Create Status Bar (Bottom) ---
    const editorStatusBar = document.createElement('div');
    editorStatusBar.id = 'isolated-editor-status-bar';
    editorStatusBar.style.textAlign = 'center';
    editorStatusBar.style.padding = '5px';
    editorStatusBar.style.backgroundColor = 'rgba(0,0,0,0.7)';
    editorStatusBar.style.color = 'white';
    editorStatusBar.style.fontSize = '0.9em';
    editorStatusBar.textContent = 'Isolated Editor Initialized. Move mouse over canvas for brush.';
    isolatedEditorOverlay.appendChild(editorStatusBar);

    // Append overlay to body
    document.body.appendChild(isolatedEditorOverlay);

    // --- Get references and attach handlers ---
    const actualResetButton = document.getElementById('isolated-editor-reset-button');
    // const actualSpawnButton = document.getElementById('isolated-editor-spawn-button'); // Not used in this block

    if (actualResetButton) {
        actualResetButton.onclick = resetIsolatedView;
    } else {
        console.error("Could not find the reset button element (#isolated-editor-reset-button) after adding it to DOM!");
    }

    try {
        console.log("MainPanel: Initializing isolated viewer inside overlay...");
        initIsolatedViewer(viewerContainer);

        console.log("MainPanel: Generating isolated terrain...");
        // Log the specific dependencies being passed to generateIsolatedTerrain
        console.log("[MainDebugPanel] Dependencies for generateIsolatedTerrain:", 
            {
                compInfo: miningDeps.compInfo,
                noiseScale: miningDeps.noiseScale,
                planetOffset: miningDeps.planetOffset,
                seed: miningDeps.seed, // also log seed and noiseLayers for completeness
                noiseLayers: miningDeps.noiseLayers
            }
        );
        generateIsolatedTerrain({
           noiseLayers: miningDeps.noiseLayers,
           seed: miningDeps.seed,
           compInfo: miningDeps.compInfo,
           noiseScale: miningDeps.noiseScale,
           planetOffset: miningDeps.planetOffset
        });

        console.log("MainPanel: Isolated terrain generated. Setting up editing...");
        if (editorStatusBar && logPanel) { 
            setupIsolatedEditing(
                editorStatusBar,
                logPanel,
                (affectedKeys) => {
                 console.log(`MainPanel: Isolated edit affected chunks: ${affectedKeys.join(', ')}`);
             });
        } else {
            console.error("MainPanel: Cannot set up editing - editorStatusBar or logPanel element is missing internally before call.");
        }
        console.log("Isolated editor launched successfully with status bar.");

        // Activate mining tab data pathway
        // activateMiningTabAndEnsureContent(); // <<< COMMENTED OUT to prevent emergency panel during isolated editor launch

    } catch (error: any) {
        console.error("MainPanel: Error during isolated viewer setup:", error);
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
console.log('[MainDebugPanel-DIAGNOSTIC] Imports processed. Before createMainDebugPanelUI function definition.'); // New log after imports
export function createMainDebugPanelUI(
    planetType: string,
    seed: number | string,
    offset: THREE.Vector3,
    miningDeps: MiningDebugDependencies,
    debugControllerInstance: any
) {
    console.log('[MainDebugPanel-DIAGNOSTIC] createMainDebugPanelUI FUNCTION CALLED.'); // New log
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

    // Mock tab containers if not managed globally
    tabButtonsContainer = document.createElement('div');
    tabButtonsContainer.id = 'debug-tab-buttons-container';
    contentScrollArea.appendChild(tabButtonsContainer); 

    tabSectionsContainer = document.createElement('div');
    tabSectionsContainer.id = 'debug-tab-sections-container';
    contentScrollArea.appendChild(tabSectionsContainer);

    // --- Create Section Containers (Append to contentScrollArea) ---
    debugSection = createTabSection('debug', uiState);
    const debugTabButton = createTabButton('Debug', 'debug', uiState);
    tabButtonsContainer.appendChild(debugTabButton);
    tabSectionsContainer.appendChild(debugSection);

    generationSection = createTabSection('generation', uiState);
    const generationTabButton = createTabButton('Generation', 'generation', uiState);
    tabButtonsContainer.appendChild(generationTabButton);
    tabSectionsContainer.appendChild(generationSection);

    // Create Mining Tab Section
    const miningTabId = 'mining';
    miningTabSection = createTabSection(miningTabId, uiState);
    tabSectionsContainer.appendChild(miningTabSection); 
    console.log("[MainDebugPanel-DIAGNOSTIC] Mining tab section created and appended.", miningTabSection);

    // Create the permanent content WRAPPER for the mining tab's dynamic content
    miningPanelContentWrapper = document.createElement('div');
    miningPanelContentWrapper.className = 'mining-panel-content-wrapper';
    miningPanelContentWrapper.style.display = 'none'; // Initially hidden
    miningTabSection.appendChild(miningPanelContentWrapper);
    console.log("[MainDebugPanel-DIAGNOSTIC] miningPanelContentWrapper created and appended to miningTabSection. Initial display:", miningPanelContentWrapper.style.display);

    const miningTabButton = createTabButton('Mining', miningTabId, uiState); // This sets its own click listener
    tabButtonsContainer.appendChild(miningTabButton);

    // Modify the miningTabButton's existing click listener (or re-assign if createTabButton is simple)
    // For this example, let's assume createTabButton sets a basic tab switch, we add more logic here.
    const actualMiningButtonById = document.getElementById('main-debug-mining-tab-button') as HTMLElement;

    if(actualMiningButtonById) {
        console.log("[MainDebugPanel-DIAGNOSTIC] Found mining tab button by ID: main-debug-mining-tab-button. Assigning specific click handler.");
        actualMiningButtonById.onclick = () => {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            console.log("[MainDebugPanel-DIAGNOSTIC] MINING TAB BUTTON (ID: main-debug-mining-tab-button) CLICKED - RAW EVENT");
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");

            uiState.activeTab = miningTabId;

            // DIAGNOSTIC: Directly try to show the emergency panel FIRST
            if (window.miningPanelTabUtils && typeof window.miningPanelTabUtils.setEmergencyPanelVisible === 'function') {
                console.log("[MainDebugPanel-DIAGNOSTIC] === DIRECTLY ATTEMPTING TO SHOW EMERGENCY PANEL NOW ===");
                window.miningPanelTabUtils.setEmergencyPanelVisible(true);
            } else {
                console.error("[MainDebugPanel-DIAGNOSTIC] Could not DIRECTLY show emergency panel: miningPanelTabUtils.setEmergencyPanelVisible is not available.");
            }

            // Then, proceed with the original (simplified) logic to see its logs
            console.log("[MainDebugPanel-DIAGNOSTIC] Forcing attempt to activate mining tab content (after direct emergency show attempt).");
            activateMiningTabAndEnsureContent();
        };
    } else {
        console.error("[MainDebugPanel-DIAGNOSTIC] Could not find the actual mining tab button to override its click listener.");
    }

    // Button to Launch the Isolated Terrain Editor (moved from debugSection for clarity in example)
    const launchEditorButton = document.createElement('button');
    launchEditorButton.textContent = 'Launch Isolated Terrain Editor';
    launchEditorButton.id = 'launch-isolated-editor-button';
    launchEditorButton.onclick = () => launchIsolatedEditorOverlay(miningDeps, debugControllerInstance);
    debugSection.appendChild(launchEditorButton); // Or panelContainer directly

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

    // Button to Show Debug Preview
    const debugPreviewButton = document.createElement('button');
    debugPreviewButton.textContent = 'Show Debug Preview';
    debugPreviewButton.className = 'debug-button';
    debugPreviewButton.id = 'show-debug-preview-button';
    addTooltip(debugPreviewButton, 'Open the Debug Preview panel to view element swatches and terrain previews');
    debugPreviewButton.onclick = () => {
        console.log('Debug Preview button clicked');
        showDebugPreview();
    };
    debugSection.appendChild(debugPreviewButton);

    // Close Button (for main panel)
    const closeButton = document.createElement('button');
    closeButton.id = 'main-debug-panel-close-button'; // ID used by CSS
    closeButton.innerText = '×';
    addTooltip(closeButton, 'Close Debug Panel');
    // Styles applied via CSS ID
    closeButton.onclick = hideMainDebugPanel;
    panelContainer.appendChild(closeButton);

    document.body.appendChild(panelContainer);
    if (tabButtonsContainer && tabSectionsContainer) { // Ensure they are non-null before calling
        updateActiveTab(uiState, tabButtonsContainer, tabSectionsContainer); // Initial tab setup
    } else {
        console.error("[MainDebugPanel-DIAGNOSTIC] tabButtonsContainer or tabSectionsContainer is null before initial call to updateActiveTab.");
    }
    console.log("Main Debug Panel UI created with revised mining tab logic.");
}

/**
 * Makes the main debug panel UI visible.
 */
export function showMainDebugPanel() {
    console.log("[MainDebugPanel-DIAGNOSTIC] showMainDebugPanel called.");
    if (panelContainer) panelContainer.style.display = 'flex';
    // if (debugSection) debugSection.style.display = 'block'; // Handled by updateActiveTab
    // if (generationSection) generationSection.style.display = 'none'; // Handled by updateActiveTab
    // if (miningTabSection) miningTabSection.style.display = 'block'; // Handled by updateActiveTab
    isVisible = true;
    if (tabButtonsContainer && tabSectionsContainer) { // Ensure they are non-null before calling
        updateActiveTab(uiState, tabButtonsContainer, tabSectionsContainer); // Ensure correct tab visible on show
    } else {
        console.error("[MainDebugPanel-DIAGNOSTIC] tabButtonsContainer or tabSectionsContainer is null during showMainDebugPanel.");
    }
}

/**
 * Hides the main debug panel UI. (Only changes display)
 */
export function hideMainDebugPanel() {
    console.log("[MainDebugPanel-DIAGNOSTIC] hideMainDebugPanel called.");
    if (panelContainer) panelContainer.style.display = 'none';
    isVisible = false;
}

/**
 * Toggles the visibility of the main debug panel.
 */
export function toggleMainDebugPanel() {
    console.log("[MainDebugPanel-DIAGNOSTIC] toggleMainDebugPanel called.");
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

// Helper functions (createTabButton, createTabSection, updateActiveTab)
function createTabButton(label: string, tabId: string, state: typeof uiState): HTMLElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'debug-button';
    if (label === 'Mining') {
        button.classList.add('mining-tab-button');
        button.id = 'main-debug-mining-tab-button'; // Assign a unique ID
    }
    button.onclick = () => {
        state.activeTab = tabId;
        if (tabButtonsContainer && tabSectionsContainer) { // Null check for safety during callbacks
            updateActiveTab(state, tabButtonsContainer, tabSectionsContainer);
        }
        console.log(`[MainDebugPanel-DIAGNOSTIC] Tab button ${label} clicked. Active tab set to: ${tabId}`);
    };
    return button;
}
function createTabSection(tabId: string, state: typeof uiState): HTMLElement {
    const section = document.createElement('div');
    section.id = `tab-section-${tabId}`;
    section.className = 'debug-section-container';
    section.style.display = 'none'; // Initially all sections are hidden, updateActiveTab shows the correct one
    return section;
}
function updateActiveTab(state: typeof uiState, buttonsContainer: HTMLElement, sectionsContainer: HTMLElement) {
    console.log("[MainDebugPanel-DIAGNOSTIC] updateActiveTab called with activeTab:", state.activeTab);
    sectionsContainer.childNodes.forEach(node => {
        if (node instanceof HTMLElement && node.id.startsWith('tab-section-')) {
            const isCurrentlyActiveSection = node.id === `tab-section-${state.activeTab}`;
            node.style.display = isCurrentlyActiveSection ? 'block' : 'none';

            // Specifically manage miningPanelContentWrapper visibility
            if (node.id === 'tab-section-mining') {
                if (miningPanelContentWrapper) {
                    miningPanelContentWrapper.style.display = isCurrentlyActiveSection ? 'block' : 'none';
                    console.log(`[MainDebugPanel-DIAGNOSTIC] Mining content wrapper display set to ${miningPanelContentWrapper.style.display} because active tab is ${state.activeTab}`);
                } else {
                    console.warn("[MainDebugPanel-DIAGNOSTIC] miningPanelContentWrapper is null during updateActiveTab for mining section.");
                }
            } else {
                // If another tab becomes active, ensure mining panel content is hidden if it exists
                if (miningPanelContentWrapper && state.activeTab !== 'mining') {
                     // miningPanelContentWrapper.style.display = 'none'; // This might be too aggressive if the mining tab section itself isn't visible
                }
            }
        }
    });
    buttonsContainer.childNodes.forEach(node => {
        if (node instanceof HTMLElement && node.classList.contains('debug-button')) {
            const isButtonForActiveTab = node.textContent?.toLowerCase().includes(state.activeTab.toLowerCase()) || 
                             (node.id === 'main-debug-mining-tab-button' && state.activeTab === 'mining');
            node.style.fontWeight = isButtonForActiveTab ? 'bold' : 'normal';
             // Example: Update button text for mining panel based on active state
            if (node.id === 'main-debug-mining-tab-button') {
                const miningWrapperVisible = miningPanelContentWrapper && miningPanelContentWrapper.style.display !== 'none';
                // Button text should reflect ability to open if (active AND hidden) OR (inactive)
                // And ability to close if (active AND visible)
                if (state.activeTab === 'mining' && miningWrapperVisible) {
                    node.textContent = 'Close Mining Panel';
                } else {
                    node.textContent = 'Open Mining Panel';
                }
            }
        }
    });
}

// NEW Helper function to activate the mining tab and ensure its content is ready
function activateMiningTabAndEnsureContent() {
    const miningTabId = 'mining';
    console.log(`[MainDebugPanel-DIAGNOSTIC] activateMiningTabAndEnsureContent called. Current active tab: ${uiState.activeTab}`);

    // uiState.activeTab = miningTabId; // Explicitly set mining tab as active // <<< Already handled by tab button click

    if (!miningPanelTabContent) { // If the JS variable holding the DOM element is null
        console.log("[MainDebugPanel-DIAGNOSTIC] Mining panel content (miningPanelTabContent) JS reference is null. Calling createMiningPanelTab.");
        const deps: MiningTabDependencies = {}; // Pass actual deps if/when diagnostic is removed
        miningPanelTabContent = createMiningPanelTab(deps); // Create the DOM element and store its reference
        console.log("[MainDebugPanel-DIAGNOSTIC] createMiningPanelTab returned:", miningPanelTabContent);
    } else {
        console.log("[MainDebugPanel-DIAGNOSTIC] Mining panel content (miningPanelTabContent) JS reference exists.");
    }

    // Ensure the (now definitely existing in JS variable) miningPanelTabContent is correctly placed in the wrapper
    if (miningPanelTabContent && miningPanelContentWrapper) {
        // Log outerHTML of miningPanelTabContent BEFORE append
        if (miningPanelTabContent) {
            const contentOuterHTML = miningPanelTabContent.outerHTML;
            console.log(`[MainDebugPanel-DIAGNOSTIC] miningPanelTabContent.outerHTML before append (first 200 chars): ${contentOuterHTML ? contentOuterHTML.substring(0, 200) : 'null or empty'}`);
        } else {
            console.log("[MainDebugPanel-DIAGNOSTIC] miningPanelTabContent is null before attempting to get outerHTML.");
        }

        miningPanelContentWrapper.innerHTML = ''; // Clear existing content
        miningPanelContentWrapper.appendChild(miningPanelTabContent);
        console.log(`[MainDebugPanel-DIAGNOSTIC] miningPanelContentWrapper.innerHTML after clear and append (first 200 chars): ${miningPanelContentWrapper.innerHTML ? miningPanelContentWrapper.innerHTML.substring(0, 200) : 'empty'}`);

        // Check if the elements are findable immediately after appending
        const hoverInfoDiv = document.getElementById('diagnostic-hover-info');
        const brushInfoDiv = document.getElementById('diagnostic-brush-info');
        console.log(`[MainDebugPanel-DIAGNOSTIC] After append, getElementById('diagnostic-hover-info'):`, hoverInfoDiv);
        console.log(`[MainDebugPanel-DIAGNOSTIC] After append, getElementById('diagnostic-brush-info'):`, brushInfoDiv);

    } else {
        console.error("[MainDebugPanel-DIAGNOSTIC] Cannot ensure mining tab content: At least one critical element is null during append.");
        if (!miningPanelTabContent) {
            console.error("[MainDebugPanel-DIAGNOSTIC] CULPRIT: miningPanelTabContent IS NULL at append time.");
        }
        if (!miningPanelContentWrapper) {
            console.error("[MainDebugPanel-DIAGNOSTIC] CULPRIT: miningPanelContentWrapper IS NULL at append time.");
            // ATTEMPT TO SHOW EMERGENCY PANEL AS FALLBACK
            if (window.miningPanelTabUtils && typeof window.miningPanelTabUtils.setEmergencyPanelVisible === 'function') {
                console.log("[MainDebugPanel-DIAGNOSTIC] Main mining panel container missing, attempting to show EMERGENCY panel.");
                window.miningPanelTabUtils.setEmergencyPanelVisible(true);
            } else {
                console.error("[MainDebugPanel-DIAGNOSTIC] Could not show emergency panel: miningPanelTabUtils.setEmergencyPanelVisible is not available.");
            }
        }
    }

    // Make the content wrapper visible
    if (miningPanelContentWrapper) {
        miningPanelContentWrapper.style.display = 'block';
        console.log("[MainDebugPanel-DIAGNOSTIC] miningPanelContentWrapper display set to 'block' in activateMiningTabAndEnsureContent.");
    } else {
        console.error("[MainDebugPanel-DIAGNOSTIC] miningPanelContentWrapper is null, cannot make it visible in activateMiningTabAndEnsureContent.");
    }

    if (window.miningPanelTabUtils && typeof window.miningPanelTabUtils.setMiningTabActiveStatus === 'function') {
        window.miningPanelTabUtils.setMiningTabActiveStatus(true);
        console.log("[MainDebugPanel-DIAGNOSTIC] setMiningTabActiveStatus(true) called.");
    } else {
        console.warn("[MainDebugPanel-DIAGNOSTIC] window.miningPanelTabUtils.setMiningTabActiveStatus not available.");
    }

    if (tabButtonsContainer && tabSectionsContainer) {
        updateActiveTab(uiState, tabButtonsContainer, tabSectionsContainer);
        console.log("[MainDebugPanel-DIAGNOSTIC] updateActiveTab called from activateMiningTabAndEnsureContent.");
    } else {
        console.warn("[MainDebugPanel-DIAGNOSTIC] tabButtonsContainer or tabSectionsContainer is null. Cannot call updateActiveTab from activateMiningTabAndEnsureContent.");
    }
    console.log("[MainDebugPanel-DIAGNOSTIC] activateMiningTabAndEnsureContent finished.");
}