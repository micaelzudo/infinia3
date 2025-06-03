import * as THREE from 'three';

// --- Define Visual Parameter Mapping --- 
export interface VisualParams {
    metallic: number;
    roughness: number;
    patternIntensity: number;
    // Add more params later: e.g., noiseScale, facetStrength etc.
}

// Updated interface to include visual parameters
export interface TopElementsData {
    symbols: string[];
    colors: THREE.Color[];
    weights: number[];
    names: string[];
    visualParams: VisualParams[]; // Array of parameter objects
} 