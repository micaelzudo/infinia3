import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';
import type { NoiseMap, NoiseLayers, Seed } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { planetTypes } from '../../terrainGenerationUtils/planettypes.js';

// SpacetimeDB imports
import { spacetimeConfig } from '../multiplayer/spacetimeConfig';
import type { TerrainChunk } from '../multiplayer/generated/types';

// Interface for terrain integration parameters
export interface TerrainSpacetimeIntegrationParams {
    planetType: string;
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale: number;
    planetOffset: THREE.Vector3;
    initialRadius?: number; // Default 10 for ~200 chunks
}

// Interface for chunk data to be stored
export interface ChunkDataForStorage {
    chunkKey: string;
    planetType: string;
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    noiseData: Float32Array;
}

/**
 * Generate chunk keys around a center point (0, 0, 0) for initial terrain
 */
function generateInitialChunkKeys(radius: number, planetType: string): string[] {
    const chunkKeys: string[] = [];
    for (let x = -radius; x <= radius; x++) {
        for (let y = -1; y <= 0; y++) { // Two vertical layers as per existing pattern
            for (let z = -radius; z <= radius; z++) {
                chunkKeys.push(`${x},${y},${z}_${planetType}`);
            }
        }
    }
    return chunkKeys;
}

/**
 * Generate noise data for a specific chunk
 */
function generateChunkNoiseData(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    noiseLayers: NoiseLayers,
    seed: Seed
): Float32Array {
    const noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
    
    // Flatten the 3D noise map into a 1D array for storage
    const flatData = new Float32Array((CHUNK_SIZE + 1) * (CHUNK_HEIGHT + 1) * (CHUNK_SIZE + 1));
    let index = 0;
    
    for (let y = 0; y <= CHUNK_HEIGHT; y++) {
        for (let z = 0; z <= CHUNK_SIZE; z++) {
            for (let x = 0; x <= CHUNK_SIZE; x++) {
                flatData[index++] = noiseMap[y][z][x];
            }
        }
    }
    
    return flatData;
}

/**
 * Convert flat noise data back to 3D NoiseMap structure
 */
export function reconstructNoiseMapFromFlat(flatData: Float32Array): NoiseMap {
    const noiseMap: NoiseMap = [];
    let index = 0;
    
    for (let y = 0; y <= CHUNK_HEIGHT; y++) {
        noiseMap[y] = [];
        for (let z = 0; z <= CHUNK_SIZE; z++) {
            noiseMap[y][z] = new Float32Array(CHUNK_SIZE + 1);
            for (let x = 0; x <= CHUNK_SIZE; x++) {
                noiseMap[y][z][x] = flatData[index++];
            }
        }
    }
    
    return noiseMap;
}

/**
 * Generate initial terrain chunks for a planet type
 */
export async function generateInitialTerrainChunks(
    params: TerrainSpacetimeIntegrationParams
): Promise<ChunkDataForStorage[]> {
    const { planetType, noiseLayers, seed, initialRadius = 10 } = params;
    
    console.log(`[TerrainSpacetime] Generating initial terrain chunks for planet type: ${planetType}`);
    console.log(`[TerrainSpacetime] Radius: ${initialRadius}, Expected chunks: ${(initialRadius * 2 + 1) ** 2 * 2}`);
    
    const chunks: ChunkDataForStorage[] = [];
    const chunkKeys = generateInitialChunkKeys(initialRadius, planetType);
    
    for (const chunkKey of chunkKeys) {
        const [coords, planetTypeFromKey] = chunkKey.split('_');
        const [x, y, z] = coords.split(',').map(Number);
        
        try {
            const noiseData = generateChunkNoiseData(x, y, z, noiseLayers, seed);
            
            chunks.push({
                chunkKey,
                planetType: planetTypeFromKey,
                chunkX: x,
                chunkY: y,
                chunkZ: z,
                noiseData
            });
            
            if (chunks.length % 50 === 0) {
                console.log(`[TerrainSpacetime] Generated ${chunks.length}/${chunkKeys.length} chunks...`);
            }
        } catch (error) {
            console.error(`[TerrainSpacetime] Failed to generate chunk ${chunkKey}:`, error);
        }
    }
    
    console.log(`[TerrainSpacetime] Generated ${chunks.length} terrain chunks successfully`);
    return chunks;
}

/**
 * Store terrain chunks in SpacetimeDB
 */
export async function storeTerrainChunksInSpacetimeDB(
    chunks: ChunkDataForStorage[]
): Promise<boolean> {
    try {
        console.log(`[TerrainSpacetime] Storing ${chunks.length} chunks in SpacetimeDB...`);
        
        // Connect to SpacetimeDB if not already connected
        if (!spacetimeConfig.isConnected()) {
            console.log('[TerrainSpacetime] Connecting to SpacetimeDB...');
            await spacetimeConfig.connect();
        }
        
        let successCount = 0;
        let failCount = 0;
        
        // Store chunks in batches to avoid overwhelming the server
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (chunk) => {
                try {
                    await spacetimeConfig.storeTerrainChunk(
                        chunk.chunkKey,
                        chunk.planetType,
                        chunk.chunkX,
                        chunk.chunkY,
                        chunk.chunkZ,
                        Array.from(chunk.noiseData) // Convert Float32Array to regular array
                    );
                    successCount++;
                } catch (error) {
                    console.error(`[TerrainSpacetime] Failed to store chunk ${chunk.chunkKey}:`, error);
                    failCount++;
                }
            });
            
            await Promise.all(batchPromises);
            
            console.log(`[TerrainSpacetime] Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);
            
            // Small delay between batches to prevent overwhelming the server
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`[TerrainSpacetime] Storage complete. Success: ${successCount}, Failed: ${failCount}`);
        return failCount === 0;
        
    } catch (error) {
        console.error('[TerrainSpacetime] Failed to store terrain chunks:', error);
        return false;
    }
}

/**
 * Retrieve initial chunks from SpacetimeDB for the isolated third person system
 */
export async function getInitialChunksFromSpacetimeDB(
    planetType: string,
    radius: number = 3 // Smaller radius for initial loading
): Promise<{ [key: string]: NoiseMap }> {
    try {
        console.log(`[TerrainSpacetime] Retrieving initial chunks for planet type: ${planetType}`);
        
        // Connect to SpacetimeDB if not already connected
        if (!spacetimeConfig.isConnected()) {
            console.log('[TerrainSpacetime] Connecting to SpacetimeDB...');
            await spacetimeConfig.connect();
        }
        
        const chunkKeys = generateInitialChunkKeys(radius, planetType);
        const loadedChunks: { [key: string]: NoiseMap } = {};
        
        // Get all terrain chunks from SpacetimeDB
        const allTerrainChunks = spacetimeConfig.getAllTerrainChunks();
        
        for (const chunkKey of chunkKeys) {
            const terrainChunk = allTerrainChunks.find(chunk => chunk.chunkKey === chunkKey);
            
            if (terrainChunk && terrainChunk.noiseData && terrainChunk.noiseData.length > 0) {
                // Convert the stored flat array back to NoiseMap structure
                const flatData = new Float32Array(terrainChunk.noiseData);
                const noiseMap = reconstructNoiseMapFromFlat(flatData);
                loadedChunks[chunkKey] = noiseMap;
                
                // Update last accessed time
                await spacetimeConfig.getTerrainChunk(chunkKey);
            } else {
                console.warn(`[TerrainSpacetime] Chunk ${chunkKey} not found in SpacetimeDB`);
            }
        }
        
        console.log(`[TerrainSpacetime] Retrieved ${Object.keys(loadedChunks).length}/${chunkKeys.length} chunks`);
        return loadedChunks;
        
    } catch (error) {
        console.error('[TerrainSpacetime] Failed to retrieve initial chunks:', error);
        return {};
    }
}

/**
 * Main integration function: Generate terrain, store in SpacetimeDB, then connect and sync
 */
export async function integrateTerrainWithSpacetimeDB(
    params: TerrainSpacetimeIntegrationParams
): Promise<{
    success: boolean;
    initialChunks: { [key: string]: NoiseMap };
    message: string;
}> {
    try {
        console.log('[TerrainSpacetime] Starting terrain integration with SpacetimeDB...');
        
        // Validate planet type
        if (!planetTypes[params.planetType]) {
            throw new Error(`Invalid planet type: ${params.planetType}`);
        }
        
        // Step 1: Generate initial terrain chunks
        console.log('[TerrainSpacetime] Step 1: Generating terrain chunks...');
        const chunks = await generateInitialTerrainChunks(params);
        
        if (chunks.length === 0) {
            throw new Error('Failed to generate any terrain chunks');
        }
        
        // Step 2: Store chunks in SpacetimeDB
        console.log('[TerrainSpacetime] Step 2: Storing chunks in SpacetimeDB...');
        const storeSuccess = await storeTerrainChunksInSpacetimeDB(chunks);
        
        if (!storeSuccess) {
            console.warn('[TerrainSpacetime] Some chunks failed to store, but continuing...');
        }
        
        // Step 3: Retrieve initial chunks for the third person system
        console.log('[TerrainSpacetime] Step 3: Retrieving initial chunks...');
        const initialChunks = await getInitialChunksFromSpacetimeDB(params.planetType, 3);
        
        // Step 4: Ensure SpacetimeDB connection for player sync
        console.log('[TerrainSpacetime] Step 4: Ensuring SpacetimeDB connection...');
        if (!spacetimeConfig.isConnected()) {
            await spacetimeConfig.connect();
        }
        
        const message = `Successfully integrated terrain with SpacetimeDB. Generated ${chunks.length} chunks, retrieved ${Object.keys(initialChunks).length} initial chunks.`;
        console.log(`[TerrainSpacetime] ${message}`);
        
        return {
            success: true,
            initialChunks,
            message
        };
        
    } catch (error) {
        const errorMessage = `Failed to integrate terrain with SpacetimeDB: ${error}`;
        console.error(`[TerrainSpacetime] ${errorMessage}`);
        
        return {
            success: false,
            initialChunks: {},
            message: errorMessage
        };
    }
}

/**
 * Store initial chunks for all planet types (utility function)
 */
export async function storeInitialChunksForAllPlanetTypes(
    noiseLayers: NoiseLayers,
    seed: Seed,
    compInfo: { topElements: TopElementsData | null },
    noiseScale: number = 1.0,
    planetOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    radius: number = 10
): Promise<void> {
    console.log('[TerrainSpacetime] Storing initial chunks for all planet types...');
    
    const planetTypeNames = Object.keys(planetTypes);
    let successCount = 0;
    let failCount = 0;
    
    for (const planetType of planetTypeNames) {
        try {
            console.log(`[TerrainSpacetime] Processing planet type: ${planetType}`);
            
            const result = await integrateTerrainWithSpacetimeDB({
                planetType,
                noiseLayers,
                seed,
                compInfo,
                noiseScale,
                planetOffset,
                initialRadius: radius
            });
            
            if (result.success) {
                successCount++;
                console.log(`[TerrainSpacetime] ✓ ${planetType}: ${result.message}`);
            } else {
                failCount++;
                console.error(`[TerrainSpacetime] ✗ ${planetType}: ${result.message}`);
            }
            
        } catch (error) {
            failCount++;
            console.error(`[TerrainSpacetime] ✗ ${planetType}: ${error}`);
        }
        
        // Small delay between planet types
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`[TerrainSpacetime] Completed storing chunks for all planet types. Success: ${successCount}, Failed: ${failCount}`);
}