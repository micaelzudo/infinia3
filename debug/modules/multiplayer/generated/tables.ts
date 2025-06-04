// SpacetimeDB table bindings - these would normally be auto-generated
import { Identity, EventContext } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection } from './connection';
import { PlayerData, LoggedOutPlayerData, GameTickSchedule } from './types';

// Table event handler types
export type PlayerDataInsertHandler = (ctx: EventContext, player: PlayerData) => void;
export type PlayerDataUpdateHandler = (ctx: EventContext, oldPlayer: PlayerData, newPlayer: PlayerData) => void;
export type PlayerDataDeleteHandler = (ctx: EventContext, player: PlayerData) => void;

export type LoggedOutPlayerDataInsertHandler = (ctx: EventContext, player: LoggedOutPlayerData) => void;
export type LoggedOutPlayerDataUpdateHandler = (ctx: EventContext, oldPlayer: LoggedOutPlayerData, newPlayer: LoggedOutPlayerData) => void;
export type LoggedOutPlayerDataDeleteHandler = (ctx: EventContext, player: LoggedOutPlayerData) => void;

export type GameTickScheduleInsertHandler = (ctx: EventContext, schedule: GameTickSchedule) => void;
export type GameTickScheduleUpdateHandler = (ctx: EventContext, oldSchedule: GameTickSchedule, newSchedule: GameTickSchedule) => void;
export type GameTickScheduleDeleteHandler = (ctx: EventContext, schedule: GameTickSchedule) => void;

// Table handle classes that mimic the SpacetimeDB SDK generated table handles
export class PlayerDataTableHandle {
    private connection: DbConnection;
    private insertHandlers: PlayerDataInsertHandler[] = [];
    private updateHandlers: PlayerDataUpdateHandler[] = [];
    private deleteHandlers: PlayerDataDeleteHandler[] = [];

    constructor(connection: DbConnection) {
        this.connection = connection;
    }

    onInsert(handler: PlayerDataInsertHandler): void {
        this.insertHandlers.push(handler);
    }

    onUpdate(handler: PlayerDataUpdateHandler): void {
        this.updateHandlers.push(handler);
    }

    onDelete(handler: PlayerDataDeleteHandler): void {
        this.deleteHandlers.push(handler);
    }

    removeOnInsert(handler: PlayerDataInsertHandler): void {
        const index = this.insertHandlers.indexOf(handler);
        if (index > -1) {
            this.insertHandlers.splice(index, 1);
        }
    }

    removeOnUpdate(handler: PlayerDataUpdateHandler): void {
        const index = this.updateHandlers.indexOf(handler);
        if (index > -1) {
            this.updateHandlers.splice(index, 1);
        }
    }

    removeOnDelete(handler: PlayerDataDeleteHandler): void {
        const index = this.deleteHandlers.indexOf(handler);
        if (index > -1) {
            this.deleteHandlers.splice(index, 1);
        }
    }

    // Query methods
    getAll(): PlayerData[] {
        // This would be implemented by the actual SpacetimeDB SDK
        throw new Error('getAll() method should be implemented by SpacetimeDB SDK');
    }

    findByUsername(username: string): PlayerData | undefined {
        // This would be implemented by the actual SpacetimeDB SDK
        throw new Error('findByUsername() method should be implemented by SpacetimeDB SDK');
    }

    findByIdentity(identity: Identity): PlayerData | undefined {
        // This would be implemented by the actual SpacetimeDB SDK
        throw new Error('findByIdentity() method should be implemented by SpacetimeDB SDK');
    }

    // Internal methods for triggering events (called by SDK)
    _triggerInsert(ctx: EventContext, player: PlayerData): void {
        this.insertHandlers.forEach(handler => handler(ctx, player));
    }

    _triggerUpdate(ctx: EventContext, oldPlayer: PlayerData, newPlayer: PlayerData): void {
        this.updateHandlers.forEach(handler => handler(ctx, oldPlayer, newPlayer));
    }

    _triggerDelete(ctx: EventContext, player: PlayerData): void {
        this.deleteHandlers.forEach(handler => handler(ctx, player));
    }
}

export class LoggedOutPlayerDataTableHandle {
    private connection: DbConnection;
    private insertHandlers: LoggedOutPlayerDataInsertHandler[] = [];
    private updateHandlers: LoggedOutPlayerDataUpdateHandler[] = [];
    private deleteHandlers: LoggedOutPlayerDataDeleteHandler[] = [];

    constructor(connection: DbConnection) {
        this.connection = connection;
    }

    onInsert(handler: LoggedOutPlayerDataInsertHandler): void {
        this.insertHandlers.push(handler);
    }

    onUpdate(handler: LoggedOutPlayerDataUpdateHandler): void {
        this.updateHandlers.push(handler);
    }

    onDelete(handler: LoggedOutPlayerDataDeleteHandler): void {
        this.deleteHandlers.push(handler);
    }

    removeOnInsert(handler: LoggedOutPlayerDataInsertHandler): void {
        const index = this.insertHandlers.indexOf(handler);
        if (index > -1) {
            this.insertHandlers.splice(index, 1);
        }
    }

    removeOnUpdate(handler: LoggedOutPlayerDataUpdateHandler): void {
        const index = this.updateHandlers.indexOf(handler);
        if (index > -1) {
            this.updateHandlers.splice(index, 1);
        }
    }

    removeOnDelete(handler: LoggedOutPlayerDataDeleteHandler): void {
        const index = this.deleteHandlers.indexOf(handler);
        if (index > -1) {
            this.deleteHandlers.splice(index, 1);
        }
    }

    // Query methods
    getAll(): LoggedOutPlayerData[] {
        // This would be implemented by the actual SpacetimeDB SDK
        throw new Error('getAll() method should be implemented by SpacetimeDB SDK');
    }

    // Internal methods for triggering events (called by SDK)
    _triggerInsert(ctx: EventContext, player: LoggedOutPlayerData): void {
        this.insertHandlers.forEach(handler => handler(ctx, player));
    }

    _triggerUpdate(ctx: EventContext, oldPlayer: LoggedOutPlayerData, newPlayer: LoggedOutPlayerData): void {
        this.updateHandlers.forEach(handler => handler(ctx, oldPlayer, newPlayer));
    }

    _triggerDelete(ctx: EventContext, player: LoggedOutPlayerData): void {
        this.deleteHandlers.forEach(handler => handler(ctx, player));
    }
}

export class GameTickScheduleTableHandle {
    private connection: DbConnection;
    private insertHandlers: GameTickScheduleInsertHandler[] = [];
    private updateHandlers: GameTickScheduleUpdateHandler[] = [];
    private deleteHandlers: GameTickScheduleDeleteHandler[] = [];

    constructor(connection: DbConnection) {
        this.connection = connection;
    }

    onInsert(handler: GameTickScheduleInsertHandler): void {
        this.insertHandlers.push(handler);
    }

    onUpdate(handler: GameTickScheduleUpdateHandler): void {
        this.updateHandlers.push(handler);
    }

    onDelete(handler: GameTickScheduleDeleteHandler): void {
        this.deleteHandlers.push(handler);
    }

    removeOnInsert(handler: GameTickScheduleInsertHandler): void {
        const index = this.insertHandlers.indexOf(handler);
        if (index > -1) {
            this.insertHandlers.splice(index, 1);
        }
    }

    removeOnUpdate(handler: GameTickScheduleUpdateHandler): void {
        const index = this.updateHandlers.indexOf(handler);
        if (index > -1) {
            this.updateHandlers.splice(index, 1);
        }
    }

    removeOnDelete(handler: GameTickScheduleDeleteHandler): void {
        const index = this.deleteHandlers.indexOf(handler);
        if (index > -1) {
            this.deleteHandlers.splice(index, 1);
        }
    }

    // Internal methods for triggering events (would be called by SDK)
    _triggerInsert(ctx: EventContext, schedule: GameTickSchedule): void {
        this.insertHandlers.forEach(handler => handler(ctx, schedule));
    }

    _triggerUpdate(ctx: EventContext, oldSchedule: GameTickSchedule, newSchedule: GameTickSchedule): void {
        this.updateHandlers.forEach(handler => handler(ctx, oldSchedule, newSchedule));
    }

    _triggerDelete(ctx: EventContext, schedule: GameTickSchedule): void {
        this.deleteHandlers.forEach(handler => handler(ctx, schedule));
    }
}

// Database interface that mimics the SpacetimeDB SDK generated db interface
export interface DatabaseInterface {
    playerData: PlayerDataTableHandle;
    loggedOutPlayerData: LoggedOutPlayerDataTableHandle;
    gameTickSchedule: GameTickScheduleTableHandle;
}

// Factory function to create database interface
export function createDatabaseInterface(connection: DbConnection): DatabaseInterface {
    return {
        playerData: new PlayerDataTableHandle(connection),
        loggedOutPlayerData: new LoggedOutPlayerDataTableHandle(connection),
        gameTickSchedule: new GameTickScheduleTableHandle(connection)
    };
}