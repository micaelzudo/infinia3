import * as THREE from 'three';
import { ResourceCalculationResult, estimateTotalResources } from './resourceCalculator';
import { TopElementsData } from '../types/renderingTypes';
import { ResourceInventory } from './resourceInventory';
import { createSimpleInventoryPanel, updateSimpleInventoryPanel, addSimpleInventoryStyles } from './simpleInventoryPanel';
import { VolumeCompositionResult } from './volumeCompositionAnalyzer';
import { createYukaAIPanel, toggleYukaAIPanel } from '../ui/yukaAiPanel'; // <<< ADDED Yuka AI Panel import

/**
 * Create a simplified mining panel UI
 * @param container Container element to append the panel to
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param chunkSize Size of a chunk
 * @returns Object containing the created UI elements
 */
export function createSimpleMiningPanel(
    container: HTMLElement,
    topElements: TopElementsData | null,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    inventory: ResourceInventory,
    chunkSize: number = 32
): {
    miningPanelContainer: HTMLElement;
    resourceStatsPanel: HTMLElement;
    resourceCounterPanel: HTMLElement;
    inventoryPanel: HTMLElement;
    miningEffectsContainer: HTMLElement;
} {
    console.log("Creating simplified mining panel UI");

    // Create the mining panel container
    const miningPanelContainer = document.createElement('div');
    miningPanelContainer.className = 'mining-panel-container';
    container.appendChild(miningPanelContainer);

    // Create the mining panel header
    const miningPanelHeader = document.createElement('div');
    miningPanelHeader.className = 'mining-panel-header';
    miningPanelHeader.innerHTML = `
        <h3>Mining Panel</h3>
        <div class="header-buttons">
            <button class="calculate-button">Calculate Resources</button>
            <button class="grid-toggle-button">Show Grid</button>
            <button class="yuka-ai-toggle-button">Toggle Yuka AI</button> <!-- <<< ADDED Yuka AI Toggle Button -->
        </div>
    `;
    miningPanelContainer.appendChild(miningPanelHeader);

    // Create the mining panel content
    const miningPanelContent = document.createElement('div');
    miningPanelContent.className = 'mining-panel-content';
    miningPanelContainer.appendChild(miningPanelContent);

    // Create the resource stats panel
    const resourceStatsPanel = document.createElement('div');
    resourceStatsPanel.className = 'resource-stats-panel';
    resourceStatsPanel.innerHTML = `
        <div class="stats-header">
            <h3>Resource Statistics</h3>
        </div>
        <div class="stats-content">
            <div class="stats-summary">
                <p>Click "Calculate Resources" to analyze the terrain composition.</p>
            </div>
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Material</th>
                            <th>Symbol</th>
                            <th>%</th>
                            <th>Units</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="4" class="empty-table">No data available</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    miningPanelContent.appendChild(resourceStatsPanel);

    // Create the resource counter panel
    const resourceCounterPanel = document.createElement('div');
    resourceCounterPanel.className = 'resource-counter-panel';
    resourceCounterPanel.innerHTML = `
        <div class="counter-header">
            <h3>Material Composition</h3>
        </div>
        <div class="counter-content">
            <div class="material-counts">
                <p>Click "Calculate Resources" to analyze terrain composition</p>
            </div>
            <div class="grid-info">
                <h4>Internal Grid Data</h4>
                <p>Grid resolution: <span class="grid-value">32×32×32</span> cells</p>
                <p>Total voxels: <span class="grid-value">32,768</span></p>
            </div>
            <div class="internal-grid-visualization">
                <h4>Internal Grid Layers</h4>
                <div class="layer-visualization">
                    <div class="surface-layer">Surface</div>
                    <div class="internal-layers">
                        <div class="internal-layer">Layer 1</div>
                        <div class="internal-layer">Layer 2</div>
                        <div class="internal-layer">Layer 3</div>
                        <div class="internal-layer">Layer 4</div>
                        <div class="internal-layer">Layer 5</div>
                        <div class="internal-layer">Layer 6</div>
                        <div class="internal-layer">Layer 7</div>
                        <div class="internal-layer">Layer 8</div>
                    </div>
                </div>
                <p class="layer-info">Mining retrieves resources from all layers below the surface</p>
            </div>
        </div>
    `;
    miningPanelContent.appendChild(resourceCounterPanel);

    // Create the inventory panel
    const inventoryPanel = createSimpleInventoryPanel(inventory);
    miningPanelContent.appendChild(inventoryPanel);

    // Create the mining effects container
    const miningEffectsContainer = document.createElement('div');
    miningEffectsContainer.className = 'mining-effects-container';
    container.appendChild(miningEffectsContainer);

    // Add CSS for the mining panel and inventory
    addMiningPanelStyles();
    addSimpleInventoryStyles();

    // <<< ADDED: Event listener for Yuka AI toggle button >>>
    const yukaAiToggleButton = miningPanelHeader.querySelector('.yuka-ai-toggle-button');
    if (yukaAiToggleButton) {
        yukaAiToggleButton.addEventListener('click', () => {
            toggleYukaAIPanel();
            // Optionally, update button text or style based on panel visibility
            // For example: yukaAiToggleButton.textContent = getYukaAIPanelVisibility() ? 'Hide Yuka AI' : 'Show Yuka AI';
        });
    }

    return {
        miningPanelContainer,
        resourceStatsPanel,
        resourceCounterPanel,
        inventoryPanel,
        miningEffectsContainer
    };
}

/**
 * Update the resource statistics panel with calculation results
 * @param statsPanel Resource stats panel element
 * @param result Resource calculation result
 * @param chunkSize Size of a chunk
 */
export function updateResourceStatsPanel(
    statsPanel: HTMLElement,
    result: ResourceCalculationResult,
    chunkSize: number = 32
): void {
    if (!statsPanel) return;

    console.log("Updating resource stats panel with calculation results:", result);

    // Get the summary element
    const summaryElement = statsPanel.querySelector('.stats-summary');
    if (summaryElement) {
        summaryElement.innerHTML = `
            <p><strong>Analysis Complete</strong></p>
            <p>Total samples: ${result.totalSamples}</p>
            <p>Calculation time: ${result.calculationTime.toFixed(2)}ms</p>
            <p>Volume analyzed: ${result.boundingBox.size.x.toFixed(1)} × ${result.boundingBox.size.y.toFixed(1)} × ${result.boundingBox.size.z.toFixed(1)} units</p>
        `;
    }

    // Calculate total voxels in the chunk
    const totalVoxels = chunkSize * chunkSize * chunkSize;

    // Update the table
    const tableBody = statsPanel.querySelector('.stats-table tbody');
    if (tableBody) {
        tableBody.innerHTML = '';

        result.resources.forEach(resource => {
            // Calculate units based on percentage
            const units = Math.round((resource.percentage / 100) * totalVoxels);

            const row = document.createElement('tr');

            // Create color cell with a color swatch
            const colorCell = document.createElement('td');
            colorCell.className = 'material-cell';
            const colorHex = '#' + resource.color.getHexString();
            colorCell.innerHTML = `
                <span class="color-swatch" style="background-color: ${colorHex}"></span>
                <span>${resource.name}</span>
            `;

            // Create symbol cell
            const symbolCell = document.createElement('td');
            symbolCell.textContent = resource.symbol;

            // Create percentage cell
            const percentCell = document.createElement('td');
            percentCell.textContent = resource.percentage.toFixed(1) + '%';

            // Create units cell
            const unitsCell = document.createElement('td');
            unitsCell.textContent = units.toLocaleString();

            // Add cells to row
            row.appendChild(colorCell);
            row.appendChild(symbolCell);
            row.appendChild(percentCell);
            row.appendChild(unitsCell);

            // Add row to table
            tableBody.appendChild(row);
        });
    }
}

/**
 * Update the resource counter panel with calculation results
 * @param counterPanel Resource counter panel element
 * @param result Resource calculation result
 */
export function updateResourceCounterPanel(
    counterPanel: HTMLElement,
    result: ResourceCalculationResult
): void {
    if (!counterPanel) return;

    console.log("Updating resource counter panel with calculation results:", result);

    // Calculate total voxels in the chunk (32x32x32)
    const totalVoxels = 32768; // 32^3

    // Calculate the total units of each resource
    const resourceUnits = result.resources.map((resource, index) => ({
        ...resource,
        index, // Store the index which corresponds to the material index
        units: Math.round((resource.percentage / 100) * totalVoxels)
    }));

    // Update the material counts
    const materialCountsDiv = counterPanel.querySelector('.material-counts');
    if (materialCountsDiv) {
        // Create a detailed resource counter table
        let countsHTML = `
            <table class="resource-counter-table">
                <thead>
                    <tr>
                        <th>Material</th>
                        <th>Index</th>
                        <th>Units</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Add rows for each resource
        resourceUnits.forEach((resource) => {
            countsHTML += `
                <tr>
                    <td>
                        <span class="material-swatch" style="background-color: #${resource.color.getHexString()}"></span>
                        ${resource.symbol}
                    </td>
                    <td>${resource.index}</td>
                    <td>${resource.units.toLocaleString()}</td>
                </tr>
            `;
        });

        countsHTML += `
                </tbody>
            </table>
        `;

        materialCountsDiv.innerHTML = countsHTML;
    }

    // Update the grid info
    const gridInfoDiv = counterPanel.querySelector('.grid-info');
    if (gridInfoDiv) {
        const volumeAnalyzed = result.boundingBox.size.x * result.boundingBox.size.y * result.boundingBox.size.z;

        gridInfoDiv.innerHTML = `
            <h4>Internal Grid Data</h4>
            <p>Grid resolution: <span class="grid-value">32×32×32</span> cells</p>
            <p>Total voxels: <span class="grid-value">${totalVoxels.toLocaleString()}</span></p>
            <p>Volume analyzed: <span class="grid-value">${volumeAnalyzed.toFixed(0)}</span> cubic units</p>
            <p>Material types: <span class="grid-value">${result.resources.length}</span></p>
            <p>Calculation time: <span class="grid-value">${result.calculationTime.toFixed(2)}ms</span></p>
        `;
    }
}

/**
 * Add CSS styles for the mining panel
 */
function addMiningPanelStyles(): void {
    // Check if styles already exist
    if (document.getElementById('mining-panel-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'mining-panel-styles';
    styleElement.textContent = `
        .mining-panel-container {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 360px;
            max-height: 80%;
            background-color: rgba(30, 41, 59, 0.97);
            border: 1px solid #3b82f6;
            border-radius: 8px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            padding: 16px;
            overflow-y: auto;
            z-index: 10;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
            animation: fadeInPanel 0.5s ease-out;
        }
        
        @keyframes fadeInPanel {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .mining-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #4a5568;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .mining-panel-header h3 {
            margin: 0;
            font-size: 18px;
            color: #e2e8f0;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .mining-panel-header h3::before {
            content: '⛏️';
            display: inline-block;
            margin-right: 6px;
        }

        .header-buttons {
            display: flex;
            gap: 8px;
        }

        .header-buttons button {
            background-color: rgba(74, 85, 104, 0.7);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        .header-buttons button:hover {
            background-color: #2d3748;
            transform: translateY(-1px);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
        }
        
        .header-buttons button:active {
            transform: translateY(1px);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .calculate-button {
            background-color: rgba(59, 130, 246, 0.7) !important;
        }
        
        .calculate-button:hover {
            background-color: #3182ce !important;
        }
        
        .calculate-button::before {
            content: '📊';
            display: inline-block;
        }

        .grid-toggle-button.active {
            background-color: rgba(56, 161, 105, 0.7) !important;
        }
        
        .grid-toggle-button::before {
            content: '🔍';
            display: inline-block;
        }

        .mining-panel-content {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .resource-stats-panel, .resource-counter-panel {
            background-color: rgba(44, 55, 72, 0.7);
            border: 1px solid rgba(74, 85, 104, 0.5);
            border-radius: 8px;
            padding: 16px;
            width: 100%;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .resource-stats-panel:hover, .resource-counter-panel:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
        }

        .stats-header, .counter-header {
            border-bottom: 1px solid rgba(74, 85, 104, 0.5);
            margin-bottom: 14px;
            padding-bottom: 8px;
            display: flex;
            align-items: center;
        }

        .stats-header h3, .counter-header h3 {
            margin: 0;
            font-size: 15px;
            color: #e2e8f0;
            font-weight: bold;
        }
        
        .stats-header h3::before {
            content: '📈';
            display: inline-block;
            margin-right: 6px;
        }
        
        .counter-header h3::before {
            content: '🧪';
            display: inline-block;
            margin-right: 6px;
        }

        .stats-content, .counter-content {
            font-size: 13px;
            line-height: 1.6;
        }

        .stats-summary {
            margin-bottom: 14px;
            background-color: rgba(26, 32, 44, 0.4);
            padding: 10px;
            border-radius: 6px;
            border-left: 3px solid #60a5fa;
        }

        .stats-table, .resource-counter-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
            margin-top: 10px;
        }

        .stats-table th, .stats-table td,
        .resource-counter-table th, .resource-counter-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid rgba(74, 85, 104, 0.3);
        }

        .stats-table th, .resource-counter-table th {
            color: #a0aec0;
            font-weight: bold;
            background-color: rgba(26, 32, 44, 0.5);
        }
        
        .stats-table tr:hover, .resource-counter-table tr:hover {
            background-color: rgba(26, 32, 44, 0.3);
        }

        .empty-table {
            text-align: center;
            color: #a0aec0;
            padding: 14px;
            background-color: rgba(26, 32, 44, 0.3);
            border-radius: 4px;
        }

        .color-swatch, .material-swatch {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 2px;
            margin-right: 6px;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
        }

        .material-cell {
            display: flex;
            align-items: center;
        }

        .grid-info {
            margin-top: 16px;
            padding: 12px;
            background-color: rgba(26, 32, 44, 0.4);
            border-radius: 6px;
            box-shadow: inset 0 0 0 1px rgba(74, 85, 104, 0.3);
        }

        .grid-info h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #a0aec0;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .grid-info h4::before {
            content: '🔢';
            display: inline-block;
            font-size: 12px;
        }

        .grid-info p {
            margin: 4px 0;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            border-bottom: 1px dotted rgba(74, 85, 104, 0.3);
            padding-bottom: 4px;
        }

        .grid-value {
            font-weight: bold;
            color: #4fd1c5;
        }

        /* Internal Grid Visualization Styles */
        .internal-grid-visualization {
            margin-top: 15px;
            padding: 14px;
            background-color: rgba(26, 32, 44, 0.4);
            border-radius: 8px;
            border: 1px solid rgba(74, 85, 104, 0.3);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .internal-grid-visualization h4 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #a0aec0;
            font-weight: bold;
            display: flex;
            align-items: center;
        }
        
        .internal-grid-visualization h4::before {
            content: '📋';
            display: inline-block;
            margin-right: 6px;
            font-size: 12px;
        }

        .layer-visualization {
            display: flex;
            flex-direction: column;
            gap: 3px;
            margin: 14px 0;
        }

        .surface-layer {
            background-color: rgba(79, 209, 197, 0.25);
            border: 1px solid #4fd1c5;
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 13px;
            text-align: center;
            color: #e2e8f0;
            font-weight: bold;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        
        .surface-layer:hover {
            background-color: rgba(79, 209, 197, 0.4);
            transform: translateY(-2px);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
        }

        .internal-layers {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .internal-layer {
            background-color: rgba(66, 153, 225, 0.2);
            border: 1px solid #4299e1;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            text-align: center;
            color: #e2e8f0;
            opacity: 0.8;
            transition: all 0.3s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .internal-layer:hover {
            opacity: 1;
            background-color: rgba(66, 153, 225, 0.3);
            transform: translateY(-1px);
            box-shadow: 0 3px 5px rgba(0, 0, 0, 0.15);
        }

        .internal-layer:nth-child(even) {
            background-color: rgba(66, 153, 225, 0.15);
        }
        
        .internal-layer:nth-child(even):hover {
            background-color: rgba(66, 153, 225, 0.25);
        }

        .layer-info {
            font-size: 12px;
            color: #a0aec0;
            margin: 10px 0 0 0;
            text-align: center;
            font-style: italic;
            padding: 8px;
            background-color: rgba(26, 32, 44, 0.3);
            border-radius: 4px;
        }

        /* Mining Effects Styles */
        .mining-effects-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
            overflow: hidden;
        }

        .mining-effect {
            position: absolute;
            font-family: 'Arial', sans-serif;
            font-weight: bold;
            font-size: 16px;
            white-space: nowrap;
            pointer-events: none;
            animation: float-up 2s ease-out forwards;
            text-shadow: 0 0 6px currentColor, 0 0 10px rgba(0, 0, 0, 0.5);
            transform: scale(0);
        }

        @keyframes float-up {
            0% {
                opacity: 0;
                transform: translateY(10px) scale(0.8);
            }
            15% {
                opacity: 1;
                transform: translateY(0) scale(1.1);
            }
            30% {
                transform: translateY(-5px) scale(1);
            }
            80% {
                opacity: 1;
            }
            100% {
                opacity: 0;
                transform: translateY(-40px) scale(0.8);
            }
        }
    `;

    document.head.appendChild(styleElement);
}

/**
 * Update the inventory panel with current inventory data
 * @param inventoryPanel Inventory panel element
 * @param inventory Resource inventory
 */
export function updateInventoryPanel(
    inventoryPanel: HTMLElement,
    inventory: ResourceInventory
): void {
    if (!inventoryPanel) return;

    // Use the simple inventory panel update function
    updateSimpleInventoryPanel(inventoryPanel, inventory);
}

/**
 * Update the resource counter panel with volume composition data
 * @param counterPanel Resource counter panel element
 * @param volumeComposition Volume composition result
 */
export function updateResourceCounterWithVolumeData(
    counterPanel: HTMLElement,
    volumeComposition: VolumeCompositionResult
): void {
    if (!counterPanel) return;

    console.log("Updating resource counter with volume composition data:", volumeComposition);

    // Calculate total voxels in the chunk (32x32x32)
    const totalVoxels = 32768; // 32^3

    // Calculate the total units of each material based on the volume composition
    const materialUnits = Object.values(volumeComposition.materialCounts).map(material => ({
        ...material,
        units: Math.round((material.percentage / 100) * totalVoxels)
    }));

    // Sort materials by percentage (descending)
    materialUnits.sort((a, b) => b.percentage - a.percentage);

    // Update the material counts
    const materialCountsDiv = counterPanel.querySelector('.material-counts');
    if (materialCountsDiv) {
        // Create a detailed resource counter table
        let countsHTML = `
            <table class="resource-counter-table">
                <thead>
                    <tr>
                        <th>Material</th>
                        <th>Index</th>
                        <th>%</th>
                        <th>Units</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Add rows for each material
        materialUnits.forEach((material) => {
            countsHTML += `
                <tr>
                    <td>
                        <span class="material-swatch" style="background-color: #${material.materialColor.getHexString()}"></span>
                        ${material.materialSymbol}
                    </td>
                    <td>${material.materialIndex}</td>
                    <td>${material.percentage.toFixed(1)}%</td>
                    <td>${material.units.toLocaleString()}</td>
                </tr>
            `;
        });

        countsHTML += `
                </tbody>
            </table>
        `;

        materialCountsDiv.innerHTML = countsHTML;
    }

    // Update the grid info
    const gridInfoDiv = counterPanel.querySelector('.grid-info');
    if (gridInfoDiv) {
        const volumeAnalyzed = volumeComposition.boundingBox.size.x *
                              volumeComposition.boundingBox.size.y *
                              volumeComposition.boundingBox.size.z;

        // Calculate the number of layers based on the total points and resolution
        // Assuming a square resolution for each layer
        const pointsPerLayer = Math.sqrt(volumeComposition.totalPoints / 9); // Approximate, assuming 9 layers (8 internal + 1 surface)
        const layerResolution = Math.round(Math.sqrt(pointsPerLayer));

        gridInfoDiv.innerHTML = `
            <h4>Volume Analysis Data</h4>
            <p>Grid resolution: <span class="grid-value">${layerResolution}×${layerResolution}×${layerResolution}</span></p>
            <p>Total voxels: <span class="grid-value">${totalVoxels.toLocaleString()}</span></p>
            <p>Volume analyzed: <span class="grid-value">${volumeAnalyzed.toFixed(0)}</span> cubic units</p>
            <p>Sample points: <span class="grid-value">${volumeComposition.totalPoints.toLocaleString()}</span></p>
            <p>Material types: <span class="grid-value">${Object.keys(volumeComposition.materialCounts).length}</span></p>
            <p>Calculation time: <span class="grid-value">${volumeComposition.calculationTime.toFixed(2)}ms</span></p>
        `;
    }

    // Update the internal grid visualization with an enhanced interactive view
    const visualizationDiv = counterPanel.querySelector('.internal-grid-visualization');
    if (visualizationDiv) {
        // Get the top 3 materials by percentage
        const topMaterials = Object.values(volumeComposition.materialCounts)
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3);

        if (topMaterials.length > 0) {
            // Create interactive grid visualization header with controls
            let gridHTML = `
                <div class="grid-viz-header">
                    <h4>Internal Grid Layers</h4>
                    <div class="grid-viz-controls">
                        <button class="grid-viz-button grid-viz-explode">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Explode View
                        </button>
                        <button class="grid-viz-button grid-viz-reset">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v6h6"></path><path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path><path d="M21 22v-6h-6"></path><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path></svg>
                            Reset
                        </button>
                    </div>
                </div>
                <div class="layer-visualization" id="layer-visualization-container">
            `;

            // Add the surface layer with enhanced interactive design
                const mainMaterial = topMaterials[0];
            const surfaceColorHex = '#' + mainMaterial.materialColor.getHexString();
            gridHTML += `
                <div class="surface-layer" data-layer-index="0" data-material="${mainMaterial.materialName}" style="border-color: ${surfaceColorHex}; background-color: ${surfaceColorHex}33;">
                    <div class="layer-content">
                        <div class="layer-title">Surface Layer</div>
                        <div class="layer-info-row">
                            <span class="layer-material">${mainMaterial.materialSymbol}</span>
                            <span class="layer-percentage">${mainMaterial.percentage.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            `;

            // Add internal layers with interactive elements
            gridHTML += '<div class="internal-layers">';
            
            // Create 8 internal layers with distribution of materials
            for (let i = 0; i < 8; i++) {
                    // Cycle through the top materials for different layers
                const materialIndex = i % topMaterials.length;
                    const material = topMaterials[materialIndex];
                    const colorHex = '#' + material.materialColor.getHexString();

                // Calculate estimated units for this layer - fade opacity with depth
                    const layerUnits = Math.round((material.percentage / 100) * (totalVoxels / 9)); // Divide by 9 for 9 layers
                const opacity = 1 - (i * 0.08); // Gradually reduce opacity for deeper layers
                
                gridHTML += `
                    <div class="internal-layer" data-layer-index="${i+1}" data-material="${material.materialName}" style="border-color: ${colorHex}; background-color: ${colorHex}22; opacity: ${opacity};">
                        <div class="layer-content">
                            <div class="layer-title">Layer ${i + 1}</div>
                            <div class="layer-info-row">
                                <span class="layer-material">${material.materialSymbol}</span>
                                <span class="layer-percentage">~${layerUnits.toLocaleString()} units</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            gridHTML += '</div>'; // Close internal-layers
            gridHTML += '</div>'; // Close layer-visualization
            
            // Add interactive features info
            gridHTML += `
                <div class="layer-info">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    Click on layers to highlight. Mining retrieves resources from all layers.
                </div>
            `;
            
            visualizationDiv.innerHTML = gridHTML;
            
            // Add interaction handlers
            const layerElements = visualizationDiv.querySelectorAll('.surface-layer, .internal-layer');
            layerElements.forEach(layer => {
                layer.addEventListener('click', function() {
                    // Toggle highlighted state
                    if (this.classList.contains('layer-highlighted')) {
                        this.classList.remove('layer-highlighted');
                    } else {
                        // Remove highlight from other layers
                        layerElements.forEach(l => l.classList.remove('layer-highlighted'));
                        this.classList.add('layer-highlighted');
                    }
                });
            });

            // Handle explode view button
            const explodeButton = visualizationDiv.querySelector('.grid-viz-explode');
            const resetButton = visualizationDiv.querySelector('.grid-viz-reset');
            const layerContainer = visualizationDiv.querySelector('#layer-visualization-container');
            
            if (explodeButton && resetButton && layerContainer) {
                explodeButton.addEventListener('click', function() {
                    layerContainer.classList.add('exploded-view');
                    this.style.display = 'none';
                    if (resetButton) {
                        resetButton.style.display = 'flex';
                    }
                });
                
                resetButton.addEventListener('click', function() {
                    layerContainer.classList.remove('exploded-view');
                    this.style.display = 'none';
                    if (explodeButton) {
                        explodeButton.style.display = 'flex';
                    }
                    // Remove all highlights
                    layerElements.forEach(l => l.classList.remove('layer-highlighted'));
                });
                
                // Initially hide reset button
                resetButton.style.display = 'none';
            }
        }
    }
}
