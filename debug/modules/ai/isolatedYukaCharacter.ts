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
import { YukaNavMeshHelper } from './yukaNavMeshHelper';

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
    
    // NavMesh exploration features
    private navMeshHelper: YukaNavMeshHelper | null = null;
    private explorationTargets: THREE.Vector3[] = [];
    private currentExplorationIndex: number = 0;
    private explorationRadius: number = 50; // How far to explore from spawn point
    private spawnPosition: YukaVector3;
    private lastExplorationTime: number = 0;
    private explorationInterval: number = 10000; // Generate new exploration targets every 10 seconds
    
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
        name: string = 'isolated-yuka-character',
        navMeshHelper?: YukaNavMeshHelper
    ) {
        super();
        this.name = name;
        this.sketchbookCharacter = sketchbookCharacter;
        this.yukaEntityManager = entityManager;
        this.yukaTime = time;
        this.navMeshHelper = navMeshHelper || null;

        // Initialize YUKA entity's position from the Sketchbook character
        this.position.set(
            this.sketchbookCharacter.position.x, 
            this.sketchbookCharacter.position.y, 
            this.sketchbookCharacter.position.z
        );
        
        // Store spawn position for exploration reference
        this.spawnPosition = this.position.clone();
        
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
        this.stateMachine.add('IDLE', new IdleState()); // Add IdleState with an ID
        this.stateMachine.changeTo('IDLE'); // Change to IdleState using its ID
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
        
        // Generate initial patrol points and exploration targets
        this.generatePatrolPoints();
        this.generateExplorationTargets();
        
        // Add this entity to the YUKA entity manager
        this.yukaEntityManager.add(this);

        console.log(`[IsolatedYukaCharacter] Enhanced AI with NavMesh exploration initialized: ${this.name}`);
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
            
            // Update state machine
            this.stateMachine.update();
            
            // Update alert level based on recent memories
            this.updateAlertLevel();
            
            // Update obstacle avoidance with nearby entities
            this.updateObstacleAvoidance();
            
            // Update exploration behavior
            this.updateExploration();
            
            // Store the character's current physical position for reference
            this.physicsState.previousPosition.set(
                this.sketchbookCharacter.position.x,
                this.sketchbookCharacter.position.y,
                this.sketchbookCharacter.position.z
            );

            // --- BEGIN NAVMESH CLAMPING ---
            if (this.navMeshHelper && this.navMeshHelper.navMesh) {
                const navMesh = this.navMeshHelper.navMesh;
                // Use a small epsilon for region checks; consider making this configurable if needed
                const epsilon = typeof (this.navMeshHelper as any).regionEpsilon === 'number' ? (this.navMeshHelper as any).regionEpsilon : 0.1;

                const sourceYukaPosition = new YukaVector3(
                    this.physicsState.previousPosition.x,
                    this.physicsState.previousPosition.y,
                    this.physicsState.previousPosition.z
                );
                
                // The target position is the one calculated by Yuka's steering (this.position)
                const targetYukaPosition = this.position.clone();

                const currentRegion = navMesh.getRegionForPoint(sourceYukaPosition, epsilon);

                if (currentRegion) {
                    const clampedPosition = new YukaVector3();
                    navMesh.clampMovement(
                        currentRegion,
                        sourceYukaPosition,
                        targetYukaPosition,
                        clampedPosition
                    );
                    // Update the Yuka entity's position with the clamped one
                    this.position.copy(clampedPosition);

                    // Adjust Y position to be on the surface of the (potentially new) NavMesh region
                    const finalRegion = navMesh.getRegionForPoint(this.position, epsilon);
                    if (finalRegion) {
                        const projectedPoint = new YukaVector3();
                        finalRegion.plane.projectPoint(this.position, projectedPoint);
                        this.position.y = projectedPoint.y;
                    }
                } 
            }
            // --- END NAVMESH CLAMPING ---

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

    /**
     * Generate exploration targets using NavMesh pathfinding
     */
    private generateExplorationTargets(): void {
        this.explorationTargets = [];
        
        if (!this.navMeshHelper) {
            // Fallback to simple circular exploration if no NavMesh
            this.generateSimpleExplorationTargets();
            return;
        }
        
        const numTargets = 8;
        const attempts = 20; // Try multiple times to find valid paths
        
        for (let i = 0; i < numTargets && this.explorationTargets.length < numTargets; i++) {
            for (let attempt = 0; attempt < attempts; attempt++) {
                // Generate random point within exploration radius
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * this.explorationRadius;
                const targetX = this.spawnPosition.x + Math.cos(angle) * distance;
                const targetZ = this.spawnPosition.z + Math.sin(angle) * distance;
                const targetY = this.spawnPosition.y; // Keep same height for now
                
                const targetPosition = new THREE.Vector3(targetX, targetY, targetZ);
                const currentPosition = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
                
                // Test if we can find a path to this target
                const path = this.navMeshHelper.findPath(currentPosition, targetPosition);
                
                if (path && path.length > 2) { // Ensure path has meaningful length
                    this.explorationTargets.push(targetPosition);
                    console.log(`[IsolatedYukaCharacter] ${this.name} found exploration target ${i + 1}: ${targetPosition.toArray()}`);
                    break;
                }
            }
        }
        
        // If we couldn't find enough NavMesh targets, fill with simple targets
        if (this.explorationTargets.length < numTargets) {
            console.warn(`[IsolatedYukaCharacter] ${this.name} could only find ${this.explorationTargets.length} NavMesh exploration targets, filling with simple targets`);
            this.generateSimpleExplorationTargets(numTargets - this.explorationTargets.length);
        }
        
        console.log(`[IsolatedYukaCharacter] ${this.name} generated ${this.explorationTargets.length} exploration targets`);
    }
    
    /**
     * Fallback exploration target generation without NavMesh
     */
    private generateSimpleExplorationTargets(count: number = 8): void {
        const startIndex = this.explorationTargets.length;
        
        for (let i = 0; i < count; i++) {
            const angle = ((startIndex + i) / (startIndex + count)) * Math.PI * 2;
            const distance = this.explorationRadius * (0.5 + Math.random() * 0.5); // 50-100% of radius
            const x = this.spawnPosition.x + Math.cos(angle) * distance;
            const z = this.spawnPosition.z + Math.sin(angle) * distance;
            this.explorationTargets.push(new THREE.Vector3(x, this.spawnPosition.y, z));
        }
    }
    
    /**
     * Update exploration behavior - automatically explore when idle
     */
    private updateExploration(): void {
        const currentTime = Date.now();
        
        // Regenerate exploration targets periodically
        if (currentTime - this.lastExplorationTime > this.explorationInterval) {
            this.generateExplorationTargets();
            this.lastExplorationTime = currentTime;
        }
        
        // If agent is idle and not in combat, start exploring
        if (this.stateMachine.currentState instanceof IdleState && this.alertLevel < 1.0) {
            this.startNavMeshExploration();
        }
    }
    
    /**
     * Start NavMesh-based exploration
     */
    public startNavMeshExploration(): void {
        if (this.explorationTargets.length === 0) {
            this.generateExplorationTargets();
        }
        
        if (this.explorationTargets.length === 0) {
            console.warn(`[IsolatedYukaCharacter] ${this.name} has no exploration targets, falling back to wandering`);
            this.startWandering();
            return;
        }
        
        // Get next exploration target
        const targetPosition = this.explorationTargets[this.currentExplorationIndex];
        this.currentExplorationIndex = (this.currentExplorationIndex + 1) % this.explorationTargets.length;
        
        // Use NavMesh pathfinding if available
        if (this.navMeshHelper) {
            const currentPosition = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
            const path = this.navMeshHelper.findPath(currentPosition, targetPosition);
            
            if (path && path.length > 1) {
                // Convert THREE.Vector3 path to YukaVector3 path
                const yukaPath = path.map(point => new YukaVector3(point.x, point.y, point.z));
                this.followPath(yukaPath);
                console.log(`[IsolatedYukaCharacter] ${this.name} exploring via NavMesh path to ${targetPosition.toArray()} with ${path.length} waypoints`);
                return;
            } else {
                console.warn(`[IsolatedYukaCharacter] ${this.name} could not find NavMesh path to exploration target, using direct movement`);
            }
        }
        
        // Fallback to direct movement
        this.moveTo(targetPosition);
        console.log(`[IsolatedYukaCharacter] ${this.name} exploring directly to ${targetPosition.toArray()}`);
    }
    
    /**
     * Enhanced patrol with NavMesh pathfinding
     */
    public startNavMeshPatrol(): void {
        if (this.patrolPoints.length === 0) {
            this.generatePatrolPoints();
        }
        
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        
        // Use NavMesh pathfinding if available
        if (this.navMeshHelper) {
            const currentPosition = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
            const targetPosition = new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z);
            const path = this.navMeshHelper.findPath(currentPosition, targetPosition);
            
            if (path && path.length > 1) {
                // Convert THREE.Vector3 path to YukaVector3 path
                const yukaPath = path.map(point => new YukaVector3(point.x, point.y, point.z));
                this.followPath(yukaPath);
                console.log(`[IsolatedYukaCharacter] ${this.name} patrolling via NavMesh path with ${path.length} waypoints`);
                return;
            }
        }
        
        // Fallback to direct movement
        this.moveTo(new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z));
        console.log(`[IsolatedYukaCharacter] ${this.name} patrolling directly to patrol point`);
    }
    
    /**
     * Set NavMesh helper for pathfinding
     */
    public setNavMeshHelper(navMeshHelper: YukaNavMeshHelper): void {
        this.navMeshHelper = navMeshHelper;
        // Regenerate exploration targets with new NavMesh
        this.generateExplorationTargets();
        console.log(`[IsolatedYukaCharacter] ${this.name} NavMesh helper updated, regenerated exploration targets`);
    }
    
    /**
     * Get current exploration status
     */
    public getExplorationStatus(): { 
        isExploring: boolean, 
        currentTarget: THREE.Vector3 | null, 
        targetsRemaining: number,
        usingNavMesh: boolean 
    } {
        const isExploring = this.isAIControlled && (this.pathBehavior !== null || this.steering.behaviors.some(b => b instanceof WanderBehavior));
        const currentTarget = this.explorationTargets.length > 0 ? this.explorationTargets[this.currentExplorationIndex] : null;
        
        return {
            isExploring,
            currentTarget,
            targetsRemaining: this.explorationTargets.length,
            usingNavMesh: this.navMeshHelper !== null
        };
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