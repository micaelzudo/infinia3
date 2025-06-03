import * as THREE from 'three';
import type { EnhancedCharacter } from '../../entities/characters/core/characterTypes';
import { VectorConverter } from '../sketchbookCore';

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
    private character: EnhancedCharacter | null = null;
    private inputState: CharacterInputState;
    private keys: Record<string, boolean> = {};
    private mouseSensitivity: number = 0.002;
    private isPointerLocked: boolean = false;
    private readonly MAX_PITCH: number = Math.PI / 2.2;
    private readonly MOVEMENT_KEYS = {
        forward: ['w', 'arrowup'],
        backward: ['s', 'arrowdown'],
        left: ['a', 'arrowleft'],
        right: ['d', 'arrowright'],
        jump: [' '],
        run: ['shift'],
        crouch: ['control', 'ctrl']
    };

    constructor() {
        this.inputState = this.createDefaultInputState();
        this.setupEventListeners();
    }

    public setCharacter(character: EnhancedCharacter): void {
        this.character = character;
        if (character.viewVector) {
            this.inputState.viewVector.copy(character.viewVector);
            const targetDirection = new THREE.Vector3(
                character.viewVector.x,
                0,
                character.viewVector.z
            ).normalize();
            if (character.setOrientation) {
                character.setOrientation(targetDirection);
            }
        }
    }

    public update(_deltaTime: number): void {
        if (!this.character) return;
        this.updateInputState();
        this.handleMouseLook();
    }

    private handleMouseLook(): void {
        if (!this.character || !this.isPointerLocked) return;

        const { mouseMovementX, mouseMovementY } = this.inputState;
        if (mouseMovementX === 0 && mouseMovementY === 0) return;

        const viewVector = this.character.viewVector || VectorConverter.FORWARD.clone();
        
        // Apply yaw rotation
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(
            VectorConverter.UP,
            -mouseMovementX * this.mouseSensitivity
        );
        viewVector.applyQuaternion(yawQuat);
        
        // Calculate and apply pitch rotation
        const right = new THREE.Vector3(1, 0, 0);
        if (this.character.orientation) {
            right.applyQuaternion(new THREE.Quaternion().setFromEuler(this.character.rotation));
        }
        const currentPitch = Math.asin(Math.max(-1, Math.min(1, viewVector.y)));
        const newPitch = currentPitch - (mouseMovementY * this.mouseSensitivity);
        
        if (Math.abs(newPitch) < this.MAX_PITCH) {
            const pitchQuat = new THREE.Quaternion().setFromAxisAngle(
                right,
                -mouseMovementY * this.mouseSensitivity
            );
            viewVector.applyQuaternion(pitchQuat);
        }
        
        this.character.viewVector = viewVector;
        this.inputState.mouseMovementX = 0;
        this.inputState.mouseMovementY = 0;
    }

    private updateInputState(): void {
        if (!this.character) return;

        this.inputState.moveForward = this.MOVEMENT_KEYS.forward.some(key => this.keys[key]);
        this.inputState.moveBackward = this.MOVEMENT_KEYS.backward.some(key => this.keys[key]);
        this.inputState.moveLeft = this.MOVEMENT_KEYS.left.some(key => this.keys[key]);
        this.inputState.moveRight = this.MOVEMENT_KEYS.right.some(key => this.keys[key]);
        this.inputState.jump = this.MOVEMENT_KEYS.jump.some(key => this.keys[key]);
        this.inputState.run = this.MOVEMENT_KEYS.run.some(key => this.keys[key]);
        this.inputState.crouch = this.MOVEMENT_KEYS.crouch.some(key => this.keys[key]);
    }

    private setupEventListeners(): void {
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('click', this.handleClick);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.character || !this.isPointerLocked) return;
        this.inputState.mouseMovementX = event.movementX || 0;
        this.inputState.mouseMovementY = event.movementY || 0;
        this.inputState.mouseX = event.clientX;
        this.inputState.mouseY = event.clientY;
    }

    private handleClick = (): void => {
        if (!this.isPointerLocked) {
            document.body.requestPointerLock();
        }
    }

    private handlePointerLockChange = (): void => {
        this.isPointerLocked = document.pointerLockElement === document.body;
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase();
        if (Object.values(this.MOVEMENT_KEYS).flat().includes(key)) {
            event.preventDefault();
        }
        this.keys[key] = true;
        this.updateInputState();
    }

    private handleKeyUp = (event: KeyboardEvent): void => {
        const key = event.key.toLowerCase();
        this.keys[key] = false;
        this.updateInputState();
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
            viewVector: VectorConverter.FORWARD.clone()
        };
    }

    public dispose(): void {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }

    public getInputState(): CharacterInputState {
        return this.inputState;
    }
}

// Export a singleton instance
export const characterInput = new CharacterInputHandler();
