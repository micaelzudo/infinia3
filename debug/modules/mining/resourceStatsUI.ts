import { ResourceCalculationResult, ResourceDistribution, calculateResourceDistribution, calculateTotalResourceUnits, estimateTotalResources } from './resourceCalculator';
import { TopElementsData } from '../types/renderingTypes';

// Create and return the resource statistics UI element
export function createResourceStatsUI(containerId: string): HTMLElement {
    // Find or create container
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    // Create stats panel
    const statsPanel = document.createElement('div');
    statsPanel.className = 'resource-stats-panel';
    statsPanel.innerHTML = `
        <div class="stats-header">
            <h3>Resource Statistics</h3>
            <button class="calculate-button">Calculate Resources</button>
        </div>
        <div class="stats-content">
            <div class="stats-summary">
                <p>Click "Calculate Resources" to analyze the terrain composition.</p>
            </div>
            <div class="stats-chart-container">
                <canvas class="stats-chart"></canvas>
            </div>
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Material</th>
                            <th>Symbol</th>
                            <th>Percentage</th>
                            <th>Total Units</th>
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
    
    container.appendChild(statsPanel);
    return statsPanel;
}

// Update the resource statistics UI with calculation results
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

// Update the resource chart
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

    // Set canvas dimensions
    chartCanvas.width = 300;
    chartCanvas.height = 200;

    // Draw the pie chart
    drawPieChart(ctx, result.resources);
}

// Draw a pie chart of resource distribution
function drawPieChart(
    ctx: CanvasRenderingContext2D,
    resources: ResourceDistribution[]
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

// Add CSS styles for the resource statistics UI
export function addResourceStatsStyles(): void {
    // Check if styles already exist
    if (document.getElementById('resource-stats-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'resource-stats-styles';
    styleElement.textContent = `
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
        
        .calculate-button {
            background-color: #4a5568;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .calculate-button:hover {
            background-color: #2d3748;
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
    `;
    
    document.head.appendChild(styleElement);
}
