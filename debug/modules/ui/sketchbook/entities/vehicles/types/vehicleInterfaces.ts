import * as THREE from 'three';
import * as CANNON from 'cannon';
import { PhysicsManager } from '../../../core/physics/physicsManager';
import { VehicleType } from '../../../types/sketchbookEnums';
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

export interface VehicleConfig {
    modelPath?: string;
    position?: THREE.Vector3;
    rotation?: number;
    onProgress?: (event: ProgressEvent) => void;
    physics?: {
        mass?: number;
        friction?: number;
        restitution?: number;
        linearDamping?: number;
        angularDamping?: number;
        collisionResponse?: boolean;
        collisionFilterGroup?: number;
        collisionFilterMask?: number;
    };
}

export interface VehiclePhysics {
    body: CANNON.Body;
    velocity: THREE.Vector3;
    acceleration: THREE.Vector3;
    force: THREE.Vector3;
    mass: number;
    friction: number;
    restitution: number;
    linearDamping: number;
    angularDamping: number;
    collisionResponse: boolean;
    collisionFilterGroup: number;
    collisionFilterMask: number;
}

export interface Vehicle {
    id?: string;
    model: THREE.Group;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    velocity: THREE.Vector3;
    angularVelocity: THREE.Vector3;
    mass: number;
    friction: number;
    restitution: number;
    wheels?: any[];
    physics?: VehiclePhysics;
    update(deltaTime: number): void;
    applyForce(force: THREE.Vector3): void;
    applyTorque(torque: THREE.Vector3): void;
    setPosition(position: THREE.Vector3): void;
    setRotation(rotation: THREE.Euler): void;
    setVelocity(velocity: THREE.Vector3): void;
    setAngularVelocity(angularVelocity: THREE.Vector3): void;
    initializePhysics(physicsManager: PhysicsManager): void;
    removePhysics(physicsManager: PhysicsManager): void;
} 