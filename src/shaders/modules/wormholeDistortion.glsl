// Wormhole Distortion Module
// Simulates spatial distortion in a wormhole

// Creates gravitational lensing effect
vec2 gravitationalLensing(vec2 uv, vec2 center, float strength, float radius) {
    vec2 delta = uv - center;
    float dist = length(delta);
    
    // Calculate gravitational distortion factor
    float factor = 1.0;
    if (dist < radius) {
        // Einstein ring effect near event horizon
        float normalizedDist = dist / radius;
        float gravityWell = 1.0 - normalizedDist;
        factor = mix(1.0, 1.0 + strength, pow(gravityWell, 2.0));
    }
    
    // Apply distortion
    return center + delta / factor;
}

// Simulates space-time curvature effect
vec3 spacetimeCurvature(vec3 position, float time, float curvatureStrength) {
    // Calculate distortion direction based on position
    float distFromCenter = length(position.xy);
    vec3 curvatureDirection = normalize(vec3(-position.y, position.x, 0.0));
    
    // Wormhole swirl motion
    float swirl = sin(time * 0.2 + distFromCenter * 0.5) * curvatureStrength;
    
    // Apply rotational curve to simulate space-time distortion
    mat3 curvatureMatrix = mat3(
        cos(swirl), -sin(swirl), 0.0,
        sin(swirl), cos(swirl), 0.0,
        0.0, 0.0, 1.0
    );
    
    return curvatureMatrix * position;
}

// Generates event horizon glow effect
vec3 eventHorizonGlow(vec3 position, float time, vec3 viewPos) {
    // Distance from center of wormhole
    float dist = length(position.xy);
    
    // Calculate view angle for fresnel-like effect
    vec3 viewDir = normalize(viewPos - position);
    float viewAngle = abs(dot(normalize(position), viewDir));
    
    // Pulsating event horizon effect
    float pulseSpeed = 0.5;
    float pulseFreq = 0.7;
    float pulseFactor = sin(time * pulseSpeed) * 0.5 + 0.5;
    
    // Horizon thickness
    float horizonEdge = 0.9 - pulseFactor * 0.1;
    float horizonWidth = 0.05 + pulseFactor * 0.03;
    
    // Calculate event horizon glow
    float normDist = smoothstep(horizonEdge - horizonWidth, horizonEdge, dist) * 
                     (1.0 - smoothstep(horizonEdge, horizonEdge + horizonWidth, dist));
    
    // Apply view angle to glow (stronger when viewed from side)
    normDist *= pow(1.0 - viewAngle, 2.0);
    
    // Event horizon color with time variation
    vec3 horizonColor = mix(
        vec3(0.2, 0.6, 1.0), // Blue core
        vec3(1.0, 0.4, 0.9), // Pink edge
        sin(time * 0.3) * 0.5 + 0.5
    );
    
    // Add high energy flashes along the horizon
    float energyFlash = pow(sin(dist * 20.0 + time * 3.0) * 0.5 + 0.5, 3.0);
    horizonColor += vec3(1.0, 1.0, 1.0) * energyFlash * 0.5 * normDist;
    
    return horizonColor * normDist * 1.5;
}

// Creates wormhole throat distortion effect
vec3 wormholeThroatEffect(vec3 position, float time, float throatRadius) {
    // Distance from wormhole center
    float dist = length(position.xy) / throatRadius;
    
    // Calculate throat distortion factor (increases toward center)
    float throatDistortion = clamp(1.0 - dist, 0.0, 1.0);
    throatDistortion = pow(throatDistortion, 2.0);
    
    // Time-based pulsing throat
    float throatPulse = sin(time * 0.3) * 0.1 + 0.9;
    
    // Create a funnel-like distortion in z-direction
    vec3 distortedPos = position;
    distortedPos.z -= throatDistortion * 5.0 * throatPulse;
    
    return distortedPos;
} 