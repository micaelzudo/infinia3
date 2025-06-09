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

### 1. Navigate to the Server Module Directory

The SpacetimeDB Rust server module is located at `debug/modules/multiplayer/server/`.
Open your terminal and navigate to this directory:
```bash
cd d:\infiniagithub\debug\modules\multiplayer\server
# Or use a relative path from your project root:
# cd debug/modules/multiplayer/server
```

### 2. Build the SpacetimeDB Module

Build the Rust module using Cargo:
```bash
cargo build --release
```
This will compile your Rust code into a WebAssembly module that SpacetimeDB can run.

### 3. Start the SpacetimeDB Server

If SpacetimeDB server is not already running, start it. Open a new terminal window/tab and run:
```bash
spacetimedb start
```
This typically starts the server on `localhost:3000` and creates a default `spacetime.db` file in the directory where you run the command if one doesn't exist. It's often good practice to run this from your project root or a dedicated data directory.

### 4. Publish the Module to SpacetimeDB

From the server module directory (`debug/modules/multiplayer/server/`), publish your compiled module to the running SpacetimeDB instance. The module name is defined in your `Cargo.toml` (likely `infinia_multiplayer_server` or similar, let's assume `infinia_multiplayer_server` for this example - **please verify your actual module name**).

```bash
# Ensure you are in debug/modules/multiplayer/server/
spacetimedb publish infinia_multiplayer_server
```

### 5. Create a Database (if it doesn't exist)

Create a database instance for your game if you haven't already. You can name it, for example, `infinia_game_db`.
```bash
spacetimedb create-db infinia_game_db
```
If it already exists, this command might inform you. You can list existing databases with `spacetimedb list-dbs`.

### 6. Generate TypeScript Client Bindings

After successfully building and publishing your Rust module, generate the TypeScript client SDK bindings. From the server module directory (`debug/modules/multiplayer/server/`):
```bash
# Ensure you are in debug/modules/multiplayer/server/
# The output path should point to your client-side 'generated' folder.
spacetimedb generate --lang typescript --out ../generated
```
This command reads your Rust module's schema (tables, reducers, types) and creates corresponding TypeScript files in `debug/modules/multiplayer/generated/`. These generated files are crucial for client-side interaction.

## Client Integration

### 1. Core Client-Side Setup (using `MultiplayerManager` from `example.ts`)

The `debug/modules/multiplayer/example.ts` file provides a `MultiplayerManager` class that encapsulates much of the core client-side logic. This is a recommended starting point.

**Key Steps:**

1.  **Import necessary components:**
    ```typescript
    // In your main game initialization file (e.g., a new file or integrated into existing logic)
    import { MultiplayerManager } from './modules/multiplayer/example'; // Adjust path as needed
    import { SPACETIMEDB_URL, DATABASE_NAME, MODULE_NAME } from './modules/multiplayer/spacetimeConfig'; // Adjust path
    // Import specific generated types/reducers if needed directly, though MultiplayerManager handles many.
    import { PlayerData } from './modules/multiplayer/generated'; // Example
    ```

2.  **Instantiate and Initialize `MultiplayerManager`:**
    ```typescript
    const multiplayerManager = new MultiplayerManager(
        SPACETIMEDB_URL,
        DATABASE_NAME,
        MODULE_NAME
    );

    async function initializeMultiplayer() {
        try {
            await multiplayerManager.connect();
            console.log('Connected to SpacetimeDB!');

            // Example: Register a player (replace 'PlayerUsername' with actual input)
            await multiplayerManager.registerPlayer('PlayerUsername');

            // Example: Set up subscriptions (MultiplayerManager does this internally for PlayerData)
            // You can access player data via multiplayerManager.getPlayers() or subscribe to its events.
            multiplayerManager.onPlayerJoined = (player) => {
                console.log('Player joined:', player.username, player.player_id);
                // Your logic to create a visual representation for this player
            };
            multiplayerManager.onPlayerUpdated = (player) => {
                // console.log('Player updated:', player.username);
                // Your logic to update the visual representation
            };
            multiplayerManager.onPlayerLeft = (playerId) => {
                console.log('Player left:', playerId);
                // Your logic to remove the visual representation
            };

            // Example: Sending player input (call this in your game loop)
            // const localPlayerInput = { /* your InputState object */ };
            // multiplayerManager.updatePlayerInput(localPlayerInput);

        } catch (error) {
            console.error('Failed to initialize multiplayer:', error);
        }
    }

    initializeMultiplayer();
    ```

3.  **Integrate with Game Loop:**
    *   Call `multiplayerManager.updatePlayerInput(localInputState)` regularly to send the local player's actions to the server.
    *   Use the data from `multiplayerManager.getPlayers()` or its events (`onPlayerJoined`, `onPlayerUpdated`, `onPlayerLeft`) to render and update other players in your scene.

### 2. UI Integration (React Example - see `debug/modules/ui/multiplayer/`)

The `debug/modules/ui/multiplayer/` directory contains examples of how to integrate this core multiplayer logic with a React-based UI, including connection status displays, player lists, and registration forms.

**Key Concepts from UI Integration:**

*   **`InfiniaMultiplayerProvider` and `useInfiniaMultiplayer` hook:** These (or similar custom context/hooks) can provide easy access to the `MultiplayerManager` instance and its state throughout your React application.
*   **Component Examples:** Look for components that show how to:
    *   Display connection status.
    *   Allow users to input a username and call `multiplayerManager.registerPlayer()`.
    *   List currently connected players by observing `multiplayerManager.getPlayers()` or its events.

**Example Snippet (Conceptual - refer to actual UI module files):**
```typescript
// Simplified example of a React component using a hypothetical hook
import React, { useState, useEffect } from 'react';
import { useInfiniaMultiplayer } from './modules/ui/multiplayer/hooks'; // Adjust path
import { InputState } from './modules/multiplayer/generated'; // For input type

function MultiplayerControls() {
    const { 
        isConnected, 
        localPlayer, 
        players, 
        registerPlayer, 
        updatePlayerInput 
    } = useInfiniaMultiplayer(); // Assuming this hook wraps MultiplayerManager
    const [username, setUsername] = useState('');

    const handleRegister = async () => {
        if (username) await registerPlayer(username);
    };

    // Example: Sending input (simplified)
    useEffect(() => {
        if (isConnected && localPlayer) {
            const sendInput = () => {
                const currentInputState: InputState = { /* gather from game controls */ };
                updatePlayerInput(currentInputInputState);
            };
            const intervalId = setInterval(sendInput, 100); // Send input periodically
            return () => clearInterval(intervalId);
        }
    }, [isConnected, localPlayer, updatePlayerInput]);

    if (!isConnected) return <div>Connecting to server...</div>;

    return (
        <div>
            {!localPlayer && (
                <>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" />
                    <button onClick={handleRegister}>Join Game</button>
                </>
            )}
            {localPlayer && <div>Welcome, {localPlayer.username}!</div>}
            <h3>Players Online:</h3>
            <ul>
                {players.map(p => <li key={p.player_id}>{p.username}</li>)}
            </ul>
        </div>
    );
}
```

### 3. Third-Person Character Integration

When integrating with a third-person character controller (like in `isolatedThirdPerson.ts`):

1.  **Provide `MultiplayerManager`:** Make the `multiplayerManager` instance (or its relevant methods) available to your third-person character logic.
2.  **Local Player Input:** Instead of directly moving the character, capture input and send it via `multiplayerManager.updatePlayerInput(inputState)`.
3.  **Local Player State:** The local player's `PlayerData` (position, rotation, etc.) will be updated by the server. Your character controller should observe these updates (e.g., via `multiplayerManager.onPlayerUpdated` or by checking `multiplayerManager.getLocalPlayerState()`) and apply them to the visual character. This ensures the server is authoritative.
4.  **Remote Players:** Create and manage visual representations for other players based on data received through `multiplayerManager.onPlayerJoined`, `onPlayerUpdated`, and `onPlayerLeft`.

Refer to `debug/modules/ui/isolatedThirdPersonSpacetimeIntegration.ts` for an example of how the third-person view might be connected to the multiplayer system.

## Configuration

### Connection Parameters

The client needs to know how to connect to your SpacetimeDB instance. This is configured in `debug/modules/multiplayer/spacetimeConfig.ts`:

```typescript
// debug/modules/multiplayer/spacetimeConfig.ts
export const SPACETIMEDB_URL = "ws://localhost:3000"; // Default local SpacetimeDB server URL
export const DATABASE_NAME = "infinia_game_db";       // The name of the database you created (e.g., with spacetimedb create-db)
export const MODULE_NAME = "infinia_multiplayer_server"; // The name of your Rust module published to SpacetimeDB
// Make sure these values match your actual server setup and published module name.
```

*   **`SPACETIMEDB_URL`**: The WebSocket URL of your running SpacetimeDB server.
*   **`DATABASE_NAME`**: The name of the database you are using on the server (created with `spacetimedb create-db <your_db_name>`).
*   **`MODULE_NAME`**: The name under which your Rust server module was published (e.g., `spacetimedb publish <your_module_name>`). This name is usually defined in the `[package]` section of your server module's `Cargo.toml` file.

**Using Environment Variables (Optional but Recommended for Flexibility):**

For more flexibility, especially when deploying to different environments, you can use environment variables. You would typically use a library like `dotenv` to load a `.env` file in your client's entry point.

Example `.env` file in your project root (`d:/infiniagithub/.env`):
```env
REACT_APP_SPACETIMEDB_URL=ws://localhost:3000
REACT_APP_DATABASE_NAME=infinia_game_db
REACT_APP_MODULE_NAME=infinia_multiplayer_server
```

Then, modify `spacetimeConfig.ts` to read these:
```typescript
// debug/modules/multiplayer/spacetimeConfig.ts
export const SPACETIMEDB_URL = process.env.REACT_APP_SPACETIMEDB_URL || "ws://localhost:3000";
export const DATABASE_NAME = process.env.REACT_APP_DATABASE_NAME || "infinia_game_db";
export const MODULE_NAME = process.env.REACT_APP_MODULE_NAME || "infinia_multiplayer_server";
```
*(Ensure your build process correctly handles environment variables, e.g., Create React App for `REACT_APP_` prefixed variables)*

## Troubleshooting

### Common Issues & Checks

1.  **Connection Failed / Cannot Connect:**
    *   **SpacetimeDB Server Running?**: Ensure the `spacetimedb start` command is running in a separate terminal and hasn't exited or shown errors.
    *   **Correct URL/DB/Module Names?**: Double-check `SPACETIMEDB_URL`, `DATABASE_NAME`, and `MODULE_NAME` in `spacetimeConfig.ts` against your server setup. Pay close attention to typos.
    *   **Firewall?**: Ensure your firewall isn't blocking connections to the SpacetimeDB port (default 3000).
    *   **Browser Console Errors**: Check the browser's developer console (usually F12) for WebSocket connection errors or other JavaScript errors.

2.  **Module Not Found / Reducer Errors / Table Errors:**
    *   **Module Published?**: Verify you successfully ran `spacetimedb publish <your_module_name>` from the `debug/modules/multiplayer/server/` directory. You can list published modules with `spacetimedb list-modules` (when connected to a running server instance).
    *   **Database Exists?**: Ensure the database specified in `DATABASE_NAME` was created (`spacetimedb create-db <your_db_name>`). List with `spacetimedb list-dbs`.
    *   **Generated Bindings Up-to-Date?**: After any changes to your Rust server module's tables or reducers (`lib.rs`), you **MUST** rebuild the Rust module (`cargo build --release`) and then regenerate the TypeScript bindings (`spacetimedb generate --lang typescript --out ../generated` from the server directory). If bindings are stale, the client will try to use old/non-existent definitions.
    *   **Server Logs**: Check the terminal output where `spacetimedb start` is running. It will show logs from your Rust module, including any panics or errors occurring in your reducers.
    *   **Reducer Arguments**: Ensure the arguments you pass when calling a reducer from the client (e.g., `RegisterPlayerReducer.call(username)`) match the signature defined in your Rust `lib.rs` and reflected in the generated TypeScript reducer function.

3.  **Player Registration/Login Issues:**
    *   **`register_player` Reducer Logic**: Review the `register_player` reducer in your `lib.rs`. Check for logic errors, incorrect table operations, or unhandled conditions.
    *   **Server Logs**: Look for specific error messages related to player registration in the SpacetimeDB server logs.

4.  **Remote Players Not Appearing / Updates Not Syncing:**
    *   **Table Subscriptions**: Ensure your client code (e.g., in `MultiplayerManager` or your UI components) is correctly subscribing to `PlayerData.onInsert`, `PlayerData.onUpdate`, and `PlayerData.onDelete` (or equivalent for other relevant tables like `TerrainChunk`).
    *   **`game_tick` Logic**: If player movement or state changes are driven by the `game_tick` reducer on the server, ensure it's scheduled correctly (`GameTickSchedule` table) and its logic for updating `PlayerData` is working as expected.
    *   **`update_player_input` Reducer**: Verify this reducer is correctly receiving input from clients and updating the `InputState` within `PlayerData` on the server.
    *   **Client-Side Rendering**: Double-check your client-side logic that creates, updates, and removes visual representations of players based on the subscribed table events.

### Debugging Tips

*   **Browser Developer Tools**: Use the Network tab (for WebSocket frames, though SpacetimeDB uses a binary protocol that might not be fully human-readable there) and Console tab extensively.
*   **`console.log`**: Add liberal `console.log` statements in your client-side TypeScript code (e.g., in `MultiplayerManager`, connection callbacks, reducer call sites, table event handlers) and `println!` or `log::info!` (with `spacetimedb::log`) in your server-side Rust reducers.
*   **SpacetimeDB Admin UI**: If SpacetimeDB offers an admin UI or CLI commands to inspect table contents directly, use them to verify data on the server.
*   **Simplify**: If facing complex issues, try to simplify your test case. For example, test a single reducer call with hardcoded values, or subscribe to a single table with minimal event handling logic.

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