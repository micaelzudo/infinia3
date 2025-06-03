type EventCallback = (...args: any[]) => void;

class EventBus {
    private static instance: EventBus;
    private listeners: Map<string, EventCallback[]>;

    private constructor() {
        this.listeners = new Map();
    }

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    public on(event: string, callback: EventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    public off(event: string, callback: EventCallback): void {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event)!;
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
    }

    public emit(event: string, ...args: any[]): void {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event)!.forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    public clear(): void {
        this.listeners.clear();
    }
}

export const eventBus = EventBus.getInstance();
export const on = eventBus.on.bind(eventBus);
export const off = eventBus.off.bind(eventBus);
export const emit = eventBus.emit.bind(eventBus); 