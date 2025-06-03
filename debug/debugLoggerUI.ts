// debug/debugLoggerUI.ts

let logContainer: HTMLElement | null = null;
const MAX_LOG_LINES = 50; // Limit the number of lines displayed

// --- Styling ---
const logContainerStyle = `
    position: fixed;
    bottom: 10px;
    left: 10px;
    width: 35%;
    max-height: 30%;
    overflow-y: scroll;
    background-color: rgba(0, 0, 0, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 5px;
    padding: 8px;
    font-family: monospace;
    font-size: 0.8em;
    color: white;
    z-index: 1000;
    opacity: 0.9;
    pointer-events: none; /* Allow clicks to pass through */
`;

const logMessageStyle = `
    margin: 0 0 4px 0;
    padding: 0;
    border-bottom: 1px dotted rgba(255, 255, 255, 0.1);
    word-wrap: break-word;
`;

const colors = {
    log: '#FFFFFF',    // White
    warn: '#FFA500',   // Orange
    error: '#FF4444',  // Red
    info: '#87CEFA',   // LightSkyBlue
    debug: '#90EE90',  // LightGreen
    event: '#FFD700',  // Gold
};

// --- Helper to format messages ---
function formatMessage(args: any[]): string {
    return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return '[Unserializable Object]';
            }
        }
        return String(arg);
    }).join(' ');
}

// --- Add Message Function ---
function addMessage(type: keyof typeof colors, args: any[]) {
    if (!logContainer) return;

    const messageText = formatMessage(args);
    const messageElement = document.createElement('div');
    messageElement.textContent = `[${type.toUpperCase()}] ${messageText}`;
    messageElement.style.cssText = logMessageStyle;
    messageElement.style.color = colors[type] || colors.log;

    // Limit log lines
    while (logContainer.children.length >= MAX_LOG_LINES) {
        logContainer.removeChild(logContainer.firstChild!);
    }

    logContainer.appendChild(messageElement);

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

// --- Intercept Console Methods ---
const originalConsole = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
};

function overrideConsole() {
    console.log = (...args: any[]) => {
        originalConsole.log(...args);
        addMessage('log', args);
    };
    console.warn = (...args: any[]) => {
        originalConsole.warn(...args);
        addMessage('warn', args);
    };
    console.error = (...args: any[]) => {
        originalConsole.error(...args);
        addMessage('error', args);
    };
    console.info = (...args: any[]) => {
        originalConsole.info(...args);
        addMessage('info', args);
    };
    console.debug = (...args: any[]) => {
        originalConsole.debug(...args);
        addMessage('debug', args);
    };
    // Add a custom event log
    (console as any).event = (...args: any[]) => {
        originalConsole.log(...args); // Still log to original console
        addMessage('event', args);
    };
}

// --- Initialization ---
export function initLogUI() {
    if (logContainer) return; // Already initialized

    logContainer = document.createElement('div');
    logContainer.id = 'debug-log-ui';
    logContainer.style.cssText = logContainerStyle;

    const title = document.createElement('div');
    title.textContent = 'Debug Log';
    title.style.fontWeight = 'bold';
    title.style.borderBottom = '1px solid rgba(255, 255, 255, 0.5)';
    title.style.marginBottom = '5px';
    title.style.color = '#CCCCCC';
    logContainer.appendChild(title);


    document.body.appendChild(logContainer);
    overrideConsole();
    console.log("🔌 Debug Logger UI Initialized.");
}

// --- Cleanup ---
export function removeLogUI() {
    if (logContainer && logContainer.parentNode) {
        logContainer.parentNode.removeChild(logContainer);
        logContainer = null;
        // Restore original console methods if needed (optional)
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
        delete (console as any).event;

    }
} 