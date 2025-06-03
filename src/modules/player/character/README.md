# Character Controller for Marching Cubes

This module provides a character controller that integrates with the marching cubes terrain system. It adapts the Sketchbook character controller to work with our Three.js-based rendering engine.

## Usage

### Basic Integration

```typescript
import * as THREE from 'three';
import { CharacterController } from './modules/player/character';

// Create scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

// Create the character controller
const character = new CharacterController({
    scene: scene,
    renderer: renderer,
    camera: camera,
    initialPosition: new THREE.Vector3(0, 10, 0), // Start above ground
    onAddTerrain: (mesh) => {
        console.log('Terrain mesh added to physics');
    }
});

// In your animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const deltaTime = clock.getDelta();
    
    // Update character
    character.update(deltaTime);
    
    // Render scene with the character's camera
    renderer.render(scene, camera);
}

// Start animation
animate();

// Add terrain meshes for collision when they're generated
function onTerrainChunkGenerated(terrainMesh) {
    character.addTerrainMesh(terrainMesh);
}
```

### Controlling the Character

The character is controlled through keyboard input:

- WASD: Movement
- Space: Jump
- Shift: Sprint

The camera follows the character in third-person view and can be rotated with the mouse.

### Character Position

You can access and modify the character's position:

```typescript
// Get current position
const position = character.getPosition();

// Teleport character to a new position
character.setPosition(new THREE.Vector3(100, 50, 100));
```

### Cleanup

When switching scenes or removing the character:

```typescript
// Dispose resources
character.dispose();
```

## Physics Integration

The character controller automatically sets up a physics world using CANNON.js. When you add terrain meshes with `addTerrainMesh()`, they are converted to static trimesh colliders for the character to interact with.

## Implementation Details

The implementation is based on the Sketchbook character controller, which provides:

1. A capsule collider for character physics
2. Animation state machine (idle, walk, run, jump, etc.)
3. Input handling for player control
4. Camera control for third-person view

The `CharacterController` class provides a simplified interface to these features, while `SketchbookWorldAdapter` handles the integration with the original Sketchbook code.

## Customization

To customize the character's behavior, you can modify:

1. Physics parameters in `sketchbookAdapter.ts`
2. Camera settings in `sketchbookAdapter.ts` (method `setupCamera`)
3. Character state transitions in the original Sketchbook code 