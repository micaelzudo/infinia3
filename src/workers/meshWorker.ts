import { generateMesh } from '../meshGenerator';
import { NoiseMap } from '../types';
import * as THREE from 'three';

interface WorkerMessage {
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

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const { chunkX, chunkY, chunkZ, noiseMap, neighbors, interpolate, wireframe } = e.data;
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;

    try {
        const geometry = generateMesh(
            chunkX,
            chunkY,
            chunkZ,
            { noiseMap }
        );

        // Extract geometry data 
        const positions = geometry.attributes.position.array;
        const normals = geometry.attributes.normal.array;
        const indices = geometry.index?.array;

        // Post message with transferable buffers
        const message = {
            success: true,
            chunkKey,
            data: {
                positions,
                normals,
                indices
            }
        };

        const transferables = [
            positions.buffer,
            normals.buffer
        ];
        
        if (indices) {
            transferables.push(indices.buffer);
        }

        self.postMessage(message, transferables);

    } catch (error) {
        self.postMessage({
            success: false,
            chunkKey,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};