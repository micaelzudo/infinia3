export interface LogOptions {
    timestamp?: boolean;
    category?: string;
    level?: 'debug' | 'info' | 'warn' | 'error';
    line?: number;
    state?: string;
    action?: string;
    data?: any;
}

export class LoggingSystem {
    private static lastLogTime: Record<string, number> = {};
    private static minLogInterval: number = 500; // 500ms minimum interval between logs

    private static getTimestamp(): string {
        return `[${new Date().toLocaleTimeString()}]`;
    }

    private static getCategoryPrefix(category: string): string {
        return category ? `[${category.toUpperCase()}]` : '';
    }

    private static formatLog(message: string, options: LogOptions): string {
        const parts: string[] = [];
        
        if (options.timestamp) {
            parts.push(this.getTimestamp());
        }
        
        if (options.category) {
            parts.push(this.getCategoryPrefix(options.category));
        }

        if (options.state) {
            parts.push(`State: ${options.state}`);
        }

        if (options.action) {
            parts.push(`Action: ${options.action}`);
        }

        if (options.data) {
            parts.push(JSON.stringify(options.data, null, 2));
        }

        return parts.length > 0 ? `${parts.join(' ')} ${message}` : message;
    }

    private static shouldLog(category: string): boolean {
        if (!this.lastLogTime[category]) {
            this.lastLogTime[category] = Date.now();
            return true;
        }
        const currentTime = Date.now();
        if (currentTime - this.lastLogTime[category] >= this.minLogInterval) {
            this.lastLogTime[category] = currentTime;
            return true;
        }
        return false;
    }

    public static log(message: string, options: LogOptions = {}): void {
        if (!this.shouldLog(options.category || 'general')) return;

        const fullMessage = this.formatLog(message, options);

        switch (options.level) {
            case 'debug':
                console.debug(fullMessage);
                break;
            case 'warn':
                console.warn(fullMessage);
                break;
            case 'error':
                console.error(fullMessage);
                break;
            default:
                console.log(fullMessage);
        }
    }

    public static setMinLogInterval(interval: number): void {
        this.minLogInterval = interval;
    }
}
