// debug/modules/ui/customLogger.ts

// --- CONFIGURATION START ---
export interface CustomLoggerConfig {
    maxLogLines: number;
    throttle: {
        identicalMessageMs: number;
        typeMs: Partial<Record<'log' | 'warn' | 'error' | 'info', number>>;
        keyMs: number;
    };
    colors: Record<'log' | 'warn' | 'error' | 'info', string>;
    background: string;
    border: string;
    font: string;
    borderRadius: string;
    shadow: string;
    fileColors?: Record<string, Partial<Record<'log' | 'warn' | 'error' | 'info', string>>>;
}

export let customLoggerConfig: CustomLoggerConfig = {
    maxLogLines: 100,
    throttle: {
        identicalMessageMs: 30000,
        typeMs: { log: 0, warn: 0, error: 0, info: 0 },
        keyMs: 0,
    },
    colors: {
        log: '#e0e0e0',
        warn: '#ffd700',
        error: '#ff4d4d',
        info: '#68a2de',
    },
    background: 'rgba(24,24,24,0.98)',
    border: '2px solid #444',
    font: 'monospace',
    borderRadius: '8px',
    shadow: '0 4px 24px 0 rgba(0,0,0,0.5)',
};

export function setCustomLoggerConfig(newConfig: Partial<CustomLoggerConfig>) {
    customLoggerConfig = { ...customLoggerConfig, ...newConfig };
    // Optionally, re-style the window if already present
    if (customLogContainer) {
        customLogContainer.style.background = customLoggerConfig.background;
        customLogContainer.style.border = customLoggerConfig.border;
        customLogContainer.style.fontFamily = customLoggerConfig.font;
        customLogContainer.style.borderRadius = customLoggerConfig.borderRadius;
        customLogContainer.style.boxShadow = customLoggerConfig.shadow;
    }
}
// --- CONFIGURATION END ---

// --- CUSTOM LOG WINDOW START ---
let customLogContainer: HTMLElement | null = null;
let customLogContent: HTMLElement | null = null; // For the actual log entries
let customLogLines: string[] = [];
const MAX_LOG_LINES = customLoggerConfig.maxLogLines; // Use config
let lineCount = 0;

const logThrottleTrack: { [key: string]: number } = {}; // For throttling
const logTypeThrottleTrack: { [key: string]: number } = {}; // For type-based throttling
const identicalMessageThrottleTrack: { [message: string]: number } = {}; // For identical messages
const IDENTICAL_MESSAGE_THROTTLE_MS = customLoggerConfig.throttle.identicalMessageMs; // Use config

let customLogFocusModeEnabled = true;
const activeFilters: { [key: string]: boolean } = { log: true, warn: true, error: true, info: true };

// --- Add UI state for file filtering and search ---
let activeFileFilters: Set<string> = new Set(); // If empty, show all
let currentSearchTerm: string = '';

// --- Per-file, per-function, per-class color assignment ---
const fileColorMap: Record<string, string> = {};
const functionColorMap: Record<string, string> = {};
const classColorMap: Record<string, string> = {};
function getFileColor(fileName: string): string {
    // Use config if present
    if (customLoggerConfig.fileColors && customLoggerConfig.fileColors[fileName] && customLoggerConfig.fileColors[fileName].log) {
        return customLoggerConfig.fileColors[fileName].log!;
    }
    // If already assigned, return
    if (fileColorMap[fileName]) return fileColorMap[fileName];
    // Otherwise, generate a visually distinct color
    const hash = Array.from(fileName).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 47) % 360;
    const color = `hsl(${hue}, 70%, 55%)`;
    fileColorMap[fileName] = color;
    return color;
}

function getColorForKey(key: string, map: Record<string, string>, baseHue: number): string {
    if (map[key]) return map[key];
    // Generate a visually distinct color
    const hash = Array.from(key).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 47 + baseHue) % 360;
    const color = `hsl(${hue}, 70%, 55%)`;
    map[key] = color;
    return color;
}

// --- Variable coloring ---
const variableColorMap: Record<string, string> = {};
function getVariableColor(varName: string): string {
    if (variableColorMap[varName]) return variableColorMap[varName];
    const hash = Array.from(varName).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 67 + 180) % 360;
    const color = `hsl(${hue}, 80%, 55%)`;
    variableColorMap[varName] = color;
    return color;
}
// --- END variable coloring ---

// --- Enhanced variable coloring scheme ---
function getVariableBackground(varName: string, type: string): string {
    // Use different base hues for each log type
    let baseHue = 180;
    if (type === 'error') baseHue = 0;
    else if (type === 'warn') baseHue = 40;
    else if (type === 'info') baseHue = 210;
    else if (type === 'log') baseHue = 120;
    const hash = Array.from(varName).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 67 + baseHue) % 360;
    return `hsl(${hue}, 80%, 92%)`;
}
function getVariableValueColor(varName: string, type: string): string {
    if (type === 'error') return '#ff4d4d';
    if (type === 'warn') return '#ffb347';
    if (type === 'info') return '#68a2de';
    if (type === 'log') return '#44c767';
    return '#ffd700';
}
function getVariableNameColor(varName: string, type: string): string {
    let baseHue = 180;
    if (type === 'error') baseHue = 0;
    else if (type === 'warn') baseHue = 40;
    else if (type === 'info') baseHue = 210;
    else if (type === 'log') baseHue = 120;
    const hash = Array.from(varName).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 67 + baseHue) % 360;
    return `hsl(${hue}, 80%, 45%)`;
}
// --- END enhanced variable coloring ---

// --- Helper to colorize variables in log messages (with backgrounds, borders, etc.) ---
function colorizeLogMessage(message: string, type: string = 'log'): HTMLElement {
    const varPattern = /([A-Za-z0-9_]+)\s*[:=\(]\s*([\w\.-]+)/g;
    let lastIndex = 0;
    let match;
    const container = document.createElement('span');
    container.style.fontSize = '17px';
    container.style.lineHeight = '1.5';
    while ((match = varPattern.exec(message)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(message.slice(lastIndex, match.index)));
        }
        const varName = match[1];
        const varValue = match[2];
        // Variable pair container
        const pair = document.createElement('span');
        pair.style.display = 'inline-block';
        pair.style.background = getVariableBackground(varName, type);
        pair.style.borderRadius = '6px';
        pair.style.margin = '0 2px';
        pair.style.padding = '1px 5px 1px 5px';
        pair.style.borderBottom = `2px solid ${getVariableValueColor(varName, type)}`;
        // Variable name
        const nameSpan = document.createElement('span');
        nameSpan.textContent = varName;
        nameSpan.style.color = getVariableNameColor(varName, type);
        nameSpan.style.fontWeight = 'bold';
        nameSpan.style.fontSize = '18px';
        nameSpan.style.marginRight = '2px';
        pair.appendChild(nameSpan);
        // Separator
        const sep = message[match.index + varName.length];
        const sepSpan = document.createElement('span');
        sepSpan.textContent = sep;
        sepSpan.style.color = '#aaa';
        sepSpan.style.marginRight = '2px';
        pair.appendChild(sepSpan);
        // Variable value
        const valueSpan = document.createElement('span');
        valueSpan.textContent = varValue;
        valueSpan.style.color = getVariableValueColor(varName, type);
        valueSpan.style.fontWeight = 'bold';
        valueSpan.style.fontSize = '17px';
        valueSpan.style.marginRight = '2px';
        pair.appendChild(valueSpan);
        container.appendChild(pair);
        lastIndex = varPattern.lastIndex;
    }
    if (lastIndex < message.length) {
        container.appendChild(document.createTextNode(message.slice(lastIndex)));
    }
    return container;
}

// --- Hash function for per-message coloring ---
function hashStringToColor(str: string, baseColor: string): string {
    // Simple hash to generate a color variation from a string
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Use baseColor as fallback, but tint it with the hash
    // We'll use HSL for easy color shifting
    let h = (hash % 360 + 360) % 360;
    let s = 70;
    let l = 55;
    if (baseColor.startsWith('#')) {
        // Optionally, parse baseColor and shift it
        // For now, just use HSL
    }
    return `hsl(${h},${s}%,${l}%)`;
}
// --- END hash function ---

// --- Track last log entry per function+message for deduplication ---
const lastLogEntryMap: Record<string, HTMLElement> = {};
const logSpamCountMap: Record<string, number> = {};

function getCallerFunctionAndClass(): { functionName: string, className: string } {
    try {
        const err = new Error();
        if (!err.stack) return { functionName: 'unknown', className: '' };
        const stack = err.stack.split('\n');
        for (let i = 2; i < stack.length; i++) {
            const line = stack[i];
            if (!line.includes('customLogger') && !line.includes('appendToCustomLog')) {
                // Try to extract class and function name
                // e.g. at ClassName.methodName (file:line:col)
                const match = line.match(/at (\S+)(?:\.(\S+))?/);
                if (match) {
                    return {
                        className: match[1] && match[2] ? match[1] : '',
                        functionName: match[2] || match[1] || 'unknown',
                    };
                }
            }
        }
    } catch {}
    return { functionName: 'unknown', className: '' };
}

// --- Helper to extract caller file and function name from stack trace ---
function getCallerFileAndFunctionFromStack(): { fileName: string, functionName: string } {
    const err = new Error();
    if (!err.stack) return { fileName: 'console', functionName: 'unknown' };
    const stackLines = err.stack.split('\n');
    for (let i = 2; i < stackLines.length; i++) {
        const line = stackLines[i];
        if (line.includes('customLogger.ts')) continue; // Skip logger frames
        // Try to extract function and file name (e.g., at functionName (fileName.ts:line:col))
        const match = line.match(/at (.*?) \((.*?\.(ts|js|mjs))(?:[:\d]*)?\)/) || line.match(/at (.*?) (.*?\.(ts|js|mjs))(?:[:\d]*)?/);
        if (match) {
            return {
                functionName: match[1] || 'unknown',
                fileName: match[2] || 'console',
            };
        }
        // Fallback: just file name
        const fileMatch = line.match(/([\w\-\.]+\.(ts|js|mjs))(:\d+)?/);
        if (fileMatch) {
            return {
                functionName: 'unknown',
                fileName: fileMatch[1],
            };
        }
    }
    return { fileName: 'console', functionName: 'unknown' };
}

// --- Store original console methods globally ---
const _originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
};

(function patchConsoleForCustomLogger() {
    console.log = function(...args) {
        const { fileName, functionName } = getCallerFileAndFunctionFromStack();
        appendToCustomLog(args.map(String).join(' '), 'log', undefined, undefined, undefined, 'normal', fileName, undefined, functionName);
        _originalConsole.log.apply(console, args);
    };
    console.warn = function(...args) {
        const { fileName, functionName } = getCallerFileAndFunctionFromStack();
        appendToCustomLog(args.map(String).join(' '), 'warn', undefined, undefined, undefined, 'normal', fileName, undefined, functionName);
        _originalConsole.warn.apply(console, args);
    };
    console.error = function(...args) {
        const { fileName, functionName } = getCallerFileAndFunctionFromStack();
        appendToCustomLog(args.map(String).join(' '), 'error', undefined, undefined, undefined, 'normal', fileName, undefined, functionName);
        _originalConsole.error.apply(console, args);
    };
    console.info = function(...args) {
        const { fileName, functionName } = getCallerFileAndFunctionFromStack();
        appendToCustomLog(args.map(String).join(' '), 'info', undefined, undefined, undefined, 'normal', fileName, undefined, functionName);
        _originalConsole.info.apply(console, args);
    };
})();

export function appendToCustomLog(
    message: string,
    type: 'log' | 'warn' | 'error' | 'info' = 'log',
    throttleKey?: string,
    throttleMs?: number,
    typeThrottleMs?: number, // New parameter for type-specific throttling
    importance: 'normal' | 'critical' = 'normal', // New parameter for log importance
    fileName?: string, // NEW: file name for per-file coloring
    logId?: string, // NEW: static log ID for deduplication
    callerFunctionName?: string // NEW: function name for coloring/tags
): void {
    const currentTime = Date.now(); // Use a consistent 'now' for this function call

    // 0. Focus Mode Filter (applied first)
    if (customLogFocusModeEnabled && importance === 'normal' && type !== 'error' && type !== 'warn') {
        return; 
    }

    // 1. NEW Identical Message Throttling (applies if not critical/error)
    if (importance !== 'critical' && type !== 'error') {
        const lastIdenticalLogTime = identicalMessageThrottleTrack[message] || 0;
        if (currentTime - lastIdenticalLogTime < IDENTICAL_MESSAGE_THROTTLE_MS) {
            return; // Message throttled because it's identical and too recent
        }
        // Only update the timestamp if the message is *actually* logged (passes other throttles)
        // We will update it later, after other checks pass.
    }

    // 2. Type-based throttling (original logic)
    if (typeThrottleMs === undefined) {
        typeThrottleMs = customLoggerConfig.throttle.typeMs[type] || 0;
    }
    if (typeThrottleMs && typeThrottleMs > 0) {
        const lastLogTimeForType = logTypeThrottleTrack[type] || 0;
        if (currentTime - lastLogTimeForType < typeThrottleMs) {
            return; // Message is throttled by type
        }
        logTypeThrottleTrack[type] = currentTime; // Update timestamp for this type as it passed
    }

    // 2. Key-based throttling (adapted from original logic)
    if (throttleMs === undefined) {
        throttleMs = customLoggerConfig.throttle.keyMs;
    }
    if (throttleKey && throttleMs && throttleMs > 0) {
        const lastLogTimeForKey = logThrottleTrack[throttleKey] || 0;
        if (currentTime - lastLogTimeForKey < throttleMs) {
            return; // Throttle this message
        }
        logThrottleTrack[throttleKey] = currentTime; // Update timestamp for this key as it passed
    }

    if (!customLogContainer && !customLogContent) {
        // Attempt to get the log container dynamically. 
        // This might be problematic if the logger is used before the DOM element exists.
        // Consider passing the container element or ID during an init phase for the logger.
        const logContainer = document.getElementById('custom-log-container') || document.getElementById('itp-custom-log-window');
        if (logContainer) {
            customLogContainer = logContainer;
            customLogContent = logContainer.querySelector(':scope > div:nth-child(2)') as HTMLElement;
        }
    }
    if (customLogContainer && customLogContent) {
        // --- Get function and class name for coloring and deduplication ---
        let functionName = callerFunctionName;
        let className = '';
        if (!functionName) {
            const res = getCallerFunctionAndClass();
            functionName = res.functionName;
            className = res.className;
        }
        // Use logId if provided, otherwise dedupe by file+function+type
        const dedupeKey = logId
            ? `${fileName || ''}|${functionName}|${logId}|${type}`
            : `${fileName || ''}|${functionName}|${type}`;
        // --- DEDUPLICATE SPAMMING LOGS ---
        let dedupedLogEntry = lastLogEntryMap[dedupeKey];
        if (dedupedLogEntry && document.body.contains(dedupedLogEntry)) {
            // Update timestamp and content
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const textBlock = dedupedLogEntry.querySelector('div');
            if (textBlock) {
                const ts = textBlock.querySelector('span');
                if (ts) ts.textContent = `[${timestamp}]`;
                // Replace the colored message node
                const oldMsg = textBlock.childNodes[1];
                const newMsg = colorizeLogMessage(message, type);
                newMsg.style.fontWeight = type === 'error' ? 'bold' : 'normal';
                newMsg.style.wordBreak = 'break-word';
                if (oldMsg) textBlock.replaceChild(newMsg, oldMsg);
            }
            // --- SPAM COUNT BADGE ---
            logSpamCountMap[dedupeKey] = (logSpamCountMap[dedupeKey] || 1) + 1;
            let badge = dedupedLogEntry.querySelector('.custom-log-spam-badge') as HTMLElement;
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'custom-log-spam-badge';
                badge.style.marginLeft = '8px';
                badge.style.fontSize = '10px';
                badge.style.fontWeight = 'bold';
                badge.style.background = 'linear-gradient(90deg, #ff4d4d 60%, #ffb347 100%)';
                badge.style.color = '#fff';
                badge.style.padding = '2px 7px';
                badge.style.borderRadius = '8px';
                badge.style.boxShadow = '0 1px 4px 0 rgba(0,0,0,0.10)';
                badge.style.letterSpacing = '1px';
                badge.style.verticalAlign = 'middle';
                badge.style.transition = 'background 0.2s';
                badge.textContent = 'LIVE';
                badge.title = 'This log is being updated rapidly.';
                dedupedLogEntry.appendChild(badge);
            }
            badge.textContent = `LIVE ×${logSpamCountMap[dedupeKey]}`;
            badge.title = `This log was updated ${logSpamCountMap[dedupeKey]} times.`;
            // --- END BADGE ---
            // --- PULSE ANIMATION ---
            dedupedLogEntry.style.animation = 'pulseLogEntry 0.7s';
            setTimeout(() => { dedupedLogEntry.style.animation = ''; }, 700);
            // --- VIBRANT BORDER ---
            dedupedLogEntry.style.borderLeft = fileName ? `6px solid #ff4d4d` : '6px solid #ff4d4d';
            return;
        }
        const logEntry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // --- BEAUTIFUL LOG ENTRY ---
        logEntry.className = 'custom-log-entry';
        logEntry.style.display = 'flex';
        logEntry.style.alignItems = 'flex-start';
        logEntry.style.gap = '10px';
        logEntry.style.position = 'relative';
        logEntry.style.margin = '6px 0';
        logEntry.style.padding = '8px 14px 8px 10px';
        // Set background color per file
        logEntry.style.background = fileName ? getFileColor(fileName) : 'linear-gradient(90deg, rgba(40,40,40,0.92) 80%, rgba(80,80,80,0.10) 100%)';
        logEntry.style.borderRadius = '8px';
        logEntry.style.boxShadow = '0 2px 12px 0 rgba(0,0,0,0.10)';
        logEntry.style.transition = 'background 0.2s, box-shadow 0.2s, border 0.2s';
        logEntry.style.borderLeft = fileName ? `6px solid ${getFileColor(fileName)}` : '6px solid #444';
        logEntry.style.cursor = 'pointer';
        logEntry.style.overflow = 'hidden';
        logEntry.style.minHeight = '32px';
        logEntry.style.animation = 'fadeInLogEntry 0.5s';
        logEntry.onmouseenter = () => {
            logEntry.style.background = fileName ? getFileColor(fileName) : 'linear-gradient(90deg, rgba(60,60,60,0.98) 80%, rgba(120,120,120,0.13) 100%)';
            logEntry.style.boxShadow = '0 4px 24px 0 rgba(0,0,0,0.18)';
        };
        logEntry.onmouseleave = () => {
            logEntry.style.background = fileName ? getFileColor(fileName) : 'linear-gradient(90deg, rgba(40,40,40,0.92) 80%, rgba(80,80,80,0.10) 100%)';
            logEntry.style.boxShadow = '0 2px 12px 0 rgba(0,0,0,0.10)';
        };
        // --- ICONS ---
        const icon = document.createElement('span');
        icon.style.fontSize = '18px';
        icon.style.marginRight = '2px';
        if (type === 'error') icon.textContent = '⛔';
        else if (type === 'warn') icon.textContent = '⚠️';
        else if (type === 'info') icon.textContent = 'ℹ️';
        else icon.textContent = '��';
        logEntry.appendChild(icon);
        // --- LOG TEXT ---
        const textBlock = document.createElement('div');
        textBlock.style.flex = '1';
        textBlock.style.display = 'flex';
        textBlock.style.flexDirection = 'column';
        textBlock.style.gap = '2px';
        // Timestamp
        const ts = document.createElement('span');
        ts.textContent = `[${timestamp}]`;
        ts.style.fontSize = '13px';
        ts.style.color = '#888';
        ts.style.fontWeight = 'bold';
        textBlock.appendChild(ts);
        // Message (colorized)
        const msg = colorizeLogMessage(message, type);
        msg.style.fontWeight = type === 'error' ? 'bold' : 'normal';
        msg.style.wordBreak = 'break-word';
        textBlock.appendChild(msg);
        // --- COLORED TAGS ---
        const tagRow = document.createElement('div');
        tagRow.style.display = 'flex';
        tagRow.style.gap = '10px';
        tagRow.style.marginTop = '4px';
        // File tag
        if (fileName) {
            const fileTag = document.createElement('span');
            fileTag.textContent = fileName;
            fileTag.style.fontSize = '13px';
            fileTag.style.fontWeight = 'bold';
            fileTag.style.color = getFileColor(fileName);
            fileTag.style.background = 'rgba(0,0,0,0.10)';
            fileTag.style.padding = '2px 10px';
            fileTag.style.borderRadius = '8px';
            fileTag.title = 'File name';
            tagRow.appendChild(fileTag);
        }
        // Class tag
        if (className) {
            const classTag = document.createElement('span');
            classTag.textContent = className;
            classTag.style.fontSize = '13px';
            classTag.style.fontWeight = 'bold';
            classTag.style.color = getColorForKey(className, classColorMap, 120);
            classTag.style.background = 'rgba(0,0,0,0.10)';
            classTag.style.padding = '2px 10px';
            classTag.style.borderRadius = '8px';
            classTag.title = 'Class name';
            tagRow.appendChild(classTag);
        }
        // Function tag
        if (functionName) {
            const funcTag = document.createElement('span');
            funcTag.textContent = functionName;
            funcTag.style.fontSize = '13px';
            funcTag.style.fontWeight = 'bold';
            funcTag.style.color = getColorForKey(functionName, functionColorMap, 240);
            funcTag.style.background = 'rgba(0,0,0,0.10)';
            funcTag.style.padding = '2px 10px';
            funcTag.style.borderRadius = '8px';
            funcTag.title = 'Function name';
            tagRow.appendChild(funcTag);
        }
        textBlock.appendChild(tagRow);
        // --- END COLORED TAGS ---
        logEntry.appendChild(textBlock);
        // --- END BEAUTIFUL LOG ENTRY ---
        logEntry.dataset.logType = type;
        logEntry.dataset.logImportance = importance;
        if (fileName) logEntry.dataset.logFile = fileName;
        // --- END COLORED & STYLED LOG ENTRY ---
        customLogContent.appendChild(logEntry);
        lineCount++;

        // Prune old log entries if over max lines
        while (lineCount > MAX_LOG_LINES && customLogContent.firstChild) {
            customLogContent.removeChild(customLogContent.firstChild);
            lineCount--;
        }

        customLogContainer.scrollTop = customLogContainer.scrollHeight; // Scroll log container (main div)
        updateLogVisibility(); // Call after adding and pruning

        // --- Update file filter buttons ---
        if ((window as any)._customLoggerUpdateFileButtons) {
            (window as any)._customLoggerUpdateFileButtons();
        }

        // --- Animation keyframes (inject once) ---
        if (!document.getElementById('customLoggerFadeInKeyframes')) {
            const style = document.createElement('style');
            style.id = 'customLoggerFadeInKeyframes';
            style.textContent = `@keyframes fadeInLogEntry { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`;
            document.head.appendChild(style);
        }

        if (!document.getElementById('customLoggerPulseKeyframes')) {
            const style = document.createElement('style');
            style.id = 'customLoggerPulseKeyframes';
            style.textContent = `@keyframes pulseLogEntry { 0% { box-shadow: 0 0 0 0 #ff4d4d44; } 70% { box-shadow: 0 0 0 8px #ff4d4d11; } 100% { box-shadow: 0 2px 12px 0 rgba(0,0,0,0.10); } }`;
            document.head.appendChild(style);
        }

        // After appending:
        lastLogEntryMap[dedupeKey] = logEntry;
        logSpamCountMap[dedupeKey] = 1;
        // --- Add badge for new entry if it is a deduped log ---
        if (logSpamCountMap[dedupeKey] > 1) {
            let badge = document.createElement('span');
            badge.className = 'custom-log-spam-badge';
            badge.style.marginLeft = '8px';
            badge.style.fontSize = '10px';
            badge.style.fontWeight = 'bold';
            badge.style.background = 'linear-gradient(90deg, #ff4d4d 60%, #ffb347 100%)';
            badge.style.color = '#fff';
            badge.style.padding = '2px 7px';
            badge.style.borderRadius = '8px';
            badge.style.boxShadow = '0 1px 4px 0 rgba(0,0,0,0.10)';
            badge.style.letterSpacing = '1px';
            badge.style.verticalAlign = 'middle';
            badge.style.transition = 'background 0.2s';
            badge.textContent = 'LIVE';
            badge.title = 'This log is being updated rapidly.';
            logEntry.appendChild(badge);
        }
    }
    // Fallback to console
    switch (type) {
        case 'warn':
            _originalConsole.warn(message);
            break;
        case 'error':
            _originalConsole.error(message);
            break;
        case 'info':
            _originalConsole.info(message);
            break;
        default:
            _originalConsole.log(message);
            break;
    }

    // If an identical message passed all other throttles, update its timestamp now
    if (importance !== 'critical' && type !== 'error') {
        identicalMessageThrottleTrack[message] = currentTime;
    }

    // After every log, force update file toggles
    if ((window as any)._customLoggerUpdateFileButtons) {
        (window as any)._customLoggerUpdateFileButtons();
    }
}
// --- CUSTOM LOG WINDOW END ---

// --- Ensure the log window exists (modular UI creation) ---
function ensureCustomLogWindow(containerId: string = 'itp-custom-log-window') {
    let logWindow = document.getElementById(containerId);
    if (!logWindow) {
        logWindow = document.createElement('div');
        logWindow.id = containerId;
        logWindow.style.position = 'fixed';
        logWindow.style.bottom = '10px';
        logWindow.style.right = '10px';
        logWindow.style.width = '600px';
        logWindow.style.height = '400px';
        logWindow.style.zoom = '1.3';
        logWindow.style.background = customLoggerConfig.background;
        logWindow.style.border = customLoggerConfig.border;
        logWindow.style.borderRadius = customLoggerConfig.borderRadius;
        logWindow.style.zIndex = '2147483647';
        logWindow.style.fontFamily = customLoggerConfig.font;
        logWindow.style.fontSize = '13px';
        logWindow.style.display = 'flex';
        logWindow.style.flexDirection = 'column';
        logWindow.style.overflow = 'hidden';
        logWindow.style.boxShadow = customLoggerConfig.shadow;
        // Header
        const header = document.createElement('div');
        header.style.background = '#222';
        header.style.color = '#fff';
        header.style.padding = '4px 8px';
        header.style.fontWeight = 'bold';
        header.style.borderBottom = '1px solid #383838';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.cursor = 'move';
        header.style.flexWrap = 'wrap';
        // Title
        const title = document.createElement('span');
        title.textContent = 'Isolated Third Person Log';
        header.appendChild(title);
        // --- SEARCH BAR ---
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search logs...';
        searchInput.style.marginLeft = '10px';
        searchInput.style.fontSize = '12px';
        searchInput.style.padding = '2px 6px';
        searchInput.style.borderRadius = '3px';
        searchInput.style.border = '1px solid #555';
        searchInput.style.background = '#181818';
        searchInput.style.color = '#fff';
        searchInput.addEventListener('input', () => {
            currentSearchTerm = searchInput.value;
            updateLogVisibility();
        });
        header.appendChild(searchInput);
        // --- END SEARCH BAR ---
        // --- THROTTLE SLIDER ---
        const throttleLabel = document.createElement('span');
        throttleLabel.textContent = 'Throttle:';
        throttleLabel.style.fontWeight = 'normal';
        throttleLabel.style.fontSize = '12px';
        header.appendChild(throttleLabel);
        const throttleSlider = document.createElement('input');
        throttleSlider.type = 'range';
        throttleSlider.min = '0';
        throttleSlider.max = '60000';
        throttleSlider.value = String(customLoggerConfig.throttle.identicalMessageMs);
        throttleSlider.style.width = '80px';
        throttleSlider.style.margin = '0 4px';
        header.appendChild(throttleSlider);
        const throttleValue = document.createElement('span');
        throttleValue.textContent = throttleSlider.value + 'ms';
        throttleValue.style.fontSize = '12px';
        header.appendChild(throttleValue);
        throttleSlider.addEventListener('input', () => {
            throttleValue.textContent = throttleSlider.value + 'ms';
            setCustomLoggerConfig({ throttle: { ...customLoggerConfig.throttle, identicalMessageMs: Number(throttleSlider.value) } });
        });
        // --- END THROTTLE SLIDER ---
        // --- FILE FILTER BUTTONS ---
        const fileButtonContainer = document.createElement('div');
        fileButtonContainer.style.display = 'flex';
        fileButtonContainer.style.gap = '4px';
        fileButtonContainer.style.marginLeft = '10px';
        // We'll dynamically update this container as new files are logged
        header.appendChild(fileButtonContainer);
        // --- END FILE FILTER BUTTONS ---
        // Focus Mode Toggle
        const focusContainer = document.createElement('div');
        focusContainer.style.display = 'flex';
        focusContainer.style.alignItems = 'center';
        focusContainer.style.marginLeft = '10px';
        const focusCheckbox = document.createElement('input');
        focusCheckbox.type = 'checkbox';
        focusCheckbox.id = 'logFocusModeCheckbox';
        focusCheckbox.checked = customLogFocusModeEnabled;
        focusCheckbox.style.marginRight = '4px';
        focusCheckbox.onchange = () => {
            customLogFocusModeEnabled = focusCheckbox.checked;
            updateLogVisibility(); // Function to re-apply filters and focus mode
        };
        const focusLabel = document.createElement('label');
        focusLabel.htmlFor = 'logFocusModeCheckbox';
        focusLabel.textContent = 'Focus Mode';
        focusLabel.style.fontSize = '12px';
        focusLabel.style.fontWeight = 'normal';
        focusContainer.appendChild(focusCheckbox);
        focusContainer.appendChild(focusLabel);
        header.appendChild(focusContainer);
        // Filter Buttons
        const filterContainer = document.createElement('div');
        filterContainer.style.display = 'flex';
        filterContainer.style.marginLeft = '10px';
        filterContainer.style.gap = '5px';
        Object.keys(activeFilters).forEach(type => {
            const filterBtn = document.createElement('button');
            filterBtn.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            filterBtn.dataset.logType = type;
            filterBtn.style.padding = '2px 6px';
            filterBtn.style.fontSize = '11px';
            filterBtn.style.border = '1px solid #555';
            filterBtn.style.borderRadius = '3px';
            filterBtn.style.cursor = 'pointer';
            filterBtn.style.background = activeFilters[type] ? '#68a2de' : '#444';
            filterBtn.style.color = '#fff';
            filterBtn.onclick = () => {
                activeFilters[type] = !activeFilters[type];
                filterBtn.style.background = activeFilters[type] ? '#68a2de' : '#444';
                updateLogVisibility();
            };
            filterContainer.appendChild(filterBtn);
        });
        header.appendChild(filterContainer);
        // Slider label
        const sliderLabel = document.createElement('span');
        sliderLabel.textContent = 'Copy:';
        sliderLabel.style.fontWeight = 'normal';
        sliderLabel.style.fontSize = '12px';
        header.appendChild(sliderLabel);
        // Slider
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '1';
        slider.max = '1000';
        slider.value = '10';
        slider.style.width = '80px';
        slider.style.margin = '0 4px';
        header.appendChild(slider);
        // Slider value label
        const sliderValue = document.createElement('span');
        sliderValue.textContent = slider.value;
        sliderValue.style.fontSize = '12px';
        header.appendChild(sliderValue);
        slider.addEventListener('input', () => {
            sliderValue.textContent = slider.value;
        });
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Logs';
        copyBtn.style.marginLeft = '8px';
        copyBtn.style.background = '#444';
        copyBtn.style.color = '#fff';
        copyBtn.style.border = '1px solid #666';
        copyBtn.style.borderRadius = '4px';
        copyBtn.style.padding = '2px 8px';
        copyBtn.style.cursor = 'pointer';
        copyBtn.title = 'Copy X oldest logs (from the top)';
        header.appendChild(copyBtn);
        copyBtn.onclick = () => {
            const contentDiv = logWindow!.querySelector(':scope > div:nth-child(2)') as HTMLElement;
            if (contentDiv) {
                const logs = Array.from(contentDiv.children).map(e => (e as HTMLElement).innerText);
                const numToCopy = Math.min(Number(slider.value), logs.length);
                const logsToCopy = logs.slice(0, numToCopy).join('\n');
                navigator.clipboard.writeText(logsToCopy).then(() => {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => (copyBtn.textContent = 'Copy Logs'), 1200);
                });
            }
        };
        // Resize button
        const resizeBtn = document.createElement('button');
        resizeBtn.textContent = 'Resize';
        resizeBtn.style.marginLeft = '8px';
        resizeBtn.style.background = '#444';
        resizeBtn.style.color = '#fff';
        resizeBtn.style.border = '1px solid #666';
        resizeBtn.style.borderRadius = '4px';
        resizeBtn.style.padding = '2px 8px';
        resizeBtn.style.cursor = 'pointer';
        resizeBtn.title = 'Toggle window size';
        header.appendChild(resizeBtn);
        let maximized = false;
        resizeBtn.onclick = () => {
            if (!maximized) {
                logWindow!.style.width = '98vw';
                logWindow!.style.height = '90vh';
                logWindow!.style.left = '1vw';
                logWindow!.style.right = '';
                logWindow!.style.bottom = '';
                logWindow!.style.top = '1vh';
                maximized = true;
                resizeBtn.textContent = 'Default Size';
            } else {
                logWindow!.style.width = '600px';
                logWindow!.style.height = '400px';
                logWindow!.style.left = '';
                logWindow!.style.right = '10px';
                logWindow!.style.bottom = '10px';
                logWindow!.style.top = '';
                maximized = false;
                resizeBtn.textContent = 'Resize';
            }
        };
        // Ensure Clear button is at the end of its own line or section if header wraps
        const clearBtnContainer = document.createElement('div');
        clearBtnContainer.style.marginLeft = 'auto'; // Pushes to the right, might need width 100% on a new line

        const clearBtn = header.querySelector('button[title="Clear all logs"]');
        if(clearBtn) clearBtnContainer.appendChild(clearBtn);
        header.appendChild(clearBtnContainer);

        // --- FILE COLOR LEGEND ---
        const fileLegend = document.createElement('div');
        fileLegend.style.display = 'flex';
        fileLegend.style.alignItems = 'center';
        fileLegend.style.gap = '8px';
        fileLegend.style.marginLeft = '10px';
        fileLegend.style.fontSize = '11px';
        fileLegend.style.flexWrap = 'wrap';
        fileLegend.id = 'customLoggerFileLegend';
        header.appendChild(fileLegend);

        // --- FILE LOG MODERN PANEL ---
        const filePanelBtn = document.createElement('button');
        filePanelBtn.id = 'customLoggerFilePanelBtn';
        filePanelBtn.setAttribute('aria-expanded', 'false');
        filePanelBtn.textContent = '📁 Files';
        filePanelBtn.style.fontWeight = 'bold';
        filePanelBtn.style.fontSize = '14px';
        filePanelBtn.style.marginLeft = '8px';
        filePanelBtn.style.marginRight = '10px';
        filePanelBtn.style.color = '#fff';
        filePanelBtn.style.background = 'linear-gradient(90deg, #232c3d 60%, #2e3c54 100%)';
        filePanelBtn.style.border = 'none';
        filePanelBtn.style.borderRadius = '18px';
        filePanelBtn.style.padding = '6px 18px';
        filePanelBtn.style.cursor = 'pointer';
        filePanelBtn.style.boxShadow = '0 2px 8px 0 rgba(0,0,0,0.10)';
        filePanelBtn.style.transition = 'background 0.2s, box-shadow 0.2s';
        filePanelBtn.onclick = toggleFilePanel;
        header.insertBefore(filePanelBtn, header.firstChild);
        const filePanel = document.createElement('div');
        filePanel.id = 'customLoggerFilePanel';
        filePanel.style.display = 'none';
        filePanel.style.opacity = '0';
        filePanel.style.position = 'absolute';
        filePanel.style.left = '8px';
        filePanel.style.top = '38px';
        filePanel.style.background = 'rgba(30,34,44,0.99)';
        filePanel.style.border = '2px solid #3a4a6a';
        filePanel.style.borderRadius = '16px';
        filePanel.style.boxShadow = '0 12px 48px 0 rgba(0,0,0,0.25)';
        filePanel.style.padding = '18px 22px 18px 22px';
        filePanel.style.zIndex = '2147483648';
        filePanel.style.minWidth = '240px';
        filePanel.style.maxHeight = '320px';
        filePanel.style.overflowY = 'auto';
        filePanel.style.transition = 'opacity 0.18s cubic-bezier(.4,1.3,.6,1)';
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '12px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#fff';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = closeFilePanel;
        filePanel.appendChild(closeBtn);
        header.appendChild(filePanel);
        // Click outside to close
        document.addEventListener('mousedown', (e) => {
            if (filePanelExpanded && !filePanel.contains(e.target as Node) && !filePanelBtn.contains(e.target as Node)) {
                closeFilePanel();
            }
        });

        logWindow.appendChild(header);
        // Content
        const content = document.createElement('div');
        content.style.flex = '1';
        content.style.overflowY = 'auto';
        content.style.padding = '4px 8px';
        logWindow.appendChild(content);
        // Resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '0';
        resizeHandle.style.bottom = '0';
        resizeHandle.style.width = '18px';
        resizeHandle.style.height = '18px';
        resizeHandle.style.background = 'rgba(80,80,80,0.7)';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.borderTopLeftRadius = '6px';
        resizeHandle.title = 'Resize log window';
        logWindow.appendChild(resizeHandle);
        // Resizing logic
        let isResizing = false;
        let startX = 0, startY = 0, startWidth = 0, startHeight = 0;
        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(document.defaultView!.getComputedStyle(logWindow!).width, 10);
            startHeight = parseInt(document.defaultView!.getComputedStyle(logWindow!).height, 10);
            document.onmousemove = (ev) => {
                if (!isResizing) return;
                const newWidth = startWidth + (ev.clientX - startX);
                const newHeight = startHeight + (ev.clientY - startY);
                logWindow!.style.width = Math.max(300, newWidth) + 'px';
                logWindow!.style.height = Math.max(120, newHeight) + 'px';
            };
            document.onmouseup = () => {
                isResizing = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        });

        // Drag-to-move logic
        let offsetX = 0, offsetY = 0, isDragging = false;
        header.addEventListener('mousedown', (e) => {
            // Prevent dragging if the event target is a button or slider inside the header
            if ((e.target as HTMLElement).closest('button, input[type="range"]')) {
                return;
            }
            isDragging = true;
            const rect = logWindow!.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            document.onmousemove = (ev) => {
                if (!isDragging) return;
                logWindow!.style.left = (ev.clientX - offsetX) + 'px';
                logWindow!.style.top = (ev.clientY - offsetY) + 'px';
                logWindow!.style.right = ''; // Clear right/bottom if dragging
                logWindow!.style.bottom = '';
            };
            document.onmouseup = () => {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        });

        document.body.appendChild(logWindow);
        // --- Patch: update file filter buttons when new files are logged ---
        (window as any)._customLoggerUpdateFileButtons = function updateFileButtons() {
            // --- Update file log panel ---
            filePanel.innerHTML = '';
            filePanel.appendChild(closeBtn);
            const files = getAllLoggedFiles();
            if (files.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.textContent = 'No files have logged yet.';
                emptyMsg.style.color = '#aaa';
                emptyMsg.style.fontSize = '13px';
                emptyMsg.style.padding = '8px 0';
                filePanel.appendChild(emptyMsg);
                return;
            }
            files.forEach(file => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.gap = '8px';
                row.style.marginBottom = '8px';
                row.style.padding = '6px 0';
                // File name
                const fileNameSpan = document.createElement('span');
                fileNameSpan.textContent = file;
                fileNameSpan.style.color = getFileColor(file);
                fileNameSpan.style.fontWeight = 'bold';
                fileNameSpan.style.fontSize = '16px';
                fileNameSpan.style.flex = '1';
                row.appendChild(fileNameSpan);
                // Log count
                const countSpan = document.createElement('span');
                countSpan.textContent = getFileLogCount(file).toString();
                countSpan.style.background = '#232c3d';
                countSpan.style.color = '#fff';
                countSpan.style.fontSize = '13px';
                countSpan.style.borderRadius = '8px';
                countSpan.style.padding = '2px 10px';
                countSpan.style.marginRight = '8px';
                row.appendChild(countSpan);
                // Toggle button
                const toggleBtn = document.createElement('button');
                toggleBtn.textContent = isFileLogVisible(file) ? 'Hide' : 'Show';
                toggleBtn.style.padding = '2px 16px';
                toggleBtn.style.fontSize = '14px';
                toggleBtn.style.border = '1px solid #3a4a6a';
                toggleBtn.style.borderRadius = '8px';
                toggleBtn.style.cursor = 'pointer';
                toggleBtn.style.background = isFileLogVisible(file) ? getFileColor(file) : '#232c3d';
                toggleBtn.style.color = isFileLogVisible(file) ? '#fff' : '#888';
                toggleBtn.title = isFileLogVisible(file) ? 'Hide logs from this file' : 'Show logs from this file';
                toggleBtn.onclick = () => {
                    setFileLogVisibility(file, !isFileLogVisible(file));
                    (window as any)._customLoggerUpdateFileButtons();
                };
                row.appendChild(toggleBtn);
                filePanel.appendChild(row);
            });
        };
    } else {
        // Always ensure z-index is set to max if log window already exists
        logWindow.style.zIndex = '2147483647';
        logWindow.style.zoom = '1.3';
        const focusCheckbox = document.getElementById('logFocusModeCheckbox') as HTMLInputElement;
        if (focusCheckbox) focusCheckbox.checked = customLogFocusModeEnabled;
        Object.keys(activeFilters).forEach(type => {
            if (logWindow) {
                const filterBtn = logWindow.querySelector(`button[data-log-type="${type}"]`) as HTMLElement;
                if (filterBtn) filterBtn.style.background = activeFilters[type] ? '#68a2de' : '#444';
            }
        });
    }
}

// --- File filter infrastructure ---
let fileLogVisibility: Record<string, boolean> = {};
function setFileLogVisibility(file: string, visible: boolean) {
    fileLogVisibility[file] = visible;
    updateLogVisibility();
}
function isFileLogVisible(file: string): boolean {
    // If not set, default to true
    return fileLogVisibility[file] !== false;
}

function updateLogVisibility() {
    if (!customLogContent || !customLogContainer) return;
    const logEntries = customLogContent.children;
    for (let i = 0; i < logEntries.length; i++) {
        const entry = logEntries[i] as HTMLElement;
        const type = entry.dataset.logType || 'log';
        const importance = entry.dataset.logImportance || 'normal';
        const file = entry.dataset.logFile || '';
        let visible = activeFilters[type];
        if (customLogFocusModeEnabled && importance === 'normal' && type !== 'error' && type !== 'warn') {
            visible = false;
        }
        // File filter
        if (activeFileFilters.size > 0 && !activeFileFilters.has(file)) {
            visible = false;
        }
        // File log visibility
        if (file && !isFileLogVisible(file)) {
            visible = false;
        }
        // Search filter
        if (currentSearchTerm && !entry.textContent?.toLowerCase().includes(currentSearchTerm.toLowerCase())) {
            visible = false;
        }
        entry.style.display = visible ? 'block' : 'none';
    }
    customLogContainer.scrollTop = customLogContainer.scrollHeight;
}

// --- Modern floating file panel infrastructure ---
let filePanelExpanded = false;
function closeFilePanel() {
    filePanelExpanded = false;
    const panel = document.getElementById('customLoggerFilePanel');
    if (panel) {
        panel.style.opacity = '0';
        setTimeout(() => { panel.style.display = 'none'; }, 180);
    }
    const btn = document.getElementById('customLoggerFilePanelBtn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
function openFilePanel() {
    filePanelExpanded = true;
    const panel = document.getElementById('customLoggerFilePanel');
    if (panel) {
        panel.style.display = 'block';
        setTimeout(() => { panel.style.opacity = '1'; }, 10);
    }
    const btn = document.getElementById('customLoggerFilePanelBtn');
    if (btn) btn.setAttribute('aria-expanded', 'true');
}
function toggleFilePanel() {
    if (filePanelExpanded) closeFilePanel(); else openFilePanel();
}
function getFileLogCount(file: string): number {
    if (!customLogContent) return 0;
    let count = 0;
    for (let i = 0; i < customLogContent.children.length; i++) {
        const entry = customLogContent.children[i] as HTMLElement;
        if (entry.dataset.logFile === file) count++;
    }
    return count;
}

// --- Get all unique filenames from log entries ---
function getAllLoggedFiles(): string[] {
    const files = new Set<string>();
    if (customLogContent) {
        for (let i = 0; i < customLogContent.children.length; i++) {
            const entry = customLogContent.children[i] as HTMLElement;
            if (entry.dataset.logFile) files.add(entry.dataset.logFile);
        }
    }
    return Array.from(files);
}

export function initCustomLogger(containerId: string = 'itp-custom-log-window') {
    ensureCustomLogWindow(containerId);
    const logContainer = document.getElementById(containerId);
    if (logContainer) {
        customLogContainer = logContainer;
        customLogContent = logContainer.querySelector(':scope > div:nth-child(2)') as HTMLElement;
        // Clear previous logs from content div only, keep header
        if (customLogContent) {
            while (customLogContent.firstChild) {
                customLogContent.removeChild(customLogContent.firstChild);
            }
        }
        lineCount = 0; // Reset line count
        appendToCustomLog("Custom Logger Initialized (from customLogger.ts)", "info");
    } else {
        console.warn(`CustomLogger: Could not find log container with ID: ${containerId}`);
    }
} 