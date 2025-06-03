// Defines the structure for player state synchronization

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
    // Define based on your game's input
    // Example:
    // forward: boolean;
    // backward: boolean;
    // left: boolean;
    // right: boolean;
    // jump: boolean;
    // run: boolean;
    [key: string]: any; // Allow for flexible input state
}

/**
 * Represents the state of a player in the game.
 * This structure will be synchronized across clients via SpacetimeDB.
 */
export interface PlayerState {
    playerId: string; // Unique identifier for the player (e.g., SpacetimeDB identity or a session ID)
    position: Vector3Data;
    rotation: QuaternionData; // Could be Euler angles or a quaternion
    inputState?: PlayerInputStateData; // Current input state of the player
    lastUpdateTime: number; // Timestamp of the last update
    // Add any other relevant player data, e.g.:
    // animationState: string;
    // health: number;
    // isGrounded: boolean;
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