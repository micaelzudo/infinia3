import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WildernessInventory, WildernessItem } from './wildernessInventory';
import { WildernessBuildingSystem } from './wildernessBuildingSystem';

/**
 * Interface for craftable item configuration
 */
export interface CraftableItemConfig {
    name: string;
    modelPath: string;
    requirements: { [key: string]: number };
    scale?: number;
    model?: THREE.Group | null;
    isEquipment?: boolean;
    craftAmount?: number;
}

/**
 * Class for managing the crafting system in the Wilderness Survival game
 */
export class WildernessCraftingSystem {
    // Three.js references
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    // Game systems
    private inventory: WildernessInventory;
    private buildingSystem: WildernessBuildingSystem;

    // Crafting state
    public isCrafting: boolean = false;
    private selectedItem: CraftableItemConfig | null = null;
    public currentBlueprint: THREE.Object3D | null = null;
    private modelsLoaded: boolean = false;
    private modelLoadingPromises: Promise<any>[] = [];

    // Materials
    private blueprintMaterial: THREE.MeshStandardMaterial;

    // UI elements
    private uiContainer: HTMLElement | null = null;
    private craftingMenu: HTMLElement | null = null;
    private craftingItems: HTMLElement | null = null;

    // Craftable items configuration
    public craftableItems: CraftableItemConfig[];

    /**
     * Create a new WildernessCraftingSystem
     * @param scene The Three.js scene
     * @param camera The Three.js camera
     * @param inventory The player's inventory
     * @param buildingSystem The building system
     */
    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
        inventory: WildernessInventory,
        buildingSystem: WildernessBuildingSystem
    ) {
        this.scene = scene;
        this.camera = camera;
        this.inventory = inventory;
        this.buildingSystem = buildingSystem;

        // Create blueprint material
        this.blueprintMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
            metalness: 0.2
        });

        // Define craftable items
        this.craftableItems = [
            {
                name: 'Bonfire',
                modelPath: 'bonfire.glb', // Just the filename, path will be determined in loadModels
                requirements: { log: 4, rock: 4 },
                scale: 3.5,
                model: null
            },
            {
                name: 'Bow',
                modelPath: 'bow.glb', // Just the filename, path will be determined in loadModels
                requirements: { stick: 2, string: 1 },
                scale: 0.5,
                model: null,
                isEquipment: true
            },
            {
                name: 'Arrow',
                modelPath: 'arrow.glb', // Just the filename, path will be determined in loadModels
                requirements: { stick: 1, rock: 1 },
                scale: 0.5,
                model: null,
                isEquipment: true,
                craftAmount: 20
            }
        ];

        // Load models
        this.loadModels();

        console.log("WildernessCraftingSystem: Created new crafting system");
    }

    /**
     * Initialize the UI for the crafting system
     * @param container The HTML element to contain the crafting UI
     */
    public initUI(container: HTMLElement): void {
        this.uiContainer = container;

        // Create crafting menu
        this.craftingMenu = document.createElement('div');
        this.craftingMenu.id = 'crafting-menu';
        this.craftingMenu.style.display = 'none';
        this.uiContainer.appendChild(this.craftingMenu);

        // Create crafting menu title
        const title = document.createElement('h3');
        title.textContent = 'Crafting';
        title.style.marginBottom = '10px';
        this.craftingMenu.appendChild(title);

        // Create crafting items container
        this.craftingItems = document.createElement('div');
        this.craftingItems.id = 'crafting-items';
        this.craftingMenu.appendChild(this.craftingItems);

        // Create crafting toggle button
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Toggle Crafting Menu (C)';
        toggleButton.style.marginTop = '10px';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.backgroundColor = '#2b6cb0';
        toggleButton.style.color = 'white';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '4px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.onclick = () => this.toggleMenu();
        this.uiContainer.appendChild(toggleButton);

        // Populate crafting items
        this.setupUI();
    }

    /**
     * Create a placeholder model for items that fail to load
     * @param itemName Name of the item to create a placeholder for
     * @param scale Scale of the placeholder model
     * @returns A THREE.Group containing a placeholder model
     */
    private createPlaceholderModel(itemName: string, scale: number = 1): THREE.Group {
        console.log(`WildernessCrafting: Creating placeholder model for ${itemName}`);

        // Create a group to hold the placeholder
        const group = new THREE.Group();
        group.name = `placeholder-${itemName.toLowerCase()}`;

        // Create a simple geometry based on the item type
        let geometry: THREE.BufferGeometry;
        let color: number;

        switch(itemName.toLowerCase()) {
            case 'bonfire':
                // Cone for bonfire
                geometry = new THREE.ConeGeometry(0.5, 1, 8);
                color = 0xdd5500; // Orange-red
                break;
            case 'bow':
                // Curved cylinder for bow
                geometry = new THREE.TorusGeometry(0.5, 0.1, 8, 16, Math.PI);
                color = 0x8B4513; // Brown
                break;
            case 'arrow':
                // Thin cylinder for arrow
                geometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
                color = 0x8B4513; // Brown
                break;
            default:
                // Default cube
                geometry = new THREE.BoxGeometry(1, 1, 1);
                color = 0xaaaaaa; // Gray
        }

        // Create material and mesh
        const material = new THREE.MeshStandardMaterial({ color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Add mesh to group
        group.add(mesh);

        // Apply scale
        group.scale.set(scale, scale, scale);

        return group;
    }

    /**
     * Load 3D models for craftable items
     * @param retryCount Number of retry attempts
     */
    private loadModels(retryCount = 0): void {
        const loader = new GLTFLoader();

        // Try multiple base paths to find the models
        // This helps with different deployment environments
        const modelBasePaths = [
            '/assets/models/',           // For production/vite
            './assets/models/',          // For some dev environments
            '../assets/models/',         // Relative path option
            '../../assets/models/',      // Another relative path option
            '/public/assets/models/',    // For some build configurations
            '../../../../wildernessSurvivalThreeJS-master/assets/models/', // Reference models
            '/wildernessSurvivalThreeJS-master/assets/models/',           // Reference models (absolute)
            './wildernessSurvivalThreeJS-master/assets/models/'           // Reference models (relative)
        ];

        if (retryCount === 0) {
            console.log('WildernessCrafting: Attempting to load models from multiple possible paths');
        } else {
            this.modelLoadingPromises = [];
            console.log(`WildernessCrafting: Retrying model loading with different paths (attempt ${retryCount})`);
        }

        this.craftableItems.forEach(item => {
            const promise = new Promise<void>((resolve) => {
                // Try to load from each possible path
                const tryNextPath = (pathIndex = 0) => {
                    if (pathIndex >= modelBasePaths.length) {
                        // All paths failed, use placeholder
                        console.warn(`WildernessCrafting: Could not load model for ${item.name} from any path, using placeholder`);
                        item.model = this.createPlaceholderModel(item.name, item.scale || 1);
                        resolve();
                        return;
                    }

                    const basePath = modelBasePaths[pathIndex];
                    const modelName = item.modelPath.includes('/')
                        ? item.modelPath.split('/').pop() || item.modelPath
                        : item.modelPath;

                    const fullPath = `${basePath}${modelName}`;

                    console.log(`WildernessCrafting: Trying to load ${item.name} from ${fullPath}`);

                    loader.load(
                        fullPath,
                        (gltf) => {
                            item.model = gltf.scene;
                            item.model.traverse((node) => {
                                if (node instanceof THREE.Mesh) {
                                    node.castShadow = true;
                                    node.receiveShadow = true;
                                }
                            });

                            if (item.scale) {
                                item.model.scale.set(item.scale, item.scale, item.scale);
                            }

                            console.log(`WildernessCrafting: Successfully loaded model for ${item.name} from ${fullPath}`);
                            resolve();
                        },
                        undefined,
                        () => {
                            // This path failed, try the next one
                            console.log(`WildernessCrafting: Failed to load ${item.name} from ${fullPath}, trying next path`);
                            tryNextPath(pathIndex + 1);
                        }
                    );
                };

                // Start trying paths
                tryNextPath();
            });

            this.modelLoadingPromises.push(promise);
        });

        Promise.all(this.modelLoadingPromises)
            .then(() => {
                this.modelsLoaded = true;

                // Log which models were loaded successfully and which are using placeholders
                const loadedModels = this.craftableItems.filter(item => item.model && !item.model.name.startsWith('placeholder-'));
                const placeholderModels = this.craftableItems.filter(item => item.model && item.model.name.startsWith('placeholder-'));

                console.log(`WildernessCrafting: Models loaded successfully: ${loadedModels.map(i => i.name).join(', ') || 'None'}`);
                if (placeholderModels.length > 0) {
                    console.log(`WildernessCrafting: Using placeholders for: ${placeholderModels.map(i => i.name).join(', ')}`);
                }

                console.log('WildernessCrafting: All crafting models loaded successfully (with placeholders if needed)');
                this.updateItemAvailability();
            })
            .catch(error => {
                console.error('WildernessCrafting: Unexpected error in model loading:', error);

                // Create placeholders for any items that don't have models yet
                this.craftableItems.forEach(item => {
                    if (!item.model) {
                        item.model = this.createPlaceholderModel(item.name, item.scale || 1);
                    }
                });

                // Mark as loaded anyway so the game can continue
                this.modelsLoaded = true;
                console.log('WildernessCrafting: Using placeholder models due to loading errors');
                this.updateItemAvailability();
            });
    }

    /**
     * Set up the crafting UI elements
     */
    private setupUI(): void {
        if (!this.craftingItems) return;

        this.craftingItems.innerHTML = '';

        this.craftableItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'crafting-item';
            itemElement.dataset.name = item.name;
            itemElement.style.padding = '10px';
            itemElement.style.border = '1px solid #4a5568';
            itemElement.style.marginBottom = '8px';
            itemElement.style.borderRadius = '4px';
            itemElement.style.cursor = 'pointer';
            itemElement.style.transition = 'background-color 0.2s';

            // Hover effects
            itemElement.onmouseover = () => itemElement.style.backgroundColor = '#2d3748';
            itemElement.onmouseout = () => itemElement.style.backgroundColor = 'transparent';

            // Item name
            const nameElement = document.createElement('div');
            nameElement.className = 'crafting-item-name';
            nameElement.textContent = item.name;
            nameElement.style.fontWeight = 'bold';
            nameElement.style.marginBottom = '5px';

            // Item requirements
            const requirementsElement = document.createElement('div');
            requirementsElement.className = 'crafting-item-requirements';
            requirementsElement.style.fontSize = '0.9em';
            requirementsElement.style.color = '#a0aec0';

            const reqText = Object.entries(item.requirements)
                .map(([resource, amount]) => `${resource}: ${amount}`)
                .join(', ');

            requirementsElement.textContent = reqText ? `Requires: ${reqText}` : 'No resources required';

            // Add elements to item
            itemElement.appendChild(nameElement);
            itemElement.appendChild(requirementsElement);

            // Add click handler
            itemElement.addEventListener('click', () => {
                this.selectItem(item.name);
            });

            // Add to crafting items container
            this.craftingItems.appendChild(itemElement);
        });

        this.updateItemAvailability();
    }

    /**
     * Toggle the crafting menu visibility
     */
    public toggleMenu(): void {
        if (!this.craftingMenu) return;

        const isVisible = this.craftingMenu.style.display !== 'none';

        if (isVisible) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    /**
     * Open the crafting menu
     */
    public openMenu(): void {
        if (!this.craftingMenu) return;

        // Close building menu if open
        if (this.buildingSystem.isBuildingMenuOpen()) {
            this.buildingSystem.hideBuildingMenu();
        }

        // Cancel crafting if in progress
        if (this.isCrafting) {
            this.cancelPlacement();
        }

        this.craftingMenu.style.display = 'block';
        this.updateItemAvailability();

        console.log('WildernessCrafting: Opened crafting menu');
    }

    /**
     * Close the crafting menu
     * @param keepSelection Whether to keep the current selection
     */
    public closeMenu(keepSelection = false): void {
        if (!this.craftingMenu) return;

        this.craftingMenu.style.display = 'none';

        if (!keepSelection) {
            this.selectedItem = null;

            // Remove selection from UI
            if (this.craftingItems) {
                const selectedElements = this.craftingItems.querySelectorAll('.crafting-item.selected');
                selectedElements.forEach(el => {
                    el.classList.remove('selected');
                    (el as HTMLElement).style.backgroundColor = 'transparent';
                });
            }
        }

        console.log('WildernessCrafting: Closed crafting menu');
    }
    /**
     * Update the availability of craftable items in the UI
     */
    public updateItemAvailability(): void {
        if (!this.craftingItems) return;

        const items = this.craftingItems.querySelectorAll('.crafting-item');
        items.forEach(itemElement => {
            const htmlElement = itemElement as HTMLElement;
            const itemName = htmlElement.dataset.name;
            if (!itemName) return;

            const item = this.craftableItems.find(i => i.name === itemName);
            if (!item) return;

            const requirementsElement = htmlElement.querySelector('.crafting-item-requirements') as HTMLElement;

            if (!this.modelsLoaded || !item.model) {
                htmlElement.style.opacity = '0.7';
                htmlElement.style.cursor = 'wait';
                if (requirementsElement) requirementsElement.textContent = 'Loading model...';
                return;
            }

            if (requirementsElement && requirementsElement.textContent === 'Loading model...') {
                const reqText = Object.entries(item.requirements)
                    .map(([resource, amount]) => `${resource}: ${amount}`)
                    .join(', ');
                requirementsElement.textContent = reqText ? `Requires: ${reqText}` : 'No resources required';
            }

            if (this.canCraft(item)) {
                htmlElement.style.opacity = '1';
                htmlElement.style.cursor = 'pointer';
                htmlElement.classList.remove('disabled');
            } else {
                htmlElement.style.opacity = '0.5';
                htmlElement.style.cursor = 'not-allowed';
                htmlElement.classList.add('disabled');
            }
        });
    }

    /**
     * Check if an item can be crafted
     * @param item The item to check
     * @returns True if the item can be crafted, false otherwise
     */
    private canCraft(item: CraftableItemConfig): boolean {
        if (!this.modelsLoaded || !item.model) {
            return false;
        }

        for (const [resource, amount] of Object.entries(item.requirements)) {
            if (this.inventory.getItemCount(resource) < amount) {
                return false;
            }
        }

        return true;
    }

    /**
     * Select an item to craft
     * @param itemName The name of the item to select
     */
    private selectItem(itemName: string): void {
        console.log(`WildernessCrafting: Attempting to select item: ${itemName}`);

        if (!this.modelsLoaded) {
            console.warn(`WildernessCrafting: Models not yet loaded. Cannot select ${itemName}.`);
            return;
        }

        const item = this.craftableItems.find(i => i.name === itemName);
        if (!item) {
            console.error(`WildernessCrafting: Item ${itemName} not found.`);
            return;
        }

        if (!item.model) {
            console.error(`WildernessCrafting: Model for ${itemName} is not loaded.`);
            return;
        }

        if (!this.canCraft(item)) {
            console.log(`WildernessCrafting: Cannot craft ${itemName} - missing resources.`);
            return;
        }

        // Update UI selection state
        if (this.craftingItems) {
            const itemElements = this.craftingItems.querySelectorAll('.crafting-item');
            itemElements.forEach(el => {
                const htmlEl = el as HTMLElement;
                if (htmlEl.dataset.name === itemName) {
                    htmlEl.style.backgroundColor = '#4a5568';
                    htmlEl.classList.add('selected');
                } else {
                    htmlEl.style.backgroundColor = 'transparent';
                    htmlEl.classList.remove('selected');
                }
            });
        }

        this.selectedItem = item;
        console.log(`WildernessCrafting: Selected item:`, this.selectedItem);

        if (item.isEquipment) {
            this.craftEquipmentItem(item);
        } else {
            // For placeable items, start placement mode
            console.log(`WildernessCrafting: Item ${item.name} is placeable. Starting placement mode.`);
            this.closeMenu(true);
            this.startPlacement();
        }
    }

    /**
     * Craft an equipment item
     * @param item The item to craft
     */
    private craftEquipmentItem(item: CraftableItemConfig): void {
        console.log(`WildernessCrafting: Crafting equipment item: ${item.name}`);

        if (!this.canCraft(item)) {
            console.warn(`WildernessCrafting: Cannot craft ${item.name} - missing resources (checked again).`);
            return;
        }

        // Consume resources
        for (const [resource, amount] of Object.entries(item.requirements)) {
            this.inventory.removeItem(resource, amount);
        }

        const itemType = item.name.toLowerCase();
        const quantityToCraft = item.craftAmount || 1;

        // Add to inventory
        this.inventory.addItem(new WildernessItem(itemType, quantityToCraft));
        console.log(`WildernessCrafting: Added ${quantityToCraft} ${item.name}(s) to inventory.`);

        // Reset state
        this.selectedItem = null;
        this.isCrafting = false;
        this.updateItemAvailability();

        // De-select in UI
        if (this.craftingItems) {
            const itemElements = this.craftingItems.querySelectorAll('.crafting-item.selected');
            itemElements.forEach(el => {
                (el as HTMLElement).style.backgroundColor = 'transparent';
                el.classList.remove('selected');
            });
        }

        // Handle equipment (e.g., equipping a bow)
        if (itemType === 'bow' && typeof (window as any).g_equipWeapon === 'function') {
            console.log("WildernessCrafting: Requesting bow equip.");
            (window as any).g_equipWeapon('bow');
        }
    }

    /**
     * Start placement mode for a craftable item
     */
    private startPlacement(): void {
        if (!this.selectedItem || !this.selectedItem.model) {
            console.error("WildernessCrafting: Cannot start placement - no selected item or model.");
            return;
        }

        this.isCrafting = true;

        // Create blueprint
        this.currentBlueprint = this.selectedItem.model.clone();

        // Apply scale if specified
        if (this.selectedItem.scale) {
            this.currentBlueprint.scale.set(
                this.selectedItem.scale,
                this.selectedItem.scale,
                this.selectedItem.scale
            );
        }

        // Apply blueprint material
        this.currentBlueprint.traverse(node => {
            if (node instanceof THREE.Mesh) {
                node.material = this.blueprintMaterial.clone();
            }
        });

        // Add to scene
        this.scene.add(this.currentBlueprint);

        // Show placement prompt
        this.showPlacementPrompt();

        console.log(`WildernessCrafting: Started placement mode for ${this.selectedItem.name}`);
    }

    /**
     * Update the position of the blueprint based on raycaster
     * @param raycaster The raycaster to use for positioning
     */
    public updateBlueprintPosition(raycaster: THREE.Raycaster): void {
        if (!this.isCrafting || !this.currentBlueprint) return;

        // Cast ray to find intersection point
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        // Filter out the blueprint itself and its children
        const filteredIntersects = intersects.filter(intersect => {
            let obj: THREE.Object3D | null = intersect.object;
            while (obj) {
                if (obj === this.currentBlueprint) return false;
                obj = obj.parent;
            }
            return true;
        });

        if (filteredIntersects.length > 0) {
            // Position at intersection point
            const intersect = filteredIntersects[0];
            this.currentBlueprint.position.copy(intersect.point);

            // Rotate to face the camera (Y-axis only)
            const direction = new THREE.Vector3().subVectors(
                this.camera.position,
                this.currentBlueprint.position
            );
            direction.y = 0; // Keep upright

            if (direction.length() > 0) {
                this.currentBlueprint.lookAt(
                    this.currentBlueprint.position.x + direction.x,
                    this.currentBlueprint.position.y,
                    this.currentBlueprint.position.z + direction.z
                );
            }
        }
    }

    /**
     * Place the currently selected item
     */
    public place(): void {
        if (!this.isCrafting || !this.currentBlueprint || !this.selectedItem) {
            console.error("WildernessCrafting: Cannot place - not in crafting mode or no blueprint.");
            return;
        }

        // Check if we can still craft the item
        if (!this.canCraft(this.selectedItem)) {
            console.warn(`WildernessCrafting: Cannot craft ${this.selectedItem.name} - missing resources.`);
            this.cancelPlacement();
            return;
        }

        console.log(`WildernessCrafting: Placing ${this.selectedItem.name} at`, this.currentBlueprint.position);

        // Consume resources
        for (const [resource, amount] of Object.entries(this.selectedItem.requirements)) {
            this.inventory.removeItem(resource, amount);
        }

        // Create the actual item
        const placedObject = this.selectedItem.model!.clone();
        placedObject.position.copy(this.currentBlueprint.position);
        placedObject.rotation.copy(this.currentBlueprint.rotation);

        if (this.selectedItem.scale) {
            placedObject.scale.set(
                this.selectedItem.scale,
                this.selectedItem.scale,
                this.selectedItem.scale
            );
        }

        // Add metadata
        placedObject.userData.type = this.selectedItem.name.toLowerCase();

        // Special handling for bonfire
        if (placedObject.userData.type === 'bonfire') {
            placedObject.userData.isLit = false;
            placedObject.userData.fireParticles = null;
        }

        // Add to scene
        this.scene.add(placedObject);

        // Clean up
        this.cancelPlacement();
        this.updateItemAvailability();

        console.log(`WildernessCrafting: Placed ${this.selectedItem.name}`);
    }

    /**
     * Cancel the current placement
     */
    public cancelPlacement(): void {
        console.log('WildernessCrafting: Cancelling placement');

        if (this.currentBlueprint) {
            this.scene.remove(this.currentBlueprint);
        }

        this.currentBlueprint = null;
        this.isCrafting = false;
        this.selectedItem = null;

        // Hide placement prompt
        this.hidePlacementPrompt();

        // De-select in UI
        if (this.craftingItems) {
            const itemElements = this.craftingItems.querySelectorAll('.crafting-item.selected');
            itemElements.forEach(el => {
                (el as HTMLElement).style.backgroundColor = 'transparent';
                el.classList.remove('selected');
            });
        }
    }

    /**
     * Show the placement prompt
     */
    private showPlacementPrompt(): void {
        const promptElement = document.getElementById('interaction-prompt');
        if (promptElement) {
            promptElement.textContent = 'Press E to place, Escape to cancel';
            promptElement.style.display = 'block';
        }
    }

    /**
     * Hide the placement prompt
     */
    private hidePlacementPrompt(): void {
        const promptElement = document.getElementById('interaction-prompt');
        if (promptElement) {
            promptElement.style.display = 'none';
        }
    }

    /**
     * Clean up resources when the system is no longer needed
     */
    public dispose(): void {
        console.log("Disposing WildernessCraftingSystem");

        this.cancelPlacement();

        if (this.craftingItems) {
            this.craftingItems.innerHTML = '';
        }

        this.modelLoadingPromises = [];

        this.craftableItems.forEach(item => {
            if (item.model) {
                item.model = null;
            }
        });

        this.modelsLoaded = false;
    }
}