# Multiplayer Module (SpacetimeDB Integration)

This module contains the client-side TypeScript code for integrating multiplayer functionality using SpacetimeDB.

## Files

-   `spacetimeConfig.ts`: Handles connection logic to the SpacetimeDB instance, including setting up the `DbConnection`.
-   `playerState.ts`: Defines the `PlayerState` interface, representing the data structure for player information that will be synchronized (e.g., position, rotation, input).
-   `networkEvents.ts`: (Conceptual) Defines types for network events. With SpacetimeDB, direct table updates and reducer calls are the primary mechanisms, but this can help structure data for reducer arguments.
-   `index.ts`: Barrel file, re-exporting key components from this module.

## SpacetimeDB Server-Side Setup (Rust Module)

This client-side code expects a corresponding SpacetimeDB Rust module running on the server. You will need to:

1.  **Install SpacetimeDB CLI and Rust:**
    Follow the official SpacetimeDB documentation: [https://spacetimedb.com/docs/getting-started/installation](https://spacetimedb.com/docs/getting-started/installation)

2.  **Create a SpacetimeDB Rust Project:**
    Use the SpacetimeDB CLI to create a new Rust module project.
    ```bash
    spacetimedb new my_game_module
    cd my_game_module
    ```

3.  **Define Tables and Reducers in `src/lib.rs`:**
    You'll need at least a `PlayerState` table and reducers to update it. Example:

    ```rust
    use spacetimedb::{{spacetimedb, table::Table, ReducerContext, Identity, SpacetimeType, Timestamp}};

    #[spacetimedb(table)]
    pub struct PlayerState {
        #[primarykey]
        pub player_id: Identity, // Use SpacetimeDB Identity for unique player IDs
        pub pos_x: f32,
        pub pos_y: f32,
        pub pos_z: f32,
        pub rot_x: f32, // Quaternion x
        pub rot_y: f32, // Quaternion y
        pub rot_z: f32, // Quaternion z
        pub rot_w: f32, // Quaternion w
        // Add other fields as needed, e.g., for input state, animation, etc.
        // pub input_forward: bool,
        pub last_update_time: Timestamp,
    }

    #[spacetimedb(reducer)]
    pub fn update_player_state(
        ctx: ReducerContext,
        pos_x: f32,
        pos_y: f32,
        pos_z: f32,
        rot_x: f32,
        rot_y: f32,
        rot_z: f32,
        rot_w: f32,
        // ... other parameters for input state etc.
    ) -> Result<(), String> {
        let player_id = ctx.sender;
        let current_time = ctx.timestamp;

        // Upsert player state
        PlayerState::upsert(PlayerState {
            player_id,
            pos_x,
            pos_y,
            pos_z,
            rot_x,
            rot_y,
            rot_z,
            rot_w,
            last_update_time: current_time,
        })?;
        Ok(())
    }

    // Reducer for when a player disconnects (optional, SpacetimeDB handles some cleanup)
    #[spacetimedb(disconnect)]
    pub fn identity_disconnected(ctx: ReducerContext) -> Result<(), String> {
        println!("Player disconnected: {:?}", ctx.sender);
        PlayerState::delete_by_player_id(&ctx.sender);
        Ok(())
    }
    ```

4.  **Build and Run the SpacetimeDB Module:**
    ```bash
    spacetimedb build
    spacetimedb run
    ```
    Note the URL and database name output by `spacetimedb run`. You'll need these for `spacetimeConfig.ts`.

5.  **Generate TypeScript Client Bindings:**
    After building your Rust module, generate the TypeScript client SDK bindings:
    ```bash
    # From your Rust module directory (e.g., my_game_module)
    spacetimedb generate --lang typescript --out ../your_typescript_project/src/generated_spacetimedb # Adjust path as needed
    ```
    This will create files like `player_state.ts`, `update_player_state_reducer.ts`, etc., in the output directory. You will import these generated files in your main game code (e.g., `isolatedThirdPerson.ts`) to interact with SpacetimeDB.

## Client-Side Integration Steps (in your game code, e.g., `isolatedThirdPerson.ts`)

1.  **Install SpacetimeDB TypeScript SDK:**
    ```bash
    npm install @clockworklabs/spacetimedb-sdk
    # or
    yarn add @clockworklabs/spacetimedb-sdk
    # or
    pnpm add @clockworklabs/spacetimedb-sdk
    ```

2.  **Import and Use Generated Bindings:**
    -   Import `connectToSpacetimeDB` from `./multiplayer/spacetimeConfig.ts`.
    -   Import generated table classes (e.g., `PlayerState`) and reducer functions (e.g., `UpdatePlayerStateReducer`) from the `generated_spacetimedb` folder.
    -   Call `connectToSpacetimeDB()`.
    -   Once connected, register reducers and subscribe to table updates using the `DbConnection` instance.
    -   Use the generated reducer functions to send updates (e.g., local player movement).
    -   Use table update callbacks (`onInsert`, `onUpdate`, `onDelete` for the `PlayerState` table) to create, update, and remove remote player representations in your game world.

## Important Notes

-   Ensure the `SPACETIMEDB_URL`, `DATABASE_NAME`, and `MODULE_NAME` constants in `spacetimeConfig.ts` match your SpacetimeDB server setup.
-   The client-side code in this module provides the basic structure. You will need to integrate it with your game logic in `isolatedThirdPerson.ts` or similar files to handle player input, character updates, and rendering of remote players.
-   Error handling, reconnection logic, and more advanced features like client-side prediction and lag compensation are not included in this basic setup and would need to be implemented separately if required.