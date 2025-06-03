import * as THREE from 'three';

export interface ResourceItem {
    amount: number;
    maxAmount?: number;
}

export interface ResourceInventory {
    capacity: number;
    totalItems: number;
    resources: { [key: string]: ResourceItem };
}

export interface VolumeCompositionResult {
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

export interface ResourceCalculationResult extends VolumeCompositionResult {
    totalSamples: number;
    calculationTime: number;
    boundingBox: {
        min: THREE.Vector3;
        max: THREE.Vector3;
        size: THREE.Vector3;
    };
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
    power: number;         // Mining power (1-10)
    speed: number;         // Mining speed (1-10)
    efficiency: number;    // Resource extraction efficiency (0.1-1.0)
    durability: number;    // How many uses before breaking
    maxDurability: number; // Maximum durability
    miningSpeed?: number;  // Added for worker integration
}

export interface AreaMiningResult {
    success: boolean;
    message?: string;
    toolDamage?: number;
    minedPoints?: number;
    totalPoints?: number;
    volumeComposition?: VolumeCompositionResult;
    resources?: Array<{
        materialIndex: number;
        materialSymbol: string;
        materialName: string;
        materialColor: THREE.Color;
        amount: number;
    }>;
}