// other.frag - Element shader
precision highp float;

// Uniforms
uniform vec3 lightDirection;
uniform float time;

// Element-specific color
const vec3 baseColor = vec3(0.1333, 0.5451, 0.1333);

// Varyings
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

// Optimized hash function
float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

// Optimized noise function
float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    // Optimized smoothing
    f = f * f * (3.0 - 2.0 * f);
    
    // Optimized by using mix only 3 times instead of 7
    vec2 uv = i.xy + f.xy;
    float a = hash(vec3(uv, i.z));
    float b = hash(vec3(uv, i.z + 1.0));
    return mix(a, b, f.z);
}

// Simple FBM for surface details
float fbm(vec3 p) {
    float result = 0.0;
    float amp = 0.5;
    
    // Reduce octaves for performance
    for(int i = 0; i < 3; i++) {
        result += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    
    return result;
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);

    // Create optimized surface detail
    vec3 p = vWorldPosition * 4.0;
    float detail = fbm(p) * 0.3;
    
    // Create more interesting pattern with domain warping
    p += vec3(detail) * 0.2;
    float pattern = noise(p * 1.5) * 0.3;
    
    // Add subtle pulsing animation based on time and position
    float pulse = sin(time * 0.2 + vWorldPosition.y * 2.0) * 0.05 + 0.95;
    
    // Slope/terrain-based variation
    float slopeFactor = dot(normal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    
    // Lighting
    vec3 lightDir = normalize(lightDirection);
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    // Basic Fresnel for edge highlighting
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.0) * 0.3;
    
    // Ambient + environmental light
    vec3 ambient = baseColor * 0.3;
    
    // Add subtle specular highlight
    float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 16.0) * 0.5;
    
    // Create color variation based on terrain
    vec3 colorVariation = mix(
        baseColor * 0.8,  // Darker in valleys
        baseColor * 1.2,  // Brighter on peaks
        slopeFactor
    );
    
    // Add pattern-based color variation
    colorVariation = mix(
        colorVariation,
        colorVariation * 1.2,  // Lighter areas based on pattern
        pattern
    );
    
    // Combine lighting and color
    vec3 finalColor = 
        ambient + 
        colorVariation * diffuse * (0.7 + detail) + // Diffuse with detail variation
        colorVariation * fresnel +                  // Edge highlighting
        vec3(0.9, 0.9, 1.0) * specular;            // Slight blueish specular
        
    // Apply subtle pulse variation
    finalColor *= pulse;
    
    gl_FragColor = vec4(finalColor, 1.0);
}