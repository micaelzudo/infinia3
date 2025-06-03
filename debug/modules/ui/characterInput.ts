import * as THREE from 'three';
import { Character } from './placeholderTypes';

export interface CharacterInputState {
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    jump: boolean;
    run: boolean;
    crouch: boolean;
    mouseX: number;
    mouseY: number;
    mouseMovementX: number;
    mouseMovementY: number;
    viewVector: THREE.Vector3;
}

export class CharacterInputHandler {
    private character: Character | null = null;
    private inputState: CharacterInputState;
    private keys: Record<string, boolean> = {};
    private mouseSensitivity: number = 0.002;
    private isPointerLocked: boolean = false;
    private previousMousePosition: { x: number, y: number } = { x: 0, y: 0 };
    // Removed unused rotation variables
    private readonly MAX_PITCH: number = Math.PI / 2.2; // Slightly less than 90 degrees

    constructor() {
        this.inputState = this.createDefaultInputState();
        this.setupEventListeners();
    }

    public setCharacter(character: Character): void {
        this.character = character;
        if (character.viewVector) {
            this.inputState.viewVector.copy(character.viewVector);
            // Initialize orientation based on view vector
            const targetDirection = new THREE.Vector3(
                character.viewVector.x,
                0,
                character.viewVector.z
            ).normalize();
            
            // Set initial orientation
            this.character.setOrientation(targetDirection, true);
        }
    }

    public update(_deltaTime: number): void {
        if (!this.character) return;

        // Update input state based on current key presses
        this.updateInputState();
        
        // Handle mouse look
        this.handleMouseLook();
    }

    private handleMouseLook(): void {
        if (!this.character || !this.isPointerLocked) return;

        // Calculate mouse movement
        const movementX = this.inputState.mouseMovementX;
        const movementY = this.inputState.mouseMovementY;

        // Update rotation based on mouse movement
        if (movementX !== 0 || movementY !== 0) {
            // Update view vector based on mouse movement (pitch and yaw)
            const viewVector = this.character.viewVector || new THREE.Vector3(0, 0, -1);
            
            // Create rotation quaternions
            const yawAxis = new THREE.Vector3(0, 1, 0);
            const yawQuat = new THREE.Quaternion();
            yawQuat.setFromAxisAngle(yawAxis, -movementX * this.mouseSensitivity);
            
            // Apply yaw to view vector
            viewVector.applyQuaternion(yawQuat);
            
            // Calculate pitch (up/down)
            const right = new THREE.Vector3(1, 0, 0);
            // Ensure we have a valid quaternion
            const quat = new THREE.Quaternion();
            quat.set(this.character.quaternion.x, this.character.quaternion.y, 
                    this.character.quaternion.z, this.character.quaternion.w);
            right.applyQuaternion(quat);
            
            // Calculate current pitch angle
            const currentPitch = Math.asin(Math.max(-1, Math.min(1, viewVector.y)));
            const newPitch = currentPitch - (movementY * this.mouseSensitivity);
            
            // Apply pitch limits
            if (Math.abs(newPitch) < this.MAX_PITCH) {
                const pitchQuat = new THREE.Quaternion();
                pitchQuat.setFromAxisAngle(right, -movementY * this.mouseSensitivity);
                viewVector.applyQuaternion(pitchQuat);
            }
            
            // Update character's view vector
            this.character.viewVector = viewVector;
            
            // Update orientation (yaw only for movement direction)
            const targetDirection = new THREE.Vector3(
                viewVector.x,
                0,
                viewVector.z
            ).normalize();
            
            this.character.setOrientation(targetDirection);
        }
    }

    private handlePointerLockChange = (): void => {
        this.isPointerLocked = document.pointerLockElement === document.body;
    };

    private handlePointerLockError = (): void => {
        console.error('Pointer lock error');
    };

    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.character || !this.isPointerLocked) return;
        
        // Store mouse movement for next update
        this.inputState.mouseMovementX = event.movementX || 0;
        this.inputState.mouseMovementY = event.movementY || 0;
        
        // Store current mouse position
        this.previousMousePosition.x = event.clientX;
        this.previousMousePosition.y = event.clientY;
    };

    private handleKeyDown = (event: KeyboardEvent): void => {
        // Prevent default for common keys to avoid browser shortcuts
        const key = event.key.toLowerCase();
        if (['w', 'a', 's', 'd', ' ', 'shift', 'control', 'ctrl'].includes(key)) {
            event.preventDefault();
        }
        
        this.keys[key] = true;
        this.updateInputState();
    };

    private handleKeyUp = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase();
        this.keys[key] = false;
        this.updateInputState();
    };

    private updateInputState(): void {
        if (!this.character) return;
        
        // Update movement state
        this.inputState.moveForward = !!this.keys['w'] || !!this.keys['arrowup'];
        this.inputState.moveBackward = !!this.keys['s'] || !!this.keys['arrowdown'];
        this.inputState.moveLeft = !!this.keys['a'] || !!this.keys['arrowleft'];
        this.inputState.moveRight = !!this.keys['d'] || !!this.keys['arrowright'];
        this.inputState.jump = !!this.keys[' ']; // Spacebar
        this.inputState.run = !!this.keys['shift'];
        this.inputState.crouch = !!this.keys['control'] || !!this.keys['ctrl'];
        
        // Update character's running state if needed
        if (this.character.setArcadeVelocityTarget) {
            const speed = this.inputState.run ? 10 : 5;
            this.character.setArcadeVelocityTarget(speed);
        }
    }

    private setupEventListeners(): void {
        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown, false);
        window.addEventListener('keyup', this.handleKeyUp, false);
        
        // Mouse events
        window.addEventListener('mousemove', this.handleMouseMove, false);
        
        // Pointer lock events
        document.addEventListener('pointerlockchange', this.handlePointerLockChange, false);
        document.addEventListener('pointerlockerror', this.handlePointerLockError, false);
        
        // Lock pointer on click for first-person controls
        document.addEventListener('click', () => {
            if (document.pointerLockElement !== document.body) {
                document.body.requestPointerLock();
            }
        }, false);
    }

    public dispose(): void {
        // Remove keyboard events
        window.removeEventListener('keydown', this.handleKeyDown, false);
        window.removeEventListener('keyup', this.handleKeyUp, false);
        
        // Remove mouse events
        window.removeEventListener('mousemove', this.handleMouseMove, false);
        
        // Remove pointer lock events
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange, false);
        document.removeEventListener('pointerlockerror', this.handlePointerLockError, false);
        
        // Release pointer lock if active
        if (document.pointerLockElement === document.body) {
            document.exitPointerLock();
        }
    }

    private createDefaultInputState(): CharacterInputState {
        return {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            run: false,
            crouch: false,
            mouseX: 0,
            mouseY: 0,
            mouseMovementX: 0,
            mouseMovementY: 0,
            viewVector: new THREE.Vector3(0, 0, -1)
        };
    }
}

// Export a singleton instance
export const characterInput = new CharacterInputHandler();
