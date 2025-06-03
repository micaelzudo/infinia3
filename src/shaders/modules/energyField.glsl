// Energy Field Module
// Generates advanced energy field patterns and flows

// Energy field line pattern
float energyFieldLine(vec2 uv, float lineWidth, float lineDensity, float time) {
    // Distort UVs for field line flow
    vec2 distortedUV = uv;
    distortedUV.x += sin(uv.y * lineDensity + time) * 0.1;
    distortedUV.y += cos(uv.x * lineDensity + time * 0.7) * 0.1;
    
    // Create energy field lines
    float linePattern = sin(distortedUV.x * lineDensity) * sin(distortedUV.y * lineDensity);
    
    // Apply width and sharpness
    return smoothstep(1.0 - lineWidth, 1.0, linePattern);
}

// Generates pulsating energy field hex grid
float energyHexGrid(vec2 uv, float scale, float time) {
    // Hex grid transformation
    const vec2 s = vec2(1.0, 1.732);
    vec2 gridUV = uv * scale;
    
    vec2 i0 = floor(gridUV);
    vec2 f0 = fract(gridUV);
    
    // Calculate hex grid distances
    vec3 distances;
    
    // Distance to hex center
    distances.x = length(f0 - 0.5);
    
    // Distances to adjacent hexagons
    vec2 point1 = vec2(0.5, 0.5);
    vec2 point2 = vec2(1.0, 0.0);
    vec2 point3 = vec2(0.0, 1.0);
    
    distances.y = min(
        length(f0 - point1),
        min(length(f0 - point2), length(f0 - point3))
    );
    
    // Distance to hex edge
    distances.z = min(
        length(f0 - mix(point1, point2, 0.5)),
        min(length(f0 - mix(point2, point3, 0.5)), length(f0 - mix(point3, point1, 0.5)))
    );
    
    // Add time-based pulse to grid cells
    float pulse = sin(i0.x * 0.5 + i0.y * 0.5 + time) * 0.5 + 0.5;
    
    // Create hex pattern
    float hex = smoothstep(0.4 + pulse * 0.1, 0.5 + pulse * 0.1, distances.x);
    
    // Add glow to edges
    float edges = smoothstep(0.02, 0.05, distances.z);
    
    return mix(hex, edges, 0.5);
}

// Creates energy vortex effect
vec3 energyVortex(vec2 uv, float time, vec3 color) {
    // Center coordinates
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;
    
    // Calculate polar coordinates
    float dist = length(delta);
    float angle = atan(delta.y, delta.x);
    
    // Create spiral pattern
    float spiral = sin(dist * 20.0 - angle * 5.0 + time * 2.0);
    spiral = smoothstep(0.2, 0.8, spiral);
    
    // Add pulsating rings
    float rings = sin(dist * 30.0 - time * 3.0) * 0.5 + 0.5;
    rings = pow(rings, 3.0);
    
    // Combine effects
    float energyPattern = spiral * 0.7 + rings * 0.3;
    
    // Distance falloff
    float falloff = 1.0 - smoothstep(0.0, 0.5, dist);
    
    return color * energyPattern * falloff;
}

// Generates flowing energy waves
vec3 energyFlowWaves(vec3 position, float time, vec3 baseColor) {
    // Base wave pattern
    float wave1 = sin(position.x * 3.0 + position.y * 2.0 + position.z * 1.0 + time * 1.5);
    float wave2 = cos(position.x * 2.0 - position.y * 3.0 + position.z * 1.5 + time * 2.0);
    
    // Combine waves with phase shifts
    float waves = wave1 * 0.5 + wave2 * 0.5;
    
    // Create energy flow effect
    float flowStrength = smoothstep(-0.2, 0.8, waves);
    flowStrength = pow(flowStrength, 2.0);
    
    // Generate color variation based on flow strength
    vec3 energyColor = mix(
        baseColor * 0.5, 
        baseColor * 1.5, 
        flowStrength
    );
    
    // Add energy pulses
    float pulses = pow(sin(time * 3.0) * 0.5 + 0.5, 2.0);
    energyColor += baseColor * pulses * flowStrength * 0.5;
    
    return energyColor * flowStrength;
}

// Creates plasma field effect
vec3 plasmaField(vec2 uv, float time, vec3 color1, vec3 color2) {
    // Multiple overlapping sine waves create plasma effect
    float plasma = 0.0;
    plasma += sin(uv.x * 10.0 + time);
    plasma += sin(uv.y * 12.0 + time * 1.2);
    plasma += sin(uv.x * 5.0 + uv.y * 7.0 + time * 1.5);
    plasma += sin(sqrt(uv.x * uv.x + uv.y * uv.y) * 10.0 + time);
    
    // Normalize to 0-1 range
    plasma = plasma * 0.25 + 0.5;
    
    // Color mapping
    return mix(color1, color2, plasma);
} 