import * as THREE from 'three';

// Comprehensive Logging Utility
class Logger {
    static DEBUG = true;
    
    static log(message: string, context?: any): void {
        if (this.DEBUG) {
            console.log(`[WILDERNESS] ${message}`, context || '');
        }
    }

    static error(message: string, error?: Error): void {
        console.error(`[WILDERNESS ERROR] ${message}`, error);
    }
}

// Core Types
interface Resource {
    id: string;
    name: string;
    quantity: number;
    type: 'raw' | 'processed' | 'crafted';
}

interface CraftingRecipe {
    id: string;
    name: string;
    requiredResources: Record<string, number>;
    outputResource: Resource;
    craftTime: number;
}

interface Skill {
    id: string;
    name: string;
    level: number;
    maxLevel: number;
    experience: number;
}

// Subsystem Base Class
abstract class WildernessSubsystem {
    protected controller: WildernessController;

    constructor(controller: WildernessController) {
        this.controller = controller;
    }

    abstract initialize(): Promise<void>;
    abstract handleEvent(eventType: string, payload: any): void;
}

// Wilderness Controller
class WildernessController {
    private subsystems: Record<string, WildernessSubsystem> = {};
    private eventListeners: Record<string, Function[]> = {};

    registerSubsystem(name: string, subsystem: WildernessSubsystem): void {
        this.subsystems[name] = subsystem;
        Logger.log(`Registered subsystem: ${name}`);
    }

    async initializeWilderness(): Promise<void> {
        try {
            Logger.log('Initializing Wilderness Systems');
            await Promise.all(
                Object.values(this.subsystems).map(system => system.initialize())
            );
            Logger.log('Wilderness Systems Initialized Successfully');
        } catch (error) {
            Logger.error('Wilderness Initialization Failed', error as Error);
        }
    }

    dispatchEvent(eventType: string, payload: any): void {
        Logger.log(`Dispatching Event: ${eventType}`, payload);
        
        // Notify subsystems
        Object.values(this.subsystems).forEach(system => {
            system.handleEvent(eventType, payload);
        });

        // Trigger event listeners
        if (this.eventListeners[eventType]) {
            this.eventListeners[eventType].forEach(listener => listener(payload));
        }
    }

    addEventListener(eventType: string, listener: Function): void {
        if (!this.eventListeners[eventType]) {
            this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(listener);
    }
}

// Inventory Subsystem
class WildernessInventorySystem extends WildernessSubsystem {
    private resources: Record<string, Resource> = {};
    private maxInventorySlots: number = 50;

    async initialize(): Promise<void> {
        Logger.log('Initializing Wilderness Inventory');
        // Initial setup logic
    }

    addResource(resource: Resource): boolean {
        const totalResources = Object.keys(this.resources).length;
        if (totalResources >= this.maxInventorySlots) {
            Logger.log('Inventory Full');
            return false;
        }

        if (this.resources[resource.id]) {
            this.resources[resource.id].quantity += resource.quantity;
        } else {
            this.resources[resource.id] = resource;
        }

        this.controller.dispatchEvent('inventory:resourceAdded', resource);
        return true;
    }

    removeResource(resourceId: string, quantity: number): boolean {
        const resource = this.resources[resourceId];
        if (!resource || resource.quantity < quantity) {
            return false;
        }

        resource.quantity -= quantity;
        if (resource.quantity <= 0) {
            delete this.resources[resourceId];
        }

        this.controller.dispatchEvent('inventory:resourceRemoved', { resourceId, quantity });
        return true;
    }

    handleEvent(eventType: string, payload: any): void {
        switch (eventType) {
            case 'resource:gather':
                this.addResource(payload);
                break;
            case 'crafting:consume':
                this.removeResource(payload.resourceId, payload.quantity);
                break;
        }
    }
}

// Crafting Subsystem
class WildernessCraftingSystem extends WildernessSubsystem {
    private recipes: Record<string, CraftingRecipe> = {};
    private inventorySystem: WildernessInventorySystem;

    constructor(controller: WildernessController, inventorySystem: WildernessInventorySystem) {
        super(controller);
        this.inventorySystem = inventorySystem;
    }

    async initialize(): Promise<void> {
        Logger.log('Initializing Wilderness Crafting System');
        // Load initial recipes
        this.registerDefaultRecipes();
    }

    private registerDefaultRecipes(): void {
        // Example recipes
        const woodenToolRecipe: CraftingRecipe = {
            id: 'wooden_tool',
            name: 'Wooden Tool',
            requiredResources: { 'wood': 5 },
            outputResource: { 
                id: 'wooden_tool', 
                name: 'Wooden Tool', 
                quantity: 1, 
                type: 'crafted' 
            },
            craftTime: 5 // seconds
        };

        this.recipes[woodenToolRecipe.id] = woodenToolRecipe;
    }

    craftItem(recipeId: string): boolean {
        const recipe = this.recipes[recipeId];
        if (!recipe) {
            Logger.log(`Recipe not found: ${recipeId}`);
            return false;
        }

        // Check resource availability
        for (const [resourceId, requiredQuantity] of Object.entries(recipe.requiredResources)) {
            // Simulate resource consumption
            const consumeResult = this.inventorySystem.removeResource(resourceId, requiredQuantity);
            if (!consumeResult) {
                Logger.log(`Insufficient resources for crafting ${recipeId}`);
                return false;
            }
        }

        // Add crafted item to inventory
        this.inventorySystem.addResource(recipe.outputResource);
        
        this.controller.dispatchEvent('crafting:itemCrafted', recipe);
        return true;
    }

    handleEvent(eventType: string, payload: any): void {
        switch (eventType) {
            case 'crafting:requestCraft':
                this.craftItem(payload.recipeId);
                break;
        }
    }
}

// Wilderness Game Panel Initializer
class WildernessGamePanel {
    private controller: WildernessController;
    private inventorySystem: WildernessInventorySystem;
    private craftingSystem: WildernessCraftingSystem;

    constructor() {
        this.controller = new WildernessController();
        
        // Create and register subsystems
        this.inventorySystem = new WildernessInventorySystem(this.controller);
        this.craftingSystem = new WildernessCraftingSystem(
            this.controller, 
            this.inventorySystem
        );

        this.controller.registerSubsystem('inventory', this.inventorySystem);
        this.controller.registerSubsystem('crafting', this.craftingSystem);
    }

    async initializePanel(): Promise<void> {
        Logger.log('Initializing Wilderness Game Panel');
        await this.controller.initializeWilderness();

        // Setup debug event listeners
        this.setupDebugListeners();
    }

    private setupDebugListeners(): void {
        // Example debug event listeners
        this.controller.addEventListener('inventory:resourceAdded', (resource) => {
            Logger.log('Resource Added (Debug):', resource);
        });

        this.controller.addEventListener('crafting:itemCrafted', (recipe) => {
            Logger.log('Item Crafted (Debug):', recipe);
        });
    }

    // Expose methods for UI interaction
    gatherResource(resource: Resource): void {
        this.controller.dispatchEvent('resource:gather', resource);
    }

    requestCraftItem(recipeId: string): void {
        this.controller.dispatchEvent('crafting:requestCraft', { recipeId });
    }
}

// Export for use in other modules
export { 
    WildernessGamePanel, 
    Logger, 
    Resource, 
    CraftingRecipe, 
    Skill 
};
