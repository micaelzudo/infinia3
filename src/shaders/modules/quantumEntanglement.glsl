// Quantum Entanglement Module
// Creates visual effects representing quantum entangled particles

// Entangled particle pair properties
struct EntangledPair {
    vec3 position1;
    vec3 position2;
    vec3 color;
    float phase;
    float strength;
};

// Generate entangled pair positions and properties
EntangledPair generateEntangledPair(float seed, float time) {
    EntangledPair pair;
    
    // Use seed to create pseudorandom but deterministic positions
    float angle1 = seed * 6.283 + time * 0.2;
    float angle2 = angle1 + 3.14159; // Opposite side
    
    float radius = 0.3 + seed * 0.2;
    float vertOffset = sin(time * 0.3 + seed * 10.0) * 0.1;
    
    // First particle position
    pair.position1 = vec3(
        cos(angle1) * radius,
        sin(angle1) * radius + vertOffset,
        sin(time * 0.5 + seed * 3.0) * 0.1
    );
    
    // Second particle position (entangled opposite)
    pair.position2 = vec3(
        cos(angle2) * radius,
        sin(angle2) * radius - vertOffset,
        -sin(time * 0.5 + seed * 3.0) * 0.1
    );
    
    // Shared color (quantum state)
    pair.color = vec3(
        0.5 + 0.5 * sin(seed * 5.0 + time * 0.2),
        0.5 + 0.5 * sin(seed * 7.0 + time * 0.3),
        0.5 + 0.5 * sin(seed * 11.0 + time * 0.1)
    );
    
    // Shared quantum phase
    pair.phase = time * (1.0 + seed) + seed * 10.0;
    
    // Connection strength (varies over time)
    pair.strength = 0.5 + 0.5 * sin(pair.phase * 0.5);
    
    return pair;
}

// Calculate intensity of entangled particle at given position
float entangledParticleIntensity(vec3 samplePos, vec3 particlePos, float particlePhase) {
    // Distance from particle center
    float dist = length(samplePos - particlePos);
    
    // Particle size oscillates with phase
    float size = 0.02 + 0.01 * sin(particlePhase);
    
    // Basic particle glow with soft edge
    float intensity = smoothstep(size, 0.0, dist);
    
    // Add quantum probability ripples
    float ripples = sin(dist * 50.0 - particlePhase * 2.0) * 0.5 + 0.5;
    ripples *= 1.0 / (1.0 + dist * 20.0); // Distance falloff
    
    // Combine core and ripples
    return intensity * 0.8 + ripples * 0.2;
}

// Calculate entanglement connection beam between particles
float entanglementBeam(vec3 samplePos, vec3 pos1, vec3 pos2, float phase, float strength) {
    // Vector between the two particles
    vec3 connection = pos2 - pos1;
    vec3 connectionDir = normalize(connection);
    float connectionLength = length(connection);
    
    // Vector from first particle to sample position
    vec3 sampleOffset = samplePos - pos1;
    
    // Project sample position onto connection line
    float projection = dot(sampleOffset, connectionDir);
    
    // Check if projection is within line segment
    if (projection >= 0.0 && projection <= connectionLength) {
        // Calculate closest point on connection line
        vec3 closestPoint = pos1 + connectionDir * projection;
        
        // Distance from sample to connection line
        float dist = length(samplePos - closestPoint);
        
        // Beam width varies with phase and along length
        float normProj = projection / connectionLength; // 0-1 along beam
        float beamPhase = phase + normProj * 3.14159 * 4.0; // Phase varies along beam
        float beamWidth = 0.005 + 0.003 * sin(beamPhase) * strength;
        
        // Beam intensity with quantum oscillation
        float beamIntensity = smoothstep(beamWidth, 0.0, dist);
        beamIntensity *= strength; // Apply connection strength
        beamIntensity *= (sin(normProj * 3.14159 * 10.0 + phase * 3.0) * 0.3 + 0.7); // Quantum pulses along beam
        
        return beamIntensity;
    }
    
    return 0.0;
}

// Quantum spin visualization
float quantumSpinMarker(vec3 samplePos, vec3 particlePos, vec3 spinAxis, float phase) {
    // Distance from particle center
    float dist = length(samplePos - particlePos);
    
    // Only show spin marker within certain radius
    if (dist > 0.05) return 0.0;
    
    // Calculate rotation around particle based on phase
    float angle = phase * 5.0;
    
    // Create rotation matrix around spin axis
    mat3 rotMat;
    float c = cos(angle);
    float s = sin(angle);
    float t = 1.0 - c;
    float x = spinAxis.x;
    float y = spinAxis.y;
    float z = spinAxis.z;
    
    rotMat[0] = vec3(t*x*x + c, t*x*y - s*z, t*x*z + s*y);
    rotMat[1] = vec3(t*x*y + s*z, t*y*y + c, t*y*z - s*x);
    rotMat[2] = vec3(t*x*z - s*y, t*y*z + s*x, t*z*z + c);
    
    // Reference direction for spin marker
    vec3 refDir = normalize(vec3(0.0, 1.0, 0.0));
    
    // Rotated marker direction
    vec3 markerDir = rotMat * refDir;
    
    // Calculate marker position (small displaced sphere)
    vec3 markerPos = particlePos + markerDir * 0.03;
    
    // Distance to marker
    float markerDist = length(samplePos - markerPos);
    
    // Marker intensity (small sphere)
    return smoothstep(0.01, 0.0, markerDist);
}

// Main function to visualize quantum entanglement
vec3 quantumEntanglementEffect(vec3 samplePos, float time, int numPairs) {
    vec3 result = vec3(0.0);
    
    // Create multiple entangled pairs
    for (int i = 0; i < numPairs; i++) {
        float seed = float(i) / float(numPairs);
        
        EntangledPair pair = generateEntangledPair(seed, time);
        
        // Quantum spin axis (shared between pair due to entanglement)
        vec3 spinAxis = normalize(vec3(
            sin(pair.phase * 0.7),
            cos(pair.phase * 0.7),
            sin(pair.phase * 0.3)
        ));
        
        // Calculate particles intensity at sample position
        float intensity1 = entangledParticleIntensity(samplePos, pair.position1, pair.phase);
        float intensity2 = entangledParticleIntensity(samplePos, pair.position2, pair.phase);
        
        // Calculate entanglement beam
        float beam = entanglementBeam(samplePos, pair.position1, pair.position2, pair.phase, pair.strength);
        
        // Calculate spin markers
        float spin1 = quantumSpinMarker(samplePos, pair.position1, spinAxis, pair.phase);
        float spin2 = quantumSpinMarker(samplePos, pair.position2, -spinAxis, pair.phase); // Opposite spin
        
        // Combine all elements with pair color
        vec3 particleEffect = pair.color * (intensity1 + intensity2);
        vec3 beamEffect = mix(pair.color, vec3(1.0), 0.5) * beam;
        vec3 spinEffect = vec3(1.0) * (spin1 + spin2); // White spin markers
        
        // Add to result
        result += particleEffect + beamEffect + spinEffect;
    }
    
    return result;
}

// Creates a field of quantum foam (vacuum fluctuations)
vec3 quantumFoamField(vec3 position, float time, vec3 baseColor) {
    // Divide space into small cells for quantum foam
    float cellSize = 0.05;
    vec3 cellPos = floor(position / cellSize);
    
    // Quantum foam color
    vec3 foamColor = baseColor * 0.7 + vec3(0.3);
    
    // Result accumulation
    vec3 result = vec3(0.0);
    float totalWeight = 0.0;
    
    // Check neighboring cells for foam particles
    for (float i = -1.0; i <= 1.0; i += 1.0) {
        for (float j = -1.0; j <= 1.0; j += 1.0) {
            for (float k = -1.0; k <= 1.0; k += 1.0) {
                vec3 offset = vec3(i, j, k);
                vec3 neighborCell = cellPos + offset;
                
                // Random value for this cell
                float rand = fract(sin(dot(neighborCell, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
                
                // Quantum probability for particle to appear (time-dependent)
                float probability = sin(time + rand * 10.0) * 0.5 + 0.5;
                probability = pow(probability, 8.0); // Make appearance more discrete
                
                if (rand < probability * 0.3) {
                    // Cell center with small random offset
                    vec3 particlePos = (neighborCell + 0.5 + (vec3(
                        sin(time * 3.0 + rand * 20.0),
                        cos(time * 2.5 + rand * 15.0),
                        sin(time * 2.0 + rand * 10.0)
                    ) * 0.2)) * cellSize;
                    
                    // Particle lifetime
                    float lifetime = fract(time * 0.5 + rand);
                    float lifeIntensity = sin(lifetime * 3.14159);
                    
                    // Distance to particle
                    float dist = length(position - particlePos);
                    
                    // Particle size based on lifetime (appears and disappears)
                    float size = 0.01 * lifeIntensity;
                    
                    // Calculate particle intensity with quantum fluctuation
                    float intensity = smoothstep(size, 0.0, dist);
                    intensity *= lifeIntensity;
                    
                    // Weight based on distance and intensity
                    float weight = intensity * (1.0 - dist / cellSize);
                    
                    // Add to result
                    result += foamColor * weight;
                    totalWeight += weight;
                }
            }
        }
    }
    
    // Normalize and return
    if (totalWeight > 0.0) {
        return result / totalWeight;
    }
    return vec3(0.0);
} 