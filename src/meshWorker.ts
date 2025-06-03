import { generateMesh } from "./meshGenerator";
import { NoiseMap, ChunkData } from "./types";

interface MeshGenerationMessage {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    noiseMap: NoiseMap;
    neighbors: {
        below: NoiseMap | null;
        above: NoiseMap | null;
        xNeg: NoiseMap | null;
        xPos: NoiseMap | null;
        zNeg: NoiseMap | null;
        zPos: NoiseMap | null;
    };
    interpolate: boolean;
    wireframe: boolean;
}

self.onmessage = async (e: MessageEvent<MeshGenerationMessage>) => {
    try {
        const { chunkX, chunkY, chunkZ, noiseMap, neighbors, interpolate, wireframe } = e.data;

        // Generate mesh with neighbor data
        const geometry = generateMesh(
            chunkX, chunkY, chunkZ,
            { noiseMap },
            interpolate,
            wireframe,
            neighbors.below,
            neighbors.above, 
            neighbors.xNeg,
            neighbors.xPos,
            neighbors.zNeg,
            neighbors.zPos
        );

        // Transfer vertex and index buffer data
        const positions = geometry.getAttribute('position').array;
        const normals = geometry.getAttribute('normal').array;
        const indices = geometry.index?.array;

        self.postMessage({
            success: true,
            chunkKey: `${chunkX},${chunkY},${chunkZ}`,
            data: {
                positions,
                normals,
                indices
            }
        }, [
            positions.buffer,
            normals.buffer,
            indices ? indices.buffer : []
        ]);

    } catch (error) {
        self.postMessage({
            success: false,
            chunkKey: `${chunkX},${chunkY},${chunkZ}`,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};