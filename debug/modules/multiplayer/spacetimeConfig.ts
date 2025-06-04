// SpacetimeDB Configuration
import { Identity, ConnectionId } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection, connectToDatabase, getConnection, getDatabase, disconnect } from './generated/connection';
import { DatabaseInterface } from './generated/tables';
import { registerPlayer, updatePlayerInput, storeTerrainChunk, getTerrainChunk, storeInitialChunksForPlanet } from './generated/reducers';
import { PlayerData, LoggedOutPlayerData, Vector3, InputState, GameTickSchedule, TerrainChunk } from './generated/types';

// SpacetimeDB configuration
export const SPACETIMEDB_URL = 'ws://localhost:3000';
export const DATABASE_NAME = 'infinia-multiplayer';
export const MODULE_NAME = 'infinia-multiplayer';

// Re-export types
export type {
    PlayerData,
    LoggedOutPlayerData,
    Vector3,
    InputState,
    GameTickSchedule,
    TerrainChunk,
    DatabaseInterface
};

// Re-export reducer functions
export {
    registerPlayer,
    updatePlayerInput,
    storeTerrainChunk,
    getTerrainChunk,
    storeInitialChunksForPlanet
};

// Connection management functions
export function getConnectionInstance() {
    return getConnection();
}

export function getDatabaseInstance() {
    return getDatabase();
}

export async function connect(identity?: string, token?: string) {
    try {
        const connection = await connectToDatabase(
            SPACETIMEDB_URL,
            DATABASE_NAME,
            MODULE_NAME,
            identity,
            token
        );
        console.log('Connected to SpacetimeDB successfully');
        return connection;
    } catch (error) {
        console.error('Failed to connect to SpacetimeDB:', error);
        throw error;
    }
}

export function disconnectFromDatabase() {
    disconnect();
    console.log('Disconnected from SpacetimeDB');
}

// Placeholder for registering reducers - you'll generate these with the SpacetimeDB CLI
// export const registerPlayerStateReducers = (connection: DbConnection) => {
//     // Example: connection.registerReducer('update_player_state', UpdatePlayerStateReducer);
//     console.log("Player state reducers registered (placeholder).");
// };

// Placeholder for subscribing to tables - you'll generate table classes with the SpacetimeDB CLI
// export const subscribeToPlayerStateTable = (connection: DbConnection) => {
//     // Example: connection.subscribe(["SELECT * FROM PlayerState"], () => {
//     //     PlayerState.addOnInsert((playerState, _reducerEvent) => {
//     //         console.log("Player inserted:", playerState);
//     //         // Call your function to handle new player creation in the game world
//     //     });
//     //     PlayerState.addOnUpdate((oldPlayerState, newPlayerState, _reducerEvent) => {
//     //         console.log("Player updated:", newPlayerState);
//     //         // Call your function to update existing player in the game world
//     //     });
//     //     PlayerState.addOnDelete((deletedPlayerState, _reducerEvent) => {
//     //         console.log("Player deleted:", deletedPlayerState);
//     //         // Call your function to remove player from the game world
//     //     });
//     // });
//     console.log("Subscribed to PlayerState table (placeholder).");
// };