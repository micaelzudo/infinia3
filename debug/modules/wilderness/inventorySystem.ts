import * as THREE from 'three';

/**
 * Item class for the inventory system
 */
export class Item {
    public id: string;
    public name: string;
    public quantity: number;
    public icon: string;
    public description: string;

    /**
     * Constructor for the Item class
     * @param id The item ID
     * @param name The item name
     * @param quantity The item quantity
     * @param icon The item icon
     * @param description The item description
     */
    constructor(id: string, name: string, quantity: number = 1, icon: string = '📦', description: string = '') {
        this.id = id;
        this.name = name;
        this.quantity = quantity;
        this.icon = icon;
        this.description = description;
    }
}

/**
 * Inventory System for the Wilderness Survival Game
 * Handles the player's inventory and items
 */
export class InventorySystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private inventoryContainer: HTMLElement | null = null;
    private itemsContainer: HTMLElement | null = null;
    private items: Item[] = [];

    // Predefined items
    private predefinedItems: Item[] = [
        new Item('wood', 'Wood', 0, '🪵', 'Basic building material'),
        new Item('stone', 'Stone', 0, '🪨', 'Used for tools and building'),
        new Item('metal', 'Metal', 0, '⚙️', 'Advanced building material'),
        new Item('food', 'Food', 0, '🍖', 'Restores health'),
        new Item('water', 'Water', 0, '💧', 'Quenches thirst'),
        new Item('herb', 'Herb', 0, '🌿', 'Used for crafting medicine')
    ];

    /**
     * Constructor for the InventorySystem class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, contentArea: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;
        
        // Initialize with some items
        this.items = [...this.predefinedItems];
        
        // Create the inventory UI
        this.createInventoryUI();
        
        console.log("Inventory System initialized");
    }

    /**
     * Create the inventory UI
     */
    private createInventoryUI(): void {
        // Create the inventory section
        const inventorySection = document.createElement('div');
        inventorySection.className = 'wilderness-inventory-section';
        inventorySection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Inventory';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        inventorySection.appendChild(sectionTitle);

        // Create the inventory container
        this.inventoryContainer = document.createElement('div');
        this.inventoryContainer.className = 'wilderness-inventory-container';
        this.inventoryContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.inventoryContainer.style.borderRadius = '4px';
        this.inventoryContainer.style.padding = '10px';
        inventorySection.appendChild(this.inventoryContainer);

        // Create the items container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'wilderness-items-container';
        this.itemsContainer.style.display = 'grid';
        this.itemsContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        this.itemsContainer.style.gap = '10px';
        this.inventoryContainer.appendChild(this.itemsContainer);

        // Add the inventory section to the content area
        this.contentArea.appendChild(inventorySection);

        // Add resource gathering buttons
        this.createResourceGatheringButtons(inventorySection);

        // Update the inventory UI
        this.updateInventoryUI();
    }

    /**
     * Create resource gathering buttons
     * @param container The container to append the buttons to
     */
    private createResourceGatheringButtons(container: HTMLElement): void {
        // Create the buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'wilderness-resource-buttons';
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.flexWrap = 'wrap';
        buttonsContainer.style.gap = '10px';
        buttonsContainer.style.marginTop = '10px';
        container.appendChild(buttonsContainer);

        // Define the resource gathering actions
        const actions = [
            { id: 'wood', name: 'Gather Wood', icon: '🪓', color: '#a0522d' },
            { id: 'stone', name: 'Mine Stone', icon: '⛏️', color: '#708090' },
            { id: 'food', name: 'Hunt Food', icon: '🏹', color: '#8b4513' },
            { id: 'water', name: 'Collect Water', icon: '🪣', color: '#4682b4' },
            { id: 'herb', name: 'Forage Herbs', icon: '🔍', color: '#228b22' }
        ];

        // Create a button for each action
        actions.forEach(action => {
            const actionButton = document.createElement('button');
            actionButton.className = 'wilderness-action-button';
            actionButton.innerHTML = `<span style="font-size: 16px; margin-right: 5px;">${action.icon}</span> ${action.name}`;
            
            // Style the button
            actionButton.style.display = 'flex';
            actionButton.style.alignItems = 'center';
            actionButton.style.justifyContent = 'center';
            actionButton.style.padding = '8px 12px';
            actionButton.style.backgroundColor = action.color;
            actionButton.style.color = 'white';
            actionButton.style.border = 'none';
            actionButton.style.borderRadius = '4px';
            actionButton.style.cursor = 'pointer';
            actionButton.style.fontWeight = 'bold';
            actionButton.style.flex = '1';
            actionButton.style.minWidth = '120px';
            actionButton.style.transition = 'all 0.2s ease';
            
            // Add hover effect
            actionButton.addEventListener('mouseover', () => {
                actionButton.style.transform = 'translateY(-2px)';
                actionButton.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            });
            
            actionButton.addEventListener('mouseout', () => {
                actionButton.style.transform = 'translateY(0)';
                actionButton.style.boxShadow = 'none';
            });
            
            // Add click handler
            actionButton.addEventListener('click', () => {
                this.gatherResource(action.id);
            });
            
            buttonsContainer.appendChild(actionButton);
        });
    }

    /**
     * Gather a resource
     * @param resourceId The resource ID
     */
    private gatherResource(resourceId: string): void {
        // Find the item in the inventory
        const item = this.items.find(item => item.id === resourceId);
        if (item) {
            // Add a random amount of the resource (1-3)
            const amount = Math.floor(Math.random() * 3) + 1;
            item.quantity += amount;
            
            console.log(`Gathered ${amount} ${item.name}`);
            
            // Update the inventory UI
            this.updateInventoryUI();
        }
    }

    /**
     * Update the inventory UI
     */
    private updateInventoryUI(): void {
        if (!this.itemsContainer) return;
        
        // Clear the items container
        this.itemsContainer.innerHTML = '';
        
        // Add each item to the container
        this.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'wilderness-item';
            itemElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            itemElement.style.borderRadius = '4px';
            itemElement.style.padding = '8px';
            itemElement.style.display = 'flex';
            itemElement.style.flexDirection = 'column';
            itemElement.style.alignItems = 'center';
            itemElement.style.justifyContent = 'center';
            itemElement.style.cursor = 'pointer';
            
            // Add the item icon
            const itemIcon = document.createElement('div');
            itemIcon.className = 'wilderness-item-icon';
            itemIcon.textContent = item.icon;
            itemIcon.style.fontSize = '24px';
            itemIcon.style.marginBottom = '5px';
            itemElement.appendChild(itemIcon);
            
            // Add the item name
            const itemName = document.createElement('div');
            itemName.className = 'wilderness-item-name';
            itemName.textContent = item.name;
            itemName.style.fontSize = '14px';
            itemName.style.fontWeight = 'bold';
            itemElement.appendChild(itemName);
            
            // Add the item quantity
            const itemQuantity = document.createElement('div');
            itemQuantity.className = 'wilderness-item-quantity';
            itemQuantity.textContent = `x${item.quantity}`;
            itemQuantity.style.fontSize = '12px';
            itemQuantity.style.color = '#a0aec0';
            itemElement.appendChild(itemQuantity);
            
            // Add hover effect
            itemElement.addEventListener('mouseover', () => {
                itemElement.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            });
            
            itemElement.addEventListener('mouseout', () => {
                itemElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            });
            
            // Add tooltip with description
            itemElement.title = item.description;
            
            this.itemsContainer.appendChild(itemElement);
        });
    }

    /**
     * Add an item to the inventory
     * @param itemId The item ID
     * @param quantity The quantity to add
     */
    public addItem(itemId: string, quantity: number = 1): void {
        // Find the item in the inventory
        const item = this.items.find(item => item.id === itemId);
        if (item) {
            // Add the quantity
            item.quantity += quantity;
            
            // Update the inventory UI
            this.updateInventoryUI();
        }
    }

    /**
     * Remove an item from the inventory
     * @param itemId The item ID
     * @param quantity The quantity to remove
     * @returns Whether the item was successfully removed
     */
    public removeItem(itemId: string, quantity: number = 1): boolean {
        // Find the item in the inventory
        const item = this.items.find(item => item.id === itemId);
        if (item && item.quantity >= quantity) {
            // Remove the quantity
            item.quantity -= quantity;
            
            // Update the inventory UI
            this.updateInventoryUI();
            
            return true;
        }
        
        return false;
    }

    /**
     * Check if the inventory has enough of an item
     * @param itemId The item ID
     * @param quantity The quantity to check
     * @returns Whether the inventory has enough of the item
     */
    public hasItem(itemId: string, quantity: number = 1): boolean {
        // Find the item in the inventory
        const item = this.items.find(item => item.id === itemId);
        return item ? item.quantity >= quantity : false;
    }

    /**
     * Get the quantity of an item in the inventory
     * @param itemId The item ID
     * @returns The quantity of the item
     */
    public getItemQuantity(itemId: string): number {
        // Find the item in the inventory
        const item = this.items.find(item => item.id === itemId);
        return item ? item.quantity : 0;
    }

    /**
     * Dispose of the inventory system
     */
    public dispose(): void {
        console.log("Inventory System disposed");
    }
}
