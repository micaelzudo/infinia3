import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// === TYPE DEFINITIONS ===
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface InputState {
  w: boolean;
  s: boolean;
  a: boolean;
  d: boolean;
  space: boolean;
  shift: boolean;
  mouseX: number;
  mouseY: number;
  leftClick: boolean;
  rightClick: boolean;
}

export interface PlayerData {
  id: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  mana: number;
  input: InputState;
  lastUpdated: number;
}

export interface ConnectionState {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  url?: string;
  error?: string;
}

export interface SpacetimeDBContextType {
  // Connection management
  connection: ConnectionState;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  
  // Player management
  localPlayerId: string | null;
  players: Map<string, PlayerData>;
  
  // Core SpacetimeDB operations
  sendMessage: (message: any) => void;
  subscribe: (tableName: string, callback: (data: any) => void) => void;
  unsubscribe: (tableName: string, callback: (data: any) => void) => void;
  
  // Player operations
  updatePlayer: (playerData: Partial<PlayerData>) => void;
  getPlayer: (playerId: string) => PlayerData | undefined;
  getPlayers: () => PlayerData[];
  
  // Event callbacks
  onPlayerJoined?: (callback: (player: PlayerData) => void) => void;
  onPlayerLeft?: (callback: (playerId: string) => void) => void;
  onPlayerUpdate?: (callback: (player: PlayerData) => void) => void;
}

// === CONTEXT CREATION ===
const SpacetimeDBContext = createContext<SpacetimeDBContextType | null>(null);

// === PROVIDER COMPONENT ===
interface SpacetimeDBProviderProps {
  children: ReactNode;
  defaultUrl?: string;
  autoConnect?: boolean;
}

export const SpacetimeDBProvider: React.FC<SpacetimeDBProviderProps> = ({
  children,
  defaultUrl = 'ws://localhost:3000',
  autoConnect = false
}) => {
  // State management
  const [connection, setConnection] = useState<ConnectionState>({
    state: 'disconnected'
  });
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Map<string, PlayerData>>(new Map());
  const [subscriptions, setSubscriptions] = useState<Map<string, Set<(data: any) => void>>>(new Map());
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  
  // Event callbacks
  const [playerJoinedCallbacks, setPlayerJoinedCallbacks] = useState<Set<(player: PlayerData) => void>>(new Set());
  const [playerLeftCallbacks, setPlayerLeftCallbacks] = useState<Set<(playerId: string) => void>>(new Set());
  const [playerUpdateCallbacks, setPlayerUpdateCallbacks] = useState<Set<(player: PlayerData) => void>>(new Set());
  
  // === CONNECTION MANAGEMENT ===
  const connect = useCallback(async (url: string) => {
    if (connection.state === 'connected' || connection.state === 'connecting') {
      console.warn('[SpacetimeDB] Already connected or connecting');
      return;
    }
    
    setConnection({ state: 'connecting', url });
    
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('[SpacetimeDB] Connected to', url);
        setConnection({ state: 'connected', url });
        setWebsocket(ws);
        
        // Generate local player ID
        const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setLocalPlayerId(playerId);
        
        // Send join message
        ws.send(JSON.stringify({
          type: 'join_game',
          playerId: playerId,
          timestamp: Date.now()
        }));
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleIncomingMessage(message);
        } catch (error) {
          console.error('[SpacetimeDB] Failed to parse message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[SpacetimeDB] WebSocket error:', error);
        setConnection({ state: 'error', url, error: 'Connection failed' });
      };
      
      ws.onclose = () => {
        console.log('[SpacetimeDB] Disconnected');
        setConnection({ state: 'disconnected' });
        setWebsocket(null);
        setLocalPlayerId(null);
        setPlayers(new Map());
      };
      
    } catch (error) {
      console.error('[SpacetimeDB] Connection error:', error);
      setConnection({ state: 'error', url, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }, [connection.state]);
  
  const disconnect = useCallback(() => {
    if (websocket) {
      websocket.close();
    }
  }, [websocket]);
  
  // === MESSAGE HANDLING ===
  const handleIncomingMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'player_joined':
        if (message.player) {
          const player = message.player as PlayerData;
          setPlayers(prev => new Map(prev).set(player.id, player));
          playerJoinedCallbacks.forEach(callback => callback(player));
          console.log('[SpacetimeDB] Player joined:', player.id);
        }
        break;
        
      case 'player_left':
        if (message.playerId) {
          setPlayers(prev => {
            const newPlayers = new Map(prev);
            newPlayers.delete(message.playerId);
            return newPlayers;
          });
          playerLeftCallbacks.forEach(callback => callback(message.playerId));
          console.log('[SpacetimeDB] Player left:', message.playerId);
        }
        break;
        
      case 'player_update':
        if (message.player) {
          const player = message.player as PlayerData;
          setPlayers(prev => new Map(prev).set(player.id, player));
          playerUpdateCallbacks.forEach(callback => callback(player));
        }
        break;
        
      case 'players_list':
        if (message.players && Array.isArray(message.players)) {
          const newPlayers = new Map<string, PlayerData>();
          message.players.forEach((player: PlayerData) => {
            newPlayers.set(player.id, player);
          });
          setPlayers(newPlayers);
          console.log('[SpacetimeDB] Received players list:', message.players.length, 'players');
        }
        break;
        
      case 'table_update':
        if (message.tableName && subscriptions.has(message.tableName)) {
          const callbacks = subscriptions.get(message.tableName)!;
          callbacks.forEach(callback => callback(message.data));
        }
        break;
        
      default:
        console.log('[SpacetimeDB] Unknown message type:', message.type);
    }
  }, [subscriptions, playerJoinedCallbacks, playerLeftCallbacks, playerUpdateCallbacks]);
  
  // === CORE OPERATIONS ===
  const sendMessage = useCallback((message: any) => {
    if (websocket && connection.state === 'connected') {
      websocket.send(JSON.stringify(message));
    } else {
      console.warn('[SpacetimeDB] Cannot send message: not connected');
    }
  }, [websocket, connection.state]);
  
  const subscribe = useCallback((tableName: string, callback: (data: any) => void) => {
    setSubscriptions(prev => {
      const newSubs = new Map(prev);
      if (!newSubs.has(tableName)) {
        newSubs.set(tableName, new Set());
      }
      newSubs.get(tableName)!.add(callback);
      return newSubs;
    });
    
    // Send subscription request
    sendMessage({
      type: 'subscribe',
      tableName: tableName
    });
  }, [sendMessage]);
  
  const unsubscribe = useCallback((tableName: string, callback: (data: any) => void) => {
    setSubscriptions(prev => {
      const newSubs = new Map(prev);
      if (newSubs.has(tableName)) {
        newSubs.get(tableName)!.delete(callback);
        if (newSubs.get(tableName)!.size === 0) {
          newSubs.delete(tableName);
          // Send unsubscription request
          sendMessage({
            type: 'unsubscribe',
            tableName: tableName
          });
        }
      }
      return newSubs;
    });
  }, [sendMessage]);
  
  // === PLAYER OPERATIONS ===
  const updatePlayer = useCallback((playerData: Partial<PlayerData>) => {
    if (!localPlayerId) {
      console.warn('[SpacetimeDB] Cannot update player: no local player ID');
      return;
    }
    
    const fullPlayerData = {
      id: localPlayerId,
      ...playerData,
      lastUpdated: Date.now()
    };
    
    sendMessage({
      type: 'update_player',
      player: fullPlayerData
    });
  }, [localPlayerId, sendMessage]);
  
  const getPlayer = useCallback((playerId: string): PlayerData | undefined => {
    return players.get(playerId);
  }, [players]);
  
  const getPlayers = useCallback((): PlayerData[] => {
    return Array.from(players.values());
  }, [players]);
  
  // === EVENT CALLBACKS ===
  const onPlayerJoined = useCallback((callback: (player: PlayerData) => void) => {
    setPlayerJoinedCallbacks(prev => new Set(prev).add(callback));
  }, []);
  
  const onPlayerLeft = useCallback((callback: (playerId: string) => void) => {
    setPlayerLeftCallbacks(prev => new Set(prev).add(callback));
  }, []);
  
  const onPlayerUpdate = useCallback((callback: (player: PlayerData) => void) => {
    setPlayerUpdateCallbacks(prev => new Set(prev).add(callback));
  }, []);
  
  // === AUTO CONNECT ===
  useEffect(() => {
    if (autoConnect && connection.state === 'disconnected') {
      connect(defaultUrl);
    }
  }, [autoConnect, defaultUrl, connect, connection.state]);
  
  // === CLEANUP ===
  useEffect(() => {
    return () => {
      if (websocket) {
        websocket.close();
      }
    };
  }, [websocket]);
  
  // === CONTEXT VALUE ===
  const contextValue: SpacetimeDBContextType = {
    connection,
    connect,
    disconnect,
    localPlayerId,
    players,
    sendMessage,
    subscribe,
    unsubscribe,
    updatePlayer,
    getPlayer,
    getPlayers,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerUpdate
  };
  
  return (
    <SpacetimeDBContext.Provider value={contextValue}>
      {children}
    </SpacetimeDBContext.Provider>
  );
};

// === HOOK ===
export const useSpacetimeDB = (): SpacetimeDBContextType => {
  const context = useContext(SpacetimeDBContext);
  if (!context) {
    throw new Error('useSpacetimeDB must be used within a SpacetimeDBProvider');
  }
  return context;
};

// === GLOBAL WINDOW INTERFACE ===
declare global {
  interface Window {
    spacetimeDBContext?: SpacetimeDBContextType;
  }
}

// === EXPORT DEFAULT ===
export default SpacetimeDBContext;