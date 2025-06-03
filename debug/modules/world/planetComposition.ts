import * as THREE from 'three';
import { TopElementsData, VisualParams } from '../types/renderingTypes';
import { getElementColor, getElementFullName } from '../../terrainGenerationUtils/planetComposition.jsx'; // JS file, check path
import { planetTypes } from '../../terrainGenerationUtils/planettypes.js'; // JS file, check path
import { getVisualParams } from '../rendering/visuals';
import { MAX_SHADER_ELEMENTS } from '../rendering/constants';

// Interface definition (kept local to this module)
export interface PlanetCompositionInfo {
    dominantElement: string | null;
    topElements: TopElementsData | null;
}

// Main function to determine planet composition
export function getPlanetCompositionInfo(planetType: string): PlanetCompositionInfo {
    const fallbackColor = new THREE.Color(0xAAAAAA);
    const defaultParams = getVisualParams('DEFAULT');
    
    // Fallback data structure
    const fallbackData: PlanetCompositionInfo = {
        dominantElement: 'Si', // Default dominant element
        topElements: {
            symbols: Array(MAX_SHADER_ELEMENTS).fill('').map((_, i) => i === 0 ? 'Si' : ''),
            colors: Array(MAX_SHADER_ELEMENTS).fill(fallbackColor).map((c, i) => i === 0 ? new THREE.Color(getElementColor('Si')) : c),
            weights: Array(MAX_SHADER_ELEMENTS).fill(0.0).map((_, i) => i === 0 ? 1.0 : 0.0),
            names: Array(MAX_SHADER_ELEMENTS).fill('').map((_, i) => i === 0 ? getElementFullName('Si') : ''),
            visualParams: Array(MAX_SHADER_ELEMENTS).fill(defaultParams).map((p, i) => i === 0 ? getVisualParams('Si') : p)
        }
    };

    try {
        const planetConfig = planetTypes[planetType];
        if (!planetConfig || !planetConfig.composition) {
            console.warn(`No composition data found for planet type: ${planetType}. Using fallback.`);
            return fallbackData;
        }

        // Calculate total potential abundance
        let totalPotentialAbundance = 0;
        const elementPotentials: { [symbol: string]: number } = {};
        for (const [symbol, range] of Object.entries(planetConfig.composition) as [string, { min: number, max: number }][]) {
            const potential = (range.min + range.max) / 2;
            elementPotentials[symbol] = potential;
            totalPotentialAbundance += potential;
        }

        // Normalize potentials
        const composition: { [symbol: string]: number } = {};
        if (totalPotentialAbundance > 0) {
             for (const [symbol, potential] of Object.entries(elementPotentials)) {
                 composition[symbol] = potential / totalPotentialAbundance;
             }
        } else {
             console.warn(`Total potential abundance is zero for ${planetType}. Using fallback.`);
             return fallbackData;
        }

        // Get top N elements
        const sortedElements = Object.entries(composition)
            .sort(([, a], [, b]) => b - a)
            .slice(0, MAX_SHADER_ELEMENTS);

        if (sortedElements.length === 0) {
             console.warn(`No elements derived for ${planetType}. Using fallback.`);
             return fallbackData;
        }
        
        const dominantElement = sortedElements[0][0];

        // Prepare data for the shader
        const topElements: TopElementsData = {
            symbols: [],
            colors: [],
            weights: [],
            names: [],
            visualParams: []
        };

        let cumulativeWeight = 0; // Keep track for potential normalization later if needed
        sortedElements.forEach(([symbol, abundance]) => {
            topElements.symbols.push(symbol);
            topElements.colors.push(new THREE.Color(getElementColor(symbol)));
            topElements.weights.push(abundance); 
            topElements.names.push(getElementFullName(symbol));
            topElements.visualParams.push(getVisualParams(symbol));
            cumulativeWeight += abundance;
        });
        
        // --- Padding --- 
        // Pad arrays if fewer than MAX_SHADER_ELEMENTS found
        while (topElements.symbols.length < MAX_SHADER_ELEMENTS) {
            topElements.symbols.push(''); // Pad symbol with empty string
            topElements.colors.push(fallbackColor); 
            topElements.weights.push(0.0);
            topElements.names.push(''); // Pad names array
            topElements.visualParams.push(defaultParams); // Pad with default visual params
        }
        // ---------------

        console.log(`Prepared Top ${MAX_SHADER_ELEMENTS} Elements for ${planetType}:`, topElements);
        return {
            dominantElement: dominantElement,
            topElements: topElements
        };

    } catch (error) {
        console.error(`Error processing composition for ${planetType}:`, error);
        return fallbackData;
    }
} 