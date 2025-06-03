import { VisualParams } from '../types/renderingTypes';

const elementVisualParams: Record<string, VisualParams> = {
    'Fe': { metallic: 0.9, roughness: 0.3, patternIntensity: 0.5 },
    'Ni': { metallic: 0.8, roughness: 0.4, patternIntensity: 0.4 },
    'Co': { metallic: 0.85, roughness: 0.35, patternIntensity: 0.45 },
    'Si': { metallic: 0.1, roughness: 0.6, patternIntensity: 0.8 },
    'C':  { metallic: 0.05, roughness: 0.7, patternIntensity: 0.6 },
    'O':  { metallic: 0.0, roughness: 0.9, patternIntensity: 0.2 },
    'H':  { metallic: 0.0, roughness: 0.95, patternIntensity: 0.1 },
    'He': { metallic: 0.0, roughness: 0.98, patternIntensity: 0.05 },
    'N':  { metallic: 0.0, roughness: 0.85, patternIntensity: 0.15 },
    'S':  { metallic: 0.1, roughness: 0.75, patternIntensity: 0.7 }, // Sulfur can be crystalline/powdery
    'P':  { metallic: 0.0, roughness: 0.8, patternIntensity: 0.5 },
    'Al': { metallic: 0.7, roughness: 0.5, patternIntensity: 0.3 }, // Aluminum is metallic but often duller
    'Mg': { metallic: 0.6, roughness: 0.6, patternIntensity: 0.3 },
    'Ca': { metallic: 0.4, roughness: 0.65, patternIntensity: 0.2 },
    'Na': { metallic: 0.5, roughness: 0.6, patternIntensity: 0.2 },
    'K':  { metallic: 0.5, roughness: 0.6, patternIntensity: 0.2 },
    'Ti': { metallic: 0.7, roughness: 0.45, patternIntensity: 0.4 },
    'DEFAULT': { metallic: 0.1, roughness: 0.7, patternIntensity: 0.4 } // Generic rocky fallback
};

export function getVisualParams(symbol: string): VisualParams {
    return elementVisualParams[symbol] || elementVisualParams['DEFAULT'];
}

export { elementVisualParams }; 