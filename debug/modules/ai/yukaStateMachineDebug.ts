import * as THREE from 'three';
import * as YUKA from '../../../../yuka-master/src/yuka.js';
import { createTextSprite } from '../utils/debugUtils'; // Correct the import path

export interface YukaStateMachineOptions {
    showGraph?: boolean;
    showCurrentState?: boolean;
}

export class YukaStateMachineDebug {
    private agent: YUKA.Vehicle;
    private options: YukaStateMachineOptions;
    private camera: THREE.PerspectiveCamera;
    private rendererDomElement: HTMLElement;
    private scene: THREE.Scene; // Need scene to add sprites

    private currentStateSprite: THREE.Sprite | null = null;
    private graphVisualRoot: THREE.Group | null = null; // For graph visualization

    constructor(
        agent: YUKA.Vehicle, 
        camera: THREE.PerspectiveCamera, 
        rendererDomElement: HTMLElement, 
        scene: THREE.Scene, // Added scene parameter
        options: YukaStateMachineOptions = {}
    ) {
        this.agent = agent;
        this.camera = camera; // Store camera if needed later for graph UI
        this.rendererDomElement = rendererDomElement; // Store if needed later for graph UI
        this.scene = scene; // Store scene
        this.options = {
            showGraph: options.showGraph ?? false,
            showCurrentState: options.showCurrentState ?? false
        };
        this.updateVisuals();
    }

    public toggleGraphVisibility(enable: boolean): void {
        this.options.showGraph = enable;
        this.updateVisuals();
        console.log(`[YukaStateMachineDebug for ${this.agent.uuid}] Graph Visibility Toggled: ${enable}`);
    }

    public toggleCurrentStateVisibility(enable: boolean): void {
        this.options.showCurrentState = enable;
        this.updateVisuals();
        console.log(`[YukaStateMachineDebug for ${this.agent.uuid}] Current State Visibility Toggled: ${enable}`);
    }

    public update(): void {
        // Update current state sprite position and text
        if (this.currentStateSprite && this.options.showCurrentState) {
            const stateMachine = (this.agent as any).stateMachine as YUKA.StateMachine<YUKA.Vehicle>; // Access state machine
            const currentStateName = stateMachine?.currentState?.getName() || 'None'; // Get current state name
            
            // Update sprite text if state changed (need efficient text update)
            if (this.currentStateSprite.userData.text !== currentStateName) {
                 this.removeCurrentStateSprite(); // Remove old one
                 this.createCurrentStateSprite(currentStateName); // Create new one
                 // Note: A more efficient approach would update the canvas texture of the existing sprite.
            }
            
            // Update position to follow agent
            if (this.currentStateSprite) {
                const agentPosition = this.agent.position as unknown as THREE.Vector3;
                this.currentStateSprite.position.copy(agentPosition).add(new THREE.Vector3(0, 1.5, 0)); // Position above agent
                this.currentStateSprite.updateMatrixWorld(); // Ensure transform is updated
            }
        }
    }

    public dispose(): void {
        this.removeCurrentStateSprite();
        this.removeGraphVisual();
        console.log(`[YukaStateMachineDebug for ${this.agent.uuid}] Disposed`);
    }

    private updateVisuals(): void {
        if (this.options.showCurrentState) {
            this.createOrUpdateCurrentStateSprite();
        } else {
            this.removeCurrentStateSprite();
        }

        if (this.options.showGraph) {
            this.createOrUpdateGraphVisual();
        } else {
            this.removeGraphVisual();
        }
    }

    private createOrUpdateCurrentStateSprite(): void {
        const stateMachine = (this.agent as any).stateMachine as YUKA.StateMachine<YUKA.Vehicle>; // Access state machine
        if (!stateMachine) return;

        const currentStateName = stateMachine.currentState?.getName() || 'None';
        if (!this.currentStateSprite) {
            this.createCurrentStateSprite(currentStateName);
        } else {
            // If sprite exists, update() will handle text and position updates.
        }
    }
    
    private createCurrentStateSprite(text: string): void {
        if (this.currentStateSprite) this.removeCurrentStateSprite(); // Ensure only one sprite exists

        this.currentStateSprite = createTextSprite(text, {
            fontsize: 24,
            fontface: 'Arial',
            borderColor: { r: 0, g: 0, b: 255, a: 1.0 }, // Blue border
            backgroundColor: { r: 100, g: 100, b: 255, a: 0.8 } // Light blue background
        });
        this.currentStateSprite.name = `yuka_state_${this.agent.uuid}`;
        this.currentStateSprite.userData.text = text; // Store text for comparison in update
        this.currentStateSprite.center.set(0.5, 0.5); // Center the sprite
        this.currentStateSprite.scale.set(1.5, 0.75, 1.0); // Adjust scale as needed
        
        const agentPosition = this.agent.position as unknown as THREE.Vector3;
        this.currentStateSprite.position.copy(agentPosition).add(new THREE.Vector3(0, 1.5, 0)); // Position above agent

        this.scene.add(this.currentStateSprite);
        console.log(`[YukaStateMachineDebug for ${this.agent.uuid}] Created state sprite: ${text}`);
    }

    private removeCurrentStateSprite(): void {
        if (this.currentStateSprite) {
            if (this.currentStateSprite.parent) {
                this.currentStateSprite.parent.remove(this.currentStateSprite);
            }
            this.currentStateSprite.material.map?.dispose();
            this.currentStateSprite.material.dispose();
            this.currentStateSprite.geometry.dispose();
            this.currentStateSprite = null;
            console.log(`[YukaStateMachineDebug for ${this.agent.uuid}] Removed state sprite.`);
        }
    }

    // --- Graph Visualization Methods (Basic) ---
    private createOrUpdateGraphVisual(): void {
        const stateMachine = (this.agent as any).stateMachine as YUKA.StateMachine<YUKA.Vehicle>; // Access state machine
        if (!stateMachine) {
            console.warn("[YukaStateMachineDebug] No state machine found on agent for graph.");
            return;
        }

        if (!this.graphVisualRoot) {
            this.graphVisualRoot = new THREE.Group();
            this.graphVisualRoot.name = `yuka_fsm_graph_${this.agent.uuid}`;
            this.scene.add(this.graphVisualRoot);
            console.log("[YukaStateMachineDebug] Created graph visual root.");
        } else {
            // Clear previous graph elements if re-creating
            while (this.graphVisualRoot.children.length) {
                const child = this.graphVisualRoot.children[0];
                this.graphVisualRoot.remove(child);
                // Dispose child geometry/material if they are Three.js objects
                if ((child as any).geometry) (child as any).geometry.dispose();
                if ((child as any).material) {
                     if (Array.isArray((child as any).material)) {
                        (child as any).material.forEach((m: THREE.Material) => m.dispose());
                     } else {
                        (child as any).material.dispose();
                     }
                }
            }
        }

        const states = stateMachine.states; // Get the map of states
        let i = 0;
        states.forEach((state, stateName) => {
            console.log(`[YukaStateMachineDebug] Graph: State found - ${stateName}`);
            const stateDisplayName = state.getName ? state.getName() : stateName; // Use getName if available
            
            const stateSprite = createTextSprite(stateDisplayName, {
                fontsize: 20,
                fontface: 'Arial',
                borderColor: { r: 0, g: 255, b: 0, a: 1.0 }, // Green border for states
                backgroundColor: { r: 100, g: 200, b: 100, a: 0.7 }
            });
            stateSprite.position.set(i * 2, 2, 0); // Simple horizontal layout for now
            stateSprite.scale.set(1.2, 0.6, 1.0);
            this.graphVisualRoot.add(stateSprite);
            i++;
        });

        if (i === 0) {
            console.warn("[YukaStateMachineDebug] No states found in state machine to visualize.");
        }
        // TODO: Visualize transitions as lines between state sprites
    }

    private removeGraphVisual(): void {
        if (this.graphVisualRoot) {
            console.log("[YukaStateMachineDebug] Removing graph visual root.");
            
            // Remove children first
            while (this.graphVisualRoot.children.length) {
                const child = this.graphVisualRoot.children[0];
                this.graphVisualRoot.remove(child);
                if (child instanceof THREE.Sprite || child instanceof THREE.Mesh) {
                    child.geometry?.dispose(); 
                    if (child.material) {
                        const mat = child.material as THREE.Material | THREE.Material[];
                        if (Array.isArray(mat)) {
                            mat.forEach(m => m.dispose());
                        } else {
                            mat.dispose();
                        }
                    }
                }
            }

            // Now check parent and remove the root itself
            if (this.graphVisualRoot.parent) { 
                this.graphVisualRoot.parent.remove(this.graphVisualRoot);
            }
            
            this.graphVisualRoot = null;
        }
    }
    // --- End Graph Visualization Methods ---
}

export function setupYukaStateMachineDebug(
    agent: YUKA.Vehicle, 
    camera: THREE.PerspectiveCamera, 
    rendererDomElement: HTMLElement,
    scene: THREE.Scene, // Added scene parameter
    options: YukaStateMachineOptions = {}
) {
    return new YukaStateMachineDebug(agent, camera, rendererDomElement, scene, options);
}
