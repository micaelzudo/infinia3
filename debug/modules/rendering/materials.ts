import * as THREE from 'three';
import { MAX_SHADER_ELEMENTS } from './constants';
import { TopElementsData } from '../types/renderingTypes';

export const UNIFIED_VERTEX_SHADER = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewDirection;
    varying float vDensity;

    // --- Noise Functions (hash, noise, fbm) ---
    // (Copied from fragment shader - MUST BE KEPT IN SYNC)
    float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix( mix( mix( hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                         mix( hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                    mix( mix( hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                         mix( hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z );
    }
    float fbm(vec3 p, int octaves) {
        // Need planetOffset uniform available here IF fbm uses it directly
        // For now, assume it's handled in the call within main()
        // Let's make fbm NOT use planetOffset directly to avoid uniform issues here
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < octaves; ++i) {
            value += amplitude * noise(p * frequency); // Use p directly
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    // --- End Noise Functions ---

    void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vViewDirection = normalize(cameraPosition - worldPos.xyz); // Camera position is built-in
        // Density calculation needs noise parameters - MUST MATCH SHADER UNIFORMS somehow
        // Option 1: Define separate uniforms for density noise
        // Option 2: Use existing uniforms if appropriate (e.g., noiseScale, planetOffset)
        // Let's assume we use existing noiseScale and planetOffset for now.
        // Need to declare these uniforms in the vertex shader if used here.
        // uniform float noiseScale; // <<< If needed
        // uniform vec3 planetOffset; // <<< If needed
        // Simplified call without offset for now:
        vDensity = fbm(position * 0.1, 4); // Use placeholder scale, REMOVED offset
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const UNIFIED_FRAGMENT_SHADER = `
    precision highp float;

    #define MAX_ELEMENTS ${MAX_SHADER_ELEMENTS} // Ensure this matches InternalMaterialGrid.ts

    // Varyings
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewDirection;
    varying float vDensity; // Assuming this represents if the fragment is 'solid'

    // Uniforms: Scene
    uniform float time;
    uniform vec3 lightDirection;
    uniform vec3 planetOffset;
    uniform float noiseScale;
    uniform bool u_showInternalMaterial; // <<< ADDED UNIFORM

    // Uniforms: Top N Element Data
    uniform vec3 elementColors[MAX_ELEMENTS];
    uniform float elementWeights[MAX_ELEMENTS];
    uniform float elementMetallic[MAX_ELEMENTS];
    uniform float elementRoughness[MAX_ELEMENTS];
    uniform float elementPatternIntensity[MAX_ELEMENTS];

    // --- Noise Functions (hash, noise, fbm) ---
    // (hash, noise, fbm functions - Ensure these are identical to Vertex Shader version)
    float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }
    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix( mix( mix( hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                         mix( hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                    mix( mix( hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                         mix( hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z );
    }
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < octaves; ++i) {
            value += amplitude * noise(p * frequency + planetOffset);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    // --- End Noise Functions ---

    // --- Function to compute normal from noise field ---
    // Samples noise function to estimate surface normal
    vec3 computeNormalFromNoise(vec3 pos, float epsilon) {
        // We need a noise function that approximates the density field used for mesh generation.
        // Let's assume fbm is a reasonable approximation for this.
        // Note: This might need tuning based on the actual noise used for generation.
        float scale = noiseScale; // Use the element selection scale for consistency?
        int octaves = 4;

        vec3 gradX = vec3(fbm(pos + vec3(epsilon, 0.0, 0.0), octaves) -
                        fbm(pos - vec3(epsilon, 0.0, 0.0), octaves));
        vec3 gradY = vec3(fbm(pos + vec3(0.0, epsilon, 0.0), octaves) -
                        fbm(pos - vec3(0.0, epsilon, 0.0), octaves));
        vec3 gradZ = vec3(fbm(pos + vec3(0.0, 0.0, epsilon), octaves) -
                        fbm(pos - vec3(0.0, 0.0, epsilon), octaves));

        // The gradient of the density field gives the normal
        // Note: The exact noise function and scaling might need adjustment
        // to match the geometry generation more closely.
        return normalize(vec3(gradX.x, gradY.y, gradZ.z));
        // A simpler cross-product approach based on height difference:
        // vec3 tangentX = vec3(1.0, gradX.y, 0.0);
        // vec3 tangentZ = vec3(0.0, gradZ.y, 1.0);
        // return normalize(cross(tangentZ, tangentX));
    }
    // --- End Compute Normal ---

    // --- Lighting Functions (Fresnel, Specular) ---
    // (Assume fresnelSchlick, specularStrength functions are defined here)
    float fresnelSchlick(float cosTheta, float F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }
    float specularStrength(vec3 normal, vec3 lightDir, vec3 viewDir, float roughness) {
         vec3 halfDir = normalize(lightDir + viewDir);
         float specAngle = max(dot(normal, halfDir), 0.0);
         float shininess = (1.0 - roughness * roughness) * 256.0;
         return pow(specAngle, shininess);
    }
    // --- End Lighting Functions ---

    // --- Element Selection Function (Used for both Surface and Internal) ---
    int selectElementIndex(vec3 pos) {
        // Simpler noise for selection: Single FBM call, scaled
        float noiseVal = fbm(pos * noiseScale /* + planetOffset */, 4); // Offset handled inside fbm now
        noiseVal = noiseVal * 0.5 + 0.5; // Map FBM result (-0.5 to 0.5 approx) to 0-1 range
        noiseVal = clamp(noiseVal, 0.0, 1.0); // Ensure it stays within bounds

        float cumulativeWeight = 0.0;
        for (int i = 0; i < MAX_ELEMENTS; i++) {
             // Ensure we don't read past actual number of weights if not padded perfectly?
             // Assume weights are padded with 0.0 for unused elements.
             if (elementWeights[i] == 0.0) continue;
            cumulativeWeight += elementWeights[i];
            if (noiseVal <= cumulativeWeight + 0.001) { // Small tolerance for float errors
                 return i;
             }
        }
         // Fallback: find last non-zero weight index
         for (int i = MAX_ELEMENTS - 1; i >= 0; --i) {
             if (elementWeights[i] > 0.0) return i;
         }
        return 0; // Ultimate fallback
    }
    // --- End Element Selection ---

    // --- Volumetric Material Selection Function (Shader Version) ---
    // NOTE: Replaced with selectElementIndex as the logic should be the same
    // int getMaterialIndexAtPointShader(vec3 pos) { ... }
    // --- End Volumetric Material Selection ---

    // --- Triplanar Noise Function ---
    float triplanarFBM(vec3 p, vec3 normal, int octaves, float scale, vec3 offset) {
        // Blend weights based on normal direction (absolute value, normalized)
        vec3 blendWeights = abs(normal);
        blendWeights = max(blendWeights, 0.00001); // Avoid division by zero if normal is zero
        blendWeights = blendWeights / (blendWeights.x + blendWeights.y + blendWeights.z);

        // Sample noise on 3 planes, constructing vec3 for fbm
        vec3 p_xz = vec3(p.x, 0.0, p.z) * scale + offset;
        vec3 p_xy = vec3(p.x, p.y, 0.0) * scale + offset;
        vec3 p_yz = vec3(0.0, p.y, p.z) * scale + offset;

        float xzPlaneNoise = fbm(p_xz, octaves);
        float xyPlaneNoise = fbm(p_xy, octaves);
        float yzPlaneNoise = fbm(p_yz, octaves);

        // Blend the results
        return xzPlaneNoise * blendWeights.y + // Use Y weight for XZ plane
               xyPlaneNoise * blendWeights.z + // Use Z weight for XY plane
               yzPlaneNoise * blendWeights.x;  // Use X weight for YZ plane
    }
    // --- End Triplanar Noise ---

    void main() {
        vec3 worldPos = vWorldPosition;
        vec3 viewDir = normalize(vViewDirection);
        vec3 lightDir = normalize(lightDirection);

        if (u_showInternalMaterial) {
             // --- Internal Material Rendering ---
             int materialIndex = selectElementIndex(worldPos); // Use the existing selection function
             vec3 internalColor = elementColors[materialIndex];

             // Optional: Apply subtle shading based on position/noise (similar to TerrainDepth)
             // float depthFactor = smoothstep(0.0, -100.0, worldPos.y);
             // internalColor *= (1.0 - depthFactor * 0.5);
             // float subtleNoise = fbm(worldPos * noiseScale * 2.0, 2); // Use faster noise
             // internalColor *= (0.9 + subtleNoise * 0.2);

             gl_FragColor = vec4(internalColor, 1.0); // Output the calculated internal color

        } else {
             // --- Original Surface Shading Logic ---
             float normalEpsilon = 0.01; // Smaller epsilon might be better
             vec3 normal = normalize(computeNormalFromNoise(worldPos, normalEpsilon));

             // Using vDensity as a proxy for whether this fragment is part of the solid mesh
             // Adjust threshold as needed, or use a different mechanism if vDensity isn't suitable
             float surfaceDensityThreshold = 0.0; // Example threshold

             if (vDensity > surfaceDensityThreshold) { // Only shade 'solid' parts
                 int selectedIndex = selectElementIndex(worldPos); // Select material for surface
                 vec3 baseColor = elementColors[selectedIndex];
                 float metallic = elementMetallic[selectedIndex];
                 float roughness = elementRoughness[selectedIndex];
                 float patternIntensity = elementPatternIntensity[selectedIndex];

                 // Triplanar mapping for surface pattern
                 float patternNoiseScale = noiseScale * 2.0; // Adjust scale for pattern
                 vec3 patternOffset = planetOffset * 0.5; // Different offset for pattern
                 float patternNoise = triplanarFBM(worldPos, normal, 4, patternNoiseScale, patternOffset);
                 // Apply pattern - mix based on intensity
                 vec3 texturedColor = mix(baseColor, baseColor * (0.6 + patternNoise * 0.6), patternIntensity); // Example mix

                 // --- Simple PBR-like Lighting ---
                 float NdotL = max(dot(normal, lightDir), 0.0);
                 vec3 diffuse = texturedColor * NdotL;

                 // Specular & Fresnel
                 float F0_base = 0.04; // Base reflectivity for non-metals
                 vec3 F0 = mix(vec3(F0_base), texturedColor, metallic); // Reflectivity based on metallic property
                 float NdotV = max(dot(normal, viewDir), 0.0);
                 float fresnel = fresnelSchlick(NdotV, F0_base); // Use base for general Fresnel
                 float specStrength = specularStrength(normal, lightDir, viewDir, roughness);
                 vec3 specular = specStrength * F0 * NdotL; // Modulate specular by light & F0

                 // Combine components (Ambient light is missing, add a small constant factor)
                 vec3 ambient = vec3(0.1) * texturedColor;
                 vec3 finalColor = ambient + diffuse + specular;

                 gl_FragColor = vec4(finalColor, 1.0); // Final surface color

            } else {
                 discard; // Discard fragments that are not 'solid'
             }
         }
    }
`;


/**
 * Creates the unified shader material for the planet surface.
 * @param topElementsData - Composition data.
 * @param noiseScaleOverride - Optional noise scale to enforce consistency.
 * @param planetOffsetOverride - Optional planet offset to enforce consistency.
 */
export function createUnifiedPlanetMaterial(
    topElementsData: TopElementsData | null, // Accept the TopElementsData object
    noiseScaleOverride?: number,        // <<< ADDED parameter
    planetOffsetOverride?: THREE.Vector3 // <<< ADDED parameter
): THREE.ShaderMaterial {

    if (!topElementsData) {
         console.error("CRITICAL: topElementsData is null in createUnifiedPlanetMaterial. Using fallback magenta.");
         // Minimal fallback shader material
         return new THREE.ShaderMaterial({
            vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `void main() { gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0); }`, // Magenta color
            side: THREE.DoubleSide // Added side for fallback
         });
    }

    // --- Padding Safeguard (Ideally done upstream) ---
    const paddedColors = [...topElementsData.colors];
    const paddedWeights = [...topElementsData.weights];
    const paddedMetallic = [...topElementsData.visualParams.map(p => p.metallic)];
    const paddedRoughness = [...topElementsData.visualParams.map(p => p.roughness)];
    const paddedPatternIntensity = [...topElementsData.visualParams.map(p => p.patternIntensity)];

    while (paddedColors.length < MAX_SHADER_ELEMENTS) paddedColors.push(new THREE.Color(0x000000));
    while (paddedWeights.length < MAX_SHADER_ELEMENTS) paddedWeights.push(0.0);
    while (paddedMetallic.length < MAX_SHADER_ELEMENTS) paddedMetallic.push(0.0);
    while (paddedRoughness.length < MAX_SHADER_ELEMENTS) paddedRoughness.push(0.5); // Default roughness
    while (paddedPatternIntensity.length < MAX_SHADER_ELEMENTS) paddedPatternIntensity.push(0.0);

    // Truncate if needed (shouldn't happen with correct upstream data)
    if (paddedColors.length > MAX_SHADER_ELEMENTS) paddedColors.length = MAX_SHADER_ELEMENTS;
    if (paddedWeights.length > MAX_SHADER_ELEMENTS) paddedWeights.length = MAX_SHADER_ELEMENTS;
    if (paddedMetallic.length > MAX_SHADER_ELEMENTS) paddedMetallic.length = MAX_SHADER_ELEMENTS;
    if (paddedRoughness.length > MAX_SHADER_ELEMENTS) paddedRoughness.length = MAX_SHADER_ELEMENTS;
    if (paddedPatternIntensity.length > MAX_SHADER_ELEMENTS) paddedPatternIntensity.length = MAX_SHADER_ELEMENTS;
    // --- End Padding Safeguard ---

    // <<< Use override if provided, otherwise default/random >>>
    const noiseScale = noiseScaleOverride ?? 0.1; // Default scale 0.1 if not overridden
    const planetOffset = planetOffsetOverride ?? new THREE.Vector3(Math.random() * 100, Math.random() * 100, Math.random() * 100);

    const uniforms = {
        time: { value: 0.0 },
        lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() }, // Example light direction
        // Use padded arrays
        elementColors: { value: paddedColors },
        elementWeights: { value: paddedWeights },
        elementMetallic: { value: paddedMetallic },
        elementRoughness: { value: paddedRoughness },
        elementPatternIntensity: { value: paddedPatternIntensity },
        // Noise parameters
        planetOffset: { value: planetOffset }, // <<< Use consistent or random offset
        noiseScale: { value: noiseScale },   // <<< Use consistent or default scale
        u_showInternalMaterial: { value: false }, // Default to showing surface material
    };

    const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: UNIFIED_VERTEX_SHADER,
        fragmentShader: UNIFIED_FRAGMENT_SHADER,
        side: THREE.DoubleSide, // Render back faces for cuts
        // Consider enabling clipping planes if using THREE.Plane for cutting
        // clipping: true,
        // lights: true // May be needed for Three.js built-in light uniforms if used later
    });

    // Helper function to update time uniform
    material.userData.updateTime = (t: number) => {
        material.uniforms.time.value = t;
    };
    // <<< Add helpers to update noise params if needed later >>>
    material.userData.updateNoiseParams = (scale: number, offset: THREE.Vector3) => {
        material.uniforms.noiseScale.value = scale;
        material.uniforms.planetOffset.value = offset;
    };

    return material;
}

// --- NEW: Internal Visualizer Material ---
/**
 * Creates a simplified, transparent material to visualize internal composition.
 * Uses the same noise functions and parameters as the main terrain shader.
 */
export function createInternalVisualizerMaterial(
    topElementsData: TopElementsData | null,
    noiseScale: number,        // Required
    planetOffset: THREE.Vector3 // Required
): THREE.ShaderMaterial {

     if (!topElementsData) {
          console.error("CRITICAL: topElementsData is null in createInternalVisualizerMaterial. Using fallback transparent grey.");
          return new THREE.ShaderMaterial({
             vertexShader: UNIFIED_VERTEX_SHADER, // Use standard VS
             fragmentShader: `void main() { gl_FragColor = vec4(0.5, 0.5, 0.5, 0.5); }`, // Grey fallback
             side: THREE.DoubleSide,
             transparent: true,
             opacity: 0.5
          });
     }

    // --- Padding Safeguard (same as unified material) ---
    const paddedColors = [...topElementsData.colors];
    const paddedWeights = [...topElementsData.weights];
    while (paddedColors.length < MAX_SHADER_ELEMENTS) paddedColors.push(new THREE.Color(0x000000));
    while (paddedWeights.length < MAX_SHADER_ELEMENTS) paddedWeights.push(0.0);
    if (paddedColors.length > MAX_SHADER_ELEMENTS) paddedColors.length = MAX_SHADER_ELEMENTS;
    if (paddedWeights.length > MAX_SHADER_ELEMENTS) paddedWeights.length = MAX_SHADER_ELEMENTS;
    // --- End Padding Safeguard ---

    const uniforms = {
        // Only need uniforms relevant to internal color calculation
        elementColors: { value: paddedColors },
        elementWeights: { value: paddedWeights },
        planetOffset: { value: planetOffset },
        noiseScale: { value: noiseScale },
         // Does NOT need: time, lightDirection, metallic, roughness, pattern, u_showInternalMaterial
    };

    // Simplified Fragment Shader - only does color lookup based on world pos
    const INTERNAL_VIS_FRAGMENT_SHADER = `
        precision highp float;
        #define MAX_ELEMENTS ${MAX_SHADER_ELEMENTS}

        varying vec3 vWorldPosition;
        // No need for vNormal, vUv, vViewDirection, vDensity unless adding effects

        uniform vec3 elementColors[MAX_ELEMENTS];
        uniform float elementWeights[MAX_ELEMENTS];
        uniform vec3 planetOffset;
        uniform float noiseScale;

        // --- Noise Functions (hash, noise, fbm) ---
        // (Copied from UNIFIED_FRAGMENT_SHADER - MUST BE KEPT IN SYNC)
        float hash(vec3 p) {
            p = fract(p * vec3(0.1031, 0.1030, 0.0973));
            p += dot(p, p.yzx + 19.19);
            return fract((p.x + p.y) * p.z);
        }
        float noise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix( mix( mix( hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                             mix( hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                        mix( mix( hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                             mix( hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z );
        }
        float fbm(vec3 p, int octaves) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            for (int i = 0; i < octaves; ++i) {
                value += amplitude * noise(p * frequency + planetOffset);
                frequency *= 2.0;
                amplitude *= 0.5;
            }
            return value;
        }
        // --- End Noise Functions ---

        // --- Element Selection Function (identical to unified shader) ---
        int selectElementIndex(vec3 pos) {
            float noiseVal = fbm(pos * noiseScale, 4);
            noiseVal = noiseVal * 0.5 + 0.5;
            noiseVal = clamp(noiseVal, 0.0, 1.0);
            float cumulativeWeight = 0.0;
            for (int i = 0; i < MAX_ELEMENTS; i++) {
                if (elementWeights[i] == 0.0) continue;
                cumulativeWeight += elementWeights[i];
                if (noiseVal <= cumulativeWeight + 0.001) { return i; }
            }
            for (int i = MAX_ELEMENTS - 1; i >= 0; --i) {
                 if (elementWeights[i] > 0.0) return i;
            }
            return 0;
        }
        // --- End Element Selection ---

        void main() {
            int materialIndex = selectElementIndex(vWorldPosition);
            vec3 internalColor = elementColors[materialIndex];

            // Output the color with fixed transparency
            gl_FragColor = vec4(internalColor, 0.5); // Reduced opacity for layering
        }
    `;

    const material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: UNIFIED_VERTEX_SHADER, // Use the same vertex shader for position/normal data
        fragmentShader: INTERNAL_VIS_FRAGMENT_SHADER,
        transparent: true, // Make layers transparent
        side: THREE.DoubleSide, // Render both sides in case camera goes inside
        depthWrite: false, // <<< PREVENT layers from writing to depth buffer
        blending: THREE.AdditiveBlending // Optionally use additive blending for a glow effect
        // blending: THREE.NormalBlending // Or stick to normal blending
    });

    return material;
}