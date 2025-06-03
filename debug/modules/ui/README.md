# Sketchbook Integration for Marching Cubes

This directory contains the integration files for using Sketchbook's character controller and vehicle system with our marching cubes terrain generation.

## File Organization

The integration follows a modular approach with bridge files:

- **Unified Entry Point:**
  - **sketchbookImports.ts**: Main entry point that re-exports all components

- **Core Character System:**
  - **sketchbookCore.ts**: Basic utilities and wrappers for Sketchbook core components
  - **sketchbookEnums.ts**: Collision group definitions and physics material setup
  - **sketchbookInterfaces.ts**: Main interfaces and the SketchbookWorldAdapter class
  - **sketchbookStates.ts**: Character state machine integration

- **Vehicle Integration:**
  - **sketchbookVehicleStates.ts**: Vehicle-related character states
  - **sketchbookVehicles.ts**: Utilities for creating and managing vehicles
  - **sketchbookVehicleExample.ts**: Complete example of vehicle integration

- **Physics Integration:**
  - **terrainPhysicsIntegration.ts**: Connect terrain chunks to character physics

- **Implementation Examples:**
  - **isolatedThirdPerson.ts**: Third-person character controller implementation
  - **isolatedFirstPerson.ts**: First-person character controller implementation
  - **sketchbookTest.ts**: Simple test case for the integration

- **Documentation:**
  - **README_SKETCHBOOK.md**: Detailed usage guide
  - **SKETCHBOOK_GUIDE.md**: Technical information and examples

## Quick Start

1. Import what you need from the unified imports file:

```typescript
import {
  // Character components
  Character,
  CharacterStateBase,
  
  // Vehicle components
  Car,
  VehicleSeat,
  
  // Helper functions
  initializeCharacter,
  createCar,
  
  // Utilities
  createInputManager
} from './sketchbookImports';
```

2. Create a world adapter that connects Sketchbook to your scene:

```typescript
const worldAdapter = new SketchbookWorldAdapter({
  physicsWorld: physicsWorld,  // Your CANNON physics world
  scene: scene,                // Your THREE.js scene
  camera: camera,              // Your perspective camera
  inputManager: inputManager   // Input manager from createInputManager()
});
```

3. Create and initialize a character:

```typescript
const character = new Character(gltfAsset);
initializeCharacter(character, gltfAsset);
worldAdapter.add(character);
```

4. (Optional) Create vehicles:

```typescript
const car = await createCar(
  worldAdapter,
  '/assets/vehicles/car.glb',
  new THREE.Vector3(10, 2, 0)
);
```

## Integration Philosophy

This integration follows these principles:

1. **Loose Coupling**: Bridge files adapt Sketchbook's API to work with our code without tight dependencies.

2. **Type Safety**: TypeScript interfaces ensure compatibility between systems.

3. **Modularity**: Components are organized in focused files with clear responsibilities.

4. **Compatibility**: Version differences between libraries are handled through type assertions and adapter patterns.

For detailed usage information, see `README_SKETCHBOOK.md` and `SKETCHBOOK_GUIDE.md`. 