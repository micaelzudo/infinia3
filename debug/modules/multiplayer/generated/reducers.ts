// SpacetimeDB reducer bindings - these would normally be auto-generated

import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from './connection';
import { InputState } from './types';

// Reducer function types
export type ReducerResult<T = void> = Promise<T>;

// Connection reference
let connection: DbConnection | null = null;

export function setConnection(conn: DbConnection) {
    connection = conn;
}

function getConnection(): DbConnection {
    if (!connection) {
        throw new Error('SpacetimeDB connection not initialized. Call setConnection() first.');
    }
    return connection;
}

// Register player reducer
export async function registerPlayer(username: string): ReducerResult {
    const conn = getConnection();
    return conn.call('register_player', [username]);
}

// Update player input reducer
export async function updatePlayerInput(input: InputState): ReducerResult {
    const conn = getConnection();
    return conn.call('update_player_input', [input]);
}

// Store terrain chunk reducer
export async function storeTerrainChunk(
    chunkKey: string,
    planetType: string,
    x: number,
    y: number,
    z: number,
    noiseData: number[]
): ReducerResult {
    const conn = getConnection();
    return conn.call('store_terrain_chunk', [chunkKey, planetType, x, y, z, noiseData]);
}

// Get terrain chunk reducer
export async function getTerrainChunk(chunkKey: string): ReducerResult {
    const conn = getConnection();
    return conn.call('get_terrain_chunk', [chunkKey]);
}

// Store initial chunks for planet reducer
export async function storeInitialChunksForPlanet(
    planetType: string,
    radius: number
): ReducerResult {
    const conn = getConnection();
    return conn.call('store_initial_chunks_for_planet', [planetType, radius]);
}

// Convenience function to create InputState
export function createInputState(params: {
    w?: boolean;
    s?: boolean;
    a?: boolean;
    d?: boolean;
    space?: boolean;
    shift?: boolean;
    mouse_x?: number;
    mouse_y?: number;
    left_click?: boolean;
    right_click?: boolean;
    sequence?: number;
}): InputState {
    return {
        w: params.w || false,
        s: params.s || false,
        a: params.a || false,
        d: params.d || false,
        space: params.space || false,
        shift: params.shift || false,
        mouse_x: params.mouse_x || 0.0,
        mouse_y: params.mouse_y || 0.0,
        left_click: params.left_click || false,
        right_click: params.right_click || false,
        sequence: params.sequence || 0,
    };
}

// Convenience function to create Vector3
export function createVector3(x: number = 0, y: number = 0, z: number = 0) {
    return { x, y, z };
}