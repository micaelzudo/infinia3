import { NoiseMap } from './types_debug';
import { CHUNK_HEIGHT, CHUNK_SIZE } from './constants_debug';

const STORAGE_PREFIX = 'terrain_edit_debug_';

function getStorageKey(chunkX: number, chunkZ: number): string {
    return `${STORAGE_PREFIX}${chunkX}_${chunkZ}`;
}

/**
 * Saves a NoiseMap to localStorage.
 * @param chunkX The chunk X coordinate.
 * @param chunkZ The chunk Z coordinate.
 * @param noiseMap The NoiseMap data to save.
 */
export function saveNoiseMap(chunkX: number, chunkZ: number, noiseMap: NoiseMap): void {
    const key = getStorageKey(chunkX, chunkZ);
    try {
        // JSON can handle nested arrays of numbers
        const serializedMap = JSON.stringify(noiseMap.map(plane => 
            plane.map(row => Array.from(row)) // Convert Float32Array rows to number[]
        ));
        localStorage.setItem(key, serializedMap);
        // console.debug(`Saved NoiseMap for chunk [${chunkX}, ${chunkZ}] to localStorage.`);
    } catch (error: any) {
        if (error.name === 'QuotaExceededError') {
            console.error(`💾❌ LocalStorage quota exceeded! Failed to save chunk [${chunkX}, ${chunkZ}]. Edits for this chunk may not persist. Clear storage if needed.`);
             // Optionally trigger a UI notification here
        } else {
            console.error(`Failed to save NoiseMap for chunk [${chunkX}, ${chunkZ}] to localStorage:`, error);
        }
    }
}

/**
 * Loads a NoiseMap from localStorage.
 * @param chunkX The chunk X coordinate.
 * @param chunkZ The chunk Z coordinate.
 * @returns The loaded NoiseMap or null if not found or error occurred.
 */
export function loadNoiseMap(chunkX: number, chunkZ: number): NoiseMap | null {
    const key = getStorageKey(chunkX, chunkZ);
    try {
        const serializedMap = localStorage.getItem(key);
        if (!serializedMap) {
            return null; // Not found
        }

        const parsedMap: number[][][] = JSON.parse(serializedMap);

        // Convert back to Float32Array structure
        const noiseMap: NoiseMap = parsedMap.map(plane => 
            plane.map(row => Float32Array.from(row))
        );

        // Basic validation (optional but recommended)
        if (noiseMap.length !== CHUNK_HEIGHT + 1 || 
            noiseMap[0].length !== CHUNK_SIZE + 1 || 
            noiseMap[0][0].length !== CHUNK_SIZE + 1) {
            console.warn(`Loaded NoiseMap for chunk [${chunkX}, ${chunkZ}] has incorrect dimensions. Discarding.`);
            localStorage.removeItem(key); // Remove invalid data
            return null;
        }

        // console.debug(`Loaded NoiseMap for chunk [${chunkX}, ${chunkZ}] from localStorage.`);
        return noiseMap;
    } catch (error) {
        console.error(`Failed to load or parse NoiseMap for chunk [${chunkX}, ${chunkZ}] from localStorage:`, error);
        // Consider removing potentially corrupted item
        // localStorage.removeItem(key);
        return null;
    }
}

/**
 * Clears ALL saved debug terrain edits from localStorage.
 */
export function clearAllSavedTerrain(): void {
    try {
        let keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keysToRemove.length} saved debug terrain chunks from localStorage.`);
    } catch (error) {
        console.error("Failed to clear saved terrain data:", error);
    }
}

// Optional: Add a button or command to call clearAllSavedTerrain() for testing
// e.g., expose it on the window object for manual console clearing:
// (window as any).clearDebugTerrain = clearAllSavedTerrain; 