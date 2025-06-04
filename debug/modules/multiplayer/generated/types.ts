// Generated types from SpacetimeDB Rust module

import { Identity, Timestamp } from '@clockworklabs/spacetimedb-sdk';

// Vector3 type from common.rs
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// InputState type from common.rs
export interface InputState {
    w: boolean;
    s: boolean;
    a: boolean;
    d: boolean;
    space: boolean;
    shift: boolean;
    mouse_x: number;
    mouse_y: number;
    left_click: boolean;
    right_click: boolean;
    sequence: number;
}

// PlayerData table type from lib.rs
export interface PlayerData {
    identity: Identity;
    username: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    max_health: number;
    mana: number;
    max_mana: number;
    is_moving: boolean;
    is_running: boolean;
    last_input_seq: number;
    input: InputState;
    last_update: Timestamp;
}

// LoggedOutPlayerData table type from lib.rs
export interface LoggedOutPlayerData {
    identity: Identity;
    username: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    max_health: number;
    mana: number;
    max_mana: number;
    last_seen: Timestamp;
}

// GameTickSchedule table type from lib.rs
export interface GameTickSchedule {
    scheduled_id: bigint;
    scheduled_at: any; // ScheduleAt type
}

// TerrainChunk table type from lib.rs
export interface TerrainChunk {
    chunk_key: string;
    planet_type: string;
    x: number;
    y: number;
    z: number;
    noise_data: number[];
    created_at: Timestamp;
    last_accessed: Timestamp;
}

// Game constants from common.rs
export const PLAYER_SPEED = 7.5;
export const SPRINT_MULTIPLIER = 1.8;
export const MOUSE_SENSITIVITY = 0.002;