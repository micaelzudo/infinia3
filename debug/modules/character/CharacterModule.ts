import * as THREE from 'three';
import { Character } from '../../Sketchbook-master/src/ts/characters/Character';
import { SketchbookWorldAdapter } from '../ui/sketchbookInterfaces';
import { directPlayAnimation, getAnimationForState } from '../ui/animationUtils';
import { updatePlayerMovementAndCollision, type PlayerPhysicsState, type PlayerInputState } from '../ui/playerMovement';
import { GroundImpactData } from '../../Sketchbook-master/src/ts/characters/GroundImpactData';

/**
 * CharacterModule - Manages character state, animation, and physics
 * Integrates with Sketchbook's character system while providing our own extensions
 */
export class CharacterModule {
    private character: Character;
    private worldAdapter: SketchbookWorldAdapter;
    private scene: THREE.Scene;
    private debugId: string;
    private currentState: string = 'Idle';
    private lastGrounded: boolean = false;
    private lastVelocity: number = 0;
    private walkGraceTimer: number = -1;

    constructor(
        worldAdapter: SketchbookWorldAdapter,
        scene: THREE.Scene,
        gltf: any
    ) {
        this.worldAdapter = worldAdapter;
        this.scene = scene;
        this.debugId = `char_${Math.random().toString(36).substr(2, 9)}`;

        // Create character instance
        this.character = new Character(gltf);
        (this.character as any).debugId = this.debugId;
        this.character.world = this.worldAdapter as any;

        // Add character to scene and world
        if ((this.character.modelContainer as any)) {
            (this.scene as any).add(this.character.modelContainer as any);
        }
        this.worldAdapter.add(this.character);

        // Initialize character state
        this.initializeCharacterState();
    }

    /**
     * Initialize character state and animations
     */
    private initializeCharacterState(): void {
        // Set initial animation
        directPlayAnimation(this.character, 'idle', 0.2);
        this.currentState = 'Idle';
    }

    /**
     * Update character state and physics
     */
    public update(delta: number): void {
        try {
            // Update character physics and movement
            const physicsState: PlayerPhysicsState = {
                yVelocity: this.character.velocity.y,
                grounded: this.character.rayHasHit,
                position: this.character.modelContainer?.position as any
            };

            const inputManager: any = this.worldAdapter.inputManager;
            const inputState: PlayerInputState = {
                w: inputManager.actions.up.isPressed,
                a: inputManager.actions.left.isPressed,
                s: inputManager.actions.down.isPressed,
                d: inputManager.actions.right.isPressed,
                space: inputManager.actions.jump.isPressed,
                shift: inputManager.actions.run.isPressed
            };

            // Update movement and collision
            updatePlayerMovementAndCollision(
                this.worldAdapter.camera as THREE.PerspectiveCamera,
                inputState,
                physicsState,
                delta,
                null,
                null,
                null
            );

            // Update animation state
            this.updateAnimationState();

            // Update character
            this.character.update(delta);

        } catch (error) {
            console.error('[CharacterModule] Failed to update character:', error);
        }
    }

    /**
     * Update character animation state
     */
    private updateAnimationState(): void {
        try {
            const inputManager: any = this.worldAdapter.inputManager;
            const isGrounded = this.character.rayHasHit;
            const velocity = this.character.velocity.length();
            const anyDirection = this.anyDirection();

            // Determine new state
            let newState = this.currentState;

            if (!isGrounded) {
                newState = 'Falling';
            } else if (anyDirection) {
                if (inputManager.actions.run.isPressed) {
                    newState = 'Sprint';
                } else {
                    newState = 'Walk';
                }
            } else {
                newState = 'Idle';
            }

            // Handle state transition
            if (newState !== this.currentState) {
                const animName = getAnimationForState(newState);
                directPlayAnimation(this.character, animName, 0.2);
                this.currentState = newState;
            }

            // Update state tracking
            this.lastGrounded = isGrounded;
            this.lastVelocity = velocity;

        } catch (error) {
            console.error('[CharacterModule] Failed to update animation state:', error);
        }
    }

    /**
     * Check if character is moving in any direction
     */
    private anyDirection(): boolean {
        const inputManager: any = this.worldAdapter.inputManager;
        return (
            inputManager.actions.up.isPressed ||
            inputManager.actions.down.isPressed ||
            inputManager.actions.left.isPressed ||
            inputManager.actions.right.isPressed
        );
    }

    /**
     * Get character position
     */
    public getPosition(): THREE.Vector3 {
        return (this.character.modelContainer?.position.clone() as any) || new THREE.Vector3();
    }

    /**
     * Set character position
     */
    public setPosition(position: THREE.Vector3): void {
        if ((this.character.modelContainer as any)) {
            (this.character.modelContainer.position as any).copy(position as any);
        }
    }

    /**
     * Get character rotation
     */
    public getRotation(): THREE.Euler {
        return (this.character.modelContainer?.rotation.clone() as any) || new THREE.Euler();
    }

    /**
     * Set character rotation
     */
    public setRotation(rotation: THREE.Euler): void {
        if ((this.character.modelContainer as any)) {
            (this.character.modelContainer.rotation as any).copy(rotation as any);
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        try {
            // Remove character from scene and world
            if ((this.character.modelContainer as any)) {
                (this.scene as any).remove(this.character.modelContainer as any);
            }
            this.worldAdapter.removeCharacter(this.character);
        } catch (error) {
            console.error('[CharacterModule] Failed to dispose character:', error);
        }
    }
} 