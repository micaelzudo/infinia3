import * as THREE from 'three';

/**
 * Represents a camera shot with starting and ending positions
 */
export interface CameraShot {
    duration: number;                  // Duration of the shot in seconds
    startPos: THREE.Vector3;           // Starting position of the camera
    endPos: THREE.Vector3;             // Ending position of the camera
    startTarget: THREE.Vector3;        // Starting target (look at) position
    endTarget: THREE.Vector3;          // Ending target (look at) position
    easeIn?: boolean;                  // Whether to ease in (default: false)
    easeOut?: boolean;                 // Whether to ease out (default: false)
    callback?: () => void;             // Optional callback when shot completes
}

/**
 * Manages cinematic camera movements with predefined shots
 */
export class CinematicCameraManager {
    private camera: THREE.PerspectiveCamera;
    private shots: CameraShot[] = [];
    private currentShotIndex: number = -1;
    private currentTime: number = 0;
    private active: boolean = false;
    private currentTarget: THREE.Vector3 = new THREE.Vector3();

    /**
     * Creates a cinematic camera manager
     * @param camera Camera to control
     */
    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }

    /**
     * Sets the shots to use for the cinematic sequence
     * @param shots Array of camera shots
     */
    setShots(shots: CameraShot[]): void {
        this.shots = shots;
    }

    /**
     * Starts the cinematic sequence
     */
    start(): void {
        if (this.shots.length === 0) {
            console.warn('No shots defined for cinematic sequence');
            return;
        }

        this.currentShotIndex = 0;
        this.currentTime = 0;
        this.active = true;

        // Set initial camera position and target
        const firstShot = this.shots[0];
        this.camera.position.copy(firstShot.startPos);
        this.currentTarget.copy(firstShot.startTarget);
        this.camera.lookAt(this.currentTarget);

        console.log('Cinematic sequence started');
    }

    /**
     * Stops the cinematic sequence
     */
    stop(): void {
        this.active = false;
        console.log('Cinematic sequence stopped');
    }

    /**
     * Updates the camera position and rotation based on current shot and time
     * @param deltaTime Time elapsed since last update in seconds
     */
    update(deltaTime: number): void {
        if (!this.active || this.currentShotIndex < 0 || this.currentShotIndex >= this.shots.length) {
            return;
        }

        const currentShot = this.shots[this.currentShotIndex];
        this.currentTime += deltaTime;

        // Check if current shot is complete
        if (this.currentTime >= currentShot.duration) {
            // Call callback if defined
            if (currentShot.callback) {
                currentShot.callback();
            }

            // Move to next shot
            this.currentShotIndex++;
            this.currentTime = 0;

            // Check if sequence is complete
            if (this.currentShotIndex >= this.shots.length) {
                console.log('Cinematic sequence complete');
                this.active = false;
                return;
            }

            // Set initial position for new shot
            const newShot = this.shots[this.currentShotIndex];
            this.camera.position.copy(newShot.startPos);
            this.currentTarget.copy(newShot.startTarget);
            this.camera.lookAt(this.currentTarget);
            return;
        }

        // Calculate progress through current shot (0 to 1)
        const progress = this.currentTime / currentShot.duration;
        
        // Apply easing if specified
        let easedProgress = progress;
        if (currentShot.easeIn && !currentShot.easeOut) {
            // Ease in only
            easedProgress = this.easeInQuad(progress);
        } else if (!currentShot.easeIn && currentShot.easeOut) {
            // Ease out only
            easedProgress = this.easeOutQuad(progress);
        } else if (currentShot.easeIn && currentShot.easeOut) {
            // Ease in and out
            easedProgress = this.easeInOutQuad(progress);
        }

        // Interpolate position
        this.camera.position.lerpVectors(
            currentShot.startPos,
            currentShot.endPos,
            easedProgress
        );

        // Interpolate target
        this.currentTarget.lerpVectors(
            currentShot.startTarget,
            currentShot.endTarget,
            easedProgress
        );

        // Update camera look at
        this.camera.lookAt(this.currentTarget);
    }

    /**
     * Quadratic ease in function
     * @param t Progress (0 to 1)
     * @returns Eased value
     */
    private easeInQuad(t: number): number {
        return t * t;
    }

    /**
     * Quadratic ease out function
     * @param t Progress (0 to 1)
     * @returns Eased value
     */
    private easeOutQuad(t: number): number {
        return t * (2 - t);
    }

    /**
     * Quadratic ease in and out function
     * @param t Progress (0 to 1)
     * @returns Eased value
     */
    private easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
} 