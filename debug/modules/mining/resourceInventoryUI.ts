import { ResourceInventory, ResourceItem, getResourcesArray } from './resourceInventory';

// Create and return the inventory UI element
export function createInventoryUI(containerId: string): HTMLElement {
    // Find or create container
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    }

    // Create inventory panel
    const inventoryPanel = document.createElement('div');
    inventoryPanel.className = 'inventory-panel';
    inventoryPanel.innerHTML = `
        <div class="inventory-header">
            <h3>Resource Inventory</h3>
            <span class="inventory-capacity">0/0</span>
        </div>
        <div class="inventory-resources"></div>
    `;
    
    container.appendChild(inventoryPanel);
    return inventoryPanel;
}

// Update the inventory UI with current inventory data
export function updateInventoryUI(
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

// Add CSS styles for the inventory UI
export function addInventoryStyles(): void {
    // Check if styles already exist
    if (document.getElementById('inventory-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'inventory-styles';
    styleElement.textContent = `
        .inventory-panel {
            background-color: rgba(30, 30, 30, 0.9);
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-family: 'Arial', sans-serif;
            max-height: 300px;
            overflow-y: auto;
            padding: 10px;
            width: 100%;
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
            font-size: 16px;
        }
        
        .inventory-capacity {
            font-size: 14px;
            color: #aaa;
        }
        
        .inventory-resources {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .resource-item {
            display: flex;
            align-items: center;
            padding: 5px;
            border-radius: 3px;
            background-color: rgba(50, 50, 50, 0.5);
        }
        
        .resource-color {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            margin-right: 10px;
        }
        
        .resource-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .resource-name {
            font-size: 14px;
        }
        
        .resource-amount {
            font-weight: bold;
            color: #ddd;
        }
        
        .empty-inventory {
            color: #888;
            font-style: italic;
            text-align: center;
            padding: 10px;
        }
    `;
    
    document.head.appendChild(styleElement);
}
