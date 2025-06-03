/**
 * Consolidated Mining Hover Panel
 * This module provides a single, unified hover panel implementation for mining information
 * that consolidates functionality from all previous hover panel implementations.
 */

// Import the mining panel state manager
import { miningPanelStateManager } from './miningPanelState.js';

// Global panel reference
let hoverPanel = null;
let forceUpdateButton = null;

/**
 * Initialize the consolidated hover panel
 */
function initConsolidatedHoverPanel() {
    console.log("[ConsolidatedHoverPanel] Initializing...");

    // Remove existing panel if it exists
    if (hoverPanel) {
        if (hoverPanel.parentNode) {
            hoverPanel.parentNode.removeChild(hoverPanel);
        }
        hoverPanel = null;
    }

    // Create the panel
    hoverPanel = document.createElement('div');
    hoverPanel.id = 'consolidated-hover-panel';

    // Apply styles directly with !important flags
    const styles = {
        position: 'fixed',
        top: '20px',
        left: '20px',
        width: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        border: '3px solid #ffff00',
        zIndex: '99999999',
        boxShadow: '0 0 20px rgba(255, 255, 0, 0.7)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        display: 'none',
        visibility: 'visible',
        pointerEvents: 'none',
        maxHeight: '80vh',
        overflowY: 'auto',
        opacity: '1'
    };

    // Apply styles with !important
    Object.entries(styles).forEach(([property, value]) => {
        hoverPanel.style.setProperty(property, value.toString(), 'important');
    });

    // Set initial content
    hoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING HOVER PANEL
        </div>
        <div style="color: yellow; font-size: 16px;">
            Move mouse over terrain to see composition data
        </div>
    `;

    // Add to document body
    document.body.appendChild(hoverPanel);

    // Add force update button
    addForceUpdateButton();

    // Make this function available globally
    if (typeof window !== 'undefined') {
        window.initConsolidatedHoverPanel = initConsolidatedHoverPanel;
        window.updateConsolidatedHoverPanel = updateConsolidatedHoverPanel;
        window.showConsolidatedHoverPanel = showConsolidatedHoverPanel;
        window.hideConsolidatedHoverPanel = hideConsolidatedHoverPanel;
    }

    console.log("[ConsolidatedHoverPanel] Initialization complete");
    return hoverPanel;
}

/**
 * Update the hover panel with composition data
 */
function updateConsolidatedHoverPanel(position, volumeData, brushShape, brushRadius) {
    console.log("[ConsolidatedHoverPanel] Updating with new data");

    // Create panel if it doesn't exist
    if (!hoverPanel) {
        initConsolidatedHoverPanel();
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

    // Format the materials data
    let materialRowsHtml = '';
    let internalGridsHtml = '';

    if (volumeData && volumeData.materialCounts) {
        try {
            // Sort materials by percentage
            const materials = Object.values(volumeData.materialCounts)
                .sort((a, b) => b.percentage - a.percentage);

            // Format surface materials
            materials.forEach(material => {
                const colorHex = material.materialColor ?
                    `#${material.materialColor.getHexString()}` : '#FFFFFF';

                materialRowsHtml += `
                    <div style="display: flex; align-items: center; margin-bottom: 5px; background-color: rgba(50, 50, 50, 0.3); padding: 5px; border-radius: 3px;">
                        <div style="width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px;"></div>
                        <div style="flex-grow: 1;">
                            <strong>${material.materialSymbol || 'Unknown'}</strong>
                            (${material.materialName || 'Unknown'})
                        </div>
                        <div style="min-width: 60px; text-align: right;">
                            ${material.percentage.toFixed(1)}%
                        </div>
                        <div style="min-width: 80px; text-align: right;">
                            ${material.count.toLocaleString()} units
                        </div>
                    </div>
                `;
            });

            // Format internal grid layers
            const layerCount = 8; // Standard number of internal grid layers

            for (let i = 0; i < layerCount; i++) {
                // For each layer, show the dominant material at that depth
                const layerDepth = (i * 0.25).toFixed(2); // 0.25 units per layer

                // Get material for this layer (cycling through top materials if needed)
                const material = materials[i % materials.length];

                if (material) {
                    const colorHex = material.materialColor ?
                        `#${material.materialColor.getHexString()}` : '#FFFFFF';

                    // Calculate units for this layer (distribute internal units across layers)
                    const layerUnits = Math.round((material.percentage / 100) * (material.count / layerCount));

                    internalGridsHtml += `
                        <div style="display: flex; align-items: center; margin-bottom: 5px; background-color: rgba(${i * 20}, ${i * 10}, 0, 0.1); padding: 5px; border-radius: 3px;">
                            <div style="width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px;"></div>
                            <div style="flex-grow: 1;">
                                <strong>Layer ${i+1}</strong> (Depth: ${layerDepth}u):
                                <strong>${material.materialSymbol || 'Unknown'}</strong>
                                (~${layerUnits.toLocaleString()} units)
                            </div>
                        </div>
                    `;
                }
            }
        } catch (err) {
            console.error('[ConsolidatedHoverPanel] Error processing materials:', err);
            materialRowsHtml = `<div style="color: orange;">Error processing materials: ${err.message}</div>`;
            internalGridsHtml = `<div style="color: orange;">Error processing internal grids: ${err.message}</div>`;
        }
    } else {
        materialRowsHtml = '<div style="color: orange;">No composition data available</div>';
        internalGridsHtml = '<div style="color: orange;">No internal grid data available</div>';
    }

    // Format position
    const positionText = position ?
        `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}` :
        'Unknown position';

    // Set the complete HTML content
    if (hoverPanel) {
        hoverPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
                MINING COMPOSITION ANALYSIS
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; color: yellow; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                    Surface Mesh Composition
                </div>
                <div style="background-color: rgba(0, 50, 100, 0.2); padding: 8px; border-radius: 5px;">
                    ${materialRowsHtml}
                </div>
                <div style="font-size: 11px; color: #aaa; margin-top: 5px; font-style: italic;">
                    Surface units represent the visible terrain mesh
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; color: yellow; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                    Internal Grid Layers
                </div>
                <div style="background-color: rgba(50, 0, 100, 0.2); padding: 8px; border-radius: 5px; max-height: 200px; overflow-y: auto;">
                    ${internalGridsHtml}
                </div>
                <div style="font-size: 11px; color: #aaa; margin-top: 5px; font-style: italic;">
                    Internal grid layers represent the 3D volume below the surface
                </div>
            </div>

            <div style="margin-bottom: 10px; background-color: rgba(50, 50, 50, 0.3); padding: 8px; border-radius: 5px;">
                <div style="color: #aaa; font-weight: bold; margin-bottom: 5px;">
                    Brush Information
                </div>
                <div>Shape: <strong>${brushShape || 'Unknown'}</strong>, Radius: <strong>${brushRadius || 'Unknown'}</strong></div>
                <div>Position: ${positionText}</div>
            </div>

            <div style="font-size: 12px; color: #ff5555; border-top: 1px solid #ff5555; padding-top: 5px; text-align: center;">
                Mining retrieves resources from BOTH surface mesh AND internal grid layers
            </div>
        `;
    }
}

/**
 * Show a basic message in the hover panel
 */
function showConsolidatedHoverPanel(message) {
    if (!hoverPanel) {
        initConsolidatedHoverPanel();
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
function hideConsolidatedHoverPanel() {
    if (hoverPanel) {
        hoverPanel.style.setProperty('display', 'none', 'important');
    }
}

/**
 * Add a button to force update the hover panel
 */
function addForceUpdateButton() {
    // Remove existing button if it exists
    if (forceUpdateButton) {
        if (forceUpdateButton.parentNode) {
            forceUpdateButton.parentNode.removeChild(forceUpdateButton);
        }
        forceUpdateButton = null;
    }

    // Create the button
    forceUpdateButton = document.createElement('button');
    forceUpdateButton.id = 'force-hover-update-button';
    forceUpdateButton.textContent = 'FORCE HOVER DATA';

    // Apply styles
    forceUpdateButton.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #ff5555;
        color: white;
        border: none;
        padding: 10px 15px;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        border-radius: 5px;
    `;

    // Add click handler
    forceUpdateButton.onclick = function() {
        showConsolidatedHoverPanel('Panel forced visible');
    };

    // Add to document body
    document.body.appendChild(forceUpdateButton);
}

// Initialize the global object
if (typeof window !== 'undefined') {
    window.consolidatedHoverPanel = {
        init: initConsolidatedHoverPanel,
        update: updateConsolidatedHoverPanel,
        show: showConsolidatedHoverPanel,
        hide: hideConsolidatedHoverPanel
    };
}

// Don't auto-initialize - only initialize when needed
console.log('[ConsolidatedHoverPanel] Script loaded - will initialize on demand');
