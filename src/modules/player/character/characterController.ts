/**
 * Character Controller
 * 
 * This class provides a high-level interface for controlling a character
 * in a MarchingCubes terrain using the Sketchbook character controller.
 */

import * as THREE from 'three';
import { SketchbookWorldAdapter } from './sketchbookAdapter';
import { Character as SketchbookCharacter } from '../../../debug/modules/ui/sketchbookImports';
import { fixCharacterAnimations, fixAnimationUpdate } from './fixAnimations';

/**
 * Options for initializing the character controller
 */
export interface CharacterControllerOptions {
    /** The THREE.js scene to add the character to */
    scene: THREE.Scene;
    
    /** The THREE.js renderer */
    renderer: THREE.WebGLRenderer;
    
    /** The camera to use for third-person view */
    camera: THREE.PerspectiveCamera;
    
    /** Initial position for the character */
    initialPosition?: THREE.Vector3;
    
    /** Callback when terrain mesh is detected for physics */
    onAddTerrain?: (terrainMesh: THREE.Mesh) => void;
}

/**
 * Main controller for character movement and interaction
 */
export class CharacterController {
    /** The Sketchbook adapter that handles the character */
    private adapter: SketchbookWorldAdapter;
    
    /** Reference to the character instance */
    private character: SketchbookCharacter | null = null;
    
    /** Whether the controller is currently active */
    private active: boolean = false;
    
    /** Callback for adding terrain meshes */
    private onAddTerrain?: (terrainMesh: THREE.Mesh) => void;
    
    /** Camera reference */
    private camera: THREE.PerspectiveCamera;
    
    /** GLTF model reference for the character */
    private gltfModel: any = null;
    
    /**
     * Create a new character controller
     * 
     * @param options Configuration options
     */
    constructor(options: CharacterControllerOptions) {
        // Create adapter
        this.adapter = new SketchbookWorldAdapter(
            options.scene,
            options.renderer,
            options.camera
        );
        
        // Store camera reference
        this.camera = options.camera;
        
        // Store terrain callback
        this.onAddTerrain = options.onAddTerrain;
        
        // Initialize character
        this.initializeCharacter(options.initialPosition);
    }
    
    /**
     * Initialize the character
     * 
     * @param initialPosition Optional initial position
     */
    private async initializeCharacter(initialPosition?: THREE.Vector3): Promise<void> {
        try {
            console.log("[CharacterController] Initializing character...");
            
            // Initialize character and get GLTF reference
            const result = await this.adapter.initializeCharacter(initialPosition);
            this.character = result.character;
            this.gltfModel = result.gltf;
            
            // Apply animation fixes
            if (this.character && this.gltfModel) {
                console.log("[CharacterController] Applying animation fixes...");
                fixCharacterAnimations(this.character, this.gltfModel);
                fixAnimationUpdate(this.character);
            }
            
            this.active = true;
            console.log("[CharacterController] Character initialized successfully");
        } catch (error) {
            console.error("[CharacterController] Failed to initialize character:", error);
            this.active = false;
        }
    }
    
    /**
     * Update the character controller
     * 
     * @param deltaTime Time since last frame in seconds
     */
    public update(deltaTime: number): void {
        if (!this.active) return;
        
        // Update the adapter and all its components
        this.adapter.update(deltaTime);
    }
    
    /**
     * Add a terrain mesh to the physics world for character interaction
     * 
     * @param mesh The terrain mesh to add
     */
    public addTerrainMesh(mesh: THREE.Mesh): void {
        if (!this.active) return;
        
        // Add terrain to physics
        try {
            const body = this.adapter.addTerrainToPhysics(mesh);
            
            // Call callback if provided
            if (this.onAddTerrain) {
                this.onAddTerrain(mesh);
            }
            
            console.log("[CharacterController] Added terrain mesh to physics");
        } catch (error) {
            console.error("[CharacterController] Failed to add terrain mesh to physics:", error);
        }
    }
    
    /**
     * Set the position of the character
     * 
     * @param position The new position
     */
    public setPosition(position: THREE.Vector3): void {
        if (!this.active || !this.character) return;
        
        this.character.setPosition(position.x, position.y, position.z);
    }
    
    /**
     * Get the current position of the character
     * 
     * @returns The current position or null if not active
     */
    public getPosition(): THREE.Vector3 | null {
        if (!this.active || !this.character) return null;
        
        return this.character.position.clone();
    }
    
    /**
     * Get the third-person camera used by the controller
     * 
     * @returns The camera instance
     */
    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }
    
    /**
     * Check if the controller is active
     * 
     * @returns True if the controller is active
     */
    public isActive(): boolean {
        return this.active;
    }
    
    /**
     * Force play an animation on the character
     * 
     * @param animationName The name of the animation to play
     * @param fadeIn Time to fade in the animation in seconds
     * @returns The duration of the animation in seconds
     */
    public playAnimation(animationName: string, fadeIn: number = 0.2): number {
        if (!this.active || !this.character) return 0;
        
        return this.character.setAnimation(animationName, fadeIn);
    }
    
    /**
     * Clean up and dispose resources
     */
    public dispose(): void {
        // Clean up resources
        this.active = false;
        
        // Remove character from scene
        if (this.character) {
            this.adapter.remove(this.character);
            this.character = null;
        }
        
        console.log("[CharacterController] Disposed resources");
    }
} 