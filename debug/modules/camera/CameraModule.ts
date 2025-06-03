import * as THREE from 'three';
import { CameraOperator, World } from '../ui/sketchbookCore';
import { Vector2, Vector3, PerspectiveCamera, Camera } from 'three';

/**
 * CameraModule - Manages camera behavior and following
 * Integrates with Sketchbook's camera system while providing our own extensions
 */
export class CameraModule {
    private cameraOperator: CameraOperator | null = null;
    private camera: PerspectiveCamera;
    private scene: THREE.Scene;
    private domElement: HTMLElement;
    private target: Vector3;
    private debugId: string;
    private sensitivity: Vector2;
    private followMode: boolean;

    constructor(
        scene: THREE.Scene,
        camera: PerspectiveCamera,
        domElement: HTMLElement,
        initialTarget: Vector3
    ) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.target = initialTarget.clone();
        this.debugId = `cam_${Math.random().toString(36).substr(2, 9)}`;
        this.sensitivity = new Vector2(0.3, 0.3);
        this.followMode = true;

        // Configure camera
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(0, 2, 5);
        this.camera.lookAt(this.target);

        // Create camera operator
        const world = new World();
        this.cameraOperator = new CameraOperator(world, this.camera as unknown as Camera);
        this.cameraOperator.sensitivity = this.sensitivity as unknown as THREE.Vector2;
        this.cameraOperator.followMode = this.followMode;
        this.cameraOperator.setRadius(3);
        this.cameraOperator.phi = 30 * Math.PI / 180;
    }

    /**
     * Initialize the camera operator
     */
    public init(): void {
        try {
            // Create camera operator using existing utility
            this.cameraOperator = createFollowCamera(
                this.scene,
                this.camera,
                this.target,
                this.domElement
            );

            // Configure camera settings
            if (this.cameraOperator) {
                this.cameraOperator.setRadius(5); // Default follow distance
                (this.cameraOperator as any).setPolarAngle(30 * Math.PI / 180); // Default camera angle
                (this.cameraOperator as any).movementSpeed = 1.0;
                (this.cameraOperator as any).controlsEnabled = true;
            }
        } catch (error) {
            console.error('[CameraModule] Failed to initialize camera:', error);
            throw error;
        }
    }

    /**
     * Update camera position and orientation
     */
    public update(timeStep: number): void {
        if (this.cameraOperator) {
            this.cameraOperator.update(timeStep);
        }
    }

    /**
     * Set the target position for the camera to follow
     */
    public setTarget(target: Vector3): void {
        this.target.copy(target);
        if (this.cameraOperator) {
            this.cameraOperator.target = this.target as unknown as THREE.Vector3;
        }
    }

    /**
     * Set the camera's follow distance
     */
    public setRadius(radius: number, instant: boolean = false): void {
        if (this.cameraOperator) {
            this.cameraOperator.setRadius(radius, instant);
        }
    }

    /**
     * Set the camera's polar angle (vertical angle)
     */
    public setPolarAngle(angle: number): void {
        if (this.cameraOperator) {
            (this.cameraOperator as any).setPolarAngle(angle);
        }
    }

    /**
     * Enable or disable camera controls
     */
    public setControlsEnabled(enabled: boolean): void {
        if (this.cameraOperator) {
            (this.cameraOperator as any).controlsEnabled = enabled;
        }
    }

    /**
     * Get the camera operator instance
     */
    public getCameraOperator(): CameraOperator | null {
        return this.cameraOperator;
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        if (this.cameraOperator) {
            // Clean up any resources
            this.cameraOperator = null;
        }
    }

    public setSensitivity(x: number, y?: number): void {
        this.sensitivity.set(x, y || x);
        if (this.cameraOperator) {
            this.cameraOperator.sensitivity = this.sensitivity as unknown as THREE.Vector2;
        }
    }

    public setFollowMode(enabled: boolean): void {
        this.followMode = enabled;
        if (this.cameraOperator) {
            this.cameraOperator.followMode = this.followMode;
        }
    }

    public getCamera(): PerspectiveCamera {
        return this.camera;
    }

    public getTarget(): Vector3 {
        return this.target.clone();
    }

    public getSensitivity(): Vector2 {
        return this.sensitivity.clone();
    }

    public isFollowMode(): boolean {
        return this.followMode;
    }
} 