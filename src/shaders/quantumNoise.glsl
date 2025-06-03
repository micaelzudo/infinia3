// Quantum Noise Module
// Advanced noise functions for quantum-like effects

// Hash function for pseudo-random generation
vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    
    return fract(sin(p) * 43758.5453123);
}

// Simple version of quantum probability cloud with just position and seed
vec3 quantumProbabilityCloud(vec3 position, float seed) {
    // Create a virtual center based on seed
    vec3 center = vec3(
        sin(seed * 12.456) * 10.0,
        cos(seed * 45.789) * 10.0,
        sin(seed * 78.123) * 10.0
    );
    
    // Create virtual time from seed
    float virtualTime = seed * 10.0;
    
    // Use moderate values for other parameters
    float radius = 15.0;
    float complexity = 3.0;
    
    // Distance from the center
    float dist = length(position - center);
    
    // Normalized distance
    float normDist = min(dist / radius, 1.0);
    
    // Quantum wave function approximation (radial part)
    float radialWave = (1.0 - normDist) * exp(-normDist * 3.0);
    
    // Simplified shells
    float shells = 0.0;
    for(int n = 1; n <= 3; n++) {
        float shellRadius = float(n * n) / 9.0;
        float shellWidth = 0.1 / float(n);
        float shellIntensity = exp(-pow((normDist - shellRadius) / shellWidth, 2.0));
        shells += shellIntensity / float(n);
    }
    
    // Create color based on position and seed
    float hue = fract(seed + position.x * 0.01 + position.y * 0.02 + position.z * 0.03);
    
    // HSV to RGB conversion for the color
    vec3 color;
    float h = hue * 6.0;
    float i = floor(h);
    float f = h - i;
    float p = 0.0;
    float q = 1.0 - f;
    float t = f;
    
    if (i == 0.0) color = vec3(1.0, t, p);
    else if (i == 1.0) color = vec3(q, 1.0, p);
    else if (i == 2.0) color = vec3(p, 1.0, t);
    else if (i == 3.0) color = vec3(p, q, 1.0);
    else if (i == 4.0) color = vec3(t, p, 1.0);
    else color = vec3(1.0, p, q);
    
    // Final probability based on simplified components
    float probability = radialWave * 0.3 + shells * 0.7;
    probability = smoothstep(0.1, 0.6, probability);
    
    return color * probability;
}

// Keep the rest of the file unchanged...

// Generates quantum noise with configurable wave function properties
float quantumWaveNoise(vec3 position, float frequency, float time, float complexity) {
    // ... rest of the function unchanged ...
}

// ... rest of the file unchanged ... 