/**
 * Input Types
 * 
 * This file defines the types and interfaces used for input management.
 */

import * as THREE from 'three';

/**
 * Input state interface
 */
export interface InputState {
    // Movement
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    jump: boolean;
    sprint: boolean;
    crouch: boolean;
    interact: boolean;
    exitVehicle: boolean;
    stand: boolean;

    // Mouse
    mouseX: number;
    mouseY: number;
    mouseMovementX: number;
    mouseMovementY: number;
    mouseButtons: {
        left: boolean;
        right: boolean;
        middle: boolean;
    };

    // Gamepad
    gamepad?: {
        connected: boolean;
        buttons: boolean[];
        axes: number[];
    };
}

/**
 * Input manager interface
 */
export interface InputManager {
    keyboard: { [key: string]: boolean };
    mouse: {
        position: THREE.Vector2;
        buttons: { [button: number]: boolean };
        movement: THREE.Vector2;
    };
    gamepad?: {
        connected: boolean;
        buttons: boolean[];
        axes: number[];
    };
    getInputState(): InputState;
    update(): void;
    reset(): void;
} 