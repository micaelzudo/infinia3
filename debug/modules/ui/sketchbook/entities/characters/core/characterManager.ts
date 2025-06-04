/**
 * Character Manager
 * 
 * This file manages character state, physics, and input handling.
 */

// External libraries
import * as THREE from 'three';

// Types
import type { EnhancedCharacter } from './characterTypes';

// Core components
import { PhysicsManager } from '../../../core/physics/physicsManager';
import { InputManager, InputState } from '../../../core/input/inputTypes';

// Character components
import { initializeCharacterPhysics, updateCharacterPhysics } from './characterPhysics';
import { createCharacterStates } from '../states/sketchbookStates';

// Enums
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

interface VehicleObject extends THREE.Object3D {
    userData: {
        type: string;
        vehicle: any;
    };
}

export class CharacterManager {
    private character: EnhancedCharacter;
    private physicsManager: PhysicsManager;
    private inputManager: InputManager;
    private states: Record<string, any>;
    private worldObjects: THREE.Object3D[];

    constructor(
        character: EnhancedCharacter,
        physicsManager: PhysicsManager,
        inputManager: InputManager,
        worldObjects: THREE.Object3D[]
    ) {
        this.character = character;
        this.physicsManager = physicsManager;
        this.inputManager = inputManager;
        this.worldObjects = worldObjects;

        // Initialize character physics
        this.physicsManager.initializeCharacterPhysics(this.character);

        // Create character states
        this.states = createCharacterStates(this.character);
    }

    public update(deltaTime: number): void {
        // Update character physics
        if (this.character.updatePhysics) {
            this.character.updatePhysics(deltaTime);
        }

        // Update current state
        const currentState = this.character.states?.current;
        if (typeof currentState === 'string' && this.states[currentState]) {
            this.states[currentState].update(deltaTime);
        }

        // Handle input
        this.handleInput();
    }

    private handleInput(): void {
        // Get input state
        const input = this.inputManager.getInputState();

        // Handle movement input
        if (input.moveForward || input.moveBackward || input.moveLeft || input.moveRight) {
            const moveDirection = new THREE.Vector3();
            
            if (input.moveForward) moveDirection.z -= 1;
            if (input.moveBackward) moveDirection.z += 1;
            if (input.moveLeft) moveDirection.x -= 1;
            if (input.moveRight) moveDirection.x += 1;

            moveDirection.normalize();

            // Apply movement force based on state
            const force = input.sprint ? 
                PHYSICS_CONSTANTS.CHARACTER.SPRINT_FORCE : 
                PHYSICS_CONSTANTS.CHARACTER.MOVE_FORCE;
            
            this.character.applyForce(moveDirection.multiplyScalar(force));
        }

        // Handle jump input
        if (input.jump && this.character.isGrounded()) {
            this.character.jump?.();
        }

        // Handle vehicle interaction
        if (input.interact && this.character.canEnterVehicle) {
            this.handleVehicleInteraction();
        }
    }

    private handleVehicleInteraction(): void {
        if (this.character.isInVehicle) {
            this.character.exitVehicle?.();
        } else if (this.character.currentVehicle) {
            this.character.enterVehicle?.(this.character.currentVehicle);
        }
    }
}