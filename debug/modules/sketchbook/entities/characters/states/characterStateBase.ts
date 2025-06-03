import type { EnhancedCharacter } from '../core/characterTypes';
import { InputState } from '../../../input/inputManager';

export interface ICharacterState {
    update(timeStep: number, input: InputState): void;
    onInputChange(input: InputState): void;
    onStateEnter(previousState: ICharacterState): void;
    onStateExit(nextState: ICharacterState): void;
}

export abstract class CharacterStateBase implements ICharacterState {
    protected character: EnhancedCharacter;

    constructor(character: EnhancedCharacter) {
        this.character = character;
    }

    public abstract update(timeStep: number, input: InputState): void;
    public abstract onInputChange(input: InputState): void;

    public onStateEnter(previousState: ICharacterState): void {
        // Override in derived classes if needed
    }

    public onStateExit(nextState: ICharacterState): void {
        // Override in derived classes if needed
    }

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

    protected setAppropriateDropState(input: InputState): void {
        if (input.moveForward) {
            this.character.setState('dropRunning');
        } else {
            this.character.setState('dropIdle');
        }
    }

    protected setAppropriateJumpState(input: InputState): void {
        if (input.moveForward) {
            this.character.setState('jumpRunning');
        } else {
            this.character.setState('jumpIdle');
        }
    }
} 