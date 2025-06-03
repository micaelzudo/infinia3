# Marching Cubes V2 - Dynamic & Editable Terrain

## Overview

This project demonstrates the Marching Cubes algorithm applied to generate a 3D terrain that is:

1.  **Dynamic:** Chunks of terrain are loaded/generated around the player as they move.
2.  **Editable:** The terrain's underlying noise data can be modified in real-time via mouse interaction, and the corresponding mesh updates.
3.  **Seamless:** Special care is taken during mesh generation to use data from neighboring chunks, preventing visible seams or gaps at chunk boundaries.

This implementation differs from a basic Marching Cubes example by incorporating systems for chunk management, asynchronous noise generation via web workers, real-time editing, and sophisticated neighbor handling.

## Core Concepts & Implementations

Here are the key pieces necessary for the current functionality, reflecting significant refactoring to enable seamless vertical editing and loading:

1.  **Chunk System (`constants.ts`, `utils.ts`, `firstPerson.ts`)**
    *   The infinite world is divided into finite **Chunks** of `CHUNK_SIZE` x `CHUNK_HEIGHT` x `CHUNK_SIZE`.
    *   Each chunk is identified by a unique string key based on its X, Y, and Z coordinates using the `getChunkKeyY` utility function (see `Code_Snippets.md` Section 1 for implementation). This 3D key is essential for handling vertical layers correctly, distinguishing between chunks like `0,0,0` and `0,-1,0`, which a simple 2D key could not do.
    *   A central dictionary `loadedChunks` (in `firstPerson.ts`, see `Code_Snippets.md` Section 2 for type definitions) stores the data for currently loaded chunks, mapping the 3D chunk key to a `ChunkData` object containing `{ mesh: THREE.Mesh | null, noiseMap: NoiseMap | null }`. `null` values indicate states such as pending generation, failed generation, or an empty chunk space after mesh generation.

2.  **Noise Generation (`noiseMapGenerator.ts`, `simplex-noise`)**
    *   Terrain shape is determined by a 3D **Noise Map** (a `Float32Array[][]`, defined in `types.ts` and shown in `Code_Snippets.md` Section 2). Dimensions are `(CHUNK_HEIGHT + 1) x (CHUNK_SIZE + 1) x (CHUNK_SIZE + 1)` to cover cube corners.
    *   The `generateNoiseMap` function (see `Code_Snippets.md` Section 3) creates this data for a specific chunk coordinate (`chunkX`, `chunkY`, `chunkZ`).
    *   Includes `noiseOffset` logic for vertical shaping. Debugging focused on fixing the offset calculation for `worldY < 10`. The original `Math.pow(..., 3)` caused `NaN` values. The fix involved clamping the offset (e.g., `Math.max(-10, (worldY - 10) * 0.5)`) to ensure valid `Float32Array` data, as shown in the snippet.
    *   Includes basic `try...catch` error handling around the generation loops and explicitly returns `null` if generation fails, allowing calling functions to handle the failure gracefully (see snippet). **Rationale:** Returning `null` provides a clear signal of failure compared to potentially returning a partially filled or corrupted `NoiseMap`.
    *   A simple `noiseMapCache` exists but is currently disabled and unsuitable for varying `chunkY` as its key only uses X and Z. **Note:** Re-enabling caching would require updating the key format to include `chunkY`.
    *   **Crucially, noise generation is decoupled from mesh generation.** This allows noise maps to be pre-calculated by workers. **Rationale:** Separating these tasks simplifies the worker's role and allows the main thread to manage neighbor data access, which is complex to coordinate across workers.

3.  **Dynamic Loading (`firstPerson.ts` - `move` function)**
    *   The `move` function constantly checks the player's current chunk coordinates.
    *   It iterates through a grid around the player (defined by `LOAD_CHUNK_RADIUS`).
    *   For each nearby coordinate, it checks if that chunk key exists in `loadedChunks`.
    *   If a chunk is *not* loaded, a message is posted to the Web Worker pool to request its noise map generation. **Note:** This currently only loads chunks at `chunkY = 0`. Loading vertical chunks during movement is not yet implemented.

4.  **Worker Pool (`firstPerson.ts`, `worker.mts`)**
    *   To avoid blocking the main render loop, noise generation is offloaded to **Web Workers**.
    *   `firstPerson.ts` creates a pool of workers (`workerPool`).
    *   When a new chunk's noise map is needed, a message `[x, y, z, noiseParams...]` is sent to an available worker.
    *   `worker.mts` listens, calls `generateNoiseMap`, and posts the result `[x, y, z, noiseMap | null]` back to the main thread (see `Code_Snippets.md` Section 4 for the worker's `postMessage` logic).

5.  **Main Thread Worker Listener (`firstPerson.ts`)**
    *   The main thread listens for messages *back* from the workers, expecting the `WorkerNoiseMapMessage` type (`[x, y, z, noiseMap | null]`, see `Code_Snippets.md` Section 2).
    *   Upon receiving the `noiseMap` (or `null` if generation failed):
        *   It stores the result in the correct `loadedChunks[key]`. If `noiseMap` is `null`, it logs a warning and stops processing for this chunk.
        *   It **immediately triggers mesh generation on the main thread**. **Rationale:** While initially attempted in workers, mesh generation requires access to potentially all 6 neighbor noise maps. Coordinating the retrieval or generation of these neighbors across different workers proved complex and prone to race conditions. Moving mesh generation entirely to the main thread upon receiving a noise map simplifies data access, ensuring all necessary neighbor data (fetched or generated synchronously via `getOrGenNeighborMap`) is available when `generateMesh` is called.
        *   The mesh generation steps are:
            *   Fetching/generating noise maps for **all 6 neighbors** (X+/-, Y+/-, Z+/-) using the **`getOrGenNeighborMap`** helper function defined *locally* within the listener (see `Code_Snippets.md` Section 4 for its implementation). This helper synchronously checks `loadedChunks` and calls `generateNoiseMap` directly if a neighbor map is missing, storing the result.
            *   Calling `generateMesh(x, y, z, { noiseMap }, ...)` within a `try...catch` block for robustness, passing the received `noiseMap` and all 6 neighbor maps (`noiseMapBelow`, `noiseMapAbove`, etc.).
            *   Adding the resulting mesh to the scene and storing it in `loadedChunks`.

6.  **Mesh Generation with Neighbors (`meshGenerator.ts`)**
    *   The `generateMesh` function (see `Code_Snippets.md` Section 5) takes the chunk's coordinates, its own `noiseMap`, and the **`NoiseMap`s of its 6 direct neighbors**.
    *   It iterates through each potential cube position (`x`, `y`, `z`).
    *   For each cube, it determines the noise values of its 8 corners using the `getNoise` helper function (implementation in Snippet 5). Corners are "inside" if noise < `SURFACE_LEVEL`.
    *   The `getNoise` helper checks if a corner lies outside the current chunk's boundaries. If so, it samples the value from the corresponding plane of the neighbor map (e.g., using `noiseMapBelow[CHUNK_HEIGHT + y][z][x]` when `y < 0`). This neighbor sampling is essential for seamless meshes.
    *   **Boundary Check:** Includes validation within the main loop (`cornerNoises.some(n => n === null)`) to check if required neighbor map data was successfully retrieved by `getNoise`. If neighbor data is missing (e.g., `noiseMapBelow` is `null` when `y=0`), it logs a warning and skips processing that specific cube using `continue` (see snippet) to prevent errors.
    *   Performs Marching Cubes triangulation (`triangulation.ts`).
    *   Calculates vertex positions (simplified midpoint in snippet).
    *   **Error Handling:** Adds generated triangle geometries to `geoms`. **Includes a check `if (geoms.length === 0)`** before merging. If no geometry was generated, it returns an empty `THREE.Mesh()` (not `null`) to prevent downstream errors (see snippet).
    *   **Correct Positioning:** Uses `const yOffset = chunkY * CHUNK_HEIGHT;` and applies it via `geom.translate(x, y + yOffset, z)` (see snippet) to correctly place chunks vertically.
    *   Merges geometries and returns the final `THREE.Mesh`.

7.  **Terrain Editing (`firstPerson.ts` - `editTerrain`, `noiseMapEditor.ts`)**
    *   The `editTerrain` function runs in the animation loop, using a `Raycaster`.
    *   Includes throttling logic.
    *   If editing triggered, calls `editNoiseMapChunks` from `noiseMapEditor.ts` (see `Code_Snippets.md` Section 6).
    *   `editNoiseMapChunks` performs the following:
        *   **Calculates Base Chunk:** Determines initial chunk coordinates. **Crucially fixed** to use `chunkY = Math.floor(worldPoint.y / CHUNK_HEIGHT)` instead of hardcoding 0 (see snippet).
        *   **Iterates Edit Radius:** Loops 3D radius.
        *   **Determines Target:** Calculates target chunk and local map coordinates for each point in radius.
        *   **Handles Neighbors (Crucial Fix - "Generate-on-Demand"):**
            *   Retrieves or generates the noise map for the `targetChunkKey`. It first checks `loadedChunks`. If missing/null (`if (!existingNoiseMap)` block in snippet), it *immediately* calls `generateNoiseMap` and stores the result back into `loadedChunks`. This was key for editing into ungenerated areas (e.g., negative Y).
            *   **Cloning:** If the `targetChunkKey` is not already in the temporary `modifiedNoiseMaps` collection *for this specific edit operation*, it retrieves the map from `loadedChunks` (which might have just been generated). It performs a **`structuredClone`** (see Infrastructure #11 and Snippet 6) and stores the clone in `modifiedNoiseMaps`. This happens only once per chunk *per edit operation*. Logs warnings if retrieval/cloning fails. **Rationale:** `structuredClone` creates a deep copy, ensuring that modifications made to one point within the edit radius don't affect the noise values used for calculating edits at *other* points within the same radius during a single user action (click or drag segment). This provides atomicity for the edit operation.
            *   **Applies Edit:** Modifies the noise value at `targetMapY/Z/X` within the **cloned** map (`mapToModify`) using the `applyEditNoise` helper (implementation in snippet). This uses a linear falloff and the **reversed** `addOrRemove` multiplier (`-1` for removing) and adjusted `divisor` identified during debugging.
        *   **Returns Affected Coordinates:** Returns a list of `[cx, cy, cz]` coordinates for chunks whose noise maps were modified (stored in `affectedChunkCoords` set in snippet).
    *   After `editNoiseMapChunks` returns `affectedChunks`:
    *   `editTerrain` iterates through these coordinates (loop shown in `Code_Snippets.md` Section 7):
        *   Checks if `loadedChunks[key]?.noiseMap` exists.
        *   Removes the old mesh (`disposeNode`).
        *   Fetches/generates the `NoiseMap`s for **all 6 neighbors** using the **`getOrGenNeighborMap`** helper (same one used by worker listener, see snippet).
        *   Calls `generateMesh(cx, cy, cz, { noiseMap: chunkData.noiseMap }, ...)` passing the **updated** map (`chunkData.noiseMap`) and all 6 **latest** neighbor maps.
        *   Adds the new mesh to the scene and updates `loadedChunks`.

## Supporting Infrastructure & Details

Beyond the core algorithms, several infrastructural components are crucial for this implementation:

1.  **Project Structure & Build (`src/`, Vite, TypeScript)**
    *   **Organization:** Code is primarily organized within the `src/` directory. Key files include:
        *   `constants.ts`: Global constants (`CHUNK_SIZE`, etc.).
        *   `types.ts`: Shared type definitions (`NoiseMap`, `ChunkData`).
        *   `utils.ts`: Utility functions (`getChunkKeyY`).
        *   `noiseMapGenerator.ts`: Logic for generating noise data.
        *   `meshGenerator.ts`: Marching Cubes implementation and mesh creation.
        *   `noiseMapEditor.ts`: Logic for modifying noise data during edits.
        *   `firstPerson.ts`: Main application logic, rendering loop, event handling, state management, worker coordination.
        *   `worker.mts`: Code executed by the web workers (noise generation).
        *   `triangulation.ts`: Marching Cubes lookup tables.
    *   **Vite:** Used as the frontend build tool (`vite.config.js`). Provides HMR and optimized builds.
    *   **TypeScript:** (`tsconfig.json`) provides static typing for improved maintainability and error detection.
    *   **Module System:** ES Modules (`import`/`export`) for code organization.

2.  **Key Dependencies**
    *   **Three.js:** Core 3D library.
    *   **`simplex-noise` (or similar):** For noise generation.
    *   **Web Workers (native):** Used directly via `new Worker()` for background threads.
    *   **`stats.js`:** Performance monitoring.

3.  **Core Data Structures (`types.ts`, `firstPerson.ts`)**
    *   **`NoiseMap` (`Float32Array[][]`):** 3D array storing noise values. `Float32Array` offers better memory efficiency than standard arrays (details in `Code_Snippets.md` Section 2).
    *   **`LoadedChunks` (`{ [chunkKeyY: string]: ChunkData }`):** Central cache using the 3D chunk key.
        *   Stores `ChunkData` (`{ mesh: THREE.Mesh | null; noiseMap: NoiseMap | null }`).
        *   `null` values indicate important states: `noiseMap: null` means generation failed or hasn't happened; `mesh: null` means meshing failed, hasn't happened, or the chunk was empty space (details in `Code_Snippets.md` Section 2).

4.  **Coordinate Systems & Transformations (`constants.ts`, `utils.ts`, `*`)**
    *   **`constants.ts`:** Defines fixed values like `CHUNK_SIZE`, `CHUNK_HEIGHT`, and `SURFACE_LEVEL` (see `Code_Snippets.md` Section 8 for key examples), ensuring consistency.
    *   **`utils.ts`:** Contains helpers like `getChunkKeyY(x, y, z)` (see `Code_Snippets.md` Section 1) for the standard ``${x},${y},${z}`` key format.
    *   **Coordinate Systems:** World, Chunk (integer `chunkX, chunkY, chunkZ`), Local Voxel (integer `x, y, z` within noise map).

5.  **State Management (`firstPerson.ts`)**
    *   Global variables within `firstPerson.ts` manage the application's state:
        *   `camera`, `scene`, `renderer`: Core Three.js objects.
        *   `loadedChunks`: The central data cache.
        *   `seed`, `noiseLayers`, `interpolate`, `wireframe`: Terrain generation parameters (some loaded from `sessionStorage`).
        *   `mouse`, `keys`, `jump`, `yVelocity`, `grounded`: Player input and physics state.
        *   `wasMouseDownLastFrame`, `lastEditBaseChunkKey`: State for throttling terrain edits.
        *   `workerPool`: Holds references to the active web workers.

6.  **Event Handling & Rendering Loop (`firstPerson.ts`)**
    *   **Event Listeners:** Standard browser event listeners (`mousedown`, `mouseup`, `keydown`, `keyup`, `resize`, `pointerlockchange`) capture user input and update state variables (`mouse`, `keys`, etc.).
    *   **`animation` Function:** The core rendering loop, called by `renderer.setAnimationLoop`. It orchestrates updates each frame:
        *   Updates stats (`stats.begin()`/`end()`).
        *   Updates camera direction and raycaster.
        *   Updates mobile controls if applicable.
        *   Calls `move()` to handle player physics, collision checks, and trigger dynamic chunk loading.
        *   Calls `editTerrain()` to handle terrain modification based on mouse state (includes throttling).
        *   Calls `renderer.render(scene, camera)` to draw the scene.

7.  **Initial Synchronous Load (`firstPerson.ts`)**
    *   On startup, a small area of chunks around the origin (e.g., Y=0 and Y=-1) is generated *synchronously* on the main thread.
    *   This involves calling `generateNoiseMap` directly and then `generateMesh` for each initial chunk, including fetching/generating and passing necessary neighbor data (primarily the Y=-1 map when generating Y=0 meshes) to ensure the starting area is seamless.
    *   This provides immediate visible terrain while asynchronous loading handles chunks further away.

8.  **Player Physics & Collision (`firstPerson.ts` - `move` function)**
    *   Basic first-person physics are implemented within the `move` function.
    *   **Movement:** Translates camera position based on keyboard input (`WASD`/Arrows) relative to camera direction.
    *   **Gravity/Jumping:** Simple vertical velocity (`yVelocity`) is applied, affected by gravity (`GRAVITY`) and jumping (`JUMP_VELOCITY`).
    *   **Ground Check:** A `Raycaster` (`groundRaycaster`) points downwards from the camera. It checks for intersections *only with the mesh of the current chunk the player is in* (`loadedChunks[currentChunkKey]?.mesh`). If an intersection is close, `grounded` is set to true, and vertical position/velocity are adjusted.
    *   **Basic Collision:** Additional raycasters (`frontRaycaster`, `backRaycaster`, etc.) check short distances in movement directions against the current chunk's mesh to prevent walking directly *into* terrain within the *same* chunk. *(Note: This does not prevent walking through chunk boundaries if the next chunk hasn't loaded its mesh yet)*.

9.  **Memory Management (`disposeNode.ts`, `firstPerson.ts`)**
    *   When terrain is edited or chunks are (potentially) unloaded, the old `THREE.Mesh` objects must be properly disposed of to free up GPU memory.
    *   The `disposeNode` utility function is used in `editTerrain` to remove the old mesh's geometry and material from memory before replacing it.
    *   *(Note: This implementation doesn't currently feature chunk unloading, but proper disposal is critical in systems that do.)*

10. **Error Handling**
    *   Basic `try...catch` blocks are used in critical areas, such as parsing worker messages (now less relevant after the refactor) and generating meshes on the main thread (`editTerrain` and worker listener), to prevent errors in one chunk from crashing the entire application and log issues to the console.

11. **Deep Copying for Edits (`noiseMapEditor.ts`)**
    *   Uses `structuredClone()` to prevent edits within the same radius from interfering (ensuring atomicity for a single click/drag operation).
    *   When a chunk is affected *for the first time within a single `editNoiseMapChunks` call* (`if (!(targetChunkKey in modifiedNoiseMaps))` check in `Code_Snippets.md` Section 6), its *current* noise map is deep-copied into `modifiedNoiseMaps`.
    *   All subsequent modifications *for that chunk during that operation* happen on this temporary copy (`mapToModify`).
    *   **Rationale:** This ensures atomicity for each edit operation (single click or drag segment), preventing cascading effects within the radius.

## Summary of Last Changes (Addressing Recent Issues)

The most recent sequence of changes focused on fixing the "indestructible terrain" boundary issue, worker errors, and enabling seamless vertical editing:

1.  **Neighbor Handling in `generateMesh`:** Modified `generateMesh` to accept 6 neighbor noise maps. Added `getNoise` helper to sample across boundaries (see `Code_Snippets.md` Section 5 for implementation). Added checks for missing neighbor data (`cornerNoises.some(n => n === null)`) and empty geometry (`geoms.length === 0`). Corrected `yOffset` calculation (`chunkY * CHUNK_HEIGHT`) and application (`geom.translate`).
2.  **Neighbor Fetching/Generation during Edits & Loading:** Updated mesh regeneration logic in `editTerrain` (see `Code_Snippets.md` Section 7) and the worker listener in `firstPerson.ts` (see `Code_Snippets.md` Section 4). Both now use a helper (`getOrGenNeighborMap`) to **synchronously** fetch or generate noise maps for all 6 neighbors *before* calling `generateMesh`.
3.  **Corrected Worker Message Handling:** Rewritten the worker `message` listener (see `Code_Snippets.md` Section 4) to expect `[x, y, z, noiseMap | null]` and perform mesh generation (including fetching neighbors) entirely on the main thread within a `try...catch`. **Rationale:** Simplified neighbor data access compared to coordinating between workers.
4.  **Reliable Noise Generation for Neighbors:** Refactored `editNoiseMapChunks` (see `Code_Snippets.md` Section 6) to *always* attempt `generateNoiseMap` if a required neighbor map is not found (`if (!existingNoiseMap)` check - the "generate-on-demand" fix). Fixed initial `chunkY` calculation based on `worldPoint.y`. Fixed `noiseOffset` calculation in `generateNoiseMap` (see `Code_Snippets.md` Section 3) to clamp extreme values and prevent `NaN`s. Adjusted edit logic (`addOrRemove` multiplier, strength `divisor`) in `applyEditNoise`. Implemented `structuredClone` for atomic edits.

These changes allow `generateMesh` to create seamless meshes by using neighbor data, ensure this neighbor data is available when needed (both for loading new chunks and regenerating edited chunks), and fix the core bug preventing noise maps for chunks below Y=0 from being generated reliably on demand.

## Debugging Journey: Enabling Vertical Edits

Achieving seamless terrain editing, especially across vertical chunk boundaries (above `CHUNK_HEIGHT` and below `Y=0`), presented several challenges related to mesh generation, noise map generation for negative Y coordinates, and ensuring neighbor data was available. This section summarizes the key issues encountered and the fixes implemented, which are described in more detail within the `Core Concepts & Implementations` section above.

1.  **Initial Problem:** Users could not edit terrain below the initial ground level (`Y=0`) or significantly above the initial height. Edits seemed to hit an invisible floor or behave incorrectly at vertical boundaries. The initial `editNoiseMapChunks` explicitly prevented edits outside the current chunk's Y-bounds with `if (y <= 0 || y >= CHUNK_HEIGHT) continue;`, directly blocking vertical edits.

2.  **Root Causes & Solutions:**
    *   **Mesh Generation Errors:** Fixed errors in `generateMesh` related to handling empty geometry arrays (`geoms.length === 0` check prevents crash in `mergeBufferGeometries`) and incorrect vertical positioning (`yOffset = chunkY * CHUNK_HEIGHT` fix).
    *   **Editing Logic:** Corrected `editNoiseMapChunks` to properly calculate the initial `chunkY` based on the click location (`worldPoint.y`). Reversed the `addOrRemove` multiplier logic (-1 for removing, +1 for adding) to correctly decrease/increase noise relative to `SURFACE_LEVEL`. Adjusted edit strength `divisor` significantly (e.g., to 5) to overcome inherent noise values at Y < 0.
    *   **Noise Map Generation (Y < 0):** The most persistent issue was the failure to generate/retrieve noise maps for `chunkY = -1` (logged as `Could not obtain noise map for X,-1,Z`). Diagnosing this involved adding detailed logging and `try...catch` blocks. The root cause was identified in `editNoiseMapChunks`: it wasn't attempting to *generate* noise maps for chunks completely missing from `loadedChunks`. The fix involved refactoring the logic to reliably *trigger* `generateNoiseMap` for any missing neighbor (vertical or horizontal) *before* attempting to use its data (the "generate-on-demand" logic in `Code_Snippets.md` Section 6). Adjustments to `noiseOffset` calculations (clamping extreme values) in `generateNoiseMap` were also necessary to prevent `NaN` values (see `Code_Snippets.md` Section 3).
    *   **Missing Neighbor Data:** Modified `generateMesh` to accept and use noise maps from all 6 neighbors (`noiseMapBelow`, `noiseMapAbove`, etc.) via the `getNoise` helper, enabling seamless stitching (see `Code_Snippets.md` Section 5). Updated `editTerrain` (Snippet 7) and worker listener (Snippet 4) to fetch/generate neighbors using `getOrGenNeighborMap`. Added boundary checks (`cornerNoises.some(n => n === null)`) in `generateMesh` to skip cubes if neighbors are missing.

3.  **Result:** The combination of these fixes ensures that necessary noise data for adjacent vertical and horizontal chunks is created reliably during editing or loading. `editNoiseMapChunks` correctly modifies this data, and `generateMesh` uses the neighbor data to create visually seamless transitions across chunk boundaries, allowing for effective digging down and building up.

![Landing page](screenshots/landing-page-rotated.png)

<p align="center">
   <i>
      A 3D terrain generator and editor
   </i>
</p>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Technology](#technology)
- [Algorithm](#algorithm)
- [Optimizations](#optimizations)
- [Acknowledgements](#acknowledgements)

## Features

### Noise editor

<img src="screenshots/noise-editor-video.gif" width="100%" alt="Noise editor video" />

<p align="center">
  <i>
    Adjustable noise for varied terrain options
  </i>
</p>

Uses three layers of noise values at different frequencies and strengths in order to create a more detailed landscape

```js
noiseValue =
  1 * noise(x / frequency1, y / frequency1, z / frequency1) +
  0.5 * noise(x / frequency2, y / frequency2, z / frequency2) +
  0.25 * noise(x / frequency3, y / frequency3, z / frequency3);
```

**Options**

- Sliders to adjust noise frequencies
- Button to generate random seed
- Toggle interpolation and wireframe view

---

### First person mode

<img src="screenshots/first-person-video.gif" width="100%" alt="First person video" />

<p align="center">
  <i>
    Explore the terrain in first person
  </i>
</p>

**Controls**

- `W`,`A`,`S`,`D` or `Arrow Keys` to move
- `Space` to jump
- `Mouse` to look around

---

### Terrain editor

<img src="screenshots/edit-terrain-video.gif" width="100%" alt="Edit terrain video" />

<p align="center">
  <i>
    Deformable terrain in real time
  </i>
</p>

**Controls**

- `Left Click` to add terrain
- `Right Click` to remove terrain

## Installation

Install the dependencies and run the app

```sh
cd marching-cubes-v2
npm install
npm run dev
```

Run tailwind to edit the CSS and styling

```sh
npm run tailwind:dev
```

## Technology

- [Three.js] - Library for creating 3D graphics in a web browser
- [Typescript] - Superset of Javascript with strong static typing
- [simplex-noise] - Library for generating Simplex noise (used for terrain)
- [TailwindCSS] - CSS framework for rapid styling
- [Vite] - Frontend build tool for quicker development

## Algorithm

Marching cubes is an algorithm used for generating 3D terrain. It works by sampling the corner points of a cube using a function that takes in a point and returns a single value.

The core triangulation logic, including lookup tables (`table`, `edges`, `edgeCorners`), is typically found in `triangulation.ts`.

If the value is below a certain "surface-level" threshold, it is considered empty space. However, if the value is above the surface-level value then it is considered to be inside the surface, or underground.

After doing this for each corner of the cube, we get a list of above-ground and underground points, and the goal is to construct a surface to surround the underground points.

Repeat this for each cube in a chunk and the result is a terrain-like shape.

![Marching cubes algorithm](screenshots/marching-cubes-algorithm.png)

<p align="center">
  <i>
    Bolded corners are underground and a surface is created to enclose the corner
  </i>
</p>

## Optimizations

From taking seconds just to render a few chunks, to an infinite chunk generator with deformable terrain, here are some of the optimizations that made it all possible.

| Optimization   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BufferGeometry | Buffer geometries are a feature in Three.js that store geometry data in buffers representing parallel arrays. This reduces the amount of memory and time used to store and transform the data.                                                                                                                                                                                                                                                      |
| Noise Caching  | On the noise editor page, sliding the frequency sliders requires recomputing the noise map multiple times per second. To reduce the number of computations required, noise values are cached so that only the layer that changes will get recomputed and added on to the cached values.                                                                                                                                                             |
| Simplex Noise  | Simplex noise is an improved version of Perlin noise. It requires less calculations, scales better to higher dimensions, and reduces directional artifacts. It has a complexity of $O(n^2)$ as opposed to Perlin noise's $O(n2^n)$ where $n$ is the number of dimensions.                                                                                                                                                                           |
| Web Workers    | While Javascript is a single-threaded language, web workers enable background threads. They are used here to calculate **noise maps** (`generateNoiseMap`) in parallel, offloading this from the main thread. The worker posts `[x, y, z, noiseMap | null]` back (see `Code_Snippets.md` Section 4). The main thread listener then handles mesh generation based on the received noise map and required neighbor data. This significantly improves framerate during chunk loading. |

## Potential Future Improvements & Current Limitations

*   **Interpolation:** Vertex interpolation logic in `generateMesh` is currently simplified (using midpoint). Re-enabling/refining proper interpolation would require careful handling of cases where edge vertices span across different neighbor chunks.
*   **Chunk Unloading:** No mechanism currently exists to unload distant chunks, which could lead to high memory usage over extended sessions.
*   **Collision Detection:** Collision is basic, checking only against the current chunk's mesh. It doesn't prevent walking through boundaries if the next chunk isn't loaded, nor does it handle complex interactions smoothly.
*   **Vertical Chunk Loading:** Dynamic loading (`move` function) currently only triggers loading for chunks at `chunkY = 0`.
*   **Neighbor Fetching Optimization:** The `getOrGenNeighborMap` logic is duplicated in `firstPerson.ts` (worker listener and `editTerrain`). Refactoring this into a shared utility or class could improve maintainability.
*   **Noise Caching:** The noise map cache is disabled and needs redesigning to support varying Y levels if re-enabled.
*   **Level of Detail (LOD):** Distant chunks could use lower-resolution meshes for performance.
*   **Diagonal Neighbors:** True corner interpolation might require sampling diagonal neighbors, which `getNoise` doesn't currently handle.

## Acknowledgements

Inspired by Sebastian Lague's [Coding Adventure: Marching Cubes](https://www.youtube.com/watch?v=M3iI2l0ltbE&ab_channel=SebastianLague)
<br/>
Improved version of [marching-cubes](https://github.com/ivanwang123/marching-cubes) ([live](https://marching-cubes.vercel.app))

[//]: #
[three.js]: https://threejs.org
[typescript]: https://www.typescriptlang.org
[simplex-noise]: https://github.com/jwagner/simplex-noise.js # (Or link to specific library used if known)
[tailwindcss]: https://tailwindcss.com
[vite]: https://vitejs.dev
