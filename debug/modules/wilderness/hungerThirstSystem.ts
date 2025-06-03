import * as THREE from 'three';

/**
 * Hunger/Thirst System for the Wilderness Survival Game
 * Handles the player's hunger and thirst levels
 */
export class HungerThirstSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    
    // Hunger and thirst levels (0-100)
    private hungerLevel: number = 100;
    private thirstLevel: number = 100;
    
    // Depletion rates (per second)
    private hungerDepletionRate: number = 0.05;
    private thirstDepletionRate: number = 0.08;
    
    // UI elements
    private hungerThirstContainer: HTMLElement | null = null;
    private hungerBar: HTMLElement | null = null;
    private thirstBar: HTMLElement | null = null;
    private statusMessage: HTMLElement | null = null;
    
    // Last update time
    private lastUpdateTime: number = Date.now();
    
    // Animation frame ID
    private animationFrameId: number | null = null;
    
    /**
     * Constructor for the HungerThirstSystem class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, contentArea: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;
        
        // Create the hunger/thirst UI
        this.createHungerThirstUI();
        
        // Start the hunger/thirst update loop
        this.startUpdateLoop();
        
        console.log("Hunger/Thirst System initialized");
    }
    
    /**
     * Create the hunger/thirst UI
     */
    private createHungerThirstUI(): void {
        // Create the hunger/thirst section
        const hungerThirstSection = document.createElement('div');
        hungerThirstSection.className = 'wilderness-hungerthirst-section';
        hungerThirstSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Survival Status';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        hungerThirstSection.appendChild(sectionTitle);

        // Create the hunger/thirst container
        this.hungerThirstContainer = document.createElement('div');
        this.hungerThirstContainer.className = 'wilderness-hungerthirst-container';
        this.hungerThirstContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.hungerThirstContainer.style.borderRadius = '4px';
        this.hungerThirstContainer.style.padding = '10px';
        hungerThirstSection.appendChild(this.hungerThirstContainer);

        // Create the hunger bar container
        const hungerBarContainer = document.createElement('div');
        hungerBarContainer.className = 'wilderness-hunger-container';
        hungerBarContainer.style.marginBottom = '10px';
        this.hungerThirstContainer.appendChild(hungerBarContainer);

        // Create the hunger label
        const hungerLabel = document.createElement('div');
        hungerLabel.className = 'wilderness-hunger-label';
        hungerLabel.textContent = 'Hunger';
        hungerLabel.style.display = 'flex';
        hungerLabel.style.alignItems = 'center';
        hungerLabel.style.marginBottom = '5px';
        hungerLabel.innerHTML = '<span style="font-size: 16px; margin-right: 5px;">🍖</span> Hunger';
        hungerBarContainer.appendChild(hungerLabel);

        // Create the hunger bar background
        const hungerBarBg = document.createElement('div');
        hungerBarBg.className = 'wilderness-hunger-bar-bg';
        hungerBarBg.style.height = '15px';
        hungerBarBg.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        hungerBarBg.style.borderRadius = '3px';
        hungerBarBg.style.overflow = 'hidden';
        hungerBarContainer.appendChild(hungerBarBg);

        // Create the hunger bar
        this.hungerBar = document.createElement('div');
        this.hungerBar.className = 'wilderness-hunger-bar';
        this.hungerBar.style.height = '100%';
        this.hungerBar.style.width = `${this.hungerLevel}%`;
        this.hungerBar.style.backgroundColor = '#f59e0b';
        this.hungerBar.style.transition = 'width 0.5s ease';
        hungerBarBg.appendChild(this.hungerBar);

        // Create the thirst bar container
        const thirstBarContainer = document.createElement('div');
        thirstBarContainer.className = 'wilderness-thirst-container';
        thirstBarContainer.style.marginBottom = '10px';
        this.hungerThirstContainer.appendChild(thirstBarContainer);

        // Create the thirst label
        const thirstLabel = document.createElement('div');
        thirstLabel.className = 'wilderness-thirst-label';
        thirstLabel.style.display = 'flex';
        thirstLabel.style.alignItems = 'center';
        thirstLabel.style.marginBottom = '5px';
        thirstLabel.innerHTML = '<span style="font-size: 16px; margin-right: 5px;">💧</span> Thirst';
        thirstBarContainer.appendChild(thirstLabel);

        // Create the thirst bar background
        const thirstBarBg = document.createElement('div');
        thirstBarBg.className = 'wilderness-thirst-bar-bg';
        thirstBarBg.style.height = '15px';
        thirstBarBg.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        thirstBarBg.style.borderRadius = '3px';
        thirstBarBg.style.overflow = 'hidden';
        thirstBarContainer.appendChild(thirstBarBg);

        // Create the thirst bar
        this.thirstBar = document.createElement('div');
        this.thirstBar.className = 'wilderness-thirst-bar';
        this.thirstBar.style.height = '100%';
        this.thirstBar.style.width = `${this.thirstLevel}%`;
        this.thirstBar.style.backgroundColor = '#3b82f6';
        this.thirstBar.style.transition = 'width 0.5s ease';
        thirstBarBg.appendChild(this.thirstBar);

        // Create the status message
        this.statusMessage = document.createElement('div');
        this.statusMessage.className = 'wilderness-status-message';
        this.statusMessage.style.textAlign = 'center';
        this.statusMessage.style.padding = '5px';
        this.statusMessage.style.borderRadius = '3px';
        this.statusMessage.style.marginTop = '5px';
        this.hungerThirstContainer.appendChild(this.statusMessage);

        // Add the hunger/thirst section to the content area
        this.contentArea.appendChild(hungerThirstSection);

        // Update the status message
        this.updateStatusMessage();
    }
    
    /**
     * Start the hunger/thirst update loop
     */
    private startUpdateLoop(): void {
        // Store the current time
        this.lastUpdateTime = Date.now();
        
        // Start the animation loop
        this.animationFrameId = requestAnimationFrame(this.update.bind(this));
    }
    
    /**
     * Update the hunger/thirst system
     */
    private update(): void {
        // Calculate the time elapsed since the last update
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // in seconds
        this.lastUpdateTime = currentTime;
        
        // Update hunger and thirst levels
        this.hungerLevel = Math.max(0, this.hungerLevel - this.hungerDepletionRate * deltaTime);
        this.thirstLevel = Math.max(0, this.thirstLevel - this.thirstDepletionRate * deltaTime);
        
        // Update the UI
        this.updateUI();
        
        // Continue the animation loop
        this.animationFrameId = requestAnimationFrame(this.update.bind(this));
    }
    
    /**
     * Update the hunger/thirst UI
     */
    private updateUI(): void {
        // Update the hunger bar
        if (this.hungerBar) {
            this.hungerBar.style.width = `${this.hungerLevel}%`;
            
            // Update the color based on the hunger level
            if (this.hungerLevel > 70) {
                this.hungerBar.style.backgroundColor = '#f59e0b'; // Amber
            } else if (this.hungerLevel > 30) {
                this.hungerBar.style.backgroundColor = '#f97316'; // Orange
            } else {
                this.hungerBar.style.backgroundColor = '#ef4444'; // Red
            }
        }
        
        // Update the thirst bar
        if (this.thirstBar) {
            this.thirstBar.style.width = `${this.thirstLevel}%`;
            
            // Update the color based on the thirst level
            if (this.thirstLevel > 70) {
                this.thirstBar.style.backgroundColor = '#3b82f6'; // Blue
            } else if (this.thirstLevel > 30) {
                this.thirstBar.style.backgroundColor = '#60a5fa'; // Light blue
            } else {
                this.thirstBar.style.backgroundColor = '#ef4444'; // Red
            }
        }
        
        // Update the status message
        this.updateStatusMessage();
    }
    
    /**
     * Update the status message
     */
    private updateStatusMessage(): void {
        if (!this.statusMessage) return;
        
        let message = '';
        let color = '';
        
        // Determine the status message based on hunger and thirst levels
        if (this.hungerLevel <= 0 || this.thirstLevel <= 0) {
            message = 'CRITICAL: Find food and water immediately!';
            color = '#ef4444'; // Red
        } else if (this.hungerLevel < 20 || this.thirstLevel < 20) {
            message = 'WARNING: You are very hungry and thirsty!';
            color = '#f97316'; // Orange
        } else if (this.hungerLevel < 40 || this.thirstLevel < 40) {
            message = 'You are getting hungry and thirsty.';
            color = '#f59e0b'; // Amber
        } else {
            message = 'You are well fed and hydrated.';
            color = '#10b981'; // Green
        }
        
        // Update the status message
        this.statusMessage.textContent = message;
        this.statusMessage.style.backgroundColor = color;
        this.statusMessage.style.color = 'white';
    }
    
    /**
     * Eat food to increase hunger level
     * @param amount The amount to increase hunger by
     */
    public eat(amount: number = 20): void {
        this.hungerLevel = Math.min(100, this.hungerLevel + amount);
        this.updateUI();
        console.log(`Ate food, hunger level now: ${this.hungerLevel}`);
    }
    
    /**
     * Drink water to increase thirst level
     * @param amount The amount to increase thirst by
     */
    public drink(amount: number = 25): void {
        this.thirstLevel = Math.min(100, this.thirstLevel + amount);
        this.updateUI();
        console.log(`Drank water, thirst level now: ${this.thirstLevel}`);
    }
    
    /**
     * Get the current hunger level
     * @returns The hunger level (0-100)
     */
    public getHungerLevel(): number {
        return this.hungerLevel;
    }
    
    /**
     * Get the current thirst level
     * @returns The thirst level (0-100)
     */
    public getThirstLevel(): number {
        return this.thirstLevel;
    }
    
    /**
     * Dispose of the hunger/thirst system
     */
    public dispose(): void {
        // Stop the update loop
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log("Hunger/Thirst System disposed");
    }
}
