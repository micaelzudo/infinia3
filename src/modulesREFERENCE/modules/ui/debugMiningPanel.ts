import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Needed for isolated view
import { CHUNK_SIZE } from '../../constants_debug'; // Still potentially useful
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug'; // Keep for adapting generation
import { createUnifiedPlanetMaterial } from '../rendering/materials'; // Keep for adapting generation
import { disposeNode } from '../../disposeNode_debug'; // Keep for adapting cleanup
import { generateNoiseMap } from '../../noiseMapGenerator_debug'; // Need this for generation
import { editNoiseMapChunks } from '../../noiseMapEditor_debug'; // Need this for editing
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../types_debug'; // Need NoiseMap/LoadedChunks here
import type { TopElementsData } from '../types/renderingTypes'; // Keep for generation types

// --- Helper Function for Adding Tooltips --- 
function addTooltip(element: HTMLElement, text: string) {
    if (text) {
        element.title = text;
    }
}

// Interface for dependencies passed from main panel
interface MiningDebugDependencies {
    // Only keep dependencies needed for the *isolated* generation
    noiseLayers: NoiseLayers; 
    seed: Seed; 
    compInfo: { topElements: TopElementsData | null }; 
    // Removed main scene/camera/chunks/initFn/cleanupFn as they are likely not used by the isolated view
}

// --- Module State for the Embedded Isolated Viewer ---
let miningPanelContainer: HTMLElement | null = null;
let miningCanvas: HTMLCanvasElement | null = null;
let utilitiesContainer: HTMLElement | null = null; // << NEW
let canvasContainer: HTMLElement | null = null; // << NEW
let miningRenderer: THREE.WebGLRenderer | null = null;
let miningScene: THREE.Scene | null = null;
let miningCamera: THREE.PerspectiveCamera | null = null;
let miningControls: OrbitControls | null = null;
let miningLight: THREE.DirectionalLight | null = null;
let miningTerrainMesh: THREE.Mesh | null = null;
let miningAnimationFrameId: number | null = null;
let isMiningViewInitialized = false;
let miningStatusElement: HTMLElement | null = null; // To display status/feedback
let miningTerrainNoiseMap: NoiseMap | null = null; // Store the noise map for editing

let storedMiningDependencies: MiningDebugDependencies | null = null;
let miningLogCallback: ((keys: string[]) => void) | null = null; // Callback placeholder (maybe unused)
const MINING_CHUNK_KEY = '0,0'; // Constant key for the single chunk
let miningStatusTimeoutId: number | null = null; // For status message timeout
let miningResizeObserver: ResizeObserver | null = null; // Store resize observer

// --- Initialization ---
function initMiningView(container: HTMLDivElement, canvas: HTMLCanvasElement) {
    if (!container || !canvas) {
        console.error("[MiningPanel] Container or Canvas element is required for init.");
        throw new Error("Container or Canvas element is required.");
    }
    miningPanelContainer = container; 

    // Basic Scene Setup
    miningScene = new THREE.Scene();
    miningScene.background = new THREE.Color('#1a202c'); 

    // Renderer
    miningRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); 
    miningRenderer.setSize(container.clientWidth, container.clientHeight); // Initial size based on container
    // Renderer size now handled by CSS + ResizeObserver

    // Camera (Perspective, top-down view)
    const aspect = container.clientWidth / container.clientHeight;
    miningCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    miningCamera.position.set(0, 50, 0); 
    miningCamera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    miningScene.add(ambientLight);
    miningLight = new THREE.DirectionalLight(0xffffff, 0.8);
    miningLight.position.set(5, 10, 7.5);
    miningScene.add(miningLight);

    // Controls
    miningControls = new OrbitControls(miningCamera, miningRenderer.domElement);
    miningControls.target.set(0, 0, 0);
    miningControls.enablePan = true;
    miningControls.enableZoom = true;
    miningControls.update();

    // Handle Resize (Listen on the canvas container element - ID from CSS)
    const canvasContainerElement = document.getElementById('mining-panel-canvas-container'); 
    if (!canvasContainerElement) {
        console.error("[MiningPanel] Could not find canvas container (#mining-panel-canvas-container) for resize observer.");
        return;
    }
    const onResize = () => {
        if (!miningRenderer || !miningCamera || !canvasContainerElement) return;
        const width = canvasContainerElement.clientWidth;
        const height = canvasContainerElement.clientHeight;
        
        if (width > 0 && height > 0 && (miningRenderer.domElement.width !== width || miningRenderer.domElement.height !== height)) {
             console.log(`[MiningPanel] Resizing renderer to ${width}x${height}`);
             miningRenderer.setSize(width, height);
             if (miningCamera instanceof THREE.PerspectiveCamera) {
                 miningCamera.aspect = width / height;
             }
             miningCamera.updateProjectionMatrix();
        }
    };
    miningResizeObserver = new ResizeObserver(onResize);
    miningResizeObserver.observe(canvasContainerElement);

    // Start Render Loop (Will be called after init)
    console.log("[MiningPanel] Isolated View Initialized");
    isMiningViewInitialized = true;
}

// --- View Reset Function ---
function resetMiningView() {
    if (miningCamera && miningControls) {
        miningCamera.position.set(0, 50, 0); 
        miningCamera.lookAt(0, 0, 0);       
        miningControls.target.set(0, 0, 0);   
        miningControls.update();              
        console.log("[MiningPanel] View Reset.");
        if (miningStatusElement) {
            miningStatusElement.textContent = 'View reset.';
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready';
            }, 1500);
        }
    } else {
        console.warn("[MiningPanel] Cannot reset view, camera or controls missing.");
    }
}

// --- Terrain Generation ---
function generateMiningTerrain(params: MiningDebugDependencies) {
    if (!miningScene) {
        console.error("[MiningPanel] Scene not initialized for terrain generation.");
        return;
    }
    // Store params in storedMiningDependencies for potential regeneration
    storedMiningDependencies = params; 

    if (miningTerrainMesh) {
        disposeNode(miningScene, miningTerrainMesh);
        miningTerrainMesh = null;
        miningTerrainNoiseMap = null;
    }

    console.log("[MiningPanel] Generating noise map for isolated chunk...");
    try {
        // Use stored dependencies for generation
        miningTerrainNoiseMap = generateNoiseMap(0, 0, 0, params.noiseLayers, params.seed, false);
        console.log("[MiningPanel] Noise map generated successfully.");
    } catch (error: any) {
        console.error("[MiningPanel] Error generating noise map:", error);
        miningTerrainNoiseMap = null;
        if (miningStatusElement) miningStatusElement.textContent = 'Error: Noise gen failed.';
        return;
    }

    regenerateMiningMesh(); // Call the adapted mesh regeneration

     if (miningControls && miningCamera) {
        // Reset view after generation
        resetMiningView();
     }
}

// --- Mesh Regeneration ---
function regenerateMiningMesh() {
     if (!miningScene || !miningTerrainNoiseMap || !storedMiningDependencies?.compInfo) {
          console.error("[MiningPanel] Cannot regenerate mesh, missing scene, noise map, or compInfo.");
          if (miningStatusElement) miningStatusElement.textContent = 'Error: Mesh regen failed (deps).';
          return;
     }
     if (miningTerrainMesh) {
         disposeNode(miningScene, miningTerrainMesh);
         miningTerrainMesh = null;
     }

      console.log("[MiningPanel] Regenerating mesh...");
      const vertices = generateMeshVertices(0, 0, 0, { noiseMap: miningTerrainNoiseMap }, true);

      if (!vertices || vertices.length === 0) {
          console.warn("[MiningPanel] Mesh generation produced no vertices.");
          if (miningStatusElement) miningStatusElement.textContent = 'Warning: No vertices generated.';
          return;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();

      const material = createUnifiedPlanetMaterial(storedMiningDependencies.compInfo.topElements);
      miningTerrainMesh = new THREE.Mesh(geometry, material);
      miningTerrainMesh.name = `mining_chunk_${MINING_CHUNK_KEY}`;
      miningScene.add(miningTerrainMesh);
      console.log("[MiningPanel] Mesh regenerated and added to scene.");
      if (miningStatusElement) miningStatusElement.textContent = 'Ready';
}

// --- Editing Setup ---
function setupMiningEditing(
    callback?: (keys: string[]) => void // Keep callback optional
) {
    if (!miningRenderer || !miningCamera || !miningScene) {
         console.error("[MiningPanel] Cannot set up editing - viewer not fully initialized.");
         return;
    }
    miningLogCallback = callback ?? null; // Store the callback if provided
    // miningStatusElement is already set during populate

    if (miningStatusElement) {
        miningStatusElement.textContent = 'Ready (Click to Edit)'; // Update status
    }

    const canvas = miningRenderer.domElement;
    canvas.addEventListener('mousedown', handleMiningEdit); // Use adapted handler
    // Prevent context menu on the canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); 
    console.log("[MiningPanel] Editing setup complete.");
}

// --- Editing Handler ---
function handleMiningEdit(event: MouseEvent) {
    if (!miningRenderer || !miningCamera || !miningScene || !miningTerrainMesh || !miningTerrainNoiseMap || !storedMiningDependencies) { 
        console.warn("[MiningPanel] Cannot perform edit, dependencies missing.");
        return;
    }

    const rect = miningRenderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, miningCamera);

    const intersects = raycaster.intersectObject(miningTerrainMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const remove = event.button === 2; // Right click
        const actionText = remove ? 'Removed' : 'Added';
        const coordsText = `[X: ${point.x.toFixed(1)}, Z: ${point.z.toFixed(1)}]`; // Focus on X, Z

        console.log(`[MiningPanel] Edit: ${actionText} terrain at ${coordsText}`);

        // Update Status Bar
        if (miningStatusElement) {
            miningStatusElement.textContent = `${actionText} terrain at ${coordsText}`;
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready (Click to Edit)'; // Back to ready state
            }, 3000); 
        }

        // Create a temporary structure matching what editNoiseMapChunks expects
        const pseudoLoadedChunks: LoadedChunks = {
             [MINING_CHUNK_KEY]: { 
                 noiseMap: miningTerrainNoiseMap, 
                 mesh: miningTerrainMesh as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> 
             }
        };

        // Call editing function
        const editChunksCoordsResult: number[][] = editNoiseMapChunks(
            pseudoLoadedChunks, // Use the pseudo chunk data
            point,
            remove,
            storedMiningDependencies.noiseLayers,
            storedMiningDependencies.seed
        );

        if (editChunksCoordsResult && editChunksCoordsResult.length > 0) {
            console.log("[MiningPanel] Noise map edited, regenerating mesh...");
            // Update the stored noise map (editNoiseMapChunks modifies it in place)
            miningTerrainNoiseMap = pseudoLoadedChunks[MINING_CHUNK_KEY].noiseMap;
            regenerateMiningMesh(); // Regenerate the single mesh

            // If a callback was provided, call it (though likely unused here)
            if (miningLogCallback) {
                miningLogCallback([MINING_CHUNK_KEY]);
            }
        } else {
             console.log("[MiningPanel] Edit did not affect the noise map.");
        }
    } else {
        console.log("[MiningPanel] Edit ray missed terrain.");
        if (miningStatusElement) {
            miningStatusElement.textContent = 'Edit miss';
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready (Click to Edit)';
            }, 1500);
        }
    }
}

// --- Render Loop ---
function miningAnimate() {
    // Check if cleanup has occurred
    if (!miningRenderer || !miningScene || !miningCamera) {
        miningAnimationFrameId = null;
        return;
    }
    miningAnimationFrameId = requestAnimationFrame(miningAnimate);

    if (miningControls) {
        miningControls.update();
    }
    miningRenderer.render(miningScene, miningCamera);
}

// --- Cleanup ---
function cleanupMiningView() {
     console.log("[MiningPanel] Cleaning up isolated view...");
     if (miningAnimationFrameId) {
        cancelAnimationFrame(miningAnimationFrameId);
        miningAnimationFrameId = null;
    }
    // Disconnect resize observer
    if (miningResizeObserver) {
        miningResizeObserver.disconnect();
        miningResizeObserver = null;
    }
    // Remove listeners from canvas
    if (miningRenderer) {
         const canvas = miningRenderer.domElement;
         canvas.removeEventListener('mousedown', handleMiningEdit);
         // Context menu listener removal might be tricky if anonymous
    }

    if (miningControls) {
        miningControls.dispose();
        miningControls = null;
    }
    if (miningScene) {
        disposeNode(miningScene); // Use disposeNode for thorough cleanup
        miningScene = null;
    }
    if (miningRenderer) {
        miningRenderer.dispose();
        miningRenderer = null;
    }
    // Nullify other THREE object references
    miningCamera = null;
    miningLight = null;
    miningTerrainMesh = null;
    miningTerrainNoiseMap = null;
    miningLogCallback = null;
    isMiningViewInitialized = false; // Reset init flag
    console.log("[MiningPanel] Isolated view cleanup complete.");
}

// ---------------------------------------------------------------


/**
 * Populates the provided section element with the NEW mining panel UI layout using CSS classes.
 */
export function populateMiningSection(
    sectionElement: HTMLElement,
    dependencies: MiningDebugDependencies
) {
    console.log("[MiningPanel] Populating section with NEW layout...");
    // --- Dependency Check --- 
    let dependenciesValid = true;
    if (!dependencies) { 
        console.error("[MiningPanel] FATAL: dependencies object was not provided!");
        dependenciesValid = false; 
    }
    else { 
        const requiredKeys: (keyof MiningDebugDependencies)[] = [
            'noiseLayers', 'seed', 'compInfo'
        ];
        for (const key of requiredKeys) {
            if (!(key in dependencies) || dependencies[key] === undefined || dependencies[key] === null) {
                console.error(`[MiningPanel] FATAL: Missing or invalid dependency: '${key}'`);
                dependenciesValid = false;
            }
        }
     }
    if (!dependenciesValid) { 
         console.error("[MiningPanel] Cannot populate mining panel due to missing dependencies.");
         sectionElement.innerHTML = '<p style="color: red;">Error: Missing dependencies for isolated view.</p>';
         return; // Stop population
     }
    // ----------------------

    storedMiningDependencies = dependencies; 
    miningPanelContainer = sectionElement; 

    // Clear any previous content
    sectionElement.innerHTML = ''; 
    // sectionElement itself might need classes if it's not the one with ID main-debug-section-mining
    // Assuming sectionElement IS #main-debug-section-mining from mainDebugPanel.ts

    // --- Create Utilities Container --- 
    utilitiesContainer = document.createElement('div');
    utilitiesContainer.id = 'mining-utilities-container'; // ID used by CSS
    sectionElement.appendChild(utilitiesContainer);

    // --- Add Utilities --- (Buttons styled by CSS selector)
    const utilsTitle = document.createElement('h5'); // h5 styled by CSS
    utilsTitle.textContent = 'Mining/Editing Utilities';
    utilitiesContainer.appendChild(utilsTitle);

    const resetButton = document.createElement('button'); // Button styled by CSS
    resetButton.textContent = 'Reset View';
    addTooltip(resetButton, "Reset the camera view");
    resetButton.onclick = resetMiningView;
    utilitiesContainer.appendChild(resetButton);

    utilitiesContainer.appendChild(createSliderControl('Brush Size', '1', '10', '1', '3'));
    utilitiesContainer.appendChild(createSliderControl('Strength', '0.1', '1.0', '0.1', '0.5'));
    
    const modeButton = document.createElement('button'); // Button styled by CSS
    modeButton.textContent = 'Mode: Add';
    addTooltip(modeButton, "Toggle between Add and Remove modes (Not implemented yet)");
    // TODO: Add click handler to toggle mode
    utilitiesContainer.appendChild(modeButton);

    // --- Create Large Canvas Container --- 
    canvasContainer = document.createElement('div') as HTMLDivElement;
    canvasContainer.id = 'mining-panel-canvas-container'; // ID used by CSS
    sectionElement.appendChild(canvasContainer);

    // --- Create Canvas Element --- (Styled by parent CSS)
    miningCanvas = document.createElement('canvas');
    canvasContainer.appendChild(miningCanvas);
    
    // --- Status Text --- 
    miningStatusElement = document.createElement('div'); 
    miningStatusElement.id = 'mining-status-element'; // ID used by CSS
    miningStatusElement.textContent = 'Initializing...';
    sectionElement.appendChild(miningStatusElement);

    // --- Initialize the Isolated View (Deferred) --- 
    requestAnimationFrame(() => {
        if (miningCanvas && canvasContainer) { // Type guard ensures canvasContainer is not null
            try {
                console.log("[MiningPanel] Initializing Three.js instance...");
                 // Pass canvasContainer for sizing/resize, miningCanvas for rendering
                initMiningView(canvasContainer as HTMLDivElement, miningCanvas); // Cast to satisfy linter
                
                console.log("[MiningPanel] Generating initial terrain...");
                generateMiningTerrain(storedMiningDependencies!); 
                
                console.log("[MiningPanel] Setting up editing...");
                setupMiningEditing(); // Setup editing listeners
                
                console.log("[MiningPanel] Starting render loop...");
                miningAnimate(); // Start the render loop
                
                if(miningStatusElement) miningStatusElement.textContent = 'Ready (Click Canvas to Edit)';
                
            } catch (error) {
                 console.error("[MiningPanel] Error during initialization:", error);
                 if(miningStatusElement) miningStatusElement.textContent = 'Error: Init failed.';
                 cleanupMiningView(); // Attempt cleanup if init fails
            }
        } else {
            console.error("[MiningPanel] Canvas elements not found for deferred init.");
             if(miningStatusElement) miningStatusElement.textContent = 'Error: Canvas init failed.';
        }
    });

    console.log("[MiningPanel] NEW Section layout populated.");
}

/**
 * Updates visuals (Resize Handling)
 */
export function updateMiningDebugVisuals() {
    console.log("[MiningPanel] Updating visuals (resize check)...");
    // Trigger resize handling logic manually if needed, 
    // but ResizeObserver in initMiningView should handle most cases.
    if (isMiningViewInitialized && miningRenderer && miningCamera && miningCanvas && canvasContainer) {
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        if(width > 0 && height > 0) {
           if (miningRenderer.domElement.width !== width || miningRenderer.domElement.height !== height) {
              miningRenderer.setSize(width, height);
              miningCamera.aspect = width / height;
              miningCamera.updateProjectionMatrix();
              console.log(`[MiningPanel] Resized renderer via updateVisuals to ${width}x${height}.`);
           }
        }
    } else {
         // console.log("[MiningPanel] Skipping resize update - view not initialized or elements missing.");
    }
}

/**
 * Cleans up resources used by the mining debug panel.
 */
export function cleanupMiningDebugPanel() {
    console.log("[MiningPanel] Cleaning up (new layout)...");
    cleanupMiningView(); // <<< Call the adapted cleanup function
    
    // Clear non-THREE state variables 
    miningPanelContainer = null;
    miningCanvas = null;
    utilitiesContainer = null; 
    canvasContainer = null; 
    // Renderer, Scene, Camera etc are nulled within cleanupMiningView
    miningStatusElement = null;
    storedMiningDependencies = null;
    if (miningStatusTimeoutId) {
        clearTimeout(miningStatusTimeoutId);
        miningStatusTimeoutId = null;
    }
    console.log("[MiningPanel] Cleanup complete (new layout).");
}

// --- Helper Function for creating controls (Using CSS classes) ---
function createSliderControl(label: string, min: string, max: string, step: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'slider-control-row'; // Class for styling row
    
    const labelEl = document.createElement('label'); // Label styled by CSS
    labelEl.textContent = label;
    
    const inputEl = document.createElement('input'); // Input styled by CSS
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