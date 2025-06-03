import * as THREE from 'three';
import { InventorySystem } from './inventorySystem';

/**
 * Grass System for the Wilderness Survival Game
 * Handles grass placement and interaction for crafting string
 */
export class GrassSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private inventorySystem: InventorySystem;
    
    // Grass instances
    private grassInstances: THREE.Object3D[] = [];
    
    // Crafting state
    private isCrafting: boolean = false;
    private craftingStartTime: number = 0;
    private craftingDuration: number = 2000; // 2 seconds
    private craftingGrass: THREE.Object3D | null = null;
    
    // UI elements
    private grassContainer: HTMLElement | null = null;
    private progressBarContainer: HTMLElement | null = null;
    private progressBar: HTMLElement | null = null;
    private instructionsElement: HTMLElement | null = null;
    
    /**
     * Constructor for the GrassSystem class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     * @param inventorySystem The inventory system
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, contentArea: HTMLElement, inventorySystem: InventorySystem) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;
        this.inventorySystem = inventorySystem;
        
        // Create the grass UI
        this.createGrassUI();
        
        // Add grass to the world
        this.addGrassToWorld();
        
        console.log("Grass System initialized");
    }
    
    /**
     * Create the grass UI
     */
    private createGrassUI(): void {
        // Create the grass section
        const grassSection = document.createElement('div');
        grassSection.className = 'wilderness-grass-section';
        grassSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Plant Fiber Crafting';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        grassSection.appendChild(sectionTitle);

        // Create the grass container
        this.grassContainer = document.createElement('div');
        this.grassContainer.className = 'wilderness-grass-container';
        this.grassContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.grassContainer.style.borderRadius = '4px';
        this.grassContainer.style.padding = '10px';
        grassSection.appendChild(this.grassContainer);

        // Create the instructions element
        this.instructionsElement = document.createElement('div');
        this.instructionsElement.className = 'wilderness-grass-instructions';
        this.instructionsElement.textContent = 'Find grass in the world to craft string';
        this.instructionsElement.style.marginBottom = '10px';
        this.instructionsElement.style.textAlign = 'center';
        this.grassContainer.appendChild(this.instructionsElement);

        // Create the progress bar container
        this.progressBarContainer = document.createElement('div');
        this.progressBarContainer.className = 'wilderness-progress-container';
        this.progressBarContainer.style.height = '20px';
        this.progressBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        this.progressBarContainer.style.borderRadius = '4px';
        this.progressBarContainer.style.overflow = 'hidden';
        this.progressBarContainer.style.display = 'none';
        this.grassContainer.appendChild(this.progressBarContainer);

        // Create the progress bar
        this.progressBar = document.createElement('div');
        this.progressBar.className = 'wilderness-progress-bar';
        this.progressBar.style.height = '100%';
        this.progressBar.style.width = '0%';
        this.progressBar.style.backgroundColor = '#48bb78';
        this.progressBar.style.transition = 'width 0.1s ease';
        this.progressBarContainer.appendChild(this.progressBar);

        // Create the craft button
        const craftButton = document.createElement('button');
        craftButton.className = 'wilderness-craft-button';
        craftButton.textContent = 'Craft String';
        craftButton.style.display = 'block';
        craftButton.style.width = '100%';
        craftButton.style.marginTop = '10px';
        craftButton.style.padding = '8px';
        craftButton.style.backgroundColor = '#48bb78';
        craftButton.style.color = 'white';
        craftButton.style.border = 'none';
        craftButton.style.borderRadius = '4px';
        craftButton.style.cursor = 'pointer';
        craftButton.style.fontWeight = 'bold';
        
        // Add hover effect
        craftButton.addEventListener('mouseover', () => {
            craftButton.style.backgroundColor = '#38a169';
        });
        
        craftButton.addEventListener('mouseout', () => {
            craftButton.style.backgroundColor = '#48bb78';
        });
        
        // Add click handler
        craftButton.addEventListener('click', () => {
            this.simulateCrafting();
        });
        
        this.grassContainer.appendChild(craftButton);

        // Add the grass section to the content area
        this.contentArea.appendChild(grassSection);
    }
    
    /**
     * Add grass to the world
     * @param count The number of grass instances to add
     * @param worldSize The size of the world
     */
    private addGrassToWorld(count: number = 20, worldSize: number = 50): void {
        const worldHalfSize = worldSize / 2;
        
        // Create grass geometry
        const grassGeometry = new THREE.ConeGeometry(0.2, 1, 8);
        const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x7cfc00 });
        
        for (let i = 0; i < count; i++) {
            // Generate random position
            const x = Math.random() * worldSize - worldHalfSize;
            const z = Math.random() * worldSize - worldHalfSize;
            
            // Create grass instance
            const grass = new THREE.Mesh(grassGeometry, grassMaterial);
            
            // Position grass
            grass.position.set(x, 0.5, z); // Half height above ground
            
            // Set grass data
            grass.userData.type = 'grass';
            
            // Add to scene and tracking array
            this.scene.add(grass);
            this.grassInstances.push(grass);
        }
        
        console.log(`Added ${count} grass instances to the world`);
    }
    
    /**
     * Simulate crafting string from grass
     */
    private simulateCrafting(): void {
        if (this.isCrafting) return;
        
        this.isCrafting = true;
        this.craftingStartTime = Date.now();
        
        // Show progress bar
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'block';
        }
        
        // Update instructions
        if (this.instructionsElement) {
            this.instructionsElement.textContent = 'Crafting string from plant fiber...';
        }
        
        console.log('Started crafting string');
    }
    
    /**
     * Update crafting progress
     */
    private updateCrafting(): void {
        if (!this.isCrafting) return;
        
        const now = Date.now();
        const elapsed = now - this.craftingStartTime;
        const progress = Math.min(elapsed / this.craftingDuration, 1);
        
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.style.width = `${progress * 100}%`;
        }
        
        // Check if crafting is complete
        if (progress >= 1) {
            this.completeCrafting();
        }
    }
    
    /**
     * Complete the crafting process
     */
    private completeCrafting(): void {
        if (!this.isCrafting) return;
        
        // Add string to inventory
        this.inventorySystem.addItem('string', 1);
        
        // Hide progress bar
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'none';
        }
        
        // Update instructions
        if (this.instructionsElement) {
            this.instructionsElement.textContent = 'Crafted 1 string!';
            
            // Reset instructions after a delay
            setTimeout(() => {
                if (this.instructionsElement) {
                    this.instructionsElement.textContent = 'Find grass in the world to craft string';
                }
            }, 2000);
        }
        
        // Reset crafting state
        this.isCrafting = false;
        this.craftingGrass = null;
        
        console.log('Crafted 1 string');
    }
    
    /**
     * Cancel crafting
     */
    public cancelCrafting(): void {
        if (!this.isCrafting) return;
        
        // Hide progress bar
        if (this.progressBarContainer) {
            this.progressBarContainer.style.display = 'none';
        }
        
        // Reset instructions
        if (this.instructionsElement) {
            this.instructionsElement.textContent = 'Crafting cancelled';
            
            // Reset instructions after a delay
            setTimeout(() => {
                if (this.instructionsElement) {
                    this.instructionsElement.textContent = 'Find grass in the world to craft string';
                }
            }, 2000);
        }
        
        // Reset crafting state
        this.isCrafting = false;
        this.craftingGrass = null;
        
        console.log('Crafting cancelled');
    }
    
    /**
     * Update the grass system
     */
    public update(): void {
        if (this.isCrafting) {
            this.updateCrafting();
        }
    }
    
    /**
     * Dispose of the grass system
     */
    public dispose(): void {
        // Remove all grass instances
        for (const grass of this.grassInstances) {
            this.scene.remove(grass);
        }
        
        this.grassInstances = [];
        
        console.log("Grass System disposed");
    }
}
