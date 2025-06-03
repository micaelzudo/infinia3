# Wilderness Game - Implementation Cheatsheet (@WILDERness)

This document provides an in-depth overview of the core systems in the Wilderness game, focusing on their implementation details, key functions, and logic.

## Table of Contents
1.  [Inventory System (`inventory.js`)](#inventory-system-inventoryjs)
2.  [Crafting System (`craftingSystem.js`)](#crafting-system-craftingsystemjs)
3.  [Building System (`buildingSystem.js`)](#building-system-buildingsystemjs)

---

## Integration Guide

This section provides guidance on integrating the Wilderness game systems into a larger Three.js project, including tips for TypeScript conversion, game loop integration, UI adaptation, and dependency management.

### TypeScript Conversion

While the provided systems are in JavaScript, converting them to TypeScript can offer benefits like static typing and improved code maintainability. Here's a general approach:

1.  **Setup TypeScript:** Ensure your project has TypeScript configured (`tsconfig.json`).
2.  **Rename Files:** Change `.js` file extensions to `.ts`.
3.  **Add Types:**
    *   Define interfaces or types for complex objects (e.g., `Item`, `CraftableItemConfig`, `BuildingPieceData`).
    *   Add type annotations to function parameters, return values, and class properties.
    *   For Three.js objects (`Scene`, `Camera`, `Mesh`, `Material`, `Raycaster`, `GLTFLoader`, `Group`, `Vector3`, `Quaternion`, `BoxGeometry`), install and use `@types/three`.
4.  **Address Errors:** The TypeScript compiler (`tsc`) will highlight areas needing type adjustments or fixes. Pay attention to:
    *   `any` types: Try to replace them with more specific types.
    *   `null` or `undefined` possibilities: Handle them explicitly.
    *   DOM element interactions: Use appropriate DOM types (e.g., `HTMLElement`, `HTMLDivElement`).

**Example (Inventory Item):**

```typescript
// inventory.ts
import * as THREE from 'three'; // If using Three.js types elsewhere

export interface ItemData {
  type: string;
  quantity: number;
}

export class Item implements ItemData {
  type: string;
  quantity: number;

  constructor(type: string, quantity: number = 1) {
    this.type = type;
    this.quantity = quantity;
  }
}

export interface Slot {
  item: Item | null;
  // ... other slot properties if any
}

export class Inventory {
  public slots: Array<Item | null>;
  public slotElements: HTMLElement[]; // Or more specific type like HTMLDivElement[]
  public unlimitedLogs: boolean;
  public stackSizes: { [key: string]: number };

  constructor() {
    this.slots = new Array(5).fill(null);
    this.slotElements = Array.from(document.querySelectorAll('.inventory-slot')) as HTMLElement[];
    this.unlimitedLogs = false;
    this.stackSizes = { log: 999, axe: 1 };
    // ... rest of the constructor
  }

  addItem(item: ItemData | string, count: number = 1): boolean {
    // ... implementation with type safety ...
    this.updateUI();
    return true; // or false
  }

  // ... other methods with type annotations ...
  updateUI(): void {
    this.slotElements.forEach((slotElement, index) => {
      const item = this.slots[index];
      if (item) {
        slotElement.textContent = `${item.type} (${item.quantity})`;
      } else {
        slotElement.textContent = '';
      }
    });
    console.log('Logs:', this.getItemCount('log'));
    console.log('Rocks:', this.getItemCount('rock'));
  }

  getItemCount(itemType: string): number {
    if (this.unlimitedLogs && itemType === 'log') return 999;
    return this.slots.reduce((total, item) => {
      if (item && item.type === itemType) {
        return total + item.quantity;
      }
      return total;
    }, 0);
  }
}
```

**Example (Crafting System Configuration):**

```typescript
// craftingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory, ItemData } from './inventory'; // Assuming inventory.ts is in the same directory

export interface CraftingRecipeIngredient {
  type: string;
  quantity: number;
}

export interface CraftableItemConfig {
  name: string;
  type: string; // Unique identifier for the item type
  modelPath: string;
  scale?: THREE.Vector3; // Optional scale for the blueprint/placed model
  offset?: THREE.Vector3; // Optional offset for the blueprint/placed model
  ingredients: CraftingRecipeIngredient[];
  category: 'tools' | 'structures' | 'resources'; // Example categories
  description: string;
  // Callback for when the item is successfully crafted and placed
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class CraftingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public craftableItems: CraftableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isCrafting: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    // Define craftable items with type safety
    this.craftableItems = [
      {
        name: 'Axe',
        type: 'axe',
        modelPath: 'models/axe.glb',
        scale: new THREE.Vector3(0.5, 0.5, 0.5),
        ingredients: [
          { type: 'log', quantity: 2 },
          { type: 'rock', quantity: 1 },
        ],
        category: 'tools',
        description: 'A basic axe for chopping wood.',
        onPlace: (position, rotation, model) => {
          console.log(`Axe placed at ${position.toArray()} with rotation ${rotation.toArray()}`);
          // Additional logic: add to player's tools, etc.
        }
      },
      {
        name: 'Bonfire',
        type: 'bonfire',
        modelPath: 'models/bonfire.glb',
        ingredients: [
          { type: 'log', quantity: 5 },
          { type: 'rock', quantity: 3 },
        ],
        category: 'structures',
        description: 'Provides light and warmth.',
        onPlace: (position, rotation, model) => {
            // Example: Start fire particle effect
            // model.userData.isLit = true;
        }
      },
      // ... more craftable items
    ];

    this.setupUI();
  }

  // Method to start crafting a specific item type
  public startCrafting(itemType: string): void {
    const itemConfig = this.craftableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Crafting item type ${itemType} not found.`);
      return;
    }

    // Check if player has ingredients
    const hasAllIngredients = itemConfig.ingredients.every(ingredient => {
      return this.inventory.getItemCount(ingredient.type) >= ingredient.quantity;
    });

    if (!hasAllIngredients) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough ingredients!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isCrafting = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      // Apply a semi-transparent material to the blueprint
      this.currentBlueprint.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const meshChild = child as THREE.Mesh;
          const originalMaterial = meshChild.material as THREE.Material | THREE.Material[];
          if (Array.isArray(originalMaterial)) {
            meshChild.material = originalMaterial.map(mat => this.createBlueprintMaterial(mat));
          } else {
            meshChild.material = this.createBlueprintMaterial(originalMaterial);
          }
        }
      });
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, Esc to cancel.`;
    });
  }

  private createBlueprintMaterial(originalMaterial: THREE.Material): THREE.Material {
    const blueprintMaterial = (originalMaterial as THREE.MeshStandardMaterial).clone(); // Clone to avoid modifying shared materials
    blueprintMaterial.transparent = true;
    blueprintMaterial.opacity = 0.5;
    // You might want to change color as well, e.g., to a ghostly blue
    // if (blueprintMaterial instanceof THREE.MeshStandardMaterial) {
    //   blueprintMaterial.color.set(0x007bff);
    //   blueprintMaterial.emissive.set(0x003366);
    // }
    return blueprintMaterial;
  }

  public updateBlueprintPosition(raycaster: THREE.Raycaster): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const intersects = raycaster.intersectObjects(this.scene.children, true); // Check against all scene objects
    // A more robust solution would be to intersect with a specific ground plane or designated buildable surfaces.
    const groundIntersect = intersects.find(intersect => {
        // Example: only place on objects named 'ground' or with specific userData
        // return intersect.object.name === 'groundPlane';
        return intersect.object.isMesh && intersect.object.name !== this.currentBlueprint?.uuid; // Avoid self-intersection
    });

    if (groundIntersect) {
      this.currentBlueprint.position.copy(groundIntersect.point);
      // Optional: Align to grid or snap to surface normal
      // this.currentBlueprint.quaternion.setFromUnitVectors(THREE.Object3D.DefaultUp, groundIntersect.face.normal);
    } else {
        // If no intersection, keep blueprint at a fixed distance in front of camera
        const distance = 10; // Adjust as needed
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
    }
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const itemConfig = this.craftableItems.find(item => 
        this.currentBlueprint && 
        (this.currentBlueprint.userData.configType === item.type || 
         (this.currentBlueprint.name.toLowerCase().includes(item.type))) // Fallback if configType not set
    );
    // A better way to link blueprint to config is to store itemType in blueprint.userData when loaded.
    // For this example, we'll assume the currentBlueprint was set by startCrafting(itemType) and we need to find its config.
    // This part needs refinement to robustly get the config for the currentBlueprint.
    // Let's assume we stored the type in userData when creating the blueprint:
    const activeItemType = this.currentBlueprint.userData.itemType as string;
    const activeItemConfig = this.craftableItems.find(item => item.type === activeItemType);

    if (!activeItemConfig) {
        console.error("Could not find item configuration for current blueprint.");
        this.cancelPlacement();
        return;
    }

    // Deduct ingredients
    activeItemConfig.ingredients.forEach(ingredient => {
      this.inventory.removeItem(ingredient.type, ingredient.quantity);
    });

    // Create the final object (clone blueprint, reset material)
    const placedObject = this.currentBlueprint.clone();
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        // Restore original material or set a final material
        // This requires storing original materials or having a standard material for placed items
        // For simplicity, let's just make it non-transparent
        const finalMaterial = (meshChild.material as THREE.Material).clone();
        finalMaterial.transparent = false;
        finalMaterial.opacity = 1;
        meshChild.material = finalMaterial;
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null;
    this.isCrafting = false;

    if (activeItemConfig.onPlace) {
      activeItemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${activeItemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isCrafting = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    const craftingItemsContainer = document.getElementById('crafting-items');
    if (!craftingMenu || !craftingItemsContainer) return;

    this.craftableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('crafting-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Requires: ${item.ingredients.map(i => `${i.quantity} ${i.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startCrafting(item.type);
      craftingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    if (craftingMenu) {
        craftingMenu.style.display = craftingMenu.style.display === 'none' ? 'block' : 'none';
        if (craftingMenu.style.display === 'block') {
            // Logic to populate/update menu if needed
        } else {
            if (this.isCrafting) this.cancelPlacement(); // Cancel crafting if menu is closed
        }
    }
  }
  // ... other methods like openMenu, closeMenu, etc.
}
```

**Example (Building System Configuration):**

```typescript
// buildingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory } from './inventory'; // Assuming inventory.ts is in the same directory

export interface BuildingPieceCost {
  type: string; // Item type (e.g., 'log', 'rock')
  quantity: number;
}

export interface BuildableItemConfig {
  name: string;
  type: string; // Unique identifier for the building piece type
  modelPath: string;
  scale?: THREE.Vector3;
  offset?: THREE.Vector3; // Offset for the blueprint model relative to placement point
  costs: BuildingPieceCost[];
  category: 'foundations' | 'walls' | 'roofs' | 'decorations';
  description: string;
  snappingPoints?: { localPosition: THREE.Vector3, type: 'foundation_top' | 'wall_edge' | 'roof_connector' }[]; // For advanced snapping
  allowOverlap?: boolean; // Whether this piece can overlap with others (e.g., decorations)
  requiresSupport?: boolean; // e.g., walls need foundation
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class BuildingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public buildableItems: BuildableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isBuilding: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;
  private placementValidMaterial: THREE.Material;
  private placementInvalidMaterial: THREE.Material;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    this.placementValidMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    this.placementInvalidMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });

    this.buildableItems = [
      {
        name: 'Wooden Foundation',
        type: 'foundation_wood',
        modelPath: 'models/foundation_wood.glb',
        costs: [{ type: 'log', quantity: 4 }],
        category: 'foundations',
        description: 'A simple wooden foundation.',
        onPlace: (pos, rot, obj) => console.log('Foundation placed'),
      },
      {
        name: 'Wooden Wall',
        type: 'wall_wood',
        modelPath: 'models/wall_wood.glb',
        costs: [{ type: 'log', quantity: 2 }],
        category: 'walls',
        description: 'A sturdy wooden wall.',
        requiresSupport: true,
        onPlace: (pos, rot, obj) => console.log('Wall placed'),
      },
      // ... more buildable items
    ];

    this.setupUI(); // Similar to CraftingSystem
  }

  public startBuilding(itemType: string): void {
    const itemConfig = this.buildableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Building item type ${itemType} not found.`);
      return;
    }

    const hasAllCosts = itemConfig.costs.every(cost => {
      return this.inventory.getItemCount(cost.type) >= cost.quantity;
    });

    if (!hasAllCosts) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough materials!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isBuilding = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      this.currentBlueprint.userData.itemType = itemType; // Store for later reference
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      
      this.setBlueprintMaterial(this.placementValidMaterial); // Initially assume valid
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, R to rotate, Esc to cancel.`;
    });
  }

  private setBlueprintMaterial(material: THREE.Material): void {
    if (!this.currentBlueprint) return;
    this.currentBlueprint.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });
  }

  public updateBlueprintPositionAndValidation(mousePosition: THREE.Vector2, buildableSurfaces: THREE.Object3D[]): void {
    if (!this.currentBlueprint || !this.isBuilding) return;

    this.raycaster.setFromCamera(mousePosition, this.camera);
    const intersects = this.raycaster.intersectObjects(buildableSurfaces, true);

    let placementValid = false;
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.currentBlueprint.position.copy(intersect.point);
      // Add snapping logic here if needed (e.g., snap to grid or other pieces)
      // Add collision/overlap detection here
      // For simplicity, let's assume it's valid if it intersects a buildable surface
      placementValid = true; 
      // Example: Check for collisions with existing structures (excluding itself)
      // const colliding = this.checkCollision(this.currentBlueprint, this.scene.children.filter(c => c !== this.currentBlueprint));
      // placementValid = !colliding;
    } else {
        // If no intersection with buildable surface, keep blueprint at a fixed distance or hide
        const distance = 15;
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
        placementValid = false;
    }
    this.setBlueprintMaterial(placementValid ? this.placementValidMaterial : this.placementInvalidMaterial);
    this.currentBlueprint.userData.isValidPlacement = placementValid;
  }

  public rotateBlueprint(axis: THREE.Vector3, angle: number): void {
    if (!this.currentBlueprint || !this.isBuilding) return;
    this.currentBlueprint.rotateOnWorldAxis(axis, angle);
    // Re-validate placement after rotation if necessary
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isBuilding || !this.currentBlueprint.userData.isValidPlacement) {
      if (this.interactionPrompt && this.currentBlueprint && !this.currentBlueprint.userData.isValidPlacement) {
        this.interactionPrompt.textContent = 'Cannot place here!';
        setTimeout(() => { if (this.interactionPrompt && this.isBuilding) this.interactionPrompt.textContent = `Placing... E to place, R to rotate, Esc to cancel.`; }, 2000);
      }
      return;
    }

    const itemType = this.currentBlueprint.userData.itemType as string;
    const itemConfig = this.buildableItems.find(item => item.type === itemType);

    if (!itemConfig) {
      console.error("Could not find item configuration for current blueprint.");
      this.cancelPlacement();
      return;
    }

    // Deduct costs
    itemConfig.costs.forEach(cost => {
      this.inventory.removeItem(cost.type, cost.quantity);
    });

    const placedObject = this.currentBlueprint.clone();
    // Reset material to final/default material
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        // Assuming a default material or loading one based on itemConfig
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Placeholder material
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null; // Important: set to null before adding the clone to avoid issues
    this.scene.add(placedObject); // Add the clone as the final object
    this.isBuilding = false;

    if (itemConfig.onPlace) {
      itemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${itemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isBuilding = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    // Similar to CraftingSystem: create a menu to select buildable items
    const buildingMenu = document.getElementById('building-menu');
    const buildingItemsContainer = document.getElementById('building-items');
    if (!buildingMenu || !buildingItemsContainer) return;

    this.buildableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('building-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Costs: ${item.costs.map(c => `${c.quantity} ${c.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startBuilding(item.type);
      buildingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const buildingMenu = document.getElementById('building-menu');
    if (buildingMenu) {
        buildingMenu.style.display = buildingMenu.style.display === 'none' ? 'block' : 'none';
        if (buildingMenu.style.display === 'block') {
            // Populate/update menu
        } else {
            if (this.isBuilding) this.cancelPlacement();
        }
    }
  }
  // ... other methods
}
```

### Game Loop Integration

**Example (Crafting & Building System Game Loop Update):**

```typescript
// mainGameLoop.ts (or wherever your main update function is)
import * as THREE from 'three';
import { CraftingSystem } from './craftingSystem'; // Adjust path as needed
import { BuildingSystem } from './buildingSystem'; // Adjust path as needed
import { PlayerInput } from './playerInput'; // Assuming a class to handle input

class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private craftingSystem: CraftingSystem;
  private buildingSystem: BuildingSystem;
  private playerInput: PlayerInput;
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private buildableSurfaces: THREE.Object3D[] = []; // Array of objects that can be built upon (e.g., ground, other structures)

  constructor() {
    // ... scene, camera, renderer, inventory initialization ...
    this.scene = new THREE.Scene(); // Placeholder
    this.camera = new THREE.PerspectiveCamera(); // Placeholder
    this.renderer = new THREE.WebGLRenderer(); // Placeholder
    const inventory = {} as any; // Placeholder for Inventory instance

    this.craftingSystem = new CraftingSystem(this.scene, this.camera, inventory);
    this.buildingSystem = new BuildingSystem(this.scene, this.camera, inventory);
    this.playerInput = new PlayerInput(); // Initialize player input handler

    // Example: Add a ground plane to buildable surfaces
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.name = 'groundPlane'; // For identification
    this.scene.add(groundPlane);
    this.buildableSurfaces.push(groundPlane);

    this.setupInputHandlers();
    this.animate();
  }

  private setupInputHandlers(): void {
    window.addEventListener('mousemove', (event) => {
      // Normalize mouse position to range [-1, 1] for both x and y
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Key press handlers (simplified)
    window.addEventListener('keydown', (event) => {
      if (this.playerInput.isKeyPressed('KeyE')) { // E key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.place();
        } else if (this.buildingSystem.isBuilding) {
          this.buildingSystem.place();
        }
      }
      if (this.playerInput.isKeyPressed('KeyR')) { // R key
        if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
            // Example: Rotate around Y axis
            this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4); 
        }
      }
      if (this.playerInput.isKeyPressed('Escape')) { // Escape key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.cancelPlacement();
        }
        if (this.buildingSystem.isBuilding) {
          this.buildingSystem.cancelPlacement();
        }
      }
      if (this.playerInput.isKeyPressed('KeyC')) { // C key for crafting menu
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement(); // Close building if opening crafting
      }
      if (this.playerInput.isKeyPressed('KeyB')) { // B key for building menu
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement(); // Close crafting if opening building
      }
    });
  }

  private update(deltaTime: number): void {
    // ... other game logic (player movement, AI, physics, etc.) ...

    // Update crafting system if active
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      // Create a raycaster from camera to mouse position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mousePosition, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }

    // Update building system if active
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      // Pass mouse position and designated buildable surfaces
      this.buildingSystem.updateBlueprintPositionAndValidation(this.mousePosition, this.buildableSurfaces);
    }

    this.playerInput.update(); // Clear pressed keys for next frame
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const deltaTime = 0.016; // Simplified delta time, use a clock in a real app
    this.update(deltaTime);
    this.render();
  }
}

// Initialize the game
const game = new Game();
```

### Robust User Input Handling

**Example (PlayerInput Class for Robust Input Management):**

```typescript
// playerInput.ts
export class PlayerInput {
  private pressedKeys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private justReleasedKeys: Set<string> = new Set();

  private mouseButtonsPressed: Set<number> = new Set();
  private mouseButtonsJustPressed: Set<number> = new Set();
  private mouseButtonsJustReleased: Set<number> = new Set();

  public mousePosition: { x: number, y: number } = { x: 0, y: 0 };
  public mouseDelta: { x: number, y: number } = { x: 0, y: 0 };
  private lastMousePosition: { x: number, y: number } = { x: 0, y: 0 };

  constructor() {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.pressedKeys.has(event.code)) {
        this.justPressedKeys.add(event.code);
      }
      this.pressedKeys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.code);
      this.justReleasedKeys.add(event.code);
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousemove', (event) => {
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;
    });

    window.addEventListener('mousedown', (event) => {
      if (!this.mouseButtonsPressed.has(event.button)) {
        this.mouseButtonsJustPressed.add(event.button);
      }
      this.mouseButtonsPressed.add(event.button);
    });

    window.addEventListener('mouseup', (event) => {
      this.mouseButtonsPressed.delete(event.button);
      this.mouseButtonsJustReleased.add(event.button);
    });

    // Optional: Prevent context menu on right-click if needed for gameplay
    // window.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Call this at the end of your game loop's update function
  public update(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();

    this.mouseDelta.x = this.mousePosition.x - this.lastMousePosition.x;
    this.mouseDelta.y = this.mousePosition.y - this.lastMousePosition.y;
    this.lastMousePosition.x = this.mousePosition.x;
    this.lastMousePosition.y = this.mousePosition.y;
  }

  // Check if a key is currently held down
  public isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  // Check if a key was pressed in the current frame
  public isKeyJustPressed(keyCode: string): boolean {
    return this.justPressedKeys.has(keyCode);
  }

  // Check if a key was released in the current frame
  public isKeyJustReleased(keyCode: string): boolean {
    return this.justReleasedKeys.has(keyCode);
  }

  // Check if a mouse button is currently held down (0: left, 1: middle, 2: right)
  public isMouseButtonPressed(buttonCode: number): boolean {
    return this.mouseButtonsPressed.has(buttonCode);
  }

  // Check if a mouse button was pressed in the current frame
  public isMouseButtonJustPressed(buttonCode: number): boolean {
    return this.mouseButtonsJustPressed.has(buttonCode);
  }

  // Check if a mouse button was released in the current frame
  public isMouseButtonJustReleased(buttonCode: number): boolean {
    return this.mouseButtonsJustReleased.has(buttonCode);
  }

  // Get normalized mouse position for raycasting ([-1, 1])
  public getNormalizedMousePosition(canvas: HTMLCanvasElement): { x: number, y: number } {
    return {
        x: (this.mousePosition.x / canvas.clientWidth) * 2 - 1,
        y: -(this.mousePosition.y / canvas.clientHeight) * 2 + 1,
    };
  }
}

// Example usage in your main game class (adjust Game class from previous example)
/*
class Game {
  // ... other properties
  private playerInput: PlayerInput;
  private canvas: HTMLCanvasElement;

  constructor() {
    // ... initialization
    this.canvas = this.renderer.domElement; // Assuming renderer is setup
    this.playerInput = new PlayerInput();
    // ... rest of constructor
    this.setupInputHandlers(); // Remove old event listeners, use PlayerInput methods
  }

  private setupInputHandlers(): void {
    // No direct event listeners here anymore if PlayerInput handles them globally
    // Or, pass canvas to PlayerInput if listeners should be canvas-specific
  }

  private update(deltaTime: number): void {
    // ... other game logic ...

    // Example: Using PlayerInput for actions
    if (this.playerInput.isKeyJustPressed('KeyE')) {
      if (this.craftingSystem.isCrafting) this.craftingSystem.place();
      else if (this.buildingSystem.isBuilding) this.buildingSystem.place();
      // else interact(); // General interaction
    }

    if (this.playerInput.isKeyJustPressed('KeyR') && this.buildingSystem.isBuilding) {
        this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4);
    }

    if (this.playerInput.isKeyJustPressed('Escape')) {
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
        // else openPauseMenu();
    }
    
    if (this.playerInput.isKeyJustPressed('KeyC')) {
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
    }

    if (this.playerInput.isKeyJustPressed('KeyB')) {
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
    }

    // Update blueprint positions using normalized mouse from PlayerInput
    const normalizedMouse = this.playerInput.getNormalizedMousePosition(this.canvas);
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(normalizedMouse, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      this.buildingSystem.updateBlueprintPositionAndValidation(normalizedMouse, this.buildableSurfaces);
    }

    // IMPORTANT: Call update on PlayerInput at the end of your game update
    this.playerInput.update();
  }
  // ... rest of Game class ...
}
*/
```

### Advanced Customization Examples

This section provides practical examples for extending the Crafting and Building systems.

**1. Custom Callbacks for Crafted/Built Items:**

Leverage the `onPlace` callback in `CraftableItemConfig` and `BuildableItemConfig` for unique behaviors.

```typescript
// --- In craftingSystem.ts or buildingSystem.ts --- 
// (within the craftableItems/buildableItems array definitions)

// Example: A craftable torch that automatically lights up when placed
{
  name: 'Torch',
  type: 'torch',
  modelPath: 'models/torch.glb',
  ingredients: [{ type: 'stick', quantity: 1 }, { type: 'coal', quantity: 1 }],
  category: 'tools',
  description: 'Provides light in dark areas.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Torch placed at ${position.toArray()}`);
    // Assuming the torch model has a PointLight child
    const light = placedObject.getObjectByName('TorchLightSource') as THREE.PointLight;
    if (light) {
      light.intensity = 1.5; // Turn on the light
      light.visible = true;
    }
    placedObject.userData.isLit = true;
    // You might also want to add a particle effect for fire
  }
},

// Example: A buildable trap that becomes active when placed
{
  name: 'Spike Trap',
  type: 'spike_trap',
  modelPath: 'models/spike_trap.glb',
  costs: [{ type: 'log', quantity: 3 }, { type: 'rock', quantity: 2 }],
  category: 'decorations', // Or a new 'traps' category
  description: 'A dangerous trap for unsuspecting creatures.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Spike Trap armed at ${position.toArray()}`);
    placedObject.userData.isActive = true;
    placedObject.userData.damage = 10; // Custom property
    // Add logic to check for collisions with NPCs/players in game loop
  }
}
```

**2. Dynamic Recipe/Blueprint Modification (e.g., Skill-based):**

Modify recipes or building costs based on player skills or game events.

```typescript
// --- Potentially in a PlayerSkills.ts or GameManager.ts --- 
import { CraftingSystem, CraftableItemConfig } from './craftingSystem';
import { BuildingSystem, BuildableItemConfig } from './buildingSystem';

export class SkillManager {
  private playerSkills: Map<string, number> = new Map(); // e.g., 'woodworking': 1

  constructor() {
    this.playerSkills.set('woodworking', 1);
    this.playerSkills.set('stonemasonry', 0);
  }

  public getSkillLevel(skillName: string): number {
    return this.playerSkills.get(skillName) || 0;
  }

  // Example: Adjust crafting recipe based on skill
  public getModifiedCraftingRecipe(baseRecipe: CraftableItemConfig): CraftableItemConfig {
    const modifiedRecipe = { ...baseRecipe }; // Shallow copy
    modifiedRecipe.ingredients = baseRecipe.ingredients.map(ing => ({ ...ing })); // Deep copy ingredients

    if (baseRecipe.type === 'axe' && this.getSkillLevel('woodworking') > 0) {
      const logIngredient = modifiedRecipe.ingredients.find(ing => ing.type === 'log');
      if (logIngredient) {
        logIngredient.quantity = Math.max(1, logIngredient.quantity - this.getSkillLevel('woodworking')); // Reduce cost
      }
      modifiedRecipe.description += ` (Reduced log cost due to woodworking skill!)`;
    }
    return modifiedRecipe;
  }

  // Example: Adjust building cost based on skill
  public getModifiedBuildingBlueprint(baseBlueprint: BuildableItemConfig): BuildableItemConfig {
    const modifiedBlueprint = { ...baseBlueprint }; // Shallow copy
    modifiedBlueprint.costs = baseBlueprint.costs.map(cost => ({ ...cost })); // Deep copy costs

    if (baseBlueprint.type === 'wall_wood' && this.getSkillLevel('woodworking') >= 2) {
        modifiedBlueprint.description += ' (Reinforced due to advanced woodworking).';
        // Potentially change model or add userData for increased HP
        // modifiedBlueprint.modelPath = 'models/reinforced_wall_wood.glb'; 
    }
    return modifiedBlueprint;
  }
}

// --- In CraftingSystem.ts / BuildingSystem.ts --- 
// When displaying or starting to craft/build, you would fetch the modified config:
// constructor(scene, camera, inventory, private skillManager: SkillManager) { ... }
// 
// public getCraftableItemConfig(itemType: string): CraftableItemConfig | undefined {
//   const baseConfig = this.craftableItems.find(item => item.type === itemType);
//   if (baseConfig) {
//     return this.skillManager.getModifiedCraftingRecipe(baseConfig);
//   }
//   return undefined;
// }
// 
// // Then use this.getCraftableItemConfig(itemType) instead of directly finding in this.craftableItems
```

**3. Advanced Building Snapping Logic:**

The `BuildableItemConfig` can include `snappingPoints`. The `BuildingSystem`'s `updateBlueprintPositionAndValidation` method would need to be enhanced to use these.

```typescript
// --- In BuildableItemConfig --- 
// snappingPoints?: {
//   localPosition: THREE.Vector3; // Position relative to the item's origin
//   type: 'foundation_top' | 'wall_edge_horizontal' | 'wall_edge_vertical' | 'roof_connector';
//   connectsTo?: string[]; // Array of types this point can connect to
// }[];

// --- In BuildingSystem.ts's updateBlueprintPositionAndValidation method (conceptual) ---
/*
if (intersects.length > 0) {
  let bestSnapPoint: THREE.Vector3 | null = null;
  let smallestDistance = Infinity;
  const currentItemConfig = this.buildableItems.find(i => i.type === this.currentBlueprint.userData.itemType);

  // Iterate over existing placed objects in the scene that are buildable
  this.scene.children.forEach(object => {
    if (object.userData.isBuildingPiece && object !== this.currentBlueprint) {
      const existingItemConfig = this.buildableItems.find(i => i.type === object.userData.itemType);
      if (existingItemConfig?.snappingPoints && currentItemConfig?.snappingPoints) {
        existingItemConfig.snappingPoints.forEach(existingSnap => {
          currentItemConfig.snappingPoints.forEach(currentSnap => {
            // Check if snap types are compatible (e.g., currentSnap.connectsTo.includes(existingSnap.type))
            const worldExistingSnapPos = object.localToWorld(existingSnap.localPosition.clone());
            const worldCurrentSnapOffset = this.currentBlueprint.localToWorld(currentSnap.localPosition.clone()).sub(this.currentBlueprint.position);
            const targetBlueprintPos = worldExistingSnapPos.clone().sub(worldCurrentSnapOffset);
            
            const distance = targetBlueprintPos.distanceTo(intersects[0].point); // Distance to mouse raycast point
            if (distance < smallestDistance && distance < SNAP_THRESHOLD) { // SNAP_THRESHOLD is a constant like 0.5
              smallestDistance = distance;
              bestSnapPoint = targetBlueprintPos;
              // Potentially also align rotation based on snap points
            }
          });
        });
      }
    }
  });

  if (bestSnapPoint) {
    this.currentBlueprint.position.copy(bestSnapPoint);
  } else {
    this.currentBlueprint.position.copy(intersects[0].point); // Default to raycast point
  }
  placementValid = true; // Add more validation (collision, support)
} else {
  // ... handle no intersection ...
  placementValid = false;
}
*/
```

This provides a foundation. A full snapping system requires careful management of orientations and connection compatibilities.

Key methods from these systems need to be called within your main game loop (e.g., `requestAnimationFrame` callback).

*   **Crafting System (`CraftingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Call this in your game loop if `craftingSystem.isCrafting` is true and `craftingSystem.currentBlueprint` exists. You'll need to set up a `THREE.Raycaster` typically originating from the center of your camera.

    ```javascript
    // In your game loop
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (craftingSystem.isCrafting && craftingSystem.currentBlueprint) {
            // Assuming 'camera' is your THREE.PerspectiveCamera
            // and 'raycaster' is a THREE.Raycaster instance
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            craftingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

*   **Building System (`BuildingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Similar to the crafting system, call this in your game loop if `buildingSystem.isBuilding` is true and `buildingSystem.currentBlueprint` exists. The raycaster setup would be the same.

    ```javascript
    // In your game loop (can be combined with crafting check)
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (buildingSystem.isBuilding && buildingSystem.currentBlueprint) {
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            buildingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

### Input Handling

These systems rely on user input (keyboard and mouse clicks) to trigger actions.

1.  **Inventory:** Typically, inventory might be opened/closed with a key (e.g., 'I' or 'Tab'). The `addItem` and `removeItem` methods are called by other systems (like crafting or resource gathering) or game events.

2.  **Crafting System:**
    *   **Toggle Menu:** Bind a key (e.g., 'C') to `craftingSystem.toggleMenu()` or `craftingSystem.openMenu()` / `craftingSystem.closeMenu()`.
    *   **Item Selection:** The `setupUI()` method adds click listeners to crafting item elements. Ensure these elements are correctly set up in your HTML.
    *   **Placement (`place()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `craftingSystem.place()` when `craftingSystem.isCrafting` is true.
    *   **Cancel Placement (`cancelPlacement()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `craftingSystem.cancelPlacement()` when `craftingSystem.isCrafting` is true.

3.  **Building System:**
    *   **Show Menu:** Bind a key (e.g., 'B') to `buildingSystem.showBuildingMenu()`.
    *   **Select Building Type:** The `showBuildingMenu()` sets up a temporary keydown listener for number keys ('1'-'5') to call `buildingSystem.startBuilding(type)`. Ensure no other global listeners interfere.
    *   **Placement (`build()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `buildingSystem.build()` when `buildingSystem.isBuilding` is true.
    *   **Cancel Building (`cancelBuilding()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `buildingSystem.cancelBuilding()` when `buildingSystem.isBuilding` is true.
    *   **Rotate Wall (`rotateWall()`):** Bind a key (e.g., 'R') to `buildingSystem.rotateWall()` when `buildingSystem.isBuilding` and `buildingSystem.buildingType` is 'wall' (or other rotatable types).

**Example Input Setup (Conceptual):**

```javascript
// In your main input handling logic
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c') {
        craftingSystem.toggleMenu();
    }
    if (event.key.toLowerCase() === 'b') {
        if (buildingSystem.isBuildingMenuOpen()) {
            buildingSystem.hideBuildingMenu();
        } else {
            buildingSystem.showBuildingMenu();
        }
    }
    if (craftingSystem.isCrafting) {
        if (event.key.toLowerCase() === 'e') {
            craftingSystem.place();
        }
        if (event.key === 'Escape') {
            craftingSystem.cancelPlacement();
        }
    }
    if (buildingSystem.isBuilding) {
        if (event.key.toLowerCase() === 'e') {
            buildingSystem.build();
        }
        if (event.key === 'Escape') {
            buildingSystem.cancelBuilding();
        }
        if (event.key.toLowerCase() === 'r' && buildingSystem.buildingType === 'wall') { // Check type
            buildingSystem.rotateWall();
        }
    }
});

// For mouse clicks, you might need to check if the click is on the game canvas vs. UI elements.
// Pointer Lock API is often used in Three.js games for camera control, which needs to be managed
// when UI menus are open (e.g., exit pointer lock when a menu opens).
```

### UI Adaptation

The systems expect certain HTML elements to be present for their UI components:

*   **Inventory:** Elements with class `inventory-slot`.
*   **Crafting:** An element with ID `crafting-menu` and an element with ID `crafting-items` within it. A prompt element (e.g., `#interaction-prompt`) for placement messages.
*   **Building:** An element with ID `building-menu` (created dynamically). A prompt element (e.g., `#interaction-prompt`) for building instructions.

You'll need to either:
1.  **Replicate HTML Structure:** Create these HTML elements in your main game's HTML file with the specified IDs and classes.
2.  **Adapt System Code:** Modify the `setupUI`, `updateUI`, `showBuildingMenu`, etc., methods in the systems to work with your existing UI framework or element IDs/classes. This is more flexible if you have an established UI system (e.g., using React, Vue, Svelte, or a custom DOM manipulation library).

**Styling:** Apply CSS to style these UI elements to match your game's aesthetic.

### Dependencies and Configuration

1.  **Three.js:** All systems rely on Three.js. Ensure you have it installed and imported correctly.
    ```bash
    npm install three
    # If using TypeScript
    npm install --save-dev @types/three
    ```
2.  **GLTFLoader:** The `CraftingSystem` uses `GLTFLoader` to load 3D models. Make sure it's available.
    ```javascript
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    ```
3.  **Model Paths:** The `craftingSystem.js` defines `modelPath` for craftable items. Ensure these paths are correct relative to how your project serves static assets.
4.  **Initialization:** Instantiate the systems in your main game setup, passing necessary dependencies:

    ```javascript
    // main.js or game.js
    import * as THREE from 'three';
    import { Inventory } from './modules/ui/wilderness/inventory.js';
    import { CraftingSystem } from './modules/ui/wilderness/craftingSystem.js';
    import { BuildingSystem } from './modules/ui/wilderness/buildingSystem.js';

    // ... scene, camera setup ...

    const inventory = new Inventory();
    // Potentially pass UI elements to Inventory constructor if you modify it

    const buildingSystem = new BuildingSystem(scene, camera, inventory);
    // Consider passing a config for costs, meshes if you want to customize them externally

    const craftingSystem = new CraftingSystem(scene, camera, inventory, buildingSystem);
    // Ensure craftableItems array with modelPaths is configured correctly

    // ... rest of your game initialization ...
    ```

5.  **Global Functions/State (if any):**
    *   The `craftEquipmentItem` method in `CraftingSystem` calls `window.equipWeapon('bow')`. If you use this, ensure this global function exists or modify the call to integrate with your game's equipment system.

By following these guidelines, you can integrate the inventory, crafting, and building systems more smoothly into your Three.js project.

---

## Inventory System (`inventory.js`)

The inventory system manages the player's items, including adding, removing, and tracking quantities.

### Class: `Inventory`

Manages the player's inventory slots and items.

**Constructor:** `constructor()`
-   Initializes `this.slots`: An array of 5 elements, initially `null`.
-   Initializes `this.slotElements`: An array of DOM elements with the class `inventory-slot`.
-   Initializes `this.unlimitedLogs`: A boolean flag (default: `false`) for a cheat to have unlimited logs.
-   Initializes `this.stackSizes`: An object defining the maximum stack size for different item types (e.g., `log: 999`, `axe: 1`).

**Methods:**

-   `addItem(item, count = 1)`:
    -   Adds a specified `item` (either an `Item` object or a string type) to the inventory with a given `count`.
    -   Handles stacking: If the item is stackable and existing stacks have space, it adds to them first.
    -   If no existing stacks or they are full, it creates new stacks in empty slots.
    -   For non-stackable items, it adds each item to a separate empty slot.
    -   Updates the UI via `this.updateUI()`.
    -   Returns `true` if at least some items were added, `false` otherwise.

-   `removeItem(itemType, count = 1)`:
    -   Removes a specified `count` of an `itemType` from the inventory.
    -   If `unlimitedLogs` is true and `itemType` is 'log', it pretends to remove but doesn't actually change the count.
    -   Finds the first slot containing the `itemType`.
    -   If the item's quantity in the slot is greater than `count`, it reduces the quantity.
    -   Otherwise, it removes the item from the slot (sets to `null`).
    -   Updates the UI via `this.updateUI()`.
    -   Returns `true` if the item was found and removed/quantity reduced, `false` otherwise.

-   `hasItems(items)`:
    -   Checks if the inventory contains all item types specified in the `items` array.
    -   If `unlimitedLogs` is true and an item type is 'log', it considers 'log' as present.
    -   Returns `true` if all specified items are present, `false` otherwise.

-   `getItemCount(itemType)`:
    -   Returns the total quantity of a specific `itemType` in the inventory.
    -   If `unlimitedLogs` is true and `itemType` is 'log', it returns `999`.
    -   Sums up the `quantity` from all slots containing the `itemType`.

-   `updateUI()`:
    -   Updates the text content of the `slotElements` (DOM) to reflect the current state of `this.slots`.
    -   Displays item type and quantity for occupied slots, or an empty string for empty slots.
    -   Logs total counts of 'log' and 'rock' to the console.

### Class: `Item`

Represents a single item or a stack of items in the inventory.

**Constructor:** `constructor(type, quantity = 1)`
-   Initializes `this.type`: The type of the item (e.g., 'log', 'rock').
-   Initializes `this.quantity`: The number of items in this stack (default: `1`).

---

## Integration Guide

This section provides guidance on integrating the Wilderness game systems into a larger Three.js project, including tips for TypeScript conversion, game loop integration, UI adaptation, and dependency management.

### TypeScript Conversion

While the provided systems are in JavaScript, converting them to TypeScript can offer benefits like static typing and improved code maintainability. Here's a general approach:

1.  **Setup TypeScript:** Ensure your project has TypeScript configured (`tsconfig.json`).
2.  **Rename Files:** Change `.js` file extensions to `.ts`.
3.  **Add Types:**
    *   Define interfaces or types for complex objects (e.g., `Item`, `CraftableItemConfig`, `BuildingPieceData`).
    *   Add type annotations to function parameters, return values, and class properties.
    *   For Three.js objects (`Scene`, `Camera`, `Mesh`, `Material`, `Raycaster`, `GLTFLoader`, `Group`, `Vector3`, `Quaternion`, `BoxGeometry`), install and use `@types/three`.
4.  **Address Errors:** The TypeScript compiler (`tsc`) will highlight areas needing type adjustments or fixes. Pay attention to:
    *   `any` types: Try to replace them with more specific types.
    *   `null` or `undefined` possibilities: Handle them explicitly.
    *   DOM element interactions: Use appropriate DOM types (e.g., `HTMLElement`, `HTMLDivElement`).

**Example (Inventory Item):**

```typescript
// inventory.ts
import * as THREE from 'three'; // If using Three.js types elsewhere

export interface ItemData {
  type: string;
  quantity: number;
}

export class Item implements ItemData {
  type: string;
  quantity: number;

  constructor(type: string, quantity: number = 1) {
    this.type = type;
    this.quantity = quantity;
  }
}

export interface Slot {
  item: Item | null;
  // ... other slot properties if any
}

export class Inventory {
  public slots: Array<Item | null>;
  public slotElements: HTMLElement[]; // Or more specific type like HTMLDivElement[]
  public unlimitedLogs: boolean;
  public stackSizes: { [key: string]: number };

  constructor() {
    this.slots = new Array(5).fill(null);
    this.slotElements = Array.from(document.querySelectorAll('.inventory-slot')) as HTMLElement[];
    this.unlimitedLogs = false;
    this.stackSizes = { log: 999, axe: 1 };
    // ... rest of the constructor
  }

  addItem(item: ItemData | string, count: number = 1): boolean {
    // ... implementation with type safety ...
    this.updateUI();
    return true; // or false
  }

  // ... other methods with type annotations ...
  updateUI(): void {
    this.slotElements.forEach((slotElement, index) => {
      const item = this.slots[index];
      if (item) {
        slotElement.textContent = `${item.type} (${item.quantity})`;
      } else {
        slotElement.textContent = '';
      }
    });
    console.log('Logs:', this.getItemCount('log'));
    console.log('Rocks:', this.getItemCount('rock'));
  }

  getItemCount(itemType: string): number {
    if (this.unlimitedLogs && itemType === 'log') return 999;
    return this.slots.reduce((total, item) => {
      if (item && item.type === itemType) {
        return total + item.quantity;
      }
      return total;
    }, 0);
  }
}
```

**Example (Crafting System Configuration):**

```typescript
// craftingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory, ItemData } from './inventory'; // Assuming inventory.ts is in the same directory

export interface CraftingRecipeIngredient {
  type: string;
  quantity: number;
}

export interface CraftableItemConfig {
  name: string;
  type: string; // Unique identifier for the item type
  modelPath: string;
  scale?: THREE.Vector3; // Optional scale for the blueprint/placed model
  offset?: THREE.Vector3; // Optional offset for the blueprint/placed model
  ingredients: CraftingRecipeIngredient[];
  category: 'tools' | 'structures' | 'resources'; // Example categories
  description: string;
  // Callback for when the item is successfully crafted and placed
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class CraftingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public craftableItems: CraftableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isCrafting: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    // Define craftable items with type safety
    this.craftableItems = [
      {
        name: 'Axe',
        type: 'axe',
        modelPath: 'models/axe.glb',
        scale: new THREE.Vector3(0.5, 0.5, 0.5),
        ingredients: [
          { type: 'log', quantity: 2 },
          { type: 'rock', quantity: 1 },
        ],
        category: 'tools',
        description: 'A basic axe for chopping wood.',
        onPlace: (position, rotation, model) => {
          console.log(`Axe placed at ${position.toArray()} with rotation ${rotation.toArray()}`);
          // Additional logic: add to player's tools, etc.
        }
      },
      {
        name: 'Bonfire',
        type: 'bonfire',
        modelPath: 'models/bonfire.glb',
        ingredients: [
          { type: 'log', quantity: 5 },
          { type: 'rock', quantity: 3 },
        ],
        category: 'structures',
        description: 'Provides light and warmth.',
        onPlace: (position, rotation, model) => {
            // Example: Start fire particle effect
            // model.userData.isLit = true;
        }
      },
      // ... more craftable items
    ];

    this.setupUI();
  }

  // Method to start crafting a specific item type
  public startCrafting(itemType: string): void {
    const itemConfig = this.craftableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Crafting item type ${itemType} not found.`);
      return;
    }

    // Check if player has ingredients
    const hasAllIngredients = itemConfig.ingredients.every(ingredient => {
      return this.inventory.getItemCount(ingredient.type) >= ingredient.quantity;
    });

    if (!hasAllIngredients) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough ingredients!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isCrafting = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      // Apply a semi-transparent material to the blueprint
      this.currentBlueprint.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const meshChild = child as THREE.Mesh;
          const originalMaterial = meshChild.material as THREE.Material | THREE.Material[];
          if (Array.isArray(originalMaterial)) {
            meshChild.material = originalMaterial.map(mat => this.createBlueprintMaterial(mat));
          } else {
            meshChild.material = this.createBlueprintMaterial(originalMaterial);
          }
        }
      });
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, Esc to cancel.`;
    });
  }

  private createBlueprintMaterial(originalMaterial: THREE.Material): THREE.Material {
    const blueprintMaterial = (originalMaterial as THREE.MeshStandardMaterial).clone(); // Clone to avoid modifying shared materials
    blueprintMaterial.transparent = true;
    blueprintMaterial.opacity = 0.5;
    // You might want to change color as well, e.g., to a ghostly blue
    // if (blueprintMaterial instanceof THREE.MeshStandardMaterial) {
    //   blueprintMaterial.color.set(0x007bff);
    //   blueprintMaterial.emissive.set(0x003366);
    // }
    return blueprintMaterial;
  }

  public updateBlueprintPosition(raycaster: THREE.Raycaster): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const intersects = raycaster.intersectObjects(this.scene.children, true); // Check against all scene objects
    // A more robust solution would be to intersect with a specific ground plane or designated buildable surfaces.
    const groundIntersect = intersects.find(intersect => {
        // Example: only place on objects named 'ground' or with specific userData
        // return intersect.object.name === 'groundPlane';
        return intersect.object.isMesh && intersect.object.name !== this.currentBlueprint?.uuid; // Avoid self-intersection
    });

    if (groundIntersect) {
      this.currentBlueprint.position.copy(groundIntersect.point);
      // Optional: Align to grid or snap to surface normal
      // this.currentBlueprint.quaternion.setFromUnitVectors(THREE.Object3D.DefaultUp, groundIntersect.face.normal);
    } else {
        // If no intersection, keep blueprint at a fixed distance in front of camera
        const distance = 10; // Adjust as needed
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
    }
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const itemConfig = this.craftableItems.find(item => 
        this.currentBlueprint && 
        (this.currentBlueprint.userData.configType === item.type || 
         (this.currentBlueprint.name.toLowerCase().includes(item.type))) // Fallback if configType not set
    );
    // A better way to link blueprint to config is to store itemType in blueprint.userData when loaded.
    // For this example, we'll assume the currentBlueprint was set by startCrafting(itemType) and we need to find its config.
    // This part needs refinement to robustly get the config for the currentBlueprint.
    // Let's assume we stored the type in userData when creating the blueprint:
    const activeItemType = this.currentBlueprint.userData.itemType as string;
    const activeItemConfig = this.craftableItems.find(item => item.type === activeItemType);

    if (!activeItemConfig) {
        console.error("Could not find item configuration for current blueprint.");
        this.cancelPlacement();
        return;
    }

    // Deduct ingredients
    activeItemConfig.ingredients.forEach(ingredient => {
      this.inventory.removeItem(ingredient.type, ingredient.quantity);
    });

    // Create the final object (clone blueprint, reset material)
    const placedObject = this.currentBlueprint.clone();
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        // Restore original material or set a final material
        // This requires storing original materials or having a standard material for placed items
        // For simplicity, let's just make it non-transparent
        const finalMaterial = (meshChild.material as THREE.Material).clone();
        finalMaterial.transparent = false;
        finalMaterial.opacity = 1;
        meshChild.material = finalMaterial;
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null;
    this.isCrafting = false;

    if (activeItemConfig.onPlace) {
      activeItemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${activeItemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isCrafting = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    const craftingItemsContainer = document.getElementById('crafting-items');
    if (!craftingMenu || !craftingItemsContainer) return;

    this.craftableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('crafting-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Requires: ${item.ingredients.map(i => `${i.quantity} ${i.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startCrafting(item.type);
      craftingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    if (craftingMenu) {
        craftingMenu.style.display = craftingMenu.style.display === 'none' ? 'block' : 'none';
        if (craftingMenu.style.display === 'block') {
            // Logic to populate/update menu if needed
        } else {
            if (this.isCrafting) this.cancelPlacement(); // Cancel crafting if menu is closed
        }
    }
  }
  // ... other methods like openMenu, closeMenu, etc.
}
```

**Example (Building System Configuration):**

```typescript
// buildingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory } from './inventory'; // Assuming inventory.ts is in the same directory

export interface BuildingPieceCost {
  type: string; // Item type (e.g., 'log', 'rock')
  quantity: number;
}

export interface BuildableItemConfig {
  name: string;
  type: string; // Unique identifier for the building piece type
  modelPath: string;
  scale?: THREE.Vector3;
  offset?: THREE.Vector3; // Offset for the blueprint model relative to placement point
  costs: BuildingPieceCost[];
  category: 'foundations' | 'walls' | 'roofs' | 'decorations';
  description: string;
  snappingPoints?: { localPosition: THREE.Vector3, type: 'foundation_top' | 'wall_edge' | 'roof_connector' }[]; // For advanced snapping
  allowOverlap?: boolean; // Whether this piece can overlap with others (e.g., decorations)
  requiresSupport?: boolean; // e.g., walls need foundation
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class BuildingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public buildableItems: BuildableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isBuilding: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;
  private placementValidMaterial: THREE.Material;
  private placementInvalidMaterial: THREE.Material;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    this.placementValidMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    this.placementInvalidMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });

    this.buildableItems = [
      {
        name: 'Wooden Foundation',
        type: 'foundation_wood',
        modelPath: 'models/foundation_wood.glb',
        costs: [{ type: 'log', quantity: 4 }],
        category: 'foundations',
        description: 'A simple wooden foundation.',
        onPlace: (pos, rot, obj) => console.log('Foundation placed'),
      },
      {
        name: 'Wooden Wall',
        type: 'wall_wood',
        modelPath: 'models/wall_wood.glb',
        costs: [{ type: 'log', quantity: 2 }],
        category: 'walls',
        description: 'A sturdy wooden wall.',
        requiresSupport: true,
        onPlace: (pos, rot, obj) => console.log('Wall placed'),
      },
      // ... more buildable items
    ];

    this.setupUI(); // Similar to CraftingSystem
  }

  public startBuilding(itemType: string): void {
    const itemConfig = this.buildableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Building item type ${itemType} not found.`);
      return;
    }

    const hasAllCosts = itemConfig.costs.every(cost => {
      return this.inventory.getItemCount(cost.type) >= cost.quantity;
    });

    if (!hasAllCosts) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough materials!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isBuilding = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      this.currentBlueprint.userData.itemType = itemType; // Store for later reference
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      
      this.setBlueprintMaterial(this.placementValidMaterial); // Initially assume valid
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, R to rotate, Esc to cancel.`;
    });
  }

  private setBlueprintMaterial(material: THREE.Material): void {
    if (!this.currentBlueprint) return;
    this.currentBlueprint.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });
  }

  public updateBlueprintPositionAndValidation(mousePosition: THREE.Vector2, buildableSurfaces: THREE.Object3D[]): void {
    if (!this.currentBlueprint || !this.isBuilding) return;

    this.raycaster.setFromCamera(mousePosition, this.camera);
    const intersects = this.raycaster.intersectObjects(buildableSurfaces, true);

    let placementValid = false;
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.currentBlueprint.position.copy(intersect.point);
      // Add snapping logic here if needed (e.g., snap to grid or other pieces)
      // Add collision/overlap detection here
      // For simplicity, let's assume it's valid if it intersects a buildable surface
      placementValid = true; 
      // Example: Check for collisions with existing structures (excluding itself)
      // const colliding = this.checkCollision(this.currentBlueprint, this.scene.children.filter(c => c !== this.currentBlueprint));
      // placementValid = !colliding;
    } else {
        // If no intersection with buildable surface, keep blueprint at a fixed distance or hide
        const distance = 15;
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
        placementValid = false;
    }
    this.setBlueprintMaterial(placementValid ? this.placementValidMaterial : this.placementInvalidMaterial);
    this.currentBlueprint.userData.isValidPlacement = placementValid;
  }

  public rotateBlueprint(axis: THREE.Vector3, angle: number): void {
    if (!this.currentBlueprint || !this.isBuilding) return;
    this.currentBlueprint.rotateOnWorldAxis(axis, angle);
    // Re-validate placement after rotation if necessary
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isBuilding || !this.currentBlueprint.userData.isValidPlacement) {
      if (this.interactionPrompt && this.currentBlueprint && !this.currentBlueprint.userData.isValidPlacement) {
        this.interactionPrompt.textContent = 'Cannot place here!';
        setTimeout(() => { if (this.interactionPrompt && this.isBuilding) this.interactionPrompt.textContent = `Placing... E to place, R to rotate, Esc to cancel.`; }, 2000);
      }
      return;
    }

    const itemType = this.currentBlueprint.userData.itemType as string;
    const itemConfig = this.buildableItems.find(item => item.type === itemType);

    if (!itemConfig) {
      console.error("Could not find item configuration for current blueprint.");
      this.cancelPlacement();
      return;
    }

    // Deduct costs
    itemConfig.costs.forEach(cost => {
      this.inventory.removeItem(cost.type, cost.quantity);
    });

    const placedObject = this.currentBlueprint.clone();
    // Reset material to final/default material
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        // Assuming a default material or loading one based on itemConfig
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Placeholder material
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null; // Important: set to null before adding the clone to avoid issues
    this.scene.add(placedObject); // Add the clone as the final object
    this.isBuilding = false;

    if (itemConfig.onPlace) {
      itemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${itemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isBuilding = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    // Similar to CraftingSystem: create a menu to select buildable items
    const buildingMenu = document.getElementById('building-menu');
    const buildingItemsContainer = document.getElementById('building-items');
    if (!buildingMenu || !buildingItemsContainer) return;

    this.buildableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('building-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Costs: ${item.costs.map(c => `${c.quantity} ${c.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startBuilding(item.type);
      buildingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const buildingMenu = document.getElementById('building-menu');
    if (buildingMenu) {
        buildingMenu.style.display = buildingMenu.style.display === 'none' ? 'block' : 'none';
        if (buildingMenu.style.display === 'block') {
            // Populate/update menu
        } else {
            if (this.isBuilding) this.cancelPlacement();
        }
    }
  }
  // ... other methods
}
```

### Game Loop Integration

**Example (Crafting & Building System Game Loop Update):**

```typescript
// mainGameLoop.ts (or wherever your main update function is)
import * as THREE from 'three';
import { CraftingSystem } from './craftingSystem'; // Adjust path as needed
import { BuildingSystem } from './buildingSystem'; // Adjust path as needed
import { PlayerInput } from './playerInput'; // Assuming a class to handle input

class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private craftingSystem: CraftingSystem;
  private buildingSystem: BuildingSystem;
  private playerInput: PlayerInput;
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private buildableSurfaces: THREE.Object3D[] = []; // Array of objects that can be built upon (e.g., ground, other structures)

  constructor() {
    // ... scene, camera, renderer, inventory initialization ...
    this.scene = new THREE.Scene(); // Placeholder
    this.camera = new THREE.PerspectiveCamera(); // Placeholder
    this.renderer = new THREE.WebGLRenderer(); // Placeholder
    const inventory = {} as any; // Placeholder for Inventory instance

    this.craftingSystem = new CraftingSystem(this.scene, this.camera, inventory);
    this.buildingSystem = new BuildingSystem(this.scene, this.camera, inventory);
    this.playerInput = new PlayerInput(); // Initialize player input handler

    // Example: Add a ground plane to buildable surfaces
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.name = 'groundPlane'; // For identification
    this.scene.add(groundPlane);
    this.buildableSurfaces.push(groundPlane);

    this.setupInputHandlers();
    this.animate();
  }

  private setupInputHandlers(): void {
    window.addEventListener('mousemove', (event) => {
      // Normalize mouse position to range [-1, 1] for both x and y
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Key press handlers (simplified)
    window.addEventListener('keydown', (event) => {
      if (this.playerInput.isKeyPressed('KeyE')) { // E key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.place();
        } else if (this.buildingSystem.isBuilding) {
          this.buildingSystem.place();
        }
      }
      if (this.playerInput.isKeyPressed('KeyR')) { // R key
        if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
            // Example: Rotate around Y axis
            this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4); 
        }
      }
      if (this.playerInput.isKeyPressed('Escape')) { // Escape key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.cancelPlacement();
        }
        if (this.buildingSystem.isBuilding) {
          this.buildingSystem.cancelPlacement();
        }
      }
      if (this.playerInput.isKeyPressed('KeyC')) { // C key for crafting menu
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement(); // Close building if opening crafting
      }
      if (this.playerInput.isKeyPressed('KeyB')) { // B key for building menu
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement(); // Close crafting if opening building
      }
    });
  }

  private update(deltaTime: number): void {
    // ... other game logic (player movement, AI, physics, etc.) ...

    // Update crafting system if active
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      // Create a raycaster from camera to mouse position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mousePosition, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }

    // Update building system if active
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      // Pass mouse position and designated buildable surfaces
      this.buildingSystem.updateBlueprintPositionAndValidation(this.mousePosition, this.buildableSurfaces);
    }

    this.playerInput.update(); // Clear pressed keys for next frame
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const deltaTime = 0.016; // Simplified delta time, use a clock in a real app
    this.update(deltaTime);
    this.render();
  }
}

// Initialize the game
const game = new Game();
```

### Robust User Input Handling

**Example (PlayerInput Class for Robust Input Management):**

```typescript
// playerInput.ts
export class PlayerInput {
  private pressedKeys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private justReleasedKeys: Set<string> = new Set();

  private mouseButtonsPressed: Set<number> = new Set();
  private mouseButtonsJustPressed: Set<number> = new Set();
  private mouseButtonsJustReleased: Set<number> = new Set();

  public mousePosition: { x: number, y: number } = { x: 0, y: 0 };
  public mouseDelta: { x: number, y: number } = { x: 0, y: 0 };
  private lastMousePosition: { x: number, y: number } = { x: 0, y: 0 };

  constructor() {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.pressedKeys.has(event.code)) {
        this.justPressedKeys.add(event.code);
      }
      this.pressedKeys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.code);
      this.justReleasedKeys.add(event.code);
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousemove', (event) => {
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;
    });

    window.addEventListener('mousedown', (event) => {
      if (!this.mouseButtonsPressed.has(event.button)) {
        this.mouseButtonsJustPressed.add(event.button);
      }
      this.mouseButtonsPressed.add(event.button);
    });

    window.addEventListener('mouseup', (event) => {
      this.mouseButtonsPressed.delete(event.button);
      this.mouseButtonsJustReleased.add(event.button);
    });

    // Optional: Prevent context menu on right-click if needed for gameplay
    // window.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Call this at the end of your game loop's update function
  public update(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();

    this.mouseDelta.x = this.mousePosition.x - this.lastMousePosition.x;
    this.mouseDelta.y = this.mousePosition.y - this.lastMousePosition.y;
    this.lastMousePosition.x = this.mousePosition.x;
    this.lastMousePosition.y = this.mousePosition.y;
  }

  // Check if a key is currently held down
  public isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  // Check if a key was pressed in the current frame
  public isKeyJustPressed(keyCode: string): boolean {
    return this.justPressedKeys.has(keyCode);
  }

  // Check if a key was released in the current frame
  public isKeyJustReleased(keyCode: string): boolean {
    return this.justReleasedKeys.has(keyCode);
  }

  // Check if a mouse button is currently held down (0: left, 1: middle, 2: right)
  public isMouseButtonPressed(buttonCode: number): boolean {
    return this.mouseButtonsPressed.has(buttonCode);
  }

  // Check if a mouse button was pressed in the current frame
  public isMouseButtonJustPressed(buttonCode: number): boolean {
    return this.mouseButtonsJustPressed.has(buttonCode);
  }

  // Check if a mouse button was released in the current frame
  public isMouseButtonJustReleased(buttonCode: number): boolean {
    return this.mouseButtonsJustReleased.has(buttonCode);
  }

  // Get normalized mouse position for raycasting ([-1, 1])
  public getNormalizedMousePosition(canvas: HTMLCanvasElement): { x: number, y: number } {
    return {
        x: (this.mousePosition.x / canvas.clientWidth) * 2 - 1,
        y: -(this.mousePosition.y / canvas.clientHeight) * 2 + 1,
    };
  }
}

// Example usage in your main game class (adjust Game class from previous example)
/*
class Game {
  // ... other properties
  private playerInput: PlayerInput;
  private canvas: HTMLCanvasElement;

  constructor() {
    // ... initialization
    this.canvas = this.renderer.domElement; // Assuming renderer is setup
    this.playerInput = new PlayerInput();
    // ... rest of constructor
    this.setupInputHandlers(); // Remove old event listeners, use PlayerInput methods
  }

  private setupInputHandlers(): void {
    // No direct event listeners here anymore if PlayerInput handles them globally
    // Or, pass canvas to PlayerInput if listeners should be canvas-specific
  }

  private update(deltaTime: number): void {
    // ... other game logic ...

    // Example: Using PlayerInput for actions
    if (this.playerInput.isKeyJustPressed('KeyE')) {
      if (this.craftingSystem.isCrafting) this.craftingSystem.place();
      else if (this.buildingSystem.isBuilding) this.buildingSystem.place();
      // else interact(); // General interaction
    }

    if (this.playerInput.isKeyJustPressed('KeyR') && this.buildingSystem.isBuilding) {
        this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4);
    }

    if (this.playerInput.isKeyJustPressed('Escape')) {
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
        // else openPauseMenu();
    }
    
    if (this.playerInput.isKeyJustPressed('KeyC')) {
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
    }

    if (this.playerInput.isKeyJustPressed('KeyB')) {
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
    }

    // Update blueprint positions using normalized mouse from PlayerInput
    const normalizedMouse = this.playerInput.getNormalizedMousePosition(this.canvas);
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(normalizedMouse, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      this.buildingSystem.updateBlueprintPositionAndValidation(normalizedMouse, this.buildableSurfaces);
    }

    // IMPORTANT: Call update on PlayerInput at the end of your game update
    this.playerInput.update();
  }
  // ... rest of Game class ...
}
*/
```

### Advanced Customization Examples

This section provides practical examples for extending the Crafting and Building systems.

**1. Custom Callbacks for Crafted/Built Items:**

Leverage the `onPlace` callback in `CraftableItemConfig` and `BuildableItemConfig` for unique behaviors.

```typescript
// --- In craftingSystem.ts or buildingSystem.ts --- 
// (within the craftableItems/buildableItems array definitions)

// Example: A craftable torch that automatically lights up when placed
{
  name: 'Torch',
  type: 'torch',
  modelPath: 'models/torch.glb',
  ingredients: [{ type: 'stick', quantity: 1 }, { type: 'coal', quantity: 1 }],
  category: 'tools',
  description: 'Provides light in dark areas.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Torch placed at ${position.toArray()}`);
    // Assuming the torch model has a PointLight child
    const light = placedObject.getObjectByName('TorchLightSource') as THREE.PointLight;
    if (light) {
      light.intensity = 1.5; // Turn on the light
      light.visible = true;
    }
    placedObject.userData.isLit = true;
    // You might also want to add a particle effect for fire
  }
},

// Example: A buildable trap that becomes active when placed
{
  name: 'Spike Trap',
  type: 'spike_trap',
  modelPath: 'models/spike_trap.glb',
  costs: [{ type: 'log', quantity: 3 }, { type: 'rock', quantity: 2 }],
  category: 'decorations', // Or a new 'traps' category
  description: 'A dangerous trap for unsuspecting creatures.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Spike Trap armed at ${position.toArray()}`);
    placedObject.userData.isActive = true;
    placedObject.userData.damage = 10; // Custom property
    // Add logic to check for collisions with NPCs/players in game loop
  }
}
```

**2. Dynamic Recipe/Blueprint Modification (e.g., Skill-based):**

Modify recipes or building costs based on player skills or game events.

```typescript
// --- Potentially in a PlayerSkills.ts or GameManager.ts --- 
import { CraftingSystem, CraftableItemConfig } from './craftingSystem';
import { BuildingSystem, BuildableItemConfig } from './buildingSystem';

export class SkillManager {
  private playerSkills: Map<string, number> = new Map(); // e.g., 'woodworking': 1

  constructor() {
    this.playerSkills.set('woodworking', 1);
    this.playerSkills.set('stonemasonry', 0);
  }

  public getSkillLevel(skillName: string): number {
    return this.playerSkills.get(skillName) || 0;
  }

  // Example: Adjust crafting recipe based on skill
  public getModifiedCraftingRecipe(baseRecipe: CraftableItemConfig): CraftableItemConfig {
    const modifiedRecipe = { ...baseRecipe }; // Shallow copy
    modifiedRecipe.ingredients = baseRecipe.ingredients.map(ing => ({ ...ing })); // Deep copy ingredients

    if (baseRecipe.type === 'axe' && this.getSkillLevel('woodworking') > 0) {
      const logIngredient = modifiedRecipe.ingredients.find(ing => ing.type === 'log');
      if (logIngredient) {
        logIngredient.quantity = Math.max(1, logIngredient.quantity - this.getSkillLevel('woodworking')); // Reduce cost
      }
      modifiedRecipe.description += ` (Reduced log cost due to woodworking skill!)`;
    }
    return modifiedRecipe;
  }

  // Example: Adjust building cost based on skill
  public getModifiedBuildingBlueprint(baseBlueprint: BuildableItemConfig): BuildableItemConfig {
    const modifiedBlueprint = { ...baseBlueprint }; // Shallow copy
    modifiedBlueprint.costs = baseBlueprint.costs.map(cost => ({ ...cost })); // Deep copy costs

    if (baseBlueprint.type === 'wall_wood' && this.getSkillLevel('woodworking') >= 2) {
        modifiedBlueprint.description += ' (Reinforced due to advanced woodworking).';
        // Potentially change model or add userData for increased HP
        // modifiedBlueprint.modelPath = 'models/reinforced_wall_wood.glb'; 
    }
    return modifiedBlueprint;
  }
}

// --- In CraftingSystem.ts / BuildingSystem.ts --- 
// When displaying or starting to craft/build, you would fetch the modified config:
// constructor(scene, camera, inventory, private skillManager: SkillManager) { ... }
// 
// public getCraftableItemConfig(itemType: string): CraftableItemConfig | undefined {
//   const baseConfig = this.craftableItems.find(item => item.type === itemType);
//   if (baseConfig) {
//     return this.skillManager.getModifiedCraftingRecipe(baseConfig);
//   }
//   return undefined;
// }
// 
// // Then use this.getCraftableItemConfig(itemType) instead of directly finding in this.craftableItems
```

**3. Advanced Building Snapping Logic:**

The `BuildableItemConfig` can include `snappingPoints`. The `BuildingSystem`'s `updateBlueprintPositionAndValidation` method would need to be enhanced to use these.

```typescript
// --- In BuildableItemConfig --- 
// snappingPoints?: {
//   localPosition: THREE.Vector3; // Position relative to the item's origin
//   type: 'foundation_top' | 'wall_edge_horizontal' | 'wall_edge_vertical' | 'roof_connector';
//   connectsTo?: string[]; // Array of types this point can connect to
// }[];

// --- In BuildingSystem.ts's updateBlueprintPositionAndValidation method (conceptual) ---
/*
if (intersects.length > 0) {
  let bestSnapPoint: THREE.Vector3 | null = null;
  let smallestDistance = Infinity;
  const currentItemConfig = this.buildableItems.find(i => i.type === this.currentBlueprint.userData.itemType);

  // Iterate over existing placed objects in the scene that are buildable
  this.scene.children.forEach(object => {
    if (object.userData.isBuildingPiece && object !== this.currentBlueprint) {
      const existingItemConfig = this.buildableItems.find(i => i.type === object.userData.itemType);
      if (existingItemConfig?.snappingPoints && currentItemConfig?.snappingPoints) {
        existingItemConfig.snappingPoints.forEach(existingSnap => {
          currentItemConfig.snappingPoints.forEach(currentSnap => {
            // Check if snap types are compatible (e.g., currentSnap.connectsTo.includes(existingSnap.type))
            const worldExistingSnapPos = object.localToWorld(existingSnap.localPosition.clone());
            const worldCurrentSnapOffset = this.currentBlueprint.localToWorld(currentSnap.localPosition.clone()).sub(this.currentBlueprint.position);
            const targetBlueprintPos = worldExistingSnapPos.clone().sub(worldCurrentSnapOffset);
            
            const distance = targetBlueprintPos.distanceTo(intersects[0].point); // Distance to mouse raycast point
            if (distance < smallestDistance && distance < SNAP_THRESHOLD) { // SNAP_THRESHOLD is a constant like 0.5
              smallestDistance = distance;
              bestSnapPoint = targetBlueprintPos;
              // Potentially also align rotation based on snap points
            }
          });
        });
      }
    }
  });

  if (bestSnapPoint) {
    this.currentBlueprint.position.copy(bestSnapPoint);
  } else {
    this.currentBlueprint.position.copy(intersects[0].point); // Default to raycast point
  }
  placementValid = true; // Add more validation (collision, support)
} else {
  // ... handle no intersection ...
  placementValid = false;
}
*/
```

This provides a foundation. A full snapping system requires careful management of orientations and connection compatibilities.

Key methods from these systems need to be called within your main game loop (e.g., `requestAnimationFrame` callback).

*   **Crafting System (`CraftingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Call this in your game loop if `craftingSystem.isCrafting` is true and `craftingSystem.currentBlueprint` exists. You'll need to set up a `THREE.Raycaster` typically originating from the center of your camera.

    ```javascript
    // In your game loop
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (craftingSystem.isCrafting && craftingSystem.currentBlueprint) {
            // Assuming 'camera' is your THREE.PerspectiveCamera
            // and 'raycaster' is a THREE.Raycaster instance
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            craftingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

*   **Building System (`BuildingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Similar to the crafting system, call this in your game loop if `buildingSystem.isBuilding` is true and `buildingSystem.currentBlueprint` exists. The raycaster setup would be the same.

    ```javascript
    // In your game loop (can be combined with crafting check)
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (buildingSystem.isBuilding && buildingSystem.currentBlueprint) {
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            buildingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

### Input Handling

These systems rely on user input (keyboard and mouse clicks) to trigger actions.

1.  **Inventory:** Typically, inventory might be opened/closed with a key (e.g., 'I' or 'Tab'). The `addItem` and `removeItem` methods are called by other systems (like crafting or resource gathering) or game events.

2.  **Crafting System:**
    *   **Toggle Menu:** Bind a key (e.g., 'C') to `craftingSystem.toggleMenu()` or `craftingSystem.openMenu()` / `craftingSystem.closeMenu()`.
    *   **Item Selection:** The `setupUI()` method adds click listeners to crafting item elements. Ensure these elements are correctly set up in your HTML.
    *   **Placement (`place()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `craftingSystem.place()` when `craftingSystem.isCrafting` is true.
    *   **Cancel Placement (`cancelPlacement()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `craftingSystem.cancelPlacement()` when `craftingSystem.isCrafting` is true.

3.  **Building System:**
    *   **Show Menu:** Bind a key (e.g., 'B') to `buildingSystem.showBuildingMenu()`.
    *   **Select Building Type:** The `showBuildingMenu()` sets up a temporary keydown listener for number keys ('1'-'5') to call `buildingSystem.startBuilding(type)`. Ensure no other global listeners interfere.
    *   **Placement (`build()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `buildingSystem.build()` when `buildingSystem.isBuilding` is true.
    *   **Cancel Building (`cancelBuilding()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `buildingSystem.cancelBuilding()` when `buildingSystem.isBuilding` is true.
    *   **Rotate Wall (`rotateWall()`):** Bind a key (e.g., 'R') to `buildingSystem.rotateWall()` when `buildingSystem.isBuilding` and `buildingSystem.buildingType` is 'wall' (or other rotatable types).

**Example Input Setup (Conceptual):**

```javascript
// In your main input handling logic
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c') {
        craftingSystem.toggleMenu();
    }
    if (event.key.toLowerCase() === 'b') {
        if (buildingSystem.isBuildingMenuOpen()) {
            buildingSystem.hideBuildingMenu();
        } else {
            buildingSystem.showBuildingMenu();
        }
    }
    if (craftingSystem.isCrafting) {
        if (event.key.toLowerCase() === 'e') {
            craftingSystem.place();
        }
        if (event.key === 'Escape') {
            craftingSystem.cancelPlacement();
        }
    }
    if (buildingSystem.isBuilding) {
        if (event.key.toLowerCase() === 'e') {
            buildingSystem.build();
        }
        if (event.key === 'Escape') {
            buildingSystem.cancelBuilding();
        }
        if (event.key.toLowerCase() === 'r' && buildingSystem.buildingType === 'wall') { // Check type
            buildingSystem.rotateWall();
        }
    }
});

// For mouse clicks, you might need to check if the click is on the game canvas vs. UI elements.
// Pointer Lock API is often used in Three.js games for camera control, which needs to be managed
// when UI menus are open (e.g., exit pointer lock when a menu opens).
```

### UI Adaptation

The systems expect certain HTML elements to be present for their UI components:

*   **Inventory:** Elements with class `inventory-slot`.
*   **Crafting:** An element with ID `crafting-menu` and an element with ID `crafting-items` within it. A prompt element (e.g., `#interaction-prompt`) for placement messages.
*   **Building:** An element with ID `building-menu` (created dynamically). A prompt element (e.g., `#interaction-prompt`) for building instructions.

You'll need to either:
1.  **Replicate HTML Structure:** Create these HTML elements in your main game's HTML file with the specified IDs and classes.
2.  **Adapt System Code:** Modify the `setupUI`, `updateUI`, `showBuildingMenu`, etc., methods in the systems to work with your existing UI framework or element IDs/classes. This is more flexible if you have an established UI system (e.g., using React, Vue, Svelte, or a custom DOM manipulation library).

**Styling:** Apply CSS to style these UI elements to match your game's aesthetic.

### Dependencies and Configuration

1.  **Three.js:** All systems rely on Three.js. Ensure you have it installed and imported correctly.
    ```bash
    npm install three
    # If using TypeScript
    npm install --save-dev @types/three
    ```
2.  **GLTFLoader:** The `CraftingSystem` uses `GLTFLoader` to load 3D models. Make sure it's available.
    ```javascript
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    ```
3.  **Model Paths:** The `craftingSystem.js` defines `modelPath` for craftable items. Ensure these paths are correct relative to how your project serves static assets.
4.  **Initialization:** Instantiate the systems in your main game setup, passing necessary dependencies:

    ```javascript
    // main.js or game.js
    import * as THREE from 'three';
    import { Inventory } from './modules/ui/wilderness/inventory.js';
    import { CraftingSystem } from './modules/ui/wilderness/craftingSystem.js';
    import { BuildingSystem } from './modules/ui/wilderness/buildingSystem.js';

    // ... scene, camera setup ...

    const inventory = new Inventory();
    // Potentially pass UI elements to Inventory constructor if you modify it

    const buildingSystem = new BuildingSystem(scene, camera, inventory);
    // Consider passing a config for costs, meshes if you want to customize them externally

    const craftingSystem = new CraftingSystem(scene, camera, inventory, buildingSystem);
    // Ensure craftableItems array with modelPaths is configured correctly

    // ... rest of your game initialization ...
    ```

5.  **Global Functions/State (if any):**
    *   The `craftEquipmentItem` method in `CraftingSystem` calls `window.equipWeapon('bow')`. If you use this, ensure this global function exists or modify the call to integrate with your game's equipment system.

By following these guidelines, you can integrate the inventory, crafting, and building systems more smoothly into your Three.js project.

---

## Crafting System (`craftingSystem.js`)

The crafting system allows the player to create new items from resources in their inventory. It handles model loading, UI, resource checking, and item placement/addition.

### Class: `CraftingSystem`

Manages all aspects of crafting.

**Constructor:** `constructor(scene, camera, inventory, buildingSystem)`
-   Initializes core properties: `scene`, `camera`, `inventory`, `buildingSystem`.
-   `isCrafting`: Boolean, true if the player is in crafting/placement mode.
-   `selectedItem`: Object, the currently selected craftable item.
-   `currentBlueprint`: `THREE.Mesh`, the visual blueprint for placeable items.
-   `modelsLoaded`: Boolean, true if all 3D models for craftable items have been loaded.
-   `modelLoadingPromises`: Array of Promises for loading models.
-   `blueprintMaterial`: A semi-transparent blue `THREE.MeshStandardMaterial` for blueprints.
-   `craftableItems`: An array of objects, each defining a craftable item:
    -   `name`: Display name (e.g., 'Bonfire').
    -   `modelPath`: Path to the GLB model file.
    -   `requirements`: Object specifying resource types and amounts (e.g., `{ log: 4, rock: 4 }`).
    -   `scale`: Optional scale factor for the model.
    -   `model`: Stores the loaded `THREE.Group` (model).
    -   `isEquipment`: Optional boolean, true if the item is equipment (added to inventory, not placed).
-   Calls `this.loadModels()` and `this.setupUI()`.

**Methods:**

-   `loadModels(retryCount = 0)`:
    -   Uses `GLTFLoader` to load 3D models for all items in `this.craftableItems`.
    -   Each model load is a Promise stored in `this.modelLoadingPromises`.
    -   Sets `castShadow` and `receiveShadow` for all meshes in the loaded models.
    -   Applies `item.scale` if specified.
    -   Upon successful loading of all models, sets `this.modelsLoaded = true` and calls `this.updateItemAvailability()`.
    -   Includes retry logic (up to `maxRetries = 3`) if model loading fails.

-   `setupUI()`:
    -   Populates the crafting menu (HTML element with ID `crafting-items`) with `div` elements for each craftable item.
    -   Each item element displays its name and resource requirements.
    -   Adds click event listeners to item elements to call `this.selectItem(item.name)`.

-   `toggleMenu()`:
    -   Opens or closes the crafting menu (HTML element with ID `crafting-menu`).
    -   If opening, and `this.isCrafting` is true, it first calls `this.cancelPlacement()`.
    -   If closing, and not entering placement mode, it clears `this.selectedItem`.

-   `openMenu()`:
    -   Closes the building menu if it's open (`this.buildingSystem.cancelBuilding()`).
    -   Displays the crafting menu.
    -   Calls `this.updateItemAvailability()`.
    -   Exits pointer lock if active.

-   `closeMenu(keepSelection = false)`:
    -   Hides the crafting menu.
    -   If `keepSelection` is false (default), clears `this.selectedItem` and removes the 'selected' class from UI elements.

-   `craftEquipmentItem(item)`:
    -   Handles the crafting of items marked with `isEquipment: true`.
    -   Checks resource requirements using `this.canCraft(item)`.
    -   Consumes resources from inventory using `this.inventory.removeItem()`.
    -   Adds the crafted item to inventory using `this.inventory.addItem()` (e.g., adds 20 arrows if `item.name` is 'Arrow').
    -   Closes the crafting menu.
    -   If the item is a 'bow', calls `window.equipWeapon('bow')` if available.

-   `updateItemAvailability()`:
    -   Updates the visual state (opacity, cursor, requirements text) of items in the crafting menu UI.
    -   If models are not yet loaded, items appear disabled with a 'Loading model...' message.
    -   If models are loaded, checks resource availability using `this.canCraft(item)` to enable/disable items.

-   `canCraft(item)`:
    -   Checks if the player can craft a given `item`.
    -   Returns `false` if `this.modelsLoaded` is false.
    -   Returns `false` if the player's inventory (`this.inventory.getItemCount(resource)`) does not meet the `item.requirements`.
    -   Returns `true` otherwise.

-   `reloadModels()`:
    -   A manual method to re-trigger model loading. Resets `this.modelsLoaded` and calls `this.loadModels(0)`.

-   `selectItem(itemName)`:
    -   Called when a player clicks an item in the crafting menu.
    -   Finds the `item` object in `this.craftableItems`.
    -   Checks if models are loaded and if the item model itself is loaded.
    -   Checks if the item can be crafted using `this.canCraft(item)`.
    -   Updates UI to highlight the selected item.
    -   Sets `this.selectedItem = item`.
    -   If `item.isEquipment` is true, calls `this.craftEquipmentItem(item)`.
    -   Otherwise (for placeable items), calls `this.closeMenu(true)` (keeping selection) and `this.startPlacement()`.

-   `startPlacement()`:
    -   Initiates the placement mode for a selected placeable item.
    -   Requires `this.selectedItem` and `this.selectedItem.model` to be valid.
    -   Sets `this.isCrafting = true`.
    -   Clones `this.selectedItem.model` to create `this.currentBlueprint`.
    -   Applies `this.selectedItem.scale` to the blueprint if specified.
    -   Applies `this.blueprintMaterial` to all meshes in the blueprint.
    -   Adds `this.currentBlueprint` to the scene.
    -   Displays a placement prompt (e.g., 'Press E to place, Escape to cancel').

-   `updateBlueprintPosition(raycaster)`:
    -   Called in the game loop when `this.isCrafting` and `this.currentBlueprint` are active.
    -   Uses the provided `raycaster` (set from camera center) to find an intersection point on the ground or other objects.
    -   Positions `this.currentBlueprint` at the intersection point.
    -   Rotates the blueprint to face the player (Y-axis only) using `this.currentBlueprint.lookAt()`.

-   `place()`:
    -   Finalizes the placement of a crafted item.
    -   Requires `this.isCrafting` to be true.
    -   Checks resource requirements again using `this.canCraft(this.selectedItem)`.
    -   Consumes resources from inventory.
    -   Creates a new instance of the `this.selectedItem.model` (cloned).
    -   Positions and rotates the new instance based on `this.currentBlueprint`.
    -   Adds the new instance to the scene.
    -   Removes `this.currentBlueprint` from the scene.
    -   Resets crafting state: `this.isCrafting = false`, `this.currentBlueprint = null`, `this.selectedItem = null`.
    -   Hides the placement prompt.

-   `cancelPlacement()`:
    -   Cancels the current placement mode.
    -   Removes `this.currentBlueprint` from the scene if it exists.
    -   Resets crafting state: `this.isCrafting = false`, `this.currentBlueprint = null`, `this.selectedItem = null`.
    -   Hides the placement prompt.

---

## Integration Guide

This section provides guidance on integrating the Wilderness game systems into a larger Three.js project, including tips for TypeScript conversion, game loop integration, UI adaptation, and dependency management.

### TypeScript Conversion

While the provided systems are in JavaScript, converting them to TypeScript can offer benefits like static typing and improved code maintainability. Here's a general approach:

1.  **Setup TypeScript:** Ensure your project has TypeScript configured (`tsconfig.json`).
2.  **Rename Files:** Change `.js` file extensions to `.ts`.
3.  **Add Types:**
    *   Define interfaces or types for complex objects (e.g., `Item`, `CraftableItemConfig`, `BuildingPieceData`).
    *   Add type annotations to function parameters, return values, and class properties.
    *   For Three.js objects (`Scene`, `Camera`, `Mesh`, `Material`, `Raycaster`, `GLTFLoader`, `Group`, `Vector3`, `Quaternion`, `BoxGeometry`), install and use `@types/three`.
4.  **Address Errors:** The TypeScript compiler (`tsc`) will highlight areas needing type adjustments or fixes. Pay attention to:
    *   `any` types: Try to replace them with more specific types.
    *   `null` or `undefined` possibilities: Handle them explicitly.
    *   DOM element interactions: Use appropriate DOM types (e.g., `HTMLElement`, `HTMLDivElement`).

**Example (Inventory Item):**

```typescript
// inventory.ts
import * as THREE from 'three'; // If using Three.js types elsewhere

export interface ItemData {
  type: string;
  quantity: number;
}

export class Item implements ItemData {
  type: string;
  quantity: number;

  constructor(type: string, quantity: number = 1) {
    this.type = type;
    this.quantity = quantity;
  }
}

export interface Slot {
  item: Item | null;
  // ... other slot properties if any
}

export class Inventory {
  public slots: Array<Item | null>;
  public slotElements: HTMLElement[]; // Or more specific type like HTMLDivElement[]
  public unlimitedLogs: boolean;
  public stackSizes: { [key: string]: number };

  constructor() {
    this.slots = new Array(5).fill(null);
    this.slotElements = Array.from(document.querySelectorAll('.inventory-slot')) as HTMLElement[];
    this.unlimitedLogs = false;
    this.stackSizes = { log: 999, axe: 1 };
    // ... rest of the constructor
  }

  addItem(item: ItemData | string, count: number = 1): boolean {
    // ... implementation with type safety ...
    this.updateUI();
    return true; // or false
  }

  // ... other methods with type annotations ...
  updateUI(): void {
    this.slotElements.forEach((slotElement, index) => {
      const item = this.slots[index];
      if (item) {
        slotElement.textContent = `${item.type} (${item.quantity})`;
      } else {
        slotElement.textContent = '';
      }
    });
    console.log('Logs:', this.getItemCount('log'));
    console.log('Rocks:', this.getItemCount('rock'));
  }

  getItemCount(itemType: string): number {
    if (this.unlimitedLogs && itemType === 'log') return 999;
    return this.slots.reduce((total, item) => {
      if (item && item.type === itemType) {
        return total + item.quantity;
      }
      return total;
    }, 0);
  }
}
```

**Example (Crafting System Configuration):**

```typescript
// craftingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory, ItemData } from './inventory'; // Assuming inventory.ts is in the same directory

export interface CraftingRecipeIngredient {
  type: string;
  quantity: number;
}

export interface CraftableItemConfig {
  name: string;
  type: string; // Unique identifier for the item type
  modelPath: string;
  scale?: THREE.Vector3; // Optional scale for the blueprint/placed model
  offset?: THREE.Vector3; // Optional offset for the blueprint/placed model
  ingredients: CraftingRecipeIngredient[];
  category: 'tools' | 'structures' | 'resources'; // Example categories
  description: string;
  // Callback for when the item is successfully crafted and placed
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class CraftingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public craftableItems: CraftableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isCrafting: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    // Define craftable items with type safety
    this.craftableItems = [
      {
        name: 'Axe',
        type: 'axe',
        modelPath: 'models/axe.glb',
        scale: new THREE.Vector3(0.5, 0.5, 0.5),
        ingredients: [
          { type: 'log', quantity: 2 },
          { type: 'rock', quantity: 1 },
        ],
        category: 'tools',
        description: 'A basic axe for chopping wood.',
        onPlace: (position, rotation, model) => {
          console.log(`Axe placed at ${position.toArray()} with rotation ${rotation.toArray()}`);
          // Additional logic: add to player's tools, etc.
        }
      },
      {
        name: 'Bonfire',
        type: 'bonfire',
        modelPath: 'models/bonfire.glb',
        ingredients: [
          { type: 'log', quantity: 5 },
          { type: 'rock', quantity: 3 },
        ],
        category: 'structures',
        description: 'Provides light and warmth.',
        onPlace: (position, rotation, model) => {
            // Example: Start fire particle effect
            // model.userData.isLit = true;
        }
      },
      // ... more craftable items
    ];

    this.setupUI();
  }

  // Method to start crafting a specific item type
  public startCrafting(itemType: string): void {
    const itemConfig = this.craftableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Crafting item type ${itemType} not found.`);
      return;
    }

    // Check if player has ingredients
    const hasAllIngredients = itemConfig.ingredients.every(ingredient => {
      return this.inventory.getItemCount(ingredient.type) >= ingredient.quantity;
    });

    if (!hasAllIngredients) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough ingredients!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isCrafting = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      // Apply a semi-transparent material to the blueprint
      this.currentBlueprint.traverse(child => {
        if ((child as THREE.Mesh).isMesh) {
          const meshChild = child as THREE.Mesh;
          const originalMaterial = meshChild.material as THREE.Material | THREE.Material[];
          if (Array.isArray(originalMaterial)) {
            meshChild.material = originalMaterial.map(mat => this.createBlueprintMaterial(mat));
          } else {
            meshChild.material = this.createBlueprintMaterial(originalMaterial);
          }
        }
      });
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, Esc to cancel.`;
    });
  }

  private createBlueprintMaterial(originalMaterial: THREE.Material): THREE.Material {
    const blueprintMaterial = (originalMaterial as THREE.MeshStandardMaterial).clone(); // Clone to avoid modifying shared materials
    blueprintMaterial.transparent = true;
    blueprintMaterial.opacity = 0.5;
    // You might want to change color as well, e.g., to a ghostly blue
    // if (blueprintMaterial instanceof THREE.MeshStandardMaterial) {
    //   blueprintMaterial.color.set(0x007bff);
    //   blueprintMaterial.emissive.set(0x003366);
    // }
    return blueprintMaterial;
  }

  public updateBlueprintPosition(raycaster: THREE.Raycaster): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const intersects = raycaster.intersectObjects(this.scene.children, true); // Check against all scene objects
    // A more robust solution would be to intersect with a specific ground plane or designated buildable surfaces.
    const groundIntersect = intersects.find(intersect => {
        // Example: only place on objects named 'ground' or with specific userData
        // return intersect.object.name === 'groundPlane';
        return intersect.object.isMesh && intersect.object.name !== this.currentBlueprint?.uuid; // Avoid self-intersection
    });

    if (groundIntersect) {
      this.currentBlueprint.position.copy(groundIntersect.point);
      // Optional: Align to grid or snap to surface normal
      // this.currentBlueprint.quaternion.setFromUnitVectors(THREE.Object3D.DefaultUp, groundIntersect.face.normal);
    } else {
        // If no intersection, keep blueprint at a fixed distance in front of camera
        const distance = 10; // Adjust as needed
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
    }
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isCrafting) return;

    const itemConfig = this.craftableItems.find(item => 
        this.currentBlueprint && 
        (this.currentBlueprint.userData.configType === item.type || 
         (this.currentBlueprint.name.toLowerCase().includes(item.type))) // Fallback if configType not set
    );
    // A better way to link blueprint to config is to store itemType in blueprint.userData when loaded.
    // For this example, we'll assume the currentBlueprint was set by startCrafting(itemType) and we need to find its config.
    // This part needs refinement to robustly get the config for the currentBlueprint.
    // Let's assume we stored the type in userData when creating the blueprint:
    const activeItemType = this.currentBlueprint.userData.itemType as string;
    const activeItemConfig = this.craftableItems.find(item => item.type === activeItemType);

    if (!activeItemConfig) {
        console.error("Could not find item configuration for current blueprint.");
        this.cancelPlacement();
        return;
    }

    // Deduct ingredients
    activeItemConfig.ingredients.forEach(ingredient => {
      this.inventory.removeItem(ingredient.type, ingredient.quantity);
    });

    // Create the final object (clone blueprint, reset material)
    const placedObject = this.currentBlueprint.clone();
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        // Restore original material or set a final material
        // This requires storing original materials or having a standard material for placed items
        // For simplicity, let's just make it non-transparent
        const finalMaterial = (meshChild.material as THREE.Material).clone();
        finalMaterial.transparent = false;
        finalMaterial.opacity = 1;
        meshChild.material = finalMaterial;
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null;
    this.isCrafting = false;

    if (activeItemConfig.onPlace) {
      activeItemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${activeItemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isCrafting = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    const craftingItemsContainer = document.getElementById('crafting-items');
    if (!craftingMenu || !craftingItemsContainer) return;

    this.craftableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('crafting-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Requires: ${item.ingredients.map(i => `${i.quantity} ${i.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startCrafting(item.type);
      craftingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const craftingMenu = document.getElementById('crafting-menu');
    if (craftingMenu) {
        craftingMenu.style.display = craftingMenu.style.display === 'none' ? 'block' : 'none';
        if (craftingMenu.style.display === 'block') {
            // Logic to populate/update menu if needed
        } else {
            if (this.isCrafting) this.cancelPlacement(); // Cancel crafting if menu is closed
        }
    }
  }
  // ... other methods like openMenu, closeMenu, etc.
}
```

**Example (Building System Configuration):**

```typescript
// buildingSystem.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Inventory } from './inventory'; // Assuming inventory.ts is in the same directory

export interface BuildingPieceCost {
  type: string; // Item type (e.g., 'log', 'rock')
  quantity: number;
}

export interface BuildableItemConfig {
  name: string;
  type: string; // Unique identifier for the building piece type
  modelPath: string;
  scale?: THREE.Vector3;
  offset?: THREE.Vector3; // Offset for the blueprint model relative to placement point
  costs: BuildingPieceCost[];
  category: 'foundations' | 'walls' | 'roofs' | 'decorations';
  description: string;
  snappingPoints?: { localPosition: THREE.Vector3, type: 'foundation_top' | 'wall_edge' | 'roof_connector' }[]; // For advanced snapping
  allowOverlap?: boolean; // Whether this piece can overlap with others (e.g., decorations)
  requiresSupport?: boolean; // e.g., walls need foundation
  onPlace?: (position: THREE.Vector3, rotation: THREE.Euler, placedObject: THREE.Group) => void;
}

export class BuildingSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private inventory: Inventory;
  private loader: GLTFLoader;
  public buildableItems: BuildableItemConfig[];
  public currentBlueprint: THREE.Group | null = null;
  public isBuilding: boolean = false;
  private raycaster: THREE.Raycaster;
  private interactionPrompt: HTMLElement | null;
  private placementValidMaterial: THREE.Material;
  private placementInvalidMaterial: THREE.Material;

  constructor(scene: THREE.Scene, camera: THREE.Camera, inventory: Inventory) {
    this.scene = scene;
    this.camera = camera;
    this.inventory = inventory;
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.interactionPrompt = document.getElementById('interaction-prompt');

    this.placementValidMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
    this.placementInvalidMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });

    this.buildableItems = [
      {
        name: 'Wooden Foundation',
        type: 'foundation_wood',
        modelPath: 'models/foundation_wood.glb',
        costs: [{ type: 'log', quantity: 4 }],
        category: 'foundations',
        description: 'A simple wooden foundation.',
        onPlace: (pos, rot, obj) => console.log('Foundation placed'),
      },
      {
        name: 'Wooden Wall',
        type: 'wall_wood',
        modelPath: 'models/wall_wood.glb',
        costs: [{ type: 'log', quantity: 2 }],
        category: 'walls',
        description: 'A sturdy wooden wall.',
        requiresSupport: true,
        onPlace: (pos, rot, obj) => console.log('Wall placed'),
      },
      // ... more buildable items
    ];

    this.setupUI(); // Similar to CraftingSystem
  }

  public startBuilding(itemType: string): void {
    const itemConfig = this.buildableItems.find(item => item.type === itemType);
    if (!itemConfig) {
      console.warn(`Building item type ${itemType} not found.`);
      return;
    }

    const hasAllCosts = itemConfig.costs.every(cost => {
      return this.inventory.getItemCount(cost.type) >= cost.quantity;
    });

    if (!hasAllCosts) {
      if (this.interactionPrompt) this.interactionPrompt.textContent = 'Not enough materials!';
      setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
      return;
    }

    this.isBuilding = true;
    this.loader.load(itemConfig.modelPath, (gltf) => {
      this.currentBlueprint = gltf.scene;
      this.currentBlueprint.userData.itemType = itemType; // Store for later reference
      if (itemConfig.scale) this.currentBlueprint.scale.copy(itemConfig.scale);
      if (itemConfig.offset) this.currentBlueprint.position.copy(itemConfig.offset);
      
      this.setBlueprintMaterial(this.placementValidMaterial); // Initially assume valid
      this.scene.add(this.currentBlueprint);
      if (this.interactionPrompt) this.interactionPrompt.textContent = `Placing ${itemConfig.name}. E to place, R to rotate, Esc to cancel.`;
    });
  }

  private setBlueprintMaterial(material: THREE.Material): void {
    if (!this.currentBlueprint) return;
    this.currentBlueprint.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
      }
    });
  }

  public updateBlueprintPositionAndValidation(mousePosition: THREE.Vector2, buildableSurfaces: THREE.Object3D[]): void {
    if (!this.currentBlueprint || !this.isBuilding) return;

    this.raycaster.setFromCamera(mousePosition, this.camera);
    const intersects = this.raycaster.intersectObjects(buildableSurfaces, true);

    let placementValid = false;
    if (intersects.length > 0) {
      const intersect = intersects[0];
      this.currentBlueprint.position.copy(intersect.point);
      // Add snapping logic here if needed (e.g., snap to grid or other pieces)
      // Add collision/overlap detection here
      // For simplicity, let's assume it's valid if it intersects a buildable surface
      placementValid = true; 
      // Example: Check for collisions with existing structures (excluding itself)
      // const colliding = this.checkCollision(this.currentBlueprint, this.scene.children.filter(c => c !== this.currentBlueprint));
      // placementValid = !colliding;
    } else {
        // If no intersection with buildable surface, keep blueprint at a fixed distance or hide
        const distance = 15;
        const targetPosition = new THREE.Vector3();
        this.camera.getWorldDirection(targetPosition);
        targetPosition.multiplyScalar(distance).add(this.camera.position);
        this.currentBlueprint.position.copy(targetPosition);
        placementValid = false;
    }
    this.setBlueprintMaterial(placementValid ? this.placementValidMaterial : this.placementInvalidMaterial);
    this.currentBlueprint.userData.isValidPlacement = placementValid;
  }

  public rotateBlueprint(axis: THREE.Vector3, angle: number): void {
    if (!this.currentBlueprint || !this.isBuilding) return;
    this.currentBlueprint.rotateOnWorldAxis(axis, angle);
    // Re-validate placement after rotation if necessary
  }

  public place(): void {
    if (!this.currentBlueprint || !this.isBuilding || !this.currentBlueprint.userData.isValidPlacement) {
      if (this.interactionPrompt && this.currentBlueprint && !this.currentBlueprint.userData.isValidPlacement) {
        this.interactionPrompt.textContent = 'Cannot place here!';
        setTimeout(() => { if (this.interactionPrompt && this.isBuilding) this.interactionPrompt.textContent = `Placing... E to place, R to rotate, Esc to cancel.`; }, 2000);
      }
      return;
    }

    const itemType = this.currentBlueprint.userData.itemType as string;
    const itemConfig = this.buildableItems.find(item => item.type === itemType);

    if (!itemConfig) {
      console.error("Could not find item configuration for current blueprint.");
      this.cancelPlacement();
      return;
    }

    // Deduct costs
    itemConfig.costs.forEach(cost => {
      this.inventory.removeItem(cost.type, cost.quantity);
    });

    const placedObject = this.currentBlueprint.clone();
    // Reset material to final/default material
    placedObject.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        // Assuming a default material or loading one based on itemConfig
        (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xcccccc }); // Placeholder material
      }
    });
    // The scene already contains the blueprint, which is now the placedObject.
    // We just need to finalize its state.
    this.currentBlueprint = null; // Important: set to null before adding the clone to avoid issues
    this.scene.add(placedObject); // Add the clone as the final object
    this.isBuilding = false;

    if (itemConfig.onPlace) {
      itemConfig.onPlace(placedObject.position.clone(), placedObject.rotation.clone(), placedObject);
    }

    if (this.interactionPrompt) this.interactionPrompt.textContent = `${itemConfig.name} placed!`;
    setTimeout(() => { if (this.interactionPrompt) this.interactionPrompt.textContent = ''; }, 2000);
  }

  public cancelPlacement(): void {
    if (this.currentBlueprint) {
      this.scene.remove(this.currentBlueprint);
      this.currentBlueprint = null;
    }
    this.isBuilding = false;
    if (this.interactionPrompt) this.interactionPrompt.textContent = '';
  }

  private setupUI(): void {
    // Similar to CraftingSystem: create a menu to select buildable items
    const buildingMenu = document.getElementById('building-menu');
    const buildingItemsContainer = document.getElementById('building-items');
    if (!buildingMenu || !buildingItemsContainer) return;

    this.buildableItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('building-item');
      itemDiv.textContent = `${item.name} (${item.description}) - Costs: ${item.costs.map(c => `${c.quantity} ${c.type}`).join(', ')}`;
      itemDiv.onclick = () => this.startBuilding(item.type);
      buildingItemsContainer.appendChild(itemDiv);
    });
  }

  public toggleMenu(): void {
    const buildingMenu = document.getElementById('building-menu');
    if (buildingMenu) {
        buildingMenu.style.display = buildingMenu.style.display === 'none' ? 'block' : 'none';
        if (buildingMenu.style.display === 'block') {
            // Populate/update menu
        } else {
            if (this.isBuilding) this.cancelPlacement();
        }
    }
  }
  // ... other methods
}
```

### Game Loop Integration

**Example (Crafting & Building System Game Loop Update):**

```typescript
// mainGameLoop.ts (or wherever your main update function is)
import * as THREE from 'three';
import { CraftingSystem } from './craftingSystem'; // Adjust path as needed
import { BuildingSystem } from './buildingSystem'; // Adjust path as needed
import { PlayerInput } from './playerInput'; // Assuming a class to handle input

class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private craftingSystem: CraftingSystem;
  private buildingSystem: BuildingSystem;
  private playerInput: PlayerInput;
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private buildableSurfaces: THREE.Object3D[] = []; // Array of objects that can be built upon (e.g., ground, other structures)

  constructor() {
    // ... scene, camera, renderer, inventory initialization ...
    this.scene = new THREE.Scene(); // Placeholder
    this.camera = new THREE.PerspectiveCamera(); // Placeholder
    this.renderer = new THREE.WebGLRenderer(); // Placeholder
    const inventory = {} as any; // Placeholder for Inventory instance

    this.craftingSystem = new CraftingSystem(this.scene, this.camera, inventory);
    this.buildingSystem = new BuildingSystem(this.scene, this.camera, inventory);
    this.playerInput = new PlayerInput(); // Initialize player input handler

    // Example: Add a ground plane to buildable surfaces
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.name = 'groundPlane'; // For identification
    this.scene.add(groundPlane);
    this.buildableSurfaces.push(groundPlane);

    this.setupInputHandlers();
    this.animate();
  }

  private setupInputHandlers(): void {
    window.addEventListener('mousemove', (event) => {
      // Normalize mouse position to range [-1, 1] for both x and y
      this.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Key press handlers (simplified)
    window.addEventListener('keydown', (event) => {
      if (this.playerInput.isKeyPressed('KeyE')) { // E key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.place();
        } else if (this.buildingSystem.isBuilding) {
          this.buildingSystem.place();
        }
      }
      if (this.playerInput.isKeyPressed('KeyR')) { // R key
        if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
            // Example: Rotate around Y axis
            this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4); 
        }
      }
      if (this.playerInput.isKeyPressed('Escape')) { // Escape key
        if (this.craftingSystem.isCrafting) {
          this.craftingSystem.cancelPlacement();
        }
        if (this.buildingSystem.isBuilding) {
          this.buildingSystem.cancelPlacement();
        }
      }
      if (this.playerInput.isKeyPressed('KeyC')) { // C key for crafting menu
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement(); // Close building if opening crafting
      }
      if (this.playerInput.isKeyPressed('KeyB')) { // B key for building menu
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement(); // Close crafting if opening building
      }
    });
  }

  private update(deltaTime: number): void {
    // ... other game logic (player movement, AI, physics, etc.) ...

    // Update crafting system if active
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      // Create a raycaster from camera to mouse position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(this.mousePosition, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }

    // Update building system if active
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      // Pass mouse position and designated buildable surfaces
      this.buildingSystem.updateBlueprintPositionAndValidation(this.mousePosition, this.buildableSurfaces);
    }

    this.playerInput.update(); // Clear pressed keys for next frame
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const deltaTime = 0.016; // Simplified delta time, use a clock in a real app
    this.update(deltaTime);
    this.render();
  }
}

// Initialize the game
const game = new Game();
```

### Robust User Input Handling

**Example (PlayerInput Class for Robust Input Management):**

```typescript
// playerInput.ts
export class PlayerInput {
  private pressedKeys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private justReleasedKeys: Set<string> = new Set();

  private mouseButtonsPressed: Set<number> = new Set();
  private mouseButtonsJustPressed: Set<number> = new Set();
  private mouseButtonsJustReleased: Set<number> = new Set();

  public mousePosition: { x: number, y: number } = { x: 0, y: 0 };
  public mouseDelta: { x: number, y: number } = { x: 0, y: 0 };
  private lastMousePosition: { x: number, y: number } = { x: 0, y: 0 };

  constructor() {
    this.setupKeyboardListeners();
    this.setupMouseListeners();
  }

  private setupKeyboardListeners(): void {
    window.addEventListener('keydown', (event) => {
      if (!this.pressedKeys.has(event.code)) {
        this.justPressedKeys.add(event.code);
      }
      this.pressedKeys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.code);
      this.justReleasedKeys.add(event.code);
    });
  }

  private setupMouseListeners(): void {
    window.addEventListener('mousemove', (event) => {
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;
    });

    window.addEventListener('mousedown', (event) => {
      if (!this.mouseButtonsPressed.has(event.button)) {
        this.mouseButtonsJustPressed.add(event.button);
      }
      this.mouseButtonsPressed.add(event.button);
    });

    window.addEventListener('mouseup', (event) => {
      this.mouseButtonsPressed.delete(event.button);
      this.mouseButtonsJustReleased.add(event.button);
    });

    // Optional: Prevent context menu on right-click if needed for gameplay
    // window.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  // Call this at the end of your game loop's update function
  public update(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseButtonsJustReleased.clear();

    this.mouseDelta.x = this.mousePosition.x - this.lastMousePosition.x;
    this.mouseDelta.y = this.mousePosition.y - this.lastMousePosition.y;
    this.lastMousePosition.x = this.mousePosition.x;
    this.lastMousePosition.y = this.mousePosition.y;
  }

  // Check if a key is currently held down
  public isKeyPressed(keyCode: string): boolean {
    return this.pressedKeys.has(keyCode);
  }

  // Check if a key was pressed in the current frame
  public isKeyJustPressed(keyCode: string): boolean {
    return this.justPressedKeys.has(keyCode);
  }

  // Check if a key was released in the current frame
  public isKeyJustReleased(keyCode: string): boolean {
    return this.justReleasedKeys.has(keyCode);
  }

  // Check if a mouse button is currently held down (0: left, 1: middle, 2: right)
  public isMouseButtonPressed(buttonCode: number): boolean {
    return this.mouseButtonsPressed.has(buttonCode);
  }

  // Check if a mouse button was pressed in the current frame
  public isMouseButtonJustPressed(buttonCode: number): boolean {
    return this.mouseButtonsJustPressed.has(buttonCode);
  }

  // Check if a mouse button was released in the current frame
  public isMouseButtonJustReleased(buttonCode: number): boolean {
    return this.mouseButtonsJustReleased.has(buttonCode);
  }

  // Get normalized mouse position for raycasting ([-1, 1])
  public getNormalizedMousePosition(canvas: HTMLCanvasElement): { x: number, y: number } {
    return {
        x: (this.mousePosition.x / canvas.clientWidth) * 2 - 1,
        y: -(this.mousePosition.y / canvas.clientHeight) * 2 + 1,
    };
  }
}

// Example usage in your main game class (adjust Game class from previous example)
/*
class Game {
  // ... other properties
  private playerInput: PlayerInput;
  private canvas: HTMLCanvasElement;

  constructor() {
    // ... initialization
    this.canvas = this.renderer.domElement; // Assuming renderer is setup
    this.playerInput = new PlayerInput();
    // ... rest of constructor
    this.setupInputHandlers(); // Remove old event listeners, use PlayerInput methods
  }

  private setupInputHandlers(): void {
    // No direct event listeners here anymore if PlayerInput handles them globally
    // Or, pass canvas to PlayerInput if listeners should be canvas-specific
  }

  private update(deltaTime: number): void {
    // ... other game logic ...

    // Example: Using PlayerInput for actions
    if (this.playerInput.isKeyJustPressed('KeyE')) {
      if (this.craftingSystem.isCrafting) this.craftingSystem.place();
      else if (this.buildingSystem.isBuilding) this.buildingSystem.place();
      // else interact(); // General interaction
    }

    if (this.playerInput.isKeyJustPressed('KeyR') && this.buildingSystem.isBuilding) {
        this.buildingSystem.rotateBlueprint(new THREE.Vector3(0,1,0), Math.PI / 4);
    }

    if (this.playerInput.isKeyJustPressed('Escape')) {
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
        // else openPauseMenu();
    }
    
    if (this.playerInput.isKeyJustPressed('KeyC')) {
        this.craftingSystem.toggleMenu();
        if (this.buildingSystem.isBuilding) this.buildingSystem.cancelPlacement();
    }

    if (this.playerInput.isKeyJustPressed('KeyB')) {
        this.buildingSystem.toggleMenu();
        if (this.craftingSystem.isCrafting) this.craftingSystem.cancelPlacement();
    }

    // Update blueprint positions using normalized mouse from PlayerInput
    const normalizedMouse = this.playerInput.getNormalizedMousePosition(this.canvas);
    if (this.craftingSystem.isCrafting && this.craftingSystem.currentBlueprint) {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(normalizedMouse, this.camera);
      this.craftingSystem.updateBlueprintPosition(raycaster);
    }
    if (this.buildingSystem.isBuilding && this.buildingSystem.currentBlueprint) {
      this.buildingSystem.updateBlueprintPositionAndValidation(normalizedMouse, this.buildableSurfaces);
    }

    // IMPORTANT: Call update on PlayerInput at the end of your game update
    this.playerInput.update();
  }
  // ... rest of Game class ...
}
*/
```

### Advanced Customization Examples

This section provides practical examples for extending the Crafting and Building systems.

**1. Custom Callbacks for Crafted/Built Items:**

Leverage the `onPlace` callback in `CraftableItemConfig` and `BuildableItemConfig` for unique behaviors.

```typescript
// --- In craftingSystem.ts or buildingSystem.ts --- 
// (within the craftableItems/buildableItems array definitions)

// Example: A craftable torch that automatically lights up when placed
{
  name: 'Torch',
  type: 'torch',
  modelPath: 'models/torch.glb',
  ingredients: [{ type: 'stick', quantity: 1 }, { type: 'coal', quantity: 1 }],
  category: 'tools',
  description: 'Provides light in dark areas.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Torch placed at ${position.toArray()}`);
    // Assuming the torch model has a PointLight child
    const light = placedObject.getObjectByName('TorchLightSource') as THREE.PointLight;
    if (light) {
      light.intensity = 1.5; // Turn on the light
      light.visible = true;
    }
    placedObject.userData.isLit = true;
    // You might also want to add a particle effect for fire
  }
},

// Example: A buildable trap that becomes active when placed
{
  name: 'Spike Trap',
  type: 'spike_trap',
  modelPath: 'models/spike_trap.glb',
  costs: [{ type: 'log', quantity: 3 }, { type: 'rock', quantity: 2 }],
  category: 'decorations', // Or a new 'traps' category
  description: 'A dangerous trap for unsuspecting creatures.',
  onPlace: (position, rotation, placedObject) => {
    console.log(`Spike Trap armed at ${position.toArray()}`);
    placedObject.userData.isActive = true;
    placedObject.userData.damage = 10; // Custom property
    // Add logic to check for collisions with NPCs/players in game loop
  }
}
```

**2. Dynamic Recipe/Blueprint Modification (e.g., Skill-based):**

Modify recipes or building costs based on player skills or game events.

```typescript
// --- Potentially in a PlayerSkills.ts or GameManager.ts --- 
import { CraftingSystem, CraftableItemConfig } from './craftingSystem';
import { BuildingSystem, BuildableItemConfig } from './buildingSystem';

export class SkillManager {
  private playerSkills: Map<string, number> = new Map(); // e.g., 'woodworking': 1

  constructor() {
    this.playerSkills.set('woodworking', 1);
    this.playerSkills.set('stonemasonry', 0);
  }

  public getSkillLevel(skillName: string): number {
    return this.playerSkills.get(skillName) || 0;
  }

  // Example: Adjust crafting recipe based on skill
  public getModifiedCraftingRecipe(baseRecipe: CraftableItemConfig): CraftableItemConfig {
    const modifiedRecipe = { ...baseRecipe }; // Shallow copy
    modifiedRecipe.ingredients = baseRecipe.ingredients.map(ing => ({ ...ing })); // Deep copy ingredients

    if (baseRecipe.type === 'axe' && this.getSkillLevel('woodworking') > 0) {
      const logIngredient = modifiedRecipe.ingredients.find(ing => ing.type === 'log');
      if (logIngredient) {
        logIngredient.quantity = Math.max(1, logIngredient.quantity - this.getSkillLevel('woodworking')); // Reduce cost
      }
      modifiedRecipe.description += ` (Reduced log cost due to woodworking skill!)`;
    }
    return modifiedRecipe;
  }

  // Example: Adjust building cost based on skill
  public getModifiedBuildingBlueprint(baseBlueprint: BuildableItemConfig): BuildableItemConfig {
    const modifiedBlueprint = { ...baseBlueprint }; // Shallow copy
    modifiedBlueprint.costs = baseBlueprint.costs.map(cost => ({ ...cost })); // Deep copy costs

    if (baseBlueprint.type === 'wall_wood' && this.getSkillLevel('woodworking') >= 2) {
        modifiedBlueprint.description += ' (Reinforced due to advanced woodworking).';
        // Potentially change model or add userData for increased HP
        // modifiedBlueprint.modelPath = 'models/reinforced_wall_wood.glb'; 
    }
    return modifiedBlueprint;
  }
}

// --- In CraftingSystem.ts / BuildingSystem.ts --- 
// When displaying or starting to craft/build, you would fetch the modified config:
// constructor(scene, camera, inventory, private skillManager: SkillManager) { ... }
// 
// public getCraftableItemConfig(itemType: string): CraftableItemConfig | undefined {
//   const baseConfig = this.craftableItems.find(item => item.type === itemType);
//   if (baseConfig) {
//     return this.skillManager.getModifiedCraftingRecipe(baseConfig);
//   }
//   return undefined;
// }
// 
// // Then use this.getCraftableItemConfig(itemType) instead of directly finding in this.craftableItems
```

**3. Advanced Building Snapping Logic:**

The `BuildableItemConfig` can include `snappingPoints`. The `BuildingSystem`'s `updateBlueprintPositionAndValidation` method would need to be enhanced to use these.

```typescript
// --- In BuildableItemConfig --- 
// snappingPoints?: {
//   localPosition: THREE.Vector3; // Position relative to the item's origin
//   type: 'foundation_top' | 'wall_edge_horizontal' | 'wall_edge_vertical' | 'roof_connector';
//   connectsTo?: string[]; // Array of types this point can connect to
// }[];

// --- In BuildingSystem.ts's updateBlueprintPositionAndValidation method (conceptual) ---
/*
if (intersects.length > 0) {
  let bestSnapPoint: THREE.Vector3 | null = null;
  let smallestDistance = Infinity;
  const currentItemConfig = this.buildableItems.find(i => i.type === this.currentBlueprint.userData.itemType);

  // Iterate over existing placed objects in the scene that are buildable
  this.scene.children.forEach(object => {
    if (object.userData.isBuildingPiece && object !== this.currentBlueprint) {
      const existingItemConfig = this.buildableItems.find(i => i.type === object.userData.itemType);
      if (existingItemConfig?.snappingPoints && currentItemConfig?.snappingPoints) {
        existingItemConfig.snappingPoints.forEach(existingSnap => {
          currentItemConfig.snappingPoints.forEach(currentSnap => {
            // Check if snap types are compatible (e.g., currentSnap.connectsTo.includes(existingSnap.type))
            const worldExistingSnapPos = object.localToWorld(existingSnap.localPosition.clone());
            const worldCurrentSnapOffset = this.currentBlueprint.localToWorld(currentSnap.localPosition.clone()).sub(this.currentBlueprint.position);
            const targetBlueprintPos = worldExistingSnapPos.clone().sub(worldCurrentSnapOffset);
            
            const distance = targetBlueprintPos.distanceTo(intersects[0].point); // Distance to mouse raycast point
            if (distance < smallestDistance && distance < SNAP_THRESHOLD) { // SNAP_THRESHOLD is a constant like 0.5
              smallestDistance = distance;
              bestSnapPoint = targetBlueprintPos;
              // Potentially also align rotation based on snap points
            }
          });
        });
      }
    }
  });

  if (bestSnapPoint) {
    this.currentBlueprint.position.copy(bestSnapPoint);
  } else {
    this.currentBlueprint.position.copy(intersects[0].point); // Default to raycast point
  }
  placementValid = true; // Add more validation (collision, support)
} else {
  // ... handle no intersection ...
  placementValid = false;
}
*/
```

This provides a foundation. A full snapping system requires careful management of orientations and connection compatibilities.

Key methods from these systems need to be called within your main game loop (e.g., `requestAnimationFrame` callback).

*   **Crafting System (`CraftingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Call this in your game loop if `craftingSystem.isCrafting` is true and `craftingSystem.currentBlueprint` exists. You'll need to set up a `THREE.Raycaster` typically originating from the center of your camera.

    ```javascript
    // In your game loop
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (craftingSystem.isCrafting && craftingSystem.currentBlueprint) {
            // Assuming 'camera' is your THREE.PerspectiveCamera
            // and 'raycaster' is a THREE.Raycaster instance
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            craftingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

*   **Building System (`BuildingSystem`):**
    *   `updateBlueprintPosition(raycaster)`: Similar to the crafting system, call this in your game loop if `buildingSystem.isBuilding` is true and `buildingSystem.currentBlueprint` exists. The raycaster setup would be the same.

    ```javascript
    // In your game loop (can be combined with crafting check)
    function animate() {
        requestAnimationFrame(animate);

        // ... other game logic ...

        if (buildingSystem.isBuilding && buildingSystem.currentBlueprint) {
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            buildingSystem.updateBlueprintPosition(raycaster);
        }

        // ... rendering ...
    }
    ```

### Input Handling

These systems rely on user input (keyboard and mouse clicks) to trigger actions.

1.  **Inventory:** Typically, inventory might be opened/closed with a key (e.g., 'I' or 'Tab'). The `addItem` and `removeItem` methods are called by other systems (like crafting or resource gathering) or game events.

2.  **Crafting System:**
    *   **Toggle Menu:** Bind a key (e.g., 'C') to `craftingSystem.toggleMenu()` or `craftingSystem.openMenu()` / `craftingSystem.closeMenu()`.
    *   **Item Selection:** The `setupUI()` method adds click listeners to crafting item elements. Ensure these elements are correctly set up in your HTML.
    *   **Placement (`place()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `craftingSystem.place()` when `craftingSystem.isCrafting` is true.
    *   **Cancel Placement (`cancelPlacement()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `craftingSystem.cancelPlacement()` when `craftingSystem.isCrafting` is true.

3.  **Building System:**
    *   **Show Menu:** Bind a key (e.g., 'B') to `buildingSystem.showBuildingMenu()`.
    *   **Select Building Type:** The `showBuildingMenu()` sets up a temporary keydown listener for number keys ('1'-'5') to call `buildingSystem.startBuilding(type)`. Ensure no other global listeners interfere.
    *   **Placement (`build()`):** Bind a key (e.g., 'E' or Left Mouse Click) to `buildingSystem.build()` when `buildingSystem.isBuilding` is true.
    *   **Cancel Building (`cancelBuilding()`):** Bind a key (e.g., 'Escape' or Right Mouse Click) to `buildingSystem.cancelBuilding()` when `buildingSystem.isBuilding` is true.
    *   **Rotate Wall (`rotateWall()`):** Bind a key (e.g., 'R') to `buildingSystem.rotateWall()` when `buildingSystem.isBuilding` and `buildingSystem.buildingType` is 'wall' (or other rotatable types).

**Example Input Setup (Conceptual):**

```javascript
// In your main input handling logic
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'c') {
        craftingSystem.toggleMenu();
    }
    if (event.key.toLowerCase() === 'b') {
        if (buildingSystem.isBuildingMenuOpen()) {
            buildingSystem.hideBuildingMenu();
        } else {
            buildingSystem.showBuildingMenu();
        }
    }
    if (craftingSystem.isCrafting) {
        if (event.key.toLowerCase() === 'e') {
            craftingSystem.place();
        }
        if (event.key === 'Escape') {
            craftingSystem.cancelPlacement();
        }
    }
    if (buildingSystem.isBuilding) {
        if (event.key.toLowerCase() === 'e') {
            buildingSystem.build();
        }
        if (event.key === 'Escape') {
            buildingSystem.cancelBuilding();
        }
        if (event.key.toLowerCase() === 'r' && buildingSystem.buildingType === 'wall') { // Check type
            buildingSystem.rotateWall();
        }
    }
});

// For mouse clicks, you might need to check if the click is on the game canvas vs. UI elements.
// Pointer Lock API is often used in Three.js games for camera control, which needs to be managed
// when UI menus are open (e.g., exit pointer lock when a menu opens).
```

### UI Adaptation

The systems expect certain HTML elements to be present for their UI components:

*   **Inventory:** Elements with class `inventory-slot`.
*   **Crafting:** An element with ID `crafting-menu` and an element with ID `crafting-items` within it. A prompt element (e.g., `#interaction-prompt`) for placement messages.
*   **Building:** An element with ID `building-menu` (created dynamically). A prompt element (e.g., `#interaction-prompt`) for building instructions.

You'll need to either:
1.  **Replicate HTML Structure:** Create these HTML elements in your main game's HTML file with the specified IDs and classes.
2.  **Adapt System Code:** Modify the `setupUI`, `updateUI`, `showBuildingMenu`, etc., methods in the systems to work with your existing UI framework or element IDs/classes. This is more flexible if you have an established UI system (e.g., using React, Vue, Svelte, or a custom DOM manipulation library).

**Styling:** Apply CSS to style these UI elements to match your game's aesthetic.

### Dependencies and Configuration

1.  **Three.js:** All systems rely on Three.js. Ensure you have it installed and imported correctly.
    ```bash
    npm install three
    # If using TypeScript
    npm install --save-dev @types/three
    ```
2.  **GLTFLoader:** The `CraftingSystem` uses `GLTFLoader` to load 3D models. Make sure it's available.
    ```javascript
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
    ```
3.  **Model Paths:** The `craftingSystem.js` defines `modelPath` for craftable items. Ensure these paths are correct relative to how your project serves static assets.
4.  **Initialization:** Instantiate the systems in your main game setup, passing necessary dependencies:

    ```javascript
    // main.js or game.js
    import * as THREE from 'three';
    import { Inventory } from './modules/ui/wilderness/inventory.js';
    import { CraftingSystem } from './modules/ui/wilderness/craftingSystem.js';
    import { BuildingSystem } from './modules/ui/wilderness/buildingSystem.js';

    // ... scene, camera setup ...

    const inventory = new Inventory();
    // Potentially pass UI elements to Inventory constructor if you modify it

    const buildingSystem = new BuildingSystem(scene, camera, inventory);
    // Consider passing a config for costs, meshes if you want to customize them externally

    const craftingSystem = new CraftingSystem(scene, camera, inventory, buildingSystem);
    // Ensure craftableItems array with modelPaths is configured correctly

    // ... rest of your game initialization ...
    ```

5.  **Global Functions/State (if any):**
    *   The `craftEquipmentItem` method in `CraftingSystem` calls `window.equipWeapon('bow')`. If you use this, ensure this global function exists or modify the call to integrate with your game's equipment system.

By following these guidelines, you can integrate the inventory, crafting, and building systems more smoothly into your Three.js project.

---

## Building System (`buildingSystem.js`)

The building system enables players to construct structures like walls, foundations, and roofs using resources.

### Class: `BuildingSystem`

Manages all building-related logic, including blueprint placement, snapping, and resource consumption.

**Constructor:** `constructor(scene, camera, inventory)`
-   Initializes core properties: `scene`, `camera`, `inventory`.
-   `isBuilding`: Boolean, true if the player is in building mode.
-   `currentBlueprint`: `THREE.Mesh`, the visual blueprint for the building part.
-   `buildingType`: String, the type of building part being placed (e.g., 'wall', 'foundation').
-   `blueprintMaterial`: Semi-transparent green `THREE.MeshStandardMaterial` for valid placements.
-   `snapMaterial`: Semi-transparent blue `THREE.MeshStandardMaterial` for when snapping is active.
-   `costs`: Object defining the 'log' cost for each building type (e.g., `wall: 3`).
-   `meshes`: Object mapping building types to `THREE.BoxGeometry` instances defining their shapes and sizes.
-   `keyBindings`: Object mapping keyboard keys ('1'-'5') to building types for selection.
-   `wallsWithWindows`, `wallsWithDoors`: Maps to track windows/doors placed on specific walls.
-   `placedPieces`: Array to store all successfully placed building meshes for snapping and collision.
-   `wallRotationIndex`: Index for current wall rotation (0-3 for 0, 90, 180, 270 degrees).
-   `wallRotations`: Array of radian values for wall rotations.
-   `snapDistance`: Maximum distance for pieces to snap to each other.
-   `isSnapping`: Boolean, true if the blueprint is currently snapping to another piece.
-   `debug`: Boolean flag for enabling console logs.

**Methods:**

-   `showBuildingMenu()`:
    -   Creates and displays a DOM element (`#building-menu`) showing available building options and their keybinds.
    -   Adds a temporary keydown listener to handle building type selection via `this.startBuilding(type)`.

-   `hideBuildingMenu()`:
    -   Removes the `#building-menu` DOM element.
    -   Removes the temporary keydown listener.

-   `isBuildingMenuOpen()`: Returns `true` if the building menu DOM element exists.

-   `startBuilding(type)`:
    -   Initiates building mode for the specified `type`.
    -   Checks if the player has enough 'log' resources based on `this.costs[type]`.
    -   Sets `this.buildingType = type` and `this.isBuilding = true`.
    -   Hides the building menu.
    -   Creates `this.currentBlueprint` (a `THREE.Mesh` using `this.meshes[type]` and `this.blueprintMaterial.clone()`).
    -   Adds the blueprint to the scene.
    -   Calls `this.showBuildingInstructions(type)`.

-   `updateBlueprintPosition(raycaster)`:
    -   Called in the game loop when `this.isBuilding` and `this.currentBlueprint` are active.
    -   Calculates a `targetPosition` in front of the player.
    -   Casts a ray downwards from `targetPosition` to find the ground or other surfaces for initial placement.
    -   **Wall Placement:** Positions wall blueprint vertically (y += 1.5). Rotates based on `this.wallRotationIndex` and camera direction.
    -   **Roof Placement:** Positions roof blueprint at a height (y += 3).
    -   **Window/Door Placement:**
        -   Casts a ray forward from the camera to find a target wall among `this.placedPieces`.
        -   If a wall is hit, positions the window/door blueprint on the wall surface, aligning its rotation.
        -   Stores the target wall in `this.currentBlueprint.userData.targetWall`.
        -   Uses `this.snapMaterial` if on a valid wall, `this.blueprintMaterial` otherwise.
    -   **Snapping Logic:**
        -   Iterates through `this.placedPieces` to find a `closestPiece` within `this.snapDistance` that is compatible (`this.canSnapTo(piece)`).
        -   If a `closestPiece` is found, calls `this.getSnapPosition(closestPiece)` and `this.getSnapRotation(closestPiece)` to adjust the blueprint's position and rotation.
        -   Sets `this.isSnapping = true` and uses `this.snapMaterial`.
        -   If no snap target, uses `this.blueprintMaterial`.

-   `build()`:
    -   Finalizes the placement of the building part.
    -   Requires `this.isBuilding` and `this.currentBlueprint`.
    -   **Window/Door Specific Logic:**
        -   Requires `this.currentBlueprint.userData.targetWall` to be valid.
        -   Calls `this.createWindowOpening()` or `this.createDoorOpening()` to modify the target wall mesh.
        -   Creates a window/door frame using `this.createWindowFrame()` or `this.createDoorFrame()`.
        -   Positions and rotates the frame based on the blueprint.
        -   Adds the frame to `this.placedPieces` and tracks it in `this.wallsWithWindows` or `this.wallsWithDoors`.
        -   Sets `frame.userData.isCollidable` (true for windows, false for doors).
    -   **Normal Building Piece Logic (Wall, Foundation, Roof):**
        -   Creates a new `THREE.Mesh` using `this.meshes[this.buildingType]` and a standard wood material.
        -   Copies position and rotation from `this.currentBlueprint`.
        -   Sets `buildingPiece.userData.buildingType` and `buildingPiece.userData.isCollidable = true`.
        -   Adds the piece to the scene and `this.placedPieces`.
    -   Consumes 'log' resources from inventory using `this.inventory.removeItem()`.
    -   Removes `this.currentBlueprint` from the scene.
    -   Resets building state: `this.isBuilding = false`, `this.buildingType = null`, `this.currentBlueprint = null`, `this.wallRotationIndex = 0`.
    -   Calls `this.hideBuildingInstructions()`.

-   `cancelBuilding()`:
    -   Cancels the current building action.
    -   Removes `this.currentBlueprint` from the scene if it exists.
    -   Resets building state.
    -   Calls `this.hideBuildingInstructions()`.

-   `showBuildingInstructions(type)` / `hideBuildingInstructions()`:
    -   Manages the display of building-related prompts (e.g., 'Press E to place, R to rotate') in the `#interaction-prompt` DOM element.

-   `rotateWall()`:
    -   Called when the player presses 'R' during wall placement.
    -   Cycles `this.wallRotationIndex` through `this.wallRotations`.
    -   Updates `this.currentBlueprint.rotation.y` based on camera direction and the new rotation index.

-   `canSnapTo(piece)`:
    -   Determines if `this.currentBlueprint` (of `this.buildingType`) can snap to an existing `piece` (of `piece.userData.buildingType`).
    -   Defines valid snapping pairs:
        -   Wall to Foundation
        -   Roof to Foundation
        -   Foundation to Foundation

-   `getSnapPosition(piece)`:
    -   Calculates the precise position for `this.currentBlueprint` to snap to the given `piece`.
    -   Logic varies based on `this.buildingType` and `piece.userData.buildingType`:
        -   **Wall to Foundation:** Places wall on the closest edge of the foundation, adjusting height.
        -   **Roof to Foundation:** Places roof directly above the foundation, at the height of a standard wall.
        -   **Foundation to Foundation:** Places new foundation adjacent to the existing one, on the closest edge.

-   `getSnapRotation(piece)`:
    -   Calculates the rotation for `this.currentBlueprint` when snapping to `piece`.
    -   **Wall to Foundation:** Rotates wall to be perpendicular or parallel to the foundation edge it's snapping to.
    -   **Roof to Foundation:** Matches the foundation's rotation.
    -   **Foundation to Foundation:** Matches the existing foundation's rotation.

-   `getPieceSize(type)`:
    -   A helper method that returns an object `{ x, y, z }` representing the dimensions of a given building `type` (based on `this.meshes`).

-   `createWindowFrame()` / `createDoorFrame()`:
    -   Creates `THREE.Group` objects representing window and door frames.
    -   Frames consist of multiple `THREE.BoxGeometry` meshes (top, bottom, left, right pieces) to form the frame structure.
    -   Window frames include a semi-transparent 'glass' plane.
    -   Door frames include a simple 'door panel' mesh.
    -   Frame pieces are designed to match the thickness of a wall (`wallSize.z`).

-   `createWindowOpening(wall, windowPosition)` / `createDoorOpening(wall, doorPosition)`:
    -   Modifies an existing `wall` mesh to create an opening for a window or door at `windowPosition`/`doorPosition`.
    -   This is a complex operation that replaces the original solid wall with a `THREE.Group` (`wallGroup`).
    -   The `wallGroup` contains multiple smaller wall segments (top, bottom, left, right of the opening) that surround the space where the window/door will be.
    -   This approach avoids CSG (Constructive Solid Geometry) operations, which can be problematic, by recomposing the wall.
    -   The original wall is removed from the scene and `this.placedPieces`, and the new `wallGroup` is added.
    -   Returns the new `wallGroup`.

```