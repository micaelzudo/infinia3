import { createNoise3D } from "simplex-noise";
import { CHUNK_HEIGHT, CHUNK_SIZE, DEFAULT_NOISE_LAYERS } from "./constants_debug";
import { NoiseLayers, NoiseMap, Seed } from "./types_debug";

export function generateNoiseMap(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  noiseLayers?: NoiseLayers | null,
  seed?: Seed | null,
): NoiseMap | null {
  const currentSeed = seed || Math.random();
  const noise = createNoise3D(() => currentSeed);

  const noiseMap: NoiseMap = [];
  // Ensure noiseLayers is never null/undefined by using a default
  const effectiveNoiseLayers = noiseLayers || DEFAULT_NOISE_LAYERS;

  try {
    // CRITICAL: Match the reference y-loop structure
    let y = 0;
    while (y <= CHUNK_HEIGHT) {
      const plane = [];
      let z = 0;
      while (z <= CHUNK_SIZE) {
        // MATCH REFERENCE: Use ArrayBuffer for line creation
        const buffer = new ArrayBuffer((CHUNK_SIZE + 1) * 4);
        const line = new Float32Array(buffer);
        let x = 0;
        while (x <= CHUNK_SIZE) {
          // EXACT MATCH: Use reference noise offset calculation
          // <<< USE worldY FOR OFFSET like reference >>>
          const worldY = y + chunkY * CHUNK_HEIGHT;
          let noiseOffset = 0;
          const MIN_OFFSET = -20; // Match reference value

          // Use worldY-based offset calculation similar to reference
          if (worldY < 10) {
            noiseOffset = Math.max(MIN_OFFSET, (worldY - 10) * 0.2); // Match reference formula
          } else {
            noiseOffset = (worldY - 10) * 0.05; // Match reference formula
          }
          // <<< END worldY OFFSET >>>

          // EXACT MATCH: Use reference coordinate calculation
          const noiseOne = noise(
            (x + (chunkX - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[0],
            (y + chunkY * CHUNK_HEIGHT) / effectiveNoiseLayers[0],
            (z + (chunkZ - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[0]
          );

          const noiseTwo = 0.5 *
            noise(
              (x + (chunkX - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[1],
              (y + chunkY * CHUNK_HEIGHT) / effectiveNoiseLayers[1],
              (z + (chunkZ - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[1]
            );

          const noiseThree = 0.25 *
            noise(
              (x + (chunkX - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[2],
              (y + chunkY * CHUNK_HEIGHT) / effectiveNoiseLayers[2],
              (z + (chunkZ - 0.5) * CHUNK_SIZE) / effectiveNoiseLayers[2]
            );

          // EXACT MATCH: Layer three noise values as in reference
          let noiseValue = noiseOne + noiseTwo + noiseThree + noiseOffset;

          line[x] = noiseValue;
          x++;
        }
        plane.push(line);
        z++;
      }
      noiseMap.push(plane);
      y++;
    }
    
    // Debug output of noise values at key points for verification
    if (Math.abs(chunkX) <= 1 && Math.abs(chunkZ) <= 1) {
      console.log(`Noise map for chunk [${chunkX},${chunkY},${chunkZ}]:`);
      
      // Sample middle points of the chunk
      const midY = Math.floor(CHUNK_HEIGHT / 2);
      const midZ = Math.floor(CHUNK_SIZE / 2);
      const midX = Math.floor(CHUNK_SIZE / 2);
      
      console.log(`  Center value: [${midX},${midY},${midZ}] = ${noiseMap[midY][midZ][midX].toFixed(3)}`);
      
      // Boundaries
      console.log(`  X=0 boundary: [0,${midY},${midZ}] = ${noiseMap[midY][midZ][0].toFixed(3)}`);
      console.log(`  X=${CHUNK_SIZE} boundary: [${CHUNK_SIZE},${midY},${midZ}] = ${noiseMap[midY][midZ][CHUNK_SIZE].toFixed(3)}`);
      
      console.log(`  Z=0 boundary: [${midX},${midY},0] = ${noiseMap[midY][0][midX].toFixed(3)}`);
      console.log(`  Z=${CHUNK_SIZE} boundary: [${midX},${midY},${CHUNK_SIZE}] = ${noiseMap[midY][CHUNK_SIZE][midX].toFixed(3)}`);
      
      console.log(`  Y=0 boundary: [${midX},0,${midZ}] = ${noiseMap[0][midZ][midX].toFixed(3)}`);
      console.log(`  Y=${CHUNK_HEIGHT} boundary: [${midX},${CHUNK_HEIGHT},${midZ}] = ${noiseMap[CHUNK_HEIGHT][midZ][midX].toFixed(3)}`);
      
      // Log chunkY for debugging vertical chunk order
      console.log(`  Current chunk Y index: ${chunkY} (${chunkY * CHUNK_HEIGHT} world Y offset)`);
    }
    
    return noiseMap;
  } catch (error) {
    console.error(`Error generating noise map for chunk ${chunkX},${chunkY},${chunkZ}:`, error);
    return null;
  }
}
