# Infinia Multiplayer Setup Guide

This guide will help you set up and configure the SpacetimeDB multiplayer system for your Infinia project.

## Prerequisites

1. **SpacetimeDB CLI**: Install the SpacetimeDB CLI tool
   ```bash
   # Install SpacetimeDB CLI
   curl --proto '=https' --tlsv1.2 -sSf https://install.spacetimedb.com | sh
   ```

2. **Rust**: Make sure you have Rust installed
   ```bash
   # Install Rust if not already installed
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **Node.js Dependencies**: Ensure you have the required npm packages
   ```bash
   npm install @clockworklabs/spacetimedb-sdk
   ```

## Server Setup

### 1. Build the SpacetimeDB Module

Navigate to the server directory and build the module:

```bash
cd debug/modules/multiplayer/server
cargo build --release
```

### 2. Start SpacetimeDB

Start the SpacetimeDB standalone server:

```bash
# Start SpacetimeDB on default port (3000)
spacetimedb start
```

### 3. Publish the Module

Publish your multiplayer module to the local SpacetimeDB instance:

```bash
# From the server directory
spacetimedb publish infinia_multiplayer
```

### 4. Create a Database

Create a database instance for your game:

```bash
spacetimedb create-database infinia_game
```

## Client Integration

### 1. Basic Integration

To integrate multiplayer into your existing Infinia project:

```typescript
import React from 'react';
import { InfiniaMultiplayerIntegration } from './modules/ui/multiplayer/InfiniaMultiplayerIntegration';

// In your main component
function App() {
  const multiplayerConfig = {
    scene: yourThreeJSScene,
    character: yourCharacterInstance,
    camera: yourCamera,
    serverUrl: 'ws://localhost:3000',
    databaseName: 'infinia_game',
    moduleName: 'infinia_multiplayer',
    autoConnect: true,
    enableDebug: true // Shows connection status overlay
  };

  return (
    <InfiniaMultiplayerIntegration config={multiplayerConfig}>
      {/* Your existing UI components */}
    </InfiniaMultiplayerIntegration>
  );
}
```

### 2. Third-Person Integration

To enable multiplayer in third-person mode:

```typescript
import { initIsolatedThirdPerson } from './modules/ui/isolatedThirdPerson';

// When initializing third-person mode
const tpParams = {
  scene: yourScene,
  renderer: yourRenderer,
  // ... other parameters
  enableMultiplayer: true,
  infiniaMultiplayerAPI: window.infiniaMultiplayer, // Will be available after InfiniaMultiplayerIntegration mounts
  playerId: 'your-player-id'
};

initIsolatedThirdPerson(tpParams);
```

### 3. Using Multiplayer Hooks

```typescript
import { 
  useInfiniaMultiplayer, 
  useInfiniaPlayers, 
  useInfiniaLocalPlayer,
  useInfiniaConnectionStatus 
} from './modules/ui/multiplayer/InfiniaMultiplayerIntegration';

function MultiplayerUI() {
  const multiplayer = useInfiniaMultiplayer();
  const players = useInfiniaPlayers();
  const localPlayer = useInfiniaLocalPlayer();
  const connectionStatus = useInfiniaConnectionStatus();

  const handleRegisterPlayer = async () => {
    if (multiplayer) {
      await multiplayer.registerPlayer('YourUsername');
    }
  };

  return (
    <div>
      <div>Status: {connectionStatus}</div>
      <div>Players Online: {players.length}</div>
      <div>Local Player: {localPlayer?.username || 'Not registered'}</div>
      <button onClick={handleRegisterPlayer}>Join Game</button>
    </div>
  );
}
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# SpacetimeDB Configuration
SPACETIMEDB_URL=ws://localhost:3000
DATABASE_NAME=infinia_game
MODULE_NAME=infinia_multiplayer

# Optional: Production settings
# SPACETIMEDB_URL=wss://your-production-server.com
# DATABASE_NAME=infinia_game_prod
```

### Server Configuration

Edit `debug/modules/multiplayer/spacetimeConfig.ts` to match your setup:

```typescript
export const SPACETIMEDB_URL = process.env.SPACETIMEDB_URL || 'ws://localhost:3000';
export const DATABASE_NAME = process.env.DATABASE_NAME || 'infinia_game';
export const MODULE_NAME = process.env.MODULE_NAME || 'infinia_multiplayer';
```

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure SpacetimeDB is running: `spacetimedb start`
   - Check if the database exists: `spacetimedb list-databases`
   - Verify the module is published: `spacetimedb list-modules`

2. **Module Build Errors**
   - Make sure Rust is installed and up to date
   - Check that all dependencies in `Cargo.toml` are correct
   - Try cleaning and rebuilding: `cargo clean && cargo build --release`

3. **Player Registration Issues**
   - Ensure the client is connected before calling `registerPlayer`
   - Check browser console for error messages
   - Verify the SpacetimeDB logs for server-side errors

4. **Remote Players Not Appearing**
   - Check that multiple clients are connected
   - Verify that player updates are being sent (check console logs)
   - Ensure the scene and character references are properly set

### Debug Mode

Enable debug mode to see connection status and player information:

```typescript
const multiplayerConfig = {
  // ... other config
  enableDebug: true
};
```

This will show a debug overlay in the top-right corner with:
- Connection status
- Number of connected players
- Local player information
- Initialization status

### Logs

Check the following logs for debugging:

1. **Browser Console**: Client-side errors and connection status
2. **SpacetimeDB Logs**: Server-side errors and database operations
3. **Network Tab**: WebSocket connection and message flow

## Production Deployment

### Server Deployment

1. **Deploy SpacetimeDB**: Follow SpacetimeDB's production deployment guide
2. **Update Configuration**: Change `SPACETIMEDB_URL` to your production server
3. **SSL/TLS**: Use `wss://` instead of `ws://` for secure connections
4. **Database Management**: Set up proper database backups and monitoring

### Client Deployment

1. **Environment Variables**: Set production environment variables
2. **Build Optimization**: Ensure the multiplayer code is included in your build
3. **Error Handling**: Implement proper error handling for connection failures
4. **Performance**: Monitor network usage and optimize update frequencies

## API Reference

### InfiniaMultiplayerIntegration Props

```typescript
interface InfiniaMultiplayerConfig {
  scene: THREE.Scene;              // Three.js scene
  character: any;                  // Sketchbook character instance
  camera?: THREE.Camera;           // Optional camera reference
  serverUrl?: string;              // SpacetimeDB server URL
  databaseName?: string;           // Database name
  moduleName?: string;             // Module name
  autoConnect?: boolean;           // Auto-connect on mount
  enableDebug?: boolean;           // Show debug overlay
}
```

### Multiplayer API Methods

```typescript
interface InfiniaMultiplayerAPI {
  isInitialized: boolean;
  connectionStatus: string;
  players: InfiniaPlayerData[];
  localPlayer: InfiniaPlayerData | null;
  registerPlayer: (username: string) => Promise<void>;
  sendPlayerInput: (input: any) => void;
  getPlayerCount: () => number;
  getRemotePlayers: () => InfiniaPlayerData[];
}
```

### Player Data Structure

```typescript
interface InfiniaPlayerData {
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
  input: InputState;
  last_update: string;
}
```

## Support

For additional help:

1. Check the [SpacetimeDB Documentation](https://docs.spacetimedb.com/)
2. Review the example implementation in the `vibe-coding-starter-pack-3d-multiplayer` reference
3. Check the browser console and SpacetimeDB logs for error messages
4. Ensure all dependencies are properly installed and up to date