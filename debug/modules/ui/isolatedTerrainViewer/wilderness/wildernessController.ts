import * as THREE from 'three';
import { WildernessInventory } from './wildernessInventory';
import { WildernessCraftingSystem } from './wildernessCraftingSystem';
import { WildernessBuildingSystem } from './wildernessBuildingSystem';
import { WildernessUpgradeSystem } from './wildernessUpgradeSystem';
import { WildernessResourceSystem } from './wildernessResourceSystem';
import { WildernessMiningIntegration } from './wildernessMiningIntegration';
import { ResourceInventory, createInventory } from '../../../mining/resourceInventory';
import { MiningToolType, createDefaultTools } from '../../../mining/miningSystem';

/**
 * Main controller for the Wilderness Survival game systems
 * Manages the integration between inventory, crafting, and building systems
 */
export class WildernessController {
    // Core systems
    private inventory: WildernessInventory;
    private craftingSystem: WildernessCraftingSystem | null = null;
    private buildingSystem: WildernessBuildingSystem | null = null;
    private upgradeSystem: WildernessUpgradeSystem | null = null;
    private resourceSystem: WildernessResourceSystem | null = null;
    private miningIntegration: WildernessMiningIntegration | null = null;

    // Mining system components
    private miningInventory: ResourceInventory;
    private miningTools: ReturnType<typeof createDefaultTools>;
    private activeMiningTool: MiningToolType = MiningToolType.HAND;

    // Three.js references
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    // UI elements
    private uiContainer: HTMLElement | null = null;
    private inventoryContainer: HTMLElement | null = null;
    private craftingContainer: HTMLElement | null = null;
    private buildingContainer: HTMLElement | null = null;
    private upgradeContainer: HTMLElement | null = null;
    private miningToolsContainer: HTMLElement | null = null;
    private interactionPrompt: HTMLElement | null = null;

    // State
    private initialized: boolean = false;
    private raycaster: THREE.Raycaster;

    /**
     * Create a new WildernessController
     * @param scene The Three.js scene
     * @param camera The Three.js camera
     */
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
        this.scene = scene;
        this.camera = camera;
        this.inventory = new WildernessInventory();
        this.raycaster = new THREE.Raycaster();

        // Initialize mining components
        this.miningInventory = createInventory(100);
        this.miningTools = createDefaultTools();

        console.log("WildernessController: Created new controller instance");
    }

    /**
     * Initialize the Wilderness Survival game systems
     * @param container The HTML element to contain the UI
     */
    public init(container: HTMLElement): void {
        if (this.initialized) {
            console.warn("WildernessController: Already initialized");
            return;
        }

        this.uiContainer = container;

        // Create UI structure
        this.createUIStructure();

        // Initialize inventory
        if (this.inventoryContainer) {
            this.inventory.initUI(this.inventoryContainer);

            // Add some starter items
            this.inventory.addItem('log', 10);
            this.inventory.addItem('rock', 10);
            this.inventory.addItem('stick', 5);
        }

        // Initialize building system
        this.buildingSystem = new WildernessBuildingSystem(this.scene, this.camera, this.inventory);

        // Set UI container for building system
        if (this.buildingContainer) {
            this.buildingSystem.setUIContainer(this.buildingContainer);
        }

        // Initialize crafting system (depends on building system)
        this.craftingSystem = new WildernessCraftingSystem(
            this.scene,
            this.camera,
            this.inventory,
            this.buildingSystem
        );

        // Initialize upgrade system
        this.upgradeSystem = new WildernessUpgradeSystem(this.inventory);

        // Initialize resource system
        this.resourceSystem = new WildernessResourceSystem(this.scene, this.camera, this.inventory);

        // Initialize mining integration
        if (this.resourceSystem) {
            this.miningIntegration = new WildernessMiningIntegration(
                this.inventory,
                this.resourceSystem,
                this.miningInventory,
                this.miningTools
            );
        }

        // Connect systems
        if (this.resourceSystem && this.upgradeSystem) {
            this.resourceSystem.setUpgradeSystem(this.upgradeSystem);
        }

        if (this.miningIntegration && this.upgradeSystem) {
            this.miningIntegration.setUpgradeSystem(this.upgradeSystem);
        }

        if (this.resourceSystem && this.interactionPrompt) {
            this.resourceSystem.setInteractionPrompt(this.interactionPrompt);
        }

        // Generate resource nodes
        if (this.resourceSystem) {
            this.resourceSystem.generateResourceNodes(15, 50);
        }

        // Initialize UI for crafting, building, and upgrades
        if (this.craftingContainer && this.craftingSystem) {
            this.craftingSystem.initUI(this.craftingContainer);
        }

        if (this.upgradeContainer && this.upgradeSystem) {
            this.upgradeSystem.initUI(this.upgradeContainer);
        }

        // Initialize mining tools UI
        if (this.miningToolsContainer && this.miningIntegration) {
            this.miningIntegration.createToolSelectionUI(this.miningToolsContainer);
        }

        // Set up input handlers
        this.setupInputHandlers();

        this.initialized = true;
        console.log("WildernessController: Initialized successfully");
    }

    /**
     * Create the UI structure for the Wilderness Survival game
     */
    private createUIStructure(): void {
        if (!this.uiContainer) return;

        // Clear the container
        this.uiContainer.innerHTML = '';

        // Create inventory container
        this.inventoryContainer = document.createElement('div');
        this.inventoryContainer.className = 'wilderness-inventory-container';
        this.inventoryContainer.style.marginBottom = '20px';
        this.uiContainer.appendChild(this.inventoryContainer);

        // Create crafting container
        this.craftingContainer = document.createElement('div');
        this.craftingContainer.className = 'wilderness-crafting-container';
        this.craftingContainer.style.marginBottom = '20px';
        this.uiContainer.appendChild(this.craftingContainer);

        // Create building container
        this.buildingContainer = document.createElement('div');
        this.buildingContainer.className = 'wilderness-building-container';
        this.buildingContainer.style.marginBottom = '20px';
        this.uiContainer.appendChild(this.buildingContainer);

        // Create upgrade container
        this.upgradeContainer = document.createElement('div');
        this.upgradeContainer.className = 'wilderness-upgrade-container';
        this.upgradeContainer.style.marginBottom = '20px';
        this.uiContainer.appendChild(this.upgradeContainer);

        // Create mining tools container
        this.miningToolsContainer = document.createElement('div');
        this.miningToolsContainer.className = 'wilderness-mining-tools-container';
        this.miningToolsContainer.style.marginBottom = '20px';
        this.uiContainer.appendChild(this.miningToolsContainer);

        // Create interaction prompt
        this.interactionPrompt = document.createElement('div');
        this.interactionPrompt.id = 'interaction-prompt';
        this.interactionPrompt.style.padding = '10px';
        this.interactionPrompt.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.interactionPrompt.style.color = 'white';
        this.interactionPrompt.style.borderRadius = '4px';
        this.interactionPrompt.style.marginTop = '20px';
        this.interactionPrompt.style.display = 'none';
        this.uiContainer.appendChild(this.interactionPrompt);
    }

    /**
     * Set up input handlers for keyboard and mouse
     */
    private setupInputHandlers(): void {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /**
     * Handle keyboard input
     * @param event The keyboard event
     */
    private handleKeyDown(event: KeyboardEvent): void {
        // Only process if initialized
        if (!this.initialized) return;

        const key = event.key.toLowerCase();

        // Resource collection
        if (key === 'e' && this.resourceSystem &&
            !(this.craftingSystem?.isCrafting) &&
            !(this.buildingSystem?.isBuilding)) {
            console.log("WildernessController: Attempting to collect resources");
            this.resourceSystem.collectResources();
        }

        // Crafting system controls
        if (this.craftingSystem) {
            if (key === 'c') {
                console.log("WildernessController: Toggle crafting menu");
                this.craftingSystem.toggleMenu();
            }

            if (this.craftingSystem.isCrafting) {
                if (key === 'e') {
                    console.log("WildernessController: Place crafted item");
                    this.craftingSystem.place();
                }
                if (key === 'escape') {
                    console.log("WildernessController: Cancel crafting");
                    this.craftingSystem.cancelPlacement();
                }
            }
        }

        // Building system controls
        if (this.buildingSystem) {
            if (key === 'b') {
                console.log("WildernessController: Toggle building menu");
                if (this.buildingSystem.isBuildingMenuOpen()) {
                    this.buildingSystem.hideBuildingMenu();
                } else {
                    this.buildingSystem.showBuildingMenu();
                }
            }

            if (this.buildingSystem.isBuilding) {
                if (key === 'e') {
                    console.log("WildernessController: Build structure");
                    this.buildingSystem.build();
                }
                if (key === 'escape') {
                    console.log("WildernessController: Cancel building");
                    this.buildingSystem.cancelBuilding();
                }
                if (key === 'r' && this.buildingSystem.buildingType === 'wall') {
                    console.log("WildernessController: Rotate wall");
                    this.buildingSystem.rotateWall();
                }
            }
        }
    }

    /**
     * Update method to be called in the animation loop
     */
    public update(): void {
        if (!this.initialized) return;

        // Update crafting system blueprint position
        if (this.craftingSystem && this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            this.craftingSystem.updateBlueprintPosition(this.raycaster);
        }

        // Update building system blueprint position
        if (this.buildingSystem && this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            this.buildingSystem.updateBlueprintPosition(this.raycaster);
        }

        // Update resource system
        if (this.resourceSystem) {
            this.resourceSystem.update();
        }
    }

    /**
     * Handle mining at a specific point
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @returns True if mining was successful, false otherwise
     */
    public handleMining(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3
    ): boolean {
        if (!this.initialized || !this.miningIntegration) return false;

        return this.miningIntegration.mineAtPoint(
            point,
            topElements,
            noiseScale,
            planetOffset
        );
    }

    /**
     * Handle area mining at a specific point
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @param brushRadius The brush radius
     * @param brushShape The brush shape
     * @param brushVerticality The brush verticality
     * @returns Object containing success status and adjusted brush parameters
     */
    public handleAreaMining(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3,
        brushRadius: number,
        brushShape: 'sphere' | 'cube' | 'cylinder',
        brushVerticality: number
    ): {
        success: boolean,
        adjustedBrushParams: {
            radius: number;
            shape: 'sphere' | 'cube' | 'cylinder';
            verticality: number;
            strengthMultiplier: number;
        }
    } {
        if (!this.initialized || !this.miningIntegration) {
            return {
                success: false,
                adjustedBrushParams: {
                    radius: brushRadius,
                    shape: brushShape,
                    verticality: brushVerticality,
                    strengthMultiplier: 1.0
                }
            };
        }

        // Use the mining integration to mine the area with the active tool
        const result = this.miningIntegration.mineAreaAtPoint(
            point,
            topElements,
            noiseScale,
            planetOffset,
            brushRadius,
            brushShape,
            brushVerticality
        );

        // If mining was successful, update the tool selection UI to reflect any changes
        // (e.g., tool durability or switching to hand if a tool broke)
        if (result.success && this.miningIntegration) {
            this.miningIntegration.updateToolSelectionUI();
        }

        return {
            success: result.success,
            adjustedBrushParams: result.adjustedBrushParams
        };
    }

    /**
     * Set the active mining tool
     * @param toolType The tool type to set as active
     */
    public setActiveMiningTool(toolType: MiningToolType): void {
        if (!this.initialized || !this.miningIntegration) return;

        this.activeMiningTool = toolType;
        this.miningIntegration.setActiveToolAndNotify(toolType, false); // Don't notify when called from isolatedTerrainViewer

        // Update the UI to reflect the new active tool
        this.miningIntegration.updateToolSelectionUI();

        console.log(`WildernessController: Active mining tool set to ${toolType}`);
    }

    /**
     * Get the active mining tool
     * @returns The active mining tool
     */
    public getActiveMiningTool(): MiningToolType {
        return this.activeMiningTool;
    }

    /**
     * Clean up resources when the controller is no longer needed
     */
    public dispose(): void {
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));

        // Dispose crafting system
        if (this.craftingSystem) {
            this.craftingSystem.dispose();
            this.craftingSystem = null;
        }

        // Dispose building system
        if (this.buildingSystem) {
            this.buildingSystem.dispose();
            this.buildingSystem = null;
        }

        // Dispose resource system
        if (this.resourceSystem) {
            this.resourceSystem.dispose();
            this.resourceSystem = null;
        }

        // Dispose mining integration
        this.miningIntegration = null;

        // Dispose upgrade system
        this.upgradeSystem = null;

        // Clear UI
        if (this.uiContainer) {
            this.uiContainer.innerHTML = '';
        }

        this.initialized = false;
        console.log("WildernessController: Disposed");
    }
}
