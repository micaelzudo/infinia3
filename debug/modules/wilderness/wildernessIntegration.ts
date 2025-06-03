import * as THREE from 'three';
import { MiningIntegration } from './miningIntegration';
import { InventorySystem } from './inventorySystem';
import { CraftingSystem } from './craftingSystem';
import { DayNightSystem } from './dayNightSystem';
import { BuildingSystem } from './buildingSystem';
import { GrassSystem } from './grassSystem';
import { HungerThirstSystem } from './hungerThirstSystem';

/**
 * Interface for the wilderness integration
 */
export interface WildernessIntegration {
    miningIntegration: MiningIntegration;
    inventorySystem: InventorySystem;
    craftingSystem: CraftingSystem;
    dayNightSystem: DayNightSystem;
    buildingSystem: BuildingSystem;
    grassSystem: GrassSystem;
    hungerThirstSystem: HungerThirstSystem;
    dispose: () => void;
}

/**
 * Interface for tool brush parameters
 */
export interface ToolBrushParams {
    baseRadius: number;
    radiusMultiplier: number;
    strengthMultiplier: number;
    verticalityMultiplier: number;
    preferredShape: 'sphere' | 'cube' | 'cylinder';
}

/**
 * Initialize the wilderness integration
 * @param scene The THREE.js scene
 * @param camera The THREE.js camera
 * @param contentArea The HTML element to append UI elements to
 * @returns The wilderness integration object
 */
export function initWildernessIntegration(
    scene: THREE.Scene,
    camera: THREE.Camera,
    contentArea: HTMLElement
): WildernessIntegration {
    console.log("Initializing wilderness integration...");

    // Create the wilderness systems container
    const systemsContainer = createWildernessSystemsContainer(contentArea);

    // Initialize the mining integration
    const miningIntegration = new MiningIntegration(scene, camera, systemsContainer);

    // Initialize the inventory system
    const inventorySystem = new InventorySystem(scene, camera, systemsContainer);

    // Initialize the crafting system
    const craftingSystem = new CraftingSystem(scene, camera, systemsContainer, inventorySystem);

    // Initialize the day/night system
    const dayNightSystem = new DayNightSystem(scene, camera, systemsContainer);

    // Initialize the building system
    const buildingSystem = new BuildingSystem(scene, camera, systemsContainer, inventorySystem);

    // Initialize the grass system
    const grassSystem = new GrassSystem(scene, camera, systemsContainer, inventorySystem);

    // Initialize the hunger/thirst system
    const hungerThirstSystem = new HungerThirstSystem(scene, camera, systemsContainer);

    // Set up tool change handler
    const handleToolChange = (event: CustomEvent) => {
        const toolType = event.detail.toolType;
        console.log(`Wilderness Integration: Tool changed to ${toolType}`);

        // Get the brush parameters for the selected tool
        const brushParams = miningIntegration.getToolBrushParams(toolType);

        // Dispatch an event with the brush parameters
        const brushEvent = new CustomEvent('wilderness-brush-params-changed', {
            detail: { brushParams }
        });
        document.dispatchEvent(brushEvent);

        console.log(`Wilderness Integration: Dispatched brush parameters event with:`, brushParams);
    };

    // Add event listener for tool changes
    document.addEventListener('wilderness-tool-changed', handleToolChange as EventListener);

    // Trigger initial tool change event to set up brush parameters
    const initialToolType = miningIntegration.getCurrentTool();
    console.log(`Wilderness Integration: Triggering initial tool change event for ${initialToolType}`);
    const initialEvent = new CustomEvent('wilderness-tool-changed', {
        detail: { toolType: initialToolType }
    });
    document.dispatchEvent(initialEvent);

    // Set up keyboard event handlers for hunger/thirst system
    const handleKeyDown = (event: KeyboardEvent) => {
        // Skip if we're in an input field
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Handle key presses
        switch (event.key.toLowerCase()) {
            case 'f':
                // Eat food
                if (inventorySystem.hasItem('food', 1)) {
                    inventorySystem.removeItem('food', 1);
                    hungerThirstSystem.eat(25);
                    console.log("Ate food: +25 hunger");
                } else {
                    console.log("Cannot eat: No food in inventory");
                }
                break;
            case 'g':
                // Drink water
                if (inventorySystem.hasItem('water', 1)) {
                    inventorySystem.removeItem('water', 1);
                    hungerThirstSystem.drink(30);
                    console.log("Drank water: +30 thirst");
                } else {
                    console.log("Cannot drink: No water in inventory");
                }
                break;
        }
    };

    // Add event listener for key presses
    document.addEventListener('keydown', handleKeyDown);

    // Set up update function for building and grass systems
    const updateWildernessSystems = () => {
        if (buildingSystem) {
            buildingSystem.update();
        }
        if (grassSystem) {
            grassSystem.update();
        }
    };

    // Add event listener for animation frame updates
    let animationFrameId: number;
    const animate = () => {
        updateWildernessSystems();
        animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);

    // Create the wilderness integration object
    const integration: WildernessIntegration = {
        miningIntegration,
        inventorySystem,
        craftingSystem,
        dayNightSystem,
        buildingSystem,
        grassSystem,
        hungerThirstSystem,
        dispose: () => {
            console.log("Disposing wilderness integration...");

            // Cancel animation frame
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }

            // Remove event listeners
            document.removeEventListener('wilderness-tool-changed', handleToolChange as EventListener);
            document.removeEventListener('keydown', handleKeyDown);

            // Dispose of all systems
            miningIntegration.dispose();
            inventorySystem.dispose();
            craftingSystem.dispose();
            dayNightSystem.dispose();
            buildingSystem.dispose();
            grassSystem.dispose();
            hungerThirstSystem.dispose();

            // Clear the systems container
            if (systemsContainer.parentElement) {
                systemsContainer.innerHTML = '';
            }

            console.log("Wilderness integration disposed successfully");
        }
    };

    return integration;
}

/**
 * Create the wilderness systems container
 * @param contentArea The HTML element to append the container to
 * @returns The systems container element
 */
function createWildernessSystemsContainer(contentArea: HTMLElement): HTMLElement {
    // Create the systems container
    const systemsContainer = document.createElement('div');
    systemsContainer.className = 'wilderness-systems-container';
    systemsContainer.style.display = 'flex';
    systemsContainer.style.flexDirection = 'column';
    systemsContainer.style.gap = '20px';

    // Add the systems container to the content area
    contentArea.appendChild(systemsContainer);

    return systemsContainer;
}
