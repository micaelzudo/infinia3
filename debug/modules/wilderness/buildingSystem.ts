import * as THREE from 'three';
import { InventorySystem } from './inventorySystem';

/**
 * Building System for the Wilderness Survival Game
 * Handles building construction and placement
 */
export class BuildingSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private inventorySystem: InventorySystem;
    
    // Building state
    private isBuilding: boolean = false;
    private currentBlueprint: THREE.Mesh | null = null;
    private buildingType: string | null = null;
    
    // Building materials
    private blueprintMaterial: THREE.MeshStandardMaterial;
    private snapMaterial: THREE.MeshStandardMaterial;
    private buildingMaterial: THREE.MeshStandardMaterial;
    
    // Building costs
    private costs: Record<string, number> = {
        'wall': 3,
        'foundation': 4,
        'roof': 2,
        'window': 1,
        'door': 2
    };
    
    // Building geometries
    private geometries: Record<string, THREE.BufferGeometry> = {};
    
    // Placed building pieces
    private placedPieces: THREE.Object3D[] = [];
    
    // Wall rotation
    private wallRotationIndex: number = 0;
    private wallRotations: number[] = [0, Math.PI/2, Math.PI, Math.PI*3/2];
    
    // Snapping settings
    private snapDistance: number = 2.0;
    private isSnapping: boolean = false;
    
    // Building UI elements
    private buildingContainer: HTMLElement | null = null;
    private buildingMenu: HTMLElement | null = null;
    private instructionsElement: HTMLElement | null = null;
    
    /**
     * Constructor for the BuildingSystem class
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
        
        // Initialize materials
        this.blueprintMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5
        });
        
        this.snapMaterial = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5
        });
        
        this.buildingMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Initialize geometries
        this.initGeometries();
        
        // Create the building UI
        this.createBuildingUI();
        
        console.log("Building System initialized");
    }
    
    /**
     * Initialize building geometries
     */
    private initGeometries(): void {
        this.geometries = {
            'wall': new THREE.BoxGeometry(2, 3, 0.2),
            'foundation': new THREE.BoxGeometry(2, 0.2, 2),
            'roof': new THREE.BoxGeometry(2, 0.2, 2),
            'window': new THREE.BoxGeometry(0.8, 0.8, 0.1),
            'door': new THREE.BoxGeometry(1, 2, 0.1)
        };
    }
    
    /**
     * Create the building UI
     */
    private createBuildingUI(): void {
        // Create the building section
        const buildingSection = document.createElement('div');
        buildingSection.className = 'wilderness-building-section';
        buildingSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Building';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        buildingSection.appendChild(sectionTitle);

        // Create the building container
        this.buildingContainer = document.createElement('div');
        this.buildingContainer.className = 'wilderness-building-container';
        this.buildingContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.buildingContainer.style.borderRadius = '4px';
        this.buildingContainer.style.padding = '10px';
        buildingSection.appendChild(this.buildingContainer);

        // Create the building buttons
        const buildingButtons = document.createElement('div');
        buildingButtons.className = 'wilderness-building-buttons';
        buildingButtons.style.display = 'flex';
        buildingButtons.style.flexWrap = 'wrap';
        buildingButtons.style.gap = '10px';
        this.buildingContainer.appendChild(buildingButtons);

        // Create buttons for each building type
        const buildingTypes = [
            { id: 'foundation', name: 'Foundation', icon: '⬛', color: '#718096' },
            { id: 'wall', name: 'Wall', icon: '🧱', color: '#e53e3e' },
            { id: 'roof', name: 'Roof', icon: '🔺', color: '#dd6b20' },
            { id: 'window', name: 'Window', icon: '🪟', color: '#3182ce' },
            { id: 'door', name: 'Door', icon: '🚪', color: '#805ad5' }
        ];

        buildingTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'wilderness-building-button';
            button.innerHTML = `<span style="font-size: 16px; margin-right: 5px;">${type.icon}</span> ${type.name}`;
            
            // Style the button
            button.style.display = 'flex';
            button.style.alignItems = 'center';
            button.style.justifyContent = 'center';
            button.style.padding = '8px 12px';
            button.style.backgroundColor = type.color;
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '4px';
            button.style.cursor = 'pointer';
            button.style.fontWeight = 'bold';
            button.style.flex = '1';
            button.style.minWidth = '100px';
            
            // Add hover effect
            button.addEventListener('mouseover', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            });
            
            button.addEventListener('mouseout', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = 'none';
            });
            
            // Add click handler
            button.addEventListener('click', () => {
                this.startBuilding(type.id);
            });
            
            buildingButtons.appendChild(button);
        });

        // Create the instructions element
        this.instructionsElement = document.createElement('div');
        this.instructionsElement.className = 'wilderness-building-instructions';
        this.instructionsElement.style.marginTop = '10px';
        this.instructionsElement.style.padding = '8px';
        this.instructionsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        this.instructionsElement.style.borderRadius = '4px';
        this.instructionsElement.style.textAlign = 'center';
        this.instructionsElement.style.display = 'none';
        this.buildingContainer.appendChild(this.instructionsElement);

        // Add the building section to the content area
        this.contentArea.appendChild(buildingSection);
    }
    
    /**
     * Start building a specific type
     * @param type The building type
     */
    public startBuilding(type: string): void {
        // Check if we have enough resources
        if (!this.inventorySystem.hasItem('wood', this.costs[type])) {
            this.showInstructions(`Need ${this.costs[type]} wood to build ${type}`);
            return;
        }
        
        // Cancel any existing building
        this.cancelBuilding();
        
        // Set building state
        this.buildingType = type;
        this.isBuilding = true;
        
        // Create blueprint
        const geometry = this.geometries[type];
        const blueprint = new THREE.Mesh(geometry, this.blueprintMaterial.clone());
        this.currentBlueprint = blueprint;
        this.scene.add(blueprint);
        
        // Show building instructions
        this.showInstructions(`Click to place ${type}, press ESC to cancel`);
        
        console.log(`Started building ${type}`);
    }
    
    /**
     * Update the blueprint position
     */
    public updateBlueprintPosition(): void {
        if (!this.isBuilding || !this.currentBlueprint || !this.buildingType) return;
        
        // Get camera direction
        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        
        // Set a distance in front of the player
        const placementDistance = 3;
        
        // Calculate position in front of the player
        const targetPosition = new THREE.Vector3();
        targetPosition.copy(this.camera.position);
        targetPosition.addScaledVector(cameraDir, placementDistance);
        
        // Set initial position
        this.currentBlueprint.position.copy(targetPosition);
        
        // Adjust position based on building type
        if (this.buildingType === 'wall') {
            // Adjust height
            this.currentBlueprint.position.y += 1.5; // Half wall height
            
            // Apply wall rotation
            const rotation = this.wallRotations[this.wallRotationIndex];
            this.currentBlueprint.rotation.y = rotation;
        } else if (this.buildingType === 'roof') {
            // Adjust height
            this.currentBlueprint.position.y += 3; // Roof height
        }
        
        // Check for snapping to existing building pieces
        this.checkSnapping();
    }
    
    /**
     * Check for snapping to existing building pieces
     */
    private checkSnapping(): void {
        if (!this.currentBlueprint || !this.buildingType || this.placedPieces.length === 0) return;
        
        this.isSnapping = false;
        
        // Find the closest piece to snap to
        let closestPiece = null;
        let closestDistance = this.snapDistance;
        
        for (const piece of this.placedPieces) {
            // Skip if not compatible for snapping
            if (!this.canSnapTo(piece)) continue;
            
            // Calculate distance
            const distance = this.currentBlueprint.position.distanceTo(piece.position);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestPiece = piece;
            }
        }
        
        // Apply snapping if a close piece was found
        if (closestPiece) {
            // Calculate snap position and rotation
            const snapPosition = this.getSnapPosition(closestPiece);
            const snapRotation = this.getSnapRotation(closestPiece);
            
            // Apply snap
            this.currentBlueprint.position.copy(snapPosition);
            this.currentBlueprint.rotation.copy(snapRotation);
            this.isSnapping = true;
            
            // Change material to indicate snapping
            if (this.currentBlueprint.material !== this.snapMaterial) {
                this.currentBlueprint.material = this.snapMaterial.clone();
            }
        } else {
            // Reset to normal material if not snapping
            if (this.currentBlueprint.material !== this.blueprintMaterial) {
                this.currentBlueprint.material = this.blueprintMaterial.clone();
            }
        }
    }
    
    /**
     * Check if the current blueprint can snap to the given piece
     * @param piece The building piece to check
     * @returns Whether the current blueprint can snap to the piece
     */
    private canSnapTo(piece: THREE.Object3D): boolean {
        if (!piece.userData.buildingType || !this.buildingType) return false;
        
        const pieceType = piece.userData.buildingType;
        
        // Define valid snapping combinations
        if (this.buildingType === 'wall' && pieceType === 'foundation') return true;
        if (this.buildingType === 'roof' && pieceType === 'foundation') return true;
        if (this.buildingType === 'foundation' && pieceType === 'foundation') return true;
        
        return false;
    }
    
    /**
     * Get the snap position for the current blueprint
     * @param piece The piece to snap to
     * @returns The snap position
     */
    private getSnapPosition(piece: THREE.Object3D): THREE.Vector3 {
        const snapPos = new THREE.Vector3();
        
        if (!this.buildingType || !piece.userData.buildingType) return snapPos;
        
        const pieceType = piece.userData.buildingType;
        
        // Start with the piece position
        snapPos.copy(piece.position);
        
        // Wall snapping to foundation
        if (this.buildingType === 'wall' && pieceType === 'foundation') {
            // Place wall on edge of foundation
            snapPos.y += 1.6; // Position at foundation top + half wall height
        }
        // Roof snapping to foundation
        else if (this.buildingType === 'roof' && pieceType === 'foundation') {
            // Position roof above foundation at wall height
            snapPos.y += 3.1; // Foundation + wall height
        }
        // Foundation snapping to foundation
        else if (this.buildingType === 'foundation' && pieceType === 'foundation') {
            // Snap to adjacent position
            snapPos.x += 2; // Foundation width
        }
        
        return snapPos;
    }
    
    /**
     * Get the snap rotation for the current blueprint
     * @param piece The piece to snap to
     * @returns The snap rotation
     */
    private getSnapRotation(piece: THREE.Object3D): THREE.Euler {
        const snapRot = new THREE.Euler();
        
        // Match the piece rotation
        snapRot.copy(piece.rotation);
        
        return snapRot;
    }
    
    /**
     * Place the current building piece
     */
    public build(): void {
        if (!this.isBuilding || !this.currentBlueprint || !this.buildingType) return;
        
        // Create the building piece
        const geometry = this.geometries[this.buildingType];
        const buildingPiece = new THREE.Mesh(geometry, this.buildingMaterial.clone());
        
        // Copy position and rotation from blueprint
        buildingPiece.position.copy(this.currentBlueprint.position);
        buildingPiece.rotation.copy(this.currentBlueprint.rotation);
        
        // Store building type in userData
        buildingPiece.userData.buildingType = this.buildingType;
        
        // Add to scene
        this.scene.add(buildingPiece);
        
        // Add to placed pieces for snapping
        this.placedPieces.push(buildingPiece);
        
        // Remove resources from inventory
        this.inventorySystem.removeItem('wood', this.costs[this.buildingType]);
        
        // Show success message
        this.showInstructions(`${this.buildingType.charAt(0).toUpperCase() + this.buildingType.slice(1)} placed successfully!`);
        
        // Reset building state
        this.scene.remove(this.currentBlueprint);
        this.currentBlueprint = null;
        this.isBuilding = false;
        this.buildingType = null;
        this.wallRotationIndex = 0;
        
        console.log(`Building piece placed. Total pieces: ${this.placedPieces.length}`);
        
        // Hide instructions after a delay
        setTimeout(() => {
            this.hideInstructions();
        }, 2000);
    }
    
    /**
     * Cancel the current building operation
     */
    public cancelBuilding(): void {
        if (this.currentBlueprint) {
            this.scene.remove(this.currentBlueprint);
            this.currentBlueprint = null;
        }
        
        this.isBuilding = false;
        this.buildingType = null;
        this.wallRotationIndex = 0;
        
        this.hideInstructions();
    }
    
    /**
     * Rotate the current wall blueprint
     */
    public rotateWall(): void {
        if (!this.isBuilding || !this.currentBlueprint || this.buildingType !== 'wall') return;
        
        // Cycle through rotation indices
        this.wallRotationIndex = (this.wallRotationIndex + 1) % this.wallRotations.length;
        
        // Apply rotation
        this.currentBlueprint.rotation.y = this.wallRotations[this.wallRotationIndex];
        
        console.log(`Wall rotated to ${this.wallRotationIndex * 90} degrees`);
    }
    
    /**
     * Show building instructions
     * @param text The instructions text
     */
    private showInstructions(text: string): void {
        if (!this.instructionsElement) return;
        
        this.instructionsElement.textContent = text;
        this.instructionsElement.style.display = 'block';
    }
    
    /**
     * Hide building instructions
     */
    private hideInstructions(): void {
        if (!this.instructionsElement) return;
        
        this.instructionsElement.style.display = 'none';
    }
    
    /**
     * Update the building system
     */
    public update(): void {
        if (this.isBuilding) {
            this.updateBlueprintPosition();
        }
    }
    
    /**
     * Dispose of the building system
     */
    public dispose(): void {
        // Remove any active blueprint
        if (this.currentBlueprint) {
            this.scene.remove(this.currentBlueprint);
            this.currentBlueprint = null;
        }
        
        console.log("Building System disposed");
    }
}
