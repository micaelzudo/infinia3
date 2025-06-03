import * as THREE from 'three';
import { YukaNavMeshHelper } from './yukaNavMeshHelper';
import { getActiveChunkMeshesForCollision } from '../ui/isolatedTerrainViewer';
import type { ChunkMeshesRef } from '../ui/playerMovement';

// Singleton navMeshHelper instance
let navMeshHelper: YukaNavMeshHelper | null = null;

export function getNavMeshHelper(scene?: THREE.Scene): YukaNavMeshHelper {
    if (!navMeshHelper && scene) {
        navMeshHelper = new YukaNavMeshHelper(scene);
    }
    return navMeshHelper!;
}

export function toggleNavMeshVisibility(visible?: boolean): void {
    if (navMeshHelper) {
        navMeshHelper.toggleDebugHelper(visible);
    }
}

export function regenerateNavMesh(): void {
    if (navMeshHelper) {
        const activeChunkMeshes = getActiveChunkMeshesForCollision();
        if (activeChunkMeshes) {
            // Create a new object with the correct type
            const chunkMeshesRef: ChunkMeshesRef = {};
            Object.entries(activeChunkMeshes).forEach(([key, mesh]) => {
                if (mesh) {
                    chunkMeshesRef[key] = mesh;
                }
            });
            
            if (Object.keys(chunkMeshesRef).length > 0) {
                navMeshHelper.generateNavMesh(chunkMeshesRef, 60).catch(error => {
            console.error('[AiNavMeshManager] NavMesh generation failed:', error);
        });
            }
        }
    }
}

export function clearNavMeshDebugHelper(): void {
    if (navMeshHelper) {
        navMeshHelper.clearDebugHelper();
    }
}

export { navMeshHelper };