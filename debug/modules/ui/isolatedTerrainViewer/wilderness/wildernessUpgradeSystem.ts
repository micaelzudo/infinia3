import { WildernessInventory } from './wildernessInventory';
import { ResourceType } from './resourceTypes';
import { UpgradeData, UpgradeEffectType, UpgradeEvent } from './upgradeTypes';

// Centralized logging and error handling utility
const createLogger = (debugMode: boolean = false) => {
    return (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        if (debugMode) {
            console[level](message);
        }
    };
};

// Robust upgrade data validation
const validateUpgradeData = (upgrade: UpgradeData): boolean => {
    const requiredFields: (keyof UpgradeData)[] = ['id', 'name', 'level', 'maxLevel'];
    return requiredFields.every(field => {
        const value = upgrade[field];
        const isValid = value !== undefined && value !== null;
        if (!isValid) {
            console.error(`Invalid upgrade: missing ${String(field)}`);
        }
        return isValid;
    });
};

// Centralized utility functions and type definitions
const createLogger = (debugMode: boolean) => {
    return (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
        if (debugMode) {
            console[level](message);
        }
    };
};

// Centralized type definitions and utility functions


// Centralized type definitions and utility functions


// Centralized type definitions to prevent duplication

import { ResourceType } from './resourceTypes';

/**
 * Configuration options for the upgrade system
 */
/** Comprehensive configuration for upgrade system */
/** Comprehensive configuration for upgrade system */
/** Comprehensive configuration for upgrade system */
/** Comprehensive configuration for upgrade system */
export interface UpgradeSystemConfig {
    /** Maximum number of upgrades allowed */
    maxUpgradeLevel?: number;

    /** Optional UI container for rendering upgrades */
    uiContainer?: HTMLElement | null;

    /** Optional callback for rendering upgrades */
    renderCallback?: (upgrades: UpgradeData[]) => void;

    /** Optional debug mode for detailed logging */
    debugMode?: boolean;

    /** Optional custom logging function */
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;

    /** Optional upgrade multiplier for scaling effects */
    upgradeMultiplier?: number;
}
    /** Maximum number of upgrades allowed */
    maxUpgradeLevel?: number;

    /** Optional UI container for rendering upgrades */
    uiContainer?: HTMLElement | null;

    /** Optional callback for rendering upgrades */
    renderCallback?: (upgrades: UpgradeData[]) => void;

    /** Optional debug mode for detailed logging */
    debugMode?: boolean;

    /** Optional custom logging function */
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;

    /** Optional upgrade multiplier for scaling effects */
    upgradeMultiplier?: number;
}
    /** Maximum number of upgrades allowed */
    maxUpgradeLevel?: number;

    /** Optional UI container for rendering upgrades */
    uiContainer?: HTMLElement | null;

    /** Optional callback for rendering upgrades */
    renderCallback?: (upgrades: UpgradeData[]) => void;

    /** Optional debug mode for detailed logging */
    debugMode?: boolean;

    /** Optional custom logging function */
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;

    /** Optional upgrade multiplier for scaling effects */
    upgradeMultiplier?: number;
}
    /** Maximum number of upgrades allowed */
    maxUpgradeLevel?: number;

    /** Optional UI container for rendering upgrades */
    uiContainer?: HTMLElement | null;

    /** Optional callback for rendering upgrades */
    renderCallback?: (upgrades: UpgradeData[]) => void;

    /** Optional debug mode for detailed logging */
    debugMode?: boolean;

    /** Optional custom logging function */
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;

    /** Optional upgrade multiplier for scaling effects */
    upgradeMultiplier?: number;
}
    /**
     * Maximum number of upgrades allowed
     * @default 5
     */
    maxUpgradeLevel?: number;

    /**
     * Optional UI container for rendering upgrades
     */
    uiContainer?: HTMLElement | null;

    /**
     * Optional callback for rendering upgrades
     */
    renderCallback?: (upgrades: UpgradeData[]) => void;

    /**
     * Optional debug mode for detailed logging
     */
    debugMode?: boolean;

    /**
     * Optional custom logging function
     */
    logger?: (message: string, level?: 'info' | 'warn' | 'error') => void;
}

/**
 * Defines the structure of upgrade effects
 */
export interface UpgradeEffects {
    /** Improves tool performance */
    toolEfficiency?: number;

    /** Increases crafting speed */
    craftingSpeed?: number;

    /** Number of new recipes unlocked */
    recipeUnlockCount?: number;

    /** Complexity of craftable items */
    craftingComplexity?: number;

    /** Discount on crafting resources */
    craftingDiscount?: number;

    /** Increases building durability */
    buildingHealthBonus?: number;

    /** Bonus resource gathering */
    resourceBonus?: Record<ResourceType, number>;

    /** Optional inventory expansion slots */
    inventorySlots?: number;

    /** Tracks additional metadata about the upgrade effect */
    metadata?: Record<string, unknown>;

    /** Optional transformation or calculation for the effect */
    transform?: (currentValue: number) => number;

    /** Optional method to check if upgrade can be applied */
 * Interface for upgrade data
 */
export type UpgradeEffectType = 
    | 'inventoryCapacity' 
    | 'craftingSpeedMultiplier' 
    | 'resourceYieldMultiplier' 
    | 'skillProficiency';

/** Detailed configuration for an upgrade in the Wilderness system */
/** Types of upgrade effects */
/** Standardized upgrade effect types */
/** Standardized upgrade effect types */
/** Standardized upgrade effect types */
/** Standardized upgrade effect types */
/** Standardized upgrade effect types with comprehensive descriptions */
export enum UpgradeEffectType {
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency',
    ToolEfficiency = 'toolEfficiency',
    BuildingDurability = 'buildingDurability'
}
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency',
    ToolEfficiency = 'toolEfficiency',
    BuildingDurability = 'buildingDurability'
}
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency',
    ToolEfficiency = 'toolEfficiency',
    BuildingDurability = 'buildingDurability'
}
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency',
    ToolEfficiency = 'toolEfficiency',
    BuildingDurability = 'buildingDurability'
}
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency'
}

/** Comprehensive upgrade data structure */
/** Comprehensive upgrade data structure */
/** Comprehensive upgrade data structure */
/** Comprehensive upgrade data structure */
/** Comprehensive upgrade data structure with robust type definitions */
export interface UpgradeData {
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description of the upgrade's benefits */
    description: string;

    /** Current upgrade level, starts at 1 */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements to perform the upgrade */
    requirements?: Record<ResourceType, number>;

    /** 
     * Function to calculate upgrade effects based on current level
     * @param level Current upgrade level
     * @returns A record of upgrade effects with their corresponding values
     */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** 
     * Optional tags to categorize and filter upgrades 
     * Examples: 'survival', 'crafting', 'resource-management'
     */
    tags?: string[];

    /** 
     * Optional metadata for additional upgrade tracking 
     * Can be used for UI display or advanced game mechanics
     */
    metadata?: Record<string, unknown>;

    /** Internal tracking for upgrade application state */
    _internal: {
        /** Tracks if the upgrade has been applied */
        applied: boolean;
        /** Tracks any additional effects or state */
        effects: Record<string, unknown>;
    };
}
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description of the upgrade's benefits */
    description: string;

    /** Current upgrade level, starts at 1 */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements to perform the upgrade */
    requirements?: Record<ResourceType, number>;

    /** 
     * Function to calculate upgrade effects based on current level
     * @param level Current upgrade level
     * @returns A record of upgrade effects with their corresponding values
     */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** 
     * Optional tags to categorize and filter upgrades 
     * Examples: 'survival', 'crafting', 'resource-management'
     */
    tags?: string[];

    /** 
     * Optional metadata for additional upgrade tracking 
     * Can be used for UI display or advanced game mechanics
     */
    metadata?: Record<string, unknown>;

    /** Internal tracking for upgrade application state */
    _internal: {
        /** Tracks if the upgrade has been applied */
        applied: boolean;
        /** Tracks any additional effects or state */
        effects: Record<string, unknown>;
    };
}
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description of the upgrade's benefits */
    description: string;

    /** Current upgrade level, starts at 1 */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements to perform the upgrade */
    requirements?: Record<ResourceType, number>;

    /** 
     * Function to calculate upgrade effects based on current level
     * @param level Current upgrade level
     * @returns A record of upgrade effects with their corresponding values
     */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** 
     * Optional tags to categorize and filter upgrades 
     * Examples: 'survival', 'crafting', 'resource-management'
     */
    tags?: string[];

    /** 
     * Optional metadata for additional upgrade tracking 
     * Can be used for UI display or advanced game mechanics
     */
    metadata?: Record<string, unknown>;

    /** Internal tracking for upgrade application state */
    _internal: {
        /** Tracks if the upgrade has been applied */
        applied: boolean;
        /** Tracks any additional effects or state */
        effects: Record<string, unknown>;
    };
}
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description of the upgrade's benefits */
    description: string;

    /** Current upgrade level, starts at 1 */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements to perform the upgrade */
    requirements?: Record<ResourceType, number>;

    /** 
     * Function to calculate upgrade effects based on current level
     * @param level Current upgrade level
     * @returns A record of upgrade effects with their corresponding values
     */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** 
     * Optional tags to categorize and filter upgrades 
     * Examples: 'survival', 'crafting', 'resource-management'
     */
    tags?: string[];

    /** 
     * Optional metadata for additional upgrade tracking 
     * Can be used for UI display or advanced game mechanics
     */
    metadata?: Record<string, unknown>;

    /** Internal tracking for upgrade application state */
    _internal: {
        /** Tracks if the upgrade has been applied */
        applied: boolean;
        /** Tracks any additional effects or state */
        effects: Record<string, unknown>;
    };
}
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description of the upgrade */
    description: string;

    /** Current upgrade level */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements for the upgrade */
    requirements?: Record<string, number>;

    /** Function to calculate upgrade effects */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** Optional tags for categorization */
    tags?: string[];

    /** Internal tracking for upgrade state */
    _internal: {
        /** Whether the upgrade has been applied */
        applied: boolean;
        /** Additional effects or metadata */
        effects: Record<string, unknown>;
    };
}
    /** Unique identifier for the upgrade */
    id: string;

    /** Display name of the upgrade */
    name: string;

    /** Detailed description explaining the upgrade's benefits */
    description: string;

    /** Current upgrade level, starts at 1 */
    level: number;

    /** Maximum possible upgrade level */
    maxLevel: number;

    /** Resource requirements to perform the upgrade */
    requirements?: Record<string, number>;

    /** 
     * Function to calculate upgrade effects based on current level
     * @param level Current upgrade level
     * @returns A record of upgrade effects with their corresponding values
     */
    effect: (level: number) => Record<UpgradeEffectType, number>;

    /** 
     * Optional tags to categorize and filter upgrades 
     * Examples: 'survival', 'crafting', 'resource-management'
     */
    tags?: string[];

    /** 
     * Optional metadata for additional upgrade tracking 
     * Can be used for UI display or advanced game mechanics
     */
    metadata?: Record<string, unknown>;

    /** Internal tracking for upgrade application state */
    _internal: {
        /** Tracks if the upgrade has been applied */
        applied: boolean;
        /** Tracks any additional effects or state */
        effects: Record<string, unknown>;
    };
}

/**
 * Upgrade event types
 */
export interface UpgradeEvent {
    type: 'upgrade_started' | 'upgrade_completed' | 'upgrade_failed';
    upgradeId: string;
    level: number;
    timestamp: number;
}

/**
 * Wilderness Upgrade System for managing game upgrades
 */
/** Configuration for the Wilderness Upgrade System */
interface WildernessUpgradeConfig {
    /** Maximum level for upgrades */
    maxUpgradeLevel?: number;
    /** Additional configuration options */
    [key: string]: unknown;
}

/** Configuration for upgrade system */
interface WildernessUpgradeConfig {
    maxUpgradeLevel?: number;
    upgradeMultiplier?: number;
}

/** Event types for upgrade system */
enum UpgradeEventType {
    UPGRADE_STARTED = 'upgrade_started',
    UPGRADE_COMPLETED = 'upgrade_completed',
    UPGRADE_FAILED = 'upgrade_failed'
}

/** Upgrade event structure */
interface UpgradeEvent {
    type: UpgradeEventType;
    upgradeId: string;
    timestamp: number;
}

/** Upgrade effect types */
enum UpgradeEffectType {
    CRAFTING_SPEED = 'craftingSpeed',
    RESOURCE_EFFICIENCY = 'resourceEfficiency',
    INVENTORY_CAPACITY = 'inventoryCapacity'
}

/** Upgrade data structure */
interface UpgradeData {
    id: string;
    name: string;
    level: number;
    requirements?: Record<string, number>;
    effect?: (level: number) => Record<UpgradeEffectType, number>;
    tags?: string[];
}

export class WildernessUpgradeSystem {
    /** Inventory system */
    private readonly inventory: WildernessInventory;

    /** Configuration for upgrade system */
    private readonly config: WildernessUpgradeConfig;

    /** List of available upgrades */
    private upgrades: UpgradeData[] = [];

    /** History of applied upgrades */
    private upgradeHistory: string[] = [];

    /** Event listeners for upgrade events */
    private eventListeners: Map<UpgradeEventType, Array<(event: UpgradeEvent) => void>> = new Map();

    /** Callback for rendering upgrades */
    private renderCallback?: (upgrades: UpgradeData[]) => void = this.defaultRenderCallback;

    /** UI container for rendering upgrades */
    private uiContainer?: HTMLElement;

    /** Crafting system reference */
    private craftingSystem?: any;
    /** Inventory system */
    private inventory: WildernessInventory;

    /** Configuration for upgrade system */
    private config: WildernessUpgradeConfig;

    /** List of available upgrades */
    private upgrades: UpgradeData[] = [];

    /** History of applied upgrades */
    private upgradeHistory: string[] = [];

    /** Callback for rendering upgrades */
    private renderCallback?: (upgrades: UpgradeData[]) = this.defaultRenderCallback;

    /** UI container for rendering upgrades */
    private uiContainer?: HTMLElement;

    /** Crafting system reference */
    private craftingSystem?: any;

    /** Event listeners for upgrade events */
    private eventListeners: Array<(event: UpgradeEvent) => void> = [];

    /** Default rendering callback */
    private defaultRenderCallback = (upgrades: UpgradeData[]): void => {
        console.log('Rendering upgrades:', upgrades);
    };

    /** Constructor for WildernessUpgradeSystem */
    constructor(inventory: WildernessInventory, config: WildernessUpgradeConfig = {}) {
        this.inventory = inventory;
        this.config = config;
        this.initializeBaseUpgrades();
    }
    /** UI container for rendering upgrades */
    private uiContainer?: HTMLElement;

    /** Crafting system reference */
    private craftingSystem?: any;

    /** Event listeners for upgrade events */
    private eventListeners: Array<(event: UpgradeEvent) => void> = [];

    /** Default rendering callback */
    private defaultRenderCallback = (upgrades: UpgradeData[]) => {
        console.log('Rendering upgrades:', upgrades);
    };

    /** Inventory system */
    private inventory: WildernessInventory;

    /** Configuration for upgrade system */
    private config: WildernessUpgradeConfig;

    /** List of available upgrades */
    private upgrades: UpgradeData[];

    /** History of applied upgrades */
    private upgradeHistory: string[];

    /** Callback for rendering upgrades */
    private renderCallback?: (upgrades: UpgradeData[]);
    /** UI container for rendering upgrades */
    private uiContainer?: HTMLElement;

    /** Crafting system reference */
    private craftingSystem?: any;

    /** Event listeners for upgrade events */
    private eventListeners: Array<(event: UpgradeEvent) => void> = [];

    /** Default rendering callback */
    private defaultRenderCallback = (upgrades: UpgradeData[]) => {
        console.log('Rendering upgrades:', upgrades);
    };
    private inventory: WildernessInventory;
    private config: WildernessUpgradeConfig = {};
    private upgrades: UpgradeData[] = [];
    private upgradeHistory: string[] = [];
    private renderCallback?: (upgrades: UpgradeData[]) = this.defaultRenderCallback;
    private config: WildernessUpgradeConfig;
    private upgrades: UpgradeData[] = [];
    private upgradeHistory: string[] = [];
    private renderCallback?: (upgrades: UpgradeData[]) => void;
    private config: UpgradeSystemConfig;
    private upgrades: UpgradeData[];
    private upgradeHistory: UpgradeEvent[];
    private eventListeners: Map<UpgradeEvent['type'], Array<(event: UpgradeEvent) => void>> = new Map();

    private defaultRenderCallback = (upgrades: UpgradeData[]) => {
        console.log('Default render callback for upgrades:', upgrades);
        
        // Render upgrades in UI container if available
        if (this.uiContainer) {
            this.uiContainer.innerHTML = upgrades
                .map(upgrade => `<div>${upgrade.name} (Level ${upgrade.level})</div>`)
                .join('');
        }
    };

    // Placeholder methods for upgrade effects
    private renderUpgrades(upgrades: UpgradeData[]): void {
        console.log('Rendering upgrades:', upgrades);
        this.inventory.expandInventory(1);
    }

    private applyCraftingSpeedUpgrade(upgrade: UpgradeData): void {
        console.log(`Applying crafting speed upgrade: ${upgrade.name}`);
        const craftingSpeedMultiplier = upgrade.effect(upgrade.level).craftingSpeed;
        this.craftingSystem.setCraftingSpeedMultiplier(craftingSpeedMultiplier);
        upgrade._internal.applied = true;
        upgrade._internal.effects = { craftingSpeedMultiplier };
    }
        console.log(`Applying crafting speed upgrade: ${upgrade.name}`);
    }

    private applyResourceYieldUpgrade(upgrade: UpgradeData): void {
        console.log(`Applying resource yield upgrade: ${upgrade.name}`);
        const resourceYieldMultiplier = upgrade.effect(upgrade.level).resourceYield;
        this.resourceSystem.setYieldMultiplier(resourceYieldMultiplier);
        upgrade._internal.applied = true;
        upgrade._internal.effects = { resourceYieldMultiplier };
    }

    private applyInventoryUpgrade(upgrade: UpgradeData): void {
        console.log(`Applying inventory upgrade: ${upgrade.name}`);
        const inventoryCapacity = upgrade.effect(upgrade.level).inventoryCapacity;
        this.inventory.expandInventory(inventoryCapacity);
        upgrade._internal.applied = true;
        upgrade._internal.effects = { inventoryCapacity };
    }

    private applyHealthRegenUpgrade(upgrade: UpgradeData): void {
        console.log(`Applying health regen upgrade: ${upgrade.name}`);
        const healthRegenRate = upgrade.effect(upgrade.level).healthRegen;
        this.playerStats.setHealthRegenRate(healthRegenRate);
        upgrade._internal.applied = true;
        upgrade._internal.effects = { healthRegenRate };
    }
        console.log(`Applying health regen upgrade: ${upgrade.name}`);
    }

    private applyStaminaEfficiencyUpgrade(upgrade: UpgradeData): void {
        console.log(`Applying stamina efficiency upgrade: ${upgrade.name}`);
        const staminaEfficiencyMultiplier = upgrade.effect(upgrade.level).staminaEfficiency;
        this.playerStats.setStaminaEfficiencyMultiplier(staminaEfficiencyMultiplier);
        upgrade._internal.applied = true;
        upgrade._internal.effects = { staminaEfficiencyMultiplier };
    }
        console.log(`Applying stamina efficiency upgrade: ${upgrade.name}`);
    }

    // Emit event method
    public emitEvent(event: UpgradeEvent): void {
        const listeners = this.eventListeners.get(event.type) || [];
        listeners.forEach(listener => listener(event));
    }

    private logger: { log: (message: string, level?: 'info' | 'warn' | 'error') => void } = {
        log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
            console.log(`[${level.toUpperCase()}] ${message}`);
        }
    };
    private uiContainer: HTMLElement | null = null;
    private renderCallback: (upgrades: UpgradeData[]) => void = this.defaultRenderCallback;

    constructor(
        inventory: WildernessInventory,
        config: UpgradeSystemConfig = {},
        logger?: { log: (message: string, level?: 'info' | 'warn' | 'error') => void }
    ) {
        // Override default logger if provided
        if (logger) {
            this.logger = logger;
        }
        this.inventory = inventory;
        this.config = {
            maxUpgradeLevel: 5,
            debugMode: false,
            ...config
        };
        this.upgrades = [];
        this.upgradeHistory = [];
        this.eventListeners = new Map();
        this.logger = logger || {
            log: (message, level = 'info') => {
                if (this.config.debugMode) {
                    console[level](message);
                }
            }
        };
        this.initializeBaseUpgrades();
    }

    /**
     * Initialize base upgrades for the system
     */
    private initializeBaseUpgrades(): void {
        this.upgrades = [
            {
                id: 'larger_inventory',
                name: 'Larger Inventory',
                description: 'Expand inventory capacity',
                level: 1,
                maxLevel: this.config?.maxUpgradeLevel || 5,
                requirements: { 
                    wood: 10,
                    stone: 5
                },
                effect: (level) => ({ 
                    inventoryCapacity: 10 * level,
                    craftingSpeed: 0,
                    resourceYield: 0,
                    healthRegen: 0,
                    staminaEfficiency: 0
                }),
                tags: ['survival', 'resource-management'],
                _internal: {
                    applied: false,
                    effects: {}
                }
            },
            {
                id: 'crafting_speed',
                name: 'Crafting Efficiency',
                description: 'Reduce crafting time and resource consumption',
                level: 1,
                maxLevel: 3,
                requirements: {
                    wood: 15,
                    metal: 10,
                    stone: 5
                },
                effect: (level) => ({
                    craftingSpeedMultiplier: 1 - (0.1 * level),
                    resourceConsumptionMultiplier: 0.9 ** level
                }),
                tags: ['crafting', 'efficiency'],
                metadata: {
                    uiIcon: 'hammer',
                    difficultyLevel: 'medium'
                },
                _internal: {
                    applied: false,
                    effects: {}
                }
            },
            {
                id: 'resource_gathering',
                name: 'Advanced Gathering',
                description: 'Increase resource yield and gathering speed',
                level: 1,
                maxLevel: 4,
                requirements: {
                    stone: 20,
                    metal: 15,
                    wood: 10
                },
                effect: (level) => ({
                    resourceYieldMultiplier: 1 + (0.15 * level),
                    gatheringSpeedMultiplier: 1 + (0.1 * level)
                }),
                tags: ['survival', 'resource-management'],
                metadata: {
                    uiIcon: 'pickaxe',
                    difficultyLevel: 'hard'
                },
                _internal: {
                    applied: false,
                    effects: {}
                }
            },
            {
                id: 'survival_skills',
                name: 'Wilderness Survival',
                description: 'Improve overall survival capabilities',
                level: 1,
                maxLevel: 5,
                requirements: {
                    wood: 30,
                    stone: 25,
                    metal: 20
                },
                effect: (level) => ({
                    healthRegenMultiplier: 1 + (0.05 * level),
                    staminaEfficiencyMultiplier: 1 + (0.08 * level)
                }),
                tags: ['survival', 'player-stats'],
                metadata: {
                    uiIcon: 'heart',
                    difficultyLevel: 'expert'
                },
                _internal: {
                    applied: false,
                    effects: {}
                }
            },
            {
                id: 'efficient_crafting',
                name: 'Efficient Crafting',
                description: 'Reduce crafting resource costs',
                level: 0,
                maxLevel: 2,
                requirements: { 
                    [ResourceType.LOG]: 75, 
                    [ResourceType.ROCK]: 40 
                },
                effects: { craftingDiscount: 0.1 },
                unlocked: false,
                applied: false,
                _internal: {
                    applied: false,
                    effects: {}
                }
            }
        ];
    }

    /**
     * Check if an upgrade can be applied
     * @param upgradeId Unique identifier for the upgrade
     * @returns Boolean indicating if upgrade can be applied
     */
    public canUpgrade(upgradeId: string): boolean {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade || upgrade._internal.applied) return false;

        // Check resource requirements
        const requirements = upgrade.requirements || {};
        const requiredItems = Object.entries(requirements)
            .map(([resource, amount]) => `${resource}:${amount}`);

        return this.inventory.hasItems(requiredItems);
    }

    /**
     * Apply an upgrade with comprehensive validation and event tracking
     * @param upgradeId Unique identifier for the upgrade
     * @returns Boolean indicating if upgrade was successfully applied
     */
    public applyUpgrade(upgradeId: string): boolean {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        
        // Comprehensive validation
        if (!upgrade) {
            this.logger.log(`Upgrade ${upgradeId} not found`, 'error');
            this.emitEvent({
                type: 'upgrade_failed',
                upgradeId,
                level: 0,
                timestamp: Date.now()
            });
            return false;
        }

        // Check if upgrade can be applied
        if (!this.canUpgrade(upgradeId)) {
            this.logger.log(`Upgrade ${upgradeId} cannot be applied`, 'warn');
            this.emitEvent({
                type: 'upgrade_failed',
                upgradeId,
                level: upgrade.level,
                timestamp: Date.now()
            });
            return false;
        }

        // Emit upgrade start event
        this.emitEvent({
            type: 'upgrade_started',
            upgradeId,
            level: upgrade.level + 1,
            timestamp: Date.now()
        });

        // Deduct resources
        const requirements = upgrade.requirements || {};
        try {
            Object.entries(requirements).forEach(([resource, amount]) => 
                this.inventory.removeItem(resource as ResourceType, amount)
            );
        } catch (error) {
            this.logger.log(`Resource deduction failed for ${upgradeId}: ${error}`, 'error');
            return false;
        }

        // Apply upgrade effects
        if (upgrade.effect) {
            const effects = upgrade.effect(upgrade.level);
            Object.entries(effects).forEach(([key, value]) => {
                // Implement upgrade logic here
                switch (key) {
                    case 'inventoryCapacity':
                        this.inventory.expandInventory(value);
                        break;
                    case 'craftingSpeedMultiplier':
                        this.applyCraftingSpeedUpgrade(value);
                        break;
                    case 'resourceYieldMultiplier':
                        this.applyResourceYieldUpgrade(value);
                        break;
                    case 'healthRegenMultiplier':
                        this.applyHealthRegenUpgrade(value);
                        break;
                    case 'staminaEfficiencyMultiplier':
                        this.applyStaminaEfficiencyUpgrade(value);
                        break;
                    // Add more upgrade types as needed
                }
            });
        }

        // Increment upgrade level
        upgrade.level += 1;

        // Mark upgrade as applied
        upgrade._internal.applied = true;
        upgrade._internal.effects = upgrade.effect ? upgrade.effect(upgrade.level) : {};

        // Log and emit completion event
        this.logger.log(`Upgrade ${upgradeId} successfully applied to level ${upgrade.level}`);
        this.emitEvent({
            type: 'upgrade_completed',
            upgradeId,
            level: upgrade.level,
            timestamp: Date.now()
        });

        // Record in upgrade history
        this.upgradeHistory.push({
            type: 'upgrade_completed',
            upgradeId,
            level: upgrade.level,
            timestamp: Date.now()
        });

        return true;
    }

    /**
     * Validate upgrade prerequisites
     * @param upgradeId Unique identifier for the upgrade
     * @returns Boolean indicating if prerequisites are met
     */
    public validateUpgradePrerequisites(upgradeId: string): boolean {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) {
            this.logger.log(`Upgrade ${upgradeId} not found`, 'warn');
            return false;
        }

        // Check max level
        if (upgrade.level >= upgrade.maxLevel) {
            this.logger.log(`Max level reached for ${upgrade.id}`, 'warn');
            return false;
        }
        // Check resource requirements
        const requirements = upgrade.requirements || {};
        return Object.entries(requirements).every(([resource, amount]) => 
            this.inventory.hasItem(resource as ResourceType, amount)
        );
    }

    /**
     * Process upgrade effects
     * @param upgradeId Unique identifier for the upgrade
     */
    public processUpgradeEffects(upgradeId: string): void {
        const upgrade = this.upgrades.find(u => u.id === upgradeId);
        if (!upgrade) {
            this.logger.log(`Upgrade ${upgradeId} not found`, 'warn');
            return;
        }

        // Ensure _internal is initialized
        upgrade._internal = upgrade._internal || { applied: false, effects: {} };

        // Apply upgrade effects
        const effectMethods: Record<string, (upgrade: UpgradeData) => void> = {
            'inventory_capacity': this.applyInventoryUpgrade.bind(this),
            'crafting_speed': this.applyCraftingSpeedUpgrade.bind(this),
            'resource_yield': this.applyResourceYieldUpgrade.bind(this),
            'health_regen': this.applyHealthRegenUpgrade.bind(this),
            'stamina_efficiency': this.applyStaminaEfficiencyUpgrade.bind(this)
        };

        const applyMethod = effectMethods[upgradeId];
        if (applyMethod) {
            applyMethod(upgrade);
            upgrade._internal.applied = true;
        }

        // Trigger render callback
        if (this.renderCallback) {
            this.renderCallback(this.upgrades);
        }

        // Emit upgrade event
        this.emitEvent({
            type: 'upgrade_completed',
            upgradeId: upgrade.id,
            level: upgrade.level,
            timestamp: Date.now()
        });
    }

    /**
     * Get available upgrades that can be applied
     * @returns List of upgradeable upgrades
     */
    public getAvailableUpgrades(): UpgradeData[] {
        return this.upgrades.filter(upgrade => 
            !upgrade.applied && 
            this.canApplyUpgrade(upgrade.id)
        );
    }

    /**
     * Get the current crafting discount
     * @returns Crafting discount percentage
     */
    public getCraftingDiscount(): number {
        const upgrade = this.upgrades.find(u => u.id === 'efficient_crafting' && u.applied);
        return upgrade ? (upgrade.effects.craftingDiscount || 0) : 0;
    }

    /**
     * Reset the entire upgrade system state
     */
    public resetUpgradeState(): void {
        this.upgrades.forEach(upgrade => {
            upgrade.applied = false;
            upgrade.level = 0;
        });
        this.initializeBaseUpgrades();
    }
}

export default WildernessUpgradeSystem;