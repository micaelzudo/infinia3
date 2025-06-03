/**
 * Global Terrain Hover Handler
 * This module provides a global handler for terrain hover events
 * that works with the improved mining hover panel.
 */

import * as THREE from 'three';
import { improvedMiningHoverPanel } from './improvedMiningHoverPanel.js';

// Track if the handler is initialized
let isInitialized = false;

// Store references to required objects
let mainCamera = null;
let mainScene = null;
let mainRaycaster = null;
let terrainMeshes = [];

// Composition info for the mining hover panel
let compositionInfo = null;

// Default brush info
const defaultBrushInfo = { shape: 'sphere', radius: 4 };

/**
 * Initialize the global terrain hover handler
 * @param {THREE.Scene} scene - The main scene
 * @param {THREE.Camera} camera - The main camera
 * @param {Object} compInfo - Composition info for the mining hover panel
 */
export function initGlobalTerrainHoverHandler(scene, camera, compInfo) {
    console.log('[GlobalTerrainHoverHandler] Initializing...');
    
    // Store references
    mainScene = scene;
    mainCamera = camera;
    compositionInfo = compInfo;
    
    // Create raycaster
    mainRaycaster = new THREE.Raycaster();
    
    // Find terrain meshes in the scene
    findTerrainMeshes();
    
    // Add mouse move event listener
    document.addEventListener('mousemove', handleMouseMove);
    
    // Set initialized flag
    isInitialized = true;
    
    console.log('[GlobalTerrainHoverHandler] Initialized successfully');
}

/**
 * Find terrain meshes in the scene
 */
function findTerrainMeshes() {
    if (!mainScene) return;
    
    // Clear existing meshes
    terrainMeshes = [];
    
    // Find all meshes in the scene
    mainScene.traverse((object) => {
        // Check if the object is a mesh
        if (object instanceof THREE.Mesh) {
            // Add to terrain meshes array
            terrainMeshes.push(object);
        }
    });
    
    console.log(`[GlobalTerrainHoverHandler] Found ${terrainMeshes.length} potential terrain meshes`);
}

/**
 * Update terrain meshes (call this when the scene changes)
 */
export function updateTerrainMeshes() {
    findTerrainMeshes();
}

/**
 * Handle mouse move events
 * @param {MouseEvent} event - Mouse event
 */
function handleMouseMove(event) {
    if (!isInitialized || !mainCamera || !mainRaycaster || terrainMeshes.length === 0) return;
    
    // Calculate mouse position in normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the raycaster
    mainRaycaster.setFromCamera(mouse, mainCamera);
    
    // Check for intersections with terrain meshes
    const intersects = mainRaycaster.intersectObjects(terrainMeshes);
    
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const terrain = intersects[0].object;
        
        // Call the improved mining hover panel
        if (window.improvedMiningHoverPanel && compositionInfo) {
            try {
                // Create dependencies object
                const dependencies = {
                    camera: mainCamera,
                    raycaster: mainRaycaster,
                    terrain: terrain,
                    compInfo: compositionInfo,
                    noiseScale: 0.1,
                    planetOffset: new THREE.Vector3(0, 0, 0)
                };
                
                // Call the hover handler
                window.improvedMiningHoverPanel.handleHover(
                    event,
                    mainRaycaster,
                    terrain,
                    dependencies,
                    defaultBrushInfo
                );
            } catch (error) {
                console.error('[GlobalTerrainHoverHandler] Error calling mining hover panel:', error);
            }
        } else {
            console.warn('[GlobalTerrainHoverHandler] Mining hover panel not available');
        }
    } else {
        // Hide the hover panel if no intersection
        if (window.improvedMiningHoverPanel) {
            window.improvedMiningHoverPanel.hide();
        }
    }
}

// Export the interface for global access
export const globalTerrainHoverHandler = {
    init: initGlobalTerrainHoverHandler,
    updateMeshes: updateTerrainMeshes
};

// Make the interface available globally
if (typeof window !== 'undefined') {
    window.globalTerrainHoverHandler = globalTerrainHoverHandler;
}
