import * as THREE from 'three';
import { ResourceInventory, getResourcesArray } from './resourceInventory';

/**
 * Create a simplified inventory panel UI
 * @param inventory Resource inventory to display
 * @returns The created inventory panel element
 */
export function createSimpleInventoryPanel(inventory: ResourceInventory): HTMLElement {
    // Create inventory panel
    const inventoryPanel = document.createElement('div');
    inventoryPanel.className = 'inventory-panel';
    inventoryPanel.innerHTML = `
        <div class="inventory-header">
            <h3>Resource Inventory</h3>
            <span class="inventory-capacity">0/${inventory.capacity || '∞'}</span>
        </div>
        <div class="inventory-resources"></div>
    `;
    
    // Update the inventory panel with initial data
    updateSimpleInventoryPanel(inventoryPanel, inventory);
    
    return inventoryPanel;
}

/**
 * Update the inventory panel UI with current inventory data
 * @param inventoryPanel Inventory panel element to update
 * @param inventory Resource inventory data
 */
export function updateSimpleInventoryPanel(
    inventoryPanel: HTMLElement,
    inventory: ResourceInventory
): void {
    if (!inventoryPanel) return;

    // Update capacity display
    const capacityElement = inventoryPanel.querySelector('.inventory-capacity');
    if (capacityElement) {
        capacityElement.textContent = `${inventory.totalItems}/${inventory.capacity || '∞'}`;
    }

    // Get resources container
    const resourcesContainer = inventoryPanel.querySelector('.inventory-resources');
    if (!resourcesContainer) return;

    // Clear existing resources
    resourcesContainer.innerHTML = '';

    // Get sorted resources (by amount, descending)
    const resources = getResourcesArray(inventory).sort((a, b) => b.amount - a.amount);

    if (resources.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-inventory';
        emptyMessage.textContent = 'No resources collected yet';
        resourcesContainer.appendChild(emptyMessage);
        return;
    }

    // Add each resource
    resources.forEach(resource => {
        const resourceElement = document.createElement('div');
        resourceElement.className = 'resource-item';
        
        // Convert color to hex
        const colorHex = '#' + resource.color.getHexString();
        
        resourceElement.innerHTML = `
            <div class="resource-color" style="background-color: ${colorHex}"></div>
            <div class="resource-info">
                <div class="resource-name">${resource.name} (${resource.symbol})</div>
                <div class="resource-amount">${resource.amount}</div>
            </div>
        `;
        
        resourcesContainer.appendChild(resourceElement);
    });
}

/**
 * Add CSS styles for the inventory panel
 */
export function addSimpleInventoryStyles(): void {
    // Check if styles already exist
    if (document.getElementById('simple-inventory-styles')) return;

    const styleElement = document.createElement('style');
    styleElement.id = 'simple-inventory-styles';
    styleElement.textContent = `
        .inventory-panel {
            background-color: rgba(40, 40, 40, 0.7);
            border: 1px solid #444;
            border-radius: 4px;
            padding: 10px;
            width: 100%;
            margin-top: 15px;
        }

        .inventory-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #444;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }

        .inventory-header h3 {
            margin: 0;
            font-size: 14px;
            color: #e2e8f0;
        }

        .inventory-capacity {
            font-size: 12px;
            color: #a0aec0;
            font-weight: bold;
        }

        .inventory-resources {
            max-height: 150px;
            overflow-y: auto;
        }

        .resource-item {
            display: flex;
            align-items: center;
            padding: 5px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .resource-item:last-child {
            border-bottom: none;
        }

        .resource-color {
            width: 12px;
            height: 12px;
            border-radius: 2px;
            margin-right: 8px;
        }

        .resource-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
        }

        .resource-name {
            color: #e2e8f0;
        }

        .resource-amount {
            font-weight: bold;
            color: #4fd1c5;
        }

        .empty-inventory {
            text-align: center;
            color: #a0aec0;
            font-style: italic;
            font-size: 11px;
            padding: 10px 0;
        }

        /* Scrollbar styles for inventory */
        .inventory-resources::-webkit-scrollbar {
            width: 6px;
        }

        .inventory-resources::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }

        .inventory-resources::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .inventory-resources::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
    `;

    document.head.appendChild(styleElement);
}
