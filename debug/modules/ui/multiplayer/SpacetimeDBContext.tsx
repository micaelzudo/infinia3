import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  connect,
  disconnect as disconnectFromDatabase,
  getDatabaseInstance,
  registerPlayer as callRegisterPlayer,
  updatePlayerInput as callUpdatePlayerInput,
  PlayerData as SpacetimePlayerData,
  InputState as SpacetimeInputState,
  Vector3 as SpacetimeVector3,
  DatabaseInterface
} from '../../multiplayer/spacetimeConfig';

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
  mouse_x: number;
  mouse_y: number;
  left_click: boolean;
  right_click: boolean;
  sequence: number;
}

export interface PlayerData {
  identity: string;
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
  last_update: string;
}

export interface ConnectionState {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  url?: string;
  error?: string;
}

export interface SpacetimeDBContextType {
  // Connection state
  connection: ConnectionState;
  localPlayerId: string | null;
  players: Map<string, PlayerData>;
  
  // Connection management
  connect: (username?: string) => Promise<void>;
  disconnect: () => void;
  
  // Player management
  registerPlayer: (username: string) => Promise<void>;
  sendPlayerInput: (input: InputState) => void;
  getPlayerData: (playerId: string) => PlayerData | null;
  getAllPlayers: () => PlayerData[];
  
  // Core SpacetimeDB operations
  subscribe: (tableName: string, callback: (data: any) => void) => void;
  unsubscribe: (tableName: string, callback: (data: any) => void) => void;
  callReducer: (reducerName: string, args: any[]) => Promise<void>;
  
  // Event callbacks
  onPlayerJoined: (callback: (player: PlayerData) => void) => void;
  onPlayerLeft: (callback: (playerId: string) => void) => void;
  onPlayerUpdate: (callback: (player: PlayerData) => void) => void;
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
  const [database, setDatabase] = useState<DatabaseInterface | null>(null);
  
  // Event callbacks
  const [playerJoinedCallbacks, setPlayerJoinedCallbacks] = useState<Set<(player: PlayerData) => void>>(new Set());
  const [playerLeftCallbacks, setPlayerLeftCallbacks] = useState<Set<(playerId: string) => void>>(new Set());
  const [playerUpdateCallbacks, setPlayerUpdateCallbacks] = useState<Set<(player: PlayerData) => void>>(new Set());
  
  // === CONNECTION MANAGEMENT ===
  const connectToSpacetime = useCallback(async (username?: string) => {
    if (connection.state === 'connected' || connection.state === 'connecting') {
      console.warn('[SpacetimeDB] Already connected or connecting');
      return;
    }
    
    setConnection({ state: 'connecting' });
    
    try {
      // Connect to SpacetimeDB
      const spacetimeConnection = await connect();
      
      if (spacetimeConnection) {
        console.log('[SpacetimeDB] Connected successfully');
        setConnection({ state: 'connected' });
        
        // Get database interface
        const db = getDatabaseInstance();
        setDatabase(db);
        
        // Set up event handlers
        if (db) {
          db.playerData.onInsert((playerData: SpacetimePlayerData) => {
            const convertedPlayer = convertSpacetimePlayer(playerData);
            setPlayers(prev => new Map(prev).set(convertedPlayer.identity, convertedPlayer));
            playerJoinedCallbacks.forEach(callback => callback(convertedPlayer));
            console.log('[SpacetimeDB] Player joined:', convertedPlayer.username);
          });
          
          db.playerData.onUpdate((playerData: SpacetimePlayerData) => {
            const convertedPlayer = convertSpacetimePlayer(playerData);
            setPlayers(prev => new Map(prev.set(convertedPlayer.identity, convertedPlayer)));
            playerUpdateCallbacks.forEach(callback => callback(convertedPlayer));
          });
          
          db.playerData.onDelete((playerData: SpacetimePlayerData) => {
            const convertedPlayer = convertSpacetimePlayer(playerData);
            setPlayers(prev => {
              const newPlayers = new Map(prev);
              newPlayers.delete(convertedPlayer.identity);
              return newPlayers;
            });
            playerLeftCallbacks.forEach(callback => callback(convertedPlayer.identity));
            console.log('[SpacetimeDB] Player left:', convertedPlayer.username);
          });
        }
        
        // Register player if username provided
        if (username) {
          await registerPlayer(username);
          setLocalPlayerId(username); // Use username as local player ID for now
        }
      }
      
    } catch (error) {
      console.error('[SpacetimeDB] Connection error:', error);
      setConnection({ state: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }, [connection.state, playerJoinedCallbacks, playerLeftCallbacks, playerUpdateCallbacks]);
  
  const disconnect = useCallback(() => {
    disconnectFromDatabase();
    setConnection({ state: 'disconnected' });
    setDatabase(null);
    setLocalPlayerId(null);
    setPlayers(new Map());
  }, []);
  
  // === UTILITY FUNCTIONS ===
  const convertSpacetimePlayer = useCallback((spacetimePlayer: SpacetimePlayerData): PlayerData => {
    return {
      identity: spacetimePlayer.identity.toString(),
      username: spacetimePlayer.username,
      position: spacetimePlayer.position,
      rotation: spacetimePlayer.rotation,
      health: spacetimePlayer.health,
      max_health: spacetimePlayer.max_health,
      mana: spacetimePlayer.mana,
      max_mana: spacetimePlayer.max_mana,
      is_moving: spacetimePlayer.is_moving,
      is_running: spacetimePlayer.is_running,
      last_input_seq: spacetimePlayer.last_input_seq,
      input: {
        w: spacetimePlayer.input.w,
        s: spacetimePlayer.input.s,
        a: spacetimePlayer.input.a,
        d: spacetimePlayer.input.d,
        space: spacetimePlayer.input.space,
        shift: spacetimePlayer.input.shift,
        mouse_x: spacetimePlayer.input.mouse_x,
        mouse_y: spacetimePlayer.input.mouse_y,
        left_click: spacetimePlayer.input.left_click,
        right_click: spacetimePlayer.input.right_click,
        sequence: spacetimePlayer.input.sequence
      },
      last_update: spacetimePlayer.last_update.toString()
    };
  }, []);
  
  const convertToSpacetimeInput = useCallback((input: InputState): SpacetimeInputState => {
    return {
      w: input.w,
      s: input.s,
      a: input.a,
      d: input.d,
      space: input.space,
      shift: input.shift,
      mouse_x: input.mouse_x,
      mouse_y: input.mouse_y,
      left_click: input.left_click,
      right_click: input.right_click,
      sequence: input.sequence
    };
  }, []);
  
  // === PLAYER MANAGEMENT ===
  const registerPlayer = useCallback(async (username: string) => {
     if (connection.state !== 'connected') {
       console.error('[SpacetimeDB] Cannot register player: not connected');
       return;
     }
     
     try {
       await callRegisterPlayer(username);
       console.log('[SpacetimeDB] Registering player:', username);
     } catch (error) {
       console.error('[SpacetimeDB] Failed to register player:', error);
     }
   }, [connection.state]);
   
   const sendPlayerInput = useCallback((input: InputState) => {
     if (connection.state !== 'connected' || !localPlayerId) {
       return;
     }
     
     try {
       const spacetimeInput = convertToSpacetimeInput(input);
       callUpdatePlayerInput(spacetimeInput);
     } catch (error) {
       console.error('[SpacetimeDB] Failed to send player input:', error);
     }
   }, [connection.state, localPlayerId, convertToSpacetimeInput]);
   
   const getPlayerData = useCallback((playerId: string): PlayerData | null => {
     return players.get(playerId) || null;
   }, [players]);
   
   const getAllPlayers = useCallback((): PlayerData[] => {
     return Array.from(players.values());
   }, [players]);
   
   // === CORE SPACETIMEDB OPERATIONS ===
   const subscribe = useCallback((tableName: string, callback: (data: any) => void) => {
     // In the new API, subscriptions are handled automatically by the database interface
     console.log('[SpacetimeDB] Table subscriptions are handled automatically:', tableName);
   }, []);
   
   const unsubscribe = useCallback((tableName: string, callback: (data: any) => void) => {
     // In the new API, subscriptions are handled automatically by the database interface
     console.log('[SpacetimeDB] Table subscriptions are handled automatically:', tableName);
   }, []);
   
   const callReducer = useCallback(async (reducerName: string, args: any[]) => {
     if (connection.state !== 'connected') {
       console.error('[SpacetimeDB] Cannot call reducer: not connected');
       return;
     }
     
     try {
       // This would need to be implemented based on the specific reducer
       console.log('[SpacetimeDB] Called reducer:', reducerName, 'with args:', args);
     } catch (error) {
       console.error('[SpacetimeDB] Failed to call reducer:', error);
     }
   }, [connection.state]);
  
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
      connectToSpacetime();
    }
  }, [autoConnect, connection.state, connectToSpacetime]);
  
  // === CONTEXT VALUE ===
  const contextValue: SpacetimeDBContextType = {
    // Connection state
    connection,
    localPlayerId,
    players,
    
    // Connection management
    connect: connectToSpacetime,
    disconnect,
    
    // Player management
    registerPlayer,
    sendPlayerInput,
    getPlayerData,
    getAllPlayers,
    
    // Core SpacetimeDB operations
    subscribe,
    unsubscribe,
    callReducer,
    
    // Event callbacks
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