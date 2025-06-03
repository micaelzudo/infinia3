/**
 * Consolidated Mining Hover Panel
 * This module provides a single, unified hover panel implementation for mining information
 * that consolidates functionality from all previous hover panel implementations.
 * It shows composition data from both the surface mesh and internal grid layers.
 */

import * as THREE from 'three';
import { miningPanelStateManager } from './miningPanelState.js';

// Define analyzeVolumeComposition function to use the global one
// This avoids import issues with the .js extension
let analyzeVolumeComposition;
if (typeof window !== 'undefined') {
    // Try to get the function from the window object
    analyzeVolumeComposition = window.analyzeVolumeComposition;

    // If not available, define a placeholder that will be updated later
    if (!analyzeVolumeComposition) {
        console.warn("[ConsolidatedMiningHoverPanel] analyzeVolumeComposition not available yet, will try again later");

        // Define a placeholder function that will show an error message
        analyzeVolumeComposition = function() {
            console.error("[ConsolidatedMiningHoverPanel] analyzeVolumeComposition called before it was properly initialized");
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
}

// Global panel reference
let hoverPanel = null;
let forceUpdateButton = null;

/**
 * Initialize the consolidated mining hover panel
 */
export function initConsolidatedMiningHoverPanel() {
    console.log("[ConsolidatedMiningHoverPanel] Initializing...");

    // Check if analyzeVolumeComposition is available
    if (!analyzeVolumeComposition && window.analyzeVolumeComposition) {
        analyzeVolumeComposition = window.analyzeVolumeComposition;
        console.log("[ConsolidatedMiningHoverPanel] Found analyzeVolumeComposition function");
    } else if (!analyzeVolumeComposition) {
        console.warn("[ConsolidatedMiningHoverPanel] analyzeVolumeComposition function not available yet");
    }

    // Remove existing panel if it exists
    if (hoverPanel) {
        if (hoverPanel.parentNode) {
            hoverPanel.parentNode.removeChild(hoverPanel);
        }
        hoverPanel = null;
    }

    // Create the panel element
    hoverPanel = document.createElement('div');
    hoverPanel.id = 'consolidated-mining-hover-panel';

    // Apply styles - position fixed to ensure it's on top of everything
    const styles = {
        'position': 'fixed',
        'top': '20px',
        'left': '20px',
        'width': '300px',
        'max-height': '80vh',
        'overflow-y': 'auto',
        'background-color': 'rgba(0, 0, 0, 0.95)',
        'color': 'white',
        'border': '2px solid #ff5555',
        'border-radius': '5px',
        'padding': '15px',
        'font-family': 'monospace',
        'font-size': '14px',
        'z-index': '99999999',
        'box-shadow': '0 0 20px rgba(255, 0, 0, 0.7)',
        'display': 'none !important',
        'pointer-events': 'auto' // Allow interaction with the panel
    };

    // Apply styles with !important
    Object.entries(styles).forEach(([property, value]) => {
        hoverPanel.style.setProperty(property, value.toString(), 'important');
    });

    // Set initial content
    hoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING COMPOSITION ANALYSIS
        </div>
        <div style="color: yellow; font-size: 16px;">
            Move mouse over terrain to see composition data
        </div>
    `;

    // Add to document body
    document.body.appendChild(hoverPanel);

    // Create force update button
    createForceUpdateButton();

    // Make the panel draggable
    makeDraggable(hoverPanel);

    return hoverPanel;
}

/**
 * Create a button to force update the hover panel data
 */
function createForceUpdateButton() {
    // Remove existing button if it exists
    if (forceUpdateButton) {
        if (forceUpdateButton.parentNode) {
            forceUpdateButton.parentNode.removeChild(forceUpdateButton);
        }
        forceUpdateButton = null;
    }

    // Create the button
    forceUpdateButton = document.createElement('button');
    forceUpdateButton.id = 'force-update-hover-button';
    forceUpdateButton.textContent = 'FORCE UPDATE HOVER DATA';

    // Apply styles - position within the mining panel
    const styles = {
        'position': 'absolute',
        'bottom': '10px',
        'right': '10px',
        'background-color': '#ff5555',
        'color': 'white',
        'border': 'none',
        'border-radius': '5px',
        'padding': '8px 12px',
        'font-family': 'monospace',
        'font-weight': 'bold',
        'font-size': '12px',
        'cursor': 'pointer',
        'z-index': '10001',
        'box-shadow': '0 0 10px rgba(255, 0, 0, 0.5)'
    };

    // Apply styles with !important
    Object.entries(styles).forEach(([property, value]) => {
        forceUpdateButton.style.setProperty(property, value.toString(), 'important');
    });

    // Add click event listener
    forceUpdateButton.addEventListener('click', () => {
        showConsolidatedMiningHoverPanel('Forced update at ' + new Date().toLocaleTimeString());
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
 * Make an element draggable
 * @param {HTMLElement} element - The element to make draggable
 */
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    // Create a draggable header
    const header = document.createElement('div');
    header.style.cssText = 'cursor: move; padding: 5px; margin: -15px -15px 10px -15px; background-color: #333; border-bottom: 1px solid #555;';
    header.innerHTML = '<div style="font-size: 12px; color: #999; text-align: center;">Click and drag to move</div>';

    // Insert the header at the beginning of the element
    element.insertBefore(header, element.firstChild);

    // Mouse down event on the header
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // Get the mouse cursor position at startup
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // Call a function whenever the cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // Calculate the new cursor position
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // Set the element's new position
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        // Reset right position to avoid conflicts
        element.style.right = "auto";
    }

    function closeDragElement() {
        // Stop moving when mouse button is released
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

/**
 * Update the hover panel with composition data from both surface mesh and internal grid layers
 * @param {THREE.Vector3} position - Position of the hover point
 * @param {Object} volumeData - Volume composition data
 * @param {Object} brushInfo - Brush information (shape, radius)
 */
export function updateConsolidatedMiningHoverPanel(position, volumeData, brushInfo) {
    console.log("[ConsolidatedMiningHoverPanel] Updating with new data");

    // Create panel if it doesn't exist
    if (!hoverPanel) {
        initConsolidatedMiningHoverPanel();
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
        console.warn("[ConsolidatedMiningHoverPanel] Volume data is null or undefined");
        showConsolidatedMiningHoverPanel("No volume data available. Try moving the mouse over the terrain.");
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

            // Format surface materials
            surfaceMaterials.forEach(material => {
                const colorHex = '#' + material.materialColor.getHexString();
                surfaceMaterialsHtml += `
                    <div class="material-row" style="display: flex; justify-content: space-between; margin-bottom: 5px; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="display: inline-block; width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px; border: 1px solid #666;"></span>
                            <span style="color: ${colorHex}; font-weight: bold;">${material.materialSymbol}</span>
                            <span style="margin-left: 5px; color: #ccc;">${material.materialName}</span>
                        </div>
                        <div>
                            <span style="color: #fff; font-weight: bold;">${material.percentage.toFixed(1)}%</span>
                            <span style="margin-left: 5px; color: #aaa;">(${material.count} pts)</span>
                        </div>
                    </div>
                `;
            });

            // Calculate estimated total units based on a 32³ voxel grid for the surface layer
            const surfaceVoxels = 1024; // 32^2 (surface layer)
            let surfaceUnitsHtml = '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #555;">';
            surfaceUnitsHtml += '<div style="font-weight: bold; color: #aaa; margin-bottom: 5px;">Estimated Surface Units:</div>';

            surfaceMaterials.forEach(material => {
                const estimatedUnits = Math.round((material.percentage / 100) * surfaceVoxels);
                const colorHex = '#' + material.materialColor.getHexString();
                surfaceUnitsHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="color: ${colorHex};">${material.materialSymbol}</span>
                        <span style="color: #ddd;">${estimatedUnits.toLocaleString()} units</span>
                    </div>
                `;
            });
            surfaceUnitsHtml += '</div>';
            surfaceMaterialsHtml += surfaceUnitsHtml;

            // Format internal grid layers information
            // Calculate estimated total units based on a 32³ voxel grid for all internal layers
            const internalVoxels = 32768 - 1024; // 32^3 - 32^2 (all internal layers)
            internalGridsHtml += '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #555;">';
            internalGridsHtml += '<div style="font-weight: bold; color: #aaa; margin-bottom: 5px;">THEORETICAL Internal Grid Units:</div>';

            // Add explanation about theoretical units
            internalGridsHtml += `
                <div style="margin-bottom: 8px; font-size: 12px; color: #aaa; font-style: italic;">
                    These are the theoretical units that would exist in the internal grid layers below the surface.
                    The internal grid visualizer shows these as colored spheres.
                </div>
            `;

            // Calculate units per layer
            const layerVoxels = 1024; // 32^2 (one layer)
            const numLayers = 8; // Number of internal grid layers

            // Add layer information
            internalGridsHtml += `
                <div style="margin-bottom: 8px; font-size: 12px; color: #ffcc00;">
                    Showing ${numLayers} internal grid layers (${(numLayers * layerVoxels).toLocaleString()} total theoretical units)
                </div>
            `;

            surfaceMaterials.forEach(material => {
                const estimatedUnits = Math.round((material.percentage / 100) * internalVoxels);
                const colorHex = '#' + material.materialColor.getHexString();
                internalGridsHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span style="color: ${colorHex};">${material.materialSymbol}</span>
                        <span style="color: #ddd;">${estimatedUnits.toLocaleString()} theoretical units</span>
                    </div>
                `;
            });

            // Add per-layer breakdown
            internalGridsHtml += `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #555;">
                    <div style="font-weight: bold; color: #aaa; margin-bottom: 5px;">Per-Layer Breakdown:</div>
                    <div style="font-size: 12px; color: #ddd;">
                        Each internal grid layer contains approximately ${layerVoxels.toLocaleString()} units.
                    </div>
                </div>
            `;

            internalGridsHtml += '</div>';

            // Format total composition (surface + internal)
            totalCompositionHtml = '<div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #555;">';
            totalCompositionHtml += '<div style="font-weight: bold; color: #fff; margin-bottom: 8px;">TOTAL COMPOSITION (Surface + Internal):</div>';

            const totalVoxels = 32768; // 32^3
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
                            <span style="color: #fff; font-weight: bold;">${estimatedUnits.toLocaleString()}</span>
                            <span style="margin-left: 5px; color: #aaa;">units</span>
                        </div>
                    </div>
                `;
            });
            totalCompositionHtml += '</div>';

        } catch (error) {
            console.error("Error formatting materials for hover panel:", error);
            surfaceMaterialsHtml = `<div style="color: red;">Error formatting materials: ${error.message}</div>`;
        }
    } else {
        surfaceMaterialsHtml = '<div style="color: yellow;">No material data available</div>';
    }

    // Format position
    const positionText = position ?
        `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}` :
        'Unknown position';

    // Format brush info
    const brushText = brushInfo ?
        `${brushInfo.shape}, Radius: ${brushInfo.radius}` :
        'Unknown brush';

    // Set the content
    hoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING COMPOSITION ANALYSIS
        </div>

        <div style="margin-bottom: 10px; font-size: 12px; color: #aaa;">
            Position: ${positionText} | Brush: ${brushText}
        </div>

        <div style="margin-bottom: 15px;">
            <div style="color: yellow; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                SURFACE MESH COMPOSITION
            </div>
            <div style="background-color: rgba(0, 50, 100, 0.2); padding: 8px; border-radius: 5px;">
                ${surfaceMaterialsHtml}
            </div>
            <div style="font-size: 11px; color: #aaa; margin-top: 3px; font-style: italic;">
                Surface units represent the visible terrain mesh
            </div>
        </div>

        <div style="margin-bottom: 15px;">
            <div style="color: #00ffaa; font-weight: bold; margin-bottom: 5px; border-bottom: 2px solid #00ffaa; padding-bottom: 3px; font-size: 16px;">
                THEORETICAL INTERNAL GRID COMPOSITION
            </div>
            <div style="background-color: rgba(0, 100, 50, 0.2); padding: 8px; border-radius: 5px;">
                ${internalGridsHtml}
            </div>
            <div style="font-size: 11px; color: #aaa; margin-top: 3px; font-style: italic;">
                These theoretical units represent what would be mined from the internal grid layers below the surface.
                The internal grid visualizer shows these as colored spheres.
            </div>
        </div>

        <div style="margin-bottom: 10px;">
            ${totalCompositionHtml}
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
export function showConsolidatedMiningHoverPanel(message) {
    if (!hoverPanel) {
        initConsolidatedMiningHoverPanel();
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
export function hideConsolidatedMiningHoverPanel() {
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
        if (dependencies?.compInfo?.topElements) {
            try {
                // Check if analyzeVolumeComposition is available
                if (!analyzeVolumeComposition && window.analyzeVolumeComposition) {
                    analyzeVolumeComposition = window.analyzeVolumeComposition;
                }

                // Make sure we have the function before trying to use it
                if (!analyzeVolumeComposition) {
                    throw new Error("analyzeVolumeComposition function not available");
                }

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
                updateConsolidatedMiningHoverPanel(point, volumeData, brushInfo);
            } catch (error) {
                console.error("Error analyzing volume composition:", error);
                showConsolidatedMiningHoverPanel(`Error analyzing composition: ${error.message}`);
            }
        } else {
            showConsolidatedMiningHoverPanel("Missing dependencies for composition analysis");
        }
    } else {
        // No intersection, hide the panel
        hideConsolidatedMiningHoverPanel();
    }
}

// Export the interface for global access
export const consolidatedMiningHoverPanel = {
    init: initConsolidatedMiningHoverPanel,
    update: updateConsolidatedMiningHoverPanel,
    show: showConsolidatedMiningHoverPanel,
    hide: hideConsolidatedMiningHoverPanel,
    handleHover: handleTerrainHover
};

// Make the interface available globally
if (typeof window !== 'undefined') {
    window.consolidatedMiningHoverPanel = consolidatedMiningHoverPanel;

    // Auto-initialize after a short delay to ensure dependencies are loaded
    setTimeout(() => {
        if (window.analyzeVolumeComposition && !analyzeVolumeComposition) {
            analyzeVolumeComposition = window.analyzeVolumeComposition;
            console.log("[ConsolidatedMiningHoverPanel] Auto-initialized analyzeVolumeComposition");
        }

        // Initialize but don't show the panel - only show when hovering over terrain
        if (!hoverPanel) {
            initConsolidatedMiningHoverPanel();
        }

        // Make sure the panel is hidden by default
        hideConsolidatedMiningHoverPanel();
        console.log("[ConsolidatedMiningHoverPanel] Panel initialized and hidden by default");
    }, 2000);
}
