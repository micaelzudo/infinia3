import * as THREE from 'three';
// Import glitch shader module - REMOVED
// import importedGlitchGLSL from './shaders/modules/holographicGlitch.glsl?raw'; 

// --- Modify the imported GLSL String for thicker lines --- REMOVED
/*
let holographicGlitchGLSL = importedGlitchGLSL;
holographicGlitchGLSL = holographicGlitchGLSL.replace(...);
holographicGlitchGLSL = holographicGlitchGLSL.replace(...);
*/

// --- Shader Definitions ---

const matrixGlitchRainVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
`;

const matrixGlitchRainFragmentShader = `
    precision highp float;

    uniform float uTime;
    uniform float uGridDensity; 
    uniform float uFallSpeed;  
    uniform float uGlitchIntensity;
    uniform vec3 uColor; 

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // --- Required Function Definitions ---
    // Simple hash functions needed for Matrix rain
    float hash11(float p) {
        p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p);
    }
    float hash21(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }
    // Hash to generate glyph index / variation
    float hashGlyph(vec2 p, float time) {
        return hash21(p + fract(time * 20.0)); 
    }
    
    // Modified horizontalGlitchLine for thicker/more defined lines
    float horizontalGlitchLine(vec2 uv, float time, float intensity) {
        float lineCount = 15.0; // More lines
        float result = 0.0;
        for (float i = 0.0; i < lineCount; i++) {
            float seed = i / lineCount;
            float linePos = fract(seed + time * (0.1 + seed * 0.2));
            // Make lines thicker and sharper based on intensity
            float lineWidth = (0.005 + 0.015 * intensity) * (0.5 + seed * 0.5);
            float lineSharpness = 100.0; // Increase sharpness
            float line = smoothstep(0.0, lineWidth, abs(uv.y - linePos));
            // Flip smoothstep for sharp falloff
            result = max(result, 1.0 - line * lineSharpness);
        }
        // Clamp result to 0-1
        return clamp(result, 0.0, 1.0);
    }
    // --- End Required Function Definitions ---

    void main() {
        // --- Glitch Line Calculation ---
        // Uses the modified horizontalGlitchLine defined above
        float hGlitch = horizontalGlitchLine(vUv, uTime, uGlitchIntensity);

        // *** STRICT MASK: If not in a glitch line, discard ***
        if (hGlitch < 0.01) {
            discard;
        }

        // --- Matrix Rain Calculation (only if inside a glitch line) ---
        vec2 gridCoord = vWorldPosition.xz * uGridDensity; 
        float worldY = vWorldPosition.y; // Using world Y for fall
        float columnX = floor(gridCoord.x);
        float columnSeed = hash11(columnX * 0.123);
        float timeOffsetY = worldY * 0.2 + uTime * uFallSpeed * (0.5 + columnSeed); 
        
        float fallProgress = fract(timeOffsetY);
        
        float brightness = pow(1.0 - fallProgress, 4.0); 
        float leadingCharBoost = smoothstep(0.0, 0.05, 1.0 - fallProgress) * 2.0;
        brightness = brightness + leadingCharBoost;

        float glyphValue = hashGlyph(vec2(columnX, floor(timeOffsetY)), uTime);
        
        vec3 matrixColor = uColor * (0.5 + glyphValue * 0.5) * brightness; 

        // --- Final Output --- 
        float alpha = clamp(brightness, 0.0, 1.0); 

        if (alpha < 0.01) {
            discard;
        }

        vec3 finalColor = matrixColor;
        
        gl_FragColor = vec4(finalColor, alpha * 0.9); 
    }
`;

// --- Material Creation Function ---

export function createMatrixGlitchRainMaterial(): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 },
            uGridDensity: { value: 2.5 }, // Increased density
            uFallSpeed: { value: 0.8 },  // Increased speed
            uGlitchIntensity: { value: 0.6 }, // Controls line thickness/frequency
            uColor: { value: new THREE.Color(0x30ff50) } 
        },
        vertexShader: matrixGlitchRainVertexShader,
        fragmentShader: matrixGlitchRainFragmentShader,
        transparent: true,
        depthWrite: false, 
        side: THREE.DoubleSide
    });
    return material;
}

// --- Update Function ---

export function updateMatrixGlitchRainMaterial(material: THREE.ShaderMaterial, elapsedTime: number): void {
    if (material.uniforms.uTime) { // Check if uniform exists
        material.uniforms.uTime.value = elapsedTime;
    }
} 