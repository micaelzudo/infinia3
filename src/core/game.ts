import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { MarchingCubes } from '../marching-cubes';
import { ThirdPersonController } from '../third-person-controller';

/**
 * Contains the core components initialized when the game starts.
 */
export interface GameComponents {
    marchingCubes: MarchingCubes;
    thirdPersonController: ThirdPersonController;
    playerCylinder: THREE.Mesh;
    stats: Stats;
}

/**
 * Initializes the main game components: terrain, player controller, player visual,
 * stats display, and grid helper.
 * @param scene The main Three.js scene.
 * @param camera The main perspective camera.
 * @param renderer The WebGL renderer (needed for controller).
 * @returns An object containing the initialized game components.
 */
export async function initializeGame(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer // Added renderer dependency for TPC
): Promise<GameComponents> {

    // --- Lighting Adjustments (Consider moving if complex) ---
    // Example: Adjust existing lights for gameplay
    const gameDirectionalLight = scene.getObjectByName('directionalLight');
    if (gameDirectionalLight instanceof THREE.DirectionalLight) {
        gameDirectionalLight.intensity = 0.9;
    }
    const gameAmbientLight = scene.getObjectByName('ambientLight');
    if (gameAmbientLight instanceof THREE.AmbientLight) {
        gameAmbientLight.intensity = 0.6;
    }
    // Remove welcome-specific lights if necessary (e.g., point light)
    const welcomePointLight = scene.getObjectByName('pointLight'); // Assuming it was named
    if(welcomePointLight) scene.remove(welcomePointLight);
    
    // --- Marching Cubes Terrain ---
    const marchingCubes = new MarchingCubes(scene, 3);
    // Await the terrain generation to ensure meshes exist for player positioning
    await marchingCubes.generateTerrain();

    // --- Player Controller ---
    const thirdPersonController = new ThirdPersonController(camera, scene, renderer.domElement);

    // --- Player Visual Representation ---
    const cylinderHeight = 1.8;
    const cylinderRadius = 0.4;
    const playerGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 16);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, wireframe: false });
    const playerCylinder = new THREE.Mesh(playerGeometry, playerMaterial);

    // --- Set Initial Player Position using Raycasting ---
    const spawnRaycaster = new THREE.Raycaster();
    const spawnOrigin = new THREE.Vector3(0, 100, 0); // Start ray high above spawn point
    const downwardVector = new THREE.Vector3(0, -1, 0); // Local downward vector
    spawnRaycaster.set(spawnOrigin, downwardVector);

    const terrainMeshes = marchingCubes.getTerrainMeshes();
    const intersects = spawnRaycaster.intersectObjects(terrainMeshes as THREE.Object3D[]);

    let startY = 15.0; // Default spawn height (use the adjusted value)
    const spawnHeightOffset = 10.0; // Increased offset for higher spawn

    if (intersects.length > 0) {
        startY = intersects[0].point.y + cylinderHeight / 2 + spawnHeightOffset;
    } else {
        console.log("Player Start: No terrain found below origin (0,0), starting at default height.");
    }
    playerCylinder.position.set(0, startY, 0);
    playerCylinder.visible = false; // Start invisible, made visible in animate loop
    scene.add(playerCylinder);
    // --- End Initial Player Position ---

    // --- Grid Helper ---
    const gridHelper = new THREE.GridHelper(100, 100, 0x888888, 0x444444);
    scene.add(gridHelper);

    // --- Game Stats ---
    const stats = Stats();
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = 'auto';
    stats.dom.style.right = '0px';
    document.body.appendChild(stats.dom);

    return { marchingCubes, thirdPersonController, playerCylinder, stats };
} 