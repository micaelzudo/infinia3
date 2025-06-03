import * as THREE from 'three';
import { TopElementsData } from '../types/renderingTypes';
import { getMaterialIndexAtPoint_TS } from '../../../src/modules/rendering/InternalMaterialGrid';

// Interface for resource distribution
export interface ResourceDistribution {
    symbol: string;
    name: string;
    color: THREE.Color;
    count: number;
    percentage: number;
}

// Interface for total resources calculation result
export interface ResourceCalculationResult {
    totalSamples: number;
    resources: ResourceDistribution[];
    calculationTime: number;
    boundingBox: {
        min: THREE.Vector3;
        max: THREE.Vector3;
        size: THREE.Vector3;
    };
    samplingResolution: number;
}

/**
 * Calculate the distribution of resources in a volume of terrain
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param boundingBox Bounding box to calculate resources within
 * @param resolution Number of samples per axis (higher = more accurate but slower)
 * @returns Distribution of resources in the volume
 */
export function calculateResourceDistribution(
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    boundingBox: THREE.Box3,
    resolution: number = 20
): ResourceCalculationResult {
    const startTime = performance.now();
    
    // Calculate the size of the bounding box
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // Calculate the step size for sampling
    const stepX = size.x / resolution;
    const stepY = size.y / resolution;
    const stepZ = size.z / resolution;
    
    // Initialize counters for each material
    const materialCounts: { [symbol: string]: number } = {};
    let totalSamples = 0;
    
    // Sample points throughout the volume
    for (let x = 0; x < resolution; x++) {
        for (let y = 0; y < resolution; y++) {
            for (let z = 0; z < resolution; z++) {
                // Calculate the position of this sample
                const position = new THREE.Vector3(
                    boundingBox.min.x + (x + 0.5) * stepX,
                    boundingBox.min.y + (y + 0.5) * stepY,
                    boundingBox.min.z + (z + 0.5) * stepZ
                );
                
                // Determine the material at this position
                const materialIndex = getMaterialIndexAtPoint_TS(
                    position,
                    topElements,
                    noiseScale,
                    planetOffset
                );
                
                // Get the symbol for this material
                const symbol = topElements.symbols[materialIndex] || 'Unknown';
                
                // Increment the counter for this material
                materialCounts[symbol] = (materialCounts[symbol] || 0) + 1;
                totalSamples++;
            }
        }
    }
    
    // Convert the counts to percentages and create the result array
    const resources: ResourceDistribution[] = [];
    for (const symbol in materialCounts) {
        const count = materialCounts[symbol];
        const percentage = (count / totalSamples) * 100;
        const index = topElements.symbols.indexOf(symbol);
        const name = index >= 0 ? (topElements.names?.[index] || symbol) : symbol;
        const color = index >= 0 ? topElements.colors[index] : new THREE.Color(0xcccccc);
        
        resources.push({
            symbol,
            name,
            color,
            count,
            percentage
        });
    }
    
    // Sort by percentage (descending)
    resources.sort((a, b) => b.percentage - a.percentage);
    
    const endTime = performance.now();
    
    return {
        totalSamples,
        resources,
        calculationTime: endTime - startTime,
        boundingBox: {
            min: boundingBox.min.clone(),
            max: boundingBox.max.clone(),
            size: size.clone()
        },
        samplingResolution: resolution
    };
}

/**
 * Calculate the total amount of each resource in a chunk
 * @param chunkSize Size of the chunk
 * @param result Resource calculation result
 * @returns Total units of each resource
 */
export function calculateTotalResourceUnits(
    chunkSize: number,
    result: ResourceCalculationResult
): { [symbol: string]: number } {
    // Calculate the volume of the chunk in cubic units
    const chunkVolume = chunkSize * chunkSize * chunkSize;
    
    // Calculate the total units of each resource
    const totalUnits: { [symbol: string]: number } = {};
    
    for (const resource of result.resources) {
        // Calculate the volume of this resource in the chunk
        const resourceVolume = (resource.percentage / 100) * chunkVolume;
        
        // Convert to units (1 unit = 1 cubic unit)
        totalUnits[resource.symbol] = Math.round(resourceVolume);
    }
    
    return totalUnits;
}

/**
 * Estimate the total resources in the visible terrain
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param chunkSize Size of a chunk
 * @param chunkDepth Depth to consider for resource calculation
 * @returns Estimated total resources
 */
export function estimateTotalResources(
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    chunkSize: number = 32,
    chunkDepth: number = 8
): ResourceCalculationResult {
    // Create a bounding box for a single chunk with the specified depth
    const boundingBox = new THREE.Box3(
        new THREE.Vector3(-chunkSize/2, -chunkDepth, -chunkSize/2),
        new THREE.Vector3(chunkSize/2, 0, chunkSize/2)
    );
    
    // Calculate the resource distribution
    return calculateResourceDistribution(
        topElements,
        noiseScale,
        planetOffset,
        boundingBox,
        20 // Default resolution
    );
}
