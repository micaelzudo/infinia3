/**
 * Sketchbook Vehicles
 * 
 * This file provides a single source of truth for all vehicle-related functionality.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PhysicsManager } from '../../core/physics/physicsManager';
import { PHYSICS_CONSTANTS, VehicleType, VehicleSeatType } from '../../types/sketchbookEnums';
import type { VehicleConfig } from './types/vehicleInterfaces';
import { BaseVehicle, Car, Motorcycle, Boat, Aircraft } from './types/vehicleTypes';

/**
 * Gets the default model path for a vehicle type
 */
function getDefaultModelPath(type: VehicleType): string {
    switch (type) {
        case VehicleType.CAR:
            return '/models/vehicles/car.glb';
        case VehicleType.MOTORCYCLE:
            return '/models/vehicles/motorcycle.glb';
        case VehicleType.BOAT:
            return '/models/vehicles/boat.glb';
        case VehicleType.AIRCRAFT:
            return '/models/vehicles/aircraft.glb';
        default:
            throw new Error(`Unknown vehicle type: ${type}`);
    }
}

/**
 * Loads a vehicle model with progress tracking
 */
async function loadVehicleModelWithProgress(modelPath: string): Promise<THREE.Group> {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
        loader.load(
            modelPath,
            (gltf) => resolve(gltf.scene),
            undefined,
            (error) => reject(error)
        );
    });
}

/**
 * Configures physics for a vehicle
 */
function configureVehiclePhysics(vehicle: BaseVehicle, config: VehicleConfig, physicsManager: PhysicsManager): void {
    const world = physicsManager.getWorld();
    const materials = physicsManager.getMaterials();
    const physics = physicsManager.getPhysicsConstants();

    // Create vehicle body with physics constants
    const chassisShape = new CANNON.Box(new CANNON.Vec3(
        physics.VEHICLE.CHASSIS_WIDTH,
        physics.VEHICLE.CHASSIS_HEIGHT,
        physics.VEHICLE.CHASSIS_LENGTH
    ));
    
    const chassisBody = new CANNON.Body({
        mass: config.physics?.mass || physics.VEHICLE.MASS,
        material: materials.vehicleMaterial,
        collisionFilterGroup: PHYSICS_CONSTANTS.COLLISION_GROUPS.VEHICLE,
        collisionFilterMask: PHYSICS_CONSTANTS.COLLISION_MASKS.VEHICLE
    });
    
    chassisBody.addShape(chassisShape);
    chassisBody.position.set(
        config.position?.x || 0,
        config.position?.y || physics.VEHICLE.CHASSIS_HEIGHT,
        config.position?.z || 0
    );
    world.addBody(chassisBody);

    // Create vehicle with physics constants
    const vehicleBody = new CANNON.RaycastVehicle({
        chassisBody,
        indexRightAxis: physics.VEHICLE.AXIS_INDICES.RIGHT,
        indexForwardAxis: physics.VEHICLE.AXIS_INDICES.FORWARD,
        indexUpAxis: physics.VEHICLE.AXIS_INDICES.UP
    });

    // Add wheels with physics constants
    const wheelPositions = physics.VEHICLE.WHEEL_POSITIONS;
    wheelPositions.forEach((position) => {
        vehicleBody.addWheel({
            ...physics.VEHICLE.WHEEL_OPTIONS,
            chassisConnectionPointLocal: new CANNON.Vec3(...position)
        });
    });

    vehicleBody.addToWorld(world);
    vehicle.initializePhysics(physicsManager);
}

/**
 * Creates a vehicle of the specified type
 */
export async function createVehicle(type: VehicleType, config: VehicleConfig): Promise<BaseVehicle> {
    // Load model
    const modelPath = config.modelPath || getDefaultModelPath(type);
    const model = await loadVehicleModelWithProgress(modelPath);

    // Create vehicle instance
    let vehicle: BaseVehicle;
    switch (type) {
        case VehicleType.CAR:
            vehicle = new Car(model, config);
            break;
        case VehicleType.MOTORCYCLE:
            vehicle = new Motorcycle(model, config);
            break;
        case VehicleType.BOAT:
            vehicle = new Boat(model, config);
            break;
        case VehicleType.AIRCRAFT:
            vehicle = new Aircraft(model, config);
            break;
        default:
            throw new Error(`Unknown vehicle type: ${type}`);
    }
    
    // Configure physics
    configureVehiclePhysics(vehicle, config, new PhysicsManager());

    return vehicle;
} 