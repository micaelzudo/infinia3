import * as THREE from 'three';

// Define the resource item interface
export interface ResourceItem {
    symbol: string;       // Element symbol (e.g., "Fe", "Au")
    name: string;         // Full name (e.g., "Iron", "Gold")
    amount: number;       // Quantity collected
    color: THREE.Color;   // Visual color for UI
}

// Define the inventory interface
export interface ResourceInventory {
    resources: { [symbol: string]: ResourceItem };
    totalItems: number;
    capacity: number;     // Maximum capacity (optional)
}

// Create a new empty inventory
export function createInventory(capacity: number = 100): ResourceInventory {
    return {
        resources: {},
        totalItems: 0,
        capacity
    };
}

// Add a resource to the inventory
export function addResource(
    inventory: ResourceInventory,
    symbol: string,
    name: string,
    amount: number,
    color: THREE.Color
): boolean {
    // Check if we're at capacity
    if (inventory.capacity > 0 && inventory.totalItems + amount > inventory.capacity) {
        console.warn(`Inventory full! Cannot add ${amount} of ${name}`);
        return false;
    }

    // If resource already exists, update amount
    if (inventory.resources[symbol]) {
        inventory.resources[symbol].amount += amount;
    } else {
        // Otherwise create a new entry
        inventory.resources[symbol] = {
            symbol,
            name,
            amount,
            color: color.clone()
        };
    }

    // Update total count
    inventory.totalItems += amount;
    return true;
}

// Remove a resource from the inventory
export function removeResource(
    inventory: ResourceInventory,
    symbol: string,
    amount: number
): boolean {
    // Check if resource exists and has sufficient amount
    if (!inventory.resources[symbol] || inventory.resources[symbol].amount < amount) {
        console.warn(`Not enough ${symbol} in inventory!`);
        return false;
    }

    // Update amount
    inventory.resources[symbol].amount -= amount;
    inventory.totalItems -= amount;

    // Remove entry if amount is zero
    if (inventory.resources[symbol].amount <= 0) {
        delete inventory.resources[symbol];
    }

    return true;
}

// Get all resources as an array
export function getResourcesArray(inventory: ResourceInventory): ResourceItem[] {
    return Object.values(inventory.resources);
}

// Check if inventory has a specific resource
export function hasResource(
    inventory: ResourceInventory,
    symbol: string,
    amount: number = 1
): boolean {
    return !!inventory.resources[symbol] && inventory.resources[symbol].amount >= amount;
}

// Get the amount of a specific resource
export function getResourceAmount(
    inventory: ResourceInventory,
    symbol: string
): number {
    return inventory.resources[symbol]?.amount || 0;
}

// Clear the inventory
export function clearInventory(inventory: ResourceInventory): void {
    inventory.resources = {};
    inventory.totalItems = 0;
}
