import * as THREE from 'three';
// Import the new UI function
import { showPlanetSelectionUI } from '../debug/planetSelectorUI'; 

// Store button references
let exploreButton: HTMLElement | null = null;
let debugButton: HTMLElement | null = null;
let debugShadersButton: HTMLElement | null = null;

/**
 * Creates all welcome screen buttons and adds them to the DOM.
 * @param startGameCallback Function to call when the 'Explore Infinia' button is clicked.
 * @returns An object containing references to the created buttons.
 */
export function createWelcomeButtons(startGameCallback: () => Promise<void>): { explore: HTMLElement, debug: HTMLElement, debugShaders: HTMLElement } {
    // --- Button Container ---
    const buttonContainer = document.createElement('div');
    buttonContainer.style.position = 'absolute';
    buttonContainer.style.bottom = '10%';
    buttonContainer.style.left = '50%';
    buttonContainer.style.transform = 'translateX(-50%)';
    buttonContainer.style.zIndex = '20';
    buttonContainer.style.display = 'flex'; // Use flexbox for layout
    buttonContainer.style.gap = '20px'; // Space between buttons
    document.body.appendChild(buttonContainer);

    // --- Base Button Styling Function ---
    function styleButton(button: HTMLElement, text: string, bgColor: string, hoverBgColor: string) {
        button.textContent = text;
        button.style.padding = '15px 40px';
        button.style.fontSize = '1.5em';
        button.style.fontWeight = 'bold';
        button.style.letterSpacing = '1px';
        button.style.backgroundColor = bgColor;
        button.style.color = 'white';
        button.style.border = '2px solid rgba(255, 255, 255, 0.7)';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.transition = 'all 0.3s ease';
        button.style.boxShadow = `0 0 20px ${bgColor.replace('rgb', 'rgba').replace(')', ', 0.6)')}`;
        button.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.8)';

        button.onmouseover = () => {
            button.style.backgroundColor = hoverBgColor;
            button.style.boxShadow = `0 0 30px ${hoverBgColor.replace('rgb', 'rgba').replace(')', ', 0.8)')}`;
            button.style.transform = 'scale(1.05)'; // Apply scale directly
        };
        button.onmouseout = () => {
            button.style.backgroundColor = bgColor;
            button.style.boxShadow = `0 0 20px ${bgColor.replace('rgb', 'rgba').replace(')', ', 0.6)')}`;
            button.style.transform = 'scale(1)'; // Apply scale directly
        };
    }

    // --- Create "Debug Mode" Button ---
    debugButton = document.createElement('button');
    debugButton.id = 'debugButton';
    styleButton(debugButton, 'Debug Mode', 'rgba(200, 50, 50, 0.7)', 'rgba(230, 80, 80, 0.9)'); // Reddish
    debugButton.addEventListener('click', () => {
        console.log("🚀 Requesting Debug Mode...");
        removeWelcomeButtons(); // Remove welcome UI
        showPlanetSelectionUI(); // Show the new selection screen
    });
    buttonContainer.appendChild(debugButton);

    // --- Create "Explore Infinia" Button ---
    exploreButton = document.createElement('button');
    exploreButton.id = 'exploreButton'; // Changed from startButton
    styleButton(exploreButton, 'Explore Infinia', 'rgba(0, 110, 255, 0.7)', 'rgba(0, 150, 255, 0.9)'); // Bluish
    exploreButton.addEventListener('click', () => {
        startGameCallback().catch(err => {
            console.error("Error starting game from button:", err);
        });
    });
    buttonContainer.appendChild(exploreButton);

    // --- Create "Debug Shaders" Button ---
    debugShadersButton = document.createElement('button');
    debugShadersButton.id = 'debugShadersButton';
    debugShadersButton.textContent = 'Debug Shaders';
    // Specific styling for this smaller button
    debugShadersButton.style.position = 'absolute';
    debugShadersButton.style.bottom = '15px';
    debugShadersButton.style.right = '15px';
    debugShadersButton.style.padding = '8px 15px';
    debugShadersButton.style.fontSize = '0.9em';
    debugShadersButton.style.backgroundColor = 'rgba(100, 100, 100, 0.6)';
    debugShadersButton.style.color = 'white';
    debugShadersButton.style.border = '1px solid rgba(255, 255, 255, 0.5)';
    debugShadersButton.style.borderRadius = '4px';
    debugShadersButton.style.cursor = 'pointer';
    debugShadersButton.style.transition = 'all 0.3s ease';
    debugShadersButton.style.zIndex = '20';

    debugShadersButton.onmouseover = () => {
        if (!debugShadersButton) return; // Linter check
        debugShadersButton.style.backgroundColor = 'rgba(130, 130, 130, 0.8)';
        debugShadersButton.style.borderColor = 'rgba(255, 255, 255, 0.8)';
    };
    debugShadersButton.onmouseout = () => {
        if (!debugShadersButton) return; // Linter check
        debugShadersButton.style.backgroundColor = 'rgba(100, 100, 100, 0.6)';
        debugShadersButton.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    };

    debugShadersButton.addEventListener('click', () => {
        console.log("Debug Shaders button clicked!");
        // Add logic to toggle shader debug UI or info
    });
    document.body.appendChild(debugShadersButton);

    return { explore: exploreButton, debug: debugButton, debugShaders: debugShadersButton };
}

/**
 * Removes all created welcome buttons from the DOM.
 */
export function removeWelcomeButtons(): void {
    if (exploreButton && exploreButton.parentNode) {
        exploreButton.parentNode.removeChild(exploreButton);
        exploreButton = null;
    }
    if (debugButton && debugButton.parentNode) {
        // If it's in the container, the container removal handles it.
        // If it was added directly to body, uncomment below:
        // debugButton.parentNode.removeChild(debugButton);
        debugButton = null;
    }
    // Remove container for the main two buttons
    const container = document.getElementById('startButton')?.parentNode; // Assuming exploreButton was the old startButton
    if (container && container.parentNode && container !== document.body) { // Check it's the flex container
        container.parentNode.removeChild(container);
    }

    if (debugShadersButton && debugShadersButton.parentNode) {
        debugShadersButton.parentNode.removeChild(debugShadersButton);
        debugShadersButton = null;
    }
} 