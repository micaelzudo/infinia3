// Infinia Multiplayer Module
// This module provides SpacetimeDB integration for real-time multiplayer functionality

// Export configuration and connection utilities
export * from './spacetimeConfig';

// Export generated SpacetimeDB bindings
export * from './generated';

// Export player state management (legacy - consider migrating to generated types)
export * from './playerState';

// Export network event definitions (legacy - SpacetimeDB uses table updates instead)
export * from './networkEvents';

// Note: The generated bindings in ./generated/ should be used for new development.
// The playerState and networkEvents exports are kept for backward compatibility.

console.log("Multiplayer module loaded.");

// It's generally better to initialize and connect to SpacetimeDB
// from a higher-level application entry point (e.g., main.ts or your game setup logic)
// rather than automatically connecting when this module is imported.
// This gives more control over when the connection attempt occurs.

// Example of how you might structure initialization if you choose to do it here (not recommended for auto-connect):
// import { connectToSpacetimeDB } from './spacetimeConfig';
// async function initializeMultiplayer() {
//     try {
//         await connectToSpacetimeDB();
//         console.log("Multiplayer initialized and connected to SpacetimeDB.");
//         // Further setup like registering generated reducers and subscribing to tables
//     } catch (error) {
//         console.error("Failed to initialize multiplayer:", error);
//     }
// }
// // initializeMultiplayer(); // Uncomment if you want to auto-connect (generally not advised here)