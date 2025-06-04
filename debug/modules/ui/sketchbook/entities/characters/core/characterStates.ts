/**
 * Character State Management
 * 
 * This file provides state management for character animations and behaviors.
 */

// Import only what's needed from Sketchbook
import type { CharacterStateBase } from '../../../types/CharacterStateBase';
import type { EnhancedCharacter } from './characterTypes';
import { handleAnimationTransition } from '../../../utils/animationUtils';

// Import all character states
import {
    Idle,
    Walk,
    Sprint,
    Jump,
    Fall,
    Land,
    Drive,
    ExitVehicle,
    Sit
} from '../states/characterStates';

// State class mapping
export const STATE_CLASSES: { [key: string]: new (character: EnhancedCharacter) => CharacterStateBase } = {
    'idle': Idle,
    'walk': Walk,
    'sprint': Sprint,
    'jump': Jump,
    'fall': Fall,
    'land': Land,
    'drive': Drive,
    'exit_vehicle': ExitVehicle,
    'sit': Sit
};

// State transition mapping
export const STATE_TRANSITIONS: { [key: string]: string[] } = {
    'idle': ['walk', 'sprint', 'jump', 'fall', 'land', 'drive', 'sit'],
    'walk': ['idle', 'sprint', 'jump', 'fall', 'land', 'drive', 'sit'],
    'sprint': ['idle', 'walk', 'jump', 'fall', 'land', 'drive', 'sit'],
    'jump': ['fall', 'land'],
    'fall': ['land'],
    'land': ['idle', 'walk', 'sprint', 'jump', 'fall'],
    'drive': ['exit_vehicle'],
    'exit_vehicle': ['idle', 'walk', 'sprint'],
    'sit': ['idle', 'walk', 'sprint']
};

/**
 * Transitions to a new state
 */
export function transitionToState(
    character: EnhancedCharacter,
    newState: string,
    callbacks?: {
        onStateChange?: (oldState: string, newState: string) => void;
        onAnimationComplete?: (animation: any) => void;
    }
): boolean {
    // Get current state
    const currentState = character.states?.current;
    if (!currentState) return false;

    // Check if transition is allowed
    const allowedTransitions = STATE_TRANSITIONS[currentState];
    if (!allowedTransitions || !allowedTransitions.includes(newState)) {
        console.warn(`[Character States] Invalid state transition: ${currentState} -> ${newState}`);
        return false;
    }

    // Get state class
    const StateClass = STATE_CLASSES[newState];
    if (!StateClass) {
        console.error(`[Character States] State class not found for state: ${newState}`);
        return false;
    }

    try {
        // Create new state instance
        const newStateInstance = new StateClass(character);
        
        // Update character state
        if (character.setState) {
            character.setState(newStateInstance);
        } else {
            console.error(`[Character States] setState method not found on character`);
            return false;
        }
        
        // Handle animation transition
        handleAnimationTransition(character, newState, 0.2);
        
        // Call state change callback if provided
        if (callbacks?.onStateChange) {
            callbacks.onStateChange(currentState, newState);
        }
        
        return true;
    } catch (error) {
        console.error(`[Character States] Error transitioning to state ${newState}:`, error);
        return false;
    }
}

/**
 * Update character state based on input and physics
 */
export function updateCharacterState(
    character: EnhancedCharacter,
    input: {
        up?: boolean,
        down?: boolean,
        left?: boolean,
        right?: boolean,
        run?: boolean
    }
): void {
    if (!character || !character.states) return;

    const isGrounded = character.physics?.raycast?.hasHit || false;
    const anyDirection = input.up || input.down || input.left || input.right;
    const currentState = character.states.current;

    // Determine new state based on input and physics
    let newState = currentState;

    if (!isGrounded) {
        newState = 'fall';
    } else if (anyDirection) {
        if (input.run) {
            newState = 'sprint';
        } else {
            newState = 'walk';
        }
    } else {
        newState = 'idle';
    }

    // Transition to new state if different
    if (newState !== currentState) {
        transitionToState(character, newState);
    }
}

/**
 * Initialize character states
 */
export function initializeCharacterStates(character: EnhancedCharacter): void {
    if (!character) return;

    // Initialize state management
    character.states = {
        current: 'idle',
        previous: null,
        timeInState: 0
    };

    // Set initial state
    transitionToState(character, 'idle');
}