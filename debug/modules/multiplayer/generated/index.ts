// Generated SpacetimeDB TypeScript bindings for Infinia Multiplayer
// This file contains the generated types and functions for interacting with the SpacetimeDB module

import { Identity, Address, ReducerEvent, TableUpdate } from '@clockworklabs/spacetimedb-sdk';

// Re-export types
export * from './types';
export * from './tables';
export * from './reducers';
export * from './connection';

// Re-export connection utilities with expected names
export { connectToDatabase as connect, getConnection as getConnectionInstance, getDatabase as getDatabaseInstance, DbConnection, DatabaseInterface } from './connection';