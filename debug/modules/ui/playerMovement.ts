import * as THREE from 'three';
import { getChunkKeyY } from '../../utils_debug'; // Path relative to playerMovement.ts
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';
import { NoiseMap } from '../../types_debug'; // Add NoiseMap import
import { logThrottled } from '../../logThrottler'; // Import the throttler

// ---- Constants that were previously imported ----
export const playerHeight = 1.7;
export const playerRadius = 0.6;
export const MOVE_SPEED = 10.0;          // Base movement speed (units per second)
export const JUMP_VELOCITY = 8.0;        // Initial velocity when jumping
export const sprintMultiplier = 1.8;    // Speed multiplier when sprinting
export const GRAVITY = 20.0;             // Gravitational force
export const MAX_Y_VELOCITY = 30.0;   // Terminal velocity when falling

// Movement smoothing constants (Sketchbook-like)
export const MOVEMENT_DAMPING = 0.8; // Smoothing factor for movement (0-1, higher = more responsive)
export const MOVEMENT_MASS = 10; // Simulated mass for movement (higher = more inertia)
export const ROTATION_DAMPING = 0.7; // Smoothing factor for rotation
export const ROTATION_MASS = 20; // Simulated mass for rotation
export const VELOCITY_SMOOTHING = 0.92; // Velocity retention between frames

// Create raycasters that were previously imported
export const groundRaycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -1, 0)
);

export const frontRaycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0)
);

export const backRaycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-1, 0, 0)
);

export const leftRaycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 1)
);

export const rightRaycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
);

// Debug visualization functions previously imported
export function addDebugRay(start: THREE.Vector3, end: THREE.Vector3, color: number, group: THREE.Group): void {
    const material = new THREE.LineBasicMaterial({ color });
    const points = [start.clone(), end.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    group.add(line);
    
    // Auto-cleanup after 1 second
    setTimeout(() => {
        group.remove(line);
        geometry.dispose();
        material.dispose();
    }, 1000);
}

export function setDebugMaterial(mesh: THREE.Mesh): void {
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => {
            if (m instanceof THREE.MeshBasicMaterial) {
                m.wireframe = true;
                m.transparent = true;
                m.opacity = 0.5;
            }
        });
    } else if (mesh.material instanceof THREE.Material) {
        const debugMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            wireframe: true,
            transparent: true,
            opacity: 0.5
        });
        mesh.material = debugMaterial;
    }
}

// Types needed
export type ChunkMeshesRef = { [key: string]: THREE.Mesh | null };

export interface PlayerInputState {
    w: boolean; a: boolean; s: boolean; d: boolean;
    space: boolean;
    shift: boolean;
}

// For compatibility with Yuka controller
export interface AIPlayerInputState {
    forward: number;
    backward: number;
    left: number;
    right: number;
    jump: boolean;
    sprint: boolean;
    mouseX: number;
    mouseY: number;
}

export interface PlayerPhysicsState {
    yVelocity: number;
    grounded: boolean;
    position?: THREE.Vector3; // Add optional position property
}

// Custom type to store bbox with chunk data for debugging
interface BBoxWithChunkData {
    bbox: THREE.Box3;
    chunkKey: string;
    chunkX: number;
    chunkY: number;
    chunkZ: number;
}

// Constants
const GROUND_RAY_LENGTH = 500; // Increased from 200 to 500 for much longer ray detection
const HORIZONTAL_RAY_LENGTH = 5; // Increased from 3 to 5 for better horizontal detection
const FORCE_GROUND_SCAN_RANGE = 800; // Increased from 300 to 800 for much better ground scan range
const ABSOLUTE_MIN_GROUND_LEVEL = -2000; // Doubled the minimum ground level from -1000 to -2000
const COLLISION_CHUNK_RADIUS = 5; // Increased from 3 to 5 for wider collision detection
const SNAP_DISTANCE = 200; // Increased from 100 to 200 for better snapping to terrain
const FORCE_GROUND_SNAP = true;
const GROUND_DETECTION_SAMPLES = 9;
const GROUND_DETECTION_RADIUS = 2.0;
const USE_NOISEMAP_FOR_GROUND = true; // ENABLE noisemap detection for precise ground height
const FORCE_ABSOLUTE_GROUND_LEVEL = 5;
const USE_FORCE_GROUND = true;
const USE_MESH_BBOX_DETECTION = true;
const CONTINUOUS_GROUND_DETECTION = true;
const FIXED_GROUND_HEIGHT = 5;
const FIXED_MOVE_SPEED_MULTIPLIER = 2.0;
const TERRAIN_FOLLOW_ENABLED = true;
const GROUND_OFFSET = 1.5;
const MAX_SLOPE_ANGLE = 60;
const MULTI_RAY_GROUND_DETECTION = true;
const DEBUG_GROUND_DETECTION = true;
const SLOPE_RAY_LENGTH = 20; // Increased from 10 to 20
const FORWARD_RAY_COUNT = 8; // Increased from 5 to 8
const FORWARD_RAY_SPACING = 1.5; // Increased from 1.0 to 1.5
const SLOPE_DETECTION_ENABLED = true;
const MAX_SLOPE_CLIMB = 2.0;
const SLOPE_SMOOTHING = 0.8;
const DEBUG_NOISEMAP = true; // NEW: Enable noisemap debugging
const EXACT_MESH_TRACKING = true; // NEW: Always use exact mesh coordinates
const MESH_VERTEX_PRECISION = true; // NEW: Use precise vertex detection
const MAX_VERTEX_SCAN_RADIUS = 10; // NEW: Maximum radius to scan for vertices
const STRICT_MESH_ALIGNMENT = true; // NEW: Force player to exactly align to mesh

// Debug - ALWAYS ON
const DEBUG_MOVEMENT = true;

// Add this debug constant
const DEBUG_BBOX = true; // NEW: Show bounding box debug info

// Add new constants for hitbox collision
const HITBOX_WIDTH = 1.2;
const HITBOX_HEIGHT = 2.0;
const HITBOX_DEPTH = 1.2;
const USE_HITBOX_COLLISION = false;
const SHOW_HITBOX = true;
const HITBOX_PENETRATION_MAX = 0.8;
const FORWARD_PROJECTION_DISTANCE = 3.0;
const DOWN_PROJECTION_DISTANCE = 10.0;
const IMPROVE_HITBOX_EFFICIENCY = true;
const HITBOX_DEBUG_VERBOSE = false;
const MAX_CHECKED_VERTICES = 7000;
const HITBOX_VERTEX_STRIDE_AUTO = true;

// Add this after other interface declarations
interface CollisionResult {
  collides: boolean;
  penetration?: THREE.Vector3;
  normal?: THREE.Vector3;
  groundHeight?: number;
}

// Spring implementation (similar to Sketchbook's springV function)
interface SimulationFrame {
    position: number;
    velocity: number;
}

export function spring(source: number, dest: number, velocity: number, mass: number, damping: number): SimulationFrame {
    let acceleration = dest - source;
    acceleration /= mass;
    velocity += acceleration;
    velocity *= damping;
    let position = source + velocity;
    
    return { position, velocity };
}

export function springVector(source: THREE.Vector3, dest: THREE.Vector3, velocity: THREE.Vector3, mass: number, damping: number): void {
    const acceleration = new THREE.Vector3().subVectors(dest, source);
    acceleration.divideScalar(mass);
    velocity.add(acceleration);
    velocity.multiplyScalar(damping);
    source.add(velocity);
}

// Store velocity for smoothed player movement
let playerVelocity = new THREE.Vector3();
let targetVelocity = new THREE.Vector3();
let worldSpaceVelocity = new THREE.Vector3();

/**
 * Simple, reliable player movement with absolute ground limit
 */
export function updatePlayerMovementAndCollision(
    fpCamera: THREE.PerspectiveCamera,
    inputState: PlayerInputState,
    currentPhysicsState: PlayerPhysicsState,
    delta: number,
    chunkMeshesRef: ChunkMeshesRef | null,
    debugRayGroup: THREE.Group | null = null, // Added debug ray group parameter
    viewDirectionOverride?: THREE.Vector3 | null // NEW: Optional override for view direction
): PlayerPhysicsState {
    // Debug input
    if (DEBUG_MOVEMENT && (inputState.w || inputState.a || inputState.s || inputState.d)) {
        logThrottled("PM_INPUT", 1000, `[Movement] Input w=${inputState.w}, a=${inputState.a}, s=${inputState.s}, d=${inputState.d}`);
    }

    let { yVelocity, grounded } = currentPhysicsState;
    const jumpPressed = inputState.space;
    const initialY = fpCamera.position.y;
    const previousPosition = fpCamera.position.clone(); // Store position before any movement
    
    logThrottled("PM_INIT_QUAT", 500, `[PlayerMovement] fpCamera (proxy) initial quat: (${fpCamera.quaternion.x.toFixed(2)}, ${fpCamera.quaternion.y.toFixed(2)}, ${fpCamera.quaternion.z.toFixed(2)}, ${fpCamera.quaternion.w.toFixed(2)})`);
    
    // Create basic hitbox at the start (without extension)
    let playerHitbox: THREE.Box3 | null = null;
    let hitboxHelper: THREE.Box3Helper | null = null;
    
    if (USE_HITBOX_COLLISION) {
        const halfWidth = HITBOX_WIDTH / 2;
        const halfDepth = HITBOX_DEPTH / 2;
        
        // Create base hitbox (without forward extension for now)
        playerHitbox = new THREE.Box3(
            new THREE.Vector3(
                fpCamera.position.x - halfWidth, 
                fpCamera.position.y - playerHeight, // Bottom of hitbox at feet level
                fpCamera.position.z - halfDepth
            ),
            new THREE.Vector3(
                fpCamera.position.x + halfWidth,
                fpCamera.position.y - playerHeight + HITBOX_HEIGHT, // Top of hitbox
                fpCamera.position.z + halfDepth
            )
        );
    }

    if (!chunkMeshesRef) {
        console.warn("[Movement] Cannot perform movement: chunkMeshesRef is null");
        return { yVelocity, grounded: false };
    }

    // Calculate player's current chunk position
    const playerChunkX = Math.floor(fpCamera.position.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(fpCamera.position.y / CHUNK_HEIGHT);
    const playerChunkZ = Math.floor(fpCamera.position.z / CHUNK_SIZE);

    // --- Collect Nearby Chunk Meshes for Collision ---
    const nearbyChunkMeshes: THREE.Mesh[] = [];
    const nearbyChunkMeshesForGround: THREE.Mesh[] = []; // Separate list for ground checks to be more targeted
    
    if (DEBUG_MOVEMENT) {
        logThrottled("PM_COLLECT_MESHES_POS", 2000, `[CollectMeshes] Player cam pos: (${fpCamera.position.x.toFixed(2)}, ${fpCamera.position.y.toFixed(2)}, ${fpCamera.position.z.toFixed(2)})`);
        logThrottled("PM_COLLECT_MESHES_CHUNK", 2000, `[CollectMeshes] Calculated player chunk: (${playerChunkX}, ${playerChunkY}, ${playerChunkZ}) CHUNK_SIZE: ${CHUNK_SIZE}`);
    }
    
    // Mesh bounding boxes for ground detection
    const meshBoundingBoxes: BBoxWithChunkData[] = [];
    let lowestMeshPoint = Infinity;

    // Get meshes for current chunk and surrounding chunks for proper collision detection
    // IMPORTANT: Scan more chunks below player to find ground
    const Y_SCAN_RANGE_GROUND = 3; // Scan current Y level and three below for ground
    const Y_SCAN_RANGE_HORIZONTAL = 0; // Only current Y level for horizontal
    
    for (let dx = -COLLISION_CHUNK_RADIUS; dx <= COLLISION_CHUNK_RADIUS; dx++) {
        // Scan for ground meshes
        for (let dy = -Y_SCAN_RANGE_GROUND; dy <= 0; dy++) { 
            for (let dz = -COLLISION_CHUNK_RADIUS; dz <= COLLISION_CHUNK_RADIUS; dz++) {
                const currentSearchChunkX = playerChunkX + dx;
                const currentSearchChunkY = playerChunkY + dy;
                const currentSearchChunkZ = playerChunkZ + dz;
                const chunkKey = getChunkKeyY(currentSearchChunkX, currentSearchChunkY, currentSearchChunkZ);
                const chunkMesh = chunkMeshesRef[chunkKey];
                
                if (DEBUG_MOVEMENT && (dx === 0 && dz === 0 && dy === 0)) { // Log specifically for the player's current chunk
                    logThrottled("PM_PLAYER_CHUNK_CHECK", 2000, `[CollectMeshes] Checking player's direct chunkKey: ${chunkKey}, Mesh found: ${!!chunkMesh}`);
                    if (chunkMesh) {
                        chunkMesh.updateMatrixWorld();
                        const worldPos = new THREE.Vector3();
                        chunkMesh.getWorldPosition(worldPos); // Should be (0,0,0) if vertices are world
                        let bsInfo = "N/A";
                        if(chunkMesh.geometry) {
                            if(!chunkMesh.geometry.boundingSphere) chunkMesh.geometry.computeBoundingSphere();
                            if(chunkMesh.geometry.boundingSphere) {
                                const sphere = chunkMesh.geometry.boundingSphere.clone().applyMatrix4(chunkMesh.matrixWorld);
                                bsInfo = `Center:(${sphere.center.x.toFixed(2)},${sphere.center.y.toFixed(2)},${sphere.center.z.toFixed(2)}), Radius:${sphere.radius.toFixed(2)}`;
                            }
                        }
                        logThrottled("PM_PLAYER_CHUNK_DETAILS", 2000, `[CollectMeshes] Player's direct chunk mesh: Name: ${chunkMesh.name}, WorldPos: (${worldPos.x.toFixed(2)},${worldPos.y.toFixed(2)},${worldPos.z.toFixed(2)}), BSphere: ${bsInfo}`);
                    }
                }

                if (chunkMesh) {
                    nearbyChunkMeshesForGround.push(chunkMesh);
                    if (!nearbyChunkMeshes.includes(chunkMesh)) { // Avoid duplicates if also used for horizontal
                    nearbyChunkMeshes.push(chunkMesh);
                    }
                }
            }
        }
        // Scan for horizontal collision meshes (can be a more limited Y range if desired)
        // For now, let's ensure horizontal checks also use relevant meshes
        // If Y_SCAN_RANGE_HORIZONTAL is different, this loop needs adjustment
        // For simplicity, we're currently populating `nearbyChunkMeshes` with ground candidates too.
        // If horizontal collision needs a different set of meshes, a separate loop would be cleaner.
    }


    if (DEBUG_MOVEMENT) {
        logThrottled("PM_COLLISION_COUNTS", 2000, `[Collision] Found ${nearbyChunkMeshes.length} nearby chunks for general collision.`);
        logThrottled("PM_GROUND_COLL_COUNTS", 2000, `[Collision] Found ${nearbyChunkMeshesForGround.length} nearby chunks for ground detection.`);
    }

    // If no meshes found for ground, try a wider scan (simplified from original)
    if (nearbyChunkMeshesForGround.length === 0) {
        console.warn("[Movement] No nearby chunks for ground! Scanning wider area for ANY ground...");
        for (const key in chunkMeshesRef) {
            if (chunkMeshesRef[key]) {
                nearbyChunkMeshesForGround.push(chunkMeshesRef[key]!);
                if (!nearbyChunkMeshes.includes(chunkMeshesRef[key]!)) {
                     nearbyChunkMeshes.push(chunkMeshesRef[key]!);
                }
            }
        }
        if (DEBUG_MOVEMENT && nearbyChunkMeshesForGround.length > 0) {
            console.log(`[Movement] Found ${nearbyChunkMeshesForGround.length} meshes in wider ground scan.`);
        }
        
        // If still no ground meshes found (AI agents in ungenerated areas), provide fallback
        if (nearbyChunkMeshesForGround.length === 0) {
            console.warn("[Movement] No ground meshes found even in wider scan. Using fallback ground level for AI agents.");
            // For AI agents in ungenerated areas, assume ground level at Y=0 or slightly below current position
            const fallbackGroundY = Math.min(0, fpCamera.position.y - 5);
            if (fpCamera.position.y > fallbackGroundY + 1) {
                // Apply gravity to bring agent down to fallback ground level
                yVelocity -= GRAVITY * delta;
                fpCamera.position.y += yVelocity * delta;
                
                // Check if we've reached the fallback ground
                if (fpCamera.position.y <= fallbackGroundY) {
                    fpCamera.position.y = fallbackGroundY;
                    yVelocity = 0;
                    grounded = true;
                }
            } else {
                // Already at or below fallback ground level
                fpCamera.position.y = Math.max(fpCamera.position.y, fallbackGroundY);
                yVelocity = 0;
                grounded = true;
            }
            
            // Return early since we handled movement with fallback
            return {
                position: fpCamera.position.clone(),
                yVelocity,
                grounded
            };
        }
    }
    
    // --- Player Movement (Horizontal) ---
    const effectiveSpeed = (inputState.shift ? sprintMultiplier : 1) * MOVE_SPEED;
    const effectiveFrameSpeed = effectiveSpeed * delta;

    let didMoveHorizontally = inputState.w || inputState.s || inputState.a || inputState.d;

    // Reset target velocity if no input
    if (!didMoveHorizontally) {
        targetVelocity.set(0, 0, 0);
    }

    if (didMoveHorizontally) {
        let visualForward: THREE.Vector3;
        let visualRight: THREE.Vector3;

        if (viewDirectionOverride) {
            visualForward = viewDirectionOverride.clone(); // Already represents visual forward
            visualRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0), visualForward).normalize();
            logThrottled("PM_VISUAL_VECTORS_OVERRIDE", 500, `[PlayerMovement] Using OVERRIDE: visualForward (XZ): (${visualForward.x.toFixed(3)}, ${visualForward.z.toFixed(3)}), visualRight (XZ): (${visualRight.x.toFixed(3)}, ${visualRight.z.toFixed(3)})`);
        } else {
            // If no override, use fpCamera (proxy object representing character)
            // Assume model's -Z is forward, model's +X is right.
            const modelForward = new THREE.Vector3(0, 0, -1).applyQuaternion(fpCamera.quaternion);
            modelForward.y = 0;
            visualForward = modelForward.normalize();

            const modelRight = new THREE.Vector3(1, 0, 0).applyQuaternion(fpCamera.quaternion);
            modelRight.y = 0;
            visualRight = modelRight.normalize();
            logThrottled("PM_VISUAL_VECTORS_PROXY", 500, `[PlayerMovement] From PROXY: visualForward (XZ): (${visualForward.x.toFixed(3)}, ${visualForward.z.toFixed(3)}), visualRight (XZ): (${visualRight.x.toFixed(3)}, ${visualRight.z.toFixed(3)})`);
        }
        
        // Calculate target velocity based on input
        targetVelocity.set(0, 0, 0);
        
        // For forward/backward movement (W/S keys)
        if (inputState.w) {
            targetVelocity.add(visualForward.clone().multiplyScalar(effectiveSpeed));
        }
        if (inputState.s) {
            targetVelocity.add(visualForward.clone().negate().multiplyScalar(effectiveSpeed));
        }

        // For strafing (A/D keys)
        if (inputState.a) { 
            targetVelocity.add(visualRight.clone().negate().multiplyScalar(effectiveSpeed));
        }
        if (inputState.d) {
            targetVelocity.add(visualRight.clone().multiplyScalar(effectiveSpeed));
        }
        
        // Normalize if moving diagonally to prevent faster diagonal movement
        if (targetVelocity.lengthSq() > effectiveSpeed * effectiveSpeed) {
            targetVelocity.normalize().multiplyScalar(effectiveSpeed);
        }
        
        // Apply spring-based smoothing to velocity
        springVector(playerVelocity, targetVelocity, worldSpaceVelocity, MOVEMENT_MASS, MOVEMENT_DAMPING);
        
        // Zero out vertical component for horizontal movement
        playerVelocity.y = 0;
        
        // Calculate frame delta to apply
        const worldSpaceDelta = playerVelocity.clone().multiplyScalar(delta);
        
        logThrottled("PM_WORLD_DELTA_PRE_COLL", 500, `[PlayerMovement] worldSpaceDelta BEFORE collision: (${worldSpaceDelta.x.toFixed(3)}, ${worldSpaceDelta.y.toFixed(3)}, ${worldSpaceDelta.z.toFixed(3)})`);

        // 3. Perform World-Axis Raycasts
        const horizontalRayOrigin = fpCamera.position.clone();
        // Optional: Adjust Y to player's mid-height if fpCamera.position.y is eye-level
        // horizontalRayOrigin.y -= playerHeight / 4; // Example: Check from lower-mid body
        
        const collisionCheckDistance = playerRadius + 0.1; // How far to check

        let hitFront = false;
        let hitBack = false;
        let hitLeft = false;
        let hitRight = false;

        if (nearbyChunkMeshes.length > 0) {
            // Front (+X World)
            frontRaycaster.ray.origin.copy(horizontalRayOrigin);
            // frontRaycaster.ray.direction is already (1,0,0)
            frontRaycaster.far = collisionCheckDistance;
            const frontIntersects = frontRaycaster.intersectObjects(nearbyChunkMeshes, false);
            if (frontIntersects.length > 0) {
                hitFront = true;
                if (debugRayGroup) addDebugRay(frontRaycaster.ray.origin, frontIntersects[0].point, 0xff0000, debugRayGroup);
            } else {
                if (debugRayGroup) addDebugRay(frontRaycaster.ray.origin, frontRaycaster.ray.origin.clone().addScaledVector(frontRaycaster.ray.direction, frontRaycaster.far), 0x00ff00, debugRayGroup);
            }

            // Back (-X World)
            backRaycaster.ray.origin.copy(horizontalRayOrigin);
            // backRaycaster.ray.direction is already (-1,0,0)
            backRaycaster.far = collisionCheckDistance;
            const backIntersects = backRaycaster.intersectObjects(nearbyChunkMeshes, false);
            if (backIntersects.length > 0) {
                hitBack = true;
                if (debugRayGroup) addDebugRay(backRaycaster.ray.origin, backIntersects[0].point, 0xff0000, debugRayGroup);
            } else {
                if (debugRayGroup) addDebugRay(backRaycaster.ray.origin, backRaycaster.ray.origin.clone().addScaledVector(backRaycaster.ray.direction, backRaycaster.far), 0x00ff00, debugRayGroup);
            }

            // Left (+Z World) - Note: 'leftRaycaster' from collisionDetection.ts is +Z
            leftRaycaster.ray.origin.copy(horizontalRayOrigin);
            // leftRaycaster.ray.direction is already (0,0,1)
            leftRaycaster.far = collisionCheckDistance;
            const leftIntersects = leftRaycaster.intersectObjects(nearbyChunkMeshes, false);
            if (leftIntersects.length > 0) {
                hitLeft = true; // This corresponds to hitting something in the World +Z direction
                if (debugRayGroup) addDebugRay(leftRaycaster.ray.origin, leftIntersects[0].point, 0xff0000, debugRayGroup);
            } else {
                if (debugRayGroup) addDebugRay(leftRaycaster.ray.origin, leftRaycaster.ray.origin.clone().addScaledVector(leftRaycaster.ray.direction, leftRaycaster.far), 0x00ff00, debugRayGroup);
            }

            // Right (-Z World) - Note: 'rightRaycaster' from collisionDetection.ts is -Z
            rightRaycaster.ray.origin.copy(horizontalRayOrigin);
            // rightRaycaster.ray.direction is already (0,0,-1)
            rightRaycaster.far = collisionCheckDistance;
            const rightIntersects = rightRaycaster.intersectObjects(nearbyChunkMeshes, false);
            if (rightIntersects.length > 0) {
                hitRight = true; // This corresponds to hitting something in the World -Z direction
                if (debugRayGroup) addDebugRay(rightRaycaster.ray.origin, rightIntersects[0].point, 0xff0000, debugRayGroup);
            } else {
                if (debugRayGroup) addDebugRay(rightRaycaster.ray.origin, rightRaycaster.ray.origin.clone().addScaledVector(rightRaycaster.ray.direction, rightRaycaster.far), 0x00ff00, debugRayGroup);
            }
        }
        
        // 4. Modify World-Space Delta based on hits
        if (hitFront && worldSpaceDelta.x > 0) {
            if (DEBUG_MOVEMENT) logThrottled("PM_COLL_FRONT", 500, "[Movement] Horizontal collision on World +X. Stopping X+ movement.");
            worldSpaceDelta.x = 0;
        }
        if (hitBack && worldSpaceDelta.x < 0) {
            if (DEBUG_MOVEMENT) logThrottled("PM_COLL_BACK", 500, "[Movement] Horizontal collision on World -X. Stopping X- movement.");
            worldSpaceDelta.x = 0;
        }
        if (hitLeft && worldSpaceDelta.z > 0) { // hitLeft is +Z world
            if (DEBUG_MOVEMENT) logThrottled("PM_COLL_LEFT", 500, "[Movement] Horizontal collision on World +Z. Stopping Z+ movement.");
            worldSpaceDelta.z = 0;
        }
        if (hitRight && worldSpaceDelta.z < 0) { // hitRight is -Z world
            if (DEBUG_MOVEMENT) logThrottled("PM_COLL_RIGHT", 500, "[Movement] Horizontal collision on World -Z. Stopping Z- movement.");
            worldSpaceDelta.z = 0;
        }
        
        logThrottled("PM_WORLD_DELTA_POST_COLL", 500, `[PlayerMovement] worldSpaceDelta AFTER collision: (${worldSpaceDelta.x.toFixed(3)}, ${worldSpaceDelta.y.toFixed(3)}, ${worldSpaceDelta.z.toFixed(3)})`);
        // 5. Apply the (potentially modified) world-space delta
        fpCamera.position.add(worldSpaceDelta);

    } else {
        // If not moving, gradually slow down using damping
        playerVelocity.multiplyScalar(VELOCITY_SMOOTHING);

        // Ensure velocity truly becomes zero to prevent drift
        if (playerVelocity.lengthSq() < 0.0001) { // Threshold to consider it stopped
            playerVelocity.set(0, 0, 0);
        }

        // Apply remaining velocity if any (after potential zeroing)
        if (playerVelocity.lengthSq() > 0.0001) {
            const slowdownDelta = playerVelocity.clone().multiplyScalar(delta);
            fpCamera.position.add(slowdownDelta);
        }
    }

    // --- Ground Detection and Vertical Movement ---
    grounded = false; // Assume not grounded until proven otherwise
    let actualGroundLevel = -Infinity;

    if (nearbyChunkMeshesForGround.length > 0) {
        const rayOrigin = fpCamera.position.clone(); // Base origin on player's XZ
        
        rayOrigin.y = fpCamera.position.y + playerHeight; // Start ray from player height above current Y
        
        groundRaycaster.ray.origin.copy(rayOrigin);
        groundRaycaster.far = CHUNK_HEIGHT * 4;

        // DETAILED DEBUG LOGGING START
            if (DEBUG_MOVEMENT) {
            logThrottled("PM_GROUND_RAY_ORIGIN", 2000, `[GroundCheck Ray] Origin: (${groundRaycaster.ray.origin.x.toFixed(2)}, ${groundRaycaster.ray.origin.y.toFixed(2)}, ${groundRaycaster.ray.origin.z.toFixed(2)})`);
            logThrottled("PM_GROUND_RAY_DIR", 2000, `[GroundCheck Ray] Direction: (${groundRaycaster.ray.direction.x.toFixed(2)}, ${groundRaycaster.ray.direction.y.toFixed(2)}, ${groundRaycaster.ray.direction.z.toFixed(2)})`);
            logThrottled("PM_GROUND_RAY_FAR_NEAR", 2000, `[GroundCheck Ray] Far: ${groundRaycaster.far.toFixed(2)}, Near: ${groundRaycaster.near.toFixed(2)}`);
            logThrottled("PM_GROUND_RAY_MASK", 2000, `[GroundCheck Ray] Raycaster Layers Mask: ${groundRaycaster.layers.mask}`);
            logThrottled("PM_GROUND_RAY_CHUNK_CAM_Y", 2000, `[GroundCheck Meshes] Player Chunk Y: ${playerChunkY}, Camera Y: ${fpCamera.position.y.toFixed(2)}`);
            
            const numMeshesToLog = Math.min(nearbyChunkMeshesForGround.length, 1); // Log only the first mesh for brevity
            if (numMeshesToLog === 0) {
                 logThrottled("PM_GROUND_MESHES_EMPTY", 2000, "[GroundCheck Meshes] nearbyChunkMeshesForGround is EMPTY despite earlier check!");
            }
            for (let i = 0; i < numMeshesToLog; i++) {
                const mesh = nearbyChunkMeshesForGround[i];
                if (mesh) {
                    /* mesh.updateMatrixWorld(); // Ensure matrixWorld is up to date for world positions
                    const worldPosition = new THREE.Vector3();
                    mesh.getWorldPosition(worldPosition);
                    
                    let boundingSphereInfo = "N/A";
                    if (mesh.geometry) {
                        if (!mesh.geometry.boundingSphere) {
                            mesh.geometry.computeBoundingSphere();
                        }
                        if (mesh.geometry.boundingSphere) {
                            const sphere = mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld);
                            boundingSphereInfo = `Center:(${sphere.center.x.toFixed(2)},${sphere.center.y.toFixed(2)},${sphere.center.z.toFixed(2)}), Radius:${sphere.radius.toFixed(2)}`;
                        }
                    }
                    console.log(`[Mesh ${i}] Name: ${mesh.name}, UUID: ${mesh.uuid}, Visible: ${mesh.visible}, Layers: ${mesh.layers.mask}`);
                    console.log(`[Mesh ${i}] World Pos: (${worldPosition.x.toFixed(2)}, ${worldPosition.y.toFixed(2)}, ${worldPosition.z.toFixed(2)}), Scale: (${mesh.scale.x.toFixed(2)}, ${mesh.scale.y.toFixed(2)}, ${mesh.scale.z.toFixed(2)})`);
                    console.log(`[Mesh ${i}] BoundingSphere (World): ${boundingSphereInfo}`); */
                } else {
                    // console.log(`[Mesh ${i}] is null or undefined in nearbyChunkMeshesForGround.`);
                }
            }
        }
        // DETAILED DEBUG LOGGING END

        const groundIntersects = groundRaycaster.intersectObjects(nearbyChunkMeshesForGround, false);

        if (groundIntersects.length > 0) {
            const closestHit = groundIntersects[0];
            actualGroundLevel = closestHit.point.y;
            // const distanceToGround = closestHit.distance; // Less critical with high origin ray

            // If we hit something with this robust ray, consider it ground.
            // The snapping logic will handle the precise Y position.
            grounded = true;
            yVelocity = 0; // Stop vertical movement
            
            // Snap player's feet to the ground level.
            // Assuming fpCamera.position.y is the center of the player's height capsule.
            fpCamera.position.y = actualGroundLevel + (playerHeight / 2); 
            
            if (DEBUG_MOVEMENT && debugRayGroup) {
                addDebugRay(rayOrigin, closestHit.point, 0x00ff00, debugRayGroup); // Green for ground hit
            }
        } else {
            if (DEBUG_MOVEMENT && debugRayGroup) {
                 const missEnd = rayOrigin.clone().addScaledVector(groundRaycaster.ray.direction, groundRaycaster.far);
                 addDebugRay(rayOrigin, missEnd, 0xff0000, debugRayGroup); // Red for ground miss
            }
        }
    }

    // Apply Gravity
    if (!grounded) {
        yVelocity -= GRAVITY * delta;
        yVelocity = Math.max(yVelocity, -MAX_Y_VELOCITY); // Apply terminal velocity
    }

    // Jumping
    if (jumpPressed && grounded) {
        yVelocity = JUMP_VELOCITY;
        grounded = false; // No longer on the ground after jumping
    }
    
    // Apply vertical velocity
    fpCamera.position.y += yVelocity * delta;

    // Absolute minimum ground level enforcement (fallback)
    // This is a safety net, ideally robust ground detection should prevent needing this often.
    const minSafeY = ABSOLUTE_MIN_GROUND_LEVEL + (playerHeight / 2);
    if (fpCamera.position.y < minSafeY) {
        if(DEBUG_MOVEMENT) console.warn(`[Movement] Player fell below absolute min Y. Resetting to ${minSafeY}. Grounded: ${grounded}, yVelocity: ${yVelocity}`);
        fpCamera.position.y = minSafeY;
        yVelocity = 0;
        grounded = true; // Force grounded if we hit the absolute bottom
    }


    // --- Fallback: If still no ground found by raycast but was grounded before moving much vertically, try to snap to previous Y ---
    // This is a temporary measure and indicates issues with ground detection if hit often.
    if (!grounded && currentPhysicsState.grounded && Math.abs(fpCamera.position.y - previousPosition.y) > playerHeight * 2 && nearbyChunkMeshesForGround.length === 0) {
        if (DEBUG_MOVEMENT) console.warn("[Movement] Fallback: Lost ground after significant Y change with no nearby meshes. Attempting to revert Y slightly or use fallback.");
        // This could be a sign that chunks aren't loading fast enough or ground detection range is too small.
        // Consider a more robust fallback, like a wider, more persistent ground scan if this happens.
        // For now, let's just log. A more aggressive fallback might be to revert Y if yVelocity is sharply negative.
    }


    if (DEBUG_MOVEMENT) {
        logThrottled("PM_END_FRAME", 500, `[Movement] End Frame: PosY=${fpCamera.position.y.toFixed(2)}, VelY=${yVelocity.toFixed(2)}, Grounded=${grounded}, ActualGroundY=${actualGroundLevel.toFixed(2)}`);
    }

    return { yVelocity, grounded };
}


// --- Helper Functions (Many of these were experimental, review if they are still needed/used correctly) ---

/*
    The following functions are largely from the original complex system.
    They might need to be removed or significantly adapted if the new consolidated ground check is sufficient.
    For now, I'm commenting out the ones that directly conflict with the new simpler ground check or seem highly experimental
    and might be causing issues.
*/

// Function to find the highest point within a set of bounding boxes (original was getHighestTerrainY)
// This is NOT a replacement for raycasting for precise ground detection.
/*
function getHighestBoundingBoxY(
    position: THREE.Vector3,
    boxes: BBoxWithChunkData[],
    radius: number = 5 // Horizontal radius to check
): number | null {
    let highestY: number | null = null;
    for (const boxData of boxes) {
        const bbox = boxData.bbox;
        // Check if the player's XZ is within this bounding box's XZ extent
        if (
            position.x >= bbox.min.x - radius && position.x <= bbox.max.x + radius &&
            position.z >= bbox.min.z - radius && position.z <= bbox.max.z + radius
        ) {
            if (highestY === null || bbox.max.y > highestY) {
                highestY = bbox.max.y;
            }
        }
    }
    if (DEBUG_BBOX && highestY !== null) {
        console.log(`[BBox Highest Y] Highest bbox top found at Y=${highestY.toFixed(2)} around player.`);
    }
    return highestY;
}
*/

// --- ORIGINAL GROUND DETECTION LOGIC ---
// The following extensive ground detection logic is being replaced by the simpler,
// consolidated intersectObjects check above.
// It's preserved here for reference but should be considered inactive with the new changes.
/*
function getGroundHeightAndNormal(
    fpCamera: THREE.PerspectiveCamera,
    nearbyChunkMeshes: THREE.Mesh[],
    chunkMeshesRef: ChunkMeshesRef | null, // For noisemap access
    debugRayGroup: THREE.Group | null
): { groundHeight: number; normal: THREE.Vector3; grounded: boolean } {
    let groundHeight = ABSOLUTE_MIN_GROUND_LEVEL;
    let normal = new THREE.Vector3(0, 1, 0); // Default normal (flat ground)
    let grounded = false;
    let closestIntersection: THREE.Intersection | null = null;

    const playerPosition = fpCamera.position;

    // 1. Mesh Bounding Box Broadphase (Optional, can be slow if many boxes)
    if (USE_MESH_BBOX_DETECTION) {
        // ... (code for BBox checks, this is a broadphase, not precise ground)
    }

    // 2. Multi-Ray Ground Detection (Primary Method)
    if (MULTI_RAY_GROUND_DETECTION && nearbyChunkMeshes.length > 0) {
        const rayPatterns = [
            { x: 0, z: 0 }, // Center
            { x: playerRadius * 0.7, z: 0 }, { x: -playerRadius * 0.7, z: 0 }, // Sides
            { x: 0, z: playerRadius * 0.7 }, { x: 0, z: -playerRadius * 0.7 }, // Front/Back
            // Diagonal might be useful too
        ];

        let hits = 0;
        let averageHeight = 0;
        let averageNormal = new THREE.Vector3();

        for (const pattern of rayPatterns) {
            const rayOrigin = new THREE.Vector3(
                playerPosition.x + pattern.x,
                playerPosition.y + playerHeight * 0.1, // Start ray slightly above feet
                playerPosition.z + pattern.z
            );
            groundRaycaster.ray.origin.copy(rayOrigin);
            groundRaycaster.ray.direction.set(0, -1, 0); // Ensure direction is always down
            groundRaycaster.far = playerHeight; // Ray length relative to player height

            // IMPORTANT: Use intersectObjects here
            const intersects = groundRaycaster.intersectObjects(nearbyChunkMeshes, false);

            if (intersects.length > 0) {
                const hit = intersects[0];
                if (!closestIntersection || hit.distance < closestIntersection.distance) {
                    closestIntersection = hit;
                }
                averageHeight += hit.point.y;
                if (hit.face && hit.face.normal) {
                    // Transform normal to world space
                    const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                    averageNormal.add(worldNormal);
                }
                hits++;
                if (DEBUG_GROUND_DETECTION && debugRayGroup) {
                    addDebugRay(rayOrigin, hit.point, 0x00ffff, debugRayGroup); // Cyan for multi-ray hit
                }
            } else {
                 if (DEBUG_GROUND_DETECTION && debugRayGroup) {
                    const missEnd = rayOrigin.clone().addScaledVector(groundRaycaster.ray.direction, groundRaycaster.far);
                    addDebugRay(rayOrigin, missEnd, 0xff8800, debugRayGroup); // Orange for multi-ray miss
                }
            }
        }

        if (hits > 0) {
            grounded = true;
            groundHeight = averageHeight / hits;
            normal = averageNormal.normalize();

            // If central ray hit, prioritize its specific point for snapping, but use average normal
            if (closestIntersection) { // This ensures closestIntersection from the central ray (if it hit) or closest overall
                 groundHeight = closestIntersection.point.y; // Snap to the closest actual intersection point
                 if (closestIntersection.face && closestIntersection.face.normal) {
                     normal = closestIntersection.face.normal.clone().transformDirection(closestIntersection.object.matrixWorld).normalize();
                 }
            }

        }
    }


    // 3. Fallback / Noisemap-based ground detection (if enabled and no mesh hit)
    // This part is complex and might be better handled separately or after mesh collision is stable.
    // For now, if MULTI_RAY_GROUND_DETECTION found something, we use it.
    if (!grounded && USE_NOISEMAP_FOR_GROUND && chunkMeshesRef) {
        // ... (Original noisemap detection logic - this can be very tricky to get right with mesh-based worlds)
        // This section often caused issues if noisemap and mesh were not perfectly aligned.
        // Consider removing or heavily simplifying if mesh-based collision is the goal.
        // For now, let's assume if multi-ray fails, we are not grounded by this method.
        if (DEBUG_NOISEMAP) console.log("[Noisemap Ground] Multi-ray failed, attempting noisemap lookup.");
        
        // Simplified: Try to get ground from noisemap directly under player center
        const playerXZ = new THREE.Vector2(playerPosition.x, playerPosition.z);
        const noiseMapGroundPoint = getNearestNoiseMapGroundPoint(playerPosition, nearbyChunkMeshes, chunkMeshesRef);

        if (noiseMapGroundPoint) {
            const distanceToNoiseGround = playerPosition.y - noiseMapGroundPoint.y;
            if (distanceToNoiseGround > 0 && distanceToNoiseGround < playerHeight * 0.7) { // Check if player is above and close
                groundHeight = noiseMapGroundPoint.y;
        grounded = true;
                normal.set(0, 1, 0); // Assume flat normal from noisemap for simplicity
                if (DEBUG_NOISEMAP && debugRayGroup) {
                     addDebugRay(playerPosition, noiseMapGroundPoint, 0x00dd00, debugRayGroup); // Darker green for noisemap ground
                }
                if (DEBUG_NOISEMAP) console.log(`[Noisemap Ground] Found ground via noisemap at Y=${groundHeight.toFixed(2)}`);
    } else {
                 if (DEBUG_NOISEMAP) console.log(`[Noisemap Ground] Noisemap point found Y=${noiseMapGroundPoint.y.toFixed(2)} but too far/below player Y=${playerPosition.y.toFixed(2)}`);
            }
        } else {
            if (DEBUG_NOISEMAP) console.log("[Noisemap Ground] Noisemap lookup failed to find a point.");
        }
    }


    if (DEBUG_GROUND_DETECTION) {
         console.log(`[Ground Check] Final - Grounded: ${grounded}, Height: ${groundHeight.toFixed(2)}, Normal: (${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)})`);
    }
    
    return { groundHeight, normal, grounded };
}
*/


// Simplified function for horizontal collision (very basic, placeholder)
// The original had many experimental raycasting patterns.
/*
function checkHorizontalCollision(
    camera: THREE.PerspectiveCamera,
    direction: THREE.Vector3, // Normalized movement direction
    distance: number, // Max distance to move
    collidableMeshes: THREE.Mesh[],
    debugRayGroup: THREE.Group | null
): THREE.Vector3 | null { // Returns collision point or null
    
    frontRaycaster.ray.origin.copy(camera.position);
    // Offset origin slightly forward to avoid hitting self if playerRadius is large
    // frontRaycaster.ray.origin.addScaledVector(direction, 0.1); 
    frontRaycaster.ray.direction.copy(direction);
    frontRaycaster.far = distance + playerRadius; // Check slightly ahead of intended movement + player radius

    const intersects = frontRaycaster.intersectObjects(collidableMeshes, false);

    if (intersects.length > 0) {
        // Check if the closest intersection is within the player's actual movement path + radius
        if (intersects[0].distance < distance + playerRadius * 0.9) { // playerRadius * 0.9 to allow some closeness
             if (DEBUG_MOVEMENT && debugRayGroup) {
                addDebugRay(frontRaycaster.ray.origin, intersects[0].point, 0xff0000, debugRayGroup);
            }
            return intersects[0].point; // Collision
        }
    }
    if (DEBUG_MOVEMENT && debugRayGroup) {
        const endPt = frontRaycaster.ray.origin.clone().addScaledVector(direction, frontRaycaster.far);
        addDebugRay(frontRaycaster.ray.origin, endPt, 0x00ff00, debugRayGroup);
    }
    return null; // No collision
}
*/

// --- Vertex-based collision (Highly experimental, likely needs significant rework or removal) ---
// This section is very complex and processor-intensive. It's generally not recommended
// for standard player collision unless absolutely necessary and heavily optimized.
/*
function checkVertexCollision(
    playerPos: THREE.Vector3,
    targetMeshes: THREE.Mesh[],
    radius: number, // Player's collision radius
    debugGroup: THREE.Group | null
): { collides: boolean, penetrationDepth: number, pushVector: THREE.Vector3 } {
    // ... Original vertex collision code ...
    // This code is very performance heavy and complex.
    // For basic "don't fall through mesh" and "don't walk through walls",
    // raycasting against mesh faces is usually preferred.
    return { collides: false, penetrationDepth: 0, pushVector: new THREE.Vector3() };
}
*/


// --- Precise Ground Point Detection (Original - might be useful if basic raycast isn't enough for slopes) ---
// This was an attempt to find a more "exact" ground point than simple raycasting.
// It's complex and might be overkill if the consolidated intersectObjects works well.
/*
function getPreciseGroundInfo(
    cameraPosition: THREE.Vector3,
    meshes: THREE.Mesh[],
    debugRayGroup: THREE.Group | null
): { y: number; normal: THREE.Vector3 } | null {
    // ... Original precise ground info code using multiple raycasts and averaging ...
    // This is another complex function that might be superseded by the main intersectObjects ground check.
    // If slope handling becomes an issue with the simpler check, parts of this might be revisited.
    let closestValidHit: THREE.Intersection | null = null;
    const centralRayOrigin = cameraPosition.clone();
    centralRayOrigin.y += 0.1; // Start slightly above feet

    groundRaycaster.ray.origin.copy(centralRayOrigin);
                        groundRaycaster.ray.direction.set(0, -1, 0);
    groundRaycaster.far = playerHeight * 1.5; // Check a bit below feet
                        
    const intersects = groundRaycaster.intersectObjects(meshes, false);
                            
                            if (intersects.length > 0) {
        closestValidHit = intersects[0]; // Simplification: take the first hit from central ray
    }


    if (closestValidHit) {
        if (debugRayGroup) {
                    addDebugRay(
                        groundRaycaster.ray.origin,
                closestValidHit.point,
                0x00ff00, // Green for hit
                        debugRayGroup
                    );
        }
        const worldNormal = closestValidHit.face?.normal.clone().transformDirection(closestValidHit.object.matrixWorld).normalize() || new THREE.Vector3(0,1,0);
        return { y: closestValidHit.point.y, normal: worldNormal };
                    } else {
         if (debugRayGroup) {
            addDebugRay(
                groundRaycaster.ray.origin,
                groundRaycaster.ray.origin.clone().addScaledVector(groundRaycaster.ray.direction, groundRaycaster.far),
                0xff0000, // Red for miss
                debugRayGroup
            );
        }
        return null;
    }
}
*/


// --- Hitbox collision detection (Original - complex and might need to be re-evaluated) ---
// This uses THREE.Box3 intersection checks, which can be useful but needs careful integration.
/*
function checkHitboxCollisions(
    playerHitbox: THREE.Box3,
    meshes: THREE.Mesh[],
    movementVector: THREE.Vector3 // Intended movement vector for this frame
): { collides: boolean; adjustment: THREE.Vector3 } {
    // ... Original hitbox collision code ...
    // This involves checking if the player's Box3 intersects with any mesh's Box3 (broadphase)
    // and then potentially more detailed checks.
    // It's a valid approach but adds another layer of complexity.
    // For now, we're focusing on ray-based collision.
    const adjustment = new THREE.Vector3();
    let collidesOverall = false;

    if (!IMPROVE_HITBOX_EFFICIENCY) { // Original, less efficient path
        for (const mesh of meshes) {
            if (!mesh.geometry || !mesh.geometry.attributes.position) continue;

            const meshGlobalMatrix = mesh.matrixWorld;
            const meshBvh = mesh.geometry.boundsTree; // Assuming BVH is precomputed

            if (playerHitbox.intersectsBox(new THREE.Box3().setFromObject(mesh))) { // Broadphase with mesh bbox
                // More detailed check (e.g., against BVH or vertices) would go here.
                // The original had a checkHitboxMeshCollision function.
                const result = checkHitboxMeshCollision(playerHitbox, mesh);
                if (result.collides && result.penetration) {
                    collidesOverall = true;
                    // Simple resolution: push back by penetration.
                    // A more robust solution would consider movement direction.
                    adjustment.add(result.penetration.multiplyScalar(-1)); // Push out
                }
            }
        }
    } else { // Attempt at more efficient path (might still be WIP in original)
        // ...
    }


    return { collides: collidesOverall, adjustment };
}
*/


// --- getNearestNoiseMapGroundPoint (Original - specific to noisemap interaction) ---
// This function is probably not needed if mesh-based collision is working reliably.
/*
function getNearestNoiseMapGroundPoint(
    position: THREE.Vector3,
    collisionMeshes: THREE.Mesh[],
    chunkMeshesRef: ChunkMeshesRef | null
): THREE.Vector3 | null {
// ... existing code ...
function extractChunkCoordinates(mesh: THREE.Mesh): { chunkX: number, chunkY: number, chunkZ: number } | null {
// ... existing code ...
function checkHitboxMeshCollision(hitbox: THREE.Box3, mesh: THREE.Mesh): CollisionResult {
// ... existing code ...
*/

/**
 * Function to find the nearest ground point based on noise map
 * This uses the actual noise map data for precise ground detection
 */
function getNearestNoiseMapGroundPoint(
    position: THREE.Vector3,
    collisionMeshes: THREE.Mesh[],
    chunkMeshesRef: ChunkMeshesRef | null
): THREE.Vector3 | null {
    if (!chunkMeshesRef) return null;
    
    // Debug the search
    if (DEBUG_NOISEMAP) {
        console.log(`[NoiseMap] Looking for ground at position (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    }
    
    // Get current chunk position
    const playerChunkX = Math.floor(position.x / CHUNK_SIZE);
    const playerChunkZ = Math.floor(position.z / CHUNK_SIZE);
    
    // Search in a larger vertical range to find ground at any height
    const MAX_VERTICAL_SEARCH = 30; // Increased from 10 to 30 for more extensive vertical searching
    
    // Track best candidate
    let bestGroundPoint = null;
    let bestDistance = Infinity;
    let foundAnyNoiseMaps = false;
    
    // Expand search across multiple chunks vertically
    for (let dy = -MAX_VERTICAL_SEARCH; dy <= MAX_VERTICAL_SEARCH; dy++) {
        // Calculate target chunk Y
        const targetChunkY = Math.floor(position.y / CHUNK_HEIGHT) + dy;
        
        // Get chunk key for this location
        const chunkKey = getChunkKeyY(playerChunkX, targetChunkY, playerChunkZ);
        const chunkMesh = chunkMeshesRef[chunkKey];
        
        if (chunkMesh && chunkMesh.userData) {
            // Try to get noiseMap from userData
            const noiseMap = chunkMesh.userData.noiseMap as NoiseMap;
            
            if (noiseMap) {
                foundAnyNoiseMaps = true;
                if (DEBUG_NOISEMAP) {
                    console.log(`[NoiseMap] Found noiseMap in chunk ${chunkKey}`);
                }
                
                // Calculate local position within chunk
                const localX = Math.floor(position.x - (playerChunkX * CHUNK_SIZE));
                const localZ = Math.floor(position.z - (playerChunkZ * CHUNK_SIZE));
                
                // Verify local coordinates are within bounds
                if (localX >= 0 && localX < CHUNK_SIZE && localZ >= 0 && localZ < CHUNK_SIZE) {
                    // Scan from top to bottom of chunk to find exact ground level
                    const chunkPositionY = targetChunkY * CHUNK_HEIGHT;
                    
                    // Scan every position in the chunk (from top to bottom)
                    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
                        // If no ground found directly above, search in a wider range
                        const searchRange = 3; // Search 3 cells around the target position
                        for (let dz = -searchRange; dz <= searchRange; dz++) {
                            for (let dx = -searchRange; dx <= searchRange; dx++) {
                                const checkX = localX + dx;
                                const checkZ = localZ + dz;
                                
                                // Skip if outside chunk bounds
                                if (checkX < 0 || checkX >= CHUNK_SIZE || checkZ < 0 || checkZ >= CHUNK_SIZE) continue;
                                
                                if (noiseMap[y] && noiseMap[y][checkZ] && checkX < noiseMap[y][checkZ].length) {
                                    const noiseValue = noiseMap[y][checkZ][checkX];
                                    
                                    // Ground is where value crosses from negative to positive
                                    if (noiseValue > 0) {
                                        // This is solid terrain
                                        const worldY = chunkPositionY + y;
                                        const distance = Math.abs(position.y - worldY);
                                        
                                        if (DEBUG_NOISEMAP) {
                                            console.log(`[NoiseMap] Ground detected at chunk ${chunkKey}, local (${checkX},${y},${checkZ}), world Y=${worldY}, distance=${distance.toFixed(2)}`);
                                        }
                                        
                                        // Keep the closest ground point
                                        if (distance < bestDistance) {
                                            bestDistance = distance;
                                            bestGroundPoint = new THREE.Vector3(
                                                position.x, // Keep same X for smoothness
                                                worldY,     // Use exact Y from noise map
                                                position.z  // Keep same Z for smoothness
                                            );
                                            
                                            if (DEBUG_NOISEMAP) {
                                                console.log(`[NoiseMap] New best ground point at Y=${worldY}, distance=${distance.toFixed(2)}`);
                                            }
                                            
                                            // If very close, stop searching
                                            if (distance < 5) {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Additional logging
    if (DEBUG_NOISEMAP) {
        if (!foundAnyNoiseMaps) {
            console.warn(`[NoiseMap] No noise maps found in any chunks!`);
        } else if (!bestGroundPoint) {
            console.warn(`[NoiseMap] Found noise maps but couldn't detect ground!`);
        } else {
            console.log(`[NoiseMap] Final ground point: (${bestGroundPoint.x.toFixed(2)}, ${bestGroundPoint.y.toFixed(2)}, ${bestGroundPoint.z.toFixed(2)})`);
        }
    }
    
    return bestGroundPoint;
}

/**
 * Extract chunk coordinates from mesh name or userData
 */
function extractChunkCoordinates(mesh: THREE.Mesh): { chunkX: number, chunkY: number, chunkZ: number } | null {
    // Try to get coordinates from userData if available
    if (mesh.userData && 
        typeof mesh.userData.chunkX === 'number' && 
        typeof mesh.userData.chunkY === 'number' && 
        typeof mesh.userData.chunkZ === 'number') {
        
        return {
            chunkX: mesh.userData.chunkX,
            chunkY: mesh.userData.chunkY,
            chunkZ: mesh.userData.chunkZ
        };
    }
    
    // Try to parse from name format like "chunk_X_Y_Z"
    const nameParts = mesh.name.split('_');
    if (nameParts.length >= 4 && nameParts[0] === 'chunk') {
        const x = parseInt(nameParts[1]);
        const y = parseInt(nameParts[2]);
        const z = parseInt(nameParts[3]);
        
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            return { chunkX: x, chunkY: y, chunkZ: z };
        }
    }
    
    return null;
}

/**
 * Check collision between a 3D box and a mesh
 * @param hitbox Player hitbox
 * @param mesh Mesh to check collision with
 */
function checkHitboxMeshCollision(hitbox: THREE.Box3, mesh: THREE.Mesh): CollisionResult {
    // Quick check using bounding boxes
    const meshBounds = new THREE.Box3().setFromObject(mesh);
    if (!hitbox.intersectsBox(meshBounds)) {
        return { collides: false };
    }
    
    // More detailed check using mesh geometry
    if (!mesh.geometry) {
        return { collides: false };
    }
    
    // If it's a buffered geometry, we can test against vertices
    if (mesh.geometry.isBufferGeometry) {
        const positionAttr = mesh.geometry.getAttribute('position');
        
        if (!positionAttr) {
            return { collides: false };
        }
        
        // Store vertex positions in world space
        const vertices: THREE.Vector3[] = [];
        const worldMatrix = mesh.matrixWorld;
        
        // Optimized vertex sampling for better performance
        let stride = 10; // Default stride
        
        if (HITBOX_VERTEX_STRIDE_AUTO) {
            // Auto-adjust stride based on vertex count
            const totalVertices = positionAttr.count;
            if (totalVertices > 20000) stride = 40;
            else if (totalVertices > 10000) stride = 20;
            else if (totalVertices < 1000) stride = 4;
        }
        
        // Sample vertices with stride
        const count = Math.min(positionAttr.count, MAX_CHECKED_VERTICES);
        
        for (let i = 0; i < count; i += stride) {
            const vertexPos = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
            vertexPos.applyMatrix4(worldMatrix); // Convert to world space
            vertices.push(vertexPos);
        }
        
        if (vertices.length === 0) {
            return { collides: false };
        }
        
        // Get hitbox info
        const hitboxBottom = new THREE.Vector3(
            (hitbox.min.x + hitbox.max.x) / 2,
            hitbox.min.y,
            (hitbox.min.z + hitbox.max.z) / 2
        );
        
        // Find vertices BELOW hitbox (for ground)
        let highestBelowY = -Infinity;
        let groundVertex: THREE.Vector3 | null = null;
        
        // First pass: find vertices directly below player's feet
        const directlyBelowVertices: THREE.Vector3[] = [];
        const horizontalTolerance = HITBOX_WIDTH / 2;
        
        for (const vertex of vertices) {
            // Check if vertex is within XZ footprint of hitbox
            if (Math.abs(vertex.x - hitboxBottom.x) <= horizontalTolerance && 
                Math.abs(vertex.z - hitboxBottom.z) <= horizontalTolerance) {
                
                // Check if it's below player but not too far down
                if (vertex.y < hitboxBottom.y && 
                    vertex.y > hitboxBottom.y - DOWN_PROJECTION_DISTANCE) {
                    
                    directlyBelowVertices.push(vertex);
                    
                    // Keep track of highest point
                    if (vertex.y > highestBelowY) {
                        highestBelowY = vertex.y;
                        groundVertex = vertex;
                    }
                }
            }
        }
        
        // Second pass: if no vertices directly below, find in hitbox
        if (!groundVertex) {
            const insideVertices: THREE.Vector3[] = [];
            
            for (const vertex of vertices) {
                if (vertex.x >= hitbox.min.x && vertex.x <= hitbox.max.x &&
                    vertex.y >= hitbox.min.y && vertex.y <= hitbox.max.y &&
                    vertex.z >= hitbox.min.z && vertex.z <= hitbox.max.z) {
                    
                    insideVertices.push(vertex);
                    
                    if (vertex.y > highestBelowY && vertex.y <= hitboxBottom.y + HITBOX_PENETRATION_MAX) {
                        highestBelowY = vertex.y;
                        groundVertex = vertex;
                    }
                }
            }
            
            // Third pass: check for closest XZ distance if still no hits
            if (!groundVertex && vertices.length > 0) {
                let closestDistance = Infinity;
                
                for (const vertex of vertices) {
                    // Only consider vertices below the hitbox max height
                    if (vertex.y <= hitbox.max.y) {
                        // Calculate XZ distance
                        const xzDistance = Math.sqrt(
                            Math.pow(vertex.x - hitboxBottom.x, 2) +
                            Math.pow(vertex.z - hitboxBottom.z, 2)
                        );
                        
                        // Find closest vertex 
                        if (xzDistance < closestDistance) {
                            closestDistance = xzDistance;
                            groundVertex = vertex;
                            highestBelowY = vertex.y;
                        }
                    }
                }
            }
        }
        
        // If we found a ground point
        if (groundVertex) {
            if (HITBOX_DEBUG_VERBOSE) {
                console.log(`[Hitbox] Found ground at ${highestBelowY.toFixed(2)}, checked ${vertices.length} vertices with stride ${stride}`);
            }
            
            return {
                collides: true,
                groundHeight: highestBelowY,
                normal: new THREE.Vector3(0, 1, 0)
            };
        }
    }
    
    // No collision detected
    return { collides: false };
}

// TODO: Define shared types like ChunkMeshesRef, AddDebugRayFn, SetDebugMaterialFn
// <<< DELETE duplicate example placeholders >>>
/*
// Example placeholders:
export type ChunkMeshesRef = { [key: string]: THREE.Mesh | null };
export type AddDebugRayFn = (start: THREE.Vector3, end: THREE.Vector3, color: number) => void;
export type SetDebugMaterialFn = (mesh: THREE.Mesh) => void; // Adjust map type if needed 
*/