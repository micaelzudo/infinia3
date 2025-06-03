import * as THREE from 'three';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';

// Interface for the data expected by this visualizer
// We'll expect an object where keys are chunk strings "x,y,z"
// and values indicate if the chunk is active or has a mesh.
// For simplicity in this new system, we'll just take an array of chunk keys.
export type StandardChunkKeyArray = string[];

let standardBoundariesGroup: THREE.Group | null = null;
const DEBUG_BOX_COLOR = 0xffff00; // Yellow, to distinguish from previous green boxes

export function addStandardChunkBoundaries(scene: THREE.Scene, chunkKeys: StandardChunkKeyArray) {
    if (!scene) {
        console.error("[StandardBoundaryViz] Scene is required.");
        return;
    }

    if (!standardBoundariesGroup) {
        standardBoundariesGroup = new THREE.Group();
        standardBoundariesGroup.name = "standard_chunk_boundaries_group";
        scene.add(standardBoundariesGroup);
    } else if (!standardBoundariesGroup.parent) {
        scene.add(standardBoundariesGroup); // Re-add if it was removed
    }

    // Clear existing boxes
    while (standardBoundariesGroup.children.length > 0) {
        const child = standardBoundariesGroup.children[0] as THREE.Mesh;
        standardBoundariesGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                (child.material as THREE.Material).dispose();
            }
        }
    }

    if (!chunkKeys || chunkKeys.length === 0) {
        // console.log("[StandardBoundaryViz] No chunk keys provided, clearing visualizer.");
        return;
    }

    // console.log(`[StandardBoundaryViz] Visualizing ${chunkKeys.length} chunk boundaries.`);

    for (const key of chunkKeys) {
        const coords = key.split(',').map(Number);
        if (coords.length === 3 && !coords.some(isNaN)) {
            const [chunkX, chunkY, chunkZ] = coords;

            const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
            // Translate geometry so its local origin (0,0,0) is at its minimum corner
            geometry.translate(CHUNK_SIZE / 2, CHUNK_HEIGHT / 2, CHUNK_SIZE / 2);

            const material = new THREE.MeshBasicMaterial({
                color: DEBUG_BOX_COLOR,
                wireframe: true,
                transparent: true,
                opacity: 0.4, // Slightly more visible than before
                depthWrite: false
            });

            const boxMesh = new THREE.Mesh(geometry, material);
            
            // Position the mesh so its minimum corner (which is now its local origin)
            // is at (chunkX * CHUNK_SIZE, chunkY * CHUNK_HEIGHT, chunkZ * CHUNK_SIZE)
            boxMesh.position.set(
                chunkX * CHUNK_SIZE,
                chunkY * CHUNK_HEIGHT,
                chunkZ * CHUNK_SIZE
            );
            boxMesh.name = `standard_boundary_box_${key}`;
            standardBoundariesGroup.add(boxMesh);
        } else {
            console.warn(`[StandardBoundaryViz] Invalid chunk key format: ${key}`);
        }
    }
}

export function removeStandardChunkBoundaries(scene: THREE.Scene) {
    if (standardBoundariesGroup && standardBoundariesGroup.parent === scene) {
        scene.remove(standardBoundariesGroup);
    }
    if (standardBoundariesGroup) {
        while (standardBoundariesGroup.children.length > 0) {
            const child = standardBoundariesGroup.children[0] as THREE.Mesh;
            standardBoundariesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    (child.material as THREE.Material).dispose();
                }
            }
        }
    }
    standardBoundariesGroup = null;
}

export function getStandardBoundariesGroup(): THREE.Group | null {
    return standardBoundariesGroup;
} 