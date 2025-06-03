precision mediump float;

varying vec2 vUv;
uniform float uTime;
uniform float uSeed;
uniform vec3 uColor;

// Hash function for pseudo-random generation
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    // Calculate distance from center
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vUv, center);
    
    // Hexagon shape - create outer boundary
    float outerBoundary = 0.5;
    
    // Create animated pulse
    float pulseSpeed = 0.5 + hash(uSeed) * 0.5;
    float pulseWidth = 0.08 + hash(uSeed + 1.0) * 0.05;
    float pulseTime = fract(uTime * pulseSpeed);
    float pulse = smoothstep(pulseTime, pulseTime + pulseWidth, dist) * 
                 smoothstep(pulseTime + pulseWidth * 2.0, pulseTime + pulseWidth, dist);
    
    // Create a hexagonal mask (approximation)
    // For a true hexagon we'd use more complex math, but this works for the glow effect
    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
    float hexagonFactor = cos(angle * 6.0) * 0.1;
    float hexMask = smoothstep(outerBoundary + hexagonFactor, outerBoundary + hexagonFactor - 0.05, dist);
    
    // Combine hexagon shape with pulse
    float brightness = hexMask + pulse * 0.3;
    
    // Apply color
    vec3 glowColor = uColor * (0.7 + 0.3 * sin(uTime * 3.0 + uSeed * 10.0));
    vec3 finalColor = glowColor * brightness;
    
    // Add some shimmer
    float shimmer = hash(vUv.x * vUv.y * 100.0 + uTime) * 0.1;
    finalColor += shimmer * hexMask * glowColor;
    
    gl_FragColor = vec4(finalColor, brightness);
} 