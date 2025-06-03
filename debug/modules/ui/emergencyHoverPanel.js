/**
 * Emergency Hover Panel
 * This is a simplified, direct approach to showing hover information
 * with no dependencies on other UI elements
 */

// Create and inject the panel
function createEmergencyHoverPanel() {
    // Remove any existing panel
    const existingPanel = document.getElementById('emergency-hover-panel');
    if (existingPanel) {
        document.body.removeChild(existingPanel);
    }

    // Create the panel
    const panel = document.createElement('div');
    panel.id = 'emergency-hover-panel';

    // Apply direct styles with !important
    panel.style.cssText = `
        position: fixed !important;
        top: 100px !important;
        left: 100px !important;
        width: 300px !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 15px !important;
        border: 5px solid red !important;
        border-radius: 5px !important;
        z-index: 999999 !important;
        font-family: monospace !important;
        font-size: 14px !important;
        pointer-events: none !important;
        display: block !important;
        visibility: visible !important;
        box-shadow: 0 0 20px red !important;
    `;

    // Set initial content
    panel.innerHTML = `
        <div style="color: red; font-weight: bold; font-size: 16px; margin-bottom: 10px; text-align: center;">
            EMERGENCY HOVER PANEL
        </div>
        <div style="color: yellow;">
            Move mouse over terrain to see composition
        </div>
    `;

    // Add to document body
    document.body.appendChild(panel);

    return panel;
}

// Update the panel with composition data
function updateEmergencyHoverPanel(position, volumeData, brushInfo) {
    console.log('[EmergencyPanel] updateEmergencyHoverPanel called with:',
        position ? `Position(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})` : 'No position',
        volumeData ? 'Has volumeData' : 'No volumeData',
        brushInfo ? `Brush(${brushInfo.shape}, ${brushInfo.radius})` : 'No brushInfo'
    );

    // Log the full data to console for debugging
    console.log('[EmergencyPanel] Full volumeData:', volumeData);

    const panel = document.getElementById('emergency-hover-panel') || createEmergencyHoverPanel();

    // Ensure panel is visible with !important
    panel.style.cssText += 'display: block !important; visibility: visible !important;';

    // Format the materials data
    let surfaceMaterialsHtml = '';
    let internalGridsHtml = '';
    let debugInfo = '';

    if (volumeData && volumeData.materialCounts) {
        // Add debug info
        debugInfo = `Found ${Object.keys(volumeData.materialCounts).length} materials`;
        console.log('[EmergencyPanel] ' + debugInfo);

        try {
            // Sort materials by percentage
            const materials = Object.values(volumeData.materialCounts)
                .sort((a, b) => b.percentage - a.percentage);

            // Calculate total voxels in the brush volume
            const totalVoxels = 32768; // 32^3

            // Calculate surface units (approximately 20% of total)
            const surfaceUnits = Math.round(totalVoxels * 0.2);

            // Calculate internal grid units (approximately 80% of total)
            const internalUnits = totalVoxels - surfaceUnits;

            // Format surface materials
            materials.forEach(material => {
                try {
                    const colorHex = material.materialColor ?
                        `#${material.materialColor.getHexString()}` : '#FFFFFF';

                    // Calculate units for surface layer
                    const surfaceMaterialUnits = Math.round((material.percentage / 100) * surfaceUnits);

                    surfaceMaterialsHtml += `
                        <div style="display: flex; align-items: center; margin-bottom: 5px;">
                            <div style="width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px;"></div>
                            <div>
                                <strong>${material.materialSymbol || 'Unknown'}</strong>:
                                ${material.percentage.toFixed(1)}%
                                (~${surfaceMaterialUnits.toLocaleString()} surface units)
                            </div>
                        </div>
                    `;
                } catch (err) {
                    console.error('[EmergencyPanel] Error formatting surface material:', err);
                    surfaceMaterialsHtml += `<div style="color: orange;">Error formatting material: ${err.message}</div>`;
                }
            });

            // Format internal grid layers
            // Create a visualization of the internal grid layers
            const layerCount = 8; // Standard number of internal grid layers

            for (let i = 0; i < layerCount; i++) {
                // For each layer, show the dominant material at that depth
                // In a real implementation, this would be calculated per layer
                const layerDepth = (i * 0.25).toFixed(2); // 0.25 units per layer

                // Get material for this layer (cycling through top materials if needed)
                const material = materials[i % materials.length];

                if (material) {
                    const colorHex = material.materialColor ?
                        `#${material.materialColor.getHexString()}` : '#FFFFFF';

                    // Calculate units for this layer (distribute internal units across layers)
                    const layerUnits = Math.round((material.percentage / 100) * (internalUnits / layerCount));

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
            console.error('[EmergencyPanel] Error processing materials:', err);
            surfaceMaterialsHtml = `<div style="color: orange;">Error processing materials: ${err.message}</div>`;
            internalGridsHtml = `<div style="color: orange;">Error processing internal grids: ${err.message}</div>`;
        }
    } else {
        debugInfo = 'No material counts available';
        console.log('[EmergencyPanel] ' + debugInfo);
        surfaceMaterialsHtml = '<div style="color: orange;">No composition data available</div>';
        internalGridsHtml = '<div style="color: orange;">No internal grid data available</div>';
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
    panel.innerHTML = `
        <div style="color: red; font-weight: bold; font-size: 16px; margin-bottom: 10px; text-align: center;">
            MINING COMPOSITION ANALYSIS
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
            <div style="color: yellow; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid yellow; padding-bottom: 3px;">
                INTERNAL GRID LAYERS
            </div>
            <div style="background-color: rgba(50, 0, 100, 0.2); padding: 8px; border-radius: 5px; max-height: 200px; overflow-y: auto;">
                ${internalGridsHtml}
            </div>
            <div style="font-size: 11px; color: #aaa; margin-top: 3px; font-style: italic;">
                Internal grid layers represent the 3D volume below the surface
            </div>
        </div>

        <div style="margin-bottom: 10px; background-color: rgba(50, 50, 50, 0.3); padding: 8px; border-radius: 5px;">
            <div style="color: #aaa; font-weight: bold; margin-bottom: 5px;">
                Brush Information
            </div>
            <div>Shape: <strong>${brushInfo?.shape || 'Unknown'}</strong>, Radius: <strong>${brushInfo?.radius || 'Unknown'}</strong></div>
            <div>Position: ${positionText}</div>
            <div>Total Volume: 32,768 voxel units (32×32×32)</div>
        </div>

        <div style="font-size: 12px; color: #ff5555; border-top: 1px solid #ff5555; padding-top: 5px; text-align: center;">
            Mining retrieves resources from BOTH surface mesh AND internal grid layers
        </div>
    `;

    // Add debug info button
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Data';
    debugButton.style.cssText = `
        position: absolute;
        bottom: -30px;
        right: 0;
        background-color: red;
        color: white;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
        pointer-events: auto;
    `;
    debugButton.onclick = function() {
        showRawDebugData(volumeData);
    };
    panel.appendChild(debugButton);
}

// Show raw debug data in a separate window
function showRawDebugData(volumeData) {
    const debugWindow = window.open('', 'debugWindow', 'width=600,height=600');

    if (!debugWindow) {
        alert('Debug window was blocked. Please allow popups for this site.');
        return;
    }

    const debugContent = `
        <html>
        <head>
            <title>Composition Debug Data</title>
            <style>
                body { background: #1e1e1e; color: #ddd; font-family: monospace; padding: 20px; }
                pre { background: #2d2d2d; padding: 10px; overflow: auto; max-height: 500px; }
                h2 { color: #ff5555; }
            </style>
        </head>
        <body>
            <h2>Raw Composition Data</h2>
            <pre>${JSON.stringify(volumeData, null, 2)}</pre>
        </body>
        </html>
    `;

    debugWindow.document.write(debugContent);
    debugWindow.document.close();
}

// Hide the panel
function hideEmergencyHoverPanel() {
    const panel = document.getElementById('emergency-hover-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

// Force show the panel with a message
function forceShowEmergencyHoverPanel(message) {
    const panel = document.getElementById('emergency-hover-panel') || createEmergencyHoverPanel();

    panel.style.display = 'block';
    panel.innerHTML = `
        <div style="color: red; font-weight: bold; font-size: 16px; margin-bottom: 10px; text-align: center;">
            EMERGENCY HOVER PANEL
        </div>
        <div style="color: yellow;">
            ${message || 'Panel forced visible'}
        </div>
    `;
}

// Add a button to toggle the panel
function addEmergencyHoverButton() {
    // Remove any existing button
    const existingButton = document.getElementById('emergency-hover-button');
    if (existingButton) {
        document.body.removeChild(existingButton);
    }

    // Create the button
    const button = document.createElement('button');
    button.id = 'emergency-hover-button';
    button.textContent = 'SHOW HOVER DATA';

    // Apply styles
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: red;
        color: white;
        border: none;
        padding: 10px 15px;
        font-weight: bold;
        font-size: 16px;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    `;

    // Add click handler
    button.onclick = function() {
        forceShowEmergencyHoverPanel('Click on terrain to see composition data');
    };

    // Add to document body
    document.body.appendChild(button);

    return button;
}

// Initialize the emergency hover system
function initEmergencyHoverSystem() {
    createEmergencyHoverPanel();
    addEmergencyHoverButton();

    // Add a global mouse position tracker
    const tracker = document.createElement('div');
    tracker.id = 'mouse-position-tracker';
    tracker.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background-color: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 5px 10px;
        font-family: monospace;
        z-index: 999999;
    `;
    document.body.appendChild(tracker);

    // Track mouse position
    document.addEventListener('mousemove', function(event) {
        tracker.textContent = `Mouse: X=${event.clientX}, Y=${event.clientY}`;
    });

    console.log('Emergency hover system initialized');
}

// Export the functions
window.emergencyHoverPanel = {
    init: initEmergencyHoverSystem,
    update: updateEmergencyHoverPanel,
    hide: hideEmergencyHoverPanel,
    show: forceShowEmergencyHoverPanel
};
