import * as THREE from 'three';
import { 
    initCoreViewer, 
    cleanupCoreViewer, 
    getScene, 
    getCamera, 
    getRenderer,
    startAnimation,
    stopAnimation,
    getOrbitControls,
    getContainer,
    setGenerationParams,
    getCurrentNoiseLayers,
    getCurrentSeed,
    getCurrentCompInfo,
    getCurrentNoiseScale,
    getCurrentPlanetOffset
} from './core';
import { 
    initPhysics, 
    cleanupPhysics, 
    updatePhysics, 
    startPhysicsSimulation, 
    stopPhysicsSimulation,
    togglePhysicsDebug,
    getPhysicsWorld,
    getGroundMaterial,
    getCharacterMaterial,
    isPhysicsInitialized,
    addBody,
    removeBody
} from './physics';
import { 
    initMining, 
    cleanupMining, 
    updateMiningEffects, 
    toggleMiningPanel,
    getPlayerInventory,
    getMiningTools,
    getActiveTool,
    getResourceCalculationResult,
    isMiningPanelVisible,
    setActiveTool
} from './mining';
import { 
    enterFirstPersonMode, 
    exitFirstPersonMode, 
    enterThirdPersonMode, 
    exitThirdPersonMode, 
    updateCamera, 
    cleanupCamera,
    getActiveCamera,
    isInFirstPersonMode,
    isInThirdPersonMode,
    getFirstPersonCamera,
    getThirdPersonCamera
} from './camera';
import { 
    generateTerrain, 
    cleanupTerrain, 
    updateBrushVisualizer,
    setBrushRadius,
    setBrushStrength,
    setBrushShape,
    setBrushVerticality,
    setBrushMode,
    getBrushRadius,
    getBrushStrength,
    getBrushShape,
    getBrushVerticality,
    getBrushMode,
    getLoadedChunkData,
    getGeneratedChunkKeys
} from './terrain';
import { 
    addTrueChunkBoundariesVisualization, 
    removeTrueChunkBoundariesVisualization, 
    toggleWorldChunkBoundaries, 
    cleanupBoundaries,
    areWorldBoundariesVisible,
    getTrueChunkBoundariesGroup,
    getWorldChunkBoundariesGroup
} from './boundaries';

// Main initialization
export function initIsolatedViewer(container: HTMLDivElement) {
    // Initialize core viewer
    initCoreViewer(container);

    // Initialize physics
    initPhysics();

    // Initialize mining
    initMining(container);

    // Start physics simulation
    startPhysicsSimulation();
}

// Main update loop
export function updateIsolatedViewer() {
    // Update physics
    updatePhysics();

    // Update camera
    updateCamera();

    // Update mining effects
    updateMiningEffects();
}

// Main cleanup
export function cleanupIsolatedViewer() {
    // Clean up all modules
    cleanupCoreViewer();
    cleanupPhysics();
    cleanupMining();
    cleanupCamera();
    cleanupTerrain();
    cleanupBoundaries();
}

// Re-export all necessary functions
export {
    // Core
    getScene,
    getCamera,
    getRenderer,
    startAnimation,
    stopAnimation,
    getOrbitControls,
    getContainer,
    setGenerationParams,
    getCurrentNoiseLayers,
    getCurrentSeed,
    getCurrentCompInfo,
    getCurrentNoiseScale,
    getCurrentPlanetOffset,

    // Physics
    startPhysicsSimulation,
    stopPhysicsSimulation,
    togglePhysicsDebug,
    getPhysicsWorld,
    getGroundMaterial,
    getCharacterMaterial,
    isPhysicsInitialized,
    addBody,
    removeBody,

    // Mining
    toggleMiningPanel,
    getPlayerInventory,
    getMiningTools,
    getActiveTool,
    getResourceCalculationResult,
    isMiningPanelVisible,
    setActiveTool,

    // Camera
    enterFirstPersonMode,
    exitFirstPersonMode,
    enterThirdPersonMode,
    exitThirdPersonMode,
    getActiveCamera,
    isInFirstPersonMode,
    isInThirdPersonMode,
    getFirstPersonCamera,
    getThirdPersonCamera,

    // Terrain
    generateTerrain,
    updateBrushVisualizer,
    setBrushRadius,
    setBrushStrength,
    setBrushShape,
    setBrushVerticality,
    setBrushMode,
    getBrushRadius,
    getBrushStrength,
    getBrushShape,
    getBrushVerticality,
    getBrushMode,
    getLoadedChunkData,
    getGeneratedChunkKeys,

    // Boundaries
    addTrueChunkBoundariesVisualization,
    removeTrueChunkBoundariesVisualization,
    toggleWorldChunkBoundaries,
    areWorldBoundariesVisible,
    getTrueChunkBoundariesGroup,
    getWorldChunkBoundariesGroup
}; 