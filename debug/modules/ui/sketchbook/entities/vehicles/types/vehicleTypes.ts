import * as THREE from 'three';
import { Vehicle, VehicleConfig, VehiclePhysics } from './vehicleInterfaces';
import { PhysicsManager } from '../../../core/physics/physicsManager';
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

export class BaseVehicle implements Vehicle {
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

    constructor(model: THREE.Group, config: VehicleConfig) {
        this.model = model;
        this.position = config.position || new THREE.Vector3();
        this.rotation = new THREE.Euler(0, config.rotation || 0, 0);
        this.velocity = new THREE.Vector3();
        this.angularVelocity = new THREE.Vector3();
        this.mass = config.physics?.mass || PHYSICS_CONSTANTS.VEHICLE.MASS;
        this.friction = config.physics?.friction || PHYSICS_CONSTANTS.VEHICLE.FRICTION;
        this.restitution = config.physics?.restitution || PHYSICS_CONSTANTS.VEHICLE.RESTITUTION;
    }

    update(deltaTime: number): void {
        if (this.physics?.body) {
            // Update position and rotation from physics
            this.position.copy(this.physics.body.position as any);
            this.rotation.copy(this.physics.body.quaternion as any);
            
            // Update model transform
            this.model.position.copy(this.position);
            this.model.rotation.copy(this.rotation);
            
            // Update velocity
            this.velocity.copy(this.physics.body.velocity as any);
            this.angularVelocity.copy(this.physics.body.angularVelocity as any);
        }
    }

    applyForce(force: THREE.Vector3): void {
        if (this.physics?.body) {
            this.physics.body.applyForce(force as any, this.physics.body.position);
        }
    }

    applyTorque(torque: THREE.Vector3): void {
        if (this.physics?.body) {
            this.physics.body.applyTorque(torque as any);
        }
    }

    setPosition(position: THREE.Vector3): void {
        this.position.copy(position);
        this.model.position.copy(position);
        if (this.physics?.body) {
            this.physics.body.position.copy(position as any);
        }
    }

    setRotation(rotation: THREE.Euler): void {
        this.rotation.copy(rotation);
        this.model.rotation.copy(rotation);
        if (this.physics?.body) {
            this.physics.body.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        }
    }

    setVelocity(velocity: THREE.Vector3): void {
        this.velocity.copy(velocity);
        if (this.physics?.body) {
            this.physics.body.velocity.copy(velocity as any);
        }
    }

    setAngularVelocity(angularVelocity: THREE.Vector3): void {
        this.angularVelocity.copy(angularVelocity);
        if (this.physics?.body) {
            this.physics.body.angularVelocity.copy(angularVelocity as any);
        }
    }

    initializePhysics(physicsManager: PhysicsManager): void {
        // Base physics initialization is handled by configureVehiclePhysics
    }

    removePhysics(physicsManager: PhysicsManager): void {
        if (this.physics?.body) {
            physicsManager.getWorld().removeBody(this.physics.body);
            this.physics = undefined;
        }
    }
}

export class Car extends BaseVehicle {
    constructor(model: THREE.Group, config: VehicleConfig) {
        super(model, config);
        this.wheels = [];
    }

    update(deltaTime: number): void {
        super.update(deltaTime);
        // Car-specific update logic (handling, suspension, etc.)
    }
}

export class Motorcycle extends BaseVehicle {
    constructor(model: THREE.Group, config: VehicleConfig) {
        super(model, config);
        this.wheels = [];
    }

    update(deltaTime: number): void {
        super.update(deltaTime);
        // Motorcycle-specific update logic (leaning, balance, etc.)
    }
}

export class Boat extends BaseVehicle {
    constructor(model: THREE.Group, config: VehicleConfig) {
        super(model, config);
    }

    update(deltaTime: number): void {
        super.update(deltaTime);
        // Boat-specific update logic (buoyancy, water resistance, etc.)
    }
}

export class Aircraft extends BaseVehicle {
    constructor(model: THREE.Group, config: VehicleConfig) {
        super(model, config);
    }

    update(deltaTime: number): void {
        super.update(deltaTime);
        // Aircraft-specific update logic (lift, drag, etc.)
    }
} 