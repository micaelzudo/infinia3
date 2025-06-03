/**
 * Character Physics
 * 
 * This file provides physics functionality for characters using Sketchbook's physics system.
 */

// External libraries
import * as THREE from 'three';
import * as CANNON from 'cannon';

// Types
import type { EnhancedCharacter } from './characterTypes';

// Core components
import { PhysicsManager } from '../../../core/physics/physicsManager';

// Enums
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

// CharacterPhysics interface matching modules version
export interface CharacterPhysics {
    body: CANNON.Body;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    force: THREE.Vector3;
    mass: number;
    friction: number;
    restitution: number;
    linearDamping: number;
    angularDamping: number;
    gravity: THREE.Vector3;
    collisionResponse: boolean;
    collisionFilterGroup: number;
    collisionFilterMask: number;
    raycast: {
        hasHit: boolean;
        hitPoint: THREE.Vector3;
        hitNormal: THREE.Vector3;
        hitDistance: number;
    };
    multiRaycast?: {
        points: THREE.Vector3[];
        results: Array<{
            hasHit: boolean;
            hitPoint: THREE.Vector3;
            hitNormal: THREE.Vector3;
            hitDistance: number;
        }>;
    };
    groundCheckRay?: THREE.Raycaster;
    isGrounded: boolean;
    groundNormal: THREE.Vector3;
    slopeAngle: number;
    stepHeight: number;
    stepCheckDistance: number;
    slopeThreshold: number;
    maxSlopeAngle: number;
    stepClimbVelocity: THREE.Vector3;
}

/**
 * Initialize physics for a character using Sketchbook's physics system
 */
export function initializeCharacterPhysics(character: EnhancedCharacter, physicsManager: PhysicsManager): void {
    if (!character || !character.modelContainer) return;

    // Initialize physics using the centralized physics manager
    physicsManager.initializeCharacterPhysics(character);

    // Set up ground check ray using Sketchbook's system
    const groundCheckRay = new THREE.Raycaster();
    groundCheckRay.near = 0;
    groundCheckRay.far = PHYSICS_CONSTANTS.CHARACTER.RAYCAST_LENGTH;

    // Initialize ground check
    initializeGroundCheck(character);

    // Store ray in character for reuse
    if (character.physics) {
        character.physics.groundCheckRay = groundCheckRay;
    }
}

/**
 * Initialize ground check for character
 */
export function initializeGroundCheck(character: EnhancedCharacter): void {
    if (!character.physics) return;

    character.groundCheck = {
        raycastHitObject: undefined,
        raycastHitMethods: {
            raycast: (origin: THREE.Vector3, direction: THREE.Vector3, length: number): boolean => {
                if (!character.physics) return false;
                
                if (!character.physics.groundCheckRay) {
                    character.physics.groundCheckRay = new THREE.Raycaster(origin, direction);
                } else {
                    character.physics.groundCheckRay.set(origin, direction);
                }
                return character.physics.groundCheckRay.intersectObjects(character.modelContainer?.parent?.children || []).length > 0;
            },
            getHitPoint: (): THREE.Vector3 => {
                if (!character.physics?.groundCheckRay) return new THREE.Vector3();
                const intersects = character.physics.groundCheckRay.intersectObjects(character.modelContainer?.parent?.children || []);
                return intersects && intersects.length > 0 ? intersects[0].point : new THREE.Vector3();
            },
            getHitNormal: (): THREE.Vector3 => {
                if (!character.physics?.groundCheckRay) return new THREE.Vector3();
                const intersects = character.physics.groundCheckRay.intersectObjects(character.modelContainer?.parent?.children || []);
                return intersects && intersects.length > 0 ? intersects[0].face?.normal || new THREE.Vector3() : new THREE.Vector3();
            },
            getHitDistance: (): number => {
                if (!character.physics?.groundCheckRay) return 0;
                const intersects = character.physics.groundCheckRay.intersectObjects(character.modelContainer?.parent?.children || []);
                return intersects && intersects.length > 0 ? intersects[0].distance : 0;
            }
        }
    };
}

/**
 * Update character physics using Sketchbook's physics system
 */
export function updateCharacterPhysics(
    character: EnhancedCharacter,
    timeStep: number,
    worldObjects: THREE.Object3D[]
): void {
    if (!character || !character.physics || !character.modelContainer) return;

    // Update velocity with gravity
    character.physics.velocity.add(
        character.physics.acceleration.clone().multiplyScalar(timeStep)
    );

    // Update position
    const velocity = character.physics.velocity.clone().multiplyScalar(timeStep);
    character.modelContainer.position.x += velocity.x;
    character.modelContainer.position.y += velocity.y;
    character.modelContainer.position.z += velocity.z;

    // Check ground contact
    checkGroundContact(character, worldObjects);

    // Apply ground friction when grounded
    if (character.physics.raycast?.hasHit) {
        applyGroundFriction(character, timeStep);
    }
}

/**
 * Check if character is in contact with ground
 */
function checkGroundContact(character: EnhancedCharacter, worldObjects: THREE.Object3D[]): void {
    if (!character || !character.physics || !character.modelContainer) return;

    const rayStart = character.modelContainer.position.clone();
    const rayEnd = rayStart.clone().sub(new THREE.Vector3(0, PHYSICS_CONSTANTS.CHARACTER.RAYCAST_LENGTH, 0));
    const raycaster = new THREE.Raycaster(rayStart, rayEnd.sub(rayStart).normalize());
    const intersects = raycaster.intersectObjects(worldObjects, true);

    if (character.physics.raycast) {
        character.physics.raycast.hasHit = intersects.length > 0;
        if (intersects.length > 0) {
            character.physics.raycast.hitDistance = intersects[0].distance;
            character.physics.raycast.hitPoint.copy(intersects[0].point);
            character.physics.raycast.hitNormal.copy(intersects[0].face!.normal);
        }
    }
}

/**
 * Apply ground friction to character
 */
function applyGroundFriction(character: EnhancedCharacter, timeStep: number): void {
    if (!character || !character.physics || !character.physics.raycast?.hasHit) return;

    const friction = PHYSICS_CONSTANTS.CHARACTER.GROUND_FRICTION;
    const velocity = character.physics.velocity;

    // Apply friction in the horizontal plane
    velocity.x *= (1 - friction * timeStep);
    velocity.z *= (1 - friction * timeStep);
}

/**
 * Apply jump force to character
 */
export function applyJumpForce(character: EnhancedCharacter): void {
    if (!character.physics) return;

    character.physics.velocity.y = PHYSICS_CONSTANTS.CHARACTER.JUMP_FORCE;
}

/**
 * Apply movement force to character
 */
export function applyMovementForce(
    character: EnhancedCharacter,
    direction: THREE.Vector3,
    force: number
): void {
    if (!character.physics) return;

    // Apply force in the given direction
    const forceVector = direction.clone().multiplyScalar(force);
    character.physics.velocity.add(forceVector);
} 