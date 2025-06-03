// Hyperspace Lanes Module
// Creates high-speed lane effects for quantum travel

/**
 * Creates streaking lines that give the effect of hyperspace travel
 * @param position Current fragment position in world space
 * @param viewPosition The camera position
 * @param direction The viewing direction
 * @param time The current time for animation
 * @param intensity The effect intensity
 * @return The streaking line effect
 */
float hyperspaceStreaks(vec3 position, vec3 viewPosition, vec3 direction, float time, float intensity) {
    // Calculate direction from view to position
    vec3 viewToPos = normalize(position - viewPosition);
    
    // Project onto viewing direction to get forward distance
    float forwardDist = dot(viewToPos, direction);
    
    // Calculate perpendicular distance from view line
    vec3 perp = viewToPos - direction * forwardDist;
    float perpDist = length(perp);
    
    // Hyperspace angle (how aligned fragment is with direction of travel)
    float alignment = 1.0 - perpDist;
    alignment = pow(max(0.0, alignment), 4.0); // Sharpen the effect
    
    // Create streaking effect
    float streak = 0.0;
    
    // Multiple frequencies for varied streaks
    for (int i = 0; i < 3; i++) {
        float speed = 2.0 + float(i) * 3.0;
        float scale = 5.0 + float(i) * 10.0;
        float streakPhase = mod(time * speed + position.z * 0.1, 20.0) / 20.0;
        streak += smoothstep(0.95, 1.0, streakPhase) * (1.0 - streakPhase) * scale;
    }
    
    return streak * alignment * intensity;
}

/**
 * Creates a hyperspace tunnel border effect
 * @param position Current position
 * @param time Current time
 * @param intensity Effect intensity
 * @return The border effect color
 */
vec3 hyperspaceBorder(vec3 position, float time, float intensity) {
    // Calculate radius and angle in cylinder space
    float radius = length(position.xy);
    float angle = atan(position.y, position.x);
    
    // Create border pattern
    float pattern = sin(angle * 20.0 + time * 2.0) * 0.5 + 0.5;
    pattern *= sin(position.z * 0.1 + time) * 0.5 + 0.5;
    
    // Intensify pattern near edge of tunnel
    float edgeFactor = smoothstep(40.0, 48.0, radius);
    pattern *= edgeFactor * intensity;
    
    // Create color gradient
    vec3 color = mix(
        vec3(0.2, 0.4, 1.0), // Blue
        vec3(0.7, 0.2, 1.0), // Purple
        pattern
    );
    
    return color * pattern * intensity;
}

/**
 * Creates hyperspace particles
 * @param position Current position
 * @param time Current time
 * @param seed Random seed
 * @return Particle color
 */
vec3 hyperspaceParticles(vec3 position, float time, float seed) {
    // Create stream of particles
    vec3 particlePos = vec3(
        position.x * 0.1,
        position.y * 0.1,
        position.z * 0.05 + time * 2.0
    );
    
    // Create particle hash
    vec3 id = floor(particlePos) + seed;
    float hash = fract(sin(dot(id, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    
    // Only render some particles based on hash
    if (hash > 0.97) {
        // Particle appearance
        vec3 localPos = fract(particlePos) - 0.5;
        float dist = length(localPos.xy);
        
        // Streaking effect based on z velocity
        float falloff = smoothstep(0.05, 0.0, dist);
        float streakZ = smoothstep(0.0, -0.4, localPos.z) * falloff;
        
        // Color varies with position and time
        vec3 particleColor = mix(
            vec3(0.5, 0.7, 1.0), // Blue
            vec3(1.0, 0.6, 0.2), // Orange
            hash
        );
        
        return particleColor * streakZ * 2.0;
    }
    
    return vec3(0.0);
}

/**
 * Applies all hyperspace effects
 * @param baseColor The base color to enhance
 * @param position Current world position
 * @param viewPosition Camera/view position
 * @param time Current time
 * @param intensity Overall effect intensity
 * @return Enhanced color with hyperspace effects
 */
vec3 applyHyperspaceEffects(vec3 baseColor, vec3 position, vec3 viewPosition, float time, float intensity) {
    // Define travel direction (usually the tunnel direction)
    vec3 direction = normalize(vec3(0.0, 0.0, -1.0));
    
    // Apply streaking effect
    float streaks = hyperspaceStreaks(position, viewPosition, direction, time, intensity);
    vec3 streakColor = vec3(0.7, 0.8, 1.0) * streaks;
    
    // Add particles
    vec3 particles = hyperspaceParticles(position, time, fract(time * 0.1));
    
    // Add tunnel border effect
    vec3 borderEffect = hyperspaceBorder(position, time, intensity * 0.7);
    
    // Combine all effects
    vec3 finalColor = baseColor;
    finalColor += streakColor * intensity;
    finalColor += particles * intensity * 0.8;
    finalColor += borderEffect;
    
    // Add blue shift based on intensity
    finalColor = mix(finalColor, finalColor * vec3(0.8, 0.9, 1.1), intensity * 0.3);
    
    return finalColor;
} 