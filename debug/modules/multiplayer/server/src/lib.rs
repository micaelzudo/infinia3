/*
 * Infinia Multiplayer - lib.rs
 * 
 * Main entry point for the SpacetimeDB module. This file contains:
 * 
 * 1. Database Schema:
 *    - PlayerData: Active player information
 *    - LoggedOutPlayerData: Persistent data for disconnected players
 *    - GameTickSchedule: Periodic update scheduling
 * 
 * 2. Reducer Functions (Server Endpoints):
 *    - init: Module initialization and game tick scheduling
 *    - identity_connected/disconnected: Connection lifecycle management
 *    - register_player: Player registration with username
 *    - update_player_input: Processes player movement and state updates
 *    - game_tick: Periodic update for game state (scheduled)
 * 
 * 3. Table Structure:
 *    - All tables use Identity as primary keys where appropriate
 *    - Connection between tables maintained through identity references
 * 
 * When modifying:
 *    - Table changes require regenerating TypeScript bindings
 *    - Add `public` tag to tables that need client access
 *    - New reducers should follow naming convention and error handling patterns
 *    - Game logic should be placed in separate modules (like player_logic.rs)
 *    - Extend game_tick for gameplay systems that need periodic updates
 * 
 * Related files:
 *    - common.rs: Shared data structures used in table definitions
 *    - player_logic.rs: Player movement and state update calculations
 */

// Declare modules
mod common;
mod player_logic;

use spacetimedb::{ReducerContext, Identity, Table, Timestamp, ScheduleAt};
use std::time::Duration;

// Use items from common module
use crate::common::{Vector3, InputState};
use crate::player_logic::{update_player_position, is_significant_movement, is_significant_rotation};

// --- Schema Definitions ---

#[spacetimedb::table(name = player, public)]
#[derive(Clone)]
pub struct PlayerData {
    #[primary_key]
    identity: Identity,
    username: String,
    position: Vector3,
    rotation: Vector3,
    health: i32,
    max_health: i32,
    mana: i32,
    max_mana: i32,
    is_moving: bool,
    is_running: bool,
    last_input_seq: u32,
    input: InputState,
    last_update: Timestamp,
}

#[spacetimedb::table(name = logged_out_player)]
#[derive(Clone)]
pub struct LoggedOutPlayerData {
    #[primary_key]
    identity: Identity,
    username: String,
    position: Vector3,
    rotation: Vector3,
    health: i32,
    max_health: i32,
    mana: i32,
    max_mana: i32,
    last_seen: Timestamp,
}

#[spacetimedb::table(name = game_tick_schedule, public, scheduled(game_tick))]
pub struct GameTickSchedule {
    #[primary_key]
    #[auto_inc]
    scheduled_id: u64,
    scheduled_at: ScheduleAt,
}

#[spacetimedb::table(name = terrain_chunk, public)]
#[derive(Clone)]
pub struct TerrainChunk {
    #[primary_key]
    chunk_key: String, // Format: "x,y,z_planetType"
    planet_type: String,
    chunk_x: i32,
    chunk_y: i32,
    chunk_z: i32,
    noise_data: Vec<f32>, // Flattened 3D noise map
    created_at: Timestamp,
    last_accessed: Timestamp,
}

// --- Lifecycle Reducers ---

#[spacetimedb::reducer(init)]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    spacetimedb::log::info!("[INIT] Initializing Infinia Multiplayer module...");
    
    if ctx.db.game_tick_schedule().count() == 0 {
        spacetimedb::log::info!("[INIT] Scheduling initial game tick (every 50ms)...");
        let loop_duration = Duration::from_millis(50); // 20 FPS
        ctx.db.game_tick_schedule().insert(GameTickSchedule {
            scheduled_id: 0,
            scheduled_at: ScheduleAt::Interval(loop_duration),
        })?;
        spacetimedb::log::info!("[INIT] Game tick scheduled successfully.");
    } else {
        spacetimedb::log::info!("[INIT] Game tick already scheduled.");
    }
    
    spacetimedb::log::info!("[INIT] Infinia Multiplayer module initialized successfully.");
    Ok(())
}

#[spacetimedb::reducer]
pub fn identity_connected(ctx: &ReducerContext) -> Result<(), String> {
    let identity = ctx.sender;
    spacetimedb::log::info!("[CONNECTION] Identity connected: {}", identity.to_hex());
    
    // Check if player was previously logged out
    if let Some(logged_out_player) = ctx.db.logged_out_player().find(|p| p.identity == identity) {
        spacetimedb::log::info!("[CONNECTION] Restoring logged out player: {}", logged_out_player.username);
        
        // Restore player to active table
        ctx.db.player().insert(PlayerData {
            identity,
            username: logged_out_player.username.clone(),
            position: logged_out_player.position.clone(),
            rotation: logged_out_player.rotation.clone(),
            health: logged_out_player.health,
            max_health: logged_out_player.max_health,
            mana: logged_out_player.mana,
            max_mana: logged_out_player.max_mana,
            is_moving: false,
            is_running: false,
            last_input_seq: 0,
            input: InputState {
                w: false, s: false, a: false, d: false,
                space: false, shift: false,
                mouse_x: 0.0, mouse_y: 0.0,
                left_click: false, right_click: false,
                sequence: 0,
            },
            last_update: ctx.timestamp,
        })?;
        
        // Remove from logged out table
        ctx.db.logged_out_player().delete(&logged_out_player);
        
        spacetimedb::log::info!("[CONNECTION] Player {} restored successfully", logged_out_player.username);
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn identity_disconnected(ctx: &ReducerContext) -> Result<(), String> {
    let identity = ctx.sender;
    spacetimedb::log::info!("[DISCONNECTION] Identity disconnected: {}", identity.to_hex());
    
    // Find and move player to logged out table
    if let Some(player) = ctx.db.player().find(|p| p.identity == identity) {
        spacetimedb::log::info!("[DISCONNECTION] Moving player {} to logged out table", player.username);
        
        // Save to logged out table
        ctx.db.logged_out_player().insert(LoggedOutPlayerData {
            identity,
            username: player.username.clone(),
            position: player.position.clone(),
            rotation: player.rotation.clone(),
            health: player.health,
            max_health: player.max_health,
            mana: player.mana,
            max_mana: player.max_mana,
            last_seen: ctx.timestamp,
        })?;
        
        // Remove from active table
        ctx.db.player().delete(&player);
        
        spacetimedb::log::info!("[DISCONNECTION] Player {} moved to logged out table", player.username);
    }
    
    Ok(())
}

// --- Terrain Management Reducers ---

#[spacetimedb::reducer]
pub fn store_terrain_chunk(
    ctx: &ReducerContext,
    chunk_key: String,
    planet_type: String,
    chunk_x: i32,
    chunk_y: i32,
    chunk_z: i32,
    noise_data: Vec<f32>,
) -> Result<(), String> {
    spacetimedb::log::info!("[TERRAIN] Storing terrain chunk: {}", chunk_key);
    
    // Check if chunk already exists
    if let Some(existing_chunk) = ctx.db.terrain_chunk().find(|c| c.chunk_key == chunk_key) {
        // Update existing chunk
        let mut updated_chunk = existing_chunk.clone();
        updated_chunk.noise_data = noise_data;
        updated_chunk.last_accessed = ctx.timestamp;
        ctx.db.terrain_chunk().update(&existing_chunk, updated_chunk)?;
        spacetimedb::log::info!("[TERRAIN] Updated existing chunk: {}", chunk_key);
    } else {
        // Create new chunk
        ctx.db.terrain_chunk().insert(TerrainChunk {
            chunk_key: chunk_key.clone(),
            planet_type,
            chunk_x,
            chunk_y,
            chunk_z,
            noise_data,
            created_at: ctx.timestamp,
            last_accessed: ctx.timestamp,
        })?;
        spacetimedb::log::info!("[TERRAIN] Created new chunk: {}", chunk_key);
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn get_terrain_chunk(ctx: &ReducerContext, chunk_key: String) -> Result<(), String> {
    spacetimedb::log::info!("[TERRAIN] Retrieving terrain chunk: {}", chunk_key);
    
    if let Some(mut chunk) = ctx.db.terrain_chunk().find(|c| c.chunk_key == chunk_key) {
        // Update last accessed time
        chunk.last_accessed = ctx.timestamp;
        ctx.db.terrain_chunk().update(&chunk, chunk.clone())?;
        spacetimedb::log::info!("[TERRAIN] Found and updated access time for chunk: {}", chunk_key);
    } else {
        spacetimedb::log::info!("[TERRAIN] Chunk not found: {}", chunk_key);
    }
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn store_initial_chunks_for_planet(
    ctx: &ReducerContext,
    planet_type: String,
    radius: i32,
) -> Result<(), String> {
    spacetimedb::log::info!("[TERRAIN] Storing initial chunks for planet type: {} with radius: {}", planet_type, radius);
    
    let mut chunks_created = 0;
    
    // Generate chunks around (0, 0, 0) with the specified radius
    for x in -radius..=radius {
        for y in -1..=0 { // Two vertical layers as per the pattern
            for z in -radius..=radius {
                let chunk_key = format!("{},{},{}_{}", x, y, z, planet_type);
                
                // Check if chunk already exists
                if ctx.db.terrain_chunk().find(|c| c.chunk_key == chunk_key).is_none() {
                    // Create placeholder chunk (noise data will be generated client-side)
                    let placeholder_noise = vec![0.0; (33 * 33 * 33) as usize]; // CHUNK_SIZE+1 cubed
                    
                    ctx.db.terrain_chunk().insert(TerrainChunk {
                        chunk_key: chunk_key.clone(),
                        planet_type: planet_type.clone(),
                        chunk_x: x,
                        chunk_y: y,
                        chunk_z: z,
                        noise_data: placeholder_noise,
                        created_at: ctx.timestamp,
                        last_accessed: ctx.timestamp,
                    })?;
                    
                    chunks_created += 1;
                }
            }
        }
    }
    
    spacetimedb::log::info!("[TERRAIN] Created {} initial chunks for planet type: {}", chunks_created, planet_type);
    Ok(())
}

// --- Player Management Reducers ---

#[spacetimedb::reducer]
pub fn register_player(ctx: &ReducerContext, username: String) -> Result<(), String> {
    let identity = ctx.sender;
    spacetimedb::log::info!("[REGISTER] Registering player: {} with identity: {}", username, identity.to_hex());
    
    // Check if player already exists
    if ctx.db.player().find(|p| p.identity == identity).is_some() {
        return Err(format!("Player with identity {} already registered", identity.to_hex()));
    }
    
    // Check if username is already taken
    if ctx.db.player().find(|p| p.username == username).is_some() {
        return Err(format!("Username '{}' is already taken", username));
    }
    
    // Create new player
    let new_player = PlayerData {
        identity,
        username: username.clone(),
        position: Vector3 { x: 0.0, y: 0.0, z: 0.0 },
        rotation: Vector3 { x: 0.0, y: 0.0, z: 0.0 },
        health: 100,
        max_health: 100,
        mana: 100,
        max_mana: 100,
        is_moving: false,
        is_running: false,
        last_input_seq: 0,
        input: InputState {
            w: false, s: false, a: false, d: false,
            space: false, shift: false,
            mouse_x: 0.0, mouse_y: 0.0,
            left_click: false, right_click: false,
            sequence: 0,
        },
        last_update: ctx.timestamp,
    };
    
    ctx.db.player().insert(new_player)?;
    spacetimedb::log::info!("[REGISTER] Player {} registered successfully", username);
    
    Ok(())
}

#[spacetimedb::reducer]
pub fn update_player_input(
    ctx: &ReducerContext,
    input: InputState,
) -> Result<(), String> {
    let identity = ctx.sender;
    
    // Find the player
    let mut player = ctx.db.player()
        .find(|p| p.identity == identity)
        .ok_or_else(|| format!("Player with identity {} not found", identity.to_hex()))?;
    
    // Check sequence number to prevent old updates
    if input.sequence <= player.last_input_seq {
        return Ok(()); // Ignore old or duplicate updates
    }
    
    // Calculate delta time (assuming 50ms tick rate)
    let delta_time = 0.05; // 50ms in seconds
    
    // Store old position and rotation for change detection
    let old_position = player.position.clone();
    let old_rotation = player.rotation.clone();
    
    // Update player position and rotation based on input
    let (new_position, new_rotation) = update_player_position(
        &player.position,
        &player.rotation,
        &input,
        delta_time,
    );
    
    // Update player state
    player.position = new_position;
    player.rotation = new_rotation;
    player.input = input.clone();
    player.last_input_seq = input.sequence;
    player.last_update = ctx.timestamp;
    
    // Determine movement state
    player.is_moving = input.w || input.s || input.a || input.d;
    player.is_running = player.is_moving && input.shift;
    
    // Update the player in the database
    ctx.db.player().update(&player);
    
    // Log significant changes
    if is_significant_movement(&old_position, &player.position, 0.1) ||
       is_significant_rotation(&old_rotation, &player.rotation, 0.05) {
        spacetimedb::log::debug!(
            "[UPDATE] Player {} moved to ({:.2}, {:.2}, {:.2})",
            player.username,
            player.position.x,
            player.position.y,
            player.position.z
        );
    }
    
    Ok(())
}

// --- Game Loop ---

#[spacetimedb::reducer]
pub fn game_tick(ctx: &ReducerContext) -> Result<(), String> {
    let player_count = ctx.db.player().count();
    
    if player_count > 0 {
        spacetimedb::log::debug!("[GAME_TICK] Processing {} active players", player_count);
        
        // Here you can add periodic game logic:
        // - Health/mana regeneration
        // - Environmental effects
        // - AI updates
        // - Physics simulation
        // - Cleanup tasks
        
        // Example: Health regeneration
        for mut player in ctx.db.player().iter() {
            if player.health < player.max_health {
                player.health = (player.health + 1).min(player.max_health);
                ctx.db.player().update(&player);
            }
            
            if player.mana < player.max_mana {
                player.mana = (player.mana + 2).min(player.max_mana);
                ctx.db.player().update(&player);
            }
        }
    }
    
    Ok(())
}