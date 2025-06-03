import * as THREE from 'three';
import { generateMesh as generateMeshVertices } from '../../../meshGenerator_debug';
import { generateNoiseMap } from '../../../noiseMapGenerator_debug';
import { disposeNode } from '../../../disposeNode_debug';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../../constants_debug';
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../../types_debug';
import type { TopElementsData } from '../../types/renderingTypes';
import { getScene } from './core';
import { getChunkKeyY } from '../../../utils_debug';

// Terrain state
let isolatedLoadedChunkData: { [key: string]: any } = {};
let currentGeneratedChunkKeys: string[] = [];
let editBrushMesh: THREE.Mesh | null = null;
let editBrushRadius = 4;
let editBrushStrength = 0.5;
let editBrushShape = 'sphere';
let editBrushVerticality = 20;
let editBrushMode = 'add';

// Constants
const ISOLATED_CHUNK_X = 0;
const ISOLATED_CHUNK_Y = 0;
const ISOLATED_CHUNK_Z = 0;
const ISOLATED_CHUNK_KEY = `${ISOLATED_CHUNK_X},${ISOLATED_CHUNK_Y},${ISOLATED_CHUNK_Z}`;

export function generateTerrain(params: {
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale?: number;
    planetOffset?: THREE.Vector3;
}) {
    const scene = getScene();
    if (!scene) return;

    // Clear existing terrain
    cleanupTerrain();

    // Generate noise map for the chunk
    const noiseMap = generateNoiseMap(
        ISOLATED_CHUNK_X,
        ISOLATED_CHUNK_Y,
        ISOLATED_CHUNK_Z,
        params.noiseLayers,
        params.seed
    );

    if (!noiseMap) {
        console.error('Failed to generate noise map');
        return;
    }

    // Store chunk data
    isolatedLoadedChunkData[ISOLATED_CHUNK_KEY] = {
        noiseMap,
        meshes: [],
        playerEditMask: null
    };

    // Generate mesh
    const mesh = generateMeshVertices(
        ISOLATED_CHUNK_X,
        ISOLATED_CHUNK_Y,
        ISOLATED_CHUNK_Z,
        null, // generate
        true, // interpolate
        null, // noiseMapBelow
        null, // noiseMapAbove
        null, // noiseMapXNeg
        null, // noiseMapXPos
        null, // noiseMapZNeg
        null, // noiseMapZPos
        {} // neighborFlags
    );

    if (mesh) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.7,
            metalness: 0.2
        });
        const meshObject = new THREE.Mesh(mesh, material);
        scene.add(meshObject);
        isolatedLoadedChunkData[ISOLATED_CHUNK_KEY].meshes.push(meshObject);
        currentGeneratedChunkKeys.push(ISOLATED_CHUNK_KEY);
    }
}

export function updateBrushVisualizer(position: THREE.Vector3) {
    const scene = getScene();
    if (!scene) return;

    // Remove existing brush mesh
    if (editBrushMesh) {
        scene.remove(editBrushMesh);
        editBrushMesh.geometry.dispose();
        (editBrushMesh.material as THREE.Material).dispose();
    }

    // Create new brush mesh
    let geometry: THREE.BufferGeometry;
    switch (editBrushShape) {
        case 'sphere':
            geometry = new THREE.SphereGeometry(editBrushRadius, 32, 32);
            break;
        case 'cube':
            geometry = new THREE.BoxGeometry(
                editBrushRadius * 2,
                editBrushRadius * 2 * editBrushVerticality,
                editBrushRadius * 2
            );
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(
                editBrushRadius,
                editBrushRadius,
                editBrushRadius * 2 * editBrushVerticality,
                32
            );
            break;
        default:
            geometry = new THREE.SphereGeometry(editBrushRadius, 32, 32);
    }

    const material = new THREE.MeshBasicMaterial({
        color: editBrushMode === 'add' ? 0x00ff00 : 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.5
    });

    editBrushMesh = new THREE.Mesh(geometry, material);
    editBrushMesh.position.copy(position);
    scene.add(editBrushMesh);
}

export function cleanupTerrain() {
    const scene = getScene();
    if (!scene) return;

    // Remove all chunk meshes
    currentGeneratedChunkKeys.forEach(key => {
        const chunkData = isolatedLoadedChunkData[key];
        if (chunkData && chunkData.meshes) {
            chunkData.meshes.forEach((mesh: THREE.Object3D) => {
                scene.remove(mesh);
                if (mesh instanceof THREE.Mesh) {
                    disposeNode(mesh.geometry, true);
                    if (mesh.material) {
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach(m => m.dispose());
                        } else {
                            mesh.material.dispose();
                        }
                    }
                }
            });
        }
    });

    // Clear data
    isolatedLoadedChunkData = {};
    currentGeneratedChunkKeys = [];

    // Remove brush mesh
    if (editBrushMesh) {
        scene.remove(editBrushMesh);
        editBrushMesh.geometry.dispose();
        (editBrushMesh.material as THREE.Material).dispose();
        editBrushMesh = null;
    }
}

// Brush settings
export function setBrushRadius(radius: number) {
    editBrushRadius = radius;
}

export function setBrushStrength(strength: number) {
    editBrushStrength = strength;
}

export function setBrushShape(shape: 'sphere' | 'cube' | 'cylinder') {
    editBrushShape = shape;
}

export function setBrushVerticality(verticality: number) {
    editBrushVerticality = verticality;
}

export function setBrushMode(mode: 'add' | 'remove') {
    editBrushMode = mode;
}

// Getters
export function getBrushRadius() { return editBrushRadius; }
export function getBrushStrength() { return editBrushStrength; }
export function getBrushShape() { return editBrushShape; }
export function getBrushVerticality() { return editBrushVerticality; }
export function getBrushMode() { return editBrushMode; }
export function getLoadedChunkData() { return isolatedLoadedChunkData; }
export function getGeneratedChunkKeys() { return currentGeneratedChunkKeys; } 