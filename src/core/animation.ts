import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { MarchingCubes } from '../marching-cubes';
import { ThirdPersonController } from '../third-person-controller';
import { updateTunnel } from './tunnel';
import { TunnelCameraController } from './tunnelCamera';

/**
 * Manages the main animation loop and updates game state per frame.
 */
export class AnimationManager {
    // Core components
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private clock = new THREE.Clock(); // Manages its own clock

    // Game state reference (passed in or updated via method)
    private isGameStartedRef: { value: boolean }; // Use ref object for external changes

    // Components (optional, might be null before game starts)
    private stats?: Stats;
    private orbitControls?: OrbitControls;
    private thirdPersonController?: ThirdPersonController;
    private playerCylinder?: THREE.Mesh;
    private welcomeTextMesh?: THREE.Mesh | null;
    private marchingCubes?: MarchingCubes;
    private tunnelSystem?: THREE.Group;
    private tunnelCamera?: TunnelCameraController;

    // Collision detection helpers
    private groundRaycaster = new THREE.Raycaster();
    private downwardVector = new THREE.Vector3(0, -1, 0);
    private playerHeightOffset = 1.8; // TODO: Share or pass this constant

    private animationFrameId: number | null = null;
    // Change to store multiple callbacks
    private externalUpdateCallbacks: Array<(elapsedTime: number, camera: THREE.PerspectiveCamera) => void> = []; 

    constructor(
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        isGameStartedRef: { value: boolean } // Pass game state ref
    ) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isGameStartedRef = isGameStartedRef;
    }

    // Method to register an external update function (e.g., for planets)
    // Update to add to the array
    public registerUpdateCallback(callback: (elapsedTime: number, camera: THREE.PerspectiveCamera) => void) {
        this.externalUpdateCallbacks.push(callback);
    }

    // Method to unregister a specific callback (optional, but good practice)
    public unregisterUpdateCallback(callbackToRemove: (elapsedTime: number, camera: THREE.PerspectiveCamera) => void) {
        this.externalUpdateCallbacks = this.externalUpdateCallbacks.filter(cb => cb !== callbackToRemove);
    }

    // Method to set components that might not be available at construction
    public setComponents({
        stats,
        orbitControls,
        thirdPersonController,
        playerCylinder,
        welcomeTextMesh,
        marchingCubes,
        tunnelSystem,
        tunnelCamera
    }: {
        stats?: Stats;
        orbitControls?: OrbitControls;
        thirdPersonController?: ThirdPersonController;
        playerCylinder?: THREE.Mesh;
        welcomeTextMesh?: THREE.Mesh | null;
        marchingCubes?: MarchingCubes;
        tunnelSystem?: THREE.Group;
        tunnelCamera?: TunnelCameraController;
    }) {
        this.stats = stats !== undefined ? stats : this.stats;
        this.orbitControls = orbitControls !== undefined ? orbitControls : this.orbitControls;
        this.thirdPersonController = thirdPersonController !== undefined ? thirdPersonController : this.thirdPersonController;
        this.playerCylinder = playerCylinder !== undefined ? playerCylinder : this.playerCylinder;
        this.welcomeTextMesh = welcomeTextMesh !== undefined ? welcomeTextMesh : this.welcomeTextMesh;
        this.marchingCubes = marchingCubes !== undefined ? marchingCubes : this.marchingCubes;
        this.tunnelSystem = tunnelSystem !== undefined ? tunnelSystem : this.tunnelSystem;
        this.tunnelCamera = tunnelCamera !== undefined ? tunnelCamera : this.tunnelCamera;
    }
    
    // The main loop logic, moved from main.ts
    private animate(): void {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        // console.log("Animate loop running..."); // Basic check

        const elapsedTime = this.clock.getElapsedTime();

        // Call the external update callback if registered
        // Update to iterate and call all callbacks
        for (const callback of this.externalUpdateCallbacks) {
            try { // Add try-catch around external callbacks
                 callback(elapsedTime, this.camera);
            } catch (error) {
                 console.error("Error executing external update callback:", error);
                 // Optionally unregister the faulty callback:
                 // this.unregisterUpdateCallback(callback); 
            }
        }

        // Update tunnel shader (can be done in both game modes)
        if (this.tunnelSystem) {
            updateTunnel(this.tunnelSystem, elapsedTime, this.camera);
        }

        if (this.isGameStartedRef.value) {
            console.log("AnimationManager: Game Started mode");
            // --- Game Mode --- 
            if (this.thirdPersonController?.getIsEnabled()) {
                console.log("AnimationManager: Updating ThirdPersonController directly");
                this.thirdPersonController.update(); // Rely on controller for Y position

                // Ground Collision Detection REMOVED - Handled by ThirdPersonController
                /*
                if (this.marchingCubes && this.camera && this.playerCylinder) {
                    ...
                }
                */
                // End Ground Collision REMOVED

                // Update player cylinder position
                if (this.playerCylinder && this.camera) {
                    this.playerCylinder.position.x = this.camera.position.x;
                    this.playerCylinder.position.y = this.camera.position.y - this.playerHeightOffset / 2;
                    this.playerCylinder.position.z = this.camera.position.z;
                    this.playerCylinder.visible = true;
                }
            } else if (this.orbitControls) {
                // Orbit Mode during game (if applicable, e.g., after exiting FP)
                if(this.orbitControls.enabled) this.orbitControls.update();
                if (this.playerCylinder) {
                    this.playerCylinder.visible = false;
                }
            }
        } else {
            // console.log("Animate: Welcome Screen"); // Check welcome state branch
            // --- Welcome Screen Mode ---
            
            // Update tunnel camera controller ONLY in welcome screen mode
            if (this.tunnelCamera) {
                this.tunnelCamera.update();
            }
            
            // Animate Welcome Text Shader
            if (this.welcomeTextMesh && this.welcomeTextMesh.material instanceof THREE.ShaderMaterial) {
                this.welcomeTextMesh.material.uniforms.uTime.value = elapsedTime;
            }
             // Animate Welcome Text Position/Rotation
            if (this.welcomeTextMesh) {
                // console.log("Animate: Updating Welcome Text Mesh");
                this.welcomeTextMesh.rotation.y += 0.002;
                this.welcomeTextMesh.position.y = 15 + Math.sin(elapsedTime * 0.5) * 0.2; // Adjusted Y pos & float
            }
        }

        // console.log("Animate: Rendering frame"); // Check before render call
        // Render the scene
        this.renderer.render(this.scene, this.camera);

        // Update Stats
        if (this.stats) {
            try {
                this.stats.update();
            } catch (error) {
                console.warn('Stats.js update failed - disabling stats panel.');
                this.stats.update = () => {}; // Prevent further errors
                if (this.stats.dom.parentNode) {
                    this.stats.dom.parentNode.removeChild(this.stats.dom);
                }
            }
        }
    }

    // Start the animation loop
    public start(): void {
        if (this.animationFrameId === null) {
            this.animate();
            console.log("AnimationManager started.");
        }
    }

    // Stop the animation loop
    public stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log("AnimationManager stopped.");
        }
    }
} 