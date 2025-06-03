// Defines types for custom network events if needed.
// For SpacetimeDB, direct table updates and reducer calls are often preferred
// over a separate event system, but this can be a place for defining
// the structures of data passed to reducers if not using generated types directly.

import { PlayerState } from './playerState';

export enum NetworkEventType {
    PlayerJoined = 'PlayerJoined',
    PlayerLeft = 'PlayerLeft',
    PlayerUpdate = 'PlayerUpdate',
    ChatMessage = 'ChatMessage',
    // Add other event types as needed
}

export interface BaseNetworkEvent {
    type: NetworkEventType;
    timestamp: number;
}

export interface PlayerJoinedEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerJoined;
    player: PlayerState; // Or just playerId if full state comes from table subscription
}

export interface PlayerLeftEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerLeft;
    playerId: string;
}

export interface PlayerUpdateEvent extends BaseNetworkEvent {
    type: NetworkEventType.PlayerUpdate;
    playerState: PlayerState;
}

export interface ChatMessageEvent extends BaseNetworkEvent {
    type: NetworkEventType.ChatMessage;
    senderId: string;
    message: string;
}

// Union type for all possible network events
export type NetworkEvent =
    | PlayerJoinedEvent
    | PlayerLeftEvent
    | PlayerUpdateEvent
    | ChatMessageEvent;

// Example of data structure for a reducer call (conceptually similar to an event)
export interface UpdatePlayerStateReducerArgs {
    playerId: string;
    posX: number;
    posY: number;
    posZ: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    rotW: number;
    // ... other relevant fields like input state
    inputForward?: boolean;
    inputBackward?: boolean;
    // etc.
}

// This file provides a conceptual layer. In practice with SpacetimeDB,
// you'll primarily interact with generated client-side table classes and reducer functions.