# SpacetimeDB Multiplayer Infrastructure

This directory contains a complete SpacetimeDB integration infrastructure for the third-person character system. It provides React context, hooks, managers, and integration utilities for real-time multiplayer functionality.

## 📁 File Structure

```
multiplayer/
├── SpacetimeDBContext.tsx     # React context and provider
├── SpacetimeDBManager.ts      # Core multiplayer manager
├── SpacetimeDBHooks.ts        # React hooks for easy integration
├── ThirdPersonIntegration.ts  # Third-person character integration
├── index.ts                   # Centralized exports
└── README.md                  # This file
```

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { quickSetupMultiplayer } from './multiplayer';

// In your third-person character initialization
const multiplayerIntegration = quickSetupMultiplayer(scene, character);

if (multiplayerIntegration) {
  console.log('Multiplayer enabled!');
  console.log('Local Player ID:', multiplayerIntegration.getLocalPlayerId());
}
```

### 2. React Component Integration

```tsx
import React from 'react';
import { SpacetimeDBProvider, useMultiplayerReady, usePlayerCount } from './multiplayer';

function App() {
  return (
    <SpacetimeDBProvider>
      <GameComponent />
    </SpacetimeDBProvider>
  );
}

function GameComponent() {
  const isReady = useMultiplayerReady();
  const { total, remote } = usePlayerCount();
  
  return (
    <div>
      <p>Multiplayer: {isReady ? 'Connected' : 'Disconnected'}</p>
      <p>Players: {total} (Remote: {remote})</p>
    </div>
  );
}
```

### 3. Manual Integration

```typescript
import {
  getGlobalSpacetimeDBContext,
  initializeThirdPersonMultiplayer,
  ThirdPersonMultiplayerIntegration
} from './multiplayer';

// Get SpacetimeDB context
const context = getGlobalSpacetimeDBContext();

if (context && context.connection.state === 'connected') {
  // Initialize multiplayer
  const integration = initializeThirdPersonMultiplayer(
    scene,
    character,
    context,
    {
      enableAutoSync: true,
      updateInterval: 50, // 20 FPS
      positionThreshold: 0.1,
      rotationThreshold: 0.05
    }
  );
  
  if (integration) {
    console.log('Multiplayer initialized successfully');
  }
}
```

## 🔧 Integration with isolatedThirdPerson.ts

To integrate with the existing `isolatedThirdPerson.ts` file, add this code:

```typescript
// Add import at the top
import { exampleIntegration } from './multiplayer/ThirdPersonIntegration';

// In your initIsolatedThirdPerson function, after character creation:
export function initIsolatedThirdPerson(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  // ... other parameters
) {
  // ... existing character setup code ...
  
  // Initialize multiplayer integration
  const multiplayerIntegration = exampleIntegration(scene, character, camera);
  
  // Store reference for cleanup
  const cleanup = () => {
    multiplayerIntegration?.dispose();
    // ... other cleanup code ...
  };
  
  return {
    character,
    multiplayerIntegration,
    cleanup,
    // ... other exports ...
  };
}
```

## 📚 API Reference

### SpacetimeDBContext

React context that provides SpacetimeDB functionality throughout your app.

```typescript
interface SpacetimeDBContextType {
  connection: { state: string };
  localPlayerId: string | null;
  sendMessage: (message: any) => void;
  subscribe: (table: string, callback: Function) => () => void;
  updatePlayer: (data: Partial<PlayerData>) => void;
  getPlayer: (id: string) => PlayerData | null;
  getPlayers: () => PlayerData[];
  onPlayerJoined?: (callback: (player: PlayerData) => void) => void;
  onPlayerLeft?: (callback: (playerId: string) => void) => void;
  onPlayerUpdate?: (callback: (player: PlayerData) => void) => void;
}
```

### SpacetimeDBManager

Core manager that handles multiplayer synchronization and remote player visualization.

```typescript
class SpacetimeDBManager {
  initialize(context: SpacetimeDBContextType): boolean;
  update(deltaTime: number): void;
  isEnabled(): boolean;
  getLocalPlayerId(): string | null;
  getRemotePlayerCount(): number;
  dispose(): void;
}
```

### ThirdPersonMultiplayerIntegration

High-level integration class that connects SpacetimeDB with the third-person character.

```typescript
class ThirdPersonMultiplayerIntegration {
  initialize(context: SpacetimeDBContextType): boolean;
  update(deltaTime: number): void;
  setAutoSync(enabled: boolean): void;
  getRemotePlayerCount(): number;
  dispose(): void;
}
```

## 🎣 Available Hooks

### Connection Hooks
- `useSpacetimeDB()` - Get the SpacetimeDB context
- `useSpacetimeDBConnection()` - Check connection status
- `useLocalPlayerId()` - Get local player ID
- `useMultiplayerReady()` - Check if multiplayer is ready

### Player Data Hooks
- `usePlayers()` - Get all players
- `usePlayer(id)` - Get specific player
- `useRemotePlayers()` - Get remote players only
- `usePlayerCount()` - Get player counts

### Update Hooks
- `usePlayerUpdate()` - Send player updates
- `usePlayerPositionSync()` - Auto-sync position/rotation
- `useDebouncedPlayerUpdate()` - Debounced updates
- `useBatchedPlayerUpdate()` - Batched updates

### Event Hooks
- `usePlayerJoinedEvent()` - Listen for player joins
- `usePlayerLeftEvent()` - Listen for player leaves
- `usePlayerUpdateEvent()` - Listen for player updates

## 🔧 Configuration

### Update Intervals
```typescript
const config = {
  updateInterval: 50,        // 20 FPS (milliseconds)
  positionThreshold: 0.1,    // Minimum position change
  rotationThreshold: 0.05,   // Minimum rotation change
  interpolationFactor: 0.1,  // Smoothing factor
  maxInterpolationDistance: 5.0 // Teleport threshold
};
```

### Visual Settings
```typescript
const visualConfig = {
  remotePlayerColor: 0x00ff00,    // Green color
  remotePlayerOpacity: 0.8,       // Semi-transparent
  nameTagHeight: 1.2,             // Height above player
};
```

## 🐛 Debugging

### Check Multiplayer Status
```typescript
import { checkMultiplayerInfrastructure, getMultiplayerStatus } from './multiplayer';

// Check infrastructure
const infrastructure = checkMultiplayerInfrastructure();
console.log('Infrastructure ready:', infrastructure.ready);

// Get detailed status
const status = getMultiplayerStatus();
console.log('Status:', status.status);
console.log('Players:', status.playerCount);
```

### Console Logs
The infrastructure provides detailed console logging:
- `[SpacetimeDBManager]` - Core manager events
- `[ThirdPersonMultiplayerIntegration]` - Integration events
- `[SpacetimeDBContext]` - Context and connection events

## 🔄 Data Flow

1. **Character Movement** → `ThirdPersonMultiplayerIntegration`
2. **Position/Rotation Changes** → `SpacetimeDBManager`
3. **Threshold Check** → `sendPlayerUpdate()`
4. **SpacetimeDB Context** → `updatePlayer()`
5. **Server Broadcast** → Other clients
6. **Incoming Updates** → `handlePlayerUpdate()`
7. **Remote Player Meshes** → Visual representation
8. **Interpolation** → Smooth movement

## 🚨 Error Handling

The infrastructure includes comprehensive error handling:
- Connection failures are logged and handled gracefully
- Missing context falls back to single-player mode
- Invalid player data is filtered out
- Cleanup prevents memory leaks

## 🎯 Performance Considerations

- **Update Throttling**: Only sends updates when position/rotation changes significantly
- **Interpolation**: Smooth remote player movement without constant updates
- **Batching**: Option to batch multiple updates for efficiency
- **Debouncing**: Prevents excessive update calls
- **Memory Management**: Proper cleanup of meshes and materials

## 🔮 Future Enhancements

- Animation synchronization
- Voice chat integration
- Custom player models
- Server-side validation
- Lag compensation
- Prediction algorithms

## 📝 Notes

- This infrastructure is designed to work with the existing Sketchbook character system
- It assumes SpacetimeDB context is available globally via `window.spacetimeDBContext`
- Remote players are represented as simple colored boxes with name tags
- The system gracefully degrades to single-player mode when multiplayer is unavailable

## 🤝 Contributing

When extending this infrastructure:
1. Follow the existing naming conventions
2. Add proper TypeScript types
3. Include error handling
4. Add console logging for debugging
5. Update this README with new features