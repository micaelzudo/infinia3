// This file is deprecated - functionality moved to yukaManager.ts
// Re-export from yukaManager for backward compatibility

export { 
    yukaTime, 
    yukaEntityManager,
    updateYukaWorld as updateEntities
} from './yukaManager';

// Deprecated function - use yukaManager directly
export function initializeEntityManager() {
    console.warn('[yukaEntityManager] initializeEntityManager is deprecated. Use yukaManager directly.');
    const { yukaEntityManager } = require('./yukaManager');
    return yukaEntityManager;
}
