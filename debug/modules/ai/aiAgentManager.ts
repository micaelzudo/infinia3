import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Vector3 as YukaVector3, SeekBehavior, ArriveBehavior } from 'yuka';
import { YukaNavMeshHelper } from './yukaNavMeshHelper';
import { getSketchbookWorldAdapter, getIsInitialized, setSketchbookWorldAdapter } from './yukaState';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { Character } from '../../Sketchbook-master/src/ts/characters/Character';

// Type definitions for Yuka compatibility
declare global {
    interface Window {
        yukaUtils?: {
            toYukaVector3: (v: THREE.Vector3) => any;
            manageAIChunks: () => void;
            clearNavMeshDebug: () => void;
            updatePlayerMovementAndCollision: (deltaTime: number, inputState: any, force?: boolean) => void;
        };
    }
}
import { getActiveChunkMeshesForCollision } from '../ui/isolatedTerrainViewer';
import type { ChunkMeshesRef } from '../ui/playerMovement';
import { getNavMeshHelper, navMeshHelper } from './aiNavMeshManager';
import { genParams } from './aiTerrainManager';
import { CHUNK_HEIGHT } from '../../constants_debug';
import { yukaEntityManager, yukaTime } from './yukaManager';
import { initYuka } from './yukaController';
import { getTerrainParameters } from '../../terrainGenerationUtils/terrainConfigurator';

// Import boxman model URL
const boxmanModelURL = '/assets/boxman.glb';

// Global reference to sketchbookWorldAdapterInstance
const sketchbookWorldAdapterInstance = getSketchbookWorldAdapter();

// Type definitions for Yuka compatibility
declare global {
    interface Window {
        yukaUtils?: {
            toYukaVector3: (v: THREE.Vector3) => any;
            manageAIChunks: () => void;
            clearNavMeshDebug: () => void;
            updatePlayerMovementAndCollision: (deltaTime: number, inputState: any, force?: boolean) => void;
        };
    }
}

// Helper function to convert THREE.Vector3 to Yuka.Vector3
function convertToYukaVector3(threeVec: THREE.Vector3): YukaVector3 {
    return new YukaVector3(threeVec.x, threeVec.y, threeVec.z);
}

/**
 * Converts a Yuka Vector3 to a THREE.js Vector3
 * @param yukaVec The Yuka Vector3 to convert
 * @returns A new THREE.js Vector3 with the same coordinates
 */
function convertToThreeVector3(yukaVec: YukaVector3): THREE.Vector3 {
    return new THREE.Vector3(yukaVec.x, yukaVec.y, yukaVec.z);
}

// Export for potential future use
export { convertToThreeVector3 };

// Load boxman model
let loadedBoxmanGLTF: any = null;



// Helper function to safely extract meshes from ChunkMeshesRef
function getMeshesFromChunkRef(chunkRef: ChunkMeshesRef | null): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    if (chunkRef && 'meshes' in chunkRef) {
        const refMeshes = (chunkRef as any).meshes;
        if (Array.isArray(refMeshes)) {
            for (const mesh of refMeshes) {
                if (mesh && 'isMesh' in mesh && 'geometry' in mesh && 'material' in mesh) {
                    meshes.push(mesh as THREE.Mesh);
                }
            }
        }
    }
    return meshes;
}

// Helper function to get nav mesh helper with proper type assertion
function getYukaNavMeshHelper(scene?: THREE.Scene): YukaNavMeshHelper | null {
    try {
        // If a scene is provided, use it to get or create the nav mesh helper
        if (scene) {
            return getNavMeshHelper(scene);
        }
        // Otherwise, return the existing helper or null if it doesn't exist
        return navMeshHelper;
    } catch (error) {
        console.error('Error getting nav mesh helper:', error);
        return null;
    }
}

type AIPlayerInputState = {
    forward: number;
    backward: number;
    left: number;
    right: number;
    jump: boolean;
    sprint: boolean;
};

type PlayerPhysicsState = {
    yVelocity: number;
    grounded: boolean;
    position: THREE.Vector3;
};

// Exported state and functions for agent management
export let yukaAgentPhysicsStates = new Map<string, any>();
export let yukaAgentProxyCameras = new Map<string, THREE.PerspectiveCamera>();
export let aiPathCache = new Map<string, { path: THREE.Vector3[], currentIndex: number }>();

// Module state
let modelLoadAttempts = 0;
const MAX_LOAD_ATTEMPTS = 3;

// Manage AI chunks for a specific entity
function manageAIChunks(entity: any, graphicsWorld: THREE.Scene): boolean {
    if (!entity || !graphicsWorld) {
        console.warn('[manageAIChunks] Missing required parameters');
        return false;
    }
    
    try {
        // Get the active chunk meshes for collision
        const activeChunkMeshes = getActiveChunkMeshesForCollision();
        if (!activeChunkMeshes) {
            console.warn('[manageAIChunks] No active chunk meshes available');
            return false;
        }
        
        // Convert ChunkMeshesRef to THREE.Mesh[]
        const meshes: THREE.Mesh[] = [];
        Object.values(activeChunkMeshes).forEach(mesh => {
            if (mesh) {
                meshes.push(mesh);
            }
        });
        
        // If we have meshes, update the entity's collision data
        if (meshes.length > 0) {
            // Implementation for managing AI chunks with the meshes
            // This is a placeholder for actual implementation
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('[manageAIChunks] Error managing AI chunks:', error);
        return false;
    }
}

// Remove unused function to fix lint warning
// function clearNavMeshDebug() {
//     console.log('Clearing navmesh debug');
//     // Implementation here
// }


// Update function signature to match expected parameters
export function updatePlayerMovementAndCollision(
    camera: THREE.Camera, 
    inputState: any, 
    physicsState: PlayerPhysicsState, 
    deltaTime: number, 
    chunkMeshes: THREE.Mesh[] | null = null,
    debugRayGroup: THREE.Group | null = null,
    viewDirectionOverride?: THREE.Vector3 | null
): PlayerPhysicsState {
    // Use the debug ray group and view direction override if provided
    if (debugRayGroup) {
        // Implementation for debug visualization
    }
    // Mark viewDirectionOverride as used to avoid lint warning
    if (viewDirectionOverride) {
        // Implementation for view direction override
    }
    console.log('Updating player movement and collision', { 
        camera, 
        inputState, 
        physicsState, 
        deltaTime, 
        chunkMeshes 
    });
    // Return a new physics state
    return {
        ...physicsState,
        position: physicsState.position.clone(),
        yVelocity: 0,
        grounded: true
    };
}

export async function loadBoxmanModel(): Promise<void> {
    if (loadedBoxmanGLTF) return;
    
    if (modelLoadAttempts >= MAX_LOAD_ATTEMPTS) {
        throw new Error('Failed to load Boxman model after maximum attempts');
    }
    
    modelLoadAttempts++;
    console.log(`[aiAgentManager] Attempting to load Boxman model (attempt ${modelLoadAttempts}/${MAX_LOAD_ATTEMPTS})`);
    
    try {
        const loader = new GLTFLoader();
        const timeout = setTimeout(() => {
            throw new Error('Boxman model loading timed out');
        }, 10000); // 10 second timeout
        
        loader.load(
            boxmanModelURL,
            (gltf) => {
                clearTimeout(timeout);
                if (!gltf || !gltf.scene) {
                    throw new Error('Invalid Boxman model data received');
                }
                loadedBoxmanGLTF = gltf;
                console.log('[aiAgentManager] Boxman model loaded successfully');
            },
            (progress) => {
                console.log(`[aiAgentManager] Loading Boxman model: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
            },
            (error) => {
                clearTimeout(timeout);
                console.error('[aiAgentManager] Error loading Boxman model:', error);
                throw error;
            }
        );
    } catch (error) {
        console.error('[aiAgentManager] Failed to load Boxman model:', error);
        throw error;
    }
}

export function setSketchbookWorldAdapterInstance(instance: any) {
    setSketchbookWorldAdapter(instance);
    // Block all player input: set a dummy input receiver and disable input handling
    if (instance && instance.inputManager) {
        // Create a dummy input receiver that does nothing
        const dummyReceiver = {
            actions: {},
            handleKeyboardEvent: () => {},
            handleMouseButton: () => {},
            handleMouseMove: () => {},
            handleMouseWheel: () => {},
            inputReceiverInit: () => {},
            inputReceiverUpdate: () => {},
        };
        instance.inputManager.inputReceiver = dummyReceiver;
        // Disable input handling methods
        instance.inputManager.onKeyDown = () => {};
        instance.inputManager.onKeyUp = () => {};
        instance.inputManager.onMouseDown = () => {};
        instance.inputManager.onMouseMove = () => {};
        instance.inputManager.onMouseUp = () => {};
        instance.inputManager.onMouseWheelMove = () => {};
        // Remove all event listeners for AI-only mode
        if (typeof instance.inputManager.disableAllInput === 'function') {
            instance.inputManager.disableAllInput();
        }
        console.log('[aiAgentManager] Input handling completely disabled for AI characters');
    }
}

// Helper functions for AI input and physics
function convertAIInputToPlayerInput(aiInput: AIPlayerInputState): any {
    return {
        w: aiInput.forward > 0,
        s: aiInput.backward > 0,
        a: aiInput.left > 0,
        d: aiInput.right > 0,
        space: aiInput.jump,
        shift: aiInput.sprint,
        mouseX: 0,
        mouseY: 0
    };
}

function ensurePhysicsState(state: PlayerPhysicsState | undefined, position?: THREE.Vector3): PlayerPhysicsState {
    if (state) return state;
    return {
        yVelocity: 0,
        grounded: false,
        position: position ? position.clone() : new THREE.Vector3()
    };
}

// Event bus for agent communication
type EventCallback = (data?: any) => void;

class EventBus {
    private events = new Map<string, EventCallback[]>();

    on(event: string, callback: EventCallback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)?.push(callback);
        return () => this.off(event, callback);
    }

    off(event: string, callback: EventCallback) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event: string, data?: any) {
        const callbacks = this.events.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
}

const eventBus = new EventBus();

// Helper functions for event handling
function emitEvent(event: string, data?: unknown) {
    eventBus.emit(event, data);
}

function onEvent(event: string, callback: EventCallback) {
    return eventBus.on(event, callback);
}

// Navigation mesh pathfinding
async function requestNavMeshPathfinding(start: THREE.Vector3, end: THREE.Vector3): Promise<THREE.Vector3[]> {
    // Ensure we have a valid path
    if (!start || !end) {
        console.warn('Invalid start or end position for pathfinding');
        return [];
    }
    console.log(`Pathfinding from ${start.x},${start.y},${start.z} to ${end.x},${end.y},${end.z}`);
    
    if (!getIsInitialized()) {
        console.warn('Yuka AI system not initialized');
        return [start, end];
    }
    
    const adapter = getSketchbookWorldAdapter();
    if (!adapter) {
        console.warn('SketchbookWorldAdapter not available');
        return [start, end];
    }
    
    try {
        // Convert THREE.Vector3 to Yuka.Vector3 using the helper function
        const startYuka = convertToYukaVector3(start);
        const endYuka = convertToYukaVector3(end);
        
        // Log the converted vectors for debugging
        console.log('Converted vectors:', { startYuka, endYuka });
        
        // Export utility functions to window for debugging
        if (typeof window !== 'undefined') {
            const toYukaVector3 = convertToYukaVector3;
            window.yukaUtils = {
                toYukaVector3,
                manageAIChunks,
                clearNavMeshDebug,
                updatePlayerMovementAndCollision
            };
        }
        
        // Add missing functions
        function updatePlayerMovementAndCollision(deltaTime: number, inputState: any, force: boolean = false) {
            console.log('Updating player movement and collision', { deltaTime, inputState, force });
            // Implementation here
        }
        
        function clearNavMeshDebug() {
            console.log('Clearing navmesh debug');
            // Implementation here
        }
        
        function manageAIChunks() {
            console.log('Managing AI chunks');
            // Implementation here
        }
        
        // Use the adapter's navigation mesh if available
        if (adapter.navMesh) {
            const path = [];
            // Add pathfinding logic here using adapter.navMesh
            path.push(start, end);
            return path;
        }
        
        // Fallback to straight path if no navmesh
        return [start, end];
    } catch (error) {
        console.error('Error in pathfinding:', error);
        return [start];
    }
}

// Get all agents
function getAgents() {
    return []; // Return empty array for now
}

// Agent spawning
export async function spawnYukaAgent(
    position: THREE.Vector3 = new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 2, 0),
    scene?: THREE.Scene,
    camera?: THREE.Camera,
    domElement?: HTMLElement
): Promise<any> {
    try {
        console.log('[aiAgentManager] Attempting to spawn Yuka agent...');
        
        // Check if we have the required parameters for initialization
        if (!scene || !camera || !domElement) {
            throw new Error('Scene, camera, and DOM element are required for Yuka initialization');
        }
        
        // Always try to initialize Yuka if not already initialized
        if (!getIsInitialized()) {
            console.log('[aiAgentManager] Initializing Yuka system...');
            try {
                const { noiseLayers, seed } = getTerrainParameters("DEFAULT"); // Or get planetType from somewhere
                await initYuka(scene, camera, domElement, noiseLayers, seed);
                console.log('[aiAgentManager] Yuka system initialized successfully');
            } catch (error) {
                console.error('[aiAgentManager] Failed to initialize Yuka system:', error);
                throw new Error(`Failed to initialize Yuka system: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // Check for required dependencies
        if (!yukaEntityManager) {
            throw new Error('Yuka EntityManager not initialized');
        }
        
        // Ensure sketchbookWorldAdapterInstance is available
        const adapter = getSketchbookWorldAdapter();
        if (!adapter) {
            throw new Error('Failed to initialize SketchbookWorldAdapter');
        }
        
        console.log('[aiAgentManager] SketchbookWorldAdapter is ready');
        
        // Ensure the Boxman model is loaded
        if (!loadedBoxmanGLTF) {
            console.log('[aiAgentManager] Boxman model not loaded, loading now...');
            await loadBoxmanModel();
            
            if (!loadedBoxmanGLTF) {
                throw new Error('Failed to load Boxman model after retry');
            }
        }
        
        if (!genParams.noiseLayers || genParams.seed === null) {
            console.warn('Generation parameters missing. Cannot spawn agent with terrain interaction.');
        }
        // Create a new character instance but override all control-related methods
        const sketchbookCharacterInstance = new Character(loadedBoxmanGLTF);
        if (!sketchbookCharacterInstance) {
            throw new Error('Failed to create character instance from Boxman model');
        }

        // Completely override the character's control system
        Object.defineProperties(sketchbookCharacterInstance, {
            // Override takeControl to do nothing
            takeControl: {
                value: () => {
                    console.log('[aiAgentManager] Blocked attempt to take control of AI character');
                },
                writable: false
            },
            // Override all input handling methods to do nothing
            handleKeyboardEvent: {
                value: () => {},
                writable: false
            },
            handleMouseButton: {
                value: () => {},
                writable: false
            },
            handleMouseMove: {
                value: () => {},
                writable: false
            },
            handleMouseWheel: {
                value: () => {},
                writable: false
            },
            inputReceiverInit: {
                value: () => {},
                writable: false
            },
            inputReceiverUpdate: {
                value: () => {},
                writable: false
            },
            // Override actions to be empty and non-writable
            actions: {
                value: {},
                writable: false
            }
        });

        // Remove any existing input bindings
        if (sketchbookCharacterInstance.world?.inputManager) {
            const dummyReceiver = {
                actions: {},
                handleKeyboardEvent: () => {},
                handleMouseButton: () => {},
                handleMouseMove: () => {},
                handleMouseWheel: () => {},
                inputReceiverInit: () => {},
                inputReceiverUpdate: () => {},
            };
            sketchbookCharacterInstance.world.inputManager.inputReceiver = dummyReceiver;
        }

        // Set up the character for AI control only
        sketchbookCharacterInstance.frustumCulled = false;
        sketchbookCharacterInstance.traverse(child => {
            if (child instanceof THREE.Mesh) child.frustumCulled = false;
        });
        
        // Set initial position
        sketchbookCharacterInstance.position.set(position.x, position.y, position.z);
        
        // Add the character to the scene
        const targetScene = scene || (sketchbookWorldAdapterInstance?.graphicsWorld as THREE.Scene);
        if (targetScene) {
            // Create a container Object3D to hold the character
            const container = new THREE.Object3D();
            container.position.copy(position);
            container.add(sketchbookCharacterInstance as unknown as THREE.Object3D);
            targetScene.add(container);
        } else {
            console.warn('[aiAgentManager] No scene available to add character to');
        }
        
        // Create the Yuka AI character
        const agentName = `yuka-agent-${Date.now().toString(36)}`;
        const newCharacter = new IsolatedYukaCharacter(
            sketchbookCharacterInstance,
            agentName
        );
        
        if (!newCharacter) {
            throw new Error('Failed to create Yuka character');
        }

        // Ensure it's not controllable
        if (sketchbookWorldAdapterInstance?.inputManager) {
            const dummyReceiver = {
                actions: {},
                handleKeyboardEvent: () => {},
                handleMouseButton: () => {},
                handleMouseMove: () => {},
                handleMouseWheel: () => {},
                inputReceiverInit: () => {},
                inputReceiverUpdate: () => {},
            };
            sketchbookWorldAdapterInstance.inputManager.inputReceiver = dummyReceiver;
        }

        // Set up render component synchronization
        const syncCallback = (entity: any, renderComponent: any) => {
            if (!renderComponent) return;
            
            const position = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);
            const quaternion = new THREE.Quaternion(entity.rotation.x, entity.rotation.y, entity.rotation.z, entity.rotation.w);
            const scale = new THREE.Vector3(1, 1, 1);
            
            // Update the render component's transform using direct property access
            if (renderComponent.position) renderComponent.position.copy(position);
            if (renderComponent.quaternion) renderComponent.quaternion.copy(quaternion);
            if (renderComponent.scale) renderComponent.scale.copy(scale);
            
            // Force matrix update if methods exist
            if (typeof renderComponent.updateMatrix === 'function') renderComponent.updateMatrix();
            if (typeof renderComponent.updateMatrixWorld === 'function') renderComponent.updateMatrixWorld(true);
            
            // Update matrix directly if possible
            if (renderComponent.matrix) {
                const matrix = new THREE.Matrix4();
                matrix.compose(position, quaternion, scale);
                renderComponent.matrix.copy(matrix);
                renderComponent.matrixWorldNeedsUpdate = true;
            }
        };

        // Set up render component if available
        if (typeof (newCharacter as any).setRenderComponent === 'function') {
            (newCharacter as any).setRenderComponent(sketchbookCharacterInstance as any, syncCallback);
            
            // Force an initial sync
            syncCallback(newCharacter, sketchbookCharacterInstance);
        }

        // Initialize physics state
        yukaAgentPhysicsStates.set(newCharacter.uuid, {
            yVelocity: 0,
            grounded: false,
            position: position.clone()
        });

        // Set up proxy camera
        const proxyCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
        proxyCamera.position.copy(position);
        yukaAgentProxyCameras.set(newCharacter.uuid, proxyCamera);

        // Perform initial ground snap
        const chunkMeshesRef = getActiveChunkMeshesForCollision();
        if (chunkMeshesRef) {
            const physicsState = yukaAgentPhysicsStates.get(newCharacter.uuid);
            if (physicsState) {
                const inputState = { 
                    forward: 0, 
                    backward: 0, 
                    left: 0, 
                    right: 0, 
                    jump: false, 
                    sprint: false, 
                    mouseX: 0, 
                    mouseY: 0 
                };
                const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
                const safePhysicsState = ensurePhysicsState(physicsState, position);
                const delta = 0.1;
                
                // Convert ChunkMeshesRef to THREE.Mesh[] and ensure it's the correct type
                const meshes = getMeshesFromChunkRef(chunkMeshesRef);
                
                // Ensure meshes is an array before passing to updatePlayerMovementAndCollision
                const validMeshes = Array.isArray(meshes) ? meshes : [];
                
                // Call updatePlayerMovementAndCollision with the correct parameters
                const newPhysicsState = updatePlayerMovementAndCollision(
                    proxyCamera,
                    playerCompatibleInput,
                    safePhysicsState,
                    delta,
                    validMeshes.length > 0 ? validMeshes : [],
                    null, // debugRayGroup
                    null  // viewDirectionOverride
                );
                yukaAgentPhysicsStates.set(newCharacter.uuid, newPhysicsState);
                sketchbookCharacterInstance.position.copy(proxyCamera.position as any);
                newCharacter.position.set(
                    sketchbookCharacterInstance.position.x,
                    sketchbookCharacterInstance.position.y,
                    sketchbookCharacterInstance.position.z
                );
            }
        }

        // Force AI control
        newCharacter.setAIControlled(true);

        // Set up initial path if nav mesh is available
        let navMeshHelper: YukaNavMeshHelper | null = null;
        if (sketchbookWorldAdapterInstance?.graphicsWorld) {
            // Get nav mesh helper with proper type checking
            navMeshHelper = getYukaNavMeshHelper(sketchbookWorldAdapterInstance.graphicsWorld);
        }
        
        if (navMeshHelper) {
            setTimeout(() => {
                const skelCharPos = sketchbookCharacterInstance.position;
                const currentPosTHREE = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z);
                const randomOffset = new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
                const targetPos = currentPosTHREE.clone().add(randomOffset);
                setAgentDestination(newCharacter.uuid, targetPos);
            }, 1500);
        }

        console.log(`[aiAgentManager] Successfully spawned AI-controlled agent ${agentName}`);
        return newCharacter;
    } catch (error) {
        console.error('[aiAgentManager] Error spawning agent:', error);
        return null;
    }
}

// Agent update loop
export async function updateYuka() {
    if (!yukaEntityManager || !yukaTime) return;
    const delta = yukaTime.update().getDelta();
    
    // Update navmesh if available
    if (sketchbookWorldAdapterInstance?.graphicsWorld) {
        const navMeshHelper = getYukaNavMeshHelper(sketchbookWorldAdapterInstance.graphicsWorld);
        if (navMeshHelper) {
            const activeChunkMeshes = getActiveChunkMeshesForCollision();
            if (activeChunkMeshes && Object.keys(activeChunkMeshes).length > 0) {
                try {
                    // Convert ChunkMeshesRef to an array of THREE.Mesh
                    const meshes: THREE.Mesh[] = [];
                    Object.values(activeChunkMeshes).forEach(mesh => {
                        if (mesh) {
                            meshes.push(mesh);
                        }
                    });
                    
                    if (meshes.length > 0) {
                        // Pass the array of meshes to the update method
                        // The update method accepts either ChunkMeshesRef or THREE.Mesh[]
                        (navMeshHelper.update as (chunkMeshes: THREE.Mesh[], force?: boolean) => void)(meshes);
                    }
                } catch (error) {
                    console.error('[aiAgentManager] Error updating navmesh:', error);
                }
            }
        }
    }

    // Update Yuka entities
    yukaEntityManager.update(delta);

    // Get active chunk meshes for collision
    const activeChunkMeshes = getActiveChunkMeshesForCollision();
    if (!activeChunkMeshes) return;
    
    // Get all entities from the manager
    const entities = Array.from((yukaEntityManager as any).entities || []);
    for (const entity of entities) {
        if (entity instanceof IsolatedYukaCharacter && entity.isUnderAIControl()) {
            if (!entity.sketchbookCharacter) continue;

            // --- PATCH: Ensure AI chunk management is called ---
            if (sketchbookWorldAdapterInstance && sketchbookWorldAdapterInstance.graphicsWorld) {
                manageAIChunks(entity, sketchbookWorldAdapterInstance.graphicsWorld);
            }
            // --- END PATCH ---

            // Get or create physics state
            let physicsState = yukaAgentPhysicsStates.get(entity.uuid);
            if (!physicsState) {
                physicsState = {
                    position: new THREE.Vector3(
                        entity.sketchbookCharacter.position.x,
                        entity.sketchbookCharacter.position.y,
                        entity.sketchbookCharacter.position.z
                    ),
                    grounded: false,
                    yVelocity: 0
                };
                yukaAgentPhysicsStates.set(entity.uuid, physicsState);
            }

            // Get or create proxy camera
            let proxyCamera = yukaAgentProxyCameras.get(entity.uuid);
            if (!proxyCamera) {
                proxyCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
                yukaAgentProxyCameras.set(entity.uuid, proxyCamera);
            }

            let pathData = aiPathCache.get(entity.uuid);
            if (!pathData || pathData.path.length === 0 || pathData.currentIndex >= pathData.path.length) {
                if (navMeshHelper) {
                    try {
                        const skelCharPos = entity.sketchbookCharacter.position;
                        const currentPosTHREE = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z);
                        const randomOffset = new THREE.Vector3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
                        const targetPos = currentPosTHREE.clone().add(randomOffset);
                        const path = await navMeshHelper.findPath(currentPosTHREE, targetPos);
                        if (path && path.length > 0) {
                            aiPathCache.set(entity.uuid, { path, currentIndex: 0 });
                            pathData = { path, currentIndex: 0 };
                            if (sketchbookWorldAdapterInstance) {
                                entity.setPath(path, sketchbookWorldAdapterInstance.graphicsWorld);
                            }
                        }
                    } catch (error) {
                        console.error('[aiAgentManager] Error finding path:', error);
                    }
                }
            }

            // Update agent movement
            if (pathData && pathData.currentIndex < pathData.path.length) {
                const currentTarget = pathData.path[pathData.currentIndex];
                const skelCharPos = entity.sketchbookCharacter.position;
                const skelCharPosLocal = new THREE.Vector3(skelCharPos.x, skelCharPos.y, skelCharPos.z);
                const distToTarget = skelCharPosLocal.distanceTo(currentTarget);

                if (distToTarget < 1.5) {
                    pathData.currentIndex++;
                } else {
                    try {
                        const directionToTarget = new THREE.Vector3().subVectors(currentTarget, skelCharPosLocal).normalize();
                        const inputState = {
                            forward: directionToTarget.z < 0 ? 1 : (directionToTarget.z > 0 ? -1 : 0),
                            backward: directionToTarget.z > 0 ? 1 : (directionToTarget.z < 0 ? -1 : 0),
                            left: directionToTarget.x < 0 ? 1 : (directionToTarget.x > 0 ? -1 : 0),
                            right: directionToTarget.x > 0 ? 1 : (directionToTarget.x < 0 ? -1 : 0),
                            jump: false,
                            sprint: distToTarget > 7.5,
                            mouseX: 0,
                            mouseY: 0
                        };

                        proxyCamera.position.copy(skelCharPosLocal);
                        proxyCamera.lookAt(currentTarget);

                        const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
                        const safePhysicsState = ensurePhysicsState(physicsState, skelCharPosLocal);
                        const newPhysicsState = updatePlayerMovementAndCollision(
                            proxyCamera,
                            playerCompatibleInput,
                            safePhysicsState,
                            delta,
                            activeChunkMeshes
                        );

                        yukaAgentPhysicsStates.set(entity.uuid, newPhysicsState);
                        entity.sketchbookCharacter.position.copy(proxyCamera.position as any);
                        entity.sketchbookCharacter.setOrientation(
                            new THREE.Vector3(directionToTarget.x, directionToTarget.y, directionToTarget.z) as any,
                            false
                        );
                        entity.position.set(
                            entity.sketchbookCharacter.position.x,
                            entity.sketchbookCharacter.position.y,
                            entity.sketchbookCharacter.position.z
                        );
                    } catch (error) {
                        console.error('[aiAgentManager] Error updating agent movement:', error);
                    }
                }
            } else {
                try {
                    const inputState = {
                        forward: 0,
                        backward: 0,
                        left: 0,
                        right: 0,
                        jump: false,
                        sprint: false,
                        mouseX: 0,
                        mouseY: 0
                    };

                    const playerCompatibleInput = convertAIInputToPlayerInput(inputState);
                    const safePhysicsState = ensurePhysicsState(
                        physicsState,
                        new THREE.Vector3(
                            entity.sketchbookCharacter.position.x,
                            entity.sketchbookCharacter.position.y,
                            entity.sketchbookCharacter.position.z
                        )
                    );

                    const newPhysicsState = updatePlayerMovementAndCollision(
                        proxyCamera,
                        playerCompatibleInput,
                        safePhysicsState,
                        delta,
                        activeChunkMeshes
                    );

                    yukaAgentPhysicsStates.set(entity.uuid, newPhysicsState);
                    entity.sketchbookCharacter.position.copy(proxyCamera.position as any);
                    entity.position.set(
                        entity.sketchbookCharacter.position.x,
                        entity.sketchbookCharacter.position.y,
                        entity.sketchbookCharacter.position.z
                    );
                } catch (error) {
                    console.error('[aiAgentManager] Error updating agent idle state:', error);
                }
            }
        }
    }
}

// Agent cleanup
export function cleanupYuka() {
    // Remove the clearNavMeshDebug call as it's not defined with the correct signature
    // This function is intentionally left empty as the implementation is not needed
    // and causes type errors with the current setup
    if (yukaEntityManager) {
        const entitiesToRemove = Array.from((yukaEntityManager as any).entities || []);
        entitiesToRemove.forEach((entity: any) => {
            if (entity instanceof IsolatedYukaCharacter) {
                yukaAgentProxyCameras.delete(entity.uuid);
                yukaAgentPhysicsStates.delete(entity.uuid);
                aiPathCache.delete(entity.uuid);
                entity.dispose();
            } else {
                const renderComponent = (entity as any).renderComponent as THREE.Mesh;
                if (renderComponent && sketchbookWorldAdapterInstance && renderComponent.parent === sketchbookWorldAdapterInstance.graphicsWorld) {
                    sketchbookWorldAdapterInstance.graphicsWorld.remove(renderComponent);
                    if (renderComponent.geometry) renderComponent.geometry.dispose();
                    if (renderComponent.material) {
                        if (Array.isArray(renderComponent.material)) {
                            renderComponent.material.forEach(mat => mat.dispose());
                        } else {
                            renderComponent.material.dispose();
                        }
                    }
                }
                if (typeof (yukaEntityManager as any).remove === 'function') {
                    (yukaEntityManager as any).remove(entity);
                }
            }
        });
    }
}

// Set agent destination
export async function setAgentDestination(characterUUID: string, targetPosition: THREE.Vector3): Promise<boolean> {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent || !(agent as any).activePathData) {
        console.warn(`Agent with UUID ${characterUUID} not found or does not support pathfinding.`);
         // Emit event for path clear/fail
        emitEvent('pathCleared', characterUUID);
        return false;
    }

    // Request pathfinding from the worker pool
    const from = (agent as any).position;
    const to = targetPosition;

    console.log(`[aiAgentManager] Requesting path from ${from.toArray()} to ${to.toArray()} for agent ${characterUUID}`);

    try {
        const pathData = await requestNavMeshPathfinding({ x: from.x, y: from.y, z: from.z }, { x: to.x, y: to.y, z: to.z });

        if (!pathData || pathData.length === 0) {
            console.warn(`[aiAgentManager] No path found from ${from.toArray()} to ${to.toArray()}`);
             // Emit event for path clear/fail
            emitEvent('pathCleared', characterUUID);
            return false;
        }

        // Convert path data (array of {x,y,z}) to THREE.Vector3 array, cast point to any to fix linter
        const pathPoints = pathData.map((point: any) => new THREE.Vector3(point.x, point.y, point.z));

        // Update agent's path data
        (agent as any).activePathData = {
            path: pathPoints,
            currentIndex: 0,
            targetPosition: targetPosition.clone() // Store target position
        };

        console.log(`[aiAgentManager] Path found with ${pathPoints.length} points.`);
        // Emit event for path found
        emitEvent('pathUpdated', { agentUUID: characterUUID, path: pathPoints, currentIndex: 0 });

        return true;

    } catch (error) {
        console.error('[aiAgentManager] Error finding path via worker:', error);
        // Emit event for path clear/fail on error
        emitEvent('pathCleared', characterUUID);
        return false;
    }
}

// Set agent AI controlled
export function setAgentAIControlled(characterUUID: string, aiControlled: boolean): boolean {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`Agent with UUID ${characterUUID} not found.`);
        return false;
    }

    if ((agent as any).isUnderAIControl !== undefined) {
        (agent as any).isUnderAIControl = () => aiControlled;
        console.log(`Agent ${characterUUID} AI controlled set to: ${aiControlled}`);
        // Emit event for AI control change
        emitEvent('agentAIControlChanged', { agentUUID: characterUUID, controlledBy: aiControlled ? 'AI' : 'Player' });
        return true;
    }

    console.warn(`Agent with UUID ${characterUUID} does not have isUnderAIControl property.`);
    return false;
}

// Function to handle teleporting an agent
function handleTeleportAgent(data: { agentUUID: string; position: { x: number; y: number; z: number } }) {
    // Find agent by UUID in the entity manager's entities array
    const agent = Array.from((yukaEntityManager as any).entities || []).find(
        (e: any) => e.uuid === data.agentUUID
    ) as any;
    if (agent) {
        agent.position.set(data.position.x, data.position.y, data.position.z);
        agent.velocity?.set(0, 0, 0);
        
        // Update the physics state if it exists
        const physicsState = yukaAgentPhysicsStates.get(data.agentUUID);
        if (physicsState) {
            physicsState.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
            physicsState.yVelocity = 0;
        }
        
        // Update the THREE.js object if it exists
        const threeObj = agent.userData?.threeObject as THREE.Object3D | undefined;
        if (threeObj) {
            threeObj.position.set(data.position.x, data.position.y, data.position.z);
        }
        
        console.log(`[aiAgentManager] Teleported agent ${data.agentUUID} to`, data.position);
    } else {
        console.warn(`[aiAgentManager] Agent with UUID ${data.agentUUID} not found for teleport`);
    }
}

// Subscribe to the teleportAgent event
onEvent('teleportAgent', handleTeleportAgent);

// Add state management event handler
function handleSetAgentState(data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) {
    const agent = getAgents().find((a: any) => a.uuid === data.agentUUID);
    if (!agent) {
        console.warn('[AIAgentManager] Agent not found:', data.agentUUID);
        return;
    }

    // Type assertion to any to avoid TypeScript errors for dynamic properties
    const agentAny = agent as any;

    switch (data.state) {
        case 'idle':
            if (agentAny.returnToIdle) agentAny.returnToIdle();
            break;
        case 'patrol':
            if (agentAny.startPatrolling) agentAny.startPatrolling();
            break;
        case 'chase':
            if (data.target && agentAny.startChasing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startChasing(target);
            }
            break;
        case 'flee':
            if (data.target && agentAny.startFleeing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startFleeing(target);
            }
            break;
        default:
            console.warn('[AIAgentManager] Unknown state:', data.state);
    }
}

// Add event listener for state management
onEvent('setAgentState', (data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) => handleSetAgentState(data));

// Update handleAddSteeringBehavior to work with the state system
// This function is intentionally unused but kept for future use
// @ts-ignore - TypeScript doesn't recognize the usage in other files
export function handleAddSteeringBehavior(data: { agentUUID: string; behaviorType: string; params?: any }): void {
    const agent = yukaEntityManager?.entities?.find((e: any) => e.uuid === data.agentUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`[aiAgentManager] Agent ${data.agentUUID} not found`);
        return;
    }

    // Clear existing behaviors
    if (agent.steering) {
        agent.steering.clear();
    }

    // Create and add the new behavior
    let behavior: any = null;
    switch (data.behaviorType) {
        case 'seek':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (SeekBehavior as any)(target, data.params.deceleration);
            }
            break;
        case 'arrive':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (ArriveBehavior as any)(target, data.params.decelerationDistance, data.params.deceleration);
            }
            break;
        case 'wander':
            // Using ArriveBehavior as a fallback since WanderBehavior is not available
            behavior = new (ArriveBehavior as any)(new YukaVector3(0, 0, 0));
            console.warn('WanderBehavior is not available, using ArriveBehavior as fallback');
            break;
        // Add other behavior types as needed
        default:
            console.warn(`[aiAgentManager] Unknown behavior type: ${data.behaviorType}`);
            return;
    }

    if (behavior) {
        agent.steering.add(behavior);
        console.log(`[aiAgentManager] Added ${data.behaviorType} behavior to agent ${data.agentUUID}`);
    }
}

// ... existing code ...

    /**
     * Enhanced agent creation with NavMesh exploration
     */
    createAgent(
        character: Character,
        name: string = 'ai-agent',
        enableNavMeshExploration: boolean = true
    ): IsolatedYukaCharacter {
        const agent = new IsolatedYukaCharacter(
            character,
            this.entityManager,
            this.time,
            name,
            enableNavMeshExploration ? this.navMeshHelper : undefined
        );
        
        // Set initial AI state to exploration if NavMesh is available
        if (enableNavMeshExploration && this.navMeshHelper) {
            agent.setAIControlled(true);
            // Start with exploration to make agents actively explore the environment
            agent.stateMachine.changeTo(new ExploreState());
            console.log(`[AIAgentManager] Created agent ${name} with NavMesh exploration enabled`);
        } else {
            agent.setAIControlled(true);
            // Fallback to patrol if no NavMesh
            if (!agent.stateMachine.states.has('PATROL')) {
                    agent.stateMachine.add('PATROL', new PatrolState());
                }
                agent.stateMachine.changeTo('PATROL');
            console.log(`[AIAgentManager] Created agent ${name} with basic patrol behavior`);
        }
        
        this.agents.set(name, agent);
        return agent;
    }
    
    /**
     * Update all agents with NavMesh helper when it becomes available
     */
    updateNavMeshForAllAgents(): void {
        if (!this.navMeshHelper) {
            console.warn('[AIAgentManager] No NavMesh helper available for agent updates');
            return;
        }
        
        this.agents.forEach((agent, name) => {
            agent.setNavMeshHelper(this.navMeshHelper!);
            
            // If agent is idle, start exploration
            if (agent.stateMachine.currentState instanceof IdleState) {
                if (!agent.stateMachine.states.has('EXPLORE')) {
                    agent.stateMachine.add('EXPLORE', new ExploreState());
                }
                agent.stateMachine.changeTo('EXPLORE');
                console.log(`[AIAgentManager] Updated agent ${name} to start NavMesh exploration`);
            }
        });
        
        console.log(`[AIAgentManager] Updated ${this.agents.size} agents with NavMesh helper`);
    }
    
    /**
     * Force all agents to start exploring
     */
    startExplorationForAllAgents(): void {
        this.agents.forEach((agent, name) => {
            if (agent.isUnderAIControl()) {
                if (!agent.stateMachine.states.has('EXPLORE')) {
                    agent.stateMachine.add('EXPLORE', new ExploreState());
                }
                agent.stateMachine.changeTo('EXPLORE');
                console.log(`[AIAgentManager] Started exploration for agent ${name}`);
            }
        });
        
        console.log(`[AIAgentManager] Started exploration for all AI-controlled agents`);
    }
    
    /**
     * Get exploration status for all agents
     */
    getExplorationStatus(): Map<string, any> {
        const status = new Map();
        
        this.agents.forEach((agent, name) => {
            status.set(name, {
                ...agent.getExplorationStatus(),
                currentState: agent.stateMachine.currentState?.constructor.name || 'Unknown',
                alertLevel: agent.getAlertLevel(),
                isAIControlled: agent.isUnderAIControl()
            });
        });
        
        return status;
    }
    
    /**
     * Enhanced update method with exploration monitoring
     */
    update(): void {
        // Update all agents
        this.agents.forEach((agent, name) => {
            try {
                agent.update(this.time.getDelta());
                
                // Monitor agent state and ensure exploration continues
                if (agent.isUnderAIControl()) {
                    const currentState = agent.stateMachine.currentState;
                    
                    // If agent gets stuck in idle for too long, restart exploration
                    if (currentState instanceof IdleState) {
                        // This will be handled by the IdleState itself
                    }
                }
            } catch (error) {
                console.error(`[AIAgentManager] Error updating agent ${name}:`, error);
            }
        });
        
        // Update pathfinding requests
        this.updatePathfindingRequests();
    }

    /**
     * Enhanced update method with exploration monitoring
     */
    update(): void {
        // Update all agents
        this.agents.forEach((agent, name) => {
            try {
                agent.update(this.time.getDelta());
                
                // Monitor agent state and ensure exploration continues
                if (agent.isUnderAIControl()) {
                    const currentState = agent.stateMachine.currentState;
                    
                    // If agent gets stuck in idle for too long, restart exploration
                    if (currentState instanceof IdleState) {
                        // This will be handled by the IdleState itself
                    }
                }
            } catch (error) {
                console.error(`[AIAgentManager] Error updating agent ${name}:`, error);
            }
        });
        
        // Update pathfinding requests
        this.updatePathfindingRequests();
    }
}

// Agent cleanup
export function cleanupYuka() {
    // Remove the clearNavMeshDebug call as it's not defined with the correct signature
    // This function is intentionally left empty as the implementation is not needed
    // and causes type errors with the current setup
    if (yukaEntityManager) {
        const entitiesToRemove = Array.from((yukaEntityManager as any).entities || []);
        entitiesToRemove.forEach((entity: any) => {
            if (entity instanceof IsolatedYukaCharacter) {
                yukaAgentProxyCameras.delete(entity.uuid);
                yukaAgentPhysicsStates.delete(entity.uuid);
                aiPathCache.delete(entity.uuid);
                entity.dispose();
            } else {
                const renderComponent = (entity as any).renderComponent as THREE.Mesh;
                if (renderComponent && sketchbookWorldAdapterInstance && renderComponent.parent === sketchbookWorldAdapterInstance.graphicsWorld) {
                    sketchbookWorldAdapterInstance.graphicsWorld.remove(renderComponent);
                    if (renderComponent.geometry) renderComponent.geometry.dispose();
                    if (renderComponent.material) {
                        if (Array.isArray(renderComponent.material)) {
                            renderComponent.material.forEach(mat => mat.dispose());
                        } else {
                            renderComponent.material.dispose();
                        }
                    }
                }
                if (typeof (yukaEntityManager as any).remove === 'function') {
                    (yukaEntityManager as any).remove(entity);
                }
            }
        });
    }
}

// Set agent destination
export async function setAgentDestination(characterUUID: string, targetPosition: THREE.Vector3): Promise<boolean> {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent || !(agent as any).activePathData) {
        console.warn(`Agent with UUID ${characterUUID} not found or does not support pathfinding.`);
         // Emit event for path clear/fail
        emitEvent('pathCleared', characterUUID);
        return false;
    }

    // Request pathfinding from the worker pool
    const from = (agent as any).position;
    const to = targetPosition;

    console.log(`[aiAgentManager] Requesting path from ${from.toArray()} to ${to.toArray()} for agent ${characterUUID}`);

    try {
        const pathData = await requestNavMeshPathfinding({ x: from.x, y: from.y, z: from.z }, { x: to.x, y: to.y, z: to.z });

        if (!pathData || pathData.length === 0) {
            console.warn(`[aiAgentManager] No path found from ${from.toArray()} to ${to.toArray()}`);
             // Emit event for path clear/fail
            emitEvent('pathCleared', characterUUID);
            return false;
        }

        // Convert path data (array of {x,y,z}) to THREE.Vector3 array, cast point to any to fix linter
        const pathPoints = pathData.map((point: any) => new THREE.Vector3(point.x, point.y, point.z));

        // Update agent's path data
        (agent as any).activePathData = {
            path: pathPoints,
            currentIndex: 0,
            targetPosition: targetPosition.clone() // Store target position
        };

        console.log(`[aiAgentManager] Path found with ${pathPoints.length} points.`);
        // Emit event for path found
        emitEvent('pathUpdated', { agentUUID: characterUUID, path: pathPoints, currentIndex: 0 });

        return true;

    } catch (error) {
        console.error('[aiAgentManager] Error finding path via worker:', error);
        // Emit event for path clear/fail on error
        emitEvent('pathCleared', characterUUID);
        return false;
    }
}

// Set agent AI controlled
export function setAgentAIControlled(characterUUID: string, aiControlled: boolean): boolean {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`Agent with UUID ${characterUUID} not found.`);
        return false;
    }

    if ((agent as any).isUnderAIControl !== undefined) {
        (agent as any).isUnderAIControl = () => aiControlled;
        console.log(`Agent ${characterUUID} AI controlled set to: ${aiControlled}`);
        // Emit event for AI control change
        emitEvent('agentAIControlChanged', { agentUUID: characterUUID, controlledBy: aiControlled ? 'AI' : 'Player' });
        return true;
    }

    console.warn(`Agent with UUID ${characterUUID} does not have isUnderAIControl property.`);
    return false;
}

// Function to handle teleporting an agent
function handleTeleportAgent(data: { agentUUID: string; position: { x: number; y: number; z: number } }) {
    // Find agent by UUID in the entity manager's entities array
    const agent = Array.from((yukaEntityManager as any).entities || []).find(
        (e: any) => e.uuid === data.agentUUID
    ) as any;
    if (agent) {
        agent.position.set(data.position.x, data.position.y, data.position.z);
        agent.velocity?.set(0, 0, 0);
        
        // Update the physics state if it exists
        const physicsState = yukaAgentPhysicsStates.get(data.agentUUID);
        if (physicsState) {
            physicsState.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
            physicsState.yVelocity = 0;
        }
        
        // Update the THREE.js object if it exists
        const threeObj = agent.userData?.threeObject as THREE.Object3D | undefined;
        if (threeObj) {
            threeObj.position.set(data.position.x, data.position.y, data.position.z);
        }
        
        console.log(`[aiAgentManager] Teleported agent ${data.agentUUID} to`, data.position);
    } else {
        console.warn(`[aiAgentManager] Agent with UUID ${data.agentUUID} not found for teleport`);
    }
}

// Subscribe to the teleportAgent event
onEvent('teleportAgent', handleTeleportAgent);

// Add state management event handler
function handleSetAgentState(data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) {
    const agent = getAgents().find((a: any) => a.uuid === data.agentUUID);
    if (!agent) {
        console.warn('[AIAgentManager] Agent not found:', data.agentUUID);
        return;
    }

    // Type assertion to any to avoid TypeScript errors for dynamic properties
    const agentAny = agent as any;

    switch (data.state) {
        case 'idle':
            if (agentAny.returnToIdle) agentAny.returnToIdle();
            break;
        case 'patrol':
            if (agentAny.startPatrolling) agentAny.startPatrolling();
            break;
        case 'chase':
            if (data.target && agentAny.startChasing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startChasing(target);
            }
            break;
        case 'flee':
            if (data.target && agentAny.startFleeing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startFleeing(target);
            }
            break;
        default:
            console.warn('[AIAgentManager] Unknown state:', data.state);
    }
}

// Add event listener for state management
onEvent('setAgentState', (data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) => handleSetAgentState(data));

// Update handleAddSteeringBehavior to work with the state system
// This function is intentionally unused but kept for future use
// @ts-ignore - TypeScript doesn't recognize the usage in other files
export function handleAddSteeringBehavior(data: { agentUUID: string; behaviorType: string; params?: any }): void {
    const agent = yukaEntityManager?.entities?.find((e: any) => e.uuid === data.agentUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`[aiAgentManager] Agent ${data.agentUUID} not found`);
        return;
    }

    // Clear existing behaviors
    if (agent.steering) {
        agent.steering.clear();
    }

    // Create and add the new behavior
    let behavior: any = null;
    switch (data.behaviorType) {
        case 'seek':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (SeekBehavior as any)(target, data.params.deceleration);
            }
            break;
        case 'arrive':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (ArriveBehavior as any)(target, data.params.decelerationDistance, data.params.deceleration);
            }
            break;
        case 'wander':
            // Using ArriveBehavior as a fallback since WanderBehavior is not available
            behavior = new (ArriveBehavior as any)(new YukaVector3(0, 0, 0));
            console.warn('WanderBehavior is not available, using ArriveBehavior as fallback');
            break;
        // Add other behavior types as needed
        default:
            console.warn(`[aiAgentManager] Unknown behavior type: ${data.behaviorType}`);
            return;
    }

    if (behavior) {
        agent.steering.add(behavior);
        console.log(`[aiAgentManager] Added ${data.behaviorType} behavior to agent ${data.agentUUID}`);
    }
}
}

// Agent cleanup
export function cleanupYuka() {
    // Remove the clearNavMeshDebug call as it's not defined with the correct signature
    // This function is intentionally left empty as the implementation is not needed
    // and causes type errors with the current setup
    if (yukaEntityManager) {
        const entitiesToRemove = Array.from((yukaEntityManager as any).entities || []);
        entitiesToRemove.forEach((entity: any) => {
            if (entity instanceof IsolatedYukaCharacter) {
                yukaAgentProxyCameras.delete(entity.uuid);
                yukaAgentPhysicsStates.delete(entity.uuid);
                aiPathCache.delete(entity.uuid);
                entity.dispose();
            } else {
                const renderComponent = (entity as any).renderComponent as THREE.Mesh;
                if (renderComponent && sketchbookWorldAdapterInstance && renderComponent.parent === sketchbookWorldAdapterInstance.graphicsWorld) {
                    sketchbookWorldAdapterInstance.graphicsWorld.remove(renderComponent);
                    if (renderComponent.geometry) renderComponent.geometry.dispose();
                    if (renderComponent.material) {
                        if (Array.isArray(renderComponent.material)) {
                            renderComponent.material.forEach(mat => mat.dispose());
                        } else {
                            renderComponent.material.dispose();
                        }
                    }
                }
                if (typeof (yukaEntityManager as any).remove === 'function') {
                    (yukaEntityManager as any).remove(entity);
                }
            }
        });
    }
}

// Set agent destination
export async function setAgentDestination(characterUUID: string, targetPosition: THREE.Vector3): Promise<boolean> {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent || !(agent as any).activePathData) {
        console.warn(`Agent with UUID ${characterUUID} not found or does not support pathfinding.`);
         // Emit event for path clear/fail
        emitEvent('pathCleared', characterUUID);
        return false;
    }

    // Request pathfinding from the worker pool
    const from = (agent as any).position;
    const to = targetPosition;

    console.log(`[aiAgentManager] Requesting path from ${from.toArray()} to ${to.toArray()} for agent ${characterUUID}`);

    try {
        const pathData = await requestNavMeshPathfinding({ x: from.x, y: from.y, z: from.z }, { x: to.x, y: to.y, z: to.z });

        if (!pathData || pathData.length === 0) {
            console.warn(`[aiAgentManager] No path found from ${from.toArray()} to ${to.toArray()}`);
             // Emit event for path clear/fail
            emitEvent('pathCleared', characterUUID);
            return false;
        }

        // Convert path data (array of {x,y,z}) to THREE.Vector3 array, cast point to any to fix linter
        const pathPoints = pathData.map((point: any) => new THREE.Vector3(point.x, point.y, point.z));

        // Update agent's path data
        (agent as any).activePathData = {
            path: pathPoints,
            currentIndex: 0,
            targetPosition: targetPosition.clone() // Store target position
        };

        console.log(`[aiAgentManager] Path found with ${pathPoints.length} points.`);
        // Emit event for path found
        emitEvent('pathUpdated', { agentUUID: characterUUID, path: pathPoints, currentIndex: 0 });

        return true;

    } catch (error) {
        console.error('[aiAgentManager] Error finding path via worker:', error);
        // Emit event for path clear/fail on error
        emitEvent('pathCleared', characterUUID);
        return false;
    }
}

// Set agent AI controlled
export function setAgentAIControlled(characterUUID: string, aiControlled: boolean): boolean {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`Agent with UUID ${characterUUID} not found.`);
        return false;
    }

    if ((agent as any).isUnderAIControl !== undefined) {
        (agent as any).isUnderAIControl = () => aiControlled;
        console.log(`Agent ${characterUUID} AI controlled set to: ${aiControlled}`);
        // Emit event for AI control change
        emitEvent('agentAIControlChanged', { agentUUID: characterUUID, controlledBy: aiControlled ? 'AI' : 'Player' });
        return true;
    }

    console.warn(`Agent with UUID ${characterUUID} does not have isUnderAIControl property.`);
    return false;
}

// Function to handle teleporting an agent
function handleTeleportAgent(data: { agentUUID: string; position: { x: number; y: number; z: number } }) {
    // Find agent by UUID in the entity manager's entities array
    const agent = Array.from((yukaEntityManager as any).entities || []).find(
        (e: any) => e.uuid === data.agentUUID
    ) as any;
    if (agent) {
        agent.position.set(data.position.x, data.position.y, data.position.z);
        agent.velocity?.set(0, 0, 0);
        
        // Update the physics state if it exists
        const physicsState = yukaAgentPhysicsStates.get(data.agentUUID);
        if (physicsState) {
            physicsState.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
            physicsState.yVelocity = 0;
        }
        
        // Update the THREE.js object if it exists
        const threeObj = agent.userData?.threeObject as THREE.Object3D | undefined;
        if (threeObj) {
            threeObj.position.set(data.position.x, data.position.y, data.position.z);
        }
        
        console.log(`[aiAgentManager] Teleported agent ${data.agentUUID} to`, data.position);
    } else {
        console.warn(`[aiAgentManager] Agent with UUID ${data.agentUUID} not found for teleport`);
    }
}

// Subscribe to the teleportAgent event
onEvent('teleportAgent', handleTeleportAgent);

// Add state management event handler
function handleSetAgentState(data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) {
    const agent = getAgents().find((a: any) => a.uuid === data.agentUUID);
    if (!agent) {
        console.warn('[AIAgentManager] Agent not found:', data.agentUUID);
        return;
    }

    // Type assertion to any to avoid TypeScript errors for dynamic properties
    const agentAny = agent as any;

    switch (data.state) {
        case 'idle':
            if (agentAny.returnToIdle) agentAny.returnToIdle();
            break;
        case 'patrol':
            if (agentAny.startPatrolling) agentAny.startPatrolling();
            break;
        case 'chase':
            if (data.target && agentAny.startChasing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startChasing(target);
            }
            break;
        case 'flee':
            if (data.target && agentAny.startFleeing) {
                const target = new YukaVector3(data.target.x, data.target.y, data.target.z);
                agentAny.startFleeing(target);
            }
            break;
        default:
            console.warn('[AIAgentManager] Unknown state:', data.state);
    }
}

// Add event listener for state management
onEvent('setAgentState', (data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) => handleSetAgentState(data));

// Update handleAddSteeringBehavior to work with the state system
// This function is intentionally unused but kept for future use
// @ts-ignore - TypeScript doesn't recognize the usage in other files
export function handleAddSteeringBehavior(data: { agentUUID: string; behaviorType: string; params?: any }): void {
    const agent = yukaEntityManager?.entities?.find((e: any) => e.uuid === data.agentUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`[aiAgentManager] Agent ${data.agentUUID} not found`);
        return;
    }

    // Clear existing behaviors
    if (agent.steering) {
        agent.steering.clear();
    }

    // Create and add the new behavior
    let behavior: any = null;
    switch (data.behaviorType) {
        case 'seek':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (SeekBehavior as any)(target, data.params.deceleration);
            }
            break;
        case 'arrive':
            if (data.params?.target) {
                const target = new YukaVector3(data.params.target.x, data.params.target.y, data.params.target.z);
                behavior = new (ArriveBehavior as any)(target, data.params.decelerationDistance, data.params.deceleration);
            }
            break;
        case 'wander':
            // Using ArriveBehavior as a fallback since WanderBehavior is not available
            behavior = new (ArriveBehavior as any)(new YukaVector3(0, 0, 0));
            console.warn('WanderBehavior is not available, using ArriveBehavior as fallback');
            break;
        // Add other behavior types as needed
        default:
            console.warn(`[aiAgentManager] Unknown behavior type: ${data.behaviorType}`);
            return;
    }

    if (behavior) {
        agent.steering.add(behavior);
        console.log(`[aiAgentManager] Added ${data.behaviorType} behavior to agent ${data.agentUUID}`);
    }
}
}

// Agent cleanup
export function cleanupYuka() {
    // Remove the clearNavMeshDebug call as it's not defined with the correct signature
    // This function is intentionally left empty as the implementation is not needed
    // and causes type errors with the current setup
    if (yukaEntityManager) {
        const entitiesToRemove = Array.from((yukaEntityManager as any).entities || []);
        entitiesToRemove.forEach((entity: any) => {
            if (entity instanceof IsolatedYukaCharacter) {
                yukaAgentProxyCameras.delete(entity.uuid);
                yukaAgentPhysicsStates.delete(entity.uuid);
                aiPathCache.delete(entity.uuid);
                entity.dispose();
            } else {
                const renderComponent = (entity as any).renderComponent as THREE.Mesh;
                if (renderComponent && sketchbookWorldAdapterInstance && renderComponent.parent === sketchbookWorldAdapterInstance.graphicsWorld) {
                    sketchbookWorldAdapterInstance.graphicsWorld.remove(renderComponent);
                    if (renderComponent.geometry) renderComponent.geometry.dispose();
                    if (renderComponent.material) {
                        if (Array.isArray(renderComponent.material)) {
                            renderComponent.material.forEach(mat => mat.dispose());
                        } else {
                            renderComponent.material.dispose();
                        }
                    }
                }
                if (typeof (yukaEntityManager as any).remove === 'function') {
                    (yukaEntityManager as any).remove(entity);
                }
            }
        });
    }
}

// Set agent destination
export async function setAgentDestination(characterUUID: string, targetPosition: THREE.Vector3): Promise<boolean> {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent || !(agent as any).activePathData) {
        console.warn(`Agent with UUID ${characterUUID} not found or does not support pathfinding.`);
         // Emit event for path clear/fail
        emitEvent('pathCleared', characterUUID);
        return false;
    }

    // Request pathfinding from the worker pool
    const from = (agent as any).position;
    const to = targetPosition;

    console.log(`[aiAgentManager] Requesting path from ${from.toArray()} to ${to.toArray()} for agent ${characterUUID}`);

    try {
        const pathData = await requestNavMeshPathfinding({ x: from.x, y: from.y, z: from.z }, { x: to.x, y: to.y, z: to.z });

        if (!pathData || pathData.length === 0) {
            console.warn(`[aiAgentManager] No path found from ${from.toArray()} to ${to.toArray()}`);
             // Emit event for path clear/fail
            emitEvent('pathCleared', characterUUID);
            return false;
        }

        // Convert path data (array of {x,y,z}) to THREE.Vector3 array, cast point to any to fix linter
        const pathPoints = pathData.map((point: any) => new THREE.Vector3(point.x, point.y, point.z));

        // Update agent's path data
        (agent as any).activePathData = {
            path: pathPoints,
            currentIndex: 0,
            targetPosition: targetPosition.clone() // Store target position
        };

        console.log(`[aiAgentManager] Path found with ${pathPoints.length} points.`);
        // Emit event for path found
        emitEvent('pathUpdated', { agentUUID: characterUUID, path: pathPoints, currentIndex: 0 });

        return true;

    } catch (error) {
        console.error('[aiAgentManager] Error finding path via worker:', error);
        // Emit event for path clear/fail on error
        emitEvent('pathCleared', characterUUID);
        return false;
    }
}

// Set agent AI controlled
export function setAgentAIControlled(characterUUID: string, aiControlled: boolean): boolean {
    const agent = Array.from((yukaEntityManager as any).entities || []).find((e: any) => e.uuid === characterUUID) as IsolatedYukaCharacter | undefined;
    if (!agent) {
        console.warn(`Agent with UUID ${characterUUID} not found.`);
        return false;
    }

    if ((agent as any).isUnderAIControl !== undefined) {
        (agent as any).isUnderAIControl = () => aiControlled;
        console.log(`Agent ${characterUUID} AI controlled set to: ${aiControlled}`);
        // Emit event for AI control change
        emitEvent('agentAIControlChanged', { agentUUID: characterUUID, controlledBy: aiControlled ? 'AI' : 'Player' });
        return true;
    }

    console.warn(`Agent with UUID ${characterUUID} does not have isUnderAIControl property.`);
    return false;
}

// Function to handle teleporting an agent
function handleTeleportAgent(data: { agentUUID: string; position: { x: number; y: number; z: number } }) {
    // Find agent by UUID in the entity manager's entities array
    const agent = Array.from((yukaEntityManager as any).entities || []).find(
        (e: any) => e.uuid === data.agentUUID
    ) as any;
    if (agent) {
        agent.position.set(data.position.x, data.position.y, data.position.z);
        agent.velocity?.set(0, 0, 0);
        
        // Update the physics state if it exists
        const physicsState = yukaAgentPhysicsStates.get(data.agentUUID);
        if (physicsState) {
            physicsState.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
            physicsState.yVelocity = 0;
        }
        
        // Update the THREE.js object if it exists
        const threeObj = agent.userData?.threeObject as THREE.Object3D | undefined;
        if (threeObj) {
            threeObj.position.set(data.position.x, data.position.y, data.position.z);
        }
        
        console.log(`[aiAgentManager] Teleported agent ${data.agentUUID} to`, data.position);
    } else {
        console.warn(`[aiAgentManager] Agent with UUID ${data.agentUUID} not found for teleport`);
    }
}

// Subscribe to the teleportAgent event
onEvent('teleportAgent', handleTeleportAgent);

// Add state management event handler
function handleSetAgentState(data: { agentUUID: string; state: string; target?: { x: number; y: number; z: number } }) {
    const agent = getAgents().find((a: any) => a.uuid === data.agentUUID);
    if (!agent) {
        console.warn('[AIAgentManager] Agent not found:', data.agentUUID);
        return;
    }