import { planetTypes } from './terrainGenerationUtils/planettypes.js';
import { storageKeys } from './constants_debug';
import { cleanupWelcomeScreen } from '../src/welcomeScreen';
import * as THREE from 'three';
import { SHARED_NOISE_SCALE } from './constants_debug';
import { getPlanetCompositionInfo } from './modules/world/planetComposition';
import type { NoiseLayers, Seed } from './types_debug';
import type { TopElementsData } from './modules/types/renderingTypes';

let selectorContainer: HTMLElement | null = null;

// Basic Styling (can be enhanced)
const containerStyle = `
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    color: white;
    font-family: sans-serif;
    overflow-y: auto; /* Allow scrolling if many planets */
    padding: 20px;
`;

const gridStyle = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); /* Responsive grid */
    gap: 15px;
    width: 80%;
    max-width: 1200px;
    margin-top: 20px;
`;

const buttonStyle = `
    padding: 15px 20px;
    font-size: 1.1em;
    cursor: pointer;
    border: 1px solid #555;
    border-radius: 5px;
    background-color: rgba(50, 50, 70, 0.8);
    color: white;
    text-align: center;
    transition: background-color 0.3s ease, transform 0.1s ease;
`;

const buttonHoverStyle = `
    background-color: rgba(80, 80, 110, 0.9);
    transform: scale(1.03);
`;

function removePlanetSelectionUI() {
    if (selectorContainer && selectorContainer.parentNode) {
        selectorContainer.parentNode.removeChild(selectorContainer);
        selectorContainer = null;
    }
}

async function launchDebugMode(planetType: string) {
    console.log(`🪐 Launching debug mode for selected planet: ${planetType}`);
    sessionStorage.setItem(storageKeys.DEBUG_PLANET_TYPE, planetType);
    removePlanetSelectionUI();

    // --- Clean up welcome screen elements --- 
    // Access the globally exposed scene
    const mainScene = (window as any).globalScene;
    
    if (mainScene) {
        console.log("🧹 Attempting to clean up welcome screen elements...");
        try {
            cleanupWelcomeScreen(mainScene); 
        } catch(err) {
             console.error("Error during cleanupWelcomeScreen call:", err);
             // Fallback: Manually remove known elements if cleanup fails
             const textMesh = mainScene.getObjectByName("welcomeTextShaderPlane"); // Use the correct name found before
             if(textMesh) mainScene.remove(textMesh);
             const tunnel = mainScene.getObjectByName("welcomeTunnel"); // Use the correct name found before
             if(tunnel) mainScene.remove(tunnel);
             // Add removals for other known welcome elements (planets, title text)
             // e.g., mainScene.remove(mainScene.getObjectByName("staticPlanetsGroup")); 
        }
    } else {
        // Keep the warning, but it should hopefully find the scene now
        console.warn("Could not find globalScene reference on window object!"); 
    }
    // --------------------------------------

    try {
        await import('./firstPerson_debug');
        console.log("✅ Debug Mode Script Initialized.");
    } catch (error) {
        console.error("❌ Error loading or running debug mode script:", error);
        // Optionally, show an error message
    }
}

export function showPlanetSelectionUI() {
    if (selectorContainer) return; // Already shown

    console.log("🌍 Showing Planet Selection UI...");

    selectorContainer = document.createElement('div');
    selectorContainer.id = 'planet-selector-ui';
    selectorContainer.style.cssText = containerStyle;

    const title = document.createElement('h1');
    title.textContent = 'Select Planet Type for Debug';
    title.style.marginBottom = '20px';
    selectorContainer.appendChild(title);

    const planetGrid = document.createElement('div');
    planetGrid.style.cssText = gridStyle;

    // Get categories
    const categories: { [key: string]: string[] } = {};
    for (const typeKey in planetTypes) {
        const category = planetTypes[typeKey].category || 'uncategorized';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push(typeKey);
    }

    // Sort categories and types within categories
    const sortedCategories = Object.keys(categories).sort();

    sortedCategories.forEach(category => {
        // Add category header
        const categoryHeader = document.createElement('h3');
        categoryHeader.textContent = category.replace(/_/g, ' ').toUpperCase();
        categoryHeader.style.gridColumn = '1 / -1'; // Span full width
        categoryHeader.style.marginTop = '15px';
        categoryHeader.style.marginBottom = '5px';
        categoryHeader.style.borderBottom = '1px solid #666';
        categoryHeader.style.paddingBottom = '5px';
        planetGrid.appendChild(categoryHeader);

        // Sort planet types within the category
        categories[category].sort().forEach(typeKey => {
            const button = document.createElement('button');
            button.textContent = typeKey.replace(/_/g, ' '); // Make names readable
            button.style.cssText = buttonStyle;
            button.title = planetTypes[typeKey].description || ''; // Add description on hover

            button.onmouseover = () => button.style.cssText = buttonStyle + buttonHoverStyle;
            button.onmouseout = () => button.style.cssText = buttonStyle;

            button.addEventListener('click', () => launchDebugMode(typeKey));
            planetGrid.appendChild(button);
        });
    });


    selectorContainer.appendChild(planetGrid);
    document.body.appendChild(selectorContainer);
}

// Define GenerationParams based on isolatedTerrainViewer's needs (if not already globally available from types_debug.ts in a suitable way)
interface GenerationParamsForViewer {
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    noiseScale?: number;
    planetOffset?: THREE.Vector3;
}

export async function getPlanetGenerationParams(
    planetTypeOrRandom: string,
    inputSeedString?: string
): Promise<GenerationParamsForViewer | null> {
    let actualPlanetType = planetTypeOrRandom;
    if (planetTypeOrRandom.toLowerCase() === 'random') {
        const availableTypes = Object.keys(planetTypes);
        if (availableTypes.length === 0) {
            console.error("No planet types available for random selection.");
            return null;
        }
        actualPlanetType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        console.log(`Randomly selected planet: ${actualPlanetType}`);
    }

    if (!planetTypes[actualPlanetType]) {
        console.error(`Unknown planet type requested: ${actualPlanetType}`);
        return null;
    }

    const compInfo = getPlanetCompositionInfo(actualPlanetType);
    if (!compInfo || !compInfo.topElements) {
        console.error(`Could not get composition info for ${actualPlanetType}`);
        return null;
    }

    let seed: Seed;
    if (inputSeedString) {
        const parsedSeed = parseFloat(inputSeedString);
        if (!isNaN(parsedSeed)) {
            seed = parsedSeed;
        } else {
            console.warn(`Invalid inputSeedString: ${inputSeedString}. Using random seed.`);
            seed = Math.random(); 
        }
    } else {
        seed = Math.random(); // Generate a random number for seed
    }

    // Ensure noiseLayers from planetTypes is number[] or use default
    const pType = planetTypes[actualPlanetType] as any; // Use 'as any' for easier access to potentially untyped fields
    const noiseLayers: NoiseLayers = (Array.isArray(pType?.noiseLayers) && pType.noiseLayers.every((n: any) => typeof n === 'number')) 
        ? pType.noiseLayers 
        : [50, 30, 15, 8, 4]; 

    const noiseScale: number = (typeof pType?.noiseScale === 'number') 
        ? pType.noiseScale 
        : (SHARED_NOISE_SCALE || 0.05);
    
    let planetOffset: THREE.Vector3;
    if (pType?.planetOffset && 
        typeof pType.planetOffset.x === 'number' &&
        typeof pType.planetOffset.y === 'number' &&
        typeof pType.planetOffset.z === 'number') {
        planetOffset = new THREE.Vector3(
            pType.planetOffset.x,
            pType.planetOffset.y,
            pType.planetOffset.z
        );
    } else {
        planetOffset = new THREE.Vector3(
            parseFloat((Math.random() * 2000 - 1000).toFixed(3)),
            parseFloat((Math.random() * 2000 - 1000).toFixed(3)),
            parseFloat((Math.random() * 2000 - 1000).toFixed(3))
        );
    }
    
    // Format seed for logging to avoid overly long numbers
    const seedLog = seed.toString().length > 8 ? seed.toExponential(2) : seed.toString();
    console.log(`[getPlanetGenerationParams] For ${actualPlanetType}: Seed: ${seedLog}, NoiseScale: ${noiseScale.toFixed(3)}, Offset: x:${planetOffset.x.toFixed(1)},y:${planetOffset.y.toFixed(1)},z:${planetOffset.z.toFixed(1)}`);

    return {
        noiseLayers,
        seed,
        compInfo: { topElements: compInfo.topElements },
        noiseScale,
        planetOffset,
    };
} 