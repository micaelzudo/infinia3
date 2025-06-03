# Code Snippets: Dynamic & Editable Terrain Infrastructure

This file provides detailed code snippets and explanations for the key infrastructure components discussed in the main `README.md`, focusing on how they enable dynamic loading, seamless meshing across boundaries (including vertical), and real-time terrain editing.

---

## 1. Chunk Identification & Keying

**File:** `src/utils.ts`

**Purpose:** To uniquely identify each chunk in 3D space for storage and retrieval in the `loadedChunks` dictionary. A simple X,Z key is insufficient when dealing with vertical layers.

```typescript
// src/utils.ts

import { CHUNK_SIZE } from "./constants";

// ... other utility functions ...

/**
 * Generates a unique string key for a chunk based on its X, Y, and Z coordinates.
 * Essential for the loadedChunks dictionary to handle multiple vertical layers.
 * Format: "x,y,z"
 */
export function getChunkKeyY(chunkX: number, chunkY: number, chunkZ: number): string {
  return `${chunkX},${chunkY},${chunkZ}`;
}

// ... other utility functions ...
```

**Explanation:**
The shift from 2D chunk keys (based only on X and Z) to 3D keys using `getChunkKeyY` was fundamental for enabling vertical editing and potentially vertical chunk loading. This ensures that noise maps and meshes for chunks at different heights (e.g., `0,0,0` vs. `0,-1,0`) are stored and accessed correctly in the `loadedChunks` cache.

---

## 2. Core Data Structures

**File:** `src/types.ts`

**Purpose:** Defines the structure of the core data used throughout the application, ensuring type safety.

```typescript
// src/types.ts

// Represents the 3D noise data for a single chunk.
// Dimensions: (CHUNK_HEIGHT + 1) x (CHUNK_SIZE + 1) x (CHUNK_SIZE + 1)
// Using Float32Array is more memory-efficient than standard arrays for numerical data.
export type NoiseMap = Float32Array[][];

// Structure stored in the loadedChunks dictionary for each chunk key.
export interface ChunkData {
  mesh: THREE.Mesh | null; // The renderable Three.js mesh, null if not yet generated or chunk is empty.
  noiseMap: NoiseMap | null; // The underlying noise data, null if not yet generated or generation failed.
}

// The main dictionary storing all loaded chunk data, keyed by the 3D chunk string key.
export type LoadedChunks = {
  [chunkKeyY: string]: ChunkData;
};

// Type definition for messages received back from noise generation workers.
export type WorkerNoiseMapMessage = [number, number, number, NoiseMap]; // [chunkX, chunkY, chunkZ, noiseMap]

// (Other types might be defined here, e.g., for worker parameters)
```

**Explanation:**
*   `NoiseMap`: Defines the precise structure holding the scalar field values used by the Marching Cubes algorithm. The dimensions include `+1` because the algorithm needs values at the corners of cubes.
*   `ChunkData`: Encapsulates both the visual representation (`mesh`) and the underlying data (`noiseMap`) for a chunk. `null` values indicate states like "noise generated but not meshed" or "generation failed".
*   `LoadedChunks`: The central cache. Using the 3D `chunkKeyY` is critical. Its structure dictates how chunk data is stored and accessed. The explicit allowance for `NoiseMap | null` was important during debugging, as noise generation could fail.
*   `WorkerNoiseMapMessage`: Defines the expected data format received from workers after the refactor (sending back only the noise map).

---

## 3. Noise Generation & Vertical Handling

**File:** `src/noiseMapGenerator.ts`

**Purpose:** Generates the 3D `NoiseMap` data for a given chunk coordinate, handling vertical offsets and potential errors.

```typescript
// src/noiseMapGenerator.ts
import SimplexNoise from "simplex-noise";
import { CHUNK_HEIGHT, CHUNK_SIZE, NOISE_LAYERS, NoiseLayer } from "./constants";
import { NoiseMap } from "./types";

// Initialize simplex noise instance (potentially with seed)
// const simplex = new SimplexNoise(seed); // Example

// Simplified Cache (Currently Disabled during debugging/refactoring)
// const noiseMapCache: { [key: string]: number } = {};
// const cacheNoiseMap = false; // Flag to disable caching

export function generateNoiseMap(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  seed: string, // Or other parameters like noiseLayers
  // Assuming NOISE_LAYERS is accessible here or passed as param
): NoiseMap | null { // Return null if generation fails

  const simplex = new SimplexNoise(seed);
  const noiseMap: NoiseMap = [];

  console.log(`Generating noise map for chunk ${chunkX},${chunkY},${chunkZ}`); // Added for debugging

  try { // Added try...catch during debugging to pinpoint failures
    for (let y = 0; y <= CHUNK_HEIGHT; y++) {
      const slice: Float32Array[] = [];
      for (let z = 0; z <= CHUNK_SIZE; z++) {
        const line = new Float32Array(CHUNK_SIZE + 1);
        for (let x = 0; x <= CHUNK_SIZE; x++) {
          const worldX = chunkX * CHUNK_SIZE + x;
          const worldY = chunkY * CHUNK_HEIGHT + y;
          const worldZ = chunkZ * CHUNK_SIZE + z;

          let noiseValue = 0;
          let amplitudeSum = 0;

          // Apply noise layers (example using constants)
          NOISE_LAYERS.forEach((layer: NoiseLayer) => {
            const freq = layer.frequency;
            const amp = layer.amplitude;
            noiseValue += amp * simplex.noise3D(worldX / freq, worldY / freq, worldZ / freq);
            amplitudeSum += amp;
          });
          // Normalize noise value if layers are used
          if (amplitudeSum > 0) {
            noiseValue /= amplitudeSum;
          }

          // Apply Vertical Offset (Crucial for terrain shape & vertical edit debugging)
          let noiseOffset = 0;
          if (worldY < 10) {
             // Clamped linear offset below y=10 (Fix for extreme negative values)
             noiseOffset = Math.max(-10, (worldY - 10) * 0.5); // Example simplified/clamped offset
             // Original problematic offset: 0.002 * Math.pow(worldY - 10, 3);
          } else if (worldY < 20) {
            // transition zone? (Example)
            noiseOffset = 0;
          } else {
             // Standard offset above transition
             noiseOffset = (worldY - 20) * 0.05; // Example
          }

          const finalValue = noiseValue - noiseOffset;

          // Debug logging added during troubleshooting
          // if (chunkY < 0) {
          //   console.log(`NoiseMapGen chunkY=${chunkY}: Pos(${x},${y},${z}) WorldY=${worldY} -> Noise=${noiseValue.toFixed(3)}, Offset=${noiseOffset.toFixed(3)}, Final=${finalValue.toFixed(3)}`);
          // }

          line[x] = finalValue;
        }
        slice.push(line);
      }
      noiseMap.push(slice);
    }
    // Generation successful
    return noiseMap;

  } catch (error) {
    console.error(`Error generating noise map for chunk ${chunkX},${chunkY},${chunkZ}:`, error);
    return null; // Indicate failure
  }
}

```

**Explanation:**
*   **Vertical Offset (`noiseOffset`):** This logic shapes the overall terrain height. The key modifications involved addressing the `chunkY < 0` case. The original `Math.pow(..., 3)` calculation produced extreme negative offsets that corrupted the `Float32Array`, causing `generateNoiseMap` to effectively fail for negative Y chunks. Clamping or simplifying this calculation was essential for enabling downward digging.
*   **Return Value:** Explicitly returns `NoiseMap | null`. Returning `null` on error (caught by `try...catch`) is important for signaling failure to the calling functions (`editNoiseMapChunks`, main thread listener).
*   **Caching:** The simple cache was noted as problematic because it didn't consider `chunkY`. For a full 3D system, caching would need to incorporate the Y coordinate.
*   **Decoupling:** This function only needs chunk coordinates and generation parameters. It doesn't need neighbor data, allowing it to run independently in workers.

---

## 4. Worker Communication & Main Thread Handling

**Files:** `src/worker.mts`, `src/firstPerson.ts`

**Purpose:** Offload noise generation to workers and handle the results correctly on the main thread to trigger mesh generation.

```typescript
// src/worker.mts (Simplified)

import { generateNoiseMap } from "./noiseMapGenerator";
// Import constants CHUNK_SIZE, CHUNK_HEIGHT etc. if needed

self.onmessage = (e) => {
  const [chunkX, chunkY, chunkZ, /* noiseParams like seed, layers */] = e.data;

  // Perform the potentially expensive noise generation
  const noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, /* params */);

  if (noiseMap) {
    // Send the generated noise map back, along with coordinates
    // **CRITICAL CHANGE:** Sends NoiseMap, not mesh data/JSON.
    self.postMessage([chunkX, chunkY, chunkZ, noiseMap]);
  } else {
    // Optionally send back a failure message
     self.postMessage([chunkX, chunkY, chunkZ, null]); // Indicate failure
  }
};

// src/firstPerson.ts (Worker Listener Snippet - Refactored Logic)

// Inside init() or wherever worker listeners are set up:
workerPool.forEach((worker) => {
  worker.onmessage = (e) => {
    const message = e.data as WorkerNoiseMapMessage | [number, number, number, null];
    const [chunkX, chunkY, chunkZ, noiseMap] = message;
    const key = getChunkKeyY(chunkX, chunkY, chunkZ);

    // Store the received noise map (or null on failure)
    if (!loadedChunks[key]) {
        loadedChunks[key] = { noiseMap: null, mesh: null }; // Ensure entry exists
    }
    loadedChunks[key].noiseMap = noiseMap;

    if (!noiseMap) {
        console.warn(`Worker failed to generate noise map for ${key}`);
        return; // Don't attempt to mesh if noise map failed
    }

    console.log(`Received noiseMap for chunk ${key} from worker.`);

    // --- Mesh Generation Triggered on Main Thread ---
    // Define neighbor offsets
    const neighborOffsets = [
        { dx: 0, dy: -1, dz: 0, name: 'Below' }, { dx: 0, dy: 1, dz: 0, name: 'Above' },
        { dx: -1, dy: 0, dz: 0, name: 'XNeg' }, { dx: 1, dy: 0, dz: 0, name: 'XPos' },
        { dx: 0, dy: 0, dz: -1, name: 'ZNeg' }, { dx: 0, dy: 0, dz: 1, name: 'ZPos' }
    ];
    let neighborMaps: Record<string, NoiseMap | null> = {};

    // Helper to get/generate neighbor maps synchronously
    const getOrGenNeighborMap = (nX: number, nY: number, nZ: number): NoiseMap | null => {
        const nKey = getChunkKeyY(nX, nY, nZ);
        if (loadedChunks[nKey]?.noiseMap) {
            return loadedChunks[nKey].noiseMap;
        } else {
            console.log(`Main thread generating neighbor ${nKey} for meshing ${key}`);
            const generatedMap = generateNoiseMap(nX, nY, nZ, seed); // Use current seed/params
            if (!loadedChunks[nKey]) {
              loadedChunks[nKey] = { noiseMap: null, mesh: null };
            }
            loadedChunks[nKey].noiseMap = generatedMap; // Store it
            return generatedMap;
        }
    };

    // Fetch/Generate all 6 neighbors
    neighborOffsets.forEach(offset => {
        neighborMaps[offset.name] = getOrGenNeighborMap(chunkX + offset.dx, chunkY + offset.dy, chunkZ + offset.dz);
    });

    // Generate mesh using the received noiseMap and its neighbors
    try {
      const newMesh = generateMesh(
        chunkX, chunkY, chunkZ,
        { noiseMap: noiseMap }, // Pass the main noise map
        seed, interpolate, // Pass necessary params
        neighborMaps['Below'], neighborMaps['Above'],
        neighborMaps['XNeg'], neighborMaps['XPos'],
        neighborMaps['ZNeg'], neighborMaps['ZPos']
      );

      // Dispose old mesh if it exists and add new one
      if (loadedChunks[key]?.mesh) {
        disposeNode(loadedChunks[key].mesh!);
      }
      loadedChunks[key].mesh = newMesh;
      scene.add(newMesh);
      console.log(`Added mesh for chunk ${key}`);

    } catch(error) {
         console.error(`Error generating mesh for chunk ${key} on main thread:`, error);
         // Ensure mesh is null if generation failed
         if (loadedChunks[key]) {
             loadedChunks[key].mesh = null;
         }
    }
    // --- End Main Thread Mesh Generation ---
  };
});
```

**Explanation:**
*   **Worker Role:** The worker's sole responsibility is now `generateNoiseMap` and posting the `NoiseMap` (or `null`) back. This resolved earlier errors where workers tried (and failed) to do mesh generation or send JSON.
*   **Main Thread Listener:** This logic was significantly refactored. It now acts as the orchestrator for mesh generation upon receiving a `NoiseMap`.
*   **Neighbor Fetching (`getOrGenNeighborMap`):** It synchronously fetches or generates *all 6 neighbors* needed by `generateMesh`. This ensures `generateMesh` always receives the data required for seamless stitching *at the time the chunk itself is meshed*.
*   **Main Thread Meshing:** `generateMesh` is called directly on the main thread, passing the received `noiseMap` and the fetched/generated neighbor maps. This simplifies the process and ensures all necessary data is present.

---

## 5. Mesh Generation with Neighbors

**File:** `src/meshGenerator.ts`

**Purpose:** Creates a `THREE.Mesh` for a chunk using the Marching Cubes algorithm, utilizing neighbor noise maps for seamless boundaries.

```typescript
// src/meshGenerator.ts
import * as THREE from "three";
import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CHUNK_HEIGHT, CHUNK_SIZE, SURFACE_LEVEL } from "./constants";
import { table, edgeCorners } from "./triangulation";
import { NoiseMap } from "./types";

// Helper to get noise value, sampling from neighbors if necessary
const getNoise = (
  x: number, y: number, z: number,
  noiseMap: NoiseMap,
  noiseMapBelow: NoiseMap | null, noiseMapAbove: NoiseMap | null,
  noiseMapXNeg: NoiseMap | null, noiseMapXPos: NoiseMap | null,
  noiseMapZNeg: NoiseMap | null, noiseMapZPos: NoiseMap | null
): number | null => {
    if (y < 0) return noiseMapBelow ? noiseMapBelow[CHUNK_HEIGHT + y][z][x] : null; // Sample from top of chunk below
    if (y >= CHUNK_HEIGHT + 1) return noiseMapAbove ? noiseMapAbove[y - (CHUNK_HEIGHT + 1)][z][x] : null; // Sample from bottom of chunk above
    if (x < 0) return noiseMapXNeg ? noiseMapXNeg[y][z][CHUNK_SIZE + x] : null;
    if (x >= CHUNK_SIZE + 1) return noiseMapXPos ? noiseMapXPos[y][z][x - (CHUNK_SIZE + 1)] : null;
    if (z < 0) return noiseMapZNeg ? noiseMapZNeg[y][CHUNK_SIZE + z][x] : null;
    if (z >= CHUNK_SIZE + 1) return noiseMapZPos ? noiseMapZPos[y][z - (CHUNK_SIZE + 1)][x] : null;

    // Within current chunk bounds
    return noiseMap[y]?.[z]?.[x] ?? null; // Use nullish coalescing for safety
};

export function generateMesh(
  chunkX: number, chunkY: number, chunkZ: number,
  data: { noiseMap: NoiseMap }, // Assuming noiseMap is always provided now
  seed: string, interpolate: boolean,
  // Neighbor noise maps (can be null if at world edge or generation failed)
  noiseMapBelow: NoiseMap | null, noiseMapAbove: NoiseMap | null,
  noiseMapXNeg: NoiseMap | null, noiseMapXPos: NoiseMap | null,
  noiseMapZNeg: NoiseMap | null, noiseMapZPos: NoiseMap | null
): THREE.Mesh {

  const geoms: THREE.BufferGeometry[] = [];
  const { noiseMap } = data;

  // Correct vertical offset calculation
  const yOffset = chunkY * CHUNK_HEIGHT;

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Get noise values for the 8 corners of the current cube
        const cornerCoords = [
          [x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1],
          [x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
        ];
        const cornerNoises: (number | null)[] = cornerCoords.map(c =>
            getNoise(c[0], c[1], c[2], noiseMap, noiseMapBelow, noiseMapAbove, noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos)
        );

        // Check if any corner data is missing (e.g., neighbor failed to generate)
        if (cornerNoises.some(n => n === null)) {
           if (y === 0 && !noiseMapBelow) console.warn(`Skipping cube at ${x},${y},${z} in chunk ${chunkX},${chunkY},${chunkZ} due to missing noise map data at boundary (Below).`);
           // Add similar checks/logs for other boundaries...
           continue; // Skip this cube if data is incomplete
        }

        let cubeIndex = 0;
        cornerNoises.forEach((noiseVal, i) => {
          if (noiseVal! < SURFACE_LEVEL) { // Use non-null assertion after check
            cubeIndex |= 1 << i;
          }
        });

        // Look up edges and create triangles based on cubeIndex
        const edges = table[cubeIndex];
        if (edges === 0) continue; // No geometry for this cube configuration

        // (Simplified vertex calculation - No interpolation shown)
         for (let i = 0; edges[i] !== -1; i += 3) {
            const triangleCorners = [edges[i], edges[i+1], edges[i+2]];
            const vertices = triangleCorners.map(edgeIndex => {
                const c1 = edgeCorners[edgeIndex][0];
                const c2 = edgeCorners[edgeIndex][1];
                const p1 = new THREE.Vector3(...cornerCoords[c1]);
                const p2 = new THREE.Vector3(...cornerCoords[c2]);
                // Simplified: Use midpoint instead of interpolation
                return p1.lerp(p2, 0.5);
            });

             const geom = new THREE.BufferGeometry();
             geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(v => [v.x, v.y, v.z]), 3));
             geom.computeVertexNormals();
             // Apply chunk-relative position + world offset
             geom.translate(x, y + yOffset, z); // Apply corrected Y offset here too
             geoms.push(geom);
         }
      }
    }
  }

  // Check if any geometry was generated before merging
  if (geoms.length === 0) {
    console.log(`No geometry generated for chunk ${chunkX},${chunkY},${chunkZ}. Returning empty mesh.`);
    return new THREE.Mesh(); // Return empty mesh, not null
  }

  // Merge geometries
  const mergedGeometry = BufferGeometryUtils.mergeBufferGeometries(geoms, false); // Use false for groups argument
  if (!mergedGeometry) {
      console.error(`mergeBufferGeometries failed for chunk ${chunkX},${chunkY},${chunkZ}`);
      return new THREE.Mesh(); // Return empty on merge failure
  }
  mergedGeometry.computeBoundingSphere();

  const material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide }); // Example material
  const mesh = new THREE.Mesh(mergedGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

```

**Explanation:**
*   **Neighbor Parameters:** Takes all 6 neighbors as parameters. This is the core enabler for seamless meshing.
*   **`getNoise` Helper:** Encapsulates the logic for sampling noise, checking boundaries, and correctly accessing neighbor maps. This avoids discontinuities at chunk edges.
*   **Boundary/Null Checks:** Explicitly checks if neighbor data exists before sampling (`if (!noiseMapBelow...)`) and skips cubes if data is missing. Also checks if `geoms` is empty before merging. These prevent errors seen during debugging.
*   **`yOffset` Correction:** `const yOffset = chunkY * CHUNK_HEIGHT;` and using it in `geom.translate` correctly places meshes generated for different vertical layers.
*   **`SURFACE_LEVEL`:** Uses this constant to determine if a corner is inside or outside the terrain.

---

## 6. Terrain Editing Logic

**File:** `src/noiseMapEditor.ts`

**Purpose:** Modifies the `NoiseMap` data based on user interaction, correctly handling edits that cross chunk boundaries (including vertically) and ensuring atomic updates using cloning.

```typescript
// src/noiseMapEditor.ts

import { generateNoiseMap } from "./noiseMapGenerator";
import { CHUNK_HEIGHT, CHUNK_SIZE, EDIT_RADIUS, EDIT_STRENGTH } from "./constants";
import { LoadedChunks, NoiseMap } from "./types";
import { getChunkKeyY } from "./utils";
import * as THREE from "three";

// Function to apply the actual noise modification
function applyEditNoise(
    map: NoiseMap,
    mapX: number, mapY: number, mapZ: number,
    centerX: number, centerY: number, centerZ: number,
    radius: number, strength: number, isRemoving: boolean
): void {
    const dx = mapX - centerX;
    const dy = mapY - centerY;
    const dz = mapZ - centerZ;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (dist < radius) {
        // Linear falloff
        const editAmount = strength * Math.max(0, radius - dist) / radius / 5; // Divisor adjusted during debugging
        const addOrRemove = isRemoving ? -1 : 1; // Reversed logic: -1 for removing
        const originalValue = map[mapY]?.[mapZ]?.[mapX] ?? 0; // Handle potential undefined access
        map[mapY][mapZ][mapX] = originalValue + addOrRemove * editAmount;
    }
}


export function editNoiseMapChunks(
  loadedChunks: LoadedChunks,
  worldPoint: THREE.Vector3,
  isRemoving: boolean,
  seed: string // Or other params needed by generateNoiseMap
): [number, number, number][] { // Returns coordinates of affected chunks

  console.log('editNoiseMapChunks called with worldPoint:', worldPoint);

  // Calculate the base chunk coordinates where the interaction occurred
  // ** CRITICAL FIX:** Calculate chunkY based on worldPoint.y
  const chunkX = Math.floor((worldPoint.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunkY = Math.floor(worldPoint.y / CHUNK_HEIGHT); // Fixed from hardcoded 0
  const chunkZ = Math.floor((worldPoint.z + CHUNK_SIZE / 2) / CHUNK_SIZE);

  console.log(`Calculated base chunk: X=${chunkX}, Y=${chunkY}, Z=${chunkZ}`);

  // Calculate local coordinates relative to the base chunk's origin
  const localX = worldPoint.x - chunkX * CHUNK_SIZE;
  const localY = worldPoint.y - chunkY * CHUNK_HEIGHT; // Relative Y within base chunk
  const localZ = worldPoint.z - chunkZ * CHUNK_SIZE;

  // Store modified noise maps temporarily to ensure atomic update
  const modifiedNoiseMaps: { [key: string]: NoiseMap } = {};
  const affectedChunkCoords = new Set<string>(); // Use Set to store unique affected chunk keys

  const radius = EDIT_RADIUS;
  const strength = EDIT_STRENGTH;

  // Iterate around the edit point in 3D space
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const offsetX = localX + dx;
        const offsetY = localY + dy; // Relative Y within radius
        const offsetZ = localZ + dz;

        // Calculate the actual world Y for determining target chunk Y
        const worldEditY = worldPoint.y + dy;

        // Determine which chunk this point falls into
        const targetChunkX = chunkX + Math.floor((offsetX + CHUNK_SIZE / 2) / CHUNK_SIZE);
        const targetChunkY = Math.floor(worldEditY / CHUNK_HEIGHT); // Use world Y!
        const targetChunkZ = chunkZ + Math.floor((offsetZ + CHUNK_SIZE / 2) / CHUNK_SIZE);
        const targetChunkKey = getChunkKeyY(targetChunkX, targetChunkY, targetChunkZ);

        // Calculate the map coordinates within the target chunk
        const targetMapX = ((Math.floor(offsetX) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const targetMapY = ((Math.floor(worldEditY) % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT; // Use world Y!
        const targetMapZ = ((Math.floor(offsetZ) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        // --- Neighbor Generation/Retrieval & Cloning Logic ---
        let mapToModify: NoiseMap | null = null;

        if (targetChunkKey in modifiedNoiseMaps) {
            // Already cloned for this edit operation
            mapToModify = modifiedNoiseMaps[targetChunkKey];
        } else {
            // First time encountering this chunk in this edit operation
            let existingNoiseMap: NoiseMap | null | undefined = loadedChunks[targetChunkKey]?.noiseMap;

            // ** KEY FIX: Generate if missing entirely from loadedChunks **
            if (!existingNoiseMap) {
                console.log(`Noise map for ${targetChunkKey} not found. Generating...`);
                const generatedMap = generateNoiseMap(targetChunkX, targetChunkY, targetChunkZ, seed);
                if (generatedMap) {
                    console.log(`Generated noise map for ${targetChunkKey}. Result type: ${typeof generatedMap}, Is array: ${Array.isArray(generatedMap)}, Length: ${generatedMap?.length}`);
                     if (!loadedChunks[targetChunkKey]) {
                       loadedChunks[targetChunkKey] = { noiseMap: null, mesh: null }; // Ensure chunk entry exists
                     }
                     loadedChunks[targetChunkKey].noiseMap = generatedMap; // Store it globally
                     existingNoiseMap = generatedMap; // Use the newly generated map
                     console.log(`Storing generated noise map for ${targetChunkKey} in loadedChunks.`);
                } else {
                    console.error(`Failed to generate noise map for ${targetChunkKey}. Skipping edit for this chunk.`);
                    continue; // Skip points in this chunk if generation failed
                }
            } else {
               console.log(`Found existing noise map for ${targetChunkKey}`);
            }

            // Verify retrieval before cloning
             const mapToClone = loadedChunks[targetChunkKey]?.noiseMap;
             console.log(`Verification before storage for ${targetChunkKey}. Type: ${typeof mapToClone}, Is array: ${Array.isArray(mapToClone)}, Length: ${mapToClone?.length}`);

             if (mapToClone && Array.isArray(mapToClone) && mapToClone.length > 0) {
                 try {
                    mapToModify = structuredClone(mapToClone); // Deep clone for modification
                    modifiedNoiseMaps[targetChunkKey] = mapToModify;
                    affectedChunkCoords.add(targetChunkKey); // Mark chunk as affected
                 } catch (cloneError) {
                     console.error(`Failed to clone noise map for ${targetChunkKey}:`, cloneError);
                     continue; // Skip if cloning fails
                 }
             } else {
                 console.warn(`Could not obtain valid noise map for ${targetChunkKey} to clone. Skipping edit for this point.`);
                 continue; // Skip if we somehow still don't have a valid map
             }
        }
        // --- End Neighbor/Cloning ---

        // Apply the edit noise to the cloned map
        if (mapToModify) {
            // Center point needs to be relative to the target map's local coords
            const centerMapX = ((Math.floor(localX) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
            const centerMapY = ((Math.floor(localY) % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
            const centerMapZ = ((Math.floor(localZ) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

            applyEditNoise(
                mapToModify,
                targetMapX, targetMapY, targetMapZ,
                centerMapX, centerMapY, centerMapZ, // Use local map coords for center
                radius, strength, isRemoving
            );
        }
      }
    }
  }

  // Update the main loadedChunks with the modified maps
  for (const key in modifiedNoiseMaps) {
    if (loadedChunks[key]) { // Ensure entry exists
        loadedChunks[key].noiseMap = modifiedNoiseMaps[key];
    } else {
        console.warn(`Attempted to update non-existent chunk ${key} after modification.`);
    }
  }

  // Convert affected chunk keys back to coordinate arrays
  return Array.from(affectedChunkCoords).map(key => key.split(',').map(Number) as [number, number, number]);
}

```

**Explanation:**
*   **Base Chunk Calculation:** The fix `chunkY = Math.floor(worldPoint.y / CHUNK_HEIGHT)` ensures edits start relative to the correct vertical layer.
*   **Neighbor Generation Fix:** The logic block starting `if (!existingNoiseMap)` was the crucial addition. It ensures `generateNoiseMap` is called for chunks (like Y=-1) that weren't in `loadedChunks` at all, solving the `Could not obtain noise map...` errors.
*   **Cloning (`structuredClone`):** Essential for atomicity. By cloning the noise map *once* per affected chunk at the start of the edit operation (`if (!(targetChunkKey in modifiedNoiseMaps))`) and applying all modifications to the clone (`mapToModify`), it prevents edits within the same radius from interfering with each other.
*   **Edit Application:** Details the `editNoise` formula, including the falloff and the adjusted `divisor`. Explicitly shows the reversed `addOrRemove` logic (`-1` for removing) needed to correctly modify noise values relative to `SURFACE_LEVEL`.

---

## 7. Mesh Regeneration After Edit

**File:** `src/firstPerson.ts`

**Purpose:** Handles the process of updating the visual meshes after `editNoiseMapChunks` modifies the underlying noise data.

```typescript
// src/firstPerson.ts (Inside editTerrain function)

// ... (Raycasting logic to get intersectionPoint, isRemoving) ...

// Call the noise map editor
const affectedChunks = editNoiseMapChunks(loadedChunks, intersectionPoint, isRemoving, seed);

// Regenerate meshes for all affected chunks
if (affectedChunks.length > 0) {
  console.log("Affected chunks requiring mesh update:", affectedChunks);
  affectedChunks.forEach(([cx, cy, cz]) => {
    const key = getChunkKeyY(cx, cy, cz);
    const chunkData = loadedChunks[key];

    if (!chunkData?.noiseMap) {
      console.warn(`Skipping mesh regeneration for ${key}: Missing noiseMap data.`);
      return; // Cannot regenerate mesh without noise map
    }

    // --- Fetch/Generate Neighbors BEFORE Generating Mesh ---
    const neighborOffsets = [ // Same offsets as in worker listener
        { dx: 0, dy: -1, dz: 0, name: 'Below' }, { dx: 0, dy: 1, dz: 0, name: 'Above' },
        // ... include X+/-, Z+/- offsets
    ];
    let neighborMaps: Record<string, NoiseMap | null> = {};
    const getOrGenNeighborMap = (nX: number, nY: number, nZ: number): NoiseMap | null => {
        // Same helper function as in worker listener to get/gen neighbors
        const nKey = getChunkKeyY(nX, nY, nZ);
        // ... (implementation as shown in section 4) ...
        const generatedMap = generateNoiseMap(nX, nY, nZ, seed);
        // ... (store generated map) ...
        return generatedMap;
    };
    neighborOffsets.forEach(offset => {
        neighborMaps[offset.name] = getOrGenNeighborMap(cx + offset.dx, cy + offset.dy, cz + offset.dz);
    });
    // --- End Neighbor Fetching ---


    console.log(`Regenerating mesh for affected chunk ${key}`);

    // Dispose old mesh
    if (chunkData.mesh) {
      disposeNode(chunkData.mesh); // Assumes disposeNode handles scene removal & disposal
      chunkData.mesh = null;
    }

    // Generate new mesh using the MODIFIED noiseMap and its neighbors
    try {
      const newMesh = generateMesh(
        cx, cy, cz,
        { noiseMap: chunkData.noiseMap }, // Use the updated noiseMap
        seed, interpolate, // Pass params
        neighborMaps['Below'], neighborMaps['Above'],
        neighborMaps['XNeg'], neighborMaps['XPos'],
        neighborMaps['ZNeg'], neighborMaps['ZPos']
      );

      // Store and add the new mesh
      chunkData.mesh = newMesh;
      scene.add(newMesh);

    } catch(error) {
      console.error(`Error regenerating mesh for edited chunk ${key}:`, error);
      chunkData.mesh = null; // Ensure mesh is null if regen failed
    }
  });
}

```

**Explanation:**
*   **Trigger:** Runs immediately after `editNoiseMapChunks` returns the list of affected chunk coordinates.
*   **Iteration:** Loops through every chunk whose noise map was potentially altered.
*   **Disposal:** Calls `disposeNode` to properly remove the old mesh from the scene and free GPU resources before creating the new one.
*   **Neighbor Fetching:** Crucially, it re-uses the `getOrGenNeighborMap` logic to ensure all 6 neighbors are available *before* calling `generateMesh`. This is vital because the edit might have altered the noise map of the current chunk *or* a neighbor, and the mesh needs the *latest* data from all relevant neighbors for seamless stitching.
*   **`generateMesh` Call:** Passes the *modified* `noiseMap` for the current chunk (`chunkData.noiseMap`) along with all the fetched/generated neighbor maps to `generateMesh`.
*   **Update:** Stores the newly returned mesh in `loadedChunks` and adds it to the `scene`.

---

## 8. Constants

**File:** `src/constants.ts` (or similar)

**Purpose:** Define globally used constants for consistency.

```typescript
// src/constants.ts

export const CHUNK_SIZE = 25; // Size of chunk along X and Z axes
export const CHUNK_HEIGHT = 50; // Size of chunk along Y axis
export const SURFACE_LEVEL = 0.0; // Noise threshold for Marching Cubes algorithm

export const LOAD_CHUNK_RADIUS = 5; // Radius around player to load chunks (X/Z plane)
export const EDIT_RADIUS = 5;       // Radius of terrain editing tool
export const EDIT_STRENGTH = 0.5;   // Base strength of editing tool

// Example Noise Layer Structure (adjust as needed)
export interface NoiseLayer {
  frequency: number;
  amplitude: number;
}
export const NOISE_LAYERS: NoiseLayer[] = [
  { frequency: 100, amplitude: 1 },
  { frequency: 50, amplitude: 0.5 },
  { frequency: 25, amplitude: 0.25 },
];

// (Other constants like GRAVITY, JUMP_VELOCITY etc.)
```

**Explanation:**
*   `CHUNK_SIZE`, `CHUNK_HEIGHT`: Define the fundamental dimensions used in noise generation, mesh generation, and coordinate calculations.
*   `SURFACE_LEVEL`: The critical threshold for the Marching Cubes algorithm, determining what is considered "inside" vs "outside" the terrain surface based on noise values.
*   Other constants like `EDIT_RADIUS` and `EDIT_STRENGTH` control the behavior of the terrain editing tool.

---

This detailed breakdown should cover the specific code infrastructure and logic modifications that enabled the dynamic and vertically editable terrain features discussed. 