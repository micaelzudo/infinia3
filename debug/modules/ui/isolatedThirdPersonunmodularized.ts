import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // For loading character model
import * as CANNON from 'cannon-es'; // Import cannon-es
import CannonDebugger from 'cannon-es-debugger';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Character as OriginalCharacterForOverride } from '../../Sketchbook-master/src/ts/characters/Character'; // Corrected Alias for base class
import { CollisionGroups } from '../../Sketchbook-master/src/ts/enums/CollisionGroups'; // Path to Sketchbook's enum
import { ICharacterState } from '../../Sketchbook-master/src/ts/interfaces/ICharacterState'; // For setState typing
import { Idle } from '../../Sketchbook-master/src/ts/characters/character_states/Idle'; // For default state
import { Falling } from '../../Sketchbook-master/src/ts/characters/character_states/Falling'; // For falling state
import { Jump } from '../../Sketchbook-master/src/ts/characters/character_states/Jump'; // For jump state
import { Walk } from '../../Sketchbook-master/src/ts/characters/character_states/Walk'; // For walk state
import { DropIdle } from '../../Sketchbook-master/src/ts/characters/character_states/DropIdle'; // Import DropIdle
import { TrimeshCollider } from '../../Sketchbook-master/src/ts/physics/colliders/TrimeshCollider';
import { StartWalkForward } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkForward';
import { EndWalk } from '../../Sketchbook-master/src/ts/characters/character_states/EndWalk';
import { StartWalkRight } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkRight';
import { StartWalkLeft } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkLeft';
import { Sprint } from '../../Sketchbook-master/src/ts/characters/character_states/Sprint'; // Import Sprint state for run transitions

// Assuming Sketchbook files are made available relative to this file's location
// Adjust these paths based on your actual project structure / tsconfig aliases
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
import { logThrottled } from '../../logThrottler'; // Import the throttler
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'; // Import BufferGeometryUtils

// Potentially your existing movement/collision system if you adapt Character.ts
import { 
    updatePlayerMovementAndCollision, 
    type PlayerPhysicsState, 
    type PlayerInputState,
    type ChunkMeshesRef
} from './playerMovement';
import { getActiveChunkMeshesForCollision } from './isolatedTerrainViewer';

// Import from the centralized Sketchbook bridge
import {
    Character as SketchbookCharacter_Engine,
    CameraOperator,
    InputManager,
    GroundImpactData,
    initializeCharacter,
    configureCharacterPhysics
} from './sketchbookImports';

// Direct import of the original Character for stricter typing in overrides

// --- NEW YUKA IMPORTS ---
import { IsolatedYukaCharacter } from '../ai/isolatedYukaCharacter'; 
import { yukaEntityManager, yukaTime } from '../ai/yukaManager'; 
// --- END NEW YUKA IMPORTS ---

// Import our animation fix
import { fixCharacterAnimations, fixAnimationUpdate } from '../../../src/modules/player/character/fixAnimations';
import { patchCharacterAnimations, patchIsolatedThirdPerson } from './fixes/animationPatcher';
import { appendToCustomLog, initCustomLogger } from './customLogger'; // ADD THIS IMPORT

// --- CUSTOM LOG WINDOW START --- (This entire block from line 67 to 175 will be removed)
// let customLogContainer: HTMLElement | null = null;
// ...
// export function appendToCustomLog(...) { ... }
// ...
// --- CUSTOM LOG WINDOW END ---

// Path assuming boxman.glb is in public/assets/boxman.glb
const boxmanModelURL = '/assets/boxman.glb'; // Adjusted path for serving directly from public/assets

// --- NEW Debug Visualization Variables ---
let currentChunkPhysicsDebugMesh: THREE.Mesh | null = null;
let characterPhysicsDebugMeshes: THREE.Mesh[] = [];
// --- END Debug Visualization Variables ---

// Define SketchbookWorldAdapter class here (before it's used)
class SketchbookWorldAdapter {
    // @ts-ignore - Namespace as type error
    public inputManager!: InputManager;
    public graphicsWorld: THREE.Scene;
    public renderer: { domElement: HTMLElement };
    public updatables: any[] = [];
    // @ts-ignore - Namespace as type error
    public cameraOperator: CameraOperator | null = null; // Reference to the CameraOperator
    // @ts-ignore - Namespace as type error
    // @ts-ignore - Suppress namespace error
    public player: AdaptedSketchbookCharacter_Engine | null = null; // Reference to the Character (use local extended class)
    public camera: THREE.PerspectiveCamera | null = null; // Reference to the main third person camera
    public physicsFrameRate: number = 60; // Added based on Sketchbook's World.ts

    public params: any = { 
        Pointer_Lock: true, // Set to true to enable pointer lock for better controls
        Mouse_Sensitivity: 1.0,
        Time_Scale: 1.0 
    };
    
    // Improved physics world with proper mock implementations
    public physicsWorld: CANNON.World; // Declare type, initialize in constructor
    /* public physicsWorld: any = { // Changed to any to resolve type mismatch temporarily
        remove: (body?: any) => { },
        addBody: (body?: any) => { },
        step: (timeStep: number, oldTimeStep?: number, maxSubSteps?: number) => {  },
        gravity: new THREE.Vector3(0, -9.81, 0), 
        raycastClosest: () => ({ hasHit: false }) 
    }; */

    // Add additional required properties for Sketchbook compatibility
    public characters: any[] = [];
    public vehicles: any[] = [];
    public paths: any[] = [];
    public scenarios: any[] = [];
    
    // Track if the adapter has been patched
    private _isPatched: boolean = false;

    constructor(scene: THREE.Scene, rendererElement: HTMLElement, cameraRef: THREE.PerspectiveCamera) {
        this.graphicsWorld = scene;
        this.renderer = { domElement: rendererElement };
        this.camera = cameraRef; // Store the camera reference
        appendToCustomLog("[SketchbookWorldAdapter Constructor] Initial cameraOperator state: " + (this.cameraOperator === null ? "null" : "exists"), 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
        
        // Explicitly initialize and configure the physics world
        this.physicsWorld = new CANNON.World(); 
        this.physicsWorld.gravity.set(0, -20, 0); // Example: Set stronger gravity
        this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
        this.physicsWorld.allowSleep = true;

        appendToCustomLog("[SketchbookWorldAdapter] Initialized and configured a REAL CANNON.World instance in constructor. Gravity: " + JSON.stringify(this.physicsWorld.gravity), 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
        
        try {
            // The InputManager in Sketchbook takes the world (adapter in this case) and the domElement
            this.inputManager = new InputManager(this as any, rendererElement);
            appendToCustomLog("[SketchbookWorldAdapter] InputManager initialized successfully", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
        } catch (e) {
            appendToCustomLog("SketchbookWorldAdapter: FAILED to initialize InputManager: " + (e as Error).message, 'error', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            // Create a minimal mock InputManager if the real one fails
            this.inputManager = {
                setInputReceiver: (receiver: any) => {
                    appendToCustomLog("[MockInputManager] setInputReceiver: " + (receiver?.constructor?.name || "null"), 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                    this.inputManager.inputReceiver = receiver;
                },
                inputReceiver: null,
                update: () => { /* Mock update */ }
            } as any;
        }
    }

    public add(entity: any): void {
        if (entity.isObject3D) { // Check if it's a THREE.Object3D or derived
            this.graphicsWorld.add(entity);
        }
        // Special handling for Character and CameraOperator to set references
                 // @ts-ignore - Suppress namespace error
        if (entity instanceof AdaptedSketchbookCharacter_Engine) { // Check against the locally defined class
            const characterEntity = entity; // No cast needed now, type is correctly inferred
            this.player = characterEntity;
            characterEntity.world = this as any; // Character expects a world reference
            appendToCustomLog(`[Adapter] Assigned SketchbookWorldAdapter as .world to character ID: ${characterEntity.debugId}`, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            
            // Add to characters array for Sketchbook compatibility
            if (this.characters.indexOf(characterEntity) === -1) {
                this.characters.push(characterEntity);
            }

            // Explicitly call addToWorld or manually add body
            if (typeof characterEntity.addToWorld === 'function') {
                appendToCustomLog("[Adapter] Calling entity.addToWorld() for character ID: " + characterEntity.debugId, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                characterEntity.addToWorld(this as any); // 'this' is the SketchbookWorldAdapter, cast to any for World type
            } else if (this.physicsWorld && characterEntity.characterCapsule?.body) {
                appendToCustomLog("[Adapter] entity.addToWorld() not found. Manually adding character capsule body to physics world for char ID: " + characterEntity.debugId, 'warn', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                this.physicsWorld.addBody(characterEntity.characterCapsule.body);
            } else {
                appendToCustomLog("[Adapter] Could not add character physics body: addToWorld missing or no physicsWorld/body for char ID: " + characterEntity.debugId, 'error', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            }
        }
                 // @ts-ignore - Suppress namespace error
        if (entity instanceof CameraOperator) { 
            this.cameraOperator = entity; 
            entity.world = this as any; // CameraOperator also expects a world reference
        }
        if (typeof entity.update === 'function') {
            this.registerUpdatable(entity);
        }
    }

    public remove(entity: any): void {
        if (entity.isObject3D) {
            this.graphicsWorld.remove(entity);
        }
        if (entity === this.player) {
            this.player = null;
            
            // Remove from characters array
            const index = this.characters.indexOf(entity);
            if (index > -1) {
                this.characters.splice(index, 1);
            }
        }
        if (entity === this.cameraOperator) {
            this.cameraOperator = null; 
        }
        if (typeof entity.update === 'function') {
            this.unregisterUpdatable(entity);
        }
    }

    public registerUpdatable(entity: any): void {
        if (this.updatables.indexOf(entity) === -1) {
            this.updatables.push(entity);
        }
    }

    public unregisterUpdatable(entity: any): void {
        const index = this.updatables.indexOf(entity);
        if (index > -1) {
            this.updatables.splice(index, 1);
        }
    }
    
    // This update method will be called from updateIsolatedThirdPerson
    public update(timeStep: number, unscaledTimeStep?: number): void {
        appendToCustomLog("[SKBAdapter.update] Called.", 'log', 'SKBA_update_called', 1000, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts'); // CHANGED from 'critical'

        // Apply time scaling from params
        const scaledTimeStep = timeStep * this.params.Time_Scale;
        const finalUnscaledTimeStep = unscaledTimeStep || timeStep;
        
        try {
            // Update input manager first to handle user actions
        if (this.inputManager && typeof this.inputManager.update === 'function') {
                this.inputManager.update(scaledTimeStep, finalUnscaledTimeStep);
            }

            // --- DIAGNOSTIC LOGS FOR PHYSICS STEP --- 
            if (this.player && this.player.characterCapsule && this.player.characterCapsule.body) {
                const charBody = this.player.characterCapsule.body as any; // body is CANNON.Body
                const listenerOwner = charBody; // Listeners are directly on the body object in cannon-es
                const preStepListenersCount = listenerOwner.listeners && listenerOwner.listeners.preStep ? listenerOwner.listeners.preStep.length : 0;
                const postStepListenersCount = listenerOwner.listeners && listenerOwner.listeners.postStep ? listenerOwner.listeners.postStep.length : 0;
                
                appendToCustomLog(
                    `[SKBAdapter.update PRE-PHYSICS_STEP] ` +
                    `Char Body ID: ${charBody.id}, ` +
                    `In World: ${!!charBody.world}, ` +
                    `World Bodies: ${this.physicsWorld.bodies.length}, ` +
                    `preStep Listeners: ${preStepListenersCount}, ` +
                    `postStep Listeners: ${postStepListenersCount}, ` +
                    `Body SleepState: ${charBody.sleepState}`, 
                    'log',
                    'SKBA_pre_phys_step', // throttle key
                    1000, // throttle ms
                    undefined, // typeThrottleMs
                    'normal' // CHANGED from 'critical'
                );

                if (charBody.world !== this.physicsWorld) {
                    appendToCustomLog(
                        `[SKBAdapter.update PRE-PHYSICS_STEP] WARNING: Char Body ID ${charBody.id} world instance MISMATCH! ` +
                        `Body associated with a world: ${!!charBody.world}, Adapter physicsWorld exists: ${!!this.physicsWorld}`, 
                        'warn',
                        'SKBA_world_mismatch', // throttle key
                        1000, // throttle ms
                        undefined,
                        'normal' // CHANGED from 'critical'
                    );
                }
            } else {
                appendToCustomLog("[SKBAdapter.update PRE-PHYSICS_STEP] Character, its capsule, or its body not found for diagnostics.", 'warn', 'SKBA_pre_char_missing', 1000, undefined, 'normal'); // CHANGED from 'critical'
            }
            // --- END DIAGNOSTIC --- 

            // Manually call preStep for the character body if it exists and has the method
            if (this.physicsWorld && this.player && this.player.characterCapsule && this.player.characterCapsule.body) {
                const charBody = this.player.characterCapsule.body as any;
                if (charBody.isCharacterBody && typeof charBody.preStep === 'function') {
                    appendToCustomLog(`[SKBAdapter.update] Manually calling preStep for Char Body ID: ${charBody.id}`, 'log', 'SKBA_manual_preStep', 1000, undefined, 'normal'); // CHANGED from 'critical'
                    charBody.preStep();
                }
            }

            // Update physics world
            if (this.physicsWorld) {
                this.physicsWorld.step(1/60, scaledTimeStep, 3); // Fixed physics timestep
            } else {
                appendToCustomLog("[SKBAdapter.update] ERROR: this.physicsWorld is null, cannot step physics!", 'error', 'SKBA_no_phys_world', 1000, undefined, 'critical'); // Keep critical
            }

            // Manually call postStep for the character body if it exists and has the method
            if (this.physicsWorld && this.player && this.player.characterCapsule && this.player.characterCapsule.body) {
                const charBody = this.player.characterCapsule.body as any;
                if (charBody.isCharacterBody && typeof charBody.postStep === 'function') {
                    appendToCustomLog(`[SKBAdapter.update] Manually calling postStep for Char Body ID: ${charBody.id}`, 'log', 'SKBA_manual_postStep', 1000, undefined, 'normal'); // CHANGED from 'critical'
                    charBody.postStep();
                }
            }

            // --- DIAGNOSTIC LOGS FOR PHYSICS STEP --- 
             if (this.player && this.player.characterCapsule && this.player.characterCapsule.body) {
                const charBody = this.player.characterCapsule.body as any; // body is CANNON.Body
                appendToCustomLog(
                    `[SKBAdapter.update POST-PHYSICS_STEP] ` +
                    `Char Body ID: ${charBody.id}, ` +
                    `Position: (${charBody.position.x.toFixed(2)}, ${charBody.position.y.toFixed(2)}, ${charBody.position.z.toFixed(2)}), ` +
                    `Velocity Y: ${charBody.velocity.y.toFixed(2)}`, 
                    'log',
                    'SKBA_post_phys_step', // throttle key
                    1000, // throttle ms
                    undefined, // typeThrottleMs
                    'normal' // CHANGED from 'critical'
                );
            } else {
                appendToCustomLog("[SKBAdapter.update POST-PHYSICS_STEP] Character, its capsule, or its body not found for diagnostics.", 'warn', 'SKBA_post_char_missing', 1000, undefined, 'normal'); // CHANGED from 'critical'
            }
            // --- END DIAGNOSTIC --- 

            // Update all registered updatables
            for (const updatable of this.updatables) {
                if (updatable && typeof updatable.update === 'function') {
                    try {
                        updatable.update(scaledTimeStep, finalUnscaledTimeStep);
                    } catch (err) {
                        appendToCustomLog(`[SketchbookWorldAdapter] Error updating ${updatable.constructor?.name}: ${(err as Error).message}`, 'error', `SKBA_updatable_err_${updatable.constructor?.name}`, 1000, undefined, 'critical');
                    }
                }
            }
        } catch (err) {
            appendToCustomLog("[SketchbookWorldAdapter] Error in update: " + (err as Error).message, 'error', 'SKBA_main_update_err', 1000, undefined, 'critical');
        }
    }

    public updateControls(controls: any[]): void {
        // This method is called by Character.inputReceiverInit
        // In a full Sketchbook setup, this would pass controls to a UIManager.
        // For isolated mode, we can probably leave this as a stub.
        // console.log("[SketchbookWorldAdapter] updateControls called with:", controls);
    }

    scrollTheTimeScale(timeScale: number): void {
        logThrottled("SKADAPT_SCROLL_TIME", 1000, `[SketchbookWorldAdapter] scrollTheTimeScale called with: ${timeScale}`);
        // Adjust time scale within reasonable bounds
        this.params.Time_Scale = Math.max(0.1, Math.min(2.0, this.params.Time_Scale + timeScale * 0.1));
        appendToCustomLog(`[SketchbookWorldAdapter] Time scale set to: ${this.params.Time_Scale.toFixed(2)}`, 'info', 'SKBA_timescale_set', 1000, undefined, 'critical'); // Throttle this log
    }
    
    // Helper to enable/disable pointer lock
    public setPointerLock(enabled: boolean): void {
        this.params.Pointer_Lock = enabled;
        appendToCustomLog(`[SketchbookWorldAdapter] Pointer lock ${enabled ? 'enabled' : 'disabled'}`);
    }
}
// End SketchbookWorldAdapter class

// --- NEW YUKA CONTROLLER REF ---
let isolatedYukaController: IsolatedYukaCharacter | null = null;
// --- END NEW YUKA CONTROLLER REF ---

// --- State variables for dynamic chunk loading (mirrors isolatedFirstPerson.ts) ---
// These are the SOLE declarations for these chunk loading variables
const TP_LOAD_CHUNK_RADIUS = 3; 
const TP_VERTICAL_LOAD_RADIUS_BELOW = 1; 
const TP_VERTICAL_LOAD_RADIUS_ABOVE = 0; 
const TP_LOAD_CHECK_INTERVAL = 0.2; 

let tpLoadedChunks: LoadedChunks = {}; 
let tpChunkMeshes: ChunkMeshesRef = {};   
let tpPendingRequests: Set<string> = new Set(); 

let tpNoiseLayers: NoiseLayers | null = null;
let tpSeed: Seed | null = null;
let tpCompInfo: { topElements: TopElementsData | null } | null = null;
let tpNoiseScale: number | null = null;
let tpPlanetOffset: THREE.Vector3 | null = null;

let tpTimeSinceLastLoadCheck = 0;
let tpLastCharacterChunkX = 0;
let tpLastCharacterChunkY = 0; 
let tpLastCharacterChunkZ = 0;
let tpForceChunkLoad = true; 

interface TPWorkerResultObject { 
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    payload: { 
        positionBuffer: Float32Array | null;
        noiseMap: NoiseMap | null;
    };
}
// --- END State variables for dynamic chunk loading ---

let playerPhysicsState: PlayerPhysicsState | null = null;
const proxyCharacterObject = new THREE.Object3D(); 
const gltfLoader = new GLTFLoader();

export interface InitIsolatedThirdPersonParams {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    initialLoadedChunks: LoadedChunks;
    initialChunkMeshes: ChunkMeshesRef;
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale: number;
    planetOffset: THREE.Vector3;
    characterModelPath?: string;
    initialSpawnPosition?: THREE.Vector3;
    onExit: () => void;
}

// --- MODULE-LEVEL STATE DECLARATIONS for Third Person Mode Logic ---
let isActive: boolean = false;
// @ts-ignore - Namespace as type error
let sceneRef: THREE.Scene | null = null;
// @ts-ignore - Namespace as type error
let rendererRef: THREE.WebGLRenderer | null = null;
// Change the type of characterRef to the local AdaptedSketchbookCharacter_Engine class
let characterRef: AdaptedSketchbookCharacter_Engine | null = null; 
// @ts-ignore - Namespace as type error
// @ts-ignore - Suppress namespace error
let cameraOperatorRef: CameraOperator | null = null; 
let thirdPersonCamera: THREE.PerspectiveCamera | null = null;
let onExitCallback: (() => void) | null = null;
const clock = new THREE.Clock();
let sketchbookAdapterInstance: SketchbookWorldAdapter | null = null;
// Remove tpPhysicsWorld from here, adapter will manage its own.
// let tpPhysicsWorld: CANNON.World | null = null; 
let tpPhysicsMaterials: { [key: string]: CANNON.Material } | null = null;
// --- END MODULE-LEVEL STATE ---

let logWindowContainerElement: HTMLElement | null = null; // MOVED TO MODULE SCOPE

export function initIsolatedThirdPerson(params: InitIsolatedThirdPersonParams): { camera: THREE.PerspectiveCamera } | null {
    // --- CUSTOM LOG WINDOW INIT ---
    // logWindowContainerElement is now module-scoped, so no need to re-declare with let.
    logWindowContainerElement = document.getElementById('itp-custom-log-window');

    if (!logWindowContainerElement) {
        logWindowContainerElement = document.createElement('div');
        logWindowContainerElement.id = 'itp-custom-log-window';
        logWindowContainerElement.style.position = 'fixed';
        logWindowContainerElement.style.bottom = '10px';
        logWindowContainerElement.style.left = '10px';
        logWindowContainerElement.style.width = '480px'; 
        logWindowContainerElement.style.height = '280px'; 
        logWindowContainerElement.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
        logWindowContainerElement.style.fontFamily = '"Consolas", "Lucida Console", Monaco, monospace';
        logWindowContainerElement.style.fontSize = '12px';
        logWindowContainerElement.style.zIndex = '20000'; 
        logWindowContainerElement.style.display = 'flex';
        logWindowContainerElement.style.flexDirection = 'column';
        logWindowContainerElement.style.border = '1px solid #555';
        logWindowContainerElement.style.borderRadius = '5px';
        logWindowContainerElement.style.boxShadow = '0 2px 15px rgba(0,0,0,0.6)';

        const logHeader = document.createElement('div');
        logHeader.style.fontWeight = 'bold';
        logHeader.style.color = '#76b6f0'; 
        logHeader.style.backgroundColor = 'rgba(40, 40, 40, 0.95)';
        logHeader.style.padding = '6px 8px';
        logHeader.style.borderBottom = '1px solid #555';
        logHeader.style.cursor = 'move'; 
        logHeader.style.display = 'flex'; 
        logHeader.style.justifyContent = 'space-between'; 
        logHeader.style.alignItems = 'center'; 

        const logTitle = document.createElement('span');
        logTitle.textContent = 'ITP Debug Log';
        logHeader.appendChild(logTitle);

        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copy';
        copyButton.style.backgroundColor = '#555';
        copyButton.style.color = '#eee';
        copyButton.style.border = '1px solid #777';
        copyButton.style.borderRadius = '3px';
        copyButton.style.padding = '2px 6px';
        copyButton.style.fontSize = '10px';
        copyButton.style.cursor = 'pointer';
        copyButton.onclick = () => {
            // Get text from the content div managed by customLogger
            const loggerContentDiv = logWindowContainerElement?.querySelector(':scope > div:nth-child(2)');
            if (loggerContentDiv) {
                const logText = loggerContentDiv.textContent || '';
                navigator.clipboard.writeText(logText)
                    .then(() => appendToCustomLog('[Log Window] Copied to clipboard.', 'info'))
                    .catch(err => appendToCustomLog('[Log Window] Failed to copy: ' + err, 'error'));
            }
        };
        logHeader.appendChild(copyButton);

        logWindowContainerElement.appendChild(logHeader);

        // The logger will find/manage this div itself after initCustomLogger is called.
        const logContentElement = document.createElement('div');
        logContentElement.style.flexGrow = '1';
        logContentElement.style.overflowY = 'scroll';
        logContentElement.style.padding = '8px';
        logWindowContainerElement.appendChild(logContentElement); 

        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.bottom = '0px';
        resizeHandle.style.right = '0px';
        resizeHandle.style.width = '12px';
        resizeHandle.style.height = '12px';
        resizeHandle.style.backgroundColor = '#555';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.borderTopLeftRadius = '4px';
        logWindowContainerElement.appendChild(resizeHandle);

        document.body.appendChild(logWindowContainerElement);
        // Pass the created container element to these functions
        makeLogWindowDraggable(logWindowContainerElement, logHeader);
        makeLogWindowResizable(logWindowContainerElement, resizeHandle);

        initCustomLogger('itp-custom-log-window'); 
    } else {
        initCustomLogger('itp-custom-log-window'); 
    }
    // --- END CUSTOM LOG WINDOW INIT ---

    appendToCustomLog("!!!!!!!!!!!!!!!!!!!! initIsolatedThirdPerson HAS STARTED !!!!!!!!!!!!!!!!!!!!!", 'error', undefined, undefined, undefined, 'critical');
    appendToCustomLog("[InitITP] Initializing Isolated Third Person Mode...", 'log', undefined, undefined, undefined, 'critical');
    appendToCustomLog("[InitITP] Received param keys: " + JSON.stringify(Object.keys(params)), 'log', undefined, undefined, undefined, 'critical');

    if (isActive) {
        appendToCustomLog("[InitITP] Isolated third person mode is already active. Aborting initialization.", 'warn', undefined, undefined, undefined, 'critical');
        return null;
    }
    isActive = true; // Use module-level isActive
    sceneRef = params.scene;
    rendererRef = params.renderer;
    onExitCallback = params.onExit;
    let spawnPos = params.initialSpawnPosition;
    if (!spawnPos) {
        // Default spawn logic if not provided - ensure it's above typical ground
        // Assuming CHUNK_HEIGHT is around 60-64, CHUNK_HEIGHT / 2 is 30-32.
        // If terrain top is ~30.5, we need center Y to be at least 31.0 for a 0.5 bottom offset.
        const defaultCenterY = (CHUNK_HEIGHT / 2) + 0.5 + 0.1; // 0.5 for capsule bottom, 0.1 buffer
        spawnPos = new THREE.Vector3(0, defaultCenterY, 5); // Default Z to 5 for visibility
        appendToCustomLog(`[InitITP] No initialSpawnPosition provided. Defaulting spawn to: (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)}) based on CHUNK_HEIGHT=${CHUNK_HEIGHT}`, 'info', undefined, undefined, undefined, 'critical');
    } else {
        // If a spawn position is provided, check its Y value. 
        // If it's at the problematic Y=30 from logs, adjust it upwards.
        // This is a targeted fix for the observed log behavior.
        // A more robust solution would be to raycast downwards from a high point at spawn (later enhancement).
        if (Math.abs(spawnPos.y - 30.0) < 0.1) { // Check if Y is very close to 30.0
            const correctedY = 31.1; // Expected terrain top (30.5) + capsule bottom offset (0.5) + buffer (0.1)
            appendToCustomLog(`[InitITP] initialSpawnPosition Y detected near 30.0 (${spawnPos.y.toFixed(2)}). Correcting to ${correctedY} to ensure character is above ground (expected ground ~30.5).`, 'warn', undefined, undefined, undefined, 'critical');
            spawnPos = new THREE.Vector3(spawnPos.x, correctedY, spawnPos.z);
        } else {
            appendToCustomLog(`[InitITP] Using provided initialSpawnPosition: (${spawnPos.x.toFixed(2)}, ${spawnPos.y.toFixed(2)}, ${spawnPos.z.toFixed(2)})`, 'info', undefined, undefined, undefined, 'critical');
        }
    }
    
    // Create and return the camera immediately so the caller has access to it
    // This avoids the "Failed to initialize third person mode" error
    const aspectRatio = window.innerWidth / window.innerHeight;
    thirdPersonCamera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    thirdPersonCamera.position.set(spawnPos.x, spawnPos.y + 2, spawnPos.z + 5);
    thirdPersonCamera.lookAt(spawnPos);
    sceneRef.add(thirdPersonCamera); // Add camera to the main scene

    // Ensure the camera's matrices are up-to-date before character relies on it for orientation
    thirdPersonCamera.updateMatrixWorld(true); 

    appendToCustomLog("[TP] Third person camera initialized and added to scene.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');

    tpNoiseLayers = params.noiseLayers;
    tpSeed = params.seed;
    tpCompInfo = params.compInfo;
    tpNoiseScale = params.noiseScale;
    tpPlanetOffset = params.planetOffset;

    tpLoadedChunks = params.initialLoadedChunks || {}; 
    tpChunkMeshes = params.initialChunkMeshes || {};   
    
    // Create adapter for Sketchbook character - this will initialize its own physics world.
    // Ensure sceneRef and rendererRef are valid before creating the adapter.
    if (!sceneRef || !rendererRef) {
        appendToCustomLog("[InitITP] Scene or Renderer is null. Cannot create SketchbookWorldAdapter.", 'error');
        isActive = false; // Abort initialization
        return null;
    }
    sketchbookAdapterInstance = new SketchbookWorldAdapter(sceneRef, rendererRef.domElement, thirdPersonCamera);
    appendToCustomLog("[InitITP] SketchbookWorldAdapter created. Its physicsWorld exists: " + !!sketchbookAdapterInstance.physicsWorld, 'log', undefined, undefined, undefined, 'critical');

    
    // Define physics materials with error handling
    try {
        tpPhysicsMaterials = {
            default: new CANNON.Material('default'),
            character: new CANNON.Material('character'),
            terrain: new CANNON.Material('terrain')
        };
        
        // Only configure material interactions if adapter's physics world and materials exist
        if (sketchbookAdapterInstance && sketchbookAdapterInstance.physicsWorld && tpPhysicsMaterials) {
            // Configure material interactions on the adapter's physics world
            const worldForMaterials = sketchbookAdapterInstance.physicsWorld;

            const defaultGroundContact = new CANNON.ContactMaterial(
                tpPhysicsMaterials.default,
                tpPhysicsMaterials.terrain,
                {
                    friction: 0.3,
                    restitution: 0.3,
                    contactEquationStiffness: 1e8,
                    contactEquationRelaxation: 3
                }
            );
            
            const characterGroundContact = new CANNON.ContactMaterial(
                tpPhysicsMaterials.character,
                tpPhysicsMaterials.terrain,
                {
                    friction: 0.0, // Changed from 0.8 to 0.0
                    restitution: 0.0,
                    contactEquationStiffness: 1e8,
                    contactEquationRelaxation: 3
                }
            );
            
            worldForMaterials.addContactMaterial(defaultGroundContact);
            worldForMaterials.addContactMaterial(characterGroundContact);
            appendToCustomLog("[TP] Physics materials and contacts configured on adapter's physics world", 'log', undefined, undefined, undefined, 'critical');
                        } else {
            appendToCustomLog("[TP] Cannot configure material interactions - missing adapter physics world or materials", 'error', undefined, undefined, undefined, 'critical');
        }
    } catch (error) {
        appendToCustomLog("[TP] Error setting up physics materials: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
        tpPhysicsMaterials = null;
    }
    
    // Create the worker pool
    initIsolatedWorkerPool(handleTPWorkerResult);

    // Camera is already set up above
    
    // sketchbookAdapterInstance is already created.
    // The following lines seem redundant or potentially problematic if sceneRef/rendererRef changed.
    // sketchbookAdapterInstance.graphicsWorld = sceneRef;
    // sketchbookAdapterInstance.renderer = rendererRef;
    // REMOVE THIS LINE - it caused the linter error and uses potentially null tpPhysicsWorld
    // sketchbookAdapterInstance.physicsWorld = tpPhysicsWorld; 
    
    // Use type assertion to handle potential null and type compatibility issues
    if (sketchbookAdapterInstance) {
        // @ts-ignore - Type compatibility issues between different THREE.js versions
        sketchbookAdapterInstance.camera = thirdPersonCamera;
        
        appendToCustomLog("[InitITP] BEFORE creating CameraOperator. sketchbookAdapterInstance.cameraOperator is null: " + (sketchbookAdapterInstance.cameraOperator === null), 'log', undefined, undefined, undefined, 'critical');
        // Create the camera operator BEFORE setting up the input manager or loading the character
        appendToCustomLog("[TP] Creating camera operator...", 'log', undefined, undefined, undefined, 'critical');
        try {
            // @ts-ignore - Type compatibility issues
            sketchbookAdapterInstance.cameraOperator = new CameraOperator(sketchbookAdapterInstance, thirdPersonCamera);
            cameraOperatorRef = sketchbookAdapterInstance.cameraOperator;
            appendToCustomLog("[InitITP] AFTER creating CameraOperator. sketchbookAdapterInstance.cameraOperator is null: " + (sketchbookAdapterInstance.cameraOperator === null) + ", Ref is null: " + (cameraOperatorRef === null), 'log', undefined, undefined, undefined, 'critical' );
            appendToCustomLog("[TP] Camera operator created with world and camera", 'log', undefined, undefined, undefined, 'critical');
        } catch (error) {
            appendToCustomLog("[TP] Error creating camera operator: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
        }
    }
    
    // Set up mouse control and input
    // The InputManager is already created in SketchbookWorldAdapter's constructor.
    // This line re-creates it, which might be unintended.
    // Let's assume the adapter's inputManager is the one to use.
    // sketchbookAdapterInstance.inputManager = new InputManager(sketchbookAdapterInstance, rendererRef.domElement);
    if (!sketchbookAdapterInstance || !sketchbookAdapterInstance.inputManager) {
        appendToCustomLog("[InitITP] SketchbookAdapterInstance or its InputManager is not available for character setup.", 'error', undefined, undefined, undefined, 'critical');
        // Potentially abort or handle error
    }
    
    // Load the character model
    loadThirdPersonCharacter(spawnPos).then((characterInstance) => {
        if (!isActive || !sketchbookAdapterInstance) { 
            appendToCustomLog("[InitITP] LoadThirdPersonCharacter.then: Mode deactivated or adapter missing.", 'warn', undefined, undefined, undefined, 'critical');
            return; 
        }
        
        characterRef = characterInstance;
        // characterRef.world should now be set within loadThirdPersonCharacter
        
        // Camera operator was already set up earlier - no need to recreate it here
        appendToCustomLog("[TP] Camera operator already initialized - not recreating");

        // The add() and setInputReceiver() calls are now inside loadThirdPersonCharacter
        
        // Add physics to terrain chunks
        appendToCustomLog("[TP] Adding physics to terrain chunks...", 'log', undefined, undefined, undefined, 'critical');
        if (tpPhysicsMaterials && sketchbookAdapterInstance && sketchbookAdapterInstance.physicsWorld) {
            addPhysicsToChunks(tpChunkMeshes, tpPhysicsMaterials);
            appendToCustomLog("[TP] Physics added to terrain chunks.", 'log', undefined, undefined, undefined, 'critical');
                        } else {
            appendToCustomLog("[TP] Skipping physics for terrain - no physics materials or adapter/world not ready", 'warn', undefined, undefined, undefined, 'critical');
        }
    
    // Set up Yuka-based AI for nearby entities
    // Only call setupYukaEntities if it exists
    if (typeof setupYukaEntities === 'function') {
        // @ts-ignore - Handle missing parameter for setupYukaEntities
        setupYukaEntities(sceneRef);
    } else {
            appendToCustomLog("[TP] setupYukaEntities function not available - skipping AI setup", 'log', undefined, undefined, undefined, 'critical');
    }
    }).catch(error => {
        appendToCustomLog("Failed to load third-person character: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
    });
    
    // Start the clock
    clock.start();
    
    // Return the camera reference for the caller
    return thirdPersonCamera ? { camera: thirdPersonCamera } : null;
}

/**
 * Load the third-person character model and set up animations
 */
async function loadThirdPersonCharacter(spawnPosition: THREE.Vector3): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!sketchbookAdapterInstance || !sketchbookAdapterInstance.inputManager) {
            appendToCustomLog("[loadThirdPersonCharacter] SketchbookAdapterInstance or its InputManager is not available. Aborting character load.", 'error', undefined, undefined, undefined, 'critical');
            return reject(new Error("SketchbookAdapterInstance or InputManager not ready for character load."));
        }

        try {
            appendToCustomLog("[TP] Loading character model...", 'log', undefined, undefined, undefined, 'critical');
            const gltfLoader = new GLTFLoader();
            
            const loadStartTime = performance.now();
            
            const primaryModelPath = '/assets/boxman.glb';
            const fallbackModelPath = 'debug/Sketchbook-master/build/assets/boxman.glb';
            
            const tryLoadModel = (modelPath: string, isLastAttempt: boolean = false) => {
                appendToCustomLog(`[TP LoadChar] Attempting to load character model from: ${modelPath}`, 'log', undefined, undefined, undefined, 'critical');
                
                gltfLoader.load(modelPath, (gltf) => {
                const loadEndTime = performance.now();
                    appendToCustomLog(`[TP LoadChar] Character model loaded in ${(loadEndTime - loadStartTime).toFixed(2)}ms from ${modelPath}`, 'log', undefined, undefined, undefined, 'critical');
                
                try {
                    if (gltf.animations && gltf.animations.length > 0) {
                        const animNames = gltf.animations.map(anim => anim.name).join(', ');
                        appendToCustomLog(`[TP LoadChar] Model animations: ${animNames}`, 'log', undefined, undefined, undefined, 'critical');
                        } else {
                        appendToCustomLog("[TP LoadChar] No animations found in the model", 'warn', undefined, undefined, undefined, 'critical');
                    }
                    
                    appendToCustomLog("[TP LoadChar] About to create new AdaptedSketchbookCharacter_Engine.", 'log', undefined, undefined, undefined, 'critical');
                    const character = new AdaptedSketchbookCharacter_Engine(gltf, spawnPosition); // Corrected: Pass only gltf and spawnPosition
                    appendToCustomLog(`[TP LoadChar] POST-CONSTRUCTOR: Character instance created. Attempting to log its debugId: ${character.debugId}`, 'log', undefined, undefined, undefined, 'critical');
                    
                    const mixer = ensureMixerInitialized(gltf);
                    if (mixer) {
                            character.mixer = mixer as any; 
                        appendToCustomLog("[TP LoadChar] Animation mixer initialized successfully", 'log', undefined, undefined, undefined, 'critical');
                    }
                    
                    character.animations = gltf.animations;
                    
                    patchCharacterAnimations(character, gltf);
                    
                        character.position.copy(spawnPosition as any); 
                        
                        // ADD CHARACTER TO ADAPTER *BEFORE* SETTING INPUT RECEIVER
                        if (sketchbookAdapterInstance) { 
                            appendToCustomLog(`[TP LoadChar] Adding character (ID: ${character.debugId}) to sketchbookAdapterInstance.`, 'log', undefined, undefined, undefined, 'critical');
                            sketchbookAdapterInstance.add(character); 
                            appendToCustomLog("[TP LoadChar] Added character to sketchbookAdapterInstance. Character world should now be set.", 'log', undefined, undefined, undefined, 'critical');
                            if (!character.world) {
                                appendToCustomLog(`[TP LoadChar] CRITICAL WARNING: character.world is STILL NULL after adapter.add() for char ID: ${character.debugId}`, 'error', undefined, undefined, undefined, 'critical');
                            }
                        } else {
                            appendToCustomLog("[TP LoadChar] Could not add character to adapter - adapter instance is null. THIS IS A CRITICAL FAILURE POINT.", 'error', undefined, undefined, undefined, 'critical');
                            reject(new Error("Adapter became null during character load, cannot add character."));
                            return;
                        }
                    
                    appendToCustomLog("[TP LoadChar] Initializing character states...", 'log', undefined, undefined, undefined, 'critical');
                    initializeCharacter(character, gltf, true);
                    appendToCustomLog(`[TP LoadChar ID: ${character.debugId}] Value of character.rayCastLength AFTER initializeCharacter: ${character.rayCastLength}`, 'log', undefined, undefined, undefined, 'critical'); // Log rayCastLength after initializeCharacter
                    
                    appendToCustomLog("[TP LoadChar] Configuring character physics...", 'log', undefined, undefined, undefined, 'critical');
                    configureCharacterPhysics(character);
                    
                        character.setOrientation(new THREE.Vector3(0, 0, -1) as any, true); 
                    
                    appendToCustomLog("[TP LoadChar] Setting character as input receiver...", 'log', undefined, undefined, undefined, 'critical');
                    if (sketchbookAdapterInstance && sketchbookAdapterInstance.inputManager) {
                            appendToCustomLog(`[TP LoadChar] Setting input receiver to character ID: ${character.debugId}`, 'log', undefined, undefined, undefined, 'critical');
                            appendToCustomLog("[TP LoadChar] Before setInputReceiver. character.world is null: " + (character.world === null), 'log', undefined, undefined, undefined, 'critical');
                            if (character.world) {
                                appendToCustomLog("[TP LoadChar] Before setInputReceiver. character.world.cameraOperator is null: " + ((character.world as any).cameraOperator === null), 'log', undefined, undefined, undefined, 'critical');
                            }

                        character.inputReceiverInit = function() {
                            appendToCustomLog("[TP] Custom inputReceiverInit called for char ID: " + this.debugId, 'log', undefined, undefined, undefined, 'critical');
                            
                            try {
                                if (!this.controlledObject && this.world && this.world.cameraOperator) {
                                    this.world.cameraOperator.setRadius(1.6, true);
                                    this.world.cameraOperator.followMode = true; 
                                    this.world.cameraOperator.target = this.position;
                                    // Set characterCaller reference so the camera knows which character to follow
                                    this.world.cameraOperator.characterCaller = this;
                                    appendToCustomLog("[TP] Set cameraOperator.characterCaller to reference character ID: " + this.debugId, 'log', undefined, undefined, undefined, 'critical');
                                    
                                    if (this.world.updateControls) {
                                        this.world.updateControls([
                                            { keys: ["W", "A", "S", "D"], desc: "Movement" },
                                            { keys: ["Shift"], desc: "Sprint" },
                                            { keys: ["Space"], desc: "Jump" }
                                        ]);
                                    }
                                    
                                    appendToCustomLog("[TP] Character controls initialized for char ID: " + this.debugId, 'log', undefined, undefined, undefined, 'critical');
                                } else if (this.controlledObject && this.controlledObject.inputReceiverInit) {
                                    this.controlledObject.inputReceiverInit();
                                } else {
                                    // Add more detailed logging if the primary condition fails
                                    let reason = "";
                                    if (this.controlledObject) reason += "controlledObject is defined. ";
                                    if (!this.world) reason += "this.world is null/undefined. ";
                                    else if (!this.world.cameraOperator) reason += "this.world.cameraOperator is null/undefined. ";
                                    appendToCustomLog(`[TP] Custom inputReceiverInit for char ID: ${this.debugId} - SKIPPED main logic. Reason: ${reason}`, 'warn', undefined, undefined, undefined, 'critical');
                                }
                            } catch (e) {
                                appendToCustomLog("[TP] Error in custom inputReceiverInit for char ID: " + this.debugId + ", Error: " + (e as Error).message, 'warn', undefined, undefined, undefined, 'critical');
                            }
                        };
                        
                        sketchbookAdapterInstance.inputManager.setInputReceiver(character);
                    }
                    
                    if (mixer) {
                        directPlayAnimation(character, 'idle', 0.2, THREE.LoopRepeat);
                    }
                    
                    appendToCustomLog("[TP LoadChar] Character setup complete for char ID: " + character.debugId, 'log', undefined, undefined, undefined, 'critical');
                    resolve(character);
                } catch (error) {
                    appendToCustomLog("[TP LoadChar] Error setting up character: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
                    reject(error);
                }
            }, 
            (progress) => {
                if (progress.lengthComputable) {
                    const percentComplete = Math.round((progress.loaded / progress.total) * 100);
                    // appendToCustomLog(`[TP LoadChar] Character model loading: ${percentComplete}%`); // Too noisy for custom log
                }
            }, 
            (error) => {
                    appendToCustomLog(`[TP LoadChar] Error loading character model from ${modelPath}: ` + error.message, 'error', undefined, undefined, undefined, 'critical');
                    
                    if (!isLastAttempt) {
                        appendToCustomLog("[TP LoadChar] Trying fallback model path...", 'warn', undefined, undefined, undefined, 'critical');
                        tryLoadModel(fallbackModelPath, true);
                    } else {
                reject(error);
                    }
            });
            };
            
            tryLoadModel(primaryModelPath);
        } catch (error) {
            appendToCustomLog("[TP LoadChar] Outer error in loadThirdPersonCharacter: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
            reject(error);
        }
    });
}

// Track last character state for detecting state changes
let lastStateName: string = "None";

// Ensure the function takes no arguments as it's called by requestAnimationFrame
export function updateIsolatedThirdPerson() {
    const localTimeDelta = clock.getDelta(); // Get delta time here
    
    if (sketchbookAdapterInstance) {
        sketchbookAdapterInstance.update(localTimeDelta); 
    }

    const character = characterRef;

    // This initial check for character and charState for logging/reset remains important.
    if (character) { 
        const charIdForLog = character.debugId || 'unknownChar';
        // Use optional chaining for charState.constructor.name
        const gameLogicCharStateName = (character as any).charState?.constructor?.name ?? "None";
        
        // Log for general state checking - can be throttled or made less critical if too noisy
        appendToCustomLog(`[TP UpdateLogic Check] CharID: ${charIdForLog}, character.charState: ${gameLogicCharStateName}`, 'log', `tpUpdateLogicCheck_${charIdForLog}`, 750, 750, 'normal');

        // If character's state becomes "None", attempt to recover it.
        // The setState call below will trigger the new state's enter() method, which should handle setting the animation.
        if (gameLogicCharStateName === "None") {
            const currentAnimationName = (character as any)._currentAnimation || ((character as any).animations && (character as any).animations.length > 0 ? (character as any).animations[0]?.name : 'unknown_or_no_anims');
            appendToCustomLog(`[TP Animation Debug] State/Animation mismatch: State=${gameLogicCharStateName}, Current=${currentAnimationName}. CharID: ${charIdForLog}. Attempting to reset state to proper state.`, 'warn', `stateNoneMismatch_${charIdForLog}`, 0, 0, 'critical');
            
            if (character && (character as any).states) {
                let stateToSet: ICharacterState | null = null; 
                let stateNameToSet: string | null = null;

                if (Idle) { 
                    try {
                        stateToSet = new Idle(character as OriginalCharacterForOverride); 
                        stateNameToSet = "Idle";
                        appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. Found Idle state constructor. Preparing to set NEW Idle.`, 'log', `stateResetNewIdlePrep_${charIdForLog}`,0,0,'critical');
                    } catch (e) {
                         appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. ERROR instantiating new Idle: ${(e as Error).message}. Will try DropIdle.`, 'error', `stateResetNewIdleError_${charIdForLog}`,0,0,'critical');
                    }
                }
                
                if (!stateToSet && DropIdle) { 
                     try {
                        stateToSet = new DropIdle(character as OriginalCharacterForOverride); 
                        stateNameToSet = "DropIdle";
                        appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. Using DropIdle as fallback. Preparing to set NEW DropIdle.`, 'log', `stateResetNewDropIdlePrep_${charIdForLog}`,0,0,'critical');
                    } catch (e) {
                         appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. ERROR instantiating new DropIdle: ${(e as Error).message}.`, 'error', `stateResetNewDropIdleError_${charIdForLog}`,0,0,'critical');
                    }
                }

                if (stateToSet && stateNameToSet) {
                    appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. Attempting to set NEW state to ${stateNameToSet}.`, 'log', `stateResetAttemptNew_${charIdForLog}`, 0, 0, 'critical');
                    try {
                        (character as any).setState(stateToSet); 
                        const newCharStateName = (character as any).charState?.constructor?.name ?? 'Still None?!';
                        appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. Attempted reset to NEW ${stateNameToSet}. New state: ${newCharStateName}`, 'log', `stateResetResultNew_${charIdForLog}`, 0, 0, 'critical');
                    } catch (e) {
                        appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. ERROR resetting state with NEW ${stateNameToSet}: ${(e as Error).message}`, 'error', `stateResetErrorNew_${charIdForLog}`, 0, 0, 'critical');
                    }
        } else {
                    appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. FAILED to reset state: Could not find or instantiate a suitable recovery state (Idle or DropIdle).`, 'error', `stateResetFailNew_${charIdForLog}`, 0, 0, 'critical');
        }
            } else {
                const reason = !character ? "characterRef is null" : "character.states is null/undefined";
                appendToCustomLog(`[TP Animation Debug] CharID: ${charIdForLog}. FAILED to reset state: ${reason}.`, 'error', `stateResetFailNoStatesNew_${charIdForLog}`, 0, 0, 'critical');
    }
        } 
    } 

    // Skip if not active or missing key references
    if (!isActive || !sketchbookAdapterInstance || !characterRef) { 
        return;
    }
    
    // Apply adapter patches only once
    if (sketchbookAdapterInstance && !(sketchbookAdapterInstance as any)._patchesApplied) {
        if (sketchbookAdapterInstance.player) {
            patchIsolatedThirdPerson(sketchbookAdapterInstance);
            (sketchbookAdapterInstance as any)._patchesApplied = true;
            appendToCustomLog("[TP Update] Applied patches to SketchbookAdapterInstance.", 'log', 'TP_PatchesApplied', 60000, undefined, 'normal');
        } else {
            appendToCustomLog("[TP Update] Waiting to apply patches: sketchbookAdapterInstance.player is not yet set.", 'warn', 'TP_PatchWait', 1000, undefined, 'normal');
        }
    }
    
    const delta = clock.getDelta(); // Already got delta earlier, reuse if needed, or ensure this is the correct delta for physics/animation
    tpTimeSinceLastLoadCheck += delta;

    try {
        // The character's state machine is updated via sketchbookAdapterInstance.update(localTimeDelta) further up.
        // State transitions and animation calls (characterRef.setAnimation) should happen within the character's states' enter() methods.

        // --- Call updateAnimations to manage animation playback ---
        if (characterRef && characterRef.mixer && characterRef.charState && sketchbookAdapterInstance && sketchbookAdapterInstance.inputManager && characterRef.actions) {
            const actions = characterRef.actions as any; // Sketchbook character actions

            // Log the state of characterRef.actions
            const charIdForActionsLog = characterRef.debugId || 'unknownChar';
            let actionsString = '{';
            for (const key in actions) {
                if (actions[key] && typeof actions[key].isPressed === 'boolean') {
                    actionsString += ` ${key}: ${actions[key].isPressed},`;
                }
            }
            actionsString = actionsString.length > 1 ? actionsString.slice(0, -1) + ' }' : '{}'; // Remove trailing comma if any
            appendToCustomLog(`[TP Input Debug ID: ${charIdForActionsLog}] characterRef.actions: ${actionsString}`, 'log', `TP_CharActions_${charIdForActionsLog}`, 250, undefined, 'critical');

            // Determine input vector (simplified)
            const inputX = (actions.right?.isPressed ? 1 : 0) - (actions.left?.isPressed ? 1 : 0);
            const inputY = (actions.up?.isPressed ? 1 : 0) - (actions.down?.isPressed ? 1 : 0);
            const inputVector = new THREE.Vector2(inputX, inputY);

            // FIX: Determine if moving based on input state instead of velocity
            // This is critical to ensure animations work properly when stepping on slopes
            const isMoving = actions.up?.isPressed || 
                            actions.down?.isPressed || 
                            actions.left?.isPressed || 
                            actions.right?.isPressed;

            // Determine if shift (run) is pressed
            const isShiftPressed = actions.run?.isPressed || false;

            updateAnimations(
                characterRef,
                localTimeDelta, // Use the delta time calculated at the start of the update function
                inputVector,
                isMoving,
                isShiftPressed
            );
        }
        // --- End call to updateAnimations ---

        // REMOVED: Explicit animation triggering based on lastStateName !== currentStateName
        // The Character's internal state machine (updated via sketchbookAdapterInstance.update())
        // should handle calling characterRef.setAnimation() from within the new state's enter() method.
        /*
        const states = (characterRef as any).states;
        const currentState = (characterRef as any).currentState;
        const currentStateName = currentState ? currentState.constructor.name : "None";
        const mixer = (characterRef as any).mixer;
        
        if (currentStateName !== lastStateName) {
            appendToCustomLog(`[TP States Debug] State changed: ${lastStateName} -> ${currentStateName}`, 'info', 'TP_state_change', 1000, undefined, 'critical');
            lastStateName = currentStateName;
            
            if (currentStateName === "None") {
                // This logic is now handled at the top of the function if characterRef is valid.
                    } else {
                // appendToCustomLog(`[TP States Debug] Current state '${currentStateName}' is valid (not 'None'). Proceeding with animation for this state.`, 'log', 'TP_state_valid', 1000, undefined, 'normal');
                // const expectedAnim = getAnimationForState(currentStateName); // Ensure getAnimationForState is defined and works if needed for logging
                // appendToCustomLog(`[TP Animation Debug] Playing animation for state: ${currentStateName} -> ${expectedAnim}`, 'log', 'TP_anim_for_state', 1000); 
                // // OLD, PROBLEMATIC CALL: directPlayAnimation(characterRef, expectedAnim, 0.2);
                // // NEW, PREFERRED CALL (if states don't do it themselves, but they should):
                // // if (characterRef && typeof characterRef.setAnimation === 'function') {
                // //    characterRef.setAnimation(expectedAnim, 0.2);
                // // }
            }
        }
        */
        
        // REMOVED: Random animation check block
        /*
        if (Math.random() < 0.01) { 
            // ...
        }
        */
        
        // Update adapter (which updates character and camera) is already called at the top.
        // if (sketchbookAdapterInstance) {
        //     sketchbookAdapterInstance.update(delta); // This was already called
        // }
        
        // Check if we need to load nearby chunks
        if (tpTimeSinceLastLoadCheck >= TP_LOAD_CHECK_INTERVAL) {
        tpTimeSinceLastLoadCheck = 0;
            
            if (characterRef) {
                const position = new THREE.Vector3();
                characterRef.getWorldPosition(position as any); // Use type assertion
                
                // Get character chunk position
                const chunkX = Math.floor(position.x / CHUNK_SIZE);
                const chunkY = Math.floor(position.y / CHUNK_HEIGHT);
                const chunkZ = Math.floor(position.z / CHUNK_SIZE);
                
                // Check if we've moved to a new chunk
                if (
                    tpForceChunkLoad || 
                    chunkX !== tpLastCharacterChunkX || 
                    chunkY !== tpLastCharacterChunkY || 
                    chunkZ !== tpLastCharacterChunkZ
                ) {
                    tpLastCharacterChunkX = chunkX;
                    tpLastCharacterChunkY = chunkY;
                    tpLastCharacterChunkZ = chunkZ;
                    tpForceChunkLoad = false;
                    
                    appendToCustomLog(`[TP Chunks] Character at chunk ${chunkX},${chunkY},${chunkZ}`);
                    
                    // --- NEW: Update chunk physics debug viz ---
                    updateChunkPhysicsDebugVisualization(chunkX, chunkY, chunkZ);
                    // --- END NEW ---
                    
                    // Load chunks in vicinity
                    for (let x = chunkX - TP_LOAD_CHUNK_RADIUS; x <= chunkX + TP_LOAD_CHUNK_RADIUS; x++) {
                        for (let z = chunkZ - TP_LOAD_CHUNK_RADIUS; z <= chunkZ + TP_LOAD_CHUNK_RADIUS; z++) {
                            for (let y = chunkY - TP_VERTICAL_LOAD_RADIUS_BELOW; y <= chunkY + TP_VERTICAL_LOAD_RADIUS_ABOVE; y++) {
            const chunkKey = getChunkKeyY(x, y, z);
                                
                                // Skip if chunk is already loaded or being loaded
            if (tpChunkMeshes[chunkKey] || tpPendingRequests.has(chunkKey)) {
                continue;
            }

                                // Try to generate locally if we have a noise map
                                if (tpLoadedChunks[chunkKey]?.noiseMap) {
                                    generateTPLocalMesh(x, y, z);
                                } 
                                // Otherwise request from worker
                                else if (tpNoiseLayers && tpSeed) {
                                    appendToCustomLog(`[TP Chunks] Requesting chunk ${x},${y},${z} from worker`, 'log', `TP_req_chunk_${chunkKey}`, 10000); // Increased throttle to 10 seconds
                    if (requestChunkGeometry(x, y, z, tpNoiseLayers, tpSeed)) {
                        tpPendingRequests.add(chunkKey);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Update Yuka entities
        if (isolatedYukaController) {
            isolatedYukaController.update(delta);
        }
    } catch (error) {
        appendToCustomLog("[TP Update] Error during update: " + (error as Error).message, 'error');
        }
} // THIS IS THE INTENDED CLOSING BRACE FOR updateIsolatedThirdPerson

export function cleanupIsolatedThirdPerson() {
    appendToCustomLog("Cleaning up Isolated Third Person mode...", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    if (!isActive) return;
    isActive = false;
    clock.stop();
    
    try {
        // Clean up Yuka controller first
    if (isolatedYukaController) {
        isolatedYukaController.dispose();
        isolatedYukaController = null;
        appendToCustomLog("[TP Cleanup] Disposed IsolatedYukaCharacter.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    }

        // Terminate worker pool
    terminateIsolatedWorkerPool(); 
    tpPendingRequests.clear();

        // Gracefully clean up character and camera
        if (characterRef) {
            // If character was an input receiver, remove control
            if (sketchbookAdapterInstance?.inputManager?.inputReceiver === characterRef) {
                appendToCustomLog("[TP Cleanup] Removing character as input receiver", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                (sketchbookAdapterInstance.inputManager as any).setInputReceiver(null);
            }
            
            // Stop any running animations
            if (characterRef.mixer) {
                characterRef.mixer.stopAllAction();
                appendToCustomLog("[TP Cleanup] Stopped all character animations", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            }
            
            // Remove from world adapter
            if (sketchbookAdapterInstance) {
                sketchbookAdapterInstance.remove(characterRef);
                appendToCustomLog("[TP Cleanup] Removed character from world adapter", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            }
            
    characterRef = null;
        }
        
        // Clean up camera operator
        if (cameraOperatorRef) {
            if (sketchbookAdapterInstance) {
                sketchbookAdapterInstance.remove(cameraOperatorRef);
                appendToCustomLog("[TP Cleanup] Removed camera operator from world adapter", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    }
    cameraOperatorRef = null; 
        }

        // Clear world adapter
        sketchbookAdapterInstance = null;
    thirdPersonCamera = null;

        // Clean up chunk meshes
        if (sceneRef) {
            appendToCustomLog("[TP Cleanup] Removing chunk meshes from scene", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
        for (const key in tpChunkMeshes) {
            const mesh = tpChunkMeshes[key];
            if (mesh) {
                    disposeNode(sceneRef, mesh);
            }
        }
    }
        
        // Clear all references
    tpChunkMeshes = {};
    tpLoadedChunks = {};
    tpNoiseLayers = null;
    tpSeed = null;
    tpCompInfo = null;
    tpNoiseScale = null;
    tpPlanetOffset = null;
        sceneRef = null;
        rendererRef = null;
        
        // Call exit callback last
        if (onExitCallback) {
            const callback = onExitCallback;
            onExitCallback = null;
            appendToCustomLog("[TP Cleanup] Executing onExitCallback.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
            callback();
        }

    appendToCustomLog("Isolated Third Person mode CLEANED UP.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    } catch (error) {
        appendToCustomLog("[TP Cleanup] Error during cleanup: " + (error as Error).message, 'error');
    }

    // Remove custom log window on full cleanup
    if (logWindowContainerElement && logWindowContainerElement.parentElement) {
        logWindowContainerElement.parentElement.removeChild(logWindowContainerElement);
        logWindowContainerElement = null; // Reset the module-level variable
    }

    // --- NEW: Cleanup debug meshes ---
    if (currentChunkPhysicsDebugMesh && sceneRef) {
        if (currentChunkPhysicsDebugMesh.parent && sceneRef) { // Added sceneRef check
            sceneRef.remove(currentChunkPhysicsDebugMesh);
        }
        currentChunkPhysicsDebugMesh.geometry.dispose();
        if (Array.isArray(currentChunkPhysicsDebugMesh.material)) {
            currentChunkPhysicsDebugMesh.material.forEach(m => m.dispose());
        } else {
            (currentChunkPhysicsDebugMesh.material as THREE.Material).dispose();
        }
        currentChunkPhysicsDebugMesh = null;
        appendToCustomLog("[TP Cleanup] Cleaned up terrain physics debug mesh.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    }
    if (characterPhysicsDebugMeshes.length > 0 && sceneRef) {
        characterPhysicsDebugMeshes.forEach(mesh => {
            if (mesh.parent && sceneRef) sceneRef.remove(mesh); // Added sceneRef check
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                 mesh.material.forEach(m => m.dispose());
            } else {
                (mesh.material as THREE.Material).dispose();
            }
        });
        characterPhysicsDebugMeshes = [];
        appendToCustomLog("[TP Cleanup] Cleaned up character physics debug meshes.", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    }
    // --- END NEW ---
}

export function isIsolatedThirdPersonActive(): boolean {
    return isActive;
}

export function getIsolatedThirdPersonCamera(): THREE.PerspectiveCamera | null {
    return thirdPersonCamera;
}

// --- Helper function to get or generate neighbor noise maps (for generateTPLocalMesh) ---
function getTPNeighborNoiseMap(cx: number, cy: number, cz: number): NoiseMap | null {
    if (!tpLoadedChunks || !tpNoiseLayers || !tpSeed) { 
        appendToCustomLog(`[getTPNeighborNoiseMap] Missing refs for neighbor ${cx},${cy},${cz}`, 'warn');
        return null;
    }
    const neighborKey = getChunkKeyY(cx, cy, cz);
    let chunk = tpLoadedChunks[neighborKey]; 
    if (chunk && chunk.noiseMap) {
        chunk.lastAccessTime = Date.now(); 
        return chunk.noiseMap;
    }

    const generated = generateNoiseMap(cx, cy, cz, tpNoiseLayers, tpSeed);
    if (generated) {
        if (!tpLoadedChunks[neighborKey]) {
             tpLoadedChunks[neighborKey] = {
            mesh: null,
                noiseMap: generated,
            lastAccessTime: Date.now()
        };
        } else {
            tpLoadedChunks[neighborKey].noiseMap = generated;
            tpLoadedChunks[neighborKey].lastAccessTime = Date.now();
        }
    }
    return generated;
}


// --- Adapted from isolatedFirstPerson.ts ---
function generateTPLocalMesh(cx: number, cy: number, cz: number): boolean {
    const chunkKey = getChunkKeyY(cx, cy, cz);
    if (!tpLoadedChunks || !tpChunkMeshes || !sceneRef || !tpNoiseLayers || !tpSeed || !tpCompInfo || tpNoiseScale === null || !tpPlanetOffset) {
        appendToCustomLog(`[generateTPLocalMesh ${chunkKey}] Missing required references.`, 'error');
        if (tpPendingRequests) tpPendingRequests.delete(chunkKey); 
        return false;
    }

    const currentChunkData = tpLoadedChunks[chunkKey];
    const noiseMap = currentChunkData?.noiseMap;

    if (!noiseMap) {
        appendToCustomLog(`[generateTPLocalMesh ${chunkKey}] Can't generate mesh: noise map not available.`, 'warn');
        if (tpPendingRequests && !tpPendingRequests.has(chunkKey) && tpNoiseLayers && tpSeed) { // Added null checks for tpNoiseLayers and tpSeed
            if (requestChunkGeometry(cx, cy, cz, tpNoiseLayers, tpSeed)) {
                tpPendingRequests.add(chunkKey);
            }
        }
        return false;
    }

    const expectedHeight = CHUNK_HEIGHT + 1;
    const expectedWidth = CHUNK_SIZE + 1;
    if (noiseMap.length !== expectedHeight || 
        noiseMap[0]?.length !== expectedWidth || 
        noiseMap[0]?.[0]?.length !== expectedWidth) {
        appendToCustomLog(`[generateTPLocalMesh ${chunkKey}] Invalid noise map dimensions.`, 'error');
        if (tpPendingRequests) tpPendingRequests.delete(chunkKey);
        return false;
    }

    try {
    const noiseMapXNeg = getTPNeighborNoiseMap(cx - 1, cy, cz);
    const noiseMapXPos = getTPNeighborNoiseMap(cx + 1, cy, cz);
    const noiseMapZNeg = getTPNeighborNoiseMap(cx, cy, cz - 1);
    const noiseMapZPos = getTPNeighborNoiseMap(cx, cy, cz + 1);
        const noiseMapYNeg = getTPNeighborNoiseMap(cx, cy - 1, cz);
        const noiseMapYPos = getTPNeighborNoiseMap(cx, cy + 1, cz);

    const neighborFlags = {
        neighborXPosExists: !!noiseMapXPos,
        neighborXNegExists: !!noiseMapXNeg,
        neighborZPosExists: !!noiseMapZPos,
        neighborZNegExists: !!noiseMapZNeg,
            neighborYPosExists: !!noiseMapYPos, 
            neighborYNegExists: !!noiseMapYNeg, 
            playerEditMaskXPos: null, playerEditMaskXNeg: null, 
            playerEditMaskZPos: null, playerEditMaskZNeg: null,
            playerEditMaskYPos: null, playerEditMaskYNeg: null
        };

        const oldMesh = tpChunkMeshes[chunkKey];
        if (oldMesh && sceneRef) { // Added sceneRef check
            disposeNode(sceneRef, oldMesh); 
        }

        const geometry = generateMeshVertices(
            cx, cy, cz,
            { noiseMap }, 
            true, 
            noiseMapYNeg, noiseMapYPos, 
            noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
            neighborFlags
        );

        if (!geometry || geometry.attributes.position.count === 0) {
            appendToCustomLog(`[generateTPLocalMesh ${chunkKey}] generateMeshVertices returned empty geometry.`, 'warn');
            if (tpChunkMeshes) tpChunkMeshes[chunkKey] = null; 
            if (tpLoadedChunks && tpLoadedChunks[chunkKey]) tpLoadedChunks[chunkKey].mesh = null;
            if (tpPendingRequests) tpPendingRequests.delete(chunkKey); 
            return false;
        }
        
        if (!tpCompInfo || tpNoiseScale === null || !tpPlanetOffset || !sceneRef) { // Added sceneRef check
             appendToCustomLog(`TP Mode: Missing essential refs for material or scene in worker result for ${chunkKey}`, 'error');
             if (tpPendingRequests) tpPendingRequests.delete(chunkKey);
            return false;
        }

        const material = createUnifiedPlanetMaterial(
            tpCompInfo.topElements, 
            tpNoiseScale, 
            tpPlanetOffset
        );
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `tp_chunk_${chunkKey}`;
        mesh.frustumCulled = true; 
        mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE); 
        
        sceneRef.add(mesh);
        
        if (tpChunkMeshes) tpChunkMeshes[chunkKey] = mesh;
        if (tpLoadedChunks && !tpLoadedChunks[chunkKey]) { 
             tpLoadedChunks[chunkKey] = { noiseMap: noiseMap, mesh: mesh, lastAccessTime: Date.now() };
        } else if (tpLoadedChunks && tpLoadedChunks[chunkKey]) {
            tpLoadedChunks[chunkKey].mesh = mesh;
            tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
        }
        
        if (tpPendingRequests) tpPendingRequests.delete(chunkKey); 
        return true;

    } catch (error) {
        appendToCustomLog(`[generateTPLocalMesh ${chunkKey}] Error generating mesh: ` + (error as Error).message, 'error');
        if (tpChunkMeshes) tpChunkMeshes[chunkKey] = null;
        if (tpLoadedChunks && tpLoadedChunks[chunkKey]) tpLoadedChunks[chunkKey].mesh = null;
        if (tpPendingRequests) tpPendingRequests.delete(chunkKey);
        return false;
    }
}

// --- Adapted from isolatedFirstPerson.ts ---
// This is the function passed to initIsolatedWorkerPool
function handleTPWorkerResult(data: TPWorkerResultObject) {
    const { chunkX, chunkY, chunkZ, payload } = data;
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);

    if (tpPendingRequests) tpPendingRequests.delete(chunkKey);

    if (!tpLoadedChunks || !tpChunkMeshes || !sceneRef) {
        appendToCustomLog(`TP Mode: Missing essential refs when handling worker result for ${chunkKey}`, 'error');
        return;
    }
    
    if (!tpLoadedChunks[chunkKey]) {
        tpLoadedChunks[chunkKey] = { 
            mesh: null,
            noiseMap: null, 
            lastAccessTime: Date.now()
        };
    } else {
        tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
    }

    if (payload.noiseMap) {
        tpLoadedChunks[chunkKey].noiseMap = payload.noiseMap;
    }

    if (payload.positionBuffer && payload.positionBuffer.length > 0) {
        try {
            const oldMesh = tpChunkMeshes[chunkKey];
            if (oldMesh && sceneRef) { // Added sceneRef check
                disposeNode(sceneRef, oldMesh);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
            geometry.computeVertexNormals(); 
            
            if (!tpCompInfo || tpNoiseScale === null || !tpPlanetOffset || !sceneRef) { // Added sceneRef check
                appendToCustomLog(`TP Mode: Missing essential refs for material or scene in worker result for ${chunkKey}`, 'error');
                return; 
            }
            
            const material = createUnifiedPlanetMaterial(
                tpCompInfo.topElements,
                tpNoiseScale,
                tpPlanetOffset
            );
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `tp_chunk_${chunkKey}`;
            mesh.frustumCulled = true; 
            mesh.position.set(chunkX * CHUNK_SIZE, chunkY * CHUNK_HEIGHT, chunkZ * CHUNK_SIZE); 
            
            sceneRef.add(mesh);
            
            if (tpChunkMeshes) tpChunkMeshes[chunkKey] = mesh;
            if (tpLoadedChunks && !tpLoadedChunks[chunkKey]) { 
                 tpLoadedChunks[chunkKey] = { noiseMap: payload.noiseMap, mesh: mesh, lastAccessTime: Date.now() };
            } else if (tpLoadedChunks && tpLoadedChunks[chunkKey]) {
                tpLoadedChunks[chunkKey].mesh = mesh;
                tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
            }
            
            if (tpPendingRequests) tpPendingRequests.delete(chunkKey); 
            return true;

            } catch (error) {
            appendToCustomLog(`[handleTPWorkerResult ${chunkKey}] Error generating mesh: ` + (error as Error).message, 'error');
            if (tpChunkMeshes) tpChunkMeshes[chunkKey] = null;
            if (tpLoadedChunks && tpLoadedChunks[chunkKey]) tpLoadedChunks[chunkKey].mesh = null;
            if (tpPendingRequests) tpPendingRequests.delete(chunkKey);
            return false;
        }
    }
}

/**
 * Add physics bodies to terrain chunks for collision detection
 * 
 * @param chunkMeshes The chunk meshes to add physics to
 * @param materials The physics materials to use
 */
function addPhysicsToChunks(chunkMeshes: ChunkMeshesRef, materials: { [key: string]: CANNON.Material }) {
    if (!chunkMeshes || !sketchbookAdapterInstance || !sketchbookAdapterInstance.physicsWorld) {
        appendToCustomLog("[TP Physics] Cannot add physics - missing chunks, adapter, or physics world", 'error');
        return;
    }
    
    appendToCustomLog("[TP Physics] Adding physics to chunks...", 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
    let chunksWithPhysics: string[] = [];
    let trimeshSuccessCount = 0;
    let boxFallbackCount = 0;
    
    // Define terrain collision properties
    const terrainCollisionGroup = CollisionGroups.Default; // Should be 1
    const terrainCollisionMask = CollisionGroups.Characters | CollisionGroups.Default; // Collide with Characters (2) and Default (1)
    appendToCustomLog(`[TP Physics] Setting terrain to Group: ${terrainCollisionGroup}, Mask: ${terrainCollisionMask}`, 'info');
    
    // Process each chunk
    for (const chunkKey in chunkMeshes) {
        const mesh = chunkMeshes[chunkKey];
        if (!mesh || !mesh.geometry) { // Ensure mesh and geometry exist
            appendToCustomLog(`[TP Physics] Skipping chunk ${chunkKey} - mesh or geometry is null/undefined.`, 'warn');
            continue;
        }
        
        // Add new logging for the target chunk
        const [cxStr, cyStr, czStr] = chunkKey.split(',');
        const cx = parseInt(cxStr);
        const cy = parseInt(cyStr);
        const cz = parseInt(czStr);
        const isTargetSpawnChunk = cx === 0 && cz === 0; // Check if it's the 0,Y,0 chunk

        if (isTargetSpawnChunk) {
            appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Processing chunk under/near spawn. Mesh position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
        }
        
        try {
            // Attempt to merge vertices to create an indexed geometry
            // Make a clone if you don't want to modify the original visual mesh's geometry
            let physicsGeometry = mesh.geometry.clone(); 
            physicsGeometry = BufferGeometryUtils.mergeVertices(physicsGeometry);

            const vertices = physicsGeometry.attributes.position.array;
            const indices = physicsGeometry.index ? physicsGeometry.index.array : null;
            
            if (indices && indices.length > 0) {
                appendToCustomLog(`[TP Physics] Chunk ${chunkKey} has an index buffer after mergeVertices. Vertices: ${vertices.length / 3}, Indices: ${indices.length / 3} tris`, 'log');
                
                const trimeshShape = new CANNON.Trimesh(vertices as unknown as number[], indices as unknown as number[]);
                const body = new CANNON.Body({
                    mass: 0,
                    material: materials.terrain,
                    shape: trimeshShape,
                    collisionFilterGroup: terrainCollisionGroup,
                    collisionFilterMask: terrainCollisionMask
                });
                body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
                
                if (isTargetSpawnChunk) {
                    // Calculate and log bounding box of the trimesh vertices
                    const trimeshVertices = vertices as unknown as number[];
                    let minX = Infinity, minY = Infinity, minZ = Infinity;
                    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                    for (let i = 0; i < trimeshVertices.length; i += 3) {
                        minX = Math.min(minX, trimeshVertices[i]);
                        maxX = Math.max(maxX, trimeshVertices[i]);
                        minY = Math.min(minY, trimeshVertices[i+1]);
                        maxY = Math.max(maxY, trimeshVertices[i+1]);
                        minZ = Math.min(minZ, trimeshVertices[i+2]);
                        maxZ = Math.max(maxZ, trimeshVertices[i+2]);
                    }
                    appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Trimesh created. Local Vertices BBox: Y_min=${minY.toFixed(2)}, Y_max=${maxY.toFixed(2)}. Body Global Pos Y: ${body.position.y.toFixed(2)}. Expected Ground at Y approx ${body.position.y + maxY}`, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                }

                appendToCustomLog(`[TP Physics] Trimesh body for ${chunkKey} created at Y: ${body.position.y.toFixed(2)}. Group: ${body.collisionFilterGroup}, Mask: ${body.collisionFilterMask}`, 'log');
                sketchbookAdapterInstance.physicsWorld.addBody(body);
                (mesh as any).physicsBody = body; // Keep a reference if needed, though maybe on a separate physics object map
                chunksWithPhysics.push(chunkKey);
                trimeshSuccessCount++;
            } else {
                appendToCustomLog(`[TP Physics] Chunk ${chunkKey} still has no index buffer (or empty) after mergeVertices - creating simple collision box instead`, 'warn');
                boxFallbackCount++;
                
                // Fallback to CANNON.Box (original logic)
                mesh.geometry.computeBoundingBox(); // Use original geometry for bounding box
                const boundingBox = mesh.geometry.boundingBox;
                if (!boundingBox) {
                    appendToCustomLog(`[TP Physics] Cannot create fallback collision for chunk ${chunkKey} - no bounding box on original geometry`, 'warn');
                    continue;
                }
                
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                const boxShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
                const body = new CANNON.Body({
                    mass: 0,
                    material: materials.terrain,
                    shape: boxShape,
                    collisionFilterGroup: terrainCollisionGroup,
                    collisionFilterMask: terrainCollisionMask
                });
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);
                body.position.set(
                    mesh.position.x + center.x,
                    mesh.position.y + center.y,
                    mesh.position.z + center.z
                );
                
                if (isTargetSpawnChunk) {
                    appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Box fallback created. BBox MinY: ${boundingBox.min.y.toFixed(2)}, MaxY: ${boundingBox.max.y.toFixed(2)}. Body Global Pos Y: ${body.position.y.toFixed(2)}. Expected Ground at Y approx ${body.position.y + boundingBox.max.y}`, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
                }
                appendToCustomLog(`[TP Physics] Box fallback body for ${chunkKey} created at Y: ${body.position.y.toFixed(2)}. Group: ${body.collisionFilterGroup}, Mask: ${body.collisionFilterMask}`, 'log');
            sketchbookAdapterInstance.physicsWorld.addBody(body);
            (mesh as any).physicsBody = body;
            chunksWithPhysics.push(chunkKey);
            }
        } catch (error) {
            appendToCustomLog(`[TP Physics] Error adding physics to chunk ${chunkKey}: ` + (error as Error).message, 'error');
        }
    }
    
    appendToCustomLog(`[TP Physics] Added physics to ${chunksWithPhysics.length} chunks. Trimesh: ${trimeshSuccessCount}, Box Fallback: ${boxFallbackCount}`, 'log', undefined, undefined, undefined, 'normal', 'isolatedThirdPersonunmodularized.ts');
}

// Helper function to safely update the third-person mode
function thirdPersonUpdate(): void {
    if (!isActive) return;
    
    const deltaTime = clock.getDelta();
    
    // Update camera if available
    if (cameraOperatorRef) {
        cameraOperatorRef.update(deltaTime);
    }
    
    // Update physics world
    if (sketchbookAdapterInstance && sketchbookAdapterInstance.physicsWorld) {
        // @ts-ignore - Different CANNON types between Sketchbook and our project
        sketchbookAdapterInstance.physicsWorld.step(1/60, deltaTime);
    }
    
    // Update Sketchbook adapter
    if (sketchbookAdapterInstance) {
        // @ts-ignore - Parameter type mismatch between versions
        sketchbookAdapterInstance.update(deltaTime);
    }
}

// --- Helper functions for Yuka AI ---
/**
 * Set up Yuka AI entities in the scene
 * This is a stub implementation to avoid errors when the real implementation is not available
 * 
 * @param scene The THREE.js scene to add entities to
 */
function setupYukaEntities(scene?: THREE.Scene | null): void {
    appendToCustomLog("[TP] setupYukaEntities called (stub implementation)");
}

// --- Helper functions for animation handling ---
/**
 * Ensure a GLTF model has an initialized animation mixer
 * This is a stub implementation to avoid errors when the real implementation is not available
 * 
 * @param gltf The GLTF model to initialize a mixer for
 * @returns The animation mixer or null if initialization failed
 */
function ensureMixerInitialized(gltf: any): THREE.AnimationMixer | null {
    if (!gltf || !gltf.scene) {
        appendToCustomLog("[TP] Cannot initialize mixer - missing GLTF scene", 'warn');
        return null;
    }
    
    try {
        const mixer = new THREE.AnimationMixer(gltf.scene);
        appendToCustomLog("[TP] Created animation mixer for model");
        return mixer;
    } catch (error) {
        appendToCustomLog("[TP] Error initializing animation mixer: " + (error as Error).message, 'error');
        return null;
    }
}

/**
 * Get the animation name that corresponds to a given character state
 * This is a stub implementation to avoid errors when the real implementation is not available
 * 
 * @param stateName The name of the character state
 * @returns The corresponding animation name
 */
function getAnimationForState(stateName: string): string {
    // Enhanced mapping of state names to animations with better support for walk transitions
    const stateToAnimMap: Record<string, string> = {
        'Idle': 'idle',
        'Walk': 'run',  // Using 'run' since 'walk' doesn't exist
        'Run': 'run',
        'Sprint': 'run',
        'JumpIdle': 'jump_idle',
        'JumpRunning': 'jump_running',
        'Falling': 'falling',
        // Add the transition states with appropriate animations
        'StartWalkForward': 'run',
        'StartWalkForwardState': 'run',
        'AdaptedStartWalkForwardState': 'run',
        'StartWalkLeft': 'run', 
        'StartWalkLeftState': 'run',
        'AdaptedStartWalkLeftState': 'run',
        'StartWalkRight': 'run',
        'StartWalkRightState': 'run',
        'AdaptedStartWalkRightState': 'run',
        'EndWalk': 'idle',  // Changed from 'stop' to 'idle' since 'stop' doesn't exist
        'EndWalkState': 'idle', // Changed from 'stop' to 'idle'
        'AdaptedEndWalk': 'idle', // Changed from 'stop' to 'idle'
        'IdleRotateLeft': 'run',
        'IdleRotateRight': 'run'
    };
    
    // Get the animation from the map, or fall back to 'idle' if not found
    return stateToAnimMap[stateName] || 'idle';
}

/**
 * Directly play an animation on a character
 * This is a stub implementation to avoid errors when the real implementation is not available
 * 
 * @param character The character to play the animation on
 * @param animName The name of the animation to play
 * @param fadeIn The fade-in time for the animation
 * @param loop Whether the animation should loop
 * @returns Whether the animation was successfully played
 */
function directPlayAnimation(
    character: any,
    animName: string,
    fadeIn: number = 0.2,
    loop: number = THREE.LoopRepeat
): boolean {
    const charId = character && character.debugId ? character.debugId : 'unknown';
    
    // Animation mapping for fallbacks when requested animations don't exist
    const animationMapping: {[key: string]: {name: string, loop: number, fadeTime: number}} = {
        'walk': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 },
        'run': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 },
        'rotate_left': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'rotate_right': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'turn_left': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'turn_right': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'idle': { name: 'idle', loop: THREE.LoopRepeat, fadeTime: 0.2 },
        'stop': { name: 'idle', loop: THREE.LoopRepeat, fadeTime: 0.2 }, // Changed to LoopRepeat for smoother transitions
        'sprint': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 } // Added sprint mapping
    };
    
    // Apply animation mapping
    let targetAnimName = animName;
    let targetFadeIn = fadeIn;
    let targetLoop = loop;
    
    if (animationMapping[animName]) {
        const mapping = animationMapping[animName];
        targetAnimName = mapping.name;
        targetLoop = mapping.loop;
        
        // Only use the mapping's fade time if it's faster than requested
        // This allows callers to request even quicker fades when needed
        targetFadeIn = Math.min(fadeIn, mapping.fadeTime);
        
        // Log mapping
        if (targetAnimName !== animName) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Mapping '${animName}' to '${targetAnimName}' animation`, 'log', `DirectPlay_MapAnim_${charId}`, 500, undefined, 'normal');
        }
    }
    
    // Store previous animation for better transition logging
    const prevAnim = character._currentAnimation || 'none';
    
    // IMPORTANT: Don't change animation if it's already playing the same one
    // This prevents constant animation resets that break the animation flow
    if (character._currentAnimation === targetAnimName) {
        // Skip logging most of the time to reduce spam
        const now = Date.now();
        const lastSkipLog = character._lastSkipLogTime || 0;
        if (now - lastSkipLog > 1000) { // Log only every second
        appendToCustomLog(
                `[directPlayAnimation ID: ${charId}] Skipping animation change - already playing '${targetAnimName}'`,
                'log',
                `DirectPlay_AlreadyPlaying_${charId}`,
                2000,
                undefined,
                'normal'
        );
            character._lastSkipLogTime = now;
        }
        return true; // Return true since animation is already playing as requested
        }
        
    // Log animation transition for debugging
    appendToCustomLog(`[Animation Transition ID: ${charId}] ${prevAnim} -> ${targetAnimName}`, 'log', `AnimTransition_${charId}`, 500, undefined, 'normal');
        
    try {
        // Get the animation from the character's animations (added in constructor)
        const foundClip = character.animations?.find((clip: THREE.AnimationClip) => 
            clip.name === targetAnimName || clip.name.toLowerCase() === targetAnimName.toLowerCase()
        );
        
        if (!foundClip) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] No animation found with name '${targetAnimName}'`, 'error', `DirectPlay_NoClip_${charId}`, 0, undefined, 'critical');
            
            // Try fallback to idle
            if (targetAnimName !== 'idle' && targetAnimName !== 'run') {
                appendToCustomLog(`[directPlayAnimation ID: ${charId}] Trying fallback to idle/run animation`, 'log', `DirectPlay_Fallback_${charId}`, 0, undefined, 'normal');
                return directPlayAnimation(character, targetAnimName === 'stop' ? 'idle' : 'run', targetFadeIn, targetLoop);
            }
            
            return false;
        }
        
        if (!character.mixer) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Character has no mixer`, 'error', `DirectPlay_NoMixer_${charId}`, 0, undefined, 'critical');
            return false;
        }
        
        // Get or create action for this animation
        const existingAction = character.mixer.existingAction(foundClip);
        const action = existingAction || character.mixer.clipAction(foundClip);
        
        if (!action) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Failed to create action for '${targetAnimName}'`, 'error', `DirectPlay_NoAction_${charId}`, 0, undefined, 'critical');
            return false;
        }
        
        // Configure the action
        action.loop = targetLoop;
        action.clampWhenFinished = true;
        action.timeScale = 1;
        
        // Special case for turning animations - slightly faster playback
        if (animName.includes('turn') || animName.includes('rotate')) {
            action.timeScale = 1.2; // 20% faster for more responsive turns
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Using faster timeScale (${action.timeScale}) for turn animation`, 'log', `DirectPlay_TurnFaster_${charId}`, 500, undefined, 'normal');
        }
        
        // Log animation parameters for debugging
        appendToCustomLog(`[Animation Parameters ID: ${charId}] {duration: ${foundClip.duration.toFixed(4)}, timeScale: ${action.timeScale}, loop: ${targetLoop}, fadeIn: ${targetFadeIn}}`, 'log', `AnimParams_${charId}`, 500, undefined, 'normal');
        
        // Check if animation is currently active and running
        if (existingAction && existingAction.isRunning()) {
            // If it's already running, we don't need to restart it
            // Just make sure it has the right parameters
            existingAction.loop = targetLoop;
            existingAction.timeScale = action.timeScale;
        
        appendToCustomLog(
                `[directPlayAnimation ID: ${charId}] Animation '${targetAnimName}' already running, updated parameters`,
                'log',
                `DirectPlay_AlreadyRunning_${charId}`,
                1000,
                undefined,
                'normal'
            );
            
            // Update current animation reference
            character._currentAnimation = targetAnimName;
            
        return true;
        }
        
        // Add a timestamp check to prevent too many animation changes in quick succession
        const now = Date.now();
        const lastAnimChange = character._lastAnimChangeTime || 0;
        
        // Don't enforce minimum time for turning animations to ensure responsiveness
        let minTimeBetweenChanges = 200;
        if (animName.includes('turn') || animName.includes('rotate')) {
            minTimeBetweenChanges = 0; // No minimum time for turn animations
        }
        
        if (character._currentAnimation && character._currentAnimation !== targetAnimName) {
            // Check if enough time has passed since last animation change
            if (now - lastAnimChange < minTimeBetweenChanges) {
                // Too soon since last change, log but don't force a new animation
                appendToCustomLog(`[Animation Skip ID: ${charId}] Skipping ${character._currentAnimation} -> ${targetAnimName} change (too soon, ${now - lastAnimChange}ms < ${minTimeBetweenChanges}ms)`, 'log', `AnimSkip_${charId}`, 500, undefined, 'normal');
                
                // Still return true to prevent cascading animation attempts
                return true;
            }
            
            // Get the current action
            const currentClip = character.animations?.find((clip: THREE.AnimationClip) => 
                clip.name === character._currentAnimation || clip.name.toLowerCase() === character._currentAnimation.toLowerCase()
            );
            
            if (currentClip) {
                const currentAction = character.mixer.existingAction(currentClip);
                if (currentAction && currentAction.isRunning()) {
                    // For turning animations, use shorter crossfade for responsiveness
                    let actualFadeIn = targetFadeIn;
                    if (!animName.includes('turn') && !animName.includes('rotate')) {
                        actualFadeIn = Math.max(targetFadeIn, 0.3); // At least 0.3s fade for non-turning animations
                    }
                    
                    appendToCustomLog(`[Animation Crossfade ID: ${charId}] ${character._currentAnimation} -> ${targetAnimName} with fadeIn: ${actualFadeIn}`, 'log', `AnimCrossfade_${charId}`, 500, undefined, 'normal');
                    currentAction.crossFadeTo(action, actualFadeIn, true);
                } else {
                    // Fade in the new animation
                    action.reset();
                    action.fadeIn(targetFadeIn);
                }
            } else {
                // Fade in the new animation
                action.reset();
                action.fadeIn(targetFadeIn);
            }
        } else {
            // Reset and fade in
            action.reset();
            action.fadeIn(targetFadeIn);
        }
        
        // Record timestamp of this animation change
        character._lastAnimChangeTime = now;
        
        action.play();
        
        // Update current animation reference
        character._currentAnimation = targetAnimName;
        
        appendToCustomLog(`[Animation Play ID: ${charId}] Successfully playing '${targetAnimName}' animation`, 'log', `AnimPlay_${charId}`, 2000, undefined, 'normal');
        
        return true;
    } catch (error: any) {
        appendToCustomLog(`[directPlayAnimation ID: ${charId}] Error playing animation '${targetAnimName}': ${error.message}`, 'error', `DirectPlay_Error_${charId}`, 0, undefined, 'critical');
        return false;
    }
}

// Helper functions for draggable and resizable log window
function makeLogWindowDraggable(logWindow: HTMLElement, dragHandle: HTMLElement) {
    let offsetX: number, offsetY: number;
    let isDragging = false;

    dragHandle.onmousedown = (e) => {
        isDragging = true;
        offsetX = e.clientX - logWindow.offsetLeft;
        offsetY = e.clientY - logWindow.offsetTop;
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
        dragHandle.style.cursor = 'grabbing';
    };

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        // Boundary checks (optional, to keep window on screen)
        const maxLeft = window.innerWidth - logWindow.offsetWidth;
        const maxTop = window.innerHeight - logWindow.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        logWindow.style.left = newLeft + 'px';
        logWindow.style.top = newTop + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
        dragHandle.style.cursor = 'move';
    }
}

function makeLogWindowResizable(logWindow: HTMLElement, resizeHandle: HTMLElement) {
    let startX: number, startY: number, startWidth: number, startHeight: number;
    let isResizing = false;

    resizeHandle.onmousedown = (e) => {
        e.preventDefault(); // Prevent default drag behavior
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView!.getComputedStyle(logWindow).width, 10);
        startHeight = parseInt(document.defaultView!.getComputedStyle(logWindow).height, 10);
        document.onmousemove = onResizeMouseMove;
        document.onmouseup = onResizeMouseUp;
    };

    function onResizeMouseMove(e: MouseEvent) {
        if (!isResizing) return;
        const newWidth = startWidth + (e.clientX - startX);
        const newHeight = startHeight + (e.clientY - startY);
        logWindow.style.width = Math.max(200, newWidth) + 'px'; // Min width 200px
        logWindow.style.height = Math.max(100, newHeight) + 'px'; // Min height 100px
    }

    function onResizeMouseUp() {
        isResizing = false;
        document.onmousemove = null;
        document.onmouseup = null;
    }
}

// Adapted version of SketchbookCharacter_Engine for our use case
// This addresses the "Cannot find name 'AdaptedSketchbookCharacter_Engine'" error
class AdaptedSketchbookCharacter_Engine extends OriginalCharacterForOverride { 
    public debugId: number;
    public slopeLimit: number; // Explicitly declare slopeLimit
    public readonly GROUNDED_GRACE_PERIOD: number; // Declare to override
    private _currentAnimation: string | null = null; // Added declaration for _currentAnimation

    // --- NEW Three.js Raycasting Properties ---
    public threeGroundRaycaster: THREE.Raycaster;
    public threeRayHit: boolean = false;
    public threeRayHitPoint: THREE.Vector3 = new THREE.Vector3();
    public threeRayHitNormal: THREE.Vector3 = new THREE.Vector3();
    public threeRayHitDistance: number = 0;
    // --- END NEW Three.js Raycasting Properties ---

    constructor(gltf: any, spawnPosition: THREE.Vector3) { 
        appendToCustomLog("[AdaptedSKB Constructor] Entered. GLTF object received.", 'log', undefined, undefined, undefined, 'critical');
        appendToCustomLog(`[AdaptedSKB Constructor] SPAWN POSITION received: (${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'critical');
        if (!gltf) {
            appendToCustomLog("[AdaptedSKB Constructor] GLTF object is null or undefined before super()!", 'error', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF scene exists: ${!!gltf.scene}`, 'log', undefined, undefined, undefined, 'critical');
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF animations exist: ${!!gltf.animations}`, 'log', undefined, undefined, undefined, 'critical');
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF userData exists: ${!!gltf.userData}`, 'log', undefined, undefined, undefined, 'critical');
            if (gltf.userData) {
                appendToCustomLog(`[AdaptedSKB Constructor] GLTF userData.character exists: ${!!gltf.userData.character}`, 'log', undefined, undefined, undefined, 'critical');
            }
        }
        try {
        super(gltf); // Revert to single argument super call from original Character.ts
            appendToCustomLog("[AdaptedSKB Constructor] SUCCESSFULLY returned from super(gltf).", 'log', undefined, undefined, undefined, 'critical');
        } catch (e: any) {
            appendToCustomLog(`[AdaptedSKB Constructor] ERROR during super(gltf) call: ${e.message}`, 'error', undefined, undefined, undefined, 'critical');
            throw e; 
        }
        this.debugId = Math.random(); 
        appendToCustomLog(`[AdaptedSKB Constructor] Instance created with debugId: ${this.debugId}`, 'log', undefined, undefined, undefined, 'critical');
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Value of this.rayCastLength IMMEDIATELY AFTER super(): ${this.rayCastLength}`, 'log', undefined, undefined, undefined, 'critical'); // Log rayCastLength after super

        // --- Re-initialize rayResult with the CANNON instance used by cannon-es ---
        this.rayResult = new CANNON.RaycastResult();
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Re-initialized this.rayResult with new CANNON.RaycastResult().`, 'log', undefined, undefined, undefined, 'critical');

        this.raySafeOffset = 0.03; 
        this.rayCastLength = 1.2; 
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Set raySafeOffset=${this.raySafeOffset}, rayCastLength=${this.rayCastLength}`, 'warn', undefined, undefined, undefined, 'critical');

        // CRITICAL FIX: Synchronize modelContainer's Y offset with our new rayCastLength
        if (this.modelContainer) {
            this.modelContainer.position.y = -this.rayCastLength;
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Set modelContainer.position.y = ${this.modelContainer.position.y.toFixed(2)} (to -this.rayCastLength)`, 'warn', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CRITICAL WARNING: this.modelContainer is null or undefined. Cannot set its Y position. Character visuals will be misaligned.`, 'error', undefined, undefined, undefined, 'critical');
        }

        // Disable slope limit by setting it to cos(90deg) = 0
        this.slopeLimit = 0.0; 
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Slope limit disabled (this.slopeLimit = ${this.slopeLimit.toFixed(2)})`, 'warn', undefined, undefined, undefined, 'critical');

        // Increase the grounded grace period
        this.GROUNDED_GRACE_PERIOD = 0.3; // Default was 0.1
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Grounded grace period set to ${this.GROUNDED_GRACE_PERIOD}s`, 'warn', undefined, undefined, undefined, 'critical');

        // --- Replace original body with a cannon-es compatible body ---
        const originalBody = this.characterCapsule.body as any; // Cast to any to access properties
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Original body type: ${originalBody.constructor.name}. Mass: ${originalBody.mass}, Original Pos from base constructor: (${originalBody.position.x.toFixed(2)}, ${originalBody.position.y.toFixed(2)}, ${originalBody.position.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'critical');

        if (!tpPhysicsMaterials || !tpPhysicsMaterials.character) {
            const errorMsg = `[AdaptedSKB Constructor ID: ${this.debugId}] ERROR: tpPhysicsMaterials.character not available for new body! This is critical.`;
            appendToCustomLog(errorMsg, 'error', undefined, undefined, undefined, 'critical');
            throw new Error(errorMsg);
        }

        const newEsBody = new CANNON.Body({
            mass: originalBody.mass,
            material: tpPhysicsMaterials.character, // Use cannon-es material from isolatedThirdPerson scope
            position: new CANNON.Vec3(spawnPosition.x, spawnPosition.y, spawnPosition.z), // USE SPAWN POSITION HERE
            quaternion: new CANNON.Quaternion().copy(originalBody.quaternion),
            velocity: new CANNON.Vec3().copy(originalBody.velocity),
            angularVelocity: new CANNON.Vec3().copy(originalBody.angularVelocity),
            linearDamping: originalBody.linearDamping,
            angularDamping: originalBody.angularDamping,
            fixedRotation: originalBody.fixedRotation,
            allowSleep: originalBody.allowSleep,
            // collisionFilterGroup: originalBody.collisionFilterGroup, // Will be set explicitly
            // collisionFilterMask: originalBody.collisionFilterMask,   // Will be set explicitly
            angularFactor: new CANNON.Vec3().copy(originalBody.angularFactor),
        });
        (newEsBody as any).isCharacterBody = true; // Tag the character body
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Created new CANNON.Body (cannon-es). Mass: ${newEsBody.mass}, Material: ${newEsBody.material ? newEsBody.material.name : 'null'}. Tagged as character.`, 'log', undefined, undefined, undefined, 'critical');
        
        // Reconstruct shapes based on Character's options (which CapsuleCollider uses)
        const charOptions = (this as any).options as any; 
        
        let shapeRadius = 0.25; // Default radius
        let shapeHeight = 0.5;  // Default height

        if (charOptions && typeof charOptions.radius === 'number' && typeof charOptions.height === 'number') {
            shapeRadius = charOptions.radius;
            shapeHeight = charOptions.height;
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Using shape params from this.options: radius=${shapeRadius}, height=${shapeHeight}`, 'log', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] WARNING: charOptions or its radius/height is undefined/invalid. Using default capsule: radius=${shapeRadius}, height=${shapeHeight}. charOptions was: ${JSON.stringify(charOptions)}`, 'warn', undefined, undefined, undefined, 'critical');
        }

        const esSphere = new CANNON.Sphere(shapeRadius);
        newEsBody.addShape(esSphere, new CANNON.Vec3(0, shapeHeight / 2, 0));
        newEsBody.addShape(esSphere, new CANNON.Vec3(0, -shapeHeight / 2, 0)); 
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Added 2 Sphere shapes to new cannon-es body. Shape count: ${newEsBody.shapes.length}`, 'log', undefined, undefined, undefined, 'critical');

        if (newEsBody.shapes.length === 0) {
             appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CRITICAL WARNING: New cannon-es body has NO shapes! Physics will fail.`, 'error', undefined, undefined, undefined, 'critical');
        }

        // Set explicit collision filtering for the character body
        newEsBody.collisionFilterGroup = CollisionGroups.Characters; // Group 2
        newEsBody.shapes.forEach(shape => {
            shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders; // Collide with everything except group 4
        });
        // Ensure the body itself also has a mask if not relying solely on shape masks (cannon-es behavior can vary)
        newEsBody.collisionFilterMask = ~CollisionGroups.TrimeshColliders;

        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Set newEsBody collisionFilterGroup=${newEsBody.collisionFilterGroup}, shape/body mask=${newEsBody.collisionFilterMask} (original SKB logic)`, 'log', undefined, undefined, undefined, 'critical');

        this.characterCapsule.body = newEsBody; 
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Replaced characterCapsule.body with new cannon-es body. New body's world: ${newEsBody.world || 'null'}`, 'log', undefined, undefined, undefined, 'critical');
        // --- End body replacement ---

        // --- Directly assign preStep/postStep to the newEsBody ---
        if (newEsBody) {
            (newEsBody as any).preStep = this.physicsPreStep.bind(this);
            (newEsBody as any).postStep = this.physicsPostStep.bind(this);
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Directly assigned this.physicsPreStep/PostStep to newEsBody.preStep/postStep.`, 'log', undefined, undefined, undefined, 'critical');
            if ((newEsBody as any).preStep) {
                appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Confirmed: newEsBody.preStep is now assigned.`, 'log', undefined, undefined, undefined, 'critical');
            }
            if ((newEsBody as any).postStep) {
                appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Confirmed: newEsBody.postStep is now assigned.`, 'log', undefined, undefined, undefined, 'critical');
            }
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] ERROR: newEsBody is null, cannot assign preStep/postStep!`, 'error', undefined, undefined, undefined, 'critical');
        }
        // --- End direct assignment ---

        // --- Initialize Three.js Raycaster ---
        this.threeGroundRaycaster = new THREE.Raycaster();
        this.threeGroundRaycaster.ray.direction.set(0, -1, 0); // Default downward direction
        // Set a reasonable far distance for the raycaster, e.g., character height + a bit more
        // This rayCastLength is our character's center-to-foot distance (1.2)
        this.threeGroundRaycaster.far = this.rayCastLength + 10.0; // Check 10 units below nominal feet position
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Initialized THREE.Raycaster. Direction: (0, -1, 0), Far: ${this.threeGroundRaycaster.far.toFixed(2)}`, 'log', undefined, undefined, undefined, 'critical');
        // --- END Initialize Three.js Raycaster ---

        // REMOVED: this.actions reassignment. We will inherit from super() and adjust getLocalMovementDirection if needed.
        // // --- OVERRIDE ACTIONS FOR STANDARD WASD --- 
        // this.actions = {
        //     'up': new (this.actions.up as any).constructor('KeyW'),
        //     'down': new (this.actions.down as any).constructor('KeyS'),
        //     'left': new (this.actions.left as any).constructor('KeyA'), // Standard WASD: A for left
        //     'right': new (this.actions.right as any).constructor('KeyD'),// Standard WASD: D for right
        //     'run': new (this.actions.run as any).constructor('ShiftLeft'),
        //     'jump': new (this.actions.jump as any).constructor('Space'),
        //     'use': new (this.actions.use as any).constructor('KeyE'),
        //     'enter': new (this.actions.enter as any).constructor('KeyF'),
        //     'enter_passenger': new (this.actions.enter_passenger as any).constructor('KeyG'),
        //     'seat_switch': new (this.actions.seat_switch as any).constructor('KeyX'),
        //     'primary': new (this.actions.primary as any).constructor('Mouse0'),
        //     'secondary': new (this.actions.secondary as any).constructor('Mouse1'),
        // };
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Inheriting actions from super(). Original Sketchbook actions: up=${this.actions.up.eventCodes.join(',')}, down=${this.actions.down.eventCodes.join(',')}, left=${this.actions.left.eventCodes.join(',')}, right=${this.actions.right.eventCodes.join(',')}`, 'warn', undefined, undefined, undefined, 'critical');
        // --- END OVERRIDE ACTIONS ---
    }

    // OVVERRIDE FOR STANDARD WASD INTERPRETATION
    public override getLocalMovementDirection(): OriginalCharacterForOverride['orientation'] { // Match base class return type
        const charId = this.debugId || 'UnknownChar';
        // We inherit actions from Sketchbook super() constructor:
        // this.actions.left is KeyD
        // this.actions.right is KeyA
        // this.actions.up is KeyW
        // this.actions.down is KeyS

        const leftActionPressed = this.actions.left.isPressed;     // True if KeyD is pressed
        const rightActionPressed = this.actions.right.isPressed; // True if KeyA is pressed
        const upActionPressed = this.actions.up.isPressed;     // True if KeyW is pressed
        const downActionPressed = this.actions.down.isPressed; // True if KeyS is pressed

        // Original Sketchbook logic (from its getLocalMovementDirection):
        // const positiveX = this.actions.right.isPressed ? 1 : 0;  // KeyA maps to actions.right
        // const negativeX = this.actions.left.isPressed ? -1 : 0; // KeyD maps to actions.left
        // const x = positiveX + negativeX; // So, KeyA => +X, KeyD => -X

        // To achieve A => +X and D => -X:
        const x = (rightActionPressed ? 1 : 0) + (leftActionPressed ? -1 : 0);

        // Standard Z: W is +Z (forward), S is -Z (backward)
        const z = (upActionPressed ? 1 : 0) - (downActionPressed ? 1 : 0); 
        
        const moveVector = new THREE.Vector3(x, 0, z); 

        appendToCustomLog(
            `[AdaptedSKB getLocalMovementDirection ID: ${charId}] ` +
            `Inputs A(act.R):${rightActionPressed}(jp:${this.actions.right.justPressed}), D(act.L):${leftActionPressed}(jp:${this.actions.left.justPressed}), W(act.U):${upActionPressed}(jp:${this.actions.up.justPressed}), S(act.D):${downActionPressed}(jp:${this.actions.down.justPressed}) => Result_X: ${x}, Result_Z: ${z}. NormVector:(${moveVector.x.toFixed(2)},${moveVector.z.toFixed(2)})`,
            'log', 
            `SKB_GetLocalMoveDir_${charId}`,
            250, 
            undefined,
            'normal' // Changed from 'critical' 
        );
        return moveVector.normalize() as any; // Cast to any to bypass Vector3 type mismatch
    }

    // Override update to feed Three.js raycast results into legacy properties used by states
    public update(timeStep: number): void {
        const charIdForLog = this.debugId || 'unknownChar';
        // Populate this.rayHasHit and this.rayResult from this.threeRayHit *before* charState.update()
        if (this.threeRayHit) {
            this.rayHasHit = true; // This is the property original states check
            if (this.rayResult) { // Ensure rayResult exists
                this.rayResult.hasHit = true;
                this.rayResult.distance = this.threeRayHitDistance;
                if (this.threeRayHitNormal) {
                    this.rayResult.hitNormalWorld.set(this.threeRayHitNormal.x, this.threeRayHitNormal.y, this.threeRayHitNormal.z);
                }
                if (this.threeRayHitPoint) {
                    this.rayResult.hitPointWorld.set(this.threeRayHitPoint.x, this.threeRayHitPoint.y, this.threeRayHitPoint.z);
                }
                // It's generally safer to leave body and shape as null if we didn't hit a specific physics body with the Three.js ray.
                // The original states (like Falling) primarily use hitPointWorld and hitNormalWorld for setPosition.
                this.rayResult.body = null; 
                this.rayResult.shape = null;
            } else {
                 appendToCustomLog(`[AdaptedSKB UpdateOverride ID: ${charIdForLog}] CRITICAL WARNING: this.rayResult is null/undefined. Cannot set properties from threeRayHit.`, 'error', `SKB_UpdateOverride_NullRayResult_${charIdForLog}`, 0, undefined, 'critical');
            }
        } else {
            // CRITICAL ADDITION: If we're in Walk state and actively moving, give a grace period before going to Falling
            const isInWalkState = this.charState && this.charState.constructor.name === 'Walk';
            const isMoving = this.velocity.length() > 0.1;
            
            if (isInWalkState && isMoving) {
                // Keep rayHasHit true for walking states to prevent unnecessary transitions due to slopes
                this.rayHasHit = true;
                appendToCustomLog(
                    `[AdaptedSKB UpdateOverride ID: ${charIdForLog}] SLOPE PROTECTION: In Walk state and moving. ` +
                    `Setting rayHasHit=true despite threeRayHit=false to prevent unwanted transitions.`,
                    'warn', `SKB_UpdateOverride_WalkProtection_${charIdForLog}`, 1000, undefined, 'critical'
                );
            } else {
                this.rayHasHit = false;
            }
            
            if (this.rayResult) { // Ensure rayResult exists
                this.rayResult.reset();
            }
        }
        
        appendToCustomLog(
            `[AdaptedSKB UpdateOverride ID: ${charIdForLog}] PRE-SUPER.UPDATE: ` +
            `threeRayHit: ${this.threeRayHit}, ` +
            `this.rayHasHit (set from threeRay): ${this.rayHasHit}` +
            (this.rayResult ? `, legacyDist: ${this.rayResult.distance.toFixed(2)}` : ', legacyRayResult: null') +
            (this.rayHasHit && this.rayResult && this.rayResult.hitPointWorld ? `, legacyHitY: ${this.rayResult.hitPointWorld.y.toFixed(2)}` : ''),
            'log', `SKB_UpdateOverride_${charIdForLog}`, 500, undefined, 'normal'
        );

        super.update(timeStep); // This will call this.charState.update(), then this.position.copy(body.position), etc.
    }
    
    // Override the inputReceiverUpdate method to handle missing camera
    public inputReceiverUpdate(timeStep: number): void {
        try {
            if (this.controlledObject !== undefined) {
                this.controlledObject.inputReceiverUpdate(timeStep);
            } else {
                // Only access world.camera if it exists
                if (this.world && this.world.camera) {
                    // Look in camera's direction
                    // Use the Vector3 type from the parent class context
                    this.viewVector = new THREE.Vector3().subVectors(this.position as any, this.world.camera.position as any) as any; // Use type assertions
                    
                    // Only access cameraOperator if it exists
                    if (this.world.cameraOperator && this.world.cameraOperator.target) {
                        this.getWorldPosition(this.world.cameraOperator.target as any);
                    }
                } else {
                    // If camera doesn't exist, just use a default view vector
                    // Create a viewVector that matches the expected type
                    if (!this.viewVector) {
                        this.viewVector = new THREE.Vector3() as any; // Use type assertion
                    }
                    this.viewVector.set(0, 0, -1);
                }
            }
        } catch (error) {
            appendToCustomLog("[Character] Error in inputReceiverUpdate: " + (error as Error).message, 'error', undefined, undefined, undefined, 'critical');
        }
    }

    // Override physicsPreStep for logging - changed to regular method
    public physicsPreStep(): void { // CANNON.Body and character are implicitly 'this.characterCapsule.body' and 'this' now
        const body = this.characterCapsule.body;
        if (!body) {
            appendToCustomLog(`[AdaptedSKB physicsPreStep ID: ${this.debugId}] ERROR: Body is null! Attempting to skip further preStep logic.`, 'error', undefined, undefined, undefined, 'critical');
            return;
        }
        appendToCustomLog(`[AdaptedSKB physicsPreStep ID: ${this.debugId}] ENTRY. THIS.Pos: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}), Body Pos: (${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)})`, 'log', `SKB_PreStep_Entry_${this.debugId}`, 750, undefined, 'normal'); // CHANGED
        
        // Call our new Three.js based raycast
        // These module-scoped variables need to be accessible here.
        // Assuming this code is within isolatedThirdPerson.ts where they are defined.
        this.performThreeJsFeetRaycast(tpChunkMeshes, tpLastCharacterChunkX, tpLastCharacterChunkY, tpLastCharacterChunkZ);

        // Log results of our Three.js raycast
        appendToCustomLog(
            `[AdaptedSKB physicsPreStep ID: ${this.debugId}] After performThreeJsFeetRaycast. this.threeRayHit: ${this.threeRayHit}, Distance: ${this.threeRayHit ? this.threeRayHitDistance.toFixed(3) : 'N/A'}, HitNormalY: ${this.threeRayHit ? this.threeRayHitNormal.y.toFixed(3) : 'N/A'}`,
            'log', `SKB_PreStep_ThreeRayResult_${this.debugId}`, 750, undefined, 'normal' // KEPT 'normal'
        );
        
        // Call super.physicsPreStep. The original super.physicsPreStep also calls its own feetRaycast() (Cannon based),
        // which will set this.rayHasHit and this.rayResult. This is okay, as we will primarily rely on 
        // this.threeRayHit in our overridden physicsPostStep.
        super.physicsPreStep(body, this); 
    }

    // Override physicsPostStep for logging - changed to regular method
    public physicsPostStep(): void { // CANNON.Body and character are implicitly 'this.characterCapsule.body' and 'this' now
        const body = this.characterCapsule.body;
        if (!body) {
            appendToCustomLog(`[AdaptedSKB physicsPostStep ID: ${this.debugId}] ERROR: Body is null! Attempting to skip further postStep logic.`, 'error', undefined, undefined, undefined, 'critical');
            return;
        }

        const bodyVelBeforeSuper = new CANNON.Vec3(body.velocity.x, body.velocity.y, body.velocity.z);
        appendToCustomLog(`[AdaptedSKB physicsPostStep ID: ${this.debugId}] ENTRY. BodyVel BEFORE super.physicsPostStep: (${bodyVelBeforeSuper.x.toFixed(2)},${bodyVelBeforeSuper.y.toFixed(2)},${bodyVelBeforeSuper.z.toFixed(2)})`, 'log', `SKB_PostStep_Entry_${this.debugId}`, 750, undefined, 'normal'); // CHANGED

        // Call the original Character.ts physicsPostStep logic first.
        // This is important because the original method calculates velocities and handles
        // things like moving object compensation BEFORE applying final position.
        // We need those calculations, but will then override the Y position if grounded.
        // super.physicsPostStep(body, this); // This was how it was called in the original Character.ts
                                           // However, AdaptedSketchbookCharacter_Engine inherits from OriginalCharacterForOverride (which is Character)
                                           // So, we need to call its physicsPostStep.
                                           // The Original Character.physicsPostStep takes (body, character)
                                           // but since we are inside the character, 'this' is the character.
                                           // And body is this.characterCapsule.body
                                           // The Original Character.ts physicsPostStep (line 883) is:
                                           // public physicsPostStep(body: CANNON.Body, character: Character): void
                                           // We are overriding it, so we don't call super.physicsPostStep(body, this) directly in this manner.
                                           // Instead, the call to super.physicsPostStep() with no arguments should correctly call the parent's method.
        
        // super.physicsPostStep(); // This was incorrect due to argument mismatch.
        super.physicsPostStep(this.characterCapsule.body, this); // Corrected call to parent method.

        const bodyVelAfterSuper = new CANNON.Vec3(body.velocity.x, body.velocity.y, body.velocity.z);
        appendToCustomLog(`[AdaptedSKB physicsPostStep ID: ${this.debugId}] AFTER super.physicsPostStep. BodyVel: (${bodyVelAfterSuper.x.toFixed(2)},${bodyVelAfterSuper.y.toFixed(2)},${bodyVelAfterSuper.z.toFixed(2)}). ThreeRayHit (from preStep): ${this.threeRayHit}. Body Pos Y: ${body.position.y.toFixed(3)}`, 'log', `SKB_PostStep_AfterSuper_${this.debugId}`, 500, undefined, 'normal'); // CHANGED

        if (this.threeRayHit) { // Use Three.js raycast result for grounding
            // this.rayCastLength is the distance from character origin (center) to its feet.
            // this.threeRayHitPoint is the world-space point where the Three.js ray hit the terrain.
            // The character's origin should be this.rayCastLength above this.threeRayHitPoint.y.
            const targetBodyY = this.threeRayHitPoint.y + this.rayCastLength;
            const oldBodyY = body.position.y;
            
            body.position.y = targetBodyY;
            body.velocity.y = 0; // Force vertical velocity to zero when snapped
            body.interpolatedPosition.y = body.position.y; // Sync interpolated position

            appendToCustomLog(
                `[AdaptedSKB physicsPostStep SNAP_TO_GROUND (THREE.JS RAY) ID: ${this.debugId}] Applied snap. ` +
                `OldBodyY: ${oldBodyY.toFixed(3)}, HitPointY: ${this.threeRayHitPoint.y.toFixed(3)}, TargetY: ${targetBodyY.toFixed(3)}, Final BodyY: ${body.position.y.toFixed(3)}, Final BodyVelY: ${body.velocity.y.toFixed(3)}`,
                'log', `SKB_PostStep_SnapThree_${this.debugId}`, 500, undefined, 'normal' // CHANGED
            );
        } else {
            // threeRayHit is false: We are in the air according to our Three.js raycast.
            // The Y velocity should be whatever super.physicsPostStep calculated (which should include gravity).
            appendToCustomLog(
                `[AdaptedSKB physicsPostStep IN_AIR (THREE.JS RAY) ID: ${this.debugId}] No snap (ThreeRayHit: false). ` +
                `BodyY: ${body.position.y.toFixed(3)}, BodyVelY: ${body.velocity.y.toFixed(3)} (this is from super, should reflect gravity if super also deems it falling)`,
                'log', `SKB_PostStep_InAirThree_${this.debugId}`, 500, undefined, 'normal' // CHANGED
            );
        }
    }

    // Override handleMouseWheel to prevent crash if this.world is undefined
    public handleMouseWheel(event: WheelEvent, value: number): void {
        if (this.world && typeof (this.world as any).scrollTheTimeScale === 'function') {
            (this.world as any).scrollTheTimeScale(value);
        } else {
            appendToCustomLog(`[AdaptedSKB handleMouseWheel ID: ${this.debugId}] this.world or this.world.scrollTheTimeScale is not available. Character world exists: ${!!this.world}`, 'warn', undefined, undefined, undefined, 'critical');
        }
    }

    // Override handleMouseMove to handle mouse input
    public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void {
        appendToCustomLog(`[AdaptedSKB handleMouseMove ID: ${this.debugId}] Firing.`, 'log', undefined, undefined, undefined, 'critical');
        if (!this.world) {
            appendToCustomLog(`[AdaptedSKB handleMouseMove ID: ${this.debugId}] ERROR: this.world is undefined!`, 'error', undefined, undefined, undefined, 'critical');
            return; 
        }
        appendToCustomLog(`[AdaptedSKB handleMouseMove ID: ${this.debugId}] this.world is defined. Accessing this.world.cameraOperator is null: ${(this.world as any).cameraOperator === null}`, 'log', undefined, undefined, undefined, 'critical');

        if (!(this.world as any).cameraOperator) {
            appendToCustomLog(`[AdaptedSKB handleMouseMove ID: ${this.debugId}] ERROR: this.world.cameraOperator is undefined or null!`, 'error', undefined, undefined, undefined, 'critical');
            return; 
        }
        super.handleMouseMove(event, deltaX, deltaY);
    }

    // [REMOVED] - Duplicate setState method was here - now using the enhanced version below

    // Override addToWorld to add detailed logging
    public addToWorld(world: any): void { // world is effectively SketchbookWorldAdapter, use any for broader compatibility
        appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Called. Adapter world: ${world?.constructor?.name}. Physics world on adapter: ${!!world?.physicsWorld}`, 'log', undefined, undefined, undefined, 'critical');

        if (this.world === world) {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Short-circuit: Character already processed for this world. Body ID: ${this.characterCapsule?.body?.id}. Body in world: ${!!this.characterCapsule?.body?.world}`, 'warn', undefined, undefined, undefined, 'critical');
            // If already in this world, and body is in a physics world, assume setup is complete for this call context.
            // If body isn't in a world yet, let it proceed.
            if (this.characterCapsule?.body?.world) return;
        } else if (this.world !== undefined) {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Warning: Character is currently in a DIFFERENT world ('${this.world?.constructor?.name}'). Attempting to move to new world ('${world?.constructor?.name}'). This might require prior removal.`, 'warn', undefined, undefined, undefined, 'critical');
            // Consider calling this.removeFromWorld(this.world); if applicable and implemented robustly.
        }

        if (!world || !world.physicsWorld || typeof world.physicsWorld.addBody !== 'function') {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] CRITICAL ERROR: Adapter world, its physicsWorld, or addBody method is missing. Cannot add body to physics.`, 'error', undefined, undefined, undefined, 'critical');
            return;
        }

        if (!this.characterCapsule || !this.characterCapsule.body) {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] CRITICAL ERROR: Character capsule or body is missing. Cannot add body to physics.`, 'error', undefined, undefined, undefined, 'critical');
            return;
        }

        const bodyToAdd = this.characterCapsule.body;
        let bodyWasAlreadyInTargetPhysics = false;

        // Check if the body is ALREADY in the target physicsWorld's list of bodies
        if (world.physicsWorld.bodies.includes(bodyToAdd)) {
            bodyWasAlreadyInTargetPhysics = true;
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Body ID ${bodyToAdd.id} is ALREADY in the target adapter's physicsWorld.bodies array. Body.world is currently: ${bodyToAdd.world || 'null'}`, 'warn', undefined, undefined, undefined, 'critical');
        }

        // Add to physics world if not already there, or if its .world property is not set to this physics world
        if (!bodyWasAlreadyInTargetPhysics || bodyToAdd.world !== world.physicsWorld) {
            if (!bodyWasAlreadyInTargetPhysics) {
                appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Adding body ID ${bodyToAdd.id} to adapter's physicsWorld. Current body.world: ${bodyToAdd.world || 'null'}`, 'log', undefined, undefined, undefined, 'critical');
            } else {
                appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Body ID ${bodyToAdd.id} was in bodies array, but body.world incorrect. Re-adding/Ensuring link for body to adapter's physicsWorld. Current body.world: ${bodyToAdd.world || 'null'}`, 'warn', undefined, undefined, undefined, 'critical');
                // Cannon-es might not update body.world if addBody is called for an existing body.
                // It also might not re-add if already present. Explicitly removing and re-adding can be an option if issues persist,
                // but for now, we'll just call addBody and then check/set body.world.
            }
            world.physicsWorld.addBody(bodyToAdd);
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] AFTER world.physicsWorld.addBody(). Body's .world property: ${bodyToAdd.world || 'null'}. Target world body count: ${world.physicsWorld.bodies.length}`, 'log', undefined, undefined, undefined, 'critical');
        } 
        
        // Crucially, ensure the body's .world property points to the correct physics world instance.
        // This might not be automatically set by addBody if the body was already in the .bodies array
        // or if cannon-es behaves differently in some edge cases.
        if (bodyToAdd.world !== world.physicsWorld) {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Body.world ('${bodyToAdd.world || 'null'}') is NOT the target physicsWorld. Forcing assignment.`, 'warn', undefined, undefined, undefined, 'critical');
            bodyToAdd.world = world.physicsWorld;
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] AFTER FORCED ASSIGNMENT: Body.world is now: ${bodyToAdd.world || 'null'}`, 'log', undefined, undefined, undefined, 'critical');
        }

        // Set the character's logical world reference (to the SketchbookWorldAdapter)
        this.world = world;
        appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Set this.world to the adapter ('${this.world?.constructor?.name}').`, 'log', undefined, undefined, undefined, 'critical');

        // Original Character.ts addToWorld also calls world.add(this) for graphics/updatables.
        // This is NOT done here because SketchbookWorldAdapter.add(character) is the initial caller
        // and it will handle adding 'this' (the character) to its own updatables/graphics lists AFTER this method returns.
        // Calling world.add(this) here would lead to recursion.

        // Event listeners (preStep/postStep) are now directly assigned to the body in the AdaptedSKBCharacter_Engine constructor,
        // so no need to add/remove them here via body.addEventListener/removeEventListener.

        bodyToAdd.allowSleep = false;
        appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] Set body.allowSleep = false for body ID: ${bodyToAdd.id}.`, 'log', undefined, undefined, undefined, 'critical');

        // Final verification
        if (bodyToAdd.world === world.physicsWorld) {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] COMPLETED SUCCESSFULLY. Body ID ${bodyToAdd.id} is linked to the correct physics world. this.world is set.`, 'log', `SKB_AddToWorld_Success_${this.debugId}`, 0, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB addToWorld ID: ${this.debugId}] CRITICAL COMPLETION WARNING: Body ID ${bodyToAdd.id} .world ('${bodyToAdd.world || 'null'}') does NOT point to the target physics world. This indicates a persistent issue.`, 'error', `SKB_AddToWorld_Fail_${this.debugId}`, 0, undefined, 'critical');
        }
    }

    private _performAndLogFeetRaycast(): void {
        if (!this.characterCapsule || !this.characterCapsule.body) {
            appendToCustomLog(`[AdaptedSKB FeetRaycast ID: ${this.debugId}] ERROR: Character capsule or body is missing!`, 'error', undefined, undefined, undefined, 'critical');
            this.rayHasHit = false;
            return;
        }
        if (!this.world || !this.world.physicsWorld) {
            appendToCustomLog(`[AdaptedSKB FeetRaycast ID: ${this.debugId}] ERROR: World or physicsWorld is missing!`, 'error', undefined, undefined, undefined, 'critical');
            this.rayHasHit = false;
            return;
        }

        const body = this.characterCapsule.body; // Keep as is, should be CANNON.Body from constructor
        
        // Be hyper-explicit that x, y, z are numbers for the CANNON.Vec3 constructor
        const bodyPosX = Number((body.position as any).x);
        const bodyPosY = Number((body.position as any).y);
        const bodyPosZ = Number((body.position as any).z);

        const rayDownwardExtension = 5.0; // How much further than rayCastLength to cast downwards
        const totalRayDownwardLength = this.rayCastLength + rayDownwardExtension;

        const start = new CANNON.Vec3(bodyPosX, bodyPosY, bodyPosZ); // Start AT body center
        const end = new CANNON.Vec3(bodyPosX, bodyPosY - totalRayDownwardLength, bodyPosZ); // End significantly below feet
        
        const rayCastOptions = {
            collisionFilterMask: CollisionGroups.Default, // From imported CollisionGroups
            skipBackfaces: true
        };

        appendToCustomLog(
            `[AdaptedSKB FeetRaycast ID: ${this.debugId}] Pre-Cast Details: ` +
            `Char Body Pos: (${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}), ` +
            `Ray Start: (${start.x.toFixed(2)}, ${start.y.toFixed(2)}, ${start.z.toFixed(2)}), ` +
            `Ray End: (${end.x.toFixed(2)}, ${end.y.toFixed(2)}, ${end.z.toFixed(2)}), ` +
            `Ray Length Total: ${totalRayDownwardLength.toFixed(2)}, ` +
            `Mask: ${rayCastOptions.collisionFilterMask}, SkipBackfaces: ${rayCastOptions.skipBackfaces}`,
            'log',
            'SKB_FeetRaycast_Pre', // throttle key
            1000, // throttle ms
            undefined, // typeThrottleMs
            'critical' // importance
        );

        // Create a local RaycastResult for this specific raycast call
        const localRayResult = new CANNON.RaycastResult(); 

        // Cast the ray
        // Cast start and end to any to bypass persistent Vec3 type mismatch for raycastClosest
        // Cast localRayResult to any as a last resort for type checking this call
        this.rayHasHit = this.world.physicsWorld.raycastClosest(start as any, end as any, rayCastOptions, localRayResult as any);

        // If hit, copy essential data from localRayResult to this.rayResult for compatibility with base class logic
        if (this.rayHasHit) {
            this.rayResult.body = localRayResult.body;
            this.rayResult.distance = localRayResult.distance;
            this.rayResult.hasHit = localRayResult.hasHit;
            this.rayResult.hitFaceIndex = localRayResult.hitFaceIndex;
            this.rayResult.hitNormalWorld.copy(localRayResult.hitNormalWorld);
            this.rayResult.hitPointWorld.copy(localRayResult.hitPointWorld);
            this.rayResult.rayFromWorld.copy(localRayResult.rayFromWorld);
            this.rayResult.rayToWorld.copy(localRayResult.rayToWorld);
            this.rayResult.shape = localRayResult.shape;
        } else {
            this.rayResult.reset(); // Ensure this.rayResult is also reset if no hit
        }

        // --- Restore original rayCastLength if changed for diagnosis ---
        // this.rayCastLength = originalRayCastLength;

        // --- DEBUG RAY VISUALIZATION ---
        if (this.world && (this.world as any).graphicsWorld) {
            const scene = (this.world as any).graphicsWorld as THREE.Scene;
            const material = new THREE.LineBasicMaterial({ color: this.rayHasHit ? 0x00ff00 : 0xff0000, depthTest: false, depthWrite: false, transparent: true, opacity: 0.8 });
            const points = [];
            points.push(new THREE.Vector3(start.x, start.y, start.z));
            points.push(new THREE.Vector3(end.x, end.y, end.z));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.renderOrder = 999; // Render on top
            scene.add(line);
            setTimeout(() => { if (line.parent) line.parent.remove(line); geometry.dispose(); material.dispose(); }, 300); // Adjusted timeout & cleanup
        }
        // --- END DEBUG RAY VISUALIZATION ---


        appendToCustomLog(
            `[AdaptedSKB FeetRaycast ID: ${this.debugId}] POST-CAST - RayHasHit: ${this.rayHasHit}`,
            'log',
            'SKB_FeetRaycast_PostHit', // throttle key
            1000, // throttle ms
            undefined, // typeThrottleMs
            'critical' // importance
        );

        if (this.rayHasHit && this.rayResult.body) { // Check this.rayResult.body which should now be populated
            const hitBody = this.rayResult.body;
            appendToCustomLog(
                `[AdaptedSKB FeetRaycast ID: ${this.debugId}] HIT INFO: ` +
                `Hit Point: (${this.rayResult.hitPointWorld.x.toFixed(2)}, ${this.rayResult.hitPointWorld.y.toFixed(2)}, ${this.rayResult.hitPointWorld.z.toFixed(2)}), ` +
                `Hit Normal Y: ${this.rayResult.hitNormalWorld.y.toFixed(3)}, ` +
                `Hit Distance: ${this.rayResult.distance.toFixed(2)}, ` +
                `Hit Body Mass: ${hitBody.mass}, ` +
                `Hit Body Group: ${hitBody.collisionFilterGroup}, ` +
                `Hit Body Mask: ${hitBody.collisionFilterMask}, ` +
                `Hit Body Type: ${hitBody.type === CANNON.Body.STATIC ? 'Static' : (hitBody.type === CANNON.Body.DYNAMIC ? 'Dynamic' : 'Kinematic')}`,
                'log',
                'SKB_FeetRaycast_HitInfo', // throttle key
                1000, // throttle ms
                undefined, // typeThrottleMs
                'critical' // importance
            );
        }
    }

    public setAnimation(clipName: string, fadeIn: number): number {
        const charId = this.debugId || 'UnknownChar';
        appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] CALLED. Current: '${this._currentAnimation}', Req: '${clipName}'`, 'log', `SKB_SetAnim_Call_${charId}`, 0, undefined, 'critical');

        if (!this.mixer) {
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Mixer is UNDEFINED. Cannot play '${clipName}'.`, 'error', `SKB_SetAnim_NoMixer_${charId}`, 0, undefined, 'critical');
            return 0;
        }
        if (!this.animations || this.animations.length === 0) {
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] NO animations loaded on character. Cannot play '${clipName}'.`, 'error', `SKB_SetAnim_NoAnims_${charId}`, 0, undefined, 'critical');
            return 0;
        }

        const targetClip = THREE.AnimationClip.findByName(this.animations, clipName);
        if (!targetClip) {
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Clip '${clipName}' NOT FOUND. Animations available: ${this.animations.map(a => a.name).join(', ')}`, 'error', `SKB_SetAnim_ClipNotFound_${charId}`, 0, undefined, 'critical');
            return 0;
        }

        const currentAction = (this as any)._animationState?.action as THREE.AnimationAction | undefined;
        const currentPlayingClipName = (this as any)._animationState?.name as string | undefined;

        // If the requested animation (clipName) is already set as the current one in _animationState and its action is running
        if (currentPlayingClipName === clipName && currentAction && currentAction.isRunning()) {
            // appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Animation '${clipName}' is already current and running. Duration: ${targetClip.duration}`, 'log', `SKB_SetAnim_AlreadyRunning_${charId}`, 1000, undefined, 'normal');
            return targetClip.duration; // Return the duration of the clip that's already playing
        }
        
        // appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Proceeding to call super.setAnimation for '${clipName}'. Current in _animationState: '${currentPlayingClipName}'`, 'log', `SKB_SetAnim_ProceedSuper_${charId}`, 0, undefined, 'critical');

        const durationFromSuper = super.setAnimation(clipName, fadeIn);
        let duration = durationFromSuper;

        // Force duration for start_* and stop animations if super returned 0
        // This is because the original states (e.g., StartWalkBase) rely on a positive animationLength
        // to transition out of the state. If super.setAnimation returns 0 (e.g. for a very short clip or error),
        // the state machine would get stuck.
        if (clipName.startsWith('start_')) {
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] SPECIAL LOG FOR '${clipName}': super.setAnimation returned duration: ${durationFromSuper}`, 'error', `SKB_SetAnim_StartAnimDur_${charId}_${clipName}`, 0, undefined, 'critical');
            if (durationFromSuper <= 0) {
                duration = 0.5; // FORCE DURATION FOR TESTING START ANIMATIONS
                appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] WARNING: '${clipName}' got <=0 duration from super. FORCING to ${duration}s for testing. This might override a valid short animation.`, 'warn', `SKB_SetAnim_ForceDur_${charId}_${clipName}`, 0, undefined, 'critical');
            }
        } else if (clipName === 'stop') { // Assuming 'stop' is a specific animation name for stopping movement sequences
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] SPECIAL LOG FOR 'stop': super.setAnimation returned duration: ${durationFromSuper}`, 'error', `SKB_SetAnim_StopAnimDur_${charId}`, 0, undefined, 'critical');
            if (durationFromSuper <= 0) {
                duration = 0.5; // FORCE DURATION FOR TESTING STOP ANIMATION
                appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] WARNING: 'stop' got <=0 duration from super. FORCING to ${duration}s for testing. This might override a valid short animation.`, 'warn', `SKB_SetAnim_ForceDur_Stop_${charId}`, 0, undefined, 'critical');
            }
        }

        if (duration > 0) { // If super (or our override) resulted in a positive duration
            this._currentAnimation = clipName; // Adapter's own tracking property
            
            // Get the action for the targetClip. super.setAnimation should have already created and played this action.
            // targetClip was already validated at the start of this function.
            const actionToModify = this.mixer.clipAction(targetClip as any); // Cast to any for linter

            if (actionToModify) {
                // Adapter explicitly sets loop mode here based on clipName.
                // One-shot animations (start_*, stop) should not loop.
                // Sustained animations (walk, idle, run) should loop.
                if (clipName.startsWith('start_') || clipName === 'stop') {
                    actionToModify.setLoop(THREE.LoopOnce, 1);
                    actionToModify.clampWhenFinished = true; // Hold the last frame when finished
                    appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Set ONE-SHOT mode for '${clipName}'. Loop: LoopOnce, ClampWhenFinished: true`, 'log', `SKB_SetAnim_OneShot_${charId}_${clipName}`, 0, undefined, 'critical');
                } else {
                    actionToModify.setLoop(THREE.LoopRepeat, Infinity);
                    appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] Set LOOPING mode for '${clipName}'. Loop: LoopRepeat, Infinity`, 'log', `SKB_SetAnim_Loop_${charId}_${clipName}`, 0, undefined, 'normal');
                }
            } else {
                appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] CRITICAL ERROR: Could not get action for '${clipName}' after super.setAnimation.`, 'error', `SKB_SetAnim_NoAction_${charId}_${clipName}`, 0, undefined, 'critical');
            }
        } else {
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] CRITICAL ERROR: Duration is 0 or negative (${duration}) for '${clipName}'. Animation will NOT work properly.`, 'error', `SKB_SetAnim_ZeroDur_${charId}_${clipName}`, 0, undefined, 'critical');
        }

        // Additional debug for stop animation specifically - check the actual clip duration
        if (clipName === 'stop') {
            const actualClipDuration = targetClip ? targetClip.duration : 'unknown';
            const clipTracks = targetClip ? targetClip.tracks.length : 0;
            appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] STOP ANIMATION DETAILS - Actual clip duration: ${actualClipDuration}, Tracks: ${clipTracks}, Final returned duration: ${duration}`, 'warn', `SKB_StopAnim_Details_${charId}`, 0, undefined, 'critical');
            
            // If we have a mixer, ensure EndWalk can detect the end of this animation
            if (this.mixer) {
                const action = this.mixer.existingAction(targetClip as any);
                if (action) {
                    const actionIsRunning = action.isRunning();
                    const actionTime = action.time;
                    const actionTimeScale = action.timeScale;
                    const actionWeight = action.weight;
                    appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] STOP ANIMATION ACTION - IsRunning: ${actionIsRunning}, Time: ${actionTime}, TimeScale: ${actionTimeScale}, Weight: ${actionWeight}`, 'warn', `SKB_StopAnim_Action_${charId}`, 0, undefined, 'critical');
                } else {
                    appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] STOP ANIMATION - No existing action found!`, 'error', `SKB_StopAnim_NoAction_${charId}`, 0, undefined, 'critical');
                }
            }
        }

        appendToCustomLog(`[AdaptedSKB setAnimation ID: ${charId}] COMPLETED for '${clipName}'. Returning duration: ${duration}`, 'log', `SKB_SetAnim_Complete_${charId}_${clipName}`, 0, undefined, 'critical');
        return duration;
    }

    public performThreeJsFeetRaycast(currentChunkMeshes: ChunkMeshesRef, currentCharChunkX: number, currentCharChunkY: number, currentCharChunkZ: number): void {
        if (!this.characterCapsule || !this.characterCapsule.body) {
            appendToCustomLog(`[AdaptedSKB ThreeFeetRaycast ID: ${this.debugId}] ERROR: Character capsule or body is missing!`, 'error', undefined, undefined, undefined, 'critical');
            this.threeRayHit = false;
            return;
        }

        const bodyPos = this.characterCapsule.body.position;
        const rayOrigin = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z); // Ray starts at body center

        this.threeGroundRaycaster.ray.origin.copy(rayOrigin);
        // Direction is already set to (0, -1, 0) in constructor
        
        // INCREASE THE RAYCAST FAR VALUE TEMPORARILY FOR STEEP SLOPES
        const originalFar = this.threeGroundRaycaster.far;
        this.threeGroundRaycaster.far = this.rayCastLength + 15.0; // Increased from 10 to 15 units to better handle steep slopes

        const meshesToIntersect: THREE.Mesh[] = [];
        // EXPAND THE Y-LEVEL CHECK RANGE TO BETTER HANDLE SLOPES
        const Y_LEVELS_TO_CHECK = [-1, 0, 1]; // Check multiple Y levels

        // Collect meshes from current and immediate neighbor chunks on the XZ plane at multiple Y levels
        for (let dy of Y_LEVELS_TO_CHECK) {
            const yLevelToCheck = currentCharChunkY + dy;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const chunkKey = getChunkKeyY(currentCharChunkX + dx, yLevelToCheck, currentCharChunkZ + dz);
                    if (currentChunkMeshes[chunkKey]) {
                        meshesToIntersect.push(currentChunkMeshes[chunkKey]);
                    }
                }
            }
        }

        if (meshesToIntersect.length === 0) {
            appendToCustomLog(`[AdaptedSKB ThreeFeetRaycast ID: ${this.debugId}] No meshes to intersect for raycast. CharChunk: ${currentCharChunkX},${currentCharChunkY},${currentCharChunkZ}`, 'warn', `ThreeRay_NoMesh_${this.debugId}`, 1000, undefined, 'normal'); // CHANGED from critical
            this.threeRayHit = false;
            return;
        }

        const intersections = this.threeGroundRaycaster.intersectObjects(meshesToIntersect, false); // false for non-recursive

        if (intersections.length > 0) {
            // Find the closest valid intersection (not with the character itself, though unlikely with current setup)
            let closestHit = null;
            for (const hit of intersections) {
                if (hit.object !== (this.modelContainer as any) && hit.object !== (this.tiltContainer as any)) { // Basic self-intersection check
                    if (!closestHit || hit.distance < closestHit.distance) {
                        closestHit = hit;
                    }
                }
            }

            if (closestHit) {
                this.threeRayHit = true;
                this.threeRayHitPoint.copy(closestHit.point);
                this.threeRayHitNormal.copy(closestHit.face?.normal || new THREE.Vector3(0, 1, 0)); // Use face normal if available
                // If the hit normal is part of a transformed object, transform it to world space
                if (closestHit.face?.normal && closestHit.object.matrixWorld) {
                    const worldNormal = closestHit.face.normal.clone().transformDirection(closestHit.object.matrixWorld).normalize();
                    this.threeRayHitNormal.copy(worldNormal);
                }
                this.threeRayHitDistance = closestHit.distance;

                // SLOPE CHECK: If on a steep slope, log it
                if (this.threeRayHitNormal.y < 0.5) { // Less than 60 degrees from horizontal
                    appendToCustomLog(
                        `[AdaptedSKB ThreeFeetRaycast ID: ${this.debugId}] ON STEEP SLOPE! Normal Y: ${this.threeRayHitNormal.y.toFixed(3)}, ` +
                        `Dist: ${this.threeRayHitDistance.toFixed(3)}`, 
                        'warn', `ThreeRay_SteepSlope_${this.debugId}`, 1000, undefined, 'critical'
                    );
                }

                appendToCustomLog(
                    `[AdaptedSKB ThreeFeetRaycast ID: ${this.debugId}] HIT! Dist: ${this.threeRayHitDistance.toFixed(3)}, ` +
                    `Point: (${this.threeRayHitPoint.x.toFixed(2)},${this.threeRayHitPoint.y.toFixed(2)},${this.threeRayHitPoint.z.toFixed(2)}), ` +
                    `NormalY: ${this.threeRayHitNormal.y.toFixed(3)}, Object: ${closestHit.object.name || 'Unnamed'}`, 
                    'log', `ThreeRay_Hit_${this.debugId}`, 500, undefined, 'normal' // CHANGED from critical
                );
            } else {
                this.threeRayHit = false; // All hits were self-intersections or invalid
            }
        } else {
            this.threeRayHit = false;
        }

        // Restore original far value
        this.threeGroundRaycaster.far = originalFar;

        if (!this.threeRayHit) {
            appendToCustomLog(`[AdaptedSKB ThreeFeetRaycast ID: ${this.debugId}] NO HIT. Origin: (${rayOrigin.x.toFixed(2)},${rayOrigin.y.toFixed(2)},${rayOrigin.z.toFixed(2)}). Meshes checked: ${meshesToIntersect.length}`, 'log', `ThreeRay_NoHit_${this.debugId}`, 500, undefined, 'normal'); // KEPT 'normal'
        }
    }

    // Override handleKeyboardEvent to log inputs and action states
    public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void {
        const charId = this.debugId || 'unknownChar';
        appendToCustomLog(`[AdaptedSKB handleKeyboardEvent ID: ${charId}] Event: ${event.type}, Code: ${code}, Pressed: ${pressed}`, 'log', `AdaptedSKB_KeyEvent_${charId}`, 0, undefined, 'normal');

        // Call super implementation first
        super.handleKeyboardEvent(event, code, pressed);

        // CRITICAL FIX: Force correct action states for WASD keys after super call
        // In original Sketchbook:
        // - KeyW controls actions.up (this is correct)
        // - KeyS controls actions.down (this is correct)
        // - KeyA is mapped to actions.right (THIS IS WRONG, should be left)
        // - KeyD is mapped to actions.left (THIS IS WRONG, should be right)
        
        if (code === 'KeyA') {
            // For KeyA, explicitly override to ensure it controls 'left' action
            // Track previous state before updating
            const wasPressed = this.actions.left.isPressed;
            this.actions.left.isPressed = pressed;
            this.actions.left.justPressed = pressed && !wasPressed;
            
            // Since KeyA in original maps to right, make sure it's not active
            if (pressed) {
                this.actions.right.isPressed = false;
                this.actions.right.justPressed = false;
            }
            
            // Trigger state's onInputChange to handle this change immediately
            if (this.charState && this.charState.onInputChange) {
                this.charState.onInputChange();
            }
        }
        else if (code === 'KeyD') {
            // For KeyD, explicitly override to ensure it controls 'right' action
            // Track previous state before updating
            const wasPressed = this.actions.right.isPressed;
            this.actions.right.isPressed = pressed;
            this.actions.right.justPressed = pressed && !wasPressed;
            
            // Since KeyD in original maps to left, make sure it's not active
            if (pressed) {
                this.actions.left.isPressed = false;
                this.actions.left.justPressed = false;
            }
            
            // Trigger state's onInputChange to handle this change immediately
            if (this.charState && this.charState.onInputChange) {
                this.charState.onInputChange();
            }
        }

        appendToCustomLog(`[AdaptedSKB handleKeyboardEvent ID: ${charId}] AFTER SUPER. Log for key ${code}: ${code === 'KeyW' ? 'up' : (code === 'KeyS' ? 'down' : (code === 'KeyA' ? 'left' : (code === 'KeyD' ? 'right' : 'other')))}: ${code === 'KeyW' ? JSON.stringify(this.actions.up) : (code === 'KeyS' ? JSON.stringify(this.actions.down) : (code === 'KeyA' ? JSON.stringify(this.actions.left) : (code === 'KeyD' ? JSON.stringify(this.actions.right) : '{}')))}`, 'log', `AdaptedSKB_KeyAfter_${charId}`, 0, undefined, 'normal');
    }

    // Override fallInAir method to provide better stability on slopes
    public fallInAir(timeStep: number): void {
        const charId = this.debugId || 'unknownChar';
        const currentStateName = this.charState?.constructor.name || 'None';
        
        // Critical improvement for terrain: If we're walking and input keys are pressed, 
        // provide more stability by ignoring temporary raycast misses
        const isWalking = currentStateName === 'Walk' || currentStateName === 'Sprint';
        const isMoving = this.velocity.length() > 0.1;
        const anyDirectionPressed = 
            this.actions.up.isPressed || 
            this.actions.down.isPressed || 
            this.actions.left.isPressed || 
            this.actions.right.isPressed;
        
        // Get the normalized Y component of the ground normal (1.0 = flat, 0.0 = vertical)
        const normalY = this.threeRayHitNormal?.y || 1.0;
        
        // *** IMPORTANT CHANGE: MORE RELAXED SLOPE LIMIT CALCULATION ***
        // Lower the slope limit threshold to allow movement on steeper terrain without triggering falling
        // Use a dynamic slope limit based on player movement state
        let effectiveSlopeLimit = anyDirectionPressed ? 0.35 : 0.5;
        
        // If the player is actively moving, be even more tolerant of slopes
        if (isMoving && anyDirectionPressed) {
            effectiveSlopeLimit = 0.3; // Even more permissive when actively moving (steeper slopes)
        }
        
        const isSlopeTooSteep = normalY < effectiveSlopeLimit;
        
        // Add critical diagnostics to help diagnose fall transitions
        appendToCustomLog(
            `[Patched FallInAir ID: ${charId}] Character: ${this.constructor.name}, State: ${currentStateName}, ` +
            `rayHasHit: ${this.rayHasHit}, hitNormalY: ${normalY.toFixed(3)}, ` +
            `slopeLimit: ${effectiveSlopeLimit.toFixed(3)}, isSlopeTooSteep: ${isSlopeTooSteep}, ` +
            `ConditionMet: ${(!this.rayHasHit || (this.rayHasHit && isSlopeTooSteep))}`,
            'log', `FallInAir_Diagnostics_${charId}`, 1000, undefined, 'normal'
        );
        
        // *** KEY FIX: PRIORITIZE ANIMATION CONTINUITY ***
        // Only consider falling when absolutely necessary
        
        // If we're on ANY slope and walking/sprinting, prioritize continuing the animation
        if (this.rayHasHit && normalY > 0.5 && (isWalking || anyDirectionPressed)) {
            // We're on terrain and either walking or actively pressing direction keys
            // Don't transition to falling state at all by resetting the timer
            this.timeSinceLastGroundContact = 0;
            
            appendToCustomLog(
                `[Patched FallInAir ID: ${charId}] ANIMATION STABILITY: Forcing grounded state for ${currentStateName} ` +
                `with normalY: ${normalY.toFixed(3)} on terrain to prevent animation interruption.`,
                'warn', `FallInAir_AnimStability_${charId}`, 1000, undefined, 'critical'
            );
            
            return; // Skip the rest of the falling logic completely
        }
        
        // Provide additional grace period for character on moderate slopes
        if (this.rayHasHit && normalY < 0.85 && normalY >= effectiveSlopeLimit) {
            // We're on a slope but not too steep (terrain is walkable)
            // Extend the grounding grace period to avoid unwanted falling transitions
            const originalTimeSinceGround = this.timeSinceLastGroundContact;
            this.timeSinceLastGroundContact = Math.min(this.timeSinceLastGroundContact, this.GROUNDED_GRACE_PERIOD * 0.25);
            
            // Only log if we actually modified something
            if (originalTimeSinceGround !== this.timeSinceLastGroundContact) {
                appendToCustomLog(
                    `[Patched FallInAir ID: ${charId}] SLOPE STABILITY: Extended grace period ` +
                    `(${originalTimeSinceGround.toFixed(3)}s → ${this.timeSinceLastGroundContact.toFixed(3)}s) ` +
                    `for ${currentStateName} with normalY: ${normalY.toFixed(3)} on slope.`,
                    'warn', `FallInAir_SlopeStability_${charId}`, 1000, undefined, 'critical'
                );
            }
        }
        
        // Dynamically adjust the slope limit based on player input
        // This is similar to how firstPerson.ts handles movement on terrain
        if (normalY < 0.5 && anyDirectionPressed) {
            this.slopeLimit = 0.35; // Allow climbing steeper slopes when actively moving
        } else {
            this.slopeLimit = 0.5; // Default slope limit
        }
    }

    // Override setState to intercept and adapt StartWalkForward state
    public override setState(newState: any): void {
        const charId = this.debugId || 'unknownChar';
        const oldStateName = this.charState?.constructor.name || 'None';
        
        // Check if the new state is StartWalkForward and replace it with our adapted version
        if (newState instanceof StartWalkForward) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'StartWalkForward'. Replacing with AdaptedStartWalkForwardState`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Replace with our adapted version
            newState = new AdaptedStartWalkForwardState(this);
        }
        // Check if the new state is StartWalkRight and replace it with our adapted version
        else if (newState instanceof StartWalkRight && !(newState instanceof AdaptedStartWalkRightState)) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'StartWalkRight'. Replacing with AdaptedStartWalkRightState`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Replace with our adapted version
            newState = new AdaptedStartWalkRightState(this);
        }
        // Check if the new state is StartWalkLeft and replace it with our adapted version
        else if (newState instanceof StartWalkLeft && !(newState instanceof AdaptedStartWalkLeftState)) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'StartWalkLeft'. Replacing with AdaptedStartWalkLeftState`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Replace with our adapted version
            newState = new AdaptedStartWalkLeftState(this);
        }
        // Removed StartWalkBackward check since it doesn't exist
        // Check if the new state is Walk and replace it with our adapted version
        else if (newState instanceof Walk && !(newState instanceof AdaptedWalkState)) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'Walk'. Replacing with AdaptedWalkState`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Replace with our adapted version
            newState = new AdaptedWalkState(this);
        }
        // Check if the new state is EndWalk and replace it with our adapted version
        else if (newState instanceof EndWalk && !(newState instanceof AdaptedEndWalk)) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'EndWalk'. Replacing with AdaptedEndWalk`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Replace with our adapted version
            newState = new AdaptedEndWalk(this);
        }
        // Check if the new state is Idle and handle appropriately 
        else if (newState instanceof Idle) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO 'Idle'. Using default Idle state.`, 'warn', `AdaptedSKB_IdleToDefault_${charId}`, 0, undefined, 'critical');
            
            // Keep using the original Idle state
            // We could replace with AdaptedWalkState if immediate movement is needed
            // newState = new AdaptedWalkState(this);
        }
        // Fix for IdleRotateLeft/IdleRotateRight never being allowed to activate
        else if (newState && (newState.constructor.name === 'IdleRotateLeft' || newState.constructor.name === 'IdleRotateRight')) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Special handling for ${newState.constructor.name}`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            
            // Prevent immediate transition back to Idle by patching the animation ended check
            if (newState.animationEnded) {
                const originalAnimationEnded = newState.animationEnded;
                newState.animationEnded = (timeStep: number) => {
                    // Allow animation to play for at least 0.3 seconds before checking if it ended
                    if (!newState._patchedAnimStartTime) {
                        newState._patchedAnimStartTime = Date.now();
                        return false;
                    }
                    
                    const elapsed = (Date.now() - newState._patchedAnimStartTime) / 1000;
                    if (elapsed < 0.3) {
                        return false;
                    }
                    
                    return originalAnimationEnded.call(newState, timeStep);
                };
                appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] PATCHED ${newState.constructor.name}.animationEnded() to prevent premature Idle transition`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
            }
        }
        else {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] Changing state FROM '${oldStateName}' TO '${newState?.constructor.name}'. Passed state object valid (has enter/exit/update): ${!!(newState?.enter && newState?.exit && newState?.update)}. Passed state constructor: ${newState?.constructor.name}`, 'log', `AdaptedSKB_SetState_${charId}`, 0, undefined, 'normal');
        }
        
        // Call the original setState with our potentially adapted state
        super.setState(newState);
        
        // Check what happened after calling super
        const resultingStateName = this.charState?.constructor?.name || 'None';
        if (newState?.constructor?.name !== resultingStateName) {
            appendToCustomLog(`[AdaptedSKB setState ID: ${charId}] POST-SUPER (after potential re-wire): Target='${newState?.constructor?.name}', Actual Result='${resultingStateName}'. MISMATCH! Expected '${newState?.constructor?.name}', but got '${resultingStateName}'. State before super was: '${oldStateName}'. charState object after super is an instance of ${this.charState?.constructor?.name}.`, 'warn', `AdaptedSKB_SetStateMismatch_${charId}`, 0, undefined, 'critical');
        }
    }
}


// --- NEW Helper functions for physics debug visualization ---
function updateChunkPhysicsDebugVisualization(chunkX: number, chunkY: number, chunkZ: number): void {
    if (!sceneRef) return;

    // Remove existing debug mesh
    if (currentChunkPhysicsDebugMesh) {
        if (currentChunkPhysicsDebugMesh.parent && sceneRef) { // Added sceneRef check
            sceneRef.remove(currentChunkPhysicsDebugMesh);
        }
        currentChunkPhysicsDebugMesh.geometry.dispose();
        if (Array.isArray(currentChunkPhysicsDebugMesh.material)) {
            currentChunkPhysicsDebugMesh.material.forEach(m => m.dispose());
        } else {
            (currentChunkPhysicsDebugMesh.material as THREE.Material).dispose();
        }
        currentChunkPhysicsDebugMesh = null;
    }

    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
    const visualChunkMesh = tpChunkMeshes[chunkKey];

    if (!visualChunkMesh || !(visualChunkMesh as any).physicsBody) {
        // appendToCustomLog(`[PhysicsDebugViz] No visual mesh or physics body for chunk ${chunkKey} to visualize.`, 'info', `PhysViz_NoChunk_${chunkKey}`, 5000);
        return;
    }

    const physicsBody = (visualChunkMesh as any).physicsBody as CANNON.Body;

    if (!physicsBody.shapes.length || !(physicsBody.shapes[0] instanceof CANNON.Trimesh)) {
        appendToCustomLog(`[PhysicsDebugViz] Physics body for chunk ${chunkKey} has no shapes or is not a Trimesh. Shape type: ${physicsBody.shapes[0]?.constructor?.name}`, 'warn', `PhysViz_NotTrimesh_${chunkKey}`, 5000);
        return;
    }
    const trimeshShape = physicsBody.shapes[0] as CANNON.Trimesh;

    const vertices = trimeshShape.vertices; // number[]
    const indices = trimeshShape.indices;   // number[]

    if (!vertices || vertices.length === 0 || !indices || indices.length === 0) {
        appendToCustomLog(`[PhysicsDebugViz] Trimesh for chunk ${chunkKey} has no vertices or indices.`, 'warn', `PhysViz_NoGeomData_${chunkKey}`, 5000);
        return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff, // Cyan
        wireframe: true,
        transparent: true,
        opacity: 0.3, 
        depthTest: false 
    });

    currentChunkPhysicsDebugMesh = new THREE.Mesh(geometry, material);
    currentChunkPhysicsDebugMesh.position.copy(physicsBody.position as any);
    currentChunkPhysicsDebugMesh.quaternion.copy(physicsBody.quaternion as any);
    currentChunkPhysicsDebugMesh.renderOrder = 1000; 

    sceneRef.add(currentChunkPhysicsDebugMesh);
    appendToCustomLog(`[PhysicsDebugViz] Added terrain physics debug mesh for chunk ${chunkKey}`, 'log', `PhysViz_AddTerrain_${chunkKey}`, 5000);
}

function updateCharacterPhysicsDebugVisualization(): void {
    if (!sceneRef || !characterRef || !characterRef.characterCapsule || !characterRef.characterCapsule.body) {
        if (characterPhysicsDebugMeshes.length > 0) {
            characterPhysicsDebugMeshes.forEach(mesh => {
                if (mesh.parent && sceneRef) sceneRef.remove(mesh); // Added sceneRef check
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                     mesh.material.forEach(m => m.dispose());
                } else {
                    (mesh.material as THREE.Material).dispose();
                }
            });
            characterPhysicsDebugMeshes = [];
            // appendToCustomLog(`[PhysicsDebugViz] Cleaned up character physics debug meshes as character/scene became unavailable.`, 'info');
        }
        return;
    }

    const physicsBody = characterRef.characterCapsule.body as CANNON.Body;
    const charIdForLog = characterRef.debugId || 'char_unknown';

    appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Update called. Body has ${physicsBody.shapes.length} shapes. Meshes: ${characterPhysicsDebugMeshes.length}.`, 'log', `PhysVizChar_Update_${charIdForLog}`, 2000, undefined, 'normal');

    if (characterPhysicsDebugMeshes.length !== physicsBody.shapes.length) {
        appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Shape count mismatch (body: ${physicsBody.shapes.length}, viz: ${characterPhysicsDebugMeshes.length}). Recreating viz meshes.`, 'warn', `PhysVizChar_Recreate_${charIdForLog}`, 0, undefined, 'critical');
        characterPhysicsDebugMeshes.forEach(mesh => {
            if (mesh.parent && sceneRef) sceneRef.remove(mesh); 
            mesh.geometry.dispose();
             if (Array.isArray(mesh.material)) {
                 mesh.material.forEach(m => m.dispose());
            } else {
                (mesh.material as THREE.Material).dispose();
            }
        });
        characterPhysicsDebugMeshes = [];

        physicsBody.shapes.forEach((shape, index) => {
            let debugMesh: THREE.Mesh | null = null;
            const material = new THREE.MeshBasicMaterial({
                color: 0xff00ff, // Magenta
                wireframe: true,
                transparent: true,
                opacity: 0.5,
                depthTest: false
            });

            let shapeType = 'Unknown';
            let shapeParams = '{}';

            if (shape instanceof CANNON.Sphere) {
                shapeType = 'Sphere';
                const sphereShape = shape as CANNON.Sphere;
                shapeParams = `radius: ${sphereShape.radius.toFixed(3)}`;
                const geometry = new THREE.SphereGeometry(sphereShape.radius, 16, 16);
                debugMesh = new THREE.Mesh(geometry, material);
            } else if (shape instanceof CANNON.Box) {
                shapeType = 'Box';
                const boxShape = shape as CANNON.Box;
                shapeParams = `halfExtents: (${boxShape.halfExtents.x.toFixed(3)}, ${boxShape.halfExtents.y.toFixed(3)}, ${boxShape.halfExtents.z.toFixed(3)})`;
                const geometry = new THREE.BoxGeometry(boxShape.halfExtents.x*2, boxShape.halfExtents.y*2, boxShape.halfExtents.z*2);
                debugMesh = new THREE.Mesh(geometry, material);
            } else {
                shapeType = shape.constructor.name;
            }
            appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Shape ${index}: Type=${shapeType}, Params=${shapeParams}`, 'log', `PhysVizChar_ShapeInfo_${charIdForLog}_${index}`, 5000, undefined, 'normal');

            if (debugMesh) {
                debugMesh.renderOrder = 1001; 
                if (sceneRef) sceneRef.add(debugMesh); // Added sceneRef check
                characterPhysicsDebugMeshes.push(debugMesh);
            } else {
                appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Could not create debug mesh for shape ${index} (Type: ${shapeType})`, 'warn', `PhysVizChar_NoMesh_${charIdForLog}_${index}`, 5000, undefined, 'critical');
            }
        });
        if (characterPhysicsDebugMeshes.length > 0) {
            appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Created ${characterPhysicsDebugMeshes.length} character physics debug meshes.`, 'log', `PhysVizChar_Created_${charIdForLog}`, 0, undefined, 'critical');
        }
    }

    characterPhysicsDebugMeshes.forEach((debugMesh, i) => {
        if (i < physicsBody.shapes.length) {
            const shapeOffset = physicsBody.shapeOffsets[i]; 
            const shapeOrientation = physicsBody.shapeOrientations[i]; 

            const threeShapeOffset = new THREE.Vector3(shapeOffset.x, shapeOffset.y, shapeOffset.z);
            const threeShapeOrientation = new THREE.Quaternion(shapeOrientation.x, shapeOrientation.y, shapeOrientation.z, shapeOrientation.w);
            const threeBodyPosition = new THREE.Vector3(physicsBody.position.x, physicsBody.position.y, physicsBody.position.z);
            const threeBodyQuaternion = new THREE.Quaternion(physicsBody.quaternion.x, physicsBody.quaternion.y, physicsBody.quaternion.z, physicsBody.quaternion.w);
            
            const worldOffset = threeShapeOffset.clone().applyQuaternion(threeBodyQuaternion);
            
            debugMesh.position.copy(threeBodyPosition).add(worldOffset);
            debugMesh.quaternion.copy(threeBodyQuaternion).multiply(threeShapeOrientation);

            if (i === 0 && Math.random() < 0.05) { // Log first shape's details occasionally
                 appendToCustomLog(
                    `[PhysVizChar ID: ${charIdForLog}] Shape ${i} Viz: ` +
                    `BodyPos: (${threeBodyPosition.x.toFixed(2)}, ${threeBodyPosition.y.toFixed(2)}, ${threeBodyPosition.z.toFixed(2)}), ` +
                    `ShapeOffsetLocal: (${threeShapeOffset.x.toFixed(2)}, ${threeShapeOffset.y.toFixed(2)}, ${threeShapeOffset.z.toFixed(2)}), ` +
                    `DebugMeshPos: (${debugMesh.position.x.toFixed(2)}, ${debugMesh.position.y.toFixed(2)}, ${debugMesh.position.z.toFixed(2)})`,
                    'log', 
                    `PhysVizChar_DebugPos_${charIdForLog}_${i}`,
                    2000, // throttleMs
                    undefined, 'normal'
                );
            }
        }
    });
}
// --- END Helper functions for physics debug visualization ---

// Define stateToAnimMap globally or at a scope accessible by init and updateAnimations
const stateToAnimMap: Record<string, string> = {
    'Idle': 'idle',
    'Walk': 'run', // Base for walk/run, handled by isShiftPressed in updateAnimations
    'Run': 'run',
    'Sprint': 'run',
    'Falling': 'falling',
    'Jump': 'jump_idle', // Simplified, ideally jump_start -> jump_loop -> jump_land
    'JumpIdle': 'jump_idle',
    'JumpLand': 'jump_land',
    'DropIdle': 'drop_idle',
    'DropRolling': 'roll',
    'DropRunning': 'drop_running',
    'IdleRotateLeft': 'rotate_left',
    'IdleRotateRight': 'rotate_right',
    'StartWalkForward': 'start_forward',
    'StartWalkBackLeft': 'start_back_left',
    'StartWalkBackRight': 'start_back_right',
    'StartWalkLeft': 'start_left',
    'StartWalkRight': 'start_right',
    // Add more states as needed
};

function updateAnimations(character: typeof characterRef, delta: number, inputVector: THREE.Vector2, isMoving: boolean, isShiftPressed: boolean): void {
    if (!character) return;
    const charId = character.debugId || 'unknown';
    const currentStateName = character.charState?.constructor.name || 'None';
    
    // Important: Update and log general state for debugging
    appendToCustomLog(`[TP Animation Debug ID: ${charId}] updateAnimations: ENTERED. State: ${currentStateName}, isMoving: ${isMoving}, isShift: ${isShiftPressed}`, 'log', `TPAnim_Enter_${charId}`, 1000, undefined, 'normal');
    
    let targetAnimation = '';
    // Add transitional animation states to be managed by this function
    const animationManagedByThisFunction = 
        ['Idle', 'Walk', 'Run', 'Falling', 'DropIdle', 'Sprint', 'AdaptedIdleState', 'AdaptedWalkState', 'AdaptedSprintState', 'AdaptedEndWalk'].includes(currentStateName);
        
    // Add specific handling for transitional states that aren't being managed properly
    const isTransitionalState = 
        ['StartWalkBackRight', 'StartWalkBackLeft', 'StartWalkLeft', 'StartWalkRight', 'StartWalkForward', 
         'AdaptedStartWalkForwardState', 'AdaptedStartWalkLeftState', 'AdaptedStartWalkRightState'].includes(currentStateName);

    // Log pre-decision state
    appendToCustomLog(`[TP Animation Debug ID: ${charId}] updateAnimations: PRE-DECISION. CurrentStateName: '${currentStateName}', targetAnimation: '${targetAnimation}', animationManagedByThisFunction: ${animationManagedByThisFunction}`, 'log', `TPAnim_PreDecision_${charId}`, 1000, undefined, 'normal');

    // Check if there's no movement input while in a movement state
    const noMovementInput = !isMoving && (
        currentStateName === 'Walk' || 
        currentStateName === 'Sprint' || 
        currentStateName === 'AdaptedWalkState' || 
        currentStateName === 'AdaptedSprintState'
    );

    // If we detect no movement input in a movement state, force transition to EndWalk/Idle
    if (noMovementInput) {
        appendToCustomLog(`[TP Animation Debug ID: ${charId}] *** NO MOVEMENT DETECTED in state '${currentStateName}'. SHOULD BE IN IDLE! ***`, 'warn', `TPAnim_ForceIdle_${charId}`, 0, undefined, 'critical');
        
        // Try to force EndWalk state if we're still in a movement state with no input
        // This is a fallback correction mechanism
        if (character.charState && character.charState.constructor.name !== 'AdaptedEndWalk' && 
            character.charState.constructor.name !== 'EndWalk' && 
            character.charState.constructor.name !== 'AdaptedIdleState' && 
            character.charState.constructor.name !== 'Idle') {
            
            appendToCustomLog(`[TP Animation Debug ID: ${charId}] CORRECTION: State should be Idle/EndWalk, forcing transition...`, 'warn', `TPAnim_ForceCorrection_${charId}`, 0, undefined, 'critical');
            
            // Play stop animation immediately
            directPlayAnimation(character, 'stop', 0.05, THREE.LoopOnce);
            
            // Force state change to end walk which should then transition to idle
            character.setState(new AdaptedEndWalk(character));
            return;
        }
    }

    // For sustained states, we'll decide which animation to play
    if (currentStateName === 'Idle' || currentStateName === 'AdaptedIdleState') {
        targetAnimation = 'idle';
    } else if (currentStateName === 'Walk' || currentStateName === 'AdaptedWalkState') {
        // Check local movement direction to help determine if we should be walking
        const moveDir = character.getLocalMovementDirection();
        const isActuallyMoving = moveDir.lengthSq() > 0.01 || isMoving;
        
        if (isActuallyMoving) {
            targetAnimation = 'run'; // Always use 'run' since 'walk' doesn't exist
            appendToCustomLog(`[TP Animation Debug ID: ${charId}] Walk state with movement. Using '${targetAnimation}' animation. moveDir:(${moveDir.x.toFixed(2)},${moveDir.z.toFixed(2)})`, 'log', `TPAnim_WalkMoving_${charId}`, 1000, undefined, 'normal');
        } else {
            // If not actually moving in Walk state, transition to EndWalk
            if (character.charState && character.charState.constructor.name !== 'AdaptedEndWalk' && character.charState.constructor.name !== 'EndWalk') {
                appendToCustomLog(`[TP Animation Debug ID: ${charId}] Walk state but NOT moving. FORCING transition to AdaptedEndWalk`, 'warn', `TPAnim_WalkToEndWalk_${charId}`, 0, undefined, 'critical');
                // Play stop animation immediately
                directPlayAnimation(character, 'stop', 0.05, THREE.LoopOnce);
                // Force state change to end walk
                character.setState(new AdaptedEndWalk(character));
                return;
            }
        }
    } else if (currentStateName === 'Sprint' || currentStateName === 'AdaptedSprintState') {
        // Check local movement direction to ensure character is actually moving
        const moveDir = character.getLocalMovementDirection();
        const isActuallyMoving = moveDir.lengthSq() > 0.01 || isMoving;
        
        if (isActuallyMoving) {
            targetAnimation = 'run';  // Changed from 'sprint' to 'run' to match stateToAnimMap
            appendToCustomLog(`[TP Animation Debug ID: ${charId}] Sprint state with movement. Using '${targetAnimation}' animation. moveDir:(${moveDir.x.toFixed(2)},${moveDir.z.toFixed(2)})`, 'log', `TPAnim_SprintMoving_${charId}`, 1000, undefined, 'normal');
        } else {
            // If not actually moving in Sprint state, transition to EndWalk
            if (character.charState && character.charState.constructor.name !== 'AdaptedEndWalk' && character.charState.constructor.name !== 'EndWalk') {
                appendToCustomLog(`[TP Animation Debug ID: ${charId}] Sprint state but NOT moving. FORCING transition to AdaptedEndWalk`, 'warn', `TPAnim_SprintToEndWalk_${charId}`, 0, undefined, 'critical');
                // Play stop animation immediately
                directPlayAnimation(character, 'stop', 0.05, THREE.LoopOnce);
                // Force state change to end walk
                character.setState(new AdaptedEndWalk(character));
                return;
            }
        }
    } else if (currentStateName === 'Falling') {
        targetAnimation = 'falling';
    } else if (currentStateName === 'DropIdle') {
        targetAnimation = 'landing'; // Not sure if landing is the right name for DropIdle
    } else if (currentStateName === 'EndWalk' || currentStateName === 'AdaptedEndWalk') {
        targetAnimation = 'stop';
        appendToCustomLog(`[TP Animation Debug ID: ${charId}] EndWalk state. Using '${targetAnimation}' animation.`, 'log', `TPAnim_EndWalk_${charId}`, 1000, undefined, 'normal');
    }

    // Log the decision
    if (targetAnimation) {
        appendToCustomLog(`[TP Animation Debug ID: ${charId}] updateAnimations: Managing Sustained State: '${currentStateName}' => Enforcing Anim: '${targetAnimation}'`, 'log', `TPAnim_Decision_${charId}`, 500, undefined, 'normal');
        
        // Get current animation
        const currentAnim = (character as any)._currentAnimation || null;
        
        // Only update if animation needs changing
        if (currentAnim !== targetAnimation) {
            character.setAnimation(targetAnimation, 0.2); // 0.2 second crossfade
        }
    }
}

async function init() {
    // ... existing code ...
}

// Add this before the AdaptedSketchbookCharacter_Engine class definition
/**
 * An adapted version of StartWalkForward that ensures proper transition to Walk
 */
class AdaptedStartWalkForwardState extends StartWalkForward {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7; // Force transition after this many seconds
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkForwardState ID: ${charId}] Created`, 'log', `AdaptedStartWalkForward_Create_${charId}`, 0, undefined, 'normal');
        
        // Force animation immediately for smoother transition with a longer fade-in
        directPlayAnimation(this.character, 'run', 0.2);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Increment transition timer
        this.transitionTimer += timeStep;
        
        // Before checking timer, ensure run animation is playing
        if ((this.character as any)._currentAnimation !== 'run') {
            directPlayAnimation(this.character, 'run', 0.1);
            appendToCustomLog(`[AdaptedStartWalkForwardState.update ID: ${charId}] Animation reinforcement: forcing 'run'`, 'warn', `StartWalk_AnimForce_${charId}`, 500, undefined, 'critical');
        }
        
        // Check for direction inputs - if no movement inputs, go to EndWalk
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        
        if (!anyDirectionPressed) {
            appendToCustomLog(`[AdaptedStartWalkForwardState.update ID: ${charId}] No direction keys pressed, transitioning to EndWalk`, 'warn', `StartWalk_ToEndWalk_${charId}`, 0, undefined, 'critical');
            directPlayAnimation(this.character, 'stop', 0.1, THREE.LoopOnce);
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        
        // Check for immediate transition to Walk state for smoother movement
        // Modified to force transition even before animation ends
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            // If we've waited a minimum time or hit the timeout, transition to correct state based on run key
            const runPressed = this.character.actions.run.isPressed;
            
            appendToCustomLog(
                `[AdaptedStartWalkForwardState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Run key: ${runPressed}. Transitioning to ${runPressed ? 'AdaptedSprintState' : 'AdaptedWalkState'}.`,
                'log',
                `AdaptedStartWalkForward_Transition_${charId}`,
                500,
                undefined,
                'normal'
            );
            
            // Transition to appropriate state based on run key
            if (runPressed) {
                this.character.setState(new AdaptedSprintState(this.character));
            } else {
                this.character.setState(new AdaptedWalkState(this.character));
            }
            return;
        }
        
        // Call super only if we're not transitioning yet
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        
        appendToCustomLog(
            `[Patched StartWalkBase.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`,
            'log', 
            `AdaptedStartWalkForward_InputChange_${charId}`,
            1000,
            undefined,
            'normal'
        );
        
        if (noDir) {
            // If no direction keys are pressed, go back to idle
            appendToCustomLog(
                `[AdaptedStartWalkForwardState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`,
                'log',
                `AdaptedStartWalkForward_ToEndWalk_${charId}`,
                0,
                undefined,
                'normal'
            );
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        
        // If we have direction input but it changed, let super handle it
        if (anyDir) {
            super.onInputChange();
        }
    }
}

/**
 * Adapted version of Walk that ensures animation plays correctly
 */
class AdaptedWalkState extends Walk implements ICharacterState {
    private _transitionCheckTimer: number = 0;
    private readonly _checkInterval: number = 0.1; // Check for no movement every 100ms
    private _lastAnimationTime: number = 0; // Track last time animation was played
    private _animationThrottleInterval: number = 0.25; // Only play animation every 250ms
    private _lastMovementDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Store last movement direction
    private _lastInputDirection: THREE.Vector3 = new THREE.Vector3(); // Store last input direction
    private _noInputTimer: number = 0; // Timer to track no input
    private readonly _maxNoInputTime: number = 0.05; // Transition after 50ms of no input
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedWalkState ID: ${charId}] Created`, 'log', `AdaptedWalk_Create_${charId}`, 0, undefined, 'normal');
        
        // Force run animation immediately for smoother startup
        this.playWalkingAnimation();
    }
    
    private playWalkingAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Check if animation was recently played - throttle to avoid spam
        if (this.timer - this._lastAnimationTime < this._animationThrottleInterval) {
            // Skip playing animation if we've played one recently
            return;
        }
        
        // Update last animation time
        this._lastAnimationTime = this.timer;
        
        // Get current animation
        const currentAnim = (this.character as any)._currentAnimation || null;
        
        // Only force playing if we're not already playing 'run'
        if (currentAnim !== 'run') {
            appendToCustomLog(
                `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] Playing 'run' animation, current anim: '${currentAnim}'`,
                'log',
                `AdaptedWalk_PlayAnim_${charId}`,
                500,
                undefined,
                'normal'
            );
            
            // Try direct animation play first for more immediate control
            const animPlayed = directPlayAnimation(this.character, 'run', 0.2);
            
            if (!animPlayed) {
                appendToCustomLog(
                    `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] Failed to play 'run' animation directly, using setAnimation fallback`,
                    'warn',
                    `AdaptedWalk_AnimFail_${charId}`,
                    0,
                    undefined,
                    'normal'
                );
                
                // Fallback to setAnimation if directPlay fails
                const animTime = this.character.setAnimation('run', 0.1);
                
                if (animTime < 0) {
                    appendToCustomLog(
                        `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] CRITICAL ERROR: Failed to play 'run' animation with both methods!`,
                        'error',
                        `AdaptedWalk_AnimCriticalFail_${charId}`,
                        0,
                        undefined,
                        'critical'
                    );
                }
            }
        }
    }
    
    private hasChangedDirection(): boolean {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Get current movement direction from character orientation
        const currentDirectionVector = this.character.getLocalMovementDirection();
        // Create a new THREE.Vector3 with values from the direction vector to ensure type compatibility
        const currentDirection = new THREE.Vector3(
            currentDirectionVector.x, 
            currentDirectionVector.y, 
            currentDirectionVector.z
        );
        
        // Initialize last input direction if it's not set
        if (this._lastInputDirection.lengthSq() === 0) {
            this._lastInputDirection.set(currentDirection.x, currentDirection.y, currentDirection.z);
            return false;
        }
        
        // Compare with last movement direction
        const angleDiff = currentDirection.angleTo(this._lastMovementDirection);
        const hasChanged = angleDiff > Math.PI / 6; // 30 degrees threshold for significant direction change
        
        // Update last input direction for next check
        this._lastInputDirection.set(currentDirection.x, currentDirection.y, currentDirection.z);
        
        if (hasChanged) {
            appendToCustomLog(
                `[AdaptedWalkState.hasChangedDirection ID: ${charId}] Direction change detected! Angle: ${(angleDiff * 180 / Math.PI).toFixed(2)}°, Current: (${currentDirection.x.toFixed(2)}, ${currentDirection.z.toFixed(2)}), Last: (${this._lastMovementDirection.x.toFixed(2)}, ${this._lastMovementDirection.z.toFixed(2)})`,
                'log',
                `AdaptedWalk_DirChange_${charId}`,
                0,
                undefined,
                'normal'
            );
        }
        
        return hasChanged;
    }
    
    private playTurningAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Get current direction vector
        const currentDirectionVector = this.character.getLocalMovementDirection();
        // Create a new THREE.Vector3 with values from the direction vector for compatibility
        const currentDirection = new THREE.Vector3(
            currentDirectionVector.x, 
            currentDirectionVector.y, 
            currentDirectionVector.z
        );
        
        // Determine if turning left or right based on cross product with forward vector
        const forwardVec = new THREE.Vector3(0, 0, 1);
        const crossResult = new THREE.Vector3().crossVectors(forwardVec, currentDirection);
        
        // If y is positive, turning left; if negative, turning right
        const turnDirection = crossResult.y > 0 ? 'left' : 'right';
        
        // Play appropriate turning animation
        const animationName = `turn_${turnDirection}`;
        appendToCustomLog(
            `[AdaptedWalkState.playTurningAnimation ID: ${charId}] Playing turning animation: '${animationName}'`,
            'log',
            `AdaptedWalk_TurnAnim_${charId}`,
            500,
            undefined,
            'normal'
        );
        
        // Update last animation time to avoid animation spam
        this._lastAnimationTime = this.timer;
        
        // Try to play turn animation
        const turnAnimPlayed = directPlayAnimation(this.character, animationName, 0.1);
        
        if (!turnAnimPlayed) {
            // If turn animation fails, fall back to regular run
            appendToCustomLog(
                `[AdaptedWalkState.playTurningAnimation ID: ${charId}] Failed to play '${animationName}' animation, falling back to 'run'`,
                'warn',
                `AdaptedWalk_TurnAnimFail_${charId}`,
                0,
                undefined,
                'normal'
            );
            
            // Just play run with short crossfade
            this.playWalkingAnimation();
        }
        
        // Update last movement direction for next comparison - manually set values
        this._lastMovementDirection.set(currentDirection.x, currentDirection.y, currentDirection.z);
    }
    
    public update(timeStep: number): void {
        super.update(timeStep);
        
        // Increment timers
        this._transitionCheckTimer += timeStep;
        
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Check for movement
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        
        // Track velocity and ground info
        const velocityLength = this.character.velocity.length();
        const groundNormalY = this.character.rayHasHit ? this.character.rayResult.hitNormalWorld.y : 'N/A (no ray hit)';
        
        // Only log every _checkInterval seconds to reduce spam
        if (this._transitionCheckTimer >= this._checkInterval) {
            appendToCustomLog(`[Patched Walk.update ID: ${charId}] Inputs: up=${up}, down=${down}, left=${left}, right=${right}, velLen: ${velocityLength.toFixed(3)}, GroundNormalY: ${typeof groundNormalY === 'number' ? groundNormalY.toFixed(3) : groundNormalY}`, 'log', `Walk_Update_${charId}`, 1000, undefined, 'normal');
            this._transitionCheckTimer = 0;
        }
        
        // If no direction keys are pressed, track how long there's been no input
        if (!anyDirectionPressed) {
            this._noInputTimer += timeStep;
            
            // If no input for max time, transition to EndWalk
            if (this._noInputTimer >= this._maxNoInputTime) {
                // Get timestamp to prevent rapid state changes
                const now = Date.now();
                const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
                const minTimeBetweenStateChanges = 100; // Minimum 100ms between state changes
                
                if (now - lastStateChange >= minTimeBetweenStateChanges) {
                    appendToCustomLog(`[AdaptedWalkState.update ID: ${charId}] No input detected for ${this._noInputTimer.toFixed(3)}s, transitioning to EndWalk`, 'warn', `AdaptedWalk_NoInputTransition_${charId}`, 0, undefined, 'critical');
                    
                    // Record state change time
                    (this.character as any)._lastStateChangeTime = now;
                    
                    // Play stop animation immediately
                    directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
                    
                    // Transition to EndWalk
                    this.character.setState(new AdaptedEndWalk(this.character));
                    return;
                }
            }
        } else {
            // Reset no input timer if direction keys are pressed
            this._noInputTimer = 0;
            
            // If there's movement, ensure the character is playing the walking animation
            // But don't force animation changes too often to prevent resetting
            if (velocityLength > 0.1) {
                // Check if direction has changed significantly
                if (this.hasChangedDirection()) {
                    // Play turning animation
                    this.playTurningAnimation();
                } else if (this.timer - this._lastAnimationTime >= this._animationThrottleInterval) {
                    // If it's time for the next animation check, only play walking animation
                    // if we're not already playing it (check added in playWalkingAnimation)
                    this.playWalkingAnimation();
                }
            }
        }
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Get a timestamp to prevent rapid state changes
        const now = Date.now();
        const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
        const minTimeBetweenStateChanges = 100; // Minimum 100ms between state changes
        
        // Check if any direction keys are pressed
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
            
        // Get the actual movement vector
        const moveDirection = this.character.getLocalMovementDirection();
        const isActuallyMoving = moveDirection.lengthSq() > 0.01;
        
        appendToCustomLog(
            `[AdaptedWalkState.onInputChange ID: ${charId}] Direction keys: ${anyDirectionPressed ? 'YES' : 'NO'}, Movement vector: (${moveDirection.x.toFixed(2)}, ${moveDirection.z.toFixed(2)}), isActuallyMoving: ${isActuallyMoving}`,
            'log',
            `AdaptedWalk_Input_${charId}`,
            500,
            undefined,
            'normal'
        );
        
        // If we have any direction pressed, check special cases
        if (anyDirectionPressed) {
            // If there is movement, check for direction change
            if (isActuallyMoving) {
                // Check if direction has changed significantly
                if (this.hasChangedDirection()) {
                    // Play turning animation immediately on input change
                    this.playTurningAnimation();
                }
            }
            
            // Sprint check
            if (this.character.actions.run.isPressed) {
                // Only allow state transition if enough time has passed
                if (now - lastStateChange >= minTimeBetweenStateChanges) {
                    appendToCustomLog(
                        `[AdaptedWalkState.onInputChange ID: ${charId}] Run pressed, transitioning to AdaptedSprintState`,
                        'log',
                        `AdaptedWalk_ToSprint_${charId}`,
                        0,
                        undefined,
                        'normal'
                    );
                    
                    // Record the state change time
                    (this.character as any)._lastStateChangeTime = now;
                    
                    // Use our custom AdaptedSprintState instead of relying on super
                    this.character.setState(new AdaptedSprintState(this.character));
                    return;
                } else {
                    appendToCustomLog(
                        `[AdaptedWalkState.onInputChange ID: ${charId}] Run pressed but ignoring - too soon for state change (${now - lastStateChange}ms < ${minTimeBetweenStateChanges}ms)`,
                        'log',
                        `AdaptedWalk_IgnoreSprint_${charId}`,
                        0,
                        undefined,
                        'normal'
                    );
                }
            }
        } else {
            // If there's no direction pressed, force transition to EndWalk IMMEDIATELY
            // This is critical to fix the animation stuck issue when releasing directional keys
            appendToCustomLog(
                `[AdaptedWalkState.onInputChange ID: ${charId}] *** No direction keys pressed, FORCING transition to EndWalk state ***`,
                'warn',
                `AdaptedWalk_ToEndWalk_${charId}`,
                0,
                undefined,
                'critical'
            );
            
            // Record the state change time
            (this.character as any)._lastStateChangeTime = now;
            
            // Play the stop animation directly before state change
            directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
            
            // Create a new instance of AdaptedEndWalk and force transition IMMEDIATELY
            const adaptedEndWalkState = new AdaptedEndWalk(this.character) as unknown as ICharacterState;
            
            // Force state change
            this.character.setState(adaptedEndWalkState);
            return;
        }
        
        // Call super last to ensure our logic has priority
        super.onInputChange();
    }
}

/**
 * An adapted version of StartWalkRight that ensures proper transition to Walk
 */
class AdaptedStartWalkRightState extends StartWalkRight {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7; // Force transition after this many seconds
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkRightState ID: ${charId}] Created`, 'log', `AdaptedStartWalkRight_Create_${charId}`, 0, undefined, 'normal');
        
        // Force animation immediately for smoother transition
        directPlayAnimation(this.character, 'run', 0.1);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Increment transition timer
        this.transitionTimer += timeStep;
        
        // Check for immediate transition to Walk state for smoother movement
        // Modified to force transition even before animation ends
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            // If we've waited a minimum time or hit the timeout, transition to Walk
            appendToCustomLog(
                `[AdaptedStartWalkRightState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Transitioning to Walk.`,
                'log',
                `AdaptedStartWalkRight_ToWalk_${charId}`,
                500,
                undefined,
                'normal'
            );
            
            // Transition to Walk state
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        
        // Call super only if we're not transitioning yet
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        
        appendToCustomLog(
            `[AdaptedStartWalkRightState.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`,
            'log', 
            `AdaptedStartWalkRight_InputChange_${charId}`,
            1000,
            undefined,
            'normal'
        );
        
        if (noDir) {
            // If no direction keys are pressed, go back to idle
            appendToCustomLog(
                `[AdaptedStartWalkRightState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`,
                'log',
                `AdaptedStartWalkRight_ToEndWalk_${charId}`,
                0,
                undefined,
                'normal'
            );
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        
        // If we have direction input but it changed, let super handle it
        if (anyDir) {
            super.onInputChange();
        }
    }
}

/**
 * An adapted version of StartWalkLeft that ensures proper transition to Walk
 */
class AdaptedStartWalkLeftState extends StartWalkLeft {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7; // Force transition after this many seconds
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkLeftState ID: ${charId}] Created`, 'log', `AdaptedStartWalkLeft_Create_${charId}`, 0, undefined, 'normal');
        
        // Force animation immediately for smoother transition
        directPlayAnimation(this.character, 'run', 0.1);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Increment transition timer
        this.transitionTimer += timeStep;
        
        // Check for immediate transition to Walk state for smoother movement
        // Modified to force transition even before animation ends
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            // If we've waited a minimum time or hit the timeout, transition to Walk
            appendToCustomLog(
                `[AdaptedStartWalkLeftState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Transitioning to Walk.`,
                'log',
                `AdaptedStartWalkLeft_ToWalk_${charId}`,
                500,
                undefined,
                'normal'
            );
            
            // Transition to Walk state
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        
        // Call super only if we're not transitioning yet
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        
        appendToCustomLog(
            `[AdaptedStartWalkLeftState.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`,
            'log', 
            `AdaptedStartWalkLeft_InputChange_${charId}`,
            1000,
            undefined,
            'normal'
        );
        
        if (noDir) {
            // If no direction keys are pressed, go back to idle
            appendToCustomLog(
                `[AdaptedStartWalkLeftState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`,
                'log',
                `AdaptedStartWalkLeft_ToEndWalk_${charId}`,
                0,
                undefined,
                'normal'
            );
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        
        // If we have direction input but it changed, let super handle it
        if (anyDir) {
            super.onInputChange();
        }
    }
}

// Add an AdaptedEndWalk class before the other adapted classes
class AdaptedEndWalk extends EndWalk implements ICharacterState {
    private _lastLogTime: number = 0;
    private readonly _logInterval: number = 0.5; // Log every 500ms for important updates
    private _lastAnimationTime: number = 0; // Track last time animation was played
    private _animationAlreadyPlayed: boolean = false; // Track if we've already started the stop animation
    private _forceIdleAnimation: boolean = false; // Flag to handle transition to idle animation
    
    constructor(character: any) {
        super(character);
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Initialize animation length - will be properly updated in enter()
        this.animationLength = 0.5; // Use 0.5 for stop animation length
        
        // Start with clean tracking state
        this._animationAlreadyPlayed = false;
        this._forceIdleAnimation = false;
        
        appendToCustomLog(`[EndWalk CONSTRUCTOR ID: ${charId}] Initialized. Timer: ${this.timer}, AnimLen: ${this.animationLength}. Waiting for enter().`, 'log', `EndWalk_Create_${charId}`, 0, undefined, 'normal');
    }
    
    public enter(oldState: ICharacterState): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Call parent enter (important for setting up timers)
        super.enter(oldState as any); // Cast to any to bypass type checking
        
        // Set fixed animation length to match our stop animation
        this.animationLength = 0.5; // Use 0.5 seconds for stop animation
        
        // Clean animation tracking state on enter
        this._animationAlreadyPlayed = false;
        this._forceIdleAnimation = false;
        
        // Immediately play the animation to ensure it starts
        this.playEndWalkAnimation();
    }
    
    private playEndWalkAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const now = Date.now();
        
        // If we already played this animation recently, don't spam it
        if (this._animationAlreadyPlayed && now - this._lastAnimationTime < 100) {
            return;
        }
        
        // Use the idle animation instead of stop, since stop doesn't exist
        // and set it to play once (not looping)
        const animSuccess = directPlayAnimation(this.character, 'idle', 0.2, THREE.LoopOnce);
        
        if (animSuccess) {
            this._lastAnimationTime = now;
            this._animationAlreadyPlayed = true;
            appendToCustomLog(`[EndWalk.playEndWalkAnimation ID: ${charId}] Played 'idle' animation with LoopOnce.`, 'log', `EndWalk_PlayAnim_${charId}`, 0, undefined, 'normal');
        } else {
            appendToCustomLog(`[EndWalk.playEndWalkAnimation ID: ${charId}] FAILED to play 'idle' animation!`, 'warn', `EndWalk_PlayAnimFail_${charId}`, 0, undefined, 'critical');
        }
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Update timer from parent class
        super.update(timeStep);
        
        // Log timer state regularly
        appendToCustomLog(`[EndWalk.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, AnimLen: ${this.animationLength.toFixed(3)}. Transition Cond: ${this.timer >= this.animationLength}`, 'log', `EndWalk_Timer_${charId}`, 1000, this._lastLogTime, 'normal');
        
        // If animation wasn't played initially, try again
        if (!this._animationAlreadyPlayed) {
            appendToCustomLog(`[EndWalk.update ID: ${charId}] Missed initial animation, forcing play.`, 'log', `EndWalk_MissedAnim_${charId}`, 0, undefined, 'normal');
            this.playEndWalkAnimation();
        }
        
        // Check if animation has completed based on timer
        if (this.timer >= this.animationLength && !this._forceIdleAnimation) {
            appendToCustomLog(`[Patched EndWalk.update ID: ${charId}] Anim ('stop') ended. Transitioning to Idle. Current CharState: ${this.character.charState?.constructor.name}`, 'log', `EndWalk_Complete_${charId}`, 0, undefined, 'critical');
            this._forceIdleAnimation = true;
        }
        
        // When animation is completed, transition to idle state
        if (this.timer >= this.animationLength) {
                         appendToCustomLog(`[EndWalk.update ID: ${charId}] Timer (${this.timer.toFixed(3)}) > AnimLen (${this.animationLength.toFixed(3)}). SETTING STATE TO IDLE.`, 'log', `EndWalk_ToIdle_${charId}`, 0, undefined, 'critical');
            
            // Use our adapted idle state
            this.character.setState(new AdaptedIdleState(this.character));
        }
    }
}

// ... existing code ...

// Add an AdaptedIdleState class after the existing state adaptations
class AdaptedIdleState extends Idle implements ICharacterState {
    private _animationCheckTimer: number = 0;
    private readonly _checkInterval: number = 0.5; // Check animation every 500ms
    private _lastAnimationTime: number = 0; // Track last time animation was played
    private _animationThrottleInterval: number = 0.25; // Only play animation every 250ms
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedIdleState ID: ${charId}] Created.`, 'log', `AdaptedIdle_Create_${charId}`, 0, undefined, 'normal');
        
        // Don't force animations to cancel - use crossfading instead for smoother transitions
        // Only play immediately if coming from a state where there is no current animation
        if (!(character as any)._currentAnimation) {
            appendToCustomLog(`[AdaptedIdleState ID: ${charId}] No current animation, playing idle immediately`, 'log', `AdaptedIdle_PlayImmediate_${charId}`, 0, undefined, 'normal');
            this.playIdleAnimation();
        } else {
            // Delay first animation play slightly to avoid conflicts with previous state's animations
            setTimeout(() => {
                if (this.character.charState === this) {
                    appendToCustomLog(`[AdaptedIdleState ID: ${charId}] Delayed initial animation after 50ms`, 'log', `AdaptedIdle_DelayedInit_${charId}`, 0, undefined, 'normal');
                    this.playIdleAnimation();
                }
            }, 50);
        }
    }
    
    private playIdleAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Check if animation was recently played - throttle to avoid spam
        if (this.timer - this._lastAnimationTime < this._animationThrottleInterval) {
            // Skip playing animation if we've played one recently
            return;
        }
        
        // Update last animation time
        this._lastAnimationTime = this.timer;
        
        // Check if already playing idle animation before forcing
        const currentAnim = (this.character as any)._currentAnimation || null;
        if (currentAnim === 'idle') {
            // Already playing idle animation, no need to force it again
            // Only log occasionally to reduce spam
            if (Math.floor(this.timer * 2) % 10 === 0) { // Log approx every 5 seconds
                appendToCustomLog(
                    `[AdaptedIdleState.playIdleAnimation ID: ${charId}] Already playing 'idle' animation, no need to force`,
                    'log',
                    `AdaptedIdle_AlreadyIdle_${charId}`,
                    5000,
                    undefined,
                    'normal'
                );
            }
            return;
        }
        
        // Force logging only when animation is actually changing
        appendToCustomLog(`[AdaptedIdleState.playIdleAnimation ID: ${charId}] FORCING 'idle' animation while in '${(this.character as any).charState?.constructor?.name || 'unknown'}' state`, 'warn', `AdaptedIdle_ForceAnim_${charId}`, 0, undefined, 'critical');
        
        // Try to directly play the animation
        const animPlayed = directPlayAnimation(this.character, 'idle', 0.1);
        
        if (animPlayed) {
            appendToCustomLog(`[AdaptedIdleState.playIdleAnimation ID: ${charId}] ✓ Successfully played 'idle' animation via directPlayAnimation`, 'log', `AdaptedIdle_PlayAnim_${charId}`, 500, undefined, 'normal');
        } else {
            appendToCustomLog(`[AdaptedIdleState.playIdleAnimation ID: ${charId}] ✗ Failed to play 'idle' animation via directPlayAnimation, trying setAnimation`, 'error', `AdaptedIdle_AnimFail_${charId}`, 0, undefined, 'critical');
            
            // Fallback to setAnimation with minimum fade time to make it more immediate
            const animationTime = this.character.setAnimation('idle', 0.1);
            
            if (animationTime > 0) {
                appendToCustomLog(`[AdaptedIdleState.playIdleAnimation ID: ${charId}] ✓ Successfully played 'idle' animation via setAnimation, duration: ${animationTime.toFixed(2)}s`, 'log', `AdaptedIdle_AnimFallback_${charId}`, 0, undefined, 'critical');
            } else {
                appendToCustomLog(`[AdaptedIdleState.playIdleAnimation ID: ${charId}] ✗✗ CRITICAL: Failed to play 'idle' animation with both methods!`, 'error', `AdaptedIdle_AnimCriticalFail_${charId}`, 0, undefined, 'critical');
            }
        }
    }
    
    public update(timeStep: number): void {
        // Super call first to update internal state
        super.update(timeStep);
        
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Update the animation check timer
        this._animationCheckTimer += timeStep;
        
        // Periodically check if we need to reinforce the idle animation
        if (this._animationCheckTimer > this._checkInterval) {
            this._animationCheckTimer = 0;
            
            // Log animation progress
            const mixer = this.character.mixer;
            if (mixer) {
                const clipName = 'idle';
                const clip = this.character.animations?.find((c: THREE.AnimationClip) => 
                    c.name === clipName || c.name.toLowerCase() === clipName.toLowerCase()
                );
                
                if (clip) {
                    const duration = clip.duration;
                    const timer = this.timer;
                    const progress = (timer / duration) * 100;
                    
                    appendToCustomLog(`[Animation Progress ID: ${charId}] State: Idle, Progress: ${progress.toFixed(1)}%, Timer: ${timer.toFixed(2)}/${duration.toFixed(2)}, Elapsed real time: ${timer.toFixed(2)}s`, 'log', `AnimProgress_${charId}`, 2000, undefined, 'normal');
                }
            }
            
            // Only reinforce the animation if it's not already playing the idle animation
            if ((this.character as any)._currentAnimation !== 'idle') {
                appendToCustomLog(`[Animation Reinforcement ID: ${charId}] Current animation '${(this.character as any)._currentAnimation}' is not 'idle'. Reinforcing.`, 'log', `AnimReinforce_${charId}`, 2000, undefined, 'normal');
                this.playIdleAnimation();
            }
        }
        
        // Check fall condition like the reference implementation
        const rayHasHit = (this.character as any).threeRayHit ?? false;
        const yVel = (this.character as any)?.characterCapsule?.body?.velocity?.y || 0;
        
        // If not grounded and falling, transition to falling state (like in the reference logs)
        if (!rayHasHit && yVel < -0.1) {
            appendToCustomLog(`[State Decision ID: ${charId}] Transitioning to Falling state. Ray hit: ${rayHasHit}, Character Y velocity: ${yVel.toFixed(2)}`, 'log', `StateDecision_ToFalling_${charId}`, 0, undefined, 'normal');
            
            // Set falling state like in the reference logs - using original Falling
            this.character.setState(new Falling(this.character));
        }
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed; // Added down for completeness, though StartWalkBackward isn't adapted yet
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const run = this.character.actions.run?.isPressed || false;
        
        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Input: up=${up}, down=${down}, left=${left}, right=${right}, run=${run}`, 'log', `AdaptedIdle_Input_${charId}`, 500, undefined, 'normal');
        
        if (this.character.actions.jump.justPressed) {
            appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Jump pressed, using super.onInputChange for JumpIdle.`, 'log', `AdaptedIdle_ToJumpIdle_${charId}`, 0, undefined, 'normal');
            super.onInputChange(); // Let original handle jump from idle
            return;
        }
        
        const anyDirectionPressed = up || down || left || right;
        
        if (anyDirectionPressed) {
            // Force stop the idle animation before transitioning
            directPlayAnimation(this.character, 'stop', 0.05); // Short fade out for idle

            if (run) {
                appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Run key active with direction, transitioning to AdaptedSprintState.`, 'log', `AdaptedIdle_ToSprint_${charId}`, 0, undefined, 'normal');
                this.character.setState(new AdaptedSprintState(this.character));
            } else {
                // Prioritize forward, then strafing for initial state
                if (up) {
                    appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Forward pressed, transitioning to AdaptedStartWalkForwardState.`, 'log', `AdaptedIdle_ToStartWalkFwd_${charId}`, 0, undefined, 'normal');
                    this.character.setState(new AdaptedStartWalkForwardState(this.character));
                } else if (left) {
                    appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Left pressed, transitioning to AdaptedStartWalkLeftState.`, 'log', `AdaptedIdle_ToStartWalkLeft_${charId}`, 0, undefined, 'normal');
                    this.character.setState(new AdaptedStartWalkLeftState(this.character));
                } else if (right) {
                    appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Right pressed, transitioning to AdaptedStartWalkRightState.`, 'log', `AdaptedIdle_ToStartWalkRight_${charId}`, 0, undefined, 'normal');
                    this.character.setState(new AdaptedStartWalkRightState(this.character));
                } else if (down) {
                    // Placeholder for StartWalkBackward if/when it's adapted and needed
                    appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Down pressed. No AdaptedStartWalkBackwardState yet. Transitioning to AdaptedWalkState as fallback.`, 'warn', `AdaptedIdle_ToWalkFallbackDown_${charId}`, 0, undefined, 'normal');
                    this.character.setState(new AdaptedWalkState(this.character)); 
                }
            }
            return; 
        }
        
        // No directional input - remain in idle state (or let superclass handle if it has other logic)
        // super.onInputChange(); // Calling super might revert to idle if no input, which is fine.
        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] No directional input, remaining idle.`, 'log', `AdaptedIdle_StayIdle_${charId}`, 1000, undefined, 'normal');
    }
}

// Add a Sprint state adapter after the EndWalk class
class AdaptedSprintState extends Sprint implements ICharacterState {
    private _animationCheckTimer: number = 0;
    private readonly _checkInterval: number = 0.1; // Check for animation issues every 100ms
    private _lastAnimationTime: number = 0; // Track last time animation was played
    private _noInputTimer: number = 0; // Timer to track how long there has been no input
    private readonly _maxNoInputTime: number = 0.05; // If no input for 50ms, transition to EndWalk (reduced for faster response)
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedSprintState ID: ${charId}] Created.`, 'log', `AdaptedSprint_Create_${charId}`, 0, undefined, 'normal');
        
        // Force sprint animation immediately upon entering the state
        this.playSprintAnimation(0.05);
    }
    
    private playSprintAnimation(fadeIn: number = 0.1): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const now = Date.now() / 1000;
        
        // Only play if it's been a while since we last played the animation
        if (now - this._lastAnimationTime < 0.1) {
            // Don't spam animation changes
            return;
        }
        
        // Update last animation time with current timestamp
        this._lastAnimationTime = now;
        
        // Get current animation
        const currentAnim = (this.character as any)._currentAnimation || null;
        
        // Use normal animation speed
        const sprintTimeScale = 1.0; // Normal speed for sprint animation
        
        appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Current anim: '${currentAnim}', ensuring 'run' animation with sprint speed`, 'log', `AdaptedSprint_AnimCheck_${charId}`, 500, undefined, 'normal');
        
        // Always play run animation with sprint speed regardless of current state
        const animPlayed = directPlayAnimation(this.character, 'run', fadeIn);
        
        if (!animPlayed) {
            appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Failed to play 'run' animation directly, trying fallback`, 'warn', `AdaptedSprint_DirectFail_${charId}`, 0, undefined, 'normal');
            
            // Fallback to setAnimation if directPlayAnimation fails
            const setAnimResult = this.character.setAnimation('run', fadeIn);
            
            if (setAnimResult < 0) {
                appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] CRITICAL: Both animation methods failed!`, 'error', `AdaptedSprint_AnimFail_${charId}`, 0, undefined, 'critical');
                return;
            }
        }
        
        // Apply timeScale to make sprint visually different from walk
        try {
            // Find the run animation clip
            const runClip = this.character.animations?.find((clip: THREE.AnimationClip) => 
                clip.name === 'run' || clip.name.toLowerCase() === 'run'
            );
            
            if (runClip && this.character.mixer) {
                // Get the action for this clip
                const action = this.character.mixer.existingAction(runClip);
                
                if (action) {
                    // Set timeScale to make animation faster for sprint
                    action.timeScale = sprintTimeScale;
                    appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Applied timeScale: ${sprintTimeScale} to run animation for sprint effect`, 'log', `AdaptedSprint_TimeScale_${charId}`, 500, undefined, 'normal');
                }
            }
        } catch (error) {
            appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Error applying timeScale: ${(error as Error).message}`, 'error', `AdaptedSprint_TimeScaleError_${charId}`, 0, undefined, 'critical');
        }
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Check if any direction keys are pressed
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        const runKeyPressed = this.character.actions.run.isPressed;
        
        // Log input state regularly but not too often
        if (Math.floor(this.timer * 10) % 10 === 0) { // Log approximately every 1 second
            appendToCustomLog(
                `[AdaptedSprintState.update ID: ${charId}] Input: up=${up}, down=${down}, left=${left}, right=${right}, run=${runKeyPressed}`,
                'log',
                `AdaptedSprint_InputCheck_${charId}`,
                1000,
                undefined,
                'normal'
            );
        }
        
        // If no direction keys pressed, immediately transition to EndWalk
        if (!anyDirectionPressed) {
            this._noInputTimer += timeStep;
            
            // Make transition immediate but with debouncing to prevent flickering
            // Get timestamp to prevent rapid state changes
            const now = Date.now();
            const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
            const minTimeBetweenStateChanges = 100; // 100ms between state changes (reduced for faster response)
            
            if (now - lastStateChange >= minTimeBetweenStateChanges && this._noInputTimer >= this._maxNoInputTime) {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] No input detected, immediately transitioning to EndWalk`, 'warn', `AdaptedSprint_NoInputTransition_${charId}`, 0, undefined, 'critical');
                
                // Record state change time
                (this.character as any)._lastStateChangeTime = now;
                
                // Play stop animation directly to ensure animation transition starts immediately
                directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
                
                // Transition to EndWalk without waiting
                this.character.setState(new AdaptedEndWalk(this.character));
                return;
            } else {
                // Not enough time has passed since last state change
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] No input detected but too soon (${now - lastStateChange}ms) since last state change. Waiting.`, 'log', `AdaptedSprint_WaitingForTransition_${charId}`, 1000, undefined, 'normal');
            }
        } else {
            // Reset no input timer if direction keys are pressed
            this._noInputTimer = 0;
            
            // Force sprint animation on every update if we have direction input
            // but only if enough time has passed since last animation update
            if (Date.now() / 1000 - this._lastAnimationTime >= 0.25) { // Only update every 250ms to avoid animation spam
                this.playSprintAnimation(0.1);
            }
        }
        
        // Call parent update
        super.update(timeStep);
        
        // Increment our animation check timer
        this._animationCheckTimer += timeStep;
        
        // Check if we need to verify animation state
        if (this._animationCheckTimer >= this._checkInterval) {
            this._animationCheckTimer = 0;
            
            // Check if animation needs reinforcement
            if (anyDirectionPressed) {
                // Get current animation
                const currentAnim = (this.character as any)._currentAnimation || null;
                
                // If moving but not playing run animation, force it
                if (currentAnim !== 'run') {
                    appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Animation mismatch detected. Current: '${currentAnim}', forcing 'run'`, 'warn', `AdaptedSprint_AnimMismatch_${charId}`, 0, undefined, 'critical');
                    this.playSprintAnimation(0.05); // Quick transition
                }
            }
        }
        
        // Check if sprint key was released with proper debouncing
        if (!runKeyPressed && anyDirectionPressed) {
            // Get timestamp to prevent rapid state changes
            const now = Date.now();
            const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
            const minTimeBetweenStateChanges = 150; // 150ms minimum between state changes
            
            if (now - lastStateChange >= minTimeBetweenStateChanges) {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Run key released while moving, transitioning to AdaptedWalkState`, 'log', `AdaptedSprint_ToWalk_${charId}`, 0, undefined, 'normal');
                
                // Record state change time
                (this.character as any)._lastStateChangeTime = now;
                
                // Transition to Walk state
                this.character.setState(new AdaptedWalkState(this.character));
                return;
            } else {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Run key released but suppressing transition (${now - lastStateChange}ms < ${minTimeBetweenStateChanges}ms)`, 'log', `AdaptedSprint_SuppressTransition_${charId}`, 500, undefined, 'normal');
            }
        }
    }
    
    public onInputChange(): void {
        // Get character ID for logging
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Get a timestamp to prevent rapid state changes
        const now = Date.now();
        const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
        const minTimeBetweenStateChanges = 100; // Minimum 100ms between state changes
        
        // Check if any direction keys are pressed with more detailed logging
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        
        appendToCustomLog(
            `[AdaptedSprintState.onInputChange ID: ${charId}] Direction keys: up=${up}, down=${down}, left=${left}, right=${right}`,
            'log',
            `AdaptedSprint_InputDetails_${charId}`,
            500,
            undefined,
            'normal'
        );
        
        // If sprint key released, transition to Walk
        if (!this.character.actions.run.isPressed && anyDirectionPressed) {
            appendToCustomLog(`[AdaptedSprintState.onInputChange ID: ${charId}] Run released but still has direction input, transitioning to Walk`, 'log', `AdaptedSprint_ToWalk_${charId}`, 0, undefined, 'normal');
            
            // Record state change time
            (this.character as any)._lastStateChangeTime = now;
            
            // Use our custom walk state
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        
        // If no direction pressed, transition to EndWalk IMMEDIATELY
        if (!anyDirectionPressed) {
            appendToCustomLog(`[AdaptedSprintState.onInputChange ID: ${charId}] *** No direction keys pressed, FORCING transition to EndWalk ***`, 'warn', `AdaptedSprint_ToEndWalk_${charId}`, 0, undefined, 'critical');
            
            // Record state change time
            (this.character as any)._lastStateChangeTime = now;
            
            // Play stop animation directly before state change
            directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
            
            // Transition directly to EndWalk state which will handle the stop animation
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        
        // Only call super if we haven't already handled the state transition
        super.onInputChange();
    }
}




