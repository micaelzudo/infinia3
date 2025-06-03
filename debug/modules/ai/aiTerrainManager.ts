import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../types_debug';
import { getChunkKeyY } from '../../utils_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { initIsolatedWorkerPool, requestChunkGeometry, terminateIsolatedWorkerPool } from '../workers/isolatedWorkerPool';
import type { TopElementsData } from '../types/renderingTypes';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { getActiveChunkMeshesForCollision } from '../ui/isolatedTerrainViewer';
import { storageKeys } from '../../constants_debug';

// Exported state and functions for terrain management
export let aiLoadedChunks: LoadedChunks = {};
export let aiChunkMeshes: { [key: string]: THREE.Mesh } = {};
export let pendingRequests = new Set<string>();
export let workerInitialized = false;
export let genParams: {
    noiseLayers: NoiseLayers | null;
    seed: Seed | null;
    compInfo?: { topElements: TopElementsData | null } | null;
    noiseScale?: number | null;
    planetOffset?: THREE.Vector3 | null;
} = {
    noiseLayers: null,
    seed: null,
    compInfo: null,
    noiseScale: null,
    planetOffset: null
};

// AI chunk loading constants
export const AI_LOAD_CHECK_INTERVAL = 2000;
export const AI_LOAD_CHUNK_RADIUS = 3;
export const AI_VERTICAL_LOAD_RADIUS_BELOW = 2;
export const AI_VERTICAL_LOAD_RADIUS_ABOVE = 2;
export const AI_CHUNK_EVICTION_TIME = 30000;

// Last chunk load check time per agent
export const lastLoadCheckTime: { [key: string]: number } = {};

// Terrain management functions (ported from yukaController.ts)
// processTerrainChunk, handleAIWorkerResult, getAINeighborNoiseMap, generateAILocalMesh, manageAIChunks
// ... (Paste the full implementations from yukaController.ts, update imports as needed) 

export function processTerrainChunk(
    sceneRef: THREE.Scene,
    key: string,
    vertices: Float32Array,
    indices: Uint32Array,
    navMeshHelper?: any // Pass navMeshHelper if needed for markDirty
) {
    if (!sceneRef) return;
    pendingRequests.delete(key);
    try {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        
        // Ensure position attribute exists and has data
        if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error(`[aiTerrainManager] Invalid position attribute for chunk ${key}`);
            return;
        }
        
        // Compute normals if they don't exist
        if (!geometry.getAttribute('normal')) {
            geometry.computeVertexNormals();
        }
        
        // Verify normal attribute exists and has data
        if (!geometry.getAttribute('normal') || geometry.getAttribute('normal').count === 0) {
            console.error(`[aiTerrainManager] Failed to compute normals for chunk ${key}`);
            return;
        }

        const material = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            flatShading: true,
            side: THREE.DoubleSide,
            wireframe: sessionStorage.getItem(storageKeys.WIREFRAME) === 'true'
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `ai_terrain_${key}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        sceneRef.add(mesh);
        if (aiLoadedChunks[key]?.mesh && sceneRef) {
            sceneRef.remove(aiLoadedChunks[key].mesh);
            if (aiLoadedChunks[key].mesh.geometry) aiLoadedChunks[key].mesh.geometry.dispose();
            if (aiLoadedChunks[key].mesh.material) {
                if (Array.isArray(aiLoadedChunks[key].mesh.material)) {
                    aiLoadedChunks[key].mesh.material.forEach(m => m.dispose());
                } else {
                    aiLoadedChunks[key].mesh.material.dispose();
                }
            }
        }
        if (!aiLoadedChunks[key]) aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: 0 };
        aiLoadedChunks[key].mesh = mesh;
        aiChunkMeshes[key] = mesh;
        aiLoadedChunks[key].lastAccessTime = Date.now();
        if (navMeshHelper) navMeshHelper.markDirty();
    } catch (error) {
        console.error(`[aiTerrainManager] Error processing terrain chunk ${key}:`, error);
    }
}

export function handleAIWorkerResult(
    sceneRef: THREE.Scene,
    result: { chunkX: number, chunkY: number, chunkZ: number, payload: { positionBuffer: Float32Array | null, noiseMap: NoiseMap | null } },
    navMeshHelper?: any
) {
    const { chunkX, chunkY, chunkZ, payload } = result;
    const key = getChunkKeyY(chunkX, chunkY, chunkZ);
    pendingRequests.delete(key);
    if (!payload.noiseMap) return;
    if (!aiLoadedChunks[key]) aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: 0 };
    aiLoadedChunks[key].noiseMap = payload.noiseMap;
    aiLoadedChunks[key].lastAccessTime = Date.now();
    if (payload.positionBuffer && payload.positionBuffer.length > 0 && sceneRef && genParams.compInfo && genParams.noiseScale && genParams.planetOffset) {
        try {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
            
            // Ensure position attribute exists and has data
            if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
                console.error(`[aiTerrainManager] Invalid position attribute for chunk ${key}`);
                return;
            }
            
            // Compute normals if they don't exist
            if (!geometry.getAttribute('normal')) {
                geometry.computeVertexNormals();
            }
            
            // Verify normal attribute exists and has data
            if (!geometry.getAttribute('normal') || geometry.getAttribute('normal').count === 0) {
                console.error(`[aiTerrainManager] Failed to compute normals for chunk ${key}`);
                return;
            }

            const material = createUnifiedPlanetMaterial(
                genParams.compInfo.topElements,
                genParams.noiseScale,
                genParams.planetOffset
            );
            if (material.uniforms.u_showInternalMaterial) {
                material.uniforms.u_showInternalMaterial.value = false;
            }
            material.side = THREE.DoubleSide;

            // Apply wireframe based on session storage
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
                 material.wireframe = sessionStorage.getItem(storageKeys.WIREFRAME) === 'true';
            }

            const newMesh = new THREE.Mesh(geometry, material);
            newMesh.name = `ai_chunk_${key}`;
            newMesh.renderOrder = 1;
            if (aiLoadedChunks[key]?.mesh && sceneRef) {
                const oldMesh = aiLoadedChunks[key].mesh;
                if (oldMesh && oldMesh.parent) oldMesh.parent.remove(oldMesh);
                if (oldMesh?.geometry) oldMesh.geometry.dispose();
            }
            sceneRef.add(newMesh);
            aiLoadedChunks[key].mesh = newMesh;
            aiChunkMeshes[key] = newMesh;
            aiLoadedChunks[key].lastAccessTime = Date.now();
        } catch (error) {
            console.error(`[aiTerrainManager] Error creating mesh for ${key} from worker geometry:`, error);
        }
    } else if (payload.noiseMap) {
        generateAILocalMesh(sceneRef, chunkX, chunkY, chunkZ, navMeshHelper);
    }
}

export function getAINeighborNoiseMap(targetChunkX: number, targetChunkY: number, targetChunkZ: number): NoiseMap | null {
    const key = getChunkKeyY(targetChunkX, targetChunkY, targetChunkZ);
    if (aiLoadedChunks[key]?.noiseMap) {
        aiLoadedChunks[key].lastAccessTime = Date.now();
        return aiLoadedChunks[key].noiseMap;
    }
    if (!pendingRequests.has(key) && genParams.noiseLayers && genParams.seed !== null) {
        try {
            const newNoiseMap = generateNoiseMap(targetChunkX, targetChunkY, targetChunkZ, genParams.noiseLayers, genParams.seed);
            if (newNoiseMap) {
                if (!aiLoadedChunks[key]) aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: 0 };
                aiLoadedChunks[key].noiseMap = newNoiseMap;
                aiLoadedChunks[key].lastAccessTime = Date.now();
                return newNoiseMap;
            }
        } catch (e) {
            console.error(`[aiTerrainManager] Error generating sync noise map for ${key}:`, e);
        }
    }
    return null;
}

export function generateAILocalMesh(
    sceneRef: THREE.Scene,
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    navMeshHelper?: any
) {
    const key = getChunkKeyY(chunkX, chunkY, chunkZ);
    if (!sceneRef || !genParams.compInfo || genParams.noiseScale === null || genParams.planetOffset === null || genParams.noiseLayers === null || genParams.seed === null) {
        return;
    }
    const centralNoiseMap = aiLoadedChunks[key]?.noiseMap;
    if (!centralNoiseMap) {
        if (!pendingRequests.has(key)) {
            requestChunkGeometry(chunkX, chunkY, chunkZ, genParams.noiseLayers, genParams.seed, 0);
            pendingRequests.add(key);
        }
        return;
    }
    const noiseMapBelow = getAINeighborNoiseMap(chunkX, chunkY - 1, chunkZ);
    const noiseMapAbove = getAINeighborNoiseMap(chunkX, chunkY + 1, chunkZ);
    const noiseMapXNeg = getAINeighborNoiseMap(chunkX - 1, chunkY, chunkZ);
    const noiseMapXPos = getAINeighborNoiseMap(chunkX + 1, chunkY, chunkZ);
    const noiseMapZNeg = getAINeighborNoiseMap(chunkX, chunkY, chunkZ - 1);
    const noiseMapZPos = getAINeighborNoiseMap(chunkX, chunkY, chunkZ + 1);
    const neighborFlags = {
        neighborXPosExists: !!noiseMapXPos,
        neighborXNegExists: !!noiseMapXNeg,
        neighborYPosExists: !!noiseMapAbove,
        neighborYNegExists: !!noiseMapBelow,
        neighborZPosExists: !!noiseMapZPos,
        neighborZNegExists: !!noiseMapZNeg,
    };
    try {
        const geometry = generateMeshVertices(
            chunkX, chunkY, chunkZ,
            { noiseMap: centralNoiseMap },
            false,
            noiseMapBelow, noiseMapAbove, noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
            neighborFlags
        );
        if (!geometry || !(geometry instanceof THREE.BufferGeometry) || !geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error(`[aiTerrainManager] Invalid geometry generated for chunk ${key}`);
            return;
        }
        
        // Ensure position attribute exists and has data
        if (!geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error(`[aiTerrainManager] Invalid position attribute for chunk ${key}`);
            return;
        }
        
        // Compute normals if they don't exist
        if (!geometry.getAttribute('normal')) {
            geometry.computeVertexNormals();
        }
        
        // Verify normal attribute exists and has data
        if (!geometry.getAttribute('normal') || geometry.getAttribute('normal').count === 0) {
            console.error(`[aiTerrainManager] Failed to compute normals for chunk ${key}`);
            return;
        }

        const material = createUnifiedPlanetMaterial(
            genParams.compInfo.topElements,
            genParams.noiseScale,
            genParams.planetOffset
        );
        if (material.uniforms.u_showInternalMaterial) {
            material.uniforms.u_showInternalMaterial.value = false;
        }
        material.side = THREE.DoubleSide;

        // Apply wireframe based on session storage
        if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
             material.wireframe = sessionStorage.getItem(storageKeys.WIREFRAME) === 'true';
        }

        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = `ai_chunk_${key}`;
        newMesh.renderOrder = 1;
        if (aiLoadedChunks[key]?.mesh && sceneRef) {
            const oldMesh = aiLoadedChunks[key].mesh;
            if (oldMesh && oldMesh.parent) oldMesh.parent.remove(oldMesh);
            if (oldMesh?.geometry) oldMesh.geometry.dispose();
        }
        sceneRef.add(newMesh);
        if (!aiLoadedChunks[key]) aiLoadedChunks[key] = { noiseMap: centralNoiseMap, mesh: null, lastAccessTime: 0};
        aiLoadedChunks[key].mesh = newMesh;
        aiLoadedChunks[key].lastAccessTime = Date.now();
        aiChunkMeshes[key] = newMesh;
    } catch (error) {
        console.error(`[aiTerrainManager] Error generating mesh for ${key}:`, error);
    }
}

export function manageAIChunks(
    agent: any, // IsolatedYukaCharacter
    sceneRef: THREE.Scene
) {
    if (!genParams.noiseLayers || genParams.seed === null) return;
    
    // Get the existing chunks from IsolatedTerrainViewer
    const existingChunks = getActiveChunkMeshesForCollision();
    if (!existingChunks) {
        console.warn('[aiTerrainManager] No chunks available from IsolatedTerrainViewer');
        return;
    }

    // Log the number of chunks we're syncing with
    console.log(`[aiTerrainManager] Syncing with ${Object.keys(existingChunks).length} chunks from IsolatedTerrainViewer`);

    // Update our aiLoadedChunks to match ALL existing chunks
    for (const key in existingChunks) {
        const existingMesh = existingChunks[key];
        if (existingMesh) {
            // Always update to match the existing chunks
            if (!aiLoadedChunks[key]) {
                aiLoadedChunks[key] = { noiseMap: null, mesh: null, lastAccessTime: Date.now() };
            }
            aiLoadedChunks[key].mesh = existingMesh;
            aiLoadedChunks[key].lastAccessTime = Date.now();
            aiChunkMeshes[key] = existingMesh;

            // Ensure wireframe state is applied when syncing meshes
            if (existingMesh.material) {
                 const wireframeEnabled = sessionStorage.getItem(storageKeys.WIREFRAME) === 'true';
                 if (Array.isArray(existingMesh.material)) {
                     existingMesh.material.forEach(mat => {
                         if (mat && (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshBasicMaterial)) {
                             mat.wireframe = wireframeEnabled;
                         }
                     });
                 } else if (existingMesh.material instanceof THREE.MeshStandardMaterial || existingMesh.material instanceof THREE.MeshBasicMaterial) {
                     existingMesh.material.wireframe = wireframeEnabled;
                 }
             }
        }
    }

    // Clean up any chunks we have that don't exist in the main viewer
    for (const key in aiLoadedChunks) {
        if (!existingChunks[key]) {
            delete aiLoadedChunks[key];
            if (aiChunkMeshes[key]) delete aiChunkMeshes[key];
        }
    }

    // Log the final state
    console.log(`[aiTerrainManager] Now tracking ${Object.keys(aiLoadedChunks).length} chunks`);
}

export function getAILoadedChunkKeys(): string[] {
    return Object.keys(aiLoadedChunks);
} 