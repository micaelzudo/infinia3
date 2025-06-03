import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Use .js extension
import * as CANNON from 'cannon-es'; // <<< ADDED: Import Cannon physics engine
import cannonDebugger from 'cannon-es-debugger'; // <<< ADDED: Import Cannon debugger
import { editNoiseMapChunks } from '../../noiseMapEditor_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { disposeNode } from '../../disposeNode_debug';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug'; // CORRECTED IMPORT
import type { NoiseMap, NoiseLayers, Seed, Generate, LoadedChunks } from '../../types_debug'; // <<< Import LoadedChunks
import type { TopElementsData } from '../types/renderingTypes';
import { createInternalVisualizerMaterial } from '../rendering/materials';
import { getChunkKeyY } from '../../utils_debug'; // <<< Import getChunkKeyY
import { getMaterialIndexAtPoint_TS, createInternalMaterialGrid } from '../../../src/modules/rendering/InternalMaterialGrid'; // <<< RESTORED import
import SpacetimeDBWorker from './spacetimedbWorker';
import { SpacetimeDBIntegration } from './spacetimedbIntegration';
// import { addBoundaryDebugVisualization, removeBoundaryDebugVisualization } from './boundaryDebugVisualizer'; // <<< COMMENTED OUT
import type { ChunkMeshesRef } from './playerMovement'; // <<< IMPORT ChunkMeshesRef for its own use
// Re-export ChunkMeshesRef from playerMovement
export type { ChunkMeshesRef } from './playerMovement';
import { addTrueChunkBoundariesVisualization, removeTrueChunkBoundariesVisualization } from './trueBoundaryVisualizer';
import { generateNoiseMapForChunk, generateNoiseMapForChunkSERIAL } from '../../modules/world/noiseMapGenerator_debug';
import { addTheoreticalChunkBoundaries, removeTheoreticalChunkBoundaries } from './theoreticalBoundaryVisualizer';
import { ProceduralGenerationSettings, getProceduralGenerationSettings, createProceduralGenerationPanel, toggleProceduralGenerationPanel, cleanupProceduralGenerationPanel, getIsTheoreticalBoundariesActive, setRequestUpdateBoundaryVisualsCallback } from './proceduralGenerationPanel'; // Import settings type and getter
import {
    createInternalGridControlsPanel,
    toggleInternalGridControlsPanel,
    getInternalGridSettings,
    updateInternalGridSettings,
    InternalGridSettings,
    updateChunkCountDisplay,
    cleanupInternalGridControlsPanel
} from './internalGridControlsPanel';
// --- Yuka AI Imports ---
import { initYuka, updateYuka, cleanupYuka, spawnYukaAgent } from '../ai/yukaController';
import { createYukaAIPanel, cleanupYukaAIPanel, toggleYukaAIPanel } from './yukaAiPanel';
import { updateYukaWorld } from '../ai/yukaManager'; // <<< ADDED IMPORT
import { logThrottled } from '../../logThrottler'; // Import the throttler

// --- Import Mining System ---
import { ResourceInventory, createInventory, getResourcesArray } from '../mining/resourceInventory';
import { MiningTool, MiningToolType, createDefaultTools, mineAtPoint, damageTool } from '../mining/miningSystem';
import { mineAreaAtPoint, AreaMiningResult } from '../mining/areaMiningSystem';
import { ResourceCalculationResult, estimateTotalResources, calculateTotalResourceUnits } from '../mining/resourceCalculator';
import { createSimpleMiningPanel, updateResourceStatsPanel, updateResourceCounterPanel, updateInventoryPanel, updateResourceCounterWithVolumeData } from '../mining/simpleMiningPanel';
import {
    volumeCompositionToString,
    type VolumeCompositionResult as ActualVolumeCompositionResult,
    analyzeVolumeComposition as importedAnalyzeVolumeCompositionFunction
} from '../mining/volumeCompositionAnalyzer';

// --- Import Isolated First Person Logic ---
import {
    initIsolatedFirstPerson,
    cleanupIsolatedFirstPerson,
    updateIsolatedFirstPerson,
    getIsolatedFirstPersonCamera, // Import getter for camera
    type IsolatedChunkData // <<< IMPORT the correct type definition
} from './isolatedFirstPerson';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'; // Need this type

// --- Import Isolated Third Person Logic (NEW) ---
import {
    initIsolatedThirdPerson,
    cleanupIsolatedThirdPerson,
    updateIsolatedThirdPerson,
    getIsolatedThirdPersonCamera,
    // type InitIsolatedThirdPersonParams // If you need to reference the type here
} from './isolatedThirdPerson';
// --- End Import ---

// --- Import Wilderness Integration ---
import { initWildernessIntegration } from '../wilderness/wildernessIntegration';
// --- End Import ---

// --- Import Procedural Generation Panel Logic (NEW) ---
// REMOVE THE DUPLICATE IMPORT THAT WAS HERE
// The original import for these is likely much earlier in the file.
// For example, it might be around line 22 or so based on previous context if this is a large file.
// We only needed to add the internalGridControlsPanel import below.
// import { createProceduralGenerationPanel, toggleProceduralGenerationPanel, cleanupProceduralGenerationPanel, getIsTheoreticalBoundariesActive, setRequestUpdateBoundaryVisualsCallback } from './proceduralGenerationPanel';
// --- End Import ---

// --- Module State ---
let containerElement: HTMLDivElement | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let orbitControls: OrbitControls | null = null; // Renamed for clarity
let animationFrameId: number | null = null;
let raycastBoxMesh: THREE.Mesh | null = null;
let editBrushMesh: THREE.Mesh | null = null; // <<< ADD state for brush mesh
let editBrushRadius = 4; // <<< ADD state for brush radius (matches noiseMapEditor for now)
let editBrushStrength = 0.5; // <<< ADD state for strength (default)
let editBrushShape = 'sphere'; // Options: 'sphere', 'cube', 'cylinder'
let editBrushVerticality = 20; // Vertical stretch factor (default: 20x)
let editBrushMode = 'add'; // Options: 'add', 'remove'
let internalGridVisible = false; // Track if internal grid visualizer is visible
let internalGridSettingsForViewer: InternalGridSettings | null = null; // <<< NEW STATE for current grid settings
let internalGridControlsPanelElement: HTMLElement | null = null; // <<< NEW STATE for the panel element

// --- SpacetimeDB State ---
let spacetimeWorker: SpacetimeDBWorker | null = null;
let chunkDataMap: Map<string, NoiseMap> = new Map();
const CHUNK_LOAD_RADIUS = 2;
let centralChunkKey = '0,0,0';

// --- Yuka AI State ---
let yukaAiPanelElement: HTMLElement | null = null;
let isYukaInitialized = false;

// --- Mining System State ---
let playerInventory: ResourceInventory = createInventory(100);
let miningTools: { [key in MiningToolType]: MiningTool } = createDefaultTools();
let activeTool: MiningToolType = MiningToolType.HAND;
let resourceCalculationResult: ResourceCalculationResult | null = null;
let miningPanelContainer: HTMLElement | null = null;
let resourceStatsPanel: HTMLElement | null = null;
let miningInfoPanel: HTMLElement | null = null;
let inventoryPanel: HTMLElement | null = null;
let miningEffectsContainer: HTMLElement | null = null;
let miningPanelVisible = false; // <<< ADDED: State to track visibility
let proceduralGenerationPanelElement: HTMLElement | null = null; // <<< ADDED: State for the new panel
let wildernessSurvivalPanelElement: HTMLElement | null = null; // <<< ADDED: State for the Wilderness Survival panel
let isWildernessPanelVisible = false; // <<< ADDED: State for Wilderness Survival panel visibility


// First Person Mode State
let isFirstPersonMode = false;
let fpCameraRef: THREE.PerspectiveCamera | null = null; // Reference to the FP camera when active
let fpControlsRef: PointerLockControls | null = null; // Reference to the FP controls when active

// Third Person Mode State (NEW)
let isThirdPersonMode = false;
let tpCameraRef: THREE.PerspectiveCamera | null = null; // Reference to the TP camera when active (NEW)

// Parameters needed for regeneration/editing
let currentNoiseLayers: NoiseLayers | null = null;
let currentSeed: Seed | null = null;
let currentCompInfo: { topElements: TopElementsData | null } | null = null;
let currentPlanetOffset: THREE.Vector3 | null = null;
let currentNoiseScale: number | null = null;

let logCallback: ((keys: string[]) => void) | null = null; // Callback to report affected chunks
// Use the 3D key format
const ISOLATED_CHUNK_X = 0;
const ISOLATED_CHUNK_Y = 0;
const ISOLATED_CHUNK_Z = 0;
const ISOLATED_CHUNK_KEY = `${ISOLATED_CHUNK_X},${ISOLATED_CHUNK_Y},${ISOLATED_CHUNK_Z}`;

// UI Elements controlled by this module (references passed in)
let statusElementRef: HTMLElement | null = null;
let statusTimeoutId: number | null = null;
// Correctly type internalVisualizerLayers to hold groups or meshes
let internalVisualizerLayers: THREE.Object3D[] = []; // <<< Use array for layers, typed as Object3D[]
let logPanelElement: HTMLElement | null = null; // <<< ADD state for log panel

// Define our own interface for loaded chunk data with playerEditMask


// <<< Persistent store for the single chunk's data - uses the IMPORTED type >>>
let isolatedLoadedChunkData: { [key: string]: IsolatedChunkData & { physicsBody?: CANNON.Body | null } } = {};
// We no longer need a separate terrainNoiseMap variable if we always read from isolatedLoadedChunkData
// let terrainNoiseMap: NoiseMap | null = null;

// <<< ADDED: Module-level store for current chunk meshes for collision >>>
let currentChunkMeshesForCollision: ChunkMeshesRef = {};

// <<< ADDED: Export function to get chunk meshes >>>
export function getActiveChunkMeshesForCollision(): ChunkMeshesRef {
    return currentChunkMeshesForCollision;
}

// State for the new "true" chunk boundary boxes
let trueChunkBoundariesGroup: THREE.Group | null = null;

// Global variable to store the keys of chunks that currently have generated meshes and visible boundaries
let currentGeneratedChunkKeys: string[] = []; // SINGLE DECLARATION

// For global chunk boundaries
let worldChunkBoundariesGroup: THREE.Group | null = null;
let worldBoundariesVisible = false;

// --- Physics State --- <<< NEW SECTION
let physicsWorld: CANNON.World | null = null;
let physicsDebugger: { update: () => void } | null = null; // For cannon-es-debugger
const physicsTimeStep = 1 / 60; // seconds (60 FPS)
let lastCallTime: number | null = null;
let groundMaterial: CANNON.Material | null = null;
let characterMaterial: CANNON.Material | null = null;
let physicsInitialized = false;
// --- End Physics State ---

// --- Initialization ---
export function initIsolatedViewer(container: HTMLDivElement) {
    if (!container) {
        console.error("IsolatedViewer: Container element is required.");
        throw new Error("Container element is required.");
    }
    containerElement = container;

    // Basic Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a202c'); // Match dark panel header background

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement); // Add canvas to container

    // --- Initialize Physics World --- <<< NEW SECTION
    physicsWorld = new CANNON.World();
    physicsWorld.gravity.set(0, -9.81, 0); // Set standard gravity
    physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld); // More performant broadphase
    physicsWorld.solver = new CANNON.GSSolver(); // <<< EXPLICITLY set solver
    (physicsWorld.solver as CANNON.GSSolver).iterations = 10; // Set iterations on GSSolver
    physicsWorld.allowSleep = true; // Allow bodies to sleep for performance

    // Define materials
    groundMaterial = new CANNON.Material("groundMaterial");
    characterMaterial = new CANNON.Material("characterMaterial");

    // Define contact material properties (friction, restitution)
    const groundCharacterContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        characterMaterial,
        {
            friction: 0.4, // Adjust friction as needed
            restitution: 0.0, // No bounce for character on ground
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3,
            // frictionEquationStiffness: 1e8, // Keep commented unless needed
            // frictionEquationRelaxation: 3
        }
    );
    physicsWorld.addContactMaterial(groundCharacterContactMaterial);

    // Initialize Debugger if scene exists
    if (scene && physicsWorld) { // <<< scene is already checked here
        physicsDebugger = cannonDebugger(scene, physicsWorld, {
             // options...
             color: 0x00ff00, // Example: set wireframe color
             scale: 1.0, // Example: set scale if needed
             onUpdate: () => {}, // Changed from autoUpdate to onUpdate, effectively manual
        });
        console.log("Cannon-es debugger initialized.");
    }
    physicsInitialized = true;
    console.log("Physics World Initialized.");
    // --- End Physics Initialization ---

    // Top-Down Camera (Orbit Camera)
    const aspect = containerElement!.clientWidth / containerElement!.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(0, 50, 0); // Position above the center
    camera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene!.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene!.add(directionalLight);

    // Orbit Controls (for top-down view)
    orbitControls = new OrbitControls(camera, renderer!.domElement);
    orbitControls.target.set(0, 0, 0);
    orbitControls.enablePan = true;
    orbitControls.enableZoom = true;
    orbitControls.update();

    // Initialize Yuka AI System
    if (scene && containerElement && renderer && camera) { // Added renderer and camera to the condition
        initYuka(scene, camera, renderer.domElement); // Pass scene, camera, then renderer.domElement
        isYukaInitialized = true;
        // Create Yuka AI Panel and connect spawn function
        // Ensure containerElement is not null before using it
        yukaAiPanelElement = createYukaAIPanel(containerElement, () => {
            if (scene && camera) { // Ensure camera is also available for spawn position
                // Example spawn position, adjust as needed
                const spawnPos = camera.position.clone().add(new THREE.Vector3(0, -2, -10).applyQuaternion(camera.quaternion));
                spawnYukaAgent(spawnPos);
            } else {
                console.warn('Yuka AI: Scene or Camera not available for spawning agent.');
            }
        });
        console.log('Yuka AI Panel and Controller initialized by IsolatedTerrainViewer.');
    } else {
        console.error('IsolatedTerrainViewer: Scene or ContainerElement not available for Yuka AI initialization.');
    }

    // Handle Resize
    const onResize = () => {
        if (!renderer || !camera || !containerElement) return;
        const width = containerElement.clientWidth;
        const height = containerElement.clientHeight;
        renderer.setSize(width, height);

        // Update the *currently active* camera's aspect ratio
        const currentCamera = isFirstPersonMode ? fpCameraRef : camera;
        if (currentCamera instanceof THREE.PerspectiveCamera) {
            currentCamera.aspect = width / height;
            currentCamera.updateProjectionMatrix();
        }
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(containerElement);
    (containerElement as any).__resizeObserver = resizeObserver;

    // *** Create and add the invisible raycast bounding box ***
    if (scene) {
        // Greatly extended raycast box to include many vertical chunks
        const boxGeometry = new THREE.BoxGeometry(
            CHUNK_SIZE,
            CHUNK_HEIGHT * 50, // Extend to include MANY more chunks below (50 chunks)
            CHUNK_SIZE
        );
        // Make the raycast box invisible but still functional for raycasting
        const boxMaterial = new THREE.MeshBasicMaterial({ visible: false, depthWrite: false });
        raycastBoxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        raycastBoxMesh.position.set(
            ISOLATED_CHUNK_X * CHUNK_SIZE,
            ISOLATED_CHUNK_Y * CHUNK_HEIGHT - CHUNK_HEIGHT * 25, // Position MUCH lower to allow editing far below (25 chunks)
            ISOLATED_CHUNK_Z * CHUNK_SIZE
        );
        raycastBoxMesh.name = "isolated_raycast_box";
        scene.add(raycastBoxMesh);
        console.log("IsolatedViewer: Added INVISIBLE raycast bounding box at position:", raycastBoxMesh.position);

        // *** Create the edit brush visualizer (initially hidden) as an ellipsoid ***
        // Create an ellipsoid shape (dramatically stretched vertically)
        const horizontalRadius = editBrushRadius;
        const verticalRadius = editBrushRadius * 20; // 20x vertical radius for MUCH deeper editing

        // Create base sphere geometry
        const baseGeometry = new THREE.SphereGeometry(1, 16, 16);

        // Scale the sphere to create an ellipsoid
        const matrix = new THREE.Matrix4().makeScale(horizontalRadius, verticalRadius, horizontalRadius);
        baseGeometry.applyMatrix4(matrix);

        const brushMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow color
            wireframe: false,
            transparent: true,
            opacity: 0.3,
            depthWrite: false // Don't obscure terrain behind it
        });
        editBrushMesh = new THREE.Mesh(baseGeometry, brushMaterial);
        editBrushMesh.visible = false; // Start hidden
        editBrushMesh.name = "isolated_edit_brush";
        scene.add(editBrushMesh);

    } else {
        console.error("IsolatedViewer: Scene not available to add raycast box or brush.");
    }

    // --- Find Buttons and SLIDERS and Attach Handlers (AFTER overlay is likely added) ---
    // Use setTimeout to defer execution slightly, allowing DOM update
    setTimeout(() => {
        const resetButton = document.getElementById('isolated-editor-reset-button') as HTMLButtonElement;
        const spawnButton = document.getElementById('isolated-editor-spawn-button') as HTMLButtonElement;
        const spawnThirdPersonButton = document.getElementById('isolated-editor-spawn-third-person-button') as HTMLButtonElement; // Get the new button
        const brushSizeSlider = document.getElementById('slider-Brush_Size') as HTMLInputElement;
        const strengthSlider = document.getElementById('slider-Strength') as HTMLInputElement;
        const verticalitySlider = document.getElementById('slider-Verticality') as HTMLInputElement;
        const brushShapeDropdown = document.getElementById('dropdown-Brush_Shape') as HTMLSelectElement;
        const modeButton = document.getElementById('mining-mode-button') as HTMLButtonElement;
        const gridButton = document.getElementById('internal-grid-button') as HTMLButtonElement;

        if (resetButton) {
            resetButton.onclick = resetIsolatedView;
        } else {
            console.error("Could not find #isolated-editor-reset-button in DOM to attach handler.");
        }

        if (spawnButton) {
            spawnButton.onclick = enterFirstPersonMode;
        } else {
            console.error("Could not find #isolated-editor-spawn-button in DOM to attach handler.");
        }

        // --- Attach handler for Spawn Third Person button ---
        if (spawnThirdPersonButton) {
            spawnThirdPersonButton.onclick = enterThirdPersonMode;
        } else {
            console.error("Could not find #isolated-editor-spawn-third-person-button in DOM to attach handler.");
        }
        // --- End Attach handler ---

        // Brush Size Slider Handler
        if (brushSizeSlider) {
            // Initialize slider value from state
            brushSizeSlider.value = String(editBrushRadius);
            brushSizeSlider.oninput = (event) => {
                const newRadius = parseFloat((event.target as HTMLInputElement).value);
                if (!isNaN(newRadius) && newRadius > 0) {
                    editBrushRadius = newRadius;
                    updateBrushVisualizer();
                    console.log(`IsolatedViewer: Brush radius set to ${editBrushRadius}`);
                    if (statusElementRef) statusElementRef.textContent = `Brush Radius: ${editBrushRadius.toFixed(1)}`;
                }
            };
        } else {
            console.error("Could not find Brush Size slider element!");
        }

        // Strength Slider Handler
        if (strengthSlider) {
            // Initialize slider value from state
            strengthSlider.value = String(editBrushStrength);
            strengthSlider.oninput = (event) => {
                const newStrength = parseFloat((event.target as HTMLInputElement).value);
                if (!isNaN(newStrength) && newStrength >= 0 && newStrength <= 1) {
                    editBrushStrength = newStrength;
                    console.log(`IsolatedViewer: Brush strength set to ${editBrushStrength}`);
                    if (statusElementRef) statusElementRef.textContent = `Brush Strength: ${editBrushStrength.toFixed(2)}`;
                }
            };
        } else {
            console.error("Could not find Strength slider element!");
        }

        // Verticality Slider Handler
        if (verticalitySlider) {
            // Initialize slider value from state
            verticalitySlider.value = String(editBrushVerticality);
            verticalitySlider.oninput = (event) => {
                const newVerticality = parseFloat((event.target as HTMLInputElement).value);
                if (!isNaN(newVerticality) && newVerticality > 0) {
                    editBrushVerticality = newVerticality;
                    updateBrushVisualizer();
                    console.log(`IsolatedViewer: Brush verticality set to ${editBrushVerticality}`);
                    if (statusElementRef) statusElementRef.textContent = `Brush Verticality: ${editBrushVerticality.toFixed(1)}`;
                }
            };
        } else {
            console.error("Could not find Verticality slider element!");
        }

        // Brush Shape Dropdown Handler
        if (brushShapeDropdown) {
            // Initialize dropdown value from state
            brushShapeDropdown.value = editBrushShape;
            brushShapeDropdown.onchange = (event) => {
                const newShape = (event.target as HTMLSelectElement).value;
                editBrushShape = newShape as 'sphere' | 'cube' | 'cylinder';
                updateBrushVisualizer();
                console.log(`IsolatedViewer: Brush shape set to ${editBrushShape}`);
                if (statusElementRef) statusElementRef.textContent = `Brush Shape: ${editBrushShape}`;
            };
        } else {
            console.error("Could not find Brush Shape dropdown element!");
        }

        // Mode Button Handler
        if (modeButton) {
            // Initialize button text and class from state
            modeButton.textContent = `Mode: ${editBrushMode.charAt(0).toUpperCase() + editBrushMode.slice(1)}`;
            modeButton.className = editBrushMode === 'add' ? 'mode-add' : 'mode-remove';

            modeButton.onclick = () => {
                editBrushMode = editBrushMode === 'add' ? 'remove' : 'add';
                modeButton.textContent = `Mode: ${editBrushMode.charAt(0).toUpperCase() + editBrushMode.slice(1)}`;
                modeButton.className = editBrushMode === 'add' ? 'mode-add' : 'mode-remove';
                updateBrushVisualizer();
                console.log(`IsolatedViewer: Brush mode set to ${editBrushMode}`);
                if (statusElementRef) statusElementRef.textContent = `Brush Mode: ${editBrushMode}`;
            };
        } else {
            console.error("Could not find Mode button element!");
        }

        // Grid Button Handler
        if (gridButton) {
            // Initialize button text (might need a separate function to check actual grid visibility vs panel)
            // For now, assume it controls the panel's visibility mainly.
            const panelInitiallyVisible = false; // Or read from a saved state if you implement that
            gridButton.textContent = panelInitiallyVisible ? 'Hide Grid Controls' : 'Show Grid Controls';
            gridButton.className = panelInitiallyVisible ? 'grid-visible' : 'grid-hidden'; // Use existing classes or new ones

            gridButton.onclick = () => {
                toggleInternalGridControlsPanel(); // This function now handles its own visibility and animation
                // Update button text based on actual panel visibility (get from internalGridControlsPanel.ts if needed)
                // For simplicity, we might need an exported getter from internalGridControlsPanel like isPanelCurrentlyVisible()
                // Or, toggleInternalGridControlsPanel could return the new state.
                // For now, let's assume the panel handles its button text updates internally or we do it via callback.
                // The main action is to show/hide the panel.
                // The actual grid update will be triggered by controls WITHIN the panel.

                // We may want to update the button text here based on panel state
                // This requires knowing if toggleInternalGridControlsPanel made it visible or hidden.
                // For now, let's assume toggleInternalGridControlsPanel itself updates the button or a global state.
                // Or, we can have a function like: const isPanelNowVisible = getIsInternalGridControlsPanelVisible(); (needs export from panel)
                // gridButton.textContent = isPanelNowVisible ? 'Hide Grid Controls' : 'Show Grid Controls';
                // gridButton.className = isPanelNowVisible ? 'grid-visible' : 'grid-hidden';
                console.log(`IsolatedViewer: Toggled internal grid CONTROLS panel.`);
            };
        } else {
            console.error("Could not find Internal Grid button element!");
        }

        // <<< INITIALIZE The Internal Grid Controls Panel >>>
        if (containerElement) { // Ensure a parent exists for the panel (though it appends to body)
            internalGridControlsPanelElement = createInternalGridControlsPanel(handleInternalGridSettingsUpdate);
            // The panel is created and appended to body, initially hidden or visible based on its own internal state.
            console.log("Internal Grid Controls Panel created.");
            // Set the callback for the panel to call when its settings change.
            // setInternalGridUpdateCallback(handleInternalGridSettingsUpdate); // This is done by passing it to createInternalGridControlsPanel
        } else {
            console.error("Cannot create Internal Grid Controls Panel: main container element not found.");
        }

        // <<< Add Collision Ray Toggle Button AFTER Spawn Button >>>
        if (spawnButton) {
             const toggleCollisionRayId = 'debug-collision-ray-toggle';
             // Check if button already exists (e.g., due to hot reload)
             if (!document.getElementById(toggleCollisionRayId)) { // Check globally first
                 const btnRayDebug = document.createElement('button');
                 btnRayDebug.id = toggleCollisionRayId;
                 btnRayDebug.textContent = window.DEBUG_COLLISION_RAYS_ENABLED ? 'Hide Collision Rays' : 'Show Collision Rays';
                 // --- Apply styles similar to other editor buttons ---
                 btnRayDebug.style.display = 'block';
                 btnRayDebug.style.width = '100%'; // Match other buttons
                 btnRayDebug.style.margin = '8px 0'; // Match typical button spacing
                 btnRayDebug.style.padding = '8px 16px';
                 btnRayDebug.style.border = '1px solid #4A5568'; // Example border
                 btnRayDebug.style.borderRadius = '4px';
                 btnRayDebug.style.cursor = 'pointer';
                 btnRayDebug.style.backgroundColor = window.DEBUG_COLLISION_RAYS_ENABLED ? '#f44336' : '#ff9800'; // Orange/Red
                 btnRayDebug.style.color = 'white';
                 btnRayDebug.style.textAlign = 'center';

                 btnRayDebug.onclick = () => {
                     window.DEBUG_COLLISION_RAYS_ENABLED = !window.DEBUG_COLLISION_RAYS_ENABLED;
                     btnRayDebug.textContent = window.DEBUG_COLLISION_RAYS_ENABLED ? 'Hide Collision Rays' : 'Show Collision Rays';
                     btnRayDebug.style.backgroundColor = window.DEBUG_COLLISION_RAYS_ENABLED ? '#f44336' : '#ff9800';
                     console.log(`Collision Ray Debugging: ${window.DEBUG_COLLISION_RAYS_ENABLED ? 'ENABLED' : 'DISABLED'}`);
                 };
                 // Insert after the spawn button
                 spawnButton.insertAdjacentElement('afterend', btnRayDebug);
                 console.log("Added Collision Ray Toggle after Spawn Button");
             }
        }
        // <<< End Collision Ray Toggle Button Addition >>>

        // <<< ADD NEW BUTTON FOR MINING PANEL >>>
        if (gridButton && gridButton.parentElement) { // Ensure gridButton and its parent exist
            const toggleMiningPanelButton = document.createElement('button');
            toggleMiningPanelButton.id = 'toggle-mining-panel-button';
            toggleMiningPanelButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M14 10h.01"></path><path d="M15 4h2a2 2 0 0 1 2 2v3.4a2 2 0 0 1-.7 1.5L14 14"></path><path d="M14 14v2a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h.5"></path></svg>Mining Panels';

            // Add modern styling
            toggleMiningPanelButton.style.display = 'flex';
            toggleMiningPanelButton.style.alignItems = 'center';
            toggleMiningPanelButton.style.justifyContent = 'center';
            toggleMiningPanelButton.style.width = '100%';
            toggleMiningPanelButton.style.margin = '10px 0';
            toggleMiningPanelButton.style.padding = '12px 16px';
            toggleMiningPanelButton.style.backgroundColor = 'rgba(59, 130, 246, 0.7)';
            toggleMiningPanelButton.style.color = 'white';
            toggleMiningPanelButton.style.border = 'none';
            toggleMiningPanelButton.style.borderRadius = '6px';
            toggleMiningPanelButton.style.fontSize = '14px';
            toggleMiningPanelButton.style.fontWeight = 'bold';
            toggleMiningPanelButton.style.cursor = 'pointer';
            toggleMiningPanelButton.style.transition = 'all 0.2s ease';
            toggleMiningPanelButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';

            // Add hover styles with event listeners
            toggleMiningPanelButton.addEventListener('mouseover', () => {
                toggleMiningPanelButton.style.backgroundColor = '#2d3748';
                toggleMiningPanelButton.style.transform = 'translateY(-2px)';
                toggleMiningPanelButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            });

            toggleMiningPanelButton.addEventListener('mouseout', () => {
                toggleMiningPanelButton.style.backgroundColor = '#4a5568';
                toggleMiningPanelButton.style.transform = 'translateY(0)';
                toggleMiningPanelButton.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
            });

            toggleMiningPanelButton.addEventListener('mousedown', () => {
                toggleMiningPanelButton.style.transform = 'translateY(1px)';
                toggleMiningPanelButton.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
            });

            toggleMiningPanelButton.addEventListener('mouseup', () => {
                toggleMiningPanelButton.style.transform = 'translateY(-2px)';
                toggleMiningPanelButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
            });

            // Create a helper function to update the button state visually
            const updateButtonState = (isVisible: boolean) => {
                if (isVisible) {
                    toggleMiningPanelButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M14 10h.01"></path><path d="M15 4h2a2 2 0 0 1 2 2v3.4a2 2 0 0 1-.7 1.5L14 14"></path><path d="M14 14v2a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h.5"></path></svg>Hide Mining Panels';
                    toggleMiningPanelButton.style.backgroundColor = 'rgba(5, 150, 105, 0.8)';
                    // Add a subtle pulsing animation when active
                    toggleMiningPanelButton.style.animation = 'pulseButton 2s infinite alternate';
                    if (!document.getElementById('button-pulse-style')) {
                        const pulseStyle = document.createElement('style');
                        pulseStyle.id = 'button-pulse-style';
                        pulseStyle.textContent = `
                            @keyframes pulseButton {
                                0% { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2); }
                                100% { box-shadow: 0 4px 15px rgba(5, 150, 105, 0.4); }
                            }
                        `;
                        document.head.appendChild(pulseStyle);
                    }
                } else {
                    toggleMiningPanelButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M14 10h.01"></path><path d="M15 4h2a2 2 0 0 1 2 2v3.4a2 2 0 0 1-.7 1.5L14 14"></path><path d="M14 14v2a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h.5"></path></svg>Show Mining Panels';
                    toggleMiningPanelButton.style.backgroundColor = 'rgba(59, 130, 246, 0.7)';
                    toggleMiningPanelButton.style.animation = 'none';
                }
            };

            // Initialize button state based on visibility
            updateButtonState(miningPanelVisible);

            toggleMiningPanelButton.onclick = () => {
                console.log("[IsolatedTerrainViewer] Toggle Mining Panel button clicked - showing both panels");

                // Toggle BOTH panels together
                    miningPanelVisible = !miningPanelVisible;

                // Update button visual state
                updateButtonState(miningPanelVisible);

                // 1. Toggle emergency panel
                if (window.miningPanelTabUtils && typeof window.miningPanelTabUtils.setEmergencyPanelVisible === 'function') {
                    window.miningPanelTabUtils.setEmergencyPanelVisible(miningPanelVisible);
                    console.log(`[IsolatedTerrainViewer] Emergency Mining Panel visibility set to: ${miningPanelVisible}`);
                } else {
                    console.error("[IsolatedTerrainViewer] Cannot show emergency panel: miningPanelTabUtils.setEmergencyPanelVisible is not available");
                }

                // 2. Toggle regular mining panel
                if (miningPanelContainer) {
                    miningPanelContainer.style.display = miningPanelVisible ? 'block' : 'none';
                    console.log(`[IsolatedTerrainViewer] Regular Mining Panel visibility set to: ${miningPanelVisible}`);

                    // Add a nice fade-in animation when showing the panel
                    if (miningPanelVisible) {
                        miningPanelContainer.style.animation = 'fadeInPanel 0.5s ease-out';
                        if (!document.getElementById('panel-fade-style')) {
                            const fadeStyle = document.createElement('style');
                            fadeStyle.id = 'panel-fade-style';
                            fadeStyle.textContent = `
                                @keyframes fadeInPanel {
                                    from { opacity: 0; transform: translateY(20px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                            `;
                            document.head.appendChild(fadeStyle);
                        }
                    }
                } else {
                    console.error("[IsolatedTerrainViewer] Cannot toggle regular mining panel: container not found");
                }
            };
            gridButton.insertAdjacentElement('afterend', toggleMiningPanelButton);
            console.log("Added Toggle Mining Panel button after Grid Button.");

            const proceduralGenButton = document.createElement('button');
            proceduralGenButton.id = 'procedural-generation-button';
            proceduralGenButton.textContent = 'Procedural Generation';
            // Style like other editor buttons
            proceduralGenButton.style.display = 'block';
            proceduralGenButton.style.width = '100%';
            proceduralGenButton.style.margin = '8px 0';
            proceduralGenButton.style.padding = '8px 16px';
            proceduralGenButton.style.border = '1px solid #4A5568';
            proceduralGenButton.style.borderRadius = '4px';
            proceduralGenButton.style.cursor = 'pointer';
            proceduralGenButton.style.backgroundColor = '#4A5568';
            proceduralGenButton.style.color = 'white';
            proceduralGenButton.style.textAlign = 'center';

            proceduralGenButton.onclick = () => {
                console.log("Procedural Generation button clicked.");
                toggleProceduralGenerationPanel(); // Call the toggle function
            };
            toggleMiningPanelButton.insertAdjacentElement('afterend', proceduralGenButton);
            console.log("Added Procedural Generation button after Toggle Mining Panel button.");

            // --- Wilderness Survival Button ---
            const wildernessSurvivalButton = document.createElement('button');
            wildernessSurvivalButton.id = 'wilderness-survival-loader-button';
            wildernessSurvivalButton.textContent = 'Load Wilderness Survival Game';
            wildernessSurvivalButton.style.display = 'block';
            wildernessSurvivalButton.style.width = '100%';
            wildernessSurvivalButton.style.margin = '8px 0';
            wildernessSurvivalButton.style.padding = '8px 16px';
            wildernessSurvivalButton.style.border = '1px solid #2c5282'; // Darker blue
            wildernessSurvivalButton.style.borderRadius = '4px';
            wildernessSurvivalButton.style.cursor = 'pointer';
            wildernessSurvivalButton.style.backgroundColor = '#3182ce'; // Blue
            wildernessSurvivalButton.style.color = 'white';
            wildernessSurvivalButton.style.textAlign = 'center';

            wildernessSurvivalButton.onclick = () => {
                console.log("Wilderness Survival Loader button clicked.");
                toggleWildernessSurvivalPanel();
            };
            // Insert after the procedural generation button, assuming it exists and its parent is valid
            const procGenButtonRef = document.getElementById('procedural-generation-button');
            if (procGenButtonRef && procGenButtonRef.parentElement) {
                 procGenButtonRef.insertAdjacentElement('afterend', wildernessSurvivalButton);
                 console.log("Added Wilderness Survival Loader button after Procedural Generation button.");
            } else {
                // Fallback: if proc gen button is not found, try inserting after toggle mining panel button
                const toggleMiningPanelButtonRef = document.getElementById('toggle-mining-panel-button');
                if (toggleMiningPanelButtonRef && toggleMiningPanelButtonRef.parentElement) {
                    toggleMiningPanelButtonRef.insertAdjacentElement('afterend', wildernessSurvivalButton);
                    console.log("Added Wilderness Survival Loader button after Toggle Mining Panel button (fallback).");
                } else {
                     console.error("Could not find a reference button to insert Wilderness Survival button.");
                }
            }
            // --- End Wilderness Survival Button ---

            // <<< Create and insert the Procedural Generation Panel AFTER the button group >>>
            if (scene) { // Ensure scene is available
                // Assuming proceduralGenButton is valid here
                const proceduralGenButton = document.getElementById('procedural-generation-button'); // Example: Get the button

                if (proceduralGenButton && proceduralGenButton.parentElement) {
                    proceduralGenerationPanelElement = createProceduralGenerationPanel(scene); // Pass scene
                    proceduralGenButton.parentElement.insertAdjacentElement('afterend', proceduralGenerationPanelElement);
                    console.log("Procedural Generation panel created and inserted after editor controls.");

                    // <<< SET THE CALLBACK HERE >>>
                    if (typeof setRequestUpdateBoundaryVisualsCallback === 'function') {
                        // MODIFIED: The callback passed to the panel now accepts settings
                        setRequestUpdateBoundaryVisualsCallback(updateBoundaryVisuals);
                        console.log("IsolatedTerrainViewer: Set requestUpdateBoundaryVisuals callback for procedural panel.");
                    } else {
                        console.warn("IsolatedTerrainViewer: setRequestUpdateBoundaryVisualsCallback function not found.");
                    }
                    // <<< END SET CALLBACK >>>
                } else {
                    console.error("Could not find procedural generation button or its parent to insert panel.");
                }
            }
            // <<< END Panel Insertion >>>
        }
        // <<< END ADD NEW BUTTON >>>

    }, 100); // Delay slightly

    // --- Add the Collision Ray Toggle Button (specifically to the Mining Panel) ---
    if (typeof window !== 'undefined') {
        // Delay slightly to ensure miningPanelContainer is created
        setTimeout(() => {
            if (miningPanelContainer) { // Check if the panel exists
                const toggleCollisionRayId = 'debug-collision-ray-toggle';
                // Check if button already exists within the panel
                if (!miningPanelContainer.querySelector(`#${toggleCollisionRayId}`)) {
                    const btnRayDebug = document.createElement('button');
                    btnRayDebug.id = toggleCollisionRayId;
                    btnRayDebug.textContent = window.DEBUG_COLLISION_RAYS_ENABLED ? 'Hide Collision Rays' : 'Show Collision Rays';
                    // --- Removed absolute positioning styles ---
                    // btnRayDebug.style.position = 'absolute';
                    // btnRayDebug.style.top = '130px';
                    // btnRayDebug.style.right = '10px';
                    // btnRayDebug.style.zIndex = '10000';
                    // --- Add styles appropriate for panel integration ---
                    btnRayDebug.style.display = 'block'; // Make it take full width
                    btnRayDebug.style.width = '90%'; // Slightly less than full width
                    btnRayDebug.style.margin = '10px auto'; // Center with margin
                    btnRayDebug.style.padding = '8px 16px';
                    btnRayDebug.style.border = 'none';
                    btnRayDebug.style.borderRadius = '4px';
                    btnRayDebug.style.cursor = 'pointer';
                    btnRayDebug.style.backgroundColor = window.DEBUG_COLLISION_RAYS_ENABLED ? '#f44336' : '#ff9800';
                    btnRayDebug.style.color = 'white';
                    btnRayDebug.style.textAlign = 'center';

                    btnRayDebug.onclick = () => {
                        window.DEBUG_COLLISION_RAYS_ENABLED = !window.DEBUG_COLLISION_RAYS_ENABLED;
                        btnRayDebug.textContent = window.DEBUG_COLLISION_RAYS_ENABLED ? 'Hide Collision Rays' : 'Show Collision Rays';
                        btnRayDebug.style.backgroundColor = window.DEBUG_COLLISION_RAYS_ENABLED ? '#f44336' : '#ff9800';
                        console.log(`Collision Ray Debugging: ${window.DEBUG_COLLISION_RAYS_ENABLED ? 'ENABLED' : 'DISABLED'}`);
                    };
                    // Append to the mining panel container
                    miningPanelContainer.appendChild(btnRayDebug);
                    console.log("Added Collision Ray Toggle to Mining Panel");
                }
            } else {
                console.warn("Mining Panel Container not found when trying to add Collision Ray Toggle.");
            }
        }, 200); // Slightly longer delay to be sure panel exists
    }
    // --- End Collision Ray Toggle Button Addition ---

    // Start Render Loop
    animate(); // Ensure this is called *after* physics init

    // Add event listeners for wilderness integration
    document.addEventListener('wilderness-tool-changed', wildernessToolChangeHandler);
    document.addEventListener('wilderness-brush-params-changed', wildernessBrushParamsChangeHandler);

    console.log("Isolated Terrain Viewer Initialized");

    // --- DEBUG: Add UI toggles for boundary mesh debugging ---
    function addDebugBoundaryMeshToggle() {
        // Toggle for boundary mesh logging
        const toggleLoggingId = 'debug-boundary-mesh-toggle';
        if (!document.getElementById(toggleLoggingId)) {
            const btnLogging = document.createElement('button');
            btnLogging.id = toggleLoggingId;
            btnLogging.textContent = 'Toggle Boundary Mesh Logging';
            btnLogging.style.position = 'absolute';
            btnLogging.style.top = '10px';
            btnLogging.style.right = '10px';
            btnLogging.style.zIndex = '10000';
            btnLogging.onclick = () => {
                window.DEBUG_BOUNDARY_MESH = !window.DEBUG_BOUNDARY_MESH;
                btnLogging.textContent = window.DEBUG_BOUNDARY_MESH ? 'Boundary Mesh Logging: ON' : 'Boundary Mesh Logging: OFF';
            };
            document.body.appendChild(btnLogging);
        }

        // Toggle for raycast box visualization
        const toggleRaycastBoxId = 'debug-raycast-box-toggle';
        if (!document.getElementById(toggleRaycastBoxId)) {
            const btnRaycastBox = document.createElement('button');
            btnRaycastBox.id = toggleRaycastBoxId;
            btnRaycastBox.textContent = 'Show Raycast Box';
            btnRaycastBox.style.position = 'absolute';
            btnRaycastBox.style.top = '90px';
            btnRaycastBox.style.right = '10px';
            btnRaycastBox.style.zIndex = '10000';
            btnRaycastBox.style.backgroundColor = '#2196F3';
            btnRaycastBox.style.color = 'white';
            btnRaycastBox.style.padding = '8px 16px';
            btnRaycastBox.style.border = 'none';
            btnRaycastBox.style.borderRadius = '4px';
            btnRaycastBox.style.cursor = 'pointer';

            let raycastBoxVisible = false;

            btnRaycastBox.onclick = () => {
                if (!scene || !raycastBoxMesh) return;

                raycastBoxVisible = !raycastBoxVisible;

                if (raycastBoxVisible) {
                    // Make raycast box visible
                    if (raycastBoxMesh.material instanceof THREE.MeshBasicMaterial) {
                        raycastBoxMesh.material.visible = true;
                        raycastBoxMesh.material.wireframe = true;
                        raycastBoxMesh.material.color.set(0xff00ff); // Magenta
                        raycastBoxMesh.material.opacity = 0.3;
                        raycastBoxMesh.material.transparent = true;
                    }

                    btnRaycastBox.textContent = 'Hide Raycast Box';
                    btnRaycastBox.style.backgroundColor = '#f44336';
                } else {
                    // Make raycast box invisible
                    if (raycastBoxMesh.material instanceof THREE.MeshBasicMaterial) {
                        raycastBoxMesh.material.visible = false;
                    }

                    btnRaycastBox.textContent = 'Show Raycast Box';
                    btnRaycastBox.style.backgroundColor = '#2196F3';
                }
            };
            document.body.appendChild(btnRaycastBox);
        }
    }

    // Call this after scene setup
    if (typeof window !== 'undefined') {
        addDebugBoundaryMeshToggle();
    }

    // Initialize the true chunk boundaries group
    if (scene && !trueChunkBoundariesGroup) {
        trueChunkBoundariesGroup = new THREE.Group();
        trueChunkBoundariesGroup.name = "true_chunk_boundaries_visual_group";
        scene.add(trueChunkBoundariesGroup);
    }

    // <<< Create and inject the Procedural Generation Panel >>>
    // THIS BLOCK IS REDUNDANT AND CAUSING THE LINTER ERROR - REMOVE IT.
    // The panel is now created and inserted within the setTimeout where buttons are handled.
    /*
    if (containerElement && containerElement.parentElement) {
        // Check if a dedicated UI panel container exists, otherwise use parent of 3D view
        let uiPanelHost = document.getElementById('ui-panels-container');
        if (!uiPanelHost) {
            console.warn("`ui-panels-container` not found, appending procedural panel to parent of 3D view container. This might not be ideal for layout.");
            uiPanelHost = containerElement.parentElement;
        }
        if (uiPanelHost) {
            proceduralGenerationPanelElement = createProceduralGenerationPanel(uiPanelHost); // ERROR IS HERE
             console.log("Procedural Generation panel created and appended.");
        } else {
            console.error("Failed to find a suitable parent element for the Procedural Generation panel.");
        }
    } else {
        console.error("Container element or its parent not found, cannot create Procedural Generation panel.");
    }
    */
    // <<< End Panel Creation >>>

    // THIS IS THE CRITICAL ASSIGNMENT BLOCK
    if (typeof window !== 'undefined') {
        console.log('[IsolatedTerrainViewer_ASSIGNMENT_DEBUG] Attempting to assign window.analyzeVolumeComposition.');
        console.log('[IsolatedTerrainViewer_ASSIGNMENT_DEBUG] Type of imported function (importedAnalyzeVolumeCompositionFunction):', typeof importedAnalyzeVolumeCompositionFunction);

        if (typeof importedAnalyzeVolumeCompositionFunction === 'function') {
            window.analyzeVolumeComposition = importedAnalyzeVolumeCompositionFunction;
            console.log('[IsolatedTerrainViewer_ASSIGNMENT_SUCCESS] window.analyzeVolumeComposition has been ASSIGNED globally.');
        } else {
            console.error('[IsolatedTerrainViewer_ASSIGNMENT_FAILURE] importedAnalyzeVolumeCompositionFunction is NOT a function. Global assignment FAILED.');
            // Optionally, define a fallback or throw an error to make it very obvious
            window.analyzeVolumeComposition = () => {
                console.error("analyzeVolumeComposition was called, but the real function was not available during assignment!");
                return null;
            };
        }
    } else {
        console.warn('[IsolatedTerrainViewer_ASSIGNMENT_DEBUG] window object not found, cannot assign analyzeVolumeComposition globally.');
    }

    function addSpacetimeDBButton() {
        const button = document.createElement('button');
        button.textContent = 'SpacetimeDB';
        button.className = 'debug-button';
        button.onclick = async () => {
            const { SpacetimeDBIntegration } = await import('./spacetimedbIntegration');
            const spacetimeDB = SpacetimeDBIntegration.getInstance();
            await spacetimeDB.initialize();
            spacetimeDB.togglePanel();
        };
        container.appendChild(button);
    }

    // Add the SpacetimeDB button to the UI
    addSpacetimeDBButton();

    // Initialize SpacetimeDB worker
    spacetimeWorker = SpacetimeDBWorker.getInstance();
    initializeSpacetimeDB();
}

async function initializeSpacetimeDB() {
    try {
        spacetimeDB = SpacetimeDBIntegration.getInstance();
        await spacetimeDB.initialize();
        
        // Load initial chunks around center
        await loadSurroundingChunks();
        
        // Set up periodic saving
        setInterval(() => saveCurrentArea(), 30000); // Save every 30 seconds
        
        return true;
    } catch (error) {
        console.error('Failed to initialize SpacetimeDB:', error);
        return false;
    }
}

async function loadSurroundingChunks() {
    if (!spacetimeWorker) return;

    const [cx, cy, cz] = centralChunkKey.split(',').map(Number);
    const chunkKeys: string[] = [];

    // Generate chunk keys for the area
    for (let x = -CHUNK_LOAD_RADIUS; x <= CHUNK_LOAD_RADIUS; x++) {
        for (let y = -CHUNK_LOAD_RADIUS; y <= CHUNK_LOAD_RADIUS; y++) {
            for (let z = -CHUNK_LOAD_RADIUS; z <= CHUNK_LOAD_RADIUS; z++) {
                chunkKeys.push(`${cx + x},${cy + y},${cz + z}`);
            }
        }
    }

    // Load chunks in parallel using worker
    const { results } = await spacetimeWorker.processBatch(
        'load_' + Date.now(), // Unique batch ID
        chunkKeys,
        'load'
    );
    
    // Update chunk data map
    results.forEach((data: NoiseMap | undefined, chunkKey: string) => {
        if (data) {
            chunkDataMap.set(chunkKey, data);
            // Update isolatedLoadedChunkData if needed
            if (!isolatedLoadedChunkData[chunkKey]) {
                isolatedLoadedChunkData[chunkKey] = {
                    noiseMap: data,
                    playerEditMask: null,
                    physicsBody: null,
                    lastAccessTime: Date.now()
                };
            }
        }
    });

    // Generate any missing chunks
    for (const chunkKey of chunkKeys) {
        if (!chunkDataMap.has(chunkKey)) {
            const [x, y, z] = chunkKey.split(',').map(Number);
            const noiseMap = await generateChunk(x, y, z);
            chunkDataMap.set(chunkKey, noiseMap);
            isolatedLoadedChunkData[chunkKey] = {
                noiseMap,
                playerEditMask: null,
                physicsBody: null,
                lastAccessTime: Date.now()
            };
        }
    }
}

async function saveCurrentArea() {
    if (!spacetimeWorker) return;

    const [cx, cy, cz] = centralChunkKey.split(',').map(Number);
    const chunkKeys: string[] = [];
    const chunkData: NoiseMap[] = [];

    // Generate chunk keys for the area
    for (let x = -CHUNK_LOAD_RADIUS; x <= CHUNK_LOAD_RADIUS; x++) {
        for (let y = -CHUNK_LOAD_RADIUS; y <= CHUNK_LOAD_RADIUS; y++) {
            for (let z = -CHUNK_LOAD_RADIUS; z <= CHUNK_LOAD_RADIUS; z++) {
                const chunkKey = `${cx + x},${cy + y},${cz + z}`;
                const data = chunkDataMap.get(chunkKey);
                if (data) {
                    chunkKeys.push(chunkKey);
                    chunkData.push(data);
                }
            }
        }
    }

    // Save chunks in parallel using worker
    await spacetimeWorker.processBatch(
        'save_' + Date.now(), // Unique batch ID
        chunkKeys,
        'save',
        chunkData
    );
}

async function generateChunk(x: number, y: number, z: number): Promise<NoiseMap> {
    const chunkKey = `${x},${y},${z}`;
    
    // Try to get chunk from SpacetimeDB first
    const existingChunk = spacetimeDB?.getTerrainChunk(chunkKey);
    if (existingChunk) {
        return existingChunk;
    }

    // If not in SpacetimeDB, generate new chunk
    if (!spacetimeWorker || !currentNoiseLayers || !currentSeed) {
        throw new Error('Missing required data for chunk generation');
    }

    // Generate using worker
    const { results: genResults } = await spacetimeWorker.processBatch(
        'generate_' + Date.now(), // Unique batch ID
        [chunkKey],
        'generate',
        undefined,
        currentNoiseLayers,
        currentSeed
    );

    const generatedData = genResults.get(chunkKey);
    if (!generatedData) {
        throw new Error('Failed to generate chunk data');
    }

    // Save to SpacetimeDB if available
    if (spacetimeDB) {
        spacetimeDB.saveTerrainChunk(chunkKey, generatedData);
    }
    
    return generatedData;
}

// --- Mode Switching Functions ---
function enterFirstPersonMode() {
    if (!scene || !renderer || !orbitControls) {
        console.error("Cannot enter FP mode: Viewer not fully initialized.");
        return;
    }
    const mainChunkMesh = isolatedLoadedChunkData[ISOLATED_CHUNK_KEY]?.mesh;
    if (!mainChunkMesh) {
        console.error("Cannot enter FP mode: Main terrain mesh not found.");
        // Optionally provide user feedback via status bar
        return;
    }

    console.log("Entering Isolated First Person Mode...");
    isFirstPersonMode = true;
    orbitControls.enabled = false; // Disable OrbitControls
    // orbitControls.dispose(); // OrbitControls has dispose

    // *** Pass necessary data for potential unloading AND loading ***
    const fpInitResult = initIsolatedFirstPerson({
        scene: scene,
        renderer: renderer,
        terrainMesh: mainChunkMesh, // Keep for basic ground check
        loadedChunks: isolatedLoadedChunkData, // Pass the chunk data map
        chunkMeshes: {} as { [key: string]: THREE.Mesh | null }, // Pass dummy, FP will use loadedChunks
        // Generation Params
        noiseLayers: currentNoiseLayers!,
        seed: currentSeed!,
        compInfo: currentCompInfo!,
        noiseScale: currentNoiseScale!,
        planetOffset: currentPlanetOffset!,
        // ---
        onExit: exitFirstPersonMode // Pass the exit handler
    });

    fpCameraRef = fpInitResult.camera;
    fpControlsRef = fpInitResult.controls;

    // Attempt pointer lock (might require user click on canvas first)
    fpControlsRef?.lock();

    // Update status bar or UI if needed
    if (statusElementRef) statusElementRef.textContent = 'First Person Mode (Press Esc to exit)';
}

function exitFirstPersonMode() {
    if (!isFirstPersonMode || !orbitControls || !camera) return;

    console.log("Exiting Isolated First Person Mode...");
    cleanupIsolatedFirstPerson();
    fpCameraRef = null;
    fpControlsRef = null;

    orbitControls.enabled = true; // Re-enable OrbitControls
    isFirstPersonMode = false;

    // Reset orbit camera view if desired
    resetIsolatedView();

    // Update status bar or UI if needed
    if (statusElementRef) statusElementRef.textContent = 'Ready (Exited FP Mode)';
}

// --- NEW Third Person Mode Functions ---
function enterThirdPersonMode() {
    if (!scene || !renderer || !orbitControls || !camera) {
        console.error("Cannot enter Third Person mode: Viewer not fully initialized.");
        return;
    }
    const mainChunkMesh = isolatedLoadedChunkData[ISOLATED_CHUNK_KEY]?.mesh;
    if (!mainChunkMesh) {
        console.error("Cannot enter Third Person mode: Main terrain mesh not found.");
        return;
    }

    if (isFirstPersonMode) {
        exitFirstPersonMode(); // Exit FP if active
    }
    if (isThirdPersonMode) return; // Already in TP mode

    console.log("Entering Isolated Third Person Mode...");
    isThirdPersonMode = true;
    isFirstPersonMode = false;
    orbitControls.enabled = false;

    // --- Transform isolatedLoadedChunkData to LoadedChunks ---
    const transformedInitialLoadedChunks: LoadedChunks = {};
    for (const key in isolatedLoadedChunkData) {
        const chunk = isolatedLoadedChunkData[key];
        transformedInitialLoadedChunks[key] = {
            noiseMap: chunk.noiseMap,
            mesh: chunk.mesh === undefined ? null : chunk.mesh, // Convert undefined to null
            lastAccessTime: chunk.lastAccessTime || Date.now()
        };
    }
    // --- End Transformation ---

    try {
        const tpInitResult = initIsolatedThirdPerson({
            scene: scene,
            renderer: renderer,
            initialLoadedChunks: transformedInitialLoadedChunks, // Use transformed data
            initialChunkMeshes: currentChunkMeshesForCollision,
            noiseLayers: currentNoiseLayers!,
            seed: currentSeed!,
            compInfo: currentCompInfo!,
            noiseScale: currentNoiseScale!,
            planetOffset: currentPlanetOffset!,
            initialSpawnPosition: new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 5, 5),
            onExit: exitThirdPersonMode
        });

        if (tpInitResult) {
            tpCameraRef = tpInitResult.camera;
            console.log("Third Person mode initialized successfully with camera:", tpCameraRef);
        } else {
            console.error("Failed to initialize third person mode or get its camera.");
            // Attempt to gracefully exit if init failed
            isThirdPersonMode = false; // Reset mode flag
            if (orbitControls) orbitControls.enabled = true;
            tpCameraRef = null;
            if (statusElementRef) statusElementRef.textContent = 'Error entering Third Person Mode';
            return;
        }
    } catch (error) {
        console.error("Exception during third person initialization:", error);
        isThirdPersonMode = false;
        if (orbitControls) orbitControls.enabled = true;
        tpCameraRef = null;
        if (statusElementRef) statusElementRef.textContent = 'Error entering Third Person Mode';
        return;
    }

    if (statusElementRef) statusElementRef.textContent = 'Third Person Mode (Press Esc to exit)';
}

function exitThirdPersonMode() {
    if (!isThirdPersonMode) return;
    console.log("Exiting Isolated Third Person Mode...");

    try {
        cleanupIsolatedThirdPerson();
        console.log("Third person mode cleanup completed successfully");
    } catch (error) {
        console.error("Error during third person mode cleanup:", error);
    }
    
    tpCameraRef = null;
    isThirdPersonMode = false;
    
    if (orbitControls && camera) {
        orbitControls.enabled = true;
        resetIsolatedView();
    }
    
    if (statusElementRef) statusElementRef.textContent = 'Ready (Exited Third Person Mode)';
}
// --- END NEW Third Person Mode Functions ---


// --- View Reset Function ---
export function resetIsolatedView() {
    // Reset should ONLY affect the orbit camera
    if (isFirstPersonMode) {
        console.log("Reset View called while in First Person mode. Exiting FP mode first.");
        exitFirstPersonMode();
    } else if (isThirdPersonMode) {
        console.log("Reset View called while in Third Person mode. Exiting TP mode first.");
        exitThirdPersonMode();
    }

    if (camera && orbitControls) {
        camera.position.set(0, 50, 0); // Reset orbit camera position
        camera.lookAt(0, 0, 0);       // Reset lookAt
        orbitControls.target.set(0, 0, 0); // Reset orbit controls target
        orbitControls.update();          // Apply changes
        console.log("Isolated Viewer: Orbit View Reset.");
        if (statusElementRef) {
            statusElementRef.textContent = 'View reset.';
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef && !isFirstPersonMode) statusElementRef.textContent = 'Ready'; // Check mode
            }, 1500);
        }
    } else {
        console.warn("Isolated Viewer: Cannot reset orbit view, camera or controls missing.");
    }
}

// <<< NEW FUNCTION TO FOCUS ORBIT CAMERA >>>
export function focusOrbitCameraOn(targetPosition: THREE.Vector3, distance = 100) {
    if (isFirstPersonMode || isThirdPersonMode) {
        console.log("FocusOrbitCamera: Cannot focus orbit camera while in FP/TP mode.");
        return;
    }
    if (camera && orbitControls) {
        orbitControls.target.copy(targetPosition);
        // Position camera above and looking down, adjust distance as needed
        camera.position.set(targetPosition.x, targetPosition.y + distance, targetPosition.z);
        camera.lookAt(targetPosition);
        orbitControls.update();
        console.log(`Isolated Viewer: Orbit camera focused on ${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)}, ${targetPosition.z.toFixed(1)}`);
    } else {
        console.warn("Isolated Viewer: Cannot focus orbit camera, camera or controls missing.");
    }
}
// --- END NEW FUNCTION ---

// --- Terrain Generation ---
interface GenerationParams {
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale?: number;
    planetOffset?: THREE.Vector3;
}
export async function generateIsolatedTerrain(params: GenerationParams) {
    console.log("[IsolatedTerrainViewer] generateIsolatedTerrain called with params:",
        {
            compInfo: params.compInfo,
            noiseScale: params.noiseScale,
            planetOffset: params.planetOffset,
            seed: params.seed, // also log seed and noiseLayers for completeness
            noiseLayers: params.noiseLayers
        }
    );

    if (isFirstPersonMode) exitFirstPersonMode(); // Exit FP mode if regenerating terrain
    if (isThirdPersonMode) exitThirdPersonMode(); // Exit TP mode if regenerating terrain (NEW)
    if (!scene) {
        console.error("IsolatedViewer: Scene not initialized for terrain generation.");
        return;
    }
    currentNoiseLayers = params.noiseLayers;
    currentSeed = params.seed;
    currentCompInfo = params.compInfo;
    currentPlanetOffset = params.planetOffset || new THREE.Vector3(0,0,0);
    currentNoiseScale = params.noiseScale || 1.0; // Default noise scale

    console.log("[IsolatedTerrainViewer] Module variables set after receiving params:",
        {
            currentCompInfo: currentCompInfo,
            currentNoiseScale: currentNoiseScale,
            currentPlanetOffset: currentPlanetOffset,
            currentSeed: currentSeed, // also log currentSeed and currentNoiseLayers
            currentNoiseLayers: currentNoiseLayers
        }
    );

    // Performance optimization: Pre-emptively run garbage collection if available
    if (typeof window !== 'undefined' && (window as any).gc) {
        try {
            (window as any).gc();
            console.log("Garbage collection triggered before terrain regeneration");
        } catch (e) {
            console.log("Manual garbage collection not available");
        }
    }

    // Clear existing meshes from the scene and our tracking
    for (const key in currentChunkMeshesForCollision) {
        const mesh = currentChunkMeshesForCollision[key];
        if (mesh && scene) {
            scene.remove(mesh);
            disposeNode(scene, mesh); // Assuming disposeNode handles geometry/material // FIXED: Added scene argument
        }
    }
    currentChunkMeshesForCollision = {}; // Reset the tracker
    isolatedLoadedChunkData = {}; // Also reset the underlying data store

    // Initial generation for the central chunk:
    console.log(`IsolatedViewer: Generating initial noise maps for 7x7 grid (Y=0 and Y=-1) at center...`);
    const initialKeysToMesh: string[] = []; // Store keys for Y=0 layer to mesh later

    // Optimization: Use a pool of workers for parallel noise map generation
    const parallelGenerationPromises: Promise<void>[] = [];

    for (let x = -3; x <= 3; x++) { // Changed from -1..1
        for (let z = -3; z <= 3; z++) { // Changed from -1..1
            for (let y = 0; y >= -1; y--) { // Generate Y=0 and Y=-1
                const chunkKey = getChunkKeyY(x, y, z);
                console.log(`  Generating noise map for ${chunkKey}`);

                // Create a promise for this chunk generation
                const genPromise = new Promise<void>((resolve) => {
                    try {
                        const generatedNoiseMap = generateNoiseMap(x, y, z, currentNoiseLayers, currentSeed);

                if (generatedNoiseMap) {
                    // Create playerEditMask for the chunk
                    const playerEditMask = createPlayerEditMask(); // Use helper defined below

                    isolatedLoadedChunkData[chunkKey] = {
                        mesh: null,
                        noiseMap: generatedNoiseMap,
                        playerEditMask: playerEditMask,
                        lastAccessTime: Date.now() // <<< ADD lastAccessTime
                    };

                    if (y === 0) {
                         initialKeysToMesh.push(chunkKey); // Mark Y=0 chunks for meshing
                    }
                } else {
                     console.error(`  Initial generated noise map for ${chunkKey} was null.`);
                }
                        resolve();
                    } catch (error: any) {
                        console.error(`  Error generating noise map for ${chunkKey}:`, error);
                        resolve(); // Always resolve, even on error, to continue the process
                    }
                });

                parallelGenerationPromises.push(genPromise);
            }
        }
    }

    // Wait for all noise map generations to complete before meshing
    Promise.all(parallelGenerationPromises).then(() => {
        console.log("IsolatedViewer: All initial noise maps generated.");

        // --- Generate Meshes for the Initial Y=0 Layer ---
        if (initialKeysToMesh.length > 0) {
            console.log(`[DEBUG ITV InitialGen] Initial keys to mesh: ${initialKeysToMesh.join(', ')}`); // <<< LOG 1
            console.log(`IsolatedViewer: Generating initial meshes for ${initialKeysToMesh.length} chunks at Y=0...`);
            regenerateAffectedMeshes(initialKeysToMesh);

            // The call here might be redundant if regenerateAffectedMeshes handles it,
            // but let's keep it for the very first draw after initial noise maps.
            // However, regenerateAffectedMeshes also calls remove/add, so this could cause a flicker.
            // Let's rely on regenerateAffectedMeshes to handle the visualization update.
            // if (scene) {
            //     addTrueChunkBoundariesVisualization(scene, isolatedLoadedChunkData);
            // }
        } else {
            console.error("IsolatedViewer: No initial chunks were marked for meshing. Something went wrong during noise map generation.");
        }

        if (orbitControls && camera) {
            orbitControls.target.set(0, 0, 0);
            camera.position.set(0, 50, 0);
            camera.lookAt(0,0,0);
            orbitControls.update();
        }
    });

    // Helper function to create a player edit mask
    // CRITICAL FIX: The player edit mask must match the noise map dimensions
    function createPlayerEditMask() {
        const mask: boolean[][][] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            mask[x] = [];
            // Use CHUNK_HEIGHT+2 to match the NoiseMap dimensions
            // This is critical for allowing editing beyond chunk boundaries
            for (let y = 0; y <= CHUNK_HEIGHT+1; y++) {
                mask[x][y] = [];
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    mask[x][y][z] = false;
                }
            }
        }
        return mask;
    }

    // At the very end, after initial chunk processing and mesh generation is initiated:
    console.log("[IsolatedTerrainViewer] Initial terrain generation process completed in generateIsolatedTerrain.");

    // Perform initial analysis for the brush chunk
    if (editBrushMesh && typeof window.analyzeVolumeComposition === 'function' &&
        window.miningPanelTabUtils && typeof window.miningPanelTabUtils.updateBrushChunkCompositionInfo === 'function' &&
        currentCompInfo && currentCompInfo.topElements && // Ensure all needed deps are valid
        currentNoiseScale !== null &&
        currentPlanetOffset !== null
    ) {
        const brushPositionForAnalysis = editBrushMesh.position.clone();
        // const brushChunkX = Math.round(brushPositionForAnalysis.x / CHUNK_SIZE);
        // const brushChunkY = Math.round(brushPositionForAnalysis.y / CHUNK_HEIGHT);
        // const brushChunkZ = Math.round(brushPositionForAnalysis.z / CHUNK_SIZE);
        // const brushChunkKey = `${brushChunkX},${brushChunkY},${brushChunkZ}`;

        console.log(`[IsolatedTerrainViewer] Initial brush position for analysis: ${brushPositionForAnalysis.x.toFixed(2)}, ${brushPositionForAnalysis.y.toFixed(2)}, ${brushPositionForAnalysis.z.toFixed(2)}`);

        console.log("[IsolatedTerrainViewer] Calling window.analyzeVolumeComposition for initial brush chunk with multi-args.");
        const compositionResult = window.analyzeVolumeComposition(
            brushPositionForAnalysis,         // center
            currentCompInfo.topElements,      // topElements
            currentNoiseScale,                // noiseScale
            currentPlanetOffset,              // planetOffset
            editBrushRadius,                  // brushRadius
            editBrushShape as 'sphere' | 'cube' | 'cylinder', // brushShape
            editBrushVerticality,             // brushVerticality
            CHUNK_SIZE,                       // resolutionContextWidth / chunkSizeParam
            CHUNK_HEIGHT                      // resolutionContextHeight / chunkHeightParam
        );

        if (compositionResult) {
            console.log("[IsolatedTerrainViewer] Initial brush chunk analysis successful. Result:", volumeCompositionToString(compositionResult));
            window.miningPanelTabUtils.updateBrushChunkCompositionInfo(compositionResult as any);
        } else {
            console.warn("[IsolatedTerrainViewer] Initial brush chunk analysis returned null or failed.");
            window.miningPanelTabUtils.updateBrushChunkCompositionInfo(null);
        }
    } else {
        console.warn("[IsolatedTerrainViewer] Could not perform initial brush chunk analysis. Dependencies missing or functions not available:",
            {
                brushMesh: !!editBrushMesh,
                analyzeFunc: typeof window.analyzeVolumeComposition,
                utils: !!window.miningPanelTabUtils,
                updateFunc: typeof window.miningPanelTabUtils?.updateBrushChunkCompositionInfo,
                currentCompInfo: !!currentCompInfo,
                topElements: !!currentCompInfo?.topElements,
                currentNoiseScale: currentNoiseScale !== null,
                currentPlanetOffset: currentPlanetOffset !== null
            }
        );
    }
    // Ensure currentGeneratedChunkKeys is updated if not already
    if (!currentGeneratedChunkKeys.includes(ISOLATED_CHUNK_KEY)) {
        currentGeneratedChunkKeys.push(ISOLATED_CHUNK_KEY); // Assuming single chunk initially
    }
    console.log("[DEBUG ITV] generateIsolatedTerrain: currentGeneratedChunkKeys AFTER initial gen:", currentGeneratedChunkKeys);
    if (typeof window !== 'undefined' && (window as any).DEBUG_ITV_BATCHING) {
        console.log("[DEBUG ITV Batching] processBatch: All chunks processed. chunksToProcess.length is 0. Directly finalizing.");
    }
    if (typeof window !== 'undefined' && (window as any).DEBUG_ITV_TIMERS) {
        console.timeEnd("Mesh Regeneration Timer");
        console.log("Mesh regeneration complete (Direct Finalization).");
    }
    const settingsFromPanel = getProceduralGenerationSettings();
    if (
        settingsFromPanel &&
        typeof settingsFromPanel.visCenterX === 'number' &&
        typeof settingsFromPanel.visCenterY === 'number' &&
        typeof settingsFromPanel.visCenterZ === 'number' &&
        typeof settingsFromPanel.visHorizontalExtent === 'number' &&
        typeof settingsFromPanel.visVerticalExtent === 'number' &&
        typeof settingsFromPanel.useAlternatingLogicForTheoreticalViz === 'boolean' &&
        typeof settingsFromPanel.theoreticalVizAdjacentToTrue === 'boolean' &&
        typeof settingsFromPanel.altStartX === 'number' &&
        typeof settingsFromPanel.altStartZ === 'number' &&
        (settingsFromPanel.altStripDirection === 'x' || settingsFromPanel.altStripDirection === 'z') &&
        typeof settingsFromPanel.altInitialYLevel === 'number' &&
        typeof settingsFromPanel.altLowYLevel === 'number' &&
        typeof settingsFromPanel.altHighYLevel === 'number' &&
        typeof settingsFromPanel.seed === 'number'
    ) {
        updateBoundaryVisuals(settingsFromPanel as ProceduralGenerationSettings);
    } else {
        console.warn("[IsolatedTerrainViewer] Procedural generation settings from panel are incomplete or undefined. Skipping updateBoundaryVisuals after terrain generation. Defaulting to no theoretical boundaries.");
        if (scene) {
            removeTheoreticalChunkBoundaries(scene);
        }
    }

    // Check if we have persistent data for this area
    if (params.planetOffset) {
        const { SpacetimeDBIntegration } = await import('./spacetimedbIntegration');
        const spacetimeDB = SpacetimeDBIntegration.getInstance();
        const terrainData = await spacetimeDB.loadTerrainData(params.planetOffset);
        if (terrainData) {
            // Use the persistent data instead of generating new terrain
            return generateTerrainFromData(terrainData);
        }
    }
    
    // Continue with normal generation if no persistent data exists
    // ... existing code ...
}

async function generateTerrainFromData(data: {
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale: number;
    planetOffset: THREE.Vector3;
}) {
    // Generate terrain using the loaded data
    const noiseMap = generateNoiseMap(
        data.planetOffset.x,
        data.planetOffset.y,
        data.planetOffset.z,
        data.noiseLayers,
        data.seed
    );

    if (!noiseMap) {
        console.error('Failed to generate noise map from persistent data');
        return null;
    }

    const mesh = generateMeshVertices(
        data.planetOffset.x,
        data.planetOffset.y,
        data.planetOffset.z,
        null, // generate
        true, // interpolate
        null, // noiseMapBelow
        null, // noiseMapAbove
        null, // noiseMapXNeg
        null, // noiseMapXPos
        null, // noiseMapZNeg
        null, // noiseMapZPos
        {} // neighborFlags
    );

    if (!mesh) {
        console.error('Failed to generate mesh from persistent data');
        return null;
    }

    return mesh;
}

// --- Mesh Regeneration (Refactored) ---
// *** Renamed and takes affectedKeys array ***
function regenerateAffectedMeshes(affectedKeys: string[]) {
    if (!scene || !currentCompInfo || currentNoiseScale === null || currentPlanetOffset === null || !physicsWorld || !groundMaterial) { // <<< ADDED Physics checks
        console.error("IsolatedViewer: Cannot regenerate mesh, missing dependencies (Scene, Settings, or Physics).");
        return;
    }

    console.log(`IsolatedViewer: Regenerating meshes for keys: ${affectedKeys.join(', ')}`);
    
    // CRITICAL: Ensure all horizontal neighbors exist for affected chunks to prevent gaps
    for (const key of affectedKeys) {
        const [x, y, z] = key.split(',').map(Number);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            console.log(`[ITV RegenerateMeshes] Ensuring neighbors for ${key}`);
            ensureHorizontalNeighbors(x, y, z);
        }
    }

    const BATCH_SIZE = 10;

    const chunksToProcess = [...affectedKeys].sort((keyA, keyB) => {
        const coordsA = keyA.split(',').map(Number);
        const coordsB = keyB.split(',').map(Number);
        if (coordsA.length !== 3 || coordsB.length !== 3) return 0;
        const distA = Math.sqrt(coordsA[0]*coordsA[0] + coordsA[1]*coordsA[1] + coordsA[2]*coordsA[2]);
        const distB = Math.sqrt(coordsB[0]*coordsB[0] + coordsB[1]*coordsB[1] + coordsB[2]*coordsB[2]);
        return distA - distB;
    });

    function processBatch() {
        const currentBatch = chunksToProcess.splice(0, BATCH_SIZE);
        console.log(`[DEBUG ITV Batching] processBatch: Processing batch of ${currentBatch.length} keys: ${currentBatch.join(', ')}`);

        if (currentBatch.length === 0 && chunksToProcess.length > 0) {
            // This case should ideally not be hit if logic is correct, but as a safeguard:
            console.warn("[DEBUG ITV Batching] processBatch: currentBatch is empty but chunksToProcess still has items. Scheduling next batch.");
            setTimeout(processBatch, 0);
            return;
        }

        processMeshBatch(currentBatch);

        console.log(`[DEBUG ITV Batching] processBatch: Finished processing current batch. chunksToProcess.length = ${chunksToProcess.length}`);
        if (chunksToProcess.length > 0) {
            console.log(`[DEBUG ITV Batching] processBatch: Scheduling next batch via setTimeout.`);
            setTimeout(processBatch, 0);
        } else {
            console.log(`[DEBUG ITV Batching] processBatch: All chunks processed. chunksToProcess.length is 0. Directly finalizing.`);

            console.log("Mesh regeneration complete (Direct Finalization).");
            // The actual logging of scene and chunk counts will now be in updateBoundaryVisuals
            const currentSettingsForUpdate = getProceduralGenerationSettings() as ProceduralGenerationSettings; // Get fresh settings
            if (currentSettingsForUpdate) {
                updateBoundaryVisuals(currentSettingsForUpdate); // <<< CALL THE NEW HELPER FUNCTION HERE, PASSING SETTINGS
            } else {
                console.warn("[regenerateAffectedMeshes] Could not get settings to update boundary visuals after mesh regeneration.");
            }
        }
    }

    // Start processing the first batch
    // Ensure processBatch is called at least once to kick things off, even if chunksToProcess was initially empty (though it shouldn't be for initial gen)
    console.log("[DEBUG ITV Batching] Kicking off first call to processBatch.");
    processBatch(); // Initial call to start the loop

    function createPlayerEditMask() {
        const mask: boolean[][][] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            mask[x] = [];
            // Use CHUNK_HEIGHT+2 to match the NoiseMap dimensions
            // This is critical for allowing editing beyond chunk boundaries
            for (let y = 0; y <= CHUNK_HEIGHT+1; y++) {
                mask[x][y] = [];
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    mask[x][y][z] = false;
                }
            }
        }
        return mask;
    }

    // Process a batch of meshes
    function processMeshBatch(batchKeys: string[]) {
        console.log(`[DEBUG ITV Batching] processMeshBatch: Received batch: ${batchKeys.join(', ')}`); // <<< LOG HERE

    // --- Material setup (created once) ---
    // Main terrain material
        if (!currentCompInfo || currentNoiseScale === null || currentPlanetOffset === null) {
            console.error("IsolatedViewer: Cannot create materials, missing dependencies.");
            return;
        }

    const material = createUnifiedPlanetMaterial(
        currentCompInfo.topElements,
        currentNoiseScale,
        currentPlanetOffset
    );
    material.side = THREE.DoubleSide;
    if (material.uniforms.u_showInternalMaterial) {
        material.uniforms.u_showInternalMaterial.value = false;
    }

    // Visualizer material
    let visualizerMaterial: THREE.ShaderMaterial | null = null;
    try {
        visualizerMaterial = createInternalVisualizerMaterial(
            currentCompInfo.topElements,
            currentNoiseScale,
            currentPlanetOffset
        );
        visualizerMaterial.side = THREE.DoubleSide;
    } catch (error) {
        console.error("IsolatedViewer: Failed to create internal visualizer material:", error);
    }

    // CRITICAL FIX: Store mesh references before regeneration to avoid duplication
    const preservedMeshes: {[key: string]: THREE.Mesh | null} = {};
        for (const key of batchKeys) {
        if (isolatedLoadedChunkData[key]?.mesh) {
            preservedMeshes[key] = isolatedLoadedChunkData[key].mesh;
            console.log(`Preserving mesh reference for chunk ${key}`);
        }
    }

        // --- First, dispose old meshes AND remove physics bodies --- <<< MODIFIED
        for (const key of batchKeys) {
            const currentChunkData = isolatedLoadedChunkData[key];
            const oldMesh = currentChunkData?.mesh;
            // Remove graphics mesh
            if (oldMesh && scene) {
                scene.remove(oldMesh);
                 // No need to set currentChunkData.mesh = null here, it's done below after disposal
            }
            // Remove physics body <<< NEW
            const oldBody = currentChunkData?.physicsBody;
            if (oldBody && physicsWorld) {
                 physicsWorld.removeBody(oldBody);
                 if (currentChunkData) currentChunkData.physicsBody = null;
            }
            // Dispose graphics geometry/material after removal
            if (oldMesh) {
                if (oldMesh.geometry) oldMesh.geometry.dispose();
                if (oldMesh.material) {
                    const mat = oldMesh.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
                    else mat.dispose();
                }
            }
            // Set mesh references to null after disposal
            if (currentChunkData) currentChunkData.mesh = null;
            currentChunkMeshesForCollision[key] = null;
        }

        // Render to finalize disposal
        if (renderer && scene && camera) {
             renderer.render(scene, camera);
        }

        // --- Then create new meshes AND physics bodies --- <<< MODIFIED
        for (const key of batchKeys) {
            let currentChunkData = isolatedLoadedChunkData[key];
        const noiseMapToUse = currentChunkData?.noiseMap;

            console.log(`[DEBUG ITV Batching] processMeshBatch: Processing key ${key}. Noise map present: ${!!noiseMapToUse}`); // <<< LOG HERE

        if (!noiseMapToUse) {
            console.warn(`IsolatedViewer: Skipping mesh regeneration for ${key}, noise map missing.`);
                currentChunkMeshesForCollision[key] = null;
            continue;
        }

            // Continue with mesh generation as in the original function
            // [Rest of mesh generation code remains the same]
            // ...

        // Parse coordinates from key
        const coords = key.split(',').map(Number);
        if (coords.length !== 3 || coords.some(isNaN)) {
            console.error(`IsolatedViewer: Invalid chunk key format found: ${key}`);
                currentChunkMeshesForCollision[key] = null;
            continue;
        }
        const [chunkX, chunkY, chunkZ] = coords;

        // --- Fetch/generate all 6 neighbor noise maps ---
        const getOrGenNeighborMap = (nx: number, ny: number, nz: number): NoiseMap | null => {
            const neighborKey = getChunkKeyY(nx, ny, nz);
            let chunk = isolatedLoadedChunkData[neighborKey];
            if (chunk && chunk.noiseMap) return chunk.noiseMap;
            
            // Generate if missing
            console.log(`[DEBUG] Generating missing neighbor noise map for ${neighborKey}`);
            const generated = generateNoiseMap(nx, ny, nz, currentNoiseLayers, currentSeed);
            if (generated) {
                // CRITICAL: Ensure noise map dimensions match expected size
                if (generated.length !== CHUNK_HEIGHT + 1 || 
                    generated[0]?.length !== CHUNK_SIZE + 1 || 
                    generated[0]?.[0]?.length !== CHUNK_SIZE + 1) {
                    console.error(`Invalid noise map dimensions for neighbor ${neighborKey}`);
                    return null;
                }
                
                // Create neighbor edit mask
                function createNeighborEditMask() {
                    const mask: boolean[][][] = [];
                    for (let x = 0; x < CHUNK_SIZE; x++) {
                        mask[x] = [];
                        for (let y = 0; y <= CHUNK_HEIGHT+1; y++) {
                            mask[x][y] = [];
                            for (let z = 0; z < CHUNK_SIZE; z++) {
                                mask[x][y][z] = false;
                            }
                        }
                    }
                    return mask;
                }
                
                isolatedLoadedChunkData[neighborKey] = {
                    mesh: null,
                    noiseMap: generated,
                    playerEditMask: createNeighborEditMask(),
                    lastAccessTime: Date.now()
                };
                return generated;
            }
            return null;
        }

        // First ensure all horizontal neighbors are present
        if (!ensureHorizontalNeighbors(chunkX, chunkY, chunkZ)) {
            console.warn(`[IsolatedViewer] Failed to ensure horizontal neighbors for chunk ${key}, skipping mesh generation`);
            currentChunkMeshesForCollision[key] = null;
            continue; // Skip this chunk until all neighbors are loaded
        }
        
        // Get all 6 neighbors including vertical
        const noiseMapBelow = getOrGenNeighborMap(chunkX, chunkY - 1, chunkZ);
        const noiseMapAbove = getOrGenNeighborMap(chunkX, chunkY + 1, chunkZ);
        const noiseMapXNeg  = getOrGenNeighborMap(chunkX - 1, chunkY, chunkZ);
        const noiseMapXPos  = getOrGenNeighborMap(chunkX + 1, chunkY, chunkZ);
        const noiseMapZNeg  = getOrGenNeighborMap(chunkX, chunkY, chunkZ - 1);
        const noiseMapZPos  = getOrGenNeighborMap(chunkX, chunkY, chunkZ + 1);
        
        // CRITICAL: Check if all 6 neighbors exist before proceeding with mesh generation
        if (!noiseMapBelow || !noiseMapAbove || !noiseMapXNeg || !noiseMapXPos || !noiseMapZNeg || !noiseMapZPos) {
            console.warn(`[IsolatedViewer] Missing neighbors for chunk ${key}, skipping mesh generation`);
            console.log(`Neighbors present: Below=${!!noiseMapBelow}, Above=${!!noiseMapAbove}, XNeg=${!!noiseMapXNeg}, XPos=${!!noiseMapXPos}, ZNeg=${!!noiseMapZNeg}, ZPos=${!!noiseMapZPos}`);
            currentChunkMeshesForCollision[key] = null;
            continue; // Skip this chunk until all neighbors are loaded
        }

        // Create neighbor flags to indicate which neighbors exist
        const neighborFlags = {
            neighborXPosExists: !!noiseMapXPos,
            neighborXNegExists: !!noiseMapXNeg,
            neighborYPosExists: !!noiseMapAbove,
            neighborYNegExists: !!noiseMapBelow,
            neighborZPosExists: !!noiseMapZPos,
            neighborZNegExists: !!noiseMapZNeg,
            };

        // --- Generate new geometry ---
        let geometry: THREE.BufferGeometry | null = null;
        try {
            // CRITICAL CHECK: Verify that ALL neighbors exist before mesh generation
            if (!noiseMapBelow || !noiseMapAbove || !noiseMapXNeg || !noiseMapXPos || !noiseMapZNeg || !noiseMapZPos) {
                console.warn(`[IsolatedViewer] Cannot generate mesh for ${key} - missing neighbors. Skipping.`);
                console.log(`Neighbors present: Below=${!!noiseMapBelow}, Above=${!!noiseMapAbove}, XNeg=${!!noiseMapXNeg}, XPos=${!!noiseMapXPos}, ZNeg=${!!noiseMapZNeg}, ZPos=${!!noiseMapZPos}`);
                currentChunkMeshesForCollision[key] = null;
                continue; // Skip this chunk until all neighbors are loaded
            }
            
            const generateOpts: Generate = { noiseMap: noiseMapToUse };
            console.log(`[DEBUG ITV Batching] processMeshBatch: Calling generateMeshVertices for ${key}`); // <<< LOG HERE
            
            // Ensure neighbor flags are all set to TRUE since we verified their presence
            const completeNeighborFlags = {
                neighborXPosExists: true,
                neighborXNegExists: true,
                neighborYPosExists: true, 
                neighborYNegExists: true,
                neighborZPosExists: true,
                neighborZNegExists: true,
                // Include noise maps directly in flags
                noiseMapXNeg: noiseMapXNeg,
                noiseMapXPos: noiseMapXPos,
                noiseMapYNeg: noiseMapBelow,
                noiseMapYPos: noiseMapAbove,
                noiseMapZNeg: noiseMapZNeg,
                noiseMapZPos: noiseMapZPos
            };
            
            geometry = generateMeshVertices(
                chunkX, chunkY, chunkZ,
                generateOpts,
                false, // interpolate
                noiseMapBelow, noiseMapAbove, noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
                completeNeighborFlags
            );
                console.log(`[DEBUG ITV Batching] processMeshBatch: generateMeshVertices for ${key} returned. Geometry valid: ${!!(geometry && geometry.getAttribute('position') && geometry.getAttribute('position').count > 0)}`); // <<< LOG HERE

            if (geometry && geometry.getAttribute('position')) {
                console.log(`[Regen ${key}] 6b. Verifying boundary vertices for proper stitching...`);

                // For debugging, count vertices at each boundary
                let yTopCount = 0;
                let yBottomCount = 0;

                const positions = geometry.getAttribute('position').array;
                const yBottomBoundary = chunkY * CHUNK_HEIGHT;
                const yTopBoundary = (chunkY + 1) * CHUNK_HEIGHT;

                for (let i = 0; i < positions.length; i += 3) {
                    const y = positions[i+1];
                    if (Math.abs(y - yBottomBoundary) < 0.01) {
                        yBottomCount++;
                    } else if (Math.abs(y - yTopBoundary) < 0.01) {
                        yTopCount++;
                    }
                }

                console.log(`[Regen ${key}] Boundary vertex counts: Bottom=${yBottomCount}, Top=${yTopCount}`);
            }
        } catch (error: any) {
            console.error(`IsolatedViewer: Error generating geometry for ${key}:`, error);
                currentChunkMeshesForCollision[key] = null;
                continue;
        }

            if (!geometry || !(geometry instanceof THREE.BufferGeometry) || !geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error(`IsolatedViewer: generateMeshVertices failed, returned invalid/empty geometry for ${key}, or has no position attribute.`);
                currentChunkMeshesForCollision[key] = null;

            if (currentChunkData) {
                currentChunkData.mesh = null;
                    console.log(`[DEBUG ITV Batching] processMeshBatch: Set mesh to null for ${key} due to invalid geometry.`); // <<< LOG HERE
            } else {
                 isolatedLoadedChunkData[key] = {
                    ...(isolatedLoadedChunkData[key] || { lastAccessTime: Date.now(), noiseMap: noiseMapToUse }),
                    mesh: null
                };
                    console.log(`[DEBUG ITV Batching] processMeshBatch: Initialized and set mesh to null for ${key} due to invalid geometry.`); // <<< LOG HERE
            }
                continue;
        }

        // --- Create, Add, and Store New Mesh ---
            const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = `isolated_chunk_${key}`;
        newMesh.renderOrder = 1;

            if (scene) scene.add(newMesh);

        if (!currentChunkData) {
            isolatedLoadedChunkData[key] = {
                noiseMap: noiseMapToUse,
                mesh: newMesh as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>,
                lastAccessTime: Date.now(),
                    playerEditMask: null // Should ideally be created here too
            };
            currentChunkData = isolatedLoadedChunkData[key];
                console.log(`[DEBUG ITV Batching] processMeshBatch: CREATED new entry and assigned mesh for ${key}.`); // <<< LOG HERE
        } else {
        currentChunkData.mesh = newMesh as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
                console.log(`[DEBUG ITV Batching] processMeshBatch: UPDATED existing entry and assigned mesh for ${key}.`); // <<< LOG HERE
        }
            currentChunkMeshesForCollision[key] = newMesh;
            console.log(`[DEBUG ITV Batching] processMeshBatch: Assigned to currentChunkMeshesForCollision for ${key}.`); // <<< LOG HERE

        // --- ADD HOVER EVENT FOR MINING PANEL ---
        if (typeof window !== 'undefined' && (window as any).consolidatedMiningHoverPanel && typeof (window as any).consolidatedMiningHoverPanel.handleHover === 'function') {
            newMesh.userData._miningHoverHandler = (event: MouseEvent | undefined) => {
                // Create a synthetic event if needed
                const fakeEvent = event || { clientX: 0, clientY: 0 } as MouseEvent;
                const raycaster = new THREE.Raycaster();
                const dependencies = {
                    camera,
                    compInfo: currentCompInfo,
                    noiseScale: currentNoiseScale,
                    planetOffset: currentPlanetOffset
                };
                const brushInfo = { shape: 'sphere', radius: 4 };
                (window as any).consolidatedMiningHoverPanel.handleHover(
                    fakeEvent,
                    raycaster,
                    newMesh,
                    dependencies,
                    brushInfo
                );
            };
            // Add pointerover event
            newMesh.onBeforeRender = function() {
                // Attach DOM event only once
                if (!newMesh.userData._hoverListenerAttached && renderer && renderer.domElement) {
                    renderer.domElement.addEventListener('mousemove', function domHoverListener(e) {
                        // Project mouse to world and check if over this mesh
                        // (In a real app, use raycasting; here, always call handler for demo)
                        newMesh.userData._miningHoverHandler(e);
                    });
                    newMesh.userData._hoverListenerAttached = true;
                }
            };
    }
        }
    }
}

// --- Editing Setup ---
export function setupIsolatedEditing(
    statusElement: HTMLElement,
    logPanel: HTMLElement, // <<< ADD parameter for log panel
    callback: (keys: string[]) => void
) {
    // Force mining tab active as early as possible
    if (typeof window !== 'undefined' && window.miningPanelTabUtils &&
        typeof window.miningPanelTabUtils.setMiningTabActiveStatus === 'function') {
        console.log("[IsolatedTerrainViewer] Explicitly activating mining tab from setupIsolatedEditing...");
        window.miningPanelTabUtils.setMiningTabActiveStatus(true);
    } else {
        console.warn("[IsolatedTerrainViewer] Cannot activate mining tab - miningPanelTabUtils not available.");
    }

    console.log("Setting up simplified mining panel UI - THIS BLOCK IS NOW COMMENTED OUT FOR TESTING MAIN DEBUG PANEL INTEGRATION");

    if (!renderer || !camera || !scene || !containerElement) {
         console.error("IsolatedViewer: Cannot set up editing - viewer not fully initialized.");
         return;
    }
    logCallback = callback; // Store the callback
    statusElementRef = statusElement; // Store reference to the status element
    logPanelElement = logPanel; // <<< Store reference to the log panel element

    // Clear any old logs on setup
    if (logPanelElement) {
        logPanelElement.innerHTML = '';
    }

    if (statusElementRef) {
        statusElementRef.textContent = 'Ready'; // Initial status
    }

    // Create mining panel UI
    if (currentCompInfo && currentNoiseScale !== null && currentPlanetOffset !== null) {
        console.log("Setting up simplified mining panel UI");

        // Create the mining panel UI
        const miningPanelElements = createSimpleMiningPanel(
            containerElement!,
            currentCompInfo!.topElements,
            currentNoiseScale!,
            currentPlanetOffset!,
            playerInventory,
            CHUNK_SIZE
        );

        // Store references to the UI elements
        miningPanelContainer = miningPanelElements.miningPanelContainer;
        resourceStatsPanel = miningPanelElements.resourceStatsPanel;
        miningInfoPanel = miningPanelElements.resourceCounterPanel;
        inventoryPanel = miningPanelElements.inventoryPanel;
        miningEffectsContainer = miningPanelElements.miningEffectsContainer;

        // Make sure regular mining panel is VISIBLE initially
        if (miningPanelContainer) {
            miningPanelContainer.style.display = 'block';
            miningPanelVisible = true;
        }

        // Add event listener to the calculate button in the header
        const calculateButton = miningPanelContainer.querySelector('.calculate-button');
        if (calculateButton && currentCompInfo!.topElements) {
            calculateButton.addEventListener('click', () => {
                console.log("Calculate Resources button clicked");

                // Calculate resource distribution
                resourceCalculationResult = estimateTotalResources(
                    currentCompInfo!.topElements!,
                    currentNoiseScale!,
                    currentPlanetOffset!,
                    CHUNK_SIZE,
                    8 // Default depth
                );

                console.log("Resource calculation complete:", resourceCalculationResult);

                // Update the UI
                updateResourceStatsPanel(resourceStatsPanel!, resourceCalculationResult, CHUNK_SIZE);
                updateResourceCounterPanel(miningInfoPanel!, resourceCalculationResult);

                // Log the calculation
                appendLogMessage({
                    type: 'mine',
                    message: 'Resource calculation complete',
                    materialName: 'Resource Analysis',
                    materialColor: new THREE.Color(0x00ffff),
                    amount: resourceCalculationResult.totalSamples,
                    materialIndex: -1
                });
            });
        }

        // Add event listener to the grid toggle button in the header
        console.log("[IVT] Attempting to find .grid-toggle-button. Mining Panel Container exists:", !!miningPanelContainer);
        if (miningPanelContainer) {
            console.log("[IVT] Mining Panel Container innerHTML before querying .grid-toggle-button:", miningPanelContainer.innerHTML);
        }
        const gridToggleButton = miningPanelContainer.querySelector('.grid-toggle-button');
        console.log("[IVT] Query result for .grid-toggle-button:", gridToggleButton);

        if (gridToggleButton) {
            console.log("[IVT] .grid-toggle-button FOUND. Setting up listener.");
            gridToggleButton.addEventListener('click', () => {
                // Toggle the internal grid visualizer for the focused chunk
                const isFocusedGridVisible = toggleInternalGridVisualizer();

                // Toggle the world chunk boundaries
                // We want the main button to reflect the state of the *world* grid primarily.
                // Or, we can have two separate toggles eventually. For now, let's tie them.
                const areWorldBoundariesVisible = toggleWorldChunkBoundaries(isFocusedGridVisible); // Link to focused grid visibility for now


                // Update the button text and class based on world boundaries state
                gridToggleButton.textContent = areWorldBoundariesVisible ? 'Hide Grids' : 'Show Grids';
                if (areWorldBoundariesVisible) {
                    gridToggleButton.classList.add('active');
                } else {
                    gridToggleButton.classList.remove('active');
                }

                // Log the action
                appendLogMessage({
                    type: 'info', // Changed from 'mine'
                    message: `Focused chunk grid ${isFocusedGridVisible ? 'shown' : 'hidden'}. World boundaries ${areWorldBoundariesVisible ? 'shown' : 'hidden'}.`,
                    materialName: 'Grid Visualizer',
                   // materialColor: new THREE.Color(0x00ffff), // Color no longer fits generic info
                   // amount: 0, // Amount not relevant
                   // materialIndex: -1 // Index not relevant
                });
            });
        } else {
            console.error("[IVT] .grid-toggle-button NOT FOUND in miningPanelContainer!");
        }
    }

    const canvas = renderer.domElement;
    // --- ADD MouseMove Listener ---
    canvas.addEventListener('mousemove', handleIsolatedMouseMove);
    // --------------------------
    canvas.addEventListener('mousedown', handleIsolatedEdit);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// <<< MODIFIED Log Appending Helper >>>
interface LogData {
    type: 'mine' | 'miss' | 'error' | 'info';
    coords?: THREE.Vector3;
    materialIndex?: number;
    materialSymbol?: string;
    materialName?: string;
    materialColor?: THREE.Color;
    amount?: number;
    message?: string; // For simple messages or errors
}

function appendLogMessage(data: LogData) {
    if (!logPanelElement) return;

    const logEntry = document.createElement('p');
    logEntry.style.margin = '4px 0'; // Even more margin
    logEntry.style.fontSize = '1.1em'; // <<< Make individual entries larger
    logEntry.style.fontFamily = 'monospace';
    logEntry.style.lineHeight = '1.5'; // Improve readability further
    logEntry.style.borderBottom = '1px dashed rgba(255, 255, 255, 0.1)'; // Separator line
    logEntry.style.paddingBottom = '4px'; // Space below separator

    if (data.type === 'mine' && data.coords && data.materialName !== undefined && data.materialColor && data.amount !== undefined && data.materialIndex !== undefined) {
        const colorHex = data.materialColor.getHexString();
        // Create a subtle background highlight using the material color
        const bgColor = `rgba(${data.materialColor.r * 255}, ${data.materialColor.g * 255}, ${data.materialColor.b * 255}, 0.15)`;
        logEntry.innerHTML =
            `⛏️ <span style="color: #aaa;">[${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span> Mined: ${data.amount} ` +
            `<span style="color: #${colorHex}; font-weight: bold; background-color: ${bgColor}; padding: 1px 3px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.2);">${data.materialName}</span> ` +
            `<span style="color: #aaa;">(Index: ${data.materialIndex})</span>`;
    } else if (data.type === 'miss') {
        logEntry.innerHTML = `<span style="color: #ffcc00;">⚠️ ${data.message || 'Click missed terrain.'}</span>`; // Warning color
    } else if (data.type === 'error') {
        logEntry.innerHTML = `<span style="color: #ff6666;">❌ Error: ${data.message || 'Unknown error'}</span>`; // Error color
        if (data.coords) {
            logEntry.innerHTML += ` <span style="color: #aaa;">at [${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span>`;
        }
    } else if (data.type === 'info') {
        logEntry.innerHTML = `<span style="color: #66ccff;">ℹ️ ${data.message || 'Info'}</span>`; // Info color
        if (data.coords) {
            logEntry.innerHTML += ` <span style="color: #aaa;">at [${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span>`;
        }
    } else {
         logEntry.textContent = data.message || 'Unknown log entry.'; // Fallback
    }

    logPanelElement.appendChild(logEntry);

    // Optional: Keep log panel scrolled to the bottom
    logPanelElement.scrollTop = logPanelElement.scrollHeight;

    // Optional: Limit number of log entries (e.g., keep last 50)
    const maxLogEntries = 50;
    while (logPanelElement.children.length > maxLogEntries) {
        logPanelElement.removeChild(logPanelElement.firstChild!);
    }
}

// --- NEW MouseMove Handler for Brush AND Mining Hover Panel ---
function handleIsolatedMouseMove(event: MouseEvent) {
    logThrottled("ISO_TV_MOUSE_MOVE", 2000, "[HoverDebug] handleIsolatedMouseMove: Fired");

    if (isFirstPersonMode || isThirdPersonMode || !renderer || !camera || !editBrushMesh) {
        logThrottled("ISO_TV_MOUSE_MOVE_EXIT_EARLY", 2000, "[HoverDebug] Exiting early: FP/TP mode or missing essentials.", { isFirstPersonMode, isThirdPersonMode, renderer: !!renderer, camera: !!camera, editBrushMesh: !!editBrushMesh });
        // If not in orbit mode or essential elements missing, ensure mining hover info is cleared too
        if (typeof window !== 'undefined' && (window as any).miningPanelTabUtils &&
            typeof (window as any).miningPanelTabUtils.updateHoverCompositionInfo === 'function') {
            (window as any).miningPanelTabUtils.updateHoverCompositionInfo(null, null, null);
        }
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // --- Logic for Edit Brush Visualizer (using raycastBoxMesh) ---
    if (raycastBoxMesh) {
        const intersectsBrushBox = raycaster.intersectObject(raycastBoxMesh);
        if (intersectsBrushBox.length > 0) {
            const point = intersectsBrushBox[0].point;
        editBrushMesh.position.copy(point);
        if (!editBrushMesh.visible) editBrushMesh.visible = true;
    } else {
        if (editBrushMesh.visible) editBrushMesh.visible = false;
        }
    }

    // --- NEW Logic for Mining Panel Tab Hover Info ---
    if (typeof window !== 'undefined' && (window as any).miningPanelTabUtils &&
        typeof (window as any).miningPanelTabUtils.getIsMiningTabActive === 'function' &&
        typeof (window as any).miningPanelTabUtils.updateHoverCompositionInfo === 'function') {

        const isMiningTabActive = (window as any).miningPanelTabUtils.getIsMiningTabActive();
        logThrottled("ISO_TV_MINING_TAB_ACTIVE", 2000, "[HoverDebug] Is Mining Tab Active?", isMiningTabActive);

        if (isMiningTabActive) {
            const chunkMeshesToTest = Object.values(currentChunkMeshesForCollision).filter(mesh => mesh instanceof THREE.Mesh) as THREE.Mesh[];
            let analysisPoint: THREE.Vector3 | null = null;
            let analysisData: any | null = null;
            const currentBrushInfo = {
                shape: editBrushShape,
                radius: editBrushRadius,
            };

            if (chunkMeshesToTest.length > 0) {
                const intersectsChunk = raycaster.intersectObjects(chunkMeshesToTest, false);
                if (intersectsChunk.length > 0 && intersectsChunk[0].object instanceof THREE.Mesh) {
                    analysisPoint = intersectsChunk[0].point;
                    logThrottled("ISO_TV_RAY_HIT_CHUNK", 2000, "[HoverDebug] Raycast HIT specific chunk. Point:", analysisPoint?.toArray());
                }
            }

            if (!analysisPoint && editBrushMesh && editBrushMesh.visible) {
                analysisPoint = editBrushMesh.position.clone();
                logThrottled("ISO_TV_USING_BRUSH_POS", 2000, "[HoverDebug] No direct raycast hit, using brush position. Point:", analysisPoint?.toArray());
            }

            if (analysisPoint) {
                logThrottled("ISO_TV_ANALYSIS_POINT", 2000, "[HoverDebug] Analysis point determined:", analysisPoint?.toArray());
                if (typeof (window as any).analyzeVolumeComposition === 'function' &&
                    currentCompInfo && currentCompInfo.topElements && // ENSURE .topElements is also truthy
                    currentNoiseScale !== null &&
                    currentPlanetOffset !== null
                ) {
                    console.log("[HoverDebug] Attempting to call window.analyzeVolumeComposition.");
                    try {
                        analysisData = (window as any).analyzeVolumeComposition(
                            analysisPoint, // center
                            currentCompInfo.topElements, // topElements (now guaranteed not null)
                            currentNoiseScale,
                            currentPlanetOffset,
                            currentBrushInfo.radius,
                            currentBrushInfo.shape,
                            editBrushVerticality,
                            CHUNK_SIZE, // Effectively resolutionContextWidth
                            CHUNK_HEIGHT // Effectively resolutionContextHeight
                        );
                       logThrottled("ISO_TV_ANALYZE_VOL_RETURN", 2000, "[HoverDebug] window.analyzeVolumeComposition returned:", analysisData);
                    } catch (error) {
                        console.error("[HoverDebug] Error calling analyzeVolumeComposition:", error);
                        analysisData = null;
                    }
                } else {
                    logThrottled("ISO_TV_ANALYZE_VOL_UNAVAILABLE", 2000, "[HoverDebug] analyzeVolumeComposition function or its dependencies not available.", { analyzeFunc: typeof (window as any).analyzeVolumeComposition, currentCompInfo: !!currentCompInfo, currentNoiseScale: currentNoiseScale !== null, currentPlanetOffset: !!currentPlanetOffset }, "warn");
                    analysisData = null;
                }
                logThrottled("ISO_TV_UPDATE_HOVER_INFO", 2000, "[HoverDebug] Calling updateHoverCompositionInfo with data:", analysisData, "Point:", analysisPoint?.toArray(), "Brush:", currentBrushInfo);
                (window as any).miningPanelTabUtils.updateHoverCompositionInfo(analysisData, analysisPoint, currentBrushInfo);
            } else {
                logThrottled("ISO_TV_NO_ANALYSIS_POINT", 2000, "[HoverDebug] No analysis point determined, clearing info panel.");
                (window as any).miningPanelTabUtils.updateHoverCompositionInfo(null, null, null);
            }
        } else {
            // Mining tab is not active, clear panel
             logThrottled("ISO_TV_MINING_TAB_INACTIVE", 2000, "[HoverDebug] Mining tab NOT active, ensuring info panel is cleared.");
            (window as any).miningPanelTabUtils.updateHoverCompositionInfo(null, null, null);
        }
    } else if (typeof window !== 'undefined' && (window as any).miningPanelTabUtils &&
               typeof (window as any).miningPanelTabUtils.updateHoverCompositionInfo === 'function') {
        // MiningPanelTabUtils or a specific function is missing, ensure info is cleared
        logThrottled("ISO_TV_MINING_UTILS_PARTIAL_MISSING", 2000, "[HoverDebug] MiningPanelTabUtils partially missing, clearing info panel.", "warn");
        (window as any).miningPanelTabUtils.updateHoverCompositionInfo(null, null, null);
    } else {
        logThrottled("ISO_TV_MINING_UTILS_ALL_MISSING", 2000, "[HoverDebug] MiningPanelTabUtils entirely missing. Cannot update hover info.", "warn");
    }
}
// --------------------------------------

// --- Editing Handler ---
function handleIsolatedEdit(event: MouseEvent) {
    const currentMap = isolatedLoadedChunkData[ISOLATED_CHUNK_KEY]?.noiseMap;

    if (!renderer || !camera || !scene || !currentMap || !currentNoiseLayers || !currentSeed || !currentCompInfo || currentNoiseScale === null || currentPlanetOffset === null) {
        console.warn("IsolatedViewer: Cannot perform edit, essential dependencies missing.");
        appendLogMessage({ type: 'error', message: 'Cannot perform edit, dependencies missing.' });
        return;
    }

    const activeChunkMeshes: THREE.Mesh[] = Object.values(isolatedLoadedChunkData)
        .map(data => data?.mesh)
        .filter(mesh => mesh instanceof THREE.Mesh) as THREE.Mesh[];

    console.log('[DEBUG] Active chunk meshes for raycasting:', activeChunkMeshes.map(m => m.name)); // ADDED LOG
    if (activeChunkMeshes.length === 0) {
        console.error("[DEBUG] No active chunk meshes to raycast against!"); // ADDED LOG
        appendLogMessage({ type: 'miss', message: 'No terrain loaded to interact with (activeChunkMeshes empty).' });
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    const activeCamera = isFirstPersonMode ? fpCameraRef : camera;
    if (!activeCamera) {
        console.error("[DEBUG] Cannot edit: No active camera found!"); // ADDED LOG
        appendLogMessage({ type: 'error', message: 'Cannot perform edit, no active camera.' });
        return;
    }
    raycaster.setFromCamera(mouse, activeCamera);

    console.log("[DEBUG] Raycasting from camera against activeChunkMeshes..."); // ADDED LOG
    const intersects = raycaster.intersectObjects(activeChunkMeshes, false);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const objectName = intersects[0].object.name;
        console.log(`[DEBUG] Raycast HIT: object '${objectName}' at`, point); // ADDED LOG

        // TEMPORARY VISUAL DEBUG: Create a small sphere at the hit point
        const sphereGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }); // Magenta
        const hitMarker = new THREE.Mesh(sphereGeo, sphereMat);
        hitMarker.position.copy(point);
        scene.add(hitMarker);
        console.log("[DEBUG] Added temporary hit marker to scene."); // ADDED LOG
        setTimeout(() => {
            if (scene && hitMarker.parent === scene) { // Check if still in scene
                 scene.remove(hitMarker);
                 sphereGeo.dispose();
                 sphereMat.dispose();
                 console.log("[DEBUG] Removed temporary hit marker."); // ADDED LOG
            }
        }, 3000); // Remove after 3 seconds

        // Use the brush mode instead of mouse button to determine add/remove
        // Left click (button 0) always uses the current brush mode
        // Right click (button 2) always does the opposite of the current mode
        let shouldRemove: boolean;

        if (event.button === 0) {
            // Left click - use current brush mode
            shouldRemove = editBrushMode === 'remove';
        } else if (event.button === 2) {
            // Right click - do opposite of current mode
            shouldRemove = editBrushMode === 'add';
        } else {
            // Middle click or other - ignore
            return;
        }

        const actionText = shouldRemove ? 'Removed (Mine)' : 'Added';
        const coordsText = `[X: ${point.x.toFixed(1)}, Z: ${point.z.toFixed(1)}, Y: ${point.y.toFixed(1)}]`;
        console.log(`Isolated Edit: ${actionText} terrain at ${coordsText} using ${editBrushShape} brush (hit mesh)`);
        let resourceMessage = '';

        if (shouldRemove) {
            try {
                // Use the area mining system to mine resources from the entire brush area
                const areaMiningResult = mineAreaAtPoint(
                    point,
                    currentCompInfo.topElements!,
                    currentNoiseScale!,
                    currentPlanetOffset!,
                    miningTools[activeTool],
                    playerInventory,
                    editBrushRadius,
                    editBrushShape as 'sphere' | 'cube' | 'cylinder',
                    editBrushVerticality
                );

                if (areaMiningResult.success) {
                    // Apply damage to the tool
                    const toolBroken = damageTool(miningTools[activeTool], areaMiningResult.toolDamage);

                    // Update the inventory panel
                    if (inventoryPanel) {
                        updateInventoryPanel(inventoryPanel, playerInventory);
                    }

                    // Update the resource counter panel with volume composition data
                    if (miningInfoPanel && areaMiningResult.volumeComposition) {
                        updateResourceCounterWithVolumeData(miningInfoPanel, areaMiningResult.volumeComposition);
                    }

                    resourceMessage = areaMiningResult.message;

                    // Log the mining results for each material
                    areaMiningResult.resources.forEach(resource => {
                        // Create mining effect for each material
                        createMiningEffect(point, resource.materialColor, resource.amount, resource.materialSymbol);

                        // Log each material
                        appendLogMessage({
                            type: 'mine',
                            coords: point,
                            materialIndex: resource.materialIndex,
                            materialSymbol: resource.materialSymbol,
                            materialName: resource.materialName,
                            materialColor: resource.materialColor,
                            amount: resource.amount
                        });
                    });

                    // Log summary
                    appendLogMessage({
                        type: 'info',
                        message: `Mined ${areaMiningResult.minedPoints} of ${areaMiningResult.totalPoints} points in brush area`,
                        coords: point
                    });

                    // Log volume composition if available
                    if (areaMiningResult.volumeComposition) {
                        const compositionSummary = volumeCompositionToString(areaMiningResult.volumeComposition);
                        console.log("Volume Composition Analysis:", compositionSummary);

                        // Log the top 3 materials in the composition
                        const sortedMaterials = Object.values(areaMiningResult.volumeComposition.materialCounts)
                            .sort((a, b) => b.percentage - a.percentage)
                            .slice(0, 3);

                        if (sortedMaterials.length > 0) {
                            // Calculate total voxels in the chunk (32x32x32)
                            const totalVoxels = 32768; // 32^3

                            // Create a message with material percentages and estimated units
                            const compositionMessage = sortedMaterials
                                .map(m => {
                                    const estimatedUnits = Math.round((m.percentage / 100) * totalVoxels);
                                    return `${m.materialName}: ${m.percentage.toFixed(1)}% (~${estimatedUnits} units)`;
                                })
                                .join(', ');

                            appendLogMessage({
                                type: 'info',
                                message: `Volume composition: ${compositionMessage}`,
                                coords: point
                            });

                            // Add a second message about the internal grid layers
                            appendLogMessage({
                                type: 'info',
                                message: `Analysis includes all internal grid layers (${areaMiningResult.volumeComposition.totalPoints} sample points)`,
                                coords: point
                            });
                        }
                    }

                    // If tool broke, log it
                    if (toolBroken) {
                        appendLogMessage({
                            type: 'error',
                            message: `Your ${miningTools[activeTool].name} broke! Switched to Hand.`,
                            coords: point
                        });
                    }
                } else {
                    resourceMessage = areaMiningResult.message;

                    // Log the mining failure
                    appendLogMessage({
                        type: 'error',
                        message: areaMiningResult.message,
                        coords: point
                    });
                }
            } catch (error: any) {
                console.error("IsolatedViewer: Error during mining:", error);
                appendLogMessage({ type: 'error', message: error.message || 'Unknown error', coords: point });
                resourceMessage = "Error during mining.";
            }
        } else {
            resourceMessage = `Added terrain at ${coordsText}`;
        }

        // *** Call editNoiseMapChunks with current brush parameters ***
        // CRITICAL FIX: Ensure we can handle editing at any Y coordinate
        // This is necessary to allow editing terrain indefinitely downward
        console.log(`editNoiseMapChunks called with worldPoint: ${point} Radius: ${editBrushRadius}, Strength: ${editBrushStrength}, Shape: ${editBrushShape}, Verticality: ${editBrushVerticality}, Remove: ${shouldRemove}`);

        // Create options object for brush parameters
        // VERTICAL TERRAIN EDITING FIX: Increase verticality factor to allow for deeper edits
        const verticality = editBrushVerticality * 5; // Amplify the verticality factor 5x for deeper editing
        const brushOptions = {
            radius: editBrushRadius,
            strength: editBrushStrength,
            shape: editBrushShape as 'sphere' | 'cube' | 'cylinder',
            verticality: verticality
        };

        // CRITICAL FIX: Store the mesh references before editing
        const meshReferencesBeforeEdit: {[key: string]: THREE.Mesh | null} = {};
        for (const key in isolatedLoadedChunkData) {
            if (isolatedLoadedChunkData[key]?.mesh) {
                meshReferencesBeforeEdit[key] = isolatedLoadedChunkData[key].mesh;
            }
        }

        const editChunksCoordsResult: [number, number, number][] = editNoiseMapChunks(
            isolatedLoadedChunkData as unknown as LoadedChunks, // <<< Type assertion
            point,
            shouldRemove,
            currentNoiseLayers!,
            currentSeed!,
            editBrushRadius,      // For backward compatibility
            editBrushStrength,    // For backward compatibility
            brushOptions          // New parameter with all brush options
        );

        // CRITICAL FIX: Convert coordinate triples to chunk keys and regenerate affected meshes
        const affectedKeys = editChunksCoordsResult.map(coords => getChunkKeyY(coords[0], coords[1], coords[2]));

        // <<< ADD DETAILED LOGGING HERE >>>
        console.log(`[DEBUG ITV Edit] editNoiseMapChunks returned coords: ${JSON.stringify(editChunksCoordsResult)}`);
        console.log(`[DEBUG ITV Edit] Derived affectedKeys for regeneration: ${affectedKeys.join(', ') || 'NONE'}`);
        // <<< END DETAILED LOGGING >>>
        
        // CRITICAL: Ensure horizontal neighbors are loaded for all affected chunks
        // This is essential to prevent gaps at chunk boundaries
        for (const coords of editChunksCoordsResult) {
            console.log(`[ITV Edit] Ensuring horizontal neighbors for affected chunk ${coords[0]},${coords[1]},${coords[2]}`);
            ensureHorizontalNeighbors(coords[0], coords[1], coords[2]);
        }

        // CRITICAL FIX: Log all affected keys before regeneration
        console.log(`IsolatedViewer: Edit affected these chunk keys: ${affectedKeys.join(', ')}`);

        // Ensure the preservation of mesh references through regeneration
        if (affectedKeys.length > 0) {
            // Regenerate affected meshes while preserving references
            regenerateAffectedMeshes(affectedKeys);

            // Double-check that mesh references were preserved
            for (const key of affectedKeys) {
                if (meshReferencesBeforeEdit[key] && meshReferencesBeforeEdit[key] !== isolatedLoadedChunkData[key]?.mesh) {
                    console.warn(`Mesh reference changed for ${key} after regeneration. This may cause terrain editing issues.`);
                }
            }

            console.log(`MainPanel: Isolated edit affected chunks: ${affectedKeys.join(', ')}`);
            if (logCallback) logCallback(affectedKeys);
        }

        if (statusElementRef) {
            statusElementRef.textContent = resourceMessage || `${actionText} terrain at ${coordsText}`;
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef) statusElementRef.textContent = 'Ready';
            }, 3000);
        }

        // After terrain modification
        const affectedChunks = getAffectedChunks();
        if (spacetimeDB) {
            for (const chunkKey of affectedChunks) {
                const [x, y, z] = chunkKey.split(',').map(Number);
                const noiseMap = getChunkNoiseMap(x, y, z);
                if (noiseMap) {
                    spacetimeDB.saveTerrainChunk(chunkKey, noiseMap);
                }
            }
        }

    } else {
        const missMessage = "Click missed terrain surface (raycast returned no intersections)."; // More specific
        console.log("[DEBUG] Isolated Edit: " + missMessage); // ADDED DEBUG
        appendLogMessage({ type: 'miss', message: missMessage });
        // Update status bar on miss
        if (statusElementRef) {
            statusElementRef.textContent = missMessage;
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef) statusElementRef.textContent = 'Ready';
            }, 1500);
        }
    }
}

// --- DEBUG: Add window property for TS ---
declare global {
  interface Window {
    DEBUG_BOUNDARY_MESH?: boolean;
    DEBUG_COLLISION_RAYS_ENABLED?: boolean;

    // Add wildernessIntegration property
    wildernessIntegration?: {
      miningIntegration: {
        getToolBrushParams: (toolType: string) => {
          baseRadius: number;
          radiusMultiplier: number;
          strengthMultiplier: number;
          verticalityMultiplier: number;
          preferredShape: 'sphere' | 'cube' | 'cylinder';
        };
      };
      inventorySystem: any;
      craftingSystem: any;
      dayNightSystem: any;
      buildingSystem: any;
      grassSystem: any;
      hungerThirstSystem: any;
      dispose: () => void;
    };

    // Remove our modification to avoid conflicts with existing declarations

    analyzeVolumeComposition?: (
        center: THREE.Vector3,
        topElements: TopElementsData, // Changed: Must be TopElementsData, not null
        noiseScale: number,
        planetOffset: THREE.Vector3,
        brushRadius?: number,
        brushShape?: 'sphere' | 'cube' | 'cylinder',
        brushVerticality?: number,
        // These parameters seem to be from the actual function signature in volumeCompositionAnalyzer
        // We should include them if they are non-optional or if we intend to pass them.
        // For now, matching the multi-arg call in handleIsolatedMouseMove which also passes CHUNK_SIZE & CHUNK_HEIGHT effectively as context/resolution.
        // The actual signature might be (center, topElements, noiseScale, planetOffset, brushRadius, brushShape, brushVerticality, resolution, depthLayers, layerSpacing)
        // We need to ensure our declared signature is compatible.
        // Let's assume CHUNK_SIZE and CHUNK_HEIGHT are used as resolution/context within the function and not direct params here based on the call.
        resolutionContextWidth?: number, // Placeholder for CHUNK_SIZE if it becomes a direct param
        resolutionContextHeight?: number // Placeholder for CHUNK_HEIGHT if it becomes a direct param
    ) => ActualVolumeCompositionResult | null;
  }
}

// --- Render Loop ---
function animate() {
    if (!renderer || !scene || !camera) { // <<< ADDED camera check
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        return;
    }
    animationFrameId = requestAnimationFrame(animate);

    updateYuka(); // <<< UPDATE YUKA AGENTS HERE

    // Update chunk boundary labels if they exist
    if (scene.userData.updateLabels && Array.isArray(scene.userData.updateLabels)) {
        scene.userData.updateLabels.forEach((updateFn: Function) => {
            try {
                updateFn();
            } catch (e) {
                console.error("Error updating chunk label:", e);
            }
        });
    }

    if (isFirstPersonMode) {
        // --- First Person Mode Update ---
        updateIsolatedFirstPerson(); // Call the update function from the other module
        const currentFPCamera = getIsolatedFirstPersonCamera(); // Use getter
        if (currentFPCamera) {
            renderer.render(scene, currentFPCamera); // Render using FP camera
        } else {
            // console.error("FP Camera missing during render loop!") // Reduced console spam
            if (camera) renderer.render(scene, camera); // Fallback to orbit
        }
    } else if (isThirdPersonMode) {
        // --- Third Person Mode Update (NEW) ---
        updateIsolatedThirdPerson();
        const currentTPCamera = getIsolatedThirdPersonCamera();
        if (currentTPCamera) {
            renderer.render(scene, currentTPCamera);
        } else {
            // console.error("TP Camera missing during render loop!"); // Reduced console spam
            if (camera) renderer.render(scene, camera); // Fallback to orbit camera
        }
    } else {
        // --- Orbit Mode Update ---
        orbitControls?.update();
        if (camera) { // Ensure orbit camera exists
             renderer.render(scene, camera); // Render using Orbit camera
        } else {
             // console.error("Orbit Camera missing during render loop!"); // Reduced console spam
        }
    }
}

// --- Cleanup ---
export function cleanupIsolatedViewer() {
    console.log("Cleaning up Isolated Terrain Viewer...");
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    // Clean up FP mode if active
    if (isYukaInitialized) {
        updateYuka(); // This seems to be a general update, not cleanup specific
    }

    if (isFirstPersonMode) {
        cleanupIsolatedFirstPerson();
    }
    if (isThirdPersonMode) {
        cleanupIsolatedThirdPerson();
    }

    cleanupProceduralGenerationPanel();
    cleanupInternalGridControlsPanel();

    // Cleanup Wilderness Survival Panel
    if (wildernessSurvivalPanelElement && wildernessSurvivalPanelElement.parentElement) {
        wildernessSurvivalPanelElement.parentElement.removeChild(wildernessSurvivalPanelElement);
    }
    wildernessSurvivalPanelElement = null;
    isWildernessPanelVisible = false;

    // Cleanup Wilderness Integration
    if (window.wildernessIntegration) {
        try {
            window.wildernessIntegration.dispose();
            console.log("Wilderness integration disposed");
        } catch (error) {
            console.error("Error disposing wilderness integration:", error);
        }
        window.wildernessIntegration = undefined;
    }

    if (isYukaInitialized) {
        cleanupYuka();
        isYukaInitialized = false;
    }
    if (yukaAiPanelElement) {
        cleanupYukaAIPanel();
        yukaAiPanelElement = null;
    }

    if (scene) {
        removeTrueChunkBoundariesVisualization(scene);
    }

    if (renderer) {
         const canvas = renderer.domElement;
         canvas.removeEventListener('mousemove', handleIsolatedMouseMove);
         canvas.removeEventListener('mousedown', handleIsolatedEdit);
         canvas.oncontextmenu = null;
    }

    // Remove wilderness event listeners
    document.removeEventListener('wilderness-tool-changed', wildernessToolChangeHandler);
    document.removeEventListener('wilderness-brush-params-changed', wildernessBrushParamsChangeHandler);
    if (containerElement && (containerElement as any).__resizeObserver) {
        (containerElement as any).__resizeObserver.disconnect();
        delete (containerElement as any).__resizeObserver;
    }

    if (scene) {
        const keysToCleanup = Object.keys(isolatedLoadedChunkData);
        console.log(`Cleaning up ${keysToCleanup.length} terrain chunk meshes...`);

        for (const key of keysToCleanup) {
            const chunkDetail = isolatedLoadedChunkData[key];
            if (chunkDetail && chunkDetail.mesh) {
                const mesh = chunkDetail.mesh;
                scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach(m => m.dispose());
                    } else {
                        mesh.material.dispose();
                    }
                }
                chunkDetail.mesh = null; // Help GC
            }
            delete isolatedLoadedChunkData[key];
        }

        // Dispose visualizer layers
        internalVisualizerLayers.forEach(layer => { // Changed objFromLayerArray to layer
            if (scene && layer.parent === scene) { // Use layer
                scene.remove(layer);
        }
            // Add instanceof checks for proper disposal
            if (layer instanceof THREE.Mesh || layer instanceof THREE.InstancedMesh) {
            if (layer.geometry) layer.geometry.dispose();
            if (layer.material) {
                    const mat = layer.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(mat)) {
                        mat.forEach(m => m.dispose());
                } else {
                        mat.dispose();
                    }
                }
            } else if (layer instanceof THREE.Group) {
                 layer.children.slice().forEach(child => {
                    layer.remove(child);
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            const matChild = child.material as THREE.Material | THREE.Material[];
                            if (Array.isArray(matChild)) {
                                matChild.forEach(m => m.dispose());
                            } else {
                                matChild.dispose();
                            }
                        }
                    }
                 });
            }
        });

        [raycastBoxMesh, editBrushMesh].forEach(mesh => {
            if (mesh && scene) {
                scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) {
                    const mat = mesh.material as THREE.Material | THREE.Material[]; // Added type assertion
                    if (Array.isArray(mat)) {
                        mat.forEach(m => m.dispose());
                    } else {
                        mat.dispose();
                    }
                }
            }
        });

        // scene = null; // Commenting out, might be too aggressive if other modules share scene
    }

    isolatedLoadedChunkData = {};
    internalVisualizerLayers = [];
    raycastBoxMesh = null;
    editBrushMesh = null;
    currentChunkMeshesForCollision = {};

    if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        // renderer = null; // Commenting out, might be too aggressive
    }
    camera = null;
    // orbitControls = null; // Assuming orbitControls is specific to this viewer instance and can be nulled
    // scene = null; // Moved specific disposes up, be cautious with nulling shared objects

    currentNoiseLayers = null;
    currentSeed = null;
    currentCompInfo = null;
    currentPlanetOffset = null;
    currentNoiseScale = null;
    logCallback = null;
    statusElementRef = null;
    logPanelElement = null;

    console.log("Isolated Terrain Viewer cleanup complete.");
}

// --- Update Brush Visualizer ---
function updateBrushVisualizer() {
    if (!scene) return;

    // Remove existing brush mesh
    if (editBrushMesh) {
        scene.remove(editBrushMesh);
        if (editBrushMesh.geometry) editBrushMesh.geometry.dispose();
        if (editBrushMesh.material instanceof THREE.Material) {
            editBrushMesh.material.dispose();
        } else if (Array.isArray(editBrushMesh.material)) {
            editBrushMesh.material.forEach(m => m.dispose());
        }
    }

    // VERTICAL TERRAIN EDITING FIX: Apply the same verticality amplification to visualize actual edit area
    const horizontalRadius = editBrushRadius;
    const verticalRadius = editBrushRadius * (editBrushVerticality * 5); // Match the 5x amplification

    // Create brush geometry based on current shape
    let brushGeometry;

    switch (editBrushShape) {
        case 'cube':
            brushGeometry = new THREE.BoxGeometry(
                horizontalRadius * 2,
                verticalRadius * 2,
                horizontalRadius * 2
            );
            break;

        case 'cylinder':
            // Cylinder is oriented along the Y axis
            brushGeometry = new THREE.CylinderGeometry(
                horizontalRadius, // top radius
                horizontalRadius, // bottom radius
                verticalRadius * 2, // height
                16, // radial segments
                2, // height segments
                false // open ended
            );
            break;

        case 'sphere':
        default:
            // Use SphereGeometry but scale Y to represent the ellipsoid
            brushGeometry = new THREE.SphereGeometry(
                horizontalRadius,
                16, // width segments
                16  // height segments
            );
            // Apply vertical scaling in the mesh's scale property
            const verticalScale = verticalRadius / horizontalRadius;
            brushGeometry.scale(1, verticalScale, 1);
            break;
    }

    // Create semi-transparent material for the brush
    const color = editBrushMode === 'add' ? 0x00ff00 : 0xff0000;
    const brushMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        wireframe: true
    });

    // Create and add the brush mesh
    editBrushMesh = new THREE.Mesh(brushGeometry, brushMaterial);
    scene.add(editBrushMesh);

    // Position the brush at its current position or at the camera position if not positioned yet
    if (editBrushMesh.position.equals(new THREE.Vector3(0, 0, 0)) && camera) {
        editBrushMesh.position.copy(camera.position);
    }

    console.log(`Updated brush visualizer: shape=${editBrushShape}, horizontalRadius=${horizontalRadius}, verticalRadius=${verticalRadius} (amplified 5x)`);
}

// --- Helper to Create Mining Effect ---
function createMiningEffect(position: THREE.Vector3, color: THREE.Color, amount: number = 1, materialSymbol?: string) {
    if (!scene || !miningEffectsContainer) return;

    // Create a DOM element for the mining effect
    const effectElement = document.createElement('div');
    effectElement.className = 'mining-effect';
    effectElement.style.position = 'absolute';
    effectElement.style.pointerEvents = 'none';

    // Position the effect element
    // Convert 3D position to screen coordinates
    const screenPosition = new THREE.Vector3(position.x, position.y, position.z);
    screenPosition.project(camera!);

    const x = (screenPosition.x * 0.5 + 0.5) * renderer!.domElement.clientWidth;
    const y = (-(screenPosition.y * 0.5) + 0.5) * renderer!.domElement.clientHeight;

    effectElement.style.left = `${x}px`;
    effectElement.style.top = `${y}px`;

    // Set the effect color
    effectElement.style.color = `#${color.getHexString()}`;

    // Add the effect text with material symbol if available
    effectElement.innerHTML = `+${amount}${materialSymbol ? ` ${materialSymbol}` : ''}`;

    // Add the effect to the container
    miningEffectsContainer.appendChild(effectElement);

    // Create particles in the 3D scene
    const particleCount = 20;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    // Initialize particle positions and velocities
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        particlePositions[i3] = position.x;
        particlePositions[i3 + 1] = position.y;
        particlePositions[i3 + 2] = position.z;

        // Random velocity in a sphere
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        particleVelocities.push(velocity);
    }

    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
        color: color,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
    });

    // Create particle system
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = 'mining-particles-' + Date.now();
    scene.add(particles);

    // Animate particles
    let frame = 0;
    const maxFrames = 30;

    function animateParticles() {
        if (frame >= maxFrames || !scene) {
            // Remove particles when animation is done
            if (scene && particles.parent === scene) {
                scene.remove(particles);
                particleGeometry.dispose();
                particleMaterial.dispose();
            }
            return;
        }

        frame++;

        // Update particle positions
        const positions = particleGeometry.attributes.position.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] += particleVelocities[i].x;
            positions[i3 + 1] += particleVelocities[i].y;
            positions[i3 + 2] += particleVelocities[i].z;

            // Apply gravity
            particleVelocities[i].y -= 0.01;
        }

        particleGeometry.attributes.position.needsUpdate = true;

        // Fade out
        particleMaterial.opacity = 0.8 * (1 - frame / maxFrames);

        requestAnimationFrame(animateParticles);
    }

    // Start animation
    animateParticles();

    // Remove the DOM element after animation
    setTimeout(() => {
        if (effectElement.parentNode === miningEffectsContainer && miningEffectsContainer) {
            miningEffectsContainer.removeChild(effectElement);
        }
    }, 2000);
}

// --- Helper to Toggle Internal Grid Visualizer ---
// This function will now need to use `internalGridSettingsForViewer`
export function toggleInternalGridVisualizer(visible?: boolean) {
    const currentActiveSettings = internalGridSettingsForViewer || getInternalGridSettings(); // Use viewer's copy or panel's current if viewer hasn't received update yet

    if (visible === undefined) {
        internalGridVisible = !internalGridVisible;
    } else {
        internalGridVisible = visible;
    }

    console.log(`IsolatedViewer: ToggleInternalGridVisualizer called. Effective visibility: ${internalGridVisible}. Settings:`, currentActiveSettings);

    // Update the chunk count display
    let affectedChunkCount = 0;
    if (currentActiveSettings.showInPlayerChunkOnly) {
        affectedChunkCount = 1; // Just the player chunk
    } else {
        affectedChunkCount = Math.pow(2 * currentActiveSettings.horizontalChunkRadius + 1, 2);
    }
    updateChunkCountDisplay(affectedChunkCount);

    // Clear existing layers if we are hiding, OR if we are showing and intend to rebuild.
    if (internalVisualizerLayers.length > 0) {
        console.log("IsolatedViewer: Clearing existing internal visualizer layers before new operation.");
        internalVisualizerLayers.forEach(objFromLayerArray => {
            if (scene && objFromLayerArray.parent === scene) {
                scene.remove(objFromLayerArray);
            }
            // Proper disposal for Groups, InstancedMeshes, and Meshes
            if (objFromLayerArray instanceof THREE.Group) {
                const group = objFromLayerArray;
                group.children.slice().forEach(child => {
                    group.remove(child);
                    if (child instanceof THREE.Mesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            const mat = child.material as THREE.Material | THREE.Material[];
                            if (Array.isArray(mat)) {
                                mat.forEach(m => m.dispose());
                            } else {
                                mat.dispose();
                            }
                        }
                    }
                });
            } else if (objFromLayerArray instanceof THREE.InstancedMesh || objFromLayerArray instanceof THREE.Mesh) {
                if (objFromLayerArray.geometry) objFromLayerArray.geometry.dispose();
                if (objFromLayerArray.material) {
                    const mat = objFromLayerArray.material as THREE.Material | THREE.Material[];
                    if (Array.isArray(mat)) {
                        mat.forEach(m => m.dispose());
                    } else {
                        mat.dispose();
                    }
                }
            }
        });
        internalVisualizerLayers = [];
        console.log("IsolatedViewer: All internal visualizer layers cleared.");
    }

    if (internalGridVisible && scene &&
        currentCompInfo && currentCompInfo.topElements &&
        currentNoiseScale !== null && currentPlanetOffset !== null) {

        console.log("IsolatedViewer: Creating new internal material grid visualization using reference approach (cloned geometry).");

        const settingsToUse = currentActiveSettings;
        const targetChunkCoordinates: { x: number, y: number, z: number }[] = [];
        const playerChunkY = ISOLATED_CHUNK_Y;

        if (settingsToUse.showInPlayerChunkOnly) {
            targetChunkCoordinates.push({ x: ISOLATED_CHUNK_X, y: playerChunkY, z: ISOLATED_CHUNK_Z });
        } else {
            for (let dx = -settingsToUse.horizontalChunkRadius; dx <= settingsToUse.horizontalChunkRadius; dx++) {
                for (let dz = -settingsToUse.horizontalChunkRadius; dz <= settingsToUse.horizontalChunkRadius; dz++) {
                    targetChunkCoordinates.push({
                        x: ISOLATED_CHUNK_X + dx,
                        y: playerChunkY, // For now, visualize around the main Y=0 layer of chunks
                        z: ISOLATED_CHUNK_Z + dz
                    });
                }
            }
        }

        // Note: Theoretical chunks are harder with cloned geometry if the base mesh doesn't exist.
        // We might need a fallback for purely theoretical chunks later if this is a hard requirement.
        // For now, focusing on existing/loadable chunks for the cloned geometry approach.

        const visualizerMaterial = createInternalVisualizerMaterial(
            currentCompInfo.topElements,
            currentNoiseScale,
            currentPlanetOffset
        );

        // If the material is null (e.g. topElements not ready), abort
        if (!visualizerMaterial) {
            console.error("IsolatedViewer: Failed to create internal visualizer material. Aborting grid display.");
            internalGridVisible = false; // Don't show grid if material fails
        } else {
            let actualLayersCreatedCount = 0;

            targetChunkCoordinates.forEach(chunkCoords => {
                const chunkKey = `${chunkCoords.x},${chunkCoords.y},${chunkCoords.z}`;
                const chunkData = isolatedLoadedChunkData[chunkKey];
                const sourceMesh = chunkData?.mesh;

                if (sourceMesh && sourceMesh.geometry) {
                    const basePosition = sourceMesh.position.clone(); // Use the actual mesh's world position as base

                    for (let i = 0; i < settingsToUse.numVerticalLayers; i++) {
                        const layerGeometry = sourceMesh.geometry.clone(); // Clone geometry for each layer
                        const layerMesh = new THREE.Mesh(layerGeometry, visualizerMaterial); // Reuse material

                        layerMesh.name = `internal_viz_chunk_${chunkKey}_layer_${i}`;
                        layerMesh.renderOrder = 0; // Render layers before default (0) or main terrain (1)

                        // Offset downwards from the original mesh's position
                        // The layerSpacing and cellThickness from settings are relevant here.
                        // A simple interpretation: layerSpacing is distance between successive surfaces.
                        layerMesh.position.copy(basePosition); // Start at original mesh position
                        layerMesh.position.y -= (i + 1) * settingsToUse.layerSpacing; // Progressively move down

                        // Apply the same rotation/scale as the source mesh if necessary
                        layerMesh.quaternion.copy(sourceMesh.quaternion);
                        layerMesh.scale.copy(sourceMesh.scale);

                        scene!.add(layerMesh);
                        internalVisualizerLayers.push(layerMesh);
                        actualLayersCreatedCount++;
                    }
                } else {
                    console.warn(`IsolatedViewer: No source mesh found for chunk ${chunkKey} to create internal grid.`);
                }
            });
            console.log(`IsolatedViewer: Created ${actualLayersCreatedCount} internal visualizer layers using cloned geometry.`);
        }

    } // End of if (internalGridVisible && scene ...)

    internalVisualizerLayers.forEach(layer => {
        if (layer) layer.visible = internalGridVisible;
    });

    console.log(`IsolatedViewer: Internal grid visualizer final state: ${internalGridVisible ? 'shown' : 'hidden'} (${internalVisualizerLayers.length} layers)`);
    if (statusElementRef) {
        statusElementRef.textContent = `Internal grids ${internalGridVisible ? 'active' : 'inactive'}`;
        if (statusTimeoutId) clearTimeout(statusTimeoutId);
        statusTimeoutId = window.setTimeout(() => {
            if (statusElementRef) statusElementRef.textContent = 'Ready';
        }, 1500);
    }
    return internalGridVisible;
}

// --- NEW: True Chunk Boundaries Visualization Functions ---
function _local_DEPRECATED_addTrueChunkBoundariesVisualization(scene: THREE.Scene, chunksData: { [key: string]: IsolatedChunkData }) {
    if (!scene) return;

    // Remove existing true boundaries before adding new ones
    _local_DEPRECATED_removeTrueChunkBoundariesVisualization(scene);

    if (!trueChunkBoundariesGroup) {
        trueChunkBoundariesGroup = new THREE.Group();
        trueChunkBoundariesGroup.name = "true_chunk_boundaries_visual_group";
        scene.add(trueChunkBoundariesGroup);
    } else {
        // Ensure it's added to the scene if it was somehow removed
        if (!trueChunkBoundariesGroup.parent) {
            scene.add(trueChunkBoundariesGroup);
        }
    }

    console.log(`Adding true chunk boundary boxes for ${Object.keys(chunksData).length} chunks.`);

    for (const key in chunksData) {
        // Check if the chunk data exists, not necessarily if it has a mesh,
        // as we want to show the boundary even for an empty/unmeshed conceptual chunk space.
        if (chunksData[key]) {
            const coords = key.split(',').map(Number);
            if (coords.length === 3 && !coords.some(isNaN)) {
                const [chunkX, chunkY, chunkZ] = coords;

                const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
                // Translate geometry so its corner is at (0,0,0) in local space
                geometry.translate(CHUNK_SIZE / 2, CHUNK_HEIGHT / 2, CHUNK_SIZE / 2);

                const material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00, // Green
                    wireframe: true,
                    transparent: true,
                    opacity: 0.35, // Slightly different opacity
                    depthWrite: false
                });

                const boxMesh = new THREE.Mesh(geometry, material);
                boxMesh.position.set(
                    chunkX * CHUNK_SIZE,
                    chunkY * CHUNK_HEIGHT,
                    chunkZ * CHUNK_SIZE
                );
                boxMesh.name = `true_chunk_boundary_box_${key}`;
                if (trueChunkBoundariesGroup) {
                    trueChunkBoundariesGroup.add(boxMesh);
                }
            }
        }
    }
    // console.log("True chunk boundary boxes added/updated:", trueChunkBoundariesGroup?.children.length);
}

function _local_DEPRECATED_removeTrueChunkBoundariesVisualization(scene: THREE.Scene) {
    if (trueChunkBoundariesGroup && scene) {
        // console.log("Removing true chunk boundary boxes:", trueChunkBoundariesGroup.children.length);
        while (trueChunkBoundariesGroup.children.length > 0) {
            const child = trueChunkBoundariesGroup.children[0] as THREE.Mesh;
            trueChunkBoundariesGroup.remove(child);
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    (child.material as THREE.Material).dispose();
                }
            }
        }
        // It's already assured to be removed from scene if it existed, or re-added if needed.
        // No need to scene.remove(trueChunkBoundariesGroup) here as we reuse the group object.
        // If we were nullifying trueChunkBoundariesGroup, then we'd remove it.
    }
}
// --- End NEW True Chunk Boundaries Visualization Functions ---

// <<< NEW HELPER FUNCTION >>>
function updateBoundaryVisuals(settings: ProceduralGenerationSettings) {
    if (!scene) {
        console.error("[updateBoundaryVisuals] Scene is NULL, cannot update boundaries.");
        return;
    }

    // const settings = getProceduralGenerationSettings() as ProceduralGenerationSettings; // NO LONGER FETCHES, USES PARAMETER
    if (!settings) { // Should not happen if panel always passes it, but good check
        console.warn("[IsolatedTerrainViewer] ProcGen settings not available (passed as null/undefined) for boundary visuals.");
        return;
    }

    // True boundaries (based on actual meshes)
    if (Object.keys(isolatedLoadedChunkData).length > 0) {
        const meshesToVisualize: THREE.Mesh[] = [];
        for (const key in isolatedLoadedChunkData) {
            const chunkData = isolatedLoadedChunkData[key];
            if (chunkData && chunkData.mesh) {
                meshesToVisualize.push(chunkData.mesh);
            }
        }
        // Use the keys returned by addTrueChunkBoundariesVisualization for filtering
        currentGeneratedChunkKeys = addTrueChunkBoundariesVisualization(scene, meshesToVisualize);
        console.log(`[DEBUG ITV] Green box keys (currentGeneratedChunkKeys):`, currentGeneratedChunkKeys);
    } else {
        removeTrueChunkBoundariesVisualization(scene);
        currentGeneratedChunkKeys = [];
    }

    // Theoretical boundaries
    if (getIsTheoreticalBoundariesActive()) {
        const chunkKeysToVisualize: string[] = [];
        const {
            visCenterX, visCenterY, visCenterZ, visHorizontalExtent, visVerticalExtent,
            useAlternatingLogicForTheoreticalViz,
            theoreticalVizAdjacentToTrue, // <<< Destructure new setting
            altStartX, altStartZ, altStripDirection, altInitialYLevel,
            altLowYLevel, altHighYLevel
        } = settings;

        // console.log(`[IsolatedTerrainViewer] updateBoundaryVisuals: Using visHorizontalExtent = ${visHorizontalExtent}, visVerticalExtent = ${visVerticalExtent}`);

        if (theoreticalVizAdjacentToTrue) {
            // --- NEW LOGIC: Show theoretical boundaries only adjacent to true chunks ---
            console.log("[IsolatedTerrainViewer] Using ADJACENT-ONLY theoretical visualization mode.");
            const adjacentTheoreticalKeys = new Set<string>();
            if (currentGeneratedChunkKeys && currentGeneratedChunkKeys.length > 0) {
                for (const trueKey of currentGeneratedChunkKeys) {
                    const parts = trueKey.split(',').map(Number);
                    if (parts.length === 3 && !parts.some(isNaN)) {
                        const [cx, cy, cz] = parts;
                        const neighbors = [
                            { dx: 1, dy: 0, dz: 0 }, { dx: -1, dy: 0, dz: 0 },
                            { dx: 0, dy: 1, dz: 0 }, { dx: 0, dy: -1, dz: 0 },
                            { dx: 0, dy: 0, dz: 1 }, { dx: 0, dy: 0, dz: -1 },
                        ];
                        for (const n of neighbors) {
                            const neighborKey = `${cx + n.dx},${cy + n.dy},${cz + n.dz}`;
                            // Add if not already a true chunk
                            if (!currentGeneratedChunkKeys.includes(neighborKey)) {
                                adjacentTheoreticalKeys.add(neighborKey);
                            }
                        }
                    }
                }
            }
            chunkKeysToVisualize.push(...Array.from(adjacentTheoreticalKeys));
            // No need to further filter by currentGeneratedChunkKeys as we did it above

        } else {
            // --- ORIGINAL LOGIC: Based on extents and alternating settings ---
            console.log("[IsolatedTerrainViewer] Using EXTENT-BASED theoretical visualization mode.");
            // Calculate the bounds of the green area
            let minGreenX = Infinity, maxGreenX = -Infinity, minGreenZ = Infinity, maxGreenZ = -Infinity, minGreenY = Infinity, maxGreenY = -Infinity;
            for (const key of currentGeneratedChunkKeys) {
                const [gx, gy, gz] = key.split(',').map(Number);
                if (gx < minGreenX) minGreenX = gx;
                if (gx > maxGreenX) maxGreenX = gx;
                if (gz < minGreenZ) minGreenZ = gz;
                if (gz > maxGreenZ) maxGreenZ = gz;
                if (gy < minGreenY) minGreenY = gy;
                if (gy > maxGreenY) maxGreenY = gy;
            }
            if (!isFinite(minGreenX)) minGreenX = maxGreenX = visCenterX;
            if (!isFinite(minGreenZ)) minGreenZ = maxGreenZ = visCenterZ;
            if (!isFinite(minGreenY)) minGreenY = maxGreenY = visCenterY;
            // X direction: left of green
            for (let x = minGreenX - visHorizontalExtent; x < minGreenX; x++) {
                for (let z = minGreenZ - visHorizontalExtent; z <= maxGreenZ + visHorizontalExtent; z++) {
                    for (let y = minGreenY - visVerticalExtent; y <= maxGreenY + visVerticalExtent; y++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
            // X direction: right of green
            for (let x = maxGreenX + 1; x <= maxGreenX + visHorizontalExtent; x++) {
                for (let z = minGreenZ - visHorizontalExtent; z <= maxGreenZ + visHorizontalExtent; z++) {
                    for (let y = minGreenY - visVerticalExtent; y <= maxGreenY + visVerticalExtent; y++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
            // Z direction: above green
            for (let z = minGreenZ - visHorizontalExtent; z < minGreenZ; z++) {
                for (let x = minGreenX; x <= maxGreenX; x++) {
                    for (let y = minGreenY - visVerticalExtent; y <= maxGreenY + visVerticalExtent; y++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
            // Z direction: below green
            for (let z = maxGreenZ + 1; z <= maxGreenZ + visHorizontalExtent; z++) {
                for (let x = minGreenX; x <= maxGreenX; x++) {
                    for (let y = minGreenY - visVerticalExtent; y <= maxGreenY + visVerticalExtent; y++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
            // Y direction: below green
            for (let y = minGreenY - visVerticalExtent; y < minGreenY; y++) {
                for (let x = minGreenX - visHorizontalExtent; x <= maxGreenX + visHorizontalExtent; x++) {
                    for (let z = minGreenZ - visHorizontalExtent; z <= maxGreenZ + visHorizontalExtent; z++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
            // Y direction: above green
            for (let y = maxGreenY + 1; y <= maxGreenY + visVerticalExtent; y++) {
                for (let x = minGreenX - visHorizontalExtent; x <= maxGreenX + visHorizontalExtent; x++) {
                    for (let z = minGreenZ - visHorizontalExtent; z <= maxGreenZ + visHorizontalExtent; z++) {
                        const key = `${x},${y},${z}`;
                        if (!currentGeneratedChunkKeys.includes(key)) {
                            chunkKeysToVisualize.push(key);
                        }
                    }
                }
            }
        }

        let finalKeysForTheoretical = Array.from(new Set(chunkKeysToVisualize));

        // --- FINAL EXPLICIT FILTER to ensure no theoretical box overlaps a true box at the same X,Y,Z ---
        if (currentGeneratedChunkKeys && currentGeneratedChunkKeys.length > 0) {
            console.log(`[IsolatedTerrainViewer] Before final XYZ filter, theoretical keys: ${finalKeysForTheoretical.length}`);
            const trueChunkKeysSet = new Set(currentGeneratedChunkKeys);
            finalKeysForTheoretical = finalKeysForTheoretical.filter(theoreticalKey => {
                return !trueChunkKeysSet.has(theoreticalKey);
            });
            console.log(`[IsolatedTerrainViewer] After final XYZ filter, theoretical keys: ${finalKeysForTheoretical.length}`);
        }
        // --- End Final Filter ---
        // Log the full list of theoretical keys and settings
        console.log(`[DEBUG ITV] Theoretical box keys (finalKeysForTheoretical):`, finalKeysForTheoretical);
        console.log(`[DEBUG ITV] visHorizontalExtent: ${visHorizontalExtent}, visCenterX: ${visCenterX}, visCenterZ: ${visCenterZ}`);

        addTheoreticalChunkBoundaries(scene, finalKeysForTheoretical); // Pass the doubly-filtered list
    } else {
        removeTheoreticalChunkBoundaries(scene);
    }
}

// Make sure this function is called when proc gen panel signals an update
// This is typically done by setting this function as a callback in procGenPanel
// e.g., in initIsolatedViewer or a dedicated setup function:
// setRequestUpdateBoundaryVisualsCallback(updateBoundaryVisuals);

// --- End Initialization ---

function toggleWorldChunkBoundaries(visible?: boolean): boolean {
    if (!scene) return false;

    worldBoundariesVisible = visible !== undefined ? visible : !worldBoundariesVisible;

    if (worldBoundariesVisible) {
        if (!worldChunkBoundariesGroup) {
            worldChunkBoundariesGroup = new THREE.Group();
            worldChunkBoundariesGroup.name = "world_chunk_boundaries_group";
            scene.add(worldChunkBoundariesGroup);
        }
        // Clear existing and rebuild
        while (worldChunkBoundariesGroup.children.length > 0) {
            const child = worldChunkBoundariesGroup.children[0] as THREE.Mesh;
            worldChunkBoundariesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    (child.material as THREE.Material).dispose();
                }
            }
        }

        for (const key in isolatedLoadedChunkData) {
            if (isolatedLoadedChunkData[key]) { // Check if chunk data exists
                const coords = key.split(',').map(Number);
                if (coords.length === 3 && !coords.some(isNaN)) {
                    const [chunkX, chunkY, chunkZ] = coords;

                    // Use BoxHelper for simplicity, or wireframe BoxGeometry
                    // const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
                    // geometry.translate(CHUNK_SIZE / 2, CHUNK_HEIGHT / 2, CHUNK_SIZE / 2); // Center if not using BoxHelper from mesh
                    // const material = new THREE.MeshBasicMaterial({
                    //     color: 0xff00ff, // Magenta for global
                    //     wireframe: true,
                    //     transparent: true,
                    //     opacity: 0.4
                    // });
                    // const boxMesh = new THREE.Mesh(geometry, material);

                    // If chunk has a mesh, create helper for it, otherwise a generic box
                    let chunkMesh = isolatedLoadedChunkData[key].mesh;
                    let boxHelper: THREE.BoxHelper | THREE.Mesh;

                    if (chunkMesh) {
                        boxHelper = new THREE.BoxHelper(chunkMesh, 0xff00ff); // Magenta
                    } else {
                        // Fallback for chunks without a mesh (e.g. conceptual space)
                        const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
                        geometry.translate(CHUNK_SIZE / 2, CHUNK_HEIGHT / 2, CHUNK_SIZE / 2);
                        const material = new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, transparent: true, opacity: 0.2 });
                        boxHelper = new THREE.Mesh(geometry, material);
                         boxHelper.position.set(
                            chunkX * CHUNK_SIZE,
                            chunkY * CHUNK_HEIGHT,
                            chunkZ * CHUNK_SIZE
                        );
                    }
                    boxHelper.name = `world_chunk_boundary_${key}`;
                    worldChunkBoundariesGroup.add(boxHelper);
                }
            }
        }
        worldChunkBoundariesGroup.visible = true;
        console.log(`IsolatedViewer: World chunk boundaries shown (${worldChunkBoundariesGroup.children.length} boundaries)`);
    } else {
        if (worldChunkBoundariesGroup) {
            worldChunkBoundariesGroup.visible = false; // More efficient than removing/re-adding group
            console.log("IsolatedViewer: World chunk boundaries hidden");
        }
    }
    return worldBoundariesVisible;
}

// <<< NEW FUNCTION to handle updates from the InternalGridControlsPanel >>>
function handleInternalGridSettingsUpdate(newSettings: InternalGridSettings) {
    console.log("[IsolatedTerrainViewer] Received internal grid settings update:", newSettings);
    internalGridSettingsForViewer = newSettings; // Store the latest settings

    // Calculate how many chunks will be affected
    let affectedChunkCount = 0;
    if (newSettings.showInPlayerChunkOnly) {
        affectedChunkCount = 1; // Just the player chunk
    } else {
        // Calculate based on horizontal chunk radius
        // Formula: (2*radius + 1)² since it's a square area centered on player
        affectedChunkCount = Math.pow(2 * newSettings.horizontalChunkRadius + 1, 2);
    }

    // Update the display with the calculated count
    updateChunkCountDisplay(affectedChunkCount);

    // Now, trigger the regeneration/update of the visual grid layers
    // We need to ensure toggleInternalGridVisualizer can use these new settings.
    // It should be called in a way that it knows to REBUILD the grid if it's already visible,
    // or just build it if it's being turned on for the first time with these settings.

    // Forcing a rebuild: Hide existing (if any) then show with new settings.
    // This ensures disposal of old geometry.
    if (internalVisualizerLayers.length > 0) {
        toggleInternalGridVisualizer(false); // Hide and clear existing layers
    }
    // Then, if the controls panel is requesting an update, it implies grids should be shown.
    // We could also check a master toggle if we add one, e.g. if !masterGridToggle then don't show.
    // For now, if settings are updated via panel, try to show the grid with these settings.
    toggleInternalGridVisualizer(true); // Show with new settings
}

// --- Wilderness Survival Panel Functions ---
function createWildernessSurvivalPanel() {
    if (!containerElement) {
        console.error("Cannot create Wilderness Survival panel: main container not found.");
        return null;
    }

    const panel = document.createElement('div');
    panel.id = 'wilderness-survival-panel';
    panel.style.position = 'fixed';
    panel.style.top = '70px'; // Adjusted for more space from top
    panel.style.right = '20px'; // Positioned to the right
    panel.style.width = '400px'; // Slightly wider
    panel.style.maxHeight = 'calc(100vh - 90px)'; // Adjusted max height
    panel.style.backgroundColor = 'rgba(30, 35, 40, 0.95)'; // Darker, more opaque
    panel.style.border = '1px solid #4a5568'; // Tailwind gray-600 like
    panel.style.borderRadius = '8px';
    panel.style.padding = '20px';
    panel.style.color = '#e2e8f0'; // Tailwind gray-200 like
    panel.style.zIndex = '1002'; // Ensure it's above other UI, but potentially below modals
    panel.style.display = 'none'; // Initially hidden
    panel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
    panel.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)'; // Softer, larger shadow
    panel.style.overflowY = 'auto';
    panel.style.boxSizing = 'border-box';

    const titleBar = document.createElement('div');
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.alignItems = 'center';
    titleBar.style.marginBottom = '20px';
    titleBar.style.paddingBottom = '10px';
    titleBar.style.borderBottom = '1px solid #4a5568';
    panel.appendChild(titleBar);

    const title = document.createElement('h2');
    title.textContent = 'Wilderness Survival Systems';
    title.style.margin = '0';
    title.style.fontSize = '1.25em';
    titleBar.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // Times symbol for close
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.color = '#a0aec0'; // Tailwind gray-500
    closeButton.style.fontSize = '1.75em';
    closeButton.style.lineHeight = '1';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0 5px';
    closeButton.onmouseover = () => closeButton.style.color = '#e2e8f0';
    closeButton.onmouseout = () => closeButton.style.color = '#a0aec0';
    closeButton.onclick = () => {
        toggleWildernessSurvivalPanel(false); // Explicitly hide
    };
    titleBar.appendChild(closeButton);

    // Content area for future systems
    const contentArea = document.createElement('div');
    contentArea.id = 'wilderness-systems-content';
    // contentArea.textContent = 'Systems will be added here...'; // Placeholder removed, will be populated
    contentArea.style.minHeight = '100px'; // Ensure it has some initial height
    panel.appendChild(contentArea);

    // Append to the main container of the isolated viewer, or document.body as a fallback
    const panelHost = containerElement.querySelector('#ui-panels-container') || containerElement || document.body;
    panelHost.appendChild(panel);

    console.log("Wilderness Survival Panel created.");
    return panel;
}

function toggleWildernessSurvivalPanel(forceState?: boolean) {
    if (!wildernessSurvivalPanelElement) {
        wildernessSurvivalPanelElement = createWildernessSurvivalPanel();
        if (!wildernessSurvivalPanelElement) {
            console.error("Failed to create Wilderness Survival panel.");
            return;
        }
    }

    const loaderButton = document.getElementById('wilderness-survival-loader-button') as HTMLButtonElement;

    if (forceState !== undefined) {
        isWildernessPanelVisible = forceState;
    } else {
        isWildernessPanelVisible = !isWildernessPanelVisible;
    }

    if (isWildernessPanelVisible) {
        wildernessSurvivalPanelElement.style.display = 'block';
        if (loaderButton) loaderButton.textContent = 'Hide Wilderness Panel';
        console.log("Wilderness Survival Panel Shown. Initializing wilderness game components...");

        // Initialize the wilderness integration if not already initialized
        if (!window.wildernessIntegration && scene && camera) {
            const contentArea = document.getElementById('wilderness-systems-content');
            if (contentArea) {
                try {
                    // Clear any existing content
                    contentArea.innerHTML = '';

                    // Add loading message
                    const loadingMessage = document.createElement('div');
                    loadingMessage.textContent = 'Loading Wilderness Survival Game...';
                    loadingMessage.style.textAlign = 'center';
                    loadingMessage.style.padding = '20px';
                    contentArea.appendChild(loadingMessage);

                    // Initialize the wilderness integration with a slight delay to show loading message
                    setTimeout(() => {
                        try {
                            // Remove loading message
                            contentArea.removeChild(loadingMessage);

                            // Initialize the wilderness integration
                            if (scene && camera) {
                                const integration = initWildernessIntegration(scene, camera, contentArea);

                                // Store the integration in the window object for access by the tool change handler
                                window.wildernessIntegration = integration;

                                console.log("Wilderness integration initialized and stored in window.wildernessIntegration");

                                // Dispatch an event to notify that the wilderness integration is ready
                                const event = new CustomEvent('wilderness-integration-ready', {
                                    detail: { integration }
                                });
                                document.dispatchEvent(event);
                            } else {
                                throw new Error("Scene or camera not available");
                            }
                        } catch (error: unknown) {
                            console.error("Failed to initialize wilderness integration:", error);

                            // Show error message
                            contentArea.innerHTML = '';
                            const errorMessage = document.createElement('div');
                            errorMessage.textContent = `Error loading Wilderness Survival Game: ${error instanceof Error ? error.message : String(error)}`;
                            errorMessage.style.color = '#fc8181';
                            errorMessage.style.textAlign = 'center';
                            errorMessage.style.padding = '20px';
                            contentArea.appendChild(errorMessage);
                        }
                    }, 500);
                } catch (error: unknown) {
                    console.error("Failed to initialize wilderness integration:", error instanceof Error ? error.message : String(error));
                }
            } else {
                console.error("Failed to find wilderness systems content area");
            }
        }
    } else {
        wildernessSurvivalPanelElement.style.display = 'none';
        if (loaderButton) loaderButton.textContent = 'Load Wilderness Survival Game';
        console.log("Wilderness Survival Panel Hidden.");
    }
}
// --- Wilderness Tool Change Handler ---
function wildernessToolChangeHandler(event: Event) {
    // Get the tool type from the event detail
    const customEvent = event as CustomEvent;
    const toolType = customEvent.detail?.toolType;

    if (!toolType) {
        console.warn("Wilderness tool change event received but no tool type provided");
        return;
    }

    console.log(`Wilderness tool changed to: ${toolType}`);

    // The brush parameters will be sent in a separate event by the wilderness integration
    // We don't need to do anything else here
}

/**
 * Show a status message to the user
 * @param message The message to show
 * @param duration The duration to show the message for (in milliseconds)
 */
function showStatusMessage(message: string, duration: number = 2000) {
    // Create a status message element if it doesn't exist
    let statusElement = document.getElementById('wilderness-status-message');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'wilderness-status-message';
        statusElement.style.position = 'fixed';
        statusElement.style.bottom = '20px';
        statusElement.style.left = '50%';
        statusElement.style.transform = 'translateX(-50%)';
        statusElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '10px 20px';
        statusElement.style.borderRadius = '5px';
        statusElement.style.fontWeight = 'bold';
        statusElement.style.zIndex = '1000';
        statusElement.style.pointerEvents = 'none';
        document.body.appendChild(statusElement);
    }

    // Update the message
    statusElement.textContent = message;
    statusElement.style.display = 'block';

    // Hide the message after the duration
    setTimeout(() => {
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }, duration);
}

/**
 * Handle eating food in the wilderness survival game
 */
function handleEatFood() {
    if (!window.wildernessIntegration?.hungerThirstSystem) {
        console.warn("Cannot eat food: Hunger/Thirst system not available");
        return;
    }

    // Check if we have food in the inventory
    if (window.wildernessIntegration.inventorySystem.hasItem('food', 1)) {
        // Remove food from inventory
        window.wildernessIntegration.inventorySystem.removeItem('food', 1);

        // Increase hunger level
        window.wildernessIntegration.hungerThirstSystem.eat(25);

        // Show a message
        showStatusMessage("You ate some food (+25 hunger)", 2000);

        console.log("Ate food: +25 hunger");
    } else {
        showStatusMessage("You don't have any food!", 2000);
        console.log("Cannot eat: No food in inventory");
    }
}

/**
 * Handle drinking water in the wilderness survival game
 */
function handleDrinkWater() {
    if (!window.wildernessIntegration?.hungerThirstSystem) {
        console.warn("Cannot drink water: Hunger/Thirst system not available");
        return;
    }

    // Check if we have water in the inventory
    if (window.wildernessIntegration.inventorySystem.hasItem('water', 1)) {
        // Remove water from inventory
        window.wildernessIntegration.inventorySystem.removeItem('water', 1);

        // Increase thirst level
        window.wildernessIntegration.hungerThirstSystem.drink(30);

        // Show a message
        showStatusMessage("You drank some water (+30 thirst)", 2000);

        console.log("Drank water: +30 thirst");
    } else {
        showStatusMessage("You don't have any water!", 2000);
        console.log("Cannot drink: No water in inventory");
    }
}

// --- Wilderness Brush Parameters Change Handler ---
function wildernessBrushParamsChangeHandler(event: Event) {
    // Get the brush parameters from the event detail
    const customEvent = event as CustomEvent;
    const brushParams = customEvent.detail?.brushParams;

    if (!brushParams) {
        console.warn("Wilderness brush params change event received but no parameters provided");
        return;
    }

    console.log(`Received brush parameters:`, brushParams);

    // Update the brush parameters
    editBrushRadius = brushParams.baseRadius * brushParams.radiusMultiplier;

    // Apply the tool's preferred shape
    editBrushShape = brushParams.preferredShape;

    // Apply verticality multiplier (divide by 5 to account for the 5x amplification)
    editBrushVerticality = brushParams.verticalityMultiplier / 5;

    // Apply strength multiplier
    editBrushStrength = 0.5 * brushParams.strengthMultiplier;

    // Update the brush visualizer to reflect the new parameters
    updateBrushVisualizer();

    // Update the UI controls to reflect the new parameters
    updateUIControls();

    console.log(`Updated brush parameters: radius=${editBrushRadius}, shape=${editBrushShape}, verticality=${editBrushVerticality}, strength=${editBrushStrength}`);
}

// --- Helper to Update UI Controls ---
function updateUIControls() {
    // Find the UI controls in the debug mining panel
    const radiusSlider = document.getElementById('slider-Brush_Size') as HTMLInputElement;
    const strengthSlider = document.getElementById('slider-Strength') as HTMLInputElement;
    const shapeDropdown = document.getElementById('dropdown-Brush_Shape') as HTMLSelectElement;
    const verticalitySlider = document.getElementById('slider-Verticality') as HTMLInputElement;

    // Update the radius slider
    if (radiusSlider) {
        radiusSlider.value = editBrushRadius.toString();
        // Also update the displayed value
        const valueDisplay = radiusSlider.nextElementSibling as HTMLElement;
        if (valueDisplay) {
            valueDisplay.textContent = editBrushRadius.toString();
        }
    }

    // Update the strength slider
    if (strengthSlider) {
        strengthSlider.value = editBrushStrength.toString();
        // Also update the displayed value
        const valueDisplay = strengthSlider.nextElementSibling as HTMLElement;
        if (valueDisplay) {
            valueDisplay.textContent = editBrushStrength.toString();
        }
    }

    // Update the shape dropdown
    if (shapeDropdown) {
        // Find the option with the matching value
        for (let i = 0; i < shapeDropdown.options.length; i++) {
            if (shapeDropdown.options[i].value === editBrushShape) {
                shapeDropdown.selectedIndex = i;
                break;
            }
        }
    }

    // Update the verticality slider
    if (verticalitySlider) {
        const verticalityValue = editBrushVerticality * 5; // Convert back to the UI scale
        verticalitySlider.value = verticalityValue.toString();
        // Also update the displayed value
        const valueDisplay = verticalitySlider.nextElementSibling as HTMLElement;
        if (valueDisplay) {
            valueDisplay.textContent = verticalityValue.toString();
        }
    }

    console.log(`IsolatedViewer: Updated UI controls to reflect tool parameters:
        - Radius: ${editBrushRadius}
        - Strength: ${editBrushStrength}
        - Shape: ${editBrushShape}
        - Verticality: ${editBrushVerticality * 5}
    `);
}

// --- End Wilderness Survival Panel Functions ---

// Helper function to ensure all HORIZONTAL neighbors are loaded
function ensureHorizontalNeighbors(cx: number, cy: number, cz: number): boolean {
    console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] Starting check for horizontal neighbors.`);
    
    // Only check horizontal neighbors (no vertical neighbors)
    const horizontalNeighbors = [
        {x: cx-1, y: cy, z: cz}, // -X
        {x: cx+1, y: cy, z: cz}, // +X
        {x: cx, y: cy, z: cz-1}, // -Z
        {x: cx, y: cy, z: cz+1}  // +Z
    ];
    
    // Ensure all horizontal neighbors have noise maps
    for (const neighbor of horizontalNeighbors) {
        const neighborKey = getChunkKeyY(neighbor.x, neighbor.y, neighbor.z);
        let neighborInfo = isolatedLoadedChunkData[neighborKey];
        
        if (!neighborInfo) {
            console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] Neighbor ${neighborKey} not in isolatedLoadedChunkData, creating entry.`);
            isolatedLoadedChunkData[neighborKey] = {
                noiseMap: null,
                lastAccessTime: Date.now()
            };
            neighborInfo = isolatedLoadedChunkData[neighborKey];
        }
        
        // Generate noise map if missing
        if (!neighborInfo.noiseMap) {
            console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] NoiseMap for neighbor ${neighborKey} is missing. Attempting to generate...`);
            neighborInfo.noiseMap = generateNoiseMap(neighbor.x, neighbor.y, neighbor.z, currentNoiseLayers, currentSeed);
            neighborInfo.lastAccessTime = Date.now();
            
            // If we couldn't generate a noise map, return false
            if (!neighborInfo.noiseMap) {
                console.error(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] FAILED to generate noiseMap for neighbor ${neighborKey}. Returning false.`);
                return false;
            } else {
                console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] SUCCESSFULLY generated noiseMap for neighbor ${neighborKey}.`);
            }
        } else {
            console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] NoiseMap for neighbor ${neighborKey} already exists.`);
        }
    }
    
    console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] All horizontal neighbors have noise maps. Returning true.`);
    return true;
}

// Helper function to generate a new chunk
async function generateNewChunk(x: number, y: number, z: number): Promise<NoiseMap> {
    if (!spacetimeWorker || !currentNoiseLayers || !currentSeed) {
        throw new Error('Missing required data for chunk generation');
    }

    const chunkKey = `${x},${y},${z}`;
    
    // Generate using worker
    const { results: genResults } = await spacetimeWorker.processBatch(
        'generate_' + Date.now(), // Unique batch ID
        [chunkKey],
        'generate',
        undefined,
        currentNoiseLayers,
        currentSeed
    );

    const generatedData = genResults.get(chunkKey);
    if (!generatedData) {
        throw new Error('Failed to generate chunk data');
    }

    // Save to SpacetimeDB
    spacetimeDB.saveTerrainChunk(chunkKey, generatedData);
    
    return generatedData;
}

// Helper function to get affected chunks
function getAffectedChunks(): string[] {
    const affectedKeys: string[] = [];
    // Implement logic to get affected chunk keys
    // This should return an array of chunk keys that were modified
    return affectedKeys;
}

// Helper function to get chunk noise map
function getChunkNoiseMap(x: number, y: number, z: number): NoiseMap | null {
    const chunkKey = `${x},${y},${z}`;
    return chunkDataMap.get(chunkKey) || null;
}

