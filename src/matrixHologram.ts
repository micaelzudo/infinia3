import * as THREE from 'three';
// Import glitch shader module (assuming build setup handles ?raw)
import holographicGlitchGLSL from './shaders/modules/holographicGlitch.glsl?raw'; 
// Placeholder for noise utilities if needed, assuming noiseGLSL is available globally or passed
// For simplicity now, we might redefine simple hash inline

// Uniforms type definition (optional but good practice)
interface MatrixHologramUniforms {
    uTime: { value: number };
    uGridDensity: { value: number };
    uFallSpeed: { value: number };
    uGlitchIntensity: { value: number };
    uColor: { value: THREE.Color };
}

// --- Shaders ---

const matrixVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vPosition; // Local position

    void main() {
        vUv = uv;
        vPosition = position;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const matrixFragmentShader = `
    precision highp float;

    uniform float uTime;
    uniform float uGridDensity; // How many columns/rows per world unit
    uniform float uFallSpeed;
    uniform float uGlitchIntensity;
    uniform vec3 uColor; // Base color for matrix rain

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vPosition; // Local position

    // Inject Glitch Module Code
    ${holographicGlitchGLSL}

    // Simple hash function (alternative to importing full noise module)
    float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
    }
     float hash21(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }


    void main() {
        // Use world position XZ plane mapped to a grid for columns/rows
        // Adjust scale factor based on desired density
        vec2 gridCoord = vWorldPosition.xz * uGridDensity; 
        
        // Use local Y position (vPosition.y) for the vertical fall, 
        // relative to the box's height maybe? Or world Y? Let's try world Y.
        float worldY = vWorldPosition.y;

        // --- Matrix Rain Logic ---
        float columnX = floor(gridCoord.x);
        
        // Time offset for falling effect, different speed per column
        float columnSeed = hash11(columnX * 0.123);
        float timeOffsetY = worldY * 0.2 + uTime * uFallSpeed * (0.5 + columnSeed); 
        
        // Calculate current 'character' value (0-1) based on time and position
        // Add columnSeed to hash input for variation per column
        float charValue = hash21(vec2(columnX, floor(timeOffsetY)) + columnSeed * 10.0); 
        
        // Calculate fall progress (0 = top of stream, 1 = bottom/faded)
        float fallProgress = fract(timeOffsetY);
        
        // Brightness based on fall progress (brightest at the leading edge)
        // Sharper falloff using pow
        float brightness = pow(1.0 - fallProgress, 4.0); 
        
        // Make the leading character much brighter
        float leadingCharBoost = smoothstep(0.0, 0.05, 1.0 - fallProgress) * 2.0;
        brightness = brightness + leadingCharBoost;

        // Base Matrix Color (using uniform)
        vec3 matrixColor = uColor * brightness * charValue; 
        
        // --- Combine with Glitch ---
        // Use vUv for glitch effect texture coordinates
        vec3 finalColor = applyHolographicGlitch(matrixColor, vUv, uTime, uGlitchIntensity);

        // --- Transparency ---
        // Fade out based on brightness, discard if too faint
        float alpha = clamp(brightness * charValue, 0.0, 1.0);
        if (alpha < 0.01) {
            discard;
        }

        gl_FragColor = vec4(finalColor, alpha * 0.8); // Apply some base transparency
    }
`;

// --- Creation Function ---

export function createMatrixHologram(size: number = 10): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(size, size, size);
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uGridDensity: { value: 1.5 }, // Controls density of rain columns
            uFallSpeed: { value: 0.5 },  // Controls speed of rain fall
            uGlitchIntensity: { value: 0.4 }, // Controls glitch effect intensity
            uColor: { value: new THREE.Color(0x00ff40) } // Matrix green
        },
        vertexShader: matrixVertexShader,
        fragmentShader: matrixFragmentShader,
        transparent: true,
        depthWrite: false, // Often needed for transparency
        side: THREE.DoubleSide // Render inside and outside for volumetric feel
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "matrixHologram";
    
    return mesh;
}

// --- Update Function ---

export function updateMatrixHologram(mesh: THREE.Mesh, elapsedTime: number): void {
    if (mesh.material instanceof THREE.ShaderMaterial) {
        mesh.material.uniforms.uTime.value = elapsedTime;
    }
} 