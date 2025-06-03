// Planet Terrains Module
// Advanced procedural terrain generation for planets

// Constants for terrain types matching PlanetTerrainType enum
const int TERRAIN_DEFAULT = 0;
const int TERRAIN_MOUNTAINOUS = 1;
const int TERRAIN_CAVERNOUS = 2;
const int TERRAIN_FLOATING = 3;
const int TERRAIN_CRYSTALLINE = 4;
const int TERRAIN_DESERT = 5;
const int TERRAIN_OCEANIC = 6;
const int TERRAIN_VOLCANIC = 7;
const int TERRAIN_ALIEN = 8;

// Structure to hold terrain configuration parameters
struct TerrainConfig {
    int terrainType;
    float baseFrequency;
    float amplitude;
    int octaves;
    float persistence;
    float lacunarity;
    float ridgeThreshold;
    float warpStrength;
    float seaLevel;
    float erosion;
    float craterDensity;
    float gravity;
};

// Forward declare functions
float sampleTerrain(vec3 position, TerrainConfig config, float time);
float ridgedNoise(vec3 position, float frequency, int octaves, float persistence, float lacunarity, float threshold);
float warpedNoise(vec3 position, float frequency, int octaves, float persistence, float lacunarity, float warpStrength);
float fbm(vec3 position, float frequency, int octaves, float persistence, float lacunarity);
float craterField(vec3 position, float density, float frequency);

// Main terrain density function that dispatches to specific terrain type functions
float sampleTerrain(vec3 position, TerrainConfig config, float time) {
    // Base density starts at 0 (empty space)
    float density = 0.0;
    
    // Normalize position for sphere
    vec3 normalizedPos = normalize(position);
    float distFromCenter = length(position);
    
    // Apply time-based animation for subtle movement if needed
    float animationFactor = sin(time * 0.05) * 0.02; // Very subtle
    
    // Dispatch to appropriate terrain type
    switch(config.terrainType) {
        case TERRAIN_DEFAULT:
            // Simple smooth terrain with some variation
            density = distFromCenter - 1.0 + fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity) * config.amplitude;
            break;
            
        case TERRAIN_MOUNTAINOUS:
            // Steep ridged mountains
            density = distFromCenter - 1.0 + ridgedNoise(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity, config.ridgeThreshold) * config.amplitude * 1.5;
            break;
            
        case TERRAIN_CAVERNOUS:
            // Terrain with tunnels and caves
            float base = distFromCenter - 1.0;
            float caves = warpedNoise(normalizedPos, config.baseFrequency * 2.0, config.octaves, config.persistence, config.lacunarity, config.warpStrength);
            float caveThreshold = 0.4;
            density = base + fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity) * config.amplitude;
            // Carve caves where noise is below threshold
            if (caves < caveThreshold && distFromCenter < 1.05) {
                density -= (caveThreshold - caves) * 2.0;
            }
            break;
            
        case TERRAIN_FLOATING:
            // Islands floating above the surface
            float baseTerrain = distFromCenter - 1.0 + fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity) * config.amplitude * 0.5;
            float islands = fbm(normalizedPos * 2.0, config.baseFrequency * 3.0, config.octaves, config.persistence, config.lacunarity);
            
            // Create floating effect (sharp cutoff in vertical direction)
            float verticalFactor = normalizedPos.y * 0.5 + 0.5; // 0 to 1 from bottom to top
            float floatHeight = 0.15 + islands * 0.1;
            float islandStrength = smoothstep(0.5 - floatHeight, 0.5 + floatHeight, islands);
            
            // Combine effects
            density = baseTerrain;
            if (islands > 0.5 && distFromCenter > 1.0 && distFromCenter < 1.3) {
                density += islandStrength * (1.0 - smoothstep(1.05, 1.2, distFromCenter));
            }
            break;
            
        case TERRAIN_CRYSTALLINE:
            // Sharp crystalline formations
            // Use high-frequency noise with little smoothing
            float crystal = fbm(normalizedPos * 3.0, config.baseFrequency * 2.0, 2, 0.8, 2.5);
            float sharpness = pow(crystal, 3.0) * 3.0; // Sharpen the noise
            
            // Base terrain with sharp crystalline features
            density = distFromCenter - 1.0 + fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity) * config.amplitude * 0.3;
            
            // Add crystal formations where noise is high
            if (crystal > 0.6) {
                density += sharpness * 0.3;
            }
            break;
            
        case TERRAIN_DESERT:
            // Smooth dunes with occasional rock formations
            float dunes = fbm(normalizedPos, config.baseFrequency * 0.5, config.octaves, config.persistence, config.lacunarity);
            float rockformations = fbm(normalizedPos * 4.0, config.baseFrequency * 3.0, config.octaves, config.persistence, config.lacunarity);
            
            // Smooth base with dune patterns
            density = distFromCenter - 1.0 + dunes * config.amplitude * 0.7;
            
            // Add occasional rock formations
            if (rockformations > 0.7) {
                density += (rockformations - 0.7) * 2.0 * config.amplitude;
            }
            
            // Add crater impacts for desert planets
            density -= craterField(normalizedPos, config.craterDensity, config.baseFrequency * 8.0) * 0.2;
            break;
            
        case TERRAIN_OCEANIC:
            // Mostly flat with ocean, archipelagos, and underwater features
            float landmass = fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity);
            
            // Create base terrain with sea level
            density = distFromCenter - 1.0 + landmass * config.amplitude;
            
            // Apply sea level cutoff (smoother transition at shorelines)
            if (landmass < config.seaLevel) {
                // Underwater area - smoother with less detail
                density = density - (config.seaLevel - landmass) * 0.2;
                
                // Add underwater ridges and trenches
                float underwaterFeatures = fbm(normalizedPos * 2.0, config.baseFrequency * 3.0, config.octaves - 1, config.persistence, config.lacunarity);
                density += (underwaterFeatures - 0.5) * 0.1;
            }
            break;
            
        case TERRAIN_VOLCANIC:
            // Rough terrain with volcanic cones and lava flows
            float baseLand = fbm(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity);
            float volcanoes = ridgedNoise(normalizedPos, config.baseFrequency * 2.0, config.octaves, config.persistence, config.lacunarity, 0.7);
            
            // Base terrain
            density = distFromCenter - 1.0 + baseLand * config.amplitude * 0.5;
            
            // Add volcanic peaks
            if (volcanoes > 0.7) {
                density += pow((volcanoes - 0.7) * 3.33, 2.0) * config.amplitude;
            }
            
            // Add lava flow channels (negative density to carve them)
            float lavaChannels = fbm(normalizedPos * 5.0, config.baseFrequency * 4.0, config.octaves, config.persistence, config.lacunarity);
            if (lavaChannels < 0.3 && baseLand > 0.4) {
                density -= (0.3 - lavaChannels) * 0.5;
            }
            break;
            
        case TERRAIN_ALIEN:
            // Strange otherworldly formations unlike Earth terrains
            // Use domain warping for truly alien landscapes
            vec3 warpedPos = normalizedPos + vec3(
                sin(normalizedPos.z * 4.0 + time * 0.1) * 0.2,
                sin(normalizedPos.x * 4.0 + time * 0.15) * 0.2,
                sin(normalizedPos.y * 4.0 + time * 0.12) * 0.2
            );
            
            float alienBase = warpedNoise(normalizedPos, config.baseFrequency, config.octaves, config.persistence, config.lacunarity, config.warpStrength * 2.0);
            float tentacles = ridgedNoise(warpedPos * 2.0, config.baseFrequency * 3.0, config.octaves, config.persistence + 0.3, config.lacunarity, 0.8);
            
            // Create bizarre base formations
            density = distFromCenter - 1.0 + alienBase * config.amplitude;
            
            // Add tentacle/spire-like formations 
            if (tentacles > 0.75) {
                density += pow((tentacles - 0.75) * 4.0, 2.0) * config.amplitude * 1.2;
            }
            
            // Add weird bubble clusters
            float bubbles = fbm(warpedPos * 8.0, config.baseFrequency * 5.0, 3, 0.7, 2.0);
            if (bubbles > 0.7 && distFromCenter < 1.1) {
                density -= (bubbles - 0.7) * 0.5;
            }
            break;
    }
    
    // Apply global erosion to all terrain types
    if (config.erosion > 0.0) {
        float erosionNoise = fbm(normalizedPos * 10.0, config.baseFrequency * 5.0, 3, 0.5, 2.0);
        density -= erosionNoise * config.erosion;
    }
    
    // Apply gravity-based height adjustment (higher gravity = flatter terrain)
    if (config.gravity > 1.0) {
        float heightFactor = max(0.0, density - (distFromCenter - 1.0));
        density -= heightFactor * (config.gravity - 1.0) * 0.3;
    }
    
    return density;
}

// Ridged multifractal noise - creates ridge-like features
float ridgedNoise(vec3 position, float frequency, int octaves, float persistence, float lacunarity, float threshold) {
    float result = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    float prevValue = 1.0;
    
    for(int i = 0; i < octaves; i++) {
        vec3 p = position * frequency;
        
        // Get noise value
        float n = 1.0 - abs(snoise(p) * 2.0 - 1.0); // Transform to 0-1 ridge pattern
        
        // Apply threshold to sharpen ridges
        n = pow(n, threshold > 0.0 ? 1.0 + threshold * 3.0 : 1.0);
        
        // Add detail in valleys
        float weight = mix(1.0, min(n, prevValue) * 2.0, 0.35);
        n *= weight;
        prevValue = n;
        
        // Apply amplitude and accumulate
        result += n * amplitude;
        maxValue += amplitude;
        
        // Update amplitude and frequency for next octave
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    // Normalize the result
    return result / maxValue;
}

// Domain warped noise for more natural, twisted formations
float warpedNoise(vec3 position, float frequency, int octaves, float persistence, float lacunarity, float warpStrength) {
    // First layer of noise to define the warp
    vec3 warp = vec3(
        snoise(position * frequency),
        snoise(position * frequency + vec3(123.45, 678.9, 234.5)),
        snoise(position * frequency + vec3(876.54, 321.0, 765.4))
    );
    
    // Apply warp
    vec3 warped = position + warp * warpStrength / frequency;
    
    // Apply FBM to warped position
    return fbm(warped, frequency, octaves, persistence, lacunarity);
}

// Standard FBM (fractal Brownian motion) noise
float fbm(vec3 position, float frequency, int octaves, float persistence, float lacunarity) {
    float result = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for(int i = 0; i < octaves; i++) {
        vec3 p = position * frequency;
        
        // Add scaled noise to result
        result += snoise(p) * amplitude;
        
        // Keep track of max possible value
        maxValue += amplitude;
        
        // Update for next octave
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    // Normalize the result
    return result / maxValue;
}

// Creates realistic impact craters
float craterField(vec3 position, float density, float frequency) {
    if (density <= 0.0) return 0.0;
    
    // Scale density to a reasonable number of craters
    float scaledDensity = density * 5.0;
    
    // Use noise to determine crater locations
    float craterNoise = fbm(position, frequency, 3, 0.5, 2.0);
    
    // Only place craters where noise is above threshold based on density
    if (craterNoise < (1.0 - scaledDensity * 0.2)) {
        return 0.0;
    }
    
    // Additional noise to vary crater depths
    float depthVariation = snoise(position * frequency * 2.0) * 0.5 + 0.5;
    
    // Compute crater depth
    float craterDepth = (craterNoise - (1.0 - scaledDensity * 0.2)) 
                       / (scaledDensity * 0.2) * depthVariation;
    
    return craterDepth;
} 