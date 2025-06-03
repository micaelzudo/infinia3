/**
 * Character Initializer
 * 
 * This file handles character initialization and setup.
 */

// External libraries
import * as THREE from 'three';
import * as CANNON from 'cannon';

// Types
import type { EnhancedCharacter } from './characterTypes';

// Core components
import { PhysicsManager } from '../../../core/physics/physicsManager';

// Character components
import { initializeCharacterPhysics } from './characterPhysics';

// Enums
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

export class CharacterInitializer {
    private character: EnhancedCharacter;
    private physicsManager: PhysicsManager;

    constructor(character: EnhancedCharacter, physicsManager: PhysicsManager) {
        this.character = character;
        this.physicsManager = physicsManager;
    }

    public initialize(): void {
        // Initialize core properties
        this.initializeCoreProperties();

        // Initialize physics
        this.initializePhysics();

        // Initialize model
        this.initializeModel();
    }

    private initializeCoreProperties(): void {
        // Set initial position and rotation
        this.character.position = new THREE.Vector3(0, 0, 0);
        this.character.rotation = new THREE.Euler(0, 0, 0);
        this.character.velocity = new THREE.Vector3(0, 0, 0);

        // Set movement properties
        this.character.moveSpeed = PHYSICS_CONSTANTS.CHARACTER.MOVE_FORCE;
        this.character.sprintSpeed = PHYSICS_CONSTANTS.CHARACTER.SPRINT_FORCE;
        this.character.jumpForce = PHYSICS_CONSTANTS.CHARACTER.JUMP_FORCE;
        this.character.airControl = PHYSICS_CONSTANTS.CHARACTER.AIR_CONTROL;

        // Set initial state
        this.character.state = 'idle';
        this.character.animation = 'idle';
    }

    private initializePhysics(): void {
        // Initialize physics using the physics manager
        initializeCharacterPhysics(this.character, this.physicsManager);
    }

    private initializeModel(): void {
        // Create model container if not exists
        if (!this.character.modelContainer) {
            this.character.modelContainer = new THREE.Object3D();
        }

        // Set up model properties
        this.character.modelContainer.position.copy(this.character.position);
        this.character.modelContainer.rotation.copy(this.character.rotation);
    }
} 