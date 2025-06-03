// === SPACETIMEDB MULTIPLAYER INFRASTRUCTURE ===
// This file provides a centralized export for all SpacetimeDB multiplayer components

// === CORE CONTEXT ===
export {
  SpacetimeDBProvider,
  SpacetimeDBContext,
  useSpacetimeDB
} from './SpacetimeDBContext';

export type {
  SpacetimeDBContextType,
  PlayerData,
  Vector3,
  InputState,
  ConnectionState
} from './SpacetimeDBContext';

// === MANAGER ===
export {
  SpacetimeDBManager,
  createSpacetimeDBManager,
  setupGlobalSpacetimeDBContext
} from './SpacetimeDBManager';

export type {
  RemotePlayerMesh,
  CharacterReference
} from './SpacetimeDBManager';

// === HOOKS ===
export {
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
} from './SpacetimeDBHooks';

// === INTEGRATION ===
export {
  ThirdPersonMultiplayerIntegration,
  createThirdPersonMultiplayer,
  initializeThirdPersonMultiplayer,
  getGlobalSpacetimeDBContext,
  isMultiplayerReady,
  exampleIntegration
} from './ThirdPersonIntegration';

export type {
  ThirdPersonMultiplayerConfig
} from './ThirdPersonIntegration';

// === DEFAULT EXPORT ===
export default {
  // Context
  SpacetimeDBProvider,
  SpacetimeDBContext,
  useSpacetimeDB,
  
  // Manager
  SpacetimeDBManager,
  createSpacetimeDBManager,
  setupGlobalSpacetimeDBContext,
  
  // Integration
  ThirdPersonMultiplayerIntegration,
  createThirdPersonMultiplayer,
  initializeThirdPersonMultiplayer,
  getGlobalSpacetimeDBContext,
  isMultiplayerReady,
  
  // Hooks
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

// === UTILITY FUNCTIONS ===

/**
 * Quick setup function for basic multiplayer integration
 * @param scene - Three.js scene
 * @param character - Character instance
 * @returns Multiplayer integration instance or null
 */
export function quickSetupMultiplayer(
  scene: THREE.Scene,
  character: any
): ThirdPersonMultiplayerIntegration | null {
  const context = getGlobalSpacetimeDBContext();
  
  if (!context || !isMultiplayerReady()) {
    console.log('[QuickSetup] Multiplayer not available');
    return null;
  }
  
  return initializeThirdPersonMultiplayer(scene, character, context);
}

/**
 * Check if SpacetimeDB infrastructure is properly set up
 * @returns boolean indicating if infrastructure is ready
 */
export function checkMultiplayerInfrastructure(): {
  hasContext: boolean;
  isConnected: boolean;
  hasLocalPlayer: boolean;
  ready: boolean;
} {
  const context = getGlobalSpacetimeDBContext();
  const hasContext = context !== null;
  const isConnected = hasContext && context.connection.state === 'connected';
  const hasLocalPlayer = hasContext && !!context.localPlayerId;
  
  return {
    hasContext,
    isConnected,
    hasLocalPlayer,
    ready: hasContext && isConnected && hasLocalPlayer
  };
}

/**
 * Get multiplayer status information
 * @returns status object with detailed information
 */
export function getMultiplayerStatus(): {
  status: 'not_available' | 'disconnected' | 'connecting' | 'connected';
  localPlayerId: string | null;
  playerCount: number;
  connectionState: string;
} {
  const context = getGlobalSpacetimeDBContext();
  
  if (!context) {
    return {
      status: 'not_available',
      localPlayerId: null,
      playerCount: 0,
      connectionState: 'not_available'
    };
  }
  
  const connectionState = context.connection.state;
  let status: 'not_available' | 'disconnected' | 'connecting' | 'connected';
  
  switch (connectionState) {
    case 'connected':
      status = 'connected';
      break;
    case 'connecting':
      status = 'connecting';
      break;
    case 'disconnected':
      status = 'disconnected';
      break;
    default:
      status = 'not_available';
  }
  
  return {
    status,
    localPlayerId: context.localPlayerId,
    playerCount: context.getPlayers().length,
    connectionState
  };
}