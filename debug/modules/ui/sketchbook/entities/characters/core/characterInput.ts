/**
 * Character Input Handler
 * 
 * This file provides input handling for character movement and actions.
 */

// External libraries
import * as THREE from 'three';

// Types
import type { EnhancedCharacter } from './characterTypes';

// Core components
import { InputManager } from '../../../input/inputManager';

export class CharacterInputHandler {
    private character: EnhancedCharacter;
    private inputManager: InputManager;
    private mouse: {
        x: number;
        y: number;
        isLocked: boolean;
    };
    private touch: {
        active: boolean;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    };
    private movementSpeed: number;
    private jumpForce: number;
    private mouseSensitivity: number;
    private rotationSpeed: number;
    private maxRotationSpeed: number;
    private rotationDamping: number;

    constructor(character: EnhancedCharacter, inputManager: InputManager) {
        this.character = character;
        this.inputManager = inputManager;
        this.mouse = {
            x: 0,
            y: 0,
            isLocked: false
        };
        this.touch = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };
        this.movementSpeed = 5;
        this.jumpForce = 10;
        this.mouseSensitivity = 0.002;
        this.rotationSpeed = 0;
        this.maxRotationSpeed = 0.1;
        this.rotationDamping = 0.95;

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        // Mouse events
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // Touch events
        document.addEventListener('touchstart', this.handleTouchStart.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Pointer lock events
        document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    }

    private handleMouseMove(event: MouseEvent): void {
        if (!this.mouse.isLocked) return;
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
    }

    private handleMouseDown(event: MouseEvent): void {
        if (!this.mouse.isLocked) {
            document.body.requestPointerLock();
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        // Handle mouse up events if needed
    }

    private handleTouchStart(event: TouchEvent): void {
        this.touch.active = true;
        this.touch.startX = event.touches[0].clientX;
        this.touch.startY = event.touches[0].clientY;
        this.touch.currentX = this.touch.startX;
        this.touch.currentY = this.touch.startY;
    }

    private handleTouchMove(event: TouchEvent): void {
        if (!this.touch.active) return;
        this.touch.currentX = event.touches[0].clientX;
        this.touch.currentY = event.touches[0].clientY;
    }

    private handleTouchEnd(event: TouchEvent): void {
        this.touch.active = false;
    }

    private handlePointerLockChange(): void {
        this.mouse.isLocked = document.pointerLockElement === document.body;
    }

    public dispose(): void {
        // Remove event listeners
        document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        document.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('touchstart', this.handleTouchStart.bind(this));
        document.removeEventListener('touchmove', this.handleTouchMove.bind(this));
        document.removeEventListener('touchend', this.handleTouchEnd.bind(this));
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    }

    // Public methods to access input state
    public getInputState() {
        return this.inputManager.getInputState();
    }

    public isMoving(): boolean {
        const input = this.inputManager.getInputState();
        return input.moveForward || input.moveBackward || 
               input.moveLeft || input.moveRight;
    }
} 