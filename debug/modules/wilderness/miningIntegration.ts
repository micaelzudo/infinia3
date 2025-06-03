import * as THREE from 'three';
import { ToolBrushParams } from './wildernessIntegration';

/**
 * Mining Integration for the Wilderness Survival Game
 * Handles the mining tools and their interaction with the terrain
 */
export class MiningIntegration {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private currentTool: string = 'hand';
    private toolsContainer: HTMLElement | null = null;

    // Tool brush parameters
    private toolBrushParams: Record<string, ToolBrushParams> = {
        hand: {
            baseRadius: 2,
            radiusMultiplier: 1,
            strengthMultiplier: 0.5,
            verticalityMultiplier: 10,
            preferredShape: 'sphere'
        },
        pick: {
            baseRadius: 3,
            radiusMultiplier: 1.2,
            strengthMultiplier: 0.8,
            verticalityMultiplier: 15,
            preferredShape: 'sphere'
        },
        drill: {
            baseRadius: 4,
            radiusMultiplier: 1.5,
            strengthMultiplier: 1.2,
            verticalityMultiplier: 25,
            preferredShape: 'cylinder'
        },
        laser: {
            baseRadius: 5,
            radiusMultiplier: 1.8,
            strengthMultiplier: 2.0,
            verticalityMultiplier: 30,
            preferredShape: 'cube'
        }
    };

    /**
     * Constructor for the MiningIntegration class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, contentArea: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;

        // Create the mining tools UI
        this.createMiningToolsUI();

        console.log("Mining Integration initialized");
    }

    /**
     * Get the brush parameters for a specific tool type
     * @param toolType The tool type
     * @returns The brush parameters
     */
    public getToolBrushParams(toolType: string): ToolBrushParams {
        if (this.toolBrushParams[toolType]) {
            return this.toolBrushParams[toolType];
        } else {
            console.warn(`Unknown tool type: ${toolType}, using default parameters`);
            return this.toolBrushParams.hand;
        }
    }

    /**
     * Set the current tool
     * @param toolType The tool type
     */
    public setCurrentTool(toolType: string): void {
        if (this.toolBrushParams[toolType]) {
            this.currentTool = toolType;
            console.log(`Mining tool set to: ${toolType}`);

            // Update UI to reflect the current tool
            this.updateToolsUI();

            // Dispatch custom event for tool change
            const event = new CustomEvent('wilderness-tool-changed', {
                detail: { toolType }
            });
            document.dispatchEvent(event);
        } else {
            console.warn(`Cannot set unknown tool type: ${toolType}`);
        }
    }

    /**
     * Get the current tool
     * @returns The current tool type
     */
    public getCurrentTool(): string {
        return this.currentTool;
    }

    /**
     * Create the mining tools UI
     */
    private createMiningToolsUI(): void {
        // Create the mining tools section
        const toolsSection = document.createElement('div');
        toolsSection.className = 'wilderness-tools-section';
        toolsSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Mining Tools';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        toolsSection.appendChild(sectionTitle);

        // Create the tools container
        this.toolsContainer = document.createElement('div');
        this.toolsContainer.className = 'wilderness-tools-container';
        this.toolsContainer.style.display = 'flex';
        this.toolsContainer.style.flexWrap = 'wrap';
        this.toolsContainer.style.gap = '10px';
        toolsSection.appendChild(this.toolsContainer);

        // Define the tools
        const tools = [
            { id: 'hand', name: 'Hand', icon: '✋', color: '#f59e0b' },
            { id: 'pick', name: 'Pick', icon: '⛏️', color: '#3b82f6' },
            { id: 'drill', name: 'Drill', icon: '🔄', color: '#10b981' },
            { id: 'laser', name: 'Laser', icon: '⚡', color: '#ef4444' }
        ];

        // Create a button for each tool
        tools.forEach(tool => {
            const toolButton = document.createElement('button');
            toolButton.id = `wilderness-tool-${tool.id}`;
            toolButton.className = 'wilderness-tool-button';
            toolButton.dataset.toolType = tool.id;
            toolButton.innerHTML = `<span style="font-size: 20px; margin-right: 5px;">${tool.icon}</span> ${tool.name}`;

            // Style the button
            toolButton.style.display = 'flex';
            toolButton.style.alignItems = 'center';
            toolButton.style.justifyContent = 'center';
            toolButton.style.padding = '8px 12px';
            toolButton.style.backgroundColor = tool.color;
            toolButton.style.color = 'white';
            toolButton.style.border = 'none';
            toolButton.style.borderRadius = '4px';
            toolButton.style.cursor = 'pointer';
            toolButton.style.fontWeight = 'bold';
            toolButton.style.flex = '1';
            toolButton.style.minWidth = '80px';
            toolButton.style.transition = 'all 0.2s ease';
            toolButton.style.opacity = tool.id === this.currentTool ? '1' : '0.7';

            // Add hover effect
            toolButton.addEventListener('mouseover', () => {
                toolButton.style.transform = 'translateY(-2px)';
                toolButton.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            });

            toolButton.addEventListener('mouseout', () => {
                toolButton.style.transform = 'translateY(0)';
                toolButton.style.boxShadow = 'none';
            });

            // Add click handler
            toolButton.addEventListener('click', () => {
                this.setCurrentTool(tool.id);
            });

            this.toolsContainer?.appendChild(toolButton);
        });

        // Add the tools section to the content area
        this.contentArea.appendChild(toolsSection);

        // Set the initial tool
        this.setCurrentTool('hand');
    }

    /**
     * Update the tools UI to reflect the current tool
     */
    private updateToolsUI(): void {
        if (!this.toolsContainer) return;

        // Update all tool buttons
        const toolButtons = this.toolsContainer.querySelectorAll('.wilderness-tool-button');
        toolButtons.forEach(button => {
            const toolType = (button as HTMLElement).dataset.toolType;
            if (toolType === this.currentTool) {
                (button as HTMLElement).style.opacity = '1';
                (button as HTMLElement).style.boxShadow = `0 0 0 2px white, 0 0 0 4px ${this.getToolColor(toolType)}`;
            } else {
                (button as HTMLElement).style.opacity = '0.7';
                (button as HTMLElement).style.boxShadow = 'none';
            }
        });
    }

    /**
     * Get the color for a specific tool type
     * @param toolType The tool type
     * @returns The color
     */
    private getToolColor(toolType: string): string {
        const toolColors: Record<string, string> = {
            hand: '#f59e0b',
            pick: '#3b82f6',
            drill: '#10b981',
            laser: '#ef4444'
        };

        return toolColors[toolType] || '#4a5568';
    }

    /**
     * Dispose of the mining integration
     */
    public dispose(): void {
        console.log("Mining Integration disposed");
    }
}
