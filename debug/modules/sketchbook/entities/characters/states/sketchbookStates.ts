/**
 * Character States
 * 
 * This file provides state management for characters using Sketchbook's state system.
 */

import * as THREE from 'three';
import type { EnhancedCharacter } from '../core/characterTypes';
import { PHYSICS_CONSTANTS } from '../../../types/sketchbookEnums';

// Base state class
export abstract class CharacterState {
    protected character: EnhancedCharacter;
    protected timeInState: number = 0;

    constructor(character: EnhancedCharacter) {
        this.character = character;
    }

    public abstract update(deltaTime: number): void;
    public abstract onEnter(): void;
    public abstract onExit(): void;

    protected setState(state: string): void {
        if (this.character.setState) {
            this.character.setState(state);
        }
    }

    protected setAnimation(name: string, fadeIn: number): void {
        if (this.character.setAnimation) {
            this.character.setAnimation(name, fadeIn);
        }
    }

    protected getVelocityLength(): number {
        return this.character.physics?.velocity?.length() || 0;
    }

    protected isGrounded(): boolean {
        return this.character.physics?.raycast?.hasHit || false;
    }

    protected canTransitionTo(state: string): boolean {
        return this.character.states?.current !== state;
    }
}

// Idle state
export class Idle extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Check for movement input
        if (this.getVelocityLength() > 0.1 && this.canTransitionTo('Walk')) {
            this.setState('Walk');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('idle', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Walk state
export class Walk extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Check for sprint input
        if (this.getVelocityLength() > PHYSICS_CONSTANTS.MAX_VELOCITY * 0.7 && this.canTransitionTo('Sprint')) {
            this.setState('Sprint');
        }
        
        // Check for no movement
        if (this.getVelocityLength() < 0.1 && this.canTransitionTo('Idle')) {
            this.setState('Idle');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('walk', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Sprint state
export class Sprint extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Check for reduced speed
        if (this.getVelocityLength() < PHYSICS_CONSTANTS.MAX_VELOCITY * 0.7 && this.canTransitionTo('Walk')) {
            this.setState('Walk');
        }
        
        // Check for no movement
        if (this.getVelocityLength() < 0.1 && this.canTransitionTo('Idle')) {
            this.setState('Idle');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('sprint', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Jump state
export class JumpRunning extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Check for landing
        if (this.isGrounded() && this.canTransitionTo('Landing')) {
            this.setState('Landing');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('jump', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Falling state
export class Falling extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Check for landing
        if (this.isGrounded() && this.canTransitionTo('Landing')) {
            this.setState('Landing');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('fall', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Landing state
export class Landing extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Return to idle after landing animation
        if (this.timeInState > 0.3 && this.canTransitionTo('Idle')) {
            this.setState('Idle');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('land', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

// Vehicle-related states
export class Driving extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('drive', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

export class ExitingVehicle extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
        
        // Return to idle after exiting animation
        if (this.timeInState > 0.5 && this.canTransitionTo('Idle')) {
            this.setState('Idle');
        }
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('exit_vehicle', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

export class Sitting extends CharacterState {
    public update(deltaTime: number): void {
        this.timeInState += deltaTime;
    }

    public onEnter(): void {
        this.timeInState = 0;
        this.setAnimation('sit', 0.2);
    }

    public onExit(): void {
        // Clean up any state-specific resources
    }
}

export function createCharacterStates(character: EnhancedCharacter): Record<string, CharacterState> {
    return {
        idle: new Idle(character),
        walk: new Walk(character),
        sprint: new Sprint(character),
        jumpRunning: new JumpRunning(character),
        falling: new Falling(character),
        landing: new Landing(character),
        driving: new Driving(character),
        exitingVehicle: new ExitingVehicle(character),
        sitting: new Sitting(character)
    };
} 