/*
 * Infinia Multiplayer - common.rs
 * 
 * This file contains shared data structures and constants used throughout the application.
 * 
 * Key components:
 * - Vector3: 3D vector struct for positions, rotations and movement
 * - InputState: Player input tracking with all possible input actions
 * - Game constants: Speed values that affect player movement
 * 
 * These structures are used by:
 * - lib.rs: For database table definitions
 * - player_logic.rs: For movement calculations and state updates
 * 
 * When modifying:
 * - Changes to Vector3 or InputState will affect database schema
 * - You may need to run 'spacetime delete <db_name>' after schema changes
 * - Adjust PLAYER_SPEED and SPRINT_MULTIPLIER to change movement feel
 * - Adding new input types requires updates to InputState and UI event handlers
 */

use spacetimedb::{SpacetimeType};

// --- Shared Structs ---

// Helper struct for 3D vectors
#[derive(SpacetimeType, Clone, Debug, PartialEq)]
pub struct Vector3 {
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

// Helper struct for player input state
#[derive(SpacetimeType, Clone, Debug)]
pub struct InputState {
    pub w: bool,
    pub s: bool,
    pub a: bool,
    pub d: bool,
    pub space: bool,
    pub shift: bool,
    pub mouse_x: f32,
    pub mouse_y: f32,
    pub left_click: bool,
    pub right_click: bool,
    pub sequence: u32,
}

// --- Game Constants ---

pub const PLAYER_SPEED: f32 = 7.5;
pub const SPRINT_MULTIPLIER: f32 = 1.8;
pub const MOUSE_SENSITIVITY: f32 = 0.002;