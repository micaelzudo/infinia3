import * as THREE from 'three';
import { createAdvancedPanel } from './ui/advancedPanel';
import { MarchingCubes } from './meshGenerator';

// Interface for saved terrain states
interface TerrainState {
    id: string;
    name: string;
    timestamp: number;
    noiseLayers: number[];
    threshold: number;
    colorScheme: string;
    quality: number;
    enabledFeatures: string[];
}

/**
 * Initialize and integrate the advanced control panel with the application
 * @param marchingCubesInstance The marching cubes instance to control
 * @param scene The THREE.js scene
 * @returns The created panel element
 */
export function initializeAdvancedPanel(
    marchingCubesInstance: MarchingCubes, 
    scene: THREE.Scene
): HTMLElement {
    
    // Track current state
    let currentState = {
        noiseLayers: [50, 25, 10, 5],
        threshold: 0.0,
        colorScheme: 'terrain',
        quality: 32,
        enabledFeatures: [] as string[]
    };
    
    // Create and configure the panel
    const panel = createAdvancedPanel({
        defaultNoiseLayers: currentState.noiseLayers,
        defaultThreshold: currentState.threshold,
        defaultColorScheme: currentState.colorScheme,
        defaultQuality: currentState.quality,
        
        // Handle noise layer updates
        onNoiseLayerUpdate: (layers) => {
            console.log('Updating noise layers:', layers);
            currentState.noiseLayers = layers;
            marchingCubesInstance.setNoiseLayers(layers);
        },
        
        // Handle threshold updates
        onThresholdUpdate: (threshold) => {
            console.log('Updating threshold:', threshold);
            currentState.threshold = threshold;
            marchingCubesInstance.setThreshold(threshold);
        },
        
        // Handle color scheme updates
        onColorSchemeUpdate: (scheme) => {
            console.log('Updating color scheme:', scheme);
            currentState.colorScheme = scheme;
            applyColorScheme(marchingCubesInstance, scheme);
        },
        
        // Handle quality/resolution updates
        onQualityUpdate: (quality) => {
            console.log('Updating quality:', quality);
            currentState.quality = quality;
            marchingCubesInstance.setResolution(quality);
        },
        
        // Handle terrain feature toggles
        onTerrainFeatureToggle: (feature, enabled) => {
            console.log(`${enabled ? 'Enabling' : 'Disabling'} feature:`, feature);
            
            if (enabled) {
                if (!currentState.enabledFeatures.includes(feature)) {
                    currentState.enabledFeatures.push(feature);
                }
            } else {
                currentState.enabledFeatures = currentState.enabledFeatures.filter(f => f !== feature);
            }
            
            applyTerrainFeatures(marchingCubesInstance, currentState.enabledFeatures);
        },
        
        // Handle view mode changes
        onViewModeChange: (mode) => {
            console.log('Changing view mode:', mode);
            applyViewMode(marchingCubesInstance, mode);
        },
        
        // Handle saving current state
        onSaveState: () => {
            const stateId = `terrain_${Date.now()}`;
            const stateName = `Terrain ${new Date().toLocaleString()}`;
            
            const state: TerrainState = {
                id: stateId,
                name: stateName,
                timestamp: Date.now(),
                noiseLayers: [...currentState.noiseLayers],
                threshold: currentState.threshold,
                colorScheme: currentState.colorScheme,
                quality: currentState.quality,
                enabledFeatures: [...currentState.enabledFeatures]
            };
            
            // Save to localStorage
            saveTerrainState(state);
            console.log('Saved state:', state);
            
            // Update the states dropdown
            updateSavedStatesDropdown();
        },
        
        // Handle loading a saved state
        onLoadState: (stateId) => {
            const state = loadTerrainState(stateId);
            if (state) {
                console.log('Loading state:', state);
                
                // Update current state
                currentState = {
                    noiseLayers: state.noiseLayers,
                    threshold: state.threshold,
                    colorScheme: state.colorScheme,
                    quality: state.quality,
                    enabledFeatures: state.enabledFeatures
                };
                
                // Apply state to marching cubes
                marchingCubesInstance.setNoiseLayers(state.noiseLayers);
                marchingCubesInstance.setThreshold(state.threshold);
                marchingCubesInstance.setResolution(state.quality);
                applyColorScheme(marchingCubesInstance, state.colorScheme);
                applyTerrainFeatures(marchingCubesInstance, state.enabledFeatures);
            }
        },
        
        // Handle resetting to defaults
        onResetDefaults: () => {
            console.log('Resetting to defaults');
            
            // Reset current state
            currentState = {
                noiseLayers: [50, 25, 10, 5],
                threshold: 0.0,
                colorScheme: 'terrain',
                quality: 32,
                enabledFeatures: []
            };
            
            // Apply defaults to marching cubes
            marchingCubesInstance.setNoiseLayers(currentState.noiseLayers);
            marchingCubesInstance.setThreshold(currentState.threshold);
            marchingCubesInstance.setResolution(currentState.quality);
            applyColorScheme(marchingCubesInstance, currentState.colorScheme);
            applyTerrainFeatures(marchingCubesInstance, []);
            applyViewMode(marchingCubesInstance, 'normal');
        }
    });
    
    // Initialize saved states dropdown
    updateSavedStatesDropdown();
    
    return panel;
}

/**
 * Apply color scheme to the marching cubes material
 */
function applyColorScheme(marchingCubes: MarchingCubes, scheme: string): void {
    const schemes: { [key: string]: THREE.Color[] } = {
        terrain: [
            new THREE.Color(0x2d4413), // Deep green for low areas
            new THREE.Color(0x3d6b29), // Mid green
            new THREE.Color(0x83a866), // Light green for mid elevations
            new THREE.Color(0xd8d8d0), // Light gray for peaks
            new THREE.Color(0xffffff)  // White for highest peaks
        ],
        desert: [
            new THREE.Color(0x8b4513), // Brown
            new THREE.Color(0xcd853f), // Peru
            new THREE.Color(0xdeb887), // Burlywood
            new THREE.Color(0xf5deb3), // Wheat
            new THREE.Color(0xfaebd7)  // Antique white
        ],
        volcanic: [
            new THREE.Color(0x000000), // Black
            new THREE.Color(0x3a0000), // Very dark red
            new THREE.Color(0x800000), // Maroon
            new THREE.Color(0xff4500), // Orange red
            new THREE.Color(0xff8c00)  // Dark orange
        ],
        arctic: [
            new THREE.Color(0x0a1a2a), // Very dark blue
            new THREE.Color(0x4682b4), // Steel blue
            new THREE.Color(0xadd8e6), // Light blue
            new THREE.Color(0xe0ffff), // Light cyan
            new THREE.Color(0xffffff)  // White
        ],
        alien: [
            new THREE.Color(0x2a0a38), // Dark purple
            new THREE.Color(0x5a1a64), // Purple
            new THREE.Color(0x9932cc), // Dark orchid
            new THREE.Color(0x00fa9a), // Medium spring green
            new THREE.Color(0x7cfc00)  // Lawn green
        ],
        ocean: [
            new THREE.Color(0x000033), // Very dark blue
            new THREE.Color(0x000080), // Navy
            new THREE.Color(0x0000cd), // Medium blue
            new THREE.Color(0x4169e1), // Royal blue
            new THREE.Color(0x87ceeb)  // Sky blue
        ]
    };
    
    if (schemes[scheme]) {
        marchingCubes.setColorScheme(schemes[scheme]);
    }
}

/**
 * Apply terrain features based on enabled features list
 */
function applyTerrainFeatures(marchingCubes: MarchingCubes, features: string[]): void {
    // Enable/disable each feature in the marching cubes instance
    
    // Example implementation (adjust based on your actual implementation)
    if (features.includes('caves')) {
        marchingCubes.enableCaves();
    } else {
        marchingCubes.disableCaves();
    }
    
    if (features.includes('mountains')) {
        marchingCubes.enhanceMountains();
    } else {
        marchingCubes.resetMountains();
    }
    
    if (features.includes('valleys')) {
        marchingCubes.enableDeepValleys();
    } else {
        marchingCubes.disableDeepValleys();
    }
    
    if (features.includes('plateaus')) {
        marchingCubes.enablePlateaus();
    } else {
        marchingCubes.disablePlateaus();
    }
    
    if (features.includes('islands')) {
        marchingCubes.enableFloatingIslands();
    } else {
        marchingCubes.disableFloatingIslands();
    }
}

/**
 * Apply view mode to marching cubes renderer
 */
function applyViewMode(marchingCubes: MarchingCubes, mode: string): void {
    switch (mode) {
        case 'wireframe':
            marchingCubes.toggleWireframe(true);
            marchingCubes.setMaterialOpacity(1.0);
            break;
        case 'xray':
            marchingCubes.toggleWireframe(false);
            marchingCubes.setMaterialOpacity(0.6);
            break;
        case 'heightmap':
            marchingCubes.toggleWireframe(false);
            marchingCubes.setMaterialOpacity(1.0);
            marchingCubes.enableHeightMap();
            break;
        case 'normal':
        default:
            marchingCubes.toggleWireframe(false);
            marchingCubes.setMaterialOpacity(1.0);
            marchingCubes.disableHeightMap();
            break;
    }
}

/**
 * Save terrain state to localStorage
 */
function saveTerrainState(state: TerrainState): void {
    // Get existing states
    const existingStatesJson = localStorage.getItem('terrain_states');
    let terrainStates: TerrainState[] = [];
    
    if (existingStatesJson) {
        try {
            terrainStates = JSON.parse(existingStatesJson);
        } catch (e) {
            console.error('Error parsing saved terrain states:', e);
        }
    }
    
    // Add new state
    terrainStates.push(state);
    
    // Limit to 10 saved states
    if (terrainStates.length > 10) {
        terrainStates = terrainStates.slice(-10);
    }
    
    // Save back to localStorage
    localStorage.setItem('terrain_states', JSON.stringify(terrainStates));
}

/**
 * Load terrain state from localStorage
 */
function loadTerrainState(stateId: string): TerrainState | null {
    const existingStatesJson = localStorage.getItem('terrain_states');
    
    if (existingStatesJson) {
        try {
            const terrainStates: TerrainState[] = JSON.parse(existingStatesJson);
            return terrainStates.find(state => state.id === stateId) || null;
        } catch (e) {
            console.error('Error parsing saved terrain states:', e);
        }
    }
    
    return null;
}

/**
 * Update the saved states dropdown with states from localStorage
 */
function updateSavedStatesDropdown(): void {
    const savedStatesSelect = document.querySelector('#advanced-control-panel select') as HTMLSelectElement;
    if (!savedStatesSelect) return;
    
    // Clear existing options except the placeholder
    while (savedStatesSelect.options.length > 1) {
        savedStatesSelect.remove(1);
    }
    
    // Get saved states
    const existingStatesJson = localStorage.getItem('terrain_states');
    if (existingStatesJson) {
        try {
            const terrainStates: TerrainState[] = JSON.parse(existingStatesJson);
            
            // Add options to dropdown
            terrainStates.forEach(state => {
                const option = document.createElement('option');
                option.value = state.id;
                
                // Format date for display
                const date = new Date(state.timestamp);
                const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
                
                option.textContent = `${state.name} (${formattedDate})`;
                savedStatesSelect.appendChild(option);
            });
        } catch (e) {
            console.error('Error parsing saved terrain states:', e);
        }
    }
} 