import * as THREE from 'three';
import { getScene } from './core';

// State
let wildernessContainer: HTMLDivElement | null = null;
let isInitialized = false;

// Create wilderness systems container
function createWildernessSystemsContainer(container: HTMLDivElement): HTMLDivElement {
    if (!container) {
        console.error('[WildernessIntegration] ERROR: Container element is undefined in createWildernessSystemsContainer.');
        throw new Error('Container element is required for wilderness systems');
    }

    if (!container.isConnected) {
        console.error('[WildernessIntegration] ERROR: Container element is not attached to the DOM in createWildernessSystemsContainer.');
        throw new Error('Container element must be attached to the DOM');
    }

    // Create container if it doesn't exist
    if (!wildernessContainer) {
        wildernessContainer = document.createElement('div');
        wildernessContainer.style.position = 'absolute';
        wildernessContainer.style.top = '0';
        wildernessContainer.style.left = '0';
        wildernessContainer.style.width = '100%';
        wildernessContainer.style.height = '100%';
        wildernessContainer.style.pointerEvents = 'none';
        wildernessContainer.style.zIndex = '1'; // Ensure it's above the canvas
    }

    // Remove from old parent if exists
    if (wildernessContainer.parentElement) {
        wildernessContainer.parentElement.removeChild(wildernessContainer);
    }

    // Add to new parent container
    container.appendChild(wildernessContainer);
    return wildernessContainer;
}

// Initialize wilderness integration
export function initWildernessIntegration(container: HTMLDivElement) {
    if (!container) {
        console.error('[WildernessIntegration] ERROR: Container element is undefined in initWildernessIntegration.');
        throw new Error('Container element is required.');
    }

    if (!container.isConnected) {
        console.error('[WildernessIntegration] ERROR: Container element is not attached to the DOM in initWildernessIntegration.');
        throw new Error('Container element must be attached to the DOM');
    }

    try {
        // Create wilderness systems container
        createWildernessSystemsContainer(container);

        // Initialize wilderness systems
        const scene = getScene();
        if (!scene) {
            throw new Error('Scene is required for wilderness integration');
        }

        // Add wilderness-specific objects to scene
        const wildernessGroup = new THREE.Group();
        wildernessGroup.name = 'wildernessGroup';
        scene.add(wildernessGroup);

        isInitialized = true;
        console.log('Wilderness integration initialized successfully');
    } catch (error) {
        console.error('Error initializing wilderness integration:', error);
        cleanupWildernessIntegration();
        throw error;
    }
}

// Cleanup wilderness integration
export function cleanupWildernessIntegration() {
    if (!isInitialized) return;

    try {
        // Remove wilderness group from scene
        const scene = getScene();
        if (scene) {
            const wildernessGroup = scene.getObjectByName('wildernessGroup');
            if (wildernessGroup) {
                scene.remove(wildernessGroup);
            }
        }

        // Remove wilderness container
        if (wildernessContainer && wildernessContainer.parentElement) {
            wildernessContainer.parentElement.removeChild(wildernessContainer);
        }
        wildernessContainer = null;

        isInitialized = false;
        console.log('Wilderness integration cleaned up successfully');
    } catch (error) {
        console.error('Error cleaning up wilderness integration:', error);
    }
}

// Getters
export function getWildernessContainer() { return wildernessContainer; }
export function isWildernessInitialized() { return isInitialized; } 