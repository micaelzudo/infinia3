import * as THREE from 'three';

/**
 * Day/Night System for the Wilderness Survival Game
 * Handles the day/night cycle and weather
 */
export class DayNightSystem {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private contentArea: HTMLElement;
    private dayNightContainer: HTMLElement | null = null;
    private timeSlider: HTMLInputElement | null = null;
    private timeDisplay: HTMLElement | null = null;
    private weatherSelect: HTMLSelectElement | null = null;
    
    // Day/night cycle properties
    private time: number = 12; // 24-hour format (12 = noon)
    private dayLength: number = 20; // minutes for a full day/night cycle
    private isAutomatic: boolean = false;
    private lastUpdateTime: number = Date.now();
    
    // Weather properties
    private weather: string = 'clear';
    private weatherOptions: string[] = ['clear', 'cloudy', 'rainy', 'stormy', 'foggy', 'snowy'];
    
    // Animation frame ID for automatic cycle
    private animationFrameId: number | null = null;

    /**
     * Constructor for the DayNightSystem class
     * @param scene The THREE.js scene
     * @param camera The THREE.js camera
     * @param contentArea The HTML element to append UI elements to
     */
    constructor(scene: THREE.Scene, camera: THREE.Camera, contentArea: HTMLElement) {
        this.scene = scene;
        this.camera = camera;
        this.contentArea = contentArea;
        
        // Create the day/night UI
        this.createDayNightUI();
        
        console.log("Day/Night System initialized");
    }

    /**
     * Create the day/night UI
     */
    private createDayNightUI(): void {
        // Create the day/night section
        const dayNightSection = document.createElement('div');
        dayNightSection.className = 'wilderness-daynight-section';
        dayNightSection.style.marginBottom = '20px';

        // Create the section title
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = 'Day/Night Cycle';
        sectionTitle.style.margin = '0';
        sectionTitle.style.fontSize = '16px';
        sectionTitle.style.marginBottom = '10px';
        sectionTitle.style.borderBottom = '1px solid #4a5568';
        sectionTitle.style.paddingBottom = '5px';
        dayNightSection.appendChild(sectionTitle);

        // Create the day/night container
        this.dayNightContainer = document.createElement('div');
        this.dayNightContainer.className = 'wilderness-daynight-container';
        this.dayNightContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        this.dayNightContainer.style.borderRadius = '4px';
        this.dayNightContainer.style.padding = '10px';
        dayNightSection.appendChild(this.dayNightContainer);

        // Create the time control
        const timeControl = document.createElement('div');
        timeControl.className = 'wilderness-time-control';
        timeControl.style.marginBottom = '10px';
        this.dayNightContainer.appendChild(timeControl);

        // Create the time label
        const timeLabel = document.createElement('label');
        timeLabel.textContent = 'Time of Day:';
        timeLabel.style.display = 'block';
        timeLabel.style.marginBottom = '5px';
        timeControl.appendChild(timeLabel);

        // Create the time slider container
        const timeSliderContainer = document.createElement('div');
        timeSliderContainer.style.display = 'flex';
        timeSliderContainer.style.alignItems = 'center';
        timeControl.appendChild(timeSliderContainer);

        // Create the time slider
        this.timeSlider = document.createElement('input');
        this.timeSlider.type = 'range';
        this.timeSlider.min = '0';
        this.timeSlider.max = '24';
        this.timeSlider.step = '0.1';
        this.timeSlider.value = this.time.toString();
        this.timeSlider.style.flex = '1';
        this.timeSlider.style.marginRight = '10px';
        
        // Add event listener to update time when slider changes
        this.timeSlider.addEventListener('input', () => {
            this.time = parseFloat(this.timeSlider!.value);
            this.updateTimeDisplay();
            this.updateScene();
        });
        
        timeSliderContainer.appendChild(this.timeSlider);

        // Create the time display
        this.timeDisplay = document.createElement('div');
        this.timeDisplay.className = 'wilderness-time-display';
        this.timeDisplay.style.minWidth = '60px';
        this.timeDisplay.style.textAlign = 'right';
        timeSliderContainer.appendChild(this.timeDisplay);

        // Create the automatic toggle
        const automaticContainer = document.createElement('div');
        automaticContainer.style.display = 'flex';
        automaticContainer.style.alignItems = 'center';
        automaticContainer.style.marginTop = '5px';
        timeControl.appendChild(automaticContainer);

        // Create the automatic checkbox
        const automaticCheckbox = document.createElement('input');
        automaticCheckbox.type = 'checkbox';
        automaticCheckbox.id = 'wilderness-automatic-toggle';
        automaticCheckbox.checked = this.isAutomatic;
        automaticCheckbox.style.marginRight = '5px';
        
        // Add event listener to toggle automatic cycle
        automaticCheckbox.addEventListener('change', () => {
            this.isAutomatic = automaticCheckbox.checked;
            
            if (this.isAutomatic) {
                this.startAutomaticCycle();
            } else {
                this.stopAutomaticCycle();
            }
            
            // Disable slider when automatic is enabled
            if (this.timeSlider) {
                this.timeSlider.disabled = this.isAutomatic;
            }
        });
        
        automaticContainer.appendChild(automaticCheckbox);

        // Create the automatic label
        const automaticLabel = document.createElement('label');
        automaticLabel.htmlFor = 'wilderness-automatic-toggle';
        automaticLabel.textContent = 'Automatic Cycle';
        automaticContainer.appendChild(automaticLabel);

        // Create the weather control
        const weatherControl = document.createElement('div');
        weatherControl.className = 'wilderness-weather-control';
        weatherControl.style.marginTop = '15px';
        this.dayNightContainer.appendChild(weatherControl);

        // Create the weather label
        const weatherLabel = document.createElement('label');
        weatherLabel.textContent = 'Weather:';
        weatherLabel.style.display = 'block';
        weatherLabel.style.marginBottom = '5px';
        weatherControl.appendChild(weatherLabel);

        // Create the weather select
        this.weatherSelect = document.createElement('select');
        this.weatherSelect.className = 'wilderness-weather-select';
        this.weatherSelect.style.width = '100%';
        this.weatherSelect.style.padding = '5px';
        this.weatherSelect.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        this.weatherSelect.style.color = 'white';
        this.weatherSelect.style.border = '1px solid #4a5568';
        this.weatherSelect.style.borderRadius = '4px';
        
        // Add options for each weather type
        this.weatherOptions.forEach(weather => {
            const option = document.createElement('option');
            option.value = weather;
            option.textContent = weather.charAt(0).toUpperCase() + weather.slice(1);
            this.weatherSelect!.appendChild(option);
        });
        
        // Set the current weather
        this.weatherSelect.value = this.weather;
        
        // Add event listener to update weather when select changes
        this.weatherSelect.addEventListener('change', () => {
            this.weather = this.weatherSelect!.value;
            this.updateScene();
        });
        
        weatherControl.appendChild(this.weatherSelect);

        // Add the day/night section to the content area
        this.contentArea.appendChild(dayNightSection);

        // Update the time display
        this.updateTimeDisplay();
    }

    /**
     * Update the time display
     */
    private updateTimeDisplay(): void {
        if (!this.timeDisplay) return;
        
        // Convert time to hours and minutes
        const hours = Math.floor(this.time);
        const minutes = Math.floor((this.time - hours) * 60);
        
        // Format the time
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        const ampm = hours < 12 ? 'AM' : 'PM';
        
        // Update the display
        this.timeDisplay.textContent = `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
        
        // Update the background color based on time of day
        this.updateBackgroundColor();
    }

    /**
     * Update the background color based on time of day
     */
    private updateBackgroundColor(): void {
        if (!this.dayNightContainer) return;
        
        // Calculate the background color based on time of day
        let backgroundColor = 'rgba(0, 0, 0, 0.2)';
        
        if (this.time >= 6 && this.time < 18) {
            // Daytime - lighter background
            backgroundColor = 'rgba(0, 0, 0, 0.2)';
        } else if (this.time >= 18 && this.time < 20) {
            // Sunset - orange tint
            backgroundColor = 'rgba(50, 20, 0, 0.3)';
        } else if (this.time >= 20 || this.time < 4) {
            // Night - darker background
            backgroundColor = 'rgba(0, 0, 30, 0.4)';
        } else {
            // Sunrise - blue tint
            backgroundColor = 'rgba(20, 30, 50, 0.3)';
        }
        
        // Update the background color
        this.dayNightContainer.style.backgroundColor = backgroundColor;
    }

    /**
     * Start the automatic day/night cycle
     */
    private startAutomaticCycle(): void {
        // Store the current time
        this.lastUpdateTime = Date.now();
        
        // Start the animation loop
        this.animationFrameId = requestAnimationFrame(this.updateAutomaticCycle.bind(this));
        
        console.log("Automatic day/night cycle started");
    }

    /**
     * Stop the automatic day/night cycle
     */
    private stopAutomaticCycle(): void {
        // Cancel the animation frame
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log("Automatic day/night cycle stopped");
    }

    /**
     * Update the automatic day/night cycle
     */
    private updateAutomaticCycle(): void {
        // Calculate the time elapsed since the last update
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // in seconds
        this.lastUpdateTime = currentTime;
        
        // Calculate the time increment
        // Full day/night cycle in dayLength minutes
        const timeIncrement = (24 / (this.dayLength * 60)) * deltaTime;
        
        // Update the time
        this.time = (this.time + timeIncrement) % 24;
        
        // Update the slider
        if (this.timeSlider) {
            this.timeSlider.value = this.time.toString();
        }
        
        // Update the time display
        this.updateTimeDisplay();
        
        // Update the scene
        this.updateScene();
        
        // Continue the animation loop
        this.animationFrameId = requestAnimationFrame(this.updateAutomaticCycle.bind(this));
    }

    /**
     * Update the scene based on time and weather
     */
    private updateScene(): void {
        // Update the scene based on time of day and weather
        // This would typically involve updating the lighting, fog, etc.
        console.log(`Updating scene: time=${this.time}, weather=${this.weather}`);
        
        // Example: Update the scene background color based on time of day
        let backgroundColor = new THREE.Color(0x87CEEB); // Default sky blue
        
        if (this.time >= 6 && this.time < 18) {
            // Daytime
            backgroundColor = new THREE.Color(0x87CEEB); // Sky blue
        } else if (this.time >= 18 && this.time < 20) {
            // Sunset
            backgroundColor = new THREE.Color(0xFF7F50); // Coral
        } else if (this.time >= 20 || this.time < 4) {
            // Night
            backgroundColor = new THREE.Color(0x000033); // Dark blue
        } else {
            // Sunrise
            backgroundColor = new THREE.Color(0xFFA07A); // Light salmon
        }
        
        // Apply weather effects
        switch (this.weather) {
            case 'cloudy':
                // Darken the sky slightly
                backgroundColor.multiplyScalar(0.8);
                break;
            case 'rainy':
                // Darken the sky more and add a blue tint
                backgroundColor.multiplyScalar(0.6);
                backgroundColor.b += 0.1;
                break;
            case 'stormy':
                // Very dark sky
                backgroundColor.multiplyScalar(0.4);
                break;
            case 'foggy':
                // Lighter, grayish sky
                backgroundColor.lerp(new THREE.Color(0xCCCCCC), 0.7);
                break;
            case 'snowy':
                // Lighter sky with a blue tint
                backgroundColor.lerp(new THREE.Color(0xEEEEFF), 0.5);
                break;
        }
        
        // Update the scene background
        this.scene.background = backgroundColor;
    }

    /**
     * Dispose of the day/night system
     */
    public dispose(): void {
        // Stop the automatic cycle
        this.stopAutomaticCycle();
        
        console.log("Day/Night System disposed");
    }
}
