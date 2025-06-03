import * as THREE from 'three';
import { generateNoiseMap as generateNoiseMap_CORE } from '../../noiseMapGenerator_debug';
import { generateMesh as generateMeshVertices_CORE } from '../../meshGenerator_debug';
import type { NoiseMap, NoiseLayers, Seed, Generate } from '../../types_debug';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import type { TopElementsData } from '../types/renderingTypes';
import { disposeNode } from '../../disposeNode_debug';

export interface AlternatingTerrainParams {
    scene: THREE.Scene;
    seed: Seed;
    startX: number;   // Starting X coordinate for the strip
    startZ: number; // Starting Z coordinate for the strip
    stripLength: number; // How many chunks long the strip is
    stripDirection: 'x' | 'z'; // Direction of the strip
    initialYLevel: 'low' | 'high'; // Which Y level the strip starts with
    lowYLevel: number;
    highYLevel: number;
    noiseLayersLow: NoiseLayers;
    noiseLayersHigh: NoiseLayers;
    compInfo?: { topElements: TopElementsData | null }; 
    planetOffset?: THREE.Vector3;                       
    noiseScale?: number;                                
    interpolate?: boolean; 
}

interface GeneratedChunkData {
    noiseMap: NoiseMap | null;
    mesh: THREE.Mesh | null;
    key: string;
}

// Module-level state for a single generation pass
let localWorldData: Map<string, GeneratedChunkData> = new Map();
let currentSeed: Seed;
let currentNoiseLayersLow: NoiseLayers;
let currentNoiseLayersHigh: NoiseLayers;
let currentGenParams: AlternatingTerrainParams; // To access params in helper functions

function get3DChunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
}

/**
 * Ensures a noise map for the given chunk coordinates is generated and stored.
 * Uses the appropriate noise layers based on which primary Y-stratum cy belongs to.
 */
async function ensureNoiseMap(cx: number, cy: number, cz: number): Promise<NoiseMap | null> {
    const key = get3DChunkKey(cx, cy, cz);
    if (localWorldData.has(key) && localWorldData.get(key)?.noiseMap) {
        return localWorldData.get(key)!.noiseMap;
    }

    let noiseLayersToUse: NoiseLayers;
    if (currentGenParams.highYLevel > currentGenParams.lowYLevel) {
        const midPoint = currentGenParams.lowYLevel + (currentGenParams.highYLevel - currentGenParams.lowYLevel) / 2;
        noiseLayersToUse = (cy <= midPoint) ? currentNoiseLayersLow : currentNoiseLayersHigh;
    } else if (currentGenParams.lowYLevel > currentGenParams.highYLevel) {
        const midPoint = currentGenParams.highYLevel + (currentGenParams.lowYLevel - currentGenParams.highYLevel) / 2;
        noiseLayersToUse = (cy <= midPoint) ? currentNoiseLayersHigh : currentNoiseLayersLow;
    } else { // lowYLevel === highYLevel
        noiseLayersToUse = currentNoiseLayersLow;
    }
    // console.log(`Noise for ${key} (cy=${cy}) uses ${noiseLayersToUse === currentNoiseLayersLow ? 'LOW' : 'HIGH'} profile.`);

    try {
        const noiseMap = generateNoiseMap_CORE(cx, cy, cz, noiseLayersToUse, currentSeed);
        if (noiseMap) {
            if (!localWorldData.has(key)) localWorldData.set(key, { noiseMap: null, mesh: null, key });
            localWorldData.get(key)!.noiseMap = noiseMap;
            return noiseMap;
        }
        console.error(`[AltTerrainGen] Failed to generate noise map for ${key}`);
        return null;
    } catch (e) {
        console.error(`[AltTerrainGen] Error in ensureNoiseMap for ${key}:`, e);
        return null;
    }
}

/**
 * Generates a mesh for the specified chunk, ensuring all its 3D neighbors have noise maps.
 */
async function generateAndMeshChunk(cx: number, cy: number, cz: number): Promise<THREE.Mesh | null> {
    const key = get3DChunkKey(cx, cy, cz);
    // console.log(`[AltTerrainGen] Meshing chunk: ${key}`);

    const centralNoiseMap = await ensureNoiseMap(cx, cy, cz);
    if (!centralNoiseMap) {
        console.error(`[AltTerrainGen] Cannot mesh ${key}, central noise map failed.`);
        return null;
    }

    const neighborCoords = [
        { dx: 1, dy: 0, dz: 0, name: "XP" }, { dx: -1, dy: 0, dz: 0, name: "XN" },
        { dx: 0, dy: 1, dz: 0, name: "YP" }, { dx: 0, dy: -1, dz: 0, name: "YN" },
        { dx: 0, dy: 0, dz: 1, name: "ZP" }, { dx: 0, dy: 0, dz: -1, name: "ZN" },
    ];

    const neighborNoiseMaps: { [k: string]: NoiseMap | null } = {};
    const neighborFlags: { [k: string]: boolean } = {};

    for (const n of neighborCoords) {
        const neighborMap = await ensureNoiseMap(cx + n.dx, cy + n.dy, cz + n.dz);
        const mapKey = `noiseMap${n.name}`; // e.g. noiseMapXP
        const flagKey = `neighbor${n.name}Exists`; // e.g. neighborXPExists

        if (neighborMap) {
            neighborNoiseMaps[mapKey] = neighborMap;
            neighborFlags[flagKey] = true;
        } else {
            neighborNoiseMaps[mapKey] = null;
            neighborFlags[flagKey] = false;
        }
    }

    try {
        const generateOpts: Generate = { noiseMap: centralNoiseMap };
        const geometry = generateMeshVertices_CORE(
            cx, cy, cz,
            generateOpts,
            currentGenParams.interpolate ?? false,
            neighborNoiseMaps.noiseMapYN, neighborNoiseMaps.noiseMapYP,
            neighborNoiseMaps.noiseMapXN, neighborNoiseMaps.noiseMapXP,
            neighborNoiseMaps.noiseMapZN, neighborNoiseMaps.noiseMapZP,
            neighborFlags
        );

        if (geometry && geometry.attributes.position && geometry.attributes.position.count > 0) {
            const material = (currentGenParams.compInfo && currentGenParams.noiseScale && currentGenParams.planetOffset)
                ? createUnifiedPlanetMaterial(currentGenParams.compInfo.topElements, currentGenParams.noiseScale, currentGenParams.planetOffset)
                : new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff, wireframe: false });
            material.side = THREE.DoubleSide;

            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `alt_chunk_${key}`;
            
            const chunkData = localWorldData.get(key) || { noiseMap: centralNoiseMap, mesh: null, key };
            chunkData.mesh = mesh;
            localWorldData.set(key, chunkData);
            return mesh;
        }
        // console.warn(`[AltTerrainGen] generateMeshVertices_CORE returned empty/invalid geometry for ${key}`);
        return null;
    } catch (e) {
        console.error(`[AltTerrainGen] Error in generateMeshVertices_CORE for ${key}:`, e);
        return null;
    }
}

/**
 * Main function to generate a strip of terrain with alternating Y levels.
 */
export async function generateAlternatingTerrain(params: AlternatingTerrainParams): Promise<THREE.Group> {
    console.log("[AltTerrainGen] Starting generation with new params:", params);
    localWorldData.clear(); 
    currentSeed = params.seed;
    currentNoiseLayersLow = params.noiseLayersLow;
    currentNoiseLayersHigh = params.noiseLayersHigh;
    currentGenParams = params; // Store full params for access in helpers

    const worldGroup = new THREE.Group();
    worldGroup.name = "AlternatingTerrainGroup";

    let currentPrimaryY = (params.initialYLevel === 'low') ? params.lowYLevel : params.highYLevel;

    for (let stripIndex = 0; stripIndex < params.stripLength; stripIndex++) {
        let cx: number, cz: number;
        let nextCx: number, nextCz: number; // For pre-generation

        if (params.stripDirection === 'z') {
            cx = params.startX;
            cz = params.startZ + stripIndex;
            nextCx = cx;
            nextCz = cz + 1;
        } else { // params.stripDirection === 'x'
            cz = params.startZ;
            cx = params.startX + stripIndex;
            nextCz = cz;
            nextCx = cx + 1;
        }
        
        const cyToMesh = currentPrimaryY;
        const otherPrimaryY = (cyToMesh === params.lowYLevel) ? params.highYLevel : params.lowYLevel;

        // console.log(`[AltTerrainGen] Strip Index: ${stripIndex}, Primary Y to mesh: ${cyToMesh} at (${cx}, ${cz})`);

        const mainMesh = await generateAndMeshChunk(cx, cyToMesh, cz);
        if (mainMesh) {
            worldGroup.add(mainMesh);
        }

        // Proactive noise map generation for context and next step
        await ensureNoiseMap(cx, otherPrimaryY, cz); // The other main level at current XZ
        await ensureNoiseMap(cx, params.lowYLevel - 1, cz);
        await ensureNoiseMap(cx, params.lowYLevel + 1, cz);
        await ensureNoiseMap(cx, params.highYLevel - 1, cz);
        await ensureNoiseMap(cx, params.highYLevel + 1, cz);
        
        if (stripIndex < params.stripLength - 1) {
            const nextPrimaryYToMesh = otherPrimaryY;
            // console.log(`[AltTerrainGen] Pre-generating for next strip index (coords: (${nextCx}, ${nextCz}), PrimaryY=${nextPrimaryYToMesh})`);
            await ensureNoiseMap(nextCx, nextPrimaryYToMesh, nextCz);       
            await ensureNoiseMap(nextCx, nextPrimaryYToMesh - 1, nextCz); 
            await ensureNoiseMap(nextCx, nextPrimaryYToMesh + 1, nextCz); 
        }

        currentPrimaryY = otherPrimaryY; // Alternate for next iteration
    }

    params.scene.add(worldGroup);
    console.log("[AltTerrainGen] Generation complete. Added to scene.");
    return worldGroup;
}

/**
 * Disposes of all meshes and data generated by the last run of generateAlternatingTerrain.
 */
export function disposeAlternatingTerrain(scene: THREE.Scene, group?: THREE.Group) {
    console.log("[AltTerrainGen] Disposing generated terrain...");
    if (group && group.parent === scene) {
        scene.remove(group);
    }
    localWorldData.forEach(chunkData => {
        if (chunkData.mesh) {
            disposeNode(scene, chunkData.mesh); // Ensure disposeNode handles removal from group if still parented
        }
    });
    localWorldData.clear();
    console.log("[AltTerrainGen] Disposal complete.");
}

// Example Usage (can be called from another module like a debug script or UI panel)
/*
async function exampleUse(scene: THREE.Scene) {
    const defaultPlanetOffset = new THREE.Vector3(0,0,0);
    const defaultNoiseScale = 1.0;

    // Define two distinct noise layer configurations
    const lowNoise: NoiseLayers = [{
        noiseType: 'simplex', scale: new THREE.Vector3(150, 30, 150), octaves: 3, persistence: 0.4, lacunarity: 2.2,
        exponent: 1.0, ridgeThreshold: 0.0, heightModifier: { type: 'none', value: 20 }, offset: new THREE.Vector3(0,0,0)
    }];
    const highNoise: NoiseLayers = [{
        noiseType: 'simplex', scale: new THREE.Vector3(120, 80, 120), octaves: 5, persistence: 0.5, lacunarity: 2.0,
        exponent: 1.5, ridgeThreshold: 0.55, heightModifier: { type: 'none', value: 60 }, offset: new THREE.Vector3(1000,0,0) // Different offset for variation
    }];

    const genParams: AlternatingTerrainParams = {
        scene: scene,
        seed: "altTerrainTest" + Math.random(),
        startZ: 0,
        lengthZ: 5, // Number of chunks along Z
        startX: 0,
        lowYLevel: 0,
        highYLevel: 1, // Or could be 2 for more dramatic shifts
        noiseLayersLow: JSON.parse(JSON.stringify(lowNoise)),
        noiseLayersHigh: JSON.parse(JSON.stringify(highNoise)),
        compInfo: { topElements: null }, // Provide actual TopElementsData for proper material
        planetOffset: defaultPlanetOffset,
        noiseScale: defaultNoiseScale,
        interpolate: false,
    };

    // To use a specific material, you'd set compInfo.topElements
    // For example:
    // genParams.compInfo = { topElements: { grass: { index: 0, ...}, rock: { index: 1, ...} ... } };
    
    const generatedGroup = await generateAlternatingTerrain(genParams);
    // To clean up: disposeAlternatingTerrain(scene, generatedGroup);
}
*/ 