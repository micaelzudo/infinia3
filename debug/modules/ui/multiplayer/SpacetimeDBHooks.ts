import { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { SpacetimeDBContext, type SpacetimeDBContextType, type PlayerData, type Vector3, type InputState } from './SpacetimeDBContext';

// === BASIC HOOKS ===

/**
 * Hook to access the SpacetimeDB context
 * @returns SpacetimeDB context or null if not available
 */
export function useSpacetimeDB(): SpacetimeDBContextType | null {
  const context = useContext(SpacetimeDBContext);
  return context;
}

/**
 * Hook to check if SpacetimeDB is connected
 * @returns boolean indicating connection status
 */
export function useSpacetimeDBConnection(): boolean {
  const context = useSpacetimeDB();
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    if (!context) {
      setIsConnected(false);
      return;
    }
    
    const updateConnectionState = () => {
      setIsConnected(context.connection.state === 'connected');
    };
    
    // Initial state
    updateConnectionState();
    
    // Listen for connection changes
    const interval = setInterval(updateConnectionState, 1000);
    
    return () => clearInterval(interval);
  }, [context]);
  
  return isConnected;
}

/**
 * Hook to get the local player ID
 * @returns local player ID or null if not available
 */
export function useLocalPlayerId(): string | null {
  const context = useSpacetimeDB();
  return context?.localPlayerId || null;
}

// === PLAYER DATA HOOKS ===

/**
 * Hook to get all players
 * @returns array of player data
 */
export function usePlayers(): PlayerData[] {
  const context = useSpacetimeDB();
  const [players, setPlayers] = useState<PlayerData[]>([]);
  
  useEffect(() => {
    if (!context) {
      setPlayers([]);
      return;
    }
    
    // Get initial players
    const initialPlayers = context.getPlayers();
    setPlayers(initialPlayers);
    
    // Subscribe to player updates
    const unsubscribe = context.subscribe('players', (updatedPlayers: PlayerData[]) => {
      setPlayers(updatedPlayers);
    });
    
    return unsubscribe;
  }, [context]);
  
  return players;
}

/**
 * Hook to get a specific player by ID
 * @param playerId - ID of the player to get
 * @returns player data or null if not found
 */
export function usePlayer(playerId: string | null): PlayerData | null {
  const context = useSpacetimeDB();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  
  useEffect(() => {
    if (!context || !playerId) {
      setPlayer(null);
      return;
    }
    
    // Get initial player
    const initialPlayer = context.getPlayer(playerId);
    setPlayer(initialPlayer);
    
    // Subscribe to player updates
    const unsubscribe = context.subscribe('players', (players: PlayerData[]) => {
      const updatedPlayer = players.find(p => p.id === playerId) || null;
      setPlayer(updatedPlayer);
    });
    
    return unsubscribe;
  }, [context, playerId]);
  
  return player;
}

/**
 * Hook to get remote players (excluding local player)
 * @returns array of remote player data
 */
export function useRemotePlayers(): PlayerData[] {
  const players = usePlayers();
  const localPlayerId = useLocalPlayerId();
  
  return players.filter(player => player.id !== localPlayerId);
}

// === PLAYER UPDATE HOOKS ===

/**
 * Hook to send player updates
 * @returns function to update player data
 */
export function usePlayerUpdate(): (playerData: Partial<PlayerData>) => void {
  const context = useSpacetimeDB();
  
  return useCallback((playerData: Partial<PlayerData>) => {
    if (context) {
      context.updatePlayer(playerData);
    }
  }, [context]);
}

/**
 * Hook to automatically send player position updates
 * @param position - current player position
 * @param rotation - current player rotation
 * @param options - update options
 */
export function usePlayerPositionSync(
  position: Vector3 | null,
  rotation: Vector3 | null,
  options: {
    updateInterval?: number;
    positionThreshold?: number;
    rotationThreshold?: number;
  } = {}
): void {
  const updatePlayer = usePlayerUpdate();
  const lastPositionRef = useRef<Vector3 | null>(null);
  const lastRotationRef = useRef<Vector3 | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  const {
    updateInterval = 50, // 20 FPS
    positionThreshold = 0.1,
    rotationThreshold = 0.05
  } = options;
  
  useEffect(() => {
    if (!position || !rotation) return;
    
    const now = Date.now();
    
    // Check if enough time has passed
    if (now - lastUpdateRef.current < updateInterval) return;
    
    // Check if position changed significantly
    const positionChanged = !lastPositionRef.current ||
      Math.abs(position.x - lastPositionRef.current.x) > positionThreshold ||
      Math.abs(position.y - lastPositionRef.current.y) > positionThreshold ||
      Math.abs(position.z - lastPositionRef.current.z) > positionThreshold;
    
    // Check if rotation changed significantly
    const rotationChanged = !lastRotationRef.current ||
      Math.abs(rotation.x - lastRotationRef.current.x) > rotationThreshold ||
      Math.abs(rotation.y - lastRotationRef.current.y) > rotationThreshold ||
      Math.abs(rotation.z - lastRotationRef.current.z) > rotationThreshold;
    
    if (positionChanged || rotationChanged) {
      updatePlayer({ position, rotation });
      
      lastPositionRef.current = { ...position };
      lastRotationRef.current = { ...rotation };
      lastUpdateRef.current = now;
    }
  }, [position, rotation, updatePlayer, updateInterval, positionThreshold, rotationThreshold]);
}

// === EVENT HOOKS ===

/**
 * Hook to listen for player join events
 * @param callback - function to call when a player joins
 */
export function usePlayerJoinedEvent(callback: (player: PlayerData) => void): void {
  const context = useSpacetimeDB();
  
  useEffect(() => {
    if (!context || !context.onPlayerJoined) return;
    
    context.onPlayerJoined(callback);
  }, [context, callback]);
}

/**
 * Hook to listen for player leave events
 * @param callback - function to call when a player leaves
 */
export function usePlayerLeftEvent(callback: (playerId: string) => void): void {
  const context = useSpacetimeDB();
  
  useEffect(() => {
    if (!context || !context.onPlayerLeft) return;
    
    context.onPlayerLeft(callback);
  }, [context, callback]);
}

/**
 * Hook to listen for player update events
 * @param callback - function to call when a player updates
 */
export function usePlayerUpdateEvent(callback: (player: PlayerData) => void): void {
  const context = useSpacetimeDB();
  
  useEffect(() => {
    if (!context || !context.onPlayerUpdate) return;
    
    context.onPlayerUpdate(callback);
  }, [context, callback]);
}

// === UTILITY HOOKS ===

/**
 * Hook to get player count
 * @returns object with total, local, and remote player counts
 */
export function usePlayerCount(): {
  total: number;
  remote: number;
  isLocal: boolean;
} {
  const players = usePlayers();
  const localPlayerId = useLocalPlayerId();
  
  return {
    total: players.length,
    remote: players.filter(p => p.id !== localPlayerId).length,
    isLocal: !!localPlayerId
  };
}

/**
 * Hook to check if multiplayer is enabled and ready
 * @returns boolean indicating if multiplayer is ready
 */
export function useMultiplayerReady(): boolean {
  const isConnected = useSpacetimeDBConnection();
  const localPlayerId = useLocalPlayerId();
  
  return isConnected && !!localPlayerId;
}

/**
 * Hook to get connection statistics
 * @returns connection statistics object
 */
export function useConnectionStats(): {
  isConnected: boolean;
  localPlayerId: string | null;
  playerCount: number;
  remotePlayerCount: number;
} {
  const isConnected = useSpacetimeDBConnection();
  const localPlayerId = useLocalPlayerId();
  const { total, remote } = usePlayerCount();
  
  return {
    isConnected,
    localPlayerId,
    playerCount: total,
    remotePlayerCount: remote
  };
}

// === ADVANCED HOOKS ===

/**
 * Hook to create a debounced player update function
 * @param delay - debounce delay in milliseconds
 * @returns debounced update function
 */
export function useDebouncedPlayerUpdate(delay: number = 100): (playerData: Partial<PlayerData>) => void {
  const updatePlayer = usePlayerUpdate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((playerData: Partial<PlayerData>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      updatePlayer(playerData);
    }, delay);
  }, [updatePlayer, delay]);
}

/**
 * Hook to batch player updates
 * @param batchSize - number of updates to batch
 * @param flushInterval - interval to flush batched updates
 * @returns function to add updates to batch
 */
export function useBatchedPlayerUpdate(
  batchSize: number = 5,
  flushInterval: number = 100
): (playerData: Partial<PlayerData>) => void {
  const updatePlayer = usePlayerUpdate();
  const batchRef = useRef<Partial<PlayerData>[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const flushBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;
    
    // Merge all updates in the batch
    const mergedUpdate = batchRef.current.reduce((acc, update) => ({ ...acc, ...update }), {});
    updatePlayer(mergedUpdate);
    
    batchRef.current = [];
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [updatePlayer]);
  
  return useCallback((playerData: Partial<PlayerData>) => {
    batchRef.current.push(playerData);
    
    // Flush if batch is full
    if (batchRef.current.length >= batchSize) {
      flushBatch();
      return;
    }
    
    // Set timeout to flush batch
    if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(flushBatch, flushInterval);
    }
  }, [flushBatch, batchSize, flushInterval]);
}

// === EXPORTS ===
export default {
  useSpacetimeDB,
  useSpacetimeDBConnection,
  useLocalPlayerId,
  usePlayers,
  usePlayer,
  useRemotePlayers,
  usePlayerUpdate,
  usePlayerPositionSync,
  usePlayerJoinedEvent,
  usePlayerLeftEvent,
  usePlayerUpdateEvent,
  usePlayerCount,
  useMultiplayerReady,
  useConnectionStats,
  useDebouncedPlayerUpdate,
  useBatchedPlayerUpdate
};