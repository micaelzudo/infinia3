// Barrel file for the multiplayer module

export * from './spacetimeConfig';
export * from './playerState';
export * from './networkEvents'; // Though direct SpacetimeDB usage is primary

// You might add more exports here as the module grows, for example:
// export * from './replicationManager';
// export * from './lagCompensator';

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