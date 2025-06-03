/**
 * Sketchbook Utilities
 * 
 * This file contains utility functions and classes used by the Sketchbook character controller.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import core components from our modularized Sketchbook bridge
import {
    Character,
    CameraOperator,
    InputManager,
    IWorldEntity,
    IUpdatable,
    KeyBinding,
    CharacterStateBase,
    CollisionGroups,
    ICharacterState,
    TrimeshCollider,
    GroundImpactData,
    EntityType,
    CharacterStates,
    physicsMaterials,
    contactMaterials
} from '../../../debug/modules/ui/sketchbookCore';

/**
 * Creates a physics world with default settings
 */
export function createPhysicsWorld(): CANNON.World {
    const world = new CANNON.World();
    
    // Configure world
    world.gravity.set(0, -20, 0);
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 10;
    world.allowSleep = true;
    
    // Add default materials
    Object.values(physicsMaterials).forEach(mat => {
        world.addMaterial(mat);
    });
    
    // Add contact materials
    Object.values(contactMaterials).forEach(cm => {
        world.addContactMaterial(cm);
    });
    
    return world;
}

/**
 * Updates the physics world with a fixed timestep
 */
export function updatePhysicsWorld(world: CANNON.World, fixedTimeStep: number, maxSubSteps: number = 3): void {
    world.step(fixedTimeStep, undefined, maxSubSteps);
}

/**
 * Updates all updatable entities
 */
export function updateUpdatables(updatables: IUpdatable[], deltaTime: number): void {
    for (const updatable of updatables) {
        if (updatable.update) {
            updatable.update(deltaTime);
        }
    }
}

/**
 * Creates a camera operator for third-person camera control
 */
export function createCameraOperator(world: IWorldEntity, camera: THREE.PerspectiveCamera): CameraOperator {
    const cameraOperator = new CameraOperator(camera);
    
    // Default camera settings
    cameraOperator.movementSpeed = 1.0;
    cameraOperator.controlsEnabled = true;
    cameraOperator.followMode = true;
    cameraOperator.setRadius(3);
    cameraOperator.setPolarAngle(30 * Math.PI / 180);
    
    // Add to world if it's a world entity
    if ((world as any).add) {
        (world as any).add(cameraOperator);
    }
    
    return cameraOperator;
}

/**
 * Creates an input manager for handling user input
 */
export function createInputManager(world: IWorldEntity, domElement: HTMLElement): InputManager {
    const inputManager = new InputManager(domElement);
    
    // Configure default key bindings
    inputManager.setKeyBinding(KeyBinding.Up, ['w', 'W', 'ArrowUp']);
    inputManager.setKeyBinding(KeyBinding.Down, ['s', 'S', 'ArrowDown']);
    inputManager.setKeyBinding(KeyBinding.Left, ['a', 'A', 'ArrowLeft']);
    inputManager.setKeyBinding(KeyBinding.Right, ['d', 'D', 'ArrowRight']);
    inputManager.setKeyBinding(KeyBinding.Jump, [' ']);
    inputManager.setKeyBinding(KeyBinding.Sprint, ['Shift']);
    inputManager.setKeyBinding(KeyBinding.Action1, ['Mouse0']);
    inputManager.setKeyBinding(KeyBinding.Action2, ['Mouse2']);
    inputManager.setKeyBinding(KeyBinding.Action3, ['Mouse1']);
    inputManager.setKeyBinding(KeyBinding.Action4, ['e', 'E']);
    inputManager.setKeyBinding(KeyBinding.Action5, ['q', 'Q']);
    
    // Add to world if it's a world entity
    if ((world as any).add) {
        (world as any).add(inputManager);
    }
    
    return inputManager;
}

/**
 * Configures character physics with default settings
 */
export function configureCharacterPhysics(character: Character): void {
    // Set up collision filters
    character.collisionMask = CollisionGroups.Default | CollisionGroups.Ground;
    character.collisionFilterGroup = CollisionGroups.Character;
    
    // Configure physics body
    character.characterCapsule.body.mass = 5;
    character.characterCapsule.body.linearDamping = 0.0;
    character.characterCapsule.body.updateMassProperties();
    
    // Configure character settings
    character.arcadeVelocityIsAdditive = false;
    character.mass = 5;
    character.friction = 0.0;
    character.gravity = new CANNON.Vec3(0, -20, 0);
    
    // Set up ground detection
    character.groundImpactData = new GroundImpactData();
    character.groundImpactData.velocity.y = -1;
    
    // Enable physics
    character.physicsEnabled = true;
}

/**
 * Helper function to load a GLTF model
 */
export async function loadGLTF(url: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            url,
            (gltf) => resolve(gltf),
            undefined,
            (error) => reject(error)
        );
    });
}

/**
 * Creates a debug visualization for physics bodies
 */
export function createPhysicsDebugger(world: CANNON.World, scene: THREE.Scene): any {
    // Implementation would use a library like cannon-es-debugger
    // This is a placeholder for the actual implementation
    return {
        update: () => {
            // Update debug visualization
        },
        dispose: () => {
            // Clean up
        }
    };
}

/**
 * Disposes of resources used by the physics debugger
 */
export function disposePhysicsDebugger(debuggerInstance: any): void {
    if (debuggerInstance && typeof debuggerInstance.dispose === 'function') {
        debuggerInstance.dispose();
    }
}

// Export all types for convenience
export * from '../../../debug/modules/ui/sketchbookCore';
