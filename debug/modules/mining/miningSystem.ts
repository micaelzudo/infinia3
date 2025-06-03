import * as THREE from 'three';
import { ResourceInventory, addResource } from './resourceInventory';
import { TopElementsData } from '../types/renderingTypes';
import { getMaterialIndexAtPoint_TS } from '../../../src/modules/rendering/InternalMaterialGrid';

// Mining tool types
export enum MiningToolType {
    HAND = 'hand',
    PICK = 'pick',
    DRILL = 'drill',
    LASER = 'laser'
}

// Mining tool interface
export interface MiningTool {
    type: MiningToolType;
    name: string;
    power: number;         // Mining power (1-10)
    speed: number;         // Mining speed (1-10)
    efficiency: number;    // Resource extraction efficiency (0.1-1.0)
    durability: number;    // How many uses before breaking
    maxDurability: number; // Maximum durability
}

// Create default mining tools
export function createDefaultTools(): { [key in MiningToolType]: MiningTool } {
    return {
        [MiningToolType.HAND]: {
            type: MiningToolType.HAND,
            name: 'Hand',
            power: 1,
            speed: 1,
            efficiency: 0.5,
            durability: Infinity,
            maxDurability: Infinity
        },
        [MiningToolType.PICK]: {
            type: MiningToolType.PICK,
            name: 'Mining Pick',
            power: 3,
            speed: 2,
            efficiency: 0.7,
            durability: 100,
            maxDurability: 100
        },
        [MiningToolType.DRILL]: {
            type: MiningToolType.DRILL,
            name: 'Power Drill',
            power: 6,
            speed: 5,
            efficiency: 0.8,
            durability: 200,
            maxDurability: 200
        },
        [MiningToolType.LASER]: {
            type: MiningToolType.LASER,
            name: 'Mining Laser',
            power: 10,
            speed: 8,
            efficiency: 0.9,
            durability: 500,
            maxDurability: 500
        }
    };
}

// Material hardness levels (1-10)
export const MATERIAL_HARDNESS: { [symbol: string]: number } = {
    // Common materials (easy to mine)
    'H': 1,
    'C': 1,
    'N': 1,
    'O': 1,  // Changed from 2 to 1 to make it mineable with Hand
    'Na': 1,
    'Mg': 2,
    'Al': 2,
    'Si': 3,
    'P': 2,
    'S': 1,
    'Cl': 1,
    'K': 1,
    'Ca': 2,

    // Metals (medium hardness)
    'Ti': 4,
    'V': 4,
    'Cr': 4,
    'Mn': 3,
    'Fe': 4,
    'Co': 4,
    'Ni': 4,
    'Cu': 3,
    'Zn': 2,

    // Precious metals (harder)
    'Ag': 5,
    'Au': 6,
    'Pt': 6,

    // Rare and exotic (hardest)
    'U': 7,
    'Pu': 7,
    'Th': 7,
    'Xe': 8,
    'Rn': 8,
    'Hg': 5,
    'W': 7,
    'Os': 8,
    'Ir': 8,
    'Pd': 6,
    'Rh': 6,
    'Ru': 6,

    // Default for unknown materials
    'default': 4
};

// Material value (1-10, determines yield amount)
export const MATERIAL_VALUE: { [symbol: string]: number } = {
    // Common materials (low value)
    'H': 1,
    'C': 1,
    'N': 1,
    'O': 1,
    'Na': 1,
    'Mg': 2,
    'Al': 2,
    'Si': 2,
    'P': 2,
    'S': 2,
    'Cl': 1,
    'K': 1,
    'Ca': 1,

    // Metals (medium value)
    'Ti': 4,
    'V': 4,
    'Cr': 3,
    'Mn': 3,
    'Fe': 3,
    'Co': 4,
    'Ni': 4,
    'Cu': 3,
    'Zn': 2,

    // Precious metals (high value)
    'Ag': 6,
    'Au': 8,
    'Pt': 9,

    // Rare and exotic (highest value)
    'U': 7,
    'Pu': 8,
    'Th': 7,
    'Xe': 6,
    'Rn': 6,
    'Hg': 5,
    'W': 5,
    'Os': 7,
    'Ir': 8,
    'Pd': 7,
    'Rh': 7,
    'Ru': 6,

    // Default for unknown materials
    'default': 3
};

// Mining result interface
export interface MiningResult {
    success: boolean;
    materialIndex: number;
    materialSymbol: string;
    materialName: string;
    materialColor: THREE.Color;
    amount: number;
    message: string;
    position: THREE.Vector3;
    toolDamage: number;
}

// Mine at a specific point
export function mineAtPoint(
    point: THREE.Vector3,
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    tool: MiningTool,
    inventory: ResourceInventory
): MiningResult {
    try {
        // Determine material at this point
        const materialIndex = getMaterialIndexAtPoint_TS(
            point,
            topElements,
            noiseScale,
            planetOffset
        );

        const materialSymbol = topElements.symbols[materialIndex] || 'Unknown';
        const materialName = topElements.names[materialIndex] || materialSymbol;
        const materialColor = topElements.colors[materialIndex] || new THREE.Color(0xffffff);

        // Get material hardness (or default)
        const hardness = MATERIAL_HARDNESS[materialSymbol] || MATERIAL_HARDNESS.default;

        // Check if tool is powerful enough
        if (tool.power < hardness) {
            return {
                success: false,
                materialIndex,
                materialSymbol,
                materialName,
                materialColor,
                amount: 0,
                message: `${tool.name} is not powerful enough to mine ${materialName}`,
                position: point.clone(),
                toolDamage: 1 // Still damages tool slightly
            };
        }

        // Calculate yield amount based on material value and tool efficiency
        const baseValue = MATERIAL_VALUE[materialSymbol] || MATERIAL_VALUE.default;
        const yieldAmount = Math.max(1, Math.floor(baseValue * tool.efficiency));

        // Calculate tool damage based on hardness
        const toolDamage = Math.max(1, Math.floor(hardness / 2));

        // Add resource to inventory
        const added = addResource(
            inventory,
            materialSymbol,
            materialName,
            yieldAmount,
            materialColor
        );

        if (!added) {
            return {
                success: false,
                materialIndex,
                materialSymbol,
                materialName,
                materialColor,
                amount: 0,
                message: `Inventory full! Cannot add ${yieldAmount} ${materialName}`,
                position: point.clone(),
                toolDamage: 0 // No damage if not mined
            };
        }

        return {
            success: true,
            materialIndex,
            materialSymbol,
            materialName,
            materialColor,
            amount: yieldAmount,
            message: `Mined ${yieldAmount} ${materialName}`,
            position: point.clone(),
            toolDamage
        };
    } catch (error: any) {
        console.error("Mining error:", error);
        return {
            success: false,
            materialIndex: -1,
            materialSymbol: 'Error',
            materialName: 'Error',
            materialColor: new THREE.Color(0xff0000),
            amount: 0,
            message: `Mining error: ${error.message || 'Unknown error'}`,
            position: point.clone(),
            toolDamage: 0
        };
    }
}

// Apply damage to a tool and check if it breaks
export function damageTool(tool: MiningTool, damage: number): boolean {
    // Skip for infinite durability tools
    if (tool.durability === Infinity) return false;

    // Apply damage
    tool.durability -= damage;

    // Check if broken
    if (tool.durability <= 0) {
        tool.durability = 0;
        return true; // Tool is broken
    }

    return false; // Tool is still usable
}

// Repair a tool to full durability
export function repairTool(tool: MiningTool): void {
    tool.durability = tool.maxDurability;
}
