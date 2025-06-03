/**
 * Mining Panel State
 * This module tracks the state of the mining panel to coordinate UI elements
 */

// Global state for mining panel
const miningPanelState = {
    isActive: false,
    panelElement: null,
    panelRect: null
};

/**
 * Set the mining panel as active and store its element reference
 * @param {HTMLElement} panelElement - The mining panel element
 */
export function activateMiningPanel(panelElement) {
    miningPanelState.isActive = true;
    miningPanelState.panelElement = panelElement;
    
    // Calculate and store the panel's position and dimensions
    if (panelElement) {
        miningPanelState.panelRect = panelElement.getBoundingClientRect();
    }
    
    console.log("[MiningPanelState] Mining panel activated");
}

/**
 * Deactivate the mining panel
 */
export function deactivateMiningPanel() {
    miningPanelState.isActive = false;
    miningPanelState.panelElement = null;
    miningPanelState.panelRect = null;
    console.log("[MiningPanelState] Mining panel deactivated");
}

/**
 * Check if the mining panel is currently active
 * @returns {boolean} True if the mining panel is active
 */
export function isMiningPanelActive() {
    return miningPanelState.isActive;
}

/**
 * Get the mining panel element
 * @returns {HTMLElement|null} The mining panel element or null if not active
 */
export function getMiningPanelElement() {
    return miningPanelState.panelElement;
}

/**
 * Get the mining panel's bounding rectangle
 * @returns {DOMRect|null} The mining panel's bounding rectangle or null if not active
 */
export function getMiningPanelRect() {
    // Update the rect if the panel is active
    if (miningPanelState.isActive && miningPanelState.panelElement) {
        miningPanelState.panelRect = miningPanelState.panelElement.getBoundingClientRect();
    }
    return miningPanelState.panelRect;
}

/**
 * Position an element in front of the mining panel
 * @param {HTMLElement} element - The element to position
 */
export function positionInFrontOfMiningPanel(element) {
    if (!miningPanelState.isActive || !element) {
        // If mining panel is not active, don't change position
        return false;
    }
    
    const rect = getMiningPanelRect();
    if (!rect) return false;
    
    // Position the element in front of the mining panel
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('top', `${rect.top + 20}px`, 'important');
    element.style.setProperty('left', `${rect.left + 20}px`, 'important');
    element.style.setProperty('z-index', '99999999', 'important');
    
    return true;
}

// Export the mining panel state interface
export const miningPanelStateManager = {
    activate: activateMiningPanel,
    deactivate: deactivateMiningPanel,
    isActive: isMiningPanelActive,
    getElement: getMiningPanelElement,
    getRect: getMiningPanelRect,
    positionInFront: positionInFrontOfMiningPanel
};

// Make the interface available globally
if (typeof window !== 'undefined') {
    window.miningPanelStateManager = miningPanelStateManager;
}
