// Isolated Third Person SpacetimeDB Terrain Integration

import { connect, storeTerrainChunk, getTerrainChunk, storeInitialChunksForPlanet, TerrainChunk } from './multiplayer/spacetimeConfig';
import { generateChunkKeysAroundZero } from './isolatedTerrainViewerSpacetimeActions';
import { generateNoiseMap } from './terrain/terrainGeneration';
import { NoiseMap } from './types_debug';
import { planetTypes } from './planettypes';

// Interface for terrain integration parameters
export interface TerrainIntegrationParams {
    planetType: string;
    radius: number;
    chunkSize: number;
    seed: number;
}

// Interface for chunk data storage
export interface ChunkDataForStorage {
    chunkKey: string;
    planetType: string;
    x: number;
    y: number;
    z: number;
    noiseMap: NoiseMap;
}

// Generate initial chunk keys around (0,0,0)
function generateInitialChunkKeys(planetType: string, radius: number): string[] {
    return generateChunkKeysAroundZero(radius, planetType);
}

// Generate noise data for a chunk
function generateChunkNoiseData(
    x: number, 
    y: number, 
    z: number, 
    planetType: string, 
    seed: number,
    chunkSize: number = 32
): NoiseMap {
    // Use the existing terrain generation system
    return generateNoiseMap(x, y, z, planetType, seed, chunkSize);
}

// Convert NoiseMap to flat array for storage
function flattenNoiseMap(noiseMap: NoiseMap): number[] {
    const flatData: number[] = [];
    
    // Flatten the 3D array [x][y][z] to 1D array
    for (let x = 0; x < noiseMap.length; x++) {
        for (let y = 0; y < noiseMap[x].length; y++) {
            for (let z = 0; z < noiseMap[x][y].length; z++) {
                flatData.push(noiseMap[x][y][z]);
            }
        }
    }
    
    return flatData;
}

// Reconstruct NoiseMap from flat array
function reconstructNoiseMap(flatData: number[], size: number = 32): NoiseMap {
    const noiseMap: NoiseMap = [];
    let index = 0;
    
    // Reconstruct the 3D array [x][y][z] from 1D array
    for (let x = 0; x < size; x++) {
        noiseMap[x] = [];
        for (let y = 0; y < size; y++) {
            noiseMap[x][y] = [];
            for (let z = 0; z < size; z++) {
                noiseMap[x][y][z] = flatData[index++] || 0;
            }
        }
    }
    
    return noiseMap;
}

// Generate and store initial terrain chunks for a planet type
export async function generateAndStoreInitialChunks(
    params: TerrainIntegrationParams
): Promise<Map<string, ChunkDataForStorage>> {
    const { planetType, radius, chunkSize, seed } = params;
    const chunkKeys = generateInitialChunkKeys(planetType, radius);
    const generatedChunks = new Map<string, ChunkDataForStorage>();
    
    console.log(`Generating ${chunkKeys.length} initial chunks for planet type: ${planetType}`);
    
    // Process chunks in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < chunkKeys.length; i += batchSize) {
        const batch = chunkKeys.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (chunkKey) => {
            // Parse chunk coordinates from key (format: "x_y_z_planetType")
            const parts = chunkKey.split('_');
            const x = parseInt(parts[0]);
            const y = parseInt(parts[1]);
            const z = parseInt(parts[2]);
            
            // Generate noise data for this chunk
            const noiseMap = generateChunkNoiseData(x, y, z, planetType, seed, chunkSize);
            const flatNoiseData = flattenNoiseMap(noiseMap);
            
            // Store chunk data locally
            generatedChunks.set(chunkKey, {
                chunkKey,
                planetType,
                x, y, z,
                noiseMap
            });
            
            // Store chunk in SpacetimeDB
            try {
                await storeTerrainChunk(
                    chunkKey,
                    planetType,
                    x, y, z,
                    flatNoiseData
                );
            } catch (error) {
                console.error(`Failed to store chunk ${chunkKey}:`, error);
                throw error;
            }
        }));
        
        console.log(`Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunkKeys.length / batchSize)}`);
    }
    
    console.log(`Successfully generated and stored ${generatedChunks.size} chunks for ${planetType}`);
    return generatedChunks;
}

// Retrieve initial chunks from SpacetimeDB
export async function retrieveInitialChunks(
    planetType: string,
    radius: number
): Promise<Map<string, ChunkDataForStorage>> {
    const chunkKeys = generateInitialChunkKeys(planetType, radius);
    const retrievedChunks = new Map<string, ChunkDataForStorage>();
    
    console.log(`Retrieving ${chunkKeys.length} chunks for planet type: ${planetType}`);
    
    // Process chunks in batches
    const batchSize = 10;
    for (let i = 0; i < chunkKeys.length; i += batchSize) {
        const batch = chunkKeys.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (chunkKey) => {
            // Retrieve chunk from SpacetimeDB
            try {
                const chunkData = await getTerrainChunk(chunkKey) as TerrainChunk;
                
                if (chunkData && chunkData.noise_data) {
                    const noiseMap = reconstructNoiseMap(chunkData.noise_data);
                    retrievedChunks.set(chunkKey, {
                        chunkKey,
                        planetType: chunkData.planet_type,
                        x: chunkData.x,
                        y: chunkData.y,
                        z: chunkData.z,
                        noiseMap
                    });
                }
            } catch (error) {
                console.warn(`Failed to retrieve chunk ${chunkKey}:`, error);
            }
        }));
    }
    
    console.log(`Successfully retrieved ${retrievedChunks.size} chunks for ${planetType}`);
    return retrievedChunks;
}

// Main integration function
export async function integrateTerrainWithSpacetimeDB(
    params: TerrainIntegrationParams
): Promise<{
    success: boolean;
    chunks: Map<string, ChunkDataForStorage>;
    connection: any;
}> {
    try {
        console.log('Starting terrain integration with SpacetimeDB...');
        
        // Step 1: Connect to SpacetimeDB
        console.log('Connecting to SpacetimeDB...');
        const connection = await connect();
        
        // Step 2: Try to retrieve existing chunks first
        console.log('Checking for existing chunks...');
        let chunks = await retrieveInitialChunks(params.planetType, params.radius);
        
        // Step 3: If no chunks exist, generate and store them
        if (chunks.size === 0) {
            console.log('No existing chunks found, generating new ones...');
            chunks = await generateAndStoreInitialChunks(params);
        } else {
            console.log(`Found ${chunks.size} existing chunks`);
        }
        
        console.log('Terrain integration completed successfully');
        return {
            success: true,
            chunks,
            connection
        };
        
    } catch (error) {
        console.error('Failed to integrate terrain with SpacetimeDB:', error);
        return {
            success: false,
            chunks: new Map(),
            connection: null
        };
    }
}

// Utility function to store initial chunks for all planet types
export async function storeInitialChunksForAllPlanetTypes(
    radius: number = 7, // ~200 chunks around (0,0,0)
    chunkSize: number = 32,
    seed: number = 12345
): Promise<void> {
    console.log('Storing initial chunks for all planet types...');
    
    // Connect to SpacetimeDB
    const connection = await connect();
    
    // Process each planet type
    for (const planetType of Object.keys(planetTypes)) {
        try {
            console.log(`Processing planet type: ${planetType}`);
            
            // Use the SpacetimeDB reducer to store initial chunks
            await storeInitialChunksForPlanet(planetType, radius);
            
            console.log(`Completed storing chunks for ${planetType}`);
        } catch (error) {
            console.error(`Failed to store chunks for ${planetType}:`, error);
        }
    }
    
    console.log('Completed storing initial chunks for all planet types');
}