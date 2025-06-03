import * as THREE from 'three';
import { TopElementsData } from '../types/renderingTypes';
import { getMaterialIndexAtPoint_TS } from '../../../src/modules/rendering/InternalMaterialGrid';

/**
 * Result of a volume composition analysis
 */
export interface VolumeCompositionResult {
    totalPoints: number;
    materialCounts: {
        [materialIndex: number]: {
            materialIndex: number;
            materialSymbol: string;
            materialName: string;
            materialColor: THREE.Color;
            count: number;
            percentage: number;
        }
    };
    boundingBox: {
        min: THREE.Vector3;
        max: THREE.Vector3;
        size: THREE.Vector3;
    };
    calculationTime: number;
}

/**
 * Analyze the material composition of a volume defined by a brush, including all internal grid layers
 * @param center Center point of the volume
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param brushRadius Radius of the brush area
 * @param brushShape Shape of the brush ('sphere', 'cube', 'cylinder')
 * @param brushVerticality Vertical stretch factor for the brush
 * @param resolution Number of sample points per axis (higher = more accurate but slower)
 * @param depthLayers Number of depth layers to analyze (simulating the internal grid visualizer)
 * @param layerSpacing Spacing between depth layers
 * @returns Result of the volume composition analysis
 */
export function analyzeVolumeComposition(
    center: THREE.Vector3,
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    brushRadius: number = 4,
    brushShape: 'sphere' | 'cube' | 'cylinder' = 'sphere',
    brushVerticality: number = 1,
    resolution: number = 20,
    depthLayers: number = 8,
    layerSpacing: number = 0.25
): VolumeCompositionResult {
    const startTime = performance.now();

    // Initialize result
    const result: VolumeCompositionResult = {
        totalPoints: 0,
        materialCounts: {},
        boundingBox: {
            min: new THREE.Vector3(
                center.x - brushRadius,
                center.y - brushRadius * brushVerticality,
                center.z - brushRadius
            ),
            max: new THREE.Vector3(
                center.x + brushRadius,
                center.y + brushRadius * brushVerticality,
                center.z + brushRadius
            ),
            size: new THREE.Vector3(
                brushRadius * 2,
                brushRadius * 2 * brushVerticality,
                brushRadius * 2
            )
        },
        calculationTime: 0
    };

    // Calculate step size based on resolution
    const stepX = result.boundingBox.size.x / resolution;
    const stepY = result.boundingBox.size.y / resolution;
    const stepZ = result.boundingBox.size.z / resolution;

    // Sample points throughout the volume, including internal grid layers
    // First, sample the surface layer (at the center point's y-coordinate)
    sampleLayer(center.y, center, result, topElements, noiseScale, planetOffset,
                brushRadius, brushShape, brushVerticality, resolution, stepX, stepY, stepZ);

    // Then sample the internal grid layers below the surface
    const startOffset = layerSpacing;
    for (let layer = 0; layer < depthLayers; layer++) {
        const layerY = center.y - startOffset - (layer * layerSpacing);
        sampleLayer(layerY, center, result, topElements, noiseScale, planetOffset,
                    brushRadius, brushShape, brushVerticality, resolution, stepX, stepY, stepZ);
    }

    console.log(`Volume analysis complete: Sampled ${result.totalPoints} points across ${depthLayers + 1} layers`);

    // Calculate percentages
    if (result.totalPoints > 0) {
        Object.values(result.materialCounts).forEach(material => {
            material.percentage = (material.count / result.totalPoints) * 100;
        });
    }

    // Calculate calculation time
    result.calculationTime = performance.now() - startTime;

    return result;
}

/**
 * Sample a single horizontal layer of the volume
 * @param layerY Y-coordinate of the layer
 * @param center Center point of the brush
 * @param result Result object to update
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param brushRadius Radius of the brush
 * @param brushShape Shape of the brush
 * @param brushVerticality Vertical stretch factor
 * @param resolution Number of sample points per axis
 * @param stepX Step size along X axis
 * @param stepY Step size along Y axis
 * @param stepZ Step size along Z axis
 */
function sampleLayer(
    layerY: number,
    center: THREE.Vector3,
    result: VolumeCompositionResult,
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    brushRadius: number,
    brushShape: 'sphere' | 'cube' | 'cylinder',
    brushVerticality: number,
    resolution: number,
    stepX: number,
    stepY: number,
    stepZ: number
): void {
    // Sample points throughout this layer
    for (let x = 0; x < resolution; x++) {
        for (let z = 0; z < resolution; z++) {
            // Calculate the position of this sample
            const position = new THREE.Vector3(
                result.boundingBox.min.x + (x + 0.5) * stepX,
                layerY, // Fixed Y coordinate for this layer
                result.boundingBox.min.z + (z + 0.5) * stepZ
            );

            // For internal layers, we only need to check if the X,Z coordinates are within the brush shape
            // We'll use a modified version of isPointInBrush that only checks X,Z for internal layers
            if (!isPointInLayerBrush(position, center, brushRadius, brushShape)) {
                continue;
            }

            result.totalPoints++;

            try {
                // Determine material at this point
                const materialIndex = getMaterialIndexAtPoint_TS(
                    position,
                    topElements,
                    noiseScale,
                    planetOffset
                );

                const materialSymbol = topElements.symbols[materialIndex] || 'Unknown';
                const materialName = topElements.names[materialIndex] || materialSymbol;
                const materialColor = topElements.colors[materialIndex] || new THREE.Color(0xffffff);

                // Track the material count
                if (!result.materialCounts[materialIndex]) {
                    result.materialCounts[materialIndex] = {
                        materialIndex,
                        materialSymbol,
                        materialName,
                        materialColor,
                        count: 0,
                        percentage: 0
                    };
                }

                result.materialCounts[materialIndex].count++;
            } catch (error) {
                console.error("Error sampling point during volume analysis:", error);
                // Continue with other points
            }
        }
    }
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

/**
 * Check if a point in a layer is within the horizontal projection of the brush shape
 * This is used for internal grid layers where we only care about the X,Z coordinates
 * @param point Point to check
 * @param center Center of the brush
 * @param radius Radius of the brush
 * @param shape Shape of the brush
 * @returns True if the point is within the horizontal projection of the brush
 */
function isPointInLayerBrush(
    point: THREE.Vector3,
    center: THREE.Vector3,
    radius: number,
    shape: 'sphere' | 'cube' | 'cylinder'
): boolean {
    // Calculate horizontal distance from center
    const dx = point.x - center.x;
    const dz = point.z - center.z;
    const horizontalDistSq = dx * dx + dz * dz;

    switch (shape) {
        case 'cube':
            return Math.abs(dx) <= radius && Math.abs(dz) <= radius;

        case 'cylinder':
        case 'sphere':
        default:
            // For both cylinder and sphere, the horizontal projection is a circle
            return horizontalDistSq <= radius * radius;
    }
}

/**
 * Convert a volume composition result to a string representation
 * @param result Volume composition result
 * @returns String representation of the result
 */
export function volumeCompositionToString(result: VolumeCompositionResult): string {
    let output = `Volume Composition Analysis:\n`;
    output += `Total points: ${result.totalPoints}\n`;
    output += `Bounding box: ${result.boundingBox.size.x.toFixed(1)} × ${result.boundingBox.size.y.toFixed(1)} × ${result.boundingBox.size.z.toFixed(1)} units\n`;
    output += `Calculation time: ${result.calculationTime.toFixed(2)}ms\n\n`;

    // Sort materials by percentage (descending)
    const sortedMaterials = Object.values(result.materialCounts).sort((a, b) => b.percentage - a.percentage);

    output += `Material Composition (including all internal grid layers):\n`;
    sortedMaterials.forEach(material => {
        // Calculate estimated total units based on a 32³ voxel grid
        const totalVoxels = 32768; // 32^3
        const estimatedUnits = Math.round((material.percentage / 100) * totalVoxels);

        output += `${material.materialName} (${material.materialSymbol}): ${material.percentage.toFixed(1)}% (${material.count} points, ~${estimatedUnits} units)\n`;
    });

    return output;
}
