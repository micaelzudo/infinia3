import { planetTypes } from './planettypes.js'; // Import from the JS file
import { NoiseLayers, Seed } from '../types_debug'; // Import types from debug folder

// Define default parameters (can be adjusted)
const DEFAULT_NOISE_LAYERS: NoiseLayers = [75, 25, 10]; // Example defaults

// --- Terrain Parameter Mapping ---
// This is where we define the noise characteristics for different planet types.
// Values represent noise frequency/scale. Smaller values = finer details/higher frequency.
// Larger values = larger features/lower frequency.
// [Base Layer, Medium Detail, Fine Detail]

// TODO: Add more planet types and refine these parameters
const terrainParameterMap: { [key: string]: NoiseLayers } = {
    // --- Core Types Defined Earlier ---
    'barren_planet': [60, 20, 8],        // Rocky, some medium features, fine details
    'desert_planet': [100, 40, 15],      // Larger dunes/features, less fine detail
    'ice_planet': [120, 50, 25],       // Smoother, rolling icy hills
    'lava_planet': [50, 15, 5],        // Jagged, high-frequency details, less large structure
    'ocean_planet': [150, 80, 40],      // Very smooth, large underwater features (if any terrain)
    'terrestrial_planet': [75, 25, 10], // Generic mix, used as default
    'gas_giant': [200, 100, 50],       // Default gas giant cloud features
    'crater_planet': [70, 10, 5],        // Base terrain + high frequency craters
    // --- Types from planettypes.js ---
    'alkali_metal_clouds_gas_giant': [220, 110, 55], // Slightly diff scale than default GG
    'ammonia_clouds_gas_giant': [210, 105, 50],    // Similar to default GG
    'ammonia_planet': [130, 60, 30],             // Hazy/smooth ice giant variant
    'brown_dwarf': [240, 120, 60],             // Large scale, slow features (Substellar)
    'carbon_planet': [55, 18, 7],               // Jagged carbon formations
    'chlorine_planet': [90, 35, 15],            // Reactive atmosphere, maybe rough terrain
    'chthonian_planet': [40, 10, 4],            // Highly eroded, very rugged core remnant
    'cloudless_gas_giant': [200, 100, 50],     // Use default GG parameters for now
    'cold_eyeball_planet': [125, 50, 20],       // Tidally locked, half ice/half water - mix?
    'coreless_planet': [80, 30, 12],            // Less dense, potentially smoother mantle features
    'diamond_planet': [60, 20, 6],              // Hard, crystalline, maybe sharp edges like Carbon
    'disrupted_planet': [50, 18, 7],            // Fractured, irregular terrain from disruption
    'dwarf_planet': [100, 40, 18],            // Smaller body, maybe less pronounced features than full planet
    'earth_analog_planet': [75, 25, 10],      // Earth-like conditions (was earth_like_planet)
    'eccentric_jupiter': [190, 85, 38],         // Hot Jupiter variant, possibly more dynamic features
    'eyeball_planet': [110, 40, 15],            // Tidally locked, could be hot or cold variant
    'forest_planet': [80, 30, 12],              // Rolling hills, tree canopy noise
    'gas_dwarf': [190, 95, 48],                // Smaller scale gas features than giant
    'helium_planet': [200, 100, 50],             // Treat like a standard gas giant for noise
    'hot_desert_planet': [110, 45, 18],         // Hotter desert, maybe more wind erosion?
    'hot_eyeball_planet': [80, 30, 10],         // Tidally locked, molten side, rocky terminator
    'hot_jupiter': [180, 80, 35],              // Dynamic, smaller scale cloud features
    'hot_neptune': [170, 75, 30],             // Smaller scale gas/ice features
    'hycean_planet': [140, 70, 35],             // Water-covered, super-earth, potential for deep ocean features
    'ice_giant': [210, 100, 60],             // Large scale, denser than gas giant
    'iron_planet': [50, 15, 6],                // Dense, sharp metallic features
    'jungle_planet': [85, 35, 15],              // Dense vegetation, varied terrain
    'lava_world': [50, 15, 5],                 // Alias for lava_planet
    'magma_ocean_planet': [50, 15, 5],         // Surface mostly molten, similar to lava
    'mega_earth': [70, 28, 11],                // Larger Earth, slightly larger features
    'methane_planet': [140, 65, 35],            // Smooth, frozen plains/lakes
    'mini_neptune': [180, 90, 40],             // Smaller ice/gas giant features
    'mud_planet': [110, 50, 20],               // Sluggish, rolling mudflows
    'ocean_world': [150, 80, 40],             // Alias for ocean_planet
    'protoplanet': [65, 22, 9],               // Still forming, potentially rough, uneven surface
    'puffy_planet': [250, 120, 60],            // Very large, diffuse features (low density GG)
    'silicate_clouds_gas_giant': [205, 102, 51],// Similar to default GG
    'silicate_planet': [75, 25, 10],            // Standard rocky planet, use terrestrial default
    'steam_giant': [190, 90, 40],              // Dense water vapor clouds
    'steam_planet': [100, 45, 20],             // Hot, humid, smoother erosion
    'sub_brown_dwarf': [240, 120, 60],         // Large scale, slow features
    'sub_earth': [85, 30, 13],                 // Smaller than Earth, maybe less dramatic features
    'subglacial_ocean_planet': [125, 55, 28],  // Ice crust over ocean, smoother than ice_planet?
    'subsurface_ocean_planet': [90, 40, 15], // Rocky/icy crust over ocean
    'super_earth': [72, 26, 10],               // Larger than Earth, potentially higher gravity effects?
    'super_habitable_planet': [74, 24, 9],    // Optimized for life, diverse but maybe less extreme than Earth?
    'super_io': [55, 16, 6],                  // Highly volcanic, similar to lava/magma
    'super_jupiter': [240, 120, 60],           // Larger scale gas features
    'super_mercury': [58, 19, 7],             // Dense, metallic, barren-like
    'super_neptune': [220, 110, 55],           // Larger scale ice giant features
    'super_puff': [260, 130, 65],             // Even lower density than puffy planet
    'super_venus': [80, 30, 12],              // Thick atmosphere, volcanic activity?
    'tar_planet': [100, 30, 10],               // Viscous tar flows, crusted areas
    'terrestrial_giant': [68, 27, 10],         // Large rocky planet, similar to Mega-Earth
    'tidally_locked_planet': [100, 35, 12],   // Generic tidally locked, use eyeball average?
    'tundra_planet': [115, 45, 22],             // Frozen plains, permafrost features
    'volcanic_planet': [50, 15, 5],            // Alias for lava_planet
    'water_clouds_gas_giant': [200, 100, 50],   // Similar to default GG
    'water_giant': [160, 70, 30],             // Dense water atmosphere/ocean surface
    'water_planet': [150, 80, 40],             // Alias for ocean_planet
    // --- Removed types not in planettypes.js: ash_planet, city_planet, crystal_planet, earth_planet, frozen_gas_giant, heliocentric_gas_giant, machine_planet, magma_planet, methane_clouds_gas_giant, mountain_planet, swamp_planet, tomb_planet ---
};

/**
 * Gets the terrain generation parameters for a given planet type.
 * @param planetType The identifier string for the planet type (e.g., 'desert_planet').
 * @param baseSeed Optional base seed to potentially modify.
 * @returns An object containing the NoiseLayers and the seed.
 */
export function getTerrainParameters(planetType: string, baseSeed?: Seed): { noiseLayers: NoiseLayers, seed: Seed } {
    console.log(`Configuring terrain for planet type: ${planetType}`);

    const noiseLayers = terrainParameterMap[planetType] || DEFAULT_NOISE_LAYERS;
    
    // For now, we just return the base seed. Could add planet-specific seed logic later.
    const seed = baseSeed || Math.random(); 

    if (!terrainParameterMap[planetType]) {
        console.warn(`No specific terrain parameters found for type "${planetType}". Using defaults.`);
    }

    console.log(`  - Noise Layers: [${noiseLayers.join(', ')}]`);
    console.log(`  - Seed: ${seed}`);

    return { noiseLayers, seed };
}

// Example of how you might add more sophisticated logic later:
// function getLavaPlanetParameters(baseSeed: Seed): { noiseLayers: NoiseLayers, seed: Seed } {
//     // Maybe mix different noise profiles?
//     const noiseLayers: NoiseLayers = [50, 15, 5]; 
//     // Modify seed based on type?
//     const seed = (baseSeed || Math.random()) * 1.1; 
//     return { noiseLayers, seed };
// } 