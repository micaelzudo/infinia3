import * as THREE from 'three';

// Mining Types
export interface ResourceItem {
    amount: number;
    maxAmount?: number;
}

export interface ResourceInventory {
    capacity: number;
    totalItems: number;
    resources: { [key: string]: ResourceItem };
}

export enum MiningToolType {
    HAND = 'HAND',
    PICKAXE = 'PICKAXE',
    DRILL = 'DRILL',
    LASER = 'LASER'
}

export interface MiningTool {
    type: MiningToolType;
    name: string;
    power: number;
    speed: number;
    efficiency: number;
    durability: number;
    maxDurability: number;
    miningSpeed?: number;
}

export interface ResourceCalculationResult {
    totalPoints: number;
    materialCounts: {
        [key: string]: {
            materialName: string;
            materialColor: THREE.Color;
            count: number;
            percentage: number;
        };
    };
}

// Terrain Types
export interface NoiseLayers {
    baseNoise: Float32Array[][];
    detailNoise?: Float32Array[][];
}

export type Seed = string;

export interface TopElementsData {
    elements: Array<{
        name: string;
        color: THREE.Color;
        symbol: string;
    }>;
}

export interface LoadedChunks {
    [key: string]: {
        noiseMap: Float32Array[][] | null;
        mesh: THREE.Mesh | null;
        lastAccessTime: number;
        playerEditMask?: boolean[][][] | null;
    };
}

export interface Generate {
    noiseMap: Float32Array[][];
}

export interface ActualVolumeCompositionResult {
    materialCounts: {
        [key: string]: {
            materialName: string;
            percentage: number;
        };
    };
}

// Window Extensions
export interface SpacetimeDBWindow extends Window {
    Client?: {
        get: (table: string, query: any) => Promise<any>;
    };
    currentNoiseLayers?: NoiseLayers;
    currentSeed?: Seed;
    currentCompInfo?: { topElements: TopElementsData | null };
    currentNoiseScale?: number;
    currentPlanetOffset?: THREE.Vector3;
    analyzeVolumeComposition?: (
        center: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3,
        brushRadius?: number,
        brushShape?: 'sphere' | 'cube' | 'cylinder',
        brushVerticality?: number,
        resolutionContextWidth?: number,
        resolutionContextHeight?: number
    ) => ActualVolumeCompositionResult | null;
} 