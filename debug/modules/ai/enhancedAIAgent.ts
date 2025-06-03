import * as THREE from 'three';
import { GameEntity, MovingEntity, Vehicle, StateMachine, State, Goal, CompositeGoal, Think, GoalEvaluator } from './yuka-master/src/yuka.js';
import { AdvancedAIFeatures, VisionConfig, AdvancedAIConfig } from './advancedAIFeatures.js';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter.js';
import { Character } from '../../../src/ts/sketchbook/characters/Character.js';

// Enhanced AI Agent with all advanced features
export class EnhancedAIAgent extends MovingEntity {
    public character: Character;
    public yukaCharacter: IsolatedYukaCharacter;
    public vehicle: Vehicle;
    public stateMachine: StateMachine;
    public thinkComponent: Think;
    
    // Advanced AI Systems
    private advancedAI: AdvancedAIFeatures;
    private agentId: string;
    private config: AdvancedAIConfig;
    
    // AI State
    private currentGoal: Goal | null = null;
    private alertLevel: number = 0;
    private lastDecisionTime: number = 0;
    private decisionInterval: number = 1000; // 1 second
    
    // Memory and Perception
    private knownEntities: Set<string> = new Set();
    private threatEntities: Set<string> = new Set();
    private interestPoints: THREE.Vector3[] = [];
    
    constructor(
        character: Character,
        yukaCharacter: IsolatedYukaCharacter,
        config: AdvancedAIConfig = {}
    ) {
        super();
        
        this.character = character;
        this.yukaCharacter = yukaCharacter;
        this.agentId = character.name || `agent_${Date.now()}`;
        this.config = {
            enableVision: true,
            enableMemory: true,
            enableFuzzyLogic: true,
            enableSpatialOptimization: true,
            enableAdvancedSteering: true,
            enableGraphPathfinding: true,
            enableTriggers: true,
            enableTaskScheduling: true,
            enableMessaging: true,
            ...config
        };
        
        this.advancedAI = AdvancedAIFeatures.getInstance();
        
        this.initializeAIComponents();
        this.setupGoalSystem();
        this.setupAdvancedFeatures();
        
        console.log(`🤖 Enhanced AI Agent '${this.agentId}' initialized with advanced features`);
    }
    
    private initializeAIComponents(): void {
        // Initialize vehicle for steering behaviors
        this.vehicle = new Vehicle();
        this.vehicle.position.copy(this.position);
        this.vehicle.maxSpeed = 5;
        this.vehicle.maxForce = 10;
        
        // Initialize state machine
        this.stateMachine = new StateMachine(this);
        
        // Initialize thinking component
        this.thinkComponent = new Think(this);
        this.setupGoalEvaluators();
    }
    
    private setupGoalEvaluators(): void {
        // Patrol Goal Evaluator
        const patrolEvaluator = new PatrolGoalEvaluator(0.5);
        this.thinkComponent.addEvaluator(patrolEvaluator);
        
        // Investigate Goal Evaluator
        const investigateEvaluator = new InvestigateGoalEvaluator(0.7);
        this.thinkComponent.addEvaluator(investigateEvaluator);
        
        // Combat Goal Evaluator
        const combatEvaluator = new CombatGoalEvaluator(0.9);
        this.thinkComponent.addEvaluator(combatEvaluator);
        
        // Flee Goal Evaluator
        const fleeEvaluator = new FleeGoalEvaluator(0.8);
        this.thinkComponent.addEvaluator(fleeEvaluator);
    }
    
    private setupGoalSystem(): void {
        // Use the existing think component as the main goal
        this.currentGoal = this.thinkComponent;
        
        // Activate the main goal
        if (this.currentGoal) {
            this.currentGoal.activate();
        }
    }
    
    private setupAdvancedFeatures(): void {
        // Setup Vision System
        if (this.config.enableVision) {
            const visionConfig: VisionConfig = {
                fieldOfView: Math.PI * 0.6, // 108 degrees
                range: 30
            };
            this.advancedAI.visionSystem.createVisionComponent(this.agentId, this, visionConfig);
        }
        
        // Setup Memory System
        if (this.config.enableMemory) {
            this.advancedAI.memorySystem.createMemoryForAgent(this.agentId);
        }
        
        // Setup Fuzzy Logic
        if (this.config.enableFuzzyLogic) {
            this.advancedAI.fuzzyLogicSystem.createAgentFuzzyLogic(this.agentId);
        }
        
        // Setup Advanced Steering
        if (this.config.enableAdvancedSteering) {
            this.setupAdvancedSteering();
        }
        
        // Setup Triggers
        if (this.config.enableTriggers) {
            this.setupTriggers();
        }
    }
    
    private setupAdvancedSteering(): void {
        // Add separation behavior for crowd avoidance
        this.advancedAI.advancedSteering.addSeparationBehavior(this.agentId, this.vehicle);
        
        // Obstacle avoidance will be set up when obstacles are detected
    }
    
    private setupTriggers(): void {
        // Create alert trigger around the agent
        const alertRadius = 15;
        this.advancedAI.triggerSystem.createSphericalTrigger(
            `${this.agentId}_alert`,
            this.character.position,
            alertRadius,
            () => this.onAlertTriggered()
        );
        
        // Create investigation trigger for larger area
        const investigateRadius = 25;
        this.advancedAI.triggerSystem.createSphericalTrigger(
            `${this.agentId}_investigate`,
            this.character.position,
            investigateRadius,
            () => this.onInvestigateTriggered()
        );
    }
    
    private onAlertTriggered(): void {
        this.alertLevel = Math.min(this.alertLevel + 0.3, 1.0);
        console.log(`⚠️ Agent ${this.agentId} alert level increased to ${this.alertLevel.toFixed(2)}`);
    }
    
    private onInvestigateTriggered(): void {
        // Add current position as point of interest
        this.interestPoints.push(this.character.position.clone());
        console.log(`🔍 Agent ${this.agentId} noted point of interest`);
    }
    
    public update(delta: number): void {
        super.update(delta);
        
        // Update vehicle position
        this.vehicle.position.copy(this.position);
        
        // Update perception and decision making
        this.updatePerception(delta);
        this.updateDecisionMaking(delta);
        
        // Update goals
        if (this.currentGoal) {
            this.currentGoal.execute();
            
            // Check if goal is completed or failed
            if (this.currentGoal.status === Goal.STATUS.COMPLETED || 
                this.currentGoal.status === Goal.STATUS.FAILED) {
                this.currentGoal = null;
            }
        }
        
        // Update state machine
        this.stateMachine.update();
        
        // Decay alert level over time
        this.alertLevel = Math.max(this.alertLevel - delta * 0.1, 0);
        
        // Update triggers
        if (this.config.enableTriggers) {
            this.advancedAI.triggerSystem.checkTriggers(this);
        }
    }
    
    private updatePerception(delta: number): void {
        if (!this.config.enableVision) return;
        
        // Get nearby entities using spatial optimization
        const nearbyEntities = this.config.enableSpatialOptimization 
            ? this.advancedAI.spatialOptimizer.findNearbyEntities(this.character.position, 50)
            : [];
        
        // Check vision for each nearby entity
        const visibleEntities = this.advancedAI.visionSystem.getVisibleEntities(this.agentId, nearbyEntities);
        
        // Update memory with visible entities
        if (this.config.enableMemory) {
            visibleEntities.forEach(entity => {
                if (entity.position) {
                    this.advancedAI.memorySystem.recordSighting(
                        this.agentId,
                        entity,
                        entity.position
                    );
                    
                    const entityId = entity.uuid || entity.id?.toString() || 'unknown';
                    this.knownEntities.add(entityId);
                    
                    // Determine if entity is a threat (simplified logic)
                    if (this.isEntityThreat(entity)) {
                        this.threatEntities.add(entityId);
                        this.alertLevel = Math.min(this.alertLevel + 0.2, 1.0);
                    }
                }
            });
        }
    }
    
    private updateDecisionMaking(delta: number): void {
        const currentTime = performance.now();
        
        if (currentTime - this.lastDecisionTime < this.decisionInterval) {
            return;
        }
        
        this.lastDecisionTime = currentTime;
        
        if (!this.config.enableFuzzyLogic) return;
        
        // Calculate decision inputs
        const health = this.getHealthPercentage();
        const nearestThreatDistance = this.getNearestThreatDistance();
        const threatLevel = this.calculateThreatLevel();
        
        // Make fuzzy logic decision
        const decision = this.advancedAI.fuzzyLogicSystem.makeDecision(
            this.agentId,
            health,
            nearestThreatDistance,
            threatLevel
        );
        
        // Execute decision
        this.executeDecision(decision);
    }
    
    private executeDecision(decision: string): void {
        switch (decision) {
            case 'flee':
                this.setGoal(new FleeGoal(this));
                break;
            case 'attack':
                this.setGoal(new CombatGoal(this));
                break;
            case 'patrol':
            default:
                this.setGoal(new PatrolGoal(this));
                break;
        }
    }
    
    private setGoal(goal: Goal): void {
        if (this.currentGoal) {
            this.currentGoal.terminate();
        }
        
        this.currentGoal = goal;
        this.currentGoal.activate();
        
        console.log(`🎯 Agent ${this.agentId} set new goal: ${goal.constructor.name}`);
    }
    
    private isEntityThreat(entity: GameEntity): boolean {
        // Simplified threat detection - in a real game, this would be more sophisticated
        return entity.constructor.name.includes('Enemy') || 
               entity.constructor.name.includes('Hostile');
    }
    
    private getHealthPercentage(): number {
        // Return health as percentage (0-100)
        // This would be connected to the actual character health system
        return 100; // Placeholder
    }
    
    private getNearestThreatDistance(): number {
        if (this.threatEntities.size === 0) return 50; // Max distance if no threats
        
        let minDistance = 50;
        
        this.threatEntities.forEach(threatId => {
            const memory = this.advancedAI.memorySystem.getMemoryRecord(this.agentId, threatId);
            if (memory && memory.visible) {
                const distance = this.character.position.distanceTo(
                    new THREE.Vector3(
                        memory.lastSensedPosition.x,
                        memory.lastSensedPosition.y,
                        memory.lastSensedPosition.z
                    )
                );
                minDistance = Math.min(minDistance, distance);
            }
        });
        
        return minDistance;
    }
    
    private calculateThreatLevel(): number {
        // Calculate threat level based on number of threats, alert level, etc.
        const threatCount = this.threatEntities.size;
        const baseThreat = Math.min(threatCount * 2, 8);
        const alertBonus = this.alertLevel * 2;
        
        return Math.min(baseThreat + alertBonus, 10);
    }
    
    public sendMessage(receiver: GameEntity, message: string, data?: any): void {
        if (this.config.enableMessaging) {
            this.advancedAI.messageSystem.sendMessage(this, receiver, message, 0, data);
        }
    }
    
    public broadcastMessage(receivers: GameEntity[], message: string, data?: any): void {
        if (this.config.enableMessaging) {
            this.advancedAI.messageSystem.broadcastMessage(this, receivers, message, data);
        }
    }
    
    public handleMessage(telegram: any): boolean {
        console.log(`📨 Agent ${this.agentId} received message: ${telegram.message}`);
        
        switch (telegram.message) {
            case 'ENEMY_SPOTTED':
                this.alertLevel = Math.min(this.alertLevel + 0.5, 1.0);
                if (telegram.data && telegram.data.position) {
                    this.interestPoints.push(telegram.data.position);
                }
                return true;
                
            case 'ALL_CLEAR':
                this.alertLevel = Math.max(this.alertLevel - 0.3, 0);
                return true;
                
            case 'REQUEST_BACKUP':
                // Move towards the sender
                if (telegram.sender && telegram.sender.position) {
                    this.setGoal(new MoveToGoal(this, telegram.sender.position));
                }
                return true;
        }
        
        return false;
    }
    
    public getMemoryRecords(): any[] {
        if (!this.config.enableMemory) return [];
        return this.advancedAI.memorySystem.getRecentMemories(this.agentId, 30);
    }
    
    public getKnownEntities(): string[] {
        return Array.from(this.knownEntities);
    }
    
    public getThreatEntities(): string[] {
        return Array.from(this.threatEntities);
    }
    
    public getAlertLevel(): number {
        return this.alertLevel;
    }
    
    public addInterestPoint(position: THREE.Vector3): void {
        this.interestPoints.push(position.clone());
        console.log(`📍 Agent ${this.agentId} added interest point at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    }
    
    public getInterestPoints(): THREE.Vector3[] {
        return [...this.interestPoints];
    }
    
    public clearOldInterestPoints(): void {
        // Keep only the 5 most recent interest points
        if (this.interestPoints.length > 5) {
            this.interestPoints = this.interestPoints.slice(-5);
        }
    }
}

// Goal Evaluators for the Think component
class PatrolGoalEvaluator extends GoalEvaluator {
    calculateDesirability(agent: EnhancedAIAgent): number {
        // Base desirability for patrolling
        let desirability = 0.3;
        
        // Increase if no immediate threats
        if (agent.getThreatEntities().length === 0) {
            desirability += 0.4;
        }
        
        // Increase if alert level is low
        if (agent.getAlertLevel() < 0.3) {
            desirability += 0.3;
        }
        
        return Math.min(desirability, 1.0);
    }
    
    setGoal(agent: EnhancedAIAgent): void {
        agent.setGoal(new PatrolGoal(agent));
    }
}

class InvestigateGoalEvaluator extends GoalEvaluator {
    calculateDesirability(agent: EnhancedAIAgent): number {
        let desirability = 0.0;
        
        // Increase based on number of interest points
        const interestPoints = agent.getInterestPoints();
        desirability += Math.min(interestPoints.length * 0.2, 0.6);
        
        // Increase based on alert level
        desirability += agent.getAlertLevel() * 0.4;
        
        return Math.min(desirability, 1.0);
    }
    
    setGoal(agent: EnhancedAIAgent): void {
        agent.setGoal(new InvestigateGoal(agent));
    }
}

class CombatGoalEvaluator extends GoalEvaluator {
    calculateDesirability(agent: EnhancedAIAgent): number {
        let desirability = 0.0;
        
        // High desirability if threats are present
        const threatCount = agent.getThreatEntities().length;
        if (threatCount > 0) {
            desirability = 0.8 + (threatCount * 0.1);
        }
        
        return Math.min(desirability, 1.0);
    }
    
    setGoal(agent: EnhancedAIAgent): void {
        agent.setGoal(new CombatGoal(agent));
    }
}

class FleeGoalEvaluator extends GoalEvaluator {
    calculateDesirability(agent: EnhancedAIAgent): number {
        let desirability = 0.0;
        
        // High desirability if health is low and threats are present
        const health = agent.getHealthPercentage();
        const threatCount = agent.getThreatEntities().length;
        
        if (health < 30 && threatCount > 0) {
            desirability = 0.9;
        } else if (health < 50 && threatCount > 2) {
            desirability = 0.7;
        }
        
        return Math.min(desirability, 1.0);
    }
    
    setGoal(agent: EnhancedAIAgent): void {
        agent.setGoal(new FleeGoal(agent));
    }
}

// Goal Implementations
class PatrolGoal extends Goal {
    private agent: EnhancedAIAgent;
    private patrolPoints: THREE.Vector3[] = [];
    private currentPatrolIndex: number = 0;
    
    constructor(agent: EnhancedAIAgent) {
        super();
        this.agent = agent;
        this.generatePatrolPoints();
    }
    
    private generatePatrolPoints(): void {
        const center = this.agent.character.position.clone();
        const radius = 20;
        
        // Generate 4 patrol points in a square pattern
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const point = new THREE.Vector3(
                center.x + Math.cos(angle) * radius,
                center.y,
                center.z + Math.sin(angle) * radius
            );
            this.patrolPoints.push(point);
        }
    }
    
    activate(): void {
        this.status = Goal.STATUS.ACTIVE;
        console.log(`🚶 Agent ${this.agent.agentId} started patrolling`);
    }
    
    execute(): number {
        if (this.patrolPoints.length === 0) {
            this.status = Goal.STATUS.COMPLETED;
            return this.status;
        }
        
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        const distance = this.agent.character.position.distanceTo(targetPoint);
        
        if (distance < 2.0) {
            // Reached patrol point, move to next
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
        }
        
        // Move towards current patrol point
        this.agent.yukaCharacter.setDestination(targetPoint);
        
        return this.status;
    }
    
    terminate(): void {
        this.status = Goal.STATUS.INACTIVE;
        console.log(`🛑 Agent ${this.agent.agentId} stopped patrolling`);
    }
}

class InvestigateGoal extends Goal {
    private agent: EnhancedAIAgent;
    private investigationPoints: THREE.Vector3[];
    private currentIndex: number = 0;
    
    constructor(agent: EnhancedAIAgent) {
        super();
        this.agent = agent;
        this.investigationPoints = agent.getInterestPoints();
    }
    
    activate(): void {
        this.status = Goal.STATUS.ACTIVE;
        console.log(`🔍 Agent ${this.agent.agentId} started investigating`);
    }
    
    execute(): number {
        if (this.currentIndex >= this.investigationPoints.length) {
            this.status = Goal.STATUS.COMPLETED;
            this.agent.clearOldInterestPoints();
            return this.status;
        }
        
        const targetPoint = this.investigationPoints[this.currentIndex];
        const distance = this.agent.character.position.distanceTo(targetPoint);
        
        if (distance < 3.0) {
            // Investigated this point, move to next
            this.currentIndex++;
            console.log(`🔎 Agent ${this.agent.agentId} investigated point ${this.currentIndex}/${this.investigationPoints.length}`);
        } else {
            // Move towards investigation point
            this.agent.yukaCharacter.setDestination(targetPoint);
        }
        
        return this.status;
    }
    
    terminate(): void {
        this.status = Goal.STATUS.INACTIVE;
        console.log(`🛑 Agent ${this.agent.agentId} stopped investigating`);
    }
}

class CombatGoal extends Goal {
    private agent: EnhancedAIAgent;
    private target: THREE.Vector3 | null = null;
    
    constructor(agent: EnhancedAIAgent) {
        super();
        this.agent = agent;
        this.findTarget();
    }
    
    private findTarget(): void {
        const memories = this.agent.getMemoryRecords();
        const recentThreat = memories.find(memory => 
            this.agent.getThreatEntities().includes(memory.entity?.uuid || memory.entity?.id?.toString() || '')
        );
        
        if (recentThreat) {
            this.target = new THREE.Vector3(
                recentThreat.lastSensedPosition.x,
                recentThreat.lastSensedPosition.y,
                recentThreat.lastSensedPosition.z
            );
        }
    }
    
    activate(): void {
        this.status = Goal.STATUS.ACTIVE;
        console.log(`⚔️ Agent ${this.agent.agentId} entered combat mode`);
    }
    
    execute(): number {
        if (!this.target) {
            this.status = Goal.STATUS.FAILED;
            return this.status;
        }
        
        const distance = this.agent.character.position.distanceTo(this.target);
        
        if (distance < 5.0) {
            // In combat range - perform combat actions
            console.log(`💥 Agent ${this.agent.agentId} engaging target`);
            // Combat logic would go here
        } else {
            // Move towards target
            this.agent.yukaCharacter.setDestination(this.target);
        }
        
        // Check if target is still a threat
        if (this.agent.getThreatEntities().length === 0) {
            this.status = Goal.STATUS.COMPLETED;
        }
        
        return this.status;
    }
    
    terminate(): void {
        this.status = Goal.STATUS.INACTIVE;
        console.log(`🛑 Agent ${this.agent.agentId} exited combat mode`);
    }
}

class FleeGoal extends Goal {
    private agent: EnhancedAIAgent;
    private fleeDirection: THREE.Vector3;
    
    constructor(agent: EnhancedAIAgent) {
        super();
        this.agent = agent;
        this.calculateFleeDirection();
    }
    
    private calculateFleeDirection(): void {
        // Calculate direction away from threats
        const agentPos = this.agent.character.position;
        const fleeVector = new THREE.Vector3();
        
        const memories = this.agent.getMemoryRecords();
        let threatCount = 0;
        
        memories.forEach(memory => {
            if (this.agent.getThreatEntities().includes(memory.entity?.uuid || memory.entity?.id?.toString() || '')) {
                const threatPos = new THREE.Vector3(
                    memory.lastSensedPosition.x,
                    memory.lastSensedPosition.y,
                    memory.lastSensedPosition.z
                );
                
                const awayVector = agentPos.clone().sub(threatPos).normalize();
                fleeVector.add(awayVector);
                threatCount++;
            }
        });
        
        if (threatCount > 0) {
            fleeVector.divideScalar(threatCount).normalize();
            this.fleeDirection = agentPos.clone().add(fleeVector.multiplyScalar(30));
        } else {
            // No specific threats, flee in random direction
            const randomAngle = Math.random() * Math.PI * 2;
            this.fleeDirection = agentPos.clone().add(
                new THREE.Vector3(Math.cos(randomAngle) * 30, 0, Math.sin(randomAngle) * 30)
            );
        }
    }
    
    activate(): void {
        this.status = Goal.STATUS.ACTIVE;
        console.log(`🏃 Agent ${this.agent.agentId} started fleeing`);
    }
    
    execute(): number {
        const distance = this.agent.character.position.distanceTo(this.fleeDirection);
        
        if (distance < 5.0) {
            // Reached flee destination
            this.status = Goal.STATUS.COMPLETED;
        } else {
            // Continue fleeing
            this.agent.yukaCharacter.setDestination(this.fleeDirection);
        }
        
        return this.status;
    }
    
    terminate(): void {
        this.status = Goal.STATUS.INACTIVE;
        console.log(`🛑 Agent ${this.agent.agentId} stopped fleeing`);
    }
}

class MoveToGoal extends Goal {
    private agent: EnhancedAIAgent;
    private destination: THREE.Vector3;
    
    constructor(agent: EnhancedAIAgent, destination: THREE.Vector3) {
        super();
        this.agent = agent;
        this.destination = destination.clone();
    }
    
    activate(): void {
        this.status = Goal.STATUS.ACTIVE;
        console.log(`🎯 Agent ${this.agent.agentId} moving to destination`);
    }
    
    execute(): number {
        const distance = this.agent.character.position.distanceTo(this.destination);
        
        if (distance < 3.0) {
            this.status = Goal.STATUS.COMPLETED;
        } else {
            this.agent.yukaCharacter.setDestination(this.destination);
        }
        
        return this.status;
    }
    
    terminate(): void {
        this.status = Goal.STATUS.INACTIVE;
        console.log(`🛑 Agent ${this.agent.agentId} stopped moving to destination`);
    }
}

// Global access
(window as any).EnhancedAIAgent = EnhancedAIAgent;

console.log('🤖 Enhanced AI Agent module loaded with comprehensive YUKA integration');