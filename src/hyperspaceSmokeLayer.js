import * as THREE from "three";
// Import the new fragment shader content as raw string
import hyperspaceSmokeFragmentShaderGLSL from './shaders/hyperspaceSmokeLayer.frag?raw';

/**
 * Creates a wavy, rainbow hyperspace smoke layer
 * @param {number} radius The base radius of the tunnel (layer will be slightly larger)
 * @param {number} length The length of the tunnel segment
 * @returns {THREE.Mesh} The hyperspace smoke layer mesh
 */
export function createHyperspaceSmokeLayer(radius, length) {
  // Create a slightly larger cylinder for this overlay layer
  const layerRadius = radius * 1.02; // Make it slightly LARGER than base radius
  const layerGeometry = new THREE.CylinderGeometry(
    layerRadius, layerRadius, length, 64, 64, true // Same segmentation as base smoke
  );

  // Rotate and position similar to main tunnel/smoke
  layerGeometry.rotateX(Math.PI / 2);
  layerGeometry.translate(0, 0, -length / 2 + 100); // Match positioning logic

  // --- Define Shaders for this Layer ---

  const layerVertexShader = `
    precision highp float;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        // Get world position for calculations in fragment shader
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Use the imported fragment shader content
  const layerFragmentShader = hyperspaceSmokeFragmentShaderGLSL;

  // --- Define Material for this Layer ---
  const layerMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uCameraPos: { value: new THREE.Vector3() },
      // Define distinct, bright neon colors
      uColor1: { value: new THREE.Color(0xff00ff) }, // Magenta
      uColor2: { value: new THREE.Color(0x00ffff) }, // Cyan
      uColor3: { value: new THREE.Color(0xffff00) }, // Yellow
      uColor4: { value: new THREE.Color(0x00ff00) }, // Lime
      uNoiseScale: { value: 0.015 }, // Lower scale for broader waves
      uSpeed: { value: 0.25 },      // Increased speed significantly
      uBrightness: { value: 0.25 },   // Increased brightness slightly from 0.15 to 0.25
      uDensity: { value: 0.01 },    // Decreased density further from 0.02 to 0.01
      uSmokeRadius: { value: layerRadius }, // Use this layer's radius
      uNumSteps: { value: 96 },      // Fewer steps might be okay for this layer
      uStepSize: { value: 1.5 },      // Larger step size
      uHueSpeed: { value: 0.6 }       // Increased rainbow shift speed significantly
    },
    vertexShader: layerVertexShader,
    fragmentShader: layerFragmentShader,
    side: THREE.BackSide, // Render back faces for volume
    transparent: true,
    blending: THREE.AdditiveBlending, // Use Additive Blending for overlay effect
    depthWrite: false // Don't write to depth buffer
  });

  // Create the mesh
  const layerMesh = new THREE.Mesh(layerGeometry, layerMaterial);
  layerMesh.name = 'hyperspaceSmokeLayer'; // Unique name
  layerMesh.renderOrder = 2; // Ensure it renders AFTER the base smoke (renderOrder=1)

  return layerMesh;
} 