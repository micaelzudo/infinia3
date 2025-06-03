import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { generateMesh as generateMeshVertices } from "../../meshGenerator_debug";
import { CHUNK_SIZE, CHUNK_HEIGHT } from "../../constants_debug";
import { disposeNode } from "../../disposeNode_debug";
import { editNoiseMapChunks } from "../../noiseMapEditor_debug";
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import {
  LoadedChunks,
  NoiseLayers,
  UpdateController,
  NoiseMap,
  Generate,
  PlayerEditMask,
  Seed
} from "../../types_debug";
import { getChunkKeyY, getSeed } from "../../utils_debug";
import { mobileController } from "../../mobileController_debug";
import Worker from "web-worker";
import Stats from "stats.js";
import { planetTypes } from "../../terrainGenerationUtils/planettypes.js";
import { storageKeys as debugStorageKeys, SHARED_NOISE_SCALE } from "../../constants_debug";
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import type { TopElementsData } from '../types/renderingTypes';
import { getPlanetCompositionInfo } from '../world/planetComposition';

/* ============ DEFINE LOCAL CONSTANTS ============ */
const storageKeys = {
  NOISE_LAYERS: "noise-layers",
  MAP_SEED: "map-seed",
  INTERPOLATE: "interpolate",
  WIREFRAME: "wireframe",
};

/* ============ VARIABLES ============ */

const LOAD_CHUNK_RADIUS = 2;

// --- Define Consistent Noise Offset for Shaders (like firstPerson_debug) --- 
const SHARED_PLANET_OFFSET = new THREE.Vector3(Math.random() * 1000, Math.random() * 1000, Math.random() * 1000);

// --- Get Planet Configuration (Revised) --- 
const selectedPlanetTypeKey = sessionStorage.getItem(debugStorageKeys.DEBUG_PLANET_TYPE);
const planetTypeToLoad = selectedPlanetTypeKey || 'terrestrial_planet'; // Fallback needed

console.log(`Loading config for planet type: ${planetTypeToLoad}`);

// Get compInfo using the dedicated function
let effectiveCompInfo = getPlanetCompositionInfo(planetTypeToLoad);

// Get noise layers and seed from planetTypes object (as before)
let effectiveNoiseLayers: NoiseLayers | null = null;
let effectiveSeed: Seed | null = null;
const planetConfig = planetTypes[planetTypeToLoad];
if (planetConfig) {
    effectiveNoiseLayers = planetConfig.noiseLayers || null;
    effectiveSeed = planetConfig.seed !== undefined ? planetConfig.seed : getSeed(); 
} else {
    console.warn(`Planet type '${planetTypeToLoad}' not found in planetTypes. Using default noise layers/seed.`);
    effectiveNoiseLayers = null; // Let generator use its default
    effectiveSeed = getSeed();
}

// Use shared constants for scale and offset
let effectiveNoiseScale: number = SHARED_NOISE_SCALE;
let effectivePlanetOffset: THREE.Vector3 = SHARED_PLANET_OFFSET;

// --- Log effective parameters ---
console.log(`Effective Noise Layers:`, effectiveNoiseLayers);
console.log(`Effective Seed:`, effectiveSeed);
console.log(`Effective Noise Scale:`, effectiveNoiseScale);
console.log(`Effective Planet Offset:`, effectivePlanetOffset);
console.log(`Effective Comp Info (TopElements):`, effectiveCompInfo?.topElements);

// --- Use retrieved values for interpolate/wireframe (as before) ---
const interpolateStr = sessionStorage.getItem(storageKeys.INTERPOLATE);
const wireframeStr = sessionStorage.getItem(storageKeys.WIREFRAME);
const interpolate = interpolateStr === "true";
const wireframe = wireframeStr === "true";

let isMobile = false;

if (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
) {
  isMobile = true;
}

/* ============ SETUP ============ */

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("app") as HTMLCanvasElement,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animation);
document.body.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  1,
  20000
);
camera.position.y = 50;

// Scene
const scene = new THREE.Scene();

// Stats
const stats = new Stats();
stats.showPanel(0);
stats.dom.style.left = "";
stats.dom.style.right = "0";
document.body.appendChild(stats.dom);

/* ============ SKYBOX ============ */

const skyboxPaths = [
  "skybox/front.png",
  "skybox/back.png",
  "skybox/top.png",
  "skybox/bottom.png",
  "skybox/left.png",
  "skybox/right.png",
];

const materialArray = skyboxPaths.map((path) => {
  const texture = new THREE.TextureLoader().load(path);
  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
  });
});
const skyboxGeom = new THREE.BoxGeometry(10000, 10000, 10000);
const skybox = new THREE.Mesh(skyboxGeom, materialArray);
scene.add(skybox);

/* ============ CONTROLS ============ */
const modal = document.getElementById("modal");
const topBar = document.getElementById("top-bar");
const mobileTopBar = document.getElementById("mobile-top-bar");

if (!isMobile) {
  if (mobileTopBar) mobileTopBar.style.display = "none";
  if (modal) modal.style.display = "grid";
  if (topBar) topBar.style.display = "none";

  new PointerLockControls(camera, document.body);

  window.addEventListener("click", () => {
    document.body.requestPointerLock();
  });

  document.addEventListener("pointerlockchange", () => {
    if (modal) {
      if (document.pointerLockElement === document.body) {
        modal.style.display = "none";
        if (topBar) topBar.style.display = "flex";
      } else {
        modal.style.display = "grid";
        if (topBar) topBar.style.display = "none";
      }
    }
  });
}

/* ============ MOBILE CONTROLS ============ */

let updateControllerLook: UpdateController;
let updateControllerMove: UpdateController;

let mobileMove = new THREE.Vector2();

let cameraRotateY = 0;

const onControllerLook = (value: THREE.Vector2) => {
  if (value.x < 0) {
    cameraRotateY = 0.015;
  } else if (value.x > 0) {
    cameraRotateY = -0.015;
  } else {
    cameraRotateY = 0;
  }
};

const onControllerMove = (value: THREE.Vector2) => {
  mobileMove = value.clone().normalize();
};

if (isMobile) {
  if (mobileTopBar) mobileTopBar.style.display = "block";
  if (modal) modal.style.display = "none";
  if (topBar) topBar.style.display = "none";

  updateControllerLook = mobileController(
    document.getElementById("controller-look") as HTMLCanvasElement,
    onControllerLook
  );
  updateControllerMove = mobileController(
    document.getElementById("controller-move") as HTMLCanvasElement,
    onControllerMove
  );
}

/* ============ MASK CREATION HELPER ============ */
function createPlayerEditMask(): PlayerEditMask {
    const mask: boolean[][][] = [];
    const sizeX = CHUNK_SIZE + 2;
    const sizeY = CHUNK_HEIGHT + 2;
    const sizeZ = CHUNK_SIZE + 2;

    for (let x = 0; x < sizeX; x++) {
        mask[x] = [];
        for (let y = 0; y < sizeY; y++) {
            mask[x][y] = [];
            for (let z = 0; z < sizeZ; z++) {
                mask[x][y][z] = false;
            }
        }
    }
    return mask;
}

/* ============ GENERATE WORLD ============ */

let seed = getSeed();

let loadedChunks: LoadedChunks = {};

let noiseLayersStr = sessionStorage.getItem(storageKeys.NOISE_LAYERS);
let noiseLayers = noiseLayersStr
  ? (noiseLayersStr.split(",").map((layer) => parseInt(layer)) as NoiseLayers)
  : null;

// --- Initial Chunk Generation ---

// 1. Generate noise maps AND MASKS for initial chunks (Y=0 and Y=-1)
for (let x = -1; x < 2; x++) {
    for (let z = -1; z < 2; z++) {
        for (let y = 0; y >= -1; y--) { // Generate Y=0 and Y=-1
            const chunkKey = getChunkKeyY(x, y, z);
            if (!(chunkKey in loadedChunks)) {
                 const map = generateNoiseMap(x, y, z, noiseLayers, seed);
                 if (map) {
                    const mask = createPlayerEditMask();
                    // Initialize chunk entry with map and mask
                    loadedChunks[chunkKey] = { mesh: null, noiseMap: map, playerEditMask: mask };
                 } else {
                    console.error(`Failed to generate initial noise map for ${chunkKey}`);
                    loadedChunks[chunkKey] = { mesh: null, noiseMap: null, playerEditMask: null }; // Store nulls if map fails
                 }
            }
        }
    }
}

// 2. Generate meshes for the visible layer (Y=0), providing neighbor data
for (let x = -1; x < 2; x++) {
  for (let z = -1; z < 2; z++) {
    const chunkY = 0;
    const chunkKey = getChunkKeyY(x, chunkY, z);
    const chunkData = loadedChunks[chunkKey];

    if (chunkData && chunkData.noiseMap) {
        // --- Gather Neighbor Maps AND Masks ---
        const keyBelow = getChunkKeyY(x, chunkY - 1, z);
        const keyAbove = getChunkKeyY(x, chunkY + 1, z); // May not exist yet
        const keyXNeg = getChunkKeyY(x - 1, chunkY, z);
        const keyXPos = getChunkKeyY(x + 1, chunkY, z);
        const keyZNeg = getChunkKeyY(x, chunkY, z - 1);
        const keyZPos = getChunkKeyY(x, chunkY, z + 1);

        const dataBelow = loadedChunks[keyBelow];
        const dataAbove = loadedChunks[keyAbove];
        const dataXNeg = loadedChunks[keyXNeg];
        const dataXPos = loadedChunks[keyXPos];
        const dataZNeg = loadedChunks[keyZNeg];
        const dataZPos = loadedChunks[keyZPos];

        const noiseMapBelow = dataBelow?.noiseMap || null;
        const noiseMapAbove = dataAbove?.noiseMap || null;
        const noiseMapXNeg = dataXNeg?.noiseMap || null;
        const noiseMapXPos = dataXPos?.noiseMap || null;
        const noiseMapZNeg = dataZNeg?.noiseMap || null;
        const noiseMapZPos = dataZPos?.noiseMap || null;

        const maskBelow = dataBelow?.playerEditMask || null;
        const maskAbove = dataAbove?.playerEditMask || null;
        const maskXNeg = dataXNeg?.playerEditMask || null;
        const maskXPos = dataXPos?.playerEditMask || null;
        const maskZNeg = dataZNeg?.playerEditMask || null;
        const maskZPos = dataZPos?.playerEditMask || null;
        // ------------------------------------

        // Create neighbor flags required by meshGenerator_debug
        const neighborFlags: { [key: string]: any } = {
            neighborXPosExists: !!noiseMapXPos,
            neighborXNegExists: !!noiseMapXNeg,
            neighborYPosExists: !!noiseMapAbove,
            neighborYNegExists: !!noiseMapBelow,
            neighborZPosExists: !!noiseMapZPos,
            neighborZNegExists: !!noiseMapZNeg,
            playerEditMaskXPos: maskXPos,
            playerEditMaskXNeg: maskXNeg,
            playerEditMaskYPos: maskAbove,
            playerEditMaskYNeg: maskBelow,
            playerEditMaskZPos: maskZPos,
            playerEditMaskZNeg: maskZNeg
        };

        // Corrected: generateOpts only needs the source data (noiseMap)
        const generateOpts: Generate = { noiseMap: chunkData.noiseMap };
        // playerEditMask is passed as the LAST argument below

        // Call debug version with all required args
        const meshGeometry = generateMeshVertices(
            x, chunkY, z,
            generateOpts,
            interpolate,
            noiseMapBelow,
            noiseMapAbove,
            noiseMapXNeg,
            noiseMapXPos,
            noiseMapZNeg,
            noiseMapZPos,
            neighborFlags, // Pass the flags object
            chunkData.playerEditMask // Pass the current chunk's mask as the last argument
        );

        if (meshGeometry) { // Check if geometry was generated
            // Create material (assuming simple material for this context)
            const material = createUnifiedPlanetMaterial(
                effectiveCompInfo ? effectiveCompInfo.topElements : null,
                effectiveNoiseScale!,
                effectivePlanetOffset!
            );
            material.wireframe = wireframe;
            material.side = THREE.DoubleSide;
            const mesh = new THREE.Mesh(meshGeometry, material);
            mesh.position.set(x * CHUNK_SIZE, chunkY * CHUNK_HEIGHT, z * CHUNK_SIZE);
            scene.add(mesh);
            loadedChunks[chunkKey].mesh = mesh;
        } else {
             console.error(`Failed to generate initial mesh geometry for ${chunkKey}`);
        }

    } else {
        console.error(`Failed to generate initial mesh for ${chunkKey}: Noise map missing after generation step.`);
    }
  }
}
// --- End Initial Chunk Generation ---

/* ============ WORKER ============ */

// Keep the simple worker for now, generates only noise maps
const worker = new Worker(new URL("./worker.mts", import.meta.url));

// Function to get or generate neighbor map if not available
function getOrGenNeighborMap(cx: number, cy: number, cz: number): NoiseMap | null {
    const key = getChunkKeyY(cx, cy, cz);
    if (loadedChunks[key]?.noiseMap) {
        return loadedChunks[key].noiseMap;
    } else {
        // Generate synchronously if needed (potential performance hit)
        console.warn(`Generating neighbor map synchronously for ${key}`);
        const map = generateNoiseMap(cx, cy, cz, noiseLayers, seed);
        if (map) {
            // Store map AND create/store mask if newly generated
            const mask = createPlayerEditMask();
            if (!loadedChunks[key]) loadedChunks[key] = { mesh: null, noiseMap: null, playerEditMask: null };
            loadedChunks[key].noiseMap = map;
            loadedChunks[key].playerEditMask = mask;
            return map;
        } else {
             console.error(`Failed to generate synchronous neighbor map for ${key}`);
             return null;
        }
    }
}

worker.onmessage = (e: MessageEvent) => {
  const [cx, cy, cz, noiseMapResult] = e.data as [
    number,
    number,
    number,
    NoiseMap
  ];

  const chunkKey = getChunkKeyY(cx, cy, cz);

  if (noiseMapResult) {
    console.log(`Received noise map from worker for ${chunkKey}`);
    // Create mask for the new map
    const currentMask = createPlayerEditMask();
    // Store the map and mask
    if (!loadedChunks[chunkKey]) {
        // Initialize if first time loading
        loadedChunks[chunkKey] = { mesh: null, noiseMap: noiseMapResult, playerEditMask: currentMask };
    } else {
        // Update existing entry
        loadedChunks[chunkKey].noiseMap = noiseMapResult;
        loadedChunks[chunkKey].playerEditMask = currentMask;
    }

    // --- Now attempt to generate mesh using the new map and neighbors ---
    const chunkData = loadedChunks[chunkKey];
    if (!chunkData) { // Should exist now, but safety check
        console.error(`Chunk data missing for ${chunkKey} immediately after creation!`);
        return;
    }

    // Gather neighbor maps and masks
    const noiseMapBelow = getOrGenNeighborMap(cx, cy - 1, cz);
    const noiseMapAbove = getOrGenNeighborMap(cx, cy + 1, cz);
    const noiseMapXNeg = getOrGenNeighborMap(cx - 1, cy, cz);
    const noiseMapXPos = getOrGenNeighborMap(cx + 1, cy, cz);
    const noiseMapZNeg = getOrGenNeighborMap(cx, cy, cz - 1);
    const noiseMapZPos = getOrGenNeighborMap(cx, cy, cz + 1);

    const maskBelow = loadedChunks[getChunkKeyY(cx, cy - 1, cz)]?.playerEditMask || null;
    const maskAbove = loadedChunks[getChunkKeyY(cx, cy + 1, cz)]?.playerEditMask || null;
    const maskXNeg = loadedChunks[getChunkKeyY(cx - 1, cy, cz)]?.playerEditMask || null;
    const maskXPos = loadedChunks[getChunkKeyY(cx + 1, cy, cz)]?.playerEditMask || null;
    const maskZNeg = loadedChunks[getChunkKeyY(cx, cy, cz - 1)]?.playerEditMask || null;
    const maskZPos = loadedChunks[getChunkKeyY(cx, cy, cz + 1)]?.playerEditMask || null;

    // Define NeighborPresence type inline or import if available from types_debug
    type NeighborPresence = { [key: string]: any };
    const neighborFlags: NeighborPresence = {
        neighborXPosExists: !!noiseMapXPos,
        neighborXNegExists: !!noiseMapXNeg,
        neighborYPosExists: !!noiseMapAbove,
        neighborYNegExists: !!noiseMapBelow,
        neighborZPosExists: !!noiseMapZPos,
        neighborZNegExists: !!noiseMapZNeg,
        playerEditMaskXPos: maskXPos,
        playerEditMaskXNeg: maskXNeg,
        playerEditMaskYPos: maskAbove,
        playerEditMaskYNeg: maskBelow,
        playerEditMaskZPos: maskZNeg,
        playerEditMaskZNeg: maskZNeg,
        // Include noise maps directly in flags as per debug type
        noiseMapXNeg: noiseMapXNeg,
        noiseMapXPos: noiseMapXPos,
        noiseMapYNeg: noiseMapBelow,
        noiseMapYPos: noiseMapAbove,
        noiseMapZNeg: noiseMapZNeg,
        noiseMapZPos: noiseMapZPos
    };

    const generateOpts: Generate = { noiseMap: chunkData.noiseMap };

    // Generate mesh using debug version
    const meshGeometry = generateMeshVertices(
      cx, cy, cz,
      generateOpts,
      interpolate,
      noiseMapBelow,
      noiseMapAbove,
      noiseMapXNeg,
      noiseMapXPos,
      noiseMapZNeg,
      noiseMapZPos,
      neighborFlags,
      chunkData.playerEditMask // Pass current chunk's mask
    );

    if (meshGeometry) {
      if (loadedChunks[chunkKey].mesh) {
        disposeNode(scene, loadedChunks[chunkKey].mesh);
      }

      const material = createUnifiedPlanetMaterial(
          effectiveCompInfo ? effectiveCompInfo.topElements : null,
          effectiveNoiseScale!,
          effectivePlanetOffset!
      );
      material.wireframe = wireframe;
      material.side = THREE.DoubleSide;

      const mesh = new THREE.Mesh(meshGeometry, material);
      mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
      scene.add(mesh);
      loadedChunks[chunkKey].mesh = mesh;
    } else {
      console.warn(`Worker result for ${chunkKey}: No mesh geometry generated.`);
      // Ensure old mesh is removed if generation fails
      if (loadedChunks[chunkKey].mesh) {
        disposeNode(scene, loadedChunks[chunkKey].mesh);
        loadedChunks[chunkKey].mesh = null;
      }
    }
  } else {
    console.error(`Worker returned null noise map for ${chunkKey}`);
  }
};

/* ============ TERRAIN EDITING ============ */

let terrainIntersect: THREE.Vector3 | null = null;

const editTerrain = (remove: boolean) => {
  if (terrainIntersect) {
    const editRadius = 3;
    const editStrength = remove ? -0.5 : 0.5;

    // Call the debug version of the noise map editor
    const affectedChunkCoords = editNoiseMapChunks(
        loadedChunks, // Pass the whole structure (contains maps and masks)
        terrainIntersect,
        remove,
        noiseLayers,
        seed,
        editRadius,
        editStrength,
        {} // Pass empty object for BrushOptions for now
    );

    console.log("Edited terrain, affected coords:", affectedChunkCoords);

    // --- Regenerate meshes for affected chunks --- 
    // Iterate directly over the coordinate arrays
    for (const coords of affectedChunkCoords) {
        const cx = coords[0];
        const cy = coords[1];
        const cz = coords[2];
        // Generate the string key from coordinates
        const chunkKey = getChunkKeyY(cx, cy, cz);

        const chunkData = loadedChunks[chunkKey];
        if (!chunkData || !chunkData.noiseMap) {
            console.error(`Cannot regenerate mesh for ${chunkKey}: Missing data after edit.`);
            continue;
        }

        // Gather neighbor maps and masks (again)
        const noiseMapBelow = getOrGenNeighborMap(cx, cy - 1, cz);
        const noiseMapAbove = getOrGenNeighborMap(cx, cy + 1, cz);
        const noiseMapXNeg = getOrGenNeighborMap(cx - 1, cy, cz);
        const noiseMapXPos = getOrGenNeighborMap(cx + 1, cy, cz);
        const noiseMapZNeg = getOrGenNeighborMap(cx, cy, cz - 1);
        const noiseMapZPos = getOrGenNeighborMap(cx, cy, cz + 1);

        const maskBelow = loadedChunks[getChunkKeyY(cx, cy - 1, cz)]?.playerEditMask || null;
        const maskAbove = loadedChunks[getChunkKeyY(cx, cy + 1, cz)]?.playerEditMask || null;
        const maskXNeg = loadedChunks[getChunkKeyY(cx - 1, cy, cz)]?.playerEditMask || null;
        const maskXPos = loadedChunks[getChunkKeyY(cx + 1, cy, cz)]?.playerEditMask || null;
        const maskZNeg = loadedChunks[getChunkKeyY(cx, cy, cz - 1)]?.playerEditMask || null;
        const maskZPos = loadedChunks[getChunkKeyY(cx, cy, cz + 1)]?.playerEditMask || null;

        // Define NeighborPresence type inline or import if available from types_debug
        type NeighborPresence = { [key: string]: any };
        const neighborFlags: NeighborPresence = {
            neighborXPosExists: !!noiseMapXPos,
            neighborXNegExists: !!noiseMapXNeg,
            neighborYPosExists: !!noiseMapAbove,
            neighborYNegExists: !!noiseMapBelow,
            neighborZPosExists: !!noiseMapZPos,
            neighborZNegExists: !!noiseMapZNeg,
            playerEditMaskXPos: maskXPos,
            playerEditMaskXNeg: maskXNeg,
            playerEditMaskYPos: maskAbove,
            playerEditMaskYNeg: maskBelow,
            playerEditMaskZPos: maskZNeg,
            playerEditMaskZNeg: maskZNeg,
            // Include noise maps directly in flags as per debug type
            noiseMapXNeg: noiseMapXNeg,
            noiseMapXPos: noiseMapXPos,
            noiseMapYNeg: noiseMapBelow,
            noiseMapYPos: noiseMapAbove,
            noiseMapZNeg: noiseMapZNeg,
            noiseMapZPos: noiseMapZPos
        };

        const generateOpts: Generate = { noiseMap: chunkData.noiseMap };

        // Generate mesh using debug version
        const meshGeometry = generateMeshVertices(
            cx, cy, cz,
            generateOpts,
            interpolate,
            noiseMapBelow,
            noiseMapAbove,
            noiseMapXNeg,
            noiseMapXPos,
            noiseMapZNeg,
            noiseMapZPos,
            neighborFlags,
            chunkData.playerEditMask // Pass current chunk's mask
        );

        if (meshGeometry) {
            if (chunkData.mesh) {
                disposeNode(scene, chunkData.mesh);
            }

            const material = createUnifiedPlanetMaterial(
                effectiveCompInfo ? effectiveCompInfo.topElements : null,
                effectiveNoiseScale!,
                effectivePlanetOffset!
            );
            material.wireframe = wireframe;
            material.side = THREE.DoubleSide;

            const mesh = new THREE.Mesh(meshGeometry, material);
            mesh.position.set(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, cz * CHUNK_SIZE);
            scene.add(mesh);
            chunkData.mesh = mesh;
        } else {
             console.warn(`Regen after edit for ${chunkKey}: No mesh geometry generated.`);
             // Ensure old mesh is removed if generation fails
             if (chunkData.mesh) {
                 disposeNode(scene, chunkData.mesh);
                 chunkData.mesh = null;
             }
        }
    }
  }
};

/* ============ PLAYER MOVEMENT ============ */

let vx = 0;
let vy = 0;
let vz = 0;

let playerIsOnGround = false;

const move = (delta: number) => {
    // --- Check if player is currently locked ---
    if (document.pointerLockElement !== document.body && !isMobile) return;
    
    // --- Horizontal Movement ---
    const moveDirection = new THREE.Vector3();
    const keys = {
        w: (document.activeElement === document.body || isMobile) ? (keysPressed["KeyW"] || keysPressed["ArrowUp"]) : false,
        a: (document.activeElement === document.body || isMobile) ? (keysPressed["KeyA"] || keysPressed["ArrowLeft"]) : false,
        s: (document.activeElement === document.body || isMobile) ? (keysPressed["KeyS"] || keysPressed["ArrowDown"]) : false,
        d: (document.activeElement === document.body || isMobile) ? (keysPressed["KeyD"] || keysPressed["ArrowRight"]) : false,
    };

    if (keys.w) moveDirection.z = -1;
    if (keys.a) moveDirection.x = -1;
    if (keys.s) moveDirection.z = 1;
    if (keys.d) moveDirection.x = 1;
    moveDirection.normalize();
    moveDirection.applyEuler(camera.rotation);

    if (isMobile) {
        moveDirection.x = mobileMove.x;
        moveDirection.z = mobileMove.y;
    }

    vx = moveDirection.x * 300 * delta;
    vz = moveDirection.z * 300 * delta;

    camera.position.x += vx;
    camera.position.z += vz;

    // --- Vertical Movement (Jump/Gravity) ---
    const jump = (document.activeElement === document.body || isMobile) ? keysPressed["Space"] : false;
    if (jump && playerIsOnGround) {
        vy = 10; 
    }

    if (!playerIsOnGround) {
        vy -= 20 * delta; // Gravity
    }

    camera.position.y += vy * delta;

    // --- Ground Check ---
    const playerHeight = 5;
    const groundRaycaster = new THREE.Raycaster(camera.position, new THREE.Vector3(0, -1, 0));
    const meshes = Object.values(loadedChunks).map(chunk => chunk.mesh).filter(mesh => mesh) as THREE.Mesh[];
    const groundIntersects = groundRaycaster.intersectObjects(meshes);
    playerIsOnGround = false;
    if (groundIntersects.length > 0) {
        const distanceToGround = groundIntersects[0].distance;
        if (distanceToGround <= playerHeight) {
            camera.position.y += (playerHeight - distanceToGround); // Adjust position to be exactly on ground
            vy = 0; // Stop vertical velocity
            playerIsOnGround = true;
        }
    }

    // --- Dynamic Chunk Loading/Unloading --- 
    const playerChunkX = Math.floor(camera.position.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(camera.position.y / CHUNK_HEIGHT);
    const playerChunkZ = Math.floor(camera.position.z / CHUNK_SIZE);

    // Load nearby chunks (using simple worker for noise map only)
    for (let x = playerChunkX - LOAD_CHUNK_RADIUS; x <= playerChunkX + LOAD_CHUNK_RADIUS; x++) {
        for (let z = playerChunkZ - LOAD_CHUNK_RADIUS; z <= playerChunkZ + LOAD_CHUNK_RADIUS; z++) {
            // --- MODIFIED: Only load horizontally at the player's current Y level --- 
            const loadY = playerChunkY; // Load ONLY at the player's current Y chunk level
            const chunkKey = getChunkKeyY(x, loadY, z);
            if (!(chunkKey in loadedChunks)) {
                // Request noise map from worker
                console.log(`Requesting noise map for ${chunkKey} from worker`);
                worker.postMessage([x, loadY, z, noiseLayers, seed]);
                // Initialize entry immediately to prevent duplicate requests
                loadedChunks[chunkKey] = { mesh: null, noiseMap: null, playerEditMask: null }; 
            }
        }
    }

    // Unload distant chunks (Simple disposal)
    for (const chunkKey in loadedChunks) {
        const chunkCoords = chunkKey.split(',').map(Number);
        const cx = chunkCoords[0];
        const cy = chunkCoords[1];
        const cz = chunkCoords[2];

        const dx = Math.abs(cx - playerChunkX);
        const dy = Math.abs(cy - playerChunkY);
        const dz = Math.abs(cz - playerChunkZ);

        // Use a larger unload radius and check vertical distance too
        if (dx > LOAD_CHUNK_RADIUS + 2 || dz > LOAD_CHUNK_RADIUS + 2 || dy > LOAD_CHUNK_RADIUS + 1) {
            if (loadedChunks[chunkKey].mesh) {
                disposeNode(scene, loadedChunks[chunkKey].mesh);
            }
            delete loadedChunks[chunkKey];
            console.log(`Unloaded chunk ${chunkKey}`);
        }
    }
};

/* ============ RAYCASTING ============ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function onPointerMove(event: PointerEvent) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

const raycast = () => {
  if (document.pointerLockElement === document.body || isMobile) {
    raycaster.setFromCamera(isMobile ? new THREE.Vector2() : pointer, camera);
    const meshes = Object.values(loadedChunks).map(chunk => chunk.mesh).filter(mesh => mesh) as THREE.Mesh[];
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      terrainIntersect = intersects[0].point;
    } else {
      terrainIntersect = null;
    }
  }
};

/* ============ LISTENERS ============ */

const keysPressed: { [key: string]: boolean } = {};

window.addEventListener("keydown", (e) => {
  keysPressed[e.code] = true;

  if (document.pointerLockElement !== document.body && !isMobile) return;

  if (e.code === "KeyE") editTerrain(false);
  if (e.code === "KeyQ") editTerrain(true);
});

window.addEventListener("keyup", (e) => {
  keysPressed[e.code] = false;
});

window.addEventListener("pointermove", onPointerMove);
window.addEventListener("resize", onWindowResize);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ============ ANIMATION ============ */

let lastTime = 0;
function animation(time: number) {
  stats.begin();

  const delta = Math.min(time - lastTime, 100) / 1000;
  lastTime = time;

  if (isMobile) {
    updateControllerLook();
    updateControllerMove();

    camera.rotation.y += cameraRotateY;
  }

  move(delta);
  raycast();

  renderer.render(scene, camera);
  stats.end();
}
