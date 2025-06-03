import * as THREE from 'three'; // Keep THREE import if needed elsewhere, otherwise remove
import { generateMesh } from './meshGenerator_debug';
import type { NoiseMap, PlayerEditMask } from './types_debug';

interface WorkerMessage {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    noiseMap: NoiseMap;
    neighbors: {
        xNeg: NoiseMap | null;
        xPos: NoiseMap | null;
        zNeg: NoiseMap | null;
        zPos: NoiseMap | null;
    };
    interpolate: boolean;
    neighborFlags: {
        neighborXPosExists?: boolean;
        neighborZPosExists?: boolean;
        neighborXNegExists?: boolean;
        neighborZNegExists?: boolean;
    };
    playerEditMask?: PlayerEditMask | null;
    neighborEditMasks?: {
        xNeg?: PlayerEditMask | null;
        xPos?: PlayerEditMask | null;
        zNeg?: PlayerEditMask | null;
        zPos?: PlayerEditMask | null;
    };
}

// Validate that we have all the neighbor data required for horizontal neighbors
// Check X and Z neighbors for proper edge matching
function validateNoiseMapBoundaries(
    noiseMap: NoiseMap,
    neighbors: { 
        xNeg: NoiseMap | null;
        xPos: NoiseMap | null;
        zNeg: NoiseMap | null;
        zPos: NoiseMap | null;
    }
) {
    const debugMismatches = true;
    
    // Check X+ boundary
    if (neighbors.xPos) {
        for (let y = 0; y < noiseMap.length; y++) {
            for (let z = 0; z < noiseMap[0].length; z++) {
                const rightEdge = noiseMap[y][z][noiseMap[0][0].length - 1];
                const leftNeighbor = neighbors.xPos[y][z][0];
                if (Math.abs(rightEdge - leftNeighbor) > 0.00001) { // Use epsilon for float comparison
                    if (debugMismatches) {
                        console.warn(`X+ boundary mismatch at y=${y}, z=${z}: ${rightEdge} vs ${leftNeighbor}`);
                    }
                    // Force alignment
                    neighbors.xPos[y][z][0] = rightEdge;
                }
            }
        }
    }
    
    // Check X- boundary
    if (neighbors.xNeg) {
        for (let y = 0; y < noiseMap.length; y++) {
            for (let z = 0; z < noiseMap[0].length; z++) {
                const leftEdge = noiseMap[y][z][0];
                const rightNeighbor = neighbors.xNeg[y][z][neighbors.xNeg[0][0].length - 1];
                if (Math.abs(leftEdge - rightNeighbor) > 0.00001) {
                    if (debugMismatches) {
                        console.warn(`X- boundary mismatch at y=${y}, z=${z}: ${leftEdge} vs ${rightNeighbor}`);
                    }
                    // Force alignment
                    neighbors.xNeg[y][z][neighbors.xNeg[0][0].length - 1] = leftEdge;
                }
            }
        }
    }
    
    // Check Z+ boundary
    if (neighbors.zPos) {
        for (let y = 0; y < noiseMap.length; y++) {
            for (let x = 0; x < noiseMap[0][0].length; x++) {
                const frontEdge = noiseMap[y][noiseMap[0].length - 1][x];
                const backNeighbor = neighbors.zPos[y][0][x];
                if (Math.abs(frontEdge - backNeighbor) > 0.00001) {
                    if (debugMismatches) {
                        console.warn(`Z+ boundary mismatch at y=${y}, x=${x}: ${frontEdge} vs ${backNeighbor}`);
                    }
                    // Force alignment
                    neighbors.zPos[y][0][x] = frontEdge;
                }
            }
        }
    }
    
    // Check Z- boundary
    if (neighbors.zNeg) {
        for (let y = 0; y < noiseMap.length; y++) {
            for (let x = 0; x < noiseMap[0][0].length; x++) {
                const backEdge = noiseMap[y][0][x];
                const frontNeighbor = neighbors.zNeg[y][neighbors.zNeg[0].length - 1][x];
                if (Math.abs(backEdge - frontNeighbor) > 0.00001) {
                    if (debugMismatches) {
                        console.warn(`Z- boundary mismatch at y=${y}, x=${x}: ${backEdge} vs ${frontNeighbor}`);
                    }
                    // Force alignment
                    neighbors.zNeg[y][neighbors.zNeg[0].length - 1][x] = backEdge;
                }
            }
        }
    }
    
    return { noiseMap, neighbors };
}

self.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
    // Extract values from message data (before try block)
    const { 
        chunkX, chunkY, chunkZ, noiseMap, neighbors, interpolate, 
        neighborFlags, playerEditMask, neighborEditMasks 
    } = e.data;

    // Declare chunkKey outside try block so it's available in catch
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    
    try {
        // Validate & fix noise map boundaries to ensure perfect alignment
        const { noiseMap: validatedMap, neighbors: validatedNeighbors } = 
            validateNoiseMapBoundaries(noiseMap, neighbors);
        
        // Generate mesh with validated maps
        const geometry = generateMesh(
            chunkX, chunkY, chunkZ,
            { noiseMap: validatedMap },
            interpolate,
            null, // noiseMapBelow - null for horizontal-only loading
            null, // noiseMapAbove - null for horizontal-only loading
            validatedNeighbors.xNeg,
            validatedNeighbors.xPos,
            validatedNeighbors.zNeg,
            validatedNeighbors.zPos,
            neighborFlags,
            playerEditMask
        );

        // Extract position and normal attributes
        const positionAttribute = geometry.getAttribute('position');
        const normalAttribute = geometry.getAttribute('normal');
        const indexAttribute = geometry.getIndex();

        if (!positionAttribute || !normalAttribute) {
            throw new Error('Generated geometry missing required attributes');
        }

        // Send back success response with geometry data
        self.postMessage({
            success: true,
            chunkKey: chunkKey,
            data: {
                positions: positionAttribute.array,
                normals: normalAttribute.array,
                indices: indexAttribute?.array || null
            }
        });

    } catch (error) {
        // Send back error response
        self.postMessage({
            success: false,
            chunkKey: chunkKey,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});