// SpacetimeDB connection management - these would normally be auto-generated
import { Identity, ConnectionId, EventContext } from '@clockworklabs/spacetimedb-sdk';
import { createDatabaseInterface, DatabaseInterface } from './tables';
import { registerPlayer, updatePlayerInput } from './reducers';
import { PlayerData, LoggedOutPlayerData, GameTickSchedule } from './types';

// Mock DbConnection class - normally this would be auto-generated
export class DbConnection {
    private uri: string = '';
    private moduleName: string = '';
    private token?: string;
    private isConnected: boolean = false;
    public db: DatabaseInterface;
    
    constructor() {
        this.db = createDatabaseInterface(this);
    }
    
    static builder(): DbConnectionBuilder {
        return new DbConnectionBuilder();
    }
    
    disconnect(): void {
        this.isConnected = false;
        cleanup();
    }
    
    isConnectedToDatabase(): boolean {
        return this.isConnected;
    }
    
    subscriptionBuilder(): any {
        return {
            subscribe: (query: string) => {
                console.log('Subscribing to:', query);
            }
        };
    }
}

export class DbConnectionBuilder {
    private uri: string = '';
    private moduleName: string = '';
    private token?: string;
    private onConnectCallback?: (conn: DbConnection, identity: Identity, token: string) => void;
    private onDisconnectCallback?: () => void;
    private onConnectErrorCallback?: (error: any) => void;
    
    withUri(uri: string): DbConnectionBuilder {
        this.uri = uri;
        return this;
    }
    
    withModuleName(moduleName: string): DbConnectionBuilder {
        this.moduleName = moduleName;
        return this;
    }
    
    withToken(token: string): DbConnectionBuilder {
        this.token = token;
        return this;
    }
    
    onConnect(callback: (conn: DbConnection, identity: Identity, token: string) => void): DbConnectionBuilder {
        this.onConnectCallback = callback;
        return this;
    }
    
    onDisconnect(callback: () => void): DbConnectionBuilder {
        this.onDisconnectCallback = callback;
        return this;
    }
    
    onConnectError(callback: (error: any) => void): DbConnectionBuilder {
        this.onConnectErrorCallback = callback;
        return this;
    }
    
    build(): DbConnection {
        const conn = new DbConnection();
        // Mock connection setup
        setTimeout(() => {
            if (this.onConnectCallback) {
                const mockIdentity = { toHexString: () => 'mock-identity' } as Identity;
                this.onConnectCallback(conn, mockIdentity, this.token || '');
            }
        }, 100);
        return conn;
    }
}

let connection: DbConnection | null = null;
let db: DatabaseInterface | null = null;

export function getConnection(): DbConnection | null {
    return connection;
}

export function getDatabase(): DatabaseInterface | null {
    return db;
}

export async function connectToDatabase(
    address: string,
    dbName: string,
    moduleName: string,
    identity?: string,
    token?: string
): Promise<DbConnection> {
    if (connection) {
        console.log('Already connected to database');
        return connection;
    }

    try {
        const builder = DbConnection.builder()
            .withUri(address)
            .withModuleName(moduleName);

        // Set up connection event handlers
        builder.onConnect((conn, identity, token) => {
            console.log('Connected to SpacetimeDB with identity:', identity.toHexString());
            setupDatabase(conn);
            setupSubscriptions(conn);
        });

        builder.onDisconnect(() => {
            console.log('Disconnected from SpacetimeDB');
            cleanup();
        });

        builder.onConnectError((error) => {
            console.error('Failed to connect to SpacetimeDB:', error);
            cleanup();
        });

        if (token) {
            builder.withToken(token);
        }

        connection = builder.build();
        
        return connection;
    } catch (error) {
        console.error('Error connecting to database:', error);
        throw error;
    }
}

function setupDatabase(conn: DbConnection) {
    // Create database interface with table handles
    db = createDatabaseInterface(conn);
    
    // Set up table event handlers for debugging/logging
    db.playerData.onInsert((ctx: EventContext, player: PlayerData) => {
        console.log('Player inserted:', player);
    });
    
    db.playerData.onUpdate((ctx: EventContext, oldPlayer: PlayerData, newPlayer: PlayerData) => {
        console.log('Player updated:', { old: oldPlayer, new: newPlayer });
    });
    
    db.playerData.onDelete((ctx: EventContext, player: PlayerData) => {
        console.log('Player deleted:', player);
    });
    
    db.loggedOutPlayerData.onInsert((ctx: EventContext, player: LoggedOutPlayerData) => {
        console.log('Logged out player inserted:', player);
    });
    
    db.loggedOutPlayerData.onDelete((ctx: EventContext, player: LoggedOutPlayerData) => {
        console.log('Logged out player deleted:', player);
    });
    
    db.gameTickSchedule.onInsert((ctx: EventContext, schedule: GameTickSchedule) => {
        console.log('Game tick schedule inserted:', schedule);
    });
    
    db.gameTickSchedule.onUpdate((ctx: EventContext, oldSchedule: GameTickSchedule, newSchedule: GameTickSchedule) => {
        console.log('Game tick schedule updated:', { old: oldSchedule, new: newSchedule });
    });
    
    db.gameTickSchedule.onDelete((ctx: EventContext, schedule: GameTickSchedule) => {
        console.log('Game tick schedule deleted:', schedule);
    });
}

function setupSubscriptions(conn: DbConnection) {
    try {
        // Subscribe to player data
        conn.subscriptionBuilder().subscribe('SELECT * FROM player_data');
        
        // Subscribe to logged out players
        conn.subscriptionBuilder().subscribe('SELECT * FROM logged_out_player');
        
        // Subscribe to game tick schedule
        conn.subscriptionBuilder().subscribe('SELECT * FROM game_tick_schedule');
        
        console.log('Subscriptions set up successfully');
    } catch (error) {
        console.error('Error setting up subscriptions:', error);
    }
}

function cleanup() {
    db = null;
    connection = null;
}

export function disconnect() {
    if (connection) {
        connection.disconnect();
        cleanup();
    }
}