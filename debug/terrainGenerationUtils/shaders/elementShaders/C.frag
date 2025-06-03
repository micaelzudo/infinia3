// C.frag - Non-metal element
precision highp float;

// Uniforms
uniform vec3 lightDirection;
uniform float time;

// Element-specific color
const vec3 baseColor = vec3(0.2510, 0.2510, 0.2510);

// Varyings
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

// Noise functions
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

// Ridge noise for sharp features like cracks and ridges
float ridgeNoise(vec3 p) {
    float n = 1.0 - abs(noise(p) * 2.0 - 1.0); // Convert noise to ridges
    return n * n; // Sharpen the ridges
}

// Domain warping for more organic distortion
vec3 warpDomain(vec3 p) {
    return p + vec3(
        sin(p.y * 1.5 + p.z * 0.8) * 0.15,
        sin(p.z * 1.5 + p.x * 0.7) * 0.15,
        sin(p.x * 1.5 + p.y * 0.9) * 0.15
    );
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Get slope data for terrain-based effects
    float slopeFactor = dot(normal, vec3(0.0, 1.0, 0.0)); // 1.0 = facing up, 0.0 = vertical
    
    // Base terrain - warped domain for more natural look
    vec3 warpedPosition = warpDomain(vWorldPosition);
    float baseRoughness = fbm(warpedPosition * 3.0);
    
    // Multiple detail layers
    // Large features (hills, depressions)
    float largeFeatures = fbm(warpedPosition * 1.2);
    
    // Medium features (rocks, bumps)
    float mediumFeatures = fbm(warpedPosition * 4.0) * 0.5;
    
    // Small features (pebbles, small irregularities)
    float smallFeatures = fbm(warpedPosition * 10.0) * 0.25;
    
    // Very fine detail (rough texture, granular surface)
    float microDetail = fbm(vWorldPosition * 20.0) * 0.15;
    
    // Combine all detail scales with proper weighting
    float combinedDetail = largeFeatures + mediumFeatures + smallFeatures + microDetail;
    
    // Create erosion patterns - stronger in valleys and weaker on peaks
    float erosion = 1.0 - smoothstep(0.4, 0.6, slopeFactor); // More erosion on slopes
    float erosionPattern = ridgeNoise(warpedPosition * 5.0 + normal * erosion);
    
    // Add crack patterns - especially on flatter areas
    float crackPattern = 0.0;
    if(slopeFactor > 0.7) { // Only on relatively flat surfaces
        float crackBase = ridgeNoise(warpedPosition * 8.0);
        crackPattern = smoothstep(0.7, 0.9, crackBase) * 0.5;
    }
    
    // Stratified layers for sedimentary material look
    float strata = 0.0;
    if(baseColor.r > 0.4 || baseColor.g > 0.4 || baseColor.b > 0.4) { // Only for lighter materials
        // Horizontal layers
        strata = smoothstep(0.45, 0.55, sin(vWorldPosition.y * 15.0) * 0.5 + 0.5) * 0.4;
        // Add some distortion to the layers
        strata *= (0.8 + noise(vWorldPosition * 2.0) * 0.4);
    }
    
    // Weather-exposed vs protected areas
    float exposureFactor = mix(0.3, 1.0, slopeFactor); // More exposed on top
    
    // Different weathering for different positions (can be correlated with world position)
    float positionBasedWeathering = noise(vWorldPosition * 0.2); // Large scale variation
    
    // Moisture collection in crevices
    float moisture = smoothstep(0.5, 0.7, fbm(warpedPosition * 4.0)) * (1.0 - slopeFactor);
    
    // Time-based subtle movement (e.g., for sulfur, phosphorus that might have slow phase changes)
    float timeEffect = sin(time * 0.1 + vWorldPosition.y * 2.0) * 0.03 * (1.0 - erosion);
    
    // Lighting calculations
    vec3 lightDir = normalize(lightDirection);
    
    // Diffuse with self-shadowing from terrain details
    float diffuseBase = max(dot(normal, lightDir), 0.0);
    float shadowDetail = mix(1.0, 0.7, crackPattern + erosionPattern * 0.5);
    float diffuse = diffuseBase * shadowDetail;
    
    // Ambient occlusion in crevices and lower areas
    float ao = mix(0.6, 1.0, smoothstep(0.0, 0.2, ridgeNoise(vWorldPosition * 6.0)));
    
    // Specular varied by material characteristics
    float specBase = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 12.0) * 0.3;
    
    // Wet areas are more specular
    float specular = specBase * (1.0 + moisture * 2.0) * (1.0 - crackPattern);
    
    // Create color variation based on all our detail maps
    vec3 baseVariation = mix(baseColor * 0.8, baseColor * 1.1, combinedDetail);
    
    // Specific material adjustments to the color
    vec3 colorWithFeatures = mix(baseVariation, baseColor * 0.6, crackPattern); // Darken cracks
    colorWithFeatures = mix(colorWithFeatures, baseColor * 0.5, erosionPattern * 0.7); // Darken eroded areas
    colorWithFeatures = mix(colorWithFeatures, baseColor * 1.2, strata); // Lighter strata/layers
    
    // Moisture darkens the color and adds slight blue/green tint depending on base color
    vec3 moistColor = baseColor * 0.7 + vec3(0.0, 0.03, 0.05);
    colorWithFeatures = mix(colorWithFeatures, moistColor, moisture * 0.6);
    
    // Combine all lighting effects
    vec3 finalColor = 
        // Ambient light with ambient occlusion and base color variation
        colorWithFeatures * 0.3 * ao * exposureFactor +
        
        // Diffuse lighting with details
        colorWithFeatures * diffuse * (0.7 + combinedDetail * 0.3) +
        
        // Specular highlights for wet or smooth areas
        baseColor * specular * (1.0 - erosionPattern * 0.5) +
        
        // Add the time-based subtle effect
        baseColor * timeEffect;
    
    // Edge darkening for silhouette enhancement
    float edgeDarkening = pow(max(dot(viewDir, normal), 0.0), 0.5) * 0.2 + 0.8;
    finalColor *= edgeDarkening;
    
    gl_FragColor = vec4(finalColor, 1.0);
}