import * as THREE from 'three';

// Define the vertex shader
const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition; // Pass world position
    varying vec2 vUv;
    varying vec3 vViewDirection; // Pass view direction

    void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        vUv = uv;
        vViewDirection = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// Define the fragment shader
const fragmentShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vViewDirection;
    
    uniform float time;
    uniform vec3 lightDirection; // Added for lighting
    // cameraPosition is built-in
    
    uniform float stripeFrequency;
    uniform float stripeWidth;
    // uniform float stripeOffset; // Can remove if noise drives variation
    // uniform float stripeVariation; // Can remove if noise drives variation
    uniform float noiseScale;
    uniform float noiseStrength;
    uniform float baseRoughness; // Control overall roughness
    uniform float metallicFactor; // Control metallic look (0=dielectric, 1=metallic)

    // Element composition uniforms
    uniform vec3 stripeColors[10]; // Maximum 10 different stripe colors
    uniform float stripeWeights[10]; // Weights for each stripe color
    // uniform float totalStripeWeight; // Can calculate dynamically or ignore if weights are normalized
    uniform vec3 planetOffset; // Keep planet offset for noise variation

    // --- Noise Functions (Hash, Noise, FBM) ---
    // Hash function from Si.frag / Fe.frag
    float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
    }

    // 3D Noise function from Si.frag / Fe.frag
    float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f); // Smoothstep curve
        
        return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
                f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
                f.y),
            f.z
        );
    }

    // Fractional Brownian Motion (FBM)
    float fbm(vec3 p, int octaves) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < octaves; i++) {
            value += amplitude * noise(p * frequency + planetOffset); // Add offset here
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }
    // --- End Noise Functions ---
    
    // --- Lighting Functions ---
    // Basic Fresnel calculation
    float fresnelSchlick(float cosTheta, float F0) {
        return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
    }
    
    // Basic specular calculation (Blinn-Phong style for simplicity)
    float specularStrength(vec3 normal, vec3 lightDir, vec3 viewDir, float roughness) {
         vec3 halfDir = normalize(lightDir + viewDir);
         float specAngle = max(dot(normal, halfDir), 0.0);
         // Roughness to shininess conversion (approximate)
         float shininess = (1.0 - roughness * roughness) * 256.0; 
         return pow(specAngle, shininess);
    }
    // --- End Lighting Functions ---

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewDirection);
        vec3 lightDir = normalize(lightDirection);

        // --- Calculate Base Color from Composition ---
        vec3 blendedBaseColor = vec3(0.0);
        float totalWeight = 0.0;
        for (int i = 0; i < 10; i++) {
            if (stripeWeights[i] > 0.001) { // Use a small threshold
                blendedBaseColor += stripeColors[i] * stripeWeights[i];
                totalWeight += stripeWeights[i];
            }
        }
        // Normalize if weights weren't already (safer)
        if (totalWeight > 0.0) {
           blendedBaseColor /= totalWeight; 
        } else {
           blendedBaseColor = vec3(0.5); // Fallback grey if no weights
        }
        
        // --- Generate Pattern using FBM noise ---
        // Use world position for noise input, scale it
        vec3 noiseInput = vWorldPosition * noiseScale;
        float patternNoise = fbm(noiseInput, 4); // 4 octaves of FBM
        
        // Modulate the noise to create stripe-like features or patches
        // Example: Use sine wave driven by Y position and modulated by noise
        float yStripe = vWorldPosition.y * stripeFrequency;
        float modulatedStripe = sin(yStripe + patternNoise * noiseStrength * 10.0); // Noise influences stripe position
        // Create sharper transitions for stripes/patches
        float stripeFactor = smoothstep(0.5 - stripeWidth * 0.5, 0.5 + stripeWidth * 0.5, modulatedStripe * 0.5 + 0.5);
        
        // Mix base color slightly based on the pattern for variation
        // Example: Darker/lighter patches
        vec3 patternColor = mix(blendedBaseColor * 0.8, blendedBaseColor * 1.1, stripeFactor);
        
        // --- Calculate Lighting --- 
        float NdotL = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = patternColor * NdotL;
        
        // Specular Calculation
        // Base reflectivity for non-metals (like water/rock)
        float F0 = 0.04;
        // Lerp towards white based on metallic factor for metal reflectivity
        vec3 metalF0 = patternColor; // Metals reflect their own color
        vec3 dielectricF0 = vec3(F0);
        vec3 effectiveF0 = mix(dielectricF0, metalF0, metallicFactor); // Interpolate based on metallic factor
        
        float NdotV = max(dot(normal, viewDir), 0.0);
        float fresnel = fresnelSchlick(NdotV, F0); // Use base F0 for general fresnel
        
        float spec = specularStrength(normal, lightDir, viewDir, baseRoughness);
        vec3 specular = effectiveF0 * spec; // Specular color depends on material type
        
        // --- Combine Components ---
        // Ambient term (crude approximation)
        vec3 ambient = patternColor * 0.1;
        
        // Combine: Ambient + Diffuse + Specular
        // For metals, diffuse is often negligible, color comes from specular/reflection
        vec3 outgoingLight = ambient + mix(diffuse, vec3(0.0), metallicFactor) + specular; 
        
        // Add subtle fresnel effect for glancing angles (more reflective at edges)
        // For metals, fresnel might tint reflections, for dielectrics it adds white glare
        vec3 fresnelColor = mix(vec3(1.0), patternColor, metallicFactor); // White for dielectric, base for metal
        outgoingLight = mix(outgoingLight, fresnelColor, fresnel * 0.5); // Blend in fresnel effect
        
        // Final color
        gl_FragColor = vec4(outgoingLight, 1.0); 
    }
`;

export function createElementStripeShader(elementColors, elementWeights) {
    console.log("🎨 [createElementStripeShader] Creating ENHANCED shader with elements:", elementColors.length);
    
    const weights = Array.from(elementWeights).slice(0, 10);
    const colors = elementColors.slice(0, 10).map(c => c instanceof THREE.Color ? c : new THREE.Color(c));
    
    while (colors.length < 10) colors.push(new THREE.Color(0x000000));
    while (weights.length < 10) weights.push(0.0);
    
    console.log("🎨 Using colors:", colors.map(c => c.getHexString()));
    console.log("⚖️ Using weights:", weights);
    
    // Calculate initial average metallic factor based on dominant element?
    // Or just set a default - let's start with mostly dielectric (0.1)
    const initialMetallic = 0.1;
    const initialRoughness = 0.6;
    
    const material = new THREE.ShaderMaterial({
        uniforms: {
            planetOffset: { value: new THREE.Vector3(Math.random() * 1000, Math.random() * 1000, Math.random() * 1000) },
            time: { value: 0 },
            lightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() }, // Default light
            stripeFrequency: { value: 0.8 }, // Lower frequency for broader patterns
            stripeWidth: { value: 0.6 },
            noiseScale: { value: 0.15 }, // Adjust scale for FBM
            noiseStrength: { value: 1.5 }, // Adjust strength for FBM impact
            baseRoughness: { value: initialRoughness },
            metallicFactor: { value: initialMetallic },
            stripeColors: { value: colors },
            stripeWeights: { value: weights },
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.DoubleSide,
    });

    return material;
}

export function updateShaderUniforms(material, time) {
    if (!material || !material.uniforms) {
        // console.warn("⚠️ [updateShaderUniforms] No material or uniforms!");
        return;
    }
    material.uniforms.time.value = time;
}
