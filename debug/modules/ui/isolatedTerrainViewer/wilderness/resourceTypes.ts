/**
 * Represents the types of resources in the wilderness
 */
export enum ResourceType {
    LOG = 'log',
    ROCK = 'rock',
    STICK = 'stick',
    FIBER = 'fiber'
}

/**
 * Represents the requirements for a specific resource
 */
export type ResourceRequirements = Partial<Record<ResourceType, number>>;
