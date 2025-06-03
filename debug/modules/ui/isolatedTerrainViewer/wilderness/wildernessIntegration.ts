import * as THREE from 'three';
import { WildernessController } from './wildernessController';
import { WildernessInventory } from './wildernessInventory';
import { WildernessCraftingSystem } from './wildernessCraftingSystem';
import { WildernessBuildingSystem } from './wildernessBuildingSystem';
import { TopElementsData } from '../../../types/renderingTypes';
import { MiningToolType } from '../../../mining/miningSystem';

/**
 * Class for integrating the Wilderness Survival game with the isolatedTerrainViewer
 */
export class WildernessIntegration {
    // Core systems
    private controller: WildernessController | null = null;
    private inventory: WildernessInventory | null = null;
    private craftingSystem: WildernessCraftingSystem | null = null;
    private buildingSystem: WildernessBuildingSystem | null = null;

    // Three.js references
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    // UI elements
    private uiContainer: HTMLElement | null = null;

    // State
    private initialized: boolean = false;
    private animationFrameId: number | null = null;

    /**
     * Create a new WildernessIntegration
     * @param scene The Three.js scene
     * @param camera The Three.js camera
     */
    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera) {
        this.scene = scene;
        this.camera = camera;

        console.log("WildernessIntegration: Created new integration instance");
    }

    /**
     * Initialize the Wilderness Survival game
     * @param container The HTML element to contain the UI
     */
    public init(container: HTMLElement): void {
        if (this.initialized) {
            console.warn("WildernessIntegration: Already initialized");
            return;
        }

        this.uiContainer = container;

        // Create controller
        this.controller = new WildernessController(this.scene, this.camera);

        // Initialize controller
        this.controller.init(this.uiContainer);

        // Start update loop
        this.startUpdateLoop();

        this.initialized = true;
        console.log("WildernessIntegration: Initialized successfully");
    }

    /**
     * Start the update loop
     */
    private startUpdateLoop(): void {
        const update = () => {
            if (!this.initialized || !this.controller) return;

            // Update controller
            this.controller.update();

            // Continue loop
            this.animationFrameId = requestAnimationFrame(update);
        };

        // Start loop
        this.animationFrameId = requestAnimationFrame(update);
    }

    /**
     * Stop the update loop
     */
    private stopUpdateLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Clean up resources when the integration is no longer needed
     */
    public dispose(): void {
        console.log("Disposing WildernessIntegration");

        // Stop update loop
        this.stopUpdateLoop();

        // Dispose controller
        if (this.controller) {
            this.controller.dispose();
            this.controller = null;
        }

        // Clear UI
        if (this.uiContainer) {
            this.uiContainer.innerHTML = '';
        }

        this.initialized = false;
    }

    /**
     * Check if the integration is initialized
     * @returns True if initialized, false otherwise
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get the controller
     * @returns The controller
     */
    public getController(): WildernessController | null {
        return this.controller;
    }

    /**
     * Handle keyboard input
     * @param event The keyboard event
     */
    public handleKeyDown(event: KeyboardEvent): void {
        if (!this.initialized || !this.controller) return;

        // Forward to controller
        // Note: The controller already has its own input handling,
        // but this allows for integration-specific handling if needed
    }

    /**
     * Handle window resize
     */
    public handleResize(): void {
        if (!this.initialized || !this.controller) return;

        // Handle resize if needed
    }

    /**
     * Handle mining at a specific point
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @returns True if mining was successful, false otherwise
     */
    public handleMining(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3
    ): boolean {
        if (!this.initialized || !this.controller) return false;

        return this.controller.handleMining(
            point,
            topElements,
            noiseScale,
            planetOffset
        );
    }

    /**
     * Handle area mining at a specific point
     * @param point The point to mine at
     * @param topElements The top elements data
     * @param noiseScale The noise scale
     * @param planetOffset The planet offset
     * @param brushRadius The brush radius
     * @param brushShape The brush shape
     * @param brushVerticality The brush verticality
     * @returns Object containing success status and adjusted brush parameters
     */
    public handleAreaMining(
        point: THREE.Vector3,
        topElements: TopElementsData,
        noiseScale: number,
        planetOffset: THREE.Vector3,
        brushRadius: number,
        brushShape: 'sphere' | 'cube' | 'cylinder',
        brushVerticality: number
    ): {
        success: boolean,
        adjustedBrushParams: {
            radius: number;
            shape: 'sphere' | 'cube' | 'cylinder';
            verticality: number;
            strengthMultiplier: number;
        }
    } {
        if (!this.initialized || !this.controller) {
            return {
                success: false,
                adjustedBrushParams: {
                    radius: brushRadius,
                    shape: brushShape,
                    verticality: brushVerticality,
                    strengthMultiplier: 1.0
                }
            };
        }

        return this.controller.handleAreaMining(
            point,
            topElements,
            noiseScale,
            planetOffset,
            brushRadius,
            brushShape,
            brushVerticality
        );
    }

    /**
     * Set the active mining tool
     * @param toolType The tool type to set as active
     */
    public setActiveMiningTool(toolType: MiningToolType): void {
        if (!this.initialized || !this.controller) return;

        this.controller.setActiveMiningTool(toolType);
    }

    /**
     * Get the active mining tool
     * @returns The active mining tool
     */
    public getActiveMiningTool(): MiningToolType {
        if (!this.initialized || !this.controller) return MiningToolType.HAND;

        return this.controller.getActiveMiningTool();
    }
}

/**
 * Create and initialize a new WildernessIntegration
 * @param scene The Three.js scene
 * @param camera The Three.js camera
 * @param container The HTML element to contain the UI
 * @returns The initialized WildernessIntegration
 */
export function initWildernessIntegration(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    container: HTMLElement
): WildernessIntegration {
    const integration = new WildernessIntegration(scene, camera);
    integration.init(container);
    return integration;
}

/**
 * Dispose of a WildernessIntegration
 * @param integration The WildernessIntegration to dispose
 */
export function disposeWildernessIntegration(integration: WildernessIntegration): void {
    if (integration) {
        integration.dispose();
    }
}
