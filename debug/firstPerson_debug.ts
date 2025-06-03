import * as THREE from "three";
console.log('[FIRSTPERSON_DEBUG] Script execution started!');
import { storageKeys, CHUNK_SIZE } from "./constants_debug";
import {
  LoadedChunks,
  NoiseLayers,
  UpdateController,
} from "./types_debug";
import { getChunkKeyY as getChunkKey, getSeed } from "./utils_debug";
import Worker from "web-worker";
import Stats from "stats.js";
import { planetTypes } from "./terrainGenerationUtils/planettypes.js";
import { initLogUI } from "./debugLoggerUI";
import { loadNoiseMap, clearAllSavedTerrain } from './storageUtils_debug';

// Import from Modules (Correct Paths)
import { createRenderer, createScene, createCamera } from './modules/core/setup';
import { setupLighting, setupStats, setupSkybox } from './modules/world/sceneSetup';
import { initControls, updateMobileControls, getCameraRotateY, keys as controlKeys, jump as jumpState, shift as shiftState } from './modules/player/controls';
import { getPlanetCompositionInfo, PlanetCompositionInfo } from './modules/world/planetComposition';
import { getVisualParams } from './modules/rendering/visuals';
import { createUnifiedPlanetMaterial } from './modules/rendering/materials';
import { generateInitialChunks } from './modules/world/initialWorldGen';
import { initWorkerPool, NUM_WORKERS } from './modules/workers/workerPool';
import { initChunkManager, updateChunks, LOAD_CHUNK_RADIUS } from './modules/world/chunkManager';
import { initTerrainEditor, cleanupTerrainEditor } from './modules/interaction/terrainEditor';
import { updatePlayerMovementAndCollision, PlayerPhysicsState } from './modules/ui/playerMovement';
import { disposeNode } from './disposeNode_debug';
// Import the new Debug Preview UI module
import { createDebugPreviewUI, setupDebugPreviewScene, renderDebugPreviewScene, showDebugPreview, hideDebugPreview, cleanupDebugPreviewUI } from './modules/ui/debugPreview';
import { setGenerationParams } from './modules/ui/isolatedTerrainViewer/core';
// Import the new Main Debug Panel UI module
import { toggleMainDebugPanel, createMainDebugPanelUI, cleanupMainDebugPanelUI } from './modules/ui/mainDebugPanel'; 
// Import the new constant
import { SHARED_NOISE_SCALE } from "./constants_debug";

/* ============ CONSTANTS ============ */

// --- Determine Planet Type --- 
const DEFAULT_DEBUG_PLANET = 'terrestrial_planet';
const selectedPlanetType = sessionStorage.getItem(storageKeys.DEBUG_PLANET_TYPE);
const CURRENT_PLANET_TYPE = selectedPlanetType || DEFAULT_DEBUG_PLANET;
console.log(`🪐 Initializing world with planet type: ${CURRENT_PLANET_TYPE}${selectedPlanetType ? ' (Selected)' : ' (Default)'}`);

// --- Define Consistent Noise Offset for Shaders (Define earlier) --- 
const SHARED_PLANET_OFFSET = new THREE.Vector3(Math.random() * 1000, Math.random() * 1000, Math.random() * 1000);
console.log(`🪐 Shared Planet Offset: ${SHARED_PLANET_OFFSET.toArray().map(v => v.toFixed(2)).join(', ')}`);

// --- Player Movement State (add these) ---
let playerYVelocity = 0;
let playerGrounded = false;
let clock = new THREE.Clock(); // Add clock for delta time

// --- Clear Saved Terrain on Debug Start ---
clearAllSavedTerrain();

// --- Initialize Debug UI ---
initLogUI();

// *** Define default spawn point BEFORE reading URL params ***
let initialSpawnPosition = new THREE.Vector3(0, 30, 0); // Default Y=30

// *** Read Spawn Parameters from URL ***
const urlParams = new URLSearchParams(window.location.search);
const spawnXParam = urlParams.get('spawnX');
const spawnYParam = urlParams.get('spawnY');
const spawnZParam = urlParams.get('spawnZ');

if (spawnXParam !== null && spawnYParam !== null && spawnZParam !== null) {
    const spawnX = parseFloat(spawnXParam);
    const spawnY = parseFloat(spawnYParam);
    const spawnZ = parseFloat(spawnZParam);

    if (!isNaN(spawnX) && !isNaN(spawnY) && !isNaN(spawnZ)) {
        initialSpawnPosition.set(spawnX, spawnY, spawnZ);
        console.log(`>>> Spawn parameters found. Initial position set to:`, initialSpawnPosition);
    } else {
        console.warn("Invalid spawn parameters found in URL. Using default spawn.");
    }
} else {
    console.log("No spawn parameters found in URL. Using default spawn.");
}
// *** End Read Spawn Parameters ***

/* ============ UI Elements ============ */

// --- Create Color Preview Panel --- 
const previewPanel = document.createElement('div');
previewPanel.id = 'color-preview-panel';
previewPanel.style.position = 'fixed';
previewPanel.style.bottom = '10px';
previewPanel.style.right = '10px';
previewPanel.style.width = '250px'; // Adjust size as needed
previewPanel.style.height = '80px'; // Adjust size as needed
previewPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
previewPanel.style.border = '1px solid #555';
previewPanel.style.zIndex = '10000';
previewPanel.style.overflow = 'hidden'; // Ensure canvas stays within bounds
document.body.appendChild(previewPanel);

const previewCanvas = document.createElement('canvas');
previewPanel.appendChild(previewCanvas);

// --- Preview Scene Setup ---
let previewRenderer: THREE.WebGLRenderer;
let previewScene: THREE.Scene;
let previewCamera: THREE.PerspectiveCamera;
let previewLight: THREE.DirectionalLight;
const swatchMeshes: THREE.Mesh[] = []; // To hold references if needed later

function setupColorPreview(container: HTMLElement, canvas: HTMLCanvasElement, compInfo: PlanetCompositionInfo, planetOffset: THREE.Vector3) {
    if (!compInfo || !compInfo.topElements) {
        console.warn("Cannot setup color preview: Missing composition info.");
        return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Renderer
    previewRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    previewRenderer.setSize(width, height);
    previewRenderer.setPixelRatio(window.devicePixelRatio);
    previewRenderer.setClearColor(0x000000, 0); // Transparent background

    // Scene
    previewScene = new THREE.Scene();

    // Camera 
    previewCamera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    previewCamera.position.z = 15; // Adjust position to view swatches

    // Light (matches main scene initial direction)
    previewLight = new THREE.DirectionalLight(0xffffff, 1.0);
    previewLight.position.set(0.5, 0.8, 0.5).normalize(); // Initial direction
    previewScene.add(previewLight);
    previewScene.add(new THREE.AmbientLight(0xcccccc, 0.5)); // Add some ambient

    // --- Create Central Preview Mesh ---
    const previewGeometry = new THREE.TorusKnotGeometry(3, 1, 100, 16); // Example geometry
    const previewMaterial = createUnifiedPlanetMaterial(compInfo.topElements); // Create the actual shader material
    // Set the offset uniform for the preview material
    if (previewMaterial.uniforms.planetOffset) {
        previewMaterial.uniforms.planetOffset.value = planetOffset;
    }
    
    const centralPreviewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
    centralPreviewMesh.position.set(0, 0, 0); // Center it for now
    previewScene.add(centralPreviewMesh);
    // --------------------------------

    // Generate Swatches (Adjust positioning)
    const topElements = compInfo.topElements!;
    const numSwatches = topElements.colors.length;
    const swatchSize = 1.5; // Smaller swatches
    const spacing = 2.0; 
    const totalWidth = (numSwatches - 1) * spacing;
    const startX = -totalWidth / 2;
    const swatchY = -4; // Position swatches below the central mesh

    const swatchGeometry = new THREE.SphereGeometry(swatchSize / 2, 16, 16);

    for (let i = 0; i < numSwatches; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: topElements.colors[i],
            metalness: topElements.visualParams[i]?.metallic ?? 0.5,
            roughness: topElements.visualParams[i]?.roughness ?? 0.5,
        });
        
        const mesh = new THREE.Mesh(swatchGeometry, material);
        mesh.position.x = startX + i * spacing;
        mesh.position.y = swatchY; 
        previewScene.add(mesh);
        swatchMeshes.push(mesh);
    }
    console.log(`🎨 Color Preview Setup: Central mesh and ${numSwatches} swatches created.`);
}

// --- Re-add Debug Button --- 
const debugTerrainButton = document.createElement('button');
debugTerrainButton.id = 'debug-terrain-button';
debugTerrainButton.innerText = 'Toggle Debug Panel'; // New button text
debugTerrainButton.style.position = 'fixed';
debugTerrainButton.style.top = '60px'; // Adjust position if needed
debugTerrainButton.style.left = '10px';
debugTerrainButton.style.zIndex = '10001';
debugTerrainButton.style.padding = '8px 12px';
debugTerrainButton.style.backgroundColor = '#555';
debugTerrainButton.style.color = 'white';
debugTerrainButton.style.border = 'none';
debugTerrainButton.style.cursor = 'pointer';
debugTerrainButton.style.display = 'none'; // Initially hidden
document.body.appendChild(debugTerrainButton);

// --- Create (but don't setup yet) the Preview UI container ---
createDebugPreviewUI(); // Call creation function from module

/* ============ VARIABLES ============ */

let isMobile = false;

if (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
) {
  isMobile = true;
}

/* ============ SETUP ============ */

const renderer = createRenderer();
renderer.setAnimationLoop(animation);

// Camera
const camera = createCamera();
// *** Apply initial spawn position to camera ***
camera.position.copy(initialSpawnPosition);

// Scene
const scene = createScene();

// --- ADD LIGHTING --- 
// Replace direct lighting setup with module call
const directionalLight = setupLighting(scene);

// --- Add debugRayGroup (similar to isolatedFirstPerson) ---
let debugRayGroup: THREE.Group | null = null;
if (scene) {
    debugRayGroup = new THREE.Group();
    debugRayGroup.name = "Debug_Rays_firstPersonDebug";
    scene.add(debugRayGroup);
    // Optionally, set window.DEBUG_COLLISION_RAYS_ENABLED = true; if you want to mirror isolatedFirstPerson behavior
}

// Stats
const stats = setupStats();

/* ============ SKYBOX ============ */

// Replace direct skybox setup with module call
const skybox = setupSkybox(scene);

/* ============ CONTROLS ============ */
// Remove direct DOM element getting and desktop/mobile setup blocks
// Replace with call to initControls
initControls(camera, renderer, isMobile);

/* ============ COMPOSITION & SHADER DATA PREPARATION ============ */

// --- Get Composition Info (Keep the call, use imported function) ---
const planetCompositionInfo = getPlanetCompositionInfo(CURRENT_PLANET_TYPE);

// --- Set Generation Parameters for Isolated Terrain Viewer Core ---
// This ensures debugPreview.ts can retrieve the correct current values
const currentSeed = getSeed(); // Use the global seed
const currentNoiseLayers = planetTypes[CURRENT_PLANET_TYPE].noiseLayers; // Get noise layers from planetTypes

setGenerationParams({
    noiseLayers: currentNoiseLayers,
    seed: currentSeed,
    compInfo: planetCompositionInfo,
    noiseScale: SHARED_NOISE_SCALE,
    planetOffset: SHARED_PLANET_OFFSET
});

// --- Get Seed Value (needed for preview setup) ---
const seedValue = getSeed(); // Get seed using utility - DO THIS EARLIER

// --- Declare variables needed for dependencies early ---
let loadedChunks: LoadedChunks = {}; // Use type directly
const noiseLayers: NoiseLayers = [50, 25, 10]; // Placeholder - Use type directly

// --- Setup Preview Scene AFTER getting composition info ---
// Pass the offset, type, and seed needed by the preview
setupDebugPreviewScene(planetCompositionInfo, SHARED_PLANET_OFFSET, CURRENT_PLANET_TYPE, seedValue);

// --- Define dependencies for the Main Debug Panel's mining section ---
const miningDeps = {
    scene: scene,
    camera: camera,
    loadedChunks: loadedChunks, 
    noiseLayers: noiseLayers, 
    seed: seedValue,
    compInfo: planetCompositionInfo,
    noiseScale: SHARED_NOISE_SCALE,
    planetOffset: SHARED_PLANET_OFFSET,
    initFn: initTerrainEditor,
    cleanupFn: cleanupTerrainEditor
};

// --- Create the Main Debug Panel UI EARLY --- 
console.log('[FIRSTPERSON_DEBUG] About to call createMainDebugPanelUI');
createMainDebugPanelUI(
    CURRENT_PLANET_TYPE, 
    seedValue, 
    SHARED_PLANET_OFFSET,
    miningDeps,
    debugController
);
console.log('[FIRSTPERSON_DEBUG] createMainDebugPanelUI call completed');

/* ============ INITIAL WORLD GENERATION ============ */
// let loadedChunks: LoadedChunks = {}; // MOVED UP

// --- Get Terrain Parameters --- 
// Remove getTerrainParameters call
// const noiseLayers: NoiseLayers = [50, 25, 10]; // MOVED UP

// --- Generate Initial Chunks using module --- 
generateInitialChunks(scene, loadedChunks, noiseLayers, seedValue, planetCompositionInfo);

// --- Make Debug Button Visible AFTER initial setup --- 
debugTerrainButton.style.display = 'block'; 

// --- Attach Listener to Debug Button --- 
debugTerrainButton.addEventListener('click', toggleMainDebugPanel); // Use the toggle function for the new panel

/* ============ WORKER POOL ============ */

// --- Initialize Worker Pool using module ---
// Remove the redundant loadedChunks definition here

// Add call to initWorkerPool
// const workerPool = initWorkerPool(scene, planetCompositionInfo, loadedChunks); // <<< COMMENTED OUT to prevent conflict with isolatedWorkerPool

/* ============ CHUNK MANAGER ============ */
// --- Initialize Chunk Manager ---
// Ensure seedValue is passed and converted to string
/* // <<< COMMENTED OUT - Chunk loading now handled by isolatedFirstPerson.ts
initChunkManager(scene, planetCompositionInfo, workerPool, noiseLayers, String(seedValue));
*/

/* ============ TERRAIN EDITOR ============ */
// --- Initialize Terrain Editor ---
initTerrainEditor(scene, camera, loadedChunks, noiseLayers, seedValue, planetCompositionInfo);

/* ============ MOVEMENT ============ */

// Keep cameraDir definition
const cameraDir = new THREE.Vector3();

/* ============ ANIMATION LOOP (Refactored) ============ */

// --- Helper: Get key input state for movement function ---
function getInputState() {
    // Uses directly imported states from ./modules/player/controls.ts
    return {
        w: controlKeys[0],     // Forward (W or ArrowUp)
        s: controlKeys[1],     // Backward (S or ArrowDown)
        a: controlKeys[2],     // Left (A or ArrowLeft)
        d: controlKeys[3],     // Right (D or ArrowRight)
        space: jumpState,        // Jump (Space)
        shift: shiftState        // Sprint (ShiftLeft or ShiftRight)
    };
}

let lastPlayerChunkX = 0;
let lastPlayerChunkZ = 0;

function animation(_time: number) {
  stats.begin();

  camera.getWorldDirection(cameraDir);

  // Update mobile controls if applicable
  if (isMobile) {
    updateMobileControls(); // Call module function
    camera.rotateY(getCameraRotateY()); // Call module function
  }

  // --- Update Player Position using the new movement function ---
  if (camera && loadedChunks) { // Ensure camera and loadedChunks are available
    const delta = clock.getDelta();
    const inputState = getInputState(); 
    const currentPhysicsState: PlayerPhysicsState = { yVelocity: playerYVelocity, grounded: playerGrounded };
    
    // We need a chunkMeshesRef map for the new function.
    // Create it on the fly from loadedChunks for now.
    // This assumes loadedChunks[key].mesh exists where the mesh should be.
    // Ideally, firstPerson_debug.ts would maintain a chunkMeshesRef like isolatedFirstPerson.ts
    const chunkMeshesForMovement: { [key: string]: THREE.Mesh | null } = {};
    for (const key in loadedChunks) {
        if (loadedChunks[key] && loadedChunks[key].mesh) {
            chunkMeshesForMovement[key] = loadedChunks[key].mesh;
        } else {
            chunkMeshesForMovement[key] = null;
        }
    }

    const updatedPhysicsState = updatePlayerMovementAndCollision(
        camera,         // fpCamera
        inputState,     // inputState
        currentPhysicsState, // currentPhysicsState
        delta,          // delta
        chunkMeshesForMovement, // chunkMeshesRef
        debugRayGroup    // debugRayGroup (can be null)
    );

    playerYVelocity = updatedPhysicsState.yVelocity;
    playerGrounded = updatedPhysicsState.grounded;

    // If you still need chunkX, chunkZ for other logic (e.g. chunk loading in firstPerson_debug)
    const playerChunkX = Math.floor((camera.position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const playerChunkZ = Math.floor((camera.position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);

    // Example of using these: update chunk loading if player moved chunk
    if (playerChunkX !== lastPlayerChunkX || playerChunkZ !== lastPlayerChunkZ) {
        // console.log(`Player moved to chunk: ${playerChunkX}, ${playerChunkZ}`);
        lastPlayerChunkX = playerChunkX;
        lastPlayerChunkZ = playerChunkZ;
        // Potentially trigger chunk loading logic here if firstPerson_debug.ts handles its own loading
    }
  }
  // -----------------------------------------------------------

  // Update skybox position (Keep)
  skybox.position.copy(camera.position);

  // Update Shader Uniforms
  const elapsedTime = _time * 0.001;
  const lightDir = directionalLight.position;
  
  // Update Main Scene Uniforms
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) {
      if (object.material.uniforms.hasOwnProperty('lightDirection')) { 
          object.material.uniforms.time.value = elapsedTime;
          object.material.uniforms.lightDirection.value.copy(lightDir);
      }
    }
  });

  // --- Render Preview Scene (call module function) --- 
  renderDebugPreviewScene(lightDir, elapsedTime); // Pass required data

  stats.end();
  renderer.render(scene, camera);
}

/* ============ EVENT LISTENERS ============ */

const canvas = document.getElementById("app") as HTMLCanvasElement;
window.addEventListener("scroll", () => {
  const { scrollTop, scrollLeft, scrollHeight, clientHeight } = canvas;
  const atTop = scrollTop === 0;
  const beforeTop = 1;
  const atBottom = scrollTop === scrollHeight - clientHeight;
  const beforeBottom = scrollHeight - clientHeight - 1;

  if (atTop) {
    window.scrollTo(scrollLeft, beforeTop);
  } else if (atBottom) {
    window.scrollTo(scrollLeft, beforeBottom);
  }
});

// Add cleanup for terrain editor AND preview UI on unload
window.addEventListener('beforeunload', () => {
    cleanupTerrainEditor();
    cleanupDebugPreviewUI(); // Call cleanup from module
    cleanupMainDebugPanelUI(); // Cleanup new panel too
 });
