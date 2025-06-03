import * as THREE from 'three';
import { getScene, getRenderer, getCamera, isCoreInitialized, setGenerationParams } from './core';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../../../constants_debug';
import { logThrottled } from '../../../logThrottler';
import { editNoiseMapChunks } from '../../../noiseMapEditor_debug';
import { getChunkKeyY } from '../../../utils_debug';
import { disposeNode } from '../../../disposeNode_debug';
import { generateMesh as generateMeshVertices } from '../../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../../rendering/materials';
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../../types_debug';
import type { TopElementsData } from '../../types/renderingTypes';

// State
let editBrushMesh: THREE.Mesh | null = null;
let raycastBoxMesh: THREE.Mesh | null = null;
let isEditingEnabled = false;
let currentEditCallback: ((keys: string[]) => void) | null = null;
let statusElementRef: HTMLElement | null = null;
let logPanelElement: HTMLElement | null = null;
let loadedChunks: LoadedChunks | null = null;
let noiseLayers: NoiseLayers | null = null;
let seed: Seed | null = null;
let compInfo: { topElements: TopElementsData | null } | null = null;
let noiseScale: number | null = null;
let planetOffset: THREE.Vector3 | null = null;
let isPointerLocked = false;
let isPointerLockRequested = false;

// Initialize the edit brush visualizer
export function initEditBrush() {
    if (!isCoreInitialized()) {
        console.warn('Cannot initialize edit brush: Core viewer not initialized');
        return;
    }

    const scene = getScene();
    if (!scene) return;

    // Create raycast box mesh
    const raycastGeometry = new THREE.BoxGeometry(
        CHUNK_SIZE,
        CHUNK_HEIGHT * 50,
        CHUNK_SIZE
    );
    const raycastMaterial = new THREE.MeshBasicMaterial({ 
        visible: false, 
        depthWrite: false 
    });
    raycastBoxMesh = new THREE.Mesh(raycastGeometry, raycastMaterial);
    raycastBoxMesh.position.set(0, -CHUNK_HEIGHT * 25, 0);
    raycastBoxMesh.name = "isolated_raycast_box";
    scene.add(raycastBoxMesh);

    // Create edit brush mesh
    const brushGeometry = new THREE.SphereGeometry(1, 32, 32);
    const brushMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.3
    });
    editBrushMesh = new THREE.Mesh(brushGeometry, brushMaterial);
    editBrushMesh.visible = false;
    editBrushMesh.name = "isolated_edit_brush";
    scene.add(editBrushMesh);
}

// Cleanup edit brush
export function cleanupEditBrush() {
    const scene = getScene();
    if (!scene) return;

    if (raycastBoxMesh) {
        scene.remove(raycastBoxMesh);
        raycastBoxMesh.geometry.dispose();
        (raycastBoxMesh.material as THREE.Material).dispose();
        raycastBoxMesh = null;
    }

    if (editBrushMesh) {
        scene.remove(editBrushMesh);
        editBrushMesh.geometry.dispose();
        (editBrushMesh.material as THREE.Material).dispose();
        editBrushMesh = null;
    }
}

// Setup editing functionality
export function setupEditing(
    statusElement: HTMLElement,
    logPanel: HTMLElement,
    callback: (keys: string[]) => void,
    chunks: LoadedChunks,
    layers: NoiseLayers,
    currentSeed: Seed,
    compositionInfo: { topElements: TopElementsData | null },
    scale: number,
    offset: THREE.Vector3
) {
    if (!isCoreInitialized()) {
        console.warn('Cannot setup editing: Core viewer not initialized');
        return;
    }

    // Sync core viewer's terrain data for debug preview and swatches
    setGenerationParams({
        noiseLayers: layers,
        seed: currentSeed,
        compInfo: compositionInfo,
        noiseScale: scale,
        planetOffset: offset
    });

    const renderer = getRenderer();
    if (!renderer) return;

    // Check if pointer is already locked
    if (document.pointerLockElement) {
        console.warn("Cannot setup editing: Pointer is already locked");
        return;
    }

    // Force mining tab active
    if (typeof window !== 'undefined' && window.miningPanelTabUtils &&
        typeof window.miningPanelTabUtils.setMiningTabActiveStatus === 'function') {
        console.log("[IsolatedTerrainViewer] Explicitly activating mining tab from setupIsolatedEditing...");
        window.miningPanelTabUtils.setMiningTabActiveStatus(true);
    }

    // Store dependencies
    loadedChunks = chunks;
    noiseLayers = layers;
    seed = currentSeed;
    compInfo = compositionInfo;
    noiseScale = scale;
    planetOffset = offset;

    isEditingEnabled = true;
    currentEditCallback = callback;
    statusElementRef = statusElement;
    logPanelElement = logPanel;

    // Clear any old logs on setup
    if (logPanelElement) {
        logPanelElement.innerHTML = '';
    }

    if (statusElementRef) {
        statusElementRef.textContent = 'Ready';
    }

    const canvas = renderer.domElement;
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleEdit);
    canvas.oncontextmenu = (e) => e.preventDefault();

    // Add pointer lock change listener
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('pointerlockerror', handlePointerLockError);
}

// Cleanup editing functionality
export function cleanupEditing() {
    const renderer = getRenderer();
    if (!renderer) return;

    const canvas = renderer.domElement;
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('mousedown', handleEdit);
    canvas.oncontextmenu = null;

    // Remove pointer lock change listener
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    document.removeEventListener('pointerlockerror', handlePointerLockError);

    // Exit pointer lock if we have it
    if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
    }

    isEditingEnabled = false;
    currentEditCallback = null;
    isPointerLocked = false;
    isPointerLockRequested = false;
    statusElementRef = null;
    logPanelElement = null;
    loadedChunks = null;
    noiseLayers = null;
    seed = null;
    compInfo = null;
    noiseScale = null;
    planetOffset = null;
}

// Handle pointer lock changes
function handlePointerLockChange() {
    const renderer = getRenderer();
    if (!renderer) return;

    isPointerLocked = document.pointerLockElement === renderer.domElement;
    isPointerLockRequested = false;

    if (!isPointerLocked && isEditingEnabled) {
        cleanupEditing();
    }
}

// Handle pointer lock errors
function handlePointerLockError() {
    console.warn('Pointer lock error - this is expected if user cancels or if another system has lock');
    isPointerLockRequested = false;
}

// Handle mouse movement for editing
function handleMouseMove(event: MouseEvent) {
    if (!isEditingEnabled || !raycastBoxMesh || !editBrushMesh || !isPointerLocked) {
        return;
    }

    const renderer = getRenderer();
    const camera = getCamera();
    if (!renderer || !camera) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(getScene()?.children || [], true);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        raycastBoxMesh.position.copy(point);
        editBrushMesh.position.copy(point);
        raycastBoxMesh.visible = true;
        editBrushMesh.visible = true;

        // Update mining hover info
        if (typeof window !== 'undefined' && (window as any).miningPanelTabUtils &&
            typeof (window as any).miningPanelTabUtils.updateHoverCompositionInfo === 'function') {
            (window as any).miningPanelTabUtils.updateHoverCompositionInfo(point, null, null);
        }
    } else {
        raycastBoxMesh.visible = false;
        editBrushMesh.visible = false;
        
        // Clear mining hover info
        if (typeof window !== 'undefined' && (window as any).miningPanelTabUtils &&
            typeof (window as any).miningPanelTabUtils.updateHoverCompositionInfo === 'function') {
            (window as any).miningPanelTabUtils.updateHoverCompositionInfo(null, null, null);
        }
    }
}

// Handle edit action
function handleEdit(event: MouseEvent) {
    if (!isEditingEnabled || !raycastBoxMesh || !editBrushMesh || !currentEditCallback || !isPointerLocked ||
        !loadedChunks || !noiseLayers || !seed || !compInfo || noiseScale === null || planetOffset === null) {
        return;
    }

    const renderer = getRenderer();
    const camera = getCamera();
    if (!renderer || !camera) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(getScene()?.children || [], true);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        const remove = event.button === 2; // Right click removes

        // Call noise map editor
        const affectedChunkCoords = editNoiseMapChunks(
            loadedChunks,
            point,
            remove,
            noiseLayers,
            seed
        );

        // Regenerate meshes for affected chunks
        for (const coords of affectedChunkCoords) {
            const [cx, cy, cz] = coords;
            const chunkKey = getChunkKeyY(cx, cy, cz);
            const chunkData = loadedChunks[chunkKey];

            if (!chunkData || !chunkData.noiseMap) {
                console.error(`Cannot regenerate mesh for ${chunkKey}: Missing data after edit.`);
                continue;
            }

            // Generate new mesh
            const geometry = generateMeshVertices(cx, cy, cz, { noiseMap: chunkData.noiseMap }, true);
            geometry.computeVertexNormals();

            const material = createUnifiedPlanetMaterial(
                compInfo.topElements,
                noiseScale,
                planetOffset
            );

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
            mesh.name = `chunk_${chunkKey}`;

            // Update the loadedChunks map
            if (chunkData.mesh) {
                disposeNode(getScene()!, chunkData.mesh);
            }
            chunkData.mesh = mesh;
            getScene()?.add(mesh);
        }

        // Notify about affected chunks
        const affectedKeys = affectedChunkCoords.map(([x, y, z]) => getChunkKeyY(x, y, z));
        currentEditCallback(affectedKeys);

        // Log the edit action
        if (logPanelElement) {
            appendLogMessage({
                type: 'mine',
                coords: point,
                message: 'Terrain edited',
                materialName: 'Terrain',
                materialColor: new THREE.Color(0x00ff00),
                amount: 1
            });
        }
    } else {
        // Log miss
        if (logPanelElement) {
            appendLogMessage({
                type: 'miss',
                message: 'Click missed terrain'
            });
        }
    }
}

// Update brush visualizer
export function updateBrushVisualizer(radius: number, shape: 'sphere' | 'cube' | 'cylinder') {
    if (!editBrushMesh) return;

    const scene = getScene();
    if (!scene) return;

    scene.remove(editBrushMesh);
    editBrushMesh.geometry.dispose();

    let geometry: THREE.BufferGeometry;
    switch (shape) {
        case 'cube':
            geometry = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(radius, radius, radius * 2, 32);
            break;
        default: // sphere
            geometry = new THREE.SphereGeometry(radius, 32, 32);
    }

    editBrushMesh.geometry = geometry;
    scene.add(editBrushMesh);
}

// Log message helper
interface LogData {
    type: 'mine' | 'miss' | 'error' | 'info';
    coords?: THREE.Vector3;
    materialIndex?: number;
    materialSymbol?: string;
    materialName?: string;
    materialColor?: THREE.Color;
    amount?: number;
    message?: string;
}

function appendLogMessage(data: LogData) {
    if (!logPanelElement) return;

    const logEntry = document.createElement('p');
    logEntry.style.margin = '4px 0';
    logEntry.style.fontSize = '1.1em';
    logEntry.style.fontFamily = 'monospace';
    logEntry.style.lineHeight = '1.5';
    logEntry.style.borderBottom = '1px dashed rgba(255, 255, 255, 0.1)';
    logEntry.style.paddingBottom = '4px';

    if (data.type === 'mine' && data.coords && data.materialName !== undefined && data.materialColor && data.amount !== undefined) {
        const colorHex = data.materialColor.getHexString();
        const bgColor = `rgba(${data.materialColor.r * 255}, ${data.materialColor.g * 255}, ${data.materialColor.b * 255}, 0.15)`;
        logEntry.innerHTML =
            `⛏️ <span style="color: #aaa;">[${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span> Mined: ${data.amount} ` +
            `<span style="color: #${colorHex}; font-weight: bold; background-color: ${bgColor}; padding: 1px 3px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.2);">${data.materialName}</span>`;
    } else if (data.type === 'miss') {
        logEntry.innerHTML = `<span style="color: #ffcc00;">⚠️ ${data.message || 'Click missed terrain.'}</span>`;
    } else if (data.type === 'error') {
        logEntry.innerHTML = `<span style="color: #ff6666;">❌ Error: ${data.message || 'Unknown error'}</span>`;
        if (data.coords) {
            logEntry.innerHTML += ` <span style="color: #aaa;">at [${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span>`;
        }
    } else if (data.type === 'info') {
        logEntry.innerHTML = `<span style="color: #66ccff;">ℹ️ ${data.message || 'Info'}</span>`;
        if (data.coords) {
            logEntry.innerHTML += ` <span style="color: #aaa;">at [${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span>`;
        }
    } else {
        logEntry.textContent = data.message || 'Unknown log entry.';
    }

    logPanelElement.appendChild(logEntry);
    logPanelElement.scrollTop = logPanelElement.scrollHeight;

    // Limit number of log entries
    const maxLogEntries = 50;
    while (logPanelElement.children.length > maxLogEntries) {
        logPanelElement.removeChild(logPanelElement.firstChild!);
    }
}

// Getters
export function getEditBrushMesh() { return editBrushMesh; }
export function getRaycastBoxMesh() { return raycastBoxMesh; }
export function isEditingActive() { return isEditingEnabled; }