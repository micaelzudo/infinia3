import * as THREE from 'three';
import { MarchingCubes } from '../marching-cubes'; // Adjust path as needed

// Type for the callback to start the game
type StartGameCallback = () => Promise<void>;
// Type for the callback to toggle first person mode
type ToggleFirstPersonCallback = (enable: boolean) => void;

/**
 * Creates the "Explore Infinia" button and adds it to the DOM.
 * @param startGameCallback Function to call when the button is clicked.
 * @returns The created button element.
 */
export function createStartButton(startGameCallback: StartGameCallback): HTMLElement {
    const startButton = document.createElement('button');
    startButton.id = 'startButton';
    startButton.textContent = 'Explore Infinia';
    // Styling
    startButton.style.position = 'absolute';
    startButton.style.bottom = '10%';
    startButton.style.left = '50%';
    startButton.style.transform = 'translateX(-50%)';
    startButton.style.padding = '15px 30px';
    startButton.style.fontSize = '1.5em';
    startButton.style.backgroundColor = 'rgba(0, 120, 255, 0.7)';
    startButton.style.color = 'white';
    startButton.style.border = '2px solid rgba(255, 255, 255, 0.8)';
    startButton.style.borderRadius = '8px';
    startButton.style.cursor = 'pointer';
    startButton.style.transition = 'background-color 0.3s ease';
    startButton.style.zIndex = '20';
    startButton.onmouseover = () => startButton.style.backgroundColor = 'rgba(0, 150, 255, 0.9)';
    startButton.onmouseout = () => startButton.style.backgroundColor = 'rgba(0, 120, 255, 0.7)';

    startButton.addEventListener('click', () => {
        startGameCallback().catch(err => {
            console.error("Error starting game from button:", err);
        });
    });
    document.body.appendChild(startButton);
    return startButton;
}

/**
 * Creates the in-game UI controls panel.
 * @param marchingCubesInstance Instance of the MarchingCubes class.
 * @param toggleFirstPersonModeCallback Function to toggle first person mode.
 * @param updateInstructionsCallback Function to update the instruction text.
 */
export function createUIControls(
    marchingCubesInstance: MarchingCubes,
    toggleFirstPersonModeCallback: ToggleFirstPersonCallback,
    updateInstructionsCallback: (isFirstPerson: boolean) => void // Assuming updateInstructions is imported/passed
) {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'controlsContainer';
    controlsContainer.style.position = 'absolute';
    controlsContainer.style.top = '10px';
    controlsContainer.style.left = '10px';
    controlsContainer.style.padding = '10px';
    controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    controlsContainer.style.color = 'white';
    controlsContainer.style.fontFamily = 'Arial, sans-serif';
    controlsContainer.style.borderRadius = '5px';
    controlsContainer.style.zIndex = '10';
    document.body.appendChild(controlsContainer);

    // Add Title
    const titleElement = document.createElement('h2');
    titleElement.textContent = 'Infinia';
    titleElement.style.marginTop = '0';
    titleElement.style.marginBottom = '10px';
    titleElement.style.borderBottom = '1px solid white';
    titleElement.style.paddingBottom = '5px';
    controlsContainer.appendChild(titleElement);

    // Wireframe toggle
    const wireframeLabel = document.createElement('label');
    const wireframeCheckbox = document.createElement('input');
    wireframeCheckbox.type = 'checkbox';
    wireframeCheckbox.checked = false;
    wireframeCheckbox.id = 'wireframeCheckbox';
    wireframeCheckbox.addEventListener('change', () => {
        marchingCubesInstance.toggleWireframe(wireframeCheckbox.checked);
    });
    wireframeLabel.appendChild(wireframeCheckbox);
    wireframeLabel.appendChild(document.createTextNode(' Wireframe'));
    controlsContainer.appendChild(wireframeLabel);
    controlsContainer.appendChild(document.createElement('br'));

    // Interpolation toggle
    const interpolationLabel = document.createElement('label');
    const interpolationCheckbox = document.createElement('input');
    interpolationCheckbox.type = 'checkbox';
    interpolationCheckbox.checked = true;
    interpolationCheckbox.id = 'interpolationCheckbox';
    interpolationCheckbox.addEventListener('change', () => {
        marchingCubesInstance.toggleInterpolation(interpolationCheckbox.checked);
    });
    interpolationLabel.appendChild(interpolationCheckbox);
    interpolationLabel.appendChild(document.createTextNode(' Interpolation'));
    controlsContainer.appendChild(interpolationLabel);
    controlsContainer.appendChild(document.createElement('br'));

    // Noise frequency sliders
    const sliders: HTMLInputElement[] = [];
    ['Large', 'Medium', 'Small'].forEach((size, index) => {
        const sliderLabel = document.createElement('label');
        sliderLabel.textContent = `${size} Detail: `;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '5';
        slider.max = '100';
        slider.value = index === 0 ? '50' : index === 1 ? '25' : '10';
        slider.id = `noiseSlider${index}`;
        sliders.push(slider);
        slider.addEventListener('input', () => {
            const layers = [
                parseInt(sliders[0].value),
                parseInt(sliders[1].value),
                parseInt(sliders[2].value)
            ] as [number, number, number];
            marchingCubesInstance.setNoiseLayers(layers);
        });
        sliderLabel.appendChild(slider);
        controlsContainer.appendChild(sliderLabel);
        controlsContainer.appendChild(document.createElement('br'));
    });

    // Random seed button
    const randomSeedBtn = document.createElement('button');
    randomSeedBtn.textContent = 'Random Seed';
    randomSeedBtn.id = 'randomSeedBtn';
    randomSeedBtn.style.marginTop = '10px';
    randomSeedBtn.addEventListener('click', () => {
        marchingCubesInstance.randomizeSeed();
    });
    controlsContainer.appendChild(randomSeedBtn);

    // First person toggle button
    const firstPersonBtn = document.createElement('button');
    firstPersonBtn.id = 'firstPersonBtn';
    firstPersonBtn.textContent = 'Enter First Person';
    firstPersonBtn.style.marginTop = '10px';
    firstPersonBtn.style.marginLeft = '10px';
    firstPersonBtn.addEventListener('click', () => {
        // Determine the *next* state when toggling
        const currentState = firstPersonBtn.textContent === 'Exit First Person';
        toggleFirstPersonModeCallback(!currentState);
    });
    controlsContainer.appendChild(firstPersonBtn);

    // Instructions
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.marginTop = '15px';
    instructions.style.fontSize = '12px';
    controlsContainer.appendChild(instructions);
    updateInstructionsCallback(false); // Initialize instructions for orbit mode
}

/**
 * Creates toggle buttons for all shader effects on the tunnel
 * @param tunnelMesh The tunnel mesh with shader material
 */
export function createShaderEffectControls(tunnelMesh: THREE.Mesh): HTMLElement {
    // Create a container for shader effect controls
    const effectsContainer = document.createElement('div');
    effectsContainer.id = 'shaderEffectsContainer';
    effectsContainer.style.position = 'absolute';
    effectsContainer.style.top = '10px';
    effectsContainer.style.right = '10px';
    effectsContainer.style.padding = '10px';
    effectsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    effectsContainer.style.color = 'white';
    effectsContainer.style.fontFamily = 'Arial, sans-serif';
    effectsContainer.style.borderRadius = '5px';
    effectsContainer.style.zIndex = '10';
    effectsContainer.style.maxHeight = '80vh';
    effectsContainer.style.overflowY = 'auto';
    effectsContainer.style.display = 'none'; // <<< Hide by default
    document.body.appendChild(effectsContainer);

    // Add Title
    const titleElement = document.createElement('h2');
    titleElement.textContent = 'Tunnel Effects';
    titleElement.style.marginTop = '0';
    titleElement.style.marginBottom = '10px';
    titleElement.style.borderBottom = '1px solid white';
    titleElement.style.paddingBottom = '5px';
    effectsContainer.appendChild(titleElement);

    // Define all available shader effects
    const shaderEffects = [
        { name: 'Base Tunnel', uniform: 'uNebulaIntensity', defaultValue: 1.5 },
        { name: 'Hyperspace', uniform: 'uHyperspaceIntensity', defaultValue: 1.2 },
        { name: 'Dimensional Rift', uniform: 'uDimensionalRiftIntensity', defaultValue: 0.8 },
        { name: 'Quantum Effect', uniform: 'uQuantumEffectStrength', defaultValue: 1.5 },
        { name: 'Ethereal Glow', uniform: 'uGlowIntensity', defaultValue: 1.4 },
        { name: 'Time Warp', uniform: 'uTimeWarpIntensity', defaultValue: 1.0 },
        { name: 'Holographic Glitch', uniform: 'uHolographicGlitchIntensity', defaultValue: 0.8 },
        { name: 'Particle Flux', uniform: 'uParticleFluxIntensity', defaultValue: 1.2 },
        { name: 'Energy Field', uniform: 'uEnergyFieldIntensity', defaultValue: 1.0 },
        { name: 'Wormhole', uniform: 'uWormholeIntensity', defaultValue: 0.8 },
        { name: 'Quantum Entanglement', uniform: 'uQuantumEntanglementIntensity', defaultValue: 1.0 }
    ];

    // Create toggle switch for each effect
    shaderEffects.forEach(effect => {
        const effectContainer = document.createElement('div');
        effectContainer.style.display = 'flex';
        effectContainer.style.justifyContent = 'space-between';
        effectContainer.style.alignItems = 'center';
        effectContainer.style.marginBottom = '8px';
        
        // Label with effect name
        const label = document.createElement('span');
        label.textContent = effect.name;
        label.style.fontWeight = 'bold';
        
        // Toggle switch
        const toggleSwitch = document.createElement('label');
        toggleSwitch.className = 'switch';
        toggleSwitch.style.position = 'relative';
        toggleSwitch.style.display = 'inline-block';
        toggleSwitch.style.width = '45px';
        toggleSwitch.style.height = '22px';
        toggleSwitch.style.marginLeft = '10px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        // Start ALL effects ON
        checkbox.checked = true; 
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        slider.style.position = 'absolute';
        slider.style.cursor = 'pointer';
        slider.style.top = '0';
        slider.style.left = '0';
        slider.style.right = '0';
        slider.style.bottom = '0';
        slider.style.backgroundColor = '#ccc';
        slider.style.transition = '.4s';
        slider.style.borderRadius = '34px';
        
        // Create the circle on the slider
        slider.innerHTML = `<span style="position: absolute; height: 18px; width: 18px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%;"></span>`;
        
        // Initialize shader uniform state tracking
        if (tunnelMesh && tunnelMesh.material instanceof THREE.ShaderMaterial) {
            // Store the intended original value (or default)
            const uniformObject = tunnelMesh.material.uniforms[effect.uniform];
            const currentUniformValue = uniformObject?.value;
            const intendedOriginalValue = currentUniformValue !== undefined ? currentUniformValue : effect.defaultValue;
            
            console.log(`[UI Init - ${effect.name}] Reading initial uniform: '${effect.uniform}'. Current Value: ${currentUniformValue}, Default Fallback: ${effect.defaultValue}. Storing Original: ${intendedOriginalValue}`);
            
            tunnelMesh.userData[`${effect.uniform}_original`] = intendedOriginalValue;
            
            // Ensure the actual uniform has the intended ON value if it somehow didn't initialize correctly
            // (This is a safety check)
            if (uniformObject && uniformObject.value !== intendedOriginalValue && intendedOriginalValue !== 0) {
                 console.warn(`[UI Init - ${effect.name}] Mismatch detected! Forcing uniform to stored original: ${intendedOriginalValue}`);
                 uniformObject.value = intendedOriginalValue;
            }
        }
        
        // Style for when checked/unchecked
        checkbox.addEventListener('change', function() {
            if (this.checked) { // When toggled ON
                slider.style.backgroundColor = '#2196F3';
                const sliderCircle = slider.querySelector('span');
                if (sliderCircle) {
                    sliderCircle.style.transform = 'translateX(23px)';
                }
                
                // Enable effect: Restore original value
                if (tunnelMesh && tunnelMesh.material instanceof THREE.ShaderMaterial) {
                    const storedOriginal = tunnelMesh.userData[`${effect.uniform}_original`];
                    const originalValue = storedOriginal !== undefined ? storedOriginal : effect.defaultValue;
                    const valueToRestore = (originalValue === 0 || originalValue === undefined) ? effect.defaultValue : originalValue;
                    
                    tunnelMesh.material.uniforms[effect.uniform].value = valueToRestore;
                    console.log(`%cTurned ON ${effect.name} (${effect.uniform}) = ${valueToRestore}. (Stored Original: ${storedOriginal}, Default: ${effect.defaultValue})`, 'color: lightgreen; font-weight: bold;');
                }
            } else { // When toggled OFF
                slider.style.backgroundColor = '#ccc';
                const sliderCircle = slider.querySelector('span');
                if (sliderCircle) {
                    sliderCircle.style.transform = 'translateX(0)';
                }
                
                // Disable effect: Set value to 0
                if (tunnelMesh && tunnelMesh.material instanceof THREE.ShaderMaterial) {
                    tunnelMesh.material.uniforms[effect.uniform].value = 0.0;
                    console.log(`%cTurned OFF ${effect.name} (${effect.uniform})`, 'color: red; font-weight: bold;');
                }
            }
        });
        
        // Initialize slider visual state to ON
        slider.style.backgroundColor = '#2196F3';
        const initialSliderCircle = slider.querySelector('span');
        if (initialSliderCircle) {
            initialSliderCircle.style.transform = 'translateX(23px)';
        }
        
        toggleSwitch.appendChild(checkbox);
        toggleSwitch.appendChild(slider);
        
        effectContainer.appendChild(label);
        effectContainer.appendChild(toggleSwitch);
        effectsContainer.appendChild(effectContainer);
    });
    
    // Reset all button (now resets to ON)
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset All Effects'; // Changed text back
    resetButton.style.marginTop = '10px';
    resetButton.style.padding = '5px 10px';
    resetButton.style.backgroundColor = '#f44336';
    resetButton.style.color = 'white';
    resetButton.style.border = 'none';
    resetButton.style.borderRadius = '4px';
    resetButton.style.cursor = 'pointer';
    resetButton.style.width = '100%';
    resetButton.style.fontWeight = 'bold';
    
    resetButton.addEventListener('click', () => {
        const checkboxes = effectsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((element) => {
            const checkbox = element as HTMLInputElement;
            if (!checkbox.checked) { // If it's currently OFF
                checkbox.checked = true; // Turn it ON
                const event = new Event('change');
                checkbox.dispatchEvent(event);
            }
        });
        console.log("All shader effects reset to ON state");
    });
    
    effectsContainer.appendChild(resetButton);
    
    // Add visual effect info
    const infoText = document.createElement('div');
    infoText.style.fontSize = '12px';
    infoText.style.marginTop = '10px';
    infoText.style.color = '#aaa';
    infoText.textContent = 'Toggle effects on/off to see dramatic visual changes in the tunnel.';
    effectsContainer.appendChild(infoText);
    
    return effectsContainer;
} 