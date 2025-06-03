/**
 * Improved Mining Hover Panel
 * This module provides a better hover panel for mining composition data
 * that correctly shows both surface and internal grid composition.
 */

import * as THREE from 'three';
import { miningPanelStateManager } from './miningPanelState.js';

// Reference to the volume composition analyzer function
let analyzeVolumeComposition = null;

// Try to get the function from the global scope
if (typeof window !== 'undefined' && window.analyzeVolumeComposition) {
    analyzeVolumeComposition = window.analyzeVolumeComposition;
    console.log("[ImprovedMiningHoverPanel] Found analyzeVolumeComposition in global scope");
} else {
    console.warn("[ImprovedMiningHoverPanel] analyzeVolumeComposition not found in global scope");

    // Define a placeholder function that will show an error message
    analyzeVolumeComposition = function() {
        console.error("[ImprovedMiningHoverPanel] analyzeVolumeComposition called before it was properly initialized");
        return {
            totalPoints: 0,
            materialCounts: {},
            boundingBox: {
                min: new THREE.Vector3(),
                max: new THREE.Vector3(),
                size: new THREE.Vector3()
            },
            calculationTime: 0
        };
    };
}

// Global panel reference
let hoverPanel = null;
let forceUpdateButton = null;

/**
 * Initialize the improved mining hover panel
 * @returns {HTMLElement} The hover panel element
 */
export function initImprovedMiningHoverPanel() {
    console.log("[ImprovedMiningHoverPanel] Initializing...");

    // Remove existing panel if it exists
    if (hoverPanel) {
        if (hoverPanel.parentNode) {
            hoverPanel.parentNode.removeChild(hoverPanel);
        }
        hoverPanel = null;
    }

    // Create the hover panel
    hoverPanel = document.createElement('div');
    hoverPanel.id = 'improved-mining-hover-panel';
    hoverPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        width: 300px;
        background-color: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        z-index: 99999999;
        box-shadow: 0 0 15px rgba(0, 255, 0, 0.7);
        border: 2px solid #00ff00;
        max-height: 80vh;
        overflow-y: auto;
        display: none !important;
    `;

    // Add to document body
    document.body.appendChild(hoverPanel);

    // Create force update button
    forceUpdateButton = createForceUpdateButton();

    // Try to get the analyzeVolumeComposition function again
    if (typeof window !== 'undefined' && window.analyzeVolumeComposition && !analyzeVolumeComposition) {
        analyzeVolumeComposition = window.analyzeVolumeComposition;
        console.log("[ImprovedMiningHoverPanel] Found analyzeVolumeComposition during initialization");
    }

    console.log("[ImprovedMiningHoverPanel] Initialized successfully");

    return hoverPanel;
}

/**
 * Create a button to force update the hover panel
 * @returns {HTMLElement} The force update button
 */
function createForceUpdateButton() {
    if (forceUpdateButton) {
        if (forceUpdateButton.parentNode) {
            forceUpdateButton.parentNode.removeChild(forceUpdateButton);
        }
    }

    forceUpdateButton = document.createElement('button');
    forceUpdateButton.id = 'force-update-mining-hover-panel';
    forceUpdateButton.textContent = 'Force Update';
    forceUpdateButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background-color: #555;
        color: white;
        border: none;
        border-radius: 3px;
        padding: 3px 8px;
        font-size: 12px;
        cursor: pointer;
    `;

    // Add click event listener
    forceUpdateButton.addEventListener('click', () => {
        showImprovedMiningHoverPanel('Forced update at ' + new Date().toLocaleTimeString());
    });

    // Add to the hover panel instead of document body
    if (hoverPanel) {
        hoverPanel.appendChild(forceUpdateButton);
    } else {
        // Fallback to document body if hover panel doesn't exist
        document.body.appendChild(forceUpdateButton);
    }

    return forceUpdateButton;
}

/**
 * Update the hover panel with composition data from both surface mesh and internal grid layers
 * @param {THREE.Vector3} position - Position of the hover point
 * @param {Object} volumeData - Volume composition data
 * @param {Object} brushInfo - Brush information (shape, radius)
 */
export function updateImprovedMiningHoverPanel(position, volumeData, brushInfo) {
    console.log("[ImprovedMiningHoverPanel] Updating with new data");

    // Create panel if it doesn't exist
    if (!hoverPanel) {
        initImprovedMiningHoverPanel();
    }

    // Ensure panel is visible
    if (hoverPanel) {
        hoverPanel.style.setProperty('display', 'block', 'important');

        // Position in front of mining panel if it's active
        if (miningPanelStateManager.isActive()) {
            miningPanelStateManager.positionInFront(hoverPanel);
        } else {
            // Default position if mining panel is not active
            hoverPanel.style.setProperty('position', 'fixed', 'important');
            hoverPanel.style.setProperty('top', '20px', 'important');
            hoverPanel.style.setProperty('left', '20px', 'important');
        }
    }

    // Check if volumeData is valid
    if (!volumeData) {
        console.warn("[ImprovedMiningHoverPanel] Volume data is null or undefined");
        showImprovedMiningHoverPanel("No volume data available. Try moving the mouse over the terrain.");
        return;
    }

    // Format the materials data
    let surfaceMaterialsHtml = '';
    let internalGridsHtml = '';
    let totalCompositionHtml = '';

    if (volumeData && volumeData.materialCounts) {
        try {
            // Sort materials by percentage for surface composition
            const surfaceMaterials = Object.values(volumeData.materialCounts)
                .sort((a, b) => b.percentage - a.percentage);

            // Calculate total voxels for a 32³ grid (typical internal grid size)
            const totalVoxels = 32768; // 32^3

            // Generate HTML for each material
            surfaceMaterials.forEach(material => {
                const estimatedUnits = Math.round((material.percentage / 100) * totalVoxels);
                const colorHex = '#' + material.materialColor.getHexString();

                totalCompositionHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="display: inline-block; width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px; border: 1px solid #666;"></span>
                            <span style="color: ${colorHex}; font-weight: bold;">${material.materialSymbol}</span>
                            <span style="margin-left: 5px; color: #ccc;">${material.materialName}</span>
                        </div>
                        <div>
                            <span style="color: #aaa;">${material.percentage.toFixed(1)}%</span>
                            <span style="margin-left: 5px; color: #ffcc00; font-weight: bold;">~${estimatedUnits.toLocaleString()} units</span>
                        </div>
                    </div>
                `;
            });

            // Calculate surface vs internal grid distribution
            // For demonstration, we'll assume the top layer is the surface (1/9 of total points)
            // and the rest are internal grid layers (8/9 of total points)
            const surfacePoints = Math.round(volumeData.totalPoints / 9);
            const internalPoints = volumeData.totalPoints - surfacePoints;

            // Generate HTML for surface vs internal grid distribution
            internalGridsHtml = `
                <div style="margin-top: 10px; padding: 5px; background-color: rgba(50, 50, 50, 0.5); border-radius: 3px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Surface Layer:</span>
                        <span style="color: #8aff8a;">${surfacePoints.toLocaleString()} points</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Internal Grid Layers:</span>
                        <span style="color: #8aff8a;">${internalPoints.toLocaleString()} points</span>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("[ImprovedMiningHoverPanel] Error formatting materials:", error);
            totalCompositionHtml = `<div style="color: red;">Error formatting materials: ${error.message}</div>`;
        }
    } else {
        totalCompositionHtml = `<div style="color: yellow;">No material data available</div>`;
    }

    // Set the panel content
    hoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING COMPOSITION
        </div>

        <div style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Position:</span>
                <span style="color: #8aff8a;">X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>Brush:</span>
                <span style="color: #8aff8a;">${brushInfo.shape}, Radius: ${brushInfo.radius}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span>Total Points:</span>
                <span style="color: #8aff8a;">${volumeData.totalPoints.toLocaleString()}</span>
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #ffcc00; border-bottom: 1px solid #ffcc00; padding-bottom: 3px;">
                Total Volume Composition (Surface + Internal)
            </div>
            ${totalCompositionHtml}
        </div>

        <div style="margin-bottom: 15px;">
            <div style="font-weight: bold; margin-bottom: 5px; color: #ffcc00; border-bottom: 1px solid #ffcc00; padding-bottom: 3px;">
                Distribution
            </div>
            ${internalGridsHtml}
        </div>

        <div style="font-size: 11px; color: #999; margin-top: 10px; text-align: center; font-style: italic;">
            Last updated: ${new Date().toLocaleTimeString()}
        </div>
    `;
}

/**
 * Show a basic message in the hover panel
 * @param {string} message - Message to display
 */
export function showImprovedMiningHoverPanel(message) {
    if (!hoverPanel) {
        initImprovedMiningHoverPanel();
    }

    if (hoverPanel) {
        hoverPanel.style.setProperty('display', 'block', 'important');

        // Position in front of mining panel if it's active
        if (miningPanelStateManager.isActive()) {
            miningPanelStateManager.positionInFront(hoverPanel);
        } else {
            // Default position if mining panel is not active
            hoverPanel.style.setProperty('position', 'fixed', 'important');
            hoverPanel.style.setProperty('top', '20px', 'important');
            hoverPanel.style.setProperty('left', '20px', 'important');
        }

        // Add a timestamp to show it was forced
        const timestamp = new Date().toLocaleTimeString();
        hoverPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
                MINING COMPOSITION
            </div>
            <div style="color: yellow; font-size: 16px;">
                ${message || 'Panel forced visible at ' + timestamp}
            </div>
            <div style="margin-top: 10px; color: white;">
                Move mouse over terrain to see composition data
            </div>
        `;
    }
}

/**
 * Hide the hover panel
 */
export function hideImprovedMiningHoverPanel() {
    if (hoverPanel) {
        hoverPanel.style.setProperty('display', 'none', 'important');
    }
}

/**
 * Handle terrain hover event
 * @param {Event} event - Mouse event
 * @param {THREE.Raycaster} raycaster - Raycaster for intersection testing
 * @param {THREE.Mesh} terrain - Terrain mesh
 * @param {Object} dependencies - Mining dependencies
 * @param {Object} brushInfo - Brush information (shape, radius)
 */
export function handleTerrainHover(event, raycaster, terrain, dependencies, brushInfo) {
    // Update the raycaster with the mouse position
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, dependencies.camera);

    // Check for intersections with the terrain
    const intersects = raycaster.intersectObject(terrain);

    if (intersects.length > 0) {
        const point = intersects[0].point;

        // Only analyze composition if we have the necessary dependencies
        if (dependencies.compInfo && dependencies.compInfo.topElements) {
            try {
                // Analyze volume composition at the hover point
                const volumeData = analyzeVolumeComposition(
                    point,
                    dependencies.compInfo.topElements,
                    dependencies.noiseScale || 0.1,
                    dependencies.planetOffset || new THREE.Vector3(0, 0, 0),
                    brushInfo.radius,
                    brushInfo.shape,
                    1, // Default verticality
                    20, // Higher resolution for more accurate analysis
                    8,  // 8 depth layers to match mining operation
                    0.25 // Default layer spacing
                );

                // Update the hover panel with the composition data
                updateImprovedMiningHoverPanel(point, volumeData, brushInfo);
            } catch (error) {
                console.error("Error analyzing volume composition:", error);
                showImprovedMiningHoverPanel(`Error analyzing composition: ${error.message}`);
            }
        } else {
            showImprovedMiningHoverPanel("Missing dependencies for composition analysis");
        }
    } else {
        // No intersection, hide the panel
        hideImprovedMiningHoverPanel();
    }
}

// Export the interface for global access
export const improvedMiningHoverPanel = {
    init: initImprovedMiningHoverPanel,
    update: updateImprovedMiningHoverPanel,
    show: showImprovedMiningHoverPanel,
    hide: hideImprovedMiningHoverPanel,
    handleHover: handleTerrainHover
};

// Make the interface available globally
if (typeof window !== 'undefined') {
    window.improvedMiningHoverPanel = improvedMiningHoverPanel;

    // Auto-initialize after a short delay to ensure dependencies are loaded
    setTimeout(() => {
        if (window.analyzeVolumeComposition && !analyzeVolumeComposition) {
            analyzeVolumeComposition = window.analyzeVolumeComposition;
            console.log("[ImprovedMiningHoverPanel] Auto-initialized analyzeVolumeComposition");
        }

        // Initialize but don't show the panel - only show when hovering over terrain
        if (!hoverPanel) {
            initImprovedMiningHoverPanel();
        }

        // Make sure the panel is hidden by default
        hideImprovedMiningHoverPanel();
        console.log("[ImprovedMiningHoverPanel] Panel initialized and hidden by default");
    }, 2000);
}
