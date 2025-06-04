import { State, Vector3 as YukaVector3 } from 'yuka';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

/**
 * Base AI State interface
 */
export interface AIState extends State<IsolatedYukaCharacter> {
    enter(character: IsolatedYukaCharacter): void;
    execute(character: IsolatedYukaCharacter): void;
    exit(character: IsolatedYukaCharacter): void;
}

/**
 * Enhanced Idle State with automatic exploration
 */
export class IdleState extends State<IsolatedYukaCharacter> {
    private idleStartTime: number = 0;
    private maxIdleTime: number = 3000; // 3 seconds before starting exploration
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[IdleState] ${character.name} entering idle state`);
        character.stopMovement();
        this.idleStartTime = Date.now();
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const idleDuration = currentTime - this.idleStartTime;
        
        // Check for threats or interesting entities
        const visibleEntities = character.getVisibleEntities();
        const alertLevel = character.getAlertLevel();
        
        // If we see threats, switch to appropriate state
        if (alertLevel > 1.5) {
            // High alert - flee or fight
            if (visibleEntities.size > 0) {
                const threat = Array.from(visibleEntities)[0];
                character.stateMachine.changeTo(new FleeState(threat));
                return;
            }
        } else if (alertLevel > 0.8) {
            // Medium alert - investigate
            const lastKnownPosition = character.getLastKnownPlayerPosition();
            if (lastKnownPosition) {
                character.stateMachine.changeTo(new InvestigateState(lastKnownPosition));
                return;
            }
        }
        
        // Occasional look around behavior
        if (Math.random() < 0.01) { // 1% chance per frame
            this.lookAround(character);
        }
        
        // If idle too long and not in combat, start exploring
        if (idleDuration > this.maxIdleTime && alertLevel < 0.5) {
            console.log(`[IdleState] ${character.name} idle too long, starting exploration`);
            character.stateMachine.changeTo(new ExploreState());
            return;
        }
        
        // Random chance to start patrolling
        if (idleDuration > this.maxIdleTime * 0.5 && Math.random() < 0.1) {
            console.log(`[IdleState] ${character.name} randomly starting patrol`);
            character.stateMachine.changeTo(new PatrolState());
        }
    }
    
    private lookAround(character: IsolatedYukaCharacter): void {
        // Generate a random direction to look at
        const randomAngle = Math.random() * Math.PI * 2;
        const lookDirection = new YukaVector3(
            Math.cos(randomAngle),
            0,
            Math.sin(randomAngle)
        );
        
        // Use Yuka's rotation system instead of THREE.js
        character.rotateTo(lookDirection, 0.1); // Smooth rotation over time
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[IdleState] ${character.name} exiting idle state`);
    }
}

/**
 * Enhanced Patrol State with NavMesh pathfinding
 */
export class PatrolState extends State<IsolatedYukaCharacter> {
    private patrolPoints: YukaVector3[] = [];
    private currentPatrolIndex: number = 0;
    private arrivalThreshold: number = 2.0;
    private lastPatrolTime: number = 0;
    private patrolTimeout: number = 15000; // 15 seconds timeout per patrol point
    private useNavMesh: boolean = true;
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[PatrolState] ${character.name} entering patrol state`);
        this.generatePatrolPoints(character);
        this.moveToNextPatrolPoint(character);
        this.lastPatrolTime = Date.now();
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        
        // Check for threats
        const visibleEntities = character.getVisibleEntities();
        const alertLevel = character.getAlertLevel();
        
        if (alertLevel > 1.5 && visibleEntities.size > 0) {
            const threat = Array.from(visibleEntities)[0];
            character.stateMachine.changeTo(new ChaseState(threat));
            return;
        }
        
        // Check if we've reached the current patrol point
        if (this.patrolPoints.length > 0) {
            const targetPoint = this.patrolPoints[this.currentPatrolIndex];
            const distance = character.position.distanceTo(targetPoint);
            
            // If we've reached the patrol point or timed out, move to next
            if (distance < this.arrivalThreshold || (currentTime - this.lastPatrolTime) > this.patrolTimeout) {
                this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
                this.moveToNextPatrolPoint(character);
                this.lastPatrolTime = currentTime;
                
                // Brief pause at patrol point
                setTimeout(() => {
                    if (character.stateMachine.currentState === this) {
                        this.moveToNextPatrolPoint(character);
                    }
                }, 1000 + Math.random() * 2000); // 1-3 second pause
            }
        }
        
        // Random chance to switch to exploration
        if (Math.random() < 0.005) { // 0.5% chance per frame
            character.stateMachine.changeTo(new ExploreState());
        }
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[PatrolState] ${character.name} exiting patrol state`);
    }
    
    private generatePatrolPoints(character: IsolatedYukaCharacter): void {
        this.patrolPoints = [];
        const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 patrol points
        const radius = 15 + Math.random() * 10; // 15-25 unit radius
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const x = character.position.x + Math.cos(angle) * radius;
            const z = character.position.z + Math.sin(angle) * radius;
            const y = character.position.y; // Keep same height for now
            
            this.patrolPoints.push(new YukaVector3(x, y, z));
        }
        
        console.log(`[PatrolState] ${character.name} generated ${this.patrolPoints.length} patrol points`);
    }
    
    private moveToNextPatrolPoint(character: IsolatedYukaCharacter): void {
        if (this.patrolPoints.length === 0) return;
        
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        
        // Try NavMesh pathfinding first
        if (this.useNavMesh) {
            character.startNavMeshPatrol();
        } else {
            // Fallback to direct movement
            const targetPosition = new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z);
            character.moveTo(targetPosition);
        }
        
        console.log(`[PatrolState] ${character.name} moving to patrol point ${this.currentPatrolIndex + 1}/${this.patrolPoints.length}`);
    }
}

/**
 * New Explore State with NavMesh-based exploration
 */
export class ExploreState extends State<IsolatedYukaCharacter> {
    private explorationStartTime: number = 0;
    private maxExplorationTime: number = 30000; // 30 seconds of exploration
    private lastTargetTime: number = 0;
    private targetChangeInterval: number = 8000; // Change target every 8 seconds
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[ExploreState] ${character.name} entering exploration state`);
        this.explorationStartTime = Date.now();
        this.lastTargetTime = Date.now();
        character.startNavMeshExploration();
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const explorationDuration = currentTime - this.explorationStartTime;
        
        // Check for threats
        const visibleEntities = character.getVisibleEntities();
        const alertLevel = character.getAlertLevel();
        
        if (alertLevel > 1.5 && visibleEntities.size > 0) {
            const threat = Array.from(visibleEntities)[0];
            character.stateMachine.changeTo(new ChaseState(threat));
            return;
        }
        
        if (alertLevel > 0.8) {
            const lastKnownPosition = character.getLastKnownPlayerPosition();
            if (lastKnownPosition) {
                character.stateMachine.changeTo(new InvestigateState(lastKnownPosition));
                return;
            }
        }
        
        // Change exploration target periodically
        if (currentTime - this.lastTargetTime > this.targetChangeInterval) {
            character.startNavMeshExploration();
            this.lastTargetTime = currentTime;
        }
        
        // End exploration after max time
        if (explorationDuration > this.maxExplorationTime) {
            // Random choice between idle and patrol
            if (Math.random() < 0.6) {
                character.stateMachine.changeTo(new PatrolState());
            } else {
                character.stateMachine.changeTo(new IdleState());
            }
        }
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[ExploreState] ${character.name} exiting exploration state`);
    }
}

/**
 * Enhanced Chase State
 */
export class ChaseState extends State<IsolatedYukaCharacter> {
    private target: IsolatedYukaCharacter;
    private lastSeenPosition: YukaVector3;
    private chaseStartTime: number = 0;
    private maxChaseTime: number = 20000; // 20 seconds max chase
    private lostTargetTime: number = 0;
    private maxLostTime: number = 5000; // 5 seconds before giving up
    
    constructor(target: IsolatedYukaCharacter) {
        this.target = target;
        this.lastSeenPosition = target.position.clone();
    }
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[ChaseState] ${character.name} chasing ${this.target.name}`);
        this.chaseStartTime = Date.now();
        this.lostTargetTime = 0;
        character.pursue(this.target);
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const chaseDuration = currentTime - this.chaseStartTime;
        
        // Update last seen position if target is visible
        const visibleEntities = character.getVisibleEntities();
        if (visibleEntities.has(this.target)) {
            this.lastSeenPosition = this.target.position.clone();
            this.lostTargetTime = 0;
            character.pursue(this.target); // Update pursuit
        } else {
            // Target lost, start timer
            if (this.lostTargetTime === 0) {
                this.lostTargetTime = currentTime;
            }
            
            // Move to last known position
            const targetPosition = new THREE.Vector3(
                this.lastSeenPosition.x,
                this.lastSeenPosition.y,
                this.lastSeenPosition.z
            );
            character.moveTo(targetPosition);
        }
        
        // Give up chase if target lost too long or chase too long
        if ((this.lostTargetTime > 0 && currentTime - this.lostTargetTime > this.maxLostTime) ||
            chaseDuration > this.maxChaseTime) {
            character.stateMachine.changeTo(new InvestigateState(this.lastSeenPosition));
        }
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[ChaseState] ${character.name} ending chase`);
    }
}

/**
 * New Investigate State
 */
export class InvestigateState extends State<IsolatedYukaCharacter> {
    private investigationPoint: YukaVector3;
    private investigationStartTime: number = 0;
    private maxInvestigationTime: number = 10000; // 10 seconds
    private arrivalThreshold: number = 2.0;
    private hasReachedPoint: boolean = false;
    
    constructor(investigationPoint: YukaVector3) {
        this.investigationPoint = investigationPoint.clone();
    }
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[InvestigateState] ${character.name} investigating position`);
        this.investigationStartTime = Date.now();
        this.hasReachedPoint = false;
        
        const targetPosition = new THREE.Vector3(
            this.investigationPoint.x,
            this.investigationPoint.y,
            this.investigationPoint.z
        );
        character.moveTo(targetPosition);
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const investigationDuration = currentTime - this.investigationStartTime;
        
        // Check for threats
        const visibleEntities = character.getVisibleEntities();
        if (visibleEntities.size > 0) {
            const threat = Array.from(visibleEntities)[0];
            character.stateMachine.changeTo(new ChaseState(threat));
            return;
        }
        
        // Check if we've reached the investigation point
        if (!this.hasReachedPoint) {
            const distance = character.position.distanceTo(this.investigationPoint);
            if (distance < this.arrivalThreshold) {
                this.hasReachedPoint = true;
                character.stopMovement();
                // Look around for a moment
                console.log(`[InvestigateState] ${character.name} reached investigation point, looking around`);
            }
        }
        
        // End investigation after max time
        if (investigationDuration > this.maxInvestigationTime) {
            // Return to patrol or exploration
            if (Math.random() < 0.7) {
                character.stateMachine.changeTo(new PatrolState());
            } else {
                character.stateMachine.changeTo(new ExploreState());
            }
        }
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[InvestigateState] ${character.name} ending investigation`);
    }
}

/**
 * Enhanced Flee State
 */
export class FleeState extends State<IsolatedYukaCharacter> {
    private threat: IsolatedYukaCharacter;
    private fleeStartTime: number = 0;
    private maxFleeTime: number = 15000; // 15 seconds max flee
    private safeDistance: number = 20; // Consider safe when this far away
    
    constructor(threat: IsolatedYukaCharacter) {
        this.threat = threat;
    }
    
    enter(character: IsolatedYukaCharacter): void {
        console.log(`[FleeState] ${character.name} fleeing from ${this.threat.name}`);
        this.fleeStartTime = Date.now();
        character.fleeFrom(this.threat);
    }
    
    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const fleeDuration = currentTime - this.fleeStartTime;
        
        // Check distance to threat
        const distanceToThreat = character.position.distanceTo(this.threat.position);
        
        // If far enough away, stop fleeing
        if (distanceToThreat > this.safeDistance) {
            character.stateMachine.changeTo(new IdleState());
            return;
        }
        
        // Update flee behavior
        character.fleeFrom(this.threat);
        
        // Stop fleeing after max time (assume we're safe)
        if (fleeDuration > this.maxFleeTime) {
            character.stateMachine.changeTo(new IdleState());
        }
    }
    
    exit(character: IsolatedYukaCharacter): void {
        console.log(`[FleeState] ${character.name} ending flee`);
    }
}