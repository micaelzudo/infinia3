// Example usage of the Infinia Multiplayer Module
// This file demonstrates how to use the SpacetimeDB integration

import {
    connect,
    disconnectFromDatabase,
    getConnectionInstance,
    getDatabaseInstance,
    PlayerData,
    InputState,
    Vector3,
    DatabaseInterface,
    registerPlayer,
    updatePlayerInput
} from './spacetimeConfig';
import { spacetimeEvents, NetworkEventType } from './networkEvents';

// Example class for managing multiplayer functionality
export class MultiplayerManager {
    private isConnected = false;
    private currentPlayer: PlayerData | null = null;
    private database: DatabaseInterface | null = null;

    async connect(username: string): Promise<boolean> {
        try {
            console.log('Connecting to SpacetimeDB...');
            const connection = await connect();
            
            if (connection) {
                this.isConnected = true;
                console.log('Connected to SpacetimeDB successfully!');
                
                // Get database interface
                this.database = getDatabaseInstance();
                this.setupTableSubscriptions();
                
                // Register the player
                await this.registerPlayer(username);
                
                return true;
            }
        } catch (error) {
            console.error('Failed to connect to SpacetimeDB:', error);
        }
        return false;
    }

    private setupTableSubscriptions() {
        if (!this.database) return;

        // Subscribe to player table updates
        this.database.playerData.onInsert((playerData) => {
            console.log('Player joined:', playerData.username);
            spacetimeEvents.emitPlayerJoined(playerData);
        });

        this.database.playerData.onUpdate((playerData) => {
            console.log('Player updated:', playerData.username);
            spacetimeEvents.emitPlayerUpdate(playerData);
        });

        this.database.playerData.onDelete((playerData) => {
            console.log('Player left:', playerData.username);
            spacetimeEvents.emitPlayerLeft(playerData.identity.toString());
        });
    }

    private async registerPlayer(username: string): Promise<void> {
        try {
            await registerPlayer(username);
            console.log(`Player '${username}' registered successfully!`);
            
            // Find our player in the table
            if (this.database) {
                const players = this.database.playerData.getAll();
                this.currentPlayer = players.find(p => p.username === username) || null;
            }
        } catch (error) {
            console.error('Failed to register player:', error);
        }
    }

    async updateInput(inputState: Partial<InputState>): Promise<void> {
        if (!this.isConnected || !this.currentPlayer) {
            console.warn('Not connected or no current player');
            return;
        }

        try {
            const fullInputState: InputState = {
                forward: inputState.forward || false,
                backward: inputState.backward || false,
                left: inputState.left || false,
                right: inputState.right || false,
                jump: inputState.jump || false,
                sprint: inputState.sprint || false,
                mouse_x: inputState.mouse_x || 0,
                mouse_y: inputState.mouse_y || 0
            };

            await updatePlayerInput(fullInputState);
        } catch (error) {
            console.error('Failed to update player input:', error);
        }
    }

    getCurrentPlayer(): PlayerData | null {
        return this.currentPlayer;
    }

    getAllPlayers(): PlayerData[] {
        return this.database?.playerData.getAll() || [];
    }

    getPlayerByUsername(username: string): PlayerData | null {
        const players = this.getAllPlayers();
        return players.find(p => p.username === username) || null;
    }

    // Event handling methods
    onPlayerJoined(callback: (playerData: PlayerData) => void) {
        spacetimeEvents.on(NetworkEventType.PlayerJoined, (event) => {
            if (event.type === NetworkEventType.PlayerJoined) {
                callback(event.playerData);
            }
        });
    }

    onPlayerLeft(callback: (identity: string) => void) {
        spacetimeEvents.on(NetworkEventType.PlayerLeft, (event) => {
            if (event.type === NetworkEventType.PlayerLeft) {
                callback(event.identity);
            }
        });
    }

    onPlayerUpdate(callback: (playerData: PlayerData) => void) {
        spacetimeEvents.on(NetworkEventType.PlayerUpdate, (event) => {
            if (event.type === NetworkEventType.PlayerUpdate) {
                callback(event.playerData);
            }
        });
    }

    disconnect() {
        if (this.isConnected) {
            disconnectFromDatabase();
            this.isConnected = false;
            this.currentPlayer = null;
            this.database = null;
            console.log('Disconnected from SpacetimeDB');
        }
    }

    isPlayerConnected(): boolean {
        return this.isConnected && this.currentPlayer !== null;
    }
}

// Example usage:
/*
const multiplayerManager = new MultiplayerManager();

// Connect and register player
await multiplayerManager.connect('PlayerName');

// Set up event listeners
multiplayerManager.onPlayerJoined((playerData) => {
    console.log(`${playerData.username} joined the game!`);
});

multiplayerManager.onPlayerLeft((identity) => {
    console.log(`Player ${identity} left the game`);
});

multiplayerManager.onPlayerUpdate((playerData) => {
    console.log(`${playerData.username} moved to:`, playerData.position);
});

// Update player input (e.g., from game loop)
const inputState = {
    forward: true,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: true,
    mouse_x: 10.5,
    mouse_y: -5.2
};

await multiplayerManager.updateInput(inputState);

// Get current player info
const currentPlayer = multiplayerManager.getCurrentPlayer();
if (currentPlayer) {
    console.log('Current player position:', currentPlayer.position);
    console.log('Current player health:', currentPlayer.health);
}

// Get all players
const allPlayers = multiplayerManager.getAllPlayers();
console.log('All players:', allPlayers.map(p => p.username));

// Disconnect when done
multiplayerManager.disconnect();
*/