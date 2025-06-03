import * as THREE from 'three';
// Enhanced imports for full YUKA functionality
import { 
    Vehicle, EntityManager, Time, Vector3 as YukaVector3, 
    ArriveBehavior, Path, StateMachine, State,
    WanderBehavior, SeekBehavior, FleeBehavior, PursuitBehavior,
    FollowPathBehavior, ObstacleAvoidanceBehavior,
    Vision, MemorySystem, MemoryRecord,
    Trigger, SphericalTriggerRegion
} from 'yuka'; 
import { Character } from '../../Sketchbook-master/src/ts/characters/Character';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';
import { AIState, IdleState, PatrolState, ChaseState, FleeState } from './aiStates';

// Temporary: Define a minimal SketchbookCharacterLike interface
// interface SketchbookCharacterLike extends THREE.Object3D {
//     // Yuka entity will call this on the sketchbook character
//     setOrientation: (vector: THREE.Vector3, instantly?: boolean) => void;
//     // Add other methods/properties if IsolatedYukaCharacter's update logic needs them
// }

export class IsolatedYukaCharacter extends Vehicle { 
    public sketchbookCharacter: Character;
    private isAIControlled: boolean = false;
    public yukaEntityManager: EntityManager; 
    public yukaTime: Time; 
    
    // Enhanced YUKA features
    public stateMachine: StateMachine<IsolatedYukaCharacter>;
    public vision: Vision;
    public memorySystem: MemorySystem;
    private currentPath: Path | null = null;
    private pathBehavior: FollowPathBehavior | null = null;
    private obstacleAvoidance: ObstacleAvoidanceBehavior;
    
    // Perception and awareness
    private visibleEntities: Set<IsolatedYukaCharacter> = new Set();
    private lastKnownPlayerPosition: YukaVector3 | null = null;
    private alertLevel: number = 0; // 0 = calm, 1 = suspicious, 2 = alert
    private memoryRecords: MemoryRecord[] = []; // Array to store valid memory records
    
    // Behavioral parameters
    private wanderRadius: number = 10;
    private patrolPoints: YukaVector3[] = [];
    private currentPatrolIndex: number = 0;
    
    // Debug visualization
    private pathHelper: THREE.LineSegments | null = null;
    private visionHelper: THREE.Mesh | null = null;

    // Physics state for debugging/initialization
    public physicsState = {
        yVelocity: 0,
        grounded: false,
        previousPosition: new THREE.Vector3()
    };

    private currentAnimation: string = '';

    constructor(
        sketchbookCharacter: Character,
        entityManager: EntityManager,
        time: Time,
        name: string = 'isolated-yuka-character'
    ) {
        super();
        this.name = name;
        this.sketchbookCharacter = sketchbookCharacter;
        this.yukaEntityManager = entityManager;
        this.yukaTime = time;

        // Initialize YUKA entity's position from the Sketchbook character
        this.position.set(
            this.sketchbookCharacter.position.x, 
            this.sketchbookCharacter.position.y, 
            this.sketchbookCharacter.position.z
        );
        
        // Initialize rotation from Sketchbook character
        this.rotation.set(
            this.sketchbookCharacter.quaternion.x, 
            this.sketchbookCharacter.quaternion.y, 
            this.sketchbookCharacter.quaternion.z, 
            this.sketchbookCharacter.quaternion.w
        );

        // Configure vehicle properties
        this.maxSpeed = 5;  // Faster speed for AI
        this.maxForce = 10; // Strong steering forces
        this.mass = 1;
        this.boundingRadius = 1.5; // For collision detection

        // Initialize State Machine
        this.stateMachine = new StateMachine(this);
        this.stateMachine.currentState = new IdleState();
        this.stateMachine.globalState = null;
        
        // Initialize Vision System
        this.vision = new Vision(this);
        this.vision.fieldOfView = Math.PI * 0.6; // 108 degrees
        this.vision.range = 15; // Can see 15 units away
        
        // Initialize Memory System
        this.memorySystem = new MemorySystem(this);
        this.memorySystem.memorySpan = 10; // Remember things for 10 seconds
        
        // Initialize Obstacle Avoidance
        this.obstacleAvoidance = new ObstacleAvoidanceBehavior([]);
        this.obstacleAvoidance.dBoxLength = 3;
        this.steering.add(this.obstacleAvoidance);
        
        // Generate initial patrol points
        this.generatePatrolPoints();
        
        // Add this entity to the YUKA entity manager
        this.yukaEntityManager.add(this);

        console.log(`[IsolatedYukaCharacter] Enhanced AI initialized: ${this.name}`);
    }

    /**
     * Enhanced update method utilizing full YUKA capabilities
     */
    update(delta: number): this {
        super.update(delta); // Important: Call parent class update (runs YUKA steering behaviors)

        // Update AI systems if under AI control
        if (this.isAIControlled) {
            // Update perception systems
            this.updatePerception();
            
            // Note: MemorySystem doesn't have an update method - it's passive
            // Memory records are updated through vision system and getValidMemoryRecords()
            
            // Update state machine
            this.stateMachine.update();
            
            // Update alert level based on recent memories
            this.updateAlertLevel();
            
            // Update obstacle avoidance with nearby entities
            this.updateObstacleAvoidance();
            
            // Store the character's current physical position for reference
            this.physicsState.previousPosition.set(
                this.sketchbookCharacter.position.x,
                this.sketchbookCharacter.position.y,
                this.sketchbookCharacter.position.z
            );

            // Update orientation and animation
            this.sketchbookCharacter.quaternion.set(this.rotation.x, this.rotation.y, this.rotation.z, this.rotation.w);
            
            // Set orientation for animation 
            const forward = new THREE.Vector3(0, 0, 1);
            const skQuaternion = new THREE.Quaternion(
                this.sketchbookCharacter.quaternion.x,
                this.sketchbookCharacter.quaternion.y,
                this.sketchbookCharacter.quaternion.z,
                this.sketchbookCharacter.quaternion.w
            );
            forward.applyQuaternion(skQuaternion); 
            
            this.sketchbookCharacter.setOrientation({ 
                x: forward.x, 
                y: forward.y, 
                z: forward.z 
            } as any, true);
        } else {
            // Player is in control: Sketchbook character drives the YUKA entity
            this.position.set(
                this.sketchbookCharacter.position.x, 
                this.sketchbookCharacter.position.y, 
                this.sketchbookCharacter.position.z
            );
            this.rotation.set(
                this.sketchbookCharacter.quaternion.x, 
                this.sketchbookCharacter.quaternion.y, 
                this.sketchbookCharacter.quaternion.z, 
                this.sketchbookCharacter.quaternion.w
            );
        }

        // Update animation based on movement
        this.updateAnimation();
        
        return this;
    }

    /**
     * Sets whether the character is controlled by AI or by the player.
     */
    setAIControlled(aiControlled: boolean): void {
        this.isAIControlled = aiControlled;
        console.log(`[IsolatedYukaCharacter] ${this.name} AI control set to: ${this.isAIControlled}`);
    }

    isUnderAIControl(): boolean {
        return this.isAIControlled;
    }

    /**
     * Update perception systems - vision and memory
     */
    private updatePerception(): void {
        // Get all entities in the world
        const entities = this.yukaEntityManager.entities;
        
        // Clear previous visible entities
        this.visibleEntities.clear();
        
        // Check vision for each entity
        for (const entity of entities) {
            if (entity !== this && entity instanceof IsolatedYukaCharacter) {
                if (this.vision.visible(entity.position)) {
                    this.visibleEntities.add(entity);
                    
                    // Create memory record
                    const memoryRecord = new MemoryRecord(entity, this.yukaTime.getElapsed());
                    this.memorySystem.createRecord(memoryRecord);
                    
                    // If this is the player character, update last known position
                    if (!entity.isAIControlled) {
                        this.lastKnownPlayerPosition = entity.position.clone();
                    }
                }
            }
        }
    }

    /**
     * Update alert level based on recent memories and visible entities
     */
    private updateAlertLevel(): void {
        // Get valid memory records using the correct API - requires result array parameter
        this.memorySystem.getValidMemoryRecords(this.yukaTime.getElapsed(), this.memoryRecords);
        const playerVisible = Array.from(this.visibleEntities).some(entity => !entity.isAIControlled);
        
        if (playerVisible) {
            this.alertLevel = Math.min(2, this.alertLevel + 0.1);
        } else if (this.memoryRecords.length > 0) {
            this.alertLevel = Math.max(0, this.alertLevel - 0.05);
        } else {
            this.alertLevel = Math.max(0, this.alertLevel - 0.02);
        }
    }

    /**
     * Update obstacle avoidance with nearby entities
     */
    private updateObstacleAvoidance(): void {
        const obstacles: any[] = [];
        
        // Add other AI entities as obstacles
        for (const entity of this.visibleEntities) {
            if (entity !== this) {
                obstacles.push({
                    position: entity.position,
                    boundingRadius: entity.boundingRadius || 1.0
                });
            }
        }
        
        this.obstacleAvoidance.obstacles = obstacles;
    }

    /**
     * Generate patrol points around the current position
     */
    private generatePatrolPoints(): void {
        this.patrolPoints = [];
        const numPoints = 4;
        const radius = this.wanderRadius;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const x = this.position.x + Math.cos(angle) * radius;
            const z = this.position.z + Math.sin(angle) * radius;
            this.patrolPoints.push(new YukaVector3(x, this.position.y, z));
        }
    }

    /**
     * Update animation based on current movement and state
     */
    private updateAnimation(): void {
        const speed = this.velocity.length();
        let desiredAnim = 'idle';
        
        if (this.alertLevel > 1.5) {
            desiredAnim = speed > 0.1 ? 'sprint' : 'idle';
        } else if (speed > 0.1 && speed < 2.5) {
            desiredAnim = 'run_forward';
        } else if (speed >= 2.5) {
            desiredAnim = 'sprint';
        }
        
        if (this.currentAnimation !== desiredAnim) {
            if (typeof this.sketchbookCharacter.setAnimation === 'function') {
                this.sketchbookCharacter.setAnimation(desiredAnim, 0.2);
                this.currentAnimation = desiredAnim;
            }
        }
    }

    /**
     * Get current alert level (0 = calm, 1 = suspicious, 2 = alert)
     */
    getAlertLevel(): number {
        return this.alertLevel;
    }

    /**
     * Get visible entities
     */
    getVisibleEntities(): Set<IsolatedYukaCharacter> {
        return this.visibleEntities;
    }

    /**
     * Get last known player position
     */
    getLastKnownPlayerPosition(): YukaVector3 | null {
        return this.lastKnownPlayerPosition;
    }

    /**
     * Cleans up the YUKA entity by removing it from the entity manager.
     */
    dispose(): void {
        this.yukaEntityManager.remove(this);
        
        // Clean up path visualization
        if (this.pathHelper && this.pathHelper.parent) {
            this.pathHelper.parent.remove(this.pathHelper);
            
            if (this.pathHelper.geometry) {
                this.pathHelper.geometry.dispose();
            }
            
            if (this.pathHelper.material instanceof THREE.Material) {
                this.pathHelper.material.dispose();
            }
        }
        
        // Clean up vision visualization
        if (this.visionHelper && this.visionHelper.parent) {
            this.visionHelper.parent.remove(this.visionHelper);
            
            if (this.visionHelper.geometry) {
                this.visionHelper.geometry.dispose();
            }
            
            if (this.visionHelper.material instanceof THREE.Material) {
                this.visionHelper.material.dispose();
            }
        }
        
        console.log(`[IsolatedYukaCharacter] Disposed: ${this.name}`);
    }

    /**
     * Enhanced movement with path following and obstacle avoidance
     */
    moveTo(targetPosition: THREE.Vector3): void {
        const yukaTargetPosition = new YukaVector3(targetPosition.x, targetPosition.y, targetPosition.z);

        // Clear existing movement behaviors but keep obstacle avoidance
        this.steering.behaviors = this.steering.behaviors.filter(b => b instanceof ObstacleAvoidanceBehavior);

        // Add arrive behavior with medium deceleration
        const arriveBehavior = new ArriveBehavior(yukaTargetPosition, 3, 1); 
        this.steering.add(arriveBehavior);
        
        // Enable AI control
        this.setAIControlled(true);
        console.log(`[IsolatedYukaCharacter] ${this.name} moving to:`, targetPosition);
    }

    /**
     * Follow a path using YUKA's path following behavior
     */
    followPath(path: YukaVector3[]): void {
        if (path.length < 2) return;
        
        this.currentPath = new Path();
        path.forEach(point => this.currentPath!.add(point));
        
        // Clear existing movement behaviors but keep obstacle avoidance
        this.steering.behaviors = this.steering.behaviors.filter(b => b instanceof ObstacleAvoidanceBehavior);
        
        this.pathBehavior = new FollowPathBehavior(this.currentPath, 1.0);
        this.steering.add(this.pathBehavior);
        
        this.setAIControlled(true);
        console.log(`[IsolatedYukaCharacter] ${this.name} following path with ${path.length} points`);
    }

    /**
     * Start wandering behavior
     */
    startWandering(): void {
        this.steering.behaviors = this.steering.behaviors.filter(b => b instanceof ObstacleAvoidanceBehavior);
        
        const wanderBehavior = new WanderBehavior();
        wanderBehavior.radius = this.wanderRadius;
        wanderBehavior.distance = 5;
        wanderBehavior.jitter = 2;
        
        this.steering.add(wanderBehavior);
        this.setAIControlled(true);
        console.log(`[IsolatedYukaCharacter] ${this.name} started wandering`);
    }

    /**
     * Pursue another entity
     */
    pursue(target: IsolatedYukaCharacter): void {
        this.steering.behaviors = this.steering.behaviors.filter(b => b instanceof ObstacleAvoidanceBehavior);
        
        const pursuitBehavior = new PursuitBehavior(target);
        this.steering.add(pursuitBehavior);
        
        this.setAIControlled(true);
        console.log(`[IsolatedYukaCharacter] ${this.name} pursuing ${target.name}`);
    }

    /**
     * Flee from another entity
     */
    fleeFrom(threat: IsolatedYukaCharacter): void {
        this.steering.behaviors = this.steering.behaviors.filter(b => b instanceof ObstacleAvoidanceBehavior);
        
        const fleeBehavior = new FleeBehavior(threat.position);
        this.steering.add(fleeBehavior);
        
        this.setAIControlled(true);
        console.log(`[IsolatedYukaCharacter] ${this.name} fleeing from ${threat.name}`);
    }

    /**
     * Stops all AI movement
     */
    stopMovement(): void {
        this.steering.clear();
        this.velocity.set(0, 0, 0);
        console.log(`[IsolatedYukaCharacter] ${this.name} stopping movement.`);
    }

    /**
     * Set the path for this character to follow
     * @param points Array of points defining the path
     * @param scene Scene to add debug visualization to
     */
    setPath(points: THREE.Vector3[], scene?: THREE.Scene): void {
        // Create a YUKA path from the points
        this.currentPath = new Path();
        
        points.forEach(point => {
            this.currentPath?.add(new YukaVector3(point.x, point.y, point.z));
        });
        
        // Visualize the path if scene is provided
        if (scene && points.length > 1) {
            this.createPathVisualization(points, scene);
        }
    }
    
    /**
     * Create a visual representation of the path for debugging
     */
    private createPathVisualization(points: THREE.Vector3[], scene: THREE.Scene): void {
        // Clean up existing visualization
        if (this.pathHelper && this.pathHelper.parent) {
            this.pathHelper.parent.remove(this.pathHelper);
            
            if (this.pathHelper.geometry) {
                this.pathHelper.geometry.dispose();
            }
            
            if (this.pathHelper.material instanceof THREE.Material) {
                this.pathHelper.material.dispose();
            }
        }
        
        // Create new visualization
        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        
        // Add line segments for each path segment
        for (let i = 0; i < points.length - 1; i++) {
            const from = points[i];
            const to = points[i + 1];
            
            // Add line segment vertices
            vertices.push(from.x, from.y + 0.2, from.z); // Slightly above terrain
            vertices.push(to.x, to.y + 0.2, to.z);
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        // Create a line segments visualization with the character's unique color
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
        const material = new THREE.LineBasicMaterial({ color });
        this.pathHelper = new THREE.LineSegments(geometry, material);
        this.pathHelper.name = `PathHelper_${this.name}`;
        
        scene.add(this.pathHelper);
    }

    /**
     * Wrapper for the old ground snap function, now handled by yukaController
     */
    public performInitialGroundSnap(activeChunkMeshes: THREE.Mesh[]): void {
        // This method is no longer needed but kept for API compatibility
        console.log(`[IsolatedYukaCharacter] performInitialGroundSnap called for ${this.name}. This is now handled by the yukaController.`);
    }
}