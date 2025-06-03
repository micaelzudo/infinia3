import * as THREE from 'three';
import { ResourceInventory, addResource } from './resourceInventory';
import { TopElementsData } from '../types/renderingTypes';
import { getMaterialIndexAtPoint_TS } from '../../../src/modules/rendering/InternalMaterialGrid';
import { MiningTool, MATERIAL_HARDNESS, MATERIAL_VALUE } from './miningSystem';
import { analyzeVolumeComposition, VolumeCompositionResult } from './volumeCompositionAnalyzer';

/**
 * Result of a multi-point mining operation
 */
export interface AreaMiningResult {
    success: boolean;
    totalPoints: number;
    minedPoints: number;
    resources: {
        materialIndex: number;
        materialSymbol: string;
        materialName: string;
        materialColor: THREE.Color;
        amount: number;
    }[];
    message: string;
    toolDamage: number;
    volumeComposition: VolumeCompositionResult | null;
}

/**
 * Mine multiple points within a brush area
 * @param center Center point of the mining operation
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param tool Mining tool to use
 * @param inventory Resource inventory to add mined resources to
 * @param brushRadius Radius of the brush area
 * @param brushShape Shape of the brush ('sphere', 'cube', 'cylinder')
 * @param brushVerticality Vertical stretch factor for the brush
 * @returns Result of the mining operation
 */
export function mineAreaAtPoint(
    center: THREE.Vector3,
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    tool: MiningTool,
    inventory: ResourceInventory,
    brushRadius: number = 4,
    brushShape: 'sphere' | 'cube' | 'cylinder' = 'sphere',
    brushVerticality: number = 1
): AreaMiningResult {
    // Initialize result
    const result: AreaMiningResult = {
        success: false,
        totalPoints: 0,
        minedPoints: 0,
        resources: [],
        message: '',
        toolDamage: 0,
        volumeComposition: null
    };

    // First, analyze the volume composition to get a complete picture of the materials
    // including all internal grid layers
    result.volumeComposition = analyzeVolumeComposition(
        center,
        topElements,
        noiseScale,
        planetOffset,
        brushRadius,
        brushShape,
        brushVerticality,
        20, // Higher resolution for accurate analysis
        8,  // 8 internal grid layers (matching the visualizer)
        0.25 // Layer spacing (matching the visualizer)
    );

    // Track resources by material index
    const resourceMap: { [materialIndex: number]: {
        materialIndex: number;
        materialSymbol: string;
        materialName: string;
        materialColor: THREE.Color;
        amount: number;
    } } = {};

    // Calculate sampling resolution based on brush radius
    // Larger brushes need more samples
    const samplesPerAxis = Math.max(5, Math.ceil(brushRadius * 2));
    const stepSize = (brushRadius * 2) / samplesPerAxis;

    // Calculate bounds for sampling
    const bounds = {
        minX: center.x - brushRadius,
        maxX: center.x + brushRadius,
        minY: center.y - brushRadius * brushVerticality,
        maxY: center.y + brushRadius * brushVerticality,
        minZ: center.z - brushRadius,
        maxZ: center.z + brushRadius
    };

    // Sample points within the brush area
    for (let x = bounds.minX; x <= bounds.maxX; x += stepSize) {
        for (let y = bounds.minY; y <= bounds.maxY; y += stepSize) {
            for (let z = bounds.minZ; z <= bounds.maxZ; z += stepSize) {
                const point = new THREE.Vector3(x, y, z);
                result.totalPoints++;

                // Check if point is within the brush shape
                if (!isPointInBrush(point, center, brushRadius, brushShape, brushVerticality)) {
                    continue;
                }

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
                        // Skip this point, but don't fail the entire operation
                        continue;
                    }

                    // Calculate yield amount based on material value and tool efficiency
                    const baseValue = MATERIAL_VALUE[materialSymbol] || MATERIAL_VALUE.default;
                    const yieldAmount = Math.max(1, Math.floor(baseValue * tool.efficiency));

                    // Calculate tool damage based on hardness
                    result.toolDamage += Math.max(0.1, hardness / 20); // Reduced damage per point

                    // Track the resource
                    if (!resourceMap[materialIndex]) {
                        resourceMap[materialIndex] = {
                            materialIndex,
                            materialSymbol,
                            materialName,
                            materialColor,
                            amount: 0
                        };
                    }

                    resourceMap[materialIndex].amount += yieldAmount;
                    result.minedPoints++;
                } catch (error) {
                    console.error("Error sampling point during area mining:", error);
                    // Continue with other points
                }
            }
        }
    }

    // Convert resource map to array
    result.resources = Object.values(resourceMap);

    // Add resources to inventory
    let allResourcesAdded = true;
    for (const resource of result.resources) {
        const added = addResource(
            inventory,
            resource.materialSymbol,
            resource.materialName,
            resource.amount,
            resource.materialColor
        );

        if (!added) {
            allResourcesAdded = false;
            // Don't break, try to add as many resources as possible
        }
    }

    // Round tool damage to a reasonable value
    result.toolDamage = Math.ceil(result.toolDamage);

    // Set success and message
    if (result.minedPoints > 0) {
        result.success = true;

        if (result.resources.length === 1) {
            const resource = result.resources[0];
            result.message = `Mined ${resource.amount} ${resource.materialName}`;
        } else if (result.resources.length > 1) {
            result.message = `Mined ${result.minedPoints} points with ${result.resources.length} materials`;
        }

        if (!allResourcesAdded) {
            result.message += " (Inventory full!)";
        }
    } else {
        result.success = false;
        result.message = `${tool.name} couldn't mine any materials in this area`;
    }

    return result;
}

/**
 * Check if a point is within the brush shape
 * @param point Point to check
 * @param center Center of the brush
 * @param radius Radius of the brush
 * @param shape Shape of the brush
 * @param verticality Vertical stretch factor
 * @returns True if the point is within the brush
 */
function isPointInBrush(
    point: THREE.Vector3,
    center: THREE.Vector3,
    radius: number,
    shape: 'sphere' | 'cube' | 'cylinder',
    verticality: number
): boolean {
    // Calculate distance from center
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const dz = point.z - center.z;

    // Adjust vertical distance by verticality factor
    const adjustedDy = dy / verticality;

    switch (shape) {
        case 'cube':
            return Math.abs(dx) <= radius &&
                   Math.abs(adjustedDy) <= radius &&
                   Math.abs(dz) <= radius;

        case 'cylinder':
            const horizontalDistSq = dx * dx + dz * dz;
            return horizontalDistSq <= radius * radius &&
                   Math.abs(adjustedDy) <= radius;

        case 'sphere':
        default:
            const distSq = dx * dx + adjustedDy * adjustedDy + dz * dz;
            return distSq <= radius * radius;
    }
}
