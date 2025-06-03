/**
 * Centralized Logging Utility for Sketchbook Modules
 */

// Default to console.log if the custom logger isn't found
let loggerFunc: (message: string, type?: string, throttleKey?: string, throttleMs?: number, typeThrottleMs?: number, importance?: string) => void = 
    (message, type = 'log') => {
        if (type === 'error') console.error(message);
        else if (type === 'warn') console.warn(message);
        else console.log(message);
    };

/**
 * Initializes the Sketchbook logger to use the provided logging function.
 * This should be called by the main application (e.g., isolatedThirdPerson.ts)
 * once its custom logger is ready.
 * @param globalLogger The logging function to use (e.g., appendToCustomLog).
 */
export function initSketchbookLogger(globalLogger: typeof loggerFunc): void {
    if (typeof globalLogger === 'function') {
        loggerFunc = globalLogger;
        console.log("[SketchbookLogger] Initialized with custom logger.");
    } else {
        console.warn("[SketchbookLogger] Failed to initialize with custom logger; globalLogger was not a function. Falling back to console.");
    }
}

/**
 * Logs a message using the configured logger (custom or console fallback).
 */
export function skbLog(message: string, type: string = 'log', throttleKey?: string, throttleMs?: number, typeThrottleMs?: number, importance: string = 'normal'): void {
    // Ensure loggerFunc is callable, though it should always be by design
    if (typeof loggerFunc === 'function') {
        try {
            loggerFunc(message, type, throttleKey, throttleMs, typeThrottleMs, importance);
        } catch (e) {
            // Fallback if the custom logger itself throws an error
            console.error("[skbLog] Error calling custom logger. Fallback log:", message, e);
            console.error(message); 
        }
    } else {
        // This case should ideally not be reached if initSketchbookLogger or the default is set up correctly
        console.error("[skbLog] loggerFunc is not defined. Fallback log:", message);
        console.error(message); 
    }
}

// Overload for simpler critical messages without all params
export function skbLogCritical(message: string): void {
    skbLog(message, 'error', undefined, 0, 0, 'critical');
}

// Overload for simpler warning messages
export function skbLogWarn(message: string): void {
    skbLog(message, 'warn', undefined, 0, 0, 'normal');
} 