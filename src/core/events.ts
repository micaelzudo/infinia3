import * as THREE from 'three';
import { MarchingCubes } from '../marching-cubes';
import { ThirdPersonController } from '../third-person-controller';

// Type for the callback to toggle first person mode
type ToggleFirstPersonCallback = (enable: boolean) => void;

/**
 * Manages global event listeners for the application (mouse, keyboard, resize).
 */
export class EventManager {
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private marchingCubes?: MarchingCubes;
    private thirdPersonController?: ThirdPersonController;
    private toggleFirstPersonModeCallback: ToggleFirstPersonCallback;

    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private isMouseDown = false;
    private isRightMouseDown = false;

    // Bound functions to maintain 'this' context
    private boundOnWindowResize = this.onWindowResize.bind(this);
    private boundOnMouseDown = this.onMouseDown.bind(this);
    private boundOnMouseUp = this.onMouseUp.bind(this);
    private boundOnMouseMove = this.onMouseMove.bind(this);
    private boundOnGameKeyDown = this.onGameKeyDown.bind(this);
    private boundContextMenu = (event: Event) => event.preventDefault();

    constructor(
        camera: THREE.PerspectiveCamera,
        renderer: THREE.WebGLRenderer,
        toggleFirstPersonModeCallback: ToggleFirstPersonCallback
    ) {
        this.camera = camera;
        this.renderer = renderer;
        this.toggleFirstPersonModeCallback = toggleFirstPersonModeCallback;
        
        // Initial listener (resize is always needed)
        window.addEventListener('resize', this.boundOnWindowResize);
    }

    // Method to set dependencies that are only available after game starts
    public setGameDependencies(
        marchingCubes: MarchingCubes,
        thirdPersonController: ThirdPersonController
    ) {
        this.marchingCubes = marchingCubes;
        this.thirdPersonController = thirdPersonController;
    }

    // Add listeners specific to the game state (e.g., mouse editing, game keys)
    public addGameEventListeners(): void {
        window.addEventListener('mousedown', this.boundOnMouseDown);
        window.addEventListener('mouseup', this.boundOnMouseUp);
        window.addEventListener('mousemove', this.boundOnMouseMove);
        window.addEventListener('keydown', this.boundOnGameKeyDown); 
        window.addEventListener('contextmenu', this.boundContextMenu);
    }

    // Remove game-specific listeners (e.g., when returning to menu)
    public removeGameEventListeners(): void {
        window.removeEventListener('mousedown', this.boundOnMouseDown);
        window.removeEventListener('mouseup', this.boundOnMouseUp);
        window.removeEventListener('mousemove', this.boundOnMouseMove);
        window.removeEventListener('keydown', this.boundOnGameKeyDown);
        window.removeEventListener('contextmenu', this.boundContextMenu);
    }

    // --- Event Handler Implementations ---

    private onWindowResize(): void {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private onMouseDown(event: MouseEvent): void {
        // Prevent editing if in first person
        if (this.thirdPersonController?.getIsEnabled()) return;
        
        if (event.button === 0) this.isMouseDown = true;
        else if (event.button === 2) this.isRightMouseDown = true;
    }

    private onMouseUp(event: MouseEvent): void {
        // Prevent editing if in first person
        if (this.thirdPersonController?.getIsEnabled()) return;
        
        if (event.button === 0) this.isMouseDown = false;
        else if (event.button === 2) this.isRightMouseDown = false;
    }

    private onMouseMove(event: MouseEvent): void {
        // Prevent editing if in first person
        if (this.thirdPersonController?.getIsEnabled()) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (this.isMouseDown || this.isRightMouseDown) {
            this.editTerrain();
        }
    }

    private editTerrain(): void {
        if (!this.marchingCubes || !this.camera) return;
        // Prevent editing if in first person
        if (this.thirdPersonController?.getIsEnabled()) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Important: Raycast against the actual scene meshes, 
        // assuming marchingCubes meshes are added directly to the scene.
        // If meshes are grouped, intersect the group.
        const terrainMeshes = this.marchingCubes.getTerrainMeshes();
        const intersects = this.raycaster.intersectObjects(terrainMeshes as THREE.Object3D[]);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Use the correct context for marchingCubes
            this.marchingCubes.editTerrain(point, this.isRightMouseDown);
        }
    }

    private onGameKeyDown(event: KeyboardEvent): void {
        // Only handle Escape key here for exiting FP mode
        if (event.code === 'Escape' && this.thirdPersonController?.getIsEnabled()) {
          this.toggleFirstPersonModeCallback(false); // Call the callback passed from main.ts
        }
        // Other game-specific keydowns could be handled here if needed
    }

    // Method to clean up all listeners
    public dispose(): void {
        window.removeEventListener('resize', this.boundOnWindowResize);
        this.removeGameEventListeners();
        console.log("EventManager listeners removed.");
    }
} 