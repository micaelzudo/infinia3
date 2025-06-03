import * as THREE from 'three';
import { getChunkKeyY } from '../../../utils_debug'; // Adjust path as needed
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../constants_debug';
// import { setDebugMaterial } from '../firstPersonDebug'; // Assuming debug functions will move here

// Player dimensions and physics constants (matching Sketchbook values more closely)
export const playerHeight = 1.8; // Player height
export const playerRadius = 0.4; // Conceptual radius for collision checks
export const sprintMultiplier = 2.0; // Speed multiplier when sprinting (Sketchbook uses 1.75-2.0)

// Movement constants (tuned to be more Sketchbook-like)
export const MOVE_SPEED = 2.0; // Base movement speed (Sketchbook uses 4, but we need to scale it)
export const JUMP_VELOCITY = 5.0; // Initial velocity when jumping (Sketchbook's default)
export const MAX_Y_VELOCITY = 20.0; // Max downward velocity (absolute)
export const GRAVITY = 9.8; // Per-second gravity adjustment

// Smooth movement parameters (Sketchbook-inspired)
export const DEFAULT_VELOCITY_DAMPING = 0.8; // From Sketchbook Character.ts
export const DEFAULT_VELOCITY_MASS = 50; // From Sketchbook Character.ts
export const DEFAULT_ROTATION_DAMPING = 0.5; // From Sketchbook Character.ts
export const DEFAULT_ROTATION_MASS = 10; // From Sketchbook Character.ts
export const WALK_VELOCITY_TARGET = 0.8; // From Sketchbook's Walk state
export const SPRINT_VELOCITY_TARGET = 1.4; // From Sketchbook's Sprint state

// Ground detection constants
export const GROUND_RAY_LENGTH = playerHeight * 1.5; // Raycasting distance for ground detection
export const RAYCAST_SAFE_OFFSET = 0.03; // Safe distance offset for ground raycasts (from Sketchbook)

// Raycast detection constants
export const COLLISION_CHUNK_RADIUS = 2; // Check nearby chunks for collision

// --- Raycasters ---
// Ground raycaster for terrain detection
export const groundRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), // Origin updated in loop
    new THREE.Vector3(0, -1, 0), // Direction downward
    0, // Near plane
    GROUND_RAY_LENGTH // Use proper ground ray length
);

// Horizontal raycasters for wall collision detection
export const frontRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(1, 0, 0),
    0,
    playerRadius + 0.2 // Slightly longer than player radius
);

export const backRaycaster = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(-1, 0, 0),
    0,
    playerRadius + 0.2
);

export const leftRaycaster = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, 1),
    0,
    playerRadius + 0.2
);

export const rightRaycaster = new THREE.Raycaster(
    new THREE.Vector3(),
    new THREE.Vector3(0, 0, -1),
    0,
    playerRadius + 0.2
);

// Helper class for ground impact data (matches Sketchbook)
export class GroundImpactData {
    velocity: THREE.Vector3 = new THREE.Vector3();
}

// Vector spring implementation (Sketchbook-inspired)
export class SimulationFrame {
    constructor(
        public position: number,
        public velocity: number
    ) {}
}

// Spring functions for smooth movement (from Sketchbook's FunctionLibrary)
export function spring(source: number, dest: number, velocity: number, mass: number, damping: number): SimulationFrame {
    let acceleration = dest - source;
    acceleration /= mass;
    velocity += acceleration;
    velocity *= damping;

    let position = source + velocity;

    return new SimulationFrame(position, velocity);
}

export function springVector(source: THREE.Vector3, dest: THREE.Vector3, velocity: THREE.Vector3, mass: number, damping: number): void {
    let acceleration = new THREE.Vector3().subVectors(dest, source);
    acceleration.divideScalar(mass);
    velocity.add(acceleration);
    velocity.multiplyScalar(damping);
    source.add(velocity);
}

// Get angle between vectors (important for smooth rotation - from Sketchbook)
export function getSignedAngleBetweenVectors(v1: THREE.Vector3, v2: THREE.Vector3): number {
    // Project vectors to XZ plane
    const v1xz = new THREE.Vector3(v1.x, 0, v1.z).normalize();
    const v2xz = new THREE.Vector3(v2.x, 0, v2.z).normalize();
    
    // Calculate the angle
    let angle = Math.acos(Math.min(1, v1xz.dot(v2xz)));
    
    // Calculate the sign
    const cross = new THREE.Vector3().crossVectors(v1xz, v2xz);
    if (cross.y < 0) {
        angle = -angle;
    }
    
    return angle;
}

// --- Safety Floor State & Logic ---
// <<< DELETE ENTIRE SAFETY FLOOR COMMENT BLOCK >>>

// --- ADD BACK Collision Logic Helpers ---
// <<< DELETE ENTIRE ROBUST HELPERS COMMENT BLOCK >>>

// <<< Potentially add back reference single-mesh check if needed, or do inline >>>
/*
const checkIntersectsSingleMesh = (
    raycaster: THREE.Raycaster,
    mesh: THREE.Mesh | null,
    distance: number
): boolean => {
    if (!mesh) return false;
    raycaster.far = distance;
    const intersects = raycaster.intersectObject(mesh, false); 
    return intersects.length > 0 && intersects[0].distance <= distance;
};
*/

/*
export const checkIntersectsAgainstList = (...) => { ... };
*/
// --- END REMOVAL --- 