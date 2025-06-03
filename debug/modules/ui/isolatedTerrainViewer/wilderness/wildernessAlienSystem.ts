import * as THREE from 'three';
import { WildernessInventory } from './wildernessInventory';
import { LogLevel } from '../placeholderTypes';

export interface AlienEncounterConfig {
    spawnChance?: number;
    interactionRadius?: number;
    resourceReward?: Record<string, number>;
}

export class WildernessAlienSystem {
    private scene: THREE.Scene;
    private ufoModel?: THREE.Object3D;
    private inventory: WildernessInventory;
    private config: AlienEncounterConfig;
    private ufoPosition: THREE.Vector3;
    private isActive: boolean;

    constructor(scene: THREE.Scene, inventory: WildernessInventory, config: AlienEncounterConfig = {}) {
        this.scene = scene;
        this.inventory = inventory;
        this.config = {
            spawnChance: config.spawnChance || 0.01,
            interactionRadius: config.interactionRadius || 5,
            resourceReward: config.resourceReward || {
                'alienTech': 1,
                'rareMinerals': 3
            }
        };
        this.ufoPosition = new THREE.Vector3(0, 10, 0);
        this.isActive = false;
    }

    async initializeUFOModel(): Promise<void> {
        // Placeholder for loading UFO 3D model
        const geometry = new THREE.UFOGeometry(2, 1, 2);
        const material = new THREE.MeshStandardMaterial({ color: 0x00FFFF });
        this.ufoModel = new THREE.Mesh(geometry, material);
        this.ufoModel.position.copy(this.ufoPosition);
        this.scene.add(this.ufoModel);
    }

    update(delta: number, playerPosition: THREE.Vector3): void {
        if (!this.isActive) {
            // Random UFO spawn
            if (Math.random() < this.config.spawnChance) {
                this.spawnUFO();
            }
            return;
        }

        // UFO movement logic
        this.ufoPosition.y += Math.sin(delta) * 0.1;
        this.ufoPosition.x += Math.cos(delta) * 0.2;

        if (this.ufoModel) {
            this.ufoModel.position.copy(this.ufoPosition);
        }

        // Check for player interaction
        const distance = this.ufoPosition.distanceTo(playerPosition);
        if (distance <= this.config.interactionRadius) {
            this.handlePlayerInteraction();
        }
    }

    private spawnUFO(): void {
        this.ufoPosition = new THREE.Vector3(
            Math.random() * 100 - 50,
            10 + Math.random() * 20,
            Math.random() * 100 - 50
        );
        this.isActive = true;

        if (this.ufoModel) {
            this.ufoModel.position.copy(this.ufoPosition);
        }
    }

    private handlePlayerInteraction(): void {
        // Reward player with resources
        Object.entries(this.config.resourceReward).forEach(([resource, amount]) => {
            this.inventory.addItem(resource, amount);
        });

        // Despawn UFO
        this.despawnUFO();
    }

    private despawnUFO(): void {
        if (this.ufoModel) {
            this.scene.remove(this.ufoModel);
            this.ufoModel = undefined;
        }
        this.isActive = false;
    }

    dispose(): void {
        this.despawnUFO();
    }
}
