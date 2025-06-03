import * as THREE from 'three';
// Change import to the new theoretical visualizer
import { addTheoreticalChunkBoundaries, removeTheoreticalChunkBoundaries } from './theoreticalBoundaryVisualizer';
import { generateAlternatingTerrain, disposeAlternatingTerrain, AlternatingTerrainParams } from '../world/alternatingElevationTerrainGenerator'; // Added import
import type { NoiseLayers, Seed } from '../../types_debug'; // For NoiseLayers type
import { focusOrbitCameraOn } from './isolatedTerrainViewer'; // <<< IMPORT NEW FUNCTION
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug'; // <<< IMPORT CONSTANTS

// TODO: Import necessary types, constants, or utilities from other modules

// --- Module State ---
let procGenPanelContainer: HTMLElement | null = null;
let isPanelVisible = false;
let sceneRef: THREE.Scene | null = null; // To store the scene reference
let theoreticalChunkKeys: string[] = []; // To store keys of visualized theoretical chunks
let isTheoreticalBoundariesActive = false; // <<< NEW STATE for button toggle
let lastGeneratedAlternatingGroup: THREE.Group | null = null; // To store the group for disposal
let theoreticalRangeInfoElement: HTMLElement | null = null; // Moved near other state vars

// Callback to notify isolatedTerrainViewer to update its visuals
let onRequestUpdateBoundaryVisuals: ((settings: ProceduralGenerationSettings) => void) | null = null;

// --- Exported functions to interact with this state ---
export function getIsTheoreticalBoundariesActive(): boolean {
    return isTheoreticalBoundariesActive;
}

export function setRequestUpdateBoundaryVisualsCallback(callback: (settings: ProceduralGenerationSettings) => void) {
    onRequestUpdateBoundaryVisuals = callback;
}
// --- End Exported functions ---

// Example: Store settings for procedural generation
export interface ProceduralGenerationSettings {
    seed: number;
    // scale: number; // Removed for now, can be part of NoiseLayers
    // octaves: number;
    // persistence: number;
    // lacunarity: number;
    visCenterX: number;
    visCenterY: number;
    visCenterZ: number;
    visHorizontalExtent: number;
    visVerticalExtent: number;
    useAlternatingLogicForTheoreticalViz: boolean; // New setting
    theoreticalVizAdjacentToTrue: boolean; // <<< NEW SETTING for adjacent-only mode

    // Alternating Terrain Settings
    altStartX: number;
    altStartZ: number;
    altStripDirection: 'z' | 'x'; // New: 'z' or 'x'
    altInitialYLevel: 'low' | 'high'; // New: 'low' or 'high'
    altLengthZ: number; // Note: consider renaming or making more generic if direction can be X
    altLowYLevel: number;
    altHighYLevel: number;
    altNoiseLayersLowJSON: string;
    altNoiseLayersHighJSON: string;
    altInterpolate: boolean;
}

const defaultLowNoiseJSON = JSON.stringify([{
    noiseType: 'simplex', scale: {x:150, y:30, z:150}, octaves: 3, persistence: 0.4, lacunarity: 2.2,
    exponent: 1.0, ridgeThreshold: 0.0, heightModifier: { type: 'none', value: 20 }, offset: {x:0,y:0,z:0}
}], null, 2);

const defaultHighNoiseJSON = JSON.stringify([{
    noiseType: 'simplex', scale: {x:120, y:80, z:120}, octaves: 5, persistence: 0.5, lacunarity: 2.0,
    exponent: 1.5, ridgeThreshold: 0.55, heightModifier: { type: 'none', value: 60 }, offset: {x:1000,y:0,z:0}
}], null, 2);

let currentSettings: ProceduralGenerationSettings = {
    seed: 0,
    visCenterX: 0,
    visCenterY: 0,
    visCenterZ: 0,
    visHorizontalExtent: 1,
    visVerticalExtent: 1,
    useAlternatingLogicForTheoreticalViz: false, // Default to false
    theoreticalVizAdjacentToTrue: false, // <<< Default to false for new setting
    altStartX: 0,
    altStartZ: 0,
    altStripDirection: 'z', // Default direction
    altInitialYLevel: 'low', // Default initial level
    altLengthZ: 5,
    altLowYLevel: 0,
    altHighYLevel: 1,
    altNoiseLayersLowJSON: defaultLowNoiseJSON,
    altNoiseLayersHighJSON: defaultHighNoiseJSON,
    altInterpolate: false,
};

// --- Helper function for theoretical range display ---
function updateTheoreticalRangeInfo() {
    if (!theoreticalRangeInfoElement) return;

    const { 
        visCenterX, visCenterY, visCenterZ, visHorizontalExtent, visVerticalExtent, 
        useAlternatingLogicForTheoreticalViz,
        altLowYLevel, altHighYLevel 
    } = currentSettings;

    const minX = visCenterX - visHorizontalExtent;
    const maxX = visCenterX + visHorizontalExtent;
    const minZ = visCenterZ - visHorizontalExtent;
    const maxZ = visCenterZ + visHorizontalExtent;

    let displayText = `Previewing X: [${minX} to ${maxX}], Z: [${minZ} to ${maxZ}]`;

    if (useAlternatingLogicForTheoreticalViz) {
        displayText += `, Y-Levels: Alternating (Low: ${altLowYLevel}, High: ${altHighYLevel})`;
        if (visVerticalExtent > 0) {
            displayText += `. Vertical extent (${visVerticalExtent}) may show additional context around these levels.`;
        } else {
            displayText += `.`;
        }
    } else {
        const minY = visCenterY - visVerticalExtent;
        const maxY = visCenterY + visVerticalExtent;
        displayText += `, Y: [${minY} to ${maxY}]`;
    }

    theoreticalRangeInfoElement.textContent = displayText;
}

// --- UI Creation Functions ---

// --- Moved UI Styling and Helper Functions UP --- 
function styleLabel(label: HTMLLabelElement) {
    label.style.display = 'block';
    label.style.marginBottom = '6px';
    label.style.color = '#CBD5E0'; // Lighter text for labels
    label.style.fontWeight = '500';
}

function styleInput(input: HTMLInputElement | HTMLTextAreaElement) {
    input.style.width = 'calc(100% - 12px)';
    input.style.padding = '8px 10px';
    input.style.marginBottom = '12px';
    input.style.backgroundColor = '#2D3748'; // Dark input bg
    input.style.color = '#E2E8F0';
    input.style.border = '1px solid #4A5568';
    input.style.borderRadius = '4px';
    input.style.boxSizing = 'border-box';
    input.style.outline = 'none';
    input.onfocus = () => input.style.borderColor = '#63B3ED'; // Accent on focus
    input.onblur = () => input.style.borderColor = '#4A5568';
}

function styleNumberInput(input: HTMLInputElement) {
    styleInput(input);
    input.style.width = '80px'; // Smaller width for number inputs
}

function styleButton(button: HTMLButtonElement, primary = false) {
    button.style.padding = primary ? '10px 18px' : '8px 15px';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = '600';
    button.style.transition = 'background-color 0.2s ease';
    if (primary) {
        button.style.backgroundColor = '#4299E1'; // Blue primary
        button.style.color = 'white';
    } else {
        button.style.backgroundColor = '#4A5568'; // Gray secondary
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

function createButtonContainer(parent: HTMLElement): HTMLDivElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '10px'; // Space between buttons
    container.style.marginTop = '15px';
    parent.appendChild(container);
    return container;
}

function createStyledNumberInput(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, defaultValue?: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `${String(settingKey)}_input`;
    input.value = String(defaultValue !== undefined ? defaultValue : currentSettings[settingKey]);
    styleNumberInput(input); // styleNumberInput will call styleInput
    input.onchange = (e) => {
        const val = parseInt((e.target as HTMLInputElement).value, 10);
        if (!isNaN(val)) {
            (currentSettings[settingKey] as number) = val;
            if (['visCenterX', 'visCenterY', 'visCenterZ', 'altLowYLevel', 'altHighYLevel'].includes(String(settingKey))) {
                updateTheoreticalRangeInfo();
            }
        }
    };
    createInputGroup(parent, labelText, input);
    return input;
}

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash); // Return absolute value for simplicity as seed
}

function createStyledTextInput(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, defaultValue?: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    // For seed, currentSettings.seed is number, defaultValue might be string from an old setup, or undefined.
    // The input.value must be a string.
    if (settingKey === 'seed') {
        input.value = String(defaultValue !== undefined ? defaultValue : currentSettings.seed); 
    } else {
        input.value = String(defaultValue !== undefined ? defaultValue : currentSettings[settingKey]);
    }

    styleInput(input);
    input.onchange = (e) => {
        const M_target = e.target as HTMLInputElement;
        if (settingKey === 'seed') {
            const rawValue = M_target.value;
            const parsedNum = parseFloat(rawValue);
            if (!isNaN(parsedNum)) {
                currentSettings.seed = parsedNum;
            } else {
                currentSettings.seed = simpleHash(rawValue);
            }
            console.log(`Seed updated (raw: "${rawValue}"):`, currentSettings.seed);
        } else {
            // @ts-ignore - For other string properties, direct assignment is fine (e.g. if we add more string settings)
            currentSettings[settingKey] = M_target.value;
        }
    };
    createInputGroup(parent, labelText, input);
    return input;
}

function createStyledTextArea(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, defaultValue?: string): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.rows = 5;
    textarea.value = String(defaultValue !== undefined ? defaultValue : currentSettings[settingKey]);
    styleInput(textarea); // Apply general input styling
    textarea.style.fontFamily = 'monospace'; // Good for JSON
    textarea.onchange = (e) => {
        // @ts-ignore - Developer ensures this function is used with keys for string properties
        currentSettings[settingKey] = (e.target as HTMLTextAreaElement).value;
    };
    createInputGroup(parent, labelText, textarea);
    // Add placeholder for JSON structure hint
    if (settingKey === 'altNoiseLayersLowJSON' || settingKey === 'altNoiseLayersHighJSON') {
        textarea.placeholder = 'Example: [{\"noiseType\": \"simplex\", \"scale\": {\"x\":100, \"y\":100, \"z\":100}, ...}]';
    }
    return textarea;
}

function createStyledSliderInput(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, min: number, max: number, step: number, defaultValue?: number): HTMLInputElement {
    const container = document.createElement('div');
    container.style.marginBottom = '12px';
    
    const label = document.createElement('label');
    label.textContent = labelText;
    styleLabel(label); // Apply existing label styling
    label.style.display = 'block';
    container.appendChild(label);

    const sliderWrapper = document.createElement('div');
    sliderWrapper.style.display = 'flex';
    sliderWrapper.style.alignItems = 'center';
    container.appendChild(sliderWrapper);
    
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    const initialValue = defaultValue !== undefined ? defaultValue : (currentSettings[settingKey] as number);
    input.value = String(initialValue);
    // Style the slider - basic styling, can be enhanced with CSS variables or more specific selectors if needed
    input.style.flexGrow = '1';
    input.style.marginRight = '10px';
    // Consider custom slider track/thumb styles if browser defaults are not desired (more complex CSS)
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = String(initialValue);
    valueDisplay.style.minWidth = '30px'; // Ensure space for a couple of digits
    valueDisplay.style.textAlign = 'right';
    valueDisplay.style.color = '#E2E8F0';
    
    input.oninput = (e) => { // Use oninput for live updates as slider moves
        const val = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(val)) {
            (currentSettings[settingKey] as number) = val;
            valueDisplay.textContent = String(val);
            if (['visHorizontalExtent', 'visVerticalExtent'].includes(String(settingKey))) {
                updateTheoreticalRangeInfo();
                
                // For extent sliders specifically, trigger the boundary update immediately
                console.log(`Slider ${settingKey} changed to ${val}. Updating theoretical boundary visualization.`);
                // If onRequestUpdateBoundaryVisuals callback exists, call it with current settings
                if (onRequestUpdateBoundaryVisuals) {
                    onRequestUpdateBoundaryVisuals(currentSettings);
                }
            }
        }
    };

    sliderWrapper.appendChild(input);
    sliderWrapper.appendChild(valueDisplay);
    parent.appendChild(container);
    return input;
}

function createStyledCheckbox(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, defaultValue?: boolean): HTMLInputElement {
    const B_container = document.createElement('div');
    B_container.style.display = 'flex';
    B_container.style.alignItems = 'center';
    B_container.style.marginBottom = '12px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = defaultValue !== undefined ? defaultValue : !!currentSettings[settingKey];
    checkbox.id = `checkbox-${String(settingKey)}`; // Ensured ID format is consistent
    checkbox.style.marginRight = '8px';
    checkbox.style.cursor = 'pointer';
    // More specific styling for the checkbox itself if needed
    checkbox.style.width = '16px';
    checkbox.style.height = '16px';
    checkbox.style.accentColor = '#63B3ED'; // Use accent color for the checkmark

    checkbox.onchange = (e) => {
        (currentSettings[settingKey] as boolean) = (e.target as HTMLInputElement).checked;
        updateTheoreticalRangeInfo(); // Also update range info
    };

    const label = document.createElement('label');
    label.textContent = labelText;
    label.htmlFor = checkbox.id;
    styleLabel(label); // Reuse existing label styling
    label.style.marginBottom = '0'; // Remove margin from label as container handles it
    label.style.cursor = 'pointer';

    B_container.appendChild(checkbox);
    B_container.appendChild(label);
    parent.appendChild(B_container);
    return checkbox;
}

function createStyledRadioGroup(parent: HTMLElement, labelText: string, settingKey: keyof ProceduralGenerationSettings, options: { value: string, label: string }[], defaultValue?: string): HTMLDivElement {
    const R_groupContainer = document.createElement('div');
    R_groupContainer.style.marginBottom = '12px';

    const R_labelElement = document.createElement('label');
    R_labelElement.textContent = labelText;
    styleLabel(R_labelElement); // Style the main label for the group
    R_groupContainer.appendChild(R_labelElement);

    const R_optionsContainer = document.createElement('div');
    R_optionsContainer.style.display = 'flex';
    R_optionsContainer.style.gap = '15px'; // Spacing between radio buttons
    R_optionsContainer.style.marginTop = '5px';

    options.forEach(option => {
        const R_optionDiv = document.createElement('div');
        R_optionDiv.style.display = 'flex';
        R_optionDiv.style.alignItems = 'center';

        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = String(settingKey); // Group radios together
        radioInput.value = option.value;
        radioInput.id = `radio-${String(settingKey)}-${option.value}`;
        radioInput.checked = (defaultValue !== undefined ? defaultValue : currentSettings[settingKey]) === option.value;
        radioInput.style.marginRight = '5px';
        radioInput.style.cursor = 'pointer';
        radioInput.style.width = '15px';
        radioInput.style.height = '15px';
        radioInput.style.accentColor = '#63B3ED';

        radioInput.onchange = (e) => {
            // @ts-ignore Type assertion is okay here as we control options
            currentSettings[settingKey] = (e.target as HTMLInputElement).value;
            updateTheoreticalRangeInfo(); // Also update range info if strip direction/initial level changes behavior
        };

        const R_radioLabel = document.createElement('label');
        R_radioLabel.textContent = option.label;
        R_radioLabel.htmlFor = radioInput.id;
        styleLabel(R_radioLabel); // Re-use label styling
        R_radioLabel.style.marginBottom = '0';
        R_radioLabel.style.fontWeight = 'normal'; // Normal weight for radio option labels
        R_radioLabel.style.cursor = 'pointer';

        R_optionDiv.appendChild(radioInput);
        R_optionDiv.appendChild(R_radioLabel);
        R_optionsContainer.appendChild(R_optionDiv);
    });

    R_groupContainer.appendChild(R_optionsContainer);
    parent.appendChild(R_groupContainer);
    return R_groupContainer; 
}

// --- End New UI Helper Functions ---

/**
 * Creates the main panel for procedural generation settings.
 * @param scene The main THREE.Scene object for visualization.
 */
export function createProceduralGenerationPanel(scene: THREE.Scene): HTMLElement {
    sceneRef = scene; // Store scene reference

    if (procGenPanelContainer) {
        // Panel already exists, maybe just ensure it's visible or update content if needed
        return procGenPanelContainer;
    }

    procGenPanelContainer = document.createElement('div');
    procGenPanelContainer.id = 'procedural-generation-panel';
    // Basic Styling (ensure this matches the "godlike" styling established)
    procGenPanelContainer.style.position = 'absolute';
    procGenPanelContainer.style.top = '10px';
    procGenPanelContainer.style.right = '10px';
    procGenPanelContainer.style.width = '380px'; // Adjusted width
    procGenPanelContainer.style.maxHeight = 'calc(100vh - 20px)'; // Max height with padding
    procGenPanelContainer.style.overflowY = 'auto'; // Scroll for content
    procGenPanelContainer.style.backgroundColor = 'rgba(45, 55, 72, 0.95)'; // Dark, slightly transparent
    procGenPanelContainer.style.color = '#E2E8F0'; // Light text
    procGenPanelContainer.style.border = '1px solid #4A5568';
    procGenPanelContainer.style.borderRadius = '8px';
    procGenPanelContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    procGenPanelContainer.style.zIndex = '1000'; // Ensure it's on top
    procGenPanelContainer.style.display = isPanelVisible ? 'block' : 'none';
    procGenPanelContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    procGenPanelContainer.style.fontSize = '14px';

    // Header
    const header = document.createElement('div');
    header.style.padding = '12px 18px';
    header.style.backgroundColor = 'rgba(35, 40, 50, 0.9)'; // Slightly darker header
    header.style.borderBottom = '1px solid #4A5568';
    header.style.borderTopLeftRadius = '8px';
    header.style.borderTopRightRadius = '8px';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    procGenPanelContainer.appendChild(header);

    const title = document.createElement('h3');
    title.textContent = 'Procedural Generation Settings';
    title.style.margin = '0';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    header.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // Multiplication sign for 'x'
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = '#A0AEC0';
    closeButton.style.fontSize = '24px';
    closeButton.style.fontWeight = 'bold';
    closeButton.style.cursor = 'pointer';
    closeButton.onmouseover = () => closeButton.style.color = '#E2E8F0';
    closeButton.onmouseout = () => closeButton.style.color = '#A0AEC0';
    closeButton.onclick = () => toggleProceduralGenerationPanel(); // Use existing toggle function
    header.appendChild(closeButton);

    // --- Tab System ---
    const tabsContainer = document.createElement('div');
    tabsContainer.style.display = 'flex';
    tabsContainer.style.marginBottom = '0px'; // No margin, content padding will handle space
    tabsContainer.style.borderBottom = '1px solid #4A5568';
    tabsContainer.style.padding = '0 10px'; // Padding for tab buttons
    tabsContainer.style.backgroundColor = 'rgba(35, 40, 50, 0.7)'; // Background for the tab bar area
    procGenPanelContainer.appendChild(tabsContainer);

    const tabContentsContainer = document.createElement('div');
    tabContentsContainer.style.padding = '15px 20px'; // Padding for content within tabs
    procGenPanelContainer.appendChild(tabContentsContainer);

    const tabs: { [key: string]: { button: HTMLButtonElement, content: HTMLElement } } = {};

    function createTab(id: string, labelText: string): { button: HTMLButtonElement, content: HTMLElement } {
        const button = document.createElement('button');
        button.textContent = labelText;
        button.className = 'pg-tab-button'; // For potential global styling via class
        button.style.padding = '10px 15px';
        button.style.marginRight = '5px'; // Spacing between tab buttons
        button.style.border = 'none';
        button.style.borderBottom = '3px solid transparent'; // Indicator for active tab
        button.style.cursor = 'pointer';
        button.style.backgroundColor = 'transparent'; // Tabs are part of the tabsContainer bg
        button.style.color = '#A0AEC0'; // Inactive tab text
        button.style.outline = 'none';
        button.style.transition = 'color 0.2s ease, border-bottom-color 0.2s ease';
        button.style.fontWeight = '500';

        const content = document.createElement('div');
        content.className = 'pg-tab-content';
        content.style.display = 'none'; // Hide all tab content by default
        tabContentsContainer.appendChild(content);
        tabsContainer.appendChild(button);

        tabs[id] = { button, content };

        button.onclick = () => {
            for (const tabId in tabs) {
                tabs[tabId].content.style.display = 'none';
                tabs[tabId].button.style.color = '#A0AEC0';
                tabs[tabId].button.style.fontWeight = '500';
                tabs[tabId].button.style.borderBottomColor = 'transparent';
            }
            content.style.display = 'block';
            button.style.color = '#E2E8F0'; // Active tab text
            button.style.fontWeight = '600';
            button.style.borderBottomColor = '#63B3ED'; // Accent color for active tab
        };
        return { button, content };
    }

    // --- Tab 1: General Settings ---
    const generalTab = createTab('general', 'General');
    generalTab.content.appendChild(createSectionTitle('Global Settings'));
    createStyledTextInput(generalTab.content, 'Seed:', 'seed', String(currentSettings.seed));


    // --- Tab 2: Theoretical Visualizer Settings ---
    const theoreticalTab = createTab('theoretical', 'Theoretical Visualizer');
    theoreticalTab.content.appendChild(createSectionTitle('Visualization Area Control'));
    
    const centerContainer = document.createElement('div');
    centerContainer.style.padding = '10px';
    centerContainer.style.border = '1px solid #3A4454'; 
    centerContainer.style.borderRadius = '4px';
    centerContainer.style.marginBottom = '15px';
    centerContainer.style.backgroundColor = 'rgba(0,0,0,0.1)';
    
    createStyledNumberInput(centerContainer, 'Center X:', 'visCenterX', currentSettings.visCenterX);
    createStyledNumberInput(centerContainer, 'Center Y:', 'visCenterY', currentSettings.visCenterY);
    createStyledNumberInput(centerContainer, 'Center Z:', 'visCenterZ', currentSettings.visCenterZ);
    theoreticalTab.content.appendChild(centerContainer);

    createStyledSliderInput(theoreticalTab.content, 'Horizontal Extent (X/Z)', 'visHorizontalExtent', 0, 1000, 1, currentSettings.visHorizontalExtent);
    createStyledSliderInput(theoreticalTab.content, 'Vertical Extent (Y)', 'visVerticalExtent', 0, 1000, 1, currentSettings.visVerticalExtent);

    createStyledCheckbox(
        theoreticalTab.content, 
        'Use Alternating Gen. Logic for Y-levels',
        'useAlternatingLogicForTheoreticalViz',
        currentSettings.useAlternatingLogicForTheoreticalViz
    );

    // <<< ADD NEW CHECKBOX for adjacent-only mode >>>
    createStyledCheckbox(
        theoreticalTab.content,
        'Only Show Theoretical Adjacent to Actual Chunks (Extent 1)',
        'theoreticalVizAdjacentToTrue',
        currentSettings.theoreticalVizAdjacentToTrue
    );

    theoreticalRangeInfoElement = document.createElement('div');
    theoreticalRangeInfoElement.id = 'theoretical-range-info';
    theoreticalRangeInfoElement.style.marginTop = '10px';
    theoreticalRangeInfoElement.style.padding = '8px';
    theoreticalRangeInfoElement.style.backgroundColor = 'rgba(0,0,0,0.15)';
    theoreticalRangeInfoElement.style.borderRadius = '4px';
    theoreticalRangeInfoElement.style.fontSize = '13px';
    theoreticalRangeInfoElement.style.fontFamily = 'monospace';
    theoreticalRangeInfoElement.style.color = '#CBD5E0';
    theoreticalTab.content.appendChild(theoreticalRangeInfoElement);
    updateTheoreticalRangeInfo(); 

    const vizButtonContainer = createButtonContainer(theoreticalTab.content);
    const showVizButton = document.createElement('button');
    showVizButton.textContent = 'Show/Refresh Theoretical';
    styleButton(showVizButton, true);
    showVizButton.onclick = () => {
        isTheoreticalBoundariesActive = true; // Set active flag
        // Log currentSettings just before calling the callback
        console.log(`[ProcGenPanel] ShowVizButton Click: currentSettings.visHorizontalExtent = ${currentSettings.visHorizontalExtent}, currentSettings.visVerticalExtent = ${currentSettings.visVerticalExtent}`);
        if (onRequestUpdateBoundaryVisuals) {
            onRequestUpdateBoundaryVisuals({ ...currentSettings });
        }

        // <<< FOCUS CAMERA ON THE VISUALIZATION CENTER >>>
        const targetFocus = new THREE.Vector3(
            currentSettings.visCenterX * CHUNK_SIZE,
            currentSettings.visCenterY * CHUNK_HEIGHT,
            currentSettings.visCenterZ * CHUNK_SIZE
        );
        // Calculate a suitable distance based on extent - very rough estimate
        const extent = Math.max(currentSettings.visHorizontalExtent, currentSettings.visVerticalExtent, 1);
        const cameraDistance = extent * CHUNK_SIZE * 2; // Adjust multiplier as needed
        focusOrbitCameraOn(targetFocus, cameraDistance);
    };
    vizButtonContainer.appendChild(showVizButton);

    const clearVizButton = document.createElement('button');
    clearVizButton.textContent = 'Hide Theoretical';
    styleButton(clearVizButton);
    clearVizButton.onclick = () => {
        isTheoreticalBoundariesActive = false; // Clear active flag
        if (onRequestUpdateBoundaryVisuals) {
            onRequestUpdateBoundaryVisuals({ ...currentSettings });
        }
        if (sceneRef) {
             removeTheoreticalChunkBoundaries(sceneRef); // Direct call if only hiding
        }
        theoreticalChunkKeys = []; // Clear keys
    };
    vizButtonContainer.appendChild(clearVizButton);

    // --- Tab 3: Alternating Elevation Generator ---
    const alternatingTab = createTab('alternating', 'Alternating Elevation');
    
    alternatingTab.content.appendChild(createSectionTitle('Generation Dimensions & Start'));
    const dimContainer = document.createElement('div');
    dimContainer.style.padding = '10px';
    dimContainer.style.border = '1px solid #3A4454';
    dimContainer.style.borderRadius = '4px';
    dimContainer.style.marginBottom = '15px';
    dimContainer.style.backgroundColor = 'rgba(0,0,0,0.1)';
    createStyledNumberInput(dimContainer, 'Start X:', 'altStartX', currentSettings.altStartX);
    createStyledNumberInput(dimContainer, 'Start Z:', 'altStartZ', currentSettings.altStartZ);
    // Renamed 'altLengthZ' label to be more generic
    createStyledNumberInput(dimContainer, 'Strip Length:', 'altLengthZ', currentSettings.altLengthZ);
    alternatingTab.content.appendChild(dimContainer);

    // Radio Buttons for Strip Direction and Initial Y Level
    createStyledRadioGroup(
        alternatingTab.content,
        'Strip Direction',
        'altStripDirection',
        [{value: 'z', label: 'Along Z-axis (Length controls Z-depth)'}, {value: 'x', label: 'Along X-axis (Length controls X-width)'}],
        currentSettings.altStripDirection
    );
    createStyledRadioGroup(
        alternatingTab.content,
        'Initial Y Level (at Start X/Z)',
        'altInitialYLevel',
        [{value: 'low', label: 'Low Y Level'}, {value: 'high', label: 'High Y Level'}],
        currentSettings.altInitialYLevel
    );
    
    alternatingTab.content.appendChild(createSectionTitle('Y-Levels & Interpolation'));
    const yLevelContainer = document.createElement('div');
    yLevelContainer.style.padding = '10px';
    yLevelContainer.style.border = '1px solid #3A4454';
    yLevelContainer.style.borderRadius = '4px';
    yLevelContainer.style.marginBottom = '15px';
    yLevelContainer.style.backgroundColor = 'rgba(0,0,0,0.1)';
    createStyledNumberInput(yLevelContainer, 'Low Y Level:', 'altLowYLevel', currentSettings.altLowYLevel);
    createStyledNumberInput(yLevelContainer, 'High Y Level:', 'altHighYLevel', currentSettings.altHighYLevel);
    
    const interpolateLabel = document.createElement('label');
    interpolateLabel.style.display = 'flex';
    interpolateLabel.style.alignItems = 'center';
    interpolateLabel.style.marginTop = '10px';
    interpolateLabel.style.cursor = 'pointer';
    interpolateLabel.style.color = '#CBD5E0';
    const interpolateCheckbox = document.createElement('input');
    interpolateCheckbox.type = 'checkbox';
    interpolateCheckbox.checked = currentSettings.altInterpolate;
    interpolateCheckbox.style.marginRight = '8px';
    interpolateCheckbox.style.accentColor = '#63B3ED';
    interpolateCheckbox.onchange = (e) => {
        currentSettings.altInterpolate = (e.target as HTMLInputElement).checked;
    };
    interpolateLabel.appendChild(interpolateCheckbox);
    interpolateLabel.appendChild(document.createTextNode('Interpolate Meshes (Smooth Transition)'));
    yLevelContainer.appendChild(interpolateLabel);
    alternatingTab.content.appendChild(yLevelContainer);

    alternatingTab.content.appendChild(createSectionTitle('Noise Layers (JSON)'));
    const noiseLayersLowTextarea = createStyledTextArea(alternatingTab.content, 'Noise Layers - Low Y Level:', 'altNoiseLayersLowJSON', currentSettings.altNoiseLayersLowJSON);
    const loadDefaultLowButton = document.createElement('button');
    styleButton(loadDefaultLowButton);
    loadDefaultLowButton.textContent = 'Load Default Low Settings';
    loadDefaultLowButton.onclick = () => {
        noiseLayersLowTextarea.value = defaultLowNoiseJSON;
        currentSettings.altNoiseLayersLowJSON = defaultLowNoiseJSON;
    };
    alternatingTab.content.appendChild(loadDefaultLowButton);


    const noiseLayersHighTextarea = createStyledTextArea(alternatingTab.content, 'Noise Layers - High Y Level:', 'altNoiseLayersHighJSON', currentSettings.altNoiseLayersHighJSON);
    const loadDefaultHighButton = document.createElement('button');
    styleButton(loadDefaultHighButton);
    loadDefaultHighButton.textContent = 'Load Default High Settings';
    loadDefaultHighButton.onclick = () => {
        noiseLayersHighTextarea.value = defaultHighNoiseJSON;
        currentSettings.altNoiseLayersHighJSON = defaultHighNoiseJSON;
    };
    alternatingTab.content.appendChild(loadDefaultHighButton);

    const genButtonContainer = createButtonContainer(alternatingTab.content);
    const generateButton = document.createElement('button');
    generateButton.textContent = 'Generate Alternating Terrain';
    styleButton(generateButton, true);
    generateButton.onclick = () => {
        if (!sceneRef) {
            console.error("[ProcGenPanel] Scene reference not available for generating alternating terrain.");
            return;
        }
        try {
            const lowLayers: NoiseLayers = JSON.parse(currentSettings.altNoiseLayersLowJSON);
            const highLayers: NoiseLayers = JSON.parse(currentSettings.altNoiseLayersHighJSON);

            const params: AlternatingTerrainParams = {
                scene: sceneRef,
                seed: currentSettings.seed,
                startX: currentSettings.altStartX,
                startZ: currentSettings.altStartZ,
                stripLength: currentSettings.altLengthZ, // Use altLengthZ for stripLength
                stripDirection: currentSettings.altStripDirection, // New
                initialYLevel: currentSettings.altInitialYLevel,   // New
                lowYLevel: currentSettings.altLowYLevel,
                highYLevel: currentSettings.altHighYLevel,
                noiseLayersLow: lowLayers,
                noiseLayersHigh: highLayers,
                interpolate: currentSettings.altInterpolate,
                // compInfo, planetOffset, noiseScale can be added from a central source if needed
                // For now, the generator uses its own defaults or placeholders if these are not passed
                // We might need to fetch these from isolatedTerrainViewer if they are critical
            };

            if (lastGeneratedAlternatingGroup) {
                disposeAlternatingTerrain(sceneRef, lastGeneratedAlternatingGroup);
                lastGeneratedAlternatingGroup = null;
            }
            console.log("[ProcGenPanel] Calling generateAlternatingTerrain with params:", params);
            generateAlternatingTerrain(params).then(group => {
                lastGeneratedAlternatingGroup = group;
                console.log("[ProcGenPanel] Alternating terrain generation promise resolved.");

                // --- GODLIKE UPGRADE: Auto-configure theoretical visualizer settings ---
                currentSettings.useAlternatingLogicForTheoreticalViz = true;
                currentSettings.visCenterX = params.startX;
                currentSettings.visCenterZ = params.startZ;
                currentSettings.visCenterY = Math.round((params.lowYLevel + params.highYLevel) / 2);

                // Update UI elements to reflect these changes
                const useAltCheckbox = document.getElementById('checkbox-useAlternatingLogicForTheoreticalViz') as HTMLInputElement;
                if (useAltCheckbox) useAltCheckbox.checked = currentSettings.useAlternatingLogicForTheoreticalViz;

                const visXInput = document.getElementById('visCenterX_input') as HTMLInputElement;
                if (visXInput) visXInput.value = String(currentSettings.visCenterX);

                const visYInput = document.getElementById('visCenterY_input') as HTMLInputElement;
                if (visYInput) visYInput.value = String(currentSettings.visCenterY);

                const visZInput = document.getElementById('visCenterZ_input') as HTMLInputElement;
                if (visZInput) visZInput.value = String(currentSettings.visCenterZ);
                
                // Update the informational display for the theoretical range
                updateTheoreticalRangeInfo();

                // If theoretical boundaries are already active, refresh them
                if (isTheoreticalBoundariesActive && onRequestUpdateBoundaryVisuals) {
                    onRequestUpdateBoundaryVisuals({ ...currentSettings });
                }
                // --- End GODLIKE UPGRADE ---

            }).catch(error => {
                console.error("[ProcGenPanel] Error during alternating terrain generation:", error);
                alert("Error in NoiseLayers JSON or generation parameters. Check console.");
            });

        } catch (e) {
            console.error("[ProcGenPanel] Error parsing NoiseLayers JSON or preparing params for alternating terrain:", e);
            alert("Error in NoiseLayers JSON or generation parameters. Check console.");
        }
    };
    genButtonContainer.appendChild(generateButton);

    const disposeButton = document.createElement('button');
    disposeButton.textContent = 'Dispose Last Alternating Terrain';
    styleButton(disposeButton);
    disposeButton.onclick = () => {
        if (lastGeneratedAlternatingGroup && sceneRef) {
            disposeAlternatingTerrain(sceneRef, lastGeneratedAlternatingGroup);
            lastGeneratedAlternatingGroup = null;
            console.log('[ProcGenPanel] Disposed last alternating terrain.');
        } else {
            console.log('[ProcGenPanel] No alternating terrain to dispose or scene not available.');
        }
    };
    genButtonContainer.appendChild(disposeButton);


    // --- Activate the first tab (General) by default ---
    if (tabs['general']) {
        tabs['general'].button.click(); // Simulate click to activate
    } else if (Object.keys(tabs).length > 0) {
        tabs[Object.keys(tabs)[0]].button.click(); // Activate the first available tab
    }
    
    // Add to DOM only if it's not already there (e.g. if panel was hidden not destroyed)
    if (!procGenPanelContainer.parentElement) {
        document.body.appendChild(procGenPanelContainer);
    }
    
    return procGenPanelContainer;
}

// --- Logic Functions ---

/**
 * Toggles the visibility of the procedural generation panel.
 */
export function toggleProceduralGenerationPanel(): void {
    isPanelVisible = !isPanelVisible;
    if (procGenPanelContainer) {
        procGenPanelContainer.style.display = isPanelVisible ? 'block' : 'none';
        console.log('Procedural Generation Panel visibility:', isPanelVisible);
        if (!isPanelVisible && sceneRef) {
            if (theoreticalChunkKeys.length > 0) {
                 removeTheoreticalChunkBoundaries(sceneRef);
                 console.log('Cleared theoretical chunk boundaries on panel close.');
                 theoreticalChunkKeys = [];
            }
            isTheoreticalBoundariesActive = false;
            if (onRequestUpdateBoundaryVisuals) {
                 onRequestUpdateBoundaryVisuals({ ...currentSettings });
            }
            // Also dispose alternating terrain if panel is closed and it exists
            if (lastGeneratedAlternatingGroup) {
                disposeAlternatingTerrain(sceneRef, lastGeneratedAlternatingGroup);
                lastGeneratedAlternatingGroup = null;
                console.log("Disposed alternating terrain on panel close.");
            }
        }
    }
}

/**
 * Gets the current procedural generation settings.
 */
export function getProceduralGenerationSettings(): Partial<ProceduralGenerationSettings> { // Return Partial if not all are always relevant
    return { ...currentSettings };
}

/**
 * Updates procedural generation settings.
 * @param newSettings Partial or full settings object.
 */
export function updateProceduralGenerationSettings(newSettings: Partial<ProceduralGenerationSettings>): void {
    const modifiableSettings = currentSettings as any; // Operate on an any-typed alias

    for (const key in newSettings) {
        if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
            const typedKey = key as keyof ProceduralGenerationSettings;
            const newValue = newSettings[typedKey];

            if (newValue === undefined) {
                modifiableSettings[typedKey] = undefined;
                continue;
            }

            // Use typeof on modifiableSettings to get current type if it exists
            const currentType = typeof modifiableSettings[typedKey];
            const newType = typeof newValue;

            if (currentType === newType || modifiableSettings[typedKey] === undefined) {
                modifiableSettings[typedKey] = newValue;
            } else if (currentType === 'number' && newType === 'string') {
                const numVal = parseFloat(newValue as string);
                if (!isNaN(numVal)) {
                    modifiableSettings[typedKey] = numVal;
                } else {
                    console.warn(`[updateProceduralGenerationSettings] Could not convert string '${newValue}' to number for setting '${typedKey}'.`);
                }
            } else if (currentType === 'string' && newType === 'number') {
                modifiableSettings[typedKey] = String(newValue);
            } else if (currentType === 'boolean' && newType === 'string') {
                if ((newValue as string).toLowerCase() === 'true') {
                    modifiableSettings[typedKey] = true;
                } else if ((newValue as string).toLowerCase() === 'false') {
                    modifiableSettings[typedKey] = false;
                } else {
                    console.warn(`[updateProceduralGenerationSettings] Could not convert string '${newValue}' to boolean for setting '${typedKey}'.`);
                }
            } else {
                console.warn(`[updateProceduralGenerationSettings] Type mismatch for setting '${typedKey}'. Current: ${currentType}, New: ${newType}. Value: '', newValue, ''. Skipping update for this key.`);
            }
        }
    }
    console.log('Procedural Generation Settings updated:', currentSettings as any); // currentSettings is modified by reference
    // TODO: Add logic here to update the input fields if the panel is visible
}

// --- Placeholder for actual generation logic ---
/**
 * This function would be responsible for taking the current settings
 * and applying them to generate or modify terrain data.
 */
export function applyProceduralGeneration(): void {
    console.warn("Generic 'Apply Generation' clicked. This button might be deprecated. Use tab-specific generation buttons.");
    // const settings = getProceduralGenerationSettings();
    // This function might need to decide which generation to trigger or be removed.
}

/**
 * Cleans up resources used by the procedural generation panel, especially visualizations.
 */
export function cleanupProceduralGenerationPanel(): void {
    if (sceneRef && theoreticalChunkKeys.length > 0) {
        removeTheoreticalChunkBoundaries(sceneRef);
    }
    if (lastGeneratedAlternatingGroup && sceneRef) {
        disposeAlternatingTerrain(sceneRef, lastGeneratedAlternatingGroup);
        lastGeneratedAlternatingGroup = null;
    }
    theoreticalChunkKeys = [];
    isTheoreticalBoundariesActive = false;
    sceneRef = null;
    // procGenPanelContainer = null; // Don't nullify, allow re-creation or re-attachment
    isPanelVisible = false;
    onRequestUpdateBoundaryVisuals = null;
    console.log("Procedural Generation Panel cleaned up.");
}

console.log('Procedural Generation Panel module (UI Overhaul version) loaded.'); 