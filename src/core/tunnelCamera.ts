import * as THREE from 'three';

/**
 * Manages simple forward camera movement for the tunnel effect.
 */
export class TunnelCameraController {
    private camera: THREE.PerspectiveCamera;
    private speed: number;
    private enabled: boolean = true;

    constructor(camera: THREE.PerspectiveCamera, speed: number = 0.5) {
        this.camera = camera;
        this.speed = speed;
        // Ensure camera starts at a reasonable position for the tunnel
        this.camera.position.set(0, 0, 80); // Start inside the near end of the tunnel
        this.camera.rotation.set(0, 0, 0);
        this.camera.lookAt(0, 0, -100); // Look down the tunnel (negative Z)
        console.log(`Tunnel camera initialized with speed: ${this.speed}`);
    }

    public update(): void {
        if (!this.enabled) return;
        
        // Move camera forward along its local Z axis
        // (which is world Z if camera isn't rotated)
        this.camera.position.z -= this.speed;
        
        // Optional: Add slight Y movement/bobbing
        // this.camera.position.y = Math.sin(this.camera.position.z * 0.1) * 0.5;
    }

    /**
     * Enable the tunnel camera movement
     */
    public enable(): void {
        this.enabled = true;
        console.log("Tunnel camera movement enabled");
    }

    /**
     * Disable the tunnel camera movement
     */
    public disable(): void {
        this.enabled = false;
        console.log("Tunnel camera movement disabled");
    }

    /**
     * Check if the tunnel camera movement is enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }
} 