import * as THREE from 'three';

export class MobileControls {
    private camera: THREE.PerspectiveCamera;
    private domElement: HTMLElement;
    private isDragging: boolean = false;
    private isRotating: boolean = false;
    private lastTouchX: number = 0;
    private lastTouchY: number = 0;
    private touchStartTime: number = 0;
    private touchStartX: number = 0;
    private touchStartY: number = 0;
    private touchId1: number | null = null;
    private touchId2: number | null = null;
    private initialTouchDistance: number = 0;
    private initialCameraDistance: number = 0;
    private target: THREE.Vector3 = new THREE.Vector3();
    
    // Camera movement parameters
    private rotateSpeed: number = 0.005;
    private panSpeed: number = 0.5;
    private zoomSpeed: number = 0.01;
    
    // State
    private isEnabled: boolean = true;
    
    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Initialize target to camera position + z-axis
        this.target.copy(camera.position);
        this.target.z += 10;
        
        // Bind methods
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        
        this.attachEventListeners();
    }
    
    private attachEventListeners(): void {
        this.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.domElement.addEventListener('touchend', this.onTouchEnd, { passive: false });
        this.domElement.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    }
    
    private detachEventListeners(): void {
        this.domElement.removeEventListener('touchstart', this.onTouchStart);
        this.domElement.removeEventListener('touchmove', this.onTouchMove);
        this.domElement.removeEventListener('touchend', this.onTouchEnd);
        this.domElement.removeEventListener('touchcancel', this.onTouchEnd);
    }
    
    private onTouchStart(event: TouchEvent): void {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        const touches = event.changedTouches;
        
        if (touches.length === 1) {
            // Single touch - start rotation or pan
            const touch = touches[0];
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            this.touchStartTime = Date.now();
            this.touchId1 = touch.identifier;
            
            // Check if this is a tap (for future use)
            setTimeout(() => {
                if (this.touchId1 === touch.identifier) {
                    this.isDragging = true;
                }
            }, 50);
            
        } else if (touches.length === 2) {
            // Two touches - start pinch to zoom
            const touch1 = touches[0];
            const touch2 = touches[1];
            
            this.touchId1 = touch1.identifier;
            this.touchId2 = touch2.identifier;
            
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            this.initialTouchDistance = Math.sqrt(dx * dx + dy * dy);
            
            // Store initial camera distance for zooming
            this.initialCameraDistance = this.camera.position.distanceTo(this.target);
            
            this.isRotating = false;
        }
    }
    
    private onTouchMove(event: TouchEvent): void {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        const touches = event.touches;
        
        if (touches.length === 1 && this.isDragging) {
            // Single touch drag - rotate or pan
            const touch = this.findTouchById(touches, this.touchId1);
            if (!touch) return;
            
            const clientX = touch.clientX;
            const clientY = touch.clientY;
            
            const movementX = clientX - this.lastTouchX;
            const movementY = clientY - this.lastTouchY;
            
            // Determine if this is a rotation or pan based on initial movement
            const isPan = Math.abs(movementX) < 5 && Math.abs(movementY) < 5;
            
            if (isPan) {
                // Pan the camera
                const panOffset = new THREE.Vector3();
                panOffset.set(-movementX * this.panSpeed, movementY * this.panSpeed, 0);
                panOffset.applyQuaternion(this.camera.quaternion);
                
                this.camera.position.add(panOffset);
                this.target.add(panOffset);
            } else {
                // Rotate around target
                const direction = new THREE.Vector3();
                direction.subVectors(this.camera.position, this.target);
                
                // Rotate left/right (around Y axis)
                const theta = -movementX * this.rotateSpeed;
                
                // Rotate up/down (around local X axis)
                const phi = -movementY * this.rotateSpeed;
                
                // Apply horizontal rotation (around Y axis)
                this.camera.position.x = this.target.x + Math.sin(theta) * direction.z + Math.cos(theta) * direction.x;
                this.camera.position.z = this.target.z + Math.cos(theta) * direction.z - Math.sin(theta) * direction.x;
                
                // Apply vertical rotation (around local X axis)
                const newDirection = new THREE.Vector3();
                newDirection.subVectors(this.camera.position, this.target);
                
                // Calculate new position after vertical rotation
                const radius = newDirection.length();
                const spherical = new THREE.Spherical().setFromVector3(newDirection);
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi + phi));
                
                // Update camera position
                newDirection.setFromSpherical(spherical).multiplyScalar(radius);
                this.camera.position.copy(this.target).add(newDirection);
                
                // Make sure camera is looking at the target
                this.camera.lookAt(this.target);
            }
            
            this.lastTouchX = clientX;
            this.lastTouchY = clientY;
            
        } else if (touches.length === 2) {
            // Two touches - pinch to zoom
            const touch1 = this.findTouchById(touches, this.touchId1);
            const touch2 = this.findTouchById(touches, this.touchId2);
            
            if (!touch1 || !touch2) return;
            
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Calculate zoom factor
            const zoomFactor = 1 + (this.initialTouchDistance - distance) * this.zoomSpeed;
            const newDistance = this.initialCameraDistance * zoomFactor;
            
            // Limit zoom distance
            const minDistance = 1;
            const maxDistance = 1000;
            const clampedDistance = Math.max(minDistance, Math.min(maxDistance, newDistance));
            
            // Update camera position
            const direction = new THREE.Vector3();
            direction.subVectors(this.camera.position, this.target).normalize();
            this.camera.position.copy(this.target).add(direction.multiplyScalar(clampedDistance));
        }
    }
    
    private onTouchEnd(event: TouchEvent): void {
        if (!this.isEnabled) return;
        
        event.preventDefault();
        
        const touches = event.changedTouches;
        
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            
            if (touch.identifier === this.touchId1) {
                this.touchId1 = null;
                this.isDragging = false;
            } else if (touch.identifier === this.touchId2) {
                this.touchId2 = null;
            }
        }
        
        // If no more touches, reset state
        if (this.touchId1 === null && this.touchId2 === null) {
            this.isDragging = false;
            this.isRotating = false;
        }
    }
    
    private findTouchById(touches: TouchList, id: number | null): Touch | null {
        if (id === null) return null;
        
        for (let i = 0; i < touches.length; i++) {
            if (touches[i].identifier === id) {
                return touches[i];
            }
        }
        
        return null;
    }
    
    public update(): void {
        // Update logic if needed
    }
    
    public dispose(): void {
        this.detachEventListeners();
    }
    
    public enable(): void {
        this.isEnabled = true;
    }
    
    public disable(): void {
        this.isEnabled = false;
        this.isDragging = false;
        this.isRotating = false;
        this.touchId1 = null;
        this.touchId2 = null;
    }
    
    public setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
    }
}
