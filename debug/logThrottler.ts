// debug/logThrottler.ts

const lastLogTimestamps: { [key: string]: number } = {};
const logThrottleTimes: { [key: string]: number } = {};
const eventThrottleTimes: { [key: string]: number } = {};

// --- Listener Management ---
type LogListener = (message: string, type: 'log' | 'event', key?: string) => void;
const listeners: LogListener[] = [];

export function registerLogListener(listener: LogListener) {
    if (!listeners.includes(listener)) {
        listeners.push(listener);
    }
}

export function unregisterLogListener(listener: LogListener) {
    const index = listeners.indexOf(listener);
    if (index > -1) {
        listeners.splice(index, 1);
    }
}

function notifyListeners(message: string, type: 'log' | 'event', key?: string) {
    listeners.forEach(listener => listener(message, type, key));
}
// ------------------------

/**
 * Logs a message to the console, but only if a specified interval has passed
 * since the last message with the same key was logged.
 * 
 * Uses console.debug for throttled messages by default.
 *
 * @param key A unique string key identifying the type of message being throttled.
 * @param intervalMs The minimum time interval (in milliseconds) between logs for this key.
 * @param args The arguments to log (same as console.log).
 */
export function logThrottled(key: string, intervalMs: number, ...args: any[]): void {
    const now = performance.now();
    const lastTime = lastLogTimestamps[key] || 0;

    if (now - lastTime > intervalMs) {
        // Use console.debug for throttled messages to distinguish them visually if desired
        // Or use console.log if no distinction is needed
        console.debug(`(Throttled ${intervalMs}ms) [${key}]`, ...args);
        notifyListeners(`(Throttled ${intervalMs}ms) [${key}]`, 'log', key);
        lastLogTimestamps[key] = now;
    }
}

/**
 * Logs an event message, but throttled.
 * Uses console.event for the output.
 */
export function eventThrottled(key: string, intervalMs: number, ...args: any[]): void {
    const now = performance.now();
    const lastTime = lastLogTimestamps[key] || 0;

    if (now - lastTime > intervalMs) {
        (console as any).event(`(Throttled ${intervalMs}ms) [${key}]`, ...args);
        notifyListeners(`(Throttled ${intervalMs}ms) [${key}]`, 'event', key);
        lastLogTimestamps[key] = now;
    }
} 