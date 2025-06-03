import * as YUKA from './yuka-master/src/yuka.js';
import { Vector3 as YukaVector3 } from './yuka-master/src/yuka.js';
import * as THREE from 'three';
import { YukaNavMeshHelper } from './yukaNavMeshHelper'; // Optional: if used for line of sight checks etc.
import { createTextSprite } from '../utils/debugUtils'; // Import from the new location

export interface YukaSteeringDebugOptions {
    showForces?: boolean;
    showBehaviors?: boolean;
    // Optional container for DOM elements (not used by steering, but good for consistency)
    uiContainer?: HTMLElement; 
}

export class YukaSteeringDebug {
    private agent: any; // Use any to bypass Yuka type resolution issues for now
    private scene: THREE.Scene;
    private options: YukaSteeringDebugOptions;

    // Visuals
    private forceVisualGroup: THREE.Group;
    private behaviorVisualGroup: THREE.Group; // Keep for behaviors later
    private isForceGroupInScene: boolean = false;
    private isBehaviorGroupInScene: boolean = false; // Keep for behaviors later

    constructor(agent: any, scene: THREE.Scene, options: YukaSteeringDebugOptions = {}) {
        this.agent = agent;
        this.scene = scene;
        const showForcesOption = options.showForces ?? false;
        const showBehaviorsOption = options.showBehaviors ?? false;
        this.options = { // Ensure all options are initialized
            showForces: showForcesOption,
            showBehaviors: showBehaviorsOption,
            uiContainer: options.uiContainer
        };

        this.forceVisualGroup = new THREE.Group();
        this.forceVisualGroup.name = `SteeringForceDebug_${this.agent.uuid || 'unknownAgent'}`;
        this.behaviorVisualGroup = new THREE.Group();
        this.behaviorVisualGroup.name = `SteeringBehaviorDebug_${this.agent.uuid || 'unknownAgent'}`;

        console.log(`[YukaSteeringDebug] Initialized for ${agent.name || 'unknown agent'} with options:`, this.options);

        this.toggleForces(showForcesOption);
        this.toggleBehaviors(showBehaviorsOption);
    }

    // --- Create/Remove Visuals ---
    private _createForceVisuals() {
        // Clear previous visuals in the group
        while (this.forceVisualGroup.children.length > 0) {
            this.forceVisualGroup.remove(this.forceVisualGroup.children[0]);
        }
        
        if (!this.options.showForces || !this.agent || !this.agent.steering || !this.agent.steering._steeringForce) {
            return; 
        }

        console.log(`[SteeringDebug] Creating/Updating force visuals for ${this.agent.name || 'unknown agent'}...`);

        const steeringForce = this.agent.steering._steeringForce as any; // Use any to suppress linter error
        if (!steeringForce || typeof steeringForce.length !== 'function') { // Add type check
            console.log("  - Steering force is null/undefined or not a vector.");
            return;
        }
        const forceLength = steeringForce.length();

        if (forceLength > 0.001) {
            const arrowColor = 0xff0000; 
            const arrowLengthFactor = 0.5; 
            const arrowHeadLengthFactor = 0.2 * arrowLengthFactor;
            const arrowHeadWidthFactor = 0.1 * arrowLengthFactor;

            // Assuming steeringForce has x, y, z and clone/normalize methods after the 'any' cast
            const direction = new THREE.Vector3(steeringForce.x, steeringForce.y, steeringForce.z).normalize();

            const forceArrow = new THREE.ArrowHelper(
                direction, // Use normalized THREE vector
                new THREE.Vector3(0, 0, 0), 
                forceLength * arrowLengthFactor, 
                arrowColor,
                forceLength * arrowHeadLengthFactor, 
                forceLength * arrowHeadWidthFactor  
            );

            // Make arrow always visible (ignore depth)
            (forceArrow.line.material as THREE.Material).depthTest = false;
            (forceArrow.line.material as THREE.Material).depthWrite = false;
            (forceArrow.cone.material as THREE.Material).depthTest = false;
            (forceArrow.cone.material as THREE.Material).depthWrite = false;

            this.forceVisualGroup.add(forceArrow);
            console.log("  - Added ArrowHelper to forceVisualGroup with depthTest=false.");
        } else {
             console.log("  - Steering force is negligible, not adding arrow.");
        }

        // Position the entire group at the agent's location
        const agentPosition = new THREE.Vector3();
        agentPosition.setFromMatrixPosition(this.agent.worldMatrix as THREE.Matrix4);
        this.forceVisualGroup.position.copy(agentPosition);
    }

    private _addForceGroupToScene() {
        if (!this.isForceGroupInScene && this.options.showForces) {
             console.log(`[SteeringDebug] Adding force visual group to scene for ${this.agent.name || 'unknown agent'}`);
            this._createForceVisuals(); // Create/Update content before adding
            this.scene.add(this.forceVisualGroup);
            this.isForceGroupInScene = true;
        }
    }

    private _removeForceGroupFromScene() {
        if (this.isForceGroupInScene) {
            console.log(`[SteeringDebug] Removing force visual group from scene for ${this.agent.name || 'unknown agent'}`);
            this.scene.remove(this.forceVisualGroup);
            this.isForceGroupInScene = false;
        }
    }
    
    private _createBehaviorVisuals() {
        // Clear previous visuals
        while (this.behaviorVisualGroup.children.length > 0) {
            this.behaviorVisualGroup.remove(this.behaviorVisualGroup.children[0]);
        }

        if (!this.options.showBehaviors || !this.agent || !this.agent.steering || !this.agent.steering.behaviors) {
            return;
        }
        console.log(`[SteeringDebug] Creating/Updating behavior visuals for ${this.agent.name || 'unknown agent'}...`);

        const activeBehaviors = (this.agent.steering.behaviors as Array<any>)
            .filter(b => b.active)
            .map(b => b.constructor.name || 'UnknownBehavior');

        if (activeBehaviors.length > 0) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return;

            const fontSize = 16;
            context.font = `${fontSize}px Arial`;
            const text = activeBehaviors.join(', ');
            const textMetrics = context.measureText(text);
            
            // Make canvas power-of-2 for better texture handling, if necessary, though less critical for canvas textures
            canvas.width = THREE.MathUtils.ceilPowerOfTwo(textMetrics.width + 10); // Add some padding
            canvas.height = THREE.MathUtils.ceilPowerOfTwo(fontSize + 10); // Add some padding

            // Re-apply font after resize
            context.font = `${fontSize}px Arial`;
            context.fillStyle = 'rgba(0,0,0,0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
            const sprite = new THREE.Sprite(material);
            
            // Scale the sprite based on text length to keep it somewhat reasonable
            const spriteWidth = canvas.width / 100; // Adjust scale factor as needed
            const spriteHeight = canvas.height / 100;
            sprite.scale.set(spriteWidth, spriteHeight, 1.0);
            
            this.behaviorVisualGroup.add(sprite);
            console.log(`  - Added Sprite for behaviors: ${text}`);
        } else {
            console.log("  - No active behaviors to display.");
        }
        const agentPosition = new THREE.Vector3();
        agentPosition.setFromMatrixPosition(this.agent.worldMatrix as THREE.Matrix4);
        this.behaviorVisualGroup.position.copy(agentPosition);
        // Offset slightly above the agent
        this.behaviorVisualGroup.position.y += (this.agent.boundingRadius || 1) + 0.5; 
    }

    private _addBehaviorGroupToScene() {
        if (!this.isBehaviorGroupInScene && this.options.showBehaviors) {
            console.log(`[SteeringDebug] Adding behavior visual group to scene for ${this.agent.name || 'unknown agent'}`);
            this._createBehaviorVisuals(); // Create/Update content before adding
            this.scene.add(this.behaviorVisualGroup);
            this.isBehaviorGroupInScene = true;
        }
    }

    private _removeBehaviorGroupFromScene() {
        if (this.isBehaviorGroupInScene) {
            console.log(`[SteeringDebug] Removing behavior visual group from scene for ${this.agent.name || 'unknown agent'}`);
            this.scene.remove(this.behaviorVisualGroup);
            this.isBehaviorGroupInScene = false;
        }
    }


    // --- Toggle Methods ---
    toggleForces(show: boolean) {
        if (this.options.showForces !== show) {
            this.options.showForces = show;
            console.log(`[YukaSteeringDebug] Agent ${this.agent.name || 'unknown agent'} - toggleForces called with: ${show}`);
            if (show) {
                this._addForceGroupToScene();
            } else {
                this._removeForceGroupFromScene();
            }
        } else {
             console.log(`[YukaSteeringDebug] Agent ${this.agent.name || 'unknown agent'} - toggleForces called but state (${show}) hasn't changed.`);
        }
    }

    toggleBehaviors(show: boolean) {
        if (this.options.showBehaviors !== show) {
            this.options.showBehaviors = show;
            console.log(`[YukaSteeringDebug] Agent ${this.agent.name || 'unknown agent'} - toggleBehaviors called with: ${show}`);
            if (show) {
                this._addBehaviorGroupToScene();
            } else {
                this._removeBehaviorGroupFromScene();
            }
        } else {
             console.log(`[YukaSteeringDebug] Agent ${this.agent.name || 'unknown agent'} - toggleBehaviors called but state (${show}) hasn't changed.`);
        }
    }

    // --- Update Loop ---
    update() {
        if (!this.agent || !this.scene) return;

        // Update Steering Force Group
        if (this.isForceGroupInScene) {
            // Recreate visuals (updates arrow direction/length) and reposition group
            this._createForceVisuals(); 
        }

        // Update Behavior Sprite Group
        if (this.isBehaviorGroupInScene) {
            // Recreate visuals (updates text/texture if behaviors change) and reposition group
            this._createBehaviorVisuals();
        }
    }

    dispose() {
        console.log(`[YukaSteeringDebug] Disposing for ${this.agent.name || 'unknown agent'}`);
        this.toggleForces(false); // Ensure force visuals are removed
        this.toggleBehaviors(false); // Ensure behavior visuals are removed
        
        // Clear children from groups just in case
        while (this.forceVisualGroup.children.length > 0) {
            this.forceVisualGroup.remove(this.forceVisualGroup.children[0]);
        }
        while (this.behaviorVisualGroup.children.length > 0) {
            this.behaviorVisualGroup.remove(this.behaviorVisualGroup.children[0]);
        }
    }
}

// Factory function
export function setupYukaSteeringDebug(
    agent: any, 
    scene: THREE.Scene, 
    options: YukaSteeringDebugOptions = {}
) {
    if (!agent || !agent.steering) {
        console.warn(`[setupYukaSteeringDebug] Agent ${agent?.name || '(unknown)'} does not have a steering property. Skipping debug setup.`);
        return null;
    }
    return new YukaSteeringDebug(agent, scene, options);
} 