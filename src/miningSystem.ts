import * as THREE from 'three';
import { editNoiseMapChunks } from './noiseMapEditor';
import { LoadedChunks, NoiseLayers } from './types';

interface MiningSystem {
    handleMining: (intersection: THREE.Intersection, remove: boolean) => void;
}

export function createMiningSystem(
    loadedChunks: LoadedChunks,
    noiseLayers: NoiseLayers | null,
    seed: number | null,
    regenerateChunk: (x: number, y: number, z: number) => void
): MiningSystem {
    return {
        handleMining: (intersection: THREE.Intersection, remove: boolean) => {
            if (!intersection.point) return;
            
            // Get the world position of the intersection
            const worldPoint = intersection.point.clone();
            if (remove) {
                // Move the point slightly towards the face normal when removing terrain
                worldPoint.add(intersection.face!.normal.multiplyScalar(0.1));
            } else {
                // Move the point slightly away from the face when adding terrain
                worldPoint.sub(intersection.face!.normal.multiplyScalar(0.1));
            }

            // Call editNoiseMapChunks with proper types
            const affectedChunks = editNoiseMapChunks(loadedChunks, worldPoint, remove, noiseLayers, seed);
            
            // Regenerate all affected chunks, ensuring coordinates are numbers
            affectedChunks.forEach(([x, y, z]) => {
                regenerateChunk(Number(x), Number(y), Number(z));
            });
        }
    };
}

export function mineBlock(loadedChunks: LoadedChunks, position: THREE.Vector3, noiseLayers: NoiseLayers | null, seed: number | null) {
    // Call editNoiseMapChunks with proper types
    const affectedChunks = editNoiseMapChunks(loadedChunks, position, true, noiseLayers, seed);
    
    // Return the affected chunks coordinates
    return affectedChunks;
}