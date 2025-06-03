/**
 * Input Manager
 * 
 * This file provides input state management for the UI.
 */

import * as THREE from 'three';

export interface InputState {
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    jump: boolean;
    sprint: boolean;
    crouch: boolean;
    interact: boolean;
    exitVehicle: boolean;
    mouseX: number;
    mouseY: number;
    mouseMovementX: number;
    mouseMovementY: number;
}

export class InputManager {
    private inputState: InputState;
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
        sprint: ['shift'],
        crouch: ['control', 'ctrl'],
        interact: ['e'],
        exitVehicle: ['f']
    };

    constructor() {
        this.inputState = this.createDefaultInputState();
        this.setupEventListeners();
    }

    private createDefaultInputState(): InputState {
        return {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            sprint: false,
            crouch: false,
            interact: false,
            exitVehicle: false,
            mouseX: 0,
            mouseY: 0,
            mouseMovementX: 0,
            mouseMovementY: 0
        };
    }

    private setupEventListeners(): void {
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('click', this.handleClick);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
    }

    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.isPointerLocked) return;
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

    private updateInputState(): void {
        this.inputState.moveForward = this.MOVEMENT_KEYS.forward.some(key => this.keys[key]);
        this.inputState.moveBackward = this.MOVEMENT_KEYS.backward.some(key => this.keys[key]);
        this.inputState.moveLeft = this.MOVEMENT_KEYS.left.some(key => this.keys[key]);
        this.inputState.moveRight = this.MOVEMENT_KEYS.right.some(key => this.keys[key]);
        this.inputState.jump = this.MOVEMENT_KEYS.jump.some(key => this.keys[key]);
        this.inputState.sprint = this.MOVEMENT_KEYS.sprint.some(key => this.keys[key]);
        this.inputState.crouch = this.MOVEMENT_KEYS.crouch.some(key => this.keys[key]);
        this.inputState.interact = this.MOVEMENT_KEYS.interact.some(key => this.keys[key]);
        this.inputState.exitVehicle = this.MOVEMENT_KEYS.exitVehicle.some(key => this.keys[key]);
    }

    public getInputState(): InputState {
        return { ...this.inputState };
    }

    public updateInputState(newState: Partial<InputState>): void {
        this.inputState = { ...this.inputState, ...newState };
    }

    public dispose(): void {
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
    }
} 