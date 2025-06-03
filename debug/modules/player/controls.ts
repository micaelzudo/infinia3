import * as THREE from 'three';
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { mobileController } from "../../mobileController_debug";
import type { UpdateController } from '../../types_debug';
import { eventThrottled } from '../../logThrottler';

// Input State
export const keys = [false, false, false, false]; // [forward, backward, left, right]
export let jump = false;
export let shift = false;
export let mobileMove = new THREE.Vector2();
let cameraRotateY = 0;

// Mobile controller update functions
let _updateControllerLook: UpdateController | null = null;
let _updateControllerMove: UpdateController | null = null;

// DOM Elements (passed during init)
let modal: HTMLElement | null = null;
let topBar: HTMLElement | null = null;
let mobileTopBar: HTMLElement | null = null;
let debugButton: HTMLElement | null = null;

const onControllerLook = (value: THREE.Vector2) => {
  if (value.x < 0) {
    cameraRotateY = 0.015;
  } else if (value.x > 0) {
    cameraRotateY = -0.015;
  } else {
    cameraRotateY = 0;
  }
};

export function getCameraRotateY(): number {
    return cameraRotateY;
}

const onControllerMove = (value: THREE.Vector2) => {
  mobileMove = value.clone().normalize();
};

// Desktop Listeners
const onDesktopClick = (event: MouseEvent) => {
    // Check if the click originated within the isolated editor overlay
    const isolatedEditor = document.getElementById('isolated-editor-overlay');
    if (isolatedEditor && event.target instanceof Node && isolatedEditor.contains(event.target)) {
        console.log("Click inside Isolated Editor Overlay, skipping pointer lock request.");
        // Stop propagation might not be strictly necessary if we just return,
        // but can prevent potential conflicts if other global listeners exist.
        event.stopPropagation(); 
        return; // Don't request pointer lock
    }

    // Don't request pointer lock if clicking on a known UI button in the main view
    // (Keep the original check for the debug button if it still exists/is relevant)
    if (debugButton && event.target === debugButton) { 
        event.stopPropagation();
        console.log("Click on Debug Button, skipping pointer lock request.");
        return; 
    }
    // Add checks for other main UI elements here if needed

    // Otherwise, request pointer lock as usual (click was likely on the main canvas)
    console.log("Click on non-UI element or main canvas, requesting pointer lock.");
    document.body.requestPointerLock();
};

const onPointerLockChange = () => {
  if (modal && topBar) {
    if (document.pointerLockElement === document.body) {
      modal.style.display = "none";
      topBar.style.display = "flex";
    } else {
      modal.style.display = "grid";
      topBar.style.display = "none";
    }
  }
};

// Keyboard Listeners
const onKeyDown = (e: KeyboardEvent) => {
  switch (e.code) {
    case "ArrowUp":
    case "KeyW":
      keys[0] = true;
      break;
    case "ArrowDown":
    case "KeyS":
      keys[1] = true;
      break;
    case "ArrowLeft":
    case "KeyA":
      keys[2] = true;
      break;
    case "ArrowRight":
    case "KeyD":
      keys[3] = true;
      break;
    case "Space":
      if (!jump) { // Log only on first press down
        (console as any).event("⌨️ Space Pressed (Jump intent)");
      }
      jump = true;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      shift = true;
      break;
  }
};

const onKeyUp = (e: KeyboardEvent) => {
  switch (e.code) {
    case "ArrowUp":
    case "KeyW":
      keys[0] = false;
      break;
    case "ArrowDown":
    case "KeyS":
      keys[1] = false;
      break;
    case "ArrowLeft":
    case "KeyA":
      keys[2] = false;
      break;
    case "ArrowRight":
    case "KeyD":
      keys[3] = false;
      break;
    case "Space":
      jump = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      shift = false;
      break;
  }
};

// Resize Listener
const onWindowResize = (camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, isMobile: boolean) => {
  let width = window.innerWidth;
  let height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (isMobile) {
    // Re-initialize mobile controllers on resize
    const controllerLookElement = document.getElementById("controller-look") as HTMLCanvasElement;
    const controllerMoveElement = document.getElementById("controller-move") as HTMLCanvasElement;
    if (controllerLookElement && controllerMoveElement) {
        _updateControllerLook = mobileController(controllerLookElement, onControllerLook);
        _updateControllerMove = mobileController(controllerMoveElement, onControllerMove);
    }
  }
};

// Initialization
export function initControls(cam: THREE.PerspectiveCamera, rend: THREE.WebGLRenderer, isMob: boolean) {
  modal = document.getElementById("modal");
  topBar = document.getElementById("top-bar");
  mobileTopBar = document.getElementById("mobile-top-bar");
  debugButton = document.getElementById("debug-terrain-button");

  if (!isMob) {
    // Desktop setup
    if (mobileTopBar) mobileTopBar.style.display = "none";
    if (modal) modal.style.display = "grid";
    if (topBar) topBar.style.display = "none";

    new PointerLockControls(cam, document.body);
    window.addEventListener("click", onDesktopClick);
    document.addEventListener("pointerlockchange", onPointerLockChange);

  } else {
    // Mobile setup
    if (mobileTopBar) mobileTopBar.style.display = "block";
    if (modal) modal.style.display = "none";
    if (topBar) topBar.style.display = "none";

    const controllerLookElement = document.getElementById("controller-look") as HTMLCanvasElement;
    const controllerMoveElement = document.getElementById("controller-move") as HTMLCanvasElement;
    if (controllerLookElement && controllerMoveElement) {
        _updateControllerLook = mobileController(controllerLookElement, onControllerLook);
        _updateControllerMove = mobileController(controllerMoveElement, onControllerMove);
    }
  }

  // Common listeners
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  // Use bind or arrow function to pass parameters to resize handler
  window.addEventListener("resize", () => onWindowResize(cam, rend, isMob));
}

// Function to update mobile controls state if needed (called in animation loop)
export function updateMobileControls() {
  if (_updateControllerLook) _updateControllerLook();
  if (_updateControllerMove) _updateControllerMove();
} 