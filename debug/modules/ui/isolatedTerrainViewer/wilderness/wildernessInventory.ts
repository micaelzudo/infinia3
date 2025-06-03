

/**
 * Interface for item data
 */
export interface ItemData {
    type: string;
    quantity: number;
}

/**
 * Class representing an item in the inventory
 */
export class WildernessItem implements ItemData {
    type: string;
    quantity: number;

    constructor(type: string, quantity: number = 1) {
        this.type = type;
        this.quantity = quantity;
    }
}

/**
 * Interface for an inventory slot
 */
export interface Slot {
    item: WildernessItem | null;
}

/**
 * Class representing the player's inventory
 */
export class WildernessInventory {
    public slots: Array<WildernessItem | null>;
    public slotElements: HTMLElement[];
    public unlimitedLogs: boolean;
    public unlimitedResources: boolean;
    public stackSizes: { [key: string]: number };
    private uiContainer: HTMLElement | null = null;

    constructor() {
        this.slots = new Array(5).fill(null);
        this.slotElements = [];
        this.unlimitedLogs = false;
        this.unlimitedResources = false;
        this.stackSizes = {
            log: 999,
            rock: 999,
            stick: 999,
            string: 999,
            axe: 1,
            bow: 1,
            arrow: 999
        };
    }

    /**
     * Expand the inventory by adding more slots
     * @param additionalSlots The number of slots to add
     */
    public expandInventory(additionalSlots: number): void {
        const currentSize = this.slots.length;
        const newSize = currentSize + additionalSlots;

        // Expand slots array
        this.slots = [...this.slots, ...new Array(additionalSlots).fill(null)];

        // Update UI if initialized
        if (this.uiContainer) {
            this.initUI(this.uiContainer);
        }

        console.log(`WildernessInventory: Expanded inventory from ${currentSize} to ${newSize} slots`);
    }

    public updateUI(): void {
        if (!this.uiContainer) return;

        const slots = this.uiContainer.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            const item = this.slots[index];
            const itemDisplay = slot.querySelector('.item-display') as HTMLElement;
            const quantityDisplay = slot.querySelector('.item-quantity') as HTMLElement;

            if (item) {
                itemDisplay.textContent = item.type;
                quantityDisplay.textContent = item.quantity.toString();
            } else {
                itemDisplay.textContent = '';
                quantityDisplay.textContent = '';
            }
        });
    }

    /**
     * Set whether resources are unlimited
     * @param unlimited Whether resources should be unlimited
     */
    public setUnlimitedResources(unlimited: boolean): void {
        this.unlimitedResources = unlimited;
        console.log(`WildernessInventory: Unlimited resources ${unlimited ? 'enabled' : 'disabled'}`);
        this.updateUI();
    }

    /**
     * Initialize the UI for the inventory
     * @param container The HTML element to contain the inventory UI
     */
    public initUI(container: HTMLElement) {
        this.uiContainer = container;
        this.uiContainer.innerHTML = '';
        this.uiContainer.classList.add('wilderness-inventory');

        const inventoryTitle = document.createElement('h3');
        inventoryTitle.textContent = 'Inventory';
        inventoryTitle.classList.add('inventory-title');
        this.uiContainer.appendChild(inventoryTitle);

        const inventoryGrid = document.createElement('div');
        inventoryGrid.classList.add('inventory-grid');
        inventoryGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        inventoryGrid.style.gap = '10px';

        // Dynamically create inventory slots
        for (let i = 0; i < this.slots.length; i++) {
            const slot = document.createElement('div');
            slot.classList.add('inventory-slot');
            slot.dataset.index = i.toString();
            
            const itemDisplay = document.createElement('div');
            itemDisplay.classList.add('item-display');
            
            const quantityDisplay = document.createElement('span');
            quantityDisplay.classList.add('item-quantity');
            
            slot.appendChild(itemDisplay);
            slot.appendChild(quantityDisplay);
            
            inventoryGrid.appendChild(slot);
        }

        this.uiContainer.appendChild(inventoryGrid);
        this.updateUI();
        inventoryGrid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        inventoryGrid.style.gap = '8px';
        inventoryGrid.style.marginBottom = '20px';
        this.uiContainer.appendChild(inventoryGrid);

        // Create inventory slots
        for (let i = 0; i < this.slots.length; i++) {
            const slotElement = document.createElement('div');
            slotElement.className = 'inventory-slot';
            slotElement.style.width = '100%';
            slotElement.style.aspectRatio = '1/1';
            slotElement.style.backgroundColor = '#2d3748';
            slotElement.style.border = '1px solid #4a5568';
            slotElement.style.borderRadius = '4px';
            slotElement.style.display = 'flex';
            slotElement.style.alignItems = 'center';
            slotElement.style.justifyContent = 'center';
            slotElement.style.fontSize = '0.8em';
            slotElement.style.textAlign = 'center';
            slotElement.style.padding = '4px';
            slotElement.style.wordBreak = 'break-word';

            inventoryGrid.appendChild(slotElement);
            this.slotElements.push(slotElement);
        }

        // Add cheat button for unlimited logs
        const cheatButton = document.createElement('button');
        cheatButton.textContent = this.unlimitedLogs ? 'Disable Unlimited Logs' : 'Enable Unlimited Logs';
        cheatButton.style.marginTop = '10px';
        cheatButton.style.padding = '5px 10px';
        cheatButton.style.backgroundColor = this.unlimitedLogs ? '#48bb78' : '#2b6cb0';
        cheatButton.style.color = 'white';
        cheatButton.style.border = 'none';
        cheatButton.style.borderRadius = '4px';
        cheatButton.style.cursor = 'pointer';

        cheatButton.onclick = () => {
            this.unlimitedLogs = !this.unlimitedLogs;
            cheatButton.textContent = this.unlimitedLogs ? 'Disable Unlimited Logs' : 'Enable Unlimited Logs';
            cheatButton.style.backgroundColor = this.unlimitedLogs ? '#48bb78' : '#2b6cb0';
            this.updateUI();
            console.log(`Unlimited logs ${this.unlimitedLogs ? 'enabled' : 'disabled'}`);
        };

        this.uiContainer.appendChild(cheatButton);

        // Initialize UI with current inventory state
        this.updateUI();
    }

    /**
     * Add an item to the inventory
     * @param item The item or item type to add
     * @param count The quantity to add
     * @returns True if the item was added, false otherwise
     */
    public addItem(item: WildernessItem | string, count: number = 1): boolean {
        // Convert string to Item if needed
        const itemToAdd = typeof item === 'string'
            ? new WildernessItem(item, count)
            : item;

        const itemType = itemToAdd.type;
        let remainingCount = itemToAdd.quantity;
        let addedAny = false;

        // First try to add to existing stacks
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot && slot.type === itemType) {
                const maxStack = this.stackSizes[itemType] || 999;
                const spaceInStack = maxStack - slot.quantity;

                if (spaceInStack > 0) {
                    const amountToAdd = Math.min(remainingCount, spaceInStack);
                    slot.quantity += amountToAdd;
                    remainingCount -= amountToAdd;
                    addedAny = true;

                    if (remainingCount <= 0) break;
                }
            }
        }

        // If there are still items to add, find empty slots
        if (remainingCount > 0) {
            for (let i = 0; i < this.slots.length; i++) {
                if (this.slots[i] === null) {
                    const maxStack = this.stackSizes[itemType] || 999;
                    const amountToAdd = Math.min(remainingCount, maxStack);

                    this.slots[i] = new WildernessItem(itemType, amountToAdd);
                    remainingCount -= amountToAdd;
                    addedAny = true;

                    if (remainingCount <= 0) break;
                }
            }
        }

        this.updateUI();
        return addedAny;
    }

    /**
     * Remove an item from the inventory
     * @param itemType The type of item to remove
     * @param count The quantity to remove
     * @returns True if the item was removed, false otherwise
     */
    public removeItem(itemType: string, count: number = 1): boolean {
        // Special case for unlimited logs
        if (this.unlimitedLogs && itemType === 'log') {
            console.log(`Removed ${count} logs (unlimited mode)`);
            return true;
        }

        // Special case for unlimited resources
        if (this.unlimitedResources && ['log', 'rock', 'stick', 'string'].includes(itemType)) {
            console.log(`Removed ${count} ${itemType}(s) (unlimited resources mode)`);
            return true;
        }

        let remainingToRemove = count;
        let removedAny = false;

        // Find slots with this item type and remove from them
        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot && slot.type === itemType) {
                if (slot.quantity > remainingToRemove) {
                    slot.quantity -= remainingToRemove;
                    removedAny = true;
                    break;
                } else {
                    remainingToRemove -= slot.quantity;
                    this.slots[i] = null;
                    removedAny = true;

                    if (remainingToRemove <= 0) break;
                }
            }
        }

        this.updateUI();
        return removedAny;
    }

    /**
     * Check if the inventory has the specified items
     * @param items Array of item types to check
     * @returns True if all items are present, false otherwise
     */
    public hasItems(items: string[]): boolean {
        for (const itemType of items) {
            if (this.unlimitedLogs && itemType === 'log') continue;

            if (this.getItemCount(itemType) <= 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get the total count of a specific item type in the inventory
     * @param itemType The type of item to count
     * @returns The total quantity of the item
     */
    public getItemCount(itemType: string): number {
        // Special case for unlimited logs
        if (this.unlimitedLogs && itemType === 'log') return 999;

        // Special case for unlimited resources
        if (this.unlimitedResources && ['log', 'rock', 'stick', 'string'].includes(itemType)) return 999;

        return this.slots.reduce((total, item) => {
            if (item && item.type === itemType) {
                return total + item.quantity;
            }
            return total;
        }, 0);
    }

    /**
     * Update the inventory UI to reflect the current state
     */
    public updateUI(): void {
        if (!this.uiContainer) return;

        this.slotElements.forEach((slotElement, index) => {
            const item = this.slots[index];
            if (item) {
                slotElement.textContent = `${item.type} (${item.quantity})`;
                slotElement.style.backgroundColor = '#2d3748';
            } else {
                slotElement.textContent = '';
                slotElement.style.backgroundColor = '#1a202c';
            }
        });

        // Log resource counts to console for debugging
        console.log('Logs:', this.getItemCount('log'));
        console.log('Rocks:', this.getItemCount('rock'));
        console.log('Sticks:', this.getItemCount('stick'));
    }
}
