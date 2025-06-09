// c:\Users\Micael\Documents\NEWBEGINNINGS\marchingcubes\debug\modules\ai\yukaController.ts
import * as YUKA from 'yuka';
import * as THREE from 'three';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter'; // Import IsolatedYukaCharacter
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Import GLTF type
import { Character } from '../../Sketchbook-master/src/ts/characters/Character'; // Import Sketchbook Character
import boxmanModelURL from '../../Sketchbook-master/build/assets/boxman.glb?url'; // Import the model URL
import { InputManager } from '../../Sketchbook-master/src/ts/core/InputManager'; // Needed for SketchbookWorldAdapter
import { CameraOperator } from '../../Sketchbook-master/src/ts/core/CameraOperator'; // Needed for SketchbookWorldAdapter

// --- NEW IMPORTS FOR DYNAMIC CHUNK LOADING ---
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../types_debug';
import { updatePlayerMovementAndCollision, type ChunkMeshesRef, type AIPlayerInputState, type PlayerPhysicsState, type PlayerInputState } from '../ui/playerMovement'; // Update import to use AIPlayerInputState AND PlayerInputState
import { getChunkKeyY } from '../../utils_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { initIsolatedWorkerPool, requestChunkGeometry, terminateIsolatedWorkerPool } from '../workers/isolatedWorkerPool';
import { initializeWorkerPool as initNavMeshWorkerPool, terminateWorkerPool as terminateNavMeshWorkerPool } from '../workers/navMeshWorkerPool';
import type { TopElementsData } from '../types/renderingTypes'; // For createUnifiedPlanetMaterial
import { generateTopElements, PLANTS } from '../ui/topelements/generateTopElements';
import { AdvancedAIFeatures, AdvancedAIConfig } from './advancedAIFeatures';
import { EnhancedAIAgent } from './enhancedAIAgent';
import { generateNoiseMap } from '../../noiseMapGenerator_debug'; // Fix import path

// Import the Vector3 as YukaVector3 specifically to make explicit conversions
import { Vector3 as YukaVector3, Path } from 'yuka'; 

// Import the getter for chunk meshes from isolatedTerrainViewer
import { getActiveChunkMeshesForCollision } from '../ui/isolatedTerrainViewer';

// Import the YukaNavMeshHelper
import { YukaNavMeshHelper } from './yukaNavMeshHelper';

// --- NEW IMPORT FOR DEBUGGER ---
import { visualizeNavMeshPolygons, visualizePath, visualizePoint, clearNavMeshDebug } from './navMeshDebugger';

// Constants for AI chunk loading
const AI_LOAD_CHECK_INTERVAL = 2000; // Ms between chunk load checks
const AI_LOAD_CHUNK_RADIUS = 3; // Horizontal radius to load
const AI_VERTICAL_LOAD_RADIUS_BELOW = 2; // How many chunks below to load
const AI_VERTICAL_LOAD_RADIUS_ABOVE = 2; // How many chunks above to load
const AI_CHUNK_EVICTION_TIME = 30000; // Ms before evicting unused chunks

// Define type for worker callback
type WorkerCallback = (result: any, data: any) => void;
type PositionResultCallback = (result: any) => void;

// --- Global Yuka manager state ---
let entityManager: YUKA.EntityManager | null = null;
let time: YUKA.Time | null = null;
let sceneRef: THREE.Scene | null = null;
let cameraRef: THREE.Camera | null = null;
let loadedBoxmanGLTF: GLTF | null = null;
let sketchbookWorldAdapterInstance: SketchbookWorldAdapter | null = null;

// Physics state for each active Yuka agent
const yukaAgentPhysicsStates = new Map<string, PlayerPhysicsState>();
// Camera proxies for Yuka agents
const yukaAgentProxyCameras = new Map<string, THREE.PerspectiveCamera>();
// Last chunk load check time per agent
const lastLoadCheckTime: { [key: string]: number } = {};

// Advanced AI Features Manager
let advancedAIManager: AdvancedAIFeatures | null = null;
// Enhanced AI Agents
const enhancedAIAgents = new Map<string, EnhancedAIAgent>();

// --- Terrain generation state ---
let workerInitialized = false;
const pendingRequests = new Set<string>();

// AI-specific chunk tracking
const aiLoadedChunks: LoadedChunks = {};
const aiChunkMeshes: { [key: string]: THREE.Mesh } = {};

interface GenParams {
    noiseLayers: NoiseLayers | null;
    seed: Seed | null;
    compInfo?: { topElements: TopElementsData | null } | null;
    noiseScale?: number | null;
    planetOffset?: THREE.Vector3 | null;
}

const genParams: GenParams = {
    noiseLayers: null,
    seed: null,
    compInfo: null,
    noiseScale: null,
    planetOffset: null
};

let terrain: { [key: string]: THREE.Mesh } = {};

// --- NavMesh and path planning ---
let navMeshHelper: YukaNavMeshHelper | null = null;
const aiPathCache = new Map<string, { path: THREE.Vector3[], currentIndex: number }>();
// Distance threshold for considering a path point reached
const PATH_POINT_THRESHOLD = 1.5;

/**
 * Load the Boxman model for Sketchbook compatibility
 */
async function loadBoxmanModel(): Promise<void> {
    if (loadedBoxmanGLTF) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            boxmanModelURL,
            (gltf) => {
                console.log('[YukaController] Loaded boxman.glb', gltf.scene);

                // Log available animation names
                if (gltf.animations && gltf.animations.length > 0) {
                    console.log('[YukaController] Available animations in boxman.glb:');
                    gltf.animations.forEach(clip => {
                        console.log(`  - Animation Name: '${clip.name}'`);
                    });
                } else {
                    console.log('[YukaController] No animations found in boxman.glb');
                }

                loadedBoxmanGLTF = gltf;
                resolve();
            },
            undefined,
            (error) => {
                console.error('[YukaController] Error loading Boxman model:', error);
                reject(error);
            }
        );
    });
}

/**
 * Process terrain chunk data received from worker
 */
function processTerrainChunk(key: string, vertices: Float32Array, indices: Uint32Array): void {
    if (!sceneRef) return;
    
    console.log(`[YukaController] Processing terrain chunk ${key}`);
    pendingRequests.delete(key);
    
    try {
        // Create geometry from received vertex data
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        
        // Create material
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B4513, // Brown for ground
            flatShading: true,
            side: THREE.DoubleSide
        });
        
        // Create mesh and add to scene
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `ai_terrain_${key}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Add to scene and store in terrain dictionary
        sceneRef.add(mesh);
        
        // Remove old mesh if present
        if (terrain[key]) {
            sceneRef.remove(terrain[key]);
            if (terrain[key].geometry) terrain[key].geometry.dispose();
            if (terrain[key].material) {
                if (Array.isArray(terrain[key].material)) {
                    terrain[key].material.forEach(m => m.dispose());
                } else {
                    terrain[key].material.dispose();
                }
            }
        }
        
        terrain[key] = mesh;
        
        // Mark navmesh for update since terrain changed
        if (navMeshHelper) navMeshHelper.markDirty();
        
    } catch (error) {
        console.error(`[YukaController] Error processing terrain chunk ${key}:`, error);
    }
}

// +++ COPIED SketchbookWorldAdapter +++
// (Ensure all its internal dependencies like InputManager, CameraOperator are imported)
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

    // Provide a more complete mock physicsWorld, similar to isolatedThirdPerson
    public physicsWorld = {
        remove: (body?: any) => { console.log("[SketchbookWorldAdapter MockPhysics] remove() called", body); },
        addBody: (body?: any) => { console.log("[SketchbookWorldAdapter MockPhysics] addBody() called", body); },
        step: (timeStep: number, oldTimeStep?: number, maxSubSteps?: number) => { /* console.log("[MockPhysicsWorld] step() called"); */ }
        // Add other methods if Character complains
    };

    constructor(params: { scene: THREE.Scene, renderer: HTMLElement, camera: THREE.Camera }) {
        this.graphicsWorld = params.scene;
        this.renderer = { domElement: params.renderer };
        this.camera = params.camera as THREE.PerspectiveCamera;
        try {
            // InputManager might throw errors if hostRendererDomElement is just document.body and not a focused canvas
            this.inputManager = new InputManager(this as any, params.renderer);
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
            this.player = entity; // Though we might have multiple AI agents, Character expects to be 'the player' for its world
            entity.world = this as any;
            console.log("[SketchbookWorldAdapter] Associated with Character:", entity.name);
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
        if (entity === this.player) { // This logic might need adjustment for multiple AI
            this.player = null;
        }
        if (entity === this.cameraOperator) {
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
        // We won't call this from Yuka's update loop, Character instances will be updated by Yuka's EntityManager
        // But Character might call this.world.update() internally for some reason.
        for (const updatable of this.updatables) {
            if (updatable !== this.player) { // Avoid double-updating the character if Yuka also updates it
                 updatable.update(timeStep, unscaledTimeStep);
            }
        }
    }
    public updateControls(controls: any): void { /* Stub */ }
    public scrollTheTimeScale(value: number): void { /* Stub */ }
}
// --- END COPIED SketchbookWorldAdapter ---

// Initialize Yuka AI System
export function initYuka(
    scene: THREE.Scene,
    camera: THREE.Camera,
    rendererDomElement: HTMLCanvasElement,
    noiseLayersParam: NoiseLayers | null = null,
    seedParam: Seed | null = null
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (entityManager) {
            console.log('Yuka system already initialized.');
            resolve();
            return;
        }

        try {
            // Initialize YUKA entity manager and time
            entityManager = new YUKA.EntityManager();
            time = new YUKA.Time();
            sceneRef = scene;
            cameraRef = camera;

            // Store generation parameters for terrain chunks
            genParams.noiseLayers = noiseLayersParam;
            genParams.seed = seedParam;

            console.log('Initializing Yuka system...');
            console.log('Scene ref:', scene);

            // Create a SketchbookWorldAdapter instance
            sketchbookWorldAdapterInstance = new SketchbookWorldAdapter({
                scene: scene,
                camera: camera,
                renderer: rendererDomElement,
            });


            // Initialize the NavMeshHelper
            navMeshHelper = new YukaNavMeshHelper(scene);
            
            // Initialize Advanced AI Features Manager
            advancedAIManager = AdvancedAIFeatures.getInstance();
            console.log('🧠 Advanced AI Features Manager initialized');

            // Load the Sketchbook-compatible character model to reuse for all agents
            loadBoxmanModel()
                .then(() => {
                    console.log('Boxman model loaded and ready for agents.');
                    
                    // Initialize worker pool for terrain geometry generation
                    if (!workerInitialized && noiseLayersParam !== null && seedParam !== null) {
                        console.log('[YukaController] Initializing worker pool for AI terrain awareness');
                        workerInitialized = true;
                        
                        // Cast the callback to match the expected type
                        const workerCallback = (result: any) => {
                            if (result && result.payload) {
                                const key = getChunkKeyY(result.chunkX, result.chunkY, result.chunkZ);
                                processTerrainChunk(key, result.payload.positionBuffer, result.payload.indexBuffer);
                            }
                        };
                        
                        initIsolatedWorkerPool(workerCallback);
                        
                        // Initialize NavMesh worker pool
                        if (!initNavMeshWorkerPool()) {
                            console.error('[YukaController] Failed to initialize NavMesh worker pool');
                        } else {
                            console.log('[YukaController] NavMesh worker pool initialized successfully');
                        }
                    }
                    resolve();
                })
                .catch((err: Error) => {
                    console.error('Failed to load Boxman model:', err);
                    reject(err);
                });
        } catch (error) {
            console.error('Error initializing Yuka system:', error);
            reject(error);
        }
    });
}

function sync(entity: YUKA.GameEntity, renderComponent: THREE.Object3D) {
    renderComponent.matrix.copy(entity.worldMatrix as unknown as THREE.Matrix4);
    
    // Update enhanced AI agents
    if (advancedAIManager && enhancedAIAgents.size > 0) {
        const deltaTime = time?.getDelta() || 0.016; // Fallback to ~60fps
        
        // Update the advanced AI features manager
        advancedAIManager.update(deltaTime);
        
        // Update individual enhanced AI agents
        enhancedAIAgents.forEach((enhancedAgent, agentId) => {
            try {
                enhancedAgent.update(deltaTime);
            } catch (error) {
                console.warn(`Failed to update enhanced AI agent ${agentId}:`, error);
            }
        });
    }
}


// --- NEW: Worker Result Handler (Adapted from isolatedThirdPerson) ---
function handleAIWorkerResult(result: { chunkX: number, chunkY: number, chunkZ: number, payload: { positionBuffer: Float32Array | null, noiseMap: NoiseMap | null } }) {
    const { chunkX, chunkY, chunkZ, payload } = result;
    const key = getChunkKeyY(chunkX, chunkY, chunkZ);

    console.log(`[YukaAIWorker] Received data for ${key}. Mesh data present: ${!!payload.positionBuffer}, NoiseMap: ${!!payload.noiseMap}`);
    pendingRequests.delete(key);

    if (!payload.noiseMap) {
        console.warn(`[YukaAIWorker] No noiseMap returned for ${key}. Cannot process.`);
        return;
    }

    // Store the noise map
    if (!aiLoadedChunks[key]) {
        aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: 0 };
    }
    aiLoadedChunks[key].noiseMap = payload.noiseMap;
    aiLoadedChunks[key].lastAccessTime = Date.now();

    // If positionBuffer (geometry) is also provided by the worker, create mesh directly
    if (payload.positionBuffer && payload.positionBuffer.length > 0 && sceneRef && genParams.compInfo && genParams.noiseScale && genParams.planetOffset) {
        try {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
            // Worker might need to provide normals and UVs, or we compute them here/in shader
            geometry.computeVertexNormals(); 

            const material = createUnifiedPlanetMaterial(
                genParams.compInfo.topElements,
                genParams.noiseScale,
                genParams.planetOffset
            );
            if (material.uniforms.u_showInternalMaterial) {
                 material.uniforms.u_showInternalMaterial.value = false;
            }
            material.side = THREE.DoubleSide;


            const newMesh = new THREE.Mesh(geometry, material);
            newMesh.name = `ai_chunk_${key}`;
            newMesh.renderOrder = 1; // Ensure it's rendered appropriately

            // Remove old mesh if it exists
            if (aiLoadedChunks[key]?.mesh) {
                const oldMesh = aiLoadedChunks[key].mesh;
                if (oldMesh && oldMesh.parent) oldMesh.parent.remove(oldMesh);
                if (oldMesh?.geometry) oldMesh.geometry.dispose();
                // if (oldMesh?.material) (oldMesh.material as THREE.Material).dispose(); // Material is shared
            }
            
            sceneRef.add(newMesh);
            aiLoadedChunks[key].mesh = newMesh;
            aiChunkMeshes[key] = newMesh;
            console.log(`[YukaAIWorker] Created and added mesh for ${key} from worker geometry.`);

        } catch (error) {
            console.error(`[YukaAIWorker] Error creating mesh for ${key} from worker geometry:`, error);
        }
    } else if (payload.noiseMap) {
        // If only noise map, generate mesh locally (less ideal for performance but a fallback)
        console.log(`[YukaAIWorker] Only noiseMap for ${key}. Triggering local mesh generation.`);
        generateAILocalMesh(chunkX, chunkY, chunkZ);
    }
}
// --- END Worker Result Handler ---


// --- NEW: Get/Generate Neighbor NoiseMap (Adapted from isolatedThirdPerson) ---
function getAINeighborNoiseMap(targetChunkX: number, targetChunkY: number, targetChunkZ: number): NoiseMap | null {
    const key = getChunkKeyY(targetChunkX, targetChunkY, targetChunkZ);
    if (aiLoadedChunks[key]?.noiseMap) {
        aiLoadedChunks[key].lastAccessTime = Date.now();
        return aiLoadedChunks[key].noiseMap;
    }

    // If not found and not pending, and generation params are available, generate it synchronously for now
    // Ideally, this would also be an async request to the worker pool if it's a common case.
    if (!pendingRequests.has(key) && genParams.noiseLayers && genParams.seed !== null) {
        console.log(`[YukaAINeighbor] Generating missing neighbor NoiseMap for ${key} synchronously.`);
        try {
            const newNoiseMap = generateNoiseMap(targetChunkX, targetChunkY, targetChunkZ, genParams.noiseLayers, genParams.seed);
            if (newNoiseMap) {
                if (!aiLoadedChunks[key]) {
                    aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: 0 };
                }
                aiLoadedChunks[key].noiseMap = newNoiseMap;
                aiLoadedChunks[key].lastAccessTime = Date.now();
                return newNoiseMap;
            }
        } catch (e) {
            console.error(`[YukaAINeighbor] Error generating sync noise map for ${key}:`, e);
        }
    }
    console.warn(`[YukaAINeighbor] Could not get/generate NoiseMap for neighbor ${key}`);
    return null;
}
// --- END Get/Generate Neighbor NoiseMap ---

// --- NEW: Local Mesh Generation (Adapted from isolatedThirdPerson) ---
function generateAILocalMesh(chunkX: number, chunkY: number, chunkZ: number) {
    const key = getChunkKeyY(chunkX, chunkY, chunkZ);
    if (!sceneRef || !genParams.compInfo || genParams.noiseScale === null || genParams.planetOffset === null || genParams.noiseLayers === null || genParams.seed === null) {
        console.error(`[YukaAIGenMesh] Cannot generate mesh for ${key}, missing scene, compInfo, or genParams.`);
        return;
    }

    const centralNoiseMap = aiLoadedChunks[key]?.noiseMap;
    if (!centralNoiseMap) {
        console.warn(`[YukaAIGenMesh] Noisemap for ${key} not found in aiLoadedChunks. Requesting...`);
        // Request it if missing, the worker callback will eventually call this function again if only noisemap is returned.
        if (!pendingRequests.has(key)) {
             requestChunkGeometry(chunkX, chunkY, chunkZ, genParams.noiseLayers, genParams.seed, 0); // Priority 0 for AI immediate need
             pendingRequests.add(key);
        }
        return;
    }

    const noiseMapBelow = getAINeighborNoiseMap(chunkX, chunkY - 1, chunkZ);
    const noiseMapAbove = getAINeighborNoiseMap(chunkX, chunkY + 1, chunkZ);
    const noiseMapXNeg = getAINeighborNoiseMap(chunkX - 1, chunkY, chunkZ);
    const noiseMapXPos = getAINeighborNoiseMap(chunkX + 1, chunkY, chunkZ);
    const noiseMapZNeg = getAINeighborNoiseMap(chunkX, chunkY, chunkZ - 1);
    const noiseMapZPos = getAINeighborNoiseMap(chunkX, chunkY, chunkZ + 1);

    const neighborFlags = {
        neighborXPosExists: !!noiseMapXPos,
        neighborXNegExists: !!noiseMapXNeg,
        neighborYPosExists: !!noiseMapAbove,
        neighborYNegExists: !!noiseMapBelow,
        neighborZPosExists: !!noiseMapZPos,
        neighborZNegExists: !!noiseMapZNeg,
    };

    try {
        const geometry = generateMeshVertices(
            chunkX, chunkY, chunkZ,
            { noiseMap: centralNoiseMap },
            false, // interpolate
            noiseMapBelow, noiseMapAbove, noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
            neighborFlags
        );

        if (!geometry || !(geometry instanceof THREE.BufferGeometry) || !geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error(`[YukaAIGenMesh] generateMeshVertices failed for ${key}.`);
            return;
        }

        const material = createUnifiedPlanetMaterial(
            genParams.compInfo.topElements,
            genParams.noiseScale,
            genParams.planetOffset
        );
         if (material.uniforms.u_showInternalMaterial) {
             material.uniforms.u_showInternalMaterial.value = false;
        }
        material.side = THREE.DoubleSide;


        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = `ai_chunk_${key}`;
        newMesh.renderOrder = 1;

        // Remove old mesh
        if (aiLoadedChunks[key]?.mesh) {
            const oldMesh = aiLoadedChunks[key].mesh;
            if (oldMesh && oldMesh.parent) oldMesh.parent.remove(oldMesh);
            if (oldMesh?.geometry) oldMesh.geometry.dispose();
            // Material is shared
        }

        sceneRef.add(newMesh);
        if (!aiLoadedChunks[key]) aiLoadedChunks[key] = { noiseMap: centralNoiseMap, mesh: null, lastAccessTime: 0}; // Should exist
        aiLoadedChunks[key].mesh = newMesh;
        aiLoadedChunks[key].lastAccessTime = Date.now();
        aiChunkMeshes[key] = newMesh;
        console.log(`[YukaAIGenMesh] Generated and added mesh for ${key}.`);

    } catch (error) {
        console.error(`[YukaAIGenMesh] Error generating mesh for ${key}:`, error);
    }
}
// --- END Local Mesh Generation ---

// --- NEW: Manage AI Chunks (called in updateYuka for each agent) ---
function manageAIChunks(agent: IsolatedYukaCharacter) {
    if (!genParams.noiseLayers || genParams.seed === null) {
        // console.warn(`[YukaManageChunks] Missing genParams for agent ${agent.name}. Cannot manage chunks.`);
        return; // Not an error, just can't load yet
    }

    const agentPos = agent.sketchbookCharacter.position;
    const currentChunkX = Math.round(agentPos.x / CHUNK_SIZE);
    const currentChunkY = Math.round(agentPos.y / CHUNK_HEIGHT);
    const currentChunkZ = Math.round(agentPos.z / CHUNK_SIZE);

    // Check if it's time to load for this agent
    const now = Date.now();
    if (lastLoadCheckTime[agent.uuid] && (now - lastLoadCheckTime[agent.uuid] < AI_LOAD_CHECK_INTERVAL)) {
        return;
    }
    lastLoadCheckTime[agent.uuid] = now;

    // Request needed chunks
    for (let dx = -AI_LOAD_CHUNK_RADIUS; dx <= AI_LOAD_CHUNK_RADIUS; dx++) {
        for (let dz = -AI_LOAD_CHUNK_RADIUS; dz <= AI_LOAD_CHUNK_RADIUS; dz++) {
            for (let dy = -AI_VERTICAL_LOAD_RADIUS_BELOW; dy <= AI_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
                const targetX = currentChunkX + dx;
                const targetY = currentChunkY + dy;
                const targetZ = currentChunkZ + dz;
                const key = getChunkKeyY(targetX, targetY, targetZ);

                if (!aiLoadedChunks[key]?.mesh && !pendingRequests.has(key)) {
                     // Prioritize closer chunks, simple priority for now
                    const distSq = dx * dx + dy * dy + dz * dz;
                    const priority = Math.max(0, Math.min(10, Math.floor(Math.sqrt(distSq)))); // Lower for closer

                    console.log(`[YukaManageChunks] Agent ${agent.name} needs ${key}. Requesting P:${priority}...`);
                    if (requestChunkGeometry(targetX, targetY, targetZ, genParams.noiseLayers, genParams.seed, priority)) {
                        pendingRequests.add(key);
                    }
                } else if (aiLoadedChunks[key]) {
                    aiLoadedChunks[key].lastAccessTime = now; // Mark as accessed
                }
            }
        }
    }

    // Evict old chunks (simple eviction based on last access time)
    // This could be improved with more sophisticated LRU or distance-based eviction.
    for (const key in aiLoadedChunks) {
        if (now - (aiLoadedChunks[key].lastAccessTime || 0) > AI_CHUNK_EVICTION_TIME) {
            console.log(`[YukaManageChunks] Evicting old AI chunk ${key}`);
            const chunkData = aiLoadedChunks[key];
            if (chunkData.mesh && sceneRef) {
                sceneRef.remove(chunkData.mesh);
                if (chunkData.mesh.geometry) chunkData.mesh.geometry.dispose();
                // Material is shared
            }
            delete aiLoadedChunks[key];
            if (aiChunkMeshes[key]) delete aiChunkMeshes[key];
        }
    }
}
// --- END Manage AI Chunks ---


export function updateYuka() {
    if (!entityManager || !time) return;

    const delta = time.update().getDelta();
    
    // Update NavMesh if needed (not every frame for performance)
    if (navMeshHelper) {
        const activeChunkMeshes = getActiveChunkMeshesForCollision();
        if (activeChunkMeshes) {
            navMeshHelper.update(activeChunkMeshes);
        }
    }
    
    // Update all Yuka entities
    entityManager.update(delta);

    // Get the current active chunk meshes for collision detection
    const activeChunkMeshes = getActiveChunkMeshesForCollision();
    
    if (!activeChunkMeshes) {
        console.warn('[YukaController] updateYuka: No active chunk meshes available');
        return;
    }

    // Process all IsolatedYukaCharacter entities
    entityManager.entities.forEach(entity => {
        if (entity instanceof IsolatedYukaCharacter && entity.isUnderAIControl()) {
            // Skip if Sketchbook character is not available
            if (!entity.sketchbookCharacter) {
                // console.warn(`[YukaController Update] Agent ${entity.name} has no sketchbookCharacter.`);
                return;
            }

            // --- DEBUG BOXMAN STATE ---
            const char = entity.sketchbookCharacter;
            // Log only once per few seconds to avoid spam, or if something seems off
            if (Date.now() % 3000 < 20) { // Crude way to log periodically
                console.log(`[Yuka Update Debug - ${entity.name}] Visible: ${char.visible}, Pos: (${char.position.x.toFixed(2)}, ${char.position.y.toFixed(2)}, ${char.position.z.toFixed(2)}), Scale: (${char.scale.x.toFixed(2)}, ${char.scale.y.toFixed(2)}, ${char.scale.z.toFixed(2)}), Parented: ${char.parent !== null}`);
                if (char.parent) console.log(`[Yuka Update Debug - ${entity.name}] Parent name: ${char.parent.name}`);
                // Check world matrix from Yuka entity
                const yukaWorldMatrix = entity.worldMatrix.elements;
                if (yukaWorldMatrix[12] === 0 && yukaWorldMatrix[13] === 0 && yukaWorldMatrix[14] === 0 && entity.name.includes('yuka-agent')) { // A crude check for potential zero matrix for translation part
                    // console.warn(`[Yuka Update Debug - ${entity.name}] Yuka entity worldMatrix translation might be zeroed!`, yukaWorldMatrix);
                }
            }
            // --- END DEBUG BOXMAN STATE ---

            // Get/create physics state for this agent
            let physicsState = yukaAgentPhysicsStates.get(entity.uuid);
            if (!physicsState) {
                physicsState = {
                    position: new THREE.Vector3(entity.sketchbookCharacter.position.x, entity.sketchbookCharacter.position.y, entity.sketchbookCharacter.position.z),
                    grounded: false,
                    yVelocity: 0
                };
                yukaAgentPhysicsStates.set(entity.uuid, physicsState);
            }

            // Get/create camera proxy for this agent
            let proxyCamera = yukaAgentProxyCameras.get(entity.uuid);
            if (!proxyCamera) {
                proxyCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
                yukaAgentProxyCameras.set(entity.uuid, proxyCamera);
            }

            // ------------------------------------------------------
            // Path following logic
            // ------------------------------------------------------
            let pathData = aiPathCache.get(entity.uuid);
            
            // Check if we need to create or update this agent's path
            if (!pathData || pathData.path.length === 0 || pathData.currentIndex >= pathData.path.length) {
                // If agent has no path or reached end of path, generate a new one
                if (navMeshHelper) {
                    // Get a random position to move to
                    const skelCharPos = entity.sketchbookCharacter.position;
                    const currentPosTHREE = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z);
                    const randomOffset = new THREE.Vector3(
                        (Math.random() - 0.5) * 20, 
                        0,
                        (Math.random() - 0.5) * 20
                    );
                    const targetPos = currentPosTHREE.clone().add(randomOffset); // targetPos is now a local THREE.Vector3
                    
                    // Find path to the target
                    const path = navMeshHelper.findPath(currentPosTHREE, targetPos);
                    
                    if (path && path.length > 0) {
                        console.log(`[YukaController] Found path for ${entity.name} with ${path.length} points`);
                        aiPathCache.set(entity.uuid, { path, currentIndex: 0 });
                        pathData = { path, currentIndex: 0 };
                        
                        // Visualize path if scene is available
                        if (sceneRef) {
                            entity.setPath(path, sceneRef);
                        }
                    }
                }
            }
            
            // Follow the path if we have one
            if (pathData && pathData.currentIndex < pathData.path.length) {
                const currentTarget = pathData.path[pathData.currentIndex]; // currentTarget is a local THREE.Vector3 from navMeshHelper
                const skelCharPos = entity.sketchbookCharacter.position; // foreign vector
                const skelCharPosLocal = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z); // local version
                const distToTarget = skelCharPosLocal.distanceTo(currentTarget);
                
                // Check if we've reached the current waypoint
                if (distToTarget < PATH_POINT_THRESHOLD) {
                    // Move to the next waypoint
                    pathData.currentIndex++;
                    console.log(`[YukaController] ${entity.name} reached waypoint ${pathData.currentIndex-1}, moving to waypoint ${pathData.currentIndex}`);
                    
                    // If we've reached the end of the path, clear it
                    if (pathData.currentIndex >= pathData.path.length) {
                        console.log(`[YukaController] ${entity.name} reached end of path`);
                    }
                } else {
                    // Move toward current waypoint
                    // Use the YUKA steering system to determine movement direction
                    const currentSkelCharPos = entity.sketchbookCharacter.position; // Renamed to avoid redeclaration
                    const directionToTarget = new THREE.Vector3()
                        .subVectors(currentTarget, new THREE.Vector3(currentSkelCharPos.x, currentSkelCharPos.y, currentSkelCharPos.z))
                        .normalize();
                    
                    // Set the input state to move in that direction
                    const inputState: AIPlayerInputState = {
                        forward: directionToTarget.z < 0 ? 1 : (directionToTarget.z > 0 ? -1 : 0),
                        backward: directionToTarget.z > 0 ? 1 : (directionToTarget.z < 0 ? -1 : 0),
                        left: directionToTarget.x < 0 ? 1 : (directionToTarget.x > 0 ? -1 : 0),
                        right: directionToTarget.x > 0 ? 1 : (directionToTarget.x < 0 ? -1 : 0),
                        jump: false,
                        sprint: distToTarget > PATH_POINT_THRESHOLD * 5, // Sprint if far away
                        mouseX: 0,
                        mouseY: 0
                    };
                    
                    // Set proxy camera position for physics calculations
                    proxyCamera.position.copy(new THREE.Vector3(currentSkelCharPos.x, currentSkelCharPos.y, currentSkelCharPos.z));
                    proxyCamera.lookAt(currentTarget);
                    
                    // Apply movement using the playerMovement system
                    const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
                    const safePhysicsState = ensurePhysicsState(physicsState, new THREE.Vector3(entity.sketchbookCharacter.position.x, entity.sketchbookCharacter.position.y, entity.sketchbookCharacter.position.z));
                    const newPhysicsState = updatePlayerMovementAndCollision(
                        proxyCamera,
                        playerCompatibleInput,
                        safePhysicsState,
                        delta,
                        activeChunkMeshes
                    );
                    
                    // Update the stored physics state
                    yukaAgentPhysicsStates.set(entity.uuid, newPhysicsState);
                    
                    // Update the character's position directly from the proxy camera after physics
                    entity.sketchbookCharacter.position.copy(proxyCamera.position as any); 
                    
                    // Update orientation to face movement direction
                    // Convert local directionToTarget to a new vector for the foreign setOrientation method
                    entity.sketchbookCharacter.setOrientation(new THREE.Vector3(directionToTarget.x, directionToTarget.y, directionToTarget.z) as any, false); 
                    
                    // Update Yuka entity position to match the character's position (important for steering behaviors)
                    entity.position.set(
                        entity.sketchbookCharacter.position.x,
                        entity.sketchbookCharacter.position.y,
                        entity.sketchbookCharacter.position.z
                    );
                }
    } else {
                // No path - just apply gravity/physics without movement input
                const inputState: AIPlayerInputState = {
                    forward: 0,
                    backward: 0,
                    left: 0,
                    right: 0,
                    jump: false,
                    sprint: false,
                    mouseX: 0,
                    mouseY: 0
                };
                
                // Apply gravity and collision only
                const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
                const safePhysicsState = ensurePhysicsState(physicsState, new THREE.Vector3(entity.sketchbookCharacter.position.x, entity.sketchbookCharacter.position.y, entity.sketchbookCharacter.position.z));
                const newPhysicsState = updatePlayerMovementAndCollision(
                    proxyCamera,
                    playerCompatibleInput,
                    safePhysicsState,
                    delta,
                    activeChunkMeshes
                );
                
                yukaAgentPhysicsStates.set(entity.uuid, newPhysicsState);
                // Update the character's position directly from the proxy camera after physics
                entity.sketchbookCharacter.position.copy(proxyCamera.position as any);
                entity.position.set(
                    entity.sketchbookCharacter.position.x,
                    entity.sketchbookCharacter.position.y,
                    entity.sketchbookCharacter.position.z
                );
            }
        }
    });
}

// Fix aiChunkMeshesRef type 
const aiChunkMeshesRef: ChunkMeshesRef = aiChunkMeshes;

export function spawnYukaAgent(position: THREE.Vector3 = new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 2, 0), aiControlled: boolean = true) { // Spawn higher
    if (!entityManager || !sceneRef || !time || !sketchbookWorldAdapterInstance) {
        console.warn('Yuka system or SketchbookWorldAdapter not initialized. Cannot spawn agent.');
        return null;
    }
    if (!loadedBoxmanGLTF) {
        console.warn('Boxman GLTF model not loaded yet. Cannot spawn agent.');
        return null;
    }
     if (!genParams.noiseLayers || genParams.seed === null) {
        console.warn('Yuka Controller: Generation parameters missing. Cannot spawn agent with terrain interaction.');
        // We'll continue to spawn, but it might float
    }

    
    const sketchbookCharacterInstance = new Character(loadedBoxmanGLTF);
    console.log('[YukaController] Spawned sketchbookCharacterInstance:', sketchbookCharacterInstance);
    
    // Disable frustum culling for the main character group and its meshes
    sketchbookCharacterInstance.frustumCulled = false;
    sketchbookCharacterInstance.traverse(child => {
        if (child instanceof THREE.Mesh) {
            child.frustumCulled = false;
        }
    });
    
    // Set initial position of character
    sketchbookCharacterInstance.position.copy(position as any); // position is local, copy might expect foreign if sketchbook has its own THREE. If error, convert 'position'
    
    // Generate a unique name for this agent
    const agentName = `yuka-agent-${Date.now().toString(36)}`;
    console.log(`[YukaController] Creating agent: ${agentName}`);
    
    // Create Yuka IsolatedYukaCharacter (extends Vehicle)
    const newCharacter = new IsolatedYukaCharacter(
        sketchbookCharacterInstance,
        entityManager,
        time,
        agentName
    );
    
    // Add the character to the scene via SketchbookWorldAdapter
    sketchbookWorldAdapterInstance.add(sketchbookCharacterInstance);
    
    // Associate the Sketchbook character as the renderComponent for the Yuka entity
    // This enables automatic position/rotation syncing in the Yuka Vehicle class
    const syncCallback = (entity: YUKA.GameEntity, renderComponent: THREE.Object3D) => {
        renderComponent.matrix.copy(entity.worldMatrix as unknown as THREE.Matrix4);
    };
    newCharacter.setRenderComponent(sketchbookCharacterInstance as any, syncCallback); 

    // IsolatedYukaCharacter adds itself to the entity manager in its constructor

    // Initialize physics state for this agent
    yukaAgentPhysicsStates.set(newCharacter.uuid, {
        yVelocity: 0,
        grounded: false,
        position: position.clone()
    });
    
    // Initialize camera proxy for this agent
    const proxyCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
    proxyCamera.position.copy(position);
    yukaAgentProxyCameras.set(newCharacter.uuid, proxyCamera);

    console.log('New IsolatedYukaCharacter (with Boxman model & Adapter) spawned at:', position);

    // Apply initial ground snap
    const activeChunkMeshes = getActiveChunkMeshesForCollision();
    if (activeChunkMeshes) {
        // Use updatePlayerMovementAndCollision to properly place on ground
        const physicsState = yukaAgentPhysicsStates.get(newCharacter.uuid);
        if (physicsState) {
            // Create a neutral input state
            const inputState: AIPlayerInputState = {
                forward: 0,
                backward: 0,
                left: 0,
                right: 0,
                jump: false,
                sprint: false,
                mouseX: 0,
                mouseY: 0
            };
            
            // Apply gravity to place on ground
            const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
            const safePhysicsState = ensurePhysicsState(physicsState, position);
            const delta = 0.1; // Define delta for initial placement
            const newPhysicsState = updatePlayerMovementAndCollision(
                proxyCamera,
                playerCompatibleInput,
                safePhysicsState,
                delta,
                activeChunkMeshes
            );
            
            // Update the character's position
            yukaAgentPhysicsStates.set(newCharacter.uuid, newPhysicsState);
            // Update the character's position directly from the proxy camera after initial ground snap
            sketchbookCharacterInstance.position.copy(proxyCamera.position as any);
            newCharacter.position.set(
                sketchbookCharacterInstance.position.x,
                sketchbookCharacterInstance.position.y,
                sketchbookCharacterInstance.position.z
            );
            
            console.log(`[YukaController] Agent ${agentName} placed on ground at:`, sketchbookCharacterInstance.position.toArray());

            if (navMeshHelper && sceneRef) { // Ensure sceneRef is available for debugger
                console.log(`[YukaController] Attempting to generate NavMesh for agent ${agentName}`);
                
                const agentPos = sketchbookCharacterInstance.position;
                const agentChunkX = Math.round(agentPos.x / CHUNK_SIZE);
                const agentChunkY = Math.round(agentPos.y / CHUNK_HEIGHT); 
                const agentChunkZ = Math.round(agentPos.z / CHUNK_SIZE);
                const agentChunkKey = getChunkKeyY(agentChunkX, agentChunkY, agentChunkZ);

                let chunkMeshForNavMesh: THREE.Mesh | null = null;

                // Try to get the mesh from aiChunkMeshes first (most relevant)
                if (aiChunkMeshes[agentChunkKey]) {
                    chunkMeshForNavMesh = aiChunkMeshes[agentChunkKey];
                    console.log(`[YukaController] Found agent's current chunk ${agentChunkKey} in aiChunkMeshes.`);
                } else {
                    // Fallback to getActiveChunkMeshesForCollision if not in aiChunkMeshes
                    const allActivePlayerMeshes = getActiveChunkMeshesForCollision();
                    if (allActivePlayerMeshes && allActivePlayerMeshes[agentChunkKey]) {
                        chunkMeshForNavMesh = allActivePlayerMeshes[agentChunkKey];
                        console.log(`[YukaController] Found agent's current chunk ${agentChunkKey} in getActiveChunkMeshesForCollision().`);
                    }
                }

                if (chunkMeshForNavMesh) {
                    const singleChunkMeshRef: ChunkMeshesRef = { [agentChunkKey]: chunkMeshForNavMesh };
                    console.log(`[YukaController] Generating NavMesh using single chunk: ${agentChunkKey}`);
                    navMeshHelper.generateNavMesh(singleChunkMeshRef, 60).catch(error => {
                    console.error('[YukaController] NavMesh generation failed:', error);
                }); 
        } else {
                    console.warn(`[YukaController] Agent's current chunk mesh ${agentChunkKey} NOT FOUND. Attempting to load chunk before NavMesh generation.`);
                    
                    // Try to load the required chunk
                    const chunkCoords = agentChunkKey.split(',').map(Number);
                    if (chunkCoords.length === 3) {
                        const [chunkX, chunkY, chunkZ] = chunkCoords;
                        console.log(`[YukaController] Requesting chunk load for agent: ${chunkX},${chunkY},${chunkZ}`);
                        
                        // Request the chunk to be loaded
                        requestChunkGeometry(chunkX, chunkY, chunkZ, genParams.noiseLayers!, genParams.seed!);
                        
                        // Set a timeout to retry NavMesh generation after chunk loading
                        setTimeout(() => {
                            const retryChunkMeshes = getActiveChunkMeshesForCollision();
                            if (retryChunkMeshes[agentChunkKey]) {
                                console.log(`[YukaController] Chunk ${agentChunkKey} loaded, generating NavMesh for agent`);
                                const retrySingleChunkMeshRef: ChunkMeshesRef = { [agentChunkKey]: retryChunkMeshes[agentChunkKey] };
                                navMeshHelper.generateNavMesh(retrySingleChunkMeshRef, 60).catch(error => {
                                    console.error('[YukaController] Retry NavMesh generation failed:', error);
                                });
                            } else {
                                console.warn(`[YukaController] Chunk ${agentChunkKey} still not available after load attempt`);
                                if (navMeshHelper) navMeshHelper.clearNavMesh();
                            }
                        }, 2000); // Wait 2 seconds for chunk to load
                    } else {
                        if (navMeshHelper) navMeshHelper.clearNavMesh();
                    }
                }

                const currentNavMesh = navMeshHelper.getNavMesh(); 
                if (currentNavMesh) {
                    console.log(`[YukaController] NavMesh available. Regions: ${currentNavMesh.regions.length}`);
                    // visualizeNavMeshPolygons(sceneRef, currentNavMesh); // KEEP DISABLED FOR NOW

                    // --- TEST PATHFINDING ---
                    const agentCurrentPos = new THREE.Vector3(
                        sketchbookCharacterInstance.position.x,
                        sketchbookCharacterInstance.position.y,
                        sketchbookCharacterInstance.position.z
                    );
                    const testTargetPos = agentCurrentPos.clone().add(new THREE.Vector3(1, 0, 1)); // Very close target

                    console.log(`[YukaController] Test Pathfinding: From ${agentCurrentPos.toArray().join(',')} to ${testTargetPos.toArray().join(',')}`);
                    visualizePoint(sceneRef, agentCurrentPos, 0x0000FF, 0.3, true, 'testPathStart'); // Blue sphere at start
                    visualizePoint(sceneRef, testTargetPos, 0xFF00FF, 0.3, true, 'testPathTarget'); // Magenta sphere at target

                    const testPath = navMeshHelper.findPath(agentCurrentPos, testTargetPos);
                    if (testPath && testPath.length > 0) {
                        console.log(`[YukaController] TEST PATH SUCCESS! Points: ${testPath.length}`);
                        visualizePath(sceneRef, testPath, 0x00FFFF, true); // Cyan path
    } else {
                        console.error(`[YukaController] TEST PATH FAILED! No path found to a very close point.`);
                        // Try to get closest point on navmesh to agent's current position
                        const closestNavPoint = navMeshHelper.getClosestPoint(agentCurrentPos);
                        if (closestNavPoint) {
                            console.log(`[YukaController] Closest point on NavMesh to agent: ${closestNavPoint.toArray().join(',')}`);
                            visualizePoint(sceneRef, closestNavPoint, 0xFFFF00, 0.2, true, 'closestNavPoint'); // Yellow
                        } else {
                            console.error('[YukaController] Could not even find the closest point on NavMesh to the agent.');
                        }
                    }
                    // --- END TEST PATHFINDING ---                    
            } else {
                    // console.warn('[YukaController] Could not get NavMesh from helper to visualize.');
                    console.error('[YukaController] NavMesh is NULL after regeneration attempt in spawnYukaAgent.');
                }
            }
        }
    }

    // Set AI control based on parameter
    newCharacter.setAIControlled(aiControlled);
    
    // Initialize with appropriate AI state if AI controlled
    if (aiControlled) {
        // Import and initialize AI states
        import('./aiStates').then(aiStates => {
            // Make AI states available globally for debugging
            if (typeof window !== 'undefined') {
                (window as any).IdleState = aiStates.IdleState;
                (window as any).PatrolState = aiStates.PatrolState;
                (window as any).ChaseState = aiStates.ChaseState;
                (window as any).FleeState = aiStates.FleeState;
            }
            
            // Start with patrol state
            if (newCharacter.stateMachine && typeof newCharacter.stateMachine.changeTo === 'function') {
                try {
                    // Add PatrolState to the state machine if not already added
                    if (!newCharacter.stateMachine.states.has('PATROL')) {
                        newCharacter.stateMachine.add('PATROL', new aiStates.PatrolState());
                    }
                    newCharacter.stateMachine.changeTo('PATROL');
                    console.log(`[YukaController] Agent ${agentName} initialized with PatrolState`);
                } catch (error) {
                    console.warn(`[YukaController] Failed to initialize PatrolState for ${agentName}:`, error);
                }
            } else {
                console.warn(`[YukaController] StateMachine not properly initialized for ${agentName}`);
            }
            
            // Create Enhanced AI Agent with advanced features
            if (advancedAIManager) {
                const aiConfig: AdvancedAIConfig = {
                    enableVision: true,
                    enableMemory: true,
                    enableFuzzyLogic: true,
                    enableSpatialOptimization: true,
                    enableAdvancedSteering: true,
                    enableGraphPathfinding: true,
                    enableTriggers: true,
                    enableTaskScheduling: true,
                    enableMessaging: true
                };
                
                const enhancedAgent = new EnhancedAIAgent(
                    sketchbookCharacterInstance,
                    newCharacter,
                    aiConfig
                );
                
                enhancedAIAgents.set(newCharacter.uuid, enhancedAgent);
                
                // Add agent to spatial optimizer
                advancedAIManager.spatialOptimizer.addEntity(enhancedAgent);
                
                console.log(`🤖 Enhanced AI Agent created for ${agentName} with advanced features`);
            }
        }).catch(error => {
            console.error('[YukaController] Failed to load AI states:', error);
        });
    }
    
    // If we have a navmesh, find a path to a random nearby point
    if (navMeshHelper && sceneRef) { // Ensure sceneRef is available for debugger
        setTimeout(() => {
            const skelCharPos = sketchbookCharacterInstance.position; 
            const currentPosTHREE = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z); 
            const randomOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 10, 
                0, 
                (Math.random() - 0.5) * 10 
            );
            const targetPos = currentPosTHREE.clone().add(randomOffset); 
            console.log(`[YukaController] Agent ${agentName} attempting initial path to closer target:`, targetPos.toArray());
            
            setAgentDestination(newCharacter.uuid, targetPos);
        }, 1500); 
    }

    return newCharacter;
}

export function cleanupYuka() {
    if (entityManager && sceneRef) { // Ensure sceneRef is available for debugger cleanup
        clearNavMeshDebug(sceneRef); // --- NEW: Clear debug objects ---
    }
    if (entityManager) {
        const entitiesToRemove = [...entityManager.entities];
        entitiesToRemove.forEach(entity => {
            if (entity instanceof IsolatedYukaCharacter) {
                // Clean up enhanced AI agent
                const enhancedAgent = enhancedAIAgents.get(entity.uuid);
                if (enhancedAgent) {
                    enhancedAgent.dispose();
                    enhancedAIAgents.delete(entity.uuid);
                    
                    // Remove from spatial optimizer
                    if (advancedAIManager) {
                        advancedAIManager.spatialOptimizer.removeEntity(enhancedAgent);
                    }
                }
                
                // Clean up agent-specific data
                yukaAgentProxyCameras.delete(entity.uuid);
                yukaAgentPhysicsStates.delete(entity.uuid);
                aiPathCache.delete(entity.uuid);
                
                entity.dispose(); 
            } else {
                const renderComponent = (entity as any).renderComponent as THREE.Mesh; 
                if (renderComponent && sceneRef && renderComponent.parent === sceneRef) {
                    sceneRef.remove(renderComponent);
                    if (renderComponent.geometry) renderComponent.geometry.dispose();
                    if (renderComponent.material) {
                        if (Array.isArray(renderComponent.material)) {
                            renderComponent.material.forEach(mat => mat.dispose());
                        } else {
                            renderComponent.material.dispose();
                        }
                    }
                }
                
                // Remove entity from manager
                if (entityManager) {
                    entityManager.remove(entity);
                }
            }
        });
        
        // Clean up terrain chunks
        Object.values(terrain).forEach(mesh => {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(mat => mat.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        });
        terrain = {};
        
        // Clean up nav mesh helper
        if (navMeshHelper) {
            navMeshHelper.dispose();
            navMeshHelper = null;
        }
        
        // Terminate worker pools if initialized
        if (workerInitialized) {
            terminateIsolatedWorkerPool();
            terminateNavMeshWorkerPool();
            workerInitialized = false;
        }
        
        entityManager = null as any;
        time = null as any;
        sceneRef = null;
        loadedBoxmanGLTF = null;
        sketchbookWorldAdapterInstance = null;
        cameraRef = null;
        
        console.log('Yuka system cleaned up.');
    }
}

/**
 * Toggle the visibility of the navigation mesh debug visualization
 */
export function toggleNavMeshVisibility(visible?: boolean): void {
    if (navMeshHelper) {
        navMeshHelper.toggleDebugHelper(visible);
    }
}

/**
 * Regenerate the navigation mesh based on current terrain
 */
export function regenerateNavMesh(): void {
    if (navMeshHelper) {
        const activeChunkMeshes = getActiveChunkMeshesForCollision();
        if (activeChunkMeshes) {
            navMeshHelper.generateNavMesh(activeChunkMeshes, 60).catch(error => {
                console.error('[YukaController] NavMesh regeneration failed:', error);
            }); // Higher max slope for more connected paths
        }
    }
}

/**
 * Manually set a new path for a specific agent to follow
 * @param characterUUID The UUID of the IsolatedYukaCharacter
 * @param targetPosition The position to move to
 */
export function setAgentDestination(characterUUID: string, targetPosition: THREE.Vector3): boolean {
   if (!entityManager || !navMeshHelper || !sceneRef) { // Ensure sceneRef for debugger
       console.warn('[YukaController] Cannot set agent destination: EntityManager, NavMeshHelper, or SceneRef is null.');
       return false;
    }
    
    const entity = entityManager.entities.find(e => e.uuid === characterUUID) as IsolatedYukaCharacter;
    if (!entity || !(entity instanceof IsolatedYukaCharacter)) {
        console.warn(`[YukaController] No IsolatedYukaCharacter found with UUID ${characterUUID}`);
        return false;
    }
    entity.setAIControlled(true);
    
    const skelCharPos = entity.sketchbookCharacter.position; 
    const startPosTHREE = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z); 
    const path = navMeshHelper.findPath(startPosTHREE, targetPosition); 
    
    if (!path || path.length === 0) {
        console.warn(`[YukaController] No path found from ${startPosTHREE.toArray()} to ${targetPosition.toArray()}`);
        // --- NEW: Visualize start and end points if path fails ---
        visualizePoint(sceneRef, startPosTHREE, 0x0000ff, 0.3, false, 'pathStartPoint'); // Blue for start
        visualizePoint(sceneRef, targetPosition, 0xff0000, 0.3, false, 'pathTargetPoint'); // Red for target
        return false;
    } else {
        // --- NEW: Visualize successful path and clear old points ---
        visualizePoint(sceneRef, startPosTHREE, 0x0000ff, 0.3, true, 'pathStartPoint'); // Clear old start point if any
        visualizePoint(sceneRef, targetPosition, 0xff0000, 0.3, true, 'pathTargetPoint'); // Clear old target point if any
        visualizePath(sceneRef, path);
    }
    
aiPathCache.set(entity.uuid, { path, currentIndex: 0 });
    console.log(`[YukaController] Set new path for ${entity.name} with ${path.length} points`);
    return true;
}

export function setAgentAIControlled(characterUUID: string, aiControlled: boolean): boolean {
   if (!entityManager) {
       console.warn('[YukaController] Cannot set agent AI control: EntityManager is null.');
       return false;
   }

   const entity = entityManager.entities.find((e: YUKA.GameEntity) => e.uuid === characterUUID) as IsolatedYukaCharacter;
   if (!entity || !(entity instanceof IsolatedYukaCharacter)) {
       console.warn(`[YukaController] No IsolatedYukaCharacter found with UUID ${characterUUID}`);
       return false;
   }
   entity.setAIControlled(aiControlled);
   console.log(`[YukaController] Set AI control for ${entity.name} to ${aiControlled}`);
   return true;
}

// --- Helper function to convert AIPlayerInputState to PlayerInputState ---
function convertAIInputToPlayerInput(aiInput: AIPlayerInputState): PlayerInputState {
    return {
        w: aiInput.forward > 0,
        s: aiInput.backward > 0,
        a: aiInput.left > 0,
        d: aiInput.right > 0,
        space: aiInput.jump,
        shift: aiInput.sprint
    };
}

// Helper function to ensure physicsState is defined
function ensurePhysicsState(state: PlayerPhysicsState | undefined, position?: THREE.Vector3): PlayerPhysicsState {
    if (state) return state;
    
    // Create a default state
    return {
        yVelocity: 0,
        grounded: false,
        position: position ? position.clone() : new THREE.Vector3()
    };
}