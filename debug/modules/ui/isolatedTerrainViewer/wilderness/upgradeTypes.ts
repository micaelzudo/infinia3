/** Comprehensive upgrade effect types for the wilderness survival game */
export enum UpgradeEffectType {
    InventoryCapacity = 'inventoryCapacity',
    CraftingSpeed = 'craftingSpeed',
    ResourceYield = 'resourceYield',
    HealthRegen = 'healthRegen',
    StaminaEfficiency = 'staminaEfficiency',
    ToolEfficiency = 'toolEfficiency',
    BuildingDurability = 'buildingDurability'
}

/** Comprehensive upgrade data structure with robust type definitions */
export interface UpgradeData {
    /** Unique identifier for the upgrade */
    id: string;

    /** Human-readable name of the upgrade */
    name: string;

    /** Current level of the upgrade */
    level: number;

    /** Optional resource requirements for the upgrade */
    requirements?: Record<string, number>;

    /** Optional effect calculation function */
    effect?: (level: number) => Record<UpgradeEffectType, number>;

    /** Optional tags for categorization */
    tags?: string[];

    /** Optional metadata for additional upgrade information */
    metadata?: Record<string, unknown>;

    /** Flag to indicate if the upgrade is currently active */
    isActive?: boolean;
}

/** Upgrade event types for tracking and managing upgrade states */
export interface UpgradeEvent {
    type: 'upgrade' | 'downgrade' | 'reset';
    upgradeId: string;
    timestamp: number;
    level: number;
}
