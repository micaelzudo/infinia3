/**
 * Character States
 * 
 * This file re-exports the Sketchbook character states for use in our project.
 */

// Import and re-export the state factory from Sketchbook
import { createCharacterStates } from '../../../../debug/modules/ui/sketchbook/entities/characters/states/characterStates';

// Re-export individual states for direct access
import { 
    CharacterStateBase,
    Idle,
    Walk,
    Sprint,
    JumpRunning,
    JumpIdle,
    Falling,
    DropIdle,
    DropRolling,
    DropRunning,
    EndWalk,
    StartWalkBase,
    StartWalkForward,
    StartWalkLeft,
    StartWalkRight,
    StartWalkBackLeft,
    StartWalkBackRight,
    IdleRotateLeft,
    IdleRotateRight
} from '../../../../debug/modules/ui/sketchbook/entities/characters/states/characterStates';

export {
    // Factory function to create all states
    createCharacterStates,
    
    // Base class
    CharacterStateBase,
    
    // Individual states
    Idle,
    Walk,
    Sprint,
    JumpRunning,
    JumpIdle,
    Falling,
    DropIdle,
    DropRolling,
    DropRunning,
    EndWalk,
    StartWalkBase,
    StartWalkForward,
    StartWalkLeft,
    StartWalkRight,
    StartWalkBackLeft,
    StartWalkBackRight,
    IdleRotateLeft,
    IdleRotateRight
};