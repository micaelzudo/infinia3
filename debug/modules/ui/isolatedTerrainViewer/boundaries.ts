import * as THREE from 'three';
import { getScene } from './core';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../../constants_debug';

// Boundary state
let trueChunkBoundariesGroup: THREE.Group | null = null;
let worldChunkBoundariesGroup: THREE.Group | null = null;
let worldBoundariesVisible = false;

export function addTrueChunkBoundariesVisualization(chunksData: { [key: string]: any }) {
    const scene = getScene();
    if (!scene) return;

    // Remove existing boundaries
    removeTrueChunkBoundariesVisualization();

    // Create new group
    trueChunkBoundariesGroup = new THREE.Group();
    scene.add(trueChunkBoundariesGroup);

    // Create boundary boxes for each chunk
    Object.entries(chunksData).forEach(([key, data]) => {
        if (!trueChunkBoundariesGroup) return;
        
        const [x, y, z] = key.split(',').map(Number);
        
        // Create wireframe box
        const geometry = new THREE.BoxGeometry(
            CHUNK_SIZE,
            CHUNK_HEIGHT,
            CHUNK_SIZE
        );
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5
        });
        const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            material
        );

        // Position the box
        wireframe.position.set(
            x * CHUNK_SIZE,
            y * CHUNK_HEIGHT,
            z * CHUNK_SIZE
        );

        trueChunkBoundariesGroup.add(wireframe);
    });
}

export function removeTrueChunkBoundariesVisualization() {
    const scene = getScene();
    if (!scene || !trueChunkBoundariesGroup) return;

    scene.remove(trueChunkBoundariesGroup);
    trueChunkBoundariesGroup.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
        }
    });
    trueChunkBoundariesGroup = null;
}

export function toggleWorldChunkBoundaries(visible?: boolean): boolean {
    const scene = getScene();
    if (!scene) return false;

    if (visible !== undefined) {
        worldBoundariesVisible = visible;
    } else {
        worldBoundariesVisible = !worldBoundariesVisible;
    }

    if (worldBoundariesVisible) {
        if (!worldChunkBoundariesGroup) {
            // Create world boundaries group
            worldChunkBoundariesGroup = new THREE.Group();
            scene.add(worldChunkBoundariesGroup);

            // Create a large box representing the world bounds
            const worldSize = 1000; // Arbitrary large size
            const geometry = new THREE.BoxGeometry(worldSize, worldSize, worldSize);
            const material = new THREE.LineBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.3
            });
            const wireframe = new THREE.LineSegments(
                new THREE.WireframeGeometry(geometry),
                material
            );

            worldChunkBoundariesGroup.add(wireframe);
        }
    } else {
        if (worldChunkBoundariesGroup) {
            scene.remove(worldChunkBoundariesGroup);
            worldChunkBoundariesGroup.traverse((child) => {
                if (child instanceof THREE.LineSegments) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
            worldChunkBoundariesGroup = null;
        }
    }

    return worldBoundariesVisible;
}

export function cleanupBoundaries() {
    removeTrueChunkBoundariesVisualization();
    toggleWorldChunkBoundaries(false);
}

// Getters
export function areWorldBoundariesVisible() { return worldBoundariesVisible; }
export function getTrueChunkBoundariesGroup() { return trueChunkBoundariesGroup; }
export function getWorldChunkBoundariesGroup() { return worldChunkBoundariesGroup; } 