import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { editNoiseMapChunks } from '../../noiseMapEditor_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { disposeNode } from '../../disposeNode_debug';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { getMaterialIndexAtPoint_TS } from '../../../src/modules/rendering/InternalMaterialGrid';

// --- Module State ---
let containerElement: HTMLDivElement | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let animationFrameId: number | null = null;
let terrainMesh: THREE.Mesh | null = null;
let terrainNoiseMap: any = null; // Changed from NoiseMap to any to fix type error

// Touch state
let touchStartX = 0;
let touchStartY = 0;
let touchStartDistance = 0;
let isPinching = false;
let isRotating = false;
let lastTouchX = 0;
let lastTouchY = 0;
let lastPinchDistance = 0;

// Parameters needed for regeneration/editing
// Use any type for these to avoid type definition issues
let currentNoiseLayers: any = null;
let currentSeed: any = null;
let currentCompInfo: { topElements: TopElementsData | null } | null = null;
let currentPlanetOffset: THREE.Vector3 | null = null;
let currentNoiseScale: number | null = null;

let logCallback: ((keys: string[]) => void) | null = null; // Callback to report affected chunks
const ISOLATED_CHUNK_KEY = '0,0';

// UI Elements controlled by this module (references passed in)
let statusElementRef: HTMLElement | null = null;
let statusTimeoutId: number | null = null;
let internalVisualizerLayers: THREE.Mesh[] = []; // <<< Use array for layers
let logPanelElement: HTMLElement | null = null; // <<< ADD state for log panel

// --- Initialization ---
export function initIsolatedViewer(container: HTMLDivElement) {
    if (!container) {
        console.error("IsolatedViewer: Container element is required.");
        throw new Error("Container element is required.");
    }
    containerElement = container;

    // Basic Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a202c'); // Match dark panel header background

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement); // Add canvas to container

    // Camera (Perspective for now, top-down view)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    camera.position.set(0, 50, 0); // Position above the center
    camera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = true;
    controls.update();

    // Handle Resize
    const onResize = () => {
        if (!renderer || !camera || !containerElement) return;
        const width = containerElement.clientWidth;
        const height = containerElement.clientHeight;
        renderer.setSize(width, height);
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.aspect = width / height;
        }
        camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(containerElement);
    (containerElement as any).__resizeObserver = resizeObserver;

    // Start Render Loop
    animate();

    console.log("Isolated Terrain Viewer Initialized");
}

// --- View Reset Function ---
export function resetIsolatedView() {
    if (camera && controls) {
        camera.position.set(0, 50, 0);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
        console.log("Isolated Viewer: View Reset.");
        if (statusElementRef) {
            statusElementRef.textContent = 'View reset.';
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef) statusElementRef.textContent = 'Ready';
            }, 1500);
        }
    } else {
        console.warn("Isolated Viewer: Cannot reset view, camera or controls missing.");
    }
}

// --- Terrain Generation ---
interface GenerationParams {
    noiseLayers: any;
    seed: any;
    compInfo: { topElements: TopElementsData | null };
    noiseScale?: number;
    planetOffset?: THREE.Vector3;
}
export function generateIsolatedTerrain(params: GenerationParams) {
    if (!scene) {
        console.error("IsolatedViewer: Scene not initialized for terrain generation.");
        return;
    }
    currentNoiseLayers = params.noiseLayers;
    currentSeed = params.seed;
    currentCompInfo = params.compInfo;
    currentNoiseScale = params.noiseScale ?? 0.1;
    currentPlanetOffset = params.planetOffset ?? new THREE.Vector3(Math.random() * 100, Math.random() * 100, Math.random() * 100);
    console.log(`IsolatedViewer: Using Noise Scale: ${currentNoiseScale}, Offset:`, currentPlanetOffset);

    if (terrainMesh) {
        disposeNode(scene, terrainMesh);
        terrainMesh = null;
        terrainNoiseMap = null;
    }
    if (internalVisualizerLayers.length > 0) {
        console.log(`IsolatedViewer: Cleaning up ${internalVisualizerLayers.length} old visualizer layers.`);
        internalVisualizerLayers.forEach(layer => disposeNode(scene!, layer));
        internalVisualizerLayers = [];
    }

    console.log("IsolatedViewer: Generating noise map for chunk [0,0]...");
    try {
        terrainNoiseMap = generateNoiseMap(0, 0, 0, currentNoiseLayers, currentSeed, false);
        console.log("IsolatedViewer: Noise map generated successfully.");
    } catch (error: any) {
        console.error("IsolatedViewer: Error generating noise map:", error);
        terrainNoiseMap = null;
        return;
    }

    regenerateMesh();

    if (controls && camera) {
        controls.target.set(0, 0, 0);
        camera.position.set(0, 50, 0);
        camera.lookAt(0,0,0);
        controls.update();
    }
}

// --- Mesh Regeneration ---
function regenerateMesh() {
    if (!scene || !terrainNoiseMap || !currentCompInfo || currentNoiseScale === null || currentPlanetOffset === null) {
        console.error("IsolatedViewer: Cannot regenerate mesh, missing scene, noise map, compInfo, or noise params.");
        return;
    }

    if (terrainMesh) {
        disposeNode(scene, terrainMesh);
        terrainMesh = null;
    }
    if (internalVisualizerLayers.length > 0) {
        internalVisualizerLayers.forEach(layer => disposeNode(scene!, layer));
        internalVisualizerLayers = [];
    }

    console.log("IsolatedViewer: Regenerating mesh and internal visualizer layers...");
    const vertices = generateMeshVertices(0, 0, 0, { noiseMap: terrainNoiseMap }, true);

    if (!vertices || vertices.length === 0) {
        console.warn("IsolatedViewer: Mesh generation produced no vertices.");
        return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    const material = createUnifiedPlanetMaterial(
        currentCompInfo.topElements,
        currentNoiseScale,
        currentPlanetOffset
    );
    if (material.uniforms.u_showInternalMaterial) {
        material.uniforms.u_showInternalMaterial.value = false;
    }

    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.name = `isolated_chunk_${ISOLATED_CHUNK_KEY}`;
    terrainMesh.renderOrder = 1;
    scene.add(terrainMesh);
    console.log("IsolatedViewer: Main terrain mesh regenerated.");

    const numberOfLayers = 8;
    const layerSpacing = 0.25;
    const startOffset = 0.25;
    try {
        const visualizerMaterial = createInternalVisualizerMaterial(
            currentCompInfo.topElements,
            currentNoiseScale,
            currentPlanetOffset
        );

        for (let i = 0; i < numberOfLayers; i++) {
            const visualizerGeometry = geometry.clone();
            const layerMesh = new THREE.Mesh(visualizerGeometry, visualizerMaterial);
            layerMesh.name = `internal_visualizer_layer_${i}`;
            layerMesh.position.y = -startOffset - (i * layerSpacing);
            scene.add(layerMesh);
            internalVisualizerLayers.push(layerMesh);
        }
        console.log(`IsolatedViewer: Created ${internalVisualizerLayers.length} internal visualizer layers.`);
    } catch (error) {
        console.error("IsolatedViewer: Failed to create internal visualizer layers:", error);
        internalVisualizerLayers.forEach(layer => disposeNode(scene!, layer));
        internalVisualizerLayers = [];
    }
}

// --- Editing Setup ---
export function setupIsolatedEditing(
    statusElement: HTMLElement,
    logPanel: HTMLElement,
    callback: (keys: string[]) => void
) {
    if (!renderer || !camera || !scene) {
        console.error("IsolatedViewer: Cannot set up editing - viewer not fully initialized.");
        return;
    }
    logCallback = callback;
    statusElementRef = statusElement;
    logPanelElement = logPanel;

    if (logPanelElement) {
        logPanelElement.innerHTML = '';
    }

    if (statusElementRef) {
        statusElementRef.textContent = 'Ready';
    }

    const canvas = renderer.domElement;
    
    canvas.addEventListener('mousedown', handleIsolatedEdit);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}

// --- Log Appending Helper ---
interface LogData {
    type: 'mine' | 'miss' | 'error';
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

    if (data.type === 'mine' && data.coords && data.materialName !== undefined && data.materialColor && data.amount !== undefined && data.materialIndex !== undefined) {
        const colorHex = data.materialColor.getHexString();
        const bgColor = `rgba(${data.materialColor.r * 255}, ${data.materialColor.g * 255}, ${data.materialColor.b * 255}, 0.15)`;
        logEntry.innerHTML = 
            `⛏️ <span style="color: #aaa;">[${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span> Mined: ${data.amount} ` +
            `<span style="color: #${colorHex}; font-weight: bold; background-color: ${bgColor}; padding: 1px 3px; border-radius: 3px; border: 1px solid rgba(255, 255, 255, 0.2);">${data.materialName}</span> ` +
            `<span style="color: #aaa;">(Index: ${data.materialIndex})</span>`;
    } else if (data.type === 'miss') {
        logEntry.innerHTML = `<span style="color: #ffcc00;">⚠️ ${data.message || 'Click missed terrain.'}</span>`;
    } else if (data.type === 'error') {
        logEntry.innerHTML = `<span style="color: #ff6666;">❌ Error: ${data.message || 'Unknown error'}</span>`;
        if (data.coords) {
            logEntry.innerHTML += ` <span style="color: #aaa;">at [${data.coords.x.toFixed(1)}, ${data.coords.y.toFixed(1)}, ${data.coords.z.toFixed(1)}]</span>`;
        }
    } else {
        logEntry.textContent = data.message || 'Unknown log entry.';
    }

    logPanelElement.appendChild(logEntry);

    logPanelElement.scrollTop = logPanelElement.scrollHeight;

    const maxLogEntries = 50;
    while (logPanelElement.children.length > maxLogEntries) {
        logPanelElement.removeChild(logPanelElement.firstChild!);
    }
}

// --- Editing Handler ---
function handleIsolatedEdit(event: MouseEvent) {
    if (!renderer || !camera || !scene || !terrainMesh || !terrainNoiseMap || !currentNoiseLayers || !currentSeed || !currentCompInfo || currentNoiseScale === null || currentPlanetOffset === null) {
        console.warn("IsolatedViewer: Cannot perform edit, dependencies missing (scene, mesh, map, layers, seed, compInfo, noiseParams).");
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(terrainMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;
        const shouldRemove = event.button === 0;
        const shouldAdd = event.button === 2;

        const actionText = shouldRemove ? 'Removed (Mine)' : (shouldAdd ? 'Added' : 'Unknown Action');
        const coordsText = `[X: ${point.x.toFixed(1)}, Z: ${point.z.toFixed(1)}]`;

        console.log(`Isolated Edit: Button ${event.button} -> ${actionText} terrain at ${coordsText}`);

        let resourceMessage = '';

        if (shouldRemove) {
            try {
                const minedMaterialIndex = getMaterialIndexAtPoint_TS(
                    point,
                    currentCompInfo.topElements!,
                    currentNoiseScale!,
                    currentPlanetOffset!
                );
                const materialSymbol = currentCompInfo.topElements!.symbols[minedMaterialIndex] || 'Unknown Ore';
                const materialColor = currentCompInfo.topElements!.colors[minedMaterialIndex] || new THREE.Color(0xffffff);
                const yieldAmount = 1;
                const materialName = currentCompInfo.topElements!.names[minedMaterialIndex] || materialSymbol;

                resourceMessage = `Mined: ${yieldAmount} ${materialSymbol} at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`;
                
                appendLogMessage({ 
                    type: 'mine', 
                    coords: point, 
                    materialIndex: minedMaterialIndex, 
                    materialSymbol: materialSymbol, 
                    materialName: materialName, 
                    materialColor: materialColor, 
                    amount: yieldAmount 
                });
            } catch (error: any) {
                console.error("IsolatedViewer: Error during resource calculation:", error);
                const errorMessage = `Error calculating resource at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`;
                appendLogMessage({ type: 'error', message: error.message || 'Unknown error', coords: point });
                resourceMessage = "Error during mining.";
            }
        } else if (shouldAdd) {
            resourceMessage = `Added terrain at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`;
        } else {
            resourceMessage = `Unknown click action (Button: ${event.button})`;
        }

        const pseudoLoadedChunks = {
            [ISOLATED_CHUNK_KEY]: {
                noiseMap: terrainNoiseMap,
                mesh: terrainMesh,
                needsUpdate: false,
                lastUsed: performance.now(),
                materialGrid: null
            }
        };

        const editChunksCoordsResult = editNoiseMapChunks(
            pseudoLoadedChunks,
            point,
            shouldRemove,
            currentNoiseLayers,
            currentSeed
        );

        if (pseudoLoadedChunks[ISOLATED_CHUNK_KEY]) {
            terrainNoiseMap = pseudoLoadedChunks[ISOLATED_CHUNK_KEY].noiseMap;
            console.log("IsolatedViewer: Updated terrainNoiseMap after edit.");
        } else {
            console.warn("IsolatedViewer: Could not find edited noise map in pseudoLoadedChunks to update.");
        }

        regenerateMesh();

        if (logCallback) {
            const validCoords = editChunksCoordsResult.filter(coords => coords && coords.length === 2) as [number, number][];
            const affectedKeys = validCoords.map(coords => `${coords[0]},${coords[1]}`);
            logCallback(affectedKeys);
        }

        if (statusElementRef) {
            statusElementRef.textContent = resourceMessage || `${actionText} terrain at ${coordsText}`;
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef) statusElementRef.textContent = 'Ready';
            }, 3000);
        }
    } else {
        const missMessage = "Click missed terrain.";
        console.log("Isolated Edit: " + missMessage);
        appendLogMessage({ type: 'miss', message: missMessage });
        if (statusElementRef) {
            statusElementRef.textContent = 'Click missed terrain.';
            if (statusTimeoutId) clearTimeout(statusTimeoutId);
            statusTimeoutId = window.setTimeout(() => {
                if (statusElementRef) statusElementRef.textContent = 'Ready';
            }, 1500);
        }
    }
}

// --- Touch Event Handlers ---
function handleTouchStart(event: TouchEvent) {
    event.preventDefault();
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        isRotating = false;
    } else if (event.touches.length === 2) {
        isPinching = true;
        isRotating = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        touchStartDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        lastPinchDistance = touchStartDistance;
    }
}

function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    
    if (event.touches.length === 1 && !isPinching) {
        const touch = event.touches[0];
        const deltaX = touch.clientX - lastTouchX;
        const deltaY = touch.clientY - lastTouchY;
        
        if (controls) {
            const azimuthAngle = 2 * Math.PI * deltaX / renderer!.domElement.clientWidth;
            const polarAngle = 2 * Math.PI * deltaY / renderer!.domElement.clientHeight;
            
            const position = new THREE.Vector3();
            const target = new THREE.Vector3();
            position.copy(camera.position);
            target.copy(controls.target);
            
            const rotationMatrix = new THREE.Matrix4().makeRotationY(azimuthAngle);
            position.sub(target);
            position.applyMatrix4(rotationMatrix);
            position.add(target);
            
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(up, target.clone().sub(position)).normalize();
            const rotationMatrixX = new THREE.Matrix4().makeRotationAxis(right, polarAngle);
            position.sub(target);
            position.applyMatrix4(rotationMatrixX);
            position.add(target);
            
            camera.position.copy(position);
            camera.lookAt(target);
            controls.update();
        }
        
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        isRotating = true;
    } else if (event.touches.length === 2 && isPinching) {
        // Two touches - handle pinch/rotate
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        
        // Calculate current distance between fingers
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
        
        // Zoom based on pinch distance change
        if (camera instanceof THREE.PerspectiveCamera && controls) {
            const zoomDelta = (lastPinchDistance - currentDistance) * 0.01;
            camera.fov += zoomDelta * 5;
            camera.fov = Math.max(20, Math.min(100, camera.fov)); // Clamp FOV
            camera.updateProjectionMatrix();
        }
        
        lastPinchDistance = currentDistance;
    }
}

function handleTouchEnd(event: TouchEvent) {
    event.preventDefault();
    
    if (event.touches.length === 0) {
        // All touches ended
        isPinching = false;
        isRotating = false;
    } else if (event.touches.length === 1) {
        // One finger lifted, but another remains
        isPinching = false;
        const touch = event.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
    }
    
    // Handle tap (if touch didn't move much)
    if (!isRotating && event.changedTouches?.length === 1) {
        const touch = event.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        
        const deltaX = Math.abs(touchEndX - touchStartX);
        const deltaY = Math.abs(touchEndY - touchStartY);
        
        // If touch moved less than 10px, consider it a tap
        if (deltaX < 10 && deltaY < 10) {
            // Simulate a left-click at the touch position
            const fakeEvent = new MouseEvent('mousedown', {
                clientX: touchEndX,
                clientY: touchEndY,
                button: 0 // Left click
            });
            handleIsolatedEdit(fakeEvent);
        }
    }
}

// --- Render Loop ---
function animate() {
    if (!renderer || !scene || !camera) return; // Stop if cleaned up
    animationFrameId = requestAnimationFrame(animate);
    
    // Only update controls if not currently being controlled by touch
    if (controls && !isPinching && !isRotating) {
        controls.update();
    }
    
    renderer.render(scene, camera);
}

// --- Cleanup ---
export function cleanupIsolatedViewer() {
    console.log("Cleaning up Isolated Terrain Viewer...");
    
    // Remove touch event listeners
    if (renderer) {
        const canvas = renderer.domElement;
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
    }
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (statusTimeoutId) { // Clear timeout on cleanup
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }

    if (renderer) {
         renderer.domElement.removeEventListener('mousedown', handleIsolatedEdit);
         // How to remove contextmenu listener added anonymously?
         // For now, leave it, or assign null if it works reliably:
         renderer.domElement.oncontextmenu = null;
    }
    if (containerElement && (containerElement as any).__resizeObserver) {
        (containerElement as any).__resizeObserver.disconnect();
        delete (containerElement as any).__resizeObserver;
    }

    if (scene) {
        // Dispose children manually before disposing scene might be safer
        if (terrainMesh) disposeNode(scene, terrainMesh);
        if (internalVisualizerLayers.length > 0) { // <<< Cleanup layers array
            internalVisualizerLayers.forEach(layer => disposeNode(scene!, layer));
        }
         // Dispose lights? Usually not necessary unless complex/many
        scene = null; // Release scene reference first
    }
     if (terrainMesh) {
        terrainMesh = null;
    }
    internalVisualizerLayers = []; // <<< Clear array
    if (controls) {
        controls.dispose();
        controls = null;
    }
    if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement) {
            renderer.domElement.parentElement.removeChild(renderer.domElement);
        }
        renderer = null;
    }

    camera = null;
    terrainNoiseMap = null;
    currentNoiseLayers = null;
    currentSeed = null;
    currentCompInfo = null;
    currentPlanetOffset = null;
    currentNoiseScale = null;
    statusElementRef = null; // Clear status element reference
    logPanelElement = null; // <<< Clear log panel reference
    logCallback = null;
    containerElement = null;

    console.log("Isolated Terrain Viewer Cleaned Up");
} 