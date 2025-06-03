import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { generateMesh } from '../../../meshGenerator_debug';
import { generateNoiseMap } from '../../../noiseMapGenerator_debug';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../constants_debug';
import type { NoiseMap, NoiseLayers } from '../../../types_debug';

/**
 * Helper function to snap vertices to chunk boundaries 
 * @param positions The position buffer to modify
 * @param chunkX X coordinate of the chunk
 * @param chunkY Y coordinate of the chunk
 * @param chunkZ Z coordinate of the chunk
 */
function snapVerticesToBoundaries(positions: Float32Array, chunkX: number, chunkY: number, chunkZ: number): void {
    const SNAP_THRESHOLD = 0.005; // Same as in meshGenerator_debug.ts

    // Calculate exact boundary positions
    const xLeftBoundary = (chunkX - 0.5) * CHUNK_SIZE;
    const xRightBoundary = (chunkX + 0.5) * CHUNK_SIZE;
    const yBottomBoundary = chunkY * CHUNK_HEIGHT;
    const yTopBoundary = (chunkY + 1) * CHUNK_HEIGHT;
    const zBackBoundary = (chunkZ - 0.5) * CHUNK_SIZE;
    const zFrontBoundary = (chunkZ + 0.5) * CHUNK_SIZE;

    // Snap vertices to boundaries and apply precision rounding
    for (let i = 0; i < positions.length; i += 3) {
        let vx = positions[i];
        let vy = positions[i+1];
        let vz = positions[i+2];

        // X boundaries
        if (Math.abs(vx - xLeftBoundary) < SNAP_THRESHOLD) {
            vx = xLeftBoundary;
        } else if (Math.abs(vx - xRightBoundary) < SNAP_THRESHOLD) {
            vx = xRightBoundary;
        }

        // Y boundaries - CRITICAL for vertical chunk stitching
        // The Y boundaries are the most important for fixing the vertical mesh continuity
        if (Math.abs(vy - yBottomBoundary) < SNAP_THRESHOLD) {
            vy = yBottomBoundary;
        } else if (Math.abs(vy - yTopBoundary) < SNAP_THRESHOLD) {
            vy = yTopBoundary;
        }

        // Z boundaries
        if (Math.abs(vz - zBackBoundary) < SNAP_THRESHOLD) {
            vz = zBackBoundary;
        } else if (Math.abs(vz - zFrontBoundary) < SNAP_THRESHOLD) {
            vz = zFrontBoundary;
        }

        // Apply precision fix - critical for consistent vertices across chunks
        positions[i] = Math.round(vx * 1000000) / 1000000;
        positions[i+1] = Math.round(vy * 1000000) / 1000000;
        positions[i+2] = Math.round(vz * 1000000) / 1000000;
    }
}

// Listen for messages from the main thread
self.onmessage = (event) => {
    try {
        // Extract parameters
        const { chunkX, chunkY, chunkZ, noiseLayers, seed } = event.data;
        
        // Generate noise map
        const noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
        
        if (!noiseMap) {
            // If noise map generation failed, return null result
            self.postMessage({
                chunkX,
                chunkY,
                chunkZ,
                positionBuffer: null,
                noiseMap: null
            });
            return;
        }
        
        // Generate mesh geometry
        const geometry = generateMesh(
            chunkX, chunkY, chunkZ,
            { noiseMap },
            true // Use interpolation
        );
        
        // Extract and process position buffer
        if (geometry && geometry.attributes && geometry.attributes.position) {
            const positionBuffer = geometry.attributes.position.array as Float32Array;
            
            // Apply boundary snapping to fix gaps between chunks
            snapVerticesToBoundaries(positionBuffer, chunkX, chunkY, chunkZ);
            
            // Return the results
            self.postMessage({
                chunkX,
                chunkY,
                chunkZ,
                positionBuffer,
                noiseMap
            });
        } else {
            // Return null buffer if geometry generation failed
            self.postMessage({
                chunkX,
                chunkY,
                chunkZ,
                positionBuffer: null,
                noiseMap // Still return the noise map
            });
        }
    } catch (error: any) {
        console.error('Error in isolated mesh worker:', error);
        // Return error state
        self.postMessage({
            chunkX: event.data.chunkX,
            chunkY: event.data.chunkY,
            chunkZ: event.data.chunkZ,
            positionBuffer: null,
            noiseMap: null,
            error: error.message || String(error)
        });
    }
}; 