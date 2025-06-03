// SpacetimeDB Configuration
import { DbConnection } from '@clockworklabs/spacetimedb-sdk';

// Replace with your actual SpacetimeDB server URL and database name
const SPACETIMEDB_URL = "ws://localhost:3000"; // Or your remote server URL
const DATABASE_NAME = "your_database_name"; // The name of your SpacetimeDB database
const MODULE_NAME = "your_module_name"; // The name of your SpacetimeDB module

let dbConnection: DbConnection | null = null;

export const getSpacetimeDBInstance = (): DbConnection | null => {
    return dbConnection;
};

export const connectToSpacetimeDB = async (identity?: string, token?: string): Promise<DbConnection> => {
    if (dbConnection && dbConnection.status() === 'connected') {
        console.log("Already connected to SpacetimeDB.");
        return dbConnection;
    }

    console.log(`Attempting to connect to SpacetimeDB at ${SPACETIMEDB_URL}, DB: ${DATABASE_NAME}, Module: ${MODULE_NAME}`);

    const builder = DbConnection.builder()
        .address(SPACETIMEDB_URL)
        .dbName(DATABASE_NAME)
        .moduleName(MODULE_NAME);

    if (identity && token) {
        builder.identity(identity, token);
        console.log("Connecting with identity.");
    } else {
        console.log("Connecting anonymously.");
    }

    dbConnection = builder.build();

    return new Promise((resolve, reject) => {
        if (!dbConnection) {
            reject(new Error("Failed to build DbConnection."));
            return;
        }
        dbConnection.onConnect(() => {
            console.log("Successfully connected to SpacetimeDB!");
            // You might want to register reducers and subscribe to tables here
            // e.g., registerPlayerStateReducers(dbConnection);
            //       subscribeToPlayerStateTable(dbConnection);
            resolve(dbConnection!);
        });

        dbConnection.onDisconnect((reason) => {
            console.warn(`Disconnected from SpacetimeDB: ${reason}`);
            // Optionally, attempt to reconnect or notify the user
        });

        dbConnection.onError((error) => {
            console.error("SpacetimeDB connection error:", error);
            reject(error);
        });

        dbConnection.connect();
    });
};

export const disconnectFromSpacetimeDB = () => {
    if (dbConnection) {
        dbConnection.disconnect();
        dbConnection = null;
        console.log("Disconnected from SpacetimeDB.");
    }
};

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