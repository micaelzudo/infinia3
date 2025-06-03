import * as THREE from 'three';
import { MobileControls } from './mobileControls';

// Types
export interface InputManager {
    getAxis(name: string): number;
    getAction(name: string): boolean;
    getActionDown(name: string): boolean;
    getActionUp(name: string): boolean;
}

export interface CharacterState {
    enter(): void;
    update(deltaTime: number): void;
    exit(): void;
    onInputChange(x: number, y: number): void;
    handleAction?(action: string): void;
}

export interface CharacterStates {
    idle: CharacterState;
    walk: CharacterState;
    sprint: CharacterState;
    jumpIdle: CharacterState;
    jumpRunning: CharacterState;
    fall: CharacterState;
    endWalk: CharacterState;
    [key: string]: CharacterState;
}

export interface CharacterRef {
    // Core properties
    camera: THREE.PerspectiveCamera;
    gltf: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    currentAnimation: THREE.AnimationAction | null;
    model: THREE.Object3D;
    physicsBody: any; // Replace with actual physics body type
    inputManager: InputManager;
    orientation: THREE.Vector3;
    velocity: THREE.Vector3;
    stats: {
        walkSpeed: number;
        sprintSpeed: number;
        jumpForce: number;
    };
    speedMultiplier: number;
    avatarRadius: number;
    avatarHeight: number;
    physicsEnabled: boolean;
    states: CharacterStates;
    _currentState: CharacterState | null;
    
    // Methods
    onInputChange(x: number, y: number): void;
    playAnimation(name: string, fadeInDuration?: number): void;
    stopAnimation(name: string): void;
    setOrientation(vector: THREE.Vector3, instant?: boolean): void;
    setVelocity(x: number, y: number, z: number): void;
    getCameraRelativeMovementVector(): THREE.Vector3;
    getLocalMovementDirection(): THREE.Vector3;
    setState(newState: CharacterState): void;
}

class CharacterStateBase_Adapter {
    protected characterRef: CharacterRef;
    public animationTransitions: Record<string, { condition: () => boolean; nextState: string }>;
    
    constructor(character: CharacterRef) {
        this.characterRef = character;
        this.animationTransitions = {};
    }
    
    public enter(): void {}
    public update(_timeStep: number): void {}
    public exit(): void {}
    public onInputChange(_x: number, _y: number): void {}
    public handleAction(action: string): void {
        // Default implementation does nothing
        console.log(`Action triggered: ${action}`);
    }
}

// --- END PLACEHOLDER ADAPTER DEFINITIONS ---

// Global state
let isActive: boolean = false;
let mobileControls: MobileControls | null = null;
let sceneRef: THREE.Scene | null = null;
let cameraRef: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let characterRefInternal: CharacterRef | null = null;
let onExitCallback: (() => void) | null = null;
const clock: THREE.Clock = new THREE.Clock();

// Get viewport size helper - using direct window properties for better mobile support
function getViewportSize(): { width: number; height: number } {
    // Use visual viewport for mobile devices if available
    if (window.visualViewport) {
        return {
            width: Math.floor(window.visualViewport.width),
            height: Math.floor(window.visualViewport.height)
        };
    }
    
    // Fallback to window dimensions
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}

// State adapters (stub implementations to satisfy type checking)
// These are just type placeholders - the actual implementations should be provided by the application
const initCharacterStates = (character: CharacterRef): void => {
    // Create state instances
    character.states = {
        idle: new Idle_Adapter(character),
        walk: new Walk_Adapter(character),
        sprint: new Sprint_Adapter(character),
        jumpIdle: new JumpIdle_Adapter(character),
        jumpRunning: new JumpRunning_Adapter(character),
        fall: new Fall_Adapter(character),
        endWalk: new EndWalk_Adapter(character)
    };
    
    // Set initial state
    character.setState(character.states.idle);
};

// Create default input manager if none provided
const createDefaultInputManager = (): InputManager => ({
    getAxis: (): number => 0,
    getAction: (): boolean => false,
    getActionDown: (): boolean => false,
    getActionUp: (): boolean => false
});

// Initialize character reference
const createCharacterReference = (inputManager: InputManager): CharacterRef => {
    const character: CharacterRef = {
        camera: new THREE.PerspectiveCamera(),
        gltf: null,
        mixer: null,
        currentAnimation: null,
        model: new THREE.Object3D(),
        physicsBody: null,
        inputManager,
        orientation: new THREE.Vector3(0, 0, 1),
        velocity: new THREE.Vector3(),
        stats: {
            walkSpeed: 2,
            sprintSpeed: 4,
            jumpForce: 5
        },
        speedMultiplier: 1,
        avatarRadius: 0.5,
        avatarHeight: 1.8,
        physicsEnabled: true,
        states: {} as CharacterStates,
        _currentState: null,
        
        // Methods
        onInputChange(x: number, y: number) {
            if (this._currentState) {
                this._currentState.onInputChange(x, y);
            }
        },
        
        playAnimation(name: string, fadeInDuration = 0.2) {
            if (this.gltf?.animations && this.mixer) {
                const clip = this.gltf.animations.find((a: THREE.AnimationClip) => a.name === name);
                if (clip) {
                    if (this.currentAnimation) {
                        this.currentAnimation.fadeOut(fadeInDuration * 0.5);
                    }
                    const action = this.mixer.clipAction(clip);
                    action.reset().fadeIn(fadeInDuration).play();
                    this.currentAnimation = action;
                } else {
                    console.warn(`Animation ${name} not found`);
                }
            }
        },
        
        stopAnimation(name: string) {
            if (this.gltf?.animations && this.mixer) {
                const clip = this.gltf.animations.find((a: THREE.AnimationClip) => a.name === name);
                if (clip) {
                    const action = this.mixer.clipAction(clip);
                    action.fadeOut(0.2);
                }
            }
        },
        
        setOrientation(vector: THREE.Vector3, instant = false) {
            if (this.model && vector.lengthSq() > 0.001) {
                // Enhanced logging function for Android
                function logToFile(message: string): void {
                    try {
                        // This will be caught by our try-catch and logged to console as fallback
                        if (!(window as any).Android) return;
                        (window as any).Android.log(message);
                    } catch (e) {
                        // Fallback to console if Android interface not available
                        console.log(`[ThirdPerson] ${message}`);
                    }
                }
                
                logToFile('Input vector');
                
                const direction = vector.clone().normalize();
                
                // Calculate the angle between the current forward vector and the target direction
                const currentForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
                const angle = Math.atan2(
                    direction.x * currentForward.z - direction.z * currentForward.x,
                    direction.x * currentForward.x + direction.z * currentForward.z
                );
                
                // Only update if the angle is significant
                if (Math.abs(angle) > 0.001) {
                    // Create a quaternion for the rotation around the Y axis
                    const targetQuaternion = new THREE.Quaternion();
                    targetQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
                    
                    if (instant) {
                        this.model.quaternion.multiply(targetQuaternion);
                    } else {
                        // Use slerp for smooth rotation
                        const slerp = new THREE.Quaternion();
                        slerp.slerpQuaternions(
                            new THREE.Quaternion().copy(this.model.quaternion),
                            new THREE.Quaternion().copy(this.model.quaternion).multiply(targetQuaternion),
                            0.1
                        );
                        this.model.quaternion.copy(slerp);
                    }
                }
            }
        },
        
        setVelocity: function(x: number, y: number, z: number) {
            this.velocity.set(x, y, z);
        },
        
        getCameraRelativeMovementVector: function() {
            try {
                const verticalInput = this.inputManager.getAxis('vertical');
                const horizontalInput = this.inputManager.getAxis('horizontal');
                
                // Early return if no significant input
                if (Math.abs(verticalInput) < 0.001 && Math.abs(horizontalInput) < 0.001) {
                    return new THREE.Vector3();
                }
                
                // Get camera orientation
                const cameraQuat = this.camera.quaternion;
                const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat);
                const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuat);
                
                // Project vectors onto XZ plane
                forward.y = 0;
                right.y = 0;
                
                // Check for zero-length vectors before normalizing
                if (forward.lengthSq() > 0.0001) {
                    forward.normalize();
                } else {
                    forward.set(0, 0, 1); // Fallback to default forward
                }
                
                if (right.lengthSq() > 0.0001) {
                    right.normalize();
                } else {
                    right.set(1, 0, 0); // Fallback to default right
                }
                
                // Calculate movement direction based on input
                const moveDirection = new THREE.Vector3();
                
                // Apply deadzone to input values
                const deadzone = 0.1;
                const applyDeadzone = (value: number) => {
                    if (Math.abs(value) < deadzone) return 0;
                    return Math.sign(value) * (Math.abs(value) - deadzone) / (1 - deadzone);
                };
                
                const vInput = applyDeadzone(verticalInput);
                const hInput = applyDeadzone(horizontalInput);
                
                // Combine movement vectors
                if (vInput !== 0) {
                    moveDirection.addScaledVector(forward, vInput);
                }
                if (hInput !== 0) {
                    moveDirection.addScaledVector(right, hInput);
                }
                
                // Normalize only if we have significant movement
                const moveLengthSq = moveDirection.lengthSq();
                if (moveLengthSq > 0.0001) {
                    // Apply square root to make the movement feel more natural
                    const moveLength = Math.sqrt(moveLengthSq);
                    moveDirection.multiplyScalar(moveLength > 1 ? 1 / moveLength : 1);
                } else {
                    moveDirection.set(0, 0, 0);
                }
                
                return moveDirection;
                
            } catch (error) {
                console.error('Error in getCameraRelativeMovementVector:', error);
                return new THREE.Vector3();
            }
        },
        
        getLocalMovementDirection: function() {
            return new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
        },
        
        setState: function(newState: CharacterState) {
            if (this._currentState) {
                this._currentState.exit();
            }
            
            this._currentState = newState;
            
            if (newState) {
                newState.enter();
            }
        }
    };
    
    initCharacterStates(character);
    return character;
};

// Animation helper functions are now methods on the CharacterRef interface

// State adapter implementations
export class Idle_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('idle');
        }
    }
}

export class Walk_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('walk');
        }
    }
}

export class Sprint_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('sprint');
        }
    }
}

export class JumpIdle_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('jump_idle');
        }
    }
}

export class JumpRunning_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('jump_running');
        }
    }
}

export class Fall_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('fall');
        }
    }
}

// Enhanced logging function for Android
function logToFile(message: string, data?: any): void {
    const logMessage = `[ThirdPerson] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logMessage);
    try {
        if ((window as any).Android && (window as any).Android.log) {
            (window as any).Android.log(logMessage);
        }
    } catch (e) {
        // Fallback to console if Android interface not available
        console.log(`[ThirdPerson] Android log failed:`, e);
    }
}

export class EndWalk_Adapter extends CharacterStateBase_Adapter {
    enter(): void {
        if (this.characterRef) {
            this.characterRef.playAnimation('end_walk');
        }
    }
}

export function initIsolatedThirdPersonView(
scene: THREE.Scene,
camera: THREE.PerspectiveCamera,
renderer: THREE.WebGLRenderer,
inputManager?: InputManager
): CharacterRef {
// Initialize mobile controls if on mobile
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile && renderer.domElement.parentElement) {
    mobileControls = new MobileControls(camera, renderer.domElement.parentElement);
            
    // Set initial target slightly in front of the camera
    const target = new THREE.Vector3();
    camera.getWorldDirection(target);
    target.multiplyScalar(10).add(camera.position);
    mobileControls.setTarget(target);
}
logToFile('Initializing isolated third person view');
logToFile('Window dimensions', { 
    innerWidth: window.innerWidth, 
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio
});
            
logToFile('Scene info', { 
    children: scene.children.length,
    type: scene.type
});
            
logToFile('Camera info', { 
    type: camera.type,
    fov: camera.fov,
    aspect: camera.aspect,
    near: camera.near,
    far: camera.far,
    position: camera.position.toArray(),
    rotation: camera.rotation.toArray()
});
            
console.log('[ThirdPerson] Initializing isolated third person view');
console.log(`[ThirdPerson] Window size: ${window.innerWidth}x${window.innerHeight}`);
console.log(`[ThirdPerson] Device pixel ratio: ${window.devicePixelRatio}`);
            
if (!renderer) {
    console.error("[ThirdPerson] ERROR: Renderer not initialized");
    return characterRefInternal!;
}
            
console.log("[ThirdPerson] Renderer found, setting up scene");
console.log(`[ThirdPerson] Scene:`, scene);
console.log(`[ThirdPerson] Camera:`, camera);
if (isActive) {
    console.warn('Third person mode already initialized');
    return characterRefInternal!;
}
            
isActive = true;
sceneRef = scene;
cameraRef = camera;
            
// Hide all UI elements
const uiElements = document.querySelectorAll('div, header, footer, nav, aside, button, a');
uiElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.style.display !== 'none') {
        htmlEl.dataset.previousDisplay = htmlEl.style.display;
        htmlEl.style.display = 'none';
    }
});
            
// Make body fullscreen
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';
            
// Use the existing renderer from main.ts
console.log('[ThirdPerson] Getting renderer');
renderer = renderer || (window as any).appRenderer;
console.log('[ThirdPerson] Renderer:', renderer);
            
if (renderer) {
    console.log('[ThirdPerson] Setting up renderer for fullscreen');
    // Ensure the renderer is set up for fullscreen
    const visualViewport = window.visualViewport || {
        width: window.innerWidth,
        height: window.innerHeight
    };
    const width = Math.floor(visualViewport.width);
    const height = Math.floor(visualViewport.height);
            
    // Update renderer settings
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height, false);
            
    const canvas = renderer.domElement;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.zIndex = '0';
} else {
    console.error('Renderer not found. Make sure the main app has initialized the renderer.');
}
            
// Create character reference with provided or default input manager
characterRefInternal = createCharacterReference(inputManager || createDefaultInputManager());
            
// Set up fullscreen behavior
setupMobileView();
            
// Handle window resize
window.addEventListener('resize', handleWindowResize);
handleWindowResize();
            
return characterRefInternal;
}

export function updateIsolatedThirdPerson(deltaTime: number): void {
    if (!isActive || !characterRefInternal) return;
    
    try {
        // Update animation mixer
        if (characterRefInternal.mixer) {
            characterRefInternal.mixer.update(deltaTime);
        }
        
        // Update mobile controls if active
        if (mobileControls) {
            mobileControls.update();
        }
    } catch (e) {
        console.error('Error in character state update:', e);
    }
}

export function exitIsolatedThirdPerson(): void {
    if (!isActive) return;
    
    console.log('Exiting third person mode');
    
    // Clean up mobile controls
    if (mobileControls) {
        mobileControls.dispose();
        mobileControls = null;
    }
    
    isActive = false;
            
// Clean up resources
if (characterRefInternal) {
    if (characterRefInternal.model && sceneRef) {
        sceneRef.remove(characterRefInternal.model);
        }
        
        if (characterRefInternal.mixer) {
            characterRefInternal.mixer.stopAllAction();
            if (characterRefInternal.gltf) {
                characterRefInternal.mixer.uncacheRoot(characterRefInternal.gltf);
            }
        }
        
        characterRefInternal = null;
    }
    
    // Clean up renderer
    if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
        renderer.dispose();
        renderer = null;
    }
    
    // Restore UI elements
    const uiElements = document.querySelectorAll('[data-previous-display]');
    uiElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        const previousDisplay = htmlEl.dataset.previousDisplay || '';
        htmlEl.style.display = previousDisplay;
        delete htmlEl.dataset.previousDisplay;
    });
    
    // Reset body styles
    document.body.style.margin = '';
    document.body.style.padding = '';
    document.body.style.overflow = '';
    
    // Remove event listeners
    window.removeEventListener('resize', handleWindowResize);
    
    // Call exit callback if provided
    if (onExitCallback) {
        onExitCallback();
        onExitCallback = null;
    }
    
    sceneRef = null;
    cameraRef = null;
}

export function getCharacterRef(): CharacterRef | null {
    return characterRefInternal;
}

export function getIsolatedThirdPersonCamera(): THREE.PerspectiveCamera | null {
    return cameraRef;
}

export function setupMobileView(): void {
    if (!renderer) return;
    
    // Set up viewport meta tag with more aggressive settings
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.setAttribute('name', 'viewport');
        document.head.appendChild(viewportMeta);
    }
    
    // Update viewport settings
    viewportMeta.setAttribute('content', [
        'width=device-width',
        'initial-scale=1',
        'maximum-scale=1',
        'minimum-scale=1',
        'user-scalable=no',
        'viewport-fit=cover',
        'shrink-to-fit=no'
    ].join(', '));
    
    // Set document and body styles
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.position = 'fixed';
    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.top = '0';
    document.documentElement.style.left = '0';
    
    // Prevent default touch behavior
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    // @ts-ignore - webkitTouchCallout is a non-standard property but needed for iOS
    document.body.style.webkitTouchCallout = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    
    // Set touch action and styles on renderer
    if (renderer.domElement) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        renderer.setSize(width, height, false);
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = width + 'px';
        renderer.domElement.style.height = height + 'px';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.zIndex = '0';
        renderer.domElement.style.touchAction = 'none';
    }
}

export function handleWindowResize(): void {
    if (!cameraRef || !renderer) return;
    
    // Use visual viewport for mobile devices to handle software keyboard and other UI elements
    const visualViewport = window.visualViewport || {
        width: window.innerWidth,
        height: window.innerHeight
    };
    const width = Math.floor(visualViewport.width);
    const height = Math.floor(visualViewport.height);
    
    // Update camera
    cameraRef.aspect = width / height;
    cameraRef.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(width, height, false);
    
    // Update DOM element size
    if (renderer.domElement) {
        renderer.domElement.style.width = width + 'px';
        renderer.domElement.style.height = height + 'px';
    }
    
    // Force a repaint
    if (document.documentElement) {
        document.documentElement.style.width = width + 'px';
        document.documentElement.style.height = height + 'px';
    }
    
    // Dispatch resize event
    window.dispatchEvent(new Event('resize'));
}

// Export only the base adapter class
export { CharacterStateBase_Adapter };