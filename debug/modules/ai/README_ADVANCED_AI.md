# Advanced AI System Integration with YUKA

This document describes the comprehensive AI system that integrates YUKA's powerful features with additional advanced capabilities for creating intelligent, responsive AI agents.

## 🎯 Overview

The Advanced AI System extends YUKA's core functionality with:
- **Vision & Memory Systems** - Realistic perception and memory
- **Fuzzy Logic** - Human-like decision making
- **Advanced Steering** - Complex movement behaviors
- **Spatial Optimization** - Efficient collision detection with BVH
- **Event System** - Inter-agent communication
- **Goal-Oriented Behavior** - Intelligent task management
- **Graph Pathfinding** - Advanced navigation

## 📁 File Structure

```
ai/
├── advancedAIFeatures.ts      # Core AI features manager
├── enhancedAIAgent.ts         # Enhanced AI agent class
├── advancedAIExample.ts       # Usage examples
├── yukaController.ts          # Main YUKA integration
└── README_ADVANCED_AI.md      # This documentation
```

## 🚀 Quick Start

### 1. Basic Setup

```typescript
import { AdvancedAIFeatures, AdvancedAIConfig } from './advancedAIFeatures';
import { EnhancedAIAgent } from './enhancedAIAgent';

// Initialize the AI manager (singleton)
const aiManager = AdvancedAIFeatures.getInstance();

// Configure AI features
const aiConfig: AdvancedAIConfig = {
    enableVision: true,
    enableMemory: true,
    enableFuzzyLogic: true,
    enableSpatialOptimization: true,
    enableAdvancedSteering: true,
    enableGraphPathfinding: true,
    enableTriggers: true,
    enableTaskScheduling: true,
    enableMessaging: true
};
```

### 2. Creating Enhanced AI Agents

```typescript
// Create character mesh and YUKA vehicle
const characterMesh = new THREE.Mesh(geometry, material);
const yukaVehicle = new YUKA.Vehicle();

// Create enhanced AI agent
const enhancedAgent = new EnhancedAIAgent(
    characterMesh,
    yukaVehicle,
    aiConfig
);

// Add to spatial optimizer
aiManager.spatialOptimizer.addEntity(enhancedAgent);
```

### 3. Update Loop

```typescript
function gameLoop(deltaTime: number) {
    // Update AI manager
    aiManager.update(deltaTime);
    
    // Update individual agents
    enhancedAgent.update(deltaTime);
    
    // Update YUKA entity manager
    entityManager.update(deltaTime);
}
```

## 🧠 Core Systems

### Vision System

Provides realistic line-of-sight detection and field-of-view calculations.

```typescript
// Configure vision
agent.visionSystem.setRange(15);                    // 15 unit sight range
agent.visionSystem.setFieldOfView(Math.PI * 0.6);   // 108° field of view
agent.visionSystem.addObstacle(wallMesh);           // Add obstacles

// Check visibility
const canSee = agent.visionSystem.visible(targetEntity);
```

**Features:**
- Configurable range and field of view
- Obstacle-aware line of sight
- Efficient raycasting
- Integration with memory system

### Memory System

Stores and manages information about perceived entities.

```typescript
// Access memory records
const memories = agent.memorySystem.getRecords();

// Check if entity was seen recently
const lastSeen = agent.memorySystem.getRecord(entityId);
if (lastSeen && lastSeen.timeVisible > 0) {
    console.log('Entity was seen recently');
}
```

**Features:**
- Automatic memory creation from vision
- Time-based memory decay
- Last known position tracking
- Visibility duration tracking

### Fuzzy Logic System

Enables human-like decision making with uncertainty and gradual transitions.

```typescript
// Example: Threat assessment
const distance = agent.position.distanceTo(threat.position);
const health = agent.health / agent.maxHealth;

// Fuzzy sets for decision making
const nearThreat = distance < 5 ? 1.0 : Math.max(0, (10 - distance) / 5);
const lowHealth = health < 0.3 ? 1.0 : Math.max(0, (0.5 - health) / 0.2);

// Fuzzy rule: IF near threat AND low health THEN flee
const fleeDesire = Math.min(nearThreat, lowHealth);
```

**Features:**
- Fuzzy sets (triangular, trapezoidal, shoulder)
- Fuzzy operators (AND, OR, NOT)
- Rule-based decision making
- Smooth behavior transitions

### Advanced Steering Behaviors

Complex movement patterns beyond basic seek/flee.

```typescript
// Interpose between two entities
const interpose = new YUKA.InterposeBehavior(entityA, entityB);
agent.steering.add(interpose);

// Obstacle avoidance with detection box
const avoidance = new YUKA.ObstacleAvoidanceBehavior(obstacles);
avoidance.dBoxLength = 4.0;  // Detection box length
agent.steering.add(avoidance);

// Separation from neighbors
const separation = new YUKA.SeparationBehavior(neighbors);
separation.separationRadius = 3.0;
agent.steering.add(separation);
```

**Available Behaviors:**
- Interpose (position between entities)
- Obstacle Avoidance (dynamic obstacle detection)
- Separation (maintain distance from neighbors)
- Advanced Pursuit/Evade
- Formation behaviors

### Spatial Optimization (BVH)

Efficient collision detection and spatial queries using Bounding Volume Hierarchies.

```typescript
// Automatic spatial optimization
aiManager.spatialOptimizer.addEntity(agent);

// Efficient neighbor queries
const nearbyEntities = aiManager.spatialOptimizer.query(agent.position, radius);

// Collision detection
const collisions = aiManager.spatialOptimizer.intersectRay(ray);
```

**Features:**
- Automatic BVH construction and updates
- Efficient range queries
- Ray intersection tests
- Dynamic entity management

### Event System

Decoupled communication between AI agents and systems.

```typescript
// Listen for events
aiManager.eventDispatcher.addEventListener('threat-detected', (event) => {
    console.log('Threat detected:', event.data);
    // Alert nearby agents
});

// Dispatch events
aiManager.eventDispatcher.dispatchEvent({
    type: 'area-clear',
    data: { position: agent.position }
});
```

**Features:**
- Type-safe event system
- Automatic event cleanup
- Priority-based event handling
- Cross-agent communication

### Goal-Oriented Behavior

Intelligent task management with behavior trees and goal evaluation.

```typescript
// Available goal types
const goals = {
    PATROL: 'patrol',
    INVESTIGATE: 'investigate', 
    COMBAT: 'combat',
    FLEE: 'flee',
    MOVE_TO: 'moveTo'
};

// Goal evaluation and switching
agent.goalEvaluator.evaluateGoals();
const currentGoal = agent.goalEvaluator.currentGoal;
```

**Features:**
- Multiple goal types
- Automatic goal evaluation
- Priority-based goal switching
- State persistence

### Graph Pathfinding

Advanced navigation using graph algorithms.

```typescript
// Create navigation graph
const graph = YUKA.GraphUtils.createGridLayout(width, height, cellSize);

// A* pathfinding
const astar = new YUKA.AStar();
const path = astar.search(graph, startNode, goalNode);

// Dijkstra for shortest paths
const dijkstra = new YUKA.Dijkstra();
const shortestPath = dijkstra.search(graph, startNode, goalNode);
```

**Features:**
- A* and Dijkstra algorithms
- Heuristic policies
- Grid and custom graph layouts
- Path optimization

## 🎮 Integration with Existing System

The advanced AI system is fully integrated with the existing YUKA controller:

### Automatic Initialization

```typescript
// In yukaController.ts - initYuka()
advancedAIManager = AdvancedAIFeatures.getInstance();
console.log('🧠 Advanced AI Features Manager initialized');
```

### Enhanced Agent Creation

```typescript
// In yukaController.ts - spawnYukaAgent()
const enhancedAgent = new EnhancedAIAgent(
    sketchbookCharacterInstance,
    newCharacter,
    aiConfig
);
enhancedAIAgents.set(newCharacter.uuid, enhancedAgent);
```

### Automatic Updates

```typescript
// In yukaController.ts - sync()
if (advancedAIManager && enhancedAIAgents.size > 0) {
    const deltaTime = time?.getDelta() || 0.016;
    advancedAIManager.update(deltaTime);
    
    enhancedAIAgents.forEach((enhancedAgent, agentId) => {
        enhancedAgent.update(deltaTime);
    });
}
```

### Proper Cleanup

```typescript
// In yukaController.ts - cleanupYuka()
const enhancedAgent = enhancedAIAgents.get(entity.uuid);
if (enhancedAgent) {
    enhancedAgent.dispose();
    enhancedAIAgents.delete(entity.uuid);
    advancedAIManager.spatialOptimizer.removeEntity(enhancedAgent);
}
```

## 🔧 Configuration Options

### AdvancedAIConfig

```typescript
interface AdvancedAIConfig {
    enableVision: boolean;              // Vision system
    enableMemory: boolean;              // Memory system
    enableFuzzyLogic: boolean;          // Fuzzy logic
    enableSpatialOptimization: boolean; // BVH optimization
    enableAdvancedSteering: boolean;    // Advanced steering
    enableGraphPathfinding: boolean;    // Graph pathfinding
    enableTriggers: boolean;            // Trigger system
    enableTaskScheduling: boolean;      // Task management
    enableMessaging: boolean;           // Event messaging
}
```

### Performance Tuning

```typescript
// Regulator frequencies (updates per second)
const regulators = {
    vision: 10,        // 10 Hz - vision updates
    memory: 5,         // 5 Hz - memory cleanup
    fuzzy: 15,         // 15 Hz - fuzzy logic
    spatial: 20,       // 20 Hz - spatial optimization
    goals: 2           // 2 Hz - goal evaluation
};
```

## 📊 Performance Considerations

### Optimization Strategies

1. **Regulators**: Different systems update at different frequencies
2. **Spatial Optimization**: BVH reduces collision detection complexity
3. **Memory Management**: Automatic cleanup of old memory records
4. **Event Throttling**: Prevents event spam
5. **Lazy Evaluation**: Systems only update when needed

### Recommended Limits

- **Agents**: Up to 50-100 enhanced agents
- **Vision Range**: Keep under 20 units for performance
- **Memory Records**: Auto-cleanup after 30 seconds
- **Update Frequency**: 60 FPS main loop, varied subsystem rates

## 🐛 Debugging

### Debug Output

The system provides comprehensive logging:

```typescript
// Enable debug mode
const DEBUG_AI = true;

if (DEBUG_AI) {
    console.log('🧠 Advanced AI Features Manager initialized');
    console.log('🤖 Enhanced AI Agent created with advanced features');
    console.log('👁️ Vision system active');
    console.log('🧠 Memory system tracking entities');
}
```

### Common Issues

1. **Performance**: Reduce vision range or agent count
2. **Memory Leaks**: Ensure proper disposal of agents
3. **Event Loops**: Check for circular event dependencies
4. **Pathfinding**: Verify graph connectivity

## 🔮 Future Enhancements

### Planned Features

- **Machine Learning Integration**: Neural network decision making
- **Behavior Trees**: Visual behavior editing
- **Formation AI**: Coordinated group behaviors
- **Dynamic Difficulty**: Adaptive AI challenge
- **Voice Commands**: Natural language processing

### Extension Points

- Custom fuzzy sets and rules
- Additional steering behaviors
- Custom goal types
- Event system extensions
- Performance profiling tools

## 📚 Examples

See `advancedAIExample.ts` for comprehensive usage examples including:

- Guard AI with threat assessment
- Patrol AI with route following
- Scout AI with exploration behavior
- Leader AI with command capabilities
- Inter-agent communication
- Environmental triggers

## 🤝 Contributing

To extend the AI system:

1. Follow the existing patterns in `AdvancedAIFeatures`
2. Add new systems to the manager class
3. Update the `AdvancedAIConfig` interface
4. Add corresponding update calls
5. Include proper disposal methods
6. Add examples and documentation

---

*This advanced AI system transforms simple YUKA agents into intelligent, responsive entities capable of complex behaviors and realistic decision-making.*