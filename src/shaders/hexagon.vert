varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vDistance;

uniform float uTime;
uniform float uPulse;
uniform float uBorderWidth;

// Noise function (Simple 2D hash)
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Simple noise function
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep
    
    float a = hash(i + vec2(0.0, 0.0));
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    // Pass varyings to fragment shader
    vUv = uv;
    vPosition = position;
    vNormal = normal;
    
    // Calculate vertex position relative to the center
    vec2 centered = vec2(position.x, position.y) * 2.0;
    float distanceFromCenter = length(centered);
    vDistance = distanceFromCenter; // Assuming base size corresponds to radius 1
    
    // --- Instability Effect ---
    float noiseFrequency = 3.0;
    float noiseAmplitude = 0.03; // Controls jitter intensity
    float noiseOffset = uTime * 0.5;
    float displacementX = (noise(vec2(position.x * noiseFrequency + noiseOffset, position.y * noiseFrequency)) - 0.5) * 2.0 * noiseAmplitude;
    float displacementY = (noise(vec2(position.y * noiseFrequency, position.x * noiseFrequency + noiseOffset)) - 0.5) * 2.0 * noiseAmplitude;
    float displacementZ = (noise(vec2(position.x * noiseFrequency, position.y * noiseFrequency + noiseOffset * 0.7)) - 0.5) * 2.0 * noiseAmplitude * 0.5; // Less Z jitter

    // --- Original Z-axis effects ---
    float pulseAmount = sin(uTime * 0.8) * 0.02 * uPulse;
    float waveX = sin(position.x * 3.0 + uTime) * 0.01;
    float waveY = cos(position.y * 3.0 + uTime * 0.7) * 0.01;
    
    // --- Combine ALL effects into final position ---
    vec3 finalPosition = position + vec3(displacementX, displacementY, displacementZ); // Apply instability displacement
    finalPosition.z += pulseAmount + waveX + waveY; // Apply original Z effects (pulse, wave)
    
    // Apply projections
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
} 