/**
 * Sketchbook Imports
 * 
 * This file provides a unified import point for all Sketchbook components.
 */

// External libraries
import * as THREE from 'three';
import * as CANNON from 'cannon';

// Character components
import { CharacterManager } from '../entities/characters/core';
import { CharacterInputHandler } from '../entities/characters/core';
import type { CharacterBase, EnhancedCharacter } from '../entities/characters/core';
import { CharacterInitializer } from '../entities/characters/core';

// State management
import { createCharacterStates } from '../entities/characters/states/characterStates';

// Core components
import { PhysicsManager } from '../core/physics/physicsManager';

// Types and enums
import { PHYSICS_CONSTANTS } from '../types/sketchbookEnums';
import { VehicleType, VehicleSeatType } from '../types/sketchbookEnums';

// Vehicle components
import { Car, Motorcycle, Boat, Aircraft } from '../entities/vehicles/types/vehicleTypes';
import type { Vehicle, VehicleConfig } from '../entities/vehicles/types/vehicleInterfaces';

// Re-export all components
export {
    // Character components
    CharacterManager,
    CharacterInputHandler,
    CharacterInitializer,
    CharacterBase,
    EnhancedCharacter,
    
    // State management
    createCharacterStates,
    
    // Physics and collision
    PhysicsManager,
    PHYSICS_CONSTANTS,
    
    // Vehicle components
    Car,
    Motorcycle,
    Boat,
    Aircraft,
    VehicleType,
    VehicleSeatType
};

// Re-export types
export type {
    Vehicle,
    VehicleConfig
};

/**
 * Initialize a character with all necessary components
 */
export function initializeCharacter(
    character: EnhancedCharacter,
    physicsManager: PhysicsManager
): void {
    // Create character states
    const states = createCharacterStates(character);
    
    // Initialize character
    const initializer = new CharacterInitializer(character, physicsManager);
    initializer.initialize();
    
    // Set initial state
    if (character.setState) {
        character.setState('Idle');
    }
}