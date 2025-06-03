import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { disposeNode } from "./disposeNode";
import { generateMesh } from "./meshGenerator";
import { generateNoiseMap } from "./noiseMapGenerator";
import { LoadedChunks, NoiseLayers } from "./types";
import { getChunkKey } from "./utils";
import { createStartButton } from "./ui";

/* ============ SETUP ============ */

// Shared state to track if game has started
const gameState = {
  value: false
};

// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("app") as HTMLCanvasElement,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animation);
const canvasContainer = document.getElementById("canvas-container");
canvasContainer?.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
camera.position.y = 90;
camera.position.x = 60;
camera.position.z = 60;

// Scene
const scene = new THREE.Scene();

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

/* ============ CONTROLS ============ */

const controls = new OrbitControls(camera, renderer.domElement);
controls.target = new THREE.Vector3(0, 0, 0);
controls.autoRotate = true;
controls.update();

/* ============ WELCOME SCREEN ============ */
let welcomeTextMesh: THREE.Mesh | null = null;
let startButton: HTMLElement | null = null;
let clock = new THREE.Clock();

// Create welcome text
async function createWelcomeText(): Promise<THREE.Mesh | null> {
  // Create a simple text geometry for the welcome screen
  const textGeometry = new THREE.PlaneGeometry(40, 20, 32, 32);
  
  const textMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 }
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      
      void main() {
        vUv = uv; 
        vec3 pos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float; 
      uniform float uTime;
      varying vec2 vUv;
      
      // Color definitions
      vec3 colorA = vec3(0.1, 0.2, 0.8); // Deep Blue
      vec3 colorB = vec3(0.5, 0.2, 1.0); // Purple
      vec3 colorC = vec3(0.2, 0.8, 1.0); // Cyan
      
      // --- Hex Grid Function ---
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
          return line;
      }
      
      void main() {
          // Base color gradient
          vec3 baseColor = mix(colorA, colorB, smoothstep(0.3, 0.7, sin(vUv.y * 2.0 + uTime * 0.5)));
          baseColor = mix(baseColor, colorC, smoothstep(0.3, 0.7, cos(vUv.x * 2.0 + uTime * 0.7)));
      
          // Calculate hexagonal grid pattern
          float scale = 25.0; // Adjust scale for hexagon size
          float lineWidth = 0.03; // Adjust line thickness
          float hexPattern = hexGrid(vUv, scale, lineWidth);
      
          // Make hex lines glow slightly based on time
          vec3 hexColor = vec3(0.8, 0.8, 1.0) * (0.5 + 0.5 * sin(uTime * 2.0)); // Pulsing white/cyan
          
          // Combine base color with hex grid lines (darken base color where lines are)
          vec3 finalColor = mix(baseColor, hexColor, 1.0 - hexPattern); 
      
          gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    transparent: false,
    side: THREE.DoubleSide
  });
  
  const welcomeMesh = new THREE.Mesh(textGeometry, textMaterial);
  welcomeMesh.position.set(0, 15, -30);
  welcomeMesh.name = "welcomeText";
  scene.add(welcomeMesh);
  
  return welcomeMesh;
}

// Add text to the scene
const textOverlay = document.createElement('div');
textOverlay.id = 'text-overlay';
textOverlay.style.position = 'absolute';
textOverlay.style.top = '15%';
textOverlay.style.left = '0';
textOverlay.style.width = '100%';
textOverlay.style.textAlign = 'center';
textOverlay.style.fontSize = '4em';
textOverlay.style.fontWeight = 'bold';
textOverlay.style.color = 'white';
textOverlay.style.textShadow = '0 0 10px rgba(0,150,255,0.8)';
textOverlay.style.zIndex = '10';
textOverlay.innerHTML = 'WELCOME TO<br>MARCHING CUBES';
document.body.appendChild(textOverlay);

// Create loading overlay and hide it after initialization
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loading';
loadingOverlay.style.position = 'fixed';
loadingOverlay.style.top = '0';
loadingOverlay.style.left = '0';
loadingOverlay.style.width = '100%';
loadingOverlay.style.height = '100%';
loadingOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
loadingOverlay.style.display = 'flex';
loadingOverlay.style.justifyContent = 'center';
loadingOverlay.style.alignItems = 'center';
loadingOverlay.style.color = 'white';
loadingOverlay.style.fontSize = '24px';
loadingOverlay.style.zIndex = '1000';
loadingOverlay.textContent = 'Loading...';
document.body.appendChild(loadingOverlay);

// Hide loading overlay after everything is loaded
window.addEventListener('load', () => {
  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 1000);
});

// Create welcome screen elements
async function initWelcomeScreen() {
  // Create welcome text with shaders
  welcomeTextMesh = await createWelcomeText();
  
  // Create start button
  startButton = createStartButton(startGame);
  
  const canvasContainerElement = document.getElementById('canvas-container');
  if (canvasContainerElement) {
    const firstChild = canvasContainerElement.querySelector('.absolute') as HTMLElement;
    if (firstChild) {
      firstChild.style.display = 'none';
    }
  }
}

// Start the game (transition from welcome screen to main experience)
async function startGame() {
  if (gameState.value) return;
  console.log("Starting Marching Cubes...");
  gameState.value = true;
  
  // Clean up welcome screen elements
  if (welcomeTextMesh) scene.remove(welcomeTextMesh);
  if (startButton) startButton.remove();
  if (textOverlay) textOverlay.style.display = 'none';
  
  // Show the original content
  const canvasContainerElement = document.getElementById('canvas-container');
  if (canvasContainerElement) {
    const firstChild = canvasContainerElement.querySelector('.absolute') as HTMLElement;
    if (firstChild) {
      firstChild.style.display = 'flex';
    }
  }
  
  // Transition to the main experience
  generateMap();
}

/* ============ MESH GENERATOR ============ */

const MAP_SIZE = 2;

let loadedChunks: LoadedChunks = {};

let seed = Math.random();

let noiseLayers: NoiseLayers = [50, 25, 10];

function generateMap() {
  for (let z = -MAP_SIZE / 2; z <= MAP_SIZE / 2; z++) {
    for (let x = -MAP_SIZE / 2; x <= MAP_SIZE / 2; x++) {
      if (getChunkKey(x, z) in loadedChunks) {
        loadedChunks[getChunkKey(x, z)].noiseMap = generateNoiseMap(
          x,
          0,
          z,
          noiseLayers,
          seed,
          false
        );
      } else {
        loadedChunks[getChunkKey(x, z)] = {
          noiseMap: generateNoiseMap(x, 0, z, noiseLayers, seed, false),
          mesh: null,
        };
      }
    }
  }

  for (let z = -MAP_SIZE / 2; z <= MAP_SIZE / 2; z++) {
    for (let x = -MAP_SIZE / 2; x <= MAP_SIZE / 2; x++) {
      const { mesh: oldMesh, noiseMap } = loadedChunks[getChunkKey(x, z)];

      if (oldMesh) {
        disposeNode(scene, oldMesh);
      }

      const mesh = generateMesh(x, 0, z, { noiseMap }, true, false);
      loadedChunks[getChunkKey(x, z)].mesh = mesh;
      scene.add(mesh);
    }
  }
}

// Initialize welcome screen instead of immediately generating the map
// We'll generate the map when the user clicks "Start"
initWelcomeScreen();

/* ============ ANIMATION ============ */

function animation(_time: number) {
  const elapsedTime = clock.getElapsedTime();
  
  // Update welcome text shader if it exists
  if (!gameState.value && welcomeTextMesh && welcomeTextMesh.material instanceof THREE.ShaderMaterial) {
    welcomeTextMesh.material.uniforms.uTime.value = elapsedTime;
  }
  
  controls.update();
  renderer.render(scene, camera);
}

/* ============ MISC EVENT LISTENERS ============ */

window.addEventListener("resize", () => {
  let width = window.innerWidth;
  let height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
