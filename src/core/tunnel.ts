import * as THREE from 'three';

// Import original shader files
import tunnelVertexShader from '../shaders/tunnel.vert?raw';
import tunnelFragmentShader from '../shaders/tunnel.frag?raw';

// Import NEW smoke shader files
import nebulaSmokeVertexShader from '../shaders/nebulaSmoke.vert?raw';
import nebulaSmokeFragmentShader from '../shaders/nebulaSmoke.frag?raw';

// Import the shader orchestrator
import { createOrchestratedShaderMaterial, updateOrchestration } from '../shaders/shaderOrchestrator';

/**
 * Processes shader includes by replacing include directives with actual shader code
 * @param shaderSource The source shader code with include directives
 * @returns Processed shader code with includes resolved
 */
// function processShaderIncludes(shaderSource: string): string {
//     // No processing needed - the shader already has all code inlined
//     return shaderSource;
// }

/**
 * Creates the tunnel geometry and the overlaying smoke effect.
 * @returns A THREE.Group containing the tunnel mesh and the smoke mesh.
 */
export function createTunnel(): THREE.Group {
    console.log("🌀 Creating quantum tunnel infrastructure and smoke layer...");
    
    // --- Original Tunnel --- 
    const radius = 100;
    const length = 100000; 
    const radialSegments = 32;
    const heightSegments = 8; 
    const openEnded = false; 
    const tunnelGeometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, heightSegments, openEnded);
    tunnelGeometry.rotateX(Math.PI / 2);
    tunnelGeometry.translate(0, 0, -length / 2 + 100);

    console.log(`📐 Tunnel geometry created: length=${length}, radius=${radius}`);
    console.log("🎨 Creating tunnel shader with quantum effects...");
    const tunnelMaterial = createOrchestratedShaderMaterial(); 
    const tunnelMesh = new THREE.Mesh(tunnelGeometry, tunnelMaterial);
    tunnelMesh.name = "proceduralTunnel";
    console.log("🚇 Quantum tunnel mesh created");

    // --- Neon Smoke Layer --- 
    const smokeRadius = radius - 5.0; // Slightly smaller radius to be INSIDE
    const smokeLength = length; // Same length
    const smokeRadialSegments = radialSegments;
    const smokeHeightSegments = heightSegments;
    // Use a BoxGeometry slightly larger than the smoke radius, rotated, as a bounding volume proxy for ray marching
    // This avoids complex cylinder intersection math in the shader for now
    const smokeBoundingBoxSize = smokeRadius * 2.1; // A bit larger than diameter
    // Use fewer segments for the bounding box as it's just for triggering the frag shader
    const smokeGeometry = new THREE.CylinderGeometry(smokeRadius, smokeRadius, smokeLength, smokeRadialSegments, 4, true); 
    smokeGeometry.rotateX(Math.PI / 2);
    smokeGeometry.translate(0, 0, -smokeLength / 2 + 100); // Match position

    console.log(`💨 Creating smoke layer geometry: radius=${smokeRadius}`);

    const smokeUniforms = {
        uTime: { value: 0.0 },
        uCameraPos: { value: new THREE.Vector3() }, // NEW: Camera position
        uColor1: { value: new THREE.Color(0x00CFFF) }, // Electric Blue
        uColor2: { value: new THREE.Color(0x00FFFF) }, // Bright Cyan
        uColor3: { value: new THREE.Color(0xDA70D6) }, // Light Violet (Orchid)
        uColor4: { value: new THREE.Color(0xE0FFFF) }, // Cool White/Light Cyan
        uNoiseScale: { value: 0.018 }, // Slightly increased scale (smaller clouds, more detail potential)
        uSpeed: { value: 0.06 }, // Slightly faster base speed
        uBrightness: { value: 1.4 }, // Increased brightness slightly
        uDensity: { value: 0.45 }, // Significantly reduced base density
        uSmokeRadius: { value: smokeRadius }, // NEW: Pass smoke radius
        uNumSteps: { value: 32 }, // NEW: Ray marching steps
        uStepSize: { value: 4.0 }, // NEW: Ray marching step size (world units)
        uBackgroundInfluenceStrength: { value: 0.6 } // NEW: Control background interaction
    };

    const smokeMaterial = new THREE.ShaderMaterial({
        uniforms: smokeUniforms,
        vertexShader: nebulaSmokeVertexShader,
        fragmentShader: nebulaSmokeFragmentShader,
        side: THREE.BackSide, // Render inside faces for volume perception from within
        transparent: true,
        blending: THREE.NormalBlending, 
        depthWrite: false 
    });

    const smokeMesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
    smokeMesh.name = "nebulaSmokeLayer";
    smokeMesh.renderOrder = 1; 
    console.log("✨ Nebula smoke layer mesh created");

    // --- Grouping --- 
    const tunnelGroup = new THREE.Group();
    tunnelGroup.add(tunnelMesh);
    tunnelGroup.add(smokeMesh);
    tunnelGroup.name = "tunnelSystem";

    console.log("✅ Tunnel system group created.");
    return tunnelGroup;
}

/**
 * Updates the time uniforms for the tunnel system (tunnel + smoke).
 * @param tunnelGroup The group containing the tunnel and smoke meshes.
 * @param elapsedTime The elapsed time.
 * @param camera Optional camera for orchestrator updates.
 */
export function updateTunnel(tunnelGroup: THREE.Group, elapsedTime: number, camera?: THREE.Camera) {
    if (!tunnelGroup || !camera) return; // Need camera for smoke update now

    const tunnelMesh = tunnelGroup.getObjectByName("proceduralTunnel") as THREE.Mesh;
    const smokeMesh = tunnelGroup.getObjectByName("nebulaSmokeLayer") as THREE.Mesh;

    // Update original tunnel via orchestrator
    if (tunnelMesh && tunnelMesh.material instanceof THREE.ShaderMaterial) {
        if (Math.floor(elapsedTime) % 10 === 0 && Math.floor(elapsedTime) !== tunnelMesh.userData.lastLoggedTime) {
            tunnelMesh.userData.lastLoggedTime = Math.floor(elapsedTime);
            // console.log(`⏱️ Tunnel shader updated at t=${elapsedTime.toFixed(2)}`); // Less logging
        }
        // const cameraPosition = camera ? camera.position : new THREE.Vector3(0, 0, 0); // Redundant check
        updateOrchestration(tunnelMesh.material, elapsedTime, camera.position);
    }

    // Update smoke layer time AND camera position
    if (smokeMesh && smokeMesh.material instanceof THREE.ShaderMaterial) {
        smokeMesh.material.uniforms.uTime.value = elapsedTime;
        smokeMesh.material.uniforms.uCameraPos.value.copy(camera.position); // Update camera pos
    }
} 