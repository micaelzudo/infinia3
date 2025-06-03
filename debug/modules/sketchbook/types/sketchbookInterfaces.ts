/**
 * Sketchbook Interfaces Bridge
 * 
 * This file provides TypeScript interfaces for Sketchbook's components,
 * allowing us to safely interact with Sketchbook's classes while keeping
 * our code loosely coupled and type-safe.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';
import type { CharacterBase, EnhancedCharacter } from '../entities/characters/core/characterTypes';
import { Vehicle } from '../entities/vehicles/sketchbookVehicles';
import { PhysicsManager } from '../core/physics/physicsManager';

// Import Sketchbook interfaces/types we need to reference
import { World } from '../../Sketchbook-master/src/ts/world/World';
import { CharacterSpawnPoint } from '../../Sketchbook-master/src/ts/world/CharacterSpawnPoint';
import { InputManager } from '../../Sketchbook-master/src/ts/core/InputManager';

/**
 * Interface for third-person character state 
 */
export interface ICharacterState {
    position: THREE.Vector3;
    rotation: THREE.Quaternion;
    velocity: THREE.Vector3;
    physicsVelocity: CANNON.Vec3;
    worldPosition: THREE.Vector3;
    actions: {
        [key: string]: boolean | number;
    };
    id?: string; // Add optional id property
    // Add other state properties as needed
}

/**
 * Interface for character control parameters
 */
export interface ICharacterParams {
    height: number;
    radius: number;
    mass: number;
    modelOffset: THREE.Vector3;
    walkSpeed: number;
    runSpeed: number;
    jumpHeight: number;
    lookSensitivity: number;
    // Add other parameters as needed
}

/**
 * Interface for anything that can provide character parameters
 */
export interface ICharacterProvider {
    getCharacterParams(): ICharacterParams;
    getCharacterState(): ICharacterState;
}

/**
 * Interface for physics world adapter used by characters
 */
export interface IPhysicsWorld {
    addBody(body: CANNON.Body): void;
    removeBody(body: CANNON.Body): void;
    step(dt: number): void;
}

/**
 * Interface for a basic world that can contain a character
 */
export interface IWorld {
    physicsWorld: IPhysicsWorld;
    graphicsWorld: THREE.Scene;
    camera: THREE.Camera;
    characters: CharacterBase[];

    update(timestep: number, unscaledTimeStep: number): void;
    registerUpdatable(registerable: any): void;
    unregisterUpdatable(registerable: any): void;
}

/**
 * Interface for input manager
 */
export interface InputManager {
    keyboard: { [key: string]: boolean };
    mouse: { position: THREE.Vector2; buttons: { [button: number]: boolean } };
}

/**
 * Interface for updatable objects
 */
export interface Updatable {
    update?(timestep: number, unscaledTimeStep: number): void;
}

/**
 * Bridge class that adapts our terrain world to work with Sketchbook
 * This allows Sketchbook components to interact with our world
 * without creating a direct dependency
 */
export class SketchbookWorldAdapter {
    physicsWorld: IPhysicsWorld;
    graphicsWorld: THREE.Scene;
    camera: THREE.Camera;
    inputManager: InputManager;
    characters: EnhancedCharacter[] = [];
    vehicles: any[] = [];
    updatables: Updatable[] = [];
    physicsManager: PhysicsManager;

    constructor(params: {
        physicsWorld: IPhysicsWorld;
        graphicsWorld: THREE.Scene;
        camera: THREE.Camera;
        inputManager: InputManager;
        physicsManager: PhysicsManager;
    }) {
        this.physicsWorld = params.physicsWorld;
        this.graphicsWorld = params.graphicsWorld;
        this.camera = params.camera;
        this.inputManager = params.inputManager;
        this.physicsManager = params.physicsManager;
    }

    addCharacter(character: EnhancedCharacter): void {
        this.characters.push(character);
        this.updatables.push(character);
        
        // Add model to scene if it exists
        if (character.modelContainer) {
            this.graphicsWorld.add(character.modelContainer);
        }
        
        // Add physics body if it exists
        if (character.physics?.body) {
            this.physicsManager.initializeCharacterPhysics(character);
        }
    }

    removeCharacter(character: EnhancedCharacter): void {
        const index = this.characters.indexOf(character);
        if (index !== -1) {
            this.characters.splice(index, 1);
            const updatableIndex = this.updatables.indexOf(character);
            if (updatableIndex !== -1) {
                this.updatables.splice(updatableIndex, 1);
            }
            
            // Remove model from scene if it exists
            if (character.modelContainer) {
                this.graphicsWorld.remove(character.modelContainer);
            }
            
            // Remove physics body if it exists
            if (character.physics?.body) {
                this.physicsManager.removeBody(character.id || 'character');
            }
        }
    }

    addVehicle(vehicle: any): void {
        this.vehicles.push(vehicle);
        this.updatables.push(vehicle);
        
        // Add model to scene if it exists
        if (vehicle.modelContainer) {
            this.graphicsWorld.add(vehicle.modelContainer);
        }
        
        // Add physics body if it exists
        if (vehicle.physics?.body) {
            this.physicsManager.initializeVehiclePhysics(vehicle);
        }
    }

    removeVehicle(vehicle: any): void {
        const index = this.vehicles.indexOf(vehicle);
        if (index !== -1) {
            this.vehicles.splice(index, 1);
            const updatableIndex = this.updatables.indexOf(vehicle);
            if (updatableIndex !== -1) {
                this.updatables.splice(updatableIndex, 1);
            }
            
            // Remove model from scene if it exists
            if (vehicle.modelContainer) {
                this.graphicsWorld.remove(vehicle.modelContainer);
            }
            
            // Remove physics body if it exists
            if (vehicle.physics?.body) {
                this.physicsManager.removeBody(vehicle.id || 'vehicle');
            }
        }
    }

    /**
     * Update all registered updatable objects
     * Called from the main animation loop
     */
    update(timestep: number, unscaledTimeStep: number = timestep): void {
        // Update physics
        this.physicsManager.update(timestep);
        
        // Update all registered objects
        this.updatables.forEach(obj => {
            if (obj.update) {
                obj.update(timestep, unscaledTimeStep);
            }
        });
    }

    /**
     * Add shorthand that matches Sketchbook's World.add() function
     * This is used by Character to add itself to the world
     */
    add(object: any): void {
        if ('physics' in object && object.physics?.body instanceof CANNON.Body) {
            if ('wheels' in object) {
                this.addVehicle(object);
            } else {
                this.addCharacter(object as EnhancedCharacter);
            }
        } else if (object.isObject3D) {
            this.graphicsWorld.add(object);
        } else if (object.body && object.body instanceof CANNON.Body) {
            this.physicsWorld.addBody(object.body);
        } else {
            console.warn('[SketchbookWorldAdapter] Unknown object type in add():', object);
        }
    }

    /**
     * Register an object for updates
     */
    registerUpdatable(updatable: Updatable): void {
        if (!this.updatables.includes(updatable)) {
            this.updatables.push(updatable);
        }
    }

    /**
     * Unregister an object from updates
     */
    unregisterUpdatable(updatable: Updatable): void {
        const index = this.updatables.indexOf(updatable);
        if (index !== -1) {
            this.updatables.splice(index, 1);
        }
    }
}

/**
 * Interface for collidable objects
 */
export interface ICollidable {
    body: CANNON.Body;
    mesh: THREE.Mesh;
}

/**
 * Interface for terrain chunks
 */
export interface ITerrainChunk extends ICollidable {
    position: THREE.Vector3;
    chunkId: string;
    isLoaded: boolean;
}

/**
 * Interface for interactive objects
 */
export interface IInteractive extends ICollidable {
    interact(): void;
    canInteract: boolean;
    name: string;
} 