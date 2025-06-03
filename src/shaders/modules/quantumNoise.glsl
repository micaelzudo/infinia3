// Quantum Noise Module
// Advanced noise functions for quantum-like effects

// Hash function for pseudo-random generation
vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    
    return fract(sin(p) * 43758.5453123);
}

// Generates quantum noise with configurable wave function properties
float quantumWaveNoise(vec3 position, float frequency, float time, float complexity) {
    // Wave parameters vary over time to simulate quantum fluctuations
    float waveFactor1 = sin(time * 0.1) * 0.5 + 0.5;
    float waveFactor2 = cos(time * 0.2) * 0.5 + 0.5;
    float waveFactor3 = sin(time * 0.3 + cos(time * 0.5)) * 0.5 + 0.5;
    
    // Create multiple interfering wave functions
    float wave1 = sin(position.x * frequency * (1.0 + waveFactor1) + 
                      position.y * frequency * 1.3 + 
                      position.z * frequency * 0.7 + 
                      time * 0.5);
                     
    float wave2 = sin(position.x * frequency * 0.8 + 
                      position.y * frequency * (1.0 + waveFactor2) + 
                      position.z * frequency * 1.1 + 
                      time * 0.7);
                      
    float wave3 = sin(position.x * frequency * 1.2 + 
                      position.y * frequency * 0.9 + 
                      position.z * frequency * (1.0 + waveFactor3) + 
                      time * 0.3);
    
    // Apply interference pattern
    float basePattern = (wave1 + wave2 + wave3) / 3.0;
    
    // Add complexity and non-linearity (optimized for performance)
    float complexityEffect = 0.0;
    float complexityDivisor = 0.0;
    
    // Unrolled loop for better performance on some GPUs
    if(complexity >= 1.0) {
        float iterationFactor = 1.0 / complexity;
        float waveX = sin(position.x * frequency * 2.0 * iterationFactor + time * (0.2 + 0.1 * iterationFactor));
        float waveY = sin(position.y * frequency * 2.0 * iterationFactor + time * (0.3 + 0.05 * iterationFactor));
        float waveZ = sin(position.z * frequency * 2.0 * iterationFactor + time * (0.1 + 0.15 * iterationFactor));
        
        complexityEffect += (waveX + waveY + waveZ) / 3.0;
        complexityDivisor += 1.0;
    }
    
    if(complexity >= 2.0) {
        float iterationFactor = 2.0 / complexity;
        float waveX = sin(position.x * frequency * 2.0 * iterationFactor + time * (0.2 + 0.1 * iterationFactor));
        float waveY = sin(position.y * frequency * 2.0 * iterationFactor + time * (0.3 + 0.05 * iterationFactor));
        float waveZ = sin(position.z * frequency * 2.0 * iterationFactor + time * (0.1 + 0.15 * iterationFactor));
        
        complexityEffect += (waveX + waveY + waveZ) / 6.0;
        complexityDivisor += 0.5;
    }
    
    if(complexity >= 3.0) {
        float iterationFactor = 3.0 / complexity;
        float waveX = sin(position.x * frequency * 2.0 * iterationFactor + time * (0.2 + 0.1 * iterationFactor));
        float waveY = sin(position.y * frequency * 2.0 * iterationFactor + time * (0.3 + 0.05 * iterationFactor));
        float waveZ = sin(position.z * frequency * 2.0 * iterationFactor + time * (0.1 + 0.15 * iterationFactor));
        
        complexityEffect += (waveX + waveY + waveZ) / 9.0;
        complexityDivisor += 0.33;
    }
    
    if(complexityDivisor > 0.0) {
        basePattern += complexityEffect / complexityDivisor;
    }
    
    // Scale to 0-1 range
    return basePattern * 0.5 + 0.5;
}

// Simulates quantum uncertainty using noise patterns (optimized version)
float quantumUncertainty(vec3 position, float time, float scale) {
    // Small scale uncertainty effect
    float smallScaleTime = time * 2.0;
    vec3 smallScaleUncertainty = (hash33(position * 10.0 * scale + smallScaleTime) - 0.5) * 0.02;
    
    // Medium scale uncertainty effect
    float medScaleTime = time * 1.0;
    vec3 medScaleUncertainty = (hash33(position * 5.0 * scale + medScaleTime) - 0.5) * 0.05;
    
    // Large scale uncertainty effect
    float largeScaleTime = time * 0.5;
    vec3 largeScaleUncertainty = (hash33(position * 2.0 * scale + largeScaleTime) - 0.5) * 0.1;
    
    // Apply multi-scale uncertainty to position
    vec3 uncertain_pos = position + smallScaleUncertainty + medScaleUncertainty + largeScaleUncertainty;
    
    // Generate noise with uncertain position
    vec3 noiseVal = hash33(uncertain_pos * scale);
    
    // Calculate intensity based on uncertainty magnitude
    float uncertaintyMagnitude = length(smallScaleUncertainty + medScaleUncertainty + largeScaleUncertainty);
    
    // Extract final value with shifting weights
    float finalVal = noiseVal.x * (0.5 + 0.2 * sin(time * 0.3)) + 
                     noiseVal.y * (0.3 + 0.2 * cos(time * 0.4)) + 
                     noiseVal.z * (0.2 + 0.2 * sin(time * 0.5));
                     
    // Apply uncertainty magnitude as a multiplier
    return finalVal * (1.0 + uncertaintyMagnitude * 10.0);
}

// Simplified quantum probability cloud effect
float quantumProbabilityCloud(vec3 position, vec3 center, float radius, float time) {
    // Distance from the center
    float dist = length(position - center);
    
    // Normalized distance
    float normDist = min(dist / radius, 1.0);
    
    // Quantum wave function approximation (radial part)
    float radialWave = (1.0 - normDist) * exp(-normDist * 3.0);
    
    // Simplified shell model (3 shells are sufficient for most visual effects)
    float shell1 = exp(-pow((normDist - 0.25) / 0.1, 2.0));
    float shell2 = exp(-pow((normDist - 0.5) / 0.08, 2.0));
    float shell3 = exp(-pow((normDist - 0.75) / 0.05, 2.0));
    
    // Animate shells
    float animShell1 = shell1 * (0.7 + 0.3 * sin(time * 0.5));
    float animShell2 = shell2 * (0.7 + 0.3 * cos(time * 0.7));
    float animShell3 = shell3 * (0.7 + 0.3 * sin(time * 0.9));
    
    // Combine shells
    float shells = (animShell1 + animShell2 + animShell3) / 3.0;
    
    // Quick uncertainty approximation
    float uncertainty = hash33(position * 5.0 + time * 0.1).x * 0.2;
    
    // Combine all components
    float probability = radialWave * 0.3 + shells * 0.5 + uncertainty;
    
    // Apply probability threshold with smoothstep for quantum "jumps"
    return smoothstep(0.1, 0.6, probability);
}

// Quantum entanglement effect between two positions (simplified for performance)
vec2 quantumEntanglement(vec3 posA, vec3 posB, float entanglementStrength, float time) {
    // Hash values for both positions
    vec3 hashA = hash33(posA);
    vec3 hashB = hash33(posB);
    
    // Create base values
    float valueA = hashA.x;
    float valueB = hashB.x;
    
    // Apply time-based fluctuation
    float timeFactor = sin(time * 0.5) * 0.5 + 0.5;
    
    // Mix values based on entanglement strength and time
    float mixFactor = entanglementStrength * timeFactor;
    
    // When entangled, the values converge
    float entangledA = mix(valueA, (valueA + valueB) * 0.5, mixFactor);
    float entangledB = mix(valueB, (valueA + valueB) * 0.5, mixFactor);
    
    // Apply opposite phase shift to represent quantum correlation
    float phaseA = sin(time * 2.0) * mixFactor;
    float phaseB = -phaseA; // Opposite phase
    
    entangledA += phaseA * 0.1;
    entangledB += phaseB * 0.1;
    
    return vec2(entangledA, entangledB);
} 