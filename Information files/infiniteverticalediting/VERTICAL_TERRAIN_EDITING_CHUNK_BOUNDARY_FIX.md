# Vertical Terrain Editing Chunk Boundary Fix

This document explains the critical fix made to allow terrain editing beyond vertical chunk boundaries.

## Overview of the Problem

The core issue preventing terrain editing beyond vertical chunk boundaries was in the `noiseMapEditor_debug.ts` file. The problem was that when editing near the top or bottom of a chunk, the editor would try to modify voxels in the current chunk even when the edit should actually affect voxels in the chunk above or below.

## Key Fix: Chunk Boundary Detection and Redirection

The solution involves detecting when an edit operation crosses a vertical chunk boundary and redirecting the edit to the correct chunk:

1. **Detect Boundary Crossing**: When the local Y coordinate (`targetMapY`) is outside the current chunk's bounds (negative or greater than `CHUNK_HEIGHT`), we calculate which chunk should actually be modified.

2. **Redirect to Correct Chunk**: Instead of clamping the Y coordinate to the current chunk's bounds, we adjust both the chunk Y coordinate (`actualChunkY`) and the local Y coordinate (`actualMapY`) to point to the correct chunk and position within that chunk.

3. **Use Correct Chunk Key**: We use the adjusted chunk coordinates to generate the correct chunk key, ensuring that the edit affects the right chunk.

## Technical Details

### Boundary Detection and Redirection

```typescript
// Calculate local Y coordinate within the current chunk
const targetMapY = Math.floor(targetWorldY) - targetChunkY * CHUNK_HEIGHT;

// Instead of clamping, detect if we need to edit a different chunk
let actualChunkY = targetChunkY;
let actualMapY = targetMapY;

// If targetMapY is negative, we need to edit the chunk below
if (targetMapY < 0) {
    actualChunkY = targetChunkY - 1;
    actualMapY = CHUNK_HEIGHT + targetMapY; // Convert to local coordinates in the chunk below
}
// If targetMapY is above CHUNK_HEIGHT, we need to edit the chunk above
else if (targetMapY > CHUNK_HEIGHT) {
    actualChunkY = targetChunkY + 1;
    actualMapY = targetMapY - CHUNK_HEIGHT - 1; // Convert to local coordinates in the chunk above
}

// Now ensure the actualMapY is within valid bounds for the noise map
const clampedTargetMapY = Math.max(0, Math.min(actualMapY, CHUNK_HEIGHT));
```

### Using the Correct Chunk Key

```typescript
// Use the actual chunk coordinates after adjusting for Y boundaries
const targetChunkKey = getChunkKeyY(targetChunkX, actualChunkY, targetChunkZ);
```

### Vertical Boundary Propagation

```typescript
// Special handling for vertical boundaries to ensure proper propagation
if (clampedTargetMapY === 0 || clampedTargetMapY === CHUNK_HEIGHT) {
    // We're at a vertical boundary, make sure to update the neighboring chunk's mask
    const vertNeighborChunkY = clampedTargetMapY === 0 ? actualChunkY - 1 : actualChunkY + 1;
    // ...
}
```

## How to Test the Fix

1. Run the application and load the isolated terrain viewer
2. Try editing terrain near vertical chunk boundaries
3. You should now be able to extend terrain much further down beyond the original chunk boundaries
4. The edit should seamlessly cross chunk boundaries without any gaps or artifacts

## Why This Fix Works

The previous implementation was trying to clamp edits to the current chunk's bounds, which prevented editing beyond those bounds. By detecting when an edit should affect a different chunk and redirecting it to that chunk, we allow editing to seamlessly cross chunk boundaries.

This fix ensures that:

1. The correct chunk is identified for each edit operation
2. The local coordinates within that chunk are calculated correctly
3. The edit is applied to the right position in the right chunk
4. Boundary propagation between chunks works correctly

## Related Components

This fix works in conjunction with the existing boundary handling in `meshGenerator_debug.ts`, which already has special cases for vertical boundaries:

```typescript
// Special case for vertical boundaries: always allow editing even if neighbor doesn't exist
if ((face === '+Y' || face === '-Y') && !neighborExists) {
  // For vertical boundaries without neighbors, always emit if this voxel is inside the surface
  return thisDensity < SURFACE_LEVEL;
}
```

And in `isTrulyOpenBoundaryTriangle`:

```typescript
// Special case for vertical boundaries: always allow editing even if neighbor doesn't exist
if (isYBoundary) {
  // For vertical boundaries, always emit triangles to allow extending terrain down
  return true;
}
```

These components work together to ensure that terrain can be edited seamlessly across vertical chunk boundaries.
