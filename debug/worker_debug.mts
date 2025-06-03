import '/@vite/env'
import { generateNoiseMap } from './noiseMapGenerator_debug';
import { generateMesh } from './meshGenerator_debug';
import type { NoiseLayers, Seed, NoiseMap } from "./types_debug";

// Expected message: [chunkX, chunkY, chunkZ, noiseLayers, seed]
type WorkerNoiseGenMessage = [chunkX: number, chunkY: number, chunkZ: number, noiseLayers: NoiseLayers, seed: Seed];

// Return message format matching what IsolatedWorkerPool expects
// [chunkX, chunkY, chunkZ, payload] where payload has positionBuffer and noiseMap
type WorkerReturnPayload = {
    positionBuffer: Float32Array | null;
    noiseMap: NoiseMap | null;
};
type WorkerReturnMessage = [chunkX: number, chunkY: number, chunkZ: number, payload: WorkerReturnPayload];

addEventListener("message", (e: MessageEvent<WorkerNoiseGenMessage>) => {
    const [chunkX, chunkY, chunkZ, noiseLayers, seed] = e.data;
    console.log(`Worker: STARTED processing chunk [${chunkX},${chunkY},${chunkZ}]`);

    try {
        // More verbose logging about the inputs
        console.log(`Worker: Generating for [${chunkX},${chunkY},${chunkZ}] with seed=${seed}`);
        
        // Generate the noise map
        const noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
        
        if (!noiseMap) {
            console.error(`Worker: Failed to generate noise map for [${chunkX},${chunkY},${chunkZ}] - returned null`);
            // Return proper format with null values
            postMessage([chunkX, chunkY, chunkZ, { positionBuffer: null, noiseMap: null }]);
            return;
        }
        
        // Validate noiseMap dimensions
        console.log(`Worker: NoiseMap dimensions for [${chunkX},${chunkY},${chunkZ}]: Y=${noiseMap.length}, Z=${noiseMap[0]?.length || 0}, X=${noiseMap[0]?.[0]?.length || 0}`);
        
        // Generate mesh from noise map
        try {
            // Get simplified geometry
            const geometry = generateMesh(
                chunkX, chunkY, chunkZ,
                { noiseMap },
                true, // optimizeFaces
                null, null, null, null, null, null, // No neighbors for simplicity
                { // Empty neighbor flags
                    neighborYPosExists: false,
                    neighborYNegExists: false,
                    neighborXPosExists: false,
                    neighborXNegExists: false,
                    neighborZPosExists: false,
                    neighborZNegExists: false,
                    playerEditMaskYPos: null,
                    playerEditMaskYNeg: null,
                    playerEditMaskXPos: null,
                    playerEditMaskXNeg: null,
                    playerEditMaskZPos: null,
                    playerEditMaskZNeg: null
                }
            );
            
            // Extract position buffer if geometry was generated
            const positionBuffer = geometry ? 
                new Float32Array(geometry.attributes.position.array) : null;
            
            // Return both the position buffer and the noise map
            const payload: WorkerReturnPayload = {
                positionBuffer,
                noiseMap
            };
            
            console.log(`Worker: COMPLETED chunk [${chunkX},${chunkY},${chunkZ}] - sending back to main thread`);
            console.log(`Worker: Generated positionBuffer length: ${positionBuffer?.length || 0}`);
            
            postMessage([chunkX, chunkY, chunkZ, payload]);
        } catch (meshError) {
            console.error(`Worker: ERROR generating mesh for [${chunkX},${chunkY},${chunkZ}]:`, meshError);
            // If mesh generation fails, still return the noise map
            postMessage([chunkX, chunkY, chunkZ, { positionBuffer: null, noiseMap }]);
        }
    } catch (error) {
        console.error(`Worker: ERROR generating noise map for [${chunkX},${chunkY},${chunkZ}]:`, error);
        // Return null values on error
        postMessage([chunkX, chunkY, chunkZ, { positionBuffer: null, noiseMap: null }]);
    }
});
