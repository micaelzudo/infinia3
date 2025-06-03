declare module 'yuka' {
    export class Time {
        constructor();
        update(): Time;
        getDelta(): number;
        timeScale: number;
    }

    export class EntityManager {
        constructor();
        update(delta: number): void;
        add(entity: GameEntity): this;
        remove(entity: GameEntity): this;
        entities: GameEntity[];
    }

    export class GameEntity {
        constructor();
        uuid: string;
        name: string;
        position: Vector3;
        rotation: Quaternion;
        velocity: Vector3;
        scale: Vector3;
        boundingBox: any;
        boundingRadius: number;
        neighbors: GameEntity[];
        maxSpeed: number;
        mass: number;
        update(delta: number): this;
        getSpeed(): number;
        getDirection(result: Vector3): Vector3;
        setOrientation(direction: Vector3, instantly?: boolean): void;
    }

    export class Vehicle extends GameEntity {
        constructor();
        steering: SteeringManager;
        maxForce: number;
        pathHelper: THREE.LineSegments | null;
        currentAnimation: string;
        physicsState: { yVelocity: number; grounded: boolean; previousPosition: THREE.Vector3 };
        activePathData: { path: THREE.Vector3[], currentIndex: number, targetPosition: THREE.Vector3 } | null;
        isUnderAIControl(): boolean;
        setAIControlled(aiControlled: boolean): void;
        setPath(points: THREE.Vector3[], scene?: THREE.Scene): void;
        moveTo(targetPosition: THREE.Vector3): void;
    }

    export class Vector3 {
        constructor(x?: number, y?: number, z?: number);
        x: number;
        y: number;
        z: number;
        set(x: number, y: number, z: number): this;
        copy(v: Vector3 | THREE.Vector3): this;
        add(v: Vector3): this;
        sub(v: Vector3): this;
        subVectors(a: Vector3, b: Vector3): this;
        multiplyScalar(s: number): this;
        divideScalar(s: number): this;
        normalize(): this;
        length(): number;
        lengthSq(): number;
        distanceTo(v: Vector3): number;
        squaredDistanceTo(v: Vector3): number;
        dot(v: Vector3): number;
        cross(v: Vector3): this;
        crossVectors(a: Vector3, b: Vector3): this;
        toArray(xyz: number[]): number[];
        fromArray(xyz: number[]): this;
        applyMatrix4(m: THREE.Matrix4): this;
        applyRotation(q: Quaternion): this;
        toFixed?(digits: number): string;
    }

    export class Quaternion {
        constructor(x?: number, y?: number, z?: number, w?: number);
        x: number;
        y: number;
        z: number;
        w: number;
        set(x: number, y: number, z: number, w: number): this;
        copy(q: Quaternion | THREE.Quaternion): this;
        multiply(q: Quaternion): this;
        premultiply(q: Quaternion): this;
        identity(): this;
        invert(): this;
        slerp(q: Quaternion, t: number): this;
        slerpQuaternions(q1: Quaternion, q2: Quaternion, t: number): this;
        random(): this;
        toArray(xyzw: number[]): number[];
        fromArray(xyzw: number[]): this;
    }

    export class SteeringManager {
        constructor(vehicle: Vehicle);
        behaviors: SteeringBehavior[];
        clear(): void;
        add(behavior: SteeringBehavior): this;
        remove(behavior: SteeringBehavior): this;
        update(delta: number): this;
    }

    export class SteeringBehavior {
        active: boolean;
        weight: number;
        constructor();
        calculate(vehicle: Vehicle, force: Vector3, delta: number): Vector3;
        toJSON(): object;
        fromJSON(json: object): this;
        resolveReferences(entities: Map<string, GameEntity>): this;
    }

    export class ArriveBehavior extends SteeringBehavior {
        constructor(target: Vector3, deceleration?: number, tolerance?: number);
        target: Vector3;
        deceleration: number;
        tolerance: number;
    }

    export class SeekBehavior extends SteeringBehavior {
        constructor(target: Vector3);
        target: Vector3;
    }

    export class FleeBehavior extends SteeringBehavior {
        constructor(target: Vector3, panicDistance?: number);
        target: Vector3;
        panicDistance: number;
    }

    export class WanderBehavior extends SteeringBehavior {
        constructor(radius?: number, distance?: number, jitter?: number);
        radius: number;
        distance: number;
        jitter: number;
    }

    export class PursuitBehavior extends SteeringBehavior {
        constructor(evader?: GameEntity, predictionFactor?: number);
        evader: GameEntity | null;
        predictionFactor: number;
    }

    export class EvadeBehavior extends SteeringBehavior {
        constructor(pursuer?: GameEntity, panicDistance?: number, predictionFactor?: number);
        pursuer: GameEntity | null;
        panicDistance: number;
        predictionFactor: number;
    }

    export class OffsetPursuitBehavior extends SteeringBehavior {
        constructor(leader?: GameEntity, offset?: Vector3);
        leader: GameEntity | null;
        offset: Vector3;
    }

    export class InterposeBehavior extends SteeringBehavior {
        constructor(entity1?: GameEntity, entity2?: GameEntity, deceleration?: number);
        entity1: GameEntity | null;
        entity2: GameEntity | null;
        deceleration: number;
    }

    export class SeparationBehavior extends SteeringBehavior {
        constructor();
        neighborhoodRadius: number;
    }

    export class AlignmentBehavior extends SteeringBehavior {
        constructor();
        neighborhoodRadius: number;
    }

    export class CohesionBehavior extends SteeringBehavior {
        constructor();
        neighborhoodRadius: number;
    }

    export class ObstacleAvoidanceBehavior extends SteeringBehavior {
        constructor(obstacles?: GameEntity[]);
        obstacles: GameEntity[];
        brakingWeight: number;
        dBoxMinLength: number;
    }

    export class Path {
        constructor();
        add(point: Vector3): void;
        remove(point: Vector3): void;
        clear(): void;
        length(): number;
        points: Vector3[];
    }

    export class State<T> {
        constructor();
        enter(entity: T): void;
        execute(entity: T): void;
        exit(entity: T): void;
        onMessage(entity: T, telegram: any): boolean;
        getName?(): string;
    }

    export class StateMachine<T> {
        constructor(owner: T);
        currentState: State<T> | null;
        globalState: State<T> | null;
        previousState: State<T> | null;
        owner: T;
        update(): void;
        changeState(newState: State<T>): void;
        revertToPreviousState(): void;
        handleMessage(telegram: any): boolean;
        dispose?(): void;
    }

    export class NavMeshGenerator {
        constructor();
        fromGeometry(geometry: THREE.BufferGeometry): NavMesh;
    }

    export class NavMesh {
        regions: any[];
        findPath(from: Vector3, to: Vector3): Vector3[];
        getClosestPoint(point: Vector3): Vector3;
        isPointOnNavMesh(point: Vector3): boolean;
        getRandomPoint(): Vector3;
    }
} 