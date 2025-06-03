import * as THREE from 'three';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';
// We no longer need IsolatedChunkData if we only receive meshes

let visualizerGroup: THREE.Group | null = null;
const BOX_COLOR = 0x00ff00; // Green for all boxes derived from meshes
const BOX_OPACITY = 0.35;

export function addTrueChunkBoundariesVisualization(scene: THREE.Scene, actualMeshes: THREE.Mesh[]): string[] {
    if (!scene) {
        console.error("[TrueBoundaryViz REBUILT] Scene is not available.");
        return []; // Return empty array if scene is not available
    }

    if (!visualizerGroup) {
        visualizerGroup = new THREE.Group();
        visualizerGroup.name = "rebuilt_true_chunk_boundaries_group";
        scene.add(visualizerGroup);
    } else if (!visualizerGroup.parent) {
        scene.add(visualizerGroup);
    }

    // Clear existing boxes
    while (visualizerGroup.children.length > 0) {
        const child = visualizerGroup.children[0] as THREE.Mesh;
        visualizerGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                (child.material as THREE.Material).dispose();
            }
        }
    }
    console.log(`[TrueBoundaryViz REBUILT] Cleared old boxes. Processing ${actualMeshes.length} meshes.`);

    const drawnChunkKeys = new Set<string>();
    const worldBoundingBox = new THREE.Box3();

    for (const mesh of actualMeshes) {
        if (!mesh || !mesh.geometry) continue; // Skip if mesh or its geometry is invalid

        // Ensure matrix world is up to date for accurate bounding box calculation
        mesh.updateMatrixWorld(true);
        worldBoundingBox.setFromObject(mesh);

        if (worldBoundingBox.isEmpty()) continue;

        const minCX = Math.floor(worldBoundingBox.min.x / CHUNK_SIZE);
        const maxCX = Math.floor(worldBoundingBox.max.x / CHUNK_SIZE);
        const minCY = Math.floor(worldBoundingBox.min.y / CHUNK_HEIGHT);
        const maxCY = Math.floor(worldBoundingBox.max.y / CHUNK_HEIGHT);
        const minCZ = Math.floor(worldBoundingBox.min.z / CHUNK_SIZE);
        const maxCZ = Math.floor(worldBoundingBox.max.z / CHUNK_SIZE);

        // console.log(`[TrueBoundaryViz REBUILT] Mesh bounds: X[${minCX}-${maxCX}], Y[${minCY}-${maxCY}], Z[${minCZ}-${maxCZ}]`);

        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                for (let cz = minCZ; cz <= maxCZ; cz++) {
                    const chunkKey = `${cx},${cy},${cz}`;
                    if (!drawnChunkKeys.has(chunkKey)) {
                        drawnChunkKeys.add(chunkKey);

                        const boxGeometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
                        const material = new THREE.MeshBasicMaterial({
                            color: BOX_COLOR,
                            wireframe: false,
                            transparent: true,
                            opacity: 0.2,
                            depthWrite: false
                        });
                        const debugBox = new THREE.Mesh(boxGeometry, material);
                        debugBox.position.set(
                            cx * CHUNK_SIZE + CHUNK_SIZE / 2,
                            cy * CHUNK_HEIGHT + CHUNK_HEIGHT / 2,
                            cz * CHUNK_SIZE + CHUNK_SIZE / 2
                        );
                        debugBox.name = `true_boundary_REBUILT_${chunkKey}`;
                        visualizerGroup.add(debugBox);
                    }
                }
            }
        }
    }
    console.log(`[TrueBoundaryViz REBUILT] Finished. Added ${drawnChunkKeys.size} unique boxes.`);
    // If we need to return the keys for currentGeneratedChunkKeys in isolatedTerrainViewer, we can:
    return Array.from(drawnChunkKeys);
}

// remove function remains largely the same, ensuring it clears visualizerGroup
export function removeTrueChunkBoundariesVisualization(scene: THREE.Scene) {
    if (!visualizerGroup || !visualizerGroup.parent) return;
    while (visualizerGroup.children.length > 0) {
        const child = visualizerGroup.children[0] as THREE.Mesh;
        visualizerGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                (child.material as THREE.Material).dispose();
            }
        }
    }
    // console.log("[TrueBoundaryViz REBUILT] Removed all boxes.");
} 