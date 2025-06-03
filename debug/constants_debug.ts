import { NoiseLayers } from "./types_debug";

export const CHUNK_SIZE = 30;
export const CHUNK_HEIGHT = 50;
export const MAX_WORLD_HEIGHT = 2048;
export const MIN_WORLD_HEIGHT = -2048;
export const MAX_SHADER_ELEMENTS = 118; // How many top elements to pass to the shader
export const SEA_LEVEL = 0; // Example sea level

export const SHARED_NOISE_SCALE = 0.1; // Explicit noise scale for materials

export const DEFAULT_NOISE_LAYERS: NoiseLayers = [50, 25, 10];

export const storageKeys = {
  NOISE_LAYERS: "noise-layers",
  MAP_SEED: "map-seed",
  INTERPOLATE: "interpolate",
  WIREFRAME: "wireframe",
  DEBUG_PLANET_TYPE: "debug_selected_planet_type",
};
