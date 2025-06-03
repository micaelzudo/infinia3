import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { disposeNode } from '../../disposeNode_debug'; // Assuming path is correct
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug'; // Assuming path
import { getChunkKeyY } from '../../utils_debug'; // Import key function
import type { NoiseMap, NoiseLayers, Seed, Generate } from '../../types_debug'; // Import necessary types
import type { TopElementsData } from '../types/renderingTypes'; // Import composition type
import { generateNoiseMap } from '../../noiseMapGenerator_debug'; // Import noise generator
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug'; // Import mesh generator
import { createUnifiedPlanetMaterial } from '../rendering/materials'; // Import material creator
import { initIsolatedWorkerPool, terminateIsolatedWorkerPool, requestChunkGeometry } from '../workers/isolatedWorkerPool'; // Import pool manager
import {
    playerHeight,
    MOVE_SPEED,
    JUMP_VELOCITY,
    sprintMultiplier,
    GRAVITY,
    MAX_Y_VELOCITY,
    groundRaycaster,
    frontRaycaster,
    backRaycaster,
    leftRaycaster,
    rightRaycaster
} from './collisiondetection/collisionDetection'; // Adjust path if necessary
import {
    addDebugRay,
    clearDebugRays,
    setDebugMaterial,
    restoreOriginalMaterials
} from './collisiondetection/debugVisuals'; // Adjust path
// <<< Import movement module >>>
import { 
    updatePlayerMovementAndCollision, 
    PlayerPhysicsState 
} from './playerMovement'; // Adjust path if necessary
// <<< REMOVE Safety Floor Import Block >>>
/*
import {
    createOrUpdateSafetyFloor1,
    createStaticSafetyFloor2,
    cleanupSafetyFloors,
    enforceSafetyBounds
} from './collisiondetection/collisionDetection'; // Path to collision detection module
*/

// <<< Added global definition and initialization >>>
declare global {
  interface Window {
    DEBUG_COLLISION_RAYS_ENABLED?: boolean;
  }
}
// Initialize the flag (defaults to false)
if (typeof window !== 'undefined') {
    window.DEBUG_COLLISION_RAYS_ENABLED = window.DEBUG_COLLISION_RAYS_ENABLED ?? false;
}
// <<< End added global definition >>>

// Constants for player and world
const LOAD_CHUNK_RADIUS = 5; // INCREASED from 4 to 5 - larger radius for stable surface coverage
const UNLOAD_CHUNK_RADIUS = 8; // Distance before chunks are unloaded
const LOAD_CHECK_INTERVAL = 0.1; // Check for new chunks to load every 0.1 seconds
const UNLOAD_CHECK_INTERVAL = 5.0; // Check for old chunks to unload every 5 seconds
const MAX_WORKER_POOL_SIZE = 4; // Number of workers to create
const INITIAL_FLOOR_Y_OFFSET = -2; // Offset for the safety floor

// --- Isolated First Person Types ---
export interface IsolatedChunkData {
    noiseMap: NoiseMap | null;
    lastAccessTime: number; // Time when this chunk was last accessed
    mesh?: THREE.Mesh | null; // Optional mesh property
    playerEditMask?: boolean[][][] | null; // Optional mask
}

interface WorkerResultObject {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    payload: {
        positionBuffer: Float32Array | null;
        noiseMap: NoiseMap | null;
    };
}

// --- State Management ---
let isActive = false;
let sceneRef: THREE.Scene | null = null;
let rendererRef: THREE.WebGLRenderer | null = null;
let terrainMeshRef: THREE.Mesh | null = null; // Main mesh for ground check
let loadedChunksRef: { [key: string]: IsolatedChunkData } | null = null; // Reference to viewer's loaded chunks
let chunkMeshesRef: { [key: string]: THREE.Mesh | null } | null = null; // Reference to viewer's meshes
let fpCamera: THREE.PerspectiveCamera | null = null;
let fpControls: PointerLockControls | null = null;
let onExitCallback: (() => void) | null = null;

// Generation Parameters (stored)
let noiseLayersRef: NoiseLayers | null = null;
let seedRef: Seed | null = null;
let compInfoRef: { topElements: TopElementsData | null } | null = null;
let noiseScaleRef: number | null = null;
let planetOffsetRef: THREE.Vector3 | null = null;

// Movement variables (simplified)
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };
const clock = new THREE.Clock();

// --- NEW Movement State Variables ---
let yVelocity = 0; // Vertical velocity component
let grounded = false; // Is the player on the ground?
let jump = false; // Is the jump key currently pressed?

// Raycasting
// const groundRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, playerHeight * 0.8);
// --- NEW Raycasters ---
/*
const groundRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), // Origin updated in loop
    new THREE.Vector3(0, -1, 0), // Direction
    0, // Near plane
    GROUND_RAY_LENGTH // Far plane (use defined length)
);
// Horizontal Raycasters - Origin needs offset adjustment based on player capsule
const frontRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0, HORIZONTAL_COLLISION_DISTANCE); // +X
const backRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(-1, 0, 0), 0, HORIZONTAL_COLLISION_DISTANCE); // -X
const leftRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 0, HORIZONTAL_COLLISION_DISTANCE); // +Z (Adjusted direction for THREE's coord system)
const rightRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, HORIZONTAL_COLLISION_DISTANCE); // -Z (Adjusted direction)
*/
// <<< END REMOVE MOVED DEFINITIONS >>>

// Chunk Management Logic
let timeSinceLastLoadCheck = 0;
let timeSinceLastUnloadCheck = 0;
let lastPlayerChunkX = 0;
let lastPlayerChunkY = 0; 
let lastPlayerChunkZ = 0;
let forceChunkLoad = true; // Force load on first update

// --- Module State ---
let pendingNoiseMapRequests = new Set<string>();

// --- Initialization tracking ---
let initialLoadingCount = 0; // Count of chunks being loaded during initial spawn
let isInitialLoadComplete = false; // Flag to track when initial loading is complete

// Define Message Types (matching worker)
type WorkerNoiseGenMessage = [chunkX: number, chunkY: number, chunkZ: number, noiseLayers: NoiseLayers, seed: Seed];

// --- Debug Visualization ---
const debugMeshesEnabled = false; // Set to true to see chunk load boundaries
let showChunkBoundaries = debugMeshesEnabled; // Set to false to disable
const debugBoxes: { [key: string]: THREE.LineSegments } = {};

// <<< REMOVE old safety floor state >>>
// let safetyFloorMesh: THREE.Mesh | null = null;

// <<< Added debug ray group state >>>
let debugRayGroup: THREE.Group | null = null;
// <<< End added debug ray group state >>>

// <<< Added state for mesh material backup >>>
// <<< MODIFIED: Store original material object itself >>>
const originalMeshMaterials = new Map<string, { originalMaterial: THREE.Material | THREE.Material[] }>();
// <<< End added state >>>

// <<< REMOVE Duplicate import block >>>
/*
// <<< Import the debug functions >>>
import {
    addDebugRay,
    clearDebugRays,
    setDebugMaterial,
    restoreOriginalMaterials
} from './collisiondetection/debugVisuals'; // Adjust path
*/

// <<< DELETE Commented out debug functions >>>



// --- Modified createMeshFromBuffer (Secondary mesh logic removed) ---
function createMeshFromBuffer(cx: number, cy: number, cz: number, chunkKey: string, positionBuffer: Float32Array) {
    if (!loadedChunksRef || !chunkMeshesRef || !sceneRef || !compInfoRef) return; 

    console.log(`[createMeshFromBuffer ${chunkKey}] Starting mesh creation from buffer...`);

    if (!positionBuffer || positionBuffer.length === 0) {
        console.log(`[createMeshFromBuffer ${chunkKey}] Empty buffer, skipping.`);
        // ... (handle empty buffer) ...
        return;
    }

    let mesh: THREE.Mesh | null = null;

    try {
        // 1. Create Geometry & Material 
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionBuffer, 3));
        geometry.computeVertexNormals();
        let material: THREE.Material = new THREE.MeshNormalMaterial({ wireframe: false }); // Default
        if (compInfoRef?.topElements) {
            material = createUnifiedPlanetMaterial(compInfoRef.topElements);
        }

        // 2. Create Primary Mesh Object 
        mesh = new THREE.Mesh(geometry, material);
        console.log(`[createMeshFromBuffer ${chunkKey}] Primary mesh object created from buffer.`);

    } catch (error) {
        console.error(`[createMeshFromBuffer ${chunkKey}] ERROR during primary mesh creation from buffer:`, error);
        // ... (error handling) ...
        return; 
    }

    // 3. Add Primary Mesh to Scene & Update Refs 
    try {
        if (mesh) { 
            if (sceneRef) { sceneRef.add(mesh); }
            loadedChunksRef![chunkKey] = { ...(loadedChunksRef![chunkKey] || {}), mesh: mesh, noiseMap: loadedChunksRef![chunkKey]?.noiseMap || null, lastAccessTime: Date.now() };
            chunkMeshesRef![chunkKey] = mesh;
            console.log(`[createMeshFromBuffer ${chunkKey}] Primary mesh from buffer added to scene and references updated.`);
        }
        if (debugMeshesEnabled) { updateDebugBoxes(); }
    } catch (error) {
        console.error(`[createMeshFromBuffer ${chunkKey}] Error adding primary mesh from buffer to scene:`, error);
        // ... (error handling) ...
    }
}

// --- NEW checkIntersects function >>>
// Helper function to check intersections for a specific raycaster against nearby meshes
// Returns the distance to the closest intersection, or Infinity if no hit within the limit.
const checkIntersects = (
    raycaster: THREE.Raycaster,
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>,
    distance: number
): boolean => {
    // Debug ray visualization can be added here if needed, similar to the old logic
    const intersects = raycaster.intersectObject(mesh);
    if (intersects.length > 0) {
        if (intersects[0].distance <= distance) {
             // Optional: addDebugRay(raycaster.ray.origin, intersects[0].point, 0xffa500);
            return true; // Hit within distance
        }
    }
    // Optional: addDebugRay(raycaster.ray.origin, raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(distance)), 0x808080);
    return false; // No hit within distance
};
// <<< END NEW checkIntersects function >>>

// --- Modified performGroundCheck to use both mesh types ---
/*
function performGroundCheck(playerPosition: THREE.Vector3, playerChunkX: number, playerChunkY: number, playerChunkZ: number): { groundHit: boolean, groundLevel: number, minGroundDistance: number } {
    // Get all meshes at player's current Y level and TWO below/one above for reliable ground detection
    const groundCheckRadius = 3; // Horizontal radius for collecting meshes
    const nearbyMeshes: THREE.Mesh[] = [];
    
    // EXPANDED VERTICAL RANGE: Check from Y-2 to Y+1
    for (let dx = -groundCheckRadius; dx <= groundCheckRadius; dx++) {
        for (let dz = -groundCheckRadius; dz <= groundCheckRadius; dz++) {
            // Check from 2 levels below to 1 level above the player's current chunk Y
            for (let dy = -2; dy <= 1; dy++) { 
                const checkX = playerChunkX + dx;
                const checkY = playerChunkY + dy; 
                const checkZ = playerChunkZ + dz;
                const key = getChunkKeyY(checkX, checkY, checkZ);
                
                // Add primary mesh if it exists
                const mesh = chunkMeshesRef![key];
                if (mesh) {
                    nearbyMeshes.push(mesh);
                    setDebugMaterial(mesh); // <<< Highlight mesh >>>
                }
            }
        }
    }

    // Define multiple ground rays with different offsets for better detection
    const rayOffsets = [
        { x: 0, z: 0 },         // Center
        { x: 0.25, z: 0 },      // Slightly right
        { x: -0.25, z: 0 },     // Slightly left
        { x: 0, z: 0.25 },      // Slightly forward
        { x: 0, z: -0.25 },     // Slightly backward
        { x: 0.2, z: 0.2 },     // Forward-right
        { x: -0.2, z: 0.2 },    // Forward-left
        { x: 0.2, z: -0.2 },    // Backward-right
        { x: -0.2, z: -0.2 }    // Backward-left
    ];

    // Results
    let groundHit = false;
    let groundLevel = 0;
    let minGroundDistance = Infinity;

    // Check regular meshes
    if (nearbyMeshes.length > 0) {
        // Cast multiple rays from player position with different offsets
        for (const offset of rayOffsets) {
            // Setup ray origin with offset
            const rayOrigin = new THREE.Vector3(
                playerPosition.x + offset.x,
                playerPosition.y - (playerHeight * 0.4), // Ray starts below camera center
                playerPosition.z + offset.z
            );
            
            // Create and configure raycaster
            const ray = new THREE.Raycaster();
            ray.set(rayOrigin, new THREE.Vector3(0, -1, 0));
            ray.far = playerHeight * 2.0; // Sufficient distance to detect ground
            
            // Check for intersections
            const intersects = ray.intersectObjects(nearbyMeshes);
            let didHit = false; // Flag for this specific ray
            if (intersects.length > 0) {
                didHit = true;
                groundHit = true;
                const distance = intersects[0].distance;
                const hitPoint = intersects[0].point;
                
                // Update if this is the closest ground point
                if (distance < minGroundDistance) {
                    minGroundDistance = distance;
                    groundLevel = hitPoint.y; // Use hit point Y for level
                }
                // <<< Add Debug Ray (HIT - Regular Mesh) >>>
                addDebugRay(rayOrigin, hitPoint, 0x00ffff); // Cyan for hit on regular mesh
            }
            // <<< Add Debug Ray (MISS - Regular Mesh) >>>
            if (!didHit) {
                const missEnd = rayOrigin.clone().add(new THREE.Vector3(0, -1, 0).multiplyScalar(ray.far));
                addDebugRay(rayOrigin, missEnd, 0xff00ff); // Magenta for miss on regular mesh
            }
        }
    }

    if (groundHit) {
        console.log(`[Ground Detection] Found terrain ground at Y=${groundLevel.toFixed(2)}, distance=${minGroundDistance.toFixed(2)}`);
    }

    return { groundHit, groundLevel, minGroundDistance };
}
*/

// --- Initialization ---
interface InitParams {
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    terrainMesh: THREE.Mesh; // Still needed for initial ground check/spawn
    loadedChunks: { [key: string]: IsolatedChunkData }; // Add loaded chunks map
    chunkMeshes: { [key: string]: THREE.Mesh | null }; // Add chunk meshes map
    // Generation Params
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale: number;
    planetOffset: THREE.Vector3;
    // ---
    onExit: () => void;
}

export function initIsolatedFirstPerson(params: InitParams) {
    console.log("Initializing Isolated First Person mode...");
    sceneRef = params.scene;
    rendererRef = params.renderer;
    terrainMeshRef = params.terrainMesh;
    loadedChunksRef = params.loadedChunks;
    chunkMeshesRef = params.chunkMeshes;
    onExitCallback = params.onExit;
    noiseLayersRef = params.noiseLayers;
    seedRef = params.seed;
    compInfoRef = params.compInfo;
    noiseScaleRef = params.noiseScale;
    planetOffsetRef = params.planetOffset;

    // --- Initialize Worker Pool ---
    if (!initIsolatedWorkerPool(handleWorkerPoolResult)) {
        console.error("CRITICAL: Failed to initialize worker pool. Dynamic loading disabled.");
        // Handle failure - maybe disable dynamic loading features?
    }
    pendingNoiseMapRequests.clear();
    // ---------------------------

    const canvas = rendererRef.domElement;
    const aspect = canvas.clientWidth / canvas.clientHeight;

    // Create FP Camera
    fpCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

    // --- Calculate Spawn Position --- 
    let spawnX = 0;
    let spawnY = CHUNK_HEIGHT / 2 + 5; // Default Y
    let spawnZ = 0;

    if (terrainMeshRef && terrainMeshRef.geometry) {
        try {
            terrainMeshRef.geometry.computeBoundingBox();
            const bbox = terrainMeshRef.geometry.boundingBox!;
            const center = new THREE.Vector3();
            bbox.getCenter(center);
            center.add(terrainMeshRef.position); // Convert local center to world center

            spawnX = center.x;
            spawnZ = center.z;

            // Raycast down from above the center to find the surface
            const spawnRaycaster = new THREE.Raycaster();
            const rayOrigin = new THREE.Vector3(spawnX, terrainMeshRef.position.y + bbox.max.y + 10, spawnZ);
            spawnRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

            const intersects = spawnRaycaster.intersectObject(terrainMeshRef);

            if (intersects.length > 0) {
                spawnY = intersects[0].point.y + playerHeight;
                console.log(`Isolated FP Spawn: Ray hit surface at Y=${intersects[0].point.y.toFixed(2)}, spawning at Y=${spawnY.toFixed(2)}`);
            } else {
                console.warn("Isolated FP Spawn: Ray missed surface at mesh center. Using default Y.");
            }
        } catch (e) {
             console.error("Isolated FP Spawn: Error calculating spawn position:", e);
        }
    }
    // --- End Calculate Spawn Position ---

    fpCamera.position.set(spawnX, spawnY, spawnZ);
    console.log(`Isolated FP Spawn: Final position set to [${spawnX.toFixed(2)}, ${spawnY.toFixed(2)}, ${spawnZ.toFixed(2)}]`);

    // <<< Initialize debugRayGroup >>>
    if (sceneRef) {
        // <<< Log flag value before init >>>
        console.log(`[FP Init] DEBUG_COLLISION_RAYS_ENABLED: ${window.DEBUG_COLLISION_RAYS_ENABLED}`);
        
        // Set collision ray debug to true by default
        window.DEBUG_COLLISION_RAYS_ENABLED = true;
        
        debugRayGroup = new THREE.Group();
        debugRayGroup.name = "FP_Debug_Rays";
        sceneRef.add(debugRayGroup);
        
        console.log(`[FP Init] Collision rays debugging enabled: ${window.DEBUG_COLLISION_RAYS_ENABLED}`);
    }
    // <<< End initialize debugRayGroup >>>

    // --- Preload Initial Chunks ---
    const initialChunkX = Math.floor(spawnX / CHUNK_SIZE);
    const initialChunkY = Math.floor(spawnY / CHUNK_HEIGHT);
    const initialChunkZ = Math.floor(spawnZ / CHUNK_SIZE);
    
    // Set as last known position
    lastPlayerChunkX = initialChunkX;
    lastPlayerChunkY = initialChunkY;
    lastPlayerChunkZ = initialChunkZ;
    
    console.log(`Isolated FP: Preloading chunks around (${initialChunkX},${initialChunkY},${initialChunkZ})`);
    
    // Preload a solid 3x3 grid around the player
    // This ensures we start with a contiguous chunk of terrain
    const PRELOAD_RADIUS = 1; // Create a 3x3 grid initially
    initialLoadingCount = 0;
    
    // First, load the center chunk (where the player is)
    const centerKey = getChunkKeyY(initialChunkX, initialChunkY, initialChunkZ);
    loadedChunksRef[centerKey] = { 
        mesh: null, 
        noiseMap: null, 
        lastAccessTime: Date.now() 
    };
    if (requestChunkGeometry(initialChunkX, initialChunkY, initialChunkZ, noiseLayersRef, seedRef)) {
        pendingNoiseMapRequests.add(centerKey);
        initialLoadingCount++;
    } else {
        console.error(`[FP Init] Failed to post message to worker for initial center chunk ${centerKey}. It will not be loaded via worker.`);
        // Optionally, remove from loadedChunksRef or mark as failed if it won't be retried
    }
    
    // Then load the directly adjacent chunks (4-connected neighborhood)
    const adjacentOffsets = [
        [-1, 0], [1, 0], // left, right
        [0, -1], [0, 1]  // back, front
    ];
    
    for (const [dx, dz] of adjacentOffsets) {
            const preloadX = initialChunkX + dx;
            const preloadY = initialChunkY; 
            const preloadZ = initialChunkZ + dz;
            const preloadKey = getChunkKeyY(preloadX, preloadY, preloadZ);
            
            // Skip if already loaded or pending (pending check is more robust now)
            if (loadedChunksRef[preloadKey]?.mesh || pendingNoiseMapRequests.has(preloadKey)) continue;
            
            // Create entry and request it
        console.log(`Isolated FP: Preloading adjacent chunk ${preloadKey}`);
            loadedChunksRef[preloadKey] = { 
                mesh: null, 
                noiseMap: null, 
                lastAccessTime: Date.now() 
            };
            if (requestChunkGeometry(preloadX, preloadY, preloadZ, noiseLayersRef, seedRef)) {
                pendingNoiseMapRequests.add(preloadKey);
                initialLoadingCount++;
            } else {
                console.error(`[FP Init] Failed to post message to worker for adjacent chunk ${preloadKey}. It will not be loaded via worker.`);
            }
    }
    
    // Finally, load the diagonal chunks to complete the 3x3 grid
    const diagonalOffsets = [
        [-1, -1], [1, -1], [-1, 1], [1, 1]  // diagonals
    ];
    
    for (const [dx, dz] of diagonalOffsets) {
        const preloadX = initialChunkX + dx;
        const preloadY = initialChunkY; 
        const preloadZ = initialChunkZ + dz;
        const preloadKey = getChunkKeyY(preloadX, preloadY, preloadZ);
        
        // Skip if already loaded or pending
        if (loadedChunksRef[preloadKey]?.mesh || pendingNoiseMapRequests.has(preloadKey)) continue;
        
        // Create entry and request it
        console.log(`Isolated FP: Preloading diagonal chunk ${preloadKey}`);
        loadedChunksRef[preloadKey] = { 
            mesh: null, 
            noiseMap: null, 
            lastAccessTime: Date.now() 
        };
        if (requestChunkGeometry(preloadX, preloadY, preloadZ, noiseLayersRef, seedRef)) {
            pendingNoiseMapRequests.add(preloadKey);
            initialLoadingCount++;
        } else {
            console.error(`[FP Init] Failed to post message to worker for diagonal chunk ${preloadKey}. It will not be loaded via worker.`);
        }
    }
    // ---

    // After attempting to load all initial chunks:
    if (initialLoadingCount === 0) {
        console.log("[FP Initial Load] No initial chunks were successfully dispatched to workers. Marking initial load as complete.");
        isInitialLoadComplete = true;
    }

    // Create Pointer Lock Controls
    fpControls = new PointerLockControls(fpCamera, canvas);

    // Event Listeners for Pointer Lock
    fpControls.addEventListener('lock', () => { console.log('Pointer locked'); });
    fpControls.addEventListener('unlock', handleUnlock); // Exit on unlock

    // Event listeners for keys
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Reset state
    Object.keys(keys).forEach(k => (keys as any)[k] = false); // Reset keys
    clock.start(); // Start clock for delta time
    timeSinceLastLoadCheck = LOAD_CHECK_INTERVAL; // Check immediately on start
    timeSinceLastUnloadCheck = 0; // Reset unload timer

    isActive = true;
    console.log("Isolated First Person mode ACTIVE.");

    // Request pointer lock immediately (might need user interaction first)
    // fpControls.lock(); // Often needs to be triggered by user click

    return { camera: fpCamera, controls: fpControls }; // Return refs if needed elsewhere
}

// --- Modified cleanup function to dispose collision meshes ---
export function cleanupIsolatedFirstPerson() {
    console.log("Cleaning up Isolated First Person mode...");
    if (!isActive) return;

    // --- Cleanup Debug Boxes ---
    if (sceneRef) {
        for (const boxKey in debugBoxes) {
            sceneRef.remove(debugBoxes[boxKey]);
            debugBoxes[boxKey].geometry.dispose();
            (debugBoxes[boxKey].material as THREE.Material).dispose();
        }
    }
    Object.keys(debugBoxes).forEach(key => delete debugBoxes[key]);
    // --- End Debug Boxes Cleanup ---

    // <<< Added debug ray cleanup >>>
    if (sceneRef && debugRayGroup) {
        // <<< Use imported function >>>
        clearDebugRays(debugRayGroup); // Clear any existing rays
        sceneRef.remove(debugRayGroup); // Remove the group itself
        debugRayGroup = null;
    }
    // <<< End added debug ray cleanup >>>

    // --- Terminate Worker Pool ---
    terminateIsolatedWorkerPool();
    pendingNoiseMapRequests.clear();
    // ---------------------------

    clock.stop();
    if (fpControls) {
        fpControls.removeEventListener('lock', () => { console.log('Pointer locked'); });
        fpControls.removeEventListener('unlock', handleUnlock);
        if (fpControls.isLocked) {
            fpControls.unlock(); // Ensure pointer is unlocked
        }
        // fpControls.dispose(); // PointerLockControls doesn't have dispose
    }
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);

    fpCamera = null;
    fpControls = null;
    sceneRef = null;
    rendererRef = null;
    terrainMeshRef = null;
    loadedChunksRef = null; // Clear refs
    chunkMeshesRef = null; // Clear refs
    onExitCallback = null;
    // Clear stored generation params
    noiseLayersRef = null;
    seedRef = null;
    compInfoRef = null;
    noiseScaleRef = null;
    planetOffsetRef = null;
    isActive = false;
    console.log("Isolated First Person mode CLEANED UP.");
}

// --- Worker Pool Result Handler ---
function handleWorkerPoolResult(data: WorkerResultObject) {
    const { chunkX: cx, chunkY: cy, chunkZ: cz, payload } = data;
    const chunkKey = getChunkKeyY(cx, cy, cz);
    console.log(`[FP Result Handler] Processing result for chunk ${chunkKey}. Position buffer present: ${!!payload.positionBuffer}`);

    if (!loadedChunksRef || !chunkMeshesRef || !sceneRef || !compInfoRef || !noiseScaleRef || !planetOffsetRef || !noiseLayersRef || !seedRef) {
        console.warn(`[FP Result Handler ${chunkKey}] Received worker pool result but essential refs are missing. Skipping.`);
        pendingNoiseMapRequests.delete(chunkKey); // Ensure removed from pending even on skip
        return;
    }
    
    if (!pendingNoiseMapRequests.has(chunkKey)) {
        console.warn(`[FP Result Handler ${chunkKey}] Received result for chunk that's not in pending requests list.`);
        return; 
    }
    
    // Store/update the noise map for this chunk regardless of geometry success
    if (payload.noiseMap) {
        if (loadedChunksRef[chunkKey]) {
            loadedChunksRef[chunkKey].noiseMap = payload.noiseMap;
            loadedChunksRef[chunkKey].lastAccessTime = Date.now();
        } else {
            loadedChunksRef[chunkKey] = { 
                noiseMap: payload.noiseMap, 
                lastAccessTime: Date.now(),
                mesh: null
            };
        }
    } else if (!loadedChunksRef[chunkKey]?.noiseMap) {
        // If worker didn't send a noise map and we don't have one, we might have an issue
        console.warn(`[FP Result Handler ${chunkKey}] Worker did not return a noiseMap and none exists locally.`);
        // Fallback: try to generate it synchronously to avoid complete failure if possible, 
        // but this indicates worker failed to provide essential data.
        const fallbackNoiseMap = generateNoiseMap(cx, cy, cz, noiseLayersRef, seedRef);
        if (fallbackNoiseMap) {
            if (loadedChunksRef[chunkKey]) loadedChunksRef[chunkKey].noiseMap = fallbackNoiseMap;
            else loadedChunksRef[chunkKey] = { noiseMap: fallbackNoiseMap, lastAccessTime: Date.now(), mesh: null };
            console.log(`[FP Result Handler ${chunkKey}] Generated fallback noiseMap.`);
        } else {
            console.error(`[FP Result Handler ${chunkKey}] CRITICAL: Failed to generate fallback noiseMap. Chunk will likely fail to load.`);
            pendingNoiseMapRequests.delete(chunkKey);
            if (initialLoadingCount > 0) initialLoadingCount--; // Decrement if part of initial load
            return; // Cannot proceed without a noise map
        }
    }

    pendingNoiseMapRequests.delete(chunkKey);

    if (payload.positionBuffer && payload.positionBuffer.length > 0) {
        console.log(`[FP Result Handler ${chunkKey}] Creating mesh directly from worker's positionBuffer.`);
        // Worker provided geometry data, create mesh directly
        try {
            const oldMesh = chunkMeshesRef[chunkKey];
            if (oldMesh) {
                disposeNode(sceneRef, oldMesh);
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
            // If worker sends normals, set them here: geometry.setAttribute('normal', new THREE.BufferAttribute(payload.normalsBuffer, 3));
            // Otherwise, compute them if needed (can be slow on main thread)
            geometry.computeVertexNormals(); 

            const material = createUnifiedPlanetMaterial(
                compInfoRef.topElements,
                noiseScaleRef,
                planetOffsetRef
            );

            const newMesh = new THREE.Mesh(geometry, material);
            newMesh.name = `fp_chunk_worker_${chunkKey}`;
            sceneRef.add(newMesh);

            chunkMeshesRef[chunkKey] = newMesh;
            if (loadedChunksRef[chunkKey]) {
                loadedChunksRef[chunkKey].mesh = newMesh;
            } else {
                // This case should be less common now as noiseMap handling above should create the entry
                loadedChunksRef[chunkKey] = { noiseMap: payload.noiseMap, mesh: newMesh, lastAccessTime: Date.now() };
            }
            console.log(`[FP Result Handler ${chunkKey}] Successfully created mesh from worker geometry.`);

        } catch (error) {
            console.error(`[FP Result Handler ${chunkKey}] Error creating mesh from worker geometry:`, error);
            // Fallback to generateLocalMesh if direct creation fails but we have a noise map
            if (loadedChunksRef[chunkKey]?.noiseMap) {
                console.warn(`[FP Result Handler ${chunkKey}] Falling back to generateLocalMesh due to error.`);
                generateLocalMesh(cx, cy, cz);
            } else {
                 console.error(`[FP Result Handler ${chunkKey}] Cannot fallback to generateLocalMesh, no noiseMap available.`);
            }
        }
    } else {
        // Worker did NOT provide geometry, but we should have a noiseMap (from worker or fallback).
        // Proceed with generateLocalMesh using the noiseMap.
        console.warn(`[FP Result Handler ${chunkKey}] Worker did not provide positionBuffer. Attempting generateLocalMesh with available/fallback noiseMap.`);
        if (loadedChunksRef[chunkKey]?.noiseMap) {
            generateLocalMesh(cx, cy, cz);
        } else {
             console.error(`[FP Result Handler ${chunkKey}] Cannot run generateLocalMesh, no noiseMap available even after fallback.`);
        }
    }

    // Decrement initial loading count if applicable
    if (initialLoadingCount > 0) {
        initialLoadingCount--;
        console.log(`[FP Initial Load] Chunk ${chunkKey} complete. ${initialLoadingCount} chunks remaining.`);
        
        if (initialLoadingCount === 0) {
            console.log("[FP Initial Load] All initial chunks loaded!");
            isInitialLoadComplete = true;
        }
    }
}

// --- Modified generateLocalMesh (Adds Secondary mesh logic) ---
function generateLocalMesh(cx: number, cy: number, cz: number) {
    if (!loadedChunksRef || !chunkMeshesRef || !sceneRef || !noiseLayersRef || !seedRef || !compInfoRef || !noiseScaleRef || !planetOffsetRef) {
        console.error(`[Generate Local Mesh] Missing required references for chunk ${cx},${cy},${cz}`);
        return;
    }
    
    const chunkKey = getChunkKeyY(cx, cy, cz);
    console.log(`[Generate Local Mesh] Attempting local mesh generation for ${chunkKey}`);
    
    // Get this chunk's noise map
    const currentChunkData = loadedChunksRef[chunkKey];
    const noiseMap = currentChunkData?.noiseMap;
    if (!noiseMap) {
        console.warn(`[Generate Local Mesh] Can't generate mesh for ${chunkKey}: noise map not available`);
        return;
    }

    // NEW: Verify noise map dimensions are as expected
    const expectedHeight = CHUNK_HEIGHT + 1;
    const expectedWidth = CHUNK_SIZE + 1;
    
    if (noiseMap.length !== expectedHeight || 
        noiseMap[0]?.length !== expectedWidth || 
        noiseMap[0]?.[0]?.length !== expectedWidth) {
        
        console.error(`[Generate Local Mesh] Invalid noise map dimensions for ${chunkKey}: ` +
                      `Expected [${expectedHeight}, ${expectedWidth}, ${expectedWidth}], ` + 
                      `Got [${noiseMap.length}, ${noiseMap[0]?.length || 0}, ${noiseMap[0]?.[0]?.length || 0}]`);
        return;
    }

    try {
        // --- Get only necessary horizontal neighbor noise maps for rendering ---
        // Get horizontal neighbors only
        const noiseMapXNeg = getNeighborNoiseMap(cx - 1, cy, cz);
        const noiseMapXPos = getNeighborNoiseMap(cx + 1, cy, cz);
        const noiseMapZNeg = getNeighborNoiseMap(cx, cy, cz - 1);
        const noiseMapZPos = getNeighborNoiseMap(cx, cy, cz + 1);
        
        // Helper function to get/generate neighbor noise maps
        function getNeighborNoiseMap(nx: number, ny: number, nz: number): NoiseMap | null {
            const neighborKey = getChunkKeyY(nx, ny, nz);
            let chunk = loadedChunksRef![neighborKey]; 
            if (chunk && chunk.noiseMap) return chunk.noiseMap;

            // Generate if missing
            console.log(`[Generate Local Mesh] Generating missing neighbor noise map for ${neighborKey}`);
            const generated = generateNoiseMap(nx, ny, nz, noiseLayersRef!, seedRef!);
            if (generated) {
                loadedChunksRef![neighborKey] = {
                    mesh: null,
                    noiseMap: generated,
                    lastAccessTime: Date.now()
                };
            }
            return generated;
        }

        // --- Create neighbor flags (HORIZONTAL ONLY) ---
        const neighborFlags = {
            neighborXPosExists: !!noiseMapXPos,
            neighborXNegExists: !!noiseMapXNeg,
            neighborZPosExists: !!noiseMapZPos,
            neighborZNegExists: !!noiseMapZNeg,
            // Always say vertical neighbors exist to avoid mesh holes at boundaries
            neighborYPosExists: true,
            neighborYNegExists: true,
            // We don't care about edit masks for this implementation
            playerEditMaskXPos: null,
            playerEditMaskXNeg: null,
            playerEditMaskZPos: null,
            playerEditMaskZNeg: null,
            playerEditMaskYPos: null,
            playerEditMaskYNeg: null
        };

        // Remove existing mesh before adding new one
        const oldMesh = chunkMeshesRef[chunkKey];
        if (oldMesh) {
            console.log(`[Generate Local Mesh] Removing old mesh for ${chunkKey}`);
            disposeNode(sceneRef, oldMesh);
        }

        // Generate the primary mesh geometry 
        const geometry = generateMeshVertices(
            cx, cy, cz,
            { noiseMap }, 
            true, // Interpolate is now default true here
            null, null, 
            noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos, 
            neighborFlags
        );

        // Create primary material
        const material = createUnifiedPlanetMaterial(
            compInfoRef!.topElements, // Assume compInfoRef is valid here based on checks
            noiseScaleRef!, 
            planetOffsetRef!
        );
        
        // Create primary mesh and add to scene
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = true; 
        if(sceneRef) sceneRef.add(mesh);
        
        // Store primary mesh reference
        // <<< DETAILED LOGGING START >>>
        if (mesh) {
            console.log(`[Generate Local Mesh ${chunkKey}] ABOUT TO ASSIGN mesh (UUID: ${mesh.uuid}) to chunkMeshesRef and loadedChunksRef.`);
        } else {
            console.warn(`[Generate Local Mesh ${chunkKey}] Mesh object is NULL or UNDEFINED before assignment to refs!`);
        }
        // <<< DETAILED LOGGING END >>>

        chunkMeshesRef![chunkKey] = mesh;
        if (!loadedChunksRef![chunkKey]) {
             loadedChunksRef![chunkKey] = { noiseMap: noiseMap, lastAccessTime: Date.now() };
        }
        loadedChunksRef![chunkKey].mesh = mesh;

        // <<< DETAILED LOGGING START >>>
        if (chunkMeshesRef![chunkKey]) {
            console.log(`[Generate Local Mesh ${chunkKey}] SUCCESSFULLY ASSIGNED mesh (UUID: ${chunkMeshesRef![chunkKey]?.uuid}) to chunkMeshesRef.`);
            if (loadedChunksRef![chunkKey]?.mesh) {
                console.log(`[Generate Local Mesh ${chunkKey}] SUCCESSFULLY ASSIGNED mesh (UUID: ${loadedChunksRef![chunkKey]?.mesh?.uuid}) to loadedChunksRef.`);
            } else {
                console.error(`[Generate Local Mesh ${chunkKey}] FAILED to assign/verify mesh in loadedChunksRef after assignment!`);
            }
        } else {
            console.error(`[Generate Local Mesh ${chunkKey}] FAILED to assign/verify mesh in chunkMeshesRef after assignment!`);
        }
        // <<< DETAILED LOGGING END >>>

        console.log(`[Generate Local Mesh] Successfully finished creation for ${chunkKey} with ${geometry.attributes.position.count} vertices`);
        return true;
    } catch (error) {
        console.error(`[Generate Local Mesh] Error generating mesh for ${chunkKey}:`, error);
        // Clear refs on error
        if (loadedChunksRef![chunkKey]) loadedChunksRef![chunkKey].mesh = null;
        chunkMeshesRef![chunkKey] = null;
        return false;
    }
}

// Helper function to regenerate neighbor meshes when a chunk's noise map changes
function regenerateNeighborMeshes(cx: number, cy: number, cz: number) {
    // For now, let's focus on just regenerating the chunk itself properly
    // We'll skip neighbor regeneration until we confirm the basic functionality works
    console.log(`[Regenerate Neighbors] Skipping neighbors for now to focus on main chunk functionality`);
}

// --- Update Loop --- 
export function updateIsolatedFirstPerson() {
    if (!isActive || !fpControls || !fpCamera || !sceneRef || !loadedChunksRef || !chunkMeshesRef || !noiseLayersRef || !seedRef || !compInfoRef || !noiseScaleRef || !planetOffsetRef) return;

    // --- Debug Visual Updates --- 
    restoreOriginalMaterials(sceneRef, originalMeshMaterials);
    clearDebugRays(debugRayGroup);

    // --- Time Delta --- 
    const delta = clock.getDelta();
    timeSinceLastLoadCheck += delta;
    timeSinceLastUnloadCheck += delta;

    // --- Update Player Movement ---
    // Create input state object from keys
    const inputState = {
        w: keys.w,
        a: keys.a,
        s: keys.s,
        d: keys.d,
        space: keys.space,
        shift: keys.shift
    };
    
    // Call the movement update function with current physics state
    const currentPhysicsState = { yVelocity, grounded };
    const updatedPhysicsState = updatePlayerMovementAndCollision(
        fpCamera,
        inputState,
        currentPhysicsState,
        delta,
        chunkMeshesRef,
        debugRayGroup
    );
    
    // Update physics state
    yVelocity = updatedPhysicsState.yVelocity;
    grounded = updatedPhysicsState.grounded;
    
    // Log movement for debugging if keys are pressed
    if (keys.w || keys.a || keys.s || keys.d) {
        console.log(`[Movement] Position: x=${fpCamera.position.x.toFixed(2)}, y=${fpCamera.position.y.toFixed(2)}, z=${fpCamera.position.z.toFixed(2)}`);
    }

    // --- Player Chunk Coords (still needed for chunk loading) --- 
    const playerChunkX = Math.floor(fpCamera.position.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(fpCamera.position.y / CHUNK_HEIGHT);
    const playerChunkZ = Math.floor(fpCamera.position.z / CHUNK_SIZE);

    // --- Chunk Management --- 
    let playerMovedChunk = false;
    if (playerChunkX !== lastPlayerChunkX || playerChunkY !== lastPlayerChunkY || playerChunkZ !== lastPlayerChunkZ) {
       playerMovedChunk = true;
       console.log(`[FP Movement] Player moved to new chunk: ${playerChunkX},${playerChunkY},${playerChunkZ}. Old: ${lastPlayerChunkX},${lastPlayerChunkY},${lastPlayerChunkZ}`);
       lastPlayerChunkX = playerChunkX;
       lastPlayerChunkY = playerChunkY;
       lastPlayerChunkZ = playerChunkZ;
    }

    // Chunk Loading
    if (timeSinceLastLoadCheck >= LOAD_CHECK_INTERVAL || forceChunkLoad || playerMovedChunk) { // Trigger load if player moved chunk
        timeSinceLastLoadCheck = 0;
        forceChunkLoad = false;
        
        // Determine chunks to load and create a priority-ordered list
        let chunksToLoad: Array<{x: number, y: number, z: number, priority: number}> = [];
        
        // ONLY load chunks at player's current Y level - STRICT HORIZONTAL ONLY
        const horizontalLoadRadius = LOAD_CHUNK_RADIUS;
        const currentPlayerY = playerChunkY; 
        
        console.log(`[ChunkLoad] Update: Player at chunk (${playerChunkX}, ${playerChunkY}, ${playerChunkZ}). ForceLoad: ${forceChunkLoad}, PlayerMoved: ${playerMovedChunk}`);

        for (let dx = -horizontalLoadRadius; dx <= horizontalLoadRadius; dx++) {
            for (let dz = -horizontalLoadRadius; dz <= horizontalLoadRadius; dz++) {
                // FIXED: Only load at player's current Y level
                const cx = playerChunkX + dx;
                const cy = currentPlayerY; // ALWAYS current Y level only
                const cz = playerChunkZ + dz;
                
                const chunkKey = getChunkKeyY(cx, cy, cz);
                let chunkInfo = loadedChunksRef![chunkKey];

                // <<< DETAILED LOGGING FOR CHUNK BEING CONSIDERED >>>
                // ADAPTIVE DEBUG LOGGING FOR CURRENT PLAYER CHUNK
                if (cx === playerChunkX && cy === playerChunkY && cz === playerChunkZ) { 
                    console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${chunkKey}] Considering ${chunkKey}. chunkInfo exists: ${!!chunkInfo}`);
                    if (chunkInfo) {
                        console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${chunkKey}] chunkInfo.mesh exists: ${!!chunkInfo.mesh}, mesh UUID: ${chunkInfo.mesh?.uuid}`);
                        console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${chunkKey}] chunkMeshesRef entry exists: ${!!chunkMeshesRef![chunkKey]}, mesh UUID: ${chunkMeshesRef![chunkKey]?.uuid}`);
                    }
                }
                // <<< END DETAILED LOGGING >>>
                
                // MODIFIED CONDITION TO INCLUDE CHECKING chunkMeshesRef
                if (!chunkInfo || !chunkInfo.mesh || !chunkMeshesRef![chunkKey]) {
                    // <<< LOG IF ADDED TO chunksToLoad >>>
                     // ADAPTIVE DEBUG LOGGING FOR CURRENT PLAYER CHUNK
                    if (cx === playerChunkX && cy === playerChunkY && cz === playerChunkZ) {
                        console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${chunkKey}] Adding ${chunkKey} to chunksToLoad. Condition: !chunkInfo (${!chunkInfo}) || !chunkInfo.mesh (${chunkInfo ? !chunkInfo.mesh : 'N/A'}) || !chunkMeshesRef[${chunkKey}] (${!chunkMeshesRef![chunkKey]})`);
                    }
                    // <<< END LOG >>>
                    const horizontalDist = Math.max(Math.abs(dx), Math.abs(dz));
                    const priority = horizontalDist;
                
                    // Higher priority (lower number) means load sooner
                    chunksToLoad.push({x: cx, y: cy, z: cz, priority: priority});
                }
            }
        }
        
        // Sort chunks by priority (lowest number = highest priority)
        chunksToLoad.sort((a, b) => a.priority - b.priority);
        
        // <<< LOG chunksToLoad CONTENTS >>>
        // ADAPTIVE DEBUG LOGGING FOR CURRENT PLAYER CHUNK
        const playerChunkKeyForLog = getChunkKeyY(playerChunkX, playerChunkY, playerChunkZ);
        if (chunksToLoad.some(c => c.x === playerChunkX && c.y === playerChunkY && c.z === playerChunkZ)) {
            console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${playerChunkKeyForLog}] chunksToLoad (PRIORITIZED) CONTAINS ${playerChunkKeyForLog}:`, JSON.stringify(chunksToLoad.map(c => getChunkKeyY(c.x,c.y,c.z))));
        } else {
            console.log(`[ChunkLoad DEBUG CurrentPlayerChunk ${playerChunkKeyForLog}] chunksToLoad (PRIORITIZED) DOES NOT CONTAIN ${playerChunkKeyForLog}. Full list:`, JSON.stringify(chunksToLoad.map(c => getChunkKeyY(c.x,c.y,c.z))));
        }
        // <<< END LOG >>>

        console.log("[ChunkLoad Checkpoint A] Just before MAX_CHUNKS_PER_FRAME definition.");

        // Process chunks in priority order
        const MAX_CHUNKS_PER_FRAME = 50; // TEMPORARILY INCREASED from 3 for debugging
        let processedCount = 0;
        
        console.log(`[ChunkLoad Loop] Starting to process ${chunksToLoad.length} chunks from chunksToLoad. MAX_CHUNKS_PER_FRAME: ${MAX_CHUNKS_PER_FRAME}`); // Log before loop

        for (const chunk of chunksToLoad) {
            // Enforce player's current Y level - double check
            if (chunk.y !== playerChunkY) {
                console.warn(`[SAFETY] Skipping chunk at Y level ${chunk.y}, not at player's current Y level ${playerChunkY}`);
                continue;
            }
            
            // Check whether we've reached our limit for this frame
            if (processedCount >= MAX_CHUNKS_PER_FRAME) break;
            
            const chunkKey = getChunkKeyY(chunk.x, chunk.y, chunk.z);

            // If we're in initial loading phase and this chunk is being processed for the first time
            // (i.e., not just a re-processing because it was missing from chunkMeshesRef),
            // then increment initialLoadingCount.
            // We can approximate this by checking if chunkInfo.mesh didn't already exist.
            // This check should happen BEFORE attempting to load, only if it will be processed.
            let willBeProcessedForInitialLoad = false;
            if (!isInitialLoadComplete) {
                const existingChunkInfo = loadedChunksRef![chunkKey];
                if (!existingChunkInfo || !existingChunkInfo.mesh) {
                    willBeProcessedForInitialLoad = true;
                }
            }
            
            // Check if noise map already exists or needs generation
            let chunkInfo = loadedChunksRef![chunkKey];
            if (!chunkInfo) {
                // Create new chunk data
                loadedChunksRef![chunkKey] = {
                            noiseMap: null,
                            lastAccessTime: Date.now()
                        };
                chunkInfo = loadedChunksRef![chunkKey];
            }
            
            // Update access time for this chunk
            chunkInfo.lastAccessTime = Date.now();
            
            // NEW LOGIC BLOCK STARTS
            // If the mesh is already properly registered in chunkMeshesRef, it's fully processed by this system.
            if (chunkMeshesRef![chunkKey]) {
                console.log(`[ChunkLoad Loop ${chunkKey}] Mesh already in chunkMeshesRef. Skipping.`);
                continue;
            }

            // If we're here, chunkMeshesRef[chunkKey] is MISSING.
            // We need to ensure it gets created/added.

            // If chunkInfo.mesh exists (meaning it was created, e.g., by worker or previous incomplete load)
            // but it's not in chunkMeshesRef, we need to (re)process it with generateLocalMesh.
            // generateLocalMesh handles adding to scene, chunkMeshesRef, and setting position.
            if (chunkInfo.mesh && !chunkMeshesRef![chunkKey]) { // Second condition is redundant now but good for clarity
                console.log(`[ChunkLoad Loop ${chunkKey}] Mesh in loadedChunksRef but not chunkMeshesRef. Re-processing via generateLocalMesh.`);
                const neighborsOkForReprocess = ensureHorizontalNeighbors(chunk.x, chunk.y, chunk.z);
                if (neighborsOkForReprocess) {
                    if (generateLocalMesh(chunk.x, chunk.y, chunk.z)) { 
                        processedCount++;
                        if (willBeProcessedForInitialLoad) initialLoadingCount++; // Increment only if successfully processed
                    } else {
                        console.warn(`[ChunkLoad Loop ${chunkKey}] generateLocalMesh failed during re-processing existing mesh.`);
                    }
                } else {
                    console.warn(`[ChunkLoad Loop ${chunkKey}] ensureHorizontalNeighbors failed during re-processing existing mesh.`);
                }
                continue; // Done with this chunk attempt
            }
            
            // If chunkInfo.mesh does NOT exist, we need to generate it from scratch (ideally via worker).
            // Generate noise map if needed (this path is now for worker dispatch)
            if (!chunkInfo.noiseMap) { // If no noise map, means worker needs to generate it.
                console.log(`[ChunkLoad Loop ${chunkKey}] Requesting geometry (includes noiseMap) from worker.`);
                if (requestChunkGeometry(chunk.x, chunk.y, chunk.z, noiseLayersRef!, seedRef!)) {
                    pendingNoiseMapRequests.add(chunkKey); // Mark as pending for worker response
                    processedCount++;
                    if (willBeProcessedForInitialLoad) initialLoadingCount++; // Increment only if successfully dispatched
                } else {
                    console.error(`[ChunkLoad Loop ${chunkKey}] Failed to post message to worker. Will not be loaded via worker.`);
                    // If request fails, clean up placeholder if it was just created for this attempt
                    if (loadedChunksRef![chunkKey] && !loadedChunksRef![chunkKey].noiseMap && !loadedChunksRef![chunkKey].mesh) {
                        delete loadedChunksRef![chunkKey];
                    }
                }
            } else {
                 // NoiseMap exists, but mesh doesn't in chunkMeshesRef. This implies it might be from an old load
                 // or worker only returned noiseMap. Fallback to main thread meshing.
                console.log(`[ChunkLoad Loop ${chunkKey}] NoiseMap exists, but mesh missing in chunkMeshesRef. Attempting generateLocalMesh.`);
                const hasNeighbors = ensureHorizontalNeighbors(chunk.x, chunk.y, chunk.z);
                if (hasNeighbors) {
                    if (generateLocalMesh(chunk.x, chunk.y, chunk.z)) { 
                        processedCount++;
                        if (willBeProcessedForInitialLoad) initialLoadingCount++; // Increment only if successfully processed
                    } else {
                        console.warn(`[ChunkLoad Loop ${chunkKey}] generateLocalMesh failed for new mesh with existing noiseMap.`);
                    }
                } else {
                    console.warn(`[ChunkLoad Loop ${chunkKey}] ensureHorizontalNeighbors returned false. Mesh not generated for new mesh with existing noiseMap.`);
                }
            }
            // END NEW LOGIC BLOCK
        }
        
        console.log(`[ChunkLoad Loop] Finished processing chunksToLoad. Processed ${processedCount} successfully this frame.`); // Log after loop

        // --- Check if initial loading is complete ---
        if (!isInitialLoadComplete && chunksToLoad.length === 0) {
            isInitialLoadComplete = true;
            console.log("[Chunk Loading] Initial loading complete!");
        }
        
        // Update debug visualizations
        updateDebugBoxes();
    }

    // --- Chunk Unloading Logic ---
    if (timeSinceLastUnloadCheck >= UNLOAD_CHECK_INTERVAL) {
        // ... (Chunk unloading logic remains unchanged / disabled) ...
    }
}

// --- Event Handlers ---
function handleUnlock() {
    console.log('Pointer unlocked - Exiting FP mode.');
    if (onExitCallback) {
        onExitCallback(); // Trigger the exit in the main viewer
    } else {
        console.warn("onExitCallback not set in isolatedFirstPerson!");
        cleanupIsolatedFirstPerson();
    }
}

function onKeyDown(event: KeyboardEvent) {
    if (!isActive) return;
    // <<< DEBUG LOG >>>
    console.log(`[FP KeyDown] Code: ${event.code}, isActive: ${isActive}`);
    switch (event.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyD': keys.d = true; break;
        case 'Space': keys.space = true; jump = true; break; // Set jump flag
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = true; break;
        case 'Escape': // Use Escape key to exit cleanly
             // <<< DEBUG LOGS for Escape Key >>>
             console.log("[FP KeyDown] Escape key pressed.");
             console.log(`  - fpControls exists: ${!!fpControls}`);
             if (fpControls) {
                 console.log(`  - fpControls.isLocked: ${fpControls.isLocked}`);
             }
             console.log(`  - onExitCallback exists: ${!!onExitCallback}`);
             // <<< END DEBUG LOGS >>>

             if (fpControls?.isLocked) {
                 console.log("[FP KeyDown] Escape: Attempting fpControls.unlock()...");
                 fpControls.unlock(); // This will trigger handleUnlock
             } else if (onExitCallback) {
                 console.log("[FP KeyDown] Escape: Pointer not locked, attempting direct onExitCallback()...");
                 onExitCallback(); // Directly trigger exit if not locked
             } else {
                 console.warn("[FP KeyDown] Escape pressed, but controls not locked AND no exit callback found!");
             }
             break;
    }
}

function onKeyUp(event: KeyboardEvent) {
     if (!isActive) return;
    switch (event.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyD': keys.d = false; break;
        case 'Space': keys.space = false; jump = false; break; // Clear jump flag
        case 'ShiftLeft':
        case 'ShiftRight': keys.shift = false; break;
    }
}

// --- Getters (Optional) ---
export function isIsolatedFirstPersonActive(): boolean {
    return isActive;
}

export function getIsolatedFirstPersonCamera(): THREE.PerspectiveCamera | null {
    return fpCamera;
}

// Helper function to ensure all HORIZONTAL neighbors are loaded
function ensureHorizontalNeighbors(cx: number, cy: number, cz: number): boolean {
    if (!loadedChunksRef || !noiseLayersRef || !seedRef) {
        console.warn(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] Aborting: Missing essential refs.`);
        return false;
    }
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
        let neighborInfo = loadedChunksRef[neighborKey];
        
        if (!neighborInfo) {
            console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] Neighbor ${neighborKey} not in loadedChunksRef, creating entry.`);
            loadedChunksRef[neighborKey] = {
                noiseMap: null,
                lastAccessTime: Date.now()
            };
            neighborInfo = loadedChunksRef[neighborKey];
        }
        
        // Generate noise map if missing
        if (!neighborInfo.noiseMap) {
            console.log(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] NoiseMap for neighbor ${neighborKey} is missing. Attempting to generate...`);
            neighborInfo.noiseMap = generateNoiseMap(neighbor.x, neighbor.y, neighbor.z, noiseLayersRef, seedRef);
            neighborInfo.lastAccessTime = Date.now();
            
            // If we couldn't generate a noise map, return false
            if (!neighborInfo.noiseMap) {
                console.error(`[EnsureNeighbors ${getChunkKeyY(cx,cy,cz)}] FAILED to generate noiseMap for neighbor ${neighborKey}. Returning false.`);
                return false; // <<<< THIS COULD BE THE EXIT POINT
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

// Function to create or update debug boxes for chunks
function updateDebugBoxes() {
    if (!showChunkBoundaries || !isActive || !sceneRef || !chunkMeshesRef || !loadedChunksRef) return;
    
    // Create boxes for all chunks in loadedChunksRef
    for (const chunkKey in loadedChunksRef!) {
        // Skip if box already exists
        if (debugBoxes[chunkKey]) continue;
        
        // Parse coordinates
        const [cx, cy, cz] = chunkKey.split(',').map(Number);
        
        // Create wireframe box
        const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
        const edges = new THREE.EdgesGeometry(geometry);
        
        // Color based on status:
        // - Red: Y <= -1 (underground chunks)
        // - Yellow: Pending (in loadedChunks but no mesh)
        // - Green: Complete (has mesh)
        // - Blue: Y >= 1 (sky chunks)
        let color = 0xffff00; // Default yellow for pending
        
        const isPending = !loadedChunksRef[chunkKey].mesh;
        
        if (!isPending) {
            color = 0x00ff00; // Green for complete with mesh
        } else if (cy <= -1) {
            color = 0xff0000; // Red for underground pending chunks
        } else if (cy >= 1) {
            color = 0x0000ff; // Blue for sky pending chunks
        }
        
        const material = new THREE.LineBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: isPending ? 0.3 : 0.7 // Make complete chunks more visible
        });
        
        const box = new THREE.LineSegments(edges, material);
        box.position.set(
            cx * CHUNK_SIZE, 
            cy * CHUNK_HEIGHT, 
            cz * CHUNK_SIZE
        );
        sceneRef.add(box);
        debugBoxes[chunkKey] = box;
    }
    
    // Remove boxes for unloaded chunks
    for (const boxKey in debugBoxes) {
        if (!loadedChunksRef[boxKey]) {
            sceneRef.remove(debugBoxes[boxKey]);
            debugBoxes[boxKey].geometry.dispose();
            (debugBoxes[boxKey].material as THREE.Material).dispose();
            delete debugBoxes[boxKey];
        } else if (loadedChunksRef[boxKey].mesh) {
            // Update color if chunk now has a mesh
            const material = debugBoxes[boxKey].material as THREE.LineBasicMaterial;
            material.color.set(0x00ff00); // Green for complete
            material.opacity = 0.7; // Make complete chunks more visible
        }
    }
}