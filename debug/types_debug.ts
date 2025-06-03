// CRITICAL FIX: The NoiseMap is a 3D array with indices [y][z][x]
// This is the root cause of the issue - the type definition was incorrect
export type NoiseMap = Float32Array[][];

export type LoadedChunks = {
  [chunkKeyY: string]: {
    mesh: THREE.Mesh | null;
    noiseMap: NoiseMap | null;
    playerEditMask?: boolean[][][] | null;
    lastAccessTime?: number;
  };
};

export type NoiseMapCache = {
  [key: string]: {
    noiseMap: number[][][][];
    noiseLayers: number[];
    seed: number;
  };
};

interface FromNoiseMap {
  noiseMap: NoiseMap | null;
  noiseLayers?: never;
  seed?: never;
}
interface FromLayersAndSeed {
  noiseLayers?: NoiseLayers | null;
  seed?: Seed | null;
  noiseMap?: never;
}
export type Generate = FromNoiseMap | FromLayersAndSeed;

export type NoiseLayers = [number, number, number];
export type Seed = number;
export type LayersAndSeed = [NoiseLayers, Seed];

export type WorkerMessage = [
  x: number,
  y: number,
  z: number,
  noiseLayers: NoiseLayers | null,
  seed: number,
  interpolate: boolean,
  wireframe: boolean,
  hasEditedNeighbor?: boolean
];

export type WorkerReturnMessage = [
  x: number,
  y: number,
  z: number,
  meshJson: any
];

export type UpdateController = () => void;

// CRITICAL FIX: The PlayerEditMask must match the NoiseMap dimensions
// The PlayerEditMask is a 3D array with indices [x][y][z]
// This is different from the NoiseMap which is [y][z][x]
// This mismatch is causing the terrain editing to fail beyond vertical chunk boundaries
export type PlayerEditMask = boolean[][][];
