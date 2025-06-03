/**
 * Utility functions for consistent indexing of NoiseMap and PlayerEditMask
 * 
 * IMPORTANT: The NoiseMap and PlayerEditMask use different indexing patterns:
 * - NoiseMap is indexed as [y][z][x]
 * - PlayerEditMask is indexed as [x][y][z]
 * 
 * These utility functions ensure consistent access patterns.
 */

import { NoiseMap, PlayerEditMask } from "./types_debug";

/**
 * Gets a value from a NoiseMap using the correct indexing pattern [y][z][x]
 * @param noiseMap The noise map to access
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @returns The noise value at the specified coordinates, or undefined if out of bounds
 */
export function getNoiseMapValue(noiseMap: NoiseMap, x: number, y: number, z: number): number | undefined {
  // NoiseMap is indexed as [y][z][x]
  return noiseMap[y]?.[z]?.[x];
}

/**
 * Sets a value in a NoiseMap using the correct indexing pattern [y][z][x]
 * @param noiseMap The noise map to modify
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @param value The value to set
 * @returns True if the value was set, false if the coordinates are out of bounds
 */
export function setNoiseMapValue(noiseMap: NoiseMap, x: number, y: number, z: number, value: number): boolean {
  // NoiseMap is indexed as [y][z][x]
  if (noiseMap[y]?.[z]?.[x] !== undefined) {
    noiseMap[y][z][x] = value;
    return true;
  }
  return false;
}

/**
 * Gets a value from a PlayerEditMask using the correct indexing pattern [x][y][z]
 * @param mask The player edit mask to access
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @returns The edit state at the specified coordinates, or undefined if out of bounds
 */
export function getPlayerEditMaskValue(mask: PlayerEditMask, x: number, y: number, z: number): boolean | undefined {
  // PlayerEditMask is indexed as [x][y][z]
  return mask[x]?.[y]?.[z];
}

/**
 * Sets a value in a PlayerEditMask using the correct indexing pattern [x][y][z]
 * @param mask The player edit mask to modify
 * @param x The x coordinate
 * @param y The y coordinate
 * @param z The z coordinate
 * @param value The value to set
 * @returns True if the value was set, false if the coordinates are out of bounds
 */
export function setPlayerEditMaskValue(mask: PlayerEditMask, x: number, y: number, z: number, value: boolean): boolean {
  // PlayerEditMask is indexed as [x][y][z]
  if (mask[x]?.[y]?.[z] !== undefined) {
    mask[x][y][z] = value;
    return true;
  }
  return false;
}
