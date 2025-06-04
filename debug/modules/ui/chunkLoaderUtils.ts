import * as THREE from 'three';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { disposeNode } from '../../disposeNode_debug';
import { getChunkKeyY } from '../../utils_debug';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';

/**
 * Loads and unloads chunks around the player, generates meshes, and requests worker jobs as needed.
 * @param playerPosition Player's THREE.Vector3 position
 * @param opts All state/config needed for chunk management
 */
let hasDoneInitialLoad = false;

export function loadChunksAroundPlayer(
  playerPosition: THREE.Vector3,
  opts: {
    tpLoadedChunks: any,
    tpChunkMeshes: any,
    tpPendingRequests: Set<string>,
    tpNoiseLayers: any,
    tpSeed: any,
    tpCompInfo: any,
    tpNoiseScale: number,
    tpPlanetOffset: THREE.Vector3,
    TP_LOAD_CHUNK_RADIUS: number,
    TP_VERTICAL_LOAD_RADIUS_BELOW: number,
    TP_VERTICAL_LOAD_RADIUS_ABOVE: number,
    MAX_CHUNK_GEN_PER_FRAME: number,
    requestChunkGeometry: Function,
    sceneRef: THREE.Scene,
    generateLocalMesh: Function,
    addStandardChunkBoundaries: Function,
  }
) {
  const {
    tpLoadedChunks,
    tpChunkMeshes,
    tpPendingRequests,
    tpNoiseLayers,
    tpSeed,
    tpCompInfo,
    tpNoiseScale,
    tpPlanetOffset,
    TP_LOAD_CHUNK_RADIUS,
    TP_VERTICAL_LOAD_RADIUS_BELOW,
    TP_VERTICAL_LOAD_RADIUS_ABOVE,
    MAX_CHUNK_GEN_PER_FRAME,
    requestChunkGeometry,
    sceneRef,
    generateLocalMesh,
    addStandardChunkBoundaries,
  } = opts;

  const charChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
  const charChunkY = Math.floor(playerPosition.y / CHUNK_HEIGHT);
  const charChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);

  const chunksToConsiderProcessing: {x:number, y:number, z:number}[] = [];
  for (let dy = -TP_VERTICAL_LOAD_RADIUS_BELOW; dy <= TP_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
    for (let dx = -TP_LOAD_CHUNK_RADIUS; dx <= TP_LOAD_CHUNK_RADIUS; dx++) {
      for (let dz = -TP_LOAD_CHUNK_RADIUS; dz <= TP_LOAD_CHUNK_RADIUS; dz++) {
        const loadX = charChunkX + dx;
        const loadY = charChunkY + dy;
        const loadZ = charChunkZ + dz;
        const chunkKey = getChunkKeyY(loadX, loadY, loadZ);
        if (!tpChunkMeshes[chunkKey] && !tpPendingRequests.has(chunkKey)) {
          chunksToConsiderProcessing.push({x: loadX, y: loadY, z: loadZ});
        } else if (tpLoadedChunks[chunkKey]) {
          tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
        }
      }
    }
  }
  chunksToConsiderProcessing.sort((a, b) => {
    const distA = Math.abs(a.x - charChunkX) + Math.abs(a.y - charChunkY) + Math.abs(a.z - charChunkZ);
    const distB = Math.abs(b.x - charChunkX) + Math.abs(b.y - charChunkY) + Math.abs(b.z - charChunkZ);
    return distA - distB;
  });
  let processedThisFrame = 0;
  for (const {x, y, z} of chunksToConsiderProcessing) {
    if (processedThisFrame >= MAX_CHUNK_GEN_PER_FRAME) break;
    const chunkKey = getChunkKeyY(x, y, z);
    if (tpChunkMeshes[chunkKey] || tpPendingRequests.has(chunkKey)) continue;
    let chunkData = tpLoadedChunks[chunkKey];
    if (!chunkData) {
      tpLoadedChunks[chunkKey] = { noiseMap: null, mesh: null, lastAccessTime: Date.now() };
      chunkData = tpLoadedChunks[chunkKey];
    }
    if (!chunkData.noiseMap) {
      if (tpNoiseLayers && tpSeed) {
        if (requestChunkGeometry(x, y, z, tpNoiseLayers, tpSeed)) {
          tpPendingRequests.add(chunkKey);
          processedThisFrame++;
        } else {
          if (tpLoadedChunks[chunkKey] && !tpLoadedChunks[chunkKey].noiseMap && !tpLoadedChunks[chunkKey].mesh) {
            delete tpLoadedChunks[chunkKey];
          }
        }
      }
    } else {
      if (generateLocalMesh(x, y, z)) {
        processedThisFrame++;
      }
    }
  }
  // Unload chunks out of range
  if (hasDoneInitialLoad) {
    const keepKeys = new Set();
    for (let dy = -TP_VERTICAL_LOAD_RADIUS_BELOW; dy <= TP_VERTICAL_LOAD_RADIUS_ABOVE; dy++) {
      for (let dx = -TP_LOAD_CHUNK_RADIUS; dx <= TP_LOAD_CHUNK_RADIUS; dx++) {
        for (let dz = -TP_LOAD_CHUNK_RADIUS; dz <= TP_LOAD_CHUNK_RADIUS; dz++) {
          keepKeys.add(getChunkKeyY(charChunkX + dx, charChunkY + dy, charChunkZ + dz));
        }
      }
    }
    for (const key in tpChunkMeshes) {
      if (!keepKeys.has(key)) {
        if (tpChunkMeshes[key]) {
          disposeNode(sceneRef, tpChunkMeshes[key]);
        }
        delete tpChunkMeshes[key];
        delete tpLoadedChunks[key];
      }
    }
  } else {
    hasDoneInitialLoad = true;
  }
  if (sceneRef && processedThisFrame > 0) {
    addStandardChunkBoundaries(sceneRef, Object.keys(tpLoadedChunks));
  }
}

/**
 * Handles worker results for chunk geometry and noise maps.
 * @param data Worker result object
 * @param opts All state/config needed for chunk management
 */
export function handleWorkerResult(
  data: any,
  opts: {
    tpLoadedChunks: any,
    tpChunkMeshes: any,
    tpPendingRequests: Set<string>,
    tpCompInfo: any,
    tpNoiseScale: number,
    tpPlanetOffset: THREE.Vector3,
    sceneRef: THREE.Scene,
    generateLocalMesh: Function,
  }
) {
  const { chunkX, chunkY, chunkZ, payload } = data;
  const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
  opts.tpPendingRequests.delete(chunkKey);
  if (!opts.tpLoadedChunks[chunkKey]) {
    opts.tpLoadedChunks[chunkKey] = { mesh: null, noiseMap: null, lastAccessTime: Date.now() };
  }
  opts.tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
  if (payload.noiseMap) {
    opts.tpLoadedChunks[chunkKey].noiseMap = payload.noiseMap;
  }
  if (payload.positionBuffer && opts.sceneRef) {
    try {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(payload.positionBuffer, 3));
      geometry.computeVertexNormals();
      const material = createUnifiedPlanetMaterial(
        opts.tpCompInfo.topElements,
        opts.tpNoiseScale,
        opts.tpPlanetOffset
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `tp_chunk_${chunkKey}`;
      opts.tpLoadedChunks[chunkKey].mesh = mesh;
      opts.tpChunkMeshes[chunkKey] = mesh;
      opts.sceneRef.add(mesh);
      
      // Check if character needs repositioning on terrain
      if ((window as any).tpCharacterRef && !((window as any).tpCharacterPositioned)) {
        const characterRef = (window as any).tpCharacterRef;
        const charChunkX = Math.floor(characterRef.position.x / 32); // CHUNK_SIZE
        const charChunkZ = Math.floor(characterRef.position.z / 32); // CHUNK_SIZE
        
        // If this chunk is near the character spawn position, try to reposition
        if (Math.abs(chunkX - charChunkX) <= 1 && Math.abs(chunkZ - charChunkZ) <= 1) {
          // Import the terrain height function
          import('./isolatedThirdPerson_copy').then(module => {
            if (module.findTerrainHeightAtPosition) {
              const terrainHeight = module.findTerrainHeightAtPosition(characterRef.position.x, characterRef.position.z, opts.tpChunkMeshes);
              if (terrainHeight !== null) {
                characterRef.position.y = terrainHeight + 2;
                (window as any).tpCharacterPositioned = true;
                console.log(`[TP Chunk Load] Repositioned character to terrain height: ${terrainHeight + 2}`);
              }
            }
          }).catch(err => console.warn('[TP Chunk Load] Could not import terrain height function:', err));
        }
      }
      
      return;
    } catch (e) {
      // fallback to local mesh gen
    }
  }
  if (opts.tpLoadedChunks[chunkKey] && !opts.tpLoadedChunks[chunkKey].mesh && opts.tpLoadedChunks[chunkKey].noiseMap && opts.sceneRef) {
    opts.generateLocalMesh(chunkX, chunkY, chunkZ);
  }
}

/**
 * Generates a mesh for a chunk, including neighbor noise map access.
 * @param cx Chunk X
 * @param cy Chunk Y
 * @param cz Chunk Z
 * @param opts All state/config needed for mesh generation
 */
export function generateLocalMesh(
  cx: number,
  cy: number,
  cz: number,
  opts: {
    tpLoadedChunks: any,
    tpChunkMeshes: any,
    tpNoiseLayers: any,
    tpSeed: any,
    tpCompInfo: any,
    tpNoiseScale: number,
    tpPlanetOffset: THREE.Vector3,
    sceneRef: THREE.Scene,
  }
) {
  const chunkKey = getChunkKeyY(cx, cy, cz);
  const currentChunkData = opts.tpLoadedChunks[chunkKey];
  const noiseMapToUse = currentChunkData?.noiseMap;
  if (!noiseMapToUse) return false;
  function getNeighborNoiseMap(nx: number, ny: number, nz: number) {
    const neighborKey = getChunkKeyY(nx, ny, nz);
    if (opts.tpLoadedChunks[neighborKey]?.noiseMap) {
      return opts.tpLoadedChunks[neighborKey].noiseMap;
    }
    const generatedMap = generateNoiseMap(nx, ny, nz, opts.tpNoiseLayers, opts.tpSeed);
    if (!opts.tpLoadedChunks[neighborKey]) {
      opts.tpLoadedChunks[neighborKey] = { noiseMap: null, mesh: null, lastAccessTime: Date.now() };
    }
    opts.tpLoadedChunks[neighborKey].noiseMap = generatedMap;
    opts.tpLoadedChunks[neighborKey].lastAccessTime = Date.now();
    return generatedMap;
  }
  const noiseMapXNeg = getNeighborNoiseMap(cx - 1, cy, cz);
  const noiseMapXPos = getNeighborNoiseMap(cx + 1, cy, cz);
  const noiseMapZNeg = getNeighborNoiseMap(cx, cy, cz - 1);
  const noiseMapZPos = getNeighborNoiseMap(cx, cy, cz + 1);
  const neighborFlags = {
    neighborXPosExists: !!noiseMapXPos,
    neighborXNegExists: !!noiseMapXNeg,
    neighborZPosExists: !!noiseMapZPos,
    neighborZNegExists: !!noiseMapZNeg,
    neighborYPosExists: true,
    neighborYNegExists: true,
    playerEditMaskXPos: null, playerEditMaskXNeg: null, playerEditMaskZPos: null,
    playerEditMaskZNeg: null, playerEditMaskYPos: null, playerEditMaskYNeg: null
  };
  try {
    if (opts.tpChunkMeshes[chunkKey]) {
      disposeNode(opts.sceneRef, opts.tpChunkMeshes[chunkKey]);
      opts.tpChunkMeshes[chunkKey] = null;
      if (opts.tpLoadedChunks[chunkKey]) opts.tpLoadedChunks[chunkKey].mesh = null;
    }
    const generateOpts = { noiseMap: noiseMapToUse };
    const geometry = generateMeshVertices(
      cx, cy, cz,
      generateOpts,
      true,
      null, null,
      noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
      neighborFlags
    );
    if (!geometry || geometry.getAttribute('position').count === 0) return false;
    const material = createUnifiedPlanetMaterial(
      opts.tpCompInfo.topElements,
      opts.tpNoiseScale,
      opts.tpPlanetOffset
    );
    material.side = THREE.DoubleSide;
    const newMesh = new THREE.Mesh(geometry, material);
    newMesh.name = `tp_chunk_${chunkKey}`;
    opts.sceneRef.add(newMesh);
    opts.tpChunkMeshes[chunkKey] = newMesh;
    if (opts.tpLoadedChunks[chunkKey]) {
      opts.tpLoadedChunks[chunkKey].mesh = newMesh;
      opts.tpLoadedChunks[chunkKey].lastAccessTime = Date.now();
    } else {
      opts.tpLoadedChunks[chunkKey] = { mesh: newMesh, noiseMap: noiseMapToUse, lastAccessTime: Date.now() };
    }
    return true;
  } catch (e) {
    if (opts.tpChunkMeshes[chunkKey]) {
      disposeNode(opts.sceneRef, opts.tpChunkMeshes[chunkKey]);
      opts.tpChunkMeshes[chunkKey] = null;
    }
    if (opts.tpLoadedChunks[chunkKey]) {
      opts.tpLoadedChunks[chunkKey].mesh = null;
    }
    return false;
  }
}
