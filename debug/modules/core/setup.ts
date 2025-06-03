import * as THREE from 'three';

export function createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("app") as HTMLCanvasElement,
        antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Note: Animation loop is set in the main script
    document.body.appendChild(renderer.domElement);
    console.log("Renderer Created");
    return renderer;
}

export function createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    console.log("Scene Created");
    return scene;
}

export function createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        1,
        20000
    );
    camera.position.y = 50; // Initial position from original debug file
    console.log("Camera Created");
    return camera;
} 