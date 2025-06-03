/**
 * Physics Manager
 * 
 * This file centralizes all physics-related functionality and constants.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';
import { PHYSICS_CONSTANTS } from '../../types/sketchbookEnums';
import type { EnhancedCharacter } from '../../entities/characters/core/characterTypes';
import type { Vehicle } from '../../../entities/vehicles/vehicle';

// Physics constants
const PHYSICS = {
    GRAVITY: -9.81,
    MAX_VELOCITY: 10,
    CHARACTER: {
        MASS: 5,
        HEIGHT: 1.8,
        RADIUS: 0.3,
        MOVE_FORCE: 100,
        SPRINT_FORCE: 150,
        JUMP_FORCE: 5,
        GROUND_FRICTION: 0.3,
        AIR_FRICTION: 0.1,
        MAX_SLOPE: Math.PI / 4
    },
    VEHICLE: {
        MASS: 1500,
        FRICTION: 0.3,
        RESTITUTION: 0.2,
        CHASSIS_WIDTH: 2,
        CHASSIS_HEIGHT: 1.5,
        CHASSIS_LENGTH: 4,
        AXIS_INDICES: {
            FRONT: 0,
            REAR: 1
        },
        WHEEL_POSITIONS: [
            new THREE.Vector3(-1, 0, 2),  // Front left
            new THREE.Vector3(1, 0, 2),   // Front right
            new THREE.Vector3(-1, 0, -2), // Rear left
            new THREE.Vector3(1, 0, -2)   // Rear right
        ],
        WHEEL_OPTIONS: {
            radius: 0.4,
            directionLocal: new THREE.Vector3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 1.4,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new THREE.Vector3(1, 0, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        }
    },
    LINEAR_DAMPING: 0.01,
    ANGULAR_DAMPING: 0.01
};

// Collision groups and masks
const COLLISION = {
    GROUPS: {
        NONE: 0,
        CHARACTER: 1,
        VEHICLE: 2,
        TERRAIN: 4,
        OBJECT: 8,
        TRIGGER: 16,
        STATIC: 32
    } as const,
    MASKS: {
        CHARACTER: PHYSICS_CONSTANTS.COLLISION_MASKS.CHARACTER,
        VEHICLE: PHYSICS_CONSTANTS.COLLISION_MASKS.VEHICLE,
        TERRAIN: PHYSICS_CONSTANTS.COLLISION_MASKS.TERRAIN,
        TRIGGER: PHYSICS_CONSTANTS.COLLISION_MASKS.TRIGGER,
        STATIC: PHYSICS_CONSTANTS.COLLISION_MASKS.STATIC
    }
};

interface RaycastResult {
    hasHit: boolean;
    hitPoint: THREE.Vector3;
    hitNormal: THREE.Vector3;
    hitDistance: number;
}

export class PhysicsManager {
    private world: CANNON.World;
    private materials: {
        characterMaterial: CANNON.Material;
        vehicleMaterial: CANNON.Material;
        terrainMaterial: CANNON.Material;
        triggerMaterial: CANNON.Material;
        staticMaterial: CANNON.Material;
    };
    private bodies: Map<string, CANNON.Body> = new Map();

    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, PHYSICS.GRAVITY, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.solver.iterations = 10;
        this.world.defaultContactMaterial.friction = 0.3;

        // Initialize materials
        this.materials = {
            characterMaterial: new CANNON.Material('character'),
            vehicleMaterial: new CANNON.Material('vehicle'),
            terrainMaterial: new CANNON.Material('terrain'),
            triggerMaterial: new CANNON.Material('trigger'),
            staticMaterial: new CANNON.Material('static')
        };

        // Configure contact materials
        this.configureContactMaterials();
    }

    private configureContactMaterials(): void {
        // Character-terrain contact
        const characterTerrainContact = new CANNON.ContactMaterial(
            this.materials.characterMaterial,
            this.materials.terrainMaterial,
            {
                friction: PHYSICS.CHARACTER.GROUND_FRICTION,
                restitution: 0.2
            }
        );

        // Vehicle-terrain contact
        const vehicleTerrainContact = new CANNON.ContactMaterial(
            this.materials.vehicleMaterial,
            this.materials.terrainMaterial,
            {
                friction: PHYSICS.VEHICLE.FRICTION,
                restitution: PHYSICS.VEHICLE.RESTITUTION
            }
        );

        // Add contact materials to world
        this.world.addContactMaterial(characterTerrainContact);
        this.world.addContactMaterial(vehicleTerrainContact);
    }

    public getWorld(): CANNON.World {
        return this.world;
    }

    public getMaterials(): typeof this.materials {
        return this.materials;
    }

    public getPhysicsConstants(): typeof PHYSICS {
        return PHYSICS;
    }

    public getCollisionConstants(): typeof COLLISION {
        return COLLISION;
    }

    public initializeCharacterPhysics(character: EnhancedCharacter): void {
        if (!character || !character.modelContainer) return;

        const body = new CANNON.Body({
            mass: PHYSICS.CHARACTER.MASS,
            position: new CANNON.Vec3(),
            shape: new CANNON.Sphere(PHYSICS.CHARACTER.RADIUS),
            material: this.materials.characterMaterial
        });

        body.collisionFilterGroup = COLLISION.GROUPS.CHARACTER;
        body.collisionFilterMask = 
            COLLISION.MASKS.TERRAIN | 
            COLLISION.MASKS.VEHICLE | 
            COLLISION.MASKS.TRIGGER;

        character.physics = {
            body,
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(0, PHYSICS.GRAVITY, 0),
            force: new THREE.Vector3(),
            mass: PHYSICS.CHARACTER.MASS,
            friction: PHYSICS.CHARACTER.GROUND_FRICTION,
            restitution: 0.2,
            linearDamping: PHYSICS.LINEAR_DAMPING,
            angularDamping: PHYSICS.ANGULAR_DAMPING,
            collisionResponse: true,
            collisionFilterGroup: COLLISION.GROUPS.CHARACTER,
            collisionFilterMask: -1,
            gravity: new THREE.Vector3(0, PHYSICS.GRAVITY, 0),
            raycast: {
                hasHit: false,
                hitPoint: new THREE.Vector3(),
                hitNormal: new THREE.Vector3(),
                hitDistance: 0
            }
        };

        this.world.addBody(body);
        this.bodies.set(character.id || 'character', body);
    }

    public initializeVehiclePhysics(vehicle: Vehicle): void {
        if (!vehicle || !vehicle.model) return;

        const body = new CANNON.Body({
            mass: PHYSICS.VEHICLE.MASS,
            position: new CANNON.Vec3(),
            shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)),
            material: this.materials.vehicleMaterial
        });

        body.collisionFilterGroup = COLLISION.GROUPS.VEHICLE;
        body.collisionFilterMask = 
            COLLISION.MASKS.TERRAIN | 
            COLLISION.MASKS.CHARACTER | 
            COLLISION.MASKS.TRIGGER;

        vehicle.physics = {
            body,
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            force: new THREE.Vector3(),
            mass: PHYSICS.VEHICLE.MASS,
            friction: PHYSICS.VEHICLE.FRICTION,
            restitution: PHYSICS.VEHICLE.RESTITUTION,
            linearDamping: PHYSICS.LINEAR_DAMPING,
            angularDamping: PHYSICS.ANGULAR_DAMPING,
            collisionResponse: true,
            collisionFilterGroup: COLLISION.GROUPS.VEHICLE,
            collisionFilterMask: -1
        };

        this.world.addBody(body);
        this.bodies.set(vehicle.id || 'vehicle', body);
    }

    public update(deltaTime: number): void {
        this.world.step(1/60, deltaTime, 3);
    }

    public removeBody(body: CANNON.Body): void {
        this.world.remove(body);
    }

    public removePhysics(body: CANNON.Body): void {
        this.removeBody(body);
    }

    public raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = 100): RaycastResult {
        const from = new CANNON.Vec3(origin.x, origin.y, origin.z);
        const to = new CANNON.Vec3(
            origin.x + direction.x * maxDistance,
            origin.y + direction.y * maxDistance,
            origin.z + direction.z * maxDistance
        );
        
        const result = new CANNON.RaycastResult();
        
        // Perform the raycast
        this.world.raycastClosest(
            from,
            to,
            { skipBackfaces: true },
            result
        );
        
        if (result.hasHit) {
            return {
                hasHit: true,
                hitPoint: new THREE.Vector3(
                    result.hitPointWorld.x,
                    result.hitPointWorld.y,
                    result.hitPointWorld.z
                ),
                hitNormal: new THREE.Vector3(
                    result.hitNormalWorld.x,
                    result.hitNormalWorld.y,
                    result.hitNormalWorld.z
                ),
                hitDistance: result.distance
            };
        }

        // Default return if no hit
        return {
            hasHit: false,
            hitPoint: new THREE.Vector3(),
            hitNormal: new THREE.Vector3(0, 1, 0),
            hitDistance: 0
        };
    }
}