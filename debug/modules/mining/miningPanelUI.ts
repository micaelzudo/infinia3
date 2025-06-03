import * as THREE from 'three';
import { ResourceInventory, createInventory, getResourcesArray } from './resourceInventory';
import { createInventoryUI, updateInventoryUI, addInventoryStyles } from './resourceInventoryUI';
import { MiningTool, MiningToolType, createDefaultTools } from './miningSystem';
import { createMiningToolsUI, updateToolsUI, addMiningToolsStyles } from './miningToolsUI';
import { ResourceCalculationResult, estimateTotalResources, calculateTotalResourceUnits } from './resourceCalculator';
import { TopElementsData } from '../types/renderingTypes';

/**
 * Create the mining panel UI
 * @param container Container element to append the panel to
 * @param topElements Material composition data
 * @param noiseScale Noise scale for material distribution
 * @param planetOffset Planet offset for noise calculation
 * @param chunkSize Size of a chunk
 * @returns Object containing the created UI elements
 */
export function createMiningPanelUI(
    container: HTMLElement,
    topElements: TopElementsData | null,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    chunkSize: number = 32
): {
    miningEffectsContainer: HTMLElement;
    inventoryPanel: HTMLElement;
    toolsPanel: HTMLElement;
    resourceStatsPanel: HTMLElement;
    miningInfoPanel: HTMLElement;
} {
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
        </div>
    `;
    miningPanelContainer.appendChild(miningPanelHeader);

    // Create the mining panel content
    const miningPanelContent = document.createElement('div');
    miningPanelContent.className = 'mining-panel-content';
    miningPanelContainer.appendChild(miningPanelContent);

    // Create the left column (resource stats and info)
    const leftColumn = document.createElement('div');
    leftColumn.className = 'mining-panel-column';
    miningPanelContent.appendChild(leftColumn);

    // Create the resource stats container
    const statsContainer = document.createElement('div');
    statsContainer.className = 'resource-stats-container';
    leftColumn.appendChild(statsContainer);

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
            <div class="stats-chart-container">
                <canvas class="stats-chart" width="250" height="150"></canvas>
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
    statsContainer.appendChild(resourceStatsPanel);

    // Create the resource counter panel
    const miningInfoPanel = document.createElement('div');
    miningInfoPanel.className = 'mining-info-panel';
    miningInfoPanel.innerHTML = `
        <div class="info-header">
            <h3>Resource Counter</h3>
        </div>
        <div class="info-content">
            <div class="resource-counter">
                <h4>Material Composition</h4>
                <div class="material-counts">
                    <div class="resource-counter-message">
                        <p>Click "Calculate Resources" to analyze terrain composition</p>
                        <p>This will show the material index and unit count for each resource type</p>
                    </div>
                </div>
            </div>

            <div class="grid-displacement-info">
                <h4>Internal Grid Data</h4>
                <p>Grid resolution: <span class="grid-value">32×32×32</span> cells per chunk</p>
                <p>Total voxels: <span class="grid-value">32,768</span> per chunk</p>
                <p>Sampling depth: <span class="grid-value">8</span> layers</p>
            </div>
        </div>
    `;
    leftColumn.appendChild(miningInfoPanel);

    // Create the right column (inventory and tools)
    const rightColumn = document.createElement('div');
    rightColumn.className = 'mining-panel-column';
    miningPanelContent.appendChild(rightColumn);

    // Create the inventory container
    const inventoryContainer = document.createElement('div');
    inventoryContainer.className = 'mining-inventory-container';
    rightColumn.appendChild(inventoryContainer);

    // Create the inventory panel
    const inventoryPanel = createInventoryUI('mining-inventory-container');
    addInventoryStyles();

    // Create the tools container
    const toolsContainer = document.createElement('div');
    toolsContainer.className = 'mining-tools-container';
    rightColumn.appendChild(toolsContainer);

    // Create the tools panel
    const toolsPanel = createMiningToolsUI('mining-tools-container');
    addMiningToolsStyles();

    // Create the mining effects container
    const miningEffectsContainer = document.createElement('div');
    miningEffectsContainer.className = 'mining-effects-container';
    container.appendChild(miningEffectsContainer);

    // Add CSS for the mining panel
    addMiningPanelStyles();

    return {
        miningEffectsContainer,
        inventoryPanel,
        toolsPanel,
        resourceStatsPanel,
        miningInfoPanel
    };
}

/**
 * Update the resource statistics UI with calculation results
 * @param statsPanel Resource stats panel element
 * @param result Resource calculation result
 * @param chunkSize Size of a chunk
 */
export function updateResourceStatsUI(
    statsPanel: HTMLElement,
    result: ResourceCalculationResult,
    chunkSize: number = 32
): void {
    if (!statsPanel) return;

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

    // Calculate total resource units
    const totalUnits = calculateTotalResourceUnits(chunkSize, result);

    // Update the table
    const tableBody = statsPanel.querySelector('.stats-table tbody');
    if (tableBody) {
        tableBody.innerHTML = '';

        result.resources.forEach(resource => {
            const row = document.createElement('tr');

            // Create color cell with a color swatch
            const colorCell = document.createElement('td');
            colorCell.className = 'material-cell';
            const colorHex = '#' + resource.color.getHexString();
            colorCell.innerHTML = `
                <span class="color-swatch" style="background-color: ${colorHex}"></span>
                <span>${resource.name}</span>
            `;

            // Create other cells
            const symbolCell = document.createElement('td');
            symbolCell.textContent = resource.symbol;

            const percentageCell = document.createElement('td');
            percentageCell.textContent = `${resource.percentage.toFixed(2)}%`;

            const unitsCell = document.createElement('td');
            unitsCell.textContent = `${totalUnits[resource.symbol].toLocaleString()}`;

            // Add cells to row
            row.appendChild(colorCell);
            row.appendChild(symbolCell);
            row.appendChild(percentageCell);
            row.appendChild(unitsCell);

            // Add row to table
            tableBody.appendChild(row);
        });
    }

    // Update the chart
    updateResourceChart(statsPanel, result);
}

/**
 * Update the mining information panel with resource calculation results
 * @param infoPanel Mining info panel element
 * @param result Resource calculation result
 */
export function updateMiningInfoPanel(
    infoPanel: HTMLElement,
    result: ResourceCalculationResult
): void {
    if (!infoPanel) return;

    console.log("Updating mining info panel with resource calculation results:", result);

    // Calculate total voxels in the chunk (32x32x32)
    const totalVoxels = 32768; // 32^3

    // Calculate the total units of each resource
    const resourceUnits = result.resources.map((resource, originalIndex) => ({
        ...resource,
        originalIndex, // Store the original index which corresponds to the material index
        units: Math.round((resource.percentage / 100) * totalVoxels)
    }));

    // Calculate total volume analyzed
    const volumeAnalyzed = result.boundingBox.size.x * result.boundingBox.size.y * result.boundingBox.size.z;
    const totalUnits = resourceUnits.reduce((sum, r) => sum + r.units, 0);

    // Update the info panel content
    const infoContent = infoPanel.querySelector('.info-content');
    if (infoContent) {
        const materialCountsDiv = infoContent.querySelector('.material-counts');
        if (materialCountsDiv) {
            // Create a detailed resource counter table
            let countsHTML = `
                <table class="resource-counter-table">
                    <thead>
                        <tr>
                            <th>Material</th>
                            <th>Index</th>
                            <th>Units</th>
                            <th>%</th>
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
                            ${resource.name}
                        </td>
                        <td>${resource.originalIndex}</td>
                        <td>${resource.units.toLocaleString()}</td>
                        <td>${resource.percentage.toFixed(1)}%</td>
                    </tr>
                `;
            });

            countsHTML += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>Total</strong></td>
                            <td><strong>${totalUnits.toLocaleString()}</strong></td>
                            <td><strong>100%</strong></td>
                        </tr>
                    </tfoot>
                </table>
            `;

            materialCountsDiv.innerHTML = countsHTML;
        }

        // Update the grid displacement info
        const gridInfoDiv = infoContent.querySelector('.grid-displacement-info');
        if (gridInfoDiv) {
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
}

/**
 * Update the resource chart
 * @param statsPanel Resource stats panel element
 * @param result Resource calculation result
 */
function updateResourceChart(
    statsPanel: HTMLElement,
    result: ResourceCalculationResult
): void {
    const chartCanvas = statsPanel.querySelector('.stats-chart') as HTMLCanvasElement;
    if (!chartCanvas) return;

    // Get the chart context
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);

    // Draw the pie chart
    drawPieChart(ctx, result.resources);
}

/**
 * Draw a pie chart of resource distribution
 * @param ctx Canvas context
 * @param resources Resource distribution data
 */
function drawPieChart(
    ctx: CanvasRenderingContext2D,
    resources: Array<{
        symbol: string;
        name: string;
        color: THREE.Color;
        percentage: number;
    }>
): void {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const radius = Math.min(centerX, centerY) * 0.8;

    // Start at the top
    let startAngle = -Math.PI / 2;

    // Draw each slice
    resources.forEach(resource => {
        const sliceAngle = (resource.percentage / 100) * (Math.PI * 2);
        const endAngle = startAngle + sliceAngle;

        // Draw the slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        // Fill with the resource color
        ctx.fillStyle = '#' + resource.color.getHexString();
        ctx.fill();

        // Draw a white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Only add labels for slices that are large enough
        if (resource.percentage > 5) {
            // Calculate the midpoint angle for the text
            const midAngle = startAngle + sliceAngle / 2;

            // Position the text at 2/3 of the radius from the center
            const textX = centerX + Math.cos(midAngle) * (radius * 0.6);
            const textY = centerY + Math.sin(midAngle) * (radius * 0.6);

            // Draw the text
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(resource.symbol, textX, textY);
        }

        // Move to the next slice
        startAngle = endAngle;
    });

    // Add a legend
    const legendX = 10;
    let legendY = ctx.canvas.height - 10 - (resources.length * 15);

    // Only show top 5 resources in legend to avoid overcrowding
    const legendResources = resources.slice(0, 5);

    legendResources.forEach(resource => {
        // Draw color box
        ctx.fillStyle = '#' + resource.color.getHexString();
        ctx.fillRect(legendX, legendY - 8, 10, 10);

        // Draw text
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${resource.symbol} (${resource.percentage.toFixed(1)}%)`, legendX + 15, legendY);

        legendY += 15;
    });
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
            bottom: 10px;
            left: 10px;
            width: 300px;
            max-height: 80%;
            background-color: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            padding: 10px;
            overflow-y: auto;
            z-index: 10;
        }

        .mining-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444;
            padding-bottom: 10px;
            margin-bottom: 10px;
        }

        .mining-panel-header h3 {
            margin: 0;
            font-size: 16px;
            color: #e2e8f0;
        }

        .header-buttons {
            display: flex;
            gap: 5px;
        }

        .header-buttons button {
            background-color: #4a5568;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 11px;
        }

        .header-buttons button:hover {
            background-color: #2d3748;
        }

        .grid-toggle-button.active {
            background-color: #38a169;
        }

        .mining-panel-content {
            display: flex;
            gap: 15px;
        }

        .mining-panel-column {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .resource-stats-panel {
            background-color: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            padding: 10px;
            width: 100%;
        }

        .stats-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }

        .stats-header h3 {
            margin: 0;
            font-size: 16px;
        }

        .stats-buttons {
            display: flex;
            gap: 8px;
        }

        .calculate-button, .grid-toggle-button {
            background-color: #4a5568;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
        }

        .calculate-button:hover, .grid-toggle-button:hover {
            background-color: #2d3748;
        }

        .grid-toggle-button.active {
            background-color: #38a169;
        }

        .grid-toggle-button.active:hover {
            background-color: #2f855a;
        }

        .stats-content {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .stats-summary {
            font-size: 12px;
            color: #cbd5e0;
        }

        .stats-chart-container {
            display: flex;
            justify-content: center;
            margin: 10px 0;
        }

        .stats-chart {
            max-width: 100%;
            height: auto;
        }

        .stats-table-container {
            max-height: 200px;
            overflow-y: auto;
        }

        .stats-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }

        .stats-table th,
        .stats-table td {
            padding: 5px;
            text-align: left;
            border-bottom: 1px solid #444;
        }

        .stats-table th {
            background-color: #2d3748;
            position: sticky;
            top: 0;
        }

        .material-cell {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .color-swatch {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }

        .empty-table {
            text-align: center;
            color: #a0aec0;
            padding: 20px 0;
        }

        .mining-info-panel {
            background-color: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            padding: 10px;
        }

        .info-header {
            border-bottom: 1px solid #444;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }

        .info-header h3 {
            margin: 0;
            font-size: 16px;
        }

        .info-content {
            font-size: 14px;
            color: #ddd;
        }

        .info-content h4 {
            margin: 15px 0 5px 0;
            font-size: 15px;
            color: #fff;
        }

        .info-content p {
            margin: 5px 0;
        }

        .info-content ul {
            margin: 5px 0;
            padding-left: 20px;
        }

        .info-content li {
            margin-bottom: 3px;
        }

        .resource-distribution-bar {
            width: 100%;
            height: 20px;
            display: flex;
            margin: 10px 0;
            border-radius: 3px;
            overflow: hidden;
        }

        .resource-bar-segment {
            height: 100%;
            min-width: 1px;
        }

        .resource-distribution-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 10px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
        }

        .legend-label {
            font-size: 12px;
        }

        .resource-counter-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 5px;
            border: 1px solid #444;
        }

        .resource-counter-table th,
        .resource-counter-table td {
            padding: 4px;
            text-align: left;
            border-bottom: 1px solid #444;
        }

        .resource-counter-table th {
            background-color: #2d3748;
            position: sticky;
            top: 0;
        }

        .resource-counter-table tfoot {
            background-color: rgba(0, 0, 0, 0.3);
            font-weight: bold;
        }

        .resource-counter-table tfoot td {
            border-top: 2px solid #555;
        }

        .resource-counter-message {
            background-color: rgba(0, 0, 0, 0.2);
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            color: #aaa;
        }

        .material-swatch {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 2px;
            margin-right: 5px;
        }

        .grid-displacement-info {
            margin-top: 15px;
            padding: 10px;
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
        }

        .grid-value {
            font-weight: bold;
            color: #4fd1c5;
        }

        .mining-effects-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 900;
        }
    `;

    document.head.appendChild(styleElement);
}
