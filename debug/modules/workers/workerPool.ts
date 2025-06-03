import * as THREE from 'three';
import Worker from "web-worker"; 
import type { LoadedChunks } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { getChunkKeyY } from '../../utils_debug';
import { eventThrottled } from '../../logThrottler';
import { disposeNode } from '../../disposeNode_debug'; // Needed if mesh generated but chunk unloaded

// --- Constants --- 
export const NUM_WORKERS = 3;

// --- Type Definitions --- 
// Define expected message type from worker (aligned with WorkerReturnMessage)
export type WorkerReturnMessage = [number, number, number, any]; 

// Interface for PlanetCompositionInfo structure needed by material function
interface PlanetCompositionInfo {
    dominantElement: string | null;
    topElements: TopElementsData | null;
}

// --- Module State / Dependencies (Set via init) --- 
let _scene: THREE.Scene | null = null;
let _PLANET_COMPOSITION_INFO: PlanetCompositionInfo | null = null;
let _loadedChunks: LoadedChunks | null = null;

// --- Worker Message Handler --- 
function handleWorkerMessage(e: MessageEvent<WorkerReturnMessage>) {
    if (!_scene || !_PLANET_COMPOSITION_INFO || !_loadedChunks) {
        console.error("Worker message handler dependencies not initialized!");
        return;
    }

    const chunkX = e.data[0];
    const chunkY = e.data[1];
    const chunkZ = e.data[2];
    const meshJson = e.data[3];
    const vertices = meshJson as Float32Array;
    
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);

    // Check if the chunk is still needed (wasn't unloaded while worker was busy)
    if (_loadedChunks[chunkKey]) { 
        
        // Create geometry from vertices
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        // Compute normals
        geometry.computeVertexNormals();

        // Call the material function 
        const material = createUnifiedPlanetMaterial(
            _PLANET_COMPOSITION_INFO.topElements 
        );
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `chunk_${chunkKey}`;

        eventThrottled('worker-finish', 200, `🌱 Worker finished chunk [${chunkX}, ${chunkY}, ${chunkZ}] with Unified material`);
        _scene.add(mesh);
        
        // Update loadedChunks - store mesh, discard noiseMap (no longer needed here)
        _loadedChunks[chunkKey] = { mesh: mesh, noiseMap: null }; 
    } else {
         (console as any).event(`❓ Worker finished chunk [${chunkX}, ${chunkY}, ${chunkZ}], but it was already unloaded.`);
         // Note: No mesh was created or added to the scene, so no disposal needed here.
    }
}

// --- Initialization --- 
export function initWorkerPool(
    scene: THREE.Scene,
    compInfo: PlanetCompositionInfo,
    loadedChunks: LoadedChunks
): Worker[] {
    // Store references needed by the message handler
    _scene = scene;
    _PLANET_COMPOSITION_INFO = compInfo;
    _loadedChunks = loadedChunks;

    const workerPool: Worker[] = [];
    console.log(`Initializing ${NUM_WORKERS} workers...`);

    // Correct worker path
    // Worker URL is relative to this file's location *in the final build/output directory*,
    // OR relative to the HTML file if type='module' and no bundler path resolution is involved.
    // Assuming Vite handles resolution, ../../worker_debug.mts (relative to source) might be correct? 
    // Or maybe ./worker_debug.mts if the worker file is copied to the output root alongside modules?
    // Let's try keeping the original relative path for now, assuming bundler handles it.
    const workerUrl = new URL("../../worker_debug.mts", import.meta.url);

    for (let w = 0; w < NUM_WORKERS; w++) {
        // Use the defined URL
        const worker = new Worker(workerUrl, {
            type: "module",
        });

        worker.addEventListener("message", handleWorkerMessage);
        workerPool.push(worker);
    }
    
    console.log("Worker Pool Initialized.");
    return workerPool;
} 