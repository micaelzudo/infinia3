import { LogLevel } from '../placeholderTypes';

export interface DayNightCycleConfig {
    initialTime?: number;
    cycleDuration?: number;
    timeScale?: number;
}

export class WildernessDayNightCycle {
    private currentTime: number;
    private cycleDuration: number;
    private timeScale: number;
    private isRunning: boolean;

    constructor(config: DayNightCycleConfig = {}) {
        this.currentTime = config.initialTime || 0;
        this.cycleDuration = config.cycleDuration || 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.timeScale = config.timeScale || 1;
        this.isRunning = false;
    }

    start(): void {
        this.isRunning = true;
    }

    pause(): void {
        this.isRunning = false;
    }

    update(delta: number): void {
        if (!this.isRunning) return;

        // Update time based on delta and time scale
        this.currentTime += delta * this.timeScale;

        // Reset cycle if it completes
        if (this.currentTime >= this.cycleDuration) {
            this.currentTime = 0;
        }
    }

    getCurrentTimeOfDay(): { hours: number, minutes: number } {
        const totalMinutes = Math.floor((this.currentTime / this.cycleDuration) * (24 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return { hours, minutes };
    }

    isNightTime(): boolean {
        const { hours } = this.getCurrentTimeOfDay();
        return hours >= 20 || hours < 6; // Night is from 8 PM to 6 AM
    }

    getLightIntensity(): number {
        const { hours, minutes } = this.getCurrentTimeOfDay();
        const totalMinutes = hours * 60 + minutes;

        // Simulate light intensity curve
        if (totalMinutes < 360) { // 6 AM - Sunrise
            return this.interpolate(0, 1, totalMinutes / 360);
        } else if (totalMinutes < 1080) { // 6 AM to 6 PM - Full daylight
            return 1;
        } else if (totalMinutes < 1440) { // 6 PM - Sunset
            return this.interpolate(1, 0, (totalMinutes - 1080) / 360);
        } else { // Night
            return 0;
        }
    }

    private interpolate(start: number, end: number, progress: number): number {
        return start + (end - start) * progress;
    }

    dispose(): void {
        this.pause();
        this.currentTime = 0;
    }
}
