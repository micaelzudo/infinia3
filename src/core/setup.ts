import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * Contains the results of the initial scene setup.
 */
export interface SceneSetup {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    orbitControls: OrbitControls;
}

/**
 * Initializes the basic Three.js scene, camera, renderer, lights, and orbit controls
 * suitable for the welcome screen.
 * @returns An object containing the created scene, camera, renderer, and orbitControls.
 */
export function initializeSceneBasics(): SceneSetup {
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050510); // Dark space blue background
    document.body.appendChild(renderer.domElement);

    // Scene
    const scene = new THREE.Scene();

    // --- Add Fog for Infinite Tunnel Illusion ---
    const fogColor = 0x050510; // Match clear color
    const fogNear = 50;      // Start fading EXTREMELY close
    const fogFar = 600;       // Fully faded EXTREMELY close (adjust if too much)
    scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    // -------------------------------------------

    // --- Background REMOVED - Handled separately ---
    /*
    const textureLoader = new THREE.TextureLoader();
    // Replace with your desired high-resolution space background image URL
    const backgroundTextureUrl = 'https://images.pexels.com/photos/1252890/pexels-photo-1252890.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=750&w=1260'; 
    textureLoader.load(backgroundTextureUrl, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping; // Suitable for panoramic images
        // texture.colorSpace = THREE.SRGBColorSpace; // If your image is sRGB
        scene.background = texture;
        console.log("Background texture loaded.");
    }, undefined, (err) => {
        console.error("Error loading background texture:", err);
        // Fallback to clear color is already set
    });
    */
    // --- End Background ---

    // Camera
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 15, 50); // Positioned to view the title
    camera.lookAt(0, 10, 0);

    // OrbitControls (for the welcome screen initially)
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.enabled = true; 
    orbitControls.target.set(0, 10, 0);

    // Lighting (for welcome screen)
    const ambientLight = new THREE.AmbientLight(0x404060, 1.5);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x80aaff, 2, 100);
    pointLight.position.set(-10, 25, 20);
    scene.add(pointLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    return { scene, camera, renderer, orbitControls };
} 