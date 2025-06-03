import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { NoiseMap, NoiseLayers, Seed } from '../../../types_debug';
import type { TopElementsData } from '../../types/renderingTypes';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../../constants_debug';

// Core state
let containerElement: HTMLDivElement | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let orbitControls: OrbitControls | null = null;
let animationFrameId: number | null = null;
let isInitialized = false;

// Parameters needed for regeneration/editing
let currentNoiseLayers: NoiseLayers | null = null;
let currentSeed: Seed | null = null;
let currentCompInfo: { topElements: TopElementsData | null } | null = null;
let currentPlanetOffset: THREE.Vector3 | null = null;
let currentNoiseScale: number | null = null;

// Constants
const ISOLATED_CHUNK_X = 0;
const ISOLATED_CHUNK_Y = 0;
const ISOLATED_CHUNK_Z = 0;
const ISOLATED_CHUNK_KEY = `${ISOLATED_CHUNK_X},${ISOLATED_CHUNK_Y},${ISOLATED_CHUNK_Z}`;

// Animation hooks
type AnimationHook = () => void;
let preRenderHooks: AnimationHook[] = [];
let postRenderHooks: AnimationHook[] = [];

export function addPreRenderHook(hook: AnimationHook) {
    preRenderHooks.push(hook);
}

export function addPostRenderHook(hook: AnimationHook) {
    postRenderHooks.push(hook);
}

export function removePreRenderHook(hook: AnimationHook) {
    preRenderHooks = preRenderHooks.filter(h => h !== hook);
}

export function removePostRenderHook(hook: AnimationHook) {
    postRenderHooks = postRenderHooks.filter(h => h !== hook);
}

// Resize handler
function handleResize() {
    if (!containerElement || !camera || !renderer) return;
    
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

// Initialize core viewer
export function initCoreViewer(container: HTMLDivElement) {
    if (isInitialized) {
        console.warn('Core viewer already initialized');
        return;
    }

    if (!container) {
        console.error("IsolatedViewer: Container element is required.");
        throw new Error("Container element is required.");
    }
    containerElement = container;

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a202c');

    // Create camera
    camera = new THREE.PerspectiveCamera(75, containerElement.clientWidth / containerElement.clientHeight, 0.1, 1000);
    camera.position.set(
        ISOLATED_CHUNK_X * CHUNK_SIZE + CHUNK_SIZE / 2,
        CHUNK_HEIGHT / 2,
        ISOLATED_CHUNK_Z * CHUNK_SIZE + CHUNK_SIZE / 2
    );

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerElement.clientWidth, containerElement.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerElement.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Orbit Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.screenSpacePanning = false;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 500;
    orbitControls.maxPolarAngle = Math.PI / 2;
    orbitControls.target.set(0, 0, 0);
    orbitControls.enablePan = true;
    orbitControls.enableZoom = true;
    orbitControls.update();

    // Handle Resize
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerElement);
    (containerElement as any).__resizeObserver = resizeObserver;

    isInitialized = true;
}

export function startAnimation() {
    if (!scene || !camera || !renderer || !orbitControls) return;

    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        // Run pre-render hooks
        preRenderHooks.forEach(hook => {
            try {
                hook();
            } catch (e) {
                console.error("Error in pre-render hook:", e);
            }
        });

        // Update orbit controls
        orbitControls?.update();

        // Render scene
        renderer?.render(scene!, camera!);

        // Run post-render hooks
        postRenderHooks.forEach(hook => {
            try {
                hook();
            } catch (e) {
                console.error("Error in post-render hook:", e);
            }
        });
    }

    animate();
}

export function stopAnimation() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    // Clear hooks
    preRenderHooks = [];
    postRenderHooks = [];
}

export function cleanupCoreViewer() {
    if (!isInitialized) return;

    stopAnimation();
    
    if (renderer) {
        renderer.dispose();
        renderer = null;
    }

    if (scene) {
        scene.clear();
        scene = null;
    }

    if (camera) {
        camera = null;
    }

    if (orbitControls) {
        orbitControls.dispose();
        orbitControls = null;
    }

    if (containerElement) {
        if ((containerElement as any).__resizeObserver) {
            (containerElement as any).__resizeObserver.disconnect();
            delete (containerElement as any).__resizeObserver;
        }
        containerElement.innerHTML = '';
        containerElement = null;
    }

    isInitialized = false;
}

// Getters for core components
export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
export function getOrbitControls() { return orbitControls; }
export function getContainer() { return containerElement; }
export function isCoreInitialized() { return isInitialized; }

// Setters for generation parameters
export function setGenerationParams(params: {
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale?: number;
    planetOffset?: THREE.Vector3;
}) {
    currentNoiseLayers = params.noiseLayers;
    currentSeed = params.seed;
    currentCompInfo = params.compInfo;
    currentNoiseScale = params.noiseScale ?? null;
    currentPlanetOffset = params.planetOffset ?? null;
}

// Getters for generation parameters
export function getCurrentNoiseLayers() { return currentNoiseLayers; }
export function getCurrentSeed() { return currentSeed; }
export function getCurrentCompInfo() { return currentCompInfo; }
export function getCurrentNoiseScale() { return currentNoiseScale; }
export function getCurrentPlanetOffset() { return currentPlanetOffset; } 