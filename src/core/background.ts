import * as THREE from 'three';

// Import shader files as raw strings
import backgroundVertexShader from '../shaders/background.vert?raw';
import backgroundFragmentShader from '../shaders/background.frag?raw';

/**
 * Creates a skybox mesh with a procedural abstract background shader.
 * @returns The skybox mesh.
 */
export function createAbstractBackground(): THREE.Mesh {
    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000); // Large box

    const skyboxMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }
        },
        vertexShader: backgroundVertexShader,
        fragmentShader: backgroundFragmentShader,
        side: THREE.BackSide // Render on the inside
    });

    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    skybox.name = "proceduralBackground"; // Optional name

    return skybox;
}

/**
 * Updates the time uniform for the abstract background shader.
 * @param backgroundMesh The background mesh created by createAbstractBackground.
 * @param elapsedTime The elapsed time from a THREE.Clock.
 */
export function updateAbstractBackground(backgroundMesh: THREE.Mesh, elapsedTime: number) {
    if (backgroundMesh && backgroundMesh.material instanceof THREE.ShaderMaterial) {
        backgroundMesh.material.uniforms.uTime.value = elapsedTime;
    }
} 