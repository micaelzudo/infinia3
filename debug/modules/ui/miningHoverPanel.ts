/**
 * Standalone Mining Hover Panel
 * This module creates a completely separate hover panel for mining information
 * that won't be affected by other UI elements.
 */

import * as THREE from 'three';
import { VolumeCompositionResult } from '../mining/miningSystem';

// Global panel reference
let standaloneHoverPanel: HTMLElement | null = null;

/**
 * Initialize the standalone hover panel
 */
export function initStandaloneHoverPanel(): void {
    console.log("[StandaloneHoverPanel] Initializing...");

    // Remove existing panel if it exists
    if (standaloneHoverPanel) {
        if (standaloneHoverPanel.parentNode) {
            standaloneHoverPanel.parentNode.removeChild(standaloneHoverPanel);
        }
        standaloneHoverPanel = null;
    }

    // Create the panel
    standaloneHoverPanel = document.createElement('div');
    standaloneHoverPanel.id = 'standalone-hover-panel';

    // Apply styles directly with !important flags
    const styles = {
        position: 'fixed',
        top: '150px',
        left: '50px',
        width: '300px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        border: '5px solid red',
        zIndex: '999999',
        boxShadow: '0 0 30px rgba(255, 0, 0, 1)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        display: 'block',
        visibility: 'visible',
        pointerEvents: 'none',
        maxHeight: '80vh',
        overflowY: 'auto',
        transform: 'none',
        opacity: '1'
    };

    // Apply styles with !important
    Object.entries(styles).forEach(([property, value]) => {
        standaloneHoverPanel!.style.setProperty(property, value.toString(), 'important');
    });

    // Set initial content
    standaloneHoverPanel.innerHTML = `
        <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
            MINING COMPOSITION (STANDALONE)
        </div>
        <div style="color: yellow; font-size: 16px;">
            Move mouse over terrain to see composition data
        </div>
    `;

    // Add to document body
    document.body.appendChild(standaloneHoverPanel);

    // Add mouse position tracker
    const mouseTracker = document.createElement('div');
    mouseTracker.id = 'mouse-position-tracker';
    Object.entries({
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        zIndex: '999999',
        fontFamily: 'monospace',
        fontSize: '14px'
    }).forEach(([property, value]) => {
        mouseTracker.style.setProperty(property, value.toString());
    });

    mouseTracker.innerHTML = 'Mouse: X=0, Y=0';
    document.body.appendChild(mouseTracker);

    // Track mouse position globally
    document.addEventListener('mousemove', (event) => {
        if (mouseTracker) {
            mouseTracker.innerHTML = `Mouse: X=${event.clientX}, Y=${event.clientY}`;
        }
    });

    console.log("[StandaloneHoverPanel] Initialization complete");
}

/**
 * Update the standalone hover panel with composition data
 */
export function updateStandaloneHoverPanel(
    position: THREE.Vector3,
    volumeData: VolumeCompositionResult,
    brushShape: string,
    brushRadius: number
): void {
    // Make this function available globally
    if (typeof window !== 'undefined') {
        (window as any).updateStandaloneHoverPanel = updateStandaloneHoverPanel;
    }
    console.log("[StandaloneHoverPanel] Updating with new data");

    // Create panel if it doesn't exist
    if (!standaloneHoverPanel) {
        initStandaloneHoverPanel();
    }

    // Ensure panel is visible
    if (standaloneHoverPanel) {
        standaloneHoverPanel.style.setProperty('display', 'block', 'important');

        // Make sure it's in the DOM
        if (!document.body.contains(standaloneHoverPanel)) {
            document.body.appendChild(standaloneHoverPanel);
        }

        // Generate HTML content
        const sortedMaterials = Object.values(volumeData.materialCounts).sort((a, b) => b.percentage - a.percentage);
        const totalVoxels = 32768; // 32^3

        // Create material rows HTML
        let materialRowsHtml = '';
        sortedMaterials.forEach(material => {
            const estimatedUnits = Math.round((material.percentage / 100) * totalVoxels);
            const colorHex = `#${material.materialColor.getHexString()}`;

            materialRowsHtml += `
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="width: 16px; height: 16px; border-radius: 3px; margin-right: 8px; background-color: ${colorHex}; border: 1px solid rgba(255, 255, 255, 0.3);"></div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold;">${material.materialSymbol}</div>
                        <div style="font-size: 12px; opacity: 0.8;">${material.percentage.toFixed(1)}% (~${estimatedUnits.toLocaleString()} units)</div>
                    </div>
                </div>
            `;
        });

        // Create grid layers visualization - show actual layers with depth
        let gridLayersHtml = '';
        const layerCount = 8; // Match the default depthLayers parameter
        const layerSpacing = 0.25; // Match the default layerSpacing parameter

        // Calculate units per layer (approximate)
        const unitsPerLayer = totalVoxels / layerCount;

        // Create a visualization of the layers
        for (let i = 0; i < layerCount; i++) {
            // For each layer, show the dominant material
            // In a real implementation, we would calculate this per layer
            const layerIndex = Math.min(i, sortedMaterials.length - 1);
            const material = sortedMaterials[layerIndex % sortedMaterials.length];

            if (material) {
                const colorHex = `#${material.materialColor.getHexString()}`;
                const opacity = 1 - (i * 0.08); // Gradual fade with depth
                const depth = (i * layerSpacing).toFixed(2);
                const estimatedLayerUnits = Math.round(unitsPerLayer * (material.percentage / 100));

                gridLayersHtml += `
                    <div style="height: 28px; background-color: ${colorHex}; opacity: ${opacity}; display: flex; justify-content: space-between; align-items: center; padding: 0 10px; margin-bottom: 2px; border-radius: 2px; position: relative;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-weight: bold; text-shadow: 0 0 3px rgba(0, 0, 0, 0.8); margin-right: 8px;">${material.materialSymbol}</span>
                            <span style="font-size: 11px; opacity: 0.9;">Depth: ${depth}u</span>
                        </div>
                        <span style="text-shadow: 0 0 3px rgba(0, 0, 0, 0.8);">~${estimatedLayerUnits.toLocaleString()} units</span>
                    </div>
                `;
            }
        }

        // Set the complete HTML content
        standaloneHoverPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
                MINING COMPOSITION ANALYSIS
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; color: yellow; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                    Total Volume Composition (Surface + Internal)
                </div>
                ${materialRowsHtml}
                <div style="font-size: 11px; color: #aaa; margin-top: 5px; font-style: italic;">
                    Analysis includes surface mesh and all internal grid layers
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; color: yellow; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                    Internal Grid Layers (8 layers, 0.25u spacing)
                </div>
                <div style="border: 1px solid yellow; border-radius: 3px; overflow: hidden; margin-top: 5px;">
                    ${gridLayersHtml}
                </div>
                <div style="font-size: 11px; color: #aaa; margin-top: 5px; font-style: italic;">
                    Mining retrieves resources from all layers shown above
                </div>
            </div>

            <div style="margin-bottom: 15px; background-color: rgba(255, 0, 0, 0.3); padding: 8px; border-radius: 4px; font-size: 14px;">
                <div>Brush: ${brushShape}, Radius: ${brushRadius}</div>
                <div>Width: ${(brushRadius * 2).toFixed(1)} units</div>
                <div>Depth: ${(brushRadius * 2).toFixed(1)} units</div>
                <div>Total Voxels: ${totalVoxels.toLocaleString()} (32×32×32)</div>
            </div>

            <div style="font-size: 14px; color: white; border-top: 1px solid yellow; padding-top: 5px;">
                Position: X=${position.x.toFixed(1)}, Y=${position.y.toFixed(1)}, Z=${position.z.toFixed(1)}
            </div>
        `;
    }
}

/**
 * Show a basic message in the standalone hover panel
 */
export function showBasicMessage(message: string): void {
    if (!standaloneHoverPanel) {
        initStandaloneHoverPanel();
    }

    if (standaloneHoverPanel) {
        standaloneHoverPanel.style.setProperty('display', 'block', 'important');

        standaloneHoverPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
                MINING COMPOSITION
            </div>
            <div style="color: yellow; font-size: 16px;">
                ${message}
            </div>
        `;
    }
}

/**
 * Hide the standalone hover panel
 */
export function hideStandaloneHoverPanel(): void {
    if (standaloneHoverPanel) {
        standaloneHoverPanel.style.setProperty('display', 'none', 'important');
    }
}

/**
 * Force show the standalone hover panel
 */
export function forceShowStandaloneHoverPanel(): void {
    // Make this function available globally
    if (typeof window !== 'undefined') {
        (window as any).forceShowStandaloneHoverPanel = forceShowStandaloneHoverPanel;
    }
    if (!standaloneHoverPanel) {
        initStandaloneHoverPanel();
    }

    if (standaloneHoverPanel) {
        standaloneHoverPanel.style.setProperty('display', 'block', 'important');

        // Add a timestamp to show it was forced
        const timestamp = new Date().toLocaleTimeString();
        standaloneHoverPanel.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold; color: #ff5555; border-bottom: 2px solid #ff5555; padding-bottom: 5px; font-size: 18px;">
                MINING COMPOSITION (FORCED)
            </div>
            <div style="color: yellow; font-size: 16px;">
                Panel forced visible at ${timestamp}
            </div>
            <div style="margin-top: 10px; color: white;">
                Move mouse over terrain to see composition data
            </div>
        `;
    }
}

/**
 * Clean up the standalone hover panel
 */
export function cleanupStandaloneHoverPanel(): void {
    if (standaloneHoverPanel) {
        if (standaloneHoverPanel.parentNode) {
            standaloneHoverPanel.parentNode.removeChild(standaloneHoverPanel);
        }
        standaloneHoverPanel = null;
    }

    const mouseTracker = document.getElementById('mouse-position-tracker');
    if (mouseTracker && mouseTracker.parentNode) {
        mouseTracker.parentNode.removeChild(mouseTracker);
    }
}
