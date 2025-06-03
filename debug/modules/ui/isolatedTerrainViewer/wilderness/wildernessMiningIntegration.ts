import * as THREE from 'three';
import { WildernessInventory, WildernessItem } from './wildernessInventory';
import { WildernessResourceSystem } from './wildernessResourceSystem';
import { WildernessUpgradeSystem } from './wildernessUpgradeSystem';
import { ResourceInventory, addResource, getResourcesArray } from '../../../mining/resourceInventory';
import { MiningTool, MiningToolType, mineAtPoint, damageTool, MATERIAL_HARDNESS } from '../../../mining/miningSystem';
import { AreaMiningResult, mineAreaAtPoint } from '../../../mining/areaMiningSystem';
import { TopElementsData } from '../../../types/renderingTypes';

/**
 * Class for integrating the Wilderness resource system with the mining system
 */
export class WildernessMiningIntegration {
    // Game systems
    private wildernessInventory: WildernessInventory;
    private wildernessResourceSystem: WildernessResourceSystem;
    private wildernessUpgradeSystem: WildernessUpgradeSystem | null = null;

    // Mining system
    private miningInventory: ResourceInventory;
    private miningTools: { [key in MiningToolType]: MiningTool };
    private activeTool: MiningToolType = MiningToolType.HAND;

    // Tool-specific brush parameters
    private toolBrushParams: { [key in MiningToolType]: {
        baseRadius: number;
        radiusMultiplier: number;
        strengthMultiplier: number;
        verticalityMultiplier: number;
        preferredShape: 'sphere' | 'cube' | 'cylinder';
    }} = {
        [MiningToolType.HAND]: {
            baseRadius: 1.5,
            radiusMultiplier: 1.0,
            strengthMultiplier: 0.5,
            verticalityMultiplier: 1.0,
            preferredShape: 'sphere'
        },
        [MiningToolType.PICK]: {
            baseRadius: 2.5,
            radiusMultiplier: 1.2,
            strengthMultiplier: 0.8,
            verticalityMultiplier: 1.5,
            preferredShape: 'sphere'
        },
        [MiningToolType.DRILL]: {
            baseRadius: 3.5,
            radiusMultiplier: 1.5,
            strengthMultiplier: 1.2,
            verticalityMultiplier: 2.0,
            preferredShape: 'cylinder'
        },
        [MiningToolType.LASER]: {
            baseRadius: 4.5,
            radiusMultiplier: 2.0,
            strengthMultiplier: 1.5,
            verticalityMultiplier: 3.0,
            preferredShape: 'cube'
        }
    };

    // UI elements
    private toolSelectionContainer: HTMLElement | null = null;

    // Resource mapping
    private resourceMapping: { [miningSymbol: string]: string } = {
        'Fe': 'iron',
        'Cu': 'copper',
        'Au': 'gold',
        'Ag': 'silver',
        'C': 'carbon',
        'Si': 'silicon',
        'O': 'oxygen',
        'H': 'hydrogen',
        'N': 'nitrogen',
        'S': 'sulfur',
        'Al': 'aluminum',
        'Ti': 'titanium',
        'Zn': 'zinc',
        'Ni': 'nickel',
        'Co': 'cobalt',
        'Mn': 'manganese',
        'Cr': 'chromium',
        'V': 'vanadium',
        'W': 'tungsten',
        'Pt': 'platinum',
        'Pd': 'palladium',
        'Rh': 'rhodium',
        'Ir': 'iridium',
        'Os': 'osmium',
        'Ru': 'ruthenium',
        'U': 'uranium',
        'Pu': 'plutonium',
        'Th': 'thorium',
        'Xe': 'xenon',
        'Rn': 'radon',
        'Hg': 'mercury',
        'Na': 'sodium',
        'Mg': 'magnesium',
        'P': 'phosphorus',
        'Cl': 'chlorine',
        'K': 'potassium',
        'Ca': 'calcium'
    };

    // Basic resources mapping (for auto-conversion)
    private basicResourceMapping: { [miningSymbol: string]: string } = {
        'C': 'stick',
        'O': 'log',
        'Si': 'rock',
        'Fe': 'iron'
    };

    /**
     * Create a new WildernessMiningIntegration
     * @param wildernessInventory The wilderness inventory
     * @param wildernessResourceSystem The wilderness resource system
     * @param miningInventory The mining inventory
     * @param miningTools The mining tools
     */
    constructor(
        wildernessInventory: WildernessInventory,
        wildernessResourceSystem: WildernessResourceSystem,
        miningInventory: ResourceInventory,
        miningTools: { [key in MiningToolType]: MiningTool }
    ) {
        this.wildernessInventory = wildernessInventory;
        this.wildernessResourceSystem = wildernessResourceSystem;
        this.miningInventory = miningInventory;
        this.miningTools = miningTools;

        console.log("WildernessMiningIntegration: Created new integration instance");
    }

    /**
     * Set the upgrade system
     * @param upgradeSystem The upgrade system
     */
    public setUpgradeSystem(upgradeSystem: WildernessUpgradeSystem): void {
        this.wildernessUpgradeSystem = upgradeSystem;
    }

    /**
     * Set the active mining tool
     * @param toolType The tool type to set as active
     */
    public setActiveTool(toolType: MiningToolType): void {
        this.activeTool = toolType;
    }

    /**
     * Set the active mining tool and notify the isolatedTerrainViewer
     * @param toolType The tool type to set as active
     * @param notifyIsolatedViewer Whether to notify the isolatedTerrainViewer of the change
     */
    public setActiveToolAndNotify(toolType: MiningToolType, notifyIsolatedViewer: boolean = true): void {
        this.activeTool = toolType;

        // Dispatch a custom event that isolatedTerrainViewer can listen for
        if (notifyIsolatedViewer) {
            const event = new CustomEvent('wilderness-tool-changed', {
                detail: { toolType }
            });
            document.dispatchEvent(event);
            console.log(`WildernessMiningIntegration: Dispatched tool change event for ${toolType}`);
        }
    }

    /**
     * Get the active mining tool
     * @returns The active mining tool
     */
    public getActiveTool(): MiningTool {
        return this.miningTools[this.activeTool];
    }

    /**
     * Get the active mining tool type
     * @returns The active mining tool type
     */
    public getActiveMiningTool(): MiningToolType {
        return this.activeTool;
    }

    /**
     * Get the brush parameters for a specific tool type
     * @param toolType The tool type to get parameters for
     * @returns The brush parameters for the specified tool
     */
    public getToolBrushParams(toolType: MiningToolType): {
        baseRadius: number;
        radiusMultiplier: number;
        strengthMultiplier: number;
        verticalityMultiplier: number;
        preferredShape: 'sphere' | 'cube' | 'cylinder';
    } {
        return this.toolBrushParams[toolType];
    }

    /**
     * Mine at a specific point and transfer resources to the wilderness inventory
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @returns The mining result
     */
    public mineAtPoint(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3
    ): boolean {
        // Use the mining system to mine at the point
        const miningResult = mineAtPoint(
            point,
            topElements,
            noiseScale,
            planetOffset,
            this.miningTools[this.activeTool],
            this.miningInventory
        );

        if (miningResult.success) {
            // Apply damage to the tool
            const toolBroken = damageTool(this.miningTools[this.activeTool], miningResult.toolDamage);

            // If tool broke, switch to hand
            if (toolBroken) {
                this.activeTool = MiningToolType.HAND;
                console.log(`WildernessMiningIntegration: Tool broke, switched to ${this.activeTool}`);
            }

            // Transfer the mined resource to the wilderness inventory
            this.transferResourceToWildernessInventory(
                miningResult.materialSymbol,
                miningResult.materialName,
                miningResult.amount
            );

            return true;
        }

        return false;
    }

    /**
     * Mine an area at a specific point and transfer resources to the wilderness inventory
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @param brushRadius The base brush radius
     * @param brushShape The brush shape
     * @param brushVerticality The base brush verticality
     * @returns The area mining result with adjusted brush parameters
     */
    public mineAreaAtPoint(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3,
        brushRadius: number,
        brushShape: 'sphere' | 'cube' | 'cylinder',
        brushVerticality: number
    ): AreaMiningResult & {
        adjustedBrushParams: {
            radius: number;
            shape: 'sphere' | 'cube' | 'cylinder';
            verticality: number;
            strengthMultiplier: number;
        }
    } {
        // Apply tool-specific modifiers to brush parameters
        const toolParams = this.toolBrushParams[this.activeTool];
        const activeTool = this.miningTools[this.activeTool];

        // Calculate adjusted brush parameters based on the active tool
        const adjustedRadius = Math.max(toolParams.baseRadius, brushRadius * toolParams.radiusMultiplier);
        const adjustedVerticality = brushVerticality * toolParams.verticalityMultiplier;
        const strengthMultiplier = toolParams.strengthMultiplier || 1.0;

        // Use the tool's preferred shape instead of the provided shape
        // This allows different tools to have different brush shapes (e.g., drill = cylinder, pick = sphere)
        const toolShape = toolParams.preferredShape || brushShape;

        console.log(`WildernessMiningIntegration: Mining with ${activeTool.name}, adjusted radius: ${adjustedRadius.toFixed(1)}, shape: ${toolShape}, verticality: ${adjustedVerticality.toFixed(1)}, strength multiplier: ${strengthMultiplier.toFixed(1)}`);

        // Use the mining system to mine the area with adjusted parameters
        const areaMiningResult = mineAreaAtPoint(
            point,
            topElements,
            noiseScale,
            planetOffset,
            activeTool,
            this.miningInventory,
            adjustedRadius,
            toolShape, // Use the tool-specific shape
            adjustedVerticality
        );

        if (areaMiningResult.success) {
            // Apply damage to the tool
            const toolBroken = damageTool(this.miningTools[this.activeTool], areaMiningResult.toolDamage);

            // If tool broke, switch to hand
            if (toolBroken) {
                this.activeTool = MiningToolType.HAND;
                console.log(`WildernessMiningIntegration: Tool broke, switched to ${this.activeTool}`);
            }

            // Transfer each mined resource to the wilderness inventory
            areaMiningResult.resources.forEach(resource => {
                this.transferResourceToWildernessInventory(
                    resource.materialSymbol,
                    resource.materialName,
                    resource.amount
                );
            });
        }

        // Return the mining result with the adjusted brush parameters
        return {
            ...areaMiningResult,
            adjustedBrushParams: {
                radius: adjustedRadius,
                shape: toolShape,
                verticality: adjustedVerticality,
                strengthMultiplier: strengthMultiplier
            }
        };
    }

    /**
     * Transfer a resource from the mining inventory to the wilderness inventory
     * @param materialSymbol The material symbol
     * @param materialName The material name
     * @param amount The amount to transfer
     */
    private transferResourceToWildernessInventory(
        materialSymbol: string,
        materialName: string,
        amount: number
    ): void {
        // Apply resource bonus from upgrades
        let resourceBonus = 0;
        if (this.wildernessUpgradeSystem) {
            resourceBonus = this.wildernessUpgradeSystem.getResourceBonus();
        }

        // Calculate total amount with bonus
        const totalAmount = amount + resourceBonus;

        // Map the mining resource to a wilderness resource
        let wildernessResourceType: string;

        // Check if it's a basic resource that should be auto-converted
        if (this.basicResourceMapping[materialSymbol]) {
            wildernessResourceType = this.basicResourceMapping[materialSymbol];
        } else {
            // Use the resource mapping or create a new resource type
            wildernessResourceType = this.resourceMapping[materialSymbol] || materialSymbol.toLowerCase();
        }

        // Add to wilderness inventory
        this.wildernessInventory.addItem(wildernessResourceType, totalAmount);

        console.log(`WildernessMiningIntegration: Transferred ${totalAmount} ${materialName} (${materialSymbol}) to wilderness inventory as ${wildernessResourceType}`);
    }

    /**
     * Sync the mining inventory with the wilderness inventory
     * This transfers all resources from the mining inventory to the wilderness inventory
     */
    public syncInventories(): void {
        // Get all resources from the mining inventory
        const resources = getResourcesArray(this.miningInventory);

        // Transfer each resource to the wilderness inventory
        resources.forEach(resource => {
            this.transferResourceToWildernessInventory(
                resource.symbol,
                resource.name,
                resource.amount
            );
        });

        console.log("WildernessMiningIntegration: Synced mining inventory with wilderness inventory");
    }

    /**
     * Create a tool selection UI
     * @param container The container element to add the UI to
     */
    public createToolSelectionUI(container: HTMLElement): void {
        if (!container) return;

        // Create tool selection container
        const toolSelectionContainer = document.createElement('div');
        toolSelectionContainer.className = 'wilderness-tool-selection';
        toolSelectionContainer.style.marginBottom = '20px';
        toolSelectionContainer.style.padding = '15px';
        toolSelectionContainer.style.backgroundColor = 'rgba(26, 32, 44, 0.4)';
        toolSelectionContainer.style.borderRadius = '8px';
        toolSelectionContainer.style.border = '1px solid rgba(74, 85, 104, 0.3)';

        // Create header
        const header = document.createElement('h3');
        header.textContent = 'Mining Tools';
        header.style.margin = '0 0 10px 0';
        header.style.fontSize = '16px';
        header.style.fontWeight = 'bold';
        header.style.color = '#e2e8f0';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';

        // Add icon to header
        header.innerHTML = '⛏️ Mining Tools';

        toolSelectionContainer.appendChild(header);

        // Create tool buttons container
        const toolButtonsContainer = document.createElement('div');
        toolButtonsContainer.style.display = 'flex';
        toolButtonsContainer.style.flexWrap = 'wrap';
        toolButtonsContainer.style.gap = '8px';
        toolButtonsContainer.style.marginTop = '10px';

        // Create a button for each tool
        Object.values(this.miningTools).forEach(tool => {
            const toolButton = document.createElement('button');
            toolButton.className = 'wilderness-tool-button';
            toolButton.dataset.tool = tool.type;
            toolButton.style.flex = '1';
            toolButton.style.minWidth = '80px';
            toolButton.style.padding = '8px 12px';
            toolButton.style.backgroundColor = tool.type === this.activeTool ? 'rgba(66, 153, 225, 0.6)' : 'rgba(45, 55, 72, 0.6)';
            toolButton.style.color = '#e2e8f0';
            toolButton.style.border = '1px solid rgba(74, 85, 104, 0.5)';
            toolButton.style.borderRadius = '6px';
            toolButton.style.cursor = 'pointer';
            toolButton.style.fontSize = '14px';
            toolButton.style.fontWeight = 'bold';
            toolButton.style.transition = 'all 0.2s ease';
            toolButton.style.display = 'flex';
            toolButton.style.flexDirection = 'column';
            toolButton.style.alignItems = 'center';
            toolButton.style.justifyContent = 'center';
            toolButton.style.gap = '5px';

            // Add tool icon
            const toolIcon = document.createElement('span');
            toolIcon.style.fontSize = '18px';

            // Set icon based on tool type
            switch (tool.type) {
                case MiningToolType.HAND:
                    toolIcon.textContent = '👋';
                    break;
                case MiningToolType.PICK:
                    toolIcon.textContent = '⛏️';
                    break;
                case MiningToolType.DRILL:
                    toolIcon.textContent = '🔄';
                    break;
                case MiningToolType.LASER:
                    toolIcon.textContent = '🔆';
                    break;
            }

            // Add tool name
            const toolName = document.createElement('span');
            toolName.textContent = tool.name;

            // Add tool stats
            const toolStats = document.createElement('div');
            toolStats.style.fontSize = '11px';
            toolStats.style.color = '#a0aec0';
            toolStats.style.marginTop = '4px';

            // Show power and efficiency
            toolStats.textContent = `Power: ${tool.power} | Eff: ${(tool.efficiency * 100).toFixed(0)}%`;

            // Add durability bar if not infinite
            if (tool.durability !== Infinity) {
                const durabilityBar = document.createElement('div');
                durabilityBar.style.width = '100%';
                durabilityBar.style.height = '4px';
                durabilityBar.style.backgroundColor = 'rgba(26, 32, 44, 0.5)';
                durabilityBar.style.borderRadius = '2px';
                durabilityBar.style.marginTop = '5px';
                durabilityBar.style.overflow = 'hidden';

                const durabilityFill = document.createElement('div');
                durabilityFill.style.width = `${(tool.durability / tool.maxDurability) * 100}%`;
                durabilityFill.style.height = '100%';
                durabilityFill.style.backgroundColor = tool.durability > tool.maxDurability * 0.3 ? '#48bb78' : '#ed8936';
                durabilityFill.style.transition = 'width 0.3s ease';

                durabilityBar.appendChild(durabilityFill);
                toolStats.appendChild(durabilityBar);
            } else {
                // Show infinite durability
                const infiniteText = document.createElement('div');
                infiniteText.textContent = 'Durability: ∞';
                infiniteText.style.fontSize = '10px';
                infiniteText.style.marginTop = '4px';
                toolStats.appendChild(infiniteText);
            }

            // Add click handler
            toolButton.onclick = () => {
                this.setActiveToolAndNotify(tool.type);
                this.updateToolSelectionUI();
            };

            // Add elements to button
            toolButton.appendChild(toolIcon);
            toolButton.appendChild(toolName);
            toolButton.appendChild(toolStats);

            // Add button to container
            toolButtonsContainer.appendChild(toolButton);
        });

        // Add tool buttons to container
        toolSelectionContainer.appendChild(toolButtonsContainer);

        // Add tool info section
        const toolInfoSection = document.createElement('div');
        toolInfoSection.className = 'wilderness-tool-info';
        toolInfoSection.style.marginTop = '15px';
        toolInfoSection.style.padding = '10px';
        toolInfoSection.style.backgroundColor = 'rgba(26, 32, 44, 0.3)';
        toolInfoSection.style.borderRadius = '6px';
        toolInfoSection.style.fontSize = '12px';
        toolInfoSection.style.color = '#a0aec0';

        // Get active tool
        const activeTool = this.miningTools[this.activeTool];
        const toolParams = this.toolBrushParams[this.activeTool];

        // Set tool info content
        toolInfoSection.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold; color: #e2e8f0;">Active Tool: ${activeTool.name}</div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Power:</span>
                <span>${activeTool.power}/10</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Efficiency:</span>
                <span>${(activeTool.efficiency * 100).toFixed(0)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Mining Radius:</span>
                <span>${toolParams.baseRadius.toFixed(1)} (×${toolParams.radiusMultiplier.toFixed(1)})</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Strength:</span>
                <span>×${toolParams.strengthMultiplier.toFixed(1)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Verticality:</span>
                <span>×${toolParams.verticalityMultiplier.toFixed(1)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Brush Shape:</span>
                <span>${toolParams.preferredShape.charAt(0).toUpperCase() + toolParams.preferredShape.slice(1)}</span>
            </div>
            <div style="margin-top: 8px; font-style: italic; text-align: center;">
                Better tools mine larger areas and harder materials
            </div>
        `;

        // Add tool info to container
        toolSelectionContainer.appendChild(toolInfoSection);

        // Add to container
        container.appendChild(toolSelectionContainer);

        // Store reference to container
        this.toolSelectionContainer = toolSelectionContainer;
    }

    /**
     * Update the tool selection UI to reflect the current active tool
     */
    public updateToolSelectionUI(): void {
        if (!this.toolSelectionContainer) return;

        // Update tool buttons
        const toolButtons = this.toolSelectionContainer.querySelectorAll('.wilderness-tool-button');
        toolButtons.forEach(button => {
            const toolType = (button as HTMLElement).dataset.tool as MiningToolType;
            button.style.backgroundColor = toolType === this.activeTool ? 'rgba(66, 153, 225, 0.6)' : 'rgba(45, 55, 72, 0.6)';
        });

        // Update tool info section
        const toolInfoSection = this.toolSelectionContainer.querySelector('.wilderness-tool-info');
        if (toolInfoSection) {
            const activeTool = this.miningTools[this.activeTool];
            const toolParams = this.toolBrushParams[this.activeTool];

            // Update tool info content
            toolInfoSection.innerHTML = `
                <div style="margin-bottom: 8px; font-weight: bold; color: #e2e8f0;">Active Tool: ${activeTool.name}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Power:</span>
                    <span>${activeTool.power}/10</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Efficiency:</span>
                    <span>${(activeTool.efficiency * 100).toFixed(0)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Mining Radius:</span>
                    <span>${toolParams.baseRadius.toFixed(1)} (×${toolParams.radiusMultiplier.toFixed(1)})</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Strength:</span>
                    <span>×${toolParams.strengthMultiplier.toFixed(1)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Verticality:</span>
                    <span>×${toolParams.verticalityMultiplier.toFixed(1)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Brush Shape:</span>
                    <span>${toolParams.preferredShape.charAt(0).toUpperCase() + toolParams.preferredShape.slice(1)}</span>
                </div>
                <div style="margin-top: 8px; font-style: italic; text-align: center;">
                    Better tools mine larger areas and harder materials
                </div>
            `;
        }
    }
}
