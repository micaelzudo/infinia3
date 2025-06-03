import * as THREE from 'three';
import { WildernessInventory } from './wildernessInventory';
import { WildernessUpgradeSystem } from './wildernessUpgradeSystem';

/**
 * Interface for resource node data
 */
export interface ResourceNodeData {
    type: string;
    position: THREE.Vector3;
    mesh: THREE.Mesh;
    remainingResources: number;
    respawnTime: number;
    lastHarvested: number;
}

/**
 * Class for managing resource collection in the Wilderness Survival game
 */
export class WildernessResourceSystem {
    // Three.js references
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    
    // Game systems
    private inventory: WildernessInventory;
    private upgradeSystem: WildernessUpgradeSystem | null = null;
    
    // Resource nodes
    private resourceNodes: ResourceNodeData[] = [];
    
    // Resource types
    private resourceTypes = ['log', 'rock', 'stick'];
    
    // UI elements
    private interactionPrompt: HTMLElement | null = null;
    
    // State
    private raycaster: THREE.Raycaster;
    private targetNode: ResourceNodeData | null = null;
    
    /**
     * Create a new WildernessResourceSystem
     * @param scene The Three.js scene
     * @param camera The Three.js camera
     * @param inventory The player's inventory
     */
    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
        inventory: WildernessInventory
    ) {
        this.scene = scene;
        this.camera = camera;
        this.inventory = inventory;
        this.raycaster = new THREE.Raycaster();
        
        console.log("WildernessResourceSystem: Created new resource system");
    }
    
    /**
     * Set the upgrade system
     * @param upgradeSystem The upgrade system
     */
    public setUpgradeSystem(upgradeSystem: WildernessUpgradeSystem): void {
        this.upgradeSystem = upgradeSystem;
    }
    
    /**
     * Set the interaction prompt element
     * @param promptElement The interaction prompt element
     */
    public setInteractionPrompt(promptElement: HTMLElement): void {
        this.interactionPrompt = promptElement;
    }
    
    /**
     * Generate resource nodes in the scene
     * @param count The number of nodes to generate
     * @param radius The radius within which to generate nodes
     */
    public generateResourceNodes(count: number, radius: number): void {
        // Clear existing nodes
        this.clearResourceNodes();
        
        // Generate new nodes
        for (let i = 0; i < count; i++) {
            const type = this.resourceTypes[Math.floor(Math.random() * this.resourceTypes.length)];
            
            // Generate random position within radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * radius;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            // Create mesh based on resource type
            let mesh: THREE.Mesh;
            
            switch (type) {
                case 'log':
                    mesh = this.createLogMesh();
                    break;
                case 'rock':
                    mesh = this.createRockMesh();
                    break;
                case 'stick':
                    mesh = this.createStickMesh();
                    break;
                default:
                    mesh = this.createLogMesh();
            }
            
            // Position mesh
            mesh.position.set(x, 0, z);
            
            // Add to scene
            this.scene.add(mesh);
            
            // Create resource node
            const node: ResourceNodeData = {
                type,
                position: new THREE.Vector3(x, 0, z),
                mesh,
                remainingResources: Math.floor(Math.random() * 3) + 3, // 3-5 resources
                respawnTime: 60000, // 60 seconds
                lastHarvested: 0
            };
            
            // Add to resource nodes
            this.resourceNodes.push(node);
            
            // Add metadata to mesh
            mesh.userData.resourceNode = node;
        }
        
        console.log(`WildernessResourceSystem: Generated ${count} resource nodes`);
    }
    
    /**
     * Clear all resource nodes from the scene
     */
    private clearResourceNodes(): void {
        // Remove meshes from scene
        for (const node of this.resourceNodes) {
            this.scene.remove(node.mesh);
        }
        
        // Clear resource nodes array
        this.resourceNodes = [];
    }
    
    /**
     * Create a mesh for a log resource
     * @returns The log mesh
     */
    private createLogMesh(): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    /**
     * Create a mesh for a rock resource
     * @returns The rock mesh
     */
    private createRockMesh(): THREE.Mesh {
        const geometry = new THREE.DodecahedronGeometry(0.8, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.9,
            metalness: 0.1
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    /**
     * Create a mesh for a stick resource
     * @returns The stick mesh
     */
    private createStickMesh(): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6);
        const material = new THREE.MeshStandardMaterial({
            color: 0xa0522d,
            roughness: 0.8,
            metalness: 0.2
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.z = Math.PI / 4;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    /**
     * Update method to be called in the animation loop
     */
    public update(): void {
        // Check for resource node respawns
        const now = Date.now();
        
        for (const node of this.resourceNodes) {
            if (node.remainingResources <= 0 && now - node.lastHarvested > node.respawnTime) {
                // Respawn resources
                node.remainingResources = Math.floor(Math.random() * 3) + 3; // 3-5 resources
                node.mesh.visible = true;
                
                console.log(`WildernessResourceSystem: Respawned ${node.type} node`);
            }
        }
        
        // Cast ray from camera center
        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        
        // Check for intersections with resource nodes
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        // Reset target node
        this.targetNode = null;
        
        // Find closest resource node
        for (const intersect of intersects) {
            let obj: THREE.Object3D | null = intersect.object;
            
            while (obj) {
                if (obj.userData.resourceNode) {
                    const node = obj.userData.resourceNode as ResourceNodeData;
                    
                    if (node.remainingResources > 0) {
                        this.targetNode = node;
                        break;
                    }
                }
                
                obj = obj.parent;
            }
            
            if (this.targetNode) break;
        }
        
        // Update interaction prompt
        this.updateInteractionPrompt();
    }
    
    /**
     * Update the interaction prompt based on the target node
     */
    private updateInteractionPrompt(): void {
        if (!this.interactionPrompt) return;
        
        if (this.targetNode) {
            this.interactionPrompt.textContent = `Press E to collect ${this.targetNode.type}`;
            this.interactionPrompt.style.display = 'block';
        } else {
            this.interactionPrompt.style.display = 'none';
        }
    }
    
    /**
     * Collect resources from the target node
     */
    public collectResources(): void {
        if (!this.targetNode) return;
        
        // Get resource type and count
        const resourceType = this.targetNode.type;
        let resourceCount = 1;
        
        // Apply resource bonus from upgrades
        if (this.upgradeSystem) {
            resourceCount += this.upgradeSystem.getResourceBonus();
        }
        
        // Add to inventory
        this.inventory.addItem(resourceType, resourceCount);
        
        // Update node
        this.targetNode.remainingResources--;
        this.targetNode.lastHarvested = Date.now();
        
        // Hide mesh if no resources left
        if (this.targetNode.remainingResources <= 0) {
            this.targetNode.mesh.visible = false;
        }
        
        console.log(`WildernessResourceSystem: Collected ${resourceCount} ${resourceType}(s)`);
    }
    
    /**
     * Clean up resources when the system is no longer needed
     */
    public dispose(): void {
        this.clearResourceNodes();
    }
}
