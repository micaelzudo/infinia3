import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // For loading character model
import * as CANNON from 'cannon-es'; // Import cannon-es
// Assuming Sketchbook files are made available relative to this file's location
// Adjust these paths based on your actual project structure / tsconfig aliases
// import { Character } from '../../Sketchbook-master/src/ts/characters/Character';
// import { CameraOperator } from '../../Sketchbook-master/src/ts/core/CameraOperator';
// import { World as SketchbookWorld } from '../../Sketchbook-master/src/ts/world/World';
import { InputManager } from '../../Sketchbook-master/src/ts/core/InputManager';
// Import states if you plan to use Sketchbook's state machine for the character
// import { Idle } from '../../Sketchbook-master/src/ts/characters/character_states/Idle';

// Imports from your project (similar to isolatedFirstPerson.ts)
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'; // If needed for camera
import { disposeNode } from '../../disposeNode_debug';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';
import { getChunkKeyY } from '../../utils_debug';
import type { NoiseMap, NoiseLayers, Seed, Generate, LoadedChunks } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { initIsolatedWorkerPool, terminateIsolatedWorkerPool, requestChunkGeometry } from '../workers/isolatedWorkerPool';
import { addStandardChunkBoundaries, removeStandardChunkBoundaries } from './standardBoundaryVisualizer';

// SpacetimeDB multiplayer imports
import type { Vector3 as SpacetimeVector3, InputState as SpacetimeInputState } from '../multiplayer/SpacetimeDBContext';
import { useInfiniaMultiplayer, type InfiniaPlayerData } from '../multiplayer/InfiniaMultiplayerIntegration';

// Potentially your existing movement/collision system if you adapt Character.ts
import { 
    updatePlayerMovementAndCollision, 
    type PlayerPhysicsState, 
    type PlayerInputState,
    type ChunkMeshesRef
} from './playerMovement';
import { getActiveChunkMeshesForCollision } from './isolatedTerrainViewer';

// Sketchbook imports (Ensure these paths are correct or aliased in your tsconfig)
import { Character } from '../../Sketchbook-master/src/ts/characters/Character';
import { CameraOperator } from '../../Sketchbook-master/src/ts/core/CameraOperator';
import { World as SketchbookWorld } from '../../Sketchbook-master/src/ts/world/World';
// import { Idle } from '../../Sketchbook-master/src/ts/characters/character_states/Idle';
import boxmanModelURL from '../../Sketchbook-master/build/assets/boxman.glb?url'; // Import the model URL
import { GroundImpactData } from '../../Sketchbook-master/src/ts/characters/GroundImpactData'; // <<< ADDED IMPORT

// --- Minimal SketchbookWorld Adapter ---
class SketchbookWorldAdapter {
    public inputManager!: InputManager; // Definite assignment assertion, will be set in constructor
    public graphicsWorld: THREE.Scene;
    public renderer: { domElement: HTMLElement };
    public updatables: any[] = [];
    
    public cameraOperator: CameraOperator | null = null; 
    public player: Character | null = null;
    public camera: THREE.PerspectiveCamera | null = null; // <<< ADDED camera property

    public params: any = { 
        Pointer_Lock: true, 
        Mouse_Sensitivity: 1.0,
        Time_Scale: 1.0 
    };
    public physicsFrameTime: number = 1 / 60;
    public physicsMaxPrediction: number = 60;

    public physicsWorld = {
        remove: () => { console.log("[MockPhysicsWorld] remove() called for Character"); },
        addBody: () => { console.log("[MockPhysicsWorld] addBody() called for Character"); }
    };

    constructor(hostScene: THREE.Scene, hostRendererDomElement: HTMLElement, hostCamera: THREE.PerspectiveCamera) {
        this.graphicsWorld = hostScene;
        this.renderer = { domElement: hostRendererDomElement };
        this.camera = hostCamera; // <<< ASSIGN hostCamera
        try {
            this.inputManager = new InputManager(this as any, hostRendererDomElement); 
            console.log("SketchbookWorldAdapter: InputManager initialized.");
        } catch (e) {
            console.error("SketchbookWorldAdapter: FAILED to initialize InputManager:", e);
        }
    }

    public add(entity: any): void {
        if (entity instanceof THREE.Object3D) {
            this.graphicsWorld.add(entity);
        }
        if (entity instanceof Character) { 
            this.player = entity;
            entity.world = this as any; 
        }
        if (entity instanceof CameraOperator) { 
            this.cameraOperator = entity; 
            entity.world = this as any;
        }
        if (typeof entity.update === 'function') {
            this.registerUpdatable(entity);
        }
    }

    public remove(entity: any): void {
        if (entity instanceof THREE.Object3D) {
            this.graphicsWorld.remove(entity);
        }
        if (entity === this.player) {
            this.player = null;
        }
        if (entity === this.cameraOperator) {
            if (this.inputManager && this.inputManager.inputReceiver === this.cameraOperator) {
            }
            this.cameraOperator = null; 
        }
        if (typeof entity.update === 'function') {
            this.unregisterUpdatable(entity);
        }
    }

    public registerUpdatable(registree: any): void {
        if (!this.updatables.includes(registree)) { 
            this.updatables.push(registree);
            this.updatables.sort((a, b) => (a.updateOrder || 0) - (b.updateOrder || 0));
        }
    }

    public unregisterUpdatable(registree: any): void {
        const index = this.updatables.indexOf(registree);
        if (index > -1) {
            this.updatables.splice(index, 1);
        }
    }
    
    public update(timeStep: number, unscaledTimeStep: number): void {
        for (const updatable of this.updatables) {
            updatable.update(timeStep, unscaledTimeStep);
        }
    }

    // <<< ADDED STUB METHOD >>>
    public updateControls(controls: any): void {
        console.log("[SketchbookWorldAdapter] updateControls called. Controls data:", controls);
        // This method is a stub to prevent errors.
        // In the original SketchbookWorld, it updates UI elements with control information.
        // You can optionally implement UI updates here if needed for your application.
    }

    // <<< ADDED scrollTheTimeScale METHOD >>>
    public scrollTheTimeScale(value: number): void {
        console.log(`[SketchbookWorldAdapter] scrollTheTimeScale called with value: ${value}. Time scale not implemented in adapter.`);
        // You could adjust a time scale factor here if your game uses one
        // For now, it's just a log.
        // Example: this.params.Time_Scale += value * 0.1; 
        // Make sure this.params.Time_Scale is clamped if you implement it.
    }
    // <<< END ADDED METHOD >>>
}

// --- Module State ---
let isActive = false;
let mobileControlsContainer: HTMLElement | null = null;
let sceneRef: THREE.Scene | null = null;
let rendererRef: THREE.WebGLRenderer | null = null;
let characterRef: Character | null = null; 
let cameraOperatorRef: CameraOperator | null = null; 
let thirdPersonCamera: THREE.PerspectiveCamera | null = null; // Dedicated third-person camera
let sketchbookWorldAdapterInstance: SketchbookWorldAdapter | null = null;
let onExitCallback: (() => void) | null = null;
const clock = new THREE.Clock();

// --- NEW: State variables for dynamic chunk loading (mirrors isolatedFirstPerson.ts) ---
const TP_LOAD_CHUNK_RADIUS = 3; // Radius of chunks to load around the character (XZ plane)
const TP_VERTICAL_LOAD_RADIUS_BELOW = 1; // How many chunks to load below the character's Y level
const TP_VERTICAL_LOAD_RADIUS_ABOVE = 0; // How many chunks to load above (0 for now, can be increased)
const TP_LOAD_CHECK_INTERVAL = 0.2; // Interval to check for loading new chunks

let tpLoadedChunks: LoadedChunks = {}; // Holds NoiseMap, mesh ref, access time etc.
let tpChunkMeshes: ChunkMeshesRef = {};   // Direct map to THREE.Mesh for collision
let tpPendingRequests: Set<string> = new Set(); // Tracks chunks requested from workers

// Generation parameters (will be set during init)
let tpNoiseLayers: NoiseLayers | null = null;
let tpSeed: Seed | null = null;
let tpCompInfo: { topElements: TopElementsData | null } | null = null;
let tpNoiseScale: number | null = null;
let tpPlanetOffset: THREE.Vector3 | null = null;

// Loading cadence and triggers
let tpTimeSinceLastLoadCheck = 0;
let tpLastCharacterChunkX = 0;
let tpLastCharacterChunkY = 0; // Track Y for vertical loading decisions
let tpLastCharacterChunkZ = 0;
let tpForceChunkLoad = true; // Force initial load check

// For worker results
interface TPWorkerResultObject { // Similar to isolatedFirstPerson's WorkerResultObject
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    payload: { // New structure from isolatedWorkerPool
        positionBuffer: Float32Array | null;
        noiseMap: NoiseMap | null;
        // normalsBuffer?: Float32Array | null; // If worker sends these
    };
}

// --- Multiplayer State Variables ---
let multiplayerEnabled = false;
let infiniaMultiplayerAPI: any = null; // Will hold Infinia Multiplayer API when available
let localPlayerId: string | null = null;
let lastPlayerUpdateTime = 0;
const PLAYER_UPDATE_INTERVAL = 1000 / 20; // 20 FPS update rate for better performance
let remotePlayerMeshes: Map<string, THREE.Mesh> = new Map(); // Visual representations of other players
let lastSentPosition: THREE.Vector3 | null = null;
let lastSentRotation: THREE.Vector3 | null = null;
const POSITION_THRESHOLD = 0.1; // Minimum distance to trigger position update
const ROTATION_THRESHOLD = 0.05; // Minimum rotation change to trigger update
// --- END NEW ---

// State for custom player movement
let playerPhysicsState: PlayerPhysicsState | null = null;
const proxyCharacterObject = new THREE.Object3D(); // Used as a proxy for playerMovement camera

// For character model loading
const gltfLoader = new GLTFLoader();
// const CHARACTER_MODEL_PATH = '/assets/models/boxman.glb'; // Load from public directory - REMOVED

// --- Initialization Parameters ---
export interface InitIsolatedThirdPersonParams {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    // --- ADDED: Parameters for initial terrain state and generation ---
    initialLoadedChunks: LoadedChunks;
    initialChunkMeshes: ChunkMeshesRef;
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale: number;
    planetOffset: THREE.Vector3;
    // --- END ADDED ---
    
    // For Sketchbook's Character and World (if using its physics)
    // physicsWorld?: CANNON.World; // If you integrate Cannon.js

    // Character model path (optional, can be hardcoded or default)
    characterModelPath?: string;

    initialSpawnPosition?: THREE.Vector3;
    onExit: () => void;
    
    // --- Multiplayer Parameters ---
    enableMultiplayer?: boolean;
    infiniaMultiplayerAPI?: any; // Infinia Multiplayer API for multiplayer
    playerId?: string; // Local player ID
}

export function initIsolatedThirdPerson(params: InitIsolatedThirdPersonParams) {
    console.log("[TP LOG] initIsolatedThirdPerson CALLED with params:", params);
    console.log("Initializing Isolated Third Person mode...");
    isActive = true;
    sceneRef = params.scene;
    rendererRef = params.renderer;
    onExitCallback = params.onExit;
    // Calculate spawn position on terrain surface
    let spawnPos = params.initialSpawnPosition || new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 2, 0);
    
    // If we have terrain data, try to find the actual terrain height at spawn position
    if (params.initialChunkMeshes && Object.keys(params.initialChunkMeshes).length > 0) {
        const terrainHeight = findTerrainHeightAtPosition(spawnPos.x, spawnPos.z, params.initialChunkMeshes);
        if (terrainHeight !== null) {
            spawnPos.y = terrainHeight + 2; // Place character 2 units above terrain
            console.log(`[TP Init] Adjusted spawn position to terrain height: ${terrainHeight + 2}`);
        } else {
            console.warn(`[TP Init] Could not find terrain height at spawn position, using default height`);
        }
    } else {
        console.warn(`[TP Init] No initial chunk meshes available, will wait for terrain to load before final positioning`);
    }

    // --- Store generation parameters ---
    tpNoiseLayers = params.noiseLayers;
    tpSeed = params.seed;
    tpCompInfo = params.compInfo;
    tpNoiseScale = params.noiseScale;
    tpPlanetOffset = params.planetOffset;

    // --- Initialize with terrain from viewer ---
    tpLoadedChunks = params.initialLoadedChunks || {}; // Start with viewer's loaded chunks
    tpChunkMeshes = params.initialChunkMeshes || {};   // And their meshes
    tpPendingRequests.clear();
    tpForceChunkLoad = true;
    tpTimeSinceLastLoadCheck = TP_LOAD_CHECK_INTERVAL; // Ensure first check happens soon

    // --- Initialize multiplayer if enabled ---
    multiplayerEnabled = params.enableMultiplayer || false;
    infiniaMultiplayerAPI = params.infiniaMultiplayerAPI || (window as any).infiniaMultiplayer || null;
    localPlayerId = params.playerId || null;
    lastPlayerUpdateTime = 0;
    lastSentPosition = null;
    lastSentRotation = null;
    
    if (multiplayerEnabled && infiniaMultiplayerAPI) {
        console.log("[TP Init] Multiplayer enabled with player ID:", localPlayerId);
        // Initialize remote player tracking
        remotePlayerMeshes.clear();
        // Set up player update listeners
        setupMultiplayerListeners();
    } else {
        console.log("[TP Init] Multiplayer disabled or no Infinia Multiplayer API available");
        // Try to get API from global scope if not provided
        if (multiplayerEnabled && !infiniaMultiplayerAPI) {
            setTimeout(() => {
                infiniaMultiplayerAPI = (window as any).infiniaMultiplayer;
                if (infiniaMultiplayerAPI) {
                    console.log("[TP Init] Found Infinia Multiplayer API on retry");
                    setupMultiplayerListeners();
                }
            }, 1000);
        }
    }

    if (!rendererRef || !sceneRef) {
        console.error("Renderer or Scene not available for Isolated Third Person initialization.");
        if(onExitCallback) onExitCallback();
        return { camera: null }; 
    }

    const canvas = rendererRef.domElement;
    console.log("[TP Init] Using renderer DOM element for InputManager:", canvas);
    const aspect = canvas.clientWidth / canvas.clientHeight;
    thirdPersonCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
    console.log("[TP Init] Third person camera created.", thirdPersonCamera); // Log the camera itself

    try {
        // Pass the thirdPersonCamera to the adapter's constructor
        sketchbookWorldAdapterInstance = new SketchbookWorldAdapter(sceneRef, rendererRef.domElement, thirdPersonCamera);
        console.log("[TP Init] SketchbookWorldAdapter instantiated.");

        // Attach to window for other modules to access
        if (typeof window !== 'undefined') {
            window.sketchbookWorldAdapterInstance = sketchbookWorldAdapterInstance;
            console.log("[TP Init] SketchbookWorldAdapter attached to window object.");
        }

        // Disable InputManager's own pointer lock handling to simplify integration
        // if there are conflicts with the main application's pointer lock.
        if (sketchbookWorldAdapterInstance && sketchbookWorldAdapterInstance.params) {
            sketchbookWorldAdapterInstance.params.Pointer_Lock = false;
            console.log("[TP Init] SketchbookWorldAdapter Pointer_Lock set to false for InputManager.");
        }
        // Attempt to focus the canvas to help with input.
        if (rendererRef && rendererRef.domElement && typeof rendererRef.domElement.focus === 'function') {
            rendererRef.domElement.focus();
            console.log("[TP Init] Attempted to focus renderer DOM element.");
        }

        if (!sketchbookWorldAdapterInstance.inputManager) {
            console.error("[TP Init] CRITICAL: inputManager on adapter is NULL after adapter construction!");
        }
    } catch (e) {
        console.error("[TP Init] FAILED to instantiate SketchbookWorldAdapter:", e);
        if(onExitCallback) onExitCallback();
        return { camera: null };
    }

    console.log(`[TP Init] Attempting to load character model from: ${boxmanModelURL}`);

    playerPhysicsState = {
        yVelocity: 0,
        grounded: false
    };

    gltfLoader.load(
        boxmanModelURL,
        (gltf) => {
            console.log("[TP Init GLTF Callback] Character GLTF loaded successfully.");
            if (!sceneRef || !sketchbookWorldAdapterInstance || !thirdPersonCamera) {
                console.error("[TP Init GLTF Callback] Scene, WorldAdapter, or TP Camera not available when GLTF loaded.");
                if (onExitCallback) onExitCallback();
                return;
            }
            try {
                console.log("[TP Init GLTF Callback] Attempting to instantiate Character...");
                characterRef = new Character(gltf);
                console.log("[TP Init GLTF Callback] Sketchbook Character instantiated.", characterRef);

                console.log("[TP Init GLTF Callback] Assigning mock physics world to characterRef.world on adapter...");
                // Ensure adapter has a physicsWorld before Character uses it, even for setPhysicsEnabled(false)
                if (!(sketchbookWorldAdapterInstance as any).physicsWorld) {
                    console.warn("[TP Init GLTF Callback] Adapter's physicsWorld was missing, creating mock.");
                    (sketchbookWorldAdapterInstance as any).physicsWorld = { 
                        remove: () => { console.log("[MockPhysicsWorld GLTF] remove() called"); },
                        addBody: () => { console.log("[MockPhysicsWorld GLTF] addBody() called"); }
                    };
                }
                // Character needs its .world property set to the adapter BEFORE setPhysicsEnabled is called.
                // The adapter.add() method also does this, but setPhysicsEnabled might be called first by Character constructor or soon after.
                // Direct assignment here is safer if setPhysicsEnabled relies on it early.
                characterRef.world = sketchbookWorldAdapterInstance as any; 
                console.log("[TP Init GLTF Callback] characterRef.world assigned to adapter instance.");

                console.log("[TP Init GLTF Callback] Calling characterRef.setPhysicsEnabled(false)...");
                characterRef.setPhysicsEnabled(false); 
                console.log("[TP Init GLTF Callback] characterRef.setPhysicsEnabled(false) called.");

                console.log("[TP Init GLTF Callback] Adding characterRef to SketchbookWorldAdapter...");
                sketchbookWorldAdapterInstance.add(characterRef);
                console.log("[TP Init GLTF Callback] characterRef added to adapter. Adapter player:", sketchbookWorldAdapterInstance.player);

                characterRef.setPosition(spawnPos.x, spawnPos.y, spawnPos.z);
                console.log("[TP Init GLTF Callback] Character position set.");

                console.log("[TP Init GLTF Callback] Attempting to instantiate CameraOperator...");
                cameraOperatorRef = new CameraOperator(sketchbookWorldAdapterInstance as any, thirdPersonCamera as any);
                console.log("[TP Init GLTF Callback] CameraOperator instantiated.", cameraOperatorRef);

                console.log("[TP Init GLTF Callback] Adding cameraOperatorRef to SketchbookWorldAdapter...");
                sketchbookWorldAdapterInstance.add(cameraOperatorRef);
                console.log("[TP Init GLTF Callback] cameraOperatorRef added to adapter. Adapter cameraOperator:", sketchbookWorldAdapterInstance.cameraOperator);

                cameraOperatorRef.followMode = true; 
                if (characterRef) { 
                    cameraOperatorRef.target = characterRef.position; 
                }
                cameraOperatorRef.setRadius(5, true); 
                console.log("[TP Init GLTF Callback] CameraOperator configured.");

                if (sketchbookWorldAdapterInstance.inputManager) {
                    console.log("[TP Init GLTF Callback] InputManager exists on adapter. Current input receiver:", sketchbookWorldAdapterInstance.inputManager.inputReceiver?.constructor.name);
                    console.log("[TP Init GLTF Callback] Calling characterRef.takeControl()...");
                    characterRef.takeControl(); 
                    console.log("[TP Init GLTF Callback] characterRef.takeControl() called. New input receiver:", sketchbookWorldAdapterInstance.inputManager.inputReceiver?.constructor.name);
                } else {
                    console.error("[TP Init GLTF Callback] CRITICAL: inputManager is MISSING on adapter before takeControl()!");
                }

                // --- Preload Initial Chunks (now that character is loaded) ---
                if (characterRef && tpNoiseLayers && tpSeed) {
                    const initialCharChunkX = Math.floor(characterRef.position.x / CHUNK_SIZE);
                    const initialCharChunkY = Math.floor(characterRef.position.y / CHUNK_HEIGHT);
                    const initialCharChunkZ = Math.floor(characterRef.position.z / CHUNK_SIZE);

                    tpLastCharacterChunkX = initialCharChunkX;
                    tpLastCharacterChunkY = initialCharChunkY;
                    tpLastCharacterChunkZ = initialCharChunkZ;

                    console.log(`TP Mode: Preloading initial chunks around character at (${initialCharChunkX}, ${initialCharChunkY}, ${initialCharChunkZ})`);
                    const preloadRadius = 1;
                    for (let dy = -TP_VERTICAL_LOAD_RADIUS_BELOW; dy <= TP_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
                        for (let dx = -preloadRadius; dx <= preloadRadius; dx++) {
                            for (let dz = -preloadRadius; dz <= preloadRadius; dz++) {
                                const preloadX = initialCharChunkX + dx;
                                const preloadY = initialCharChunkY + dy;
                                const preloadZ = initialCharChunkZ + dz;
                                const chunkKey = getChunkKeyY(preloadX, preloadY, preloadZ);

                                if (!tpLoadedChunks[chunkKey] && !tpPendingRequests.has(chunkKey)) {
                                    console.log(`TP Mode: Pre-requesting ${chunkKey}`);
                                    tpLoadedChunks[chunkKey] = {
                                        mesh: null,
                                        noiseMap: null,
                                        lastAccessTime: Date.now()
                                    };
                                    if (requestChunkGeometry(preloadX, preloadY, preloadZ, tpNoiseLayers, tpSeed)) {
                                        tpPendingRequests.add(chunkKey);
                                    } else {
                                        console.error(`[TP Init Preload] Failed to post message to worker for chunk ${chunkKey}.`);
                                        delete tpLoadedChunks[chunkKey];
                                    }
                                }
                            }
                        }
                    }
                } else {
                    console.warn("TP Mode: Missing character or generation params for preloading.");
                }
                // --- End Preload ---

            } catch (e) {
                console.error("[TP Init GLTF Callback] Error during Character/CameraOperator instantiation or setup:", e);
                alert(`Failed to init character/camera: ${e instanceof Error ? e.message : String(e)}`);
                if (onExitCallback) onExitCallback();
            }
        },
        undefined, // onProgress callback (optional)
        (error) => {
            console.error('Error loading character GLTF:', boxmanModelURL, error); // UPDATED to use imported URL
            alert(`Failed to load character model from ${boxmanModelURL}. Check path and console.`); // UPDATED
            if (onExitCallback) onExitCallback();
        }
    );

    clock.start();
    console.log("Isolated Third Person mode initialization process started.");

    // --- Initialize Worker Pool ---
    if (!initIsolatedWorkerPool(handleTPWorkerResult)) { // Assuming a shared or new worker pool
        console.error("TP Mode: CRITICAL: Failed to initialize worker pool. Dynamic loading will be impaired.");
    }

    // --- Preloading moved to after character loading in GLTF callback ---

    // --- Add initial boundary visualization ---
    if (sceneRef) {
        addStandardChunkBoundaries(sceneRef, Object.keys(tpLoadedChunks));
    }

    // --- Custom logger initialization commented out to prevent auto-start ---
    // initCustomLogger('itp-custom-log-window');
    // appendToCustomLog('Custom Logger started after Isolated Third Person init', 'info', undefined, undefined, undefined, 'normal', 'isolatedThirdPerson.ts');

    // Initialize mobile controls if on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && typeof document !== 'undefined') {
      // Create container for mobile controls if it doesn't exist
      mobileControlsContainer = document.createElement('div');
      mobileControlsContainer.style.position = 'fixed';
      mobileControlsContainer.style.top = '0';
      mobileControlsContainer.style.left = '0';
      mobileControlsContainer.style.width = '100%';
      mobileControlsContainer.style.height = '100%';
      mobileControlsContainer.style.pointerEvents = 'none';
      mobileControlsContainer.style.zIndex = '1000';
      document.body.appendChild(mobileControlsContainer);

      // Import React and ReactDOM dynamically to avoid SSR issues
      import('react').then(React => {
        import('react-dom').then(ReactDOM => {
          import('./MobileControls').then(({ default: MobileControls }) => {
            const MobileControlsComponent = () => {
              // Handle movement input
              const handleMove = (direction: { x: number; y: number }) => {
                if (!characterRef) return;
                
                // Deadzone to prevent accidental movements
                const deadzone = 0.1;
                const moveX = Math.abs(direction.x) > deadzone ? direction.x : 0;
                const moveY = Math.abs(direction.y) > deadzone ? direction.y : 0;
                
                // Update character movement
                characterRef.actions['up']!.isPressed = moveY < -0.3;
                characterRef.actions['down']!.isPressed = moveY > 0.3;
                characterRef.actions['left']!.isPressed = moveX < -0.3;
                characterRef.actions['right']!.isPressed = moveX > 0.3;
                
                console.log(`Move: x=${moveX.toFixed(2)}, y=${moveY.toFixed(2)}`);
              };

              // Handle jump action with cooldown
              let canJump = true;
              const handleJump = () => {
                if (!characterRef || !canJump) return;
                
                characterRef.actions['jump']!.isPressed = true;
                canJump = false;
                
                // Auto-release jump after a short delay
                setTimeout(() => {
                  if (characterRef) {
                    characterRef.actions['jump']!.isPressed = false;
                  }
                }, 200);
                
                // Jump cooldown
                setTimeout(() => {
                  canJump = true;
                }, 500);
              };

              // Handle run toggle
              let isRunning = false;
              const handleRun = (runState: boolean) => {
                if (!characterRef) return;
                isRunning = runState;
                characterRef.actions['run']!.isPressed = runState;
                console.log(`Run ${runState ? 'enabled' : 'disabled'}`);
              };

              // Handle camera rotation
              const handleRotate = (delta: { x: number; y: number }) => {
                if (!sketchbookWorldAdapterInstance || !sketchbookWorldAdapterInstance.cameraOperator) {
                  console.warn('Camera operator not available for rotation');
                  return;
                }
                
                // Adjust sensitivity as needed
                const sensitivity = 0.005;
                const deltaX = delta.x * sensitivity;
                const deltaY = delta.y * sensitivity;
                
                try {
                  // Call camera operator's move method to rotate the camera
                  sketchbookWorldAdapterInstance.cameraOperator.move(deltaX, deltaY);
                  
                  // Update character rotation to match camera yaw if character exists
                  if (characterRef) {
                    characterRef.rotation.y = sketchbookWorldAdapterInstance.cameraOperator.target.y;
                  }
                } catch (error) {
                  console.error('Error during camera rotation:', error);
                }
              };

              // Handle exit button
              const handleExit = () => {
                console.log('Exit button pressed');
                if (onExitCallback) {
                  onExitCallback();
                }
              };

              // Create mobile controls with proper props
              return React.default.createElement(MobileControls, {
                onMove: handleMove,
                onRotate: handleRotate,
                onJump: handleJump,
                onRun: handleRun,
                onExit: handleExit,
                isRunning: false
              });
            };
            
            // Create root and render the component with error handling
            const renderControls = () => {
              try {
                // Modern React 18+ with createRoot
                if (ReactDOM.createRoot) {
                  const root = ReactDOM.createRoot(mobileControlsContainer!);
                  root.render(React.default.createElement(MobileControlsComponent));
                  return () => root.unmount();
                } 
                // Legacy React with render
                else if (ReactDOM.default && ReactDOM.default.render) {
                  ReactDOM.default.render(
                    React.default.createElement(MobileControlsComponent),
                    mobileControlsContainer
                  );
                  return () => {
                    ReactDOM.default.unmountComponentAtNode(mobileControlsContainer!);
                  };
                } else {
                  throw new Error('No supported ReactDOM render method found');
                }
              } catch (error) {
                console.error('Failed to render mobile controls:', error);
                // Show fallback UI or instructions
                if (mobileControlsContainer) {
                  mobileControlsContainer.innerHTML = `
                    <div style="
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%);
                      color: white;
                      text-align: center;
                      padding: 20px;
                      background: rgba(0,0,0,0.7);
                      border-radius: 10px;
                      max-width: 80%;
                    ">
                      <h3>Mobile Controls Unavailable</h3>
                      <p>Please use keyboard or gamepad controls instead.</p>
                    </div>
                  `;
                }
                return () => {};
              }
            };


            // Initial render
            const cleanup = renderControls();

            // Handle window resize for responsive controls
            const handleResize = () => {
              if (mobileControlsContainer) {
                // Force re-render on resize
                cleanup?.();
                renderControls();
              }
            };

            window.addEventListener('resize', handleResize);

            // Cleanup function
            return () => {
              window.removeEventListener('resize', handleResize);
              cleanup?.();
            };
          }).catch(error => {
            console.error('Error loading MobileControls:', error);
          });
        }).catch(error => {
          console.error('Error loading react-dom:', error);
        });
      }).catch(error => {
        console.error('Error loading react:', error);
      });
    }

    return { camera: thirdPersonCamera }; 
}



export function updateIsolatedThirdPerson() {
    console.log("[TP LOG] updateIsolatedThirdPerson CALLED");
    if (!isActive || !sketchbookWorldAdapterInstance || !characterRef || !playerPhysicsState) {
        console.log("[TP LOG] updateIsolatedThirdPerson returning early. isActive:", isActive, "adapter:", !!sketchbookWorldAdapterInstance, "char:", !!characterRef, "physicsState:", !!playerPhysicsState);
        return;
    }
    const delta = clock.getDelta();
    tpTimeSinceLastLoadCheck += delta;

    // 1. Get Chunk Meshes (NOW USES tpChunkMeshes)
    // const chunkMeshesForCollision: ChunkMeshesRef | null = getActiveChunkMeshesForCollision(); // OLD
    const chunkMeshesForCollision: ChunkMeshesRef = tpChunkMeshes; // NEW: Use locally managed meshes

    // 2. Prepare InputState for playerMovement.ts
    const inputState: PlayerInputState = {
        w: characterRef.actions['down']?.isPressed || false,  // S-key (character backward intent) for physics W input
        s: characterRef.actions['up']?.isPressed || false,    // W-key (character forward intent) for physics S input
        a: characterRef.actions['left']?.isPressed || false,  // A-key (character left intent) for physics A input
        d: characterRef.actions['right']?.isPressed || false, // D-key (character right intent) for physics D input
        space: characterRef.actions['jump']?.isPressed || false,
        shift: characterRef.actions['run']?.isPressed || false,
    };

    // 3. Sync proxy object with actual character's transform
    proxyCharacterObject.position.copy(characterRef.position as any); // Type cast
    proxyCharacterObject.quaternion.copy(characterRef.quaternion as any); // Type cast

    // 4. Call the custom collision and movement logic
    const newPhysicsState = updatePlayerMovementAndCollision(
        proxyCharacterObject as any as THREE.PerspectiveCamera, // Cast needed
        inputState,
        playerPhysicsState,
        delta,
        chunkMeshesForCollision 
        // debugRayGroup can be added if you have one in this scene
    );

    // 5. Apply results
    characterRef.position.copy(proxyCharacterObject.position as any); // Type cast // Position was updated on the proxy
    playerPhysicsState = newPhysicsState;

    // <<< TELL SKETCHBOOK CHARACTER ABOUT GROUNDED STATE >>>
    if (characterRef) {
        characterRef.rayHasHit = playerPhysicsState.grounded;

        if (playerPhysicsState.grounded) {
            if (!characterRef.groundImpactData) {
                characterRef.groundImpactData = new GroundImpactData();
            }
            // Set the velocity on impact. 
            // You might want to use the character's current yVelocity from playerPhysicsState 
            // or the character's full velocity vector if it makes sense for landing animations.
            characterRef.groundImpactData.velocity.copy(characterRef.velocity); 
            // Or, if you want to use the specific y-velocity at impact from your physics:
            // characterRef.groundImpactData.velocity.set(characterRef.velocity.x, playerPhysicsState.yVelocity, characterRef.velocity.z);
        }
        // The Character's internal state machine (e.g., in Falling.ts) will use characterRef.rayHasHit
        // during its own update (called via sketchbookWorldAdapterInstance.update) to transition states.
    }
    // <<< END OF GROUNDED STATE UPDATE >>>
    
    // *** ADDED: Initialize/Reset current orientation before updates ***
    if (characterRef) {
        const currentForward = new THREE.Vector3();
        characterRef.getWorldDirection(currentForward as any); // Get current forward direction of the Object3D
        // Manually copy components to avoid type mismatch between different THREE instances
        characterRef.orientation.x = currentForward.x;
        characterRef.orientation.y = currentForward.y;
        characterRef.orientation.z = currentForward.z;
    }
    // *** END ADDED ***

    // Update CameraOperator's target (if it's not already referencing characterRef.position directly)
    if (cameraOperatorRef && cameraOperatorRef.target !== characterRef.position) {
        cameraOperatorRef.target.copy(characterRef.position as any); // Type cast
    }
    
    // *** ADDED: Explicitly update CameraOperator first ***
    if (cameraOperatorRef && typeof cameraOperatorRef.update === 'function') {
        cameraOperatorRef.update(delta);
    }
    // *** END ADDED ***
    
    // *** ADDED: Ensure orientationTarget is set BEFORE state machine/rotation updates ***
    if (characterRef && cameraOperatorRef && thirdPersonCamera) {
        // Get camera's forward direction (assuming camera looks forward along -Z)
        const cameraDirection = new THREE.Vector3();
        thirdPersonCamera.getWorldDirection(cameraDirection);
        // Project onto XZ plane for horizontal orientation
        cameraDirection.y = 0;
        
        // Check length BEFORE normalizing
        if (cameraDirection.lengthSq() > 0.001) {
             cameraDirection.normalize(); // Normalize only if valid
             // Pass the actual Vector3 instance, using 'as any' for type compatibility
             characterRef.setOrientation(cameraDirection as any, false);
        }
        // If direction is near zero (looking straight down/up), don't update orientationTarget
    }
    // *** END REFINED ***

    // DEBUG: Log character actions, state, and grounded status
    if (characterRef && sketchbookWorldAdapterInstance && sketchbookWorldAdapterInstance.inputManager) {
        console.log("[TP Update Debug] Actions:", {
            up: characterRef.actions['up']?.isPressed,
            down: characterRef.actions['down']?.isPressed,
            left: characterRef.actions['left']?.isPressed,
            right: characterRef.actions['right']?.isPressed,
            run: characterRef.actions['run']?.isPressed,
            jump: characterRef.actions['jump']?.isPressed
        }, "Grounded (rayHasHit):", characterRef.rayHasHit, "Current State:", characterRef.charState?.constructor.name);
    }

    // SketchbookWorldAdapter's update loop (original call)
    // This will update animations (mixer.update) and other character logic if needed.
    sketchbookWorldAdapterInstance.update(delta, delta);

    // Force a call to character inputReceiverUpdate to ensure viewVector is calculated with latest positions.
    // This is important for Character.ts to establish its internal viewVector correctly.
    if (characterRef && sketchbookWorldAdapterInstance.inputManager && sketchbookWorldAdapterInstance.inputManager.inputReceiver === characterRef)
    {
        (characterRef as any).inputReceiverUpdate(delta);
    }

    // *** REMOVE PREVIOUS SAFEGUARD IF IT EXISTS, REPLACE WITH THIS ***
    if (characterRef) {
        // 1. Ensure characterRef.orientation is a valid, Sketchbook-scoped Vector3
        //    representing the character's current *actual* orientation.
        const tempWorldDir = new THREE.Vector3(); // Our project's THREE
        characterRef.getWorldDirection(tempWorldDir as any); // Cast to satisfy argument type
        characterRef.setOrientation(tempWorldDir as any, true); // true = instant, updates .orientation

        // 2. Ensure characterRef.orientationTarget is a valid, Sketchbook-scoped Vector3
        //    representing the desired camera-based orientation.
        if (cameraOperatorRef && thirdPersonCamera) {
            const tempCameraDir = new THREE.Vector3(); // Our project's THREE
            thirdPersonCamera.getWorldDirection(tempCameraDir as any); // Cast
            tempCameraDir.y = 0;
            if (tempCameraDir.lengthSq() > 0.001) {
                tempCameraDir.normalize();
                characterRef.setOrientation(tempCameraDir as any, false); // false = only updates .orientationTarget
            } else {
                // Fallback for target: use current actual orientation if camera dir is zero
                characterRef.setOrientation(tempWorldDir as any, false);
            }
        } else {
            // Fallback for target if no camera: use current actual orientation
            characterRef.setOrientation(tempWorldDir as any, false);
        }
    }
    // *** END OF NEW INITIALIZATION BLOCK ***

    // *** ADD DIAGNOSTIC LOGGING ***
    if (characterRef) {
        console.log("[TP Update Pre-SpringRotation] Orientation:", 
            characterRef.orientation ? JSON.stringify(characterRef.orientation) : 'undefined',
            "Is Vector3:", characterRef.orientation instanceof THREE.Vector3
        );
        console.log("[TP Update Pre-SpringRotation] OrientationTarget:", 
            characterRef.orientationTarget ? JSON.stringify(characterRef.orientationTarget) : 'undefined',
            "Is Vector3:", characterRef.orientationTarget instanceof THREE.Vector3
        );
    }
    // *** END DIAGNOSTIC LOGGING ***

    // *** Manual orientation update for when Sketchbook PHYSICS IS OFF ***
    if (characterRef) {
        (characterRef as any).springRotation(delta); // Simulate the rotation spring
        (characterRef as any).rotateModel();      // Apply the orientation to the model
    }

    // CameraOperator update (original call - might be redundant if already in adapter.update)
    // if (cameraOperatorRef && typeof cameraOperatorRef.update === 'function') {
    //     cameraOperatorRef.update(delta); 
    // }

    // --- Multiplayer Synchronization ---
    if (multiplayerEnabled && spacetimeDBContext && characterRef) {
        handleMultiplayerSync(delta);
    }
    
    // --- NEW: Dynamic Chunk Loading Loop ---
    if (characterRef && (tpTimeSinceLastLoadCheck >= TP_LOAD_CHECK_INTERVAL || tpForceChunkLoad)) {
        tpTimeSinceLastLoadCheck = 0;
        tpForceChunkLoad = false;
        // Restore updating of last character chunk reference
        const charX = characterRef.position.x;
        const charY = characterRef.position.y;
        const charZ = characterRef.position.z;
        const charChunkX = Math.floor(charX / CHUNK_SIZE);
        const charChunkY = Math.floor(charY / CHUNK_HEIGHT);
        const charChunkZ = Math.floor(charZ / CHUNK_SIZE);
        tpLastCharacterChunkX = charChunkX;
        tpLastCharacterChunkY = charChunkY;
        tpLastCharacterChunkZ = charChunkZ;
        loadChunksAroundPlayer(
            characterRef.position as unknown as THREE.Vector3,
            {
                tpLoadedChunks,
                tpChunkMeshes,
                tpPendingRequests,
                tpNoiseLayers: tpNoiseLayers!,
                tpSeed: tpSeed!,
                tpCompInfo: tpCompInfo!,
                tpNoiseScale: tpNoiseScale!,
                tpPlanetOffset: tpPlanetOffset!,
                TP_LOAD_CHUNK_RADIUS,
                TP_VERTICAL_LOAD_RADIUS_BELOW,
                TP_VERTICAL_LOAD_RADIUS_ABOVE,
                MAX_CHUNK_GEN_PER_FRAME: 2,
                requestChunkGeometry,
                sceneRef: sceneRef!,
                generateLocalMesh: (x: number, y: number, z: number) => generateLocalMesh(x, y, z, {
                    tpLoadedChunks,
                    tpChunkMeshes,
                    tpNoiseLayers: tpNoiseLayers!,
                    tpSeed: tpSeed!,
                    tpCompInfo: tpCompInfo!,
                    tpNoiseScale: tpNoiseScale!,
                    tpPlanetOffset: tpPlanetOffset!,
                    sceneRef: sceneRef!,
                }),
                addStandardChunkBoundaries,
            }
        );
    }
    // --- END Dynamic Chunk Loading Loop ---
}

export function cleanupIsolatedThirdPerson() {
    console.log("Cleaning up Isolated Third Person mode...");
    if (!isActive) return;
    isActive = false;
    clock.stop();

    // --- Terminate Worker Pool ---
    if (typeof terminateIsolatedWorkerPool === 'function') {
        terminateIsolatedWorkerPool();
    }
    if (tpPendingRequests && typeof tpPendingRequests.clear === 'function') {
        tpPendingRequests.clear();
    }
    // --- End Worker Pool Termination ---


    // Clean up character and camera
    if (characterRef && sketchbookWorldAdapterInstance) {
        sketchbookWorldAdapterInstance.remove(characterRef);
    }
    characterRef = null;
    
    if (cameraOperatorRef && sketchbookWorldAdapterInstance && typeof cameraOperatorRef.update === 'function') {
        sketchbookWorldAdapterInstance.unregisterUpdatable(cameraOperatorRef);
    }

    // Clean up mobile controls
    if (mobileControlsContainer && mobileControlsContainer.parentNode) {
        mobileControlsContainer.parentNode.removeChild(mobileControlsContainer);
        mobileControlsContainer = null;
    }

    // Remove from window object
    if (typeof window !== 'undefined') {
        window.sketchbookWorldAdapterInstance = undefined;
        console.log("[TP Cleanup] SketchbookWorldAdapter removed from window object.");
    }

    // Clean up references
    sketchbookWorldAdapterInstance = null; 
    thirdPersonCamera = null;
    sceneRef = null;
    rendererRef = null;
    onExitCallback = null;

    // --- Clear dynamically loaded terrain ---
    if (sceneRef) {
        for (const key in tpChunkMeshes) {
            const mesh = tpChunkMeshes[key];
            if (mesh) {
                disposeNode(sceneRef, mesh);
                sceneRef?.remove(mesh);
            }
            // if (chunkData.physicsBody) physicsWorldRef?.removeBody(chunkData.physicsBody);
        }
        tpChunkMeshes = {};
        tpLoadedChunks = {};
        tpPendingRequests.clear();
    }
    tpLoadedChunks = {};
    tpChunkMeshes = {};
    tpPendingRequests.clear();

    // Reset state variables
    characterRef = null;
    cameraOperatorRef = null;
    sketchbookWorldAdapterInstance = null;
    sceneRef = null;
    rendererRef = null;
    isActive = false;
    tpForceChunkLoad = true; 

    // Multiplayer cleanup (conceptual)
    if (multiplayerApiRef) {
        multiplayerApiRef.disconnect();
    }
    multiplayerIntegrationRef = null;
    multiplayerApiRef = null;
    localPlayerDataRef = null;
    remotePlayersDataRef.clear();

    if (onExitCallback) {
        onExitCallback();
        onExitCallback = null;
    }
    console.log('[IsolatedThirdPerson] Cleaned up successfully.');
}

// --- Placeholder Input Handlers (to be integrated with your system or Sketchbook's InputManager) ---

// --- Getters (Optional) ---
export function isIsolatedThirdPersonActive(): boolean {
    return isActive;
}

export function getIsolatedThirdPersonCamera(): THREE.PerspectiveCamera | null {
    return thirdPersonCamera;
}

export function getIsolatedThirdPersonPlanetData() {
    return {
        compInfo: tpCompInfo,
        planetOffset: tpPlanetOffset,
        seed: tpSeed,
        noiseScale: tpNoiseScale,
        planetType: 'earth' // You can make this dynamic if needed
    };
}

// --- NEW: Worker Result Handler ---
function handleTPWorkerResult(data: TPWorkerResultObject) {
    handleWorkerResult(data, {
        tpLoadedChunks,
        tpChunkMeshes,
        tpPendingRequests,
        tpCompInfo: tpCompInfo!,
        tpNoiseScale: tpNoiseScale!,
        tpPlanetOffset: tpPlanetOffset!,
        sceneRef: sceneRef!,
        generateLocalMesh: (x: number, y: number, z: number) => generateLocalMesh(x, y, z, {
            tpLoadedChunks,
            tpChunkMeshes,
            tpNoiseLayers: tpNoiseLayers!,
            tpSeed: tpSeed!,
            tpCompInfo: tpCompInfo!,
            tpNoiseScale: tpNoiseScale!,
            tpPlanetOffset: tpPlanetOffset!,
            sceneRef: sceneRef!,
        }),
    });
}

// --- NEW: Local Mesh Generation (adapted from isolatedFirstPerson.ts) ---
function generateTPLocalMesh(cx: number, cy: number, cz: number) {
    console.log(`[TP LOG] generateTPLocalMesh CALLED for ${cx},${cy},${cz}`);
    if (!tpLoadedChunks || !tpChunkMeshes || !sceneRef || !tpNoiseLayers || !tpSeed || !tpCompInfo || tpNoiseScale === null || !tpPlanetOffset) {
        console.error(`TP Mode: Cannot generate mesh for ${cx},${cy},${cz}. Missing essential references.`);
        return false;
    }

    const chunkKey = getChunkKeyY(cx, cy, cz);
    console.log(`TP Mode: Attempting local mesh generation for ${chunkKey}`);

    const currentChunkData = tpLoadedChunks[chunkKey];
    const noiseMapToUse = currentChunkData?.noiseMap;

    if (!noiseMapToUse) {
        console.warn(`TP Mode: Noise map for ${chunkKey} not available. Cannot generate mesh.`);
        // Potentially try to generate it synchronously if it's critical and wasn't worker-generated
        // For now, we assume worker or prior sync generation handled it.
        return false;
    }

    // Helper to get/generate neighbor noise maps (only horizontal for now)
    const getTPNeighborNoiseMap = (nx: number, ny: number, nz: number): NoiseMap | null => {
        const neighborKey = getChunkKeyY(nx, ny, nz);
        if (tpLoadedChunks[neighborKey]?.noiseMap) {
            return tpLoadedChunks[neighborKey].noiseMap;
        }
        // Synchronously generate if missing (for horizontal stitching)
        console.log(`TP Mode: Synchronously generating missing neighbor noise map for ${neighborKey} (needed by ${chunkKey})`);
        const generatedMap = generateNoiseMap(nx, ny, nz, tpNoiseLayers!, tpSeed!);
        if (!tpLoadedChunks[neighborKey]) {
            tpLoadedChunks[neighborKey] = { noiseMap: null, mesh: null, lastAccessTime: Date.now() };
        }
        tpLoadedChunks[neighborKey].noiseMap = generatedMap;
        tpLoadedChunks[neighborKey].lastAccessTime = Date.now();
        return generatedMap;
    };

    const noiseMapXNeg = getTPNeighborNoiseMap(cx - 1, cy, cz);
    const noiseMapXPos = getTPNeighborNoiseMap(cx + 1, cy, cz);
    const noiseMapZNeg = getTPNeighborNoiseMap(cx, cy, cz - 1);
    const noiseMapZPos = getTPNeighborNoiseMap(cx, cy, cz + 1);
    // For simplicity, we'll assume vertical neighbors are handled by overlapping noise maps or not strictly needed for visual continuity
    // This matches the current isolatedFirstPerson.ts simplified approach for generateLocalMesh neighbors.

    const neighborFlags = {
        neighborXPosExists: !!noiseMapXPos,
        neighborXNegExists: !!noiseMapXNeg,
        neighborZPosExists: !!noiseMapZPos,
        neighborZNegExists: !!noiseMapZNeg,
        neighborYPosExists: true, // Assume for now, or get from a chunk above/below if needed
        neighborYNegExists: true, // Assume for now
        playerEditMaskXPos: null, playerEditMaskXNeg: null, playerEditMaskZPos: null,
        playerEditMaskZNeg: null, playerEditMaskYPos: null, playerEditMaskYNeg: null
    };

    try {
        // Dispose old mesh if it exists
        if (tpChunkMeshes[chunkKey]) {
            console.log(`TP Mode: Disposing old mesh for ${chunkKey}`);
            disposeNode(sceneRef, tpChunkMeshes[chunkKey]!);
            tpChunkMeshes[chunkKey] = null;
            if (tpLoadedChunks[chunkKey]) tpLoadedChunks[chunkKey].mesh = null;
        }

        const generateOpts: Generate = { noiseMap: noiseMapToUse };
        const geometry = generateMeshVertices(
            cx, cy, cz,
            generateOpts,
            true, // interpolate
            null, null, // noiseMapBelow, noiseMapAbove (can be enhanced later)
            noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
            neighborFlags
        );

        if (!geometry || geometry.getAttribute('position').count === 0) {
            console.error(`TP Mode: Generated empty geometry for ${chunkKey}.`);
            return false;
        }

        const material = createUnifiedPlanetMaterial(
            tpCompInfo!.topElements,
            tpNoiseScale!,
            tpPlanetOffset!
        );
        material.side = THREE.DoubleSide;

        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = `tp_chunk_${chunkKey}`;
        sceneRef.add(newMesh);

        tpChunkMeshes[chunkKey] = newMesh;
        console.log(`[TP Mesh] Added: ${newMesh.name}, Position:`, newMesh.position.toArray().join(', '));

        if (tpLoadedChunks[chunkKey]) {
            tpLoadedChunks[chunkKey].mesh = newMesh;
            tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
        } else {
            // Should ideally not happen if placeholder was added
            tpLoadedChunks[chunkKey] = { mesh: newMesh, noiseMap: noiseMapToUse, lastAccessTime: Date.now() };
        }
        console.log(`TP Mode: Successfully generated and added mesh for ${chunkKey}`);
        return true;

    } catch (error) {
        console.error(`TP Mode: Error generating mesh for ${chunkKey}:`, error);
        // Ensure cleanup if error occurs
        if (tpChunkMeshes[chunkKey]) {
            disposeNode(sceneRef, tpChunkMeshes[chunkKey]!);
            tpChunkMeshes[chunkKey] = null;
        }
        if (tpLoadedChunks[chunkKey]) {
            tpLoadedChunks[chunkKey].mesh = null;
        }
        return false;
    }
}
// --- END NEW ---

// --- Multiplayer Functions ---
function setupMultiplayerListeners() {
    if (!infiniaMultiplayerAPI) return;
    
    console.log("[TP Multiplayer] Setting up multiplayer listeners");
    
    // Set up periodic check for remote players
    const checkRemotePlayers = () => {
        if (!infiniaMultiplayerAPI || !isActive) return;
        
        const remotePlayers = infiniaMultiplayerAPI.getRemotePlayers?.() || [];
        
        // Update existing remote players
        remotePlayers.forEach((player: InfiniaPlayerData) => {
            updateRemotePlayer(player.identity, player);
        });
        
        // Remove players that are no longer in the list
        const currentPlayerIds = new Set(remotePlayers.map((p: InfiniaPlayerData) => p.identity));
        for (const [playerId] of remotePlayerMeshes) {
            if (!currentPlayerIds.has(playerId)) {
                removeRemotePlayer(playerId);
            }
        }
    };
    
    // Check for remote players every 100ms
    const remotePlayerInterval = setInterval(checkRemotePlayers, 100);
    
    // Store interval for cleanup
    (window as any).tpRemotePlayerInterval = remotePlayerInterval;
}

function handleMultiplayerSync(delta: number) {
    if (!multiplayerEnabled || !infiniaMultiplayerAPI || !characterRef || (thirdPersonMultiplayerIntegration && thirdPersonMultiplayerIntegration.isEnabled())) return;
    
    const currentTime = Date.now();
    
    // Send player updates at regular intervals
    if (currentTime - lastPlayerUpdateTime >= PLAYER_UPDATE_INTERVAL) {
        sendPlayerUpdate();
        lastPlayerUpdateTime = currentTime;
    }
    
    // Remote players are handled by the setupMultiplayerListeners interval
}

function sendPlayerUpdate() {
    if (!characterRef || !infiniaMultiplayerAPI) return;
    
    const position = characterRef.position as THREE.Vector3;
    const rotation = characterRef.rotation as THREE.Euler;
    
    // Check if position or rotation changed significantly
    const positionChanged = !lastSentPosition || position.distanceTo(lastSentPosition) > POSITION_THRESHOLD;
    const rotationChanged = !lastSentRotation || 
        Math.abs(rotation.x - (lastSentRotation.x || 0)) > ROTATION_THRESHOLD ||
        Math.abs(rotation.y - (lastSentRotation.y || 0)) > ROTATION_THRESHOLD ||
        Math.abs(rotation.z - (lastSentRotation.z || 0)) > ROTATION_THRESHOLD;
    
    if (positionChanged || rotationChanged) {
        // Get current input state from character
        const inputState = {
            w: characterRef.actions['down']?.isPressed || false,
            s: characterRef.actions['up']?.isPressed || false,
            a: characterRef.actions['left']?.isPressed || false,
            d: characterRef.actions['right']?.isPressed || false,
            space: characterRef.actions['jump']?.isPressed || false,
            shift: characterRef.actions['run']?.isPressed || false,
            mouseX: 0, // TODO: Get actual mouse movement
            mouseY: 0,
            leftClick: false, // TODO: Get actual mouse state
            rightClick: false
        };
        
        // Send through Infinia Multiplayer API
        if (infiniaMultiplayerAPI.sendPlayerInput) {
            infiniaMultiplayerAPI.sendPlayerInput(inputState);
        }
        
        // Update last sent values
        lastSentPosition = position.clone();
        lastSentRotation = new THREE.Vector3(rotation.x, rotation.y, rotation.z);
        
        console.log("[TP Multiplayer] Sent player input:", inputState);
    }
}

function updateRemotePlayers() {
    // This function would be called by the SpacetimeDB context
    // when receiving updates from other players
    // For now, it's a placeholder that manages the visual representation
    // of remote players based on data received through the context
    
    // Example: Update remote player meshes based on received data
    // This would typically be called from the SpacetimeDB context
    // when processing incoming player_update messages
}

function updateRemotePlayer(playerId: string, playerData: InfiniaPlayerData) {
    // Keep this for the old system if SpacetimeDB isn't active
    if (!sceneRef || playerId === localPlayerId || (thirdPersonMultiplayerIntegration && thirdPersonMultiplayerIntegration.isEnabled())) return;
    
    let playerMesh = remotePlayerMeshes.get(playerId);
    
    if (!playerMesh) {
        // Create a simple representation for remote players
        const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        playerMesh = new THREE.Mesh(geometry, material);
        playerMesh.name = `remote_player_${playerId}`;
        
        // Add a name label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = 256;
        canvas.height = 64;
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'white';
        context.font = '24px Arial';
        context.textAlign = 'center';
        context.fillText(playerData.username || playerId.slice(0, 8), canvas.width / 2, 40);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ map: texture });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(0, 1.2, 0);
        label.scale.set(2, 0.5, 1);
        playerMesh.add(label);
        
        sceneRef.add(playerMesh);
        remotePlayerMeshes.set(playerId, playerMesh);
        console.log("[TP Multiplayer] Created remote player mesh for:", playerData.username || playerId);
    }
    
    // Update position and rotation with smooth interpolation
    if (playerData.position) {
        const targetPosition = new THREE.Vector3(playerData.position.x, playerData.position.y, playerData.position.z);
        playerMesh.position.lerp(targetPosition, 0.1); // Smooth interpolation
    }
    if (playerData.rotation) {
        const targetRotation = new THREE.Euler(playerData.rotation.x, playerData.rotation.y, playerData.rotation.z);
        playerMesh.rotation.x = THREE.MathUtils.lerp(playerMesh.rotation.x, targetRotation.x, 0.1);
        playerMesh.rotation.y = THREE.MathUtils.lerp(playerMesh.rotation.y, targetRotation.y, 0.1);
        playerMesh.rotation.z = THREE.MathUtils.lerp(playerMesh.rotation.z, targetRotation.z, 0.1);
    }
}

function removeRemotePlayer(playerId: string) {
    // Keep this for the old system if SpacetimeDB isn't active
    if (thirdPersonMultiplayerIntegration && thirdPersonMultiplayerIntegration.isEnabled()) return;
    
    const playerMesh = remotePlayerMeshes.get(playerId);
    if (playerMesh && sceneRef) {
        sceneRef.remove(playerMesh);
        playerMesh.geometry.dispose();
        if (playerMesh.material instanceof THREE.Material) {
            playerMesh.material.dispose();
        }
        remotePlayerMeshes.delete(playerId);
        console.log("[TP Multiplayer] Removed remote player:", playerId);
    }
}

// --- Terrain Height Finding Function ---
function findTerrainHeightAtPosition(x: number, z: number, chunkMeshes: { [key: string]: THREE.Mesh }): number | null {
    // Use raycasting to find the terrain height at the given x, z position
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(x, CHUNK_HEIGHT * 2, z); // Start from high above
    const direction = new THREE.Vector3(0, -1, 0); // Point downward
    
    raycaster.set(origin, direction);
    
    // Collect all terrain meshes for raycasting
    const terrainMeshes: THREE.Mesh[] = [];
    for (const chunkKey in chunkMeshes) {
        const chunkMesh = chunkMeshes[chunkKey];
        if (chunkMesh && chunkMesh instanceof THREE.Mesh) {
            terrainMeshes.push(chunkMesh);
        }
    }
    
    if (terrainMeshes.length === 0) {
        console.warn('[findTerrainHeight] No terrain meshes available for raycasting');
        return null;
    }
    
    // Perform raycast
    const intersections = raycaster.intersectObjects(terrainMeshes, false);
    
    if (intersections.length > 0) {
        // Return the highest intersection point (closest to the ray origin)
        const highestIntersection = intersections[0];
        console.log(`[findTerrainHeight] Found terrain at height: ${highestIntersection.point.y}`);
        return highestIntersection.point.y;
    }
    
    console.warn(`[findTerrainHeight] No terrain intersection found at position (${x}, ${z})`);
    return null;
}

// Export multiplayer functions for external use
export { updateRemotePlayer, removeRemotePlayer };
// --- END Multiplayer Functions ---

// --- Wrapper function for MultiplayerPanelLoader compatibility ---
export async function initIsolatedThirdPersonView(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    console.log('[TP View] initIsolatedThirdPersonView called with:', { scene, camera, renderer });
    
    // Get terrain data from isolatedTerrainViewer if available
    const terrainViewer = (window as any).isolatedTerrainViewer;
    if (!terrainViewer) {
        console.error('[TP View] isolatedTerrainViewer not found on window object');
        return;
    }
    
    // Import terrain generation parameters from core module
    let noiseLayers, seed, compInfo, noiseScale, planetOffset;
    try {
        const coreModule = await import('./isolatedTerrainViewer/core');
        noiseLayers = coreModule.getCurrentNoiseLayers();
        seed = coreModule.getCurrentSeed();
        compInfo = coreModule.getCurrentCompInfo();
        noiseScale = coreModule.getCurrentNoiseScale();
        planetOffset = coreModule.getCurrentPlanetOffset();
        
        console.log('[TP View] Retrieved generation parameters:', {
            noiseLayers: noiseLayers?.length,
            seed,
            compInfo,
            noiseScale,
            planetOffset
        });
    } catch (error) {
        console.error('[TP View] Failed to import core module:', error);
        return;
    }
    
    // Get loaded chunks and meshes from terrain viewer
    const loadedChunks = terrainViewer.getLoadedChunks ? terrainViewer.getLoadedChunks() : {};
    const chunkMeshes = terrainViewer.getChunkMeshes ? terrainViewer.getChunkMeshes() : {};
    
    console.log('[TP View] Retrieved terrain data:', {
        loadedChunksCount: Object.keys(loadedChunks).length,
        chunkMeshesCount: Object.keys(chunkMeshes).length
    });
    
    // Initialize third person mode with terrain data
    const params: InitIsolatedThirdPersonParams = {
        scene,
        camera,
        renderer,
        onExit: () => {
            console.log('[TP View] Third person mode exited');
            // Additional cleanup if needed
        },
        initialLoadedChunks: loadedChunks,
        initialChunkMeshes: chunkMeshes,
        noiseLayers,
        seed,
        compInfo,
        noiseScale,
        planetOffset,
        enableMultiplayer: false // Can be made configurable
    };
    
    initIsolatedThirdPerson(params);
}

// Need to import lodash for _.remove in unregisterUpdatable
import _ from 'lodash';

import {
  loadChunksAroundPlayer,
  handleWorkerResult,
  generateLocalMesh
} from './chunkLoaderUtils';

import { appendToCustomLog, initCustomLogger } from './customLogger'; // Import custom logger