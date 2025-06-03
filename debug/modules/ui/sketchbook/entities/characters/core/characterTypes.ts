/**
 * Character Types
 * 
 * This file defines the types and interfaces used for character management.
 */

// External libraries
import * as THREE from 'three';
import * as CANNON from 'cannon';
import type { InputState } from '../../../core/input/inputTypes';
import type { ICharacterState, CharacterStateInfo } from '../states/characterStates';

// Types and enums
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
    body: any;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    groundCheckRay: THREE.Raycaster;
    isGrounded: boolean;
    groundNormal: THREE.Vector3;
    slopeAngle: number;
    stepHeight: number;
    stepCheckDistance: number;
    slopeThreshold: number;
    maxSlopeAngle: number;
    collisionResponse: THREE.Vector3;
    stepClimbVelocity: THREE.Vector3;
    raycast: {
        hasHit: boolean;
        hitPoint: THREE.Vector3;
        hitNormal: THREE.Vector3;
        hitDistance: number;
    };
}

export interface RaycastResult {
    hit: boolean;
    distance: number;
    normal: { x: number; y: number; z: number };
    point: { x: number; y: number; z: number };
}

export interface CharacterAnimations {
    mixer: THREE.AnimationMixer;
    current: string;
    previous: string;
    actions: { [key: string]: THREE.AnimationAction };
    clips: { [key: string]: THREE.AnimationClip };
}

// Base character interface
export interface CharacterBase {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    model: THREE.Object3D;
    modelContainer: THREE.Group;
    animations: CharacterAnimations;
    physics: CharacterPhysics;
    scene: THREE.Scene;
    groundCheck: {
        raycastHitObject?: THREE.Object3D;
        raycastHitMethods: {
            raycast: (origin: THREE.Vector3, direction: THREE.Vector3, length: number) => boolean;
            getHitPoint: () => THREE.Vector3;
            getHitNormal: () => THREE.Vector3;
            getHitDistance: () => number;
        };
    };
}

// Enhanced character interface with additional functionality
export interface EnhancedCharacter extends CharacterBase {
    states: {
        current: string;
        previous: string;
        timeInState: number;
        instance: any;
        history: Array<{
            state: string;
            timestamp: number;
            duration: number;
        }>;
    };
    setState(state: string): void;
    stateCallbacks?: {
        onStateEnter?: (state: string) => void;
        onStateExit?: (state: string) => void;
        onStateUpdate?: (state: string, timeStep: number) => void;
        onTransitionStart?: (fromState: string, toState: string) => void;
        onTransitionEnd?: (fromState: string, toState: string) => void;
    };
    
    // Movement properties
    moveSpeed: number;
    sprintSpeed: number;
    jumpForce: number;
    gravity: number;
    friction: number;
    airResistance: number;
    maxSlopeAngle: number;
    stepHeight: number;
    stepCheckDistance: number;
    slopeThreshold: number;
    
    // Physics methods
    updatePhysics(deltaTime: number): void;
    applyForce(force: THREE.Vector3): void;
    applyImpulse(impulse: THREE.Vector3): void;
    
    // Ground check methods
    getGroundNormal(): THREE.Vector3;
    
    // Vehicle interaction
    currentVehicle?: any;
    isInVehicle: boolean;
    canEnterVehicle: boolean;
    
    // Animation methods
    playAnimation(name: string, fadeIn: number): void;
    stopAnimation(name: string): void;
    
    // State methods
    getCurrentState(): string;
    getPreviousState(): string | null;
    getTimeInState(): number;
    
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
    setPhysicsEnabled(enabled: boolean): void;
    takeControl(): void;
    setOrientation(direction: THREE.Vector3): void;
    isOnGround(): boolean;
    setArcadeVelocityTarget(speed: number): void;
    update(deltaTime: number): void;
    handleInput(input: InputState): void;
    handleCollision(collision: any): void;
    handleTrigger(trigger: any): void;
    enterVehicle(vehicle: any): void;
    exitVehicle(): void;
}

export interface CharacterState {
    current: string;
    previous: string | null;
    timeInState: number;
    instance?: ICharacterState;
} 