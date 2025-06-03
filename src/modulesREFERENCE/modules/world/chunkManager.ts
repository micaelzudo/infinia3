import * as THREE from 'three';
import type { LoadedChunks, NoiseLayers, Seed } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes'; // Needed for PlanetCompositionInfo type
import { getChunkKey } from '../../utils_debug';
import { loadNoiseMap } from '../../storageUtils_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
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
            let chunkKey = getChunkKey(x, z);
            if (!(chunkKey in loadedChunks)) {
                loadedChunks[chunkKey] = { mesh: null, noiseMap: null }; // Placeholder
                logThrottled('chunk-request', 500, `⏳ Requesting chunk [${x}, ${z}]...`);

                const storedNoiseMap = loadNoiseMap(x, z);

                if (storedNoiseMap) {
                    eventThrottled('chunk-load-local', 500, `💾 Found stored NoiseMap for [${x}, ${z}], generating mesh locally.`);
                    try {
                        const vertices = generateMeshVertices(x, 0, z, { noiseMap: storedNoiseMap }, true);
                        const geometry = new THREE.BufferGeometry();
                        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                        geometry.computeVertexNormals();

                        const material = createUnifiedPlanetMaterial(
                            _PLANET_COMPOSITION_INFO.topElements
                        );
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.name = `chunk_${chunkKey}`;

                        // Check again if it wasn't unloaded while generating
                        if (loadedChunks[chunkKey] !== undefined) {
                            _scene.add(mesh);
                            eventThrottled('chunk-add-local', 500, `✅ Locally generated mesh for stored chunk [${x}, ${z}] added.`);
                            loadedChunks[chunkKey] = { mesh: mesh, noiseMap: storedNoiseMap };
                        } else {
                            eventThrottled('chunk-discard-local', 500, `❓ Chunk [${x}, ${z}] unloaded before local generation finished.`);
                            disposeNode(_scene, mesh);
                        }
                    } catch (error) {
                        console.error(`Error generating mesh locally for stored chunk [${x}, ${z}]:`, error);
                        // Clean up placeholder if generation failed
                        if (loadedChunks[chunkKey]?.mesh === null) delete loadedChunks[chunkKey];
                    }
                } else {
                    eventThrottled('chunk-request-worker', 500, `🌍 No stored NoiseMap for [${x}, ${z}], requesting from worker.`);
                    if (_workerPool.length > 0) {
                         workerIndex = workerIndex % _workerPool.length; // Ensure valid index
                        _workerPool[workerIndex].postMessage([x, z, _noiseLayers, _seed]);
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
        const [x, z] = chunkKey.split(',').map(Number);
        if (Math.abs(x - playerChunkX) > LOAD_CHUNK_RADIUS || Math.abs(z - playerChunkZ) > LOAD_CHUNK_RADIUS) {
            const chunkData = loadedChunks[chunkKey];
            if (chunkData && chunkData.mesh) { // Only dispose if mesh exists
                eventThrottled('chunk-unload', 500, `🗑️ Unloading chunk [${x}, ${z}]`);
                disposeNode(_scene, chunkData.mesh);
            }
             delete loadedChunks[chunkKey]; // Remove from map regardless of mesh state
        }
    }
} 