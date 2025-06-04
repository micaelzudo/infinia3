/*
 * Infinia Multiplayer Integration
 * 
 * This file provides a complete integration between the existing Infinia third-person
 * character system and SpacetimeDB multiplayer functionality.
 * 
 * Key features:
 * - Seamless integration with existing isolatedThirdPerson.ts
 * - Real-time player synchronization
 * - Proper TypeScript bindings
 * - React context integration
 * - Automatic connection management
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import * as THREE from 'three';

// Import the existing multiplayer components
import { SpacetimeDBProvider, useSpacetimeDB } from './SpacetimeDBContext';
import { SpacetimeDBManager } from './SpacetimeDBManager';
import { ThirdPersonMultiplayerIntegration } from './ThirdPersonIntegration';

// === TYPE DEFINITIONS ===
export interface InfiniaPlayerData {
  identity: string;
  username: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  health: number;
  max_health: number;
  mana: number;
  max_mana: number;
  is_moving: boolean;
  is_running: boolean;
  input: {
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
  };
  last_update: string;
}

export interface InfiniaMultiplayerConfig {
  scene: THREE.Scene;
  character: any; // Sketchbook character instance
  camera?: THREE.Camera;
  serverUrl?: string;
  databaseName?: string;
  moduleName?: string;
  autoConnect?: boolean;
  enableDebug?: boolean;
}

// === MULTIPLAYER INTEGRATION COMPONENT ===
export const InfiniaMultiplayerIntegration: React.FC<{
  config: InfiniaMultiplayerConfig;
  children?: React.ReactNode;
}> = ({ config, children }) => {
  return (
    <SpacetimeDBProvider
      defaultUrl={config.serverUrl || 'ws://localhost:3000'}
      autoConnect={config.autoConnect ?? true}
    >
      <InfiniaMultiplayerCore config={config}>
        {children}
      </InfiniaMultiplayerCore>
    </SpacetimeDBProvider>
  );
};

// === CORE MULTIPLAYER LOGIC ===
const InfiniaMultiplayerCore: React.FC<{
  config: InfiniaMultiplayerConfig;
  children?: React.ReactNode;
}> = ({ config, children }) => {
  const spacetimeDB = useSpacetimeDB();
  const [isInitialized, setIsInitialized] = useState(false);
  const [players, setPlayers] = useState<Map<string, InfiniaPlayerData>>(new Map());
  const [localPlayer, setLocalPlayer] = useState<InfiniaPlayerData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  
  // Refs for integration
  const integrationRef = useRef<ThirdPersonMultiplayerIntegration | null>(null);
  const lastInputSequence = useRef<number>(0);
  const lastUpdateTime = useRef<number>(0);
  
  // === CONNECTION MANAGEMENT ===
  useEffect(() => {
    if (!spacetimeDB) return;
    
    const initializeMultiplayer = async () => {
      try {
        // Connect to SpacetimeDB
        await spacetimeDB.connect(config.serverUrl || 'ws://localhost:3000');
        setConnectionStatus('connected');
        
        // Initialize the integration
        integrationRef.current = new ThirdPersonMultiplayerIntegration({
          scene: config.scene,
          character: config.character,
          camera: config.camera,
          enableAutoSync: true,
          updateInterval: 50, // 20 FPS
        });
        
        const success = integrationRef.current.initialize(spacetimeDB);
        if (success) {
          setIsInitialized(true);
          console.log('[InfiniaMultiplayer] Initialized successfully');
        } else {
          console.error('[InfiniaMultiplayer] Failed to initialize');
        }
        
      } catch (error) {
        console.error('[InfiniaMultiplayer] Connection failed:', error);
        setConnectionStatus('error');
      }
    };
    
    initializeMultiplayer();
    
    return () => {
      if (integrationRef.current) {
        integrationRef.current.cleanup();
      }
    };
  }, [spacetimeDB, config]);
  
  // === PLAYER DATA SYNCHRONIZATION ===
  useEffect(() => {
    if (!spacetimeDB || !isInitialized) return;
    
    // Subscribe to player updates
    const handlePlayerUpdate = (playerData: InfiniaPlayerData) => {
      setPlayers(prev => new Map(prev).set(playerData.identity, playerData));
      
      // Update local player if it's us
      if (spacetimeDB.localPlayerId === playerData.identity) {
        setLocalPlayer(playerData);
      }
    };
    
    const handlePlayerJoined = (playerData: InfiniaPlayerData) => {
      console.log('[InfiniaMultiplayer] Player joined:', playerData.username);
      setPlayers(prev => new Map(prev).set(playerData.identity, playerData));
    };
    
    const handlePlayerLeft = (playerId: string) => {
      console.log('[InfiniaMultiplayer] Player left:', playerId);
      setPlayers(prev => {
        const newMap = new Map(prev);
        newMap.delete(playerId);
        return newMap;
      });
    };
    
    // Register callbacks
    spacetimeDB.onPlayerUpdate?.(handlePlayerUpdate);
    spacetimeDB.onPlayerJoined?.(handlePlayerJoined);
    spacetimeDB.onPlayerLeft?.(handlePlayerLeft);
    
  }, [spacetimeDB, isInitialized]);
  
  // === INPUT HANDLING ===
  const sendPlayerInput = useCallback((inputState: any) => {
    if (!spacetimeDB || !isInitialized || !config.character) return;
    
    const now = Date.now();
    if (now - lastUpdateTime.current < 50) return; // Throttle to 20 FPS
    
    lastInputSequence.current++;
    lastUpdateTime.current = now;
    
    // Convert input to SpacetimeDB format
    const spacetimeInput = {
      w: inputState.w || false,
      s: inputState.s || false,
      a: inputState.a || false,
      d: inputState.d || false,
      space: inputState.space || false,
      shift: inputState.shift || false,
      mouse_x: inputState.mouseX || 0,
      mouse_y: inputState.mouseY || 0,
      left_click: inputState.leftClick || false,
      right_click: inputState.rightClick || false,
      sequence: lastInputSequence.current,
    };
    
    // Send to server
    spacetimeDB.sendMessage({
      type: 'update_player_input',
      input: spacetimeInput
    });
    
  }, [spacetimeDB, isInitialized, config.character]);
  
  // === PLAYER REGISTRATION ===
  const registerPlayer = useCallback(async (username: string) => {
    if (!spacetimeDB || !isInitialized) {
      throw new Error('SpacetimeDB not initialized');
    }
    
    try {
      spacetimeDB.sendMessage({
        type: 'register_player',
        username: username
      });
      
      console.log('[InfiniaMultiplayer] Player registration sent:', username);
    } catch (error) {
      console.error('[InfiniaMultiplayer] Registration failed:', error);
      throw error;
    }
  }, [spacetimeDB, isInitialized]);
  
  // === EXPOSE API ===
  const multiplayerAPI = {
    isInitialized,
    connectionStatus,
    players: Array.from(players.values()),
    localPlayer,
    registerPlayer,
    sendPlayerInput,
    getPlayerCount: () => players.size,
    getRemotePlayers: () => Array.from(players.values()).filter(p => p.identity !== spacetimeDB?.localPlayerId),
  };
  
  // Make API available globally for integration with existing code
  useEffect(() => {
    (window as any).infiniaMultiplayer = multiplayerAPI;
  }, [multiplayerAPI]);
  
  return (
    <>
      {children}
      {config.enableDebug && (
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 1000
        }}>
          <div>Status: {connectionStatus}</div>
          <div>Players: {players.size}</div>
          <div>Local: {localPlayer?.username || 'None'}</div>
          <div>Initialized: {isInitialized ? 'Yes' : 'No'}</div>
        </div>
      )}
    </>
  );
};

// === UTILITY FUNCTIONS ===
export const createInfiniaMultiplayer = (config: InfiniaMultiplayerConfig) => {
  return {
    InfiniaMultiplayerIntegration: () => (
      <InfiniaMultiplayerIntegration config={config} />
    ),
    config
  };
};

// === HOOKS FOR EXTERNAL USE ===
export const useInfiniaMultiplayer = () => {
  return (window as any).infiniaMultiplayer || null;
};

export const useInfiniaPlayers = () => {
  const api = useInfiniaMultiplayer();
  return api?.players || [];
};

export const useInfiniaLocalPlayer = () => {
  const api = useInfiniaMultiplayer();
  return api?.localPlayer || null;
};

export const useInfiniaConnectionStatus = () => {
  const api = useInfiniaMultiplayer();
  return api?.connectionStatus || 'disconnected';
};