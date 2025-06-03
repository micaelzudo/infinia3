// Time Warp Module
// Creates temporal distortion effects and time dilation visuals

// Time ripple effect - creates concentric rings that represent time waves
float timeRipple(vec2 uv, vec2 center, float time, float speed, float frequency) {
    // Distance from ripple center
    float dist = length(uv - center);
    
    // Create expanding ripple pattern
    float ripple = sin(dist * frequency - time * speed);
    
    // Add some distance-based falloff
    float falloff = 1.0 / (1.0 + dist * 5.0);
    
    return ripple * falloff;
}

// Creates combined time ripples effect from multiple sources
float multiTimeRipples(vec2 uv, float time) {
    float ripples = 0.0;
    
    // Create multiple ripple centers
    vec2 centers[3];
    centers[0] = vec2(0.3, 0.3) + vec2(sin(time * 0.3), cos(time * 0.4)) * 0.1;
    centers[1] = vec2(0.7, 0.5) + vec2(cos(time * 0.4), sin(time * 0.5)) * 0.1;
    centers[2] = vec2(0.4, 0.8) + vec2(sin(time * 0.5), cos(time * 0.3)) * 0.1;
    
    // Different speeds and frequencies for each ripple
    float speeds[3] = float[3](1.0, 1.5, 0.7);
    float freqs[3] = float[3](15.0, 20.0, 10.0);
    
    // Combine all ripple effects
    for (int i = 0; i < 3; i++) {
        ripples += timeRipple(uv, centers[i], time, speeds[i], freqs[i]);
    }
    
    return ripples / 3.0;
}

// Creates time echo effect - creates ghosting/trailing
vec2 timeEcho(vec2 uv, float time, float strength) {
    // Create several time echoes with different offsets
    vec2 echo = uv;
    
    // Echo direction varies with time
    float angle = time * 0.2;
    vec2 direction = vec2(cos(angle), sin(angle));
    
    // Echo strength oscillates
    float echoStrength = sin(time * 3.0) * 0.5 + 0.5;
    
    // Apply echo displacement
    echo += direction * strength * echoStrength;
    
    return echo;
}

// Creates temporal blur effect
vec3 temporalBlur(vec3 currentColor, vec2 uv, float time, float strength) {
    // Create multiple time samples
    vec3 blurredColor = currentColor;
    
    // Number of temporal samples
    const int samples = 5;
    
    // Create samples from "different points in time"
    for (int i = 1; i <= samples; i++) {
        float timeOffset = float(i) / float(samples) * 2.0;
        
        // Sample direction changes with time
        float angle = time * 0.1 + timeOffset;
        vec2 offset = vec2(cos(angle), sin(angle)) * strength * float(i) / float(samples);
        
        // Each sample has diminishing contribution
        float weight = 1.0 - float(i) / float(samples);
        
        // Add time sample to blurred result
        blurredColor += currentColor * weight * 0.2;
    }
    
    // Normalize result
    return blurredColor / (1.0 + float(samples) * 0.2);
}

// Creates time dilation effect (slowing down or speeding up)
float timeDilation(float normalTime, vec2 uv, vec2 center, float radius, float dilationFactor) {
    // Distance from dilation center
    float dist = length(uv - center);
    
    // Dilation factor varies with distance (stronger near center)
    float factor = 1.0;
    if (dist < radius) {
        // Calculate normalized distance (0 at center, 1 at radius)
        float normDist = dist / radius;
        
        // Smooth falloff for dilation factor
        factor = mix(dilationFactor, 1.0, smoothstep(0.0, 1.0, normDist));
    }
    
    // Apply time dilation
    return normalTime * factor;
}

// Creates time reversal visual effect
vec3 timeReversal(vec3 originalColor, vec2 uv, float time) {
    // Reverse color channels for visual effect
    vec3 reversedColor = originalColor.bgr;
    
    // Create reversal pulse
    float pulse = sin(time * 2.0) * 0.5 + 0.5;
    pulse = pow(pulse, 3.0); // Sharpen pulse
    
    // Add time ripple during reversal
    vec2 center = vec2(0.5, 0.5);
    float ripple = timeRipple(uv, center, -time, 2.0, 20.0) * pulse;
    
    // Mix original and reversed colors based on ripple
    vec3 result = mix(originalColor, reversedColor, pulse * 0.5);
    
    // Add glow to ripple
    result += vec3(0.1, 0.3, 0.6) * ripple * pulse;
    
    return result;
}

// Main time warp effect
vec3 applyTimeWarpEffects(vec3 originalColor, vec2 uv, float time, float intensity) {
    // Get basic time ripple effect
    float ripples = multiTimeRipples(uv, time) * intensity;
    
    // Apply time echo to UVs for sampling
    vec2 echoUV = timeEcho(uv, time, 0.02 * intensity);
    
    // Apply temporal blur
    vec3 blurredColor = temporalBlur(originalColor, uv, time, 0.01 * intensity);
    
    // Create time warp color (blue-shifted)
    vec3 timeWarpColor = originalColor + vec3(-0.1, 0.0, 0.2) * ripples;
    
    // Add bright temporal distortion at ripple peaks
    float distortionHighlight = max(0.0, ripples);
    timeWarpColor += vec3(0.1, 0.3, 0.6) * distortionHighlight;
    
    // Apply flickering effect during intense time warps
    float flicker = sin(time * 20.0) * 0.5 + 0.5;
    flicker *= pow(sin(time * 0.5) * 0.5 + 0.5, 4.0); // Only flicker occasionally
    
    // Final color
    vec3 finalColor = mix(originalColor, timeWarpColor, intensity * 0.7);
    finalColor = mix(finalColor, blurredColor, intensity * 0.3);
    finalColor *= 1.0 + flicker * intensity * 0.2; // Add flicker
    
    return finalColor;
} 