/**
 * Sketchbook Adapter
 * 
 * This file provides an adapter for integrating the Sketchbook character controller
 * with our MarchingCubes terrain system.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import Sketchbook components through debug integration
import type { 
    Character as SketchbookCharacterType,
    CameraOperator as CameraOperatorType,
    InputManager as InputManagerType
} from '../../../debug/modules/ui/sketchbookImports';

// Import the actual implementations
const { 
    Character: SketchbookCharacter,
    CameraOperator, 
    InputManager,
    initializeCharacter,
    configureCharacterPhysics
} = await import('../../../debug/modules/ui/sketchbookImports');

// Path to character model - use relative path for mobile compatibility
const CHARACTER_MODEL_PATH = (process.env.ASSET_PATH || '/') + 'assets/boxman.glb';

// Type aliases for better TypeScript support
type SketchbookCharacter = InstanceType<typeof SketchbookCharacterType>;
type CameraOperator = InstanceType<typeof CameraOperatorType>;
type InputManager = InstanceType<typeof InputManagerType>;

/**
 * Result object returned from initializeCharacter
 */
export interface CharacterInitResult {
    character: SketchbookCharacter;
    gltf: any;
}

/**
 * Adapter class that bridges Sketchbook with our MarchingCubes world
 */
export class SketchbookWorldAdapter {
    // Scene and renderer references
    public graphicsWorld: THREE.Scene;
    public renderer: { domElement: HTMLElement };
    
    // Characters and camera
    public player: SketchbookCharacter | null = null;
    public camera: THREE.PerspectiveCamera;
    public cameraOperator: CameraOperator | null = null;
    
    // Input management
    public inputManager: InputManager;
    
    // Updatable objects
    public updatables: any[] = [];
    
    // Configuration parameters
    public params: any = { 
        Pointer_Lock: false,
        Mouse_Sensitivity: 1.0,
        Time_Scale: 1.0 
    };
    
    // Physics world for character interactions
    public physicsWorld: CANNON.World;

    /**
     * Create a new SketchbookWorldAdapter
     * 
     * @param scene The THREE.js scene
     * @param renderer The THREE.js renderer
     * @param camera The camera to use
     */
    constructor(
        scene: THREE.Scene, 
        renderer: THREE.WebGLRenderer,
        camera: THREE.PerspectiveCamera
    ) {
        this.graphicsWorld = scene;
        this.renderer = { domElement: renderer.domElement };
        this.camera = camera;
        
        // Create a physics world for character interactions
        this.physicsWorld = new CANNON.World();
        this.physicsWorld.gravity.set(0, -9.81, 0);
        this.physicsWorld.broadphase = new CANNON.SAPBroadphase(this.physicsWorld);
        this.physicsWorld.solver.iterations = 10;
        
        // Create input manager
        try {
            this.inputManager = new InputManager(this as any, renderer.domElement);
            console.log("[SketchbookAdapter] InputManager initialized successfully");
        } catch (e) {
            console.error("[SketchbookAdapter] Failed to initialize InputManager:", e);
            throw e;
        }
    }

    /**
     * Initialize the character and camera
     * 
     * @param initialPosition Initial position for the character
     * @returns Promise that resolves when character is loaded with both character and GLTF model
     */
    public async initializeCharacter(initialPosition?: THREE.Vector3): Promise<CharacterInitResult> {
        return new Promise((resolve, reject) => {
            // Load character model
            const loader = new GLTFLoader();
            loader.load(CHARACTER_MODEL_PATH, (gltf) => {
                try {
                    // Create character
                    const character = new SketchbookCharacter(gltf);
                    
                    // Initialize character with states
                    initializeCharacter(character, gltf);
                    configureCharacterPhysics(character);
                    
                    // Add character to world
                    this.add(character);
                    
                    // Set initial position if provided
                    if (initialPosition) {
                        character.setPosition(initialPosition.x, initialPosition.y, initialPosition.z);
                    }
                    
                    // Create camera operator for third-person view
                    this.setupCamera(character);
                    
                    console.log("[SketchbookAdapter] Character initialized successfully");
                    
                    // Return both character and GLTF model
                    resolve({ character, gltf });
                } catch (e) {
                    console.error("[SketchbookAdapter] Failed to initialize character:", e);
                    reject(e);
                }
            }, undefined, (error) => {
                console.error("[SketchbookAdapter] Error loading character model:", error);
                reject(error);
            });
        });
    }
    
    /**
     * Set up third-person camera to follow character
     * 
     * @param character The character to follow
     */
    private setupCamera(character: SketchbookCharacter): void {
        // Create camera operator
        this.cameraOperator = new CameraOperator(this as any, this.camera);
        
        // Configure camera to follow character
        this.cameraOperator.target = character.position;
        this.cameraOperator.followMode = true;
        this.cameraOperator.setRadius(3);
        this.cameraOperator.setPolarAngle(30 * Math.PI / 180);
        
        // Add camera operator to world
        this.add(this.cameraOperator);
        
        // Switch input receiver to camera
        this.inputManager.setInputReceiver(this.cameraOperator);
    }
    
    /**
     * Add an entity to the world
     */
    public add(entity: any): void {
        if (entity instanceof SketchbookCharacter) {
            this.player = entity;
            this.graphicsWorld.add(entity);
            entity.world = this as any;
        } else if (entity instanceof CameraOperator) {
            this.cameraOperator = entity;
            entity.world = this as any;
        } else if (entity.isObject3D) {
            this.graphicsWorld.add(entity);
        }
        
        if (typeof entity.update === 'function') {
            this.registerUpdatable(entity);
        }
    }
    
    /**
     * Remove an entity from the world
     */
    public remove(entity: any): void {
        if (entity === this.player) {
            this.player = null;
        }
        
        if (entity === this.cameraOperator) {
            this.cameraOperator = null;
        }
        
        if (entity.isObject3D) {
            this.graphicsWorld.remove(entity);
        }
        
        this.unregisterUpdatable(entity);
    }
    
    /**
     * Register an updatable object
     */
    public registerUpdatable(entity: any): void {
        if (this.updatables.indexOf(entity) === -1) {
            this.updatables.push(entity);
        }
    }
    
    /**
     * Unregister an updatable object
     */
    public unregisterUpdatable(entity: any): void {
        const index = this.updatables.indexOf(entity);
        if (index !== -1) {
            this.updatables.splice(index, 1);
        }
    }
    
    /**
     * Update the world
     * 
     * @param deltaTime Time since last frame in seconds
     */
    public update(deltaTime: number): void {
        // Update physics
        this.physicsWorld.step(1/60, deltaTime, 3);
        
        // Update input manager
        if (this.inputManager && typeof this.inputManager.update === 'function') {
            this.inputManager.update(deltaTime);
        }
        
        // Update all registered updatables
        for (const updatable of this.updatables) {
            if (updatable.update) {
                updatable.update(deltaTime);
            }
        }
    }
    
    /**
     * Add terrain mesh to physics world
     * 
     * @param mesh The terrain mesh
     * @returns The CANNON.Body created for the terrain
     */
    public addTerrainToPhysics(mesh: THREE.Mesh): CANNON.Body {
        // Extract vertices and faces from mesh
        const vertices = mesh.geometry.attributes.position.array;
        const indices = mesh.geometry.index ? mesh.geometry.index.array : null;
        
        if (!indices) {
            throw new Error("Mesh must have indexed geometry");
        }
        
        // Create CANNON vertices and faces
        const cannonVertices: CANNON.Vec3[] = [];
        for (let i = 0; i < vertices.length; i += 3) {
            cannonVertices.push(new CANNON.Vec3(
                vertices[i],
                vertices[i+1],
                vertices[i+2]
            ));
        }
        
        const cannonFaces: number[][] = [];
        for (let i = 0; i < indices.length; i += 3) {
            cannonFaces.push([indices[i], indices[i+1], indices[i+2]]);
        }
        
        // Create trimesh and body
        const shape = new CANNON.Trimesh(cannonVertices, cannonFaces);
        const body = new CANNON.Body({ mass: 0 }); // Static body
        body.addShape(shape);
        
        // Match position and rotation with mesh
        body.position.copy(mesh.position as any);
        body.quaternion.copy(mesh.quaternion as any);
        
        // Add to physics world
        this.physicsWorld.addBody(body);
        
        // Store reference to body in mesh userdata
        mesh.userData.physicsBody = body;
        
        return body;
    }
    
    /**
     * Handle additional UI controls update
     */
    public updateControls(controls: any[]): void {
        // This is called by Character when initializing as input receiver
        // Stub implementation - expand if needed
    }
    
    /**
     * Handle time scale changes
     */
    public scrollTheTimeScale(timeScale: number): void {
        // Stub implementation - expand if needed
    }
} 