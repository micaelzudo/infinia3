import { CHUNK_HEIGHT, CHUNK_SIZE } from "./constants";
import { generateNoiseMap } from "./noiseMapGenerator";
import { LoadedChunks, NoiseLayers, NoiseMap, Seed } from "./types";
import { getChunkKey } from "./utils";

// --- Infinite Vertical Editing ---
function getChunkKeyY(chunkX: number, chunkY: number, chunkZ: number) {
  return `${chunkX},${chunkY},${chunkZ}`;
}

export function editNoiseMapChunks(
  loadedChunks: LoadedChunks,
  worldPoint: THREE.Vector3,
  remove: boolean,
  noiseLayers?: NoiseLayers | null,
  seed?: Seed | null
) {
  // --- Calculate Base Chunk Coordinates --- 
  const chunkX = Math.floor((worldPoint.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunkY = Math.floor(worldPoint.y / CHUNK_HEIGHT);
  const chunkZ = Math.floor((worldPoint.z + CHUNK_SIZE / 2) / CHUNK_SIZE);

  // --- Calculate Local Coordinates within the Base Chunk --- 
  const localX = worldPoint.x - chunkX * CHUNK_SIZE;
  const localY = worldPoint.y - chunkY * CHUNK_HEIGHT;
  const localZ = worldPoint.z - chunkZ * CHUNK_SIZE;

  // --- Get Base Noise Map --- 
  const baseChunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
  let baseNoiseMap =
    baseChunkKey in loadedChunks
      ? loadedChunks[baseChunkKey].noiseMap
      : null;

  // Generate base noise map if it doesn't exist (e.g., clicking on newly exposed area)
  if (!baseNoiseMap) {
    baseNoiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
    if (!(baseChunkKey in loadedChunks)) {
      loadedChunks[baseChunkKey] = { mesh: null, noiseMap: baseNoiseMap };
    } else {
      loadedChunks[baseChunkKey].noiseMap = baseNoiseMap;
    }
  }

  // --- Edit Logic ---
  const radius = 2;
  const addOrRemove = remove ? 1 : -1;
  const affectedChunkCoords: string[] = [];
  // We'll keep track of all modified noise maps for updating loadedChunks at the end
  const modifiedNoiseMaps: { [key: string]: NoiseMap } = {};

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > radius * radius) continue;
        // Calculate target world coordinates
        const wx = localX + dx;
        const wy = localY + dy;
        const wz = localZ + dz;
        // Determine which chunk this coordinate falls into
        const tChunkX = chunkX + Math.floor(wx / CHUNK_SIZE);
        const tChunkY = chunkY + Math.floor(wy / CHUNK_HEIGHT);
        const tChunkZ = chunkZ + Math.floor(wz / CHUNK_SIZE);
        const tLocalX = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const tLocalY = ((wy % CHUNK_HEIGHT) + CHUNK_HEIGHT) % CHUNK_HEIGHT;
        const tLocalZ = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const targetChunkKey = getChunkKeyY(tChunkX, tChunkY, tChunkZ);
        let mapToModify = modifiedNoiseMaps[targetChunkKey];
        if (!mapToModify) {
          mapToModify =
            targetChunkKey in loadedChunks && loadedChunks[targetChunkKey].noiseMap
              ? loadedChunks[targetChunkKey].noiseMap!
              : generateNoiseMap(tChunkX, tChunkY, tChunkZ, noiseLayers, seed);
          modifiedNoiseMaps[targetChunkKey] = mapToModify;
        }
        // Add or remove terrain
        const radiusSq = radius * radius;
        const addMagnitude = (radiusSq - distSq) / radiusSq * 5;
        mapToModify[tLocalY][tLocalZ][tLocalX] += addOrRemove * addMagnitude;
        if (!affectedChunkCoords.includes(targetChunkKey)) {
          affectedChunkCoords.push(targetChunkKey);
        }
      }
    }
  }

  // --- Final Update ---
  for (const key in modifiedNoiseMaps) {
    loadedChunks[key] = loadedChunks[key] || { mesh: null, noiseMap: null };
    loadedChunks[key].noiseMap = modifiedNoiseMaps[key];
  }

  return affectedChunkCoords;
}
