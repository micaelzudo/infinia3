import { State } from 'yuka';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { Vector3 } from 'yuka';
import * as THREE from 'three';

// Base state class for AI states
export class AIState extends State<IsolatedYukaCharacter> {
    protected readonly name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    getName(): string {
        return this.name;
    }
}

// Enhanced Idle state with perception awareness
export class IdleState extends AIState {
    private lookAroundTimer: number = 0;
    private readonly LOOK_AROUND_INTERVAL: number = 2.0; // seconds
    private readonly IDLE_DURATION: number = 4.0; // seconds before switching to patrol
    private readonly ALERT_CHECK_INTERVAL: number = 0.5; // seconds
    private idleTimer: number = 0;
    private alertCheckTimer: number = 0;

    constructor() {
        super('Idle');
    }

    enter(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} entering Idle state`);
        // Don't clear all steering - keep obstacle avoidance
        character.steering.behaviors.forEach(behavior => {
            if (behavior.constructor.name !== 'ObstacleAvoidanceBehavior') {
                character.steering.remove(behavior);
            }
        });
        this.lookAroundTimer = 0;
        this.idleTimer = 0;
        this.alertCheckTimer = 0;
    }

    execute(character: IsolatedYukaCharacter): void {
        const deltaTime = character.yukaTime.getDelta();
        
        this.lookAroundTimer += deltaTime;
        this.idleTimer += deltaTime;
        this.alertCheckTimer += deltaTime;
        
        // Check for player visibility more frequently
        if (this.alertCheckTimer >= this.ALERT_CHECK_INTERVAL) {
            const visibleEntities = character.getVisibleEntities();
            const playerVisible = Array.from(visibleEntities).find(entity => !entity.isUnderAIControl());
            
            if (playerVisible) {
                const chaseState = new ChaseState();
                chaseState.setTargetEntity(playerVisible);
                character.stateMachine.changeState(chaseState);
                return;
            }
            
            // Check alert level - if suspicious, start investigating
            const alertLevel = character.getAlertLevel();
            if (alertLevel > 0.3) {
                const lastKnownPos = character.getLastKnownPlayerPosition();
                if (lastKnownPos) {
                    // Move towards last known position
                    character.moveTo(new THREE.Vector3(lastKnownPos.x, lastKnownPos.y, lastKnownPos.z));
                    // Don't change state immediately - investigate from idle
                }
            }
            
            this.alertCheckTimer = 0;
        }
        
        // Occasionally look around (more frequent if alert)
        const alertLevel = character.getAlertLevel();
        const lookInterval = this.LOOK_AROUND_INTERVAL * (1.0 - alertLevel * 0.5); // Faster looking when alert
        
        if (this.lookAroundTimer >= lookInterval) {
            this.lookAround(character, alertLevel > 0.2);
            this.lookAroundTimer = 0;
        }
        
        // Switch to patrol after idle duration (shorter if alert)
        const idleDuration = this.IDLE_DURATION * (1.0 - alertLevel * 0.3);
        if (this.idleTimer >= idleDuration) {
            character.stateMachine.changeState(new PatrolState());
        }
    }

    exit(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} exiting Idle state`);
    }

    private lookAround(character: IsolatedYukaCharacter, isAlert: boolean = false): void {
        // Generate a random direction to look at
        let angle: number;
        
        if (isAlert) {
            // When alert, look towards last known player position or random
            const lastKnownPos = character.getLastKnownPlayerPosition();
            if (lastKnownPos) {
                const dirToLastKnown = new Vector3(
                    lastKnownPos.x - character.position.x,
                    0,
                    lastKnownPos.z - character.position.z
                ).normalize();
                angle = Math.atan2(dirToLastKnown.z, dirToLastKnown.x) + (Math.random() - 0.5) * Math.PI * 0.5;
            } else {
                angle = Math.random() * Math.PI * 2;
            }
        } else {
            angle = Math.random() * Math.PI * 2;
        }
        
        const lookDirection = new Vector3(
            Math.cos(angle),
            0,
            Math.sin(angle)
        );
        
        // Rotate character to look in that direction
        character.rotation.setFromUnitVectors(
            new Vector3(0, 0, 1), // forward direction
            lookDirection
        );
    }
}

// Enhanced Patrol state with perception awareness
export class PatrolState extends AIState {
    private patrolPoints: THREE.Vector3[] = [];
    private currentPatrolIndex: number = 0;
    private readonly PATROL_RADIUS: number = 10;
    private readonly PATROL_POINTS: number = 4;
    private investigationTimer: number = 0;

    constructor() {
        super('Patrol');
    }

    enter(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} entering Patrol state`);
        this.generatePatrolPoints(character);
        this.moveToNextPoint(character);
        this.investigationTimer = 0;
    }

    execute(character: IsolatedYukaCharacter): void {
        // Check for player visibility - switch to chase if spotted
        const visibleEntities = character.getVisibleEntities();
        const playerVisible = Array.from(visibleEntities).find(entity => !entity.isUnderAIControl());
        
        if (playerVisible) {
            const chaseState = new ChaseState();
            chaseState.setTarget(new THREE.Vector3(playerVisible.position.x, playerVisible.position.y, playerVisible.position.z));
            character.stateMachine.changeState(chaseState);
            return;
        }
        
        // Check alert level - if suspicious, investigate last known position
        if (character.getAlertLevel() > 0.5) {
            const lastKnownPos = character.getLastKnownPlayerPosition();
            if (lastKnownPos && this.investigationTimer <= 0) {
                character.moveTo(new THREE.Vector3(lastKnownPos.x, lastKnownPos.y, lastKnownPos.z));
                this.investigationTimer = 5.0; // Investigate for 5 seconds
                return;
            }
            this.investigationTimer -= character.yukaTime.getDelta();
        }
        
        // Normal patrol behavior
        const currentPoint = this.patrolPoints[this.currentPatrolIndex];
        const distance = character.position.distanceTo(new Vector3(currentPoint.x, currentPoint.y, currentPoint.z));
        
        if (distance < 1.5) { // Within 1.5 units of the target
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            this.moveToNextPoint(character);
        }
    }

    exit(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} exiting Patrol state`);
        // Don't clear all steering - keep obstacle avoidance
    }

    private generatePatrolPoints(character: IsolatedYukaCharacter): void {
        this.patrolPoints = [];
        const center = character.position;
        
        for (let i = 0; i < this.PATROL_POINTS; i++) {
            const angle = (i / this.PATROL_POINTS) * Math.PI * 2;
            const x = center.x + Math.cos(angle) * this.PATROL_RADIUS;
            const z = center.z + Math.sin(angle) * this.PATROL_RADIUS;
            this.patrolPoints.push(new THREE.Vector3(x, center.y, z));
        }
    }

    private moveToNextPoint(character: IsolatedYukaCharacter): void {
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        character.moveTo(targetPoint);
    }
}

// Enhanced Chase state with dynamic target tracking
export class ChaseState extends AIState {
    private target: THREE.Vector3 | null = null;
    private readonly CHASE_SPEED: number = 2.5;
    private readonly GIVE_UP_DISTANCE: number = 25.0;
    private readonly GIVE_UP_TIME: number = 15.0; // seconds
    private readonly LOST_SIGHT_TIME: number = 3.0; // seconds before using last known position
    private chaseStartTime: number = 0;
    private lastSeenTime: number = 0;
    private targetEntity: any = null;

    constructor() {
        super('Chase');
    }

    enter(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} entering Chase state`);
        this.chaseStartTime = Date.now();
        this.lastSeenTime = Date.now();
        if (this.target) {
            character.pursue(this.target);
        }
    }

    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - this.chaseStartTime) / 1000;
        
        // Check if we can still see the target
        const visibleEntities = character.getVisibleEntities();
        const playerVisible = Array.from(visibleEntities).find(entity => !entity.isUnderAIControl());
        
        if (playerVisible) {
            // Update target position and last seen time
            this.target = new THREE.Vector3(playerVisible.position.x, playerVisible.position.y, playerVisible.position.z);
            this.targetEntity = playerVisible;
            this.lastSeenTime = currentTime;
            character.pursue(this.target);
        } else {
            // Lost sight of target - use last known position
            const timeSinceLastSeen = (currentTime - this.lastSeenTime) / 1000;
            
            if (timeSinceLastSeen < this.LOST_SIGHT_TIME) {
                // Still pursuing last known position
                if (this.target) {
                    character.pursue(this.target);
                }
            } else {
                // Use memory system's last known position
                const lastKnownPos = character.getLastKnownPlayerPosition();
                if (lastKnownPos) {
                    this.target = new THREE.Vector3(lastKnownPos.x, lastKnownPos.y, lastKnownPos.z);
                    character.pursue(this.target);
                }
            }
        }

        if (!this.target) {
            // No target at all, return to patrol
            character.stateMachine.changeState(new PatrolState());
            return;
        }

        const distance = character.position.distanceTo(new Vector3(this.target.x, this.target.y, this.target.z));
        const timeSinceLastSeen = (currentTime - this.lastSeenTime) / 1000;

        // Give up if target is too far, we've been chasing too long, or lost sight for too long
        if (distance > this.GIVE_UP_DISTANCE || timeElapsed > this.GIVE_UP_TIME || timeSinceLastSeen > this.GIVE_UP_TIME) {
            console.log(`[AIState] ${character.name} giving up chase - distance: ${distance.toFixed(1)}, time: ${timeElapsed.toFixed(1)}, lost sight: ${timeSinceLastSeen.toFixed(1)}`);
            character.stateMachine.changeState(new PatrolState());
            return;
        }
    }

    exit(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} exiting Chase state`);
        // Don't clear all steering - keep obstacle avoidance
    }

    setTarget(target: THREE.Vector3): void {
        this.target = target;
        this.lastSeenTime = Date.now();
    }

    setTargetEntity(entity: any): void {
        this.targetEntity = entity;
        if (entity) {
            this.target = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);
            this.lastSeenTime = Date.now();
        }
    }
}

// Enhanced Flee state with dynamic threat assessment
export class FleeState extends AIState {
    private threat: THREE.Vector3 | null = null;
    private readonly FLEE_DISTANCE: number = 15.0;
    private readonly SAFE_DISTANCE: number = 25.0;
    private readonly PANIC_DISTANCE: number = 5.0;
    private readonly FLEE_TIME_LIMIT: number = 10.0; // seconds
    private fleeStartTime: number = 0;
    private threatEntity: any = null;

    constructor() {
        super('Flee');
    }

    enter(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} entering Flee state`);
        this.fleeStartTime = Date.now();
        if (this.threat) {
            character.fleeFrom(this.threat);
        }
    }

    execute(character: IsolatedYukaCharacter): void {
        const currentTime = Date.now();
        const timeElapsed = (currentTime - this.fleeStartTime) / 1000;
        
        // Check if we can still see the threat
        const visibleEntities = character.getVisibleEntities();
        const playerVisible = Array.from(visibleEntities).find(entity => !entity.isUnderAIControl());
        
        if (playerVisible) {
            // Update threat position
            this.threat = new THREE.Vector3(playerVisible.position.x, playerVisible.position.y, playerVisible.position.z);
            this.threatEntity = playerVisible;
            
            const distance = character.position.distanceTo(new Vector3(this.threat.x, this.threat.y, this.threat.z));
            
            // If very close, increase flee intensity
            if (distance < this.PANIC_DISTANCE) {
                character.maxSpeed = 4.0; // Panic speed
                character.fleeFrom(this.threat);
            } else if (distance < this.SAFE_DISTANCE) {
                character.maxSpeed = 3.0; // Normal flee speed
                character.fleeFrom(this.threat);
            } else {
                // We're at safe distance, transition to patrol but stay alert
                character.maxSpeed = 2.0; // Reset to normal speed
                character.stateMachine.changeState(new PatrolState());
                return;
            }
        } else {
            // Lost sight of threat
            if (this.threat) {
                const distance = character.position.distanceTo(new Vector3(this.threat.x, this.threat.y, this.threat.z));
                if (distance > this.SAFE_DISTANCE || timeElapsed > this.FLEE_TIME_LIMIT) {
                    // Safe or fled long enough, return to patrol
                    character.maxSpeed = 2.0; // Reset to normal speed
                    character.stateMachine.changeState(new PatrolState());
                    return;
                } else {
                    // Continue fleeing from last known position
                    character.fleeFrom(this.threat);
                }
            } else {
                // No threat information, return to idle
                character.maxSpeed = 2.0; // Reset to normal speed
                character.stateMachine.changeState(new IdleState());
                return;
            }
        }
    }

    exit(character: IsolatedYukaCharacter): void {
        console.log(`[AIState] ${character.name} exiting Flee state`);
        character.maxSpeed = 2.0; // Reset to normal speed
        // Don't clear all steering - keep obstacle avoidance
    }

    setThreat(threat: THREE.Vector3): void {
        this.threat = threat;
        this.fleeStartTime = Date.now();
    }

    setThreatEntity(entity: any): void {
        this.threatEntity = entity;
        if (entity) {
            this.threat = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);
            this.fleeStartTime = Date.now();
        }
    }
}