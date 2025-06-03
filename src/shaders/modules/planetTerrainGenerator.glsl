// Planet Terrain Generator Module
// Generates various types of planetary terrain using noise functions

#include "noiseUtilities.glsl"
#include "mathUtils.glsl"

// Terrain types - correspond to TypeScript enum
#define TERRAIN_DEFAULT 0
#define TERRAIN_MOUNTAINOUS 1
#define TERRAIN_CAVERNOUS 2
#define TERRAIN_FLOATING 3
#define TERRAIN_CRYSTALLINE 4
#define TERRAIN_DESERT 5
#define TERRAIN_OCEANIC 6
#define TERRAIN_VOLCANIC 7
#define TERRAIN_ALIEN 8

// Terrain configuration for generating planets
struct TerrainConfig {
    int planetType;
    float baseFrequency;
    float amplitude;
    int octaves;
    float persistence;
    float lacunarity;
    float ridgeThreshold;
    float warpStrength;
    float seaLevel;
    float craterDensity;
    float craterDepth;
    float erosion;
    float gravity;
    float seed;
};

// Get default terrain configuration
TerrainConfig defaultTerrainConfig() {
    TerrainConfig config;
    config.planetType = TERRAIN_DEFAULT;
    config.baseFrequency = 1.0;
    config.amplitude = 1.0;
    config.octaves = 5;
    config.persistence = 0.5;
    config.lacunarity = 2.0;
    config.ridgeThreshold = 0.3;
    config.warpStrength = 0.0;
    config.seaLevel = 0.0;
    config.craterDensity = 0.0;
    config.craterDepth = 0.0;
    config.erosion = 0.0;
    config.gravity = 1.0;
    config.seed = 0.0;
    return config;
}

// Default terrain - smooth rolling hills
float defaultTerrain(vec3 position, TerrainConfig config) {
    float elevation = 0.0;
    
    // Apply domain warping for more interesting features
    vec3 warpedPos = position;
    if (config.warpStrength > 0.0) {
        warpedPos = domainWarp(position, config.warpStrength, config.baseFrequency * 2.0);
    }
    
    // Generate base FBM noise for the terrain
    elevation = fbm(
        warpedPos * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    ) * config.amplitude;
    
    // Apply craters if density > 0
    if (config.craterDensity > 0.0) {
        float craters = craterNoise(position, config.craterDensity, config.craterDepth, config.seed);
        elevation += craters;
    }
    
    // Apply gravity effect - flatten the terrain based on gravity
    if (config.gravity > 0.0) {
        float heightFactor = 1.0 - config.gravity * 0.5;
        elevation *= heightFactor;
    }
    
    return elevation;
}

// Mountainous terrain - sharp peaks and ridges
float mountainousTerrain(vec3 position, TerrainConfig config) {
    float elevation = 0.0;
    
    // Use ridge noise for mountain ridges
    float ridgeNoise = ridgeNoise(
        position * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity,
        config.ridgeThreshold
    ) * config.amplitude * 1.5;
    
    // Layer with regular FBM for smaller details
    float detailNoise = fbm(
        position * config.baseFrequency * 2.0, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    ) * config.amplitude * 0.5;
    
    // Combine the two noise types
    elevation = ridgeNoise + detailNoise * 0.3;
    
    // Apply gravity - higher mountains should be less common with strong gravity
    if (config.gravity > 0.0) {
        float heightAttenuation = pow(1.0 - config.gravity * 0.4, 2.0);
        elevation *= heightAttenuation;
    }
    
    // Apply erosion to peaks
    if (config.erosion > 0.0) {
        // Calculate slope for erosion
        float dx = dFdx(elevation);
        float dy = dFdy(elevation);
        float slope = sqrt(dx*dx + dy*dy);
        
        elevation = applyErosion(elevation, slope, config.erosion);
    }
    
    return elevation;
}

// Cavernous terrain - caves and tunnels
float cavernousTerrain(vec3 position, TerrainConfig config) {
    // Use Worley (Voronoi) noise to create cave-like structures
    float caves = voronoiNoise(position * config.baseFrequency);
    
    // Invert and adjust to create hollow spaces
    caves = 1.0 - caves;
    caves = smoothstep(0.1, 0.6, caves); 
    
    // Generate base terrain with FBM
    float baseTerrain = fbm(
        position * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    ) * config.amplitude;
    
    // Combine with cave system
    float elevation = baseTerrain;
    
    // Apply cave carving - more caves where the terrain is thicker
    float caveFactor = mix(0.0, 0.7, config.amplitude);
    elevation -= caves * caveFactor;
    
    // Apply gravity effect - fewer caves and tunnels with higher gravity
    if (config.gravity > 0.7) {
        float gravityFactor = (config.gravity - 0.7) / 0.3; 
        elevation = mix(elevation, baseTerrain, gravityFactor * 0.5);
    }
    
    return elevation;
}

// Floating terrain - floating islands and archways
float floatingTerrain(vec3 position, TerrainConfig config) {
    // Create base noise
    float base = fbm(
        position * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Create mask for floating islands
    float mask = fbm(
        position * config.baseFrequency * 0.5, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Shape the mask to create distinct islands
    mask = smoothstep(0.3, 0.7, mask);
    
    // Create connections between islands with a different noise pattern
    float connections = fbm(
        position * config.baseFrequency * 2.0 + vec3(100.0, 50.0, 25.0), 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    connections = smoothstep(0.6, 0.8, connections) * 0.3;
    
    // Combine elements
    float elevation = base * config.amplitude * mask;
    elevation += connections * config.amplitude * 0.5;
    
    // Low gravity planets have more floating islands
    float gravityFactor = clamp(1.0 - config.gravity, 0.0, 1.0);
    elevation *= mix(0.5, 1.5, gravityFactor);
    
    return elevation;
}

// Crystalline terrain - sharp geometric formations
float crystallineTerrain(vec3 position, TerrainConfig config) {
    // Transform space to create crystalline structures
    vec3 transformedPos = terrainTransform(position, 0.2, min(float(config.octaves) * 0.5, 3.0));
    
    // Create sharp noise patterns
    float crystalNoise = fbm(
        transformedPos * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Apply bias to create sharper transitions
    crystalNoise = bias(crystalNoise, 0.3);
    
    // Use higher frequencies for crystal facets
    float facets = fbm(
        position * config.baseFrequency * 3.0, 
        3, 
        0.5, 
        2.0
    );
    
    // Combine for final elevation
    float elevation = crystalNoise * config.amplitude;
    
    // Add faceting effect
    float facetStrength = 0.3;
    elevation = elevation * (1.0 - facetStrength) + facets * facetStrength;
    
    // Gravity affects crystal growth - lower gravity allows larger crystals
    float gravityFactor = clamp(1.0 - config.gravity, 0.0, 1.0);
    elevation *= mix(0.8, 1.2, gravityFactor);
    
    return elevation;
}

// Desert terrain - dunes and rock formations
float desertTerrain(vec3 position, TerrainConfig config) {
    // Create main dune patterns
    vec3 dunePos = position;
    dunePos.y *= 0.5; // Stretch in one direction for dune ridges
    
    float dunes = fbm(
        dunePos * config.baseFrequency * 0.7, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Create secondary ripple patterns
    float ripples = fbm(
        position * config.baseFrequency * 3.0, 
        3, 
        0.5, 
        2.0
    ) * 0.1;
    
    // Rock formations
    float rocks = turbulenceNoise(position * config.baseFrequency * 1.5, 3);
    rocks = smoothstep(0.4, 0.6, rocks) * 0.4;
    
    // Combine elements with a mask to create regions of dunes vs rocky areas
    float mask = fbm(
        position * config.baseFrequency * 0.3, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    mask = smoothstep(0.3, 0.7, mask);
    
    // Blend dunes and rocks based on mask
    float elevation = mix(dunes, rocks, mask) * config.amplitude;
    elevation += ripples * config.amplitude;
    
    // Apply erosion - more pronounced in desert environments
    if (config.erosion > 0.0) {
        float dx = dFdx(elevation);
        float dy = dFdy(elevation);
        float slope = sqrt(dx*dx + dy*dy);
        
        elevation = applyErosion(elevation, slope, config.erosion * 1.5);
    }
    
    return elevation;
}

// Oceanic terrain - underwater features and islands
float oceanicTerrain(vec3 position, TerrainConfig config) {
    // Generate base terrain
    float base = fbm(
        position * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Shape elevation for ocean floor and islands
    float elevation = base * config.amplitude;
    
    // Apply sea level
    float seaLevel = max(config.seaLevel, 0.0);
    
    // Create a mask for determining islands
    float islandMask = fbm(
        position * config.baseFrequency * 0.4, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Adjust island distribution - fewer islands when the mask value is high
    islandMask = smoothstep(0.5, 0.8, islandMask);
    
    // Apply seabed features
    float seabed = fbm(
        position * config.baseFrequency * 1.5, 
        3, 
        0.5, 
        2.0
    ) * 0.2;
    
    // Create coral-like structures in shallow areas
    float coral = 0.0;
    if (elevation > -0.5 && elevation < -0.1) {
        coral = turbulenceNoise(position * config.baseFrequency * 4.0, 2) * 0.15;
        coral *= smoothstep(-0.5, -0.3, elevation) * smoothstep(0.0, -0.2, elevation);
    }
    
    // Combine all elements
    elevation = mix(elevation - seaLevel, elevation + 0.3, islandMask);
    elevation += seabed * (1.0 - islandMask); // Only apply seabed where there are no islands
    elevation += coral;
    
    return elevation;
}

// Volcanic terrain - calderas, lava flows and ash fields
float volcanicTerrain(vec3 position, TerrainConfig config) {
    // Base terrain
    float base = fbm(
        position * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Create volcano cones
    float volcanoMask = fbm(
        position * config.baseFrequency * 0.3, 
        3, 
        0.5, 
        2.0
    );
    
    // Create sharper peaks for volcanoes
    volcanoMask = pow(volcanoMask, 2.0);
    
    // Create caldera (crater) at the top of each volcano
    float caldera = 0.0;
    if (volcanoMask > 0.6) {
        // Calculate relative height on the volcano
        float volcanoHeight = (volcanoMask - 0.6) / 0.4;
        
        // Create crater only near the top
        if (volcanoHeight > 0.7) {
            vec3 localPos = position * config.baseFrequency * 2.0;
            float craterDist = length(localPos - round(localPos));
            caldera = smoothstep(0.1, 0.2, craterDist) - 1.0;
            caldera *= (volcanoHeight - 0.7) / 0.3 * 0.5; // Deeper at the very top
        }
    }
    
    // Lava flows - follow down slopes
    float lavaFlows = fbm(
        position * config.baseFrequency * 2.0 + vec3(50.0, 30.0, 10.0), 
        3, 
        0.5, 
        2.0
    );
    
    // Apply volcanic elevation
    float elevation = base * (1.0 - volcanoMask * 0.5) * config.amplitude; // Base terrain
    elevation += volcanoMask * volcanoMask * config.amplitude * 1.5; // Add volcanic cones
    elevation += caldera * config.amplitude; // Apply calderas
    
    // Add small lumps for ash and tephra deposits
    float ash = fbm(
        position * config.baseFrequency * 4.0, 
        3, 
        0.5, 
        2.0
    ) * 0.1;
    
    elevation += ash * config.amplitude;
    
    return elevation;
}

// Alien terrain - weird, other-worldly formations
float alienTerrain(vec3 position, TerrainConfig config) {
    // Apply unusual warping to create alien landscapes
    vec3 warpedPos = domainWarp(
        position, 
        config.warpStrength + 0.5, 
        config.baseFrequency * 1.5
    );
    
    // Apply a second layer of warping for more distortion
    warpedPos = domainWarp(
        warpedPos, 
        config.warpStrength * 0.5, 
        config.baseFrequency * 3.0
    );
    
    // Create base noise with the warped position
    float base = fbm(
        warpedPos * config.baseFrequency, 
        config.octaves, 
        config.persistence, 
        config.lacunarity
    );
    
    // Create tentacle-like structures
    float tentacles = 0.0;
    for (int i = 0; i < 3; i++) {
        vec3 offset = vec3(
            cos(float(i) * 2.0 + config.seed), 
            sin(float(i) * 3.0 + config.seed * 2.0), 
            cos(float(i) * 4.0 + config.seed * 3.0)
        );
        
        vec3 tentaclePos = position + offset * 10.0;
        float dist = length(cross(normalize(tentaclePos), normalize(offset)));
        tentacles += smoothstep(0.1, 0.2, dist) - 1.0;
    }
    tentacles *= 0.2;
    
    // Create unusual formations
    float weird = ridgeNoise(
        warpedPos * config.baseFrequency * 2.0, 
        config.octaves, 
        config.persistence, 
        config.lacunarity,
        0.1
    ) * 0.5;
    
    // Combine all elements
    float elevation = base * config.amplitude;
    elevation += weird * config.amplitude;
    elevation += tentacles * config.amplitude;
    
    // Add strange pustules/bubbles
    float bubbles = voronoiNoise(position * config.baseFrequency * 3.0);
    bubbles = 1.0 - bubbles;
    bubbles = pow(bubbles, 8.0) * 0.5;
    
    elevation += bubbles * config.amplitude;
    
    return elevation;
}

// Main terrain generation function - dispatches to the appropriate terrain generator
float generatePlanetTerrain(vec3 position, TerrainConfig config) {
    float elevation = 0.0;
    
    // Add slight variation based on seed
    vec3 seedOffset = vec3(
        sin(config.seed * 12.345), 
        cos(config.seed * 45.678), 
        sin(config.seed * 78.912)
    );
    vec3 seedPos = position + seedOffset;
    
    // Choose terrain generator based on planet type
    if (config.planetType == TERRAIN_MOUNTAINOUS) {
        elevation = mountainousTerrain(seedPos, config);
    } 
    else if (config.planetType == TERRAIN_CAVERNOUS) {
        elevation = cavernousTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_FLOATING) {
        elevation = floatingTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_CRYSTALLINE) {
        elevation = crystallineTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_DESERT) {
        elevation = desertTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_OCEANIC) {
        elevation = oceanicTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_VOLCANIC) {
        elevation = volcanicTerrain(seedPos, config);
    }
    else if (config.planetType == TERRAIN_ALIEN) {
        elevation = alienTerrain(seedPos, config);
    }
    else {
        // Default terrain
        elevation = defaultTerrain(seedPos, config);
    }
    
    return elevation;
} 