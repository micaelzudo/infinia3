import * as YUKA from 'yuka';

/**
 * Manages the global YUKA EntityManager and Time instances.
 */

// Initialize YUKA Time
export const yukaTime = new YUKA.Time();

// Initialize YUKA EntityManager
export const yukaEntityManager = new YUKA.EntityManager();

// Track if YUKA system is paused
let isYukaSystemPaused = false;

/**
 * Gets whether the YUKA system is currently paused
 * @returns {boolean} True if the system is paused, false otherwise
 */
export function getIsYukaSystemPaused(): boolean {
    return isYukaSystemPaused;
}

/**
 * Sets whether the YUKA system should be paused
 * @param {boolean} paused - Whether to pause the system
 */
export function setIsYukaSystemPaused(paused: boolean): void {
    isYukaSystemPaused = paused;
}

/**
 * Updates the YUKA world. This should be called once per frame in the main game loop.
 * It synchronizes the YUKA time and updates all managed game entities.
 */
export function updateYukaWorld(): void {
    if (isYukaSystemPaused) return;
    
    const delta = yukaTime.update().getDelta(); // Update time and get delta
    yukaEntityManager.update(delta);
}

console.log("[YukaManager] Initialized YUKA Time and EntityManager.");