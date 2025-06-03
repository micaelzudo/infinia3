// Particle Flux Module
// Simulates subatomic particles and quantum flux

// Generates particle cloud point distribution
float particlePoint(vec3 position, vec3 particlePos, float size) {
    float dist = length(position - particlePos);
    return smoothstep(size, size * 0.5, dist);
}

// Creates motion trail for particles
float particleTrail(vec3 position, vec3 particlePos, vec3 direction, float length, float width) {
    // Calculate position relative to particle trajectory
    vec3 relPos = position - particlePos;
    
    // Project position onto particle direction
    float projDist = dot(relPos, normalize(direction));
    
    // Check if projection is within trail length and is behind particle
    if (projDist < 0.0 && projDist > -length) {
        // Calculate perpendicular distance to trajectory line
        vec3 projPoint = particlePos + normalize(direction) * projDist;
        float perpDist = length(position - projPoint);
        
        // Trail width decreases away from particle
        float trailWidth = width * (1.0 + projDist / length);
        
        return smoothstep(trailWidth, 0.0, perpDist);
    }
    
    return 0.0;
}

// Particle system with motion
vec3 particleSystem(vec3 position, float time, vec3 color) {
    vec3 result = vec3(0.0);
    float particleCount = 15.0;
    
    // Generate multiple particles
    for (float i = 0.0; i < particleCount; i++) {
        // Seed for this particle
        float seed = i / particleCount;
        
        // Randomized particle properties
        float speed = 0.2 + seed * 0.8;
        float size = 0.01 + seed * 0.02;
        float trailLength = 0.1 + seed * 0.4;
        float brightness = 0.5 + seed * 0.5;
        
        // Unique phase offset for each particle
        float phaseOffset = seed * 100.0;
        
        // Particle trajectory - circular orbit with oscillation
        float orbitRadius = 0.3 + seed * 0.2;
        float orbitAngle = time * speed + phaseOffset;
        float verticalOsc = sin(time * 0.5 + phaseOffset) * 0.1;
        
        // Particle position
        vec3 particlePos = vec3(
            cos(orbitAngle) * orbitRadius,
            sin(orbitAngle) * orbitRadius + verticalOsc,
            sin(time * 0.3 + phaseOffset) * 0.2
        );
        
        // Particle velocity vector (for trail direction)
        vec3 particleVel = vec3(
            -sin(orbitAngle) * orbitRadius * speed,
            cos(orbitAngle) * orbitRadius * speed,
            cos(time * 0.3 + phaseOffset) * 0.2 * 0.3
        );
        
        // Calculate particle point and trail
        float point = particlePoint(position, particlePos, size);
        float trail = particleTrail(position, particlePos, particleVel, trailLength, size * 2.0);
        
        // Combine point and trail
        float particle = max(point, trail * 0.5);
        
        // Unique color variation for this particle
        vec3 particleColor = color * (0.8 + seed * 0.4);
        
        // Add particle to result
        result += particleColor * particle * brightness;
    }
    
    return result;
}

// Quantum flux field with particles appearing and disappearing
vec3 quantumFluxField(vec3 position, float time, vec3 baseColor) {
    vec3 result = vec3(0.0);
    float gridSize = 0.2;
    
    // Divide space into grid cells
    vec3 cell = floor(position / gridSize);
    
    // For each neighboring cell
    for (float i = -1.0; i <= 1.0; i++) {
        for (float j = -1.0; j <= 1.0; j++) {
            for (float k = -1.0; k <= 1.0; k++) {
                vec3 offset = vec3(i, j, k);
                vec3 neighborCell = cell + offset;
                
                // Pseudo-random number generation for this cell
                float random = fract(sin(dot(neighborCell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                
                // Time-varying probability of particle appearance
                float probability = sin(time * (0.5 + random * 0.5) + random * 10.0) * 0.5 + 0.5;
                probability = pow(probability, 4.0); // Sharpen probability curve
                
                // Only create particle if probability threshold met
                if (random < probability * 0.3) {
                    // Cell center position
                    vec3 cellCenter = (neighborCell + 0.5) * gridSize;
                    
                    // Phase lifetime for this particle (birth to death)
                    float particleLifetime = 1.0;
                    float particlePhase = fract(time * (0.2 + random * 0.3) + random);
                    
                    // Particle appears and disappears - lifecycle amplitude
                    float lifecycle = sin(particlePhase * 3.14159);
                    
                    // Particle size oscillation
                    float size = 0.01 + random * 0.02 * lifecycle;
                    
                    // Calculate particle intensity
                    float dist = length(position - cellCenter);
                    float intensity = smoothstep(size, 0.0, dist) * lifecycle;
                    
                    // Particle color variation
                    vec3 particleColor = baseColor * (0.8 + random * 0.4);
                    
                    // Add glowing particle
                    result += particleColor * intensity * 2.0;
                    
                    // Add subtle particle energy field
                    result += particleColor * intensity * 0.5 * 
                             smoothstep(size * 5.0, size, dist);
                }
            }
        }
    }
    
    return result;
} 