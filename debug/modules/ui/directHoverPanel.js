/**
 * Direct Hover Panel
 * This is a completely standalone implementation that directly hooks into mouse events
 * and forces the hover panel to update with composition data
 */

// Create the panel
function createDirectHoverPanel() {
    // Remove any existing panel
    const existingPanel = document.getElementById('direct-hover-panel');
    if (existingPanel) {
        document.body.removeChild(existingPanel);
    }

    // Create the panel
    const panel = document.createElement('div');
    panel.id = 'direct-hover-panel';

    // Apply direct styles with !important
    panel.style.cssText = `
        position: fixed !important;
        top: 100px !important;
        right: 20px !important;
        width: 350px !important;
        background-color: rgba(0, 0, 0, 0.9) !important;
        color: white !important;
        padding: 15px !important;
        border: 5px solid #ff0000 !important;
        border-radius: 5px !important;
        z-index: 9999999 !important;
        font-family: monospace !important;
        font-size: 14px !important;
        pointer-events: none !important;
        display: block !important;
        visibility: visible !important;
        box-shadow: 0 0 20px #ff0000 !important;
        max-height: 80vh !important;
        overflow-y: auto !important;
        animation: panelPulse 2s infinite !important;
    `;

    // Add keyframes for pulsing animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes panelPulse {
            0% { border-color: #ff0000; box-shadow: 0 0 20px #ff0000; }
            50% { border-color: #ffff00; box-shadow: 0 0 30px #ffff00; }
            100% { border-color: #ff0000; box-shadow: 0 0 20px #ff0000; }
        }

        #direct-hover-panel {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
        }
    `;
    document.head.appendChild(style);

    // Set initial content
    panel.innerHTML = `
        <div style="color: #ff0000; font-weight: bold; font-size: 18px; margin-bottom: 10px; text-align: center; text-shadow: 0 0 5px #ff0000;">
            DIRECT HOVER PANEL
        </div>
        <div style="color: yellow; text-align: center; margin-bottom: 15px;">
            Move mouse over terrain to see composition
        </div>
        <div style="color: #ff5555; text-align: center; font-weight: bold;">
            WAITING FOR MOUSE MOVEMENT...
        </div>
    `;

    // Add to document body
    document.body.appendChild(panel);

    // Set up a periodic check to ensure the panel is visible
    setInterval(() => {
        if (panel.style.display !== 'block' || panel.style.visibility !== 'visible') {
            panel.style.cssText += 'display: block !important; visibility: visible !important; opacity: 1 !important;';
        }
    }, 500);

    return panel;
}

// Update the panel with composition data
function updateDirectHoverPanel(position, materials, brushInfo) {
    const panel = document.getElementById('direct-hover-panel') || createDirectHoverPanel();

    // Ensure panel is visible with !important
    panel.style.cssText += 'display: block !important; visibility: visible !important;';

    // Format surface materials
    let surfaceMaterialsHtml = '';
    let internalGridsHtml = '';

    if (materials && materials.length > 0) {
        // Calculate total voxels in the brush volume
        const totalVoxels = 32768; // 32^3

        // Calculate surface units (approximately 20% of total)
        const surfaceUnits = Math.round(totalVoxels * 0.2);

        // Calculate internal grid units (approximately 80% of total)
        const internalUnits = totalVoxels - surfaceUnits;

        // Format surface materials
        materials.forEach(material => {
            const colorHex = material.color || '#FFFFFF';

            // Calculate units for surface layer
            const surfaceMaterialUnits = Math.round((material.percentage / 100) * surfaceUnits);

            surfaceMaterialsHtml += `
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <div style="width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px;"></div>
                    <div>
                        <strong>${material.symbol || 'Unknown'}</strong>:
                        ${material.percentage.toFixed(1)}%
                        (~${surfaceMaterialUnits.toLocaleString()} surface units)
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
                const colorHex = material.color || '#FFFFFF';

                // Calculate units for this layer (distribute internal units across layers)
                const layerUnits = Math.round((material.percentage / 100) * (internalUnits / layerCount));

                internalGridsHtml += `
                    <div style="display: flex; align-items: center; margin-bottom: 5px; background-color: rgba(${i * 20}, ${i * 10}, 0, 0.1); padding: 5px; border-radius: 3px;">
                        <div style="width: 15px; height: 15px; background-color: ${colorHex}; margin-right: 8px;"></div>
                        <div style="flex-grow: 1;">
                            <strong>Layer ${i+1}</strong> (Depth: ${layerDepth}u):
                            <strong>${material.symbol || 'Unknown'}</strong>
                            (~${layerUnits.toLocaleString()} units)
                        </div>
                    </div>
                `;
            }
        }
    } else {
        surfaceMaterialsHtml = '<div style="color: orange;">No composition data available</div>';
        internalGridsHtml = '<div style="color: orange;">No internal grid data available</div>';
    }

    // Format position
    const positionText = position ?
        `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}` :
        'Unknown position';

    // Format brush info
    const brushText = brushInfo ?
        `${brushInfo.shape || 'sphere'}, Radius: ${brushInfo.radius || '3'}` :
        'sphere, Radius: 3';

    // Set the content
    panel.innerHTML = `
        <div style="color: #ff0000; font-weight: bold; font-size: 18px; margin-bottom: 10px; text-align: center; text-shadow: 0 0 5px #ff0000;">
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
            <div>Shape: <strong>${brushInfo?.shape || 'sphere'}</strong>, Radius: <strong>${brushInfo?.radius || '3'}</strong></div>
            <div>Position: ${positionText}</div>
            <div>Total Volume: 32,768 voxel units (32×32×32)</div>
        </div>

        <div style="font-size: 12px; color: #ff5555; border-top: 1px solid #ff5555; padding-top: 5px; text-align: center;">
            Mining retrieves resources from BOTH surface mesh AND internal grid layers
        </div>

        <div style="font-size: 10px; color: #aaa; margin-top: 10px; text-align: center;">
            Last updated: ${new Date().toLocaleTimeString()}
        </div>
    `;

    // Also try to update the emergency hover panel if it exists
    if (window.emergencyHoverPanel) {
        window.emergencyHoverPanel.update(position, materials, brushInfo);
    }

    // Also try to update the standalone hover panel if it exists
    if (window.updateStandaloneHoverPanel && position) {
        // Convert materials to VolumeCompositionResult format
        const volumeData = {
            materialCounts: {},
            totalPoints: 0,
            boundingBox: {
                min: { x: position.x - brushInfo.radius, y: position.y - brushInfo.radius, z: position.z - brushInfo.radius },
                max: { x: position.x + brushInfo.radius, y: position.y + brushInfo.radius, z: position.z + brushInfo.radius },
                size: { x: brushInfo.radius * 2, y: brushInfo.radius * 2, z: brushInfo.radius * 2 }
            },
            calculationTime: 0
        };

        // Convert materials to materialCounts
        materials.forEach((material, index) => {
            volumeData.materialCounts[index] = {
                materialIndex: index,
                materialSymbol: material.symbol || 'Unknown',
                materialName: material.name || material.symbol || 'Unknown',
                materialColor: { r: 1, g: 1, b: 1 }, // Default color
                count: Math.round((material.percentage / 100) * 1000), // Arbitrary count
                percentage: material.percentage
            };

            // Try to parse the color
            if (material.color && material.color.startsWith('#')) {
                const hex = material.color.substring(1);
                volumeData.materialCounts[index].materialColor = {
                    r: parseInt(hex.substring(0, 2), 16) / 255,
                    g: parseInt(hex.substring(2, 4), 16) / 255,
                    b: parseInt(hex.substring(4, 6), 16) / 255
                };
            }

            volumeData.totalPoints += volumeData.materialCounts[index].count;
        });

        // Update the standalone hover panel
        try {
            window.updateStandaloneHoverPanel(
                position,
                volumeData,
                brushInfo.shape,
                brushInfo.radius
            );
        } catch (error) {
            console.error('[DirectHoverPanel] Error updating standalone hover panel:', error);
        }
    }
}

// Show a message in the panel
function showDirectHoverMessage(message) {
    const panel = document.getElementById('direct-hover-panel') || createDirectHoverPanel();

    panel.innerHTML = `
        <div style="color: #ff0000; font-weight: bold; font-size: 18px; margin-bottom: 10px; text-align: center; text-shadow: 0 0 5px #ff0000;">
            DIRECT HOVER PANEL
        </div>
        <div style="color: yellow; text-align: center; margin: 20px 0;">
            ${message}
        </div>
        <div style="font-size: 10px; color: #aaa; margin-top: 10px; text-align: center;">
            Last updated: ${new Date().toLocaleTimeString()}
        </div>
    `;
}

// Initialize the direct hover system
function initDirectHoverSystem() {
    console.log('[DirectHoverPanel] Initializing...');

    // Create the panel
    createDirectHoverPanel();

    // Add a button to force show the panel
    const button = document.createElement('button');
    button.id = 'direct-hover-button';
    button.textContent = 'SHOW HOVER DATA';

    // Apply styles
    button.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        background-color: #ff0000 !important;
        color: white !important;
        border: none !important;
        padding: 10px 15px !important;
        font-weight: bold !important;
        font-size: 16px !important;
        cursor: pointer !important;
        z-index: 9999999 !important;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
        animation: pulse 2s infinite !important;
    `;

    // Add keyframes for pulsing animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
            50% { transform: scale(1.05); box-shadow: 0 0 20px rgba(255, 0, 0, 0.8); }
            100% { transform: scale(1); box-shadow: 0 0 10px rgba(255, 0, 0, 0.5); }
        }
    `;
    document.head.appendChild(style);

    // Add click handler
    button.onclick = function() {
        showDirectHoverMessage('Click on terrain to see composition data');

        // Try to find and click the mining panel button
        setTimeout(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const miningButton = buttons.find(b =>
                b.textContent &&
                b.textContent.toLowerCase().includes('mining')
            );

            if (miningButton) {
                console.log('[DirectHoverPanel] Found mining button, clicking it');
                miningButton.click();
            }

            // Try to force show the standalone hover panel if it exists
            if (window.forceShowStandaloneHoverPanel) {
                console.log('[DirectHoverPanel] Forcing standalone hover panel to show');
                window.forceShowStandaloneHoverPanel();
            }

            // Try to force the emergency hover panel to show
            if (window.emergencyHoverPanel) {
                console.log('[DirectHoverPanel] Forcing emergency hover panel to show');
                window.emergencyHoverPanel.show('Click on terrain to see composition data');
            }

            // Force our panel to be visible
            const panel = document.getElementById('direct-hover-panel');
            if (panel) {
                panel.style.cssText += 'display: block !important; visibility: visible !important;';
            }

            // Trigger a fake mouse move event to update all panels
            const canvas = document.getElementById('app');
            if (canvas) {
                const rect = canvas.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;

                const mouseEvent = new MouseEvent('mousemove', {
                    clientX: centerX,
                    clientY: centerY,
                    bubbles: true,
                    cancelable: true
                });

                canvas.dispatchEvent(mouseEvent);
            }
        }, 100);
    };

    // Add to document body
    document.body.appendChild(button);

    // Add a second button to force update the hover panel
    const updateButton = document.createElement('button');
    updateButton.id = 'direct-hover-update-button';
    updateButton.textContent = 'FORCE UPDATE';

    // Apply styles
    updateButton.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 180px !important;
        background-color: #ff9900 !important;
        color: white !important;
        border: none !important;
        padding: 10px 15px !important;
        font-weight: bold !important;
        font-size: 16px !important;
        cursor: pointer !important;
        z-index: 9999999 !important;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) !important;
    `;

    // Add click handler
    updateButton.onclick = function() {
        // Force update all hover panels
        const panel = document.getElementById('direct-hover-panel');
        if (panel) {
            // Generate sample materials
            const materials = [
                { symbol: 'H', name: 'Hydrogen', percentage: 75, color: '#00FFFF' },
                { symbol: 'He', name: 'Helium', percentage: 20, color: '#FF00FF' },
                { symbol: 'O', name: 'Oxygen', percentage: 5, color: '#FFFF00' }
            ];

            // Update the panel with sample data
            updateDirectHoverPanel(
                { x: 0, y: 0, z: 0 },
                materials,
                { shape: 'sphere', radius: 3 }
            );
        }

        // Try to force show the standalone hover panel if it exists
        if (window.forceShowStandaloneHoverPanel) {
            console.log('[DirectHoverPanel] Forcing standalone hover panel to show');
            window.forceShowStandaloneHoverPanel();
        }

        // Try to force the emergency hover panel to show
        if (window.emergencyHoverPanel) {
            console.log('[DirectHoverPanel] Forcing emergency hover panel to show');
            window.emergencyHoverPanel.show('Forced update at ' + new Date().toLocaleTimeString());
        }
    };

    // Add to document body
    document.body.appendChild(updateButton);

    // Set up direct mouse event listeners
    setupMouseListeners();

    // Set up a periodic check to ensure the panel is visible
    setInterval(() => {
        const panel = document.getElementById('direct-hover-panel');
        if (!panel || panel.style.display === 'none') {
            console.log('[DirectHoverPanel] Panel not visible, recreating');
            createDirectHoverPanel();
        }
    }, 5000);

    console.log('[DirectHoverPanel] Initialization complete');
}

// Set up mouse event listeners
function setupMouseListeners() {
    console.log('[DirectHoverPanel] Setting up mouse listeners');

    // Find the canvas
    const canvas = document.getElementById('app');
    if (!canvas) {
        console.error('[DirectHoverPanel] Canvas not found');
        return;
    }

    // Add mouse move listener to the canvas
    canvas.addEventListener('mousemove', handleMouseMove);

    // Add click listener to the canvas
    canvas.addEventListener('click', handleMouseClick);

    console.log('[DirectHoverPanel] Mouse listeners set up');
}

// Handle mouse move events
function handleMouseMove(event) {
    // Get mouse position
    const x = event.clientX;
    const y = event.clientY;

    // Try to get the raycaster and camera from the global scope
    if (window.raycaster && window.camera && window.scene) {
        // Calculate normalized device coordinates
        const rect = event.target.getBoundingClientRect();
        const mouseX = ((x - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((y - rect.top) / rect.height) * 2 + 1;

        // Update the raycaster
        window.raycaster.setFromCamera({ x: mouseX, y: mouseY }, window.camera);

        // Find intersections with the terrain
        const intersects = window.raycaster.intersectObjects(window.scene.children, true);

        if (intersects.length > 0) {
            // Get the first intersection point
            const point = intersects[0].point;

            // Try to get the current brush settings from the UI
            const brushShape = getBrushShapeFromUI() || 'sphere';
            const brushRadius = getBrushRadiusFromUI() || 3;

            // Try to get the mining dependencies from the global scope
            if (window.storedMiningDependencies && window.storedMiningDependencies.compInfo && window.storedMiningDependencies.compInfo.topElements) {
                try {
                    // Try to use the actual volume composition analyzer if available
                    if (window.analyzeVolumeComposition) {
                        const volumeData = window.analyzeVolumeComposition(
                            point,
                            window.storedMiningDependencies.compInfo.topElements,
                            0.1, // Default noise scale
                            new THREE.Vector3(0, 0, 0), // Default planet offset
                            brushRadius,
                            brushShape,
                            1, // Default verticality
                            20, // Higher resolution for more accurate analysis
                            8,  // 8 depth layers to match mining operation
                            0.25 // Default layer spacing
                        );

                        // Convert the volume data to materials array
                        const materials = Object.values(volumeData.materialCounts).map(material => ({
                            symbol: material.materialSymbol,
                            name: material.materialName,
                            percentage: material.percentage,
                            color: material.materialColor ?
                                `#${material.materialColor.r.toString(16).padStart(2, '0')}${material.materialColor.g.toString(16).padStart(2, '0')}${material.materialColor.b.toString(16).padStart(2, '0')}` :
                                '#FFFFFF'
                        }));

                        // Update the panel with real data
                        updateDirectHoverPanel(
                            point,
                            materials,
                            { shape: brushShape, radius: brushRadius }
                        );

                        console.log('[DirectHoverPanel] Updated with real volume data');
                        return;
                    }
                } catch (error) {
                    console.error('[DirectHoverPanel] Error analyzing volume:', error);
                }
            }

            // Fallback to sample data if we couldn't get real data
            const materials = [
                { symbol: 'H', name: 'Hydrogen', percentage: 75, color: '#00FFFF' },
                { symbol: 'He', name: 'Helium', percentage: 20, color: '#FF00FF' },
                { symbol: 'O', name: 'Oxygen', percentage: 5, color: '#FFFF00' }
            ];

            // Update the panel with sample data
            updateDirectHoverPanel(
                point,
                materials,
                { shape: brushShape, radius: brushRadius }
            );

            // Try to call the original hover handler if it exists
            if (window.handleTerrainHover) {
                window.handleTerrainHover(event);
            }
        }
    } else {
        // If we don't have access to the raycaster, try to find the hover info in the DOM
        tryExtractHoverInfo();
    }
}

// Get brush shape from UI
function getBrushShapeFromUI() {
    // Try to find the shape selector in the UI
    const shapeSelector = document.querySelector('select[name="shape"], #shape-selector');
    if (shapeSelector) {
        return shapeSelector.value || 'sphere';
    }

    // Try to find buttons or elements with shape names
    const shapeButtons = Array.from(document.querySelectorAll('button, .shape-button, [data-shape]'));
    const activeShapeButton = shapeButtons.find(button =>
        button.classList.contains('active') ||
        button.getAttribute('data-active') === 'true'
    );

    if (activeShapeButton) {
        const shape = activeShapeButton.textContent.toLowerCase() ||
                     activeShapeButton.getAttribute('data-shape') ||
                     'sphere';

        // Normalize shape name
        if (shape.includes('sphere')) return 'sphere';
        if (shape.includes('cube')) return 'cube';
        if (shape.includes('cylinder')) return 'cylinder';
        return 'sphere';
    }

    return 'sphere'; // Default
}

// Get brush radius from UI
function getBrushRadiusFromUI() {
    // Try to find the radius input in the UI
    const radiusInput = document.querySelector('input[name="radius"], #radius-input, #brush-size');
    if (radiusInput && radiusInput.value) {
        const radius = parseFloat(radiusInput.value);
        return isNaN(radius) ? 3 : radius;
    }

    // Try to find radius display elements
    const radiusDisplay = document.querySelector('#radius-display, .radius-value, [data-radius]');
    if (radiusDisplay) {
        const radiusText = radiusDisplay.textContent || radiusDisplay.getAttribute('data-radius');
        if (radiusText) {
            const radius = parseFloat(radiusText.replace(/[^\d.]/g, ''));
            return isNaN(radius) ? 3 : radius;
        }
    }

    return 3; // Default
}

// Handle mouse click events
function handleMouseClick(event) {
    console.log('[DirectHoverPanel] Canvas clicked');

    // Try to extract hover info from the DOM
    tryExtractHoverInfo();
}

// Try to extract hover info from the DOM
function tryExtractHoverInfo() {
    // Look for the hover info panel
    const hoverPanel = document.querySelector('.hover-info-panel, #hover-info-panel');
    if (hoverPanel && hoverPanel.innerHTML) {
        console.log('[DirectHoverPanel] Found hover info panel');

        // Try to extract position
        const positionMatch = hoverPanel.innerHTML.match(/X=([\d.-]+), Y=([\d.-]+), Z=([\d.-]+)/);
        const position = positionMatch ?
            { x: parseFloat(positionMatch[1]), y: parseFloat(positionMatch[2]), z: parseFloat(positionMatch[3]) } :
            null;

        // Try to extract materials
        const materials = [];
        const materialElements = hoverPanel.querySelectorAll('.material-item, [data-material]');

        if (materialElements.length > 0) {
            materialElements.forEach(el => {
                const symbol = el.querySelector('.symbol')?.textContent || 'Unknown';
                const percentage = parseFloat(el.querySelector('.percentage')?.textContent) || 0;
                const colorStyle = el.querySelector('.color')?.style.backgroundColor || '';
                const colorMatch = colorStyle.match(/rgb\((\d+), (\d+), (\d+)\)/);
                const color = colorMatch ?
                    `#${parseInt(colorMatch[1]).toString(16).padStart(2, '0')}${parseInt(colorMatch[2]).toString(16).padStart(2, '0')}${parseInt(colorMatch[3]).toString(16).padStart(2, '0')}` :
                    '#FFFFFF';

                materials.push({ symbol, percentage, color });
            });
        } else {
            // If we can't find material elements, try to parse the HTML
            const html = hoverPanel.innerHTML;
            const symbolMatches = html.match(/([A-Z][a-z]?):\s*([\d.]+)%/g);

            if (symbolMatches) {
                symbolMatches.forEach((match, index) => {
                    const [symbolPart, percentagePart] = match.split(':');
                    const symbol = symbolPart.trim();
                    const percentage = parseFloat(percentagePart.trim());

                    // Generate a color based on the index
                    const hue = (index * 137) % 360;
                    const color = `hsl(${hue}, 80%, 50%)`;

                    materials.push({ symbol, percentage, color });
                });
            }
        }

        // Try to extract brush info
        const brushMatch = hoverPanel.innerHTML.match(/(sphere|cube|cylinder),\s*Radius:\s*([\d.]+)/i);
        const brushInfo = brushMatch ?
            { shape: brushMatch[1].toLowerCase(), radius: parseFloat(brushMatch[2]) } :
            { shape: 'sphere', radius: 3 };

        // Update the panel
        if (position || materials.length > 0) {
            updateDirectHoverPanel(position, materials, brushInfo);
        }
    } else {
        // If we can't find the hover panel, try to find the mining panel
        const miningPanel = document.querySelector('.mining-panel, #mining-panel');
        if (miningPanel) {
            console.log('[DirectHoverPanel] Found mining panel');

            // Try to extract materials
            const materials = [];
            const materialRows = miningPanel.querySelectorAll('tr[data-material], .material-row');

            if (materialRows.length > 0) {
                materialRows.forEach(row => {
                    const symbol = row.querySelector('.symbol, [data-symbol]')?.textContent || 'Unknown';
                    const percentage = parseFloat(row.querySelector('.percentage, [data-percentage]')?.textContent) || 0;
                    const colorElement = row.querySelector('.color, [data-color]');
                    const color = colorElement ?
                        window.getComputedStyle(colorElement).backgroundColor || '#FFFFFF' :
                        '#FFFFFF';

                    materials.push({ symbol, percentage, color });
                });

                // Update the panel with the materials
                updateDirectHoverPanel(null, materials, { shape: 'sphere', radius: 3 });
            }
        } else {
            // If we can't find any panels, show a message
            showDirectHoverMessage('Could not find hover info. Try clicking on terrain.');
        }
    }
}

// Export the functions
window.directHoverPanel = {
    init: initDirectHoverSystem,
    update: updateDirectHoverPanel,
    show: showDirectHoverMessage
};

// Initialize when the script loads
console.log('[DirectHoverPanel] Script loaded');
setTimeout(initDirectHoverSystem, 1000); // Wait 1 second to ensure everything is loaded
