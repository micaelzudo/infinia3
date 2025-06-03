/**
 * Boundary Debug Visualizer
 * This module provides functions to visualize and debug mesh boundaries
 */

import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../constants_debug';

/**
 * Creates visual indicators for chunk boundaries to help debug mesh issues
 * @param scene The THREE.Scene to add visualizations to
 * @param chunkMeshes Object containing all chunk meshes
 */
export function addBoundaryDebugVisualization(
  scene: THREE.Scene,
  chunkMeshes: { [key: string]: THREE.Mesh | null }
): void {
  if (!scene) return;
  
  // Remove any existing boundary visualizations
  removeBoundaryDebugVisualization(scene);
  
  // Create a material for highlighting problematic boundaries
  const boundaryMaterial = new THREE.LineBasicMaterial({ 
    color: 0xff0000, 
    linewidth: 2 
  });
  
  // For each chunk mesh
  for (const key in chunkMeshes) {
    const mesh = chunkMeshes[key];
    if (!mesh) continue;
    
    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    if (!position) continue;
    
    // Create a set to track boundary edges
    const edges = new Set<string>();
    
    // Iterate through triangles
    for (let i = 0; i < position.count; i += 3) {
      const v1 = new THREE.Vector3().fromBufferAttribute(position, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(position, i+1);
      const v3 = new THREE.Vector3().fromBufferAttribute(position, i+2);
      
      // Check if any vertex is at a chunk boundary
      const isV1Boundary = isBoundaryVertex(v1);
      const isV2Boundary = isBoundaryVertex(v2);
      const isV3Boundary = isBoundaryVertex(v3);
      
      // If at least one vertex is at a boundary, add the edges
      if (isV1Boundary || isV2Boundary || isV3Boundary) {
        if (isV1Boundary && isV2Boundary) {
          const edgeKey = getEdgeKey(v1, v2);
          edges.add(edgeKey);
        }
        if (isV2Boundary && isV3Boundary) {
          const edgeKey = getEdgeKey(v2, v3);
          edges.add(edgeKey);
        }
        if (isV3Boundary && isV1Boundary) {
          const edgeKey = getEdgeKey(v3, v1);
          edges.add(edgeKey);
        }
      }
    }
    
    // Create line segments for the boundary edges
    const lineGeometry = new THREE.BufferGeometry();
    const lineVertices: number[] = [];
    
    for (const edgeKey of edges) {
      const [x1, y1, z1, x2, y2, z2] = edgeKey.split(',').map(Number);
      lineVertices.push(x1, y1, z1, x2, y2, z2);
    }
    
    if (lineVertices.length > 0) {
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3));
      const lines = new THREE.LineSegments(lineGeometry, boundaryMaterial);
      lines.name = `boundary_debug_${key}`;
      scene.add(lines);
    }
  }
  
  console.log('Boundary debug visualization added');
}

/**
 * Removes all boundary debug visualizations from the scene
 * @param scene The THREE.Scene to remove visualizations from
 */
export function removeBoundaryDebugVisualization(scene: THREE.Scene): void {
  if (!scene) return;
  
  // Find and remove all boundary debug objects
  const objectsToRemove: THREE.Object3D[] = [];
  scene.traverse((object) => {
    if (object.name.startsWith('boundary_debug_')) {
      objectsToRemove.push(object);
    }
  });
  
  // Remove objects
  for (const object of objectsToRemove) {
    scene.remove(object);
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
      object.geometry.dispose();
      if (object.material instanceof THREE.Material) {
        object.material.dispose();
      } else if (Array.isArray(object.material)) {
        for (const material of object.material) {
          material.dispose();
        }
      }
    }
  }
  
  console.log(`Removed ${objectsToRemove.length} boundary debug visualizations`);
}

/**
 * Checks if a vertex is at a chunk boundary
 * @param v The vertex to check
 * @returns True if the vertex is at a chunk boundary
 */
function isBoundaryVertex(v: THREE.Vector3): boolean {
  // Check if vertex is at a chunk boundary
  const chunkX = Math.floor(v.x / CHUNK_SIZE);
  const chunkY = Math.floor(v.y / CHUNK_HEIGHT);
  const chunkZ = Math.floor(v.z / CHUNK_SIZE);
  
  // FIXED: Increased tolerance to 0.015 to match the new boundary snapping threshold in meshGenerator_debug.ts
  const BOUNDARY_TOLERANCE = 0.015;
  
  return Math.abs(v.x - chunkX * CHUNK_SIZE) < BOUNDARY_TOLERANCE || 
         Math.abs(v.x - (chunkX+1) * CHUNK_SIZE) < BOUNDARY_TOLERANCE ||
         Math.abs(v.y - chunkY * CHUNK_HEIGHT) < BOUNDARY_TOLERANCE || 
         Math.abs(v.y - (chunkY+1) * CHUNK_HEIGHT) < BOUNDARY_TOLERANCE ||
         Math.abs(v.z - chunkZ * CHUNK_SIZE) < BOUNDARY_TOLERANCE || 
         Math.abs(v.z - (chunkZ+1) * CHUNK_SIZE) < BOUNDARY_TOLERANCE;
}

/**
 * Creates a unique key for an edge
 * @param v1 First vertex
 * @param v2 Second vertex
 * @returns A string key representing the edge
 */
function getEdgeKey(v1: THREE.Vector3, v2: THREE.Vector3): string {
  // Create a unique key for an edge
  return `${v1.x},${v1.y},${v1.z},${v2.x},${v2.y},${v2.z}`;
}
