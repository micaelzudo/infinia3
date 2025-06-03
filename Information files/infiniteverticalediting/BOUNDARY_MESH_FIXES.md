# Boundary Mesh Fixes

This document explains the changes made to fix grid artifacts at chunk boundaries in the marching cubes implementation.

## Overview of Changes

1. **Improved Noise Sampling**
   - Enhanced `getNoiseSafe` function to better handle boundary cases
   - Added `getNoiseSafeFromMap` helper function for consistent noise value access

2. **Fixed Boundary Triangle Emission Logic**
   - Completely rewrote `isTrulyOpenBoundaryTriangle` function
   - Added better detection of boundary triangles using vertex positions
   - Improved handling of neighbor chunk awareness

3. **Consistent Vertex Positioning**
   - Added `snapVerticesToBoundaries` function to ensure vertices at chunk boundaries are positioned consistently
   - Implemented precise snapping of vertices to exact boundary positions

4. **Enhanced Neighbor Awareness**
   - Added `neighborFlags` object to track which neighbors exist
   - Passed neighbor flags to mesh generation functions

5. **Debug Visualization Tools**
   - Added boundary edge visualization to help identify problematic areas
   - Created toggle buttons for boundary mesh logging and visualization

## How to Use the Debug Tools

1. **Boundary Mesh Logging**
   - Click the "Toggle Boundary Mesh Logging" button to enable/disable detailed logging of boundary mesh generation
   - When enabled, the console will show detailed information about boundary triangles

2. **Boundary Edge Visualization**
   - Click the "Show Boundary Edges" button to visualize all edges at chunk boundaries
   - Red lines indicate edges at chunk boundaries
   - This helps identify gaps or overlaps between chunks

## Technical Details

### Noise Sampling

The improved `getNoiseSafe` function handles boundary cases more robustly:

```typescript
function getNoiseSafe(x: number, y: number, z: number, currentMap: NoiseMap, neighbors: { [key: string]: NoiseMap | null | undefined }): number | null {
  // Handle Y boundaries first (vertical)
  if (y < 0) {
    if (!neighbors.below) return null;
    return getNoiseSafeFromMap(x, y + CHUNK_HEIGHT, z, neighbors.below);
  }
  // ... handle other boundaries
}
```

### Boundary Triangle Emission

The new boundary triangle emission logic better handles edge cases:

```typescript
function isTrulyOpenBoundaryTriangle(vs: Float32Array, x: number, y: number, z: number): boolean {
  // Check if this is a boundary triangle
  const isXBoundary = (x === 0 && xs.some(xx => Math.abs(xx) < 1e-4)) || 
                      (x === CHUNK_SIZE-1 && xs.some(xx => Math.abs(xx - CHUNK_SIZE) < 1e-4));
  // ... check other boundaries
  
  // If there's a neighbor, always emit to ensure seamless boundaries
  if ((isXBoundary && (x === 0 ? neighborFlags.neighborXNegExists : neighborFlags.neighborXPosExists)) ||
      // ... check other neighbors
  ) {
    return true;
  }
  
  // For open boundaries, check if the triangle is truly needed
  // ... sample noise values and determine if boundary is open
}
```

### Vertex Snapping

The vertex snapping function ensures consistent positioning:

```typescript
function snapVerticesToBoundaries(vertices: Float32Array, chunkX: number, chunkY: number, chunkZ: number): void {
  for (let i = 0; i < vertices.length; i += 3) {
    // Snap X to chunk boundaries if very close
    if (Math.abs(vertices[i] - chunkX * CHUNK_SIZE) < SNAP_THRESHOLD) {
      vertices[i] = chunkX * CHUNK_SIZE;
    }
    // ... snap other coordinates
  }
}
```

## Remaining Considerations

1. **Corner Cases**: While the current implementation handles most boundary cases, there might still be issues at corners where three chunks meet.

2. **Performance**: The additional checks and snapping operations might impact performance slightly. Consider optimizing if needed.

3. **Diagonal Neighbors**: For perfect corner handling, diagonal neighbors might be needed. The current implementation only uses the six direct neighbors.

## Future Improvements

1. **Adaptive Resolution**: Consider implementing adaptive resolution for more detailed terrain near the player.

2. **Optimized Boundary Handling**: Further optimize boundary handling by pre-computing boundary information.

3. **Seamless LOD Transitions**: Implement level-of-detail transitions that maintain seamless boundaries.
