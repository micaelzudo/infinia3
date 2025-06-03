import * as THREE from 'three';
import { InputManager } from '../../Sketchbook-master/src/ts/core/InputManager';
import { CameraOperator } from '../../Sketchbook-master/src/ts/core/CameraOperator';
import { Character } from '../../Sketchbook-master/src/ts/characters/Character';

// +++ COPIED SketchbookWorldAdapter +++
// (Ensure all its internal dependencies like InputManager, CameraOperator are imported)
class SketchbookWorldAdapter {
    public inputManager!: InputManager;
    public graphicsWorld: THREE.Scene;
    public renderer: { domElement: HTMLElement };
    public updatables: any[] = [];
    public cameraOperator: CameraOperator | null = null;
    public player: Character | null = null;
    public camera: THREE.PerspectiveCamera | null = null;

    public params: any = {
        Pointer_Lock: true,
        Mouse_Sensitivity: 1.0,
        Time_Scale: 1.0
    };
    public physicsFrameTime: number = 1 / 60;
    public physicsMaxPrediction: number = 60;

    // Provide a more complete mock physicsWorld, similar to isolatedThirdPerson
    public physicsWorld = {
        remove: (body?: any) => { console.log("[SketchbookWorldAdapter MockPhysics] remove() called", body); },
        addBody: (body?: any) => { console.log("[SketchbookWorldAdapter MockPhysics] addBody() called", body); },
        step: (timeStep: number, oldTimeStep?: number, maxSubSteps?: number) => { /* console.log("[MockPhysicsWorld] step() called"); */ }
        // Add other methods if Character complains
    };

    constructor(params: { scene: THREE.Scene, renderer: HTMLElement, camera: THREE.Camera }) {
        this.graphicsWorld = params.scene;
        this.renderer = { domElement: params.renderer };
        this.camera = params.camera as THREE.PerspectiveCamera;
        try {
            // InputManager might throw errors if hostRendererDomElement is just document.body and not a focused canvas
            this.inputManager = new InputManager(this as any, params.renderer);
            console.log("SketchbookWorldAdapter: InputManager initialized.");
        } catch (e) {
            console.error("SketchbookWorldAdapter: FAILED to initialize InputManager:", e);
        }
    }

    public add(entity: any): void {
        if (entity instanceof THREE.Object3D) {
            this.graphicsWorld.add(entity);
        }
        if (entity instanceof Character) {
            this.player = entity; // Though we might have multiple AI agents, Character expects to be 'the player' for its world
            entity.world = this as any;
            console.log("[SketchbookWorldAdapter] Associated with Character:", entity.name);
        }
        if (entity instanceof CameraOperator) {
            this.cameraOperator = entity;
            entity.world = this as any;
        }
        if (typeof entity.update === 'function') {
            this.registerUpdatable(entity);
        }
    }

    public remove(entity: any): void {
        if (entity instanceof THREE.Object3D) {
            this.graphicsWorld.remove(entity);
        }
        if (entity === this.player) { // This logic might need adjustment for multiple AI
            this.player = null;
        }
        if (entity === this.cameraOperator) {
            this.cameraOperator = null;
        }
        if (typeof entity.update === 'function') {
            this.unregisterUpdatable(entity);
        }
    }

    public registerUpdatable(registree: any): void {
        if (!this.updatables.includes(registree)) {
            this.updatables.push(registree);
            this.updatables.sort((a, b) => (a.updateOrder || 0) - (b.updateOrder || 0));
        }
    }

    public unregisterUpdatable(registree: any): void {
        const index = this.updatables.indexOf(registree);
        if (index > -1) {
            this.updatables.splice(index, 1);
        }
    }

    public update(timeStep: number, unscaledTimeStep: number): void {
        // We won't call this from Yuka's update loop, Character instances will be updated by Yuka's EntityManager
        // But Character might call this.world.update() internally for some reason.
        for (const updatable of this.updatables) {
            if (updatable !== this.player) { // Avoid double-updating the character if Yuka also updates it
                 updatable.update(timeStep, unscaledTimeStep);
            }
        }
    }
    public updateControls(controls: any): void { /* Stub */ }
    public scrollTheTimeScale(value: number): void { /* Stub */ }
}

export default SketchbookWorldAdapter;