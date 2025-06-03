// debug/modules/ui/customLogger.ts

// --- CUSTOM LOG WINDOW START ---
let customLogContainer: HTMLElement | null = null;
let customLogContent: HTMLElement | null = null; // For the actual log entries
let customLogLines: string[] = [];
const MAX_LOG_LINES = 100; // Keep the log from growing indefinitely
let lineCount = 0;

const logThrottleTrack: { [key: string]: number } = {}; // For throttling
const logTypeThrottleTrack: { [key: string]: number } = {}; // For type-based throttling
const identicalMessageThrottleTrack: { [message: string]: number } = {}; // For identical messages
const IDENTICAL_MESSAGE_THROTTLE_MS = 30000; // 30 seconds for identical messages

let customLogFocusModeEnabled = true;
const activeFilters: { [key: string]: boolean } = { log: true, warn: true, error: true, info: true };

export function appendToCustomLog(
    message: string,
    type: 'log' | 'warn' | 'error' | 'info' = 'log',
    throttleKey?: string,
    throttleMs?: number,
    typeThrottleMs?: number, // New parameter for type-specific throttling
    importance: 'normal' | 'critical' = 'normal' // New parameter for log importance
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
    if (typeThrottleMs && typeThrottleMs > 0) { // Check if type throttling is active for this call
        const lastLogTimeForType = logTypeThrottleTrack[type] || 0;
        if (currentTime - lastLogTimeForType < typeThrottleMs) {
            return; // Message is throttled by type
        }
        logTypeThrottleTrack[type] = currentTime; // Update timestamp for this type as it passed
    }

    // 2. Key-based throttling (adapted from original logic)
    if (throttleKey && throttleMs && throttleMs > 0) { // Check if key throttling is active for this call
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
        const logEntry = document.createElement('div');
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        logEntry.textContent = `[${timestamp}] ${message}`;
        logEntry.style.whiteSpace = 'pre-wrap';
        logEntry.style.borderBottom = '1px solid #383838'; // Slightly lighter border
        logEntry.style.padding = '3px 2px';
        logEntry.style.margin = '0';
        logEntry.style.lineHeight = '1.3';
        logEntry.style.wordBreak = 'break-all'; // Ensure long messages wrap
        logEntry.dataset.logType = type;
        logEntry.dataset.logImportance = importance;

        switch (type) {
            case 'warn':
                logEntry.style.color = '#ffd700'; // Gold for warnings
                break;
            case 'error':
                logEntry.style.color = '#ff8c8c'; // Softer red
                break;
            case 'info':
                logEntry.style.color = '#a0a0a0'; // Lighter grey for info
                break;
            default:
                logEntry.style.color = '#e0e0e0'; // Lighter grey for logs
                break;
        }
        customLogContent.appendChild(logEntry);
        lineCount++;

        // Prune old log entries if over max lines
        while (lineCount > MAX_LOG_LINES && customLogContent.firstChild) {
            customLogContent.removeChild(customLogContent.firstChild);
            lineCount--;
        }

        customLogContainer.scrollTop = customLogContainer.scrollHeight; // Scroll log container (main div)
        updateLogVisibility(); // Call after adding and pruning
    }
    // Fallback to console
    switch (type) {
        case 'warn':
            console.warn(message);
            break;
        case 'error':
            console.error(message);
            break;
        case 'info':
            console.info(message);
            break;
        default:
            console.log(message);
            break;
    }

    // If an identical message passed all other throttles, update its timestamp now
    if (importance !== 'critical' && type !== 'error') {
        identicalMessageThrottleTrack[message] = currentTime;
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
        logWindow.style.background = 'rgba(24,24,24,0.98)';
        logWindow.style.border = '2px solid #444';
        logWindow.style.borderRadius = '8px';
        logWindow.style.zIndex = '2147483647'; // Highest possible z-index
        logWindow.style.fontFamily = 'monospace';
        logWindow.style.fontSize = '13px';
        logWindow.style.display = 'flex';
        logWindow.style.flexDirection = 'column';
        logWindow.style.overflow = 'hidden';
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
        header.style.cursor = 'move'; // Add move cursor to header for dragging
        header.style.flexWrap = 'wrap'; // Allow header items to wrap
        // Title
        const title = document.createElement('span');
        title.textContent = 'Isolated Third Person Log';
        header.appendChild(title);
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

function updateLogVisibility() {
    if (!customLogContent || !customLogContainer) return;
    const logEntries = customLogContent.children;
    for (let i = 0; i < logEntries.length; i++) {
        const entry = logEntries[i] as HTMLElement;
        const type = entry.dataset.logType || 'log';
        const importance = entry.dataset.logImportance || 'normal';
        let visible = activeFilters[type];
        if (customLogFocusModeEnabled && importance === 'normal' && type !== 'error' && type !== 'warn') {
            visible = false;
        }
        entry.style.display = visible ? 'block' : 'none';
    }
    customLogContainer.scrollTop = customLogContainer.scrollHeight;
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