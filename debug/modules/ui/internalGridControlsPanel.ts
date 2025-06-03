import * as THREE from 'three';

// --- Module State ---
let gridControlsPanelContainer: HTMLElement | null = null;
let isGridControlsPanelVisible = false;

// Callback to trigger grid update in isolatedTerrainViewer
let onUpdateRequestInternalGrids: ((settings: InternalGridSettings) => void) | null = null;

// Counter display element
let chunkCountDisplay: HTMLElement | null = null;

export interface InternalGridSettings {
    horizontalChunkRadius: number; // 0 for focused only, 1 for 3x3 area, etc.
    numVerticalLayers: number;
    layerSpacing: number; // Vertical distance between the center of each layer
    cellsPerLayerEdge: number; // e.g., 16 for 16x16 cells per layer
    cellThickness: number; // How thick each cell/tile is
    showInPlayerChunkOnly: boolean; // New: Toggle between player chunk and wider area
}

const defaultGridSettings: InternalGridSettings = {
    horizontalChunkRadius: 0,
    numVerticalLayers: 5,
    layerSpacing: 2.0,
    cellsPerLayerEdge: 16,
    cellThickness: 0.5,
    showInPlayerChunkOnly: true,
};

let currentGridSettings: InternalGridSettings = { ...defaultGridSettings };

// --- Styling and Helper Functions (Adapted from proceduralGenerationPanel.ts) ---
function styleLabel(label: HTMLLabelElement) {
    label.style.display = 'block';
    label.style.marginBottom = '6px';
    label.style.color = '#CBD5E0';
    label.style.fontWeight = '500';
}

function styleInput(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) {
    input.style.width = 'calc(100% - 12px)';
    input.style.padding = '8px 10px';
    input.style.marginBottom = '12px';
    input.style.backgroundColor = '#2D3748';
    input.style.color = '#E2E8F0';
    input.style.border = '1px solid #4A5568';
    input.style.borderRadius = '4px';
    input.style.boxSizing = 'border-box';
    input.style.outline = 'none';
    input.onfocus = () => input.style.borderColor = '#63B3ED';
    input.onblur = () => input.style.borderColor = '#4A5568';
}

function styleNumberInput(input: HTMLInputElement) {
    styleInput(input);
    input.style.width = '80px';
}

function styleButton(button: HTMLButtonElement, primary = false) {
    button.style.padding = primary ? '10px 18px' : '8px 15px';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = '600';
    button.style.transition = 'background-color 0.2s ease';
    if (primary) {
        button.style.backgroundColor = '#4299E1';
        button.style.color = 'white';
    } else {
        button.style.backgroundColor = '#4A5568';
        button.style.color = '#E2E8F0';
    }
    button.onmouseover = () => button.style.backgroundColor = primary ? '#3182CE' : '#2D3748';
    button.onmouseout = () => button.style.backgroundColor = primary ? '#4299E1' : '#4A5568';
    button.style.marginBottom = '8px';
}

function createSectionTitle(text: string): HTMLHeadingElement {
    const h4 = document.createElement('h4');
    h4.textContent = text;
    h4.style.marginTop = '20px';
    h4.style.marginBottom = '12px';
    h4.style.borderBottom = '1px solid #4A5568';
    h4.style.paddingBottom = '8px';
    h4.style.fontSize = '16px';
    h4.style.color = '#A0AEC0';
    return h4;
}

function createInputGroup(parent: HTMLElement, labelText: string, inputElement: HTMLElement) {
    const label = document.createElement('label');
    label.textContent = labelText;
    styleLabel(label);
    parent.appendChild(label);
    parent.appendChild(inputElement);
}

function createStyledNumberInput(parent: HTMLElement, labelText: string, settingKey: keyof InternalGridSettings, min: number, max: number, step: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `grid_setting_${String(settingKey)}`;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(currentGridSettings[settingKey]);
    styleNumberInput(input);
    input.onchange = (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(val)) {
            (currentGridSettings[settingKey] as number) = Math.max(min, Math.min(max, val));
            input.value = String(currentGridSettings[settingKey]); // Update input if value was clamped
            if (onUpdateRequestInternalGrids) {
                onUpdateRequestInternalGrids(currentGridSettings);
            }
        }
    };
    createInputGroup(parent, labelText, input);
    return input;
}

function createStyledCheckbox(parent: HTMLElement, labelText: string, settingKey: keyof InternalGridSettings): HTMLInputElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.marginBottom = '12px';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `grid_setting_${String(settingKey)}`;
    input.checked = currentGridSettings[settingKey] as boolean;
    input.style.marginRight = '8px';
    input.style.accentColor = '#63B3ED'; // Modern accent for checkbox
    
    input.onchange = (e) => {
        (currentGridSettings[settingKey] as boolean) = (e.target as HTMLInputElement).checked;
        if (onUpdateRequestInternalGrids) {
            onUpdateRequestInternalGrids(currentGridSettings);
        }
    };

    const label = document.createElement('label');
    label.textContent = labelText;
    label.htmlFor = input.id;
    label.style.color = '#CBD5E0';
    label.style.fontWeight = 'normal'; // Normal weight for checkbox label
    label.style.cursor = 'pointer';

    container.appendChild(input);
    container.appendChild(label);
    parent.appendChild(container);
    return input;
}

// Function to create and style the chunk counter display
function createChunkCountDisplay(parent: HTMLElement): HTMLElement {
    const counterContainer = document.createElement('div');
    counterContainer.style.backgroundColor = '#1E293B';
    counterContainer.style.border = '1px solid #4A5568';
    counterContainer.style.borderRadius = '6px';
    counterContainer.style.padding = '12px 16px';
    counterContainer.style.marginTop = '15px';
    counterContainer.style.marginBottom = '20px';
    counterContainer.style.textAlign = 'center';
    
    const countLabel = document.createElement('div');
    countLabel.textContent = 'Chunks with Internal Grid:';
    countLabel.style.fontSize = '14px';
    countLabel.style.color = '#A0AEC0';
    countLabel.style.marginBottom = '8px';
    
    const countValue = document.createElement('div');
    countValue.id = 'internal-grid-chunk-count';
    countValue.textContent = 'Calculating...';
    countValue.style.fontSize = '24px';
    countValue.style.fontWeight = 'bold';
    countValue.style.color = '#63B3ED';
    
    counterContainer.appendChild(countLabel);
    counterContainer.appendChild(countValue);
    parent.appendChild(counterContainer);
    
    return countValue;
}

// --- Main Panel Creation ---
export function createInternalGridControlsPanel(requestGridUpdateCallback: (settings: InternalGridSettings) => void): HTMLElement {
    onUpdateRequestInternalGrids = requestGridUpdateCallback;

    gridControlsPanelContainer = document.createElement('div');
    gridControlsPanelContainer.id = 'internal-grid-controls-panel';
    // Styling (similar to proceduralGenerationPanel.ts)
    gridControlsPanelContainer.style.position = 'absolute';
    gridControlsPanelContainer.style.top = '70px';
    gridControlsPanelContainer.style.right = '20px';
    gridControlsPanelContainer.style.width = '320px';
    gridControlsPanelContainer.style.maxHeight = 'calc(100vh - 90px)';
    gridControlsPanelContainer.style.backgroundColor = 'rgba(30, 41, 59, 0.97)'; // Darker, more opaque
    gridControlsPanelContainer.style.border = '1px solid #4A5568';
    gridControlsPanelContainer.style.borderRadius = '8px';
    gridControlsPanelContainer.style.padding = '20px';
    gridControlsPanelContainer.style.color = '#E2E8F0'; // Light text
    gridControlsPanelContainer.style.fontFamily = '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    gridControlsPanelContainer.style.zIndex = '20001'; // Ensure it's above isolated editor overlay
    gridControlsPanelContainer.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    gridControlsPanelContainer.style.overflowY = 'auto';
    gridControlsPanelContainer.style.display = isGridControlsPanelVisible ? 'block' : 'none';
    gridControlsPanelContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    gridControlsPanelContainer.style.opacity = isGridControlsPanelVisible ? '1' : '0';
    gridControlsPanelContainer.style.transform = isGridControlsPanelVisible ? 'translateY(0)' : 'translateY(10px)';

    const title = document.createElement('h3');
    title.textContent = 'Internal Grid Controls';
    title.style.color = '#A0AEC0';
    title.style.borderBottom = '1px solid #4A5568';
    title.style.paddingBottom = '10px';
    title.style.marginBottom = '20px';
    title.style.fontSize = '18px';
    gridControlsPanelContainer.appendChild(title);

    // Add chunk counter display at the top
    chunkCountDisplay = createChunkCountDisplay(gridControlsPanelContainer);

    // --- Controls ---
    createStyledCheckbox(gridControlsPanelContainer, 'Show Player Chunk Only', 'showInPlayerChunkOnly');
    createStyledNumberInput(gridControlsPanelContainer, 'Horizontal Chunk Radius (if not player only):', 'horizontalChunkRadius', 0, 5, 1);
    createStyledNumberInput(gridControlsPanelContainer, 'Number of Vertical Layers:', 'numVerticalLayers', 1, 10, 1);
    createStyledNumberInput(gridControlsPanelContainer, 'Layer Spacing (Y units):', 'layerSpacing', 0.5, 10, 0.1);
    createStyledNumberInput(gridControlsPanelContainer, 'Cells Per Layer Edge (Resolution):', 'cellsPerLayerEdge', 4, 32, 1);
    createStyledNumberInput(gridControlsPanelContainer, 'Cell Thickness (Y units):', 'cellThickness', 0.1, 5, 0.1);
    
    // Close button
    const closeButton = document.createElement('button');
    styleButton(closeButton, false);
    closeButton.textContent = 'Close';
    closeButton.style.marginTop = '20px';
    closeButton.onclick = () => toggleInternalGridControlsPanel(false);
    gridControlsPanelContainer.appendChild(closeButton);
    
    document.body.appendChild(gridControlsPanelContainer); // Append to body for global positioning
    return gridControlsPanelContainer;
}

// --- Panel Visibility and Settings ---
export function toggleInternalGridControlsPanel(visible?: boolean): void {
    isGridControlsPanelVisible = visible !== undefined ? visible : !isGridControlsPanelVisible;
    if (gridControlsPanelContainer) {
        gridControlsPanelContainer.style.display = isGridControlsPanelVisible ? 'block' : 'none';
        // Animate panel in/out
        requestAnimationFrame(() => {
            if (gridControlsPanelContainer) {
                 gridControlsPanelContainer.style.opacity = isGridControlsPanelVisible ? '1' : '0';
                 gridControlsPanelContainer.style.transform = isGridControlsPanelVisible ? 'translateY(0)' : 'translateY(10px)';
            }
        });
    }
    // If opening the panel, and no grids are visible, trigger an update based on current/default settings
    // This provides immediate feedback if the user opens the panel while main grid toggle is off.
    if (isGridControlsPanelVisible && onUpdateRequestInternalGrids) {
        // Check a global flag from isolatedTerrainViewer if internal grids are ACTUALLY on.
        // This requires isolatedTerrainViewer to export such a flag or function.
        // For now, let's assume if panel is open, user intends to see grids with these settings.
        onUpdateRequestInternalGrids(currentGridSettings); 
    }
}

export function getInternalGridSettings(): InternalGridSettings {
    return { ...currentGridSettings };
}

export function updateInternalGridSettings(newSettings: Partial<InternalGridSettings>): void {
    currentGridSettings = { ...currentGridSettings, ...newSettings };
    if (isGridControlsPanelVisible && onUpdateRequestInternalGrids) { // Update if panel is visible
        onUpdateRequestInternalGrids(currentGridSettings);
    }
}

export function setInternalGridUpdateCallback(callback: (settings: InternalGridSettings) => void): void {
    onUpdateRequestInternalGrids = callback;
}

// --- New function to update the chunk counter display ---
export function updateChunkCountDisplay(count: number): void {
    if (chunkCountDisplay) {
        chunkCountDisplay.textContent = count.toString();
        
        // Change color based on count for visual feedback
        if (count === 0) {
            chunkCountDisplay.style.color = '#F56565'; // Red for zero
        } else if (count > 10) {
            chunkCountDisplay.style.color = '#F6AD55'; // Orange for high values
        } else {
            chunkCountDisplay.style.color = '#63B3ED'; // Blue for normal values
        }
    }
}

export function cleanupInternalGridControlsPanel(): void {
    if (gridControlsPanelContainer && gridControlsPanelContainer.parentElement) {
        gridControlsPanelContainer.parentElement.removeChild(gridControlsPanelContainer);
    }
    gridControlsPanelContainer = null;
    chunkCountDisplay = null;
    isGridControlsPanelVisible = false;
    onUpdateRequestInternalGrids = null;
    currentGridSettings = { ...defaultGridSettings }; // Reset to defaults
} 