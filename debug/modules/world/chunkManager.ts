import * as THREE from 'three';
import type { LoadedChunks, NoiseLayers, Seed } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes'; // Needed for PlanetCompositionInfo type
import { getChunkKeyY } from '../../utils_debug';
import { loadNoiseMap } from '../../storageUtils_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { disposeNode } from '../../disposeNode_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { logThrottled, eventThrottled } from '../../logThrottler';
import Worker from "web-worker"; // Import Worker type

// --- Constants --- 
export const LOAD_CHUNK_RADIUS = 2;

// --- Module State --- 
let _scene: THREE.Scene | null = null;
let _PLANET_COMPOSITION_INFO: { topElements: TopElementsData | null } | null = null; 
let _workerPool: Worker[] = [];
let _noiseLayers: NoiseLayers | null = null;
let _seed: string | null = null;
let _initialized = false;

// Interface for PlanetCompositionInfo structure expected
interface PlanetCompositionInfo {
    dominantElement: string | null;
    topElements: TopElementsData | null;
}

export function initChunkManager(
    scene: THREE.Scene,
    compInfo: PlanetCompositionInfo,
    workers: Worker[],
    layers: NoiseLayers,
    seedValue: string
) {
    _scene = scene;
    _PLANET_COMPOSITION_INFO = compInfo; // Store the whole structure
    _workerPool = workers;
    _noiseLayers = layers;
    _seed = seedValue;
    _initialized = true;
    console.log("Chunk Manager Initialized");
}

// Helper to fetch or generate a neighbor noise map and store in loadedChunks if missing
function getOrGenNeighborMap(
    loadedChunks: LoadedChunks,
    nX: number,
    nY: number,
    nZ: number,
    noiseLayers: NoiseLayers,
    seed: string
): Float32Array[][] | null {
    const nKey = getChunkKeyY(nX, nY, nZ);
    if (loadedChunks[nKey]?.noiseMap) {
        return loadedChunks[nKey].noiseMap;
    } else {
        const generatedMap = generateNoiseMap(nX, nY, nZ, noiseLayers, Number(seed));
        if (!loadedChunks[nKey]) {
            loadedChunks[nKey] = { noiseMap: null, mesh: null };
        }
        loadedChunks[nKey].noiseMap = generatedMap;
        return generatedMap;
    }
}

export function updateChunks(
    playerChunkX: number,
    playerChunkZ: number,
    loadedChunks: LoadedChunks // Pass loadedChunks map in, modify it directly
) {
    if (!_initialized || !_scene || !_PLANET_COMPOSITION_INFO || !_noiseLayers || !_seed) {
        console.error("Chunk Manager not initialized!");
        return;
    }

    // --- Chunk Loading ---
    let workerIndex = 0;
    for (let z = playerChunkZ - LOAD_CHUNK_RADIUS; z <= playerChunkZ + LOAD_CHUNK_RADIUS; z++) {
        for (let x = playerChunkX - LOAD_CHUNK_RADIUS; x <= playerChunkX + LOAD_CHUNK_RADIUS; x++) {
            let chunkKey = getChunkKeyY(x, 0, z);
            if (!(chunkKey in loadedChunks)) {
                loadedChunks[chunkKey] = { mesh: null, noiseMap: null }; // Placeholder
                logThrottled('chunk-request', 500, `⏳ Requesting chunk [${x}, 0, ${z}]...`);

                const storedNoiseMap = loadNoiseMap(x, z);

                if (storedNoiseMap) {
                    eventThrottled('chunk-load-local', 500, `💾 Found stored NoiseMap for [${x}, 0, ${z}], generating mesh locally.`);
                    try {
                        // --- Neighbor Noise Maps (Horizontal Only) ---
                        const noiseMapXNeg  = getOrGenNeighborMap(loadedChunks, x - 1, 0, z, _noiseLayers, _seed);
                        const noiseMapXPos  = getOrGenNeighborMap(loadedChunks, x + 1, 0, z, _noiseLayers, _seed);
                        const noiseMapZNeg  = getOrGenNeighborMap(loadedChunks, x, 0, z - 1, _noiseLayers, _seed);
                        const noiseMapZPos  = getOrGenNeighborMap(loadedChunks, x, 0, z + 1, _noiseLayers, _seed);

                        // --- Diagnostic Logging: Compare boundaries with neighbors ---
                        if (storedNoiseMap && noiseMapXPos) {
                            for (let y = 0; y < storedNoiseMap.length; y++) {
                                for (let zIdx = 0; zIdx < storedNoiseMap[0].length; zIdx++) {
                                    const rightEdge = storedNoiseMap[y][zIdx][storedNoiseMap[0][0].length-1];
                                    const leftEdgeNeighbor = noiseMapXPos[y][zIdx][0];
                                    if (rightEdge !== leftEdgeNeighbor) {
                                        console.warn(`[DIAG] X boundary mismatch: chunk [${x},${y},${zIdx}] right edge != neighbor [${x+1},${y},${zIdx}] left edge`, rightEdge, leftEdgeNeighbor);
                                    }
                                }
                            }
                        }
                        if (storedNoiseMap && noiseMapXNeg) {
                            for (let y = 0; y < storedNoiseMap.length; y++) {
                                for (let zIdx = 0; zIdx < storedNoiseMap[0].length; zIdx++) {
                                    const leftEdge = storedNoiseMap[y][zIdx][0];
                                    const rightEdgeNeighbor = noiseMapXNeg[y][zIdx][noiseMapXNeg[0][0].length-1];
                                    if (leftEdge !== rightEdgeNeighbor) {
                                        console.warn(`[DIAG] X- boundary mismatch: chunk [${x},${y},${zIdx}] left edge != neighbor [${x-1},${y},${zIdx}] right edge`, leftEdge, rightEdgeNeighbor);
                                    }
                                }
                            }
                        }
                        if (storedNoiseMap && noiseMapZPos) {
                            for (let y = 0; y < storedNoiseMap.length; y++) {
                                for (let xIdx = 0; xIdx < storedNoiseMap[0][0].length; xIdx++) {
                                    const frontEdge = storedNoiseMap[y][storedNoiseMap[0].length-1][xIdx];
                                    const backEdgeNeighbor = noiseMapZPos[y][0][xIdx];
                                    if (frontEdge !== backEdgeNeighbor) {
                                        console.warn(`[DIAG] Z boundary mismatch: chunk [${x},${y},${xIdx}] front edge != neighbor [${x},${y},${z+1}] back edge`, frontEdge, backEdgeNeighbor);
                                    }
                                }
                            }
                        }
                        if (storedNoiseMap && noiseMapZNeg) {
                            for (let y = 0; y < storedNoiseMap.length; y++) {
                                for (let xIdx = 0; xIdx < storedNoiseMap[0][0].length; xIdx++) {
                                    const backEdge = storedNoiseMap[y][0][xIdx];
                                    const frontEdgeNeighbor = noiseMapZNeg[y][noiseMapZNeg[0].length-1][xIdx];
                                    if (backEdge !== frontEdgeNeighbor) {
                                        console.warn(`[DIAG] Z- boundary mismatch: chunk [${x},${y},${xIdx}] back edge != neighbor [${x},${y},${z-1}] front edge`, backEdge, frontEdgeNeighbor);
                                    }
                                }
                            }
                        }

                        // --- Generate Mesh with Neighbors (Horizontal Only) ---
                        const neighborXPosExists = !!loadedChunks[getChunkKeyY(x + 1, 0, z)];
                        const neighborZPosExists = !!loadedChunks[getChunkKeyY(x, 0, z + 1)];
                        const neighborXNegExists = !!loadedChunks[getChunkKeyY(x - 1, 0, z)];
                        const neighborZNegExists = !!loadedChunks[getChunkKeyY(x, 0, z - 1)];

                        // Pass playerEditMask if present in loadedChunks
                        const playerEditMask = loadedChunks[chunkKey]?.playerEditMask;
                        const playerEditMaskXNeg  = loadedChunks[getChunkKeyY(x - 1, 0, z)]?.playerEditMask || null;
                        const playerEditMaskXPos  = loadedChunks[getChunkKeyY(x + 1, 0, z)]?.playerEditMask || null;
                        const playerEditMaskZNeg  = loadedChunks[getChunkKeyY(x, 0, z - 1)]?.playerEditMask || null;
                        const playerEditMaskZPos  = loadedChunks[getChunkKeyY(x, 0, z + 1)]?.playerEditMask || null;
                        const geometry = generateMeshVertices(
                            x, 0, z,
                            { noiseMap: storedNoiseMap },
                            undefined, // interpolate
                            null, null, // Pass null for noiseMapBelow, noiseMapAbove
                            noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
                            {
                                neighborXPosExists,
                                neighborZPosExists,
                                neighborXNegExists,
                                neighborZNegExists,
                                playerEditMaskXNeg,
                                playerEditMaskXPos,
                                playerEditMaskZNeg,
                                playerEditMaskZPos,
                            },
                            playerEditMask // << Pass the mask for the current chunk
                        );
                        geometry.computeVertexNormals?.();
                        const material = createUnifiedPlanetMaterial(
                            _PLANET_COMPOSITION_INFO.topElements
                        );
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.name = `chunk_${chunkKey}`;

                        // Check again if it wasn't unloaded while generating
                        if (loadedChunks[chunkKey] !== undefined) {
                            _scene.add(mesh);
                            eventThrottled('chunk-add-local', 500, `✅ Locally generated mesh for stored chunk [${x}, 0, ${z}] added.`);
                            loadedChunks[chunkKey] = { mesh: mesh, noiseMap: storedNoiseMap };
                        } else {
                            eventThrottled('chunk-discard-local', 500, `❓ Chunk [${x}, 0, ${z}] unloaded before local generation finished.`);
                            disposeNode(_scene, mesh);
                        }
                    } catch (error) {
                        console.error(`Error generating mesh locally for stored chunk [${x}, 0, ${z}]:`, error);
                        // Clean up placeholder if generation failed
                        if (loadedChunks[chunkKey]?.mesh === null) delete loadedChunks[chunkKey];
                    }
                } else {
                    eventThrottled('chunk-request-worker', 500, `🌍 No stored NoiseMap for [${x}, 0, ${z}], requesting from worker.`);
                    if (_workerPool.length > 0) {
                        // --- Prepare data for the worker --- 
                        // 1. Generate the main noise map
                        const mainNoiseMap = generateNoiseMap(x, 0, z, _noiseLayers, Number(_seed));
                        if (!mainNoiseMap) {
                            console.error(`Failed to generate main noise map for worker request [${x}, 0, ${z}]`);
                            delete loadedChunks[chunkKey]; // Remove placeholder
                            continue; // Skip this chunk
                        }
                        // Store the generated noise map immediately
                        loadedChunks[chunkKey].noiseMap = mainNoiseMap;

                        // 2. Get horizontal neighbor noise maps
                        const neighborsData = {
                            xNeg: getOrGenNeighborMap(loadedChunks, x - 1, 0, z, _noiseLayers!, _seed!),
                            xPos: getOrGenNeighborMap(loadedChunks, x + 1, 0, z, _noiseLayers!, _seed!),
                            zNeg: getOrGenNeighborMap(loadedChunks, x, 0, z - 1, _noiseLayers!, _seed!),
                            zPos: getOrGenNeighborMap(loadedChunks, x, 0, z + 1, _noiseLayers!, _seed!)
                        };

                        // 3. Determine horizontal neighbor flags
                        const flags = {
                            neighborXNegExists: !!neighborsData.xNeg,
                            neighborXPosExists: !!neighborsData.xPos,
                            neighborZNegExists: !!neighborsData.zNeg,
                            neighborZPosExists: !!neighborsData.zPos
                        };

                        // 4. Get horizontal neighbor edit masks
                        const editMasks = {
                            xNeg: loadedChunks[getChunkKeyY(x - 1, 0, z)]?.playerEditMask || null,
                            xPos: loadedChunks[getChunkKeyY(x + 1, 0, z)]?.playerEditMask || null,
                            zNeg: loadedChunks[getChunkKeyY(x, 0, z - 1)]?.playerEditMask || null,
                            zPos: loadedChunks[getChunkKeyY(x, 0, z + 1)]?.playerEditMask || null
                        };
                        
                        // 5. Get current chunk's edit mask
                        const currentEditMask = loadedChunks[chunkKey]?.playerEditMask || null;

                        // 6. Construct the message object
                        const workerMessage = {
                            chunkX: x,
                            chunkY: 0,
                            chunkZ: z,
                            noiseMap: mainNoiseMap,
                            neighbors: neighborsData,
                            interpolate: true, // Assuming true, adjust if needed
                            neighborFlags: flags,
                            playerEditMask: currentEditMask,
                            neighborEditMasks: editMasks
                        };

                         workerIndex = workerIndex % _workerPool.length; // Ensure valid index
                        _workerPool[workerIndex].postMessage(workerMessage); // Send the object
                        workerIndex++;
                    } else {
                        console.warn("No workers available to request chunk!");
                         delete loadedChunks[chunkKey]; // Remove placeholder if no worker
                    }
                }
            }
        }
    }

    // --- Chunk Unloading ---
    for (let chunkKey in loadedChunks) {
        const [xStr, yStr, zStr] = chunkKey.split(','); 
        const x = Number(xStr);
        const y = Number(yStr);
        const z = Number(zStr);

        if (Math.abs(x - playerChunkX) > LOAD_CHUNK_RADIUS || Math.abs(z - playerChunkZ) > LOAD_CHUNK_RADIUS) {
            const chunkData = loadedChunks[chunkKey];
            if (chunkData && chunkData.mesh) { // Only dispose if mesh exists
                eventThrottled('chunk-unload', 500, `🗑️ Unloading chunk [${x}, ${y}, ${z}]`);
                disposeNode(_scene, chunkData.mesh);
            }
             delete loadedChunks[chunkKey]; // Remove from map regardless of mesh state
        }
    }
} 
