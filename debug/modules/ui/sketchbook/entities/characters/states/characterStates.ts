/**
 * Character State Management
 * 
 * This file provides state management for character animations and behaviors.
 */

import type { EnhancedCharacter } from '../core/characterTypes';
import type { InputState } from '../../../core/input/inputTypes';
import { handleAnimationTransition, hasAnimationEnded } from '../../../utils/animationUtils';

export interface ICharacterState {
    enter(): void;
    update(timeStep: number, input: InputState): void;
    exit(): void;
}

export interface CharacterStateInfo {
    current: string;
    previous: string;
    timeInState: number;
    instance: ICharacterState;
    history: Array<{
        state: string;
        timestamp: number;
        duration: number;
    }>;
}

export interface StateTransitionCallbacks {
    onStateEnter?: (state: string) => void;
    onStateExit?: (state: string) => void;
    onStateUpdate?: (state: string, timeStep: number) => void;
    onTransitionStart?: (fromState: string, toState: string) => void;
    onTransitionEnd?: (fromState: string, toState: string) => void;
}

// Update EnhancedCharacter type to use CharacterStateInfo
declare module '../core/characterTypes' {
    interface EnhancedCharacter {
        states: CharacterStateInfo;
        setState(state: string): void;
        isGrounded: boolean;
        stateCallbacks?: StateTransitionCallbacks;
    }
}

export abstract class CharacterStateBase implements ICharacterState {
    protected character: EnhancedCharacter;
    protected timeInState: number = 0;
    protected lastUpdateTime: number = 0;

    constructor(character: EnhancedCharacter) {
        this.character = character;
    }

    public abstract enter(): void;
    public abstract update(timeStep: number, input: InputState): void;
    public abstract exit(): void;

    protected setAppropriateStartWalkState(input: InputState): void {
        if (input.moveForward) {
            this.character.setState('walk');
        } else if (input.moveBackward) {
            this.character.setState('walkBackward');
        } else if (input.moveLeft) {
            this.character.setState('strafeLeft');
        } else if (input.moveRight) {
            this.character.setState('strafeRight');
        }
    }

    protected validateStateTransition(fromState: string, toState: string): boolean {
        const validTransitions = STATE_TRANSITIONS[fromState] || [];
        return validTransitions.includes(toState);
    }

    public updateStateHistory(state: string, timestamp: number): void {
        if (!this.character.states.history) {
            this.character.states.history = [];
        }

        const lastEntry = this.character.states.history[this.character.states.history.length - 1];
        if (lastEntry) {
            lastEntry.duration = timestamp - lastEntry.timestamp;
        }

        this.character.states.history.push({
            state,
            timestamp,
            duration: 0
        });

        // Keep only last 10 state changes
        if (this.character.states.history.length > 10) {
            this.character.states.history.shift();
        }
    }

    protected callStateCallbacks(callbackType: keyof StateTransitionCallbacks, ...args: any[]): void {
        if (this.character.stateCallbacks?.[callbackType]) {
            (this.character.stateCallbacks[callbackType] as Function)(...args);
        }
    }
}

// State implementations
export class Idle extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'idle');
    }

    public update(timeStep: number, input: InputState): void {
        if (input.moveForward || input.moveBackward || input.moveLeft || input.moveRight) {
            this.setAppropriateStartWalkState(input);
        } else if (input.jump) {
            this.character.setState('jump');
        } else if (input.sprint) {
            this.character.setState('sprint');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Walk extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'walk');
    }

    public update(timeStep: number, input: InputState): void {
        if (!input.moveForward && !input.moveBackward && !input.moveLeft && !input.moveRight) {
            this.character.setState('idle');
        } else if (input.jump) {
            this.character.setState('jumpRunning');
        } else if (input.sprint) {
            this.character.setState('sprint');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Sprint extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'sprint');
    }

    public update(timeStep: number, input: InputState): void {
        if (!input.sprint) {
            this.character.setState('walk');
        } else if (input.jump) {
            this.character.setState('jumpRunning');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Jump extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'jump');
    }

    public update(timeStep: number, input: InputState): void {
        if (this.character.isGrounded) {
            this.character.setState('land');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class JumpRunning extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'jumpRunning');
    }

    public update(timeStep: number, input: InputState): void {
        if (this.character.isGrounded) {
            this.character.setState('land');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Fall extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'fall');
    }

    public update(timeStep: number, input: InputState): void {
        if (this.character.isGrounded) {
            this.character.setState('land');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Land extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'land');
    }

    public update(timeStep: number, input: InputState): void {
        if (hasAnimationEnded(this.character)) {
            this.character.setState('idle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Drive extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'drive');
    }

    public update(timeStep: number, input: InputState): void {
        if (input.exitVehicle) {
            this.character.setState('exit_vehicle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class ExitVehicle extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'exit_vehicle');
    }

    public update(timeStep: number, input: InputState): void {
        if (hasAnimationEnded(this.character)) {
            this.character.setState('idle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class Sit extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'sit');
    }

    public update(timeStep: number, input: InputState): void {
        if (input.stand) {
            this.character.setState('idle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class DropIdle extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'dropIdle');
    }

    public update(timeStep: number, input: InputState): void {
        if (input.moveForward || input.moveBackward || input.moveLeft || input.moveRight) {
            this.character.setState('dropRunning');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class DropRunning extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'dropRunning');
    }

    public update(timeStep: number, input: InputState): void {
        if (!input.moveForward && !input.moveBackward && !input.moveLeft && !input.moveRight) {
            this.character.setState('dropIdle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

export class DropRolling extends CharacterStateBase {
    public enter(): void {
        handleAnimationTransition(this.character, 'dropRolling');
    }

    public update(timeStep: number, input: InputState): void {
        if (hasAnimationEnded(this.character)) {
            this.character.setState('dropIdle');
        }
    }

    public exit(): void {
        // Cleanup if needed
    }
}

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
    'sit': Sit,
    'dropIdle': DropIdle,
    'dropRunning': DropRunning,
    'dropRolling': DropRolling
} as const;

// State transition mapping
export const STATE_TRANSITIONS: { [key: string]: string[] } = {
    'idle': ['walk', 'sprint', 'jump', 'fall', 'land', 'dropIdle', 'dropRolling', 'dropRunning'],
    'walk': ['idle', 'sprint', 'jump', 'fall', 'land', 'dropIdle', 'dropRolling', 'dropRunning'],
    'sprint': ['idle', 'walk', 'jump', 'fall', 'land', 'dropIdle', 'dropRolling', 'dropRunning'],
    'jump': ['walk', 'sprint', 'fall', 'land', 'dropIdle', 'dropRolling', 'dropRunning'],
    'fall': ['idle', 'walk', 'sprint', 'land', 'dropIdle', 'dropRolling', 'dropRunning'],
    'land': ['idle', 'walk', 'sprint', 'jump', 'fall'],
    'dropIdle': ['idle', 'walk', 'sprint', 'jump', 'fall', 'land'],
    'dropRolling': ['idle', 'walk', 'sprint', 'jump', 'fall', 'land'],
    'dropRunning': ['walk', 'idle', 'sprint', 'jump', 'fall', 'land'],
    'drive': ['exit_vehicle', 'idle', 'walk', 'sprint'],
    'exit_vehicle': ['idle', 'walk', 'sprint', 'jump', 'fall', 'land'],
    'sit': ['exit_vehicle', 'idle', 'walk', 'sprint']
};

/**
 * Get the state class for a given state name
 */
export function getStateClass(stateName: string): (new (character: EnhancedCharacter) => CharacterStateBase) | null {
    return STATE_CLASSES[stateName] || null;
}

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(currentState: string, newState: string): boolean {
    return STATE_TRANSITIONS[currentState]?.includes(newState) || false;
}

/**
 * Transition to a new state with validation and callbacks
 */
export function transitionToState(
    character: EnhancedCharacter,
    newState: string,
    callbacks?: StateTransitionCallbacks
): boolean {
    if (!character?.states) return false;

    const currentState = character.states.current;
    const stateInstance = character.states.instance;

    // Validate transition
    if (!isValidStateTransition(currentState, newState)) {
        console.warn(`[Character States] Invalid state transition: ${currentState} -> ${newState}`);
        return false;
    }

    // Get state class
    const StateClass = getStateClass(newState);
    if (!StateClass) {
        console.error(`[Character States] State class not found for: ${newState}`);
        return false;
    }

    try {
        // Call transition start callback
        if (callbacks?.onTransitionStart) {
            callbacks.onTransitionStart(currentState, newState);
        }

        // Create new state instance
        const newStateInstance = new StateClass(character);
        const oldStateInstance = stateInstance;

        // Call onStateExit on old state if it exists
        if (oldStateInstance) {
            oldStateInstance.exit();
            if (callbacks?.onStateExit) {
                callbacks.onStateExit(currentState);
            }
        }

        // Update character state
        character.states = {
            current: newState,
            previous: currentState,
            timeInState: 0,
            instance: newStateInstance,
            history: character.states.history || []
        };

        // Update state history
        newStateInstance.updateStateHistory(newState, performance.now());

        // Call onStateEnter on new state
        newStateInstance.enter();
        if (callbacks?.onStateEnter) {
            callbacks.onStateEnter(newState);
        }

        // Handle animation transition with proper fade in
        const fadeIn = 0.2; // Default fade in time
        handleAnimationTransition(character, newState, fadeIn);

        // Call transition end callback
        if (callbacks?.onTransitionEnd) {
            callbacks.onTransitionEnd(currentState, newState);
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
export function updateCharacterState(character: EnhancedCharacter, input: InputState): void {
    if (!character || !character.states) return;

    const currentState = character.states.current;
    const stateInstance = character.states.instance;

    if (!stateInstance || !(stateInstance instanceof CharacterStateBase)) {
        console.error(`[Character States] Invalid state instance for state: ${currentState}`);
        return;
    }

    // Update current state
    const timeStep = 0.016; // Use fixed timeStep for now
    stateInstance.update(timeStep, input);

    // Call state update callback
    if (character.stateCallbacks?.onStateUpdate) {
        character.stateCallbacks.onStateUpdate(currentState, timeStep);
    }
}

/**
 * Creates all character states for a given character
 */
export function createCharacterStates(character: EnhancedCharacter): { [key: string]: ICharacterState } {
    const states: { [key: string]: ICharacterState } = {};
    
    for (const [stateName, StateClass] of Object.entries(STATE_CLASSES)) {
        states[stateName] = new StateClass(character);
    }
    
    return states;
} 