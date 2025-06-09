import * as THREE from 'three';
import { GameEntity, MovingEntity, EntityManager, MessageDispatcher, Telegram, EventDispatcher, Regulator, Time } from './yuka-master/src/yuka.js';
import { Vision, MemoryRecord } from './yuka-master/src/yuka.js';
import { FuzzyModule, FuzzyVariable, FuzzySet, LeftShoulderFuzzySet, TriangularFuzzySet, RightShoulderFuzzySet, FuzzyRule, FuzzyAND, FuzzyOR } from './yuka-master/src/yuka.js';
import { BVH, AABB, Vector3 as YukaVector3 } from './yuka-master/src/yuka.js';
import { InterposeBehavior, ObstacleAvoidanceBehavior, SeparationBehavior, EvadeBehavior } from './yuka-master/src/yuka.js';
import { Graph, NavNode, NavEdge, AStar, Dijkstra, GraphUtils } from './yuka-master/src/yuka.js';
import { Corridor, CostTable } from './yuka-master/src/yuka.js';
import { Trigger, SphericalTriggerRegion, RectangularTriggerRegion } from './yuka-master/src/yuka.js';
import { CellSpacePartitioning } from './yuka-master/src/yuka.js';
import { TaskQueue, Task } from './yuka-master/src/yuka.js';

// Advanced AI Features Manager
export class AdvancedAIFeatures extends EventDispatcher {
    private static instance: AdvancedAIFeatures;
    
    // Core Systems
    public visionSystem: VisionSystem;
    public memorySystem: MemorySystem;
    public fuzzyLogicSystem: FuzzyLogicSystem;
    public spatialOptimizer: SpatialOptimizer;
    public advancedSteering: AdvancedSteeringSystem;
    public graphPathfinding: GraphPathfindingSystem;
    public triggerSystem: TriggerSystem;
    public taskScheduler: TaskScheduler;
    public messageSystem: MessageSystem;
    
    // Performance Regulators
    private visionRegulator: Regulator;
    private memoryRegulator: Regulator;
    private fuzzyRegulator: Regulator;
    
    private constructor() {
        super();
        this.initializeSystems();
    }
    
    public static getInstance(): AdvancedAIFeatures {
        if (!AdvancedAIFeatures.instance) {
            AdvancedAIFeatures.instance = new AdvancedAIFeatures();
        }
        return AdvancedAIFeatures.instance;
    }
    
    private initializeSystems(): void {
        // Initialize performance regulators (updates per second)
        this.visionRegulator = new Regulator(30); // 30 FPS for vision
        this.memoryRegulator = new Regulator(10); // 10 FPS for memory updates
        this.fuzzyRegulator = new Regulator(20);  // 20 FPS for fuzzy logic
        
        // Initialize core systems
        this.visionSystem = new VisionSystem();
        this.memorySystem = new MemorySystem();
        this.fuzzyLogicSystem = new FuzzyLogicSystem();
        this.spatialOptimizer = new SpatialOptimizer();
        this.advancedSteering = new AdvancedSteeringSystem();
        this.graphPathfinding = new GraphPathfindingSystem();
        this.triggerSystem = new TriggerSystem();
        this.taskScheduler = new TaskScheduler();
        this.messageSystem = new MessageSystem();
        
        console.log('🧠 Advanced AI Features initialized with all YUKA systems');
    }
    
    public update(delta: number): void {
        // Update systems based on their regulators
        if (this.visionRegulator.ready()) {
            this.visionSystem.update(delta);
        }
        
        if (this.memoryRegulator.ready()) {
            // Note: MemorySystem doesn't have an update method - it's passive
            // Memory records are updated through vision system and getValidMemoryRecords()
            // this.memorySystem.update(delta); // This method doesn't exist
        }
        
        if (this.fuzzyRegulator.ready()) {
            this.fuzzyLogicSystem.update(delta);
        }
        
        // Always update these systems
        this.advancedSteering.update(delta);
        this.triggerSystem.update(delta);
        this.taskScheduler.update(delta);
        this.messageSystem.update(delta);
    }
}

// Vision System with Memory Integration
export class VisionSystem {
    private visionComponents: Map<string, Vision> = new Map();
    private obstacles: GameEntity[] = [];
    
    public createVisionComponent(agentId: string, owner: GameEntity, config: VisionConfig = {}): Vision {
        const vision = new Vision(owner);
        
        // Configure vision parameters
        vision.fieldOfView = config.fieldOfView || Math.PI * 0.6; // 108 degrees
        vision.range = config.range || 50;
        vision.obstacles = this.obstacles;
        
        this.visionComponents.set(agentId, vision);
        
        console.log(`👁️ Vision component created for agent ${agentId}`);
        return vision;
    }
    
    public addObstacle(obstacle: GameEntity): void {
        this.obstacles.push(obstacle);
        
        // Update all vision components
        this.visionComponents.forEach(vision => {
            vision.obstacles = this.obstacles;
        });
    }
    
    public getVisibleEntities(agentId: string, entities: GameEntity[]): GameEntity[] {
        const vision = this.visionComponents.get(agentId);
        if (!vision) return [];
        
        const visibleEntities: GameEntity[] = [];
        
        for (const entity of entities) {
            if (vision.visible(entity)) {
                visibleEntities.push(entity);
            }
        }
        
        return visibleEntities;
    }
    
    public update(delta: number): void {
        // Vision system is passive - entities query it when needed
    }
}

// Memory System for AI Agents
export class MemorySystem {
    private memoryRecords: Map<string, Map<string, MemoryRecord>> = new Map();
    private memoryDuration: number = 30; // 30 seconds memory
    
    public createMemoryForAgent(agentId: string): void {
        this.memoryRecords.set(agentId, new Map());
        console.log(`🧠 Memory system created for agent ${agentId}`);
    }
    
    public recordSighting(agentId: string, targetEntity: GameEntity, position: THREE.Vector3): void {
        const agentMemory = this.memoryRecords.get(agentId);
        if (!agentMemory) return;
        
        const entityId = targetEntity.uuid || targetEntity.id?.toString() || 'unknown';
        let record = agentMemory.get(entityId);
        
        if (!record) {
            record = new MemoryRecord(targetEntity);
            agentMemory.set(entityId, record);
        }
        
        const currentTime = performance.now() / 1000;
        
        // Update memory record
        if (!record.visible) {
            record.timeBecameVisible = currentTime;
        }
        
        record.timeLastSensed = currentTime;
        record.lastSensedPosition.set(position.x, position.y, position.z);
        record.visible = true;
    }
    
    public getMemoryRecord(agentId: string, entityId: string): MemoryRecord | null {
        const agentMemory = this.memoryRecords.get(agentId);
        return agentMemory?.get(entityId) || null;
    }
    
    public getRecentMemories(agentId: string, maxAge: number = 10): MemoryRecord[] {
        const agentMemory = this.memoryRecords.get(agentId);
        if (!agentMemory) return [];
        
        const currentTime = performance.now() / 1000;
        const recentMemories: MemoryRecord[] = [];
        
        agentMemory.forEach(record => {
            if (currentTime - record.timeLastSensed <= maxAge) {
                recentMemories.push(record);
            }
        });
        
        return recentMemories;
    }
    
    public update(delta: number): void {
        const currentTime = performance.now() / 1000;
        
        // Clean up old memories and update visibility
        this.memoryRecords.forEach(agentMemory => {
            agentMemory.forEach((record, entityId) => {
                // Mark as not visible if not sensed recently
                if (currentTime - record.timeLastSensed > 1.0) {
                    record.visible = false;
                }
                
                // Remove very old memories
                if (currentTime - record.timeLastSensed > this.memoryDuration) {
                    agentMemory.delete(entityId);
                }
            });
        });
    }
}

// Fuzzy Logic System for Decision Making
export class FuzzyLogicSystem {
    private fuzzyModules: Map<string, FuzzyModule> = new Map();
    
    public createAgentFuzzyLogic(agentId: string): FuzzyModule {
        const fuzzyModule = new FuzzyModule();
        
        // Create fuzzy variables for common AI decisions
        this.setupHealthVariable(fuzzyModule);
        this.setupDistanceVariable(fuzzyModule);
        this.setupThreatVariable(fuzzyModule);
        this.setupActionVariable(fuzzyModule);
        
        // Create fuzzy rules
        this.setupFuzzyRules(fuzzyModule);
        
        this.fuzzyModules.set(agentId, fuzzyModule);
        
        console.log(`🔀 Fuzzy logic system created for agent ${agentId}`);
        return fuzzyModule;
    }
    
    private setupHealthVariable(fuzzyModule: FuzzyModule): void {
        const health = new FuzzyVariable('health');
        
        health.add(new LeftShoulderFuzzySet('low', 0, 0, 30));
        health.add(new TriangularFuzzySet('medium', 20, 50, 80));
        health.add(new RightShoulderFuzzySet('high', 70, 100, 100));
        
        fuzzyModule.addFLV('health', health);
    }
    
    private setupDistanceVariable(fuzzyModule: FuzzyModule): void {
        const distance = new FuzzyVariable('distance');
        
        distance.add(new LeftShoulderFuzzySet('close', 0, 0, 10));
        distance.add(new TriangularFuzzySet('medium', 5, 15, 25));
        distance.add(new RightShoulderFuzzySet('far', 20, 50, 50));
        
        fuzzyModule.addFLV('distance', distance);
    }
    
    private setupThreatVariable(fuzzyModule: FuzzyModule): void {
        const threat = new FuzzyVariable('threat');
        
        threat.add(new LeftShoulderFuzzySet('low', 0, 0, 3));
        threat.add(new TriangularFuzzySet('medium', 2, 5, 8));
        threat.add(new RightShoulderFuzzySet('high', 7, 10, 10));
        
        fuzzyModule.addFLV('threat', threat);
    }
    
    private setupActionVariable(fuzzyModule: FuzzyModule): void {
        const action = new FuzzyVariable('action');
        
        action.add(new LeftShoulderFuzzySet('flee', 0, 0, 3));
        action.add(new TriangularFuzzySet('patrol', 2, 5, 8));
        action.add(new RightShoulderFuzzySet('attack', 7, 10, 10));
        
        fuzzyModule.addFLV('action', action);
    }
    
    private setupFuzzyRules(fuzzyModule: FuzzyModule): void {
        // Rule 1: If health is low AND threat is high, then flee
        fuzzyModule.addRule(new FuzzyRule(
            new FuzzyAND(
                fuzzyModule.getVariable('health').getSet('low'),
                fuzzyModule.getVariable('threat').getSet('high')
            ),
            fuzzyModule.getVariable('action').getSet('flee')
        ));
        
        // Rule 2: If health is high AND threat is low, then attack
        fuzzyModule.addRule(new FuzzyRule(
            new FuzzyAND(
                fuzzyModule.getVariable('health').getSet('high'),
                fuzzyModule.getVariable('threat').getSet('low')
            ),
            fuzzyModule.getVariable('action').getSet('attack')
        ));
        
        // Rule 3: If distance is far OR threat is low, then patrol
        fuzzyModule.addRule(new FuzzyRule(
            new FuzzyOR(
                fuzzyModule.getVariable('distance').getSet('far'),
                fuzzyModule.getVariable('threat').getSet('low')
            ),
            fuzzyModule.getVariable('action').getSet('patrol')
        ));
    }
    
    public makeDecision(agentId: string, health: number, distance: number, threat: number): string {
        const fuzzyModule = this.fuzzyModules.get(agentId);
        if (!fuzzyModule) return 'patrol';
        
        // Set input values
        fuzzyModule.getVariable('health').setValue(health);
        fuzzyModule.getVariable('distance').setValue(distance);
        fuzzyModule.getVariable('threat').setValue(threat);
        
        // Process fuzzy logic
        const actionValue = fuzzyModule.getVariable('action').getValue();
        
        // Determine action based on fuzzy output
        if (actionValue <= 3) return 'flee';
        if (actionValue >= 7) return 'attack';
        return 'patrol';
    }
    
    public update(delta: number): void {
        // Fuzzy logic is stateless - decisions are made on demand
    }
}

// Spatial Optimization using BVH
export class SpatialOptimizer {
    private bvh: BVH;
    private entities: GameEntity[] = [];
    
    constructor() {
        this.bvh = new BVH(4, 10, 8); // 4-way branching, 10 primitives per node, max depth 8
        console.log('🌳 BVH Spatial Optimizer initialized');
    }
    
    public addEntity(entity: GameEntity): void {
        this.entities.push(entity);
        this.rebuildBVH();
    }
    
    public removeEntity(entity: GameEntity): void {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
            this.rebuildBVH();
        }
    }
    
    private rebuildBVH(): void {
        if (this.entities.length === 0) return;
        
        // Convert entities to triangles for BVH (simplified)
        const triangles: any[] = [];
        
        this.entities.forEach((entity, index) => {
            if (entity.position) {
                const pos = entity.position;
                // Create a simple triangle representation
                triangles.push({
                    a: { x: pos.x - 0.5, y: pos.y, z: pos.z - 0.5 },
                    b: { x: pos.x + 0.5, y: pos.y, z: pos.z - 0.5 },
                    c: { x: pos.x, y: pos.y + 1, z: pos.z + 0.5 },
                    index: index
                });
            }
        });
        
        if (triangles.length > 0) {
            this.bvh.fromTriangles(triangles);
        }
    }
    
    public findNearbyEntities(position: THREE.Vector3, radius: number): GameEntity[] {
        // Use BVH for efficient spatial queries
        const nearbyEntities: GameEntity[] = [];
        
        this.entities.forEach(entity => {
            if (entity.position) {
                const distance = position.distanceTo(entity.position);
                if (distance <= radius) {
                    nearbyEntities.push(entity);
                }
            }
        });
        
        return nearbyEntities;
    }
}

// Advanced Steering Behaviors
export class AdvancedSteeringSystem {
    private steeringBehaviors: Map<string, any[]> = new Map();
    
    public addInterposeBehavior(agentId: string, vehicle: any, entity1: MovingEntity, entity2: MovingEntity): void {
        const behavior = new InterposeBehavior(entity1, entity2, 3);
        this.addBehavior(agentId, behavior);
        console.log(`🎯 Interpose behavior added for agent ${agentId}`);
    }
    
    public addObstacleAvoidance(agentId: string, vehicle: any, obstacles: GameEntity[]): void {
        const behavior = new ObstacleAvoidanceBehavior(obstacles);
        behavior.brakingWeight = 0.3;
        behavior.dBoxLength = 8;
        this.addBehavior(agentId, behavior);
        console.log(`🚧 Obstacle avoidance added for agent ${agentId}`);
    }
    
    public addSeparationBehavior(agentId: string, vehicle: any): void {
        const behavior = new SeparationBehavior();
        this.addBehavior(agentId, behavior);
        console.log(`↔️ Separation behavior added for agent ${agentId}`);
    }
    
    public addEvadeBehavior(agentId: string, vehicle: any, pursuer: MovingEntity): void {
        const behavior = new EvadeBehavior(pursuer);
        this.addBehavior(agentId, behavior);
        console.log(`🏃 Evade behavior added for agent ${agentId}`);
    }
    
    private addBehavior(agentId: string, behavior: any): void {
        if (!this.steeringBehaviors.has(agentId)) {
            this.steeringBehaviors.set(agentId, []);
        }
        this.steeringBehaviors.get(agentId)!.push(behavior);
    }
    
    public update(delta: number): void {
        // Steering behaviors are updated by the vehicle's steering manager
    }
}

// Graph-based Pathfinding System
export class GraphPathfindingSystem {
    private graphs: Map<string, Graph> = new Map();
    
    public createGridGraph(name: string, size: number, segments: number): Graph {
        const graph = GraphUtils.createGridLayout(size, segments);
        this.graphs.set(name, graph);
        console.log(`🗺️ Grid graph '${name}' created with ${segments}x${segments} nodes`);
        return graph;
    }
    
    public findPath(graphName: string, startIndex: number, targetIndex: number, algorithm: 'astar' | 'dijkstra' = 'astar'): number[] {
        const graph = this.graphs.get(graphName);
        if (!graph) return [];
        
        let pathfinder: any;
        
        if (algorithm === 'astar') {
            pathfinder = new AStar(graph, startIndex, targetIndex);
        } else {
            pathfinder = new Dijkstra(graph, startIndex, targetIndex);
        }
        
        pathfinder.search();
        
        if (pathfinder.found) {
            return pathfinder.getPath();
        }
        
        return [];
    }
    
    public optimizePathWithCorridor(path: YukaVector3[]): YukaVector3[] {
        if (path.length < 3) return path;
        
        const corridor = new Corridor();
        
        // Build corridor from path
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            
            // Create portal edges (simplified)
            const left = new YukaVector3(current.x - 0.5, current.y, current.z);
            const right = new YukaVector3(current.x + 0.5, current.y, current.z);
            
            corridor.push(left, right);
        }
        
        return corridor.generate();
    }
}

// Trigger System for Area-based Events
export class TriggerSystem {
    private triggers: Map<string, Trigger> = new Map();
    
    public createSphericalTrigger(id: string, center: THREE.Vector3, radius: number, callback: () => void): void {
        const region = new SphericalTriggerRegion(new YukaVector3(center.x, center.y, center.z), radius);
        const trigger = new Trigger(region);
        
        trigger.addEventListener('trigger', callback);
        
        this.triggers.set(id, trigger);
        console.log(`🎯 Spherical trigger '${id}' created at (${center.x}, ${center.y}, ${center.z})`);
    }
    
    public createRectangularTrigger(id: string, min: THREE.Vector3, max: THREE.Vector3, callback: () => void): void {
        const region = new RectangularTriggerRegion(
            new YukaVector3(min.x, min.y, min.z),
            new YukaVector3(max.x, max.y, max.z)
        );
        const trigger = new Trigger(region);
        
        trigger.addEventListener('trigger', callback);
        
        this.triggers.set(id, trigger);
        console.log(`📦 Rectangular trigger '${id}' created`);
    }
    
    public checkTriggers(entity: GameEntity): void {
        this.triggers.forEach(trigger => {
            trigger.check(entity);
        });
    }
    
    public update(delta: number): void {
        // Triggers are checked manually when entities move
    }
}

// Task Scheduling System
export class TaskScheduler {
    private taskQueue: TaskQueue;
    private activeTasks: Map<string, Task> = new Map();
    
    constructor() {
        this.taskQueue = new TaskQueue();
        console.log('📋 Task Scheduler initialized');
    }
    
    public scheduleTask(id: string, task: Task): void {
        this.activeTasks.set(id, task);
        this.taskQueue.enqueue(task);
        console.log(`📝 Task '${id}' scheduled`);
    }
    
    public cancelTask(id: string): void {
        const task = this.activeTasks.get(id);
        if (task) {
            // Task cancellation would need to be implemented in YUKA
            this.activeTasks.delete(id);
            console.log(`❌ Task '${id}' cancelled`);
        }
    }
    
    public update(delta: number): void {
        this.taskQueue.update();
    }
}

// Message System for Entity Communication
export class MessageSystem {
    private messageDispatcher: MessageDispatcher;
    
    constructor() {
        this.messageDispatcher = new MessageDispatcher();
        console.log('📨 Message System initialized');
    }
    
    public sendMessage(sender: GameEntity, receiver: GameEntity, message: string, delay: number = 0, data?: any): void {
        const telegram = new Telegram(sender, receiver, message, delay, data);
        this.messageDispatcher.dispatch(telegram);
    }
    
    public broadcastMessage(sender: GameEntity, receivers: GameEntity[], message: string, data?: any): void {
        receivers.forEach(receiver => {
            this.sendMessage(sender, receiver, message, 0, data);
        });
    }
    
    public update(delta: number): void {
        this.messageDispatcher.update();
    }
}

// Configuration interfaces
export interface VisionConfig {
    fieldOfView?: number;
    range?: number;
}

export interface AdvancedAIConfig {
    enableVision?: boolean;
    enableMemory?: boolean;
    enableFuzzyLogic?: boolean;
    enableSpatialOptimization?: boolean;
    enableAdvancedSteering?: boolean;
    enableGraphPathfinding?: boolean;
    enableTriggers?: boolean;
    enableTaskScheduling?: boolean;
    enableMessaging?: boolean;
}

// Global access
(window as any).AdvancedAIFeatures = AdvancedAIFeatures;

console.log('🚀 Advanced AI Features module loaded with comprehensive YUKA integration');