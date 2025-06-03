/**
 * Sketchbook Enums and Constants
 * 
 * This file provides a single source of truth for all enums and constants.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';

/**
 * Physics Constants
 */
export const PHYSICS_CONSTANTS = {
    // General Physics
    GRAVITY: new THREE.Vector3(0, -9.81, 0),
    MAX_VELOCITY: 10,
    MASS: 5,
    FRICTION: 0.3,
    RESTITUTION: 0.2,
    LINEAR_DAMPING: 0.1,
    ANGULAR_DAMPING: 0.1,

    // Character Physics
    CHARACTER: {
        MOVE_FORCE: 100,
        SPRINT_FORCE: 150,
        JUMP_FORCE: 5,
        AIR_CONTROL: 0.3,
        GROUND_FRICTION: 0.3,
        AIR_FRICTION: 0.1,
        MASS: 5,
        HEIGHT: 1.8,
        RADIUS: 0.3,
        STEP_HEIGHT: 0.3,
        MAX_SLOPE: Math.PI / 4,
        RAYCAST_OFFSET: 0.1,
        RAYCAST_LENGTH: 0.5,
        RAYCAST_COUNT: 4,
        RAYCAST_SPREAD: 0.2
    },

    // Vehicle Physics
    VEHICLE: {
        MASS: 1500,
        FRICTION: 0.3,
        RESTITUTION: 0.2,
        LINEAR_DAMPING: 0.1,
        ANGULAR_DAMPING: 0.1,
        CHASSIS_WIDTH: 2,
        CHASSIS_HEIGHT: 1.5,
        CHASSIS_LENGTH: 4,
        AXIS_INDICES: {
            FRONT: 0,
            REAR: 1
        },
        WHEEL_POSITIONS: [
            new THREE.Vector3(-1, 0, 2),  // Front left
            new THREE.Vector3(1, 0, 2),   // Front right
            new THREE.Vector3(-1, 0, -2), // Rear left
            new THREE.Vector3(1, 0, -2)   // Rear right
        ],
        WHEEL_OPTIONS: {
            radius: 0.4,
            directionLocal: new THREE.Vector3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.4,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new THREE.Vector3(1, 0, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        }
    },

    // Collision Groups
    COLLISION_GROUPS: {
        NONE: 0,
        CHARACTER: 1,
        VEHICLE: 2,
        TERRAIN: 4,
        OBJECT: 8,
        TRIGGER: 16
    },

    // Collision Masks
    COLLISION_MASKS: {
        NONE: 0,
        CHARACTER: -1,  // Collide with everything
        VEHICLE: -1,    // Collide with everything
        TERRAIN: -1,    // Collide with everything
        OBJECT: -1,     // Collide with everything
        TRIGGER: 1 | 2  // Only collide with characters and vehicles
    }
};

/**
 * Vehicle Types
 */
export enum VehicleType {
    CAR = 'car',
    MOTORCYCLE = 'motorcycle',
    BOAT = 'boat',
    AIRCRAFT = 'aircraft'
}

/**
 * Vehicle Seat Types
 */
export enum VehicleSeatType {
    DRIVER = 'driver',
    PASSENGER = 'passenger'
} 