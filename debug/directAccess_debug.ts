/**
 * Direct access functions for NoiseMap and PlayerEditMask
 *
 * This file provides functions that directly access the NoiseMap and PlayerEditMask
 * without relying on the type definitions, which are causing issues.
 */

import { NoiseMap, PlayerEditMask } from "./types_debug";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./constants_debug";

/**
 * Gets a value from a NoiseMap
 * @param noiseMap The noise map to access
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @returns The noise value at the specified coordinates, or undefined if out of bounds
 */
export function getNoiseValue(noiseMap: any, x: number, y: number, z: number): number | undefined {
  try {
    // CRITICAL FIX: Handle coordinates beyond CHUNK_HEIGHT+1
    // If the coordinate doesn't exist, return a default value instead of undefined
    // This ensures that we don't get errors when accessing coordinates beyond CHUNK_HEIGHT+1

    // CRITICAL FIX: Handle any Y coordinate, including negative values
    // This is necessary to handle chunks at any Y coordinate
    // If Y is extremely out of bounds, log a warning
    if (y < -1000 || y > 1000) {
      console.warn(`Y coordinate ${y} extremely out of bounds for NoiseMap`);
    }

    // If any dimension doesn't exist, return a default value (1.0 = empty space)
    if (noiseMap[y] === undefined || noiseMap[y][z] === undefined) {
      return 1.0; // Default to empty space
    }

    // Check if x coordinate is valid
    if (x < 0 || x > CHUNK_SIZE+1) {
      return 1.0; // Default to empty space
    }

    // Return the actual value or default to empty space
    const value = noiseMap[y][z][x];
    return value !== undefined ? value : 1.0;
  } catch (e) {
    console.error(`Error accessing noise map at [${y}][${z}][${x}]:`, e);
    return 1.0; // Default to empty space on error as well
  }
}

/**
 * Sets a value in a NoiseMap
 * @param noiseMap The noise map to modify
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @param value The value to set
 * @returns True if the value was set, false if the coordinates are out of bounds
 */
export function setNoiseValue(noiseMap: any, x: number, y: number, z: number, value: number): boolean {
  try {
    // CRITICAL FIX: Dynamically expand the NoiseMap when needed
    // This allows editing beyond CHUNK_HEIGHT+1

    // Check if y dimension exists
    if (noiseMap[y] === undefined) {
      // CRITICAL FIX: Allow any Y coordinate, including negative values
      // This is necessary to handle chunks at any Y coordinate
      if (y < -1000 || y > 1000) {
        console.warn(`Y coordinate ${y} extremely out of bounds for NoiseMap`);
        return false;
      }
      // Dynamically expand the y dimension
      noiseMap[y] = [];
      console.log(`Expanded NoiseMap to include y=${y}`);
    }

    // Check if z dimension exists
    if (noiseMap[y][z] === undefined) {
      // Use correct bounds check (0 to CHUNK_SIZE inclusive)
      if (z < 0 || z > CHUNK_SIZE) {
        console.warn(`Z coordinate ${z} out of bounds for NoiseMap`);
        return false;
      }
      // Initialize the z dimension with a Float32Array
      noiseMap[y][z] = new Float32Array(CHUNK_SIZE + 1); // Correct size
      // Fill with default values (1.0 = empty space)
      for (let i = 0; i <= CHUNK_SIZE; i++) { // Correct loop bounds
        noiseMap[y][z][i] = 1.0;
      }
    }

    // Check if x coordinate is valid
    if (x < 0 || x > CHUNK_SIZE+1) {
      console.warn(`X coordinate ${x} out of bounds for NoiseMap`);
      return false;
    }

    // Now we can safely set the value
    noiseMap[y][z][x] = value;
    return true;
  } catch (e) {
    console.error(`Error setting noise map at [${y}][${z}][${x}]:`, e);
    return false;
  }
}

/**
 * Gets a value from a PlayerEditMask
 * @param mask The player edit mask to access
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @returns The edit state at the specified coordinates, or undefined if out of bounds
 */
export function getEditMaskValue(mask: any, x: number, y: number, z: number): boolean | undefined {
  try {
    // CRITICAL FIX: Handle coordinates beyond CHUNK_HEIGHT+1
    // If the coordinate doesn't exist, return false instead of undefined
    // This ensures that we don't get errors when accessing coordinates beyond CHUNK_HEIGHT+1

    // Check if the coordinates are valid
    // CRITICAL FIX: Allow any Y coordinate, including negative values
    // This is necessary to handle chunks at any Y coordinate
    if (x < 0 || x >= CHUNK_SIZE || y < -1000 || y > 1000 || z < 0 || z >= CHUNK_SIZE) {
      return undefined;
    }

    // If any dimension doesn't exist, return false
    if (mask[x] === undefined || mask[x][y] === undefined || mask[x][y][z] === undefined) {
      return false;
    }

    // Return the actual value
    return mask[x][y][z];
  } catch (e) {
    console.error(`Error accessing player edit mask at [${x}][${y}][${z}]:`, e);
    return undefined;
  }
}

/**
 * Sets a value in a PlayerEditMask
 * @param mask The player edit mask to modify
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @param value The value to set
 * @returns True if the value was set, false if the coordinates are out of bounds
 */
export function setEditMaskValue(mask: any, x: number, y: number, z: number, value: boolean): boolean {
  try {
    // CRITICAL FIX: Dynamically expand the PlayerEditMask when needed
    // This allows editing beyond CHUNK_HEIGHT+1

    // Check if x dimension exists
    if (mask[x] === undefined) {
      if (x < 0 || x >= CHUNK_SIZE) {
        console.warn(`X coordinate ${x} out of bounds for PlayerEditMask`);
        return false;
      }
      mask[x] = [];
    }

    // Check if y dimension exists
    if (mask[x][y] === undefined) {
      // CRITICAL FIX: Allow any Y coordinate, including negative values
      // This is necessary to handle chunks at any Y coordinate
      if (y < -1000 || y > 1000) {
        console.warn(`Y coordinate ${y} extremely out of bounds for PlayerEditMask`);
        return false;
      }
      // Dynamically expand the y dimension
      mask[x][y] = [];
      console.log(`Expanded PlayerEditMask to include y=${y}`);
    }

    // Check if z dimension exists
    if (mask[x][y][z] === undefined) {
      if (z < 0 || z >= CHUNK_SIZE) {
        console.warn(`Z coordinate ${z} out of bounds for PlayerEditMask`);
        return false;
      }
      // Initialize the z dimension
      mask[x][y][z] = false;
    }

    // Now we can safely set the value
    mask[x][y][z] = value;
    return true;
  } catch (e) {
    console.error(`Error setting player edit mask at [${x}][${y}][${z}]:`, e);
    return false;
  }
}

/**
 * Creates a new PlayerEditMask with the correct dimensions
 * @returns A new PlayerEditMask
 */
export function createNewEditMask(): PlayerEditMask {
  const mask: PlayerEditMask = [];
  for (let x = 0; x < CHUNK_SIZE; x++) {
    mask[x] = [];
    // CRITICAL FIX: Create a much larger edit mask to allow editing at any Y coordinate
    // This is necessary to handle chunks at any Y coordinate, including very negative values
    // We'll use 3x the normal height to ensure we have enough space
    for (let y = 0; y <= CHUNK_HEIGHT * 3; y++) {
      mask[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        mask[x][y][z] = false;
      }
    }
  }
  console.log(`Created PlayerEditMask with dimensions: ${CHUNK_SIZE}x${CHUNK_HEIGHT * 3 + 1}x${CHUNK_SIZE}`);
  return mask;
}

/**
 * Dumps the dimensions of a NoiseMap for debugging
 * @param noiseMap The noise map to dump
 */
export function dumpNoiseMapDimensions(noiseMap: any): void {
  try {
    const yDim = noiseMap.length;
    const zDim = noiseMap[0]?.length || 0;
    const xDim = noiseMap[0]?.[0]?.length || 0;
    console.log(`NoiseMap dimensions: [${yDim}][${zDim}][${xDim}]`);
  } catch (e) {
    console.error("Error dumping noise map dimensions:", e);
  }
}

/**
 * Dumps the dimensions of a PlayerEditMask for debugging
 * @param mask The player edit mask to dump
 */
export function dumpEditMaskDimensions(mask: any): void {
  try {
    const xDim = mask.length;
    const yDim = mask[0]?.length || 0;
    const zDim = mask[0]?.[0]?.length || 0;
    console.log(`PlayerEditMask dimensions: [${xDim}][${yDim}][${zDim}]`);
  } catch (e) {
    console.error("Error dumping player edit mask dimensions:", e);
  }
}
