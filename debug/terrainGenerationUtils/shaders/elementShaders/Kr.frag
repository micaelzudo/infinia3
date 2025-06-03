// Kr.frag - Gaseous element
precision highp float;

// Uniforms
uniform vec3 lightDirection;
uniform float time;

// Element-specific color
const vec3 baseColor = vec3(0.3608, 0.7216, 0.8196);

// Varyings
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

// Noise function for gas swirls
float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
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

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; ++i) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Moving gas effect using noise
    float noiseTime = time * 0.1; // Slow movement
    
    // Multi-layered swirling with different speeds and scales
    vec3 noiseCoord1 = vWorldPosition * 0.15 + vec3(0.0, noiseTime * 0.7, noiseTime);
    vec3 noiseCoord2 = vWorldPosition * 0.3 + vec3(noiseTime * 0.5, 0.0, noiseTime * 0.3);
    float noiseValue1 = fbm(noiseCoord1);
    float noiseValue2 = fbm(noiseCoord2);
    
    // Combine noise layers for more complex swirling
    float combinedNoise = mix(noiseValue1, noiseValue2, 0.5 + sin(noiseTime) * 0.2);
    
    // Add vortex-like structures
    float vortex = fbm(noiseCoord1 * 2.0 + vec3(combinedNoise * 1.8));
    
    // Density variation - denser in some areas, thinner in others
    float densityVar = fbm(vWorldPosition * 0.4 - vec3(0.0, noiseTime * 0.2, 0.0));
    
    // Internal glow that changes with the noise
    vec3 innerColor = baseColor * (1.0 + 0.4 * sin(time * 0.2)); // Subtle pulsing
    vec3 innerGlow = mix(baseColor, innerColor, combinedNoise) * mix(0.8, 1.5, vortex);
    
    // Fresnel effect for edge glow - make it dependent on density
    float fresnelPower = mix(1.5, 3.0, densityVar);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), fresnelPower);
    vec3 fresnelColor = baseColor * 1.3; // Brighter at edges
    
    // Light interaction
    vec3 lightDir = normalize(lightDirection);
    float diffuse = max(dot(normal, lightDir), 0.0) * 0.6;
    float backLight = max(dot(normal, -lightDir), 0.0) * 0.2; // Light passing through gas
    vec3 ambientLight = baseColor * 0.2;
    
    // Combine effects
    vec3 finalColor = 
        ambientLight + 
        (baseColor * diffuse * 0.5) +  // Diffuse is subtle
        (baseColor * backLight) +      // Backlighting for translucency
        (innerGlow * (0.6 + vortex * 0.5)) +  // Inner glow varies with noise
        (fresnelColor * fresnel * 0.8);  // Edge highlighting
    
    // Dynamic alpha based on density, noise, viewing angle and position
    float alphaBase = mix(0.65, 0.9, densityVar);
    float alphaViewDependent = mix(alphaBase, alphaBase * 1.2, fresnel);
    float alphaNoise = mix(alphaViewDependent, alphaViewDependent * 0.8, vortex);
    
    // Final alpha with subtle pulsing
    float alpha = alphaNoise * (0.9 + 0.1 * sin(time * 0.3 + vWorldPosition.y));
    
    gl_FragColor = vec4(finalColor, alpha);
}