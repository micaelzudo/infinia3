import { Vehicle, Vector3 as YukaVector3, ArriveBehavior, GameEntity, SeekBehavior, WanderBehavior, SeparationBehavior, AlignmentBehavior, CohesionBehavior } from 'yuka';
import { Character } from '../../../debug/modules/ui/REFERENCE/modules/Sketchbook-master/src/ts/characters/Character';
import { EntityManager } from '../../core/EntityManager';
import * as THREE from 'three';

export class IsolatedYukaCharacter extends Vehicle {
    sketchbookCharacter: Character;
    pathHelper: any;
    target: YukaVector3 | null = null;
    physicsState: any;
    aiControlled: boolean = false;
    private behaviors: Map<string, any> = new Map();
    private currentState: string = 'idle';
    private stateData: any = {};
    forward: YukaVector3;
    up: YukaVector3;

    constructor(sketchbookCharacter: Character) {
        // Initialize Vehicle with default values
        super();
        
        // Set up basic Vehicle properties
        this.maxSpeed = 10;
        this.maxForce = 10;
        this.mass = 1;
        
        // Initialize position and velocity
        this.position = new YukaVector3();
        this.forward = new YukaVector3(0, 0, 1);
        this.up = new YukaVector3(0, 1, 0);
        
        this.sketchbookCharacter = sketchbookCharacter;
        this.pathHelper = {};
        this.physicsState = {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            grounded: false,
            yVelocity: 0
        };
        
        // Initialize position from sketchbook character
        this.position.fromArray(sketchbookCharacter.position.toArray([]));
        
        // Initialize steering behaviors
        this.initializeSteeringBehaviors();
        
        // Add to entity manager
        EntityManager.getInstance().add(this as unknown as GameEntity);
    }

    private initializeSteeringBehaviors(): void {
        // Arrive behavior for reaching targets
        const arriveBehavior = new ArriveBehavior(this.target || new YukaVector3());
        arriveBehavior.deceleration = 3;
        arriveBehavior.tolerance = 0.1;
        this.behaviors.set('arrive', arriveBehavior);

        // Seek behavior for direct movement
        const seekBehavior = new SeekBehavior(this.target || new YukaVector3());
        this.behaviors.set('seek', seekBehavior);

        // Wander behavior for random movement
        const wanderBehavior = new WanderBehavior();
        wanderBehavior.radius = 10;
        wanderBehavior.distance = 5;
        wanderBehavior.jitter = 2;
        this.behaviors.set('wander', wanderBehavior);

        // Flocking behaviors
        const separationBehavior = new SeparationBehavior();
        this.behaviors.set('separation', separationBehavior);

        const alignmentBehavior = new AlignmentBehavior();
        this.behaviors.set('alignment', alignmentBehavior);

        const cohesionBehavior = new CohesionBehavior();
        this.behaviors.set('cohesion', cohesionBehavior);

        // Add default behaviors to steering
        this.steering.add(arriveBehavior);
        this.steering.add(seekBehavior);
        this.steering.add(wanderBehavior);
    }

    setAIControlled(controlled: boolean): void {
        this.aiControlled = controlled;
        if (controlled) {
            this.activateBehavior('wander');
        } else {
            this.deactivateAllBehaviors();
        }
    }

    isUnderAIControl(): boolean {
        return this.aiControlled;
    }

    activateBehavior(behaviorName: string): void {
        const behavior = this.behaviors.get(behaviorName);
        if (behavior) {
            this.steering.add(behavior);
            this.currentState = behaviorName;
        }
    }

    deactivateBehavior(behaviorName: string): void {
        const behavior = this.behaviors.get(behaviorName);
        if (behavior) {
            this.steering.remove(behavior);
        }
    }

    deactivateAllBehaviors(): void {
        this.behaviors.forEach((behavior) => {
            this.steering.remove(behavior);
        });
        this.currentState = 'idle';
    }

    setStateData(data: any): void {
        this.stateData = { ...this.stateData, ...data };
    }

    getCurrentState(): string {
        return this.currentState;
    }

    update(delta: number): this {
        if (!this.aiControlled) return this;

        // Update physics state
        this.updatePhysicsState(delta);

        // Calculate steering force
        const steeringForce = new YukaVector3();
        (this.steering as any).calculate(delta, steeringForce);

        // Apply steering force to velocity
        this.velocity.add(steeringForce.multiplyScalar(delta));

        // Clamp velocity to max speed
        if ((this.velocity.length() ** 2) > this.maxSpeed * this.maxSpeed) {
            this.velocity.normalize().multiplyScalar(this.maxSpeed);
        }

        // Update position
        const displacement = new YukaVector3().copy(this.velocity).multiplyScalar(delta);
        this.position.add(displacement);

        // Update sketchbook character position
        this.sketchbookCharacter.position.fromArray(this.position.toArray([]));

        // Update orientation
        if ((this.velocity.length() ** 2) > 0.00000001) {
            const target = new YukaVector3().copy(this.position).add(this.velocity);
            (this as any).lookAt(target);
            const forward = this.forward ? 
                new THREE.Vector3(this.forward.x, this.forward.y, this.forward.z) : 
                new THREE.Vector3(0, 0, 1);
            this.sketchbookCharacter.setOrientation(forward as any, true);
        }

        return this;
    }

    private updatePhysicsState(delta: number): void {
        // Update physics state with current values
        this.physicsState.position.copy(this.position);
        this.physicsState.velocity.copy(this.velocity);
        this.physicsState.rotation.copy(this.rotation);

        // Simple ground check (can be enhanced with raycasting)
        const groundY = 0; // Replace with actual ground height
        if (this.position.y <= groundY) {
            this.physicsState.grounded = true;
            this.physicsState.yVelocity = 0;
            this.position.y = groundY;
        } else {
            this.physicsState.grounded = false;
            this.physicsState.yVelocity -= 9.8 * delta; // Apply gravity
            this.position.y += this.physicsState.yVelocity * delta;
        }
    }

    setTarget(target: YukaVector3): void {
        this.target = target;
        // Update target for all behaviors that use it
        const arriveBehavior = this.behaviors.get('arrive');
        const seekBehavior = this.behaviors.get('seek');
        if (arriveBehavior) {
            arriveBehavior.target = target;
        }
        if (seekBehavior) {
            seekBehavior.target = target;
        }
        this.activateBehavior('arrive');
    }

    dispose(): void {
        this.deactivateAllBehaviors();
        EntityManager.getInstance().remove(this as unknown as GameEntity);
    }
} 