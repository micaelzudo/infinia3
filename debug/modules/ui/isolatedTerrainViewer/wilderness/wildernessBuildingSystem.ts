import * as THREE from 'three';
import { WildernessInventory } from './wildernessInventory';

/**
 * Interface for building piece data
 */
export interface BuildingPieceData {
    type: string;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    mesh: THREE.Mesh;
}

/**
 * Class for managing the building system in the Wilderness Survival game
 */
export class WildernessBuildingSystem {
    // Three.js references
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    // Game systems
    private inventory: WildernessInventory;

    // Building state
    public isBuilding: boolean = false;
    public currentBlueprint: THREE.Mesh | null = null;
    public buildingType: string | null = null;

    // Materials
    private blueprintMaterial: THREE.MeshStandardMaterial;
    private snapMaterial: THREE.MeshStandardMaterial;

    // Building costs
    private costs: { [key: string]: number } = {
        foundation: 6,
        wall: 3,
        roof: 4,
        window: 1,
        door: 2
    };

    // Building meshes
    private meshes: { [key: string]: THREE.BoxGeometry } = {};

    // Key bindings
    private keyBindings: { [key: string]: string } = {
        '1': 'foundation',
        '2': 'wall',
        '3': 'roof',
        '4': 'window',
        '5': 'door'
    };

    // Tracking placed pieces
    private wallsWithWindows: Map<THREE.Mesh, THREE.Mesh[]> = new Map();
    private wallsWithDoors: Map<THREE.Mesh, THREE.Mesh[]> = new Map();
    public placedPieces: THREE.Mesh[] = [];

    // Wall rotation
    private wallRotationIndex: number = 0;
    private wallRotations: number[] = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

    // Snapping
    private snapDistance: number = 1.5;
    private isSnapping: boolean = false;

    // Debug
    private debug: boolean = false;

    /**
     * Create a new WildernessBuildingSystem
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

        // Create materials
        this.blueprintMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
            metalness: 0.2
        });

        this.snapMaterial = new THREE.MeshStandardMaterial({
            color: 0x0088ff,
            transparent: true,
            opacity: 0.6,
            roughness: 0.3,
            metalness: 0.2
        });

        // Create building meshes
        this.createBuildingMeshes();

        console.log("WildernessBuildingSystem: Created new building system");
    }

    /**
     * Create the building meshes
     */
    private createBuildingMeshes(): void {
        // Foundation: 4x0.5x4 box
        this.meshes.foundation = new THREE.BoxGeometry(4, 0.5, 4);

        // Wall: 4x3x0.3 box
        this.meshes.wall = new THREE.BoxGeometry(4, 3, 0.3);

        // Roof: 4x0.3x4 box
        this.meshes.roof = new THREE.BoxGeometry(4, 0.3, 4);

        // Window: 1.5x1.5x0.3 box
        this.meshes.window = new THREE.BoxGeometry(1.5, 1.5, 0.3);

        // Door: 1.5x2.5x0.3 box
        this.meshes.door = new THREE.BoxGeometry(1.5, 2.5, 0.3);
    }

    // Reference to the container element for UI
    private uiContainer: HTMLElement | null = null;

    /**
     * Set the UI container for building menus
     * @param container The HTML element to contain the building UI
     */
    public setUIContainer(container: HTMLElement): void {
        this.uiContainer = container;
    }

    /**
     * Show the building menu
     */
    public showBuildingMenu(): void {
        if (!this.uiContainer) {
            console.error("WildernessBuildingSystem: No UI container set for building menu");
            return;
        }

        // Check if menu already exists
        const existingMenu = document.getElementById('building-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // Create building menu element
        const menuElement = document.createElement('div');
        menuElement.id = 'building-menu';
        menuElement.style.position = 'relative';
        menuElement.style.backgroundColor = 'rgba(30, 35, 40, 0.95)';
        menuElement.style.padding = '15px';
        menuElement.style.borderRadius = '8px';
        menuElement.style.color = 'white';
        menuElement.style.border = '1px solid #4a5568';
        menuElement.style.marginBottom = '15px';
        menuElement.style.maxWidth = '350px';
        menuElement.style.margin = '0 auto 15px auto';

        // Create menu title
        const title = document.createElement('h3');
        title.textContent = 'Building Menu';
        title.style.marginTop = '0';
        title.style.marginBottom = '15px';
        title.style.fontSize = '1.1em';
        title.style.borderBottom = '1px solid #4a5568';
        title.style.paddingBottom = '8px';
        menuElement.appendChild(title);

        // Create building options
        const options = [
            { key: '1', type: 'foundation', name: 'Foundation' },
            { key: '2', type: 'wall', name: 'Wall' },
            { key: '3', type: 'roof', name: 'Roof' },
            { key: '4', type: 'window', name: 'Window' },
            { key: '5', type: 'door', name: 'Door' }
        ];

        // Create options grid
        const optionsGrid = document.createElement('div');
        optionsGrid.style.display = 'grid';
        optionsGrid.style.gridTemplateColumns = 'repeat(1, 1fr)';
        optionsGrid.style.gap = '8px';
        optionsGrid.style.marginBottom = '15px';
        menuElement.appendChild(optionsGrid);

        options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.style.padding = '8px 12px';
            optionElement.style.backgroundColor = '#2d3748';
            optionElement.style.borderRadius = '4px';
            optionElement.style.cursor = 'pointer';
            optionElement.style.transition = 'background-color 0.2s';

            // Hover effects
            optionElement.onmouseover = () => optionElement.style.backgroundColor = '#3f4a5c';
            optionElement.onmouseout = () => optionElement.style.backgroundColor = '#2d3748';

            // Click handler
            optionElement.onclick = () => {
                this.startBuilding(option.type);
                this.hideBuildingMenu();
            };

            const keyElement = document.createElement('span');
            keyElement.textContent = `[${option.key}] `;
            keyElement.style.fontWeight = 'bold';
            keyElement.style.color = '#3182ce';

            const nameElement = document.createElement('span');
            nameElement.textContent = option.name;

            const costElement = document.createElement('span');
            costElement.textContent = ` (${this.costs[option.type]} logs)`;
            costElement.style.color = '#a0aec0';

            optionElement.appendChild(keyElement);
            optionElement.appendChild(nameElement);
            optionElement.appendChild(costElement);

            // Check if player has enough resources and style accordingly
            if (this.inventory.getItemCount('log') < this.costs[option.type]) {
                optionElement.style.opacity = '0.5';
                optionElement.style.cursor = 'not-allowed';
                optionElement.onclick = () => {
                    this.showBuildingInstructions(`Not enough logs to build ${option.name}. Need ${this.costs[option.type]} logs.`);
                    setTimeout(() => this.hideBuildingInstructions(), 3000);
                };
            }

            optionsGrid.appendChild(optionElement);
        });

        // Add instructions
        const instructions = document.createElement('p');
        instructions.textContent = 'Press a number key or click an option to select a building type';
        instructions.style.marginTop = '10px';
        instructions.style.fontSize = '0.9em';
        instructions.style.color = '#a0aec0';
        instructions.style.textAlign = 'center';
        menuElement.appendChild(instructions);

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close Menu';
        closeButton.style.display = 'block';
        closeButton.style.width = '100%';
        closeButton.style.padding = '8px';
        closeButton.style.backgroundColor = '#4a5568';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '4px';
        closeButton.style.marginTop = '10px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.hideBuildingMenu();
        menuElement.appendChild(closeButton);

        // Add to UI container
        this.uiContainer.appendChild(menuElement);

        // Add key listener
        const keyListener = (event: KeyboardEvent) => {
            const key = event.key;

            if (this.keyBindings[key]) {
                const type = this.keyBindings[key];
                this.startBuilding(type);
                document.removeEventListener('keydown', keyListener);
            } else if (key === 'Escape') {
                this.hideBuildingMenu();
                document.removeEventListener('keydown', keyListener);
            }
        };

        document.addEventListener('keydown', keyListener);

        console.log("WildernessBuildingSystem: Showing building menu");
    }

    /**
     * Hide the building menu
     */
    public hideBuildingMenu(): void {
        const menuElement = document.getElementById('building-menu');
        if (menuElement && menuElement.parentElement) {
            menuElement.parentElement.removeChild(menuElement);
        }

        console.log("WildernessBuildingSystem: Hiding building menu");
    }

    /**
     * Check if the building menu is open
     * @returns True if the building menu is open, false otherwise
     */
    public isBuildingMenuOpen(): boolean {
        return document.getElementById('building-menu') !== null;
    }

    /**
     * Start building a specific type of structure
     * @param type The type of structure to build
     */
    public startBuilding(type: string): void {
        // Check if player has enough resources
        const cost = this.costs[type];
        if (this.inventory.getItemCount('log') < cost) {
            console.log(`WildernessBuildingSystem: Not enough logs to build ${type}`);
            this.showBuildingInstructions(`Not enough logs to build ${type}. Need ${cost} logs.`);
            setTimeout(() => this.hideBuildingInstructions(), 3000);
            return;
        }

        this.buildingType = type;
        this.isBuilding = true;

        // Hide building menu
        this.hideBuildingMenu();

        // Create blueprint
        const geometry = this.meshes[type];
        const material = this.blueprintMaterial.clone();

        this.currentBlueprint = new THREE.Mesh(geometry, material);
        this.scene.add(this.currentBlueprint);

        // Show building instructions
        this.showBuildingInstructions(type);

        console.log(`WildernessBuildingSystem: Started building ${type}`);
    }
    /**
     * Update the position of the blueprint based on raycaster
     * @param raycaster The raycaster to use for positioning
     */
    public updateBlueprintPosition(raycaster: THREE.Raycaster): void {
        if (!this.isBuilding || !this.currentBlueprint || !this.buildingType) return;

        // Calculate target position in front of player
        const targetPosition = new THREE.Vector3(0, 0, -5).applyQuaternion(this.camera.quaternion).add(this.camera.position);

        // Cast ray downward from target position to find ground
        const downRaycaster = new THREE.Raycaster(
            new THREE.Vector3(targetPosition.x, targetPosition.y + 10, targetPosition.z),
            new THREE.Vector3(0, -1, 0)
        );

        // Get all intersections
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
            const intersect = filteredIntersects[0];

            // Handle different building types
            switch (this.buildingType) {
                case 'wall':
                    // Position wall vertically
                    this.currentBlueprint.position.copy(intersect.point);
                    this.currentBlueprint.position.y += 1.5; // Half height of wall

                    // Rotate wall based on camera direction and wall rotation index
                    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                    cameraDirection.y = 0;
                    cameraDirection.normalize();

                    const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
                    this.currentBlueprint.rotation.y = angle + this.wallRotations[this.wallRotationIndex];
                    break;

                case 'foundation':
                    // Position foundation on ground
                    this.currentBlueprint.position.copy(intersect.point);
                    this.currentBlueprint.position.y += 0.25; // Half height of foundation
                    break;

                case 'roof':
                    // Position roof at a height
                    this.currentBlueprint.position.copy(intersect.point);
                    this.currentBlueprint.position.y += 3; // Height of wall
                    break;

                case 'window':
                case 'door':
                    // Try to find a wall to place window/door on
                    const wallIntersects = raycaster.intersectObjects(
                        this.placedPieces.filter(piece => piece.userData.buildingType === 'wall'),
                        false
                    );

                    if (wallIntersects.length > 0) {
                        const wallIntersect = wallIntersects[0];
                        const wall = wallIntersect.object as THREE.Mesh;

                        // Position window/door on wall
                        this.currentBlueprint.position.copy(wallIntersect.point);

                        // Match wall rotation
                        this.currentBlueprint.rotation.copy(wall.rotation);

                        // Store target wall in userData
                        this.currentBlueprint.userData.targetWall = wall;

                        // Use snap material to indicate valid placement
                        this.currentBlueprint.material = this.snapMaterial;
                    } else {
                        // No wall found, position in front of player
                        this.currentBlueprint.position.copy(intersect.point);

                        // Reset target wall
                        this.currentBlueprint.userData.targetWall = null;

                        // Use blueprint material to indicate invalid placement
                        this.currentBlueprint.material = this.blueprintMaterial;
                    }
                    break;
            }

            // Check for snapping to existing pieces
            this.isSnapping = false;
            let closestPiece: THREE.Mesh | null = null;
            let closestDistance = this.snapDistance;

            for (const piece of this.placedPieces) {
                if (!this.canSnapTo(piece)) continue;

                const distance = this.currentBlueprint.position.distanceTo(piece.position);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPiece = piece;
                }
            }

            if (closestPiece) {
                // Snap to closest piece
                const snapPosition = this.getSnapPosition(closestPiece);
                this.currentBlueprint.position.copy(snapPosition);

                const snapRotation = this.getSnapRotation(closestPiece);
                this.currentBlueprint.rotation.copy(snapRotation);

                this.isSnapping = true;

                // Use snap material
                if (this.currentBlueprint.material !== this.snapMaterial) {
                    this.currentBlueprint.material = this.snapMaterial;
                }
            } else if (this.currentBlueprint.material === this.snapMaterial &&
                      !this.currentBlueprint.userData.targetWall) {
                // Reset to blueprint material if not snapping and not on a wall
                this.currentBlueprint.material = this.blueprintMaterial;
            }
        }
    }

    /**
     * Build the current structure
     */
    public build(): void {
        if (!this.isBuilding || !this.currentBlueprint || !this.buildingType) {
            console.error("WildernessBuildingSystem: Cannot build - not in building mode or no blueprint");
            return;
        }

        // Check if player has enough resources
        const cost = this.costs[this.buildingType];
        if (this.inventory.getItemCount('log') < cost) {
            console.log(`WildernessBuildingSystem: Not enough logs to build ${this.buildingType}`);
            this.cancelBuilding();
            return;
        }

        // Special handling for windows and doors
        if (this.buildingType === 'window' || this.buildingType === 'door') {
            const targetWall = this.currentBlueprint.userData.targetWall as THREE.Mesh;
            if (!targetWall) {
                console.log(`WildernessBuildingSystem: Cannot place ${this.buildingType} - no target wall`);
                return;
            }

            // Create opening in wall
            const wallGroup = this.buildingType === 'window'
                ? this.createWindowOpening(targetWall, this.currentBlueprint.position.clone())
                : this.createDoorOpening(targetWall, this.currentBlueprint.position.clone());

            // Create frame
            const frame = this.buildingType === 'window'
                ? this.createWindowFrame()
                : this.createDoorFrame();

            // Position and rotate frame
            frame.position.copy(this.currentBlueprint.position);
            frame.rotation.copy(this.currentBlueprint.rotation);

            // Add to scene
            this.scene.add(frame);

            // Add to placed pieces
            this.placedPieces.push(frame as unknown as THREE.Mesh);

            // Track windows/doors on walls
            if (this.buildingType === 'window') {
                if (!this.wallsWithWindows.has(wallGroup)) {
                    this.wallsWithWindows.set(wallGroup, []);
                }
                this.wallsWithWindows.get(wallGroup)!.push(frame as unknown as THREE.Mesh);

                // Set as collidable
                frame.userData.isCollidable = true;
            } else {
                if (!this.wallsWithDoors.has(wallGroup)) {
                    this.wallsWithDoors.set(wallGroup, []);
                }
                this.wallsWithDoors.get(wallGroup)!.push(frame as unknown as THREE.Mesh);

                // Set as non-collidable (can walk through doors)
                frame.userData.isCollidable = false;
            }
        } else {
            // Create building piece
            const material = new THREE.MeshStandardMaterial({
                color: 0x8b4513, // Brown for wood
                roughness: 0.8,
                metalness: 0.2
            });

            const buildingPiece = new THREE.Mesh(this.meshes[this.buildingType], material);
            buildingPiece.position.copy(this.currentBlueprint.position);
            buildingPiece.rotation.copy(this.currentBlueprint.rotation);

            // Add metadata
            buildingPiece.userData.buildingType = this.buildingType;
            buildingPiece.userData.isCollidable = true;

            // Add to scene
            this.scene.add(buildingPiece);

            // Add to placed pieces
            this.placedPieces.push(buildingPiece);
        }

        // Consume resources
        this.inventory.removeItem('log', cost);

        // Clean up
        this.scene.remove(this.currentBlueprint);
        this.currentBlueprint = null;
        this.isBuilding = false;
        this.buildingType = null;
        this.wallRotationIndex = 0;

        // Hide building instructions
        this.hideBuildingInstructions();

        console.log(`WildernessBuildingSystem: Built structure`);
    }

    /**
     * Cancel the current building action
     */
    public cancelBuilding(): void {
        if (this.currentBlueprint) {
            this.scene.remove(this.currentBlueprint);
        }

        this.currentBlueprint = null;
        this.isBuilding = false;
        this.buildingType = null;
        this.wallRotationIndex = 0;

        // Hide building instructions
        this.hideBuildingInstructions();

        console.log("WildernessBuildingSystem: Cancelled building");
    }

    /**
     * Show building instructions for a specific type
     * @param type The type of structure being built
     */
    private showBuildingInstructions(type: string): void {
        const promptElement = document.getElementById('interaction-prompt');
        if (!promptElement) return;

        let instructions = 'Press E to build, Escape to cancel';

        if (type === 'wall') {
            instructions += ', R to rotate';
        }

        promptElement.textContent = instructions;
        promptElement.style.display = 'block';
    }

    /**
     * Hide building instructions
     */
    private hideBuildingInstructions(): void {
        const promptElement = document.getElementById('interaction-prompt');
        if (promptElement) {
            promptElement.style.display = 'none';
        }
    }

    /**
     * Rotate the current wall
     */
    public rotateWall(): void {
        if (!this.isBuilding || !this.currentBlueprint || this.buildingType !== 'wall') return;

        // Cycle through wall rotations
        this.wallRotationIndex = (this.wallRotationIndex + 1) % this.wallRotations.length;

        // Update wall rotation
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
        this.currentBlueprint.rotation.y = angle + this.wallRotations[this.wallRotationIndex];

        console.log(`WildernessBuildingSystem: Rotated wall to index ${this.wallRotationIndex}`);
    }

    /**
     * Check if a building piece can snap to another piece
     * @param piece The piece to check for snapping
     * @returns True if the pieces can snap together, false otherwise
     */
    private canSnapTo(piece: THREE.Mesh): boolean {
        if (!this.buildingType || !piece.userData.buildingType) return false;

        // Define valid snapping pairs
        const validPairs: { [key: string]: string[] } = {
            wall: ['foundation'],
            roof: ['foundation'],
            foundation: ['foundation']
        };

        return validPairs[this.buildingType]?.includes(piece.userData.buildingType);
    }

    /**
     * Get the snap position for a building piece
     * @param piece The piece to snap to
     * @returns The position to snap to
     */
    private getSnapPosition(piece: THREE.Mesh): THREE.Vector3 {
        if (!this.buildingType || !piece.userData.buildingType) {
            return this.currentBlueprint!.position.clone();
        }

        const position = new THREE.Vector3();

        // Handle different snapping scenarios
        if (this.buildingType === 'wall' && piece.userData.buildingType === 'foundation') {
            // Wall to foundation
            const foundationSize = this.getPieceSize('foundation');
            const wallSize = this.getPieceSize('wall');

            // Find closest edge of foundation
            const relativePos = this.currentBlueprint!.position.clone().sub(piece.position);

            // Determine which edge is closest
            const absX = Math.abs(relativePos.x);
            const absZ = Math.abs(relativePos.z);

            if (absX > absZ) {
                // Snap to X edge
                position.set(
                    piece.position.x + Math.sign(relativePos.x) * foundationSize.x / 2,
                    piece.position.y + foundationSize.y / 2 + wallSize.y / 2,
                    piece.position.z
                );
            } else {
                // Snap to Z edge
                position.set(
                    piece.position.x,
                    piece.position.y + foundationSize.y / 2 + wallSize.y / 2,
                    piece.position.z + Math.sign(relativePos.z) * foundationSize.z / 2
                );
            }
        } else if (this.buildingType === 'roof' && piece.userData.buildingType === 'foundation') {
            // Roof to foundation
            const foundationSize = this.getPieceSize('foundation');
            const roofSize = this.getPieceSize('roof');

            position.set(
                piece.position.x,
                piece.position.y + foundationSize.y / 2 + 3 + roofSize.y / 2, // Wall height (3) + offsets
                piece.position.z
            );
        } else if (this.buildingType === 'foundation' && piece.userData.buildingType === 'foundation') {
            // Foundation to foundation
            const foundationSize = this.getPieceSize('foundation');

            // Find closest edge of foundation
            const relativePos = this.currentBlueprint!.position.clone().sub(piece.position);

            // Determine which edge is closest
            const absX = Math.abs(relativePos.x);
            const absZ = Math.abs(relativePos.z);

            if (absX > absZ) {
                // Snap to X edge
                position.set(
                    piece.position.x + Math.sign(relativePos.x) * foundationSize.x,
                    piece.position.y,
                    piece.position.z
                );
            } else {
                // Snap to Z edge
                position.set(
                    piece.position.x,
                    piece.position.y,
                    piece.position.z + Math.sign(relativePos.z) * foundationSize.z
                );
            }
        } else {
            // Default: no snapping
            position.copy(this.currentBlueprint!.position);
        }

        return position;
    }

    /**
     * Get the snap rotation for a building piece
     * @param piece The piece to snap to
     * @returns The rotation to snap to
     */
    private getSnapRotation(piece: THREE.Mesh): THREE.Euler {
        if (!this.buildingType || !piece.userData.buildingType) {
            return this.currentBlueprint!.rotation.clone();
        }

        const rotation = new THREE.Euler();

        // Handle different snapping scenarios
        if (this.buildingType === 'wall' && piece.userData.buildingType === 'foundation') {
            // Wall to foundation
            const relativePos = this.currentBlueprint!.position.clone().sub(piece.position);

            // Determine which edge is closest
            const absX = Math.abs(relativePos.x);
            const absZ = Math.abs(relativePos.z);

            if (absX > absZ) {
                // Snap to X edge - wall faces inward
                rotation.set(0, relativePos.x > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
            } else {
                // Snap to Z edge - wall faces inward
                rotation.set(0, relativePos.z > 0 ? 0 : Math.PI, 0);
            }
        } else if (this.buildingType === 'roof' && piece.userData.buildingType === 'foundation') {
            // Roof to foundation - match foundation rotation
            rotation.copy(piece.rotation);
        } else if (this.buildingType === 'foundation' && piece.userData.buildingType === 'foundation') {
            // Foundation to foundation - match foundation rotation
            rotation.copy(piece.rotation);
        } else {
            // Default: no rotation snapping
            rotation.copy(this.currentBlueprint!.rotation);
        }

        return rotation;
    }

    /**
     * Get the size of a building piece
     * @param type The type of building piece
     * @returns The size of the piece as a Vector3
     */
    private getPieceSize(type: string): THREE.Vector3 {
        const geometry = this.meshes[type];
        const parameters = geometry.parameters;

        return new THREE.Vector3(
            parameters.width,
            parameters.height,
            parameters.depth
        );
    }

    /**
     * Create a window frame
     * @returns The window frame as a THREE.Group
     */
    private createWindowFrame(): THREE.Group {
        const frame = new THREE.Group();
        const wallSize = this.getPieceSize('wall');
        const windowSize = this.getPieceSize('window');

        // Create frame pieces
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // Brown for wood
            roughness: 0.8,
            metalness: 0.2
        });

        // Top frame
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(windowSize.x, 0.2, wallSize.z),
            frameMaterial
        );
        topFrame.position.y = windowSize.y / 2 - 0.1;
        frame.add(topFrame);

        // Bottom frame
        const bottomFrame = new THREE.Mesh(
            new THREE.BoxGeometry(windowSize.x, 0.2, wallSize.z),
            frameMaterial
        );
        bottomFrame.position.y = -windowSize.y / 2 + 0.1;
        frame.add(bottomFrame);

        // Left frame
        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, windowSize.y - 0.4, wallSize.z),
            frameMaterial
        );
        leftFrame.position.x = -windowSize.x / 2 + 0.1;
        frame.add(leftFrame);

        // Right frame
        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, windowSize.y - 0.4, wallSize.z),
            frameMaterial
        );
        rightFrame.position.x = windowSize.x / 2 - 0.1;
        frame.add(rightFrame);

        // Glass
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.3,
            roughness: 0.0,
            metalness: 0.8
        });

        const glass = new THREE.Mesh(
            new THREE.BoxGeometry(windowSize.x - 0.4, windowSize.y - 0.4, 0.05),
            glassMaterial
        );
        glass.position.z = -wallSize.z / 4;
        frame.add(glass);

        return frame;
    }

    /**
     * Create a door frame
     * @returns The door frame as a THREE.Group
     */
    private createDoorFrame(): THREE.Group {
        const frame = new THREE.Group();
        const wallSize = this.getPieceSize('wall');
        const doorSize = this.getPieceSize('door');

        // Create frame pieces
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // Brown for wood
            roughness: 0.8,
            metalness: 0.2
        });

        // Top frame
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(doorSize.x, 0.2, wallSize.z),
            frameMaterial
        );
        topFrame.position.y = doorSize.y / 2 - 0.1;
        frame.add(topFrame);

        // Left frame
        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, doorSize.y, wallSize.z),
            frameMaterial
        );
        leftFrame.position.x = -doorSize.x / 2 + 0.1;
        frame.add(leftFrame);

        // Right frame
        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, doorSize.y, wallSize.z),
            frameMaterial
        );
        rightFrame.position.x = doorSize.x / 2 - 0.1;
        frame.add(rightFrame);

        // Door
        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // Brown for wood
            roughness: 0.8,
            metalness: 0.2
        });

        const door = new THREE.Mesh(
            new THREE.BoxGeometry(doorSize.x - 0.4, doorSize.y - 0.2, 0.1),
            doorMaterial
        );
        door.position.z = -wallSize.z / 4;
        door.position.y = -0.1; // Slightly lower to account for no bottom frame
        frame.add(door);

        return frame;
    }

    /**
     * Create a window opening in a wall
     * @param wall The wall to create the opening in
     * @param windowPosition The position of the window
     * @returns The modified wall group
     */
    private createWindowOpening(wall: THREE.Mesh, windowPosition: THREE.Vector3): THREE.Mesh {
        // This is a simplified version - in a real implementation, you would:
        // 1. Remove the original wall from the scene
        // 2. Create a new wall group with an opening
        // 3. Add the new wall group to the scene

        console.log("WildernessBuildingSystem: Creating window opening in wall");

        // For now, just return the original wall
        return wall;
    }

    /**
     * Create a door opening in a wall
     * @param wall The wall to create the opening in
     * @param doorPosition The position of the door
     * @returns The modified wall group
     */
    private createDoorOpening(wall: THREE.Mesh, doorPosition: THREE.Vector3): THREE.Mesh {
        // This is a simplified version - in a real implementation, you would:
        // 1. Remove the original wall from the scene
        // 2. Create a new wall group with an opening
        // 3. Add the new wall group to the scene

        console.log("WildernessBuildingSystem: Creating door opening in wall");

        // For now, just return the original wall
        return wall;
    }

    /**
     * Clean up resources when the system is no longer needed
     */
    public dispose(): void {
        console.log("Disposing WildernessBuildingSystem");

        this.cancelBuilding();

        // Remove all placed pieces from scene
        for (const piece of this.placedPieces) {
            this.scene.remove(piece);
        }

        this.placedPieces = [];
        this.wallsWithWindows.clear();
        this.wallsWithDoors.clear();
    }
}