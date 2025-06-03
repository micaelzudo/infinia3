import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
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
    public inputManager!: InputManager;
    public graphicsWorld: THREE.Scene;
    public renderer: { domElement: HTMLElement };
    public updatables: any[] = [];
    
    public cameraOperator: CameraOperator | null = null; 
    public player: Character | null = null;
    public camera: THREE.PerspectiveCamera | null = null;

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
        // Create a new scene that matches Sketchbook's THREE.js version
        this.graphicsWorld = new THREE.Scene();
        // Copy all objects from host scene to our scene
        hostScene.children.forEach(child => {
            const clonedChild = child.clone();
            // Ensure the cloned object has all required properties
            if (!('animations' in clonedChild)) {
                (clonedChild as any).animations = [];
            }
            if (!('removeFromParent' in clonedChild)) {
                (clonedChild as any).removeFromParent = function() {
                    if (this.parent) {
                        this.parent.remove(this);
                    }
                };
            }
            if (!('clear' in clonedChild)) {
                (clonedChild as any).clear = function() {
                    this.children = [];
                };
            }
            this.graphicsWorld.add(clonedChild);
        });
        
        this.renderer = { domElement: hostRendererDomElement };
        this.camera = hostCamera;

        try {
            this.inputManager = new InputManager(this as any, hostRendererDomElement); 
            console.log("SketchbookWorldAdapter: InputManager initialized.");
        } catch (e) {
            console.error("SketchbookWorldAdapter: FAILED to initialize InputManager:", e);
        }
    }

    public add(entity: any): void {
        if (entity instanceof THREE.Object3D) {
            // Ensure the entity has all required properties
            if (!('animations' in entity)) {
                (entity as any).animations = [];
            }
            if (!('removeFromParent' in entity)) {
                (entity as any).removeFromParent = function() {
                    if (this.parent) {
                        this.parent.remove(this);
                    }
                };
            }
            if (!('clear' in entity)) {
                (entity as any).clear = function() {
                    this.children = [];
                };
            }
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
}

export function initIsolatedThirdPerson(params: InitIsolatedThirdPersonParams) {
    console.log("Initializing Isolated Third Person mode...");
    isActive = true;
    sceneRef = params.scene;
    rendererRef = params.renderer;
    onExitCallback = params.onExit;
    const spawnPos = params.initialSpawnPosition || new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 2, 0);

    // Store generation parameters
    tpNoiseLayers = params.noiseLayers;
    tpSeed = params.seed;
    tpCompInfo = params.compInfo;
    tpNoiseScale = params.noiseScale;
    tpPlanetOffset = params.planetOffset;

    // Initialize with terrain from viewer
    tpLoadedChunks = params.initialLoadedChunks || {};
    tpChunkMeshes = params.initialChunkMeshes || {};
    tpPendingRequests.clear();
    tpForceChunkLoad = true;
    tpTimeSinceLastLoadCheck = TP_LOAD_CHECK_INTERVAL;

    if (!rendererRef || !sceneRef) {
        console.error("Renderer or Scene not available for Isolated Third Person initialization.");
        if(onExitCallback) onExitCallback();
        return { camera: null }; 
    }

    const canvas = rendererRef.domElement;
    console.log("[TP Init] Using renderer DOM element for InputManager:", canvas);
    const aspect = canvas.clientWidth / canvas.clientHeight;
    thirdPersonCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000);
    console.log("[TP Init] Third person camera created.", thirdPersonCamera);

    try {
        // Create the adapter with proper type assertions
        sketchbookWorldAdapterInstance = new SketchbookWorldAdapter(
            sceneRef,
            rendererRef.domElement,
            thirdPersonCamera
        );
        console.log("[TP Init] SketchbookWorldAdapter instantiated.");

        // Disable InputManager's pointer lock handling
        if (sketchbookWorldAdapterInstance && sketchbookWorldAdapterInstance.params) {
            sketchbookWorldAdapterInstance.params.Pointer_Lock = false;
            console.log("[TP Init] SketchbookWorldAdapter Pointer_Lock set to false for InputManager.");
        }

        // Focus the canvas
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

    // Add comprehensive lighting setup
    if (sceneRef && sceneRef.children) {
        // Find existing lights
        const existingLights = sceneRef.children.filter(child => child instanceof THREE.Light);
        console.log(`[TP Init] Found ${existingLights.length} existing lights in scene`);

        // Add character-specific lighting if needed
        if (existingLights.length === 0) {
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            sceneRef.add(ambientLight);
            console.log('[TP Init] Added ambient light');

            // Add main directional light
            const mainLight = new THREE.DirectionalLight(0xffffff, 1);
            mainLight.position.set(5, 5, 5);
            mainLight.castShadow = true;
            mainLight.shadow.mapSize.width = 2048;
            mainLight.shadow.mapSize.height = 2048;
            mainLight.shadow.camera.near = 0.5;
            mainLight.shadow.camera.far = 50;
            sceneRef.add(mainLight);
            console.log('[TP Init] Added main directional light');

            // Add fill light
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
            fillLight.position.set(-5, 3, -5);
            sceneRef.add(fillLight);
            console.log('[TP Init] Added fill light');

            // Add rim light
            const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
            rimLight.position.set(0, 5, -5);
            sceneRef.add(rimLight);
            console.log('[TP Init] Added rim light');
        } else {
            // Adjust existing lights for character
            existingLights.forEach(light => {
                if (light instanceof THREE.DirectionalLight) {
                    light.castShadow = true;
                    light.shadow.mapSize.width = 2048;
                    light.shadow.mapSize.height = 2048;
                    light.shadow.camera.near = 0.5;
                    light.shadow.camera.far = 50;
                    console.log('[TP Init] Configured existing directional light for shadows');
                }
            });
        }
    }

    playerPhysicsState = {
        yVelocity: 0,
        grounded: false
    };

    const primaryModelPath = '/assets/boxman.glb';
    const fallbackModelPath = 'debug/Sketchbook-master/build/assets/boxman.glb';

    const tryLoadModel = (modelPath: string, isLastAttempt: boolean = false) => {
        console.log(`[TP LoadChar] Attempting to load character model from: ${modelPath}`);
        const loadStartTime = performance.now();

    gltfLoader.load(
            modelPath,
        (gltf) => {
                const loadEndTime = performance.now();
                console.log(`[TP LoadChar] Character model loaded in ${(loadEndTime - loadStartTime).toFixed(2)}ms from ${modelPath}`);
                
                try {
                    if (gltf.animations && gltf.animations.length > 0) {
                        const animNames = gltf.animations.map(anim => anim.name).join(', ');
                        console.log(`[TP LoadChar] Model animations: ${animNames}`);
                    } else {
                        console.warn("[TP LoadChar] No animations found in the model");
                    }

                    // Convert materials before creating character
                    gltf.scene.traverse((node) => {
                        if (node instanceof THREE.Mesh) {
                            const mesh = node as THREE.Mesh;
                            // Handle both single material and material array
                            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                            
                            const newMaterials = materials.map(oldMat => {
                                // Always convert to MeshStandardMaterial regardless of original type
                                console.log(`[TP LoadChar] Converting material to MeshStandardMaterial for mesh: ${mesh.name}`);
                                
                                // Create a basic MeshStandardMaterial first
                                const newMat = new THREE.MeshStandardMaterial({
                                    color: 0xffffff,
                                    metalness: 0.0,
                                    roughness: 1.0,
                                    side: THREE.FrontSide,
                                    envMapIntensity: 1.0,
                                    flatShading: false,
                                    vertexColors: false
                                });

                                // Handle specific material types
                                if (oldMat instanceof THREE.MeshPhongMaterial) {
                                    console.log(`[TP LoadChar] Converting MeshPhongMaterial for mesh: ${mesh.name}`);
                                    newMat.color.copy(oldMat.color);
                                    newMat.emissive.copy(oldMat.emissive);
                                    newMat.emissiveIntensity = oldMat.emissiveIntensity;
                                    // Convert shininess to roughness (inverse relationship)
                                    newMat.roughness = 1.0 - (oldMat.shininess / 100);
                                    // Convert specular to metalness
                                    newMat.metalness = oldMat.specular.r * 0.5;
                                    newMat.flatShading = oldMat.flatShading;
                                    newMat.vertexColors = oldMat.vertexColors;
                                    newMat.wireframe = oldMat.wireframe;
                                    newMat.transparent = oldMat.transparent;
                                    newMat.opacity = oldMat.opacity;
                                    newMat.name = oldMat.name;

                                    // Handle textures
                                    if (oldMat.map) {
                                        newMat.map = oldMat.map;
                                        newMat.map.needsUpdate = true;
                                    }
                                    if (oldMat.normalMap) {
                                        newMat.normalMap = oldMat.normalMap;
                                        newMat.normalMap.needsUpdate = true;
                                    }
                                }

                                // Set material properties
                                newMat.needsUpdate = true;
                                return newMat;
                            });

                            // Apply new materials
                            mesh.material = Array.isArray(mesh.material) ? newMaterials : newMaterials[0];

                            // Ensure geometry has all required attributes
                            if (mesh.geometry instanceof THREE.BufferGeometry) {
                                const geometry = mesh.geometry as THREE.BufferGeometry;
                                
                                if (!geometry.attributes.uv2 && geometry.attributes.uv) {
                                    console.log(`[TP LoadChar] Adding UV2 coordinates for mesh: ${mesh.name}`);
                                    geometry.setAttribute('uv2', geometry.attributes.uv);
                                }

                                // Enable shadows for the mesh
                                mesh.castShadow = true;
                                mesh.receiveShadow = true;

                                // Force geometry update and ensure proper attributes
                                if (geometry) {
                                    // Ensure position attribute exists and is valid
                                    if (!geometry.attributes.position) {
                                        console.error(`[TP LoadChar] Mesh ${mesh.name} is missing position attribute`);
                                        return;
                                    }

                                    // Ensure normal attribute exists and is valid
                                    if (!geometry.attributes.normal) {
                                        console.log(`[TP LoadChar] Computing normals for mesh: ${mesh.name}`);
                                        geometry.computeVertexNormals();
                                    }

                                    // Ensure tangent attribute exists and is valid
                                    if (!geometry.attributes.tangent) {
                                        console.log(`[TP LoadChar] Computing tangents for mesh: ${mesh.name}`);
                                        // Use computeTangents from THREE.BufferGeometryUtils if available
                                        if (typeof THREE.BufferGeometryUtils !== 'undefined') {
                                            THREE.BufferGeometryUtils.computeTangents(geometry);
                                        } else {
                                            console.warn(`[TP LoadChar] BufferGeometryUtils not available for computing tangents`);
                                        }
                                    }

                                    // Ensure UV attribute exists and is valid
                                    if (!geometry.attributes.uv) {
                                        console.warn(`[TP LoadChar] Mesh ${mesh.name} is missing UV coordinates`);
                                        // Create default UVs if missing
                                        const positions = geometry.attributes.position;
                                        const uvs = new Float32Array(positions.count * 2);
                                        for (let i = 0; i < positions.count; i++) {
                                            uvs[i * 2] = 0;
                                            uvs[i * 2 + 1] = 0;
                                        }
                                        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                                    }

                                    // Force update all attributes
                                    const attributes = [
                                        'position',
                                        'normal',
                                        'tangent',
                                        'uv',
                                        'uv2'
                                    ];

                                    attributes.forEach(attrName => {
                                        if (geometry.attributes[attrName]) {
                                            (geometry.attributes[attrName] as THREE.BufferAttribute).needsUpdate = true;
                                        }
                                    });

                                    // Ensure geometry is properly indexed
                                    if (!geometry.index) {
                                        console.log(`[TP LoadChar] Creating index for mesh: ${mesh.name}`);
                                        const positions = geometry.attributes.position;
                                        const indices = new Uint32Array(positions.count);
                                        for (let i = 0; i < positions.count; i++) {
                                            indices[i] = i;
                                        }
                                        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                                    }

                                    // Force geometry update
                                    geometry.computeBoundingSphere();
                                    geometry.computeBoundingBox();
                                }
                            }
                        }
                    });

                    // Force a scene update to ensure materials are properly initialized
                    if (sceneRef) {
                        sceneRef.updateMatrixWorld(true);
                    }

                    // Ensure renderer is properly configured
                    if (rendererRef) {
                        rendererRef.shadowMap.enabled = true;
                        rendererRef.shadowMap.type = THREE.PCFSoftShadowMap;
                        rendererRef.outputEncoding = THREE.sRGBEncoding;
                        rendererRef.toneMapping = THREE.ACESFilmicToneMapping;
                        rendererRef.toneMappingExposure = 1.0;
                    }

            if (!sceneRef || !sketchbookWorldAdapterInstance || !thirdPersonCamera) {
                        console.error("[TP LoadChar] Scene, WorldAdapter, or TP Camera not available when GLTF loaded.");
                if (onExitCallback) onExitCallback();
                return;
            }

                    console.log("[TP LoadChar] Attempting to instantiate Character...");
                characterRef = new Character(gltf, spawnPos as any);
                    console.log("[TP LoadChar] Sketchbook Character instantiated.", characterRef);

                    // Initialize character with our helper function
                    initializeCharacter(characterRef, gltf);
                    
                    // Apply collision group configuration using our helper function
                    configureCharacterPhysics(characterRef);
                    console.log("[TP Init] Configured character physics and states");

                    if (characterRef && typeof characterRef.setAnimation === 'function') {
                        const originalSetAnimation = characterRef.setAnimation.bind(characterRef);
                        characterRef.setAnimation = (clipName: string, fadeIn: number = 0.2): number => {
                            originalSetAnimation(clipName, fadeIn);
                            return 0; // Return a number to satisfy the type
                        };
                    }

                characterRef.world = sketchbookWorldAdapterInstance as any; 
                    characterRef.setPhysicsEnabled(true);
                sketchbookWorldAdapterInstance.add(characterRef);

                    // After Character is instantiated, add stubs if needed
                    if (characterRef) {
                        // Add removeFromParent and clear if missing
                        if (typeof (characterRef as any).removeFromParent !== 'function') {
                            (characterRef as any).removeFromParent = function() {
                                if (this.parent) {
                                    this.parent.remove(this);
                                }
                            };
                        }
                        if (typeof (characterRef as any).clear !== 'function') {
                            (characterRef as any).clear = function() {
                                this.children = [];
                            };
                        }
                        // Ensure spawn position is above terrain
                        const safeSpawnY = Math.max(spawnPos.y, CHUNK_HEIGHT / 2 + 2);
                        characterRef.position.set(spawnPos.x, safeSpawnY, spawnPos.z);
                        characterRef.visible = true;
                        characterRef.scale.set(1, 1, 1);
                        if (sceneRef && !sceneRef.children.includes(characterRef as any)) {
                            sceneRef.add(characterRef as any);
                        }
                    }

                    console.log("[TP LoadChar] Attempting to instantiate CameraOperator...");
                cameraOperatorRef = new CameraOperator(sketchbookWorldAdapterInstance as any, thirdPersonCamera as any);
                sketchbookWorldAdapterInstance.add(cameraOperatorRef);
                cameraOperatorRef.followMode = true; 
                    cameraOperatorRef.target = characterRef.position; 
                    cameraOperatorRef.characterCaller = characterRef;

                    if (sketchbookWorldAdapterInstance.updateControls) {
                        sketchbookWorldAdapterInstance.updateControls([
                            { keys: ["W", "A", "S", "D"], desc: "Movement" },
                            { keys: ["Shift"], desc: "Sprint" },
                            { keys: ["Space"], desc: "Jump" }
                        ]);
                    }

                    console.log("[TP LoadChar] Character setup complete");

                    // Set initial camera position with proper offset
                    if (cameraOperatorRef && thirdPersonCamera && characterRef) {
                        // Set initial camera distance and clamp in update
                        (cameraOperatorRef as any).distance = 3.0;
                        (cameraOperatorRef as any).minDistance = 2.0;
                        (cameraOperatorRef as any).maxDistance = 10.0;
                        // Always set camera target to character position
                        cameraOperatorRef.target = characterRef.position;
                        // Set camera position behind and above character
                        thirdPersonCamera.position.set(
                            characterRef.position.x,
                            characterRef.position.y + 2,
                            characterRef.position.z + 3
                        );
                        thirdPersonCamera.lookAt((characterRef.position as any).x, (characterRef.position as any).y, (characterRef.position as any).z);
                    }

                    // Configure shadow settings for the character
                    characterRef.traverse((node) => {
                        if (node instanceof THREE.Mesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                            
                            // Ensure material is properly configured for shadows
                            if (node.material) {
                                const materials = Array.isArray(node.material) ? node.material : [node.material];
                                materials.forEach(mat => {
                                    if (mat instanceof THREE.MeshStandardMaterial) {
                                        mat.shadowSide = THREE.FrontSide;
                                        mat.needsUpdate = true;
                                        
                                        // Add shadow callbacks
                                        (mat as any).onBeforeShadow = () => {};
                                        (mat as any).onAfterShadow = () => {};
                                    }
                                });
                }
                        }
                    });

                } catch (error) {
                    console.error("[TP LoadChar] Error setting up character:", error);
                if (onExitCallback) onExitCallback();
            }
        },
            (progress) => {
                if (progress.lengthComputable) {
                    const percentComplete = Math.round((progress.loaded / progress.total) * 100);
                    console.log(`[TP LoadChar] Loading progress: ${percentComplete}%`);
                }
            },
        (error) => {
                console.error(`[TP LoadChar] Error loading character model from ${modelPath}:`, error);
                if (!isLastAttempt) {
                    console.warn("[TP LoadChar] Trying fallback model path...");
                    tryLoadModel(fallbackModelPath, true);
                } else {
            if (onExitCallback) onExitCallback();
                }
        }
    );
    };

    tryLoadModel(primaryModelPath);

    clock.start();
    console.log("Isolated Third Person mode initialization process started.");

    // --- Initialize Worker Pool ---
    if (!initIsolatedWorkerPool(handleTPWorkerResult)) { // Assuming a shared or new worker pool
        console.error("TP Mode: CRITICAL: Failed to initialize worker pool. Dynamic loading will be impaired.");
    }

    // --- Preload Initial Chunks (around character spawn) ---
    if (characterRef && tpNoiseLayers && tpSeed) { // Ensure character is loaded for position
        const initialCharChunkX = Math.floor(characterRef.position.x / CHUNK_SIZE);
        const initialCharChunkY = Math.floor(characterRef.position.y / CHUNK_HEIGHT);
        const initialCharChunkZ = Math.floor(characterRef.position.z / CHUNK_SIZE);

        tpLastCharacterChunkX = initialCharChunkX;
        tpLastCharacterChunkY = initialCharChunkY;
        tpLastCharacterChunkZ = initialCharChunkZ;

        console.log(`TP Mode: Preloading initial chunks around (${initialCharChunkX}, ${initialCharChunkY}, ${initialCharChunkZ})`);
        const preloadRadius = 1; // e.g., a 3x3 horizontal area, 1 layer vertically
        for (let dy = -TP_VERTICAL_LOAD_RADIUS_BELOW; dy <= TP_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
            for (let dx = -preloadRadius; dx <= preloadRadius; dx++) {
                for (let dz = -preloadRadius; dz <= preloadRadius; dz++) {
                    const preloadX = initialCharChunkX + dx;
                    const preloadY = initialCharChunkY + dy;
                    const preloadZ = initialCharChunkZ + dz;
                    const chunkKey = getChunkKeyY(preloadX, preloadY, preloadZ);

                    if (!tpLoadedChunks[chunkKey] && !tpPendingRequests.has(chunkKey)) {
                        console.log(`TP Mode: Pre-requesting ${chunkKey}`);
                        tpLoadedChunks[chunkKey] = { // Placeholder
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
        console.warn("TP Mode: CharacterRef not available at preloading stage, or missing gen params. Initial preloading skipped.");
    }
    // --- End Preload ---

    return { camera: thirdPersonCamera }; 
}

export function updateIsolatedThirdPerson() {
    if (!isActive || !sketchbookWorldAdapterInstance || !characterRef || !playerPhysicsState) return;
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
    proxyCharacterObject.position.set(
        (characterRef.position as any).x,
        (characterRef.position as any).y,
        (characterRef.position as any).z
    );
    proxyCharacterObject.quaternion.copy(characterRef.quaternion as any);

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

    // Update CameraOperator's target with proper type assertions
    if (cameraOperatorRef && cameraOperatorRef.target !== characterRef.position) {
        const targetPos = new THREE.Vector3();
        targetPos.copy(characterRef.position);
        (cameraOperatorRef.target as any) = targetPos;
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

    // --- NEW: Dynamic Chunk Loading Loop ---
    if (characterRef && (tpTimeSinceLastLoadCheck >= TP_LOAD_CHECK_INTERVAL || tpForceChunkLoad)) {
        tpTimeSinceLastLoadCheck = 0;
        tpForceChunkLoad = false;

        const charX = characterRef.position.x;
        const charY = characterRef.position.y;
        const charZ = characterRef.position.z;

        const charChunkX = Math.floor(charX / CHUNK_SIZE);
        const charChunkY = Math.floor(charY / CHUNK_HEIGHT);
        const charChunkZ = Math.floor(charZ / CHUNK_SIZE);

        if (charChunkX !== tpLastCharacterChunkX || charChunkY !== tpLastCharacterChunkY || charChunkZ !== tpLastCharacterChunkZ) {
            console.log(`TP Mode: Character moved to chunk ${charChunkX},${charChunkY},${charChunkZ}. Triggering load.`);
            tpLastCharacterChunkX = charChunkX;
            tpLastCharacterChunkY = charChunkY;
            tpLastCharacterChunkZ = charChunkZ;
        }

        const chunksToConsiderProcessing: {x:number, y:number, z:number}[] = [];

        for (let dy = -TP_VERTICAL_LOAD_RADIUS_BELOW; dy <= TP_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
            for (let dx = -TP_LOAD_CHUNK_RADIUS; dx <= TP_LOAD_CHUNK_RADIUS; dx++) {
                for (let dz = -TP_LOAD_CHUNK_RADIUS; dz <= TP_LOAD_CHUNK_RADIUS; dz++) {
                    const loadX = charChunkX + dx;
                    const loadY = charChunkY + dy;
                    const loadZ = charChunkZ + dz;
                    const chunkKey = getChunkKeyY(loadX, loadY, loadZ);

                    // If mesh doesn't exist and not already pending request
                    if (!tpChunkMeshes[chunkKey] && !tpPendingRequests.has(chunkKey)) {
                        chunksToConsiderProcessing.push({x: loadX, y: loadY, z: loadZ});
                    } else if (tpLoadedChunks[chunkKey]) { // Update access time if already loaded/pending
                        tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
                    }
                }
            }
        }
        
        // Basic priority: process chunks closer to the character first (simple distance sort)
        chunksToConsiderProcessing.sort((a, b) => {
            const distA = Math.abs(a.x - charChunkX) + Math.abs(a.y - charChunkY) + Math.abs(a.z - charChunkZ);
            const distB = Math.abs(b.x - charChunkX) + Math.abs(b.y - charChunkY) + Math.abs(b.z - charChunkZ);
            return distA - distB;
        });

        let processedThisFrame = 0;
        const MAX_CHUNK_GEN_PER_FRAME = 2; // Limit how many new chunks we try to mesh per frame

        for (const {x, y, z} of chunksToConsiderProcessing) {
            if (processedThisFrame >= MAX_CHUNK_GEN_PER_FRAME) break;

            const chunkKey = getChunkKeyY(x, y, z);
            // Double check, as sort might not guarantee unique iteration order if some were added to pending by neighbors
            if (tpChunkMeshes[chunkKey] || tpPendingRequests.has(chunkKey)) {
                continue;
            }

            let chunkData = tpLoadedChunks[chunkKey];
            if (!chunkData) {
                tpLoadedChunks[chunkKey] = { noiseMap: null, mesh: null, lastAccessTime: Date.now() };
                chunkData = tpLoadedChunks[chunkKey];
            }

            if (!chunkData.noiseMap) { // If no noise map, request it (or generate synchronously if worker pool is disabled)
                if (tpNoiseLayers && tpSeed) { // Check if gen params are available
                    console.log(`TP Mode: Requesting/Generating noise map for ${chunkKey}`);
                    // For simplicity, let's try synchronous generation first if no worker setup, then mesh.
                    // If worker pool is robust, prefer `requestChunkGeometry`
                    // For this adaptation, assuming worker will handle it:
                    if (requestChunkGeometry(x, y, z, tpNoiseLayers, tpSeed)) {
                        tpPendingRequests.add(chunkKey);
                        processedThisFrame++; 
                    } else {
                        console.error(`[TP Update] Failed to post message to worker for chunk ${chunkKey}.`);
                        // If request fails, ensure it's not stuck as a placeholder without a pending request
                        if (tpLoadedChunks[chunkKey] && !tpLoadedChunks[chunkKey].noiseMap && !tpLoadedChunks[chunkKey].mesh) {
                            delete tpLoadedChunks[chunkKey];
                        }
                    }
                } else {
                    console.warn(`TP Mode: Cannot generate noise map for ${chunkKey}, missing gen params.`);
                }
            } else { // Noise map exists, try to generate mesh
                if (generateTPLocalMesh(x, y, z)) {
                    processedThisFrame++;
                }
            }
        }
    }
    // --- END Dynamic Chunk Loading Loop ---

    // In the updateIsolatedThirdPerson function, update the camera handling:
    if (cameraOperatorRef && thirdPersonCamera && characterRef) {
        // Clamp camera distance
        const minDistance = 2.0;
        const maxDistance = 10.0;
        const target = characterRef.position;
        const camToTarget = new THREE.Vector3().subVectors(thirdPersonCamera.position, target);
        let dist = camToTarget.length();
        if (dist < minDistance) {
            camToTarget.setLength(minDistance);
            thirdPersonCamera.position.set(
                target.x + camToTarget.x,
                target.y + camToTarget.y,
                target.z + camToTarget.z
            );
        } else if (dist > maxDistance) {
            camToTarget.setLength(maxDistance);
            thirdPersonCamera.position.set(
                target.x + camToTarget.x,
                target.y + camToTarget.y,
                target.z + camToTarget.z
            );
        }
        // Always look at character
        thirdPersonCamera.lookAt((target as any).x, (target as any).y, (target as any).z);
        cameraOperatorRef.target = target;
    }
}

export function cleanupIsolatedThirdPerson() {
    console.log("Cleaning up Isolated Third Person mode...");
    if (!isActive) return;
    isActive = false;
    clock.stop();

    // --- Terminate Worker Pool ---
    terminateIsolatedWorkerPool(); // Assuming shared pool, or a tpTerminateWorkerPool
    tpPendingRequests.clear();
    // --- End Worker Pool Termination ---

    if (characterRef && sketchbookWorldAdapterInstance) {
        sketchbookWorldAdapterInstance.remove(characterRef);
    }
    characterRef = null;
    
    if (cameraOperatorRef && sketchbookWorldAdapterInstance && typeof cameraOperatorRef.update === 'function') {
        sketchbookWorldAdapterInstance.unregisterUpdatable(cameraOperatorRef);
    }
    cameraOperatorRef = null; 

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
            }
        }
    }
    tpChunkMeshes = {};
    tpLoadedChunks = {};
    // --- End Clear ---

    // --- Reset generation parameters ---
    tpNoiseLayers = null;
    tpSeed = null;
    tpCompInfo = null;
    tpNoiseScale = null;
    tpPlanetOffset = null;
    // --- End Reset ---

    console.log("Isolated Third Person mode CLEANED UP.");
}

// --- Placeholder Input Handlers (to be integrated with your system or Sketchbook's InputManager) ---

// --- Getters (Optional) ---
export function isIsolatedThirdPersonActive(): boolean {
    return isActive;
}

export function getIsolatedThirdPersonCamera(): THREE.PerspectiveCamera | null {
    return thirdPersonCamera;
}

// --- NEW: Worker Result Handler ---
function handleTPWorkerResult(data: TPWorkerResultObject) {
    const { chunkX, chunkY, chunkZ, payload } = data; // Destructure payload
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);

    console.log(`TP Mode: Worker result received for ${chunkKey}. Position buffer present: ${!!payload.positionBuffer}`);

    if (!tpLoadedChunks || !tpChunkMeshes || !sceneRef || !tpCompInfo || tpNoiseScale === null || !tpPlanetOffset || !tpNoiseLayers || !tpSeed) {
        console.warn(`TP Mode: Worker result for ${chunkKey} ignored, essential refs missing.`);
        tpPendingRequests.delete(chunkKey);
        return;
    }

    if (!tpPendingRequests.has(chunkKey)) {
        console.warn(`TP Mode: Received result for ${chunkKey} which was not pending. Ignoring.`);
        return; 
    }

    // Store/update the noise map for this chunk regardless of geometry success
    if (payload.noiseMap) {
        if (tpLoadedChunks[chunkKey]) {
            tpLoadedChunks[chunkKey].noiseMap = payload.noiseMap;
            tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
        } else {
            tpLoadedChunks[chunkKey] = { 
                noiseMap: payload.noiseMap, 
                lastAccessTime: Date.now(), 
                mesh: null 
            };
        }
    } else if (!tpLoadedChunks[chunkKey]?.noiseMap) {
        console.warn(`TP Mode: Worker for ${chunkKey} did not return a noiseMap and none exists locally.`);
        const fallbackNoiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, tpNoiseLayers, tpSeed);
        if (fallbackNoiseMap) {
            if (tpLoadedChunks[chunkKey]) tpLoadedChunks[chunkKey].noiseMap = fallbackNoiseMap;
            else tpLoadedChunks[chunkKey] = { noiseMap: fallbackNoiseMap, lastAccessTime: Date.now(), mesh: null };
            console.log(`TP Mode: Generated fallback noiseMap for ${chunkKey}.`);
        } else {
            console.error(`TP Mode: CRITICAL: Failed to generate fallback noiseMap for ${chunkKey}. Chunk will likely fail.`);
            tpPendingRequests.delete(chunkKey);
            return; // Cannot proceed
        }
    }

    tpPendingRequests.delete(chunkKey);

    if (payload.positionBuffer && payload.positionBuffer.length > 0) {
        console.log(`TP Mode: Creating mesh for ${chunkKey} directly from worker's positionBuffer.`);
        try {
            const oldMesh = tpChunkMeshes[chunkKey];
            if (oldMesh) {
                disposeNode(sceneRef, oldMesh);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
            geometry.computeVertexNormals(); // Assume worker doesn't send normals for now

            const material = createUnifiedPlanetMaterial(
                tpCompInfo!.topElements,
                tpNoiseScale!,
                tpPlanetOffset!
            );
            material.side = THREE.DoubleSide;

            const newMesh = new THREE.Mesh(geometry, material);
            newMesh.name = `tp_chunk_worker_${chunkKey}`;
            sceneRef.add(newMesh);

            tpChunkMeshes[chunkKey] = newMesh;
            if (tpLoadedChunks[chunkKey]) {
                tpLoadedChunks[chunkKey].mesh = newMesh;
            } else {
                tpLoadedChunks[chunkKey] = { noiseMap: payload.noiseMap, mesh: newMesh, lastAccessTime: Date.now() };
            }
            console.log(`TP Mode: Successfully created mesh for ${chunkKey} from worker geometry.`);

        } catch (error) {
            console.error(`TP Mode: Error creating mesh for ${chunkKey} from worker geometry:`, error);
            if (tpLoadedChunks[chunkKey]?.noiseMap) {
                console.warn(`TP Mode: Falling back to generateTPLocalMesh for ${chunkKey} due to error.`);
                generateTPLocalMesh(chunkX, chunkY, chunkZ);
            } else {
                console.error(`TP Mode: Cannot fallback to generateTPLocalMesh for ${chunkKey}, no noiseMap.`);
            }
        }
    } else {
        console.warn(`TP Mode: Worker for ${chunkKey} did not provide positionBuffer. Attempting generateTPLocalMesh.`);
        if (tpLoadedChunks[chunkKey]?.noiseMap) {
            generateTPLocalMesh(chunkX, chunkY, chunkZ);
        } else {
            console.error(`TP Mode: Cannot run generateTPLocalMesh for ${chunkKey}, no noiseMap available.`);
        }
    }
}

// --- NEW: Local Mesh Generation (adapted from isolatedFirstPerson.ts) ---
function generateTPLocalMesh(cx: number, cy: number, cz: number) {
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
        material.side = THREE.DoubleSide; // Good for third person if camera can clip

        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = `tp_chunk_${chunkKey}`;
        sceneRef.add(newMesh);

        tpChunkMeshes[chunkKey] = newMesh;
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

// Need to import lodash for _.remove in unregisterUpdatable
import _ from 'lodash';

// --- Character Initialization Functions ---
function initializeCharacter(character: Character, gltf: any) {
    if (!character) return;

    // Set up character properties with proper type assertions
    (character as any).rayResult = {
        ray: new THREE.Ray(),
        hitPointWorld: new THREE.Vector3(),
        hitNormalWorld: new THREE.Vector3(),
        hasHit: false
    };

    // Set up velocity and acceleration with proper type assertions
    (character as any).velocity = new THREE.Vector3();
    (character as any).acceleration = new THREE.Vector3();

    // Set up orientation with proper type assertions
    (character as any).orientation = new THREE.Vector3(0, 0, -1);
    (character as any).viewVector = new THREE.Vector3(0, 0, -1);

    // Set up animations with proper type assertions
    if (gltf.animations && gltf.animations.length > 0) {
        (character as any).mixer = new THREE.AnimationMixer(character as any);
        gltf.animations.forEach((clip: any) => {
            if ((character as any).mixer) {
                (character as any).mixer.clipAction(clip);
            }
        });
    }

    // Set up actions with proper type assertions and all required movement controls
    (character as any).actions = {
        up: { isPressed: false, justPressed: false, justReleased: false },
        down: { isPressed: false, justPressed: false, justReleased: false },
        left: { isPressed: false, justPressed: false, justReleased: false },
        right: { isPressed: false, justPressed: false, justReleased: false },
        run: { isPressed: false, justPressed: false, justReleased: false },
        jump: { isPressed: false, justPressed: false, justReleased: false },
        idle: { isPressed: false, justPressed: false, justReleased: false },
        walk: { isPressed: false, justPressed: false, justReleased: false }
    };

    // Set up state machine with proper type assertions
    (character as any).stateMachine = {
        currentState: 'idle',
        states: {
            idle: { enter: () => {}, exit: () => {} },
            walk: { enter: () => {}, exit: () => {} },
            run: { enter: () => {}, exit: () => {} },
            jump: { enter: () => {}, exit: () => {} },
            falling: { enter: () => {}, exit: () => {} }
        }
    };

    // Set up ground impact data with proper type assertions
    (character as any).groundImpactData = new GroundImpactData();

    // Set up movement controls
    (character as any).moveForward = false;
    (character as any).moveBackward = false;
    (character as any).moveLeft = false;
    (character as any).moveRight = false;
    (character as any).canJump = true;
    (character as any).jumpVelocity = 10;
    (character as any).walkVelocity = 4;
    (character as any).runVelocity = 8;
    (character as any).velocityTarget = new THREE.Vector3();
    (character as any).rotationSpeed = 0.1;
    (character as any).acceleration = new THREE.Vector3();
    (character as any).decceleration = new THREE.Vector3(-0.0005, -0.0001, -0.0005);
    (character as any).velocity = new THREE.Vector3();
    (character as any).orientation = new THREE.Vector3(0, 0, -1);
    (character as any).viewVector = new THREE.Vector3(0, 0, -1);
    (character as any).targetOrientation = new THREE.Vector3(0, 0, -1);
    (character as any).targetOrientationLookAt = new THREE.Vector3();
    (character as any).targetOrientationLookAt.copy(character.position).add(character.orientation);
    (character as any).targetOrientationLookAt.y = character.position.y;
    (character as any).targetOrientationLookAt.sub(character.position);
    (character as any).targetOrientationLookAt.normalize();
    (character as any).targetOrientation.copy(character.orientation);
    (character as any).targetOrientation.y = 0;
    (character as any).targetOrientation.normalize();
    (character as any).targetOrientationLookAt.copy(character.position).add(character.orientation);
    (character as any).targetOrientationLookAt.y = character.position.y;
    (character as any).targetOrientationLookAt.sub(character.position);
    (character as any).targetOrientationLookAt.normalize();
    (character as any).targetOrientation.copy(character.orientation);
    (character as any).targetOrientation.y = 0;
    (character as any).targetOrientation.normalize();
}

function configureCharacterPhysics(character: Character) {
    console.log("[TP LoadChar] Configuring character physics...");
    
    // Set up collision properties using proper type assertions
    if (typeof (character as any).setCollider === 'function') {
        (character as any).setCollider({
            radius: 0.5,
            height: 1.8,
            offset: new THREE.Vector3(0, 0.9, 0)
        });
    }

    // Set up physics properties using proper type assertions
    (character as any).physicsEnabled = true;
    if (typeof (character as any).setMass === 'function') {
        (character as any).setMass(70);
    }
    
    // Set up vectors using proper type assertions
    if (typeof (character as any).setVelocity === 'function') {
        (character as any).setVelocity(new THREE.Vector3());
    }
    if (typeof (character as any).setAcceleration === 'function') {
        (character as any).setAcceleration(new THREE.Vector3());
    }
    if (typeof (character as any).setAngularVelocity === 'function') {
        (character as any).setAngularVelocity(new THREE.Vector3());
    }
    if (typeof (character as any).setForce === 'function') {
        (character as any).setForce(new THREE.Vector3());
    }
    if (typeof (character as any).setTorque === 'function') {
        (character as any).setTorque(new THREE.Vector3());
    }

    // Set up ground impact data using proper type assertions
    if (typeof (character as any).setGroundImpactData === 'function') {
        const groundImpactData = new GroundImpactData();
        // Use type assertion for Vector3 compatibility
        const velocity = new THREE.Vector3();
        (groundImpactData as any).velocity = velocity;
        // Add missing properties with type assertions
        (groundImpactData as any).contactPoint = new THREE.Vector3();
        (groundImpactData as any).contactNormal = new THREE.Vector3();
        (character as any).setGroundImpactData(groundImpactData);
    }

    console.log("[TP LoadChar] Character physics configuration complete");
}

// --- PORTED MODEL LOADING LOGIC FROM REFERENCE ---
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

function convertMaterialsToStandard(gltf: any) {
    gltf.scene.traverse((node: any) => {
        if (node.isMesh && node.material) {
            let oldMat = node.material;
            if (!(oldMat instanceof THREE.MeshStandardMaterial)) {
                const newMat = new THREE.MeshStandardMaterial({
                    color: oldMat.color ? oldMat.color.clone() : 0xffffff,
                    map: oldMat.map || null,
                    normalMap: oldMat.normalMap || null,
                    metalness: 0.0,
                    roughness: 1.0,
                    transparent: oldMat.transparent || false,
                    opacity: oldMat.opacity !== undefined ? oldMat.opacity : 1.0,
                });
                node.material = newMat;
            }
        }
    });
}

function loadThirdPersonCharacter(spawnPosition: THREE.Vector3, onLoaded: (character: any) => void, onError: (err: any) => void) {
    const gltfLoader = new GLTFLoader();
    const primaryModelPath = '/assets/boxman.glb';
    const fallbackModelPath = 'debug/Sketchbook-master/build/assets/boxman.glb';

    function tryLoadModel(modelPath: string, isLastAttempt = false) {
        gltfLoader.load(modelPath, (gltf) => {
            // Convert all materials to MeshStandardMaterial
            convertMaterialsToStandard(gltf);

            // Log all animation names
            if (gltf.animations && gltf.animations.length > 0) {
                const animNames = gltf.animations.map((anim: any) => anim.name).join(', ');
                console.log(`[TP LoadChar] Model animations: ${animNames}`);
            } else {
                console.warn("[TP LoadChar] No animations found in the model");
            }

            // Instantiate your character class here (replace with your actual class)
            const character = new Character(gltf, spawnPosition as any);
            onLoaded(character);
        }, undefined, (error) => {
            console.error(`[TP LoadChar] Error loading character model from ${modelPath}:`, error);
            if (!isLastAttempt) {
                tryLoadModel(fallbackModelPath, true);
            } else {
                onError(error);
            }
        });
    }

    tryLoadModel(primaryModelPath);
}