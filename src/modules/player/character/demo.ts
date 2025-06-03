/**
 * Demo for testing character animations
 */

import * as THREE from 'three';
import { CharacterController } from './characterController';

/**
 * Initialize a demo scene with a character
 */
export function initCharacterDemo(): { scene: THREE.Scene, renderer: THREE.WebGLRenderer, character: CharacterController } {
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create character controller
    const character = new CharacterController({
        scene,
        renderer,
        camera,
        initialPosition: new THREE.Vector3(0, 2, 0),
        onAddTerrain: (mesh) => {
            console.log("Terrain mesh added:", mesh);
        }
    });
    
    // Add ground mesh to character physics
    character.addTerrainMesh(ground);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Create animation test buttons
    createAnimationTestUI(character);
    
    return { scene, renderer, character };
}

/**
 * Create a simple UI for testing animations
 */
function createAnimationTestUI(character: CharacterController): void {
    // Create container for buttons
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '5px';
    document.body.appendChild(container);
    
    // Define animations to test
    const animations = [
        { name: 'idle', label: 'Idle' },
        { name: 'walk', label: 'Walk' },
        { name: 'run', label: 'Run' },
        { name: 'sprint', label: 'Sprint' },
        { name: 'jump_idle', label: 'Jump Idle' },
        { name: 'jump_running', label: 'Jump Running' }
    ];
    
    // Create a button for each animation
    animations.forEach(anim => {
        const button = document.createElement('button');
        button.textContent = anim.label;
        button.style.padding = '8px 16px';
        button.style.cursor = 'pointer';
        
        button.addEventListener('click', () => {
            console.log(`Playing animation: ${anim.name}`);
            character.playAnimation(anim.name);
        });
        
        container.appendChild(button);
    });
}

/**
 * Start the animation loop for the demo
 */
export function startCharacterDemoLoop(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    character: CharacterController
): void {
    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        
        const deltaTime = clock.getDelta();
        
        // Update character
        character.update(deltaTime);
        
        // Render scene with character camera
        renderer.render(scene, character.getCamera());
    }
    
    animate();
} 