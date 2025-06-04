/*
 * Infinia Multiplayer - player_logic.rs
 * 
 * This file contains the core game logic for player movement, state updates,
 * and physics calculations.
 * 
 * Key functions:
 * - update_player_position: Calculates new position based on input and delta time
 * - apply_movement: Applies movement vector to player position
 * - calculate_movement_vector: Determines movement direction from input
 * - validate_position: Ensures position is within valid bounds
 * 
 * Movement system:
 * - WASD for directional movement
 * - Shift for sprinting
 * - Mouse for rotation
 * - Space for jumping (future implementation)
 * 
 * Physics considerations:
 * - Delta time-based movement for frame rate independence
 * - Speed modifiers for different movement types
 * - Boundary checking to prevent out-of-bounds movement
 */

use crate::common::{Vector3, InputState, PLAYER_SPEED, SPRINT_MULTIPLIER, MOUSE_SENSITIVITY};
use std::f32::consts::PI;

// --- Movement Calculations ---

pub fn update_player_position(
    current_position: &Vector3,
    current_rotation: &Vector3,
    input: &InputState,
    delta_time: f32,
) -> (Vector3, Vector3) {
    let mut new_position = current_position.clone();
    let mut new_rotation = current_rotation.clone();
    
    // Update rotation based on mouse input
    new_rotation.y += input.mouse_x * MOUSE_SENSITIVITY;
    new_rotation.x += input.mouse_y * MOUSE_SENSITIVITY;
    
    // Clamp vertical rotation to prevent over-rotation
    new_rotation.x = new_rotation.x.clamp(-PI / 2.0, PI / 2.0);
    
    // Normalize horizontal rotation
    while new_rotation.y > PI {
        new_rotation.y -= 2.0 * PI;
    }
    while new_rotation.y < -PI {
        new_rotation.y += 2.0 * PI;
    }
    
    // Calculate movement vector
    let movement_vector = calculate_movement_vector(input, &new_rotation, delta_time);
    
    // Apply movement
    new_position.x += movement_vector.x;
    new_position.y += movement_vector.y;
    new_position.z += movement_vector.z;
    
    // Validate and clamp position
    new_position = validate_position(&new_position);
    
    (new_position, new_rotation)
}

pub fn calculate_movement_vector(
    input: &InputState,
    rotation: &Vector3,
    delta_time: f32,
) -> Vector3 {
    let mut movement = Vector3 { x: 0.0, y: 0.0, z: 0.0 };
    
    // Calculate base speed
    let base_speed = if input.shift {
        PLAYER_SPEED * SPRINT_MULTIPLIER
    } else {
        PLAYER_SPEED
    };
    
    let speed = base_speed * delta_time;
    
    // Calculate forward/backward movement
    if input.w {
        movement.x += rotation.y.sin() * speed;
        movement.z += rotation.y.cos() * speed;
    }
    if input.s {
        movement.x -= rotation.y.sin() * speed;
        movement.z -= rotation.y.cos() * speed;
    }
    
    // Calculate left/right movement (strafe)
    if input.a {
        movement.x += (rotation.y - PI / 2.0).sin() * speed;
        movement.z += (rotation.y - PI / 2.0).cos() * speed;
    }
    if input.d {
        movement.x += (rotation.y + PI / 2.0).sin() * speed;
        movement.z += (rotation.y + PI / 2.0).cos() * speed;
    }
    
    // Jump movement (simple vertical movement for now)
    if input.space {
        movement.y += speed;
    }
    
    movement
}

pub fn validate_position(position: &Vector3) -> Vector3 {
    let mut validated = position.clone();
    
    // Define world boundaries (adjust as needed)
    const MAX_X: f32 = 1000.0;
    const MIN_X: f32 = -1000.0;
    const MAX_Y: f32 = 100.0;
    const MIN_Y: f32 = -10.0;
    const MAX_Z: f32 = 1000.0;
    const MIN_Z: f32 = -1000.0;
    
    // Clamp position to boundaries
    validated.x = validated.x.clamp(MIN_X, MAX_X);
    validated.y = validated.y.clamp(MIN_Y, MAX_Y);
    validated.z = validated.z.clamp(MIN_Z, MAX_Z);
    
    validated
}

// --- Utility Functions ---

pub fn calculate_distance(pos1: &Vector3, pos2: &Vector3) -> f32 {
    let dx = pos1.x - pos2.x;
    let dy = pos1.y - pos2.y;
    let dz = pos1.z - pos2.z;
    (dx * dx + dy * dy + dz * dz).sqrt()
}

pub fn is_significant_movement(old_pos: &Vector3, new_pos: &Vector3, threshold: f32) -> bool {
    calculate_distance(old_pos, new_pos) > threshold
}

pub fn is_significant_rotation(old_rot: &Vector3, new_rot: &Vector3, threshold: f32) -> bool {
    let dx = (old_rot.x - new_rot.x).abs();
    let dy = (old_rot.y - new_rot.y).abs();
    let dz = (old_rot.z - new_rot.z).abs();
    dx > threshold || dy > threshold || dz > threshold
}