import { MiningTool, MiningToolType, createDefaultTools } from './miningSystem';

// Create and return the mining tools UI element
export function createMiningToolsUI(containerId: string): HTMLElement {
    // Find or create container
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    // Create tools panel
    const toolsPanel = document.createElement('div');
    toolsPanel.className = 'mining-tools-panel';
    toolsPanel.innerHTML = `
        <div class="tools-header">
            <h3>Mining Tools</h3>
        </div>
        <div class="tools-container"></div>
    `;
    
    container.appendChild(toolsPanel);
    return toolsPanel;
}

// Update the tools UI with current tools data
export function updateToolsUI(
    toolsPanel: HTMLElement,
    tools: { [key in MiningToolType]: MiningTool },
    activeTool: MiningToolType,
    onSelectTool: (toolType: MiningToolType) => void
): void {
    if (!toolsPanel) return;

    // Get tools container
    const toolsContainer = toolsPanel.querySelector('.tools-container');
    if (!toolsContainer) return;

    // Clear existing tools
    toolsContainer.innerHTML = '';

    // Add each tool
    Object.values(tools).forEach(tool => {
        const toolElement = document.createElement('div');
        toolElement.className = `tool-item ${tool.type === activeTool ? 'active-tool' : ''}`;
        toolElement.dataset.toolType = tool.type;
        
        // Calculate durability percentage
        const durabilityPercent = tool.durability === Infinity 
            ? 100 
            : Math.floor((tool.durability / tool.maxDurability) * 100);
        
        // Determine durability color
        let durabilityColor = '#4ade80'; // Green
        if (durabilityPercent < 30) {
            durabilityColor = '#ef4444'; // Red
        } else if (durabilityPercent < 70) {
            durabilityColor = '#f59e0b'; // Yellow/Orange
        }
        
        // Durability display
        const durabilityDisplay = tool.durability === Infinity 
            ? '∞' 
            : `${durabilityPercent}%`;
        
        toolElement.innerHTML = `
            <div class="tool-icon">${getToolIcon(tool.type)}</div>
            <div class="tool-info">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-stats">
                    <span class="tool-power" title="Mining Power">⛏️ ${tool.power}</span>
                    <span class="tool-speed" title="Mining Speed">⚡ ${tool.speed}</span>
                    <span class="tool-efficiency" title="Resource Efficiency">📊 ${Math.floor(tool.efficiency * 100)}%</span>
                </div>
                <div class="tool-durability" title="Durability">
                    <div class="durability-bar">
                        <div class="durability-fill" style="width: ${durabilityPercent}%; background-color: ${durabilityColor}"></div>
                    </div>
                    <span class="durability-text">${durabilityDisplay}</span>
                </div>
            </div>
        `;
        
        // Add click handler
        toolElement.addEventListener('click', () => {
            if (tool.durability > 0 || tool.durability === Infinity) {
                onSelectTool(tool.type);
                
                // Update active state
                document.querySelectorAll('.tool-item').forEach(el => {
                    el.classList.remove('active-tool');
                });
                toolElement.classList.add('active-tool');
            }
        });
        
        // Disable broken tools
        if (tool.durability <= 0 && tool.durability !== Infinity) {
            toolElement.classList.add('broken-tool');
            toolElement.title = 'This tool is broken and needs repair';
        }
        
        toolsContainer.appendChild(toolElement);
    });
}

// Get icon for tool type
function getToolIcon(toolType: MiningToolType): string {
    switch (toolType) {
        case MiningToolType.HAND:
            return '👋';
        case MiningToolType.PICK:
            return '⛏️';
        case MiningToolType.DRILL:
            return '🔌';
        case MiningToolType.LASER:
            return '🔆';
        default:
            return '🔧';
    }
}

// Add CSS styles for the mining tools UI
export function addMiningToolsStyles(): void {
    // Check if styles already exist
    if (document.getElementById('mining-tools-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'mining-tools-styles';
    styleElement.textContent = `
        .mining-tools-panel {
            background-color: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            padding: 10px;
            width: 100%;
        }
        
        .tools-header {
            border-bottom: 1px solid #444;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }
        
        .tools-header h3 {
            margin: 0;
            font-size: 16px;
        }
        
        .tools-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .tool-item {
            display: flex;
            align-items: center;
            padding: 8px;
            border-radius: 3px;
            background-color: rgba(50, 50, 50, 0.5);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .tool-item:hover {
            background-color: rgba(70, 70, 70, 0.7);
        }
        
        .active-tool {
            background-color: rgba(59, 130, 246, 0.3);
            border: 1px solid rgba(59, 130, 246, 0.5);
        }
        
        .broken-tool {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .tool-icon {
            font-size: 24px;
            margin-right: 12px;
            width: 30px;
            text-align: center;
        }
        
        .tool-info {
            flex: 1;
        }
        
        .tool-name {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        
        .tool-stats {
            display: flex;
            gap: 10px;
            margin-bottom: 6px;
            font-size: 12px;
            color: #ccc;
        }
        
        .tool-durability {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .durability-bar {
            flex: 1;
            height: 6px;
            background-color: rgba(100, 100, 100, 0.3);
            border-radius: 3px;
            overflow: hidden;
        }
        
        .durability-fill {
            height: 100%;
            border-radius: 3px;
        }
        
        .durability-text {
            font-size: 12px;
            color: #ccc;
            width: 30px;
            text-align: right;
        }
    `;
    
    document.head.appendChild(styleElement);
}
