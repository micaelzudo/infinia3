// Ethereal Glow Module
// Advanced glow, bloom, and ethereal light effects

// Simplified pointGlow that matches usage in tunnel.frag
float pointGlow(vec3 samplePos, vec3 glowCenter, float radius) {
    float dist = length(samplePos - glowCenter);
    float normalizedDist = dist / radius;
    
    // Hard cutoff at radius
    if (normalizedDist > 1.0) return 0.0;
    
    // Apply falloff (using default power of 2.0)
    float falloff = pow(1.0 - normalizedDist, 2.0);
    
    // Use default intensity of 1.0
    return falloff;
}

// Simplified volumetricLightRays that matches usage in tunnel.frag
float volumetricLightRays(vec3 samplePos, vec3 lightPos, vec3 direction, float radius, float density) {
    // Calculate synthetic view position based on light position and direction
    vec3 viewPos = lightPos - direction * radius;
    
    // Direction from view position to sample position
    vec3 viewToSample = normalize(samplePos - viewPos);
    
    // Direction from view position to light position
    vec3 viewToLight = normalize(lightPos - viewPos);
    
    // Angle between the two directions
    float angle = dot(viewToSample, viewToLight);
    
    // Higher values for when directions align
    float angleContribution = pow(max(0.0, angle), 32.0);
    
    // Distance from sample to light ray (line from view to light)
    float t = dot(samplePos - viewPos, viewToLight) / dot(viewToLight, viewToLight);
    t = clamp(t, 0.0, 1.0);
    vec3 closestPoint = viewPos + viewToLight * t;
    float rayDist = length(samplePos - closestPoint);
    
    // Default ray thickness
    float rayThickness = mix(0.5, 0.1, t);
    
    // Ray intensity based on distance
    float rayIntensity = smoothstep(rayThickness, 0.0, rayDist);
    
    // Multiply by angle contribution
    rayIntensity *= angleContribution;
    
    // Apply distance falloff
    float distanceFalloff = 1.0 / (1.0 + pow(rayDist * 2.0, 2.0));
    
    // Apply density modulation
    rayIntensity *= density;
    
    return rayIntensity * distanceFalloff;
}

// Simplified pulsingGlow that matches usage in tunnel.frag
float pulsingGlow(vec3 position, float time, float speed, float intensity) {
    // Create a position-dependent phase shift for the pulse
    float phaseShift = dot(position, vec3(0.1, 0.2, 0.3));
    
    // Create pulse effect
    float pulse = 0.5 + 0.5 * sin(time * speed + phaseShift);
    
    // Apply intensity
    return pulse * intensity;
}

// Keep function signatures for the original functions as well so both can be used
// Calculates a soft glow effect around a point (original full version)
float pointGlowFull(vec3 samplePos, vec3 glowCenter, float radius, float intensity, float falloffPower) {
    float dist = length(samplePos - glowCenter);
    float normalizedDist = dist / radius;
    
    // Hard cutoff at radius
    if (normalizedDist > 1.0) return 0.0;
    
    // Apply falloff
    float falloff = pow(1.0 - normalizedDist, falloffPower);
    
    return falloff * intensity;
}

// Add version of applyEtherealGlowEffects that matches usage in tunnel.frag
vec3 applyEtherealGlowEffects(vec3 baseColor, vec3 glowColors, float glowIntensity) {
    // Apply base glow by simply adding glow colors scaled by intensity
    return baseColor + glowColors * glowIntensity;
}

// Creates a soft bloom effect by sampling surrounding area
vec3 softBloom(vec3 baseColor, float intensity, float threshold) {
    // Approximate brightness using luminance calculation
    float luminance = dot(baseColor, vec3(0.299, 0.587, 0.114));
    
    // Apply threshold
    float brightPass = max(0.0, luminance - threshold);
    
    // Apply bloom intensity
    vec3 bloom = baseColor * brightPass * intensity;
    
    return bloom;
}

// Creates a wispy ethereal effect using multiple oscillating waves
vec3 etherealWisps(vec3 position, float time, vec3 baseColor, float intensity) {
    // Create multiple wisp layers with different frequencies and speeds
    float wisp1 = sin(position.x * 3.0 + position.y * 2.0 + position.z * 1.5 + time * 0.7);
    float wisp2 = sin(position.x * 1.7 + position.y * 3.2 + position.z * 2.3 + time * 1.3);
    float wisp3 = sin(position.x * 2.5 + position.y * 1.8 + position.z * 3.1 + time * 1.9);
    
    // Combine wisp layers
    float wispCombined = (wisp1 + wisp2 + wisp3) / 3.0;
    
    // Apply threshold to create more defined wisps
    wispCombined = smoothstep(0.1, 0.7, wispCombined);
    
    // Apply falloff based on distance from center
    float distFromCenter = length(position);
    float falloff = 1.0 / (1.0 + distFromCenter * distFromCenter * 2.0);
    
    // Create color variation
    vec3 wispColor1 = vec3(0.6, 0.8, 1.0); // Blue-white
    vec3 wispColor2 = vec3(0.8, 0.7, 1.0); // Purple-white
    vec3 wispColor = mix(wispColor1, wispColor2, sin(time * 0.5) * 0.5 + 0.5);
    
    // Mix with base color
    wispColor = mix(baseColor, wispColor, 0.7);
    
    return wispColor * wispCombined * falloff * intensity;
}

// Creates aura patterns with rippling effect
vec3 energyAura(vec3 position, vec3 center, float radius, vec3 auraColor, float time, float intensity) {
    // Distance from center
    float dist = length(position - center);
    
    // Normalized distance
    float normDist = dist / radius;
    if (normDist > 1.0) return vec3(0.0);
    
    // Create rippling aura effect
    float ripple1 = sin(normDist * 20.0 - time * 2.0) * 0.5 + 0.5;
    float ripple2 = sin(normDist * 15.0 - time * 1.5) * 0.5 + 0.5;
    float ripple3 = sin(normDist * 10.0 - time * 1.0) * 0.5 + 0.5;
    
    // Combine ripples with different weights
    float rippleCombined = ripple1 * 0.5 + ripple2 * 0.3 + ripple3 * 0.2;
    
    // Edge highlight effect
    float edge = smoothstep(0.8, 1.0, normDist);
    
    // Combine effects
    float auraPattern = rippleCombined * (1.0 - normDist) + edge * 2.0;
    
    // Apply falloff
    float falloff = pow(1.0 - normDist, 2.0);
    
    // Apply color
    return auraColor * auraPattern * falloff * intensity;
}

// Creates an ethereal shimmer effect
float etherealShimmer(vec3 position, float time, float speed, float scale) {
    // Create multiple noise patterns at different frequencies
    float noise1 = sin(position.x * 5.0 * scale + position.y * 3.0 * scale + position.z * 4.0 * scale + time * 2.0 * speed);
    float noise2 = sin(position.x * 7.0 * scale + position.y * 9.0 * scale + position.z * 8.0 * scale + time * 3.0 * speed);
    float noise3 = sin(position.x * 11.0 * scale + position.y * 13.0 * scale + position.z * 7.0 * scale + time * 4.0 * speed);
    
    // Combine noise patterns
    float combinedNoise = (noise1 + noise2 + noise3) / 3.0;
    
    // Apply threshold for more pronounced effect
    float shimmer = smoothstep(0.2, 0.8, combinedNoise);
    
    return shimmer;
}

// Ethereal dimension portal glow effect
vec3 portalGlow(vec3 position, vec3 portalCenter, vec3 portalNormal, float portalRadius, float time, vec3 baseColor) {
    // Vector from portal center to position
    vec3 toPos = position - portalCenter;
    
    // Project onto portal plane
    float distAlongNormal = dot(toPos, portalNormal);
    vec3 projOnPlane = toPos - distAlongNormal * portalNormal;
    
    // Distance from portal center in the plane
    float planeDist = length(projOnPlane);
    
    // Normalized distance to radius
    float normDist = planeDist / portalRadius;
    
    // Distance from portal plane
    float planeProximity = 1.0 / (1.0 + abs(distAlongNormal) * 5.0);
    
    // Ring patterns
    float ring1 = 0.5 + 0.5 * sin(normDist * 20.0 - time * 1.5);
    float ring2 = 0.5 + 0.5 * sin(normDist * 15.0 - time * 1.0);
    float ring3 = 0.5 + 0.5 * sin(normDist * 10.0 - time * 0.5);
    
    // Combine rings
    float rings = max(max(ring1, ring2), ring3);
    
    // Edge effect
    float edge = smoothstep(0.9, 1.0, normDist) * 3.0;
    
    // Center glow
    float centerGlow = 1.0 / (1.0 + planeDist * planeDist * 10.0);
    
    // Combine effects
    float portalEffect = (rings * 0.7 + edge + centerGlow) * planeProximity;
    
    // Limit effect to portal vicinity
    if (normDist > 1.2 || abs(distAlongNormal) > portalRadius * 0.5) 
        portalEffect *= 0.1;
    
    // Color modulation - inner to outer
    vec3 innerColor = vec3(0.9, 0.7, 1.0); // Purple-white
    vec3 outerColor = vec3(0.5, 0.0, 1.0); // Deep purple
    vec3 portalColor = mix(innerColor, outerColor, normDist);
    
    // Final portal glow
    vec3 glowColor = mix(baseColor, portalColor, 0.8) * portalEffect;
    
    return glowColor;
}

// Apply ethereal glow effects
vec3 applyEtherealGlowEffects(vec3 originalColor, vec3 position, vec3 viewPos, vec3 lightPos, float time, float intensity) {
    // Base glow parameters
    float glowRadius = 10.0;
    float glowFalloff = 2.0;
    float glowDensity = 0.5 * intensity;
    
    // Calculate base glow
    float baseGlowIntensity = pointGlow(position, lightPos, glowRadius);
    
    // Calculate volumetric light rays
    float rayIntensity = volumetricLightRays(position, lightPos, position - viewPos, glowRadius, glowDensity);
    
    // Calculate ethereal wisps
    vec3 wisps = etherealWisps(position, time, originalColor, 0.7 * intensity);
    
    // Calculate shimmer
    float shimmer = etherealShimmer(position, time, 1.0, 0.5) * 0.3 * intensity;
    
    // Calculate soft bloom
    vec3 bloom = softBloom(originalColor, 1.5 * intensity, 0.3);
    
    // Combine all effects
    vec3 baseGlow = mix(originalColor, vec3(0.8, 0.9, 1.0), baseGlowIntensity);
    vec3 withRays = mix(baseGlow, vec3(1.0), rayIntensity * 0.7);
    vec3 withShimmer = mix(withRays, vec3(1.0, 0.9, 0.8), shimmer);
    vec3 withWisps = withShimmer + wisps;
    vec3 finalColor = withWisps + bloom;
    
    // Apply overall intensity
    finalColor = mix(originalColor, finalColor, intensity);
    
    return finalColor;
} 