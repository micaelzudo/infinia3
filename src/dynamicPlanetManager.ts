import * as THREE from "three";
import { disposeNode } from './disposeNode'; // Assuming disposeNode is accessible
// --- Import Text/Font Utilities ---
import { FONTS, generateAlienPlanetName, getLoadedFont, FontConfig } from './utils/fontLoader'; // Assuming fontLoader utils are accessible
import { createMultiFontTextLabel, updateLabelGroup } from './canvasTextRenderer'; // Assuming canvasTextRenderer is accessible

// --- Import Shaders ---
import planetVertexShader from './shaders/planet.vert?raw';
// Import ALL planet fragment shaders
import planetFragDefault from './shaders/planet.frag?raw';
import planetBioFrag from './shaders/planet_bio.frag?raw';
import planetCrystalFrag from './shaders/planet_crystal.frag?raw';
import planetGasFrag from './shaders/planet_gas.frag?raw';
import planetIceFrag from './shaders/planet_ice.frag?raw';
import planetLavaFrag from './shaders/planet_lava.frag?raw';
import planetTerranFrag from './shaders/planet_terran.frag?raw';

// Array of available planet fragment shaders
const planetFragmentShaders = [
    planetFragDefault,
    planetBioFrag,
    planetCrystalFrag,
    planetGasFrag,
    planetIceFrag,
    planetLavaFrag,
    planetTerranFrag
];

// --- Import Hexagon Shaders ---
import hexagonVertexShader from './shaders/hexagon.vert?raw';
import hexagonFragmentShader from './shaders/hexagon.frag?raw';

// --- Constants ---
// Copied from firstPerson.ts - adjust if needed for welcome screen context
const NUM_PLANETS = 40; // Slightly fewer for welcome?
const PLANET_RADII = [5, 8, 12, 15, 20]; // Adjusted range?
// const SPAWN_RADIUS_XZ = 600; // Maybe smaller radius? // Remove or comment out - not used
const DESPAWN_DISTANCE_BEHIND = 150.0; // Increased distance - planets disappear further behind
const SPAWN_DISTANCE_AHEAD = 800.0; // Spawn a bit closer?
const SPAWN_Z_RANDOM_RANGE = 400.0;
const MIN_PLANET_BUFFER_DISTANCE = 80; // Adjusted buffer?
const VISUAL_TUNNEL_SPAWN_RADIUS = 90.0; // Use tunnel width minus buffer
const LABEL_Y_OFFSET = 1.5; // How far above planet radius to place label/hex
const HEXAGON_RADIUS_MULTIPLIER = 1.5; // How much bigger hex radius is than text (adjust)
const HEXAGON_OPACITY = 0.5;

// --- Interface ---
interface Planet {
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
    seed: number;
    radius: number;
    textMesh?: THREE.Group | null; // Optional label group
    hexagonMesh?: THREE.Mesh | null; // Optional hexagon background
}

// --- State ---
let planets: (Planet | null)[] = []; // Allow null for replaced slots
let sceneRef: THREE.Scene | null = null; // Keep a reference to the scene

// --- Helper Functions ---

/**
 * Creates a single planet mesh and returns a Planet object.
 * Adds the mesh to the scene referenced by sceneRef.
 */
function createPlanet(position: THREE.Vector3, radius: number, seed: number): Planet | null {
    if (!sceneRef) {
        console.error("[DynamicPlanetManager] Cannot create planet: Scene reference not set.");
        return null;
    }

    // Simple sphere geometry
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    // --- Select Random Fragment Shader ---
    const fragmentShaderIndex = Math.floor(Math.random() * planetFragmentShaders.length);
    const selectedFragmentShader = planetFragmentShaders[fragmentShaderIndex];
    // console.log(`Selected shader index: ${fragmentShaderIndex}`); // For debugging

    // --- Use ShaderMaterial --- 
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uSeed: { value: seed }, // Pass the unique seed
            uCameraPos: { value: new THREE.Vector3() } // Initialize camera pos uniform
            // NOTE: Add specific uniforms here if a particular shader type requires them
            // e.g., uAtmosphereDensity for gas planets, etc.
        },
        vertexShader: planetVertexShader,
        fragmentShader: selectedFragmentShader,
        side: THREE.FrontSide 
    });
    // --- End ShaderMaterial ---

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.name = `dynamic_planet_${(seed * 100000).toFixed(0)}`;

    // Add to the stored scene reference
    sceneRef.add(mesh);

    console.log(`%c[SPAWN] Dynamic Planet ${mesh.name} created (R: ${radius.toFixed(1)}, Pos: ${position.x.toFixed(1)},${position.y.toFixed(1)},${position.z.toFixed(1)})`, 'color: #80ff80');

    // --- Create Label & Hexagon --- 
    let labelGroup: THREE.Group | null = null;
    let hexagonMesh: THREE.Mesh | null = null;
    let labelWidthEstimate = 0; // Need an estimate for hexagon size

    try {
        const planetName = generateAlienPlanetName();
        // Simplify font choice: find first loaded alien font or default
        let selectedFontConfig = FONTS.find(f => f.type === 'alien' && getLoadedFont(f.name));
        if (!selectedFontConfig) { 
            selectedFontConfig = FONTS.find(f => f.name === 'AlienAlphabet'); // Fallback
        }

        if (selectedFontConfig && getLoadedFont(selectedFontConfig.name)) {
            labelGroup = createMultiFontTextLabel(planetName, 1); // Use base size 1
            if (labelGroup) {
                // Estimate width for hexagon sizing (very rough)
                labelWidthEstimate = planetName.length * 0.8; // Adjust this factor as needed
                
                const labelYPos = radius + (labelWidthEstimate * 0.5) + LABEL_Y_OFFSET; // Position above planet + half estimated height
                labelGroup.position.copy(mesh.position).add(new THREE.Vector3(0, labelYPos, 0));
                labelGroup.scale.set(2, 2, 2); // Scale label up (adjust as needed)
                sceneRef.add(labelGroup);
                // console.log(`  Label created for planet ${mesh.name}`);

                // Create Hexagon Background (if label was created)
                const hexagonRadius = labelWidthEstimate * HEXAGON_RADIUS_MULTIPLIER;
                if (hexagonRadius > 0) { 
                    const hexagonGeometry = new THREE.CircleGeometry(hexagonRadius, 6); // 6 sides for hexagon
                    // --- Use Hexagon Shader Material ---
                    const hexagonMaterial = new THREE.ShaderMaterial({ 
                        uniforms: {
                            uTime: { value: 0.0 },
                            uPulse: { value: 1.0 }, // Enable pulse
                            uBorderWidth: { value: 0.05 }, // Adjust border thickness
                            uOpacity: { value: HEXAGON_OPACITY }, // Use constant opacity
                            uGlowIntensity: { value: 0.6 }, // Adjust glow strength
                            uColor: { value: new THREE.Color(0x0a1a30) }, // Dark blue base
                            uGlowColor: { value: new THREE.Color(0x40a0ff) } // Light blue glow
                        },
                        vertexShader: hexagonVertexShader,
                        fragmentShader: hexagonFragmentShader,
                        side: THREE.DoubleSide, 
                        transparent: true,
                        depthWrite: false // Important for blending
                    });
                    // --- End Shader Material ---
                    hexagonMesh = new THREE.Mesh(hexagonGeometry, hexagonMaterial);
                    // Position hexagon with the label (slightly behind)
                    hexagonMesh.position.copy(labelGroup.position).add(new THREE.Vector3(0, 0, -0.1)); 
                    sceneRef.add(hexagonMesh);
                } else {
                    // console.log(`  Skipping hexagon due to zero radius for planet ${mesh.name}`);
                }

            } else {
                // console.warn(`  Failed to create label group for planet ${mesh.name}`);
            }
        } else {
            // console.warn(`  Font not loaded, skipping label/hexagon for planet ${mesh.name}`);
        }
    } catch (error) {
        console.error(`[DynamicPlanetManager] Error creating label/hexagon for planet:`, error);
    }
    // --- End Label & Hexagon --- 

    return {
        mesh,
        seed,
        radius,
        textMesh: labelGroup, // Add to returned object
        hexagonMesh: hexagonMesh // Add to returned object
    };
}

/**
 * Removes a planet and its associated objects from the scene and disposes resources.
 */
function removePlanet(planet: Planet) {
     if (!sceneRef || !planet || !planet.mesh) return;

    // Remove mesh from scene
    sceneRef.remove(planet.mesh);

    // Dispose geometry (assuming unique)
    planet.mesh.geometry.dispose();

    // Dispose material(s) (assuming unique)
    if (planet.mesh.material instanceof THREE.Material) {
        planet.mesh.material.dispose();
    } else if (Array.isArray(planet.mesh.material)) {
        planet.mesh.material.forEach(m => m.dispose());
    }
    // Dispose textures if necessary

    console.log(`%c> Dynamic Planet Removed (R: ${planet.radius.toFixed(1)}) <`, 'color: #ff8080;');
}


// --- Exported Functions ---

/**
 * Initializes the dynamic planet system, spawning initial planets.
 * @param scene The THREE.Scene to add planets to.
 * @param camera The initial camera position reference.
 */
export function initializeDynamicPlanets(scene: THREE.Scene, camera: THREE.Camera): void {
    console.log("[DynamicPlanetManager] Initializing...");
    sceneRef = scene; // Store scene reference
    planets = []; // Reset planets array

    const initialCameraPos = camera.position.clone();
    const tempPos = new THREE.Vector3();
    let attempts = 0;
    const maxSpawnAttempts = NUM_PLANETS * 5;

    while (planets.length < NUM_PLANETS && attempts < maxSpawnAttempts) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const radiusXZ = Math.random() * VISUAL_TUNNEL_SPAWN_RADIUS; // Use visual radius
         // Spawn ahead of initial camera Z, within range, adjusted for welcome screen view
        const spawnZ = initialCameraPos.z - (SPAWN_DISTANCE_AHEAD * 0.2) - (Math.random() * SPAWN_DISTANCE_AHEAD * 0.8);

        // Center initial planets around origin (0,0), not camera X/Y
        tempPos.set(
            Math.cos(angle) * radiusXZ, // Centered at X=0
            Math.sin(angle) * radiusXZ, // Centered at Y=0 (ignore Y variation for now)
            spawnZ
        );

        const planetRadius = PLANET_RADII[Math.floor(Math.random() * PLANET_RADII.length)];

        let collision = false;
        for (const existingPlanet of planets) {
             if (!existingPlanet) continue; // Skip null slots
            const dist = tempPos.distanceTo(existingPlanet.mesh.position);
            if (dist < planetRadius + existingPlanet.radius + MIN_PLANET_BUFFER_DISTANCE) {
                collision = true;
                break;
            }
        }

        if (!collision) {
            const seed = Math.random();
            const newPlanet = createPlanet(tempPos, planetRadius, seed);
            if (newPlanet) {
                 planets.push(newPlanet);
            }
        }
    }
    if (planets.length < NUM_PLANETS) {
        console.warn(`[DynamicPlanetManager] Could only spawn ${planets.length}/${NUM_PLANETS} initial planets.`);
    }
     console.log(`[DynamicPlanetManager] Initialization complete. ${planets.length} planets created.`);
}

/**
 * Updates planet positions, handles despawning and respawning based on camera position.
 * To be called in the animation loop.
 * @param elapsedTime Total elapsed time (for potential shader use).
 * @param camera The current camera object.
 */
export function updatePlanets(elapsedTime: number, camera: THREE.PerspectiveCamera): void {
    if (!sceneRef) return; // Need scene ref

    const indicesToReplace: number[] = [];
    const cameraPos = camera.position;

    // --- Phase 1: Mark for Destruction (Reference Logic - Z based) ---
    for (let i = 0; i < planets.length; i++) {
        const planet = planets[i];
        if (!planet || !planet.mesh) {
            if (planets[i] !== null) { 
                 console.warn(`[DynamicPlanetManager] Found invalid planet at index ${i}`);
                 indicesToReplace.push(i); 
            }
             continue;
        }

        // --- Update Shaders & LookAt --- 
        if (planet.mesh.material instanceof THREE.ShaderMaterial) {
            planet.mesh.material.uniforms.uTime.value = elapsedTime;
            if (planet.mesh.material.uniforms.uCameraPos) {
                planet.mesh.material.uniforms.uCameraPos.value.copy(cameraPos);
            }
        }
        // Update Label
        if (planet.textMesh) {
            updateLabelGroup(planet.textMesh, elapsedTime);
            planet.textMesh.lookAt(cameraPos);
        }
        // Update Hexagon
        if (planet.hexagonMesh) {
            planet.hexagonMesh.lookAt(cameraPos);
            // Update Hexagon Shader Time Uniform
            if (planet.hexagonMesh.material instanceof THREE.ShaderMaterial) {
                planet.hexagonMesh.material.uniforms.uTime.value = elapsedTime;
            }
        }
        // --- End Update Shaders & LookAt ---

        // --- Check Destruction Condition (Reference Logic - Z Based) ---
        const destroyThresholdZ = cameraPos.z + DESPAWN_DISTANCE_BEHIND;
        if (planet.mesh.position.z > destroyThresholdZ) {
            console.log(`%c[DESPAWN] Marking planet ${planet.mesh.name} for removal (Z: ${planet.mesh.position.z.toFixed(1)} > Threshold: ${destroyThresholdZ.toFixed(1)})`, 'color: #ff8080');
            indicesToReplace.push(i);
        }
    }

    // --- Phase 2: Replace Marked Planets (Reference Logic) ---
    const tempPos = new THREE.Vector3();
    // Calculate spawn center Z relative to camera Z
    // const spawnCenter = cameraPos.clone().addScaledVector(cameraForward, -SPAWN_DISTANCE_AHEAD); // Old way

    for (const indexToReplace of indicesToReplace) {
        const oldPlanet = planets[indexToReplace];

        // --- 1. Remove Old Planet ---
        if (oldPlanet) { 
            removePlanet(oldPlanet);
        }

        // --- 2. Create Replacement Planet Ahead --- 
        let isValidPosition = false;
        const maxTries = 50;
        let tries = 0;
        let newPlanet: Planet | null = null;
        const planetRadius = PLANET_RADII[Math.floor(Math.random() * PLANET_RADII.length)];

        while (!isValidPosition && tries < maxTries) {
            tries++;
            const randomAngle = Math.random() * Math.PI * 2;
            // Spawn within the VISUALLY estimated tunnel radius
            const randomRadius = Math.sqrt(Math.random()) * VISUAL_TUNNEL_SPAWN_RADIUS; // sqrt for even area distribution
            const spawnX = Math.cos(randomAngle) * randomRadius; // Correct: Relative to origin (0)
            const spawnY = Math.sin(randomAngle) * randomRadius; // Correct: Relative to origin (0)
            // Calculate Z position ahead of the camera
            const spawnZ = cameraPos.z - SPAWN_DISTANCE_AHEAD - Math.random() * SPAWN_Z_RANDOM_RANGE;

            // Position relative to the calculated spawnCenter
            tempPos.set( spawnX, spawnY, spawnZ );

            isValidPosition = true;
            for (let j = 0; j < planets.length; j++) {
                if (indexToReplace === j || !planets[j] || !planets[j]?.mesh) continue;
                const otherPlanet = planets[j] as Planet; // We know it's not null here
                const dist = tempPos.distanceTo(otherPlanet.mesh.position);
                const requiredDistance = planetRadius + otherPlanet.radius + MIN_PLANET_BUFFER_DISTANCE;
                if (dist < requiredDistance) {
                    isValidPosition = false;
                    break;
                }
            }

            if (isValidPosition) {
                const seed = Math.random();
                newPlanet = createPlanet(tempPos, planetRadius, seed);
            }
        } // End while finding position

        planets[indexToReplace] = newPlanet; // Assign new planet or null if failed

        if (!newPlanet) {
            console.warn(`   [DynamicPlanetManager] Failed to place replacement planet for index ${indexToReplace} after ${maxTries} tries.`);
        }
    } // End for indicesToReplace
}


/**
 * Cleans up all dynamic planets from the scene.
 */
export function cleanupDynamicPlanets(): void {
     console.log("[DynamicPlanetManager] Cleaning up dynamic planets...");
    if (sceneRef) {
        const validSceneRef = sceneRef; // Create non-null reference for use inside loop
        planets.forEach(planet => {
            if (planet) {
                 removePlanet(planet); // removePlanet already handles main mesh/mat/geo

                 // Remove and dispose label group
                 if (planet.textMesh) {
                    disposeNode(validSceneRef, planet.textMesh); // Use validSceneRef
                 }
                 // Remove and dispose hexagon 
                 if (planet.hexagonMesh) {
                    validSceneRef.remove(planet.hexagonMesh); // Use validSceneRef
                    planet.hexagonMesh.geometry.dispose();
                    if (planet.hexagonMesh.material instanceof THREE.Material) {
                         planet.hexagonMesh.material.dispose();
                    }
                 }
            }
        });
    } else {
         console.warn("[DynamicPlanetManager] Cannot cleanup: Scene reference is null.");
    }
    planets = []; 
    sceneRef = null; 
     console.log("[DynamicPlanetManager] Cleanup complete.");
} 