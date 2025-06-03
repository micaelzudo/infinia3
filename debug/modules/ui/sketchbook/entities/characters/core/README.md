# Character System

This directory contains the core character system implementation for the Sketchbook framework. The system provides a comprehensive set of tools for managing character movement, physics, input handling, and state management.

## Core Components

### Character Types (`characterTypes.ts`)
- Defines core interfaces and types for character implementation
- Includes `CharacterBase` and `EnhancedCharacter` interfaces
- Provides type definitions for physics, ground checking, and state management

### Character Input (`characterInput.ts`)
- Handles keyboard, mouse, and touch input
- Manages movement controls (WASD, arrow keys)
- Supports sprint, crouch, and jump actions
- Implements smooth camera rotation

### Character Initializer (`characterInitializer.ts`)
- Handles character setup and initialization
- Manages model loading and positioning
- Sets up physics properties and collision detection
- Configures camera and ground checking

### Character Physics (`characterPhysics.ts`)
- Implements physics-based movement
- Handles collision detection and response
- Manages ground checking and raycasting
- Provides multi-raycast ground detection for improved accuracy

### Character States (`characterStates.ts`)
- Manages character state transitions
- Handles animation state changes
- Provides state validation and management
- Supports custom state implementations

### Character Manager (`characterManager.ts`)
- Coordinates between different character components
- Manages character updates and synchronization
- Handles character creation and disposal
- Provides high-level character control

## Usage

```typescript
import { CharacterManager, CharacterInitializer } from './core';

// Create a character
const character = new CharacterManager();

// Initialize the character with a model and camera
const initializer = new CharacterInitializer(
    character,
    model,
    camera,
    world
);

// Initialize the character
initializer.initialize();

// Update the character in your game loop
function update(delta: number) {
    character.update(delta);
}

// Clean up when done
function dispose() {
    initializer.dispose();
}
```

## Features

- Physics-based movement and collision
- Smooth camera controls
- State management system
- Ground detection and raycasting
- Input handling for keyboard, mouse, and touch
- Animation state management
- Character initialization and cleanup

## Dependencies

- Three.js for 3D rendering and math
- TypeScript for type safety
- Sketchbook framework for core functionality

## Contributing

When contributing to the character system, please follow these guidelines:

1. Maintain type safety with TypeScript
2. Add appropriate documentation
3. Follow the existing code style
4. Add tests for new functionality
5. Update the README when adding new features 