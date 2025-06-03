# MARCHING CUBES: GAP-FREE TERRAIN QUICK REFERENCE

## CRITICAL REQUIREMENTS

1. **CORRECT COORDINATE CALCULATION**
   ```typescript
   // CRITICAL: The -0.5 offset is what ensures chunks align properly at boundaries
   // Without this offset, chunks will have gaps due to misaligned world coordinates
   const worldX = x + (chunkX - 0.5) * CHUNK_SIZE; // -0.5 shifts X to align chunks properly
   const worldY = y + chunkY * CHUNK_HEIGHT;       // No shift needed for Y axis
   const worldZ = z + (chunkZ - 0.5) * CHUNK_SIZE; // -0.5 shifts Z to align chunks properly
   
   // When generating mesh, apply the same transform to position vertices
   // NOTE: This must match EXACTLY with the noise sampling coordinates
   geometry.translate(
     (chunkX - 0.5) * CHUNK_SIZE,  // Same formula as in noise generation
     chunkY * CHUNK_HEIGHT,        // Same formula as in noise generation
     (chunkZ - 0.5) * CHUNK_SIZE   // Same formula as in noise generation
   );
   ```

2. **EXACT BOUNDARY HANDLING**
   ```typescript
   // CRITICAL: Before generating a mesh, ensure ALL 6 face-adjacent neighbors exist
   // Missing neighbors will cause gaps at chunk boundaries
   const hasAllRequiredNeighbors = 
     !!neighbors.xNeg && // Left neighbor (-X)
     !!neighbors.xPos && // Right neighbor (+X)
     !!neighbors.yNeg && // Below neighbor (-Y)
     !!neighbors.yPos && // Above neighbor (+Y)
     !!neighbors.zNeg && // Back neighbor (-Z)
     !!neighbors.zPos;   // Front neighbor (+Z)
     
   if (!hasAllRequiredNeighbors) {
     // Either:
     // 1. Skip this chunk entirely until neighbors load
     return null;
     
     // OR 2. Generate only interior, leaving a 1-cube border
     // (Advanced implementation, requires careful tracking of which boundaries are valid)
   }
   ```

3. **PROPER NOISE SAMPLING WITH BOUNDARY HANDLING**
   ```typescript
   /**
    * Get noise value with proper boundary handling.
    * This is the MOST CRITICAL function for seamless terrain.
    * It must correctly fetch values from neighboring chunks when
    * coordinates fall outside the current chunk's bounds.
    */
   function getNoise(x, y, z, currentMap, neighbors) {
     // If within current chunk bounds, use direct access (fast path)
     if (x >= 0 && x <= CHUNK_SIZE && 
         y >= 0 && y <= CHUNK_HEIGHT && 
         z >= 0 && z <= CHUNK_SIZE) {
       return currentMap[y][z][x];
     }
     
     // Otherwise, need to fetch from appropriate neighbor
     let targetMap = currentMap;
     let targetX = x;
     let targetY = y;
     let targetZ = z;
     
     // Check and adjust for X boundaries
     if (x < 0) {
       targetMap = neighbors.xNeg;
       targetX = x + CHUNK_SIZE; // Convert to neighbor's coordinate system
     } else if (x > CHUNK_SIZE) {
       targetMap = neighbors.xPos;
       targetX = x - CHUNK_SIZE; // Convert to neighbor's coordinate system
     }
     
     // Check and adjust for Y boundaries
     if (y < 0) {
       targetMap = neighbors.yNeg;
       targetY = y + CHUNK_HEIGHT; // Convert to neighbor's coordinate system
     } else if (y > CHUNK_HEIGHT) {
       targetMap = neighbors.yPos;
       targetY = y - CHUNK_HEIGHT; // Convert to neighbor's coordinate system
     }
     
     // Check and adjust for Z boundaries
     if (z < 0) {
       targetMap = neighbors.zNeg;
       targetZ = z + CHUNK_SIZE; // Convert to neighbor's coordinate system
     } else if (z > CHUNK_SIZE) {
       targetMap = neighbors.zPos;
       targetZ = z - CHUNK_SIZE; // Convert to neighbor's coordinate system
     }
     
     // Return default value if target map doesn't exist
     if (!targetMap) return null; // Or SURFACE_LEVEL + 1.0 for "outside" surface
     
     // Safe access with optional chaining and nullish coalescing
     return targetMap[targetY]?.[targetZ]?.[targetX] ?? null;
   }
   ```

4. **CHUNK LOADING PRIORITIZATION & UNLOADING PREVENTION**
   ```typescript
   // Define Priority Levels
   const LOD_IMMEDIATE = 0;  // Player's chunk and direct neighbors
   const LOD_ADJACENT = 1;   // Chunks 1 unit away (diagonals)
   const LOD_NEAR = 2;       // Chunks within close view distance
   const LOD_MEDIUM = 3;     // Medium distance chunks
   const LOD_FAR = 4;        // Far chunks, lowest priority
   
   // Calculate chunk priority based on position relative to player
   function getChunkPriority(dx, dy, dz) {
     // Manhattan distance for quick calculation
     const manhattanDist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
     
     // Direct neighbors are highest priority (required for boundary generation)
     if (manhattanDist <= 1) return LOD_IMMEDIATE;
     
     // Chunks at player's Y level get higher priority (more likely to be visible)
     if (dy === 0) {
       const maxHorizontalDist = Math.max(Math.abs(dx), Math.abs(dz));
       if (maxHorizontalDist <= 2) return LOD_ADJACENT;
       if (maxHorizontalDist <= 4) return LOD_NEAR;
     }
     
     // General distance-based prioritization
     if (manhattanDist <= 3) return LOD_ADJACENT;
     if (manhattanDist <= 5) return LOD_NEAR;
     if (manhattanDist <= 7) return LOD_MEDIUM;
     return LOD_FAR;
   }
   
   // CRITICAL: Disable chunk unloading completely to prevent gaps
   // If memory constraints require unloading, use a visibility-based approach
   
   // Instead of unloading chunks, just log statistics
   const numLoadedChunks = Object.keys(loadedChunks).length;
   console.log(`Currently loaded chunks: ${numLoadedChunks}`);
   
   // If absolutely necessary to unload:
   function safelyUnloadChunks() {
     // 1. NEVER unload chunks that are visible to the player
     // 2. NEVER unload chunks that are needed by visible chunks (neighbors)
     // 3. NEVER unload chunks during active player movement
     // 4. Unload in small batches to prevent sudden changes
   }
   ```

## COMMON ISSUES & FIXES

| Issue | Root Cause | Detailed Solution |
|-------|------------|-------------------|
| Seams between chunks | Misaligned coordinate systems | Apply consistent `-0.5 * CHUNK_SIZE` offset for X and Z in BOTH noise generation AND mesh positioning |
| Missing triangles at borders | Incomplete neighbor data | Implement robust checks for ALL required neighbors before mesh generation; defer mesh creation until all neighbors loaded |
| Z-fighting/flickering edges | Slightly different noise values | Use exact same noise generator with identical seed across all chunks; ensure boundary noise lookup uses the correct target chunk's data |
| Holes appearing during gameplay | Chunk unloading while still needed | Implement "safe zone" around player; only unload chunks after ensuring they're not neighbors of any visible chunk |
| Inconsistent surface elevation | Variable surface thresholds | Use exactly `SURFACE_LEVEL = 0.0` across all chunks; avoid any chunk-dependent bias factors in surface calculation |
| Jittery terrain during movement | Chunk loading order issues | Use priority queue for loading with immediate neighbors loaded first; implement "cushion" radius of loaded chunks around player |

## DETAILED DEBUGGING CHECKLIST

- [ ] **Coordinate Calculation Verification**
  - [ ] Confirm `(chunkX - 0.5) * CHUNK_SIZE` pattern used consistently
  - [ ] Verify same formula used in both noise sampling and mesh positioning
  - [ ] Check for accidental offsets in world position calculations

- [ ] **Surface Threshold Consistency**
  - [ ] Ensure exactly same `SURFACE_LEVEL` value across all chunks
  - [ ] Remove any Y-dependent surface threshold adjustments that vary by chunk
  - [ ] Verify interpolation uses the same threshold for edge generation

- [ ] **Neighbor Handling Completeness**
  - [ ] Confirm all 6 face-adjacent neighbors load before mesh generation
  - [ ] Verify boundary noise value retrieval correctly transforms coordinates
  - [ ] Check boundary cubes for proper triangle generation across chunk edges

- [ ] **Code Structure and Memory Management**
  - [ ] Analyze noise map storage format (consistent [y][z][x] order)
  - [ ] Check for proper object disposal (THREE.js objects need explicit disposal)
  - [ ] Review chunk loading/unloading logic for race conditions

- [ ] **Marching Cubes Algorithm Implementation**
  - [ ] Verify consistent cube indexing (0-255 based on 8 corners)
  - [ ] Check triangulation table for correct edge mapping
  - [ ] Confirm interpolation correctly places vertices on the surface threshold

## KEY CODE PATTERNS

### 1. Complete Mesh Generation with Detailed Boundary Handling
```typescript
function generateMesh(chunkX, chunkY, chunkZ, noiseMap, allNeighbors) {
  // Output arrays for vertices and indices
  const vertices = [];
  
  // CRITICAL: Inner loop processes every cube in the chunk 
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Define the 8 corners of this cube
        const cubeCorners = [
          [x, y, z],           // 0: bottom-left-back
          [x + 1, y, z],       // 1: bottom-right-back
          [x + 1, y, z + 1],   // 2: bottom-right-front
          [x, y, z + 1],       // 3: bottom-left-front
          [x, y + 1, z],       // 4: top-left-back
          [x + 1, y + 1, z],   // 5: top-right-back
          [x + 1, y + 1, z + 1], // 6: top-right-front
          [x, y + 1, z + 1]    // 7: top-left-front
        ];
        
        // Get noise values for all 8 corners using neighbor-aware function
        const cornerValues = cubeCorners.map(([cx, cy, cz]) => 
          getNoise(cx, cy, cz, noiseMap, allNeighbors)
        );
        
        // Skip if any corner values are missing
        if (cornerValues.some(val => val === null)) continue;
        
        // Calculate cube case index (0-255)
        let cubeIndex = 0;
        for (let i = 0; i < 8; i++) {
          if (cornerValues[i] < SURFACE_LEVEL) {
            cubeIndex |= (1 << i);
          }
        }
        
        // Skip empty (0) or full (255) cubes
        if (cubeIndex === 0 || cubeIndex === 255) continue;
        
        // Get triangulation pattern from lookup table
        const edges = triangulationTable[cubeIndex];
        
        // Generate triangles
        for (let e = 0; e < edges.length; e += 3) {
          // Create three vertices per triangle
          for (let i = 0; i < 3; i++) {
            // Get the edge
            const edge = edges[e + i];
            
            // Get the two corners that define this edge
            const corner1 = edgeToCornerMap[edge][0];
            const corner2 = edgeToCornerMap[edge][1];
            
            // Get corner positions and values
            const pos1 = cubeCorners[corner1];
            const pos2 = cubeCorners[corner2];
            const val1 = cornerValues[corner1];
            const val2 = cornerValues[corner2];
            
            // Interpolate vertex position along the edge
            // This places vertex where value = SURFACE_LEVEL
            const t = (SURFACE_LEVEL - val1) / (val2 - val1);
            const vertexPos = [
              pos1[0] + t * (pos2[0] - pos1[0]),
              pos1[1] + t * (pos2[1] - pos1[1]),
              pos1[2] + t * (pos2[2] - pos1[2])
            ];
            
            // Add vertex to the output
            vertices.push(vertexPos[0], vertexPos[1], vertexPos[2]);
          }
        }
      }
    }
  }
  
  // Create geometry from vertices
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  // CRITICAL: Transform to world space
  geometry.translate(
    (chunkX - 0.5) * CHUNK_SIZE,
    chunkY * CHUNK_HEIGHT,
    (chunkZ - 0.5) * CHUNK_SIZE
  );
  
  // Calculate normals for lighting
  geometry.computeVertexNormals();
  
  return geometry;
}
```

### 2. Sophisticated Priority-Based Chunk Loading System
```typescript
// Track chunks that need loading, sorted by priority
let chunkLoadQueue = [];

// Core chunk loading function
function updateChunkLoading() {
  const playerChunkX = Math.floor(camera.position.x / CHUNK_SIZE);
  const playerChunkY = Math.floor(camera.position.y / CHUNK_HEIGHT);
  const playerChunkZ = Math.floor(camera.position.z / CHUNK_SIZE);
  
  // Clear and rebuild the load queue each update
  chunkLoadQueue = [];
  
  // Use different radiuses for horizontal vs vertical
  const horizontalRadius = LOAD_CHUNK_RADIUS;
  const verticalRadius = Math.max(2, Math.floor(horizontalRadius / 2));
  
  // Identify chunks to load
  for (let dx = -horizontalRadius; dx <= horizontalRadius; dx++) {
    for (let dz = -horizontalRadius; dz <= horizontalRadius; dz++) {
      for (let dy = -verticalRadius; dy <= verticalRadius; dy++) {
        const cx = playerChunkX + dx;
        const cy = playerChunkY + dy;
        const cz = playerChunkZ + dz;
        const chunkKey = `${cx},${cy},${cz}`;
        
        // Skip already loaded chunks with complete meshes
        if (loadedChunks[chunkKey]?.mesh) continue;
        
        // Calculate priority
        const priority = getChunkPriority(dx, dy, dz);
        
        // Add to load queue
        chunkLoadQueue.push({
          x: cx, 
          y: cy, 
          z: cz, 
          priority,
          distance: Math.sqrt(dx*dx + dy*dy + dz*dz) // For tie-breaking
        });
      }
    }
  }
  
  // Sort by priority, then by distance for tie-breaking
  chunkLoadQueue.sort((a, b) => {
    // Primary sort by priority (lower number = higher priority)
    const priorityDiff = a.priority - b.priority;
    if (priorityDiff !== 0) return priorityDiff;
    
    // Secondary sort by distance (closer = higher priority)
    return a.distance - b.distance;
  });
  
  // Process limited number of chunks per frame to maintain performance
  const MAX_CHUNKS_PER_FRAME = 5;
  let processedCount = 0;
  
  // Try to process a mix of priorities (to avoid getting stuck on one type)
  let prioritiesProcessed = new Set();
  
  // Process chunks from the queue
  for (let i = 0; i < chunkLoadQueue.length && processedCount < MAX_CHUNKS_PER_FRAME; i++) {
    const chunk = chunkLoadQueue[i];
    
    // Skip if we've already processed this priority level (except for IMMEDIATE)
    if (chunk.priority !== LOD_IMMEDIATE && prioritiesProcessed.has(chunk.priority)) {
      continue;
    }
    
    // Process this chunk
    if (loadChunk(chunk.x, chunk.y, chunk.z)) {
      processedCount++;
      prioritiesProcessed.add(chunk.priority);
    }
  }
}

// More detailed chunk loading function
function loadChunk(x, y, z) {
  const chunkKey = `${x},${y},${z}`;
  
  // Initialize chunk data if needed
  if (!loadedChunks[chunkKey]) {
    loadedChunks[chunkKey] = {
      noiseMap: null,
      lastAccessTime: Date.now(),
      mesh: null
    };
  }
  
  // Update access time
  loadedChunks[chunkKey].lastAccessTime = Date.now();
  
  // Generate noise map if needed
  if (!loadedChunks[chunkKey].noiseMap) {
    loadedChunks[chunkKey].noiseMap = generateNoiseMap(x, y, z, noiseLayers, seed);
    return true; // Count this as progress
  }
  
  // If we have a noise map but no mesh, check if we can generate the mesh
  if (!loadedChunks[chunkKey].mesh) {
    // Get all 6 neighbors
    const neighbors = {
      xNeg: loadedChunks[`${x-1},${y},${z}`]?.noiseMap || null,
      xPos: loadedChunks[`${x+1},${y},${z}`]?.noiseMap || null,
      yNeg: loadedChunks[`${x},${y-1},${z}`]?.noiseMap || null,
      yPos: loadedChunks[`${x},${y+1},${z}`]?.noiseMap || null,
      zNeg: loadedChunks[`${x},${y},${z-1}`]?.noiseMap || null,
      zPos: loadedChunks[`${x},${y},${z+1}`]?.noiseMap || null
    };
    
    // Check if all neighbors are available
    const hasAllNeighbors = Object.values(neighbors).every(n => n !== null);
    
    // For highest priority chunks, we can sometimes generate with missing neighbors
    const isHighPriority = 
      (Math.abs(x - playerChunkX) <= 1 && 
       Math.abs(y - playerChunkY) <= 1 && 
       Math.abs(z - playerChunkZ) <= 1);
    
    if (hasAllNeighbors || isHighPriority) {
      // Generate mesh
      const geometry = generateMesh(x, y, z, loadedChunks[chunkKey].noiseMap, neighbors);
      
      // Create mesh with material
      const material = createTerrainMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      
      // Add to scene
      scene.add(mesh);
      
      // Store reference
      loadedChunks[chunkKey].mesh = mesh;
      return true; // Count this as progress
    }
  }
  
  return false; // No progress made
}
```

### 3. Advanced Visualization and Debugging Tools

```typescript
// Create detailed debug visualization system
const debugModes = {
  CHUNK_BOUNDARIES: 'boundaries',
  LOADING_PRIORITY: 'priority',
  NOISE_VALUES: 'noise',
  PERFORMANCE: 'performance'
};

let activeDebugMode = debugModes.CHUNK_BOUNDARIES;
const debugObjects = {}; // Store debug visualization objects

function updateDebugVisualization() {
  // Clear previous visualizations
  clearDebugObjects();
  
  // Create new visualization based on mode
  switch (activeDebugMode) {
    case debugModes.CHUNK_BOUNDARIES:
      visualizeChunkBoundaries();
      break;
    case debugModes.LOADING_PRIORITY:
      visualizeLoadingPriority();
      break;
    case debugModes.NOISE_VALUES:
      visualizeNoiseValues();
      break;
    case debugModes.PERFORMANCE:
      visualizePerformanceMetrics();
      break;
  }
}

// Detailed chunk boundary visualization
function visualizeChunkBoundaries() {
  for (const chunkKey in loadedChunks) {
    const [cx, cy, cz] = chunkKey.split(',').map(Number);
    
    // Create wireframe box with detailed color coding
    const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
    const edges = new THREE.EdgesGeometry(geometry);
    
    // Determine color based on chunk status and content
    let color;
    if (!loadedChunks[chunkKey].mesh) {
      // No mesh yet - yellow for pending
      color = 0xffff00;
    } else if (checkHasAllNeighbors(cx, cy, cz)) {
      // Has all neighbors - green for complete
      color = 0x00ff00;
    } else {
      // Missing some neighbors - orange for partial
      color = 0xff8800;
    }
    
    // Further modify color based on vertical position
    if (cy < 0) {
      // Darken for underground chunks
      color = multiplyColor(color, 0.7);
    } else if (cy > 0) {
      // Add blue tint for sky chunks
      color = addBlueChannel(color, 0.3);
    }
    
    // Create line material with color
    const material = new THREE.LineBasicMaterial({ 
      color, 
      transparent: true, 
      opacity: 0.5 + (isPlayerNearby(cx, cy, cz) ? 0.5 : 0)
    });
    
    // Create and position box
    const box = new THREE.LineSegments(edges, material);
    box.position.set(
      (cx - 0.5) * CHUNK_SIZE, // Use consistent formula
      cy * CHUNK_HEIGHT,
      (cz - 0.5) * CHUNK_SIZE
    );
    
    // Add to scene and store reference
    scene.add(box);
    debugObjects[chunkKey] = box;
    
    // Add text label showing chunk coordinates
    addCoordinateLabel(cx, cy, cz);
  }
}

// Helper to add text label showing chunk coordinates
function addCoordinateLabel(cx, cy, cz) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = '18px monospace';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(`${cx},${cy},${cz}`, canvas.width/2, canvas.height/2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(
    (cx - 0.5) * CHUNK_SIZE,
    cy * CHUNK_HEIGHT + CHUNK_HEIGHT/2,
    (cz - 0.5) * CHUNK_SIZE
  );
  sprite.scale.set(6, 3, 1);
  
  scene.add(sprite);
  const labelKey = `label_${cx}_${cy}_${cz}`;
  debugObjects[labelKey] = sprite;
}
```

## MEMORY MANAGEMENT & PERFORMANCE

```typescript
// Implement object pooling to reduce garbage collection
const noiseMapPool = []; // Pool of reusable noise maps
const geometryPool = []; // Pool of reusable geometries

// Get a noise map from pool or create new one
function getNoiseMap() {
  if (noiseMapPool.length > 0) {
    return noiseMapPool.pop();
  }
  
  // Create new 3D array with dimensions [CHUNK_HEIGHT+1][CHUNK_SIZE+1][CHUNK_SIZE+1]
  const map = [];
  for (let y = 0; y <= CHUNK_HEIGHT; y++) {
    const plane = [];
    for (let z = 0; z <= CHUNK_SIZE; z++) {
      const row = new Float32Array(CHUNK_SIZE + 1);
      plane.push(row);
    }
    map.push(plane);
  }
  return map;
}

// Return noise map to pool when done
function recycleNoiseMap(map) {
  // Reset all values to 0 for reuse
  for (let y = 0; y <= CHUNK_HEIGHT; y++) {
    for (let z = 0; z <= CHUNK_SIZE; z++) {
      const row = map[y][z];
      for (let x = 0; x <= CHUNK_SIZE; x++) {
        row[x] = 0;
      }
    }
  }
  
  // Add to pool for future reuse
  if (noiseMapPool.length < 20) { // Limit pool size
    noiseMapPool.push(map);
  }
}

// Properly dispose of THREE.js objects
function disposeChunk(chunkKey) {
  const chunk = loadedChunks[chunkKey];
  if (!chunk) return;
  
  // Remove and dispose mesh
  if (chunk.mesh) {
    // Remove from scene
    scene.remove(chunk.mesh);
    
    // Dispose geometry
    if (chunk.mesh.geometry) {
      chunk.mesh.geometry.dispose();
    }
    
    // Dispose material(s)
    if (Array.isArray(chunk.mesh.material)) {
      chunk.mesh.material.forEach(m => m.dispose());
    } else if (chunk.mesh.material) {
      chunk.mesh.material.dispose();
    }
    
    chunk.mesh = null;
  }
  
  // Recycle noise map
  if (chunk.noiseMap) {
    recycleNoiseMap(chunk.noiseMap);
    chunk.noiseMap = null;
  }
  
  // Remove chunk from loadedChunks
  delete loadedChunks[chunkKey];
}
```

---

## ADVANCED NOTES ON THE MARCHING CUBES ALGORITHM

1. **Exact Surface Threshold**: The algorithm uses `SURFACE_LEVEL = 0.0` as the boundary between solid and air. Any noise value < 0.0 is considered solid, and ≥ 0.0 is air.

2. **Cube Indexing System**: Each cube has 8 corners, and the marching cubes algorithm uses a bit-wise encoding to create an index (0-255) representing which corners are inside or outside the surface.

3. **Triangulation Table**: A pre-computed lookup table that converts each cube configuration (0-255) into a list of edges to generate triangles.

4. **Edge Interpolation**: For smoother surfaces, vertex positions are interpolated along edges based on noise values to place vertices exactly at the surface threshold.

5. **Normal Calculation**: For proper lighting, vertex normals need to be computed after mesh generation. THREE.js provides `geometry.computeVertexNormals()` for this.

## KEY CODE PATTERNS

### 1. Mesh Generation with Neighbor Data
```typescript
function generateMesh(chunkX, chunkY, chunkZ, noiseMap, allNeighborMaps) {
  // Process each cube
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        // Get all 8 corners, using neighbor data when needed
        const corners = getCubeCorners(x, y, z, noiseMap, allNeighborMaps);
        // Skip if any corner is missing
        if (corners.some(c => c === null)) continue;
        // Generate triangles for this cube
        // ...
      }
    }
  }
}
```

### 2. Priority-Based Chunk Loading
```typescript
const chunks = [];
// Add chunks in LOD order
for (let dx = -radius; dx <= radius; dx++) {
  for (let dy = -vRadius; dy <= vRadius; dy++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const priority = calculatePriority(dx, dy, dz);
      chunks.push({x: playerChunkX + dx, y: playerChunkY + dy, z: playerChunkZ + dz, priority});
    }
  }
}
// Sort by priority
chunks.sort((a, b) => a.priority - b.priority);
// Process only a limited number per frame
for (let i = 0; i < MAX_CHUNKS_PER_FRAME && i < chunks.length; i++) {
  loadChunk(chunks[i]);
}
```

## VISUAL DEBUGGING

```typescript
// Create wireframe boxes around chunks
for (const chunkKey in loadedChunks) {
  // Create box with color based on status
  // Green = complete with mesh
  // Yellow = pending (no mesh yet)
  // Red = underground chunks
  // Blue = sky chunks
}
``` 