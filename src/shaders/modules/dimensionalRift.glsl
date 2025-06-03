// Dimensional Rift Module
// Creates interdimensional tear effects and portal visuals

// Generates dimensional tear edge pattern
float dimensionalTearEdge(vec2 uv, vec2 center, float radius, float edgeThickness, float noiseScale, float time) {
    // Distance from tear center
    float dist = length(uv - center);
    
    // Create noisy edge using simplex noise
    float angle = atan(uv.y - center.y, uv.x - center.x);
    float noise = sin(angle * 8.0 + time * 2.0) * 0.1 +
                 sin(angle * 15.0 - time * 3.0) * 0.05;
    
    // Apply noise to radius
    float noisyRadius = radius + noise * noiseScale;
    
    // Create edge with inner and outer boundary
    float innerEdge = smoothstep(noisyRadius - edgeThickness, noisyRadius, dist);
    float outerEdge = smoothstep(noisyRadius, noisyRadius + edgeThickness, dist);
    
    return innerEdge * (1.0 - outerEdge);
}

// Generates energy discharge arcs along rift edges
float energyDischargeArcs(vec2 uv, vec2 center, float radius, float time) {
    // Distance and angle from center
    float dist = length(uv - center);
    float angle = atan(uv.y - center.y, uv.x - center.x);
    
    // Number of arcs around the rift
    const float arcCount = 8.0;
    
    // Generate multiple arcs
    float arcIntensity = 0.0;
    for (float i = 0.0; i < arcCount; i++) {
        // Arc position varies with time
        float arcPosition = i * (2.0 * 3.14159) / arcCount + time * 0.5;
        
        // Distance from current angle to arc position
        float angleDist = abs(mod(angle - arcPosition + 3.14159, 2.0 * 3.14159) - 3.14159);
        
        // Arc shape - narrow spike
        float arc = pow(0.05 / (0.01 + angleDist), 2.0);
        
        // Only show arcs within radius range
        if (abs(dist - radius) < 0.1) {
            arcIntensity += arc * 0.02;
        }
    }
    
    return min(1.0, arcIntensity);
}

// Generates spatial distortion around rift
vec2 spatialDistortion(vec2 uv, vec2 center, float radius, float strength, float time) {
    // Distance from rift center
    float dist = length(uv - center);
    
    // Distortion direction
    vec2 dir = normalize(uv - center);
    
    // Distortion factor decreases with distance
    float distortFactor = smoothstep(radius + 0.3, radius - 0.1, dist);
    
    // Time-based distortion wave
    float timeWave = sin(dist * 10.0 - time * 2.0) * 0.5 + 0.5;
    
    // Apply distortion
    return uv - dir * distortFactor * timeWave * strength;
}

// Creates interdimensional rift effect
vec3 dimensionalRift(vec2 uv, float time, vec3 baseColor, vec3 riftColor) {
    // Rift center position
    vec2 riftCenter = vec2(0.5, 0.5);
    
    // Animate rift center slightly
    riftCenter += vec2(
        sin(time * 0.4) * 0.05,
        cos(time * 0.3) * 0.05
    );
    
    // Rift parameters
    float riftRadius = 0.2 + sin(time * 0.2) * 0.02; // Pulsating radius
    float edgeThickness = 0.02 + sin(time * 0.5) * 0.005;
    float noiseScale = 0.05;
    
    // Apply spatial distortion to UVs for background behind the rift
    vec2 distortedUV = spatialDistortion(uv, riftCenter, riftRadius, 0.2, time);
    
    // Calculate rift edge
    float edge = dimensionalTearEdge(uv, riftCenter, riftRadius, edgeThickness, noiseScale, time);
    
    // Calculate energy discharge arcs
    float arcs = energyDischargeArcs(uv, riftCenter, riftRadius, time);
    
    // Calculate rift interior
    float interior = 1.0 - smoothstep(riftRadius - edgeThickness, riftRadius, length(uv - riftCenter));
    
    // Rift interior color with animated patterns
    float interiorPattern = sin(uv.x * 20.0 + time) * sin(uv.y * 20.0 - time) * 0.5 + 0.5;
    vec3 interiorColor = mix(riftColor * 0.5, riftColor, interiorPattern);
    
    // Edge color with high energy
    vec3 edgeColor = mix(riftColor, vec3(1.0), 0.7);
    
    // Arc color (bright white/blue)
    vec3 arcColor = vec3(0.6, 0.8, 1.0);
    
    // Combine all elements
    vec3 result = baseColor;
    
    // Add rift interior
    result = mix(result, interiorColor, interior * 0.8);
    
    // Add edge glow
    result = mix(result, edgeColor, edge * 0.9);
    
    // Add energy arcs
    result += arcColor * arcs;
    
    return result;
}

// Creates a glimpse into alternate dimension
vec3 alternateDimensionGlimpse(vec2 uv, float time, vec3 baseColor) {
    // Rift parameters
    vec2 riftCenter = vec2(0.5, 0.5);
    float riftRadius = 0.15;
    
    // Check if inside rift
    float distToRift = length(uv - riftCenter);
    if (distToRift > riftRadius) {
        return baseColor; // Outside rift, return base color
    }
    
    // Normalized position inside rift (0-1)
    float normalizedDist = distToRift / riftRadius;
    
    // Alternate dimension color scheme
    vec3 altDimColor1 = vec3(0.1, 0.0, 0.2); // Dark purple
    vec3 altDimColor2 = vec3(0.5, 0.0, 0.5); // Deep purple
    
    // Create swirling patterns for alternate dimension
    float angle = atan(uv.y - riftCenter.y, uv.x - riftCenter.x);
    float swirl = sin(angle * 5.0 + time * 2.0 + distToRift * 20.0);
    
    // Add some fractal patterns
    float fractal = 0.0;
    vec2 p = uv * 10.0;
    float amp = 0.5;
    
    for (int i = 0; i < 5; i++) {
        fractal += sin(p.x + time) * sin(p.y + time * 0.5) * amp;
        p *= 2.0;
        p = vec2(p.y, -p.x); // Rotate for variety
        amp *= 0.5;
    }
    
    // Combine patterns
    float pattern = (swirl * 0.5 + 0.5) * 0.7 + fractal * 0.3;
    
    // Create color using patterns
    vec3 altDimColor = mix(altDimColor1, altDimColor2, pattern);
    
    // Add glowing particles floating in alt dimension
    float particles = pow(sin(uv.x * 20.0 + time * 0.7) * sin(uv.y * 20.0 + time), 10.0);
    altDimColor += vec3(0.3, 0.1, 0.5) * particles;
    
    // Edge effect for transition
    float edge = smoothstep(0.7, 1.0, normalizedDist);
    
    // Combine with base color for smooth transition at edges
    return mix(altDimColor, baseColor, edge);
} 