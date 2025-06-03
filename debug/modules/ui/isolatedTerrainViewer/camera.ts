import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { getScene, getCamera, getRenderer } from './core';

// Camera state
let isFirstPersonMode = false;
let isThirdPersonMode = false;
let fpCameraRef: THREE.PerspectiveCamera | null = null;
let fpControlsRef: PointerLockControls | null = null;
let tpCameraRef: THREE.PerspectiveCamera | null = null;

// Camera settings
const FIRST_PERSON_HEIGHT = 1.7; // Player height in meters
const THIRD_PERSON_DISTANCE = 5; // Distance from player in third person
const THIRD_PERSON_HEIGHT = 2; // Height offset in third person

export function enterFirstPersonMode() {
    if (isFirstPersonMode) return;

    const scene = getScene();
    const renderer = getRenderer();
    if (!scene || !renderer) return;

    // Create first person camera
    fpCameraRef = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    fpCameraRef.position.set(0, FIRST_PERSON_HEIGHT, 0);

    // Create pointer lock controls
    fpControlsRef = new PointerLockControls(fpCameraRef, renderer.domElement);

    // Add event listeners for pointer lock
    renderer.domElement.addEventListener('click', () => {
        fpControlsRef?.lock();
    });

    // Add controls to scene
    scene.add(fpControlsRef.getObject());

    isFirstPersonMode = true;
    isThirdPersonMode = false;
}

export function exitFirstPersonMode() {
    if (!isFirstPersonMode) return;

    const scene = getScene();
    if (!scene || !fpControlsRef) return;

    // Remove controls from scene
    scene.remove(fpControlsRef.getObject());

    // Clean up
    fpControlsRef.dispose();
    fpControlsRef = null;
    fpCameraRef = null;

    isFirstPersonMode = false;
}

export function enterThirdPersonMode() {
    if (isThirdPersonMode) return;

    const scene = getScene();
    if (!scene) return;

    // Create third person camera
    tpCameraRef = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    tpCameraRef.position.set(0, THIRD_PERSON_HEIGHT, THIRD_PERSON_DISTANCE);
    tpCameraRef.lookAt(0, THIRD_PERSON_HEIGHT, 0);

    // Add camera to scene
    scene.add(tpCameraRef);

    isThirdPersonMode = true;
    isFirstPersonMode = false;
}

export function exitThirdPersonMode() {
    if (!isThirdPersonMode) return;

    const scene = getScene();
    if (!scene || !tpCameraRef) return;

    // Remove camera from scene
    scene.remove(tpCameraRef);

    // Clean up
    tpCameraRef = null;

    isThirdPersonMode = false;
}

export function updateCamera() {
    if (isFirstPersonMode && fpControlsRef) {
        // First person camera is updated by PointerLockControls
        return;
    }

    if (isThirdPersonMode && tpCameraRef) {
        // Update third person camera position relative to player
        // This would typically follow the player's position
        // For now, we'll just keep it in a fixed position
        return;
    }
}

export function getActiveCamera(): THREE.Camera | null {
    if (isFirstPersonMode && fpCameraRef) {
        return fpCameraRef;
    }
    if (isThirdPersonMode && tpCameraRef) {
        return tpCameraRef;
    }
    return getCamera();
}

export function cleanupCamera() {
    exitFirstPersonMode();
    exitThirdPersonMode();
}

// Getters
export function isInFirstPersonMode() { return isFirstPersonMode; }
export function isInThirdPersonMode() { return isThirdPersonMode; }
export function getFirstPersonCamera() { return fpCameraRef; }
export function getThirdPersonCamera() { return tpCameraRef; } 