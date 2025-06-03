/**
 * Character Types
 * 
 * This file defines the types and interfaces used for character management.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

// Ground impact data interface
export interface GroundImpactData {
    velocity: THREE.Vector3;
    contactPoint: THREE.Vector3;
    contactNormal: THREE.Vector3;
}

// Spring simulator interface
export interface RelativeSpringSimulator {
    position: number;
    velocity: number;
    target: number;
    damping: number;
    mass: number;
    stiffness: number;
    update(deltaTime: number): void;
}

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
}

// Base character interface
export interface CharacterBase {
    // Core properties
    position: THREE.Vector3;
    rotation: THREE.Euler;
    velocity: THREE.Vector3;
    state: string;
    animation: string;
    modelContainer: THREE.Group;
    
    // State management
    setState: (state: string) => void;
    setAnimation: (name: string, fadeIn: number) => void;
    states: {
        current: string;
        previous: string | null;
        timeInState: number;
    };
    
    // Physics properties
    physics?: CharacterPhysics;
    
    // Ground check properties
    groundCheck: {
        raycastHitObject?: THREE.Object3D;
        raycastHitMethods: {
            raycast: (origin: THREE.Vector3, direction: THREE.Vector3, length: number) => boolean;
            getHitPoint: () => THREE.Vector3;
            getHitNormal: () => THREE.Vector3;
            getHitDistance: () => number;
        };
    };

    isGrounded(): boolean;
    jump?(): void;
    applyForce(force: THREE.Vector3): void;
}

// Enhanced character interface with additional functionality
export interface EnhancedCharacter extends CharacterBase {
    // Movement properties
    moveSpeed: number;
    sprintSpeed: number;
    jumpForce: number;
    airControl: number;
    
    // Physics methods
    updatePhysics: (deltaTime: number) => void;
    applyForce: (force: THREE.Vector3) => void;
    applyImpulse: (impulse: THREE.Vector3) => void;
    
    // Ground check methods
    getGroundNormal: () => THREE.Vector3;
    
    // Vehicle interaction
    currentVehicle?: any;
    isInVehicle: boolean;
    canEnterVehicle: boolean;
    
    // Animation methods
    playAnimation: (name: string, fadeIn: number) => void;
    stopAnimation: (name: string) => void;
    
    // State methods
    getCurrentState: () => string;
    getPreviousState: () => string | null;
    getTimeInState: () => number;
    
    // Additional properties
    id?: string;
    updateOrder?: number;
    entityType?: string;
    height?: number;
    viewVector?: THREE.Vector3;
    orientation?: THREE.Vector3;
    orientationTarget?: THREE.Vector3;
    groundImpactData?: GroundImpactData;
    
    // Physics and raycasting properties
    coyoteTimeActive?: boolean;
    coyoteTimeDuration?: number;
    coyoteTimeElapsed?: number;
    multiRaycastEnabled?: boolean;
    groundRaycaster?: THREE.Raycaster;
    groundRayDirection?: THREE.Vector3;
    raySafetyMargin?: number;
    
    // Additional methods
    setPhysicsEnabled?: (enabled: boolean) => void;
    takeControl?: () => void;
    setOrientation?: (direction: THREE.Vector3) => void;
    isOnGround?: () => boolean;
    setArcadeVelocityTarget?: (speed: number) => void;
    jump?: () => void;
    update?: (deltaTime: number) => void;
    handleInput(input: any): void;
    handleCollision(collision: any): void;
    handleTrigger(trigger: any): void;
    enterVehicle?(vehicle: any): void;
    exitVehicle?(): void;
} 