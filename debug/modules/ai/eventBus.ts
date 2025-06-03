type EventCallback = (data?: any) => void;
const eventListeners: Map<string, Set<EventCallback>> = new Map();

export function on(event: string, cb: EventCallback) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event)!.add(cb);
}

export function off(event: string, cb: EventCallback) {
    if (eventListeners.has(event)) {
        eventListeners.get(event)!.delete(cb);
    }
}

export function emit(event: string, data?: any) {
    if (eventListeners.has(event)) {
        eventListeners.get(event)!.forEach(cb => cb(data));
    }
} 