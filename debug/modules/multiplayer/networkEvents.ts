// Defines types for custom network events if needed.
// Network Event Definitions for Infinia Multiplayer
// Legacy event system - SpacetimeDB uses table subscriptions and reducer calls instead
// This is kept for backward compatibility and as a bridge to SpacetimeDB events

import { PlayerState } from './playerState';
import { PlayerData, InputState, Vector3 } from './generated/types';

export enum NetworkEventType {
    PlayerJoined = 'PlayerJoined',
    PlayerLeft = 'PlayerLeft', 
    PlayerUpdate = 'PlayerUpdate',
    ChatMessage = 'ChatMessage',
    GameTick = 'GameTick'
}

export interface BaseNetworkEvent {
    type: NetworkEventType;
    timestamp: number;
}

export interface PlayerJoinedEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerJoined;
    player: PlayerState;
    playerData: PlayerData; // SpacetimeDB data
}

export interface PlayerLeftEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerLeft;
    playerId: string;
    identity: string; // SpacetimeDB identity
}

export interface PlayerUpdateEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerUpdate;
    playerState: PlayerState;
    playerData: PlayerData; // SpacetimeDB data
}

export interface ChatMessageEvent extends BaseNetworkEvent {
    type: NetworkEventType.ChatMessage;
    senderId: string;
    message: string;
}

export interface GameTickEvent extends BaseNetworkEvent {
    type: NetworkEventType.GameTick;
    tickNumber: number;
    deltaTime: number;
}

// Union type for all possible network events
export type NetworkEvent =
    | PlayerJoinedEvent
    | PlayerLeftEvent
    | PlayerUpdateEvent
    | ChatMessageEvent
    | GameTickEvent;

// Event emitter for handling SpacetimeDB table updates as events
export class SpacetimeEventEmitter {
    private listeners: Map<NetworkEventType, ((event: NetworkEvent) => void)[]> = new Map();

    on(eventType: NetworkEventType, callback: (event: NetworkEvent) => void) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType)!.push(callback);
    }

    off(eventType: NetworkEventType, callback: (event: NetworkEvent) => void) {
        const callbacks = this.listeners.get(eventType);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event: NetworkEvent) {
        const callbacks = this.listeners.get(event.type);
        if (callbacks) {
            callbacks.forEach(callback => callback(event));
        }
    }

    // Helper methods to convert SpacetimeDB table updates to events
    emitPlayerJoined(playerData: PlayerData) {
        const event: PlayerJoinedEvent = {
            type: NetworkEventType.PlayerJoined,
            timestamp: Date.now(),
            player: {
                playerId: playerData.identity.toString(),
                position: { x: playerData.position.x, y: playerData.position.y, z: playerData.position.z },
                rotation: { x: playerData.rotation.x, y: playerData.rotation.y, z: playerData.rotation.z, w: 1 },
                lastUpdateTime: Date.now(),
                health: playerData.health,
                mana: playerData.mana,
                username: playerData.username
            },
            playerData
        };
        this.emit(event);
    }

    emitPlayerLeft(identity: string) {
        const event: PlayerLeftEvent = {
            type: NetworkEventType.PlayerLeft,
            timestamp: Date.now(),
            playerId: identity,
            identity
        };
        this.emit(event);
    }

    emitPlayerUpdate(playerData: PlayerData) {
        const event: PlayerUpdateEvent = {
            type: NetworkEventType.PlayerUpdate,
            timestamp: Date.now(),
            playerState: {
                playerId: playerData.identity.toString(),
                position: { x: playerData.position.x, y: playerData.position.y, z: playerData.position.z },
                rotation: { x: playerData.rotation.x, y: playerData.rotation.y, z: playerData.rotation.z, w: 1 },
                lastUpdateTime: Date.now(),
                health: playerData.health,
                mana: playerData.mana,
                username: playerData.username
            },
            playerData
        };
        this.emit(event);
    }

    emitGameTick(tickNumber: number, deltaTime: number) {
        const event: GameTickEvent = {
            type: NetworkEventType.GameTick,
            timestamp: Date.now(),
            tickNumber,
            deltaTime
        };
        this.emit(event);
    }
}

// Global event emitter instance
export const spacetimeEvents = new SpacetimeEventEmitter();

// Legacy reducer argument types for backward compatibility
export interface UpdatePlayerStateReducerArgs {
    playerId: string;
    posX: number;
    posY: number;
    posZ: number;
    rotY: number;
    inputForward?: boolean;
    inputBackward?: boolean;
    inputLeft?: boolean;
    inputRight?: boolean;
    inputJump?: boolean;
    inputSprint?: boolean;
    mouseX?: number;
    mouseY?: number;
}