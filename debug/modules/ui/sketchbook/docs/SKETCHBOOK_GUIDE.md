# Sketchbook Integration Guide

This guide explains how to use the Sketchbook character controller with the marching cubes terrain system.

## Architecture

The integration follows a modular approach with bridge files that adapt Sketchbook components to our codebase:

### Core Bridge Files

- **sketchbookImports.ts**: The main entry point that re-exports all Sketchbook components
- **sketchbookInterfaces.ts**: Defines interfaces and the `SketchbookWorldAdapter` class
- **sketchbookCore.ts**: Provides utility functions and wrappers
- **sketchbookEnums.ts**: Extends collision groups for physics interactions
- **sketchbookStates.ts**: Imports and re-exports character states
- **sketchbookVehicleStates.ts**: Imports and re-exports vehicle-related states
- **sketchbookVehicles.ts**: Provides utilities for creating and managing vehicles
- **terrainPhysicsIntegration.ts**: Handles terrain-character physics interactions

## How to Import Sketchbook Components

```typescript
// Import all needed components from the unified imports file
import {
  Character,
  CameraOperator,
  configureCharacterPhysics,
  initializeCharacter
} from './sketchbookImports';
```

## Character Integration

To add a Sketchbook character to your scene:

```typescript
// 1. Create physics world adapter
const worldAdapter = new SketchbookWorldAdapter({
  physicsWorld: physicsWorld,
  scene: scene,
  camera: camera,
  inputManager: inputManager
});

// 2. Load character model
const gltfLoader = new GLTFLoader();
const gltfAsset = await loadGLTFModel('/assets/boxman.glb');

// 3. Create and initialize character
const character = new Character(gltfAsset);
initializeCharacter(character, gltfAsset);
configureCharacterPhysics(character);

// 4. Add character to world
worldAdapter.add(character);

// 5. Set initial position
character.setPosition(0, 10, 0);
```

## Adding Terrain to Physics

To make terrain chunks interactable with characters:

```typescript
import { addTerrainChunkToPhysics } from './sketchbookImports';

// Add a terrain chunk to physics
const physicsBody = addTerrainChunkToPhysics(
  terrainMesh,
  worldAdapter,
  0.3 // friction
);
```

## Vehicle Integration

The integration also supports Sketchbook's vehicle system:

```typescript
// Import vehicle-related components
import {
  Vehicle,
  VehicleSeat,
  VehicleDoor,
  createVehicleStateConstructors
} from './sketchbookImports';

// Create a vehicle
const vehicle = new Vehicle();

// Add seats to the vehicle
const driverSeat = new VehicleSeat(vehicle, VehicleSeatType.Driver);
vehicle.add(driverSeat);

// Add vehicle to the world
worldAdapter.add(vehicle);

// Allow character to enter vehicle
// This is handled automatically if you used initializeCharacter with includeVehicleStates=true
character.findVehicleToEnter(true); // true = wants to drive
```

### Vehicle State Transitions

When a character interacts with a vehicle, it automatically transitions through these states:

1. Character finds a vehicle → OpenVehicleDoor
2. Door opens → EnteringVehicle 
3. Character enters → Sitting/Driving
4. Character exits → ExitingVehicle

You can manually trigger these transitions using:

```typescript
// If character.vehicleEntryInstance contains a valid vehicle entry point:
character.setState(
  character.states.EnteringVehicle(
    character.vehicleEntryInstance.seat, 
    character.vehicleEntryInstance.entryPoint
  )
);
```

## Version Compatibility

The bridge files handle compatibility between different versions:

- **THREE.js**: Sketchbook uses v0.113.0, we use v0.143.0
- **CANNON.js**: Sketchbook uses `cannon-es`, we use both `cannon` and `cannon-es`

Type assertions are used where necessary to ensure compatibility between different versions.

## Camera Controls

The third-person camera is controlled by Sketchbook's `CameraOperator`:

```typescript
// Create camera operator
const cameraOperator = new CameraOperator(worldAdapter, camera);
cameraOperator.followMode = true;
cameraOperator.setTarget(character.position);
worldAdapter.add(cameraOperator);
```

## Character States

Character states are imported directly from Sketchbook and managed through our helper functions:

```typescript
// Set a specific state
character.setState(character.states.Sprint);
```

## Vehicle System

The Sketchbook vehicle system allows characters to enter, drive, and exit various vehicles.

### Vehicle Types

Three main vehicle types are supported:

1. **Car**: Ground vehicle with wheels
   - Controlled with WASD for movement, Space for handbrake
   - Physics-based with suspension and realistic handling

2. **Airplane**: Flying vehicle
   - Additional controls for ascending (Space) and descending (Shift)
   - Specialized flight physics for aerodynamic movement

3. **Helicopter**: Flying vehicle with vertical takeoff/landing
   - Controls for ascending, descending, and additional rotation (Q/E)
   - Hovers in place when no movement keys are pressed

### Creating Vehicles

Helper functions are provided for creating each vehicle type:

```typescript
import { createCar, createAirplane, createHelicopter } from './sketchbookImports';

// Create a car at position (10,2,0) with 90-degree rotation
const car = await createCar(
  worldAdapter, 
  '/assets/vehicles/car.glb',
  new THREE.Vector3(10, 2, 0),
  90
);

// Set up vehicle components
const driverSeat = new VehicleSeat(car, VehicleSeatType.Driver);
const driverEntryPoint = new THREE.Object3D();
driverEntryPoint.position.set(1.5, 0, 0);
car.add(driverEntryPoint);
driverSeat.entryPoints.push(driverEntryPoint);
car.seats.push(driverSeat);
```

### Vehicle Physics

Vehicles use CANNON.js physics for realistic movement:

```typescript
import { configureVehiclePhysics } from './sketchbookImports';

// Configure car physics with mass and friction
configureVehiclePhysics(car, 800, 0.5);
```

### Character-Vehicle Interaction

Characters can interact with vehicles through a state machine:

```typescript
// Find and enter nearest vehicle
character.findVehicleToEnter(true); // true = wants to drive

// Exit current vehicle
if (character.occupyingSeat) {
  character.setState(character.states.ExitingVehicle(character.occupyingSeat));
}
```

### Input Controls

Vehicle controls are set up with:

```typescript
import { setupVehicleControls } from './sketchbookImports';

// Set up controls for the vehicle
setupVehicleControls(car, inputManager);
```

Default controls:
- WASD: Movement
- Space: Handbrake (car) or ascend (aircraft)
- Shift: Descend (aircraft)
- F: Exit vehicle
- E: Switch seats
- V: Toggle view

### Example

A complete vehicle integration example is provided in `sketchbookVehicleExample.ts`, which includes:

- Creating and configuring different vehicle types
- Setting up seats, doors, and entry points
- Functions for entering and exiting vehicles
- A sample vehicle set for testing

## Additional Resources

- Check `isolatedThirdPerson.ts` for the full implementation example
- See `sketchbookTest.ts` for a minimal test case
- The `SKETCHBOOK_GUIDE.md` file provides detailed technical information about the integration 