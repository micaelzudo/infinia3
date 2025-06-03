\
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WildernessInventory, WildernessItem } from './wildernessInventory'; // Adapted import

// Forward declaration for BuildingSystem to avoid circular dependencies if it's also adapted
// We'll make its usage optional or pass a stub for now.
interface IBuildingSystem {
    isBuilding: boolean;
    cancelBuilding: () => void;
    // Add other methods/properties if CraftingSystem directly calls them
}

export class WildernessCraftingSystem {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // Match isolatedTerrainViewer's camera type
    private inventory: WildernessInventory;
    private buildingSystem: IBuildingSystem | null; // Make it optional or use an interface

    public isCrafting: boolean = false;
    private selectedItem: any | null = null; // Consider a more specific type later
    public currentBlueprint: THREE.Object3D | null = null;
    private modelsLoaded: boolean = false;
    private modelLoadingPromises: Promise<any>[] = [];

    private blueprintMaterial: THREE.MeshStandardMaterial;

    public craftableItems: any[]; // Define a proper interface for craftable items later

    private uiContainer: HTMLElement | null = null; // To hold the crafting UI elements

    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
        inventory: WildernessInventory,
        buildingSystem: IBuildingSystem | null // Accept null or a compatible system
    ) {
        this.scene = scene;
        this.camera = camera;
        this.inventory = inventory;
        this.buildingSystem = buildingSystem;

        this.blueprintMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
            metalness: 0.2
        });

        this.craftableItems = [
            {
                name: 'Bonfire',
                modelPath: 'assets/models/bonfire.glb', // Path relative to the original game's assets
                requirements: { log: 4, rock: 4 },
                scale: 3.5,
                model: null
            },
            {
                name: 'Bow',
                modelPath: 'assets/models/bow.glb',
                requirements: { string: 5, stick: 1 },
                scale: 0.5,
                model: null,
                isEquipment: true
            },
            {
                name: 'Arrow',
                modelPath: 'assets/models/arrow.glb',
                requirements: {}, // No requirements for now
                scale: 0.5,
                model: null,
                isEquipment: true,
                craftAmount: 20 // How many to craft at once
            }
        ];

        this.loadModels();
        // UI setup will be called separately with a container
    }

    // Method to set the UI container and build the UI
    public initUI(container: HTMLElement) {
        this.uiContainer = container;
        this.uiContainer.innerHTML = ''; // Clear previous content

        this.craftableItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'wilderness-crafting-item'; // Use a distinct class name
            itemElement.dataset.name = item.name;
            itemElement.style.padding = '10px';
            itemElement.style.border = '1px solid #444';
            itemElement.style.marginBottom = '8px';
            itemElement.style.borderRadius = '4px';
            itemElement.style.cursor = 'pointer';
            itemElement.style.transition = 'background-color 0.2s';

            itemElement.onmouseover = () => itemElement.style.backgroundColor = '#333';
            itemElement.onmouseout = () => itemElement.style.backgroundColor = 'transparent';


            const nameElement = document.createElement('div');
            nameElement.className = 'wilderness-crafting-item-name';
            nameElement.textContent = item.name;
            nameElement.style.fontWeight = 'bold';
            nameElement.style.marginBottom = '5px';

            const requirementsElement = document.createElement('div');
            requirementsElement.className = 'wilderness-crafting-item-requirements';
            requirementsElement.style.fontSize = '0.9em';
            requirementsElement.style.color = '#ccc';

            const reqText = Object.entries(item.requirements)
                .map(([resource, amount]) => `${resource}: ${amount}`)
                .join(', ');
            requirementsElement.textContent = reqText ? `Requires: ${reqText}` : 'No resources required';

            itemElement.appendChild(nameElement);
            itemElement.appendChild(requirementsElement);

            itemElement.addEventListener('click', () => {
                this.selectItem(item.name);
            });

            this.uiContainer.appendChild(itemElement);
        });
        this.updateItemAvailability(); // Initial availability update
    }


    private loadModels(retryCount = 0) {
        const loader = new GLTFLoader();
        // IMPORTANT: Paths are relative to where the HTML file serving the game is.
        // If isolatedTerrainViewer's HTML is at root, and assets are in wildernessSurvivalThreeJS-master/assets,
        // the path needs to reflect that, e.g., './wildernessSurvivalThreeJS-master/assets/models/bonfire.glb'
        // For now, assuming paths might need adjustment later.
        const modelBasePath = './NEWBEGINNINGS/wildernessSurvivalThreeJS-master/'; // Adjust if assets are moved/copied

        if (retryCount > 0) {
            this.modelLoadingPromises = [];
            console.log(`WildernessCrafting: Retrying model loading (attempt ${retryCount})`);
        }

        this.craftableItems.forEach(item => {
            const promise = new Promise((resolve, reject) => {
                // Prepend base path if item.modelPath is relative
                const fullModelPath = item.modelPath.startsWith('assets/') ? `${modelBasePath}${item.modelPath}` : item.modelPath;
                console.log(`WildernessCrafting: Loading model ${item.name} from ${fullModelPath}`);

                loader.load(fullModelPath,
                    (gltf) => {
                        item.model = gltf.scene;
                        item.model.traverse(function(node) {
                            if (node instanceof THREE.Mesh) { // Type guard
                                node.castShadow = true;
                                node.receiveShadow = true;
                            }
                        });
                        if (item.scale) {
                            item.model.scale.set(item.scale, item.scale, item.scale);
                        }
                        console.log(`WildernessCrafting: Loaded model for ${item.name}`);
                        resolve(item);
                    },
                    undefined, // onProgress
                    (error) => {
                        console.error(`WildernessCrafting: Error loading model for ${item.name} from ${fullModelPath}:`, error);
                        reject(error);
                    }
                );
            });
            this.modelLoadingPromises.push(promise);
        });

        Promise.all(this.modelLoadingPromises)
            .then(() => {
                this.modelsLoaded = true;
                console.log('WildernessCrafting: All crafting models loaded successfully');
                this.updateItemAvailability();
            })
            .catch(error => {
                console.error('WildernessCrafting: Error loading crafting models:', error);
                if (retryCount < 3) {
                    setTimeout(() => this.loadModels(retryCount + 1), 2000);
                } else {
                    console.error('WildernessCrafting: Max retries exceeded for model loading.');
                    // Optionally, inform the user via the UI if a container is available
                     if (this.uiContainer) {
                        const errorMsg = document.createElement('p');
                        errorMsg.textContent = 'Error loading some crafting models. Some items may not be craftable.';
                        errorMsg.style.color = 'red';
                        this.uiContainer.prepend(errorMsg);
                    }
                }
            });
    }

    private canCraft(item: any): boolean {
        if (!this.modelsLoaded || !item.model) { // Also check if specific item model loaded
            return false;
        }
        for (const [resource, amount] of Object.entries(item.requirements)) {
            if (this.inventory.getItemCount(resource as string) < (amount as number)) {
                return false;
            }
        }
        return true;
    }

    public updateItemAvailability() {
        if (!this.uiContainer) return;

        const items = this.uiContainer.querySelectorAll('.wilderness-crafting-item');
        items.forEach(itemElement => {
            const htmlElement = itemElement as HTMLElement; // Type assertion
            const itemName = htmlElement.dataset.name;
            if (!itemName) return;

            const item = this.craftableItems.find(i => i.name === itemName);
            if (!item) return;

            const requirementsElement = htmlElement.querySelector('.wilderness-crafting-item-requirements') as HTMLElement;

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

    private selectItem(itemName: string) {
        console.log(`WildernessCrafting: Attempting to select item: ${itemName}`);
        if (!this.modelsLoaded) {
            console.warn(`WildernessCrafting: Models not yet loaded. Cannot select ${itemName}.`);
            // Optionally provide user feedback: alert('Please wait for models to finish loading.');
            return;
        }

        const item = this.craftableItems.find(i => i.name === itemName);
        if (!item) {
            console.error(`WildernessCrafting: Item ${itemName} not found.`);
            return;
        }

        if (!item.model) {
            console.error(`WildernessCrafting: Model for ${itemName} is not loaded.`);
            // Optionally provide user feedback
            return;
        }

        if (!this.canCraft(item)) {
            console.log(`WildernessCrafting: Cannot craft ${itemName} - missing resources.`);
            // Optionally provide user feedback
            return;
        }

        // Update UI selection state
        if (this.uiContainer) {
            const itemElements = this.uiContainer.querySelectorAll('.wilderness-crafting-item');
            itemElements.forEach(el => {
                const htmlEl = el as HTMLElement;
                if (htmlEl.dataset.name === itemName) {
                    htmlEl.style.backgroundColor = '#4a5568'; // Selected style
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
            // For placeable items, defer to isolatedTerrainViewer for placement logic
            console.log(`WildernessCrafting: Item ${item.name} is placeable. Starting placement mode.`);
            this.isCrafting = true; // Indicate crafting mode is active for a placeable item
            // The isolatedTerrainViewer will now need to handle the blueprint creation and placement
            // based on this.selectedItem and this.isCrafting.
            // It might call a method like getSelectedCraftableItemBlueprint()
            if (typeof (window as any).notifyPlacementModeStart === 'function') {
                (window as any).notifyPlacementModeStart(this.selectedItem);
            }
        }
    }
    
    private craftEquipmentItem(item: any) {
        console.log(`WildernessCrafting: Crafting equipment item: ${item.name}`);
        if (!this.canCraft(item)) {
            console.warn(`WildernessCrafting: Cannot craft ${item.name} - missing resources (checked again).`);
            return;
        }

        for (const [resource, amount] of Object.entries(item.requirements)) {
            this.inventory.removeItem(resource as string, amount as number);
        }

        const itemType = item.name.toLowerCase();
        const quantityToCraft = item.craftAmount || 1; // Use craftAmount if defined, else 1

        this.inventory.addItem(new WildernessItem(itemType, quantityToCraft)); // Use adapted Item class
        console.log(`WildernessCrafting: Added ${quantityToCraft} ${item.name}(s) to inventory.`);

        this.selectedItem = null; // Clear selection
        this.isCrafting = false; 
        this.updateItemAvailability(); // Update UI

        // De-select in UI
        if (this.uiContainer) {
            const itemElements = this.uiContainer.querySelectorAll('.wilderness-crafting-item.selected');
            itemElements.forEach(el => {
                 (el as HTMLElement).style.backgroundColor = 'transparent';
                 el.classList.remove('selected');
            });
        }
        
        // TODO: Handle equipping via a callback or event system rather than global window.equipWeapon
        if (itemType === 'bow' && typeof (window as any).g_equipWeapon === 'function') {
            console.log("WildernessCrafting: Requesting bow equip.");
            (window as any).g_equipWeapon('bow');
        }
    }

    // This method will be called by isolatedTerrainViewer when 'E' is pressed in placement mode
    public placeSelectedItem(position: THREE.Vector3, rotation: THREE.Euler): THREE.Object3D | null {
        if (!this.isCrafting || !this.selectedItem || this.selectedItem.isEquipment) {
            console.error("WildernessCrafting: Not in correct state to place item or item is equipment.");
            this.cancelPlacement(); // Ensure state is reset
            return null;
        }
        if (!this.selectedItem.model) {
             console.error(`WildernessCrafting: Model for ${this.selectedItem.name} not loaded.`);
             this.cancelPlacement();
             return null;
        }

        console.log(`WildernessCrafting: Placing ${this.selectedItem.name} at`, position);

        // Consume resources
        for (const [resource, amount] of Object.entries(this.selectedItem.requirements)) {
            this.inventory.removeItem(resource as string, amount as number);
        }

        const placedObject = this.selectedItem.model.clone();
        placedObject.position.copy(position);
        placedObject.rotation.copy(rotation); // Apply rotation determined by viewer

        if (this.selectedItem.scale) {
            placedObject.scale.set(this.selectedItem.scale, this.selectedItem.scale, this.selectedItem.scale);
        }
        placedObject.userData.type = this.selectedItem.name.toLowerCase();

        if (placedObject.userData.type === 'bonfire') {
            placedObject.userData.isLit = false;
            placedObject.userData.fireParticles = null;
            // TODO: Need a way to add this to a global/shared interactable objects list
            // For now, isolatedTerrainViewer will need to manage this if it adds it to its own scene.
            console.log("WildernessCrafting: Bonfire instance created. Viewer should handle adding to scene and interactables.");
        }
        
        // Important: This system now returns the object.
        // The isolatedTerrainViewer is responsible for adding it to its scene.
        
        const placedItemName = this.selectedItem.name; // Store before resetting

        this.cancelPlacement(); // Resets isCrafting, selectedItem, currentBlueprint
        this.updateItemAvailability();
        
        console.log(`WildernessCrafting: ${placedItemName} data prepared for placement.`);
        return placedObject;
    }

    public cancelPlacement() {
        console.log('WildernessCrafting: Cancelling placement/crafting state.');
        if (this.currentBlueprint && this.currentBlueprint.parent) {
            this.currentBlueprint.parent.remove(this.currentBlueprint);
            // TODO: Dispose blueprint geometry/material if necessary
        }
        this.currentBlueprint = null;
        this.isCrafting = false;
        this.selectedItem = null;

        if (this.uiContainer) {
             const itemElements = this.uiContainer.querySelectorAll('.wilderness-crafting-item.selected');
            itemElements.forEach(el => {
                 (el as HTMLElement).style.backgroundColor = 'transparent';
                 el.classList.remove('selected');
            });
        }
         // Notify viewer that placement mode has ended
        if (typeof (window as any).notifyPlacementModeEnd === 'function') {
            (window as any).notifyPlacementModeEnd();
        }
        this.updateItemAvailability();
    }
    
    // Called by isolatedTerrainViewer to get blueprint for visualization
    public getSelectedBlueprintModel(): THREE.Object3D | null {
        if (this.isCrafting && this.selectedItem && !this.selectedItem.isEquipment && this.selectedItem.model) {
            const blueprint = this.selectedItem.model.clone();
            if (this.selectedItem.scale) {
                blueprint.scale.set(this.selectedItem.scale, this.selectedItem.scale, this.selectedItem.scale);
            }
            blueprint.traverse(node => {
                if (node instanceof THREE.Mesh) {
                    node.material = this.blueprintMaterial.clone();
                }
            });
            this.currentBlueprint = blueprint; // Keep a reference for potential internal use
            return blueprint;
        }
        return null;
    }

    // Cleanup method
    public dispose() {
        console.log("Disposing WildernessCraftingSystem");
        this.cancelPlacement();
        if (this.uiContainer) {
            this.uiContainer.innerHTML = '';
        }
        this.modelLoadingPromises = [];
        this.craftableItems.forEach(item => {
            if (item.model) {
                // Basic disposal for models; more thorough disposal might be needed
                // depending on how THREE.js objects are managed (geometries, materials)
                item.model = null; 
            }
        });
        this.modelsLoaded = false;
    }
}

// Example of how it might be used by isolatedTerrainViewer later:
// let wildernessCraftingSystem = new WildernessCraftingSystem(viewerScene, viewerCamera, wildernessInventoryInstance, null);
// const wildernessPanelContent = document.getElementById('wilderness-systems-content');
// if (wildernessPanelContent) {
// wildernessCraftingSystem.initUI(wildernessPanelContent);
// }
