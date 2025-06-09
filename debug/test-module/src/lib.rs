use spacetimedb::{ReducerContext, Identity, Timestamp, Table};

#[cfg(test)]
mod tests;

// Player data table
#[spacetimedb::table(name = player_data, public)]
pub struct PlayerData {
    #[primary_key]
    pub identity: Identity,
    pub username: String,
    pub position_x: f32,
    pub position_y: f32,
    pub position_z: f32,
    pub rotation_x: f32,
    pub rotation_y: f32,
    pub rotation_z: f32,
    // Aiming and look direction
    pub aim_direction_x: f32,
    pub aim_direction_y: f32,
    pub aim_direction_z: f32,
    pub look_direction_x: f32,
    pub look_direction_y: f32,
    pub look_direction_z: f32,
    pub is_aiming: bool,
    pub is_scoped: bool,
    // Animation state
    pub animation_state: String,
    pub animation_time: f32,
    // Health and connection
    pub health: f32,
    pub max_health: f32,
    pub last_update: Timestamp,
    pub is_connected: bool,
}

// Logged out player data table
#[spacetimedb::table(name = logged_out_player, public)]
pub struct LoggedOutPlayerData {
    #[primary_key]
    pub identity: Identity,
    pub username: String,
    pub last_position_x: f32,
    pub last_position_y: f32,
    pub last_position_z: f32,
    pub logout_time: Timestamp,
}

// Game tick schedule table
#[spacetimedb::table(name = game_tick_schedule, public)]
pub struct GameTickSchedule {
    #[primary_key]
    pub id: u32,
    pub tick_rate: u32,
    pub last_tick: Timestamp,
    pub next_tick: Timestamp,
}

// Terrain chunk table
#[spacetimedb::table(name = terrain_chunk, public)]
pub struct TerrainChunk {
    #[primary_key]
    pub chunk_key: String,
    pub planet_type: String,
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub created_at: Timestamp,
}

// Initialize the module
#[spacetimedb::reducer(init)]
pub fn init(ctx: &ReducerContext) {
    // Initialize game tick schedule
    ctx.db.game_tick_schedule().insert(GameTickSchedule {
        id: 1,
        tick_rate: 60, // 60 FPS
        last_tick: ctx.timestamp,
        next_tick: ctx.timestamp,
    });
    
    log::info!("Infinia Multiplayer module initialized");
}

// Handle client connections
#[spacetimedb::reducer(client_connected)]
pub fn identity_connected(ctx: &ReducerContext) {
    log::info!("Client connected: {:?}", ctx.sender);
}

// Handle client disconnections
#[spacetimedb::reducer(client_disconnected)]
pub fn identity_disconnected(ctx: &ReducerContext) {
    if let Some(player) = ctx.db.player_data().identity().find(ctx.sender) {
        // Move player to logged out table
        ctx.db.logged_out_player().insert(LoggedOutPlayerData {
            identity: player.identity,
            username: player.username.clone(),
            last_position_x: player.position_x,
            last_position_y: player.position_y,
            last_position_z: player.position_z,
            logout_time: ctx.timestamp,
        });
        
        // Remove from active players
        ctx.db.player_data().identity().delete(ctx.sender);
        
        log::info!("Player {} disconnected", player.username);
    }
}

// Register a new player
#[spacetimedb::reducer]
pub fn register_player(ctx: &ReducerContext, username: String) {
    let identity = ctx.sender;
    
    // Check if player already exists
    if let Some(_existing) = ctx.db.player_data().identity().find(identity) {
        log::warn!("Player {} already registered", username);
        return;
    }
    
    // Check if returning from logged out state
    if let Some(logged_out) = ctx.db.logged_out_player().identity().find(identity) {
        // Restore player from logged out state
        ctx.db.player_data().insert(PlayerData {
            identity,
            username: logged_out.username.clone(),
            position_x: logged_out.last_position_x,
            position_y: logged_out.last_position_y,
            position_z: logged_out.last_position_z,
            rotation_x: 0.0,
            rotation_y: 0.0,
            rotation_z: 0.0,
            aim_direction_x: 0.0,
            aim_direction_y: 0.0,
            aim_direction_z: 1.0,
            look_direction_x: 0.0,
            look_direction_y: 0.0,
            look_direction_z: 1.0,
            is_aiming: false,
            is_scoped: false,
            animation_state: "Idle".to_string(),
            animation_time: 0.0,
            health: 100.0,
            max_health: 100.0,
            last_update: ctx.timestamp,
            is_connected: true,
        });
        
        // Remove from logged out table
        ctx.db.logged_out_player().identity().delete(identity);
        
        log::info!("Player {} reconnected", logged_out.username);
    } else {
        // Create new player
        ctx.db.player_data().insert(PlayerData {
            identity,
            username: username.clone(),
            position_x: 0.0,
            position_y: 50.0, // Spawn at safe height
            position_z: 0.0,
            rotation_x: 0.0,
            rotation_y: 0.0,
            rotation_z: 0.0,
            aim_direction_x: 0.0,
            aim_direction_y: 0.0,
            aim_direction_z: 1.0,
            look_direction_x: 0.0,
            look_direction_y: 0.0,
            look_direction_z: 1.0,
            is_aiming: false,
            is_scoped: false,
            animation_state: "Idle".to_string(),
            animation_time: 0.0,
            health: 100.0,
            max_health: 100.0,
            last_update: ctx.timestamp,
            is_connected: true,
        });
        
        log::info!("New player {} registered", username);
    }
}

// Update player position
#[spacetimedb::reducer]
pub fn update_player_position(
    ctx: &ReducerContext,
    position_x: f32,
    position_y: f32,
    position_z: f32,
    rotation_x: f32,
    rotation_y: f32,
    rotation_z: f32
) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        // Update position and rotation
        let updated_player = PlayerData {
            identity,
            username: player.username,
            position_x,
            position_y,
            position_z,
            rotation_x,
            rotation_y,
            rotation_z,
            // Preserve existing aiming and animation state
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: true,
        };
        
        // Update the player in the database
        ctx.db.player_data().identity().update(updated_player);
    }
}

// Store terrain chunk data
#[spacetimedb::reducer]
pub fn store_terrain_chunk(
    ctx: &ReducerContext,
    chunk_key: String,
    planet_type: String,
    x: i32,
    y: i32,
    z: i32
) {
    // Check if chunk already exists
    if let Some(_existing) = ctx.db.terrain_chunk().chunk_key().find(&chunk_key) {
        log::warn!("Terrain chunk {} already exists", chunk_key);
        return;
    }
    
    ctx.db.terrain_chunk().insert(TerrainChunk {
        chunk_key: chunk_key.clone(),
        planet_type,
        x,
        y,
        z,
        created_at: ctx.timestamp,
    });
    
    log::info!("Stored terrain chunk: {}", chunk_key);
}

// Get terrain chunk data
#[spacetimedb::reducer]
pub fn get_terrain_chunk(ctx: &ReducerContext, chunk_key: String) {
    if let Some(chunk) = ctx.db.terrain_chunk().chunk_key().find(&chunk_key) {
        log::info!("Retrieved terrain chunk: {} at ({}, {}, {})", 
                  chunk.chunk_key, chunk.x, chunk.y, chunk.z);
    } else {
        log::warn!("Terrain chunk not found: {}", chunk_key);
    }
}

// Store initial chunks for a planet
#[spacetimedb::reducer]
pub fn store_initial_chunks_for_planet(
    ctx: &ReducerContext,
    planet_type: String,
    radius: i32
) {
    let mut chunks_created = 0;
    
    for x in -radius..=radius {
        for y in -radius..=radius {
            for z in -radius..=radius {
                let chunk_key = format!("{}_{}_{}_{}", planet_type, x, y, z);
                
                // Only create if doesn't exist
                if ctx.db.terrain_chunk().chunk_key().find(&chunk_key).is_none() {
                    ctx.db.terrain_chunk().insert(TerrainChunk {
                        chunk_key,
                        planet_type: planet_type.clone(),
                        x,
                        y,
                        z,
                        created_at: ctx.timestamp,
                    });
                    
                    chunks_created += 1;
                }
            }
        }
    }
    
    log::info!("Created {} initial chunks for planet type: {}", chunks_created, planet_type);
}

// Update player health
#[spacetimedb::reducer]
pub fn update_player_health(
    ctx: &ReducerContext,
    health_change: f32
) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let new_health = (player.health + health_change).max(0.0).min(player.max_health);
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve existing aiming and animation state
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: new_health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} health updated to {}", username_for_log, new_health);
    }
}

// Heal player to full health
#[spacetimedb::reducer]
pub fn heal_player(ctx: &ReducerContext) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve existing aiming and animation state
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.max_health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} healed to full health", username_for_log);
    }
}

// Move player randomly
#[spacetimedb::reducer]
pub fn random_move_player(ctx: &ReducerContext, max_distance: f32) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        // Generate pseudo-random movement using timestamp
        let time_value = unsafe { std::mem::transmute::<_, u64>(ctx.timestamp) };
        let random_x = ((time_value % 1000) as f32 / 1000.0 * max_distance * 2.0) - max_distance;
        let random_z = ((time_value % 1337) as f32 / 1337.0 * max_distance * 2.0) - max_distance;
        
        let new_x = player.position_x + random_x;
        let new_z = player.position_z + random_z;
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: new_x,
            position_y: player.position_y,
            position_z: new_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve existing aiming and animation state
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} moved randomly to ({}, {})", username_for_log, new_x, new_z);
    }
}

// Get player count
#[spacetimedb::reducer]
pub fn get_player_count(ctx: &ReducerContext) {
    let connected_count = ctx.db.player_data().iter().filter(|p| p.is_connected).count();
    let total_count = ctx.db.player_data().iter().count();
    
    log::info!("Player count - Connected: {}, Total: {}", connected_count, total_count);
}

// Get chunk count
#[spacetimedb::reducer]
pub fn get_chunk_count(ctx: &ReducerContext) {
    let chunk_count = ctx.db.terrain_chunk().iter().count();
    log::info!("Total chunks stored: {}", chunk_count);
}

// Update player aim direction
#[spacetimedb::reducer]
pub fn update_player_aim_direction(ctx: &ReducerContext, aim_x: f32, aim_y: f32, aim_z: f32) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Update aim direction
            aim_direction_x: aim_x,
            aim_direction_y: aim_y,
            aim_direction_z: aim_z,
            // Preserve other aiming and animation state
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} aim direction updated to ({}, {}, {})", username_for_log, aim_x, aim_y, aim_z);
    }
}

// Update player look direction
#[spacetimedb::reducer]
pub fn update_player_look_direction(ctx: &ReducerContext, look_x: f32, look_y: f32, look_z: f32) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve aim direction
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            // Update look direction
            look_direction_x: look_x,
            look_direction_y: look_y,
            look_direction_z: look_z,
            // Preserve other aiming and animation state
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} look direction updated to ({}, {}, {})", username_for_log, look_x, look_y, look_z);
    }
}

// Update player aiming state
#[spacetimedb::reducer]
pub fn update_player_aiming_state(ctx: &ReducerContext, is_aiming: bool, is_scoped: bool) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve directions
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            // Update aiming state
            is_aiming,
            is_scoped,
            // Preserve animation state
            animation_state: player.animation_state,
            animation_time: player.animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} aiming state updated - aiming: {}, scoped: {}", username_for_log, is_aiming, is_scoped);
    }
}

// Update player animation state
#[spacetimedb::reducer]
pub fn update_player_animation_state(ctx: &ReducerContext, animation_state: String, animation_time: f32) {
    let identity = ctx.sender;
    
    if let Some(player) = ctx.db.player_data().identity().find(identity) {
        let username = player.username.clone();
        let username_for_log = username.clone();
        
        let updated_player = PlayerData {
            identity,
            username,
            position_x: player.position_x,
            position_y: player.position_y,
            position_z: player.position_z,
            rotation_x: player.rotation_x,
            rotation_y: player.rotation_y,
            rotation_z: player.rotation_z,
            // Preserve directions and aiming state
            aim_direction_x: player.aim_direction_x,
            aim_direction_y: player.aim_direction_y,
            aim_direction_z: player.aim_direction_z,
            look_direction_x: player.look_direction_x,
            look_direction_y: player.look_direction_y,
            look_direction_z: player.look_direction_z,
            is_aiming: player.is_aiming,
            is_scoped: player.is_scoped,
            // Update animation state
            animation_state,
            animation_time,
            // Health and connection
            health: player.health,
            max_health: player.max_health,
            last_update: ctx.timestamp,
            is_connected: player.is_connected,
        };
        
        let animation_state_for_log = updated_player.animation_state.clone();
        ctx.db.player_data().identity().update(updated_player);
        log::info!("Player {} animation state updated to '{}' at time {}", username_for_log, animation_state_for_log, animation_time);
    }
}
