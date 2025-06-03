import * as THREE from "three";
import { createTunnel, updateTunnel } from "./tunnel.js";
import { createWelcomeButtons, removeWelcomeButtons } from "./ui";
import { FONTS, generateAlienPlanetName, getLoadedFont, FontConfig } from './utils/fontLoader';
import { createMultiFontTextLabel, updateLabelGroup } from './canvasTextRenderer';
import { disposeNode } from './disposeNode';
import { initializeDynamicPlanets, updatePlanets as updateDynamicPlanets, cleanupDynamicPlanets } from './dynamicPlanetManager'; // Import planet manager functions
import { getPlanetGenerationParams } from '../debug/planetSelectorUI'; // ADDED
import { cleanupIsolatedViewer } from '../debug/modules/ui/isolatedTerrainViewer'; // Keep for cleanup
import { launchIsolatedEditorOverlay } from '../debug/modules/ui/mainDebugPanel'; // ADDED

// Variables to track welcome screen elements
export let planetMeshes: THREE.Mesh[] = [];
let planetLabels: THREE.Group[] = [];
export let titleTextElement: HTMLElement | null = null;
let welcomeButtons: { explore: HTMLElement, debug: HTMLElement, debugShaders: HTMLElement } | null = null;
let welcomeTextMesh: THREE.Mesh | null = null; // Variable for the 3D text plane

const isDebugMode = true;

// --- GLSL For 3D Welcome Text Plane ---
const welcomeTextVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Optional: Add subtle vertex movement
    // float wave = sin(pos.x * 0.1 + uTime * 0.5) * 0.5 + cos(pos.y * 0.1 + uTime * 0.3) * 0.5;
    // pos.z += wave * 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const welcomeTextFragmentShader = `
  precision mediump float;
  uniform float uTime;
  varying vec2 vUv;
  
  // Color definitions (adjust as desired)
  vec3 colorA = vec3(0.05, 0.1, 0.3); // Dark Blue
  vec3 colorB = vec3(0.3, 0.1, 0.5); // Purple
  vec3 colorC = vec3(0.1, 0.4, 0.6); // Cyan/Blue
  
  // --- Hex Grid Function (from reference) ---
  const vec2 H = vec2(1.0, 1.73205);
  
  float hexDist(vec2 p) {
      p = abs(p);
      float c = dot(p, H * 0.5);
      c = max(c, p.x);
      return c;
  }
  
  // Returns distance to nearest hex edge
  float hexGrid(vec2 uv, float scale, float lineWidth) {
      vec2 p = uv * scale;
      vec2 i = floor(p + 0.5 * H);
      vec2 f = p - i + 0.5 * H;
      
      vec2 id = (mod(i.x + i.y, 2.0) == 0.0) ? i : i + vec2(1.0, 0.0);
      
      vec2 center = (id - 0.5 * H);
      float dist = hexDist(f - 0.5 * H);
      
      // Create lines - smoothstep for anti-aliasing
      float line = smoothstep(0.5 - lineWidth, 0.5 + lineWidth, dist);
      return line; // 1.0 inside hex, 0.0 on edge
  }
  
  void main() {
      // Base color gradient
      vec3 baseColor = mix(colorA, colorB, smoothstep(0.3, 0.7, sin(vUv.y * 3.0 + uTime * 0.3)));
      baseColor = mix(baseColor, colorC, smoothstep(0.3, 0.7, cos(vUv.x * 3.0 + uTime * 0.5)));
  
      // Calculate hexagonal grid pattern
      float scale = 15.0; // Adjust scale for hexagon size
      float lineWidth = 0.05; // Adjust line thickness
      float hexPattern = hexGrid(vUv, scale, lineWidth);
  
      // Make hex lines glow slightly based on time (pulsing cyan/white)
      vec3 hexColor = mix(vec3(0.3, 0.8, 1.0), vec3(1.0), 0.5 + 0.5 * sin(uTime * 1.5 + vUv.y * 2.0));
      
      // Combine base color with hex grid lines
      // Use hexPattern directly: 1.0 = baseColor, 0.0 = hexColor
      vec3 finalColor = mix(hexColor, baseColor, hexPattern);
      
      // Add subtle noise
      float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      finalColor *= (0.95 + noise * 0.1);
      
      // Fade edges
      float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x) * 
                       smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
                       
      gl_FragColor = vec4(finalColor, edgeFade);
  }
`;
// --- End GLSL --- 

// --- GLSL Modules (Copied from tunnel.js for simplicity in this example) ---
// In a real setup, you might import these strings or use a build tool
const mathGLSL = `
#ifndef MATH_UTILS
#define MATH_UTILS
// ... (content of math.glsl - same as in tunnel.js) ...
#endif // MATH_UTILS
`;
const noiseGLSL = `
#ifndef NOISE_UTILS
#define NOISE_UTILS

// Hash function for 3D input returning 1D output
float hash31(vec3 p) {
    // Ensure high precision for hash input/output
    highp vec3 p_hp = vec3(p);
    p_hp = fract(p_hp * 0.1031);
    p_hp += dot(p_hp, p_hp.yzx + 19.19);
    return fract((p_hp.x + p_hp.y) * p_hp.z);
}

// Value noise 3D - Modified hash calls
float valueNoise3D(vec3 p) {
    highp vec3 i = floor(p);
    highp vec3 f = fract(p);
    highp vec3 u = f * f * (3.0 - 2.0 * f); // Cubic interpolation

    // Pre-calculate corner points
    highp vec3 p000 = i + vec3(0.0, 0.0, 0.0);
    highp vec3 p100 = i + vec3(1.0, 0.0, 0.0);
    highp vec3 p010 = i + vec3(0.0, 1.0, 0.0);
    highp vec3 p110 = i + vec3(1.0, 1.0, 0.0);
    highp vec3 p001 = i + vec3(0.0, 0.0, 1.0);
    highp vec3 p101 = i + vec3(1.0, 0.0, 1.0);
    highp vec3 p011 = i + vec3(0.0, 1.0, 1.0);
    highp vec3 p111 = i + vec3(1.0, 1.0, 1.0);

    // Call hash on pre-calculated points
    float a = hash31(p000);
    float b = hash31(p100);
    float c = hash31(p010);
    float d = hash31(p110);
    float e = hash31(p001);
    float f1 = hash31(p101);
    float g = hash31(p011);
    float h = hash31(p111);

    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}

// Modified fbmValue3D to match original inline smoke fbm logic (for consistency)
float fbmValue3D(vec3 p) { // Parameter-less version
    float f = 0.0;
    float amplitude = 0.5;
    int octaves = 5;
    float lacunarity = 2.02;
    float gain = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < octaves; i++) {
        f += amplitude * valueNoise3D(p * frequency);
        frequency *= lacunarity;
        amplitude *= gain;
    }
    return f;
}

// Keep original parameterized version for planet shader compatibility if needed elsewhere
// Although the calls were updated to use float literals, let's keep the original signature
// just in case, while ensuring the above parameter-less one is used by smoke.
float fbmValue3D(vec3 p, float octavesF, float lacunarity, float gain) {
    float total = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    float maxValue = 0.0;
    int octaves = int(octavesF); // Convert float octave count to int

    for (int i = 0; i < octaves; i++) {
        if (i >= octaves) break; // Ensure loop respects integer octaves
        total += valueNoise3D(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= gain; // Persistence
        frequency *= lacunarity;
    }
    return maxValue > 0.0 ? total / maxValue : 0.0; // Normalize
}

#endif // NOISE_UTILS
`;
// --- End GLSL Modules ---

// Variable to store the animation frame ID
let welcomeScreenAnimationId: number | undefined; // Initialize as undefined

/**
 * Creates a welcome screen with tunnel, planets and welcome text
 * @param scene The Three.js scene
 * @param camera The Three.js camera
 * @param onStart Callback function to execute when start button is clicked
 * @param planetSelected The selected planet to feature, or "random"
 */
export async function initializeWelcomeScreen(
  scene: THREE.Scene,
  camera: THREE.Camera,
  onStart: () => Promise<void>,
  planetSelected?: string
): Promise<void> {
  let effectivePlanetSelected = planetSelected;
  if (isDebugMode && typeof effectivePlanetSelected === 'undefined') {
    effectivePlanetSelected = "random";
    console.log(`[WelcomeScreen] Debug mode: planetSelected was undefined, defaulting to '${effectivePlanetSelected}'.`);
  }

  if (isDebugMode) {
    console.log("[WelcomeScreen] Debug mode TRUE. Initializing Isolated Terrain Viewer via mainDebugPanel...");
    console.log(`[WelcomeScreen] Planet selected for debug: ${effectivePlanetSelected}`);

    cleanupWelcomeScreen(scene); // Cleanup standard welcome screen elements
    const generationParams = await getPlanetGenerationParams(effectivePlanetSelected!, undefined);

    if (generationParams) {
      console.log("[WelcomeScreen] Successfully retrieved generation params.");

      const oldOverlay = document.getElementById('isolated-editor-overlay');
      if (oldOverlay) {
        console.log("[WelcomeScreen] Found old isolated editor overlay, cleaning up...");
        try { cleanupIsolatedViewer(); } catch (e) { console.error("Error during previous cleanupIsolatedViewer:", e); }
        if (oldOverlay.parentNode) oldOverlay.parentNode.removeChild(oldOverlay);
      }

      const miningDepsForOverlay = {
        scene: null, // Main scene, not used by isolated editor UI creation
        camera: null, // Main camera, not used by isolated editor UI creation
        loadedChunks: {}, // Dummy
        noiseLayers: generationParams.noiseLayers,
        seed: generationParams.seed,
        compInfo: generationParams.compInfo,
        noiseScale: generationParams.noiseScale,
        planetOffset: generationParams.planetOffset,
        // initFn/cleanupFn for main world editor, not isolated one directly through this dep
        initFn: () => console.log("MainDebugPanel's dummy initFn for isolated context called"),
        cleanupFn: () => console.log("MainDebugPanel's dummy cleanupFn for isolated context called")
      };

      // LaunchIsolatedEditorOverlay will now handle creating the UI AND 
      // calling initIsolatedViewer, generateIsolatedTerrain, and setupIsolatedEditing internally.
      launchIsolatedEditorOverlay(miningDepsForOverlay as any);
      
      console.log("[WelcomeScreen] launchIsolatedEditorOverlay called. Isolated viewer setup is handled by mainDebugPanel.");
      return; // End welcome screen processing for debug mode
    } else {
      console.error(`[WelcomeScreen] Debug Mode: Failed to get generation parameters for ${effectivePlanetSelected}. Falling back to normal welcome screen.`);
    }
  }

  // Original welcome screen logic
  console.log("[WelcomeScreen] Initializing standard welcome screen...");
  console.log(`[WelcomeScreen] Initializing... Selected Planet (original flow): ${planetSelected}`);
  const clock = new THREE.Clock();
  
  // --- Add Basic Lighting --- 
  const ambientLight = new THREE.AmbientLight(0xaaaaaa, 0.6); // Soft white ambient light
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // White directional light
  directionalLight.position.set(50, 100, 75);
  scene.add(directionalLight);
  // ------------------------
  
  // --- Create Welcome Text Shader Mesh --- 
  welcomeTextMesh = await createWelcomeTextShaderMesh();
  if (welcomeTextMesh) {
    scene.add(welcomeTextMesh);
  }
  // ---------------------------------------
  
  // Create tunnel
  const tunnel = createTunnel();
  tunnel.name = "welcomeTunnel"; // Ensure tunnel has a name for cleanup
  scene.add(tunnel);
  
  // Create STATIC planets (for initial view, if desired)
  // console.log("[WelcomeScreen] Calling createPlanets (for static initial view)... TBD if needed");
  // createPlanets(scene); // Decide if you still want static planets from this file
  
  // Initialize DYNAMIC planets
  initializeDynamicPlanets(scene, camera); // Add this call
  
  // Create title text overlay
  createTitleText();
  
  // Create start button
  welcomeButtons = createWelcomeButtons(onStart);
  
  // Animation loop definition
  const WELCOME_CAMERA_SPEED = 15.0; // Units per second
  function animate() {
    // Assign the ID
    welcomeScreenAnimationId = requestAnimationFrame(animate);

    const deltaTime = clock.getDelta(); // Get time since last frame
    const elapsedTime = clock.getElapsedTime();

    // --- Move Camera Forward --- 
    camera.position.z -= WELCOME_CAMERA_SPEED * deltaTime;
    // -------------------------
    
    // --- Update Welcome Text Shader --- 
    if (welcomeTextMesh?.material instanceof THREE.ShaderMaterial) {
      welcomeTextMesh.material.uniforms.uTime.value = elapsedTime;
    }
    // -------------------------------
    
    // Update tunnel with camera for enhanced effects
    updateTunnel(tunnel, elapsedTime, camera);
    
    // Update DYNAMIC planet spawning/despawning
    updateDynamicPlanets(elapsedTime, camera as THREE.PerspectiveCamera); // Cast camera type
    
    // Continue animation if welcome screen is still active
    // Check if buttons still exist in the DOM as a proxy for welcome screen state
    if (welcomeButtons && welcomeButtons.explore.parentNode) {
      // Loop continues via requestAnimationFrame
    } else {
        // If buttons are gone, stop this specific loop
        if (welcomeScreenAnimationId !== undefined) {
            cancelAnimationFrame(welcomeScreenAnimationId);
            welcomeScreenAnimationId = undefined;
        }
    }
  } // End of animate function definition

  // --- Ensure Camera Alignment BEFORE starting animation --- 
  // Make the camera look straight down the -Z axis from its current position
  camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1);
  // Explicitly zero out pitch and roll to ensure perfect alignment
  camera.rotation.x = 0;
  camera.rotation.z = 0;
  // ------------------------------------------------------ 
  
  // Start the animation loop
  animate();
}

/**
 * Creates HTML title text overlay
 */
function createTitleText(): void {
  // Create container
  const titleContainer = document.createElement('div');
  titleContainer.style.position = 'absolute';
  titleContainer.style.top = '30%';
  titleContainer.style.left = '0';
  titleContainer.style.width = '100%';
  titleContainer.style.textAlign = 'center';
  titleContainer.style.zIndex = '10';
  titleContainer.style.pointerEvents = 'none';
  titleContainer.style.userSelect = 'none';
  
  // Create first line - "WELCOME TO"
  const welcomeText = document.createElement('h1');
  welcomeText.textContent = 'WELCOME TO';
  welcomeText.style.color = '#c0f0ff';
  welcomeText.style.fontSize = '3rem';
  welcomeText.style.fontWeight = 'bold';
  welcomeText.style.textShadow = '0 0 10px rgba(0, 150, 255, 0.5)';
  welcomeText.style.margin = '0 0 0.5rem 0';
  
  // Create second line - "INFINIA"
  const infiniaText = document.createElement('h1');
  infiniaText.textContent = 'INFINIA';
  infiniaText.style.color = 'white';
  infiniaText.style.fontSize = '5rem';
  infiniaText.style.fontWeight = 'bold';
  infiniaText.style.textShadow = '0 0 15px rgba(100, 200, 255, 0.7)';
  infiniaText.style.margin = '0';
  
  // Add text elements to container
  titleContainer.appendChild(welcomeText);
  titleContainer.appendChild(infiniaText);
  
  // Add to document
  document.body.appendChild(titleContainer);
  
  // Store reference
  titleTextElement = titleContainer;
  
  // Add animation effect
  let opacity = 0;
  titleContainer.style.opacity = '0';
  
  // Fade in animation
  const fadeIn = () => {
    if (opacity < 1) {
      opacity += 0.02;
      titleContainer.style.opacity = opacity.toString();
      requestAnimationFrame(fadeIn);
    }
  };
  
  fadeIn();
}

/**
 * Creates DECORATIVE STATIC planets for the welcome screen
 * NOTE: Consider removing or reducing this if dynamic planets are sufficient.
 * @param scene The Three.js scene
 */
// function createPlanets(scene: THREE.Scene): void {
//   console.log("[WelcomeScreen] createPlanets (STATIC) START");
//   // Clear any existing planets and labels
//   planetMeshes.forEach(planet => disposeNode(scene, planet));
//   planetLabels.forEach(label => disposeNode(scene, label));
//   planetMeshes = [];
//   planetLabels = [];
//   
//   // --- Get list of successfully loaded alien fonts (configs, not just names) ---
//   const loadedAlienFonts = FONTS.filter((f: FontConfig) => f.type === 'alien' && getLoadedFont(f.name));
//   
//   if (loadedAlienFonts.length === 0) {
//       console.error("[WelcomeScreen] No alien fonts were loaded successfully! Cannot create varied labels.");
//       // Exit early or use a hardcoded default if necessary
//       // For now, we'll let it proceed but labels might fail if the default also didn't load
//   }
//   
//   // Define planet parameters
//   const numPlanets = 12;
//   const minDistance = 80;
//   const maxDistance = 150;
//   
//   for (let i = 0; i < numPlanets; i++) {
//     console.log(`[WelcomeScreen] createPlanets - Loop iteration ${i}`);
//     
//     // Randomize size
//     const planetSize = Math.random() * 8 + 4;
//     const geometry = new THREE.SphereGeometry(planetSize, 32, 32);
//
//     // Define seed for this planet
//     const seed = Math.random(); // Define seed here
//     
//     // === Planet Material ===
//     const planetVertexShader = `
//         precision highp float; // Ensure precision
//         varying vec3 vWorldPos;
//         varying vec3 vNormal;
//         varying vec2 vUv;
//         uniform float uTime; // Declare uTime here too
//         uniform float uSeed;
//         uniform float uNoiseScale;
//         uniform float uDistortion;
//         varying float vNoise;
//
//         void main() {
//           vec4 worldPosition = modelMatrix * vec4(position, 1.0);
//           vWorldPos = worldPosition.xyz;
//           vNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
//           vUv = uv;
//           gl_Position = projectionMatrix * viewMatrix * worldPosition;
//         }
//       `;
//
//     const planetFragmentShader = `
//         precision highp float; // Ensure precision
//         varying vec3 vWorldPos;
//         varying vec3 vNormal;
//         varying vec2 vUv;
//
//         uniform vec3 uCameraPos;
//         uniform float uTime;
//         uniform float uSeed;
//         uniform float uSize;
//         uniform float uDetail;
//
//         // --- Prepended GLSL Code ---
//         ${mathGLSL}
//         ${noiseGLSL} // Uses the MODIFIED noiseGLSL
//         // --- End Prepended Code ---
//
//         // --- Replaced Inline Functions ---
//         // hash31, valueNoise3D, fbmValue3D available from noiseGLSL
//
//         // Enhanced color palette selection based on seed
//         vec3 getPlanetBaseColor(float seed) {
//             float planetType = floor(seed * 6.0);
//             if (planetType < 1.0) return mix(vec3(0.1, 0.3, 0.7), vec3(0.2, 0.5, 0.2), fract(seed * 7.0));
//             else if (planetType < 2.0) return mix(vec3(0.6, 0.2, 0.0), vec3(0.8, 0.4, 0.1), fract(seed * 5.0));
//             else if (planetType < 3.0) return mix(vec3(0.7, 0.6, 0.4), vec3(0.8, 0.5, 0.2), fract(seed * 3.0));
//             else if (planetType < 4.0) return mix(vec3(0.6, 0.8, 0.9), vec3(0.7, 0.7, 0.8), fract(seed * 9.0));
//             else if (planetType < 5.0) return mix(vec3(0.1, 0.5, 0.3), vec3(0.3, 0.7, 0.2), fract(seed * 11.0));
//             else return mix(vec3(0.6, 0.0, 0.6), vec3(0.9, 0.2, 0.5), fract(seed * 13.0));
//         }
//
//         void main() {
//             vec3 seedOffset = vec3(uSeed * 1.23, uSeed * 2.34, uSeed * 3.45);
//             float baseScale = 1.0 + fract(uSeed * 10.0) * 0.6;
//             baseScale *= uDetail / uSize; // Scale detail by planet size
//
//             vec3 baseColor = getPlanetBaseColor(uSeed);
//
//             // Add noise patterns using module fbmValue3D with float for octaves
//             vec3 p_surface = vWorldPos * baseScale + seedOffset;
//             float surfaceNoise = fbmValue3D(p_surface, 5.0, 2.1, 0.5);
//
//             float featureFactor = smoothstep(0.4, 0.6, surfaceNoise);
//             vec3 featureColor = mix(baseColor * 0.5, baseColor * 1.5, fract(uSeed * 3.21));
//             vec3 planetColor = mix(baseColor, featureColor, featureFactor);
//
//             // Add animated cloud patterns using module fbmValue3D with float for octaves
//             vec3 p_clouds = vWorldPos * baseScale * 1.2 + seedOffset;
//             p_clouds.xy += uTime * 0.02;
//             float cloudNoise = fbmValue3D(p_clouds, 4.0, 2.1, 0.5);
//             float cloudFactor = smoothstep(0.6, 0.8, cloudNoise);
//             vec3 surfaceWithClouds = mix(planetColor, vec3(1.0), cloudFactor * 0.5);
//
//             // Basic lighting
//             vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
//             float diffuse = max(dot(vNormal, lightDir), 0.0);
//             vec3 ambient = 0.3 * surfaceWithClouds;
//             vec3 diffuseLight = diffuse * surfaceWithClouds;
//
//             // Add atmospheric rim effect
//             vec3 viewDir = normalize(uCameraPos - vWorldPos);
//             float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
//             float rimFactor = pow(rimDot, 3.0);
//             vec3 rimColor = rimFactor * mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.6, 0.6), fract(uSeed * 5.67)) * 0.8;
//
//             // Add slightly pulsing glow based on time
//             float glowPulse = 0.2 * sin(uTime * 0.2 + uSeed * 10.0) + 0.8;
//             rimColor *= glowPulse;
//
//             vec3 finalColor = ambient + diffuseLight + rimColor;
//             gl_FragColor = vec4(finalColor, 1.0);
//         }
//       `;
//
//     const material = new THREE.ShaderMaterial({
//       vertexShader: planetVertexShader,
//       fragmentShader: planetFragmentShader,
//       uniforms: {
//         uTime: { value: 0.0 },
//         uSeed: { value: seed },
//         uColor1: { value: new THREE.Color().setHSL(Math.random(), 0.7, 0.5) },
//         uColor2: { value: new THREE.Color().setHSL(Math.random(), 0.7, 0.5) },
//         uColor3: { value: new THREE.Color().setHSL(Math.random(), 0.7, 0.5) },
//         uNoiseScale: { value: 5.0 + Math.random() * 10.0 },
//         uFbmOctaves: { value: 4.0 },
//         uFbmLacunarity: { value: 2.1 },
//         uFbmGain: { value: 0.45 },
//         uCameraPos: { value: new THREE.Vector3() },
//         uSize: { value: planetSize },
//         uDetail: { value: 1.0 }
//       },
//       side: THREE.FrontSide
//     });
//     
//     // Create mesh
//     const mesh = new THREE.Mesh(geometry, material);
//     
//     // Calculate and set position directly
//     const angle = (i / numPlanets) * Math.PI * 2;
//     const distance = minDistance + Math.random() * (maxDistance - minDistance);
//     const x = Math.cos(angle) * distance;
//     const y = Math.random() * 40 - 20; // Random vertical spread
//     const z = Math.sin(angle) * distance;
//     mesh.position.set(x, y, z); // Set position directly
//     mesh.name = `welcomePlanet_${i}`; 
//
//     // Store user data for animation
//     mesh.userData.angle = angle;
//     mesh.userData.distance = distance;
//     mesh.userData.ySpeed = Math.random() * 0.2 + 0.05;
//     mesh.userData.yOffset = Math.random() * Math.PI * 2;
//     
//     // Add slight random rotation
//     mesh.rotation.set(
//       Math.random() * Math.PI, 
//       Math.random() * Math.PI,
//       Math.random() * Math.PI
//     );
//     
//     // Add to scene and track
//     scene.add(mesh);
//     planetMeshes.push(mesh);
//
//     // --- Create Planet Label --- 
//     console.log(`  [WelcomeScreen] Planet ${i} - Attempting label creation...`);
//     
//     // Filter for successfully loaded alien fonts only
//     const loadedAlienFonts = FONTS.filter(font => 
//         font.type === 'alien' && getLoadedFont(font.name) !== undefined
//     );
//     
//     let selectedFontConfig: FontConfig | undefined = undefined;
//     if (loadedAlienFonts.length > 0) { 
//         selectedFontConfig = loadedAlienFonts[Math.floor(Math.random() * loadedAlienFonts.length)];
//     } else {
//         selectedFontConfig = FONTS.find(f => f.name === 'AlienAlphabet'); 
//         if (!getLoadedFont('AlienAlphabet')) {
//              console.warn(`  [WelcomeScreen] Planet ${i} - Default fallback font 'AlienAlphabet' also not loaded.`);
//              selectedFontConfig = undefined; 
//         }
//     }
//     const planetName = generateAlienPlanetName();
//     if (selectedFontConfig) {
//         console.log(`  [WelcomeScreen] Planet ${i}: Name="${planetName}", Font="${selectedFontConfig.name}" (Using internal name)`);
//         const labelGroup = createMultiFontTextLabel(planetName, 1);
//         if (labelGroup) {
//           labelGroup.position.copy(mesh.position).add(new THREE.Vector3(0, planetSize + 10, 0));
//           labelGroup.userData.planetIndex = i;
//           scene.add(labelGroup);
//           planetLabels.push(labelGroup);
//           console.log(`  [WelcomeScreen] Planet ${i} - Label group added to scene.`);
//         } else {
//            console.warn(`  [WelcomeScreen] Planet ${i} - Failed to create label group for ${planetName}.`);
//         }
//     } else {
//         // This case should only happen if no alien fonts loaded *at all*
//         console.error(`  [WelcomeScreen] Planet ${i} - Skipping label creation as no alien fonts are loaded.`);
//     }
//
//   } // End planet loop
//   
//   // Add a few very distant background planets
//   const numBackgroundPlanets = 6;
//   for (let i = 0; i < numBackgroundPlanets; i++) {
//     const angle = Math.random() * Math.PI * 2;
//     const distance = Math.random() * 200 + 200; // 200-400 units away
//     const zDistance = -(Math.random() * 800 + 200); // Further back in tunnel
//     
//     const xPosition = Math.cos(angle) * distance;
//     const yPosition = Math.sin(angle) * distance;
//     
//     const size = Math.random() * 25 + 15; // Larger background planets
//     
//     // Create a simpler geometry for distant planets
//     const geometry = new THREE.SphereGeometry(size, 16, 16);
//     
//     // Use a simplified material for distant planets
//     const material = new THREE.MeshBasicMaterial({
//       color: new THREE.Color(
//         0.5 + Math.random() * 0.5,
//         0.5 + Math.random() * 0.5,
//         0.5 + Math.random() * 0.5
//       ),
//       transparent: true,
//       opacity: 0.7,
//     });
//     
//     const mesh = new THREE.Mesh(geometry, material);
//     mesh.position.set(xPosition, yPosition, zDistance);
//     mesh.name = `backgroundPlanet_${i}`;
//     
//     scene.add(mesh);
//     planetMeshes.push(mesh);
//   }
//   console.log("[WelcomeScreen] createPlanets END");
// }

/**
 * Updates STATIC planet rotations and label orientation/animation
 * NOTE: Only needed if static planets are kept.
 * @param elapsedTime Current elapsed time
 * @param camera The Three.js camera
 */
// function updatePlanets(elapsedTime: number, camera: THREE.Camera): void {
//   planetMeshes.forEach((planet, index) => {
//     // Rotate planets at different speeds
//     planet.rotation.y += 0.002 + (index % 5) * 0.0005;
//     planet.rotation.x += 0.001 + (index % 3) * 0.0003;
//
//     // Update shader time uniform if material is ShaderMaterial
//     if (planet.material instanceof THREE.ShaderMaterial) {
//       planet.material.uniforms.uTime.value = elapsedTime;
//     }
//   });
//
//   // Update label animations and make them face the camera
//   planetLabels.forEach(label => {
//     // Check if label is not null before updating
//     if (label) {
//         updateLabelGroup(label, elapsedTime);
//         label.lookAt(camera.position);
//     }
//   });
// }

/**
 * Cleans up welcome screen elements
 * @param scene The Three.js scene
 */
export function cleanupWelcomeScreen(scene: THREE.Scene): void {
  // Remove STATIC planets and labels (if any were created by this file)
  console.log("[WelcomeScreen] Cleaning up STATIC planets/labels (if any remain)...");
  // planetMeshes.forEach(planet => disposeNode(scene, planet)); // These arrays should be empty now
  // planetMeshes = [];
  // planetLabels.forEach(label => disposeNode(scene, label));
  // planetLabels = [];

  // Remove Welcome Text Shader Mesh
  if (welcomeTextMesh) {
    disposeNode(scene, welcomeTextMesh);
    welcomeTextMesh = null;
  }
  // Remove title text
  if (titleTextElement && titleTextElement.parentNode) {
    titleTextElement.parentNode.removeChild(titleTextElement);
    titleTextElement = null;
  }
  // Remove buttons
  removeWelcomeButtons();
  welcomeButtons = null;

  // Stop the welcome screen animation loop if it's running
  if (welcomeScreenAnimationId !== undefined) {
    cancelAnimationFrame(welcomeScreenAnimationId);
    welcomeScreenAnimationId = undefined;
  }

  // Clean up DYNAMIC planets
  cleanupDynamicPlanets(); // Add this call

  // Remove tunnel
  const tunnel = scene.getObjectByName("welcomeTunnel"); // Use name
  if (tunnel) {
    disposeNode(scene, tunnel);
  }

  console.log("Welcome screen cleaned up.");
} 

// --- Function to create the 3D Welcome Text Plane ---
async function createWelcomeTextShaderMesh(): Promise<THREE.Mesh | null> {
  try {
    // Geometry (adjust size as needed)
    const textGeometry = new THREE.PlaneGeometry(60, 30, 32, 32); // Wider plane
    
    // Material
    const textMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: welcomeTextVertexShader,
      fragmentShader: welcomeTextFragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false // Prevent writing to depth buffer if it causes issues with other transparent objects
    });
    
    // Mesh
    const mesh = new THREE.Mesh(textGeometry, textMaterial);
    // Position it in front of the initial camera view
    // Initial camera Z is 300, so place it closer, e.g., Z = 150-200
    mesh.position.set(0, 25, 180); // Adjust Y and Z as needed
    mesh.rotation.x = -0.05; // Slight tilt
    mesh.name = "welcomeTextShaderPlane";
    
    console.log("[WelcomeScreen] 3D Welcome Text Shader Mesh created.");
    return mesh;
  } catch (error) {
    console.error("[WelcomeScreen] Error creating 3D welcome text shader mesh:", error);
    return null;
  }
}
// --- End Function --- 