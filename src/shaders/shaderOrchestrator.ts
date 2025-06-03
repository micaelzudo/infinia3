import * as THREE from 'three';

// Import shader files as raw strings
// Assuming these will exist in the same directory (src/shaders/)
import tunnelVertexShader from './tunnel.vert?raw';
import tunnelFragmentShader from './tunnel.frag?raw';

// Import all the shader modules
// Assuming these will exist in a 'modules' subdirectory (src/shaders/modules/)
import hyperspaceLanesShader from './modules/hyperspaceLanes.glsl?raw';
import dimensionalRiftShader from './modules/dimensionalRift.glsl?raw';
import quantumNoiseShader from './modules/quantumNoise.glsl?raw';
import etherealGlowShader from './modules/etherealGlow.glsl?raw';
import timeWarpShader from './modules/timeWarp.glsl?raw';
import holographicGlitchShader from './modules/holographicGlitch.glsl?raw';
import particleFluxShader from './modules/particleFlux.glsl?raw';
import energyFieldShader from './modules/energyField.glsl?raw';
import wormholeDistortionShader from './modules/wormholeDistortion.glsl?raw';
import quantumEntanglementShader from './modules/quantumEntanglement.glsl?raw';

// Define the structure for our effect registry
interface EffectConfig {
    uniformName: string;
    defaultIntensity: number;
    animationSpeed: number;
    phaseOffset: number;
}

// Create a registry of effects with configuration
const effectsRegistry: Record<string, EffectConfig> = {
    hyperspaceEffect: {
        uniformName: 'uHyperspaceIntensity',
        defaultIntensity: 1.2,
        animationSpeed: 0.05,
        phaseOffset: 0.0
    },
    dimensionalRiftEffect: {
        uniformName: 'uDimensionalRiftIntensity',
        defaultIntensity: 0.8,
        animationSpeed: 0.04,
        phaseOffset: 0.5
    },
    quantumEffect: {
        uniformName: 'uQuantumEffectStrength',
        defaultIntensity: 1.5,
        animationSpeed: 0.03,
        phaseOffset: 1.0
    },
    etherealGlowEffect: {
        uniformName: 'uGlowIntensity',
        defaultIntensity: 1.4,
        animationSpeed: 0.1,
        phaseOffset: 1.5
    },
    timeWarpEffect: {
        uniformName: 'uTimeWarpIntensity',
        defaultIntensity: 1.0,
        animationSpeed: 0.07,
        phaseOffset: 2.0
    },
    holographicGlitchEffect: {
        uniformName: 'uHolographicGlitchIntensity',
        defaultIntensity: 0.8,
        animationSpeed: 0.15,
        phaseOffset: 2.5
    },
    particleFluxEffect: {
        uniformName: 'uParticleFluxIntensity',
        defaultIntensity: 1.2,
        animationSpeed: 0.06,
        phaseOffset: 3.0
    },
    energyFieldEffect: {
        uniformName: 'uEnergyFieldIntensity',
        defaultIntensity: 1.0,
        animationSpeed: 0.08,
        phaseOffset: 3.5
    },
    wormholeEffect: {
        uniformName: 'uWormholeIntensity',
        defaultIntensity: 0.8,
        animationSpeed: 0.04,
        phaseOffset: 4.0
    },
    quantumEntanglementEffect: {
        uniformName: 'uQuantumEntanglementIntensity',
        defaultIntensity: 1.0,
        animationSpeed: 0.05,
        phaseOffset: 4.5
    }
};

// --- Module-level variable for QE log timing ---
let lastQELogTime = -Infinity; // Initialize to ensure first log happens

/**
 * Extract function declarations from a GLSL shader module
 * @param shaderSource The source shader code
 * @returns Array of function declarations found
 */
function extractFunctionDeclarations(shaderSource: string): string[] {
    // More robust regex that better handles multi-line functions with multiple parameters
    const functionRegex = /(?:vec[234]|float|void|int|bool)\s+(\w+)\s*\([^{]*\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/gs;
    const functions: string[] = [];
    let match;
    
    while ((match = functionRegex.exec(shaderSource)) !== null) {
        // Extract the entire function declaration including the body
        const functionBody = match[0];
        functions.push(functionBody);
    }
    
    // console.log(`Extracted functions from shader: ${functions.length}`); // Less verbose logging
    return functions;
}

/**
 * Create orchestrated shader material with all effects
 * @returns The complete shader material with all effects
 */
export function createOrchestratedShaderMaterial(): THREE.ShaderMaterial {
    console.log("🚀 Initializing quantum tunnel shader orchestration...");
    
    // Base uniforms that are always present
    const baseUniforms: Record<string, THREE.IUniform> = {
        uTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCameraPos: { value: new THREE.Vector3() },
        uTunnelRadius: { value: 100.0 }, // Default, can be overridden
        uGlowColor: { value: new THREE.Color(0x00ddff) },
        // Include defaults from the original fragment shader if they aren't covered by effects
        uNebulaIntensity: { value: 1.5 }, 
        uStarDensity: { value: 0.5 },
        uGlowIntensity: { value: effectsRegistry.etherealGlowEffect.defaultIntensity }, // Use registry default

        // --- Add uniforms for Spatial Index --- 
        uSpatialIndexTexture: { value: null }, // Placeholder, will be set externally
        uSpatialIndexBoundsMin: { value: new THREE.Vector3() },
        uSpatialIndexCellSize: { value: new THREE.Vector3() },
        uMatrixRainEnabled: { value: 0.0 }, // Add a toggle for the effect (0.0 = off, 1.0 = on)
        uTrailColor: { value: new THREE.Color(0.0, 0.75, 0.2) }, // Matrix green trail
        uLeadColor: { value: new THREE.Color(0.8, 1.0, 0.8) },  // Bright lead color
        // --- End Spatial Index Uniforms ---
    };

    // Add uniforms for each effect from the registry
    for (const key in effectsRegistry) {
        const effect = effectsRegistry[key];
        baseUniforms[effect.uniformName] = { value: effect.defaultIntensity };
    }

    // Combine all shader modules into one string
    const allModules = [
        hyperspaceLanesShader,
        dimensionalRiftShader,
        quantumNoiseShader,
        etherealGlowShader,
        timeWarpShader,
        holographicGlitchShader,
        particleFluxShader,
        energyFieldShader,
        wormholeDistortionShader,
        quantumEntanglementShader
    ].join('\n\n');

    // Extract function declarations from all modules
    const moduleFunctions = extractFunctionDeclarations(allModules);

    // --- Add Matrix Rain GLSL Function --- 
    // (Adapted from src/tunnel.js search result)
    const matrixRainGLSLFunction = `
        // Simple hash function needed by matrixRain3D
        float hash11_m(float p) {
            p = fract(p * 0.1031);
            p *= p + 33.33;
            p *= p + p;
            return fract(p);
        }

        // Function to convert world position to 3D texture UVW coordinates
        vec3 worldToSpatialIndexUVW(vec3 worldPos, vec3 gridMin, vec3 gridCellSize) {
            vec3 gridDimensions = (uSpatialIndexBoundsMax - gridMin) / gridCellSize;
            vec3 localPos = worldPos - gridMin;
            vec3 uvw = localPos / (gridDimensions * gridCellSize);
            return clamp(uvw, 0.0, 1.0); // Clamp to valid texture range
        }

        // Volumetric Matrix Rain using 3D Noise and Spatial Index
        vec4 matrixRain3D(vec3 worldPos, float time, sampler3D indexTexture, vec3 gridMin, vec3 gridCellSize) {
            
            // Sample spatial index texture
            vec3 uvw = worldToSpatialIndexUVW(worldPos, gridMin, gridCellSize);
            float isInside = texture(indexTexture, uvw).r;

            // If not inside, return transparent black
            if (isInside < 0.5) { 
                return vec4(0.0);
            }

            // Use 3D noise to determine density/probability of rain at this point
            // Animate noise over time
            // Note: Requires a 3D noise function (e.g., fbmValue3D from quantumNoiseShader)
            vec3 noiseCoord = worldPos * 0.05 + vec3(0.0, -time * 0.5, 0.0);
            // Assuming fbmValue3D exists from included modules
            // float density = fbmValue3D(noiseCoord); 
            // TEMP: Using simpler noise for now if fbmValue3D causes issues
             float density = sin(noiseCoord.x * 10.0) * sin(noiseCoord.y * 10.0) * sin(noiseCoord.z * 10.0);
             density = (density * 0.5 + 0.5); // Map to 0-1
            
            // Threshold the density - only show rain in denser noise areas
            float densityThreshold = 0.55;
            if (density < densityThreshold) {
                return vec4(0.0); // Not dense enough for rain here
            }
            
            // Calculate normalized density for brightness/alpha
            float normalizedDensity = smoothstep(densityThreshold, densityThreshold + 0.1, density);
            
            // Create vertical falling effect based on world Y coordinate and time
            // Use a hash based on XZ position to vary the fall speed and phase per column
            float columnSeed = hash11_m(floor(worldPos.x * 1.0) + floor(worldPos.z * 1.0));
            float fallSpeed = 1.5 + columnSeed * 2.5;
            float fallPhase = time * fallSpeed + columnSeed * 10.0;
            
            // Use fract to create repeating vertical pattern (the streaks)
            float verticalProg = fract(worldPos.y * 0.5 - fallPhase);
            
            // Make streaks fade out quickly - high power means sharp falloff
            float streakBrightness = pow(1.0 - verticalProg, 8.0);
            
            // Combine density and streak brightness
            float finalBrightness = streakBrightness * normalizedDensity * 1.5; // Boost overall brightness
            
            // Determine leading edge (top of the streak)
            float leadEdgeThreshold = 0.9; // Top 10% of the streak
            float isLeadingEdge = smoothstep(leadEdgeThreshold, leadEdgeThreshold + 0.05, 1.0 - verticalProg);
            
            // Mix colors based on leading edge (using uniforms)
            vec3 color = mix(uTrailColor, uLeadColor, isLeadingEdge) * finalBrightness;
            
            // Add some extra glow based on brightness
            color += vec3(0.0, 0.5, 0.1) * finalBrightness * finalBrightness;
            
            // Calculate alpha
            float alpha = min(finalBrightness * 2.0, 0.9); // Make it fairly opaque
            
            return vec4(color, alpha);
        }
    `;
    // --- End Matrix Rain Function ---

    // Prepend all module functions and matrix rain function before the main tunnel shader body
    const shaderIncludes = moduleFunctions.join('\n\n') + '\n\n' + matrixRainGLSLFunction + '\n\n';
    
    // Find the main function in the base tunnel shader
    const mainFunctionRegex = /void\s+main\s*\(\s*\)\s*\{/;
    const mainMatch = tunnelFragmentShader.match(mainFunctionRegex);

    if (!mainMatch || mainMatch.index === undefined) {
        console.error("Could not find main() function in tunnelFragmentShader!");
        throw new Error("Failed to orchestrate shaders: main() not found.");
    }

    // Inject module functions before main()
    let finalFragmentShader = 
        tunnelFragmentShader.slice(0, mainMatch.index) + 
        shaderIncludes + 
        tunnelFragmentShader.slice(mainMatch.index);

    // --- Modify the main() function --- 
    // This is brittle; ideally, the base shader would have hooks
    const finalMainContent = `
    // --- Calculations using vWorldPos and injected functions ---
    float angle = atan(vWorldPos.y, vWorldPos.x); 
    float angularCoord = (angle + PI) / TWO_PI; 
    float tunnelSpeed = 0.03; 
    float timeBasedDistance = uTime * tunnelSpeed;

    // --- Nebula Calculation (Complex Version) ---
    vec2 nebulaCoords = vec2(vWorldPos.x * 0.05, vWorldPos.y * 0.05 + mod(timeBasedDistance, 100.0));
    vec2 p1 = nebulaCoords * 1.5; 
    float noise1 = fbm_ref2d(p1, 5); // Use injected reference 2D fbm
    vec2 p2_offset_coord = nebulaCoords * 3.0 + mod(uTime * 0.005, 100.0); 
    float offset_fbm = fbm_ref2d(p2_offset_coord, 6); // Use injected reference 2D fbm
    vec2 p2_offset = vec2(offset_fbm * 0.2);
    vec2 p2 = nebulaCoords * 2.5 + vec2(-mod(uTime * 0.01, 50.0), 0.0) + p2_offset;
    float noise2 = fbm_ref2d(p2, 6); // Use injected reference 2D fbm
    float nebulaValue = smoothstep(0.4, 0.7, noise1) + smoothstep(0.5, 0.8, noise2) * 0.6;
    vec3 nebulaColor = vec3(0.0);
    nebulaColor = mix(nebulaColor, vec3(0.1, 0.0, 0.3), smoothstep(0.3, 0.8, noise1));
    nebulaColor = mix(nebulaColor, vec3(0.0, 0.2, 0.5), smoothstep(0.5, 0.9, noise2));
    nebulaColor += vec3(0.9, 0.2, 0.4) * pow(noise2, 3.0) * 0.5;

    // Apply quantum effects to enhance the nebula (Using injected functions)
    vec3 quantumPos = vWorldPos * 0.01 + vec3(uTime * 0.01, uTime * 0.02, uTime * 0.015);
    float qNoiseValue = quantumNoise(quantumPos); 
    vec3 qFBMValue = quantumFBM(quantumPos);    
    nebulaColor = mix(nebulaColor, nebulaColor * qFBMValue, 0.3 * uQuantumEffectStrength);
    nebulaValue = mix(nebulaValue, nebulaValue + qNoiseValue * 0.2, 0.4 * uQuantumEffectStrength);
    // Apply Nebula Intensity uniform
    nebulaColor *= uNebulaIntensity; 

    // --- Abstract Planets/Structures (3D - Using injected functions) ---
    vec3 blobColor = vec3(0.0);
    float blobScale = 0.04; 
    vec3 blobAnimSpeed = vec3(0.01, 0.005, -0.03);
    vec3 blobPos = vWorldPos * blobScale + vec3(
        mod(blobAnimSpeed.x * uTime, 50.0),
        mod(blobAnimSpeed.y * uTime, 50.0),
        mod(blobAnimSpeed.z * uTime, 50.0)
    );
    float blobPresenceNoise = fbm_ref3d(blobPos, 4); // Use injected 3D fbm
    float sizeNoise = fbm_ref3d(blobPos * 0.7 + vec3(10.0, 20.0, 30.0), 3); // Use injected 3D fbm
    float baseSizeThreshold = 0.6;
    float dynamicSizeThreshold = baseSizeThreshold + sizeNoise * 0.2 - 0.1;
    
    if (blobPresenceNoise > dynamicSizeThreshold) {
        float blobIntensity = smoothstep(dynamicSizeThreshold, dynamicSizeThreshold + 0.1, blobPresenceNoise);
        vec3 detailNoisePos = blobPos * 3.0 + vec3(5.0, -10.0, 15.0);
        float detailNoise = fbm_ref3d(detailNoisePos, 5); // Use injected 3D fbm
        
        vec3 baseBlobColor = vec3(0.8, 0.3, 0.1); // Example orange
        vec3 detailColor = vec3(0.2, 0.7, 0.9); // Example cyan
        
        blobColor = mix(baseBlobColor, detailColor, smoothstep(0.4, 0.6, detailNoise));
        blobColor *= blobIntensity;
        
        // Add some self-illumination based on noise
        float illuminationNoise = fbm_ref3d(blobPos * 2.0 + vec3(-20.0, 5.0, -10.0), 4); // Use injected 3D fbm
        blobColor += blobColor * smoothstep(0.5, 0.7, illuminationNoise) * 0.5;
    }

    // --- Star Field (Using function from base tunnel.frag, assuming it's kept) ---
    // Need to ensure the 'stars' function definition is preserved or included
    // If 'stars' was only in the original main(), it needs to be moved outside or re-added to includes
    float starField = stars(vUv, uStarDensity * 0.1); // Uses vUv
    vec3 starColor = vec3(1.0) * starField;

    // --- Glows and Lights (Using injected functions) ---
    // Pulsing Glow
    float pulseGlowValue = pulsingGlow(vWorldPos * 0.1, uTime, uEtherealPulseSpeed, 0.5); 
    vec3 pulseGlowColor = uGlowColor * pulseGlowValue * uGlowIntensity; 

    // Volumetric Rays
    vec3 rayOrigin = vec3(0.0, 0.0, vWorldPos.z - 5.0); 
    vec3 rayDirection = normalize(vec3(0.0, 0.0, 1.0)); 
    float rayValue = volumetricLightRays(vWorldPos, rayOrigin, rayDirection, 20.0, uRayIntensity); 
    vec3 rayColor = vec3(1.0, 0.8, 0.5) * rayValue;

    // --- Combine Tunnel Effects ---
    vec3 tunnelEffectsColor = nebulaColor + blobColor + starColor + pulseGlowColor + rayColor;
    // Apply other effects if implemented (e.g., hyperspace, time warp...)
    // orchestratedColor = applyHyperspaceEffects(orchestratedColor, ...); 
    
    // --- Apply Matrix Rain Effect (Keep existing logic) --- 
    vec4 matrixColor = vec4(0.0);
    vec3 spatialBoundsMin = uSpatialIndexBoundsMin; 
    vec3 spatialCellSize = uSpatialIndexCellSize; 
    
    // Need to calculate boundsMax from min, resolution, and cell size
    vec3 spatialResolution = vec3(textureSize(uSpatialIndexTexture, 0)); // Get resolution from texture
    vec3 spatialBoundsMax = spatialBoundsMin + spatialResolution * spatialCellSize;
    
    // Add uSpatialIndexBoundsMax uniform (needed by worldToSpatialIndexUVW)
    // Hack: Define it here if not passed as uniform
    vec3 uSpatialIndexBoundsMax = spatialBoundsMax; 

    if (uMatrixRainEnabled > 0.5 && spatialCellSize.x > 0.0) { // Check if enabled and index is valid
         matrixColor = matrixRain3D(vWorldPos, uTime, uSpatialIndexTexture, spatialBoundsMin, spatialCellSize);
    }
   
    // --- Final Blending --- 
    // Blend matrix rain over the combined tunnel effects
    vec3 finalColor = mix(tunnelEffectsColor, matrixColor.rgb, matrixColor.a); // Alpha blend matrix rain
    float finalAlpha = max(matrixColor.a, 0.8); // Blend alpha

    // Clamp final color
    finalColor = min(finalColor, 1.5); // Allow slightly higher values for HDR/bloom later

    gl_FragColor = vec4(finalColor, finalAlpha);
`;

    // Replace the original main function body with the new orchestrated one
    finalFragmentShader = finalFragmentShader.replace(
        /void\s+main\s*\(\s*\)\s*\{[\s\S]*?\}/, // Regex to match the entire main function body
        `void main() {${finalMainContent}}`
    );

    // Create the final material
    const material = new THREE.ShaderMaterial({
        uniforms: baseUniforms,
        vertexShader: tunnelVertexShader, // Use the base tunnel vertex shader
        fragmentShader: finalFragmentShader,
        transparent: true,
        depthWrite: false, // Usually false for complex blended effects
        depthTest: true,
        side: THREE.DoubleSide // Render both sides for effects visible from outside/inside
    });

    console.log("✅ Shader orchestration complete.");
    return material;
}


/**
 * Update orchestrated shader material uniforms over time
 * @param material The shader material to update
 * @param elapsedTime The total elapsed time
 * @param cameraPos The current camera position
 */
export function updateOrchestration(material: THREE.ShaderMaterial, elapsedTime: number, cameraPos: THREE.Vector3): void {
    if (!material || !material.uniforms) return;

    material.uniforms.uTime.value = elapsedTime;
    material.uniforms.uCameraPos.value.copy(cameraPos);
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);

    // Animate effect intensities using sine waves based on registry config
    for (const key in effectsRegistry) {
        const effect = effectsRegistry[key];
        if (material.uniforms[effect.uniformName]) {
            // Cycle intensity between 0 and defaultIntensity*1.5 (example range)
            const intensity = (Math.sin(elapsedTime * effect.animationSpeed + effect.phaseOffset) * 0.5 + 0.5) * effect.defaultIntensity * 1.5;
            material.uniforms[effect.uniformName].value = intensity;

            // Example: Log Quantum Entanglement intensity periodically
            if (effect.uniformName === 'uQuantumEntanglementIntensity' && elapsedTime > lastQELogTime + 5.0) {
                // console.log(`Quantum Entanglement Intensity: ${intensity.toFixed(3)} at time ${elapsedTime.toFixed(1)}s`);
                lastQELogTime = elapsedTime; // Update last log time
            }
        }
    }
    
    // --- Update Spatial Index Uniforms --- 
    // Check if the userData contains the required spatial index info
    // This assumes the texture/data was attached to the Mesh's userData
    // We need access to the Mesh itself here, which is not ideal.
    // TODO: Refactor how spatial index data is passed to the update function or material.
    
    // TEMPORARY: Assume material.userData holds the required info (needs setup elsewhere)
    if (material.userData?.spatialIndexTexture) {
        material.uniforms.uSpatialIndexTexture.value = material.userData.spatialIndexTexture;
        material.uniforms.uMatrixRainEnabled.value = 1.0; // Enable effect if texture exists
    } else {
         material.uniforms.uMatrixRainEnabled.value = 0.0; // Disable if no texture
    }
     if (material.userData?.spatialIndexBoundsMin) {
        material.uniforms.uSpatialIndexBoundsMin.value.copy(material.userData.spatialIndexBoundsMin);
    }
     if (material.userData?.spatialIndexCellSize) {
        material.uniforms.uSpatialIndexCellSize.value.copy(material.userData.spatialIndexCellSize);
    }
    // --- End Spatial Index Update ---
}


/**
 * Checks for GLSL compilation errors on a given material.
 * @param renderer The WebGLRenderer instance.
 * @param material The ShaderMaterial to check.
 * @returns A string containing the error log, or an empty string if no errors.
 */
function checkMaterialShaderError(renderer: THREE.WebGLRenderer, material: THREE.ShaderMaterial): string {
    const gl = renderer.getContext();
    // const program = material.program?.program; // Original potentially problematic line
    // Attempt to get the program associated with the material via renderer state (might be internal API)
    const programInfo = renderer.properties.get(material)?.program;
    if (!programInfo) return "Material program not available via renderer properties.";
    const program = programInfo.program; // Extract the WebGLProgram

    if (!program) return "Material program not available yet.";

    const vs = material.vertexShader;
    const fs = material.fragmentShader;

    // Helper to compile a shader and check errors
    const compileShader = (shaderType: number, shaderSource: string): WebGLShader | string => {
        const shader = gl.createShader(shaderType);
        if (!shader) return "Failed to create shader object.";
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const errorLog = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            return `Shader Compile Error:\n${errorLog}\n\nSource:\n${shaderSource.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n')}`;
        }
        return shader;
    };

    // Compile vertex shader
    const glVertexShader = compileShader(gl.VERTEX_SHADER, vs);
    if (typeof glVertexShader === 'string') {
        return `Vertex Shader Error:\n${glVertexShader}`;
    }

    // Compile fragment shader
    const glFragmentShader = compileShader(gl.FRAGMENT_SHADER, fs);
    if (typeof glFragmentShader === 'string') {
        gl.deleteShader(glVertexShader); // Clean up vertex shader
        return `Fragment Shader Error:\n${glFragmentShader}`;
    }

    // Link program
    const glProgram = gl.createProgram();
    if (!glProgram) {
        gl.deleteShader(glVertexShader);
        gl.deleteShader(glFragmentShader);
        return "Failed to create program object.";
    }
    gl.attachShader(glProgram, glVertexShader);
    gl.attachShader(glProgram, glFragmentShader);
    gl.linkProgram(glProgram);

    // Check linking errors
    if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        const errorLog = gl.getProgramInfoLog(glProgram);
        gl.deleteProgram(glProgram); // Clean up program
        gl.deleteShader(glVertexShader);
        gl.deleteShader(glFragmentShader);
        return `Program Link Error:\n${errorLog}`;
    }

    // Clean up shaders and program if successful compilation/linking
    gl.deleteProgram(glProgram);
    gl.deleteShader(glVertexShader);
    gl.deleteShader(glFragmentShader);

    return ""; // No errors found
}

/**
 * Utility function to check for shader compilation errors after material creation.
 * Call this during development after creating complex shader materials.
 * @param renderer The WebGLRenderer instance.
 * @returns An error message string if errors are found, otherwise an empty string.
 */
export function checkShaderErrors(renderer: THREE.WebGLRenderer): string {
    // This function requires access to the scene or materials, which it doesn't have here.
    // It should be called from a context where the material is available.
    // Example Usage (in your main loop or setup):
    // const error = checkMaterialShaderError(renderer, myOrchestratedMaterial);
    // if (error) { console.error(error); }
    console.warn("checkShaderErrors function needs to be called with a specific material.");
    return "";
} 