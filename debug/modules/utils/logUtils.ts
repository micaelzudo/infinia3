const lastLogTime: { [key: string]: number } = {};

/**
 * Logs a message to the console, but throttles it so it only appears
 * at most once per specified interval for a given key.
 *
 * @param key A unique string key identifying this log message.
 * @param message The message parts to log (will be joined with spaces).
 * @param throttleMs The minimum time in milliseconds between logs for the same key (default: 60000ms = 1 minute).
 */
export function throttleLog(key: string, ...message: any[]): void {
    const now = Date.now();
    const throttleMs = 60000; // Default to 1 minute (60000 ms)
    const lastTime = lastLogTime[key] || 0;

    if (now - lastTime > throttleMs) {
        console.log(...message); // Use spread operator for multiple message parts
        lastLogTime[key] = now;
    }
}

/**
 * Logs a warning message, throttled like throttleLog.
 *
 * @param key A unique string key identifying this log message.
 * @param message The message parts to log.
 * @param throttleMs Throttle interval (default 1 minute).
 */
export function throttleWarn(key: string, ...message: any[]): void {
    const now = Date.now();
    const throttleMs = 60000;
    const lastTime = lastLogTime[key] || 0;

    if (now - lastTime > throttleMs) {
        console.warn(...message);
        lastLogTime[key] = now;
    }
}

// Note: Errors are typically not throttled as they indicate problems that should always be visible. 