import * as THREE from 'three';
import type { LoadedChunks, NoiseLayers, Seed } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { editNoiseMapChunks } from '../../noiseMapEditor_debug';
import { getChunkKeyY } from '../../utils_debug';
import { disposeNode } from '../../disposeNode_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { logThrottled, eventThrottled } from '../../logThrottler';
import { workerMeshGen } from '../../workerMeshGen_debug';

// --- Constants --- 
const EDIT_THROTTLE_MS = 1000; // Throttle time between edits

// --- Module State --- 
let _scene: THREE.Scene | null = null;
let _camera: THREE.PerspectiveCamera | null = null;
let _loadedChunks: LoadedChunks | null = null;
let _noiseLayers: NoiseLayers | null = null;
let _seed: Seed | null = null;
let _PLANET_COMPOSITION_INFO: { topElements: TopElementsData | null } | null = null;

const mouse = [false, false]; // [left_button_down, right_button_down]
let lastEditTime = 0;
const editRaycaster = new THREE.Raycaster();
let _initialized = false;

// Interface for PlanetCompositionInfo structure expected
interface PlanetCompositionInfo {
    dominantElement: string | null;
    topElements: TopElementsData | null;
}

function performTerrainEdit() {
    if (!_initialized || !_camera || !_scene || !_loadedChunks || !_noiseLayers || !_seed || !_PLANET_COMPOSITION_INFO) {
        console.error("Terrain Editor not initialized or missing dependencies for edit.");
        return;
    }

    // Set raycaster from camera
    const cameraDir = new THREE.Vector3();
    _camera.getWorldDirection(cameraDir);
    editRaycaster.set(_camera.position, cameraDir);

    // --- Intersect ONLY with meshes currently in loadedChunks ---
    const meshesToIntersect: THREE.Mesh[] = Object.values(_loadedChunks)
                                            .map(chunkData => chunkData.mesh)
                                            .filter((mesh): mesh is THREE.Mesh => mesh !== null && mesh instanceof THREE.Mesh);

    if (meshesToIntersect.length === 0) {
        logThrottled('terrain-edit-no-mesh', 1000, `⛏️ Edit attempt: No loaded chunk meshes found to intersect.`);
        return; // No loaded meshes to intersect
    }

    const intersects = editRaycaster.intersectObjects(meshesToIntersect);
    // --- End Intersection Change ---

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const remove = !mouse[0] && mouse[1]; // True if right mouse is down and left is up
        
        eventThrottled('terrain-edit-attempt', EDIT_THROTTLE_MS, `⛏️ Edit Attempt at ${point.toArray().map(p=>p.toFixed(1)).join(', ')}. Remove: ${remove}`);

        // --- Call noise map editor (returns coords of affected chunks [x, y, z]) ---
        const editChunksCoords: number[][] = editNoiseMapChunks(
            _loadedChunks!, // Pass loaded chunks so it can modify neighbor maps if needed
            point,
            remove,
            _noiseLayers!,
            _seed!
        );
        // --- End noise map edit call ---

        // --- Regenerate meshes for affected chunks IF THEY ARE STILL LOADED ---
        editChunksCoords.forEach((chunkCoords) => {
            const chunkX = chunkCoords[0];
            const chunkY = chunkCoords[1]; 
            const chunkZ = chunkCoords[2];
            const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
            
            // *** Check if the affected chunk is currently loaded ***
            if (_loadedChunks && _loadedChunks[chunkKey]) { 
                const chunkData = _loadedChunks[chunkKey];
                const { mesh: oldMesh, noiseMap } = chunkData;
                
                if (!noiseMap) {
                    // This case should be less likely if editNoiseMapChunks handles map generation
                    console.error(`Error: NoiseMap missing for loaded chunk ${chunkKey} during edit update.`);
                    return; // Skip if noiseMap is unexpectedly missing
                }
                
                logThrottled('mesh-update-start', 500, `🖌️ Updating mesh for edited chunk [${chunkX}, ${chunkY}, ${chunkZ}]`);
                
                // Dispose old mesh if it exists
                if (oldMesh) {
                     disposeNode(_scene!, oldMesh);
                }

                // -- START CHANGE: Use Worker for Mesh Generation --
                // TODO: Ensure workerMeshGen is initialized and available in this scope
                // TODO: Need to handle neighbor data for generateChunkMesh if required for seams
                workerMeshGen.generateChunkMesh(
                    { x: chunkX, y: chunkY, z: chunkZ, noiseMap: noiseMap },
                    { /* Provide neighbor noise maps if needed */ } // TODO: Fetch/pass neighbor data
                ).then((geometry: THREE.BufferGeometry) => {
                    if (!_loadedChunks || !_loadedChunks[chunkKey] || !_scene || !_PLANET_COMPOSITION_INFO) {
                        console.warn(`Skipping mesh update for ${chunkKey}, state changed during async generation.`);
                        geometry.dispose(); // Dispose the unused geometry
                        return; 
                    }

                    const material = createUnifiedPlanetMaterial(
                        _PLANET_COMPOSITION_INFO!.topElements
                    );
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.name = `chunk_${chunkKey}`;
    
                    // Update the loadedChunks map with the new mesh
                    _loadedChunks[chunkKey].mesh = mesh;
                    _scene!.add(mesh); // Add new mesh to the scene
                    logThrottled('mesh-update-complete', 500, `✅ Worker finished mesh for edited chunk [${chunkX}, ${chunkY}, ${chunkZ}]`);

                }).catch((error: Error) => {
                     console.error(`Worker failed to generate mesh for edited chunk ${chunkKey}:`, error);
                });
                // -- END CHANGE --

            } else {
                // Log that we are skipping because the chunk wasn't found in the main loaded list
                logThrottled('mesh-update-skip-unloaded', 500, `❓ Skipped mesh update for unloaded chunk [${chunkX}, ${chunkY}, ${chunkZ}] after edit.`);
            }
        });
        // --- End mesh regeneration ---

    } else {
        logThrottled('terrain-edit-miss', 1000, `⛏️ Edit attempt missed terrain (no intersection with loaded chunks).`);
    }
}

// --- Event Listeners --- 
const onMouseDown = (e: MouseEvent) => {
    switch (e.button) {
        case 0: mouse[0] = true; break; // Left Click (Add Terrain)
        case 2: mouse[1] = true; break; // Right Click (Remove Terrain)
        // Removed preventDefault here, as it's likely handled elsewhere if needed for this module
    }
    // Attempt edit on mouse down, throttled
    const now = performance.now();
    if (now - lastEditTime > EDIT_THROTTLE_MS) {
        eventThrottled('edit-terrain-click', EDIT_THROTTLE_MS, `🖱️ Edit input detected`);
        performTerrainEdit();
        lastEditTime = now;
    } else {
        logThrottled('edit-throttle-reject', 500, `🖱️ Edit rejected (throttle: ${((EDIT_THROTTLE_MS - (now - lastEditTime))/1000).toFixed(1)}s left)`);
    }
};

const onMouseUp = (e: MouseEvent) => {
    switch (e.button) {
        case 0: mouse[0] = false; break;
        case 2: mouse[1] = false; break;
    }
};

// --- Initialization --- 
export function initTerrainEditor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    loadedChunks: LoadedChunks, // Pass the main map
    noiseLayers: NoiseLayers,
    seed: Seed,
    compInfo: PlanetCompositionInfo
) {
    _scene = scene;
    _camera = camera;
    _loadedChunks = loadedChunks; // Store reference to the main map
    _noiseLayers = noiseLayers;
    _seed = seed;
    _PLANET_COMPOSITION_INFO = compInfo;

    // Add listeners
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    _initialized = true;
    console.log("Terrain Editor Initialized");
}

// Optional: Add a cleanup function to remove listeners if needed
export function cleanupTerrainEditor() {
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    _initialized = false;
     console.log("Terrain Editor Cleaned Up");
} 