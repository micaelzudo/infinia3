import * as THREE from 'three';
import * as YUKA from '../../../../yuka-master/src/yuka.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'; // Import TransformControls

export interface YukaPathEditorOptions {
    enableUI?: boolean;
    enableHandles?: boolean;
    camera?: THREE.Camera; // Needed for TransformControls
    domElement?: HTMLElement; // Needed for TransformControls
}

export class YukaPathEditor {
    private agent: YUKA.Vehicle;
    private options: YukaPathEditorOptions;
    private scene: THREE.Scene;
    private camera?: THREE.Camera;
    private domElement?: HTMLElement;

    private transformControls: TransformControls | null = null;
    private pathVisualHelper: THREE.LineSegments | null = null; // To visualize the path being edited

    constructor(agent: YUKA.Vehicle, scene: THREE.Scene, options: YukaPathEditorOptions = {}) {
        this.agent = agent;
        this.scene = scene;
        this.options = {
            enableUI: options.enableUI ?? false,
            enableHandles: options.enableHandles ?? false,
        };
        this.camera = options.camera;
        this.domElement = options.domElement;

        this.updateVisuals();
    }

    public toggleUI(enable: boolean): void {
        this.options.enableUI = enable;
        this.updateVisuals();
        console.log(`[YukaPathEditor for ${this.agent.uuid}] UI Toggled: ${enable}`);
        // TODO: Implement actual UI logic (HTML elements)
    }

    public toggleHandles(enable: boolean): void {
        this.options.enableHandles = enable;
        console.log(`[YukaPathEditor for ${this.agent.uuid}] Handles Toggled: ${enable}`);
        this.updateVisuals();
    }

    public update(): void {
        if (this.options.enableHandles && this.transformControls) {
            // Optional: Update transform controls if needed, e.g., reattach if agent moves far
        }
        if (this.options.enableUI) {
             // If path visualization is part of the UI toggle
             this.createOrUpdatePathVisual(); // FIX: Remove leading underscore
        }
    }

    public dispose(): void {
        console.log(`[YukaPathEditor for ${this.agent.uuid}] Disposed`);
        this.removeHandles();
        this.removePathVisual();
        // TODO: Clean up UI elements
    }

    private updateVisuals(): void {
        if (this.options.enableHandles) {
            this.createOrUpdateHandles();
             this.createOrUpdatePathVisual(); // Show path when handles are active
        } else {
            this.removeHandles();
             this.removePathVisual();
        }

        if (this.options.enableUI) {
            // TODO: Show/create path editor UI elements
        } else {
            // TODO: Hide/destroy path editor UI elements
        }
    }

    private createOrUpdateHandles(): void {
        if (!this.camera || !this.domElement) {
            console.warn("[YukaPathEditor] Camera and DOM Element required for TransformControls.");
            return;
        }

        const path = (this.agent as any).currentPath as YUKA.Path; // Access path (might need type assertion or getter)
        if (!path || path.waypoints.length === 0) {
            this.removeHandles(); // Remove handles if no path
            console.log("[YukaPathEditor] No path found for agent, handles not shown.");
            return;
        }

        // For simplicity, target the first waypoint
        const targetWaypoint = path.waypoints[0];
        const targetObject = new THREE.Object3D(); // Create a dummy object to control
        targetObject.position.copy(targetWaypoint as unknown as THREE.Vector3);
        this.scene.add(targetObject); // Add dummy to scene so controls can attach

        if (!this.transformControls) {
            console.log("[YukaPathEditor] Creating TransformControls.");
            this.transformControls = new TransformControls(this.camera, this.domElement);
            this.transformControls.setSize(0.8); // Adjust size as needed
            this.transformControls.showY = false; // Often only want XZ editing for paths

            // --- Event Listener Example (Needs Refinement) ---
            this.transformControls.addEventListener('objectChange', () => {
                // WARNING: Modifying YUKA path directly here can be tricky.
                // Need to map the changed position back and update the YUKA.Path.
                // This requires careful handling of coordinate systems and YUKA's API.
                if (this.transformControls?.object) {
                     const newPos = this.transformControls.object.position;
                     console.log(`[YukaPathEditor] Handle moved to: (${newPos.x.toFixed(2)}, ${newPos.z.toFixed(2)}) - Updating path not yet implemented.`);
                     // Example (conceptual - YUKA path modification needs care):
                     // path.waypoints[0].copy(newPos as unknown as YUKA.Vector3); // Direct modification - might break things
                     // path.calculateWaypoints(); // Recalculate if needed?
                }
            });

            this.transformControls.addEventListener('dragging-changed', (event) => {
                 // Example: Disable agent movement while dragging handle
                 // if (event.value) {
                 //    this.agent.steering.clear(); // Stop agent
                 // } else {
                 //    // Restore steering if needed
                 // }
            });
            // --- End Event Listener Example ---

            this.scene.add(this.transformControls);
        }

        // Attach controls to the dummy object representing the waypoint
        if (this.transformControls.object !== targetObject) {
             if (this.transformControls.object && this.transformControls.object.parent) {
                  // Detach from previous dummy object and remove it
                  const oldDummy = this.transformControls.object;
                  this.transformControls.detach();
                  if (oldDummy instanceof THREE.Mesh) {
                      oldDummy.geometry.dispose();
                  }
                  if (oldDummy.parent) {
                      oldDummy.parent.remove(oldDummy);
                  }
             }
            console.log("[YukaPathEditor] Attaching controls to waypoint object.");
            this.transformControls.attach(targetObject);
        }
         // Ensure position is up-to-date in case path changed
         targetObject.position.copy(targetWaypoint as unknown as THREE.Vector3);
    }

    private removeHandles(): void {
        if (this.transformControls) {
            console.log("[YukaPathEditor] Removing TransformControls.");
             if (this.transformControls.object && this.transformControls.object.parent) {
                 // Remove the dummy object when detaching
                 const dummyObject = this.transformControls.object;
                 this.transformControls.detach();
                 if (dummyObject instanceof THREE.Mesh) {
                     dummyObject.geometry.dispose();
                 }
                 if (dummyObject.parent) {
                     dummyObject.parent.remove(dummyObject);
                 }
             }
            this.transformControls.dispose(); // Clean up listeners
            if (this.transformControls.parent) {
                this.transformControls.parent.remove(this.transformControls);
            }
            this.transformControls = null;
        }
    }

    // --- Path Visualization ---
    private createOrUpdatePathVisual(): void {
         const path = (this.agent as any).currentPath as YUKA.Path; // Access path
         if (!path || path.waypoints.length < 2) {
             this.removePathVisual();
             return;
         }

         const points = path.waypoints.map(wp => new THREE.Vector3(wp.x, wp.y + 0.1, wp.z)); // Offset slightly for visibility

         if (!this.pathVisualHelper) {
             const geometry = new THREE.BufferGeometry().setFromPoints(points);
             const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 }); // Green line
             this.pathVisualHelper = new THREE.LineSegments(geometry, material);
             this.pathVisualHelper.name = `yuka_path_visual_${this.agent.uuid}`;
             this.scene.add(this.pathVisualHelper);
             console.log("[YukaPathEditor] Created path visual helper.");
         } else {
             // Update existing geometry
             this.pathVisualHelper.geometry.setFromPoints(points);
             this.pathVisualHelper.geometry.computeBoundingSphere(); // Important for visibility updates
             console.log("[YukaPathEditor] Updated path visual helper.");
         }
    }

    private removePathVisual(): void {
        if (this.pathVisualHelper) {
            console.log("[YukaPathEditor] Removing path visual helper.");
            if (this.pathVisualHelper.parent) {
                this.pathVisualHelper.parent.remove(this.pathVisualHelper);
            }
            this.pathVisualHelper.geometry.dispose();
            (this.pathVisualHelper.material as THREE.Material).dispose();
            this.pathVisualHelper = null;
        }
    }
    // --- End Path Visualization ---
}

// Keep existing setup function
export function setupYukaPathEditor(agent: YUKA.Vehicle, scene: THREE.Scene, options: YukaPathEditorOptions = {}) {
    return new YukaPathEditor(agent, scene, options);
} 
