import * as THREE from 'three';

// Type definition for the material backup map
type OriginalMeshMaterialMap = Map<string, { originalMaterial: THREE.Material | THREE.Material[] }>;

// <<< Added global definition and initialization >>>
declare global {
    interface Window {
      DEBUG_COLLISION_RAYS_ENABLED?: boolean;
    }
  }

/**
 * Clears existing debug ray visualizations.
 * @param debugRayGroup The THREE.Group containing the debug rays.
 */
export function clearDebugRays(debugRayGroup: THREE.Group | null) {
    if (!debugRayGroup) return;
    while (debugRayGroup.children.length > 0) {
        const obj = debugRayGroup.children[0];
        debugRayGroup.remove(obj);
        if (obj instanceof THREE.ArrowHelper) {
            // Dispose geometry and materials of ArrowHelper components
            obj.line.geometry.dispose();
            if (obj.line.material instanceof THREE.Material) {
                obj.line.material.dispose();
            } else if (Array.isArray(obj.line.material)) {
                obj.line.material.forEach(m => m.dispose());
            }
            obj.cone.geometry.dispose();
            if (obj.cone.material instanceof THREE.Material) {
                obj.cone.material.dispose();
            } else if (Array.isArray(obj.cone.material)) {
                obj.cone.material.forEach(m => m.dispose());
            }
        } else if (obj instanceof THREE.Line) { // Fallback for old line type if ever used
            obj.geometry.dispose();
            if (obj.material instanceof THREE.Material) {
                obj.material.dispose();
            } else if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            }
        }
    }
}

/**
 * Adds a single debug ray (as an ArrowHelper) to the scene.
 * @param start Start point of the ray.
 * @param end End point of the ray.
 * @param color Color of the ray.
 * @param debugRayGroup The THREE.Group to add the ray to.
 */
export function addDebugRay(
    start: THREE.Vector3, 
    end: THREE.Vector3, 
    color: number, 
    debugRayGroup: THREE.Group | null
) {
    // Use window property directly, assumes it's initialized elsewhere
    const debugEnabled = typeof window !== 'undefined' && window.DEBUG_COLLISION_RAYS_ENABLED;

    // <<< Log function call >>>
    // console.log(`[addDebugRay] Called. Enabled: ${debugEnabled}, Group Exists: ${!!debugRayGroup}`);
    if (!debugRayGroup || !debugEnabled) return;

    try {
        const direction = end.clone().sub(start);
        const length = direction.length();
        direction.normalize();

        if (length < 0.01) return; // Avoid zero-length arrows

        // console.log(`[Debug Arrow] Drawing arrow from ${start.toArray().map(n => n.toFixed(1))}, dir: ${direction.toArray().map(n => n.toFixed(1))}, len: ${length.toFixed(2)}`);

        const headLength = Math.min(length * 0.2, 0.3); // Adjust head size based on length
        const headWidth = Math.min(length * 0.1, 0.2);

        const arrowHelper = new THREE.ArrowHelper(direction, start, length, color, headLength, headWidth);
        
        // Make arrow material ignore depth
        if (arrowHelper.line.material instanceof THREE.LineBasicMaterial) {
            arrowHelper.line.material.depthTest = false;
            arrowHelper.line.material.depthWrite = false;
            arrowHelper.line.material.transparent = true;
            arrowHelper.line.material.opacity = 0.8; 
            arrowHelper.line.material.linewidth = 1; 
        }
        if (arrowHelper.cone.material instanceof THREE.MeshBasicMaterial) {
             arrowHelper.cone.material.depthTest = false;
             arrowHelper.cone.material.depthWrite = false;
             arrowHelper.cone.material.transparent = true;
             arrowHelper.cone.material.opacity = 0.8;
        }
        
        arrowHelper.renderOrder = 999; // Render on top
        debugRayGroup.add(arrowHelper);

    } catch (error) {
        console.error("Error adding debug ray:", error);
    }
}

/**
 * Applies a debug wireframe material to a mesh, backing up the original.
 * @param mesh The mesh to apply the debug material to.
 * @param originalMeshMaterials Map holding the original materials, keyed by mesh UUID.
 */
export function setDebugMaterial(
    mesh: THREE.Mesh,
    originalMeshMaterials: OriginalMeshMaterialMap
) {
    const debugEnabled = typeof window !== 'undefined' && window.DEBUG_COLLISION_RAYS_ENABLED;
    // <<< Log function call and mesh info >>>
    // console.log(`[setDebugMaterial] Called for mesh: ${mesh?.name} (UUID: ${mesh?.uuid}). Enabled: ${debugEnabled}, HasMat: ${!!mesh?.material}, AlreadyBackedUp: ${originalMeshMaterials.has(mesh?.uuid)}`);
    if (!mesh || !mesh.material || !debugEnabled || originalMeshMaterials.has(mesh.uuid)) return;

    // Store original material reference
    originalMeshMaterials.set(mesh.uuid, { originalMaterial: mesh.material });

    // Define a standard debug material (consider making this configurable or caching it)
    const debugMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Bright yellow
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthTest: false, 
        depthWrite: false
    });

    // Replace the mesh's material
    mesh.material = debugMaterial;
    // console.log(`[Debug Mesh] Replaced material for ${mesh.name} with debug material.`);
}

/**
 * Restores the original materials to meshes that were modified for debugging.
 * @param scene The main scene to traverse for meshes.
 * @param originalMeshMaterials Map holding the original materials, keyed by mesh UUID.
 */
export function restoreOriginalMaterials(
    scene: THREE.Scene | null,
    originalMeshMaterials: OriginalMeshMaterialMap
) {
    if (originalMeshMaterials.size === 0 || !scene) return;

    scene.traverse((object) => {
        if (object instanceof THREE.Mesh && originalMeshMaterials.has(object.uuid)) {
            const backup = originalMeshMaterials.get(object.uuid)!;
            if (backup.originalMaterial) {
                // console.log(`[Debug Mesh] Restoring original material for ${object.name}`);
                object.material = backup.originalMaterial;
            } else {
                 console.warn(`[Debug Mesh] No original material found to restore for ${object.name}`);
            }
        }
    });
    
    // Clear the map after restoring
    originalMeshMaterials.clear();
} 