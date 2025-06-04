// Player State Management for Infinia Multiplayer
// Legacy compatibility layer - prefer using generated types for new development

import { Vector3, InputState, PlayerData } from './generated/types';

// Legacy types for backward compatibility
export interface Vector3Data {
    x: number;
    y: number;
    z: number;
}

export interface QuaternionData {
    x: number;
    y: number;
    z: number;
    w: number;
}

export interface PlayerInputStateData {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    jump: boolean;
    sprint: boolean;
    mouse_x: number;
    mouse_y: number;
    [key: string]: any; // Allow for flexible input state
}

/**
 * Legacy player state interface - use PlayerData from generated types for new development
 */
export interface PlayerState {
    playerId: string;
    position: Vector3Data;
    rotation: QuaternionData;
    inputState?: PlayerInputStateData;
    lastUpdateTime: number;
    health?: number;
    mana?: number;
    username?: string;
}

// Utility functions for converting between legacy and generated types
export function convertToVector3(legacy: Vector3Data): Vector3 {
    return { x: legacy.x, y: legacy.y, z: legacy.z };
}

export function convertFromVector3(generated: Vector3): Vector3Data {
    return { x: generated.x, y: generated.y, z: generated.z };
}

export function convertToInputState(legacy: PlayerInputStateData): InputState {
    return {
        forward: legacy.forward || false,
        backward: legacy.backward || false,
        left: legacy.left || false,
        right: legacy.right || false,
        jump: legacy.jump || false,
        sprint: legacy.sprint || false,
        mouse_x: legacy.mouse_x || 0,
        mouse_y: legacy.mouse_y || 0,
        sequence_number: 0 // Will be set by the server
    };
}

export function convertFromPlayerData(playerData: PlayerData): PlayerState {
    return {
        playerId: playerData.identity.toString(),
        position: convertFromVector3(playerData.position),
        rotation: { x: 0, y: playerData.rotation_y, z: 0, w: 1 }, // Convert from Y rotation to quaternion
        lastUpdateTime: Date.now(),
        health: playerData.health,
        mana: playerData.mana,
        username: playerData.username
    };
}

// Example of how you might use this in your SpacetimeDB table definition (in Rust):
// #[spacetimedb(table)]
// pub struct PlayerStateTable {
//     #[primarykey]
//     pub player_id: String,
//     pub pos_x: f32,
//     pub pos_y: f32,
//     pub pos_z: f32,
//     pub rot_x: f32,
//     pub rot_y: f32,
//     pub rot_z: f32,
//     pub rot_w: f32,
//     // ... other fields corresponding to PlayerInputStateData and other PlayerState properties
//     pub last_update_time: u64,
// }