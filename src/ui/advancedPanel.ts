import * as THREE from 'three';
import { MarchingCubes } from '../meshGenerator';

// Define types for callbacks
type NoiseLayerUpdateCallback = (layers: number[]) => void;
type ThresholdUpdateCallback = (threshold: number) => void;
type ColorSchemeUpdateCallback = (scheme: string) => void;
type QualityUpdateCallback = (quality: number) => void;
type TerrainFeatureToggleCallback = (feature: string, enabled: boolean) => void;
type ViewModeCallback = (mode: string) => void;
type SaveStateCallback = () => void;
type LoadStateCallback = (stateId: string) => void;

interface AdvancedPanelOptions {
    defaultNoiseLayers?: number[];
    defaultThreshold?: number;
    defaultColorScheme?: string;
    defaultQuality?: number;
    availableColorSchemes?: string[];
    availableTerrainFeatures?: {name: string, label: string}[];
    onNoiseLayerUpdate?: NoiseLayerUpdateCallback;
    onThresholdUpdate?: ThresholdUpdateCallback;
    onColorSchemeUpdate?: ColorSchemeUpdateCallback;
    onQualityUpdate?: QualityUpdateCallback;
    onTerrainFeatureToggle?: TerrainFeatureToggleCallback;
    onViewModeChange?: ViewModeCallback;
    onSaveState?: SaveStateCallback;
    onLoadState?: LoadStateCallback;
    onResetDefaults?: () => void;
}

/**
 * Creates an advanced control panel with multiple sections and controls
 */
export function createAdvancedPanel(options: AdvancedPanelOptions = {}): HTMLElement {
    // Apply defaults
    const defaults = {
        defaultNoiseLayers: [50, 25, 10, 5],
        defaultThreshold: 0.0,
        defaultColorScheme: 'terrain',
        defaultQuality: 32,
        availableColorSchemes: ['terrain', 'desert', 'volcanic', 'arctic', 'alien', 'ocean'],
        availableTerrainFeatures: [
            {name: 'caves', label: 'Generate Caves'},
            {name: 'mountains', label: 'Enhanced Mountains'},
            {name: 'valleys', label: 'Deep Valleys'},
            {name: 'plateaus', label: 'Flat Plateaus'},
            {name: 'islands', label: 'Floating Islands'}
        ]
    };

    const settings = {...defaults, ...options};

    // Create main container
    const panel = document.createElement('div');
    panel.id = 'advanced-control-panel';
    panel.className = 'control-panel advanced-panel';
    
    // Apply styles to panel
    Object.assign(panel.style, {
        position: 'absolute',
        top: '10px',
        right: '10px',
        width: '320px',
        maxHeight: '90vh',
        backgroundColor: 'rgba(10, 10, 20, 0.85)',
        color: 'white',
        borderRadius: '8px',
        fontFamily: 'Arial, sans-serif',
        padding: '15px',
        zIndex: '1000',
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(5px)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        border: '1px solid rgba(80, 80, 255, 0.3)'
    });

    // Create panel header
    const header = document.createElement('div');
    header.className = 'panel-header';
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(100, 100, 255, 0.5)',
        paddingBottom: '10px',
        marginBottom: '5px'
    });

    const title = document.createElement('h2');
    title.textContent = 'Terrain Control Panel';
    Object.assign(title.style, {
        margin: '0',
        fontSize: '1.3em',
        fontWeight: 'bold',
        color: '#aaf'
    });

    const toggleButton = document.createElement('button');
    toggleButton.innerHTML = '&minus;';
    toggleButton.title = 'Minimize panel';
    Object.assign(toggleButton.style, {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'white',
        fontSize: '20px',
        cursor: 'pointer',
        width: '24px',
        height: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0'
    });

    // Panel sections container
    const sectionsContainer = document.createElement('div');
    sectionsContainer.className = 'panel-sections';
    Object.assign(sectionsContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px'
    });

    // Toggle panel collapse functionality
    toggleButton.addEventListener('click', () => {
        if (sectionsContainer.style.display === 'none') {
            sectionsContainer.style.display = 'flex';
            toggleButton.innerHTML = '&minus;';
            toggleButton.title = 'Minimize panel';
        } else {
            sectionsContainer.style.display = 'none';
            toggleButton.innerHTML = '&plus;';
            toggleButton.title = 'Expand panel';
        }
    });

    header.appendChild(title);
    header.appendChild(toggleButton);
    panel.appendChild(header);
    panel.appendChild(sectionsContainer);

    // --- Create Panel Sections ---

    // 1. NOISE LAYERS SECTION
    const noiseSection = createPanelSection('Noise Layers', 'Configure terrain noise layers');
    
    // Create sliders for each noise layer
    const noiseLayersContainer = document.createElement('div');
    Object.assign(noiseLayersContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    });

    const layerSliders: HTMLInputElement[] = [];
    const layerLabels = ['Large Features', 'Medium Features', 'Small Details', 'Micro Details'];
    
    settings.defaultNoiseLayers.forEach((defaultValue, index) => {
        const layerLabel = index < layerLabels.length ? layerLabels[index] : `Layer ${index + 1}`;
        const slider = createRangeWithLabel(layerLabel, 0, 100, defaultValue, (value) => {
            // Collect all slider values and pass as array
            const layers = layerSliders.map(s => parseInt(s.value));
            if (settings.onNoiseLayerUpdate) {
                settings.onNoiseLayerUpdate(layers);
            }
        });
        
        layerSliders.push(slider.rangeInput);
        noiseLayersContainer.appendChild(slider.container);
    });
    
    noiseSection.content.appendChild(noiseLayersContainer);
    sectionsContainer.appendChild(noiseSection.container);

    // 2. THRESHOLD AND QUALITY SECTION
    const renderSection = createPanelSection('Rendering', 'Adjust rendering parameters');
    
    // Threshold slider
    const thresholdControl = createRangeWithLabel('Surface Threshold', -1.0, 1.0, settings.defaultThreshold, (value) => {
        if (settings.onThresholdUpdate) {
            settings.onThresholdUpdate(parseFloat(value));
        }
    }, 0.01);
    renderSection.content.appendChild(thresholdControl.container);
    
    // Quality/resolution slider
    const qualityControl = createRangeWithLabel('Resolution', 8, 64, settings.defaultQuality, (value) => {
        if (settings.onQualityUpdate) {
            settings.onQualityUpdate(parseInt(value));
        }
    }, 1);
    renderSection.content.appendChild(qualityControl.container);

    sectionsContainer.appendChild(renderSection.container);

    // 3. COLOR SCHEMES SECTION
    const colorSection = createPanelSection('Appearance', 'Change terrain appearance');
    
    // Create color scheme selector
    const colorSchemeLabel = document.createElement('label');
    colorSchemeLabel.textContent = 'Color Scheme:';
    Object.assign(colorSchemeLabel.style, {
        marginBottom: '5px',
        display: 'block'
    });
    
    const colorSchemeSelect = document.createElement('select');
    Object.assign(colorSchemeSelect.style, {
        width: '100%',
        padding: '8px',
        backgroundColor: 'rgba(30, 30, 50, 0.8)',
        color: 'white',
        border: '1px solid rgba(80, 80, 255, 0.3)',
        borderRadius: '4px',
        marginBottom: '10px'
    });
    
    settings.availableColorSchemes.forEach(scheme => {
        const option = document.createElement('option');
        option.value = scheme;
        option.textContent = scheme.charAt(0).toUpperCase() + scheme.slice(1);
        if (scheme === settings.defaultColorScheme) {
            option.selected = true;
        }
        colorSchemeSelect.appendChild(option);
    });
    
    colorSchemeSelect.addEventListener('change', () => {
        if (settings.onColorSchemeUpdate) {
            settings.onColorSchemeUpdate(colorSchemeSelect.value);
        }
    });
    
    colorSection.content.appendChild(colorSchemeLabel);
    colorSection.content.appendChild(colorSchemeSelect);
    sectionsContainer.appendChild(colorSection.container);

    // 4. TERRAIN FEATURES SECTION
    const featuresSection = createPanelSection('Terrain Features', 'Toggle special terrain features');
    
    const featuresContainer = document.createElement('div');
    Object.assign(featuresContainer.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    });
    
    settings.availableTerrainFeatures.forEach(feature => {
        const featureToggle = createToggleSwitch(feature.label, false, (enabled) => {
            if (settings.onTerrainFeatureToggle) {
                settings.onTerrainFeatureToggle(feature.name, enabled);
            }
        });
        featuresContainer.appendChild(featureToggle);
    });
    
    featuresSection.content.appendChild(featuresContainer);
    sectionsContainer.appendChild(featuresSection.container);

    // 5. VIEW MODES SECTION
    const viewSection = createPanelSection('View Mode', 'Change visualization mode');
    
    const viewModesContainer = document.createElement('div');
    Object.assign(viewModesContainer.style, {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px'
    });
    
    const viewModes = [
        { name: 'normal', label: 'Normal' },
        { name: 'wireframe', label: 'Wireframe' },
        { name: 'heightmap', label: 'Height Map' },
        { name: 'xray', label: 'X-Ray' }
    ];
    
    viewModes.forEach(mode => {
        const viewButton = document.createElement('button');
        viewButton.textContent = mode.label;
        Object.assign(viewButton.style, {
            padding: '8px',
            backgroundColor: mode.name === 'normal' ? 'rgba(80, 80, 255, 0.3)' : 'rgba(30, 30, 50, 0.8)',
            color: 'white',
            border: '1px solid rgba(80, 80, 255, 0.3)',
            borderRadius: '4px',
            cursor: 'pointer'
        });
        
        viewButton.addEventListener('click', () => {
            // Remove active style from all buttons
            viewModesContainer.querySelectorAll('button').forEach(btn => {
                btn.style.backgroundColor = 'rgba(30, 30, 50, 0.8)';
            });
            
            // Set active style for clicked button
            viewButton.style.backgroundColor = 'rgba(80, 80, 255, 0.3)';
            
            if (settings.onViewModeChange) {
                settings.onViewModeChange(mode.name);
            }
        });
        
        viewModesContainer.appendChild(viewButton);
    });
    
    viewSection.content.appendChild(viewModesContainer);
    sectionsContainer.appendChild(viewSection.container);

    // 6. PRESETS AND SAVE STATES SECTION
    const presetsSection = createPanelSection('Presets & States', 'Save and load terrain configurations');
    
    // Save current state
    const saveStateBtn = document.createElement('button');
    saveStateBtn.textContent = 'Save Current State';
    Object.assign(saveStateBtn.style, {
        padding: '8px',
        backgroundColor: 'rgba(0, 120, 60, 0.5)',
        color: 'white',
        border: '1px solid rgba(0, 180, 100, 0.5)',
        borderRadius: '4px',
        cursor: 'pointer',
        marginBottom: '10px',
        width: '100%'
    });
    
    saveStateBtn.addEventListener('click', () => {
        if (settings.onSaveState) {
            settings.onSaveState();
        }
        
        // Show feedback
        const originalText = saveStateBtn.textContent;
        saveStateBtn.textContent = 'State Saved!';
        saveStateBtn.style.backgroundColor = 'rgba(0, 180, 100, 0.7)';
        
        setTimeout(() => {
            saveStateBtn.textContent = originalText;
            saveStateBtn.style.backgroundColor = 'rgba(0, 120, 60, 0.5)';
        }, 1500);
    });
    
    presetsSection.content.appendChild(saveStateBtn);
    
    // Reset to defaults
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset to Defaults';
    Object.assign(resetBtn.style, {
        padding: '8px',
        backgroundColor: 'rgba(180, 60, 60, 0.5)',
        color: 'white',
        border: '1px solid rgba(220, 100, 100, 0.5)',
        borderRadius: '4px',
        cursor: 'pointer',
        width: '100%',
        marginBottom: '15px'
    });
    
    resetBtn.addEventListener('click', () => {
        if (settings.onResetDefaults) {
            settings.onResetDefaults();
        }
        
        // Reset all controls to defaults
        settings.defaultNoiseLayers.forEach((value, index) => {
            if (index < layerSliders.length) {
                layerSliders[index].value = value.toString();
            }
        });
        
        thresholdControl.rangeInput.value = settings.defaultThreshold.toString();
        qualityControl.rangeInput.value = settings.defaultQuality.toString();
        colorSchemeSelect.value = settings.defaultColorScheme;
        
        // Find and click the "normal" view mode button
        const normalBtn = Array.from(viewModesContainer.querySelectorAll('button'))
            .find(btn => btn.textContent === 'Normal');
        if (normalBtn) {
            normalBtn.click();
        }
    });
    
    presetsSection.content.appendChild(resetBtn);
    
    // Saved states dropdown (to be populated dynamically)
    const savedStatesLabel = document.createElement('label');
    savedStatesLabel.textContent = 'Saved States:';
    Object.assign(savedStatesLabel.style, {
        display: 'block',
        marginBottom: '5px'
    });
    
    const savedStatesSelect = document.createElement('select');
    Object.assign(savedStatesSelect.style, {
        width: '100%',
        padding: '8px',
        backgroundColor: 'rgba(30, 30, 50, 0.8)',
        color: 'white',
        border: '1px solid rgba(80, 80, 255, 0.3)',
        borderRadius: '4px',
        marginBottom: '10px'
    });
    
    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = '-- Select a saved state --';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    savedStatesSelect.appendChild(placeholderOption);
    
    // Add some example saved states
    const exampleStates = ['Mountain Range', 'Desert Valley', 'Coastal Islands', 'Arctic Landscape'];
    exampleStates.forEach((state, index) => {
        const option = document.createElement('option');
        option.value = `state_${index}`;
        option.textContent = state;
        savedStatesSelect.appendChild(option);
    });
    
    const loadStateBtn = document.createElement('button');
    loadStateBtn.textContent = 'Load Selected State';
    Object.assign(loadStateBtn.style, {
        padding: '8px',
        backgroundColor: 'rgba(30, 100, 180, 0.5)',
        color: 'white',
        border: '1px solid rgba(80, 150, 220, 0.5)',
        borderRadius: '4px',
        cursor: 'pointer',
        width: '100%'
    });
    
    loadStateBtn.addEventListener('click', () => {
        const selectedState = savedStatesSelect.value;
        if (selectedState && settings.onLoadState) {
            settings.onLoadState(selectedState);
        }
    });
    
    presetsSection.content.appendChild(savedStatesLabel);
    presetsSection.content.appendChild(savedStatesSelect);
    presetsSection.content.appendChild(loadStateBtn);
    
    sectionsContainer.appendChild(presetsSection.container);

    // Add the panel to the document
    document.body.appendChild(panel);
    
    return panel;
}

// --- Helper Functions for UI Components ---

/**
 * Creates a collapsible section for the panel
 */
function createPanelSection(title: string, description: string = ''): { 
    container: HTMLElement, 
    header: HTMLElement, 
    content: HTMLElement 
} {
    const container = document.createElement('div');
    container.className = 'panel-section';
    Object.assign(container.style, {
        backgroundColor: 'rgba(20, 20, 40, 0.6)',
        borderRadius: '6px',
        overflow: 'hidden'
    });
    
    const header = document.createElement('div');
    header.className = 'section-header';
    Object.assign(header.style, {
        padding: '8px 12px',
        backgroundColor: 'rgba(40, 40, 100, 0.4)',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    const titleContainer = document.createElement('div');
    
    const titleText = document.createElement('h3');
    titleText.textContent = title;
    Object.assign(titleText.style, {
        margin: '0',
        fontSize: '1.1em',
        fontWeight: 'bold'
    });
    
    titleContainer.appendChild(titleText);
    
    if (description) {
        const titleDesc = document.createElement('span');
        titleDesc.textContent = description;
        Object.assign(titleDesc.style, {
            fontSize: '0.8em',
            opacity: '0.7',
            display: 'block'
        });
        titleContainer.appendChild(titleDesc);
    }
    
    const toggleIcon = document.createElement('span');
    toggleIcon.innerHTML = '&minus;';
    Object.assign(toggleIcon.style, {
        fontSize: '1.2em'
    });
    
    header.appendChild(titleContainer);
    header.appendChild(toggleIcon);
    
    const content = document.createElement('div');
    content.className = 'section-content';
    Object.assign(content.style, {
        padding: '12px'
    });
    
    // Toggle section collapse
    header.addEventListener('click', () => {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggleIcon.innerHTML = '&minus;';
        } else {
            content.style.display = 'none';
            toggleIcon.innerHTML = '&plus;';
        }
    });
    
    container.appendChild(header);
    container.appendChild(content);
    
    return { container, header, content };
}

/**
 * Creates a range slider with label and value display
 */
function createRangeWithLabel(
    label: string, 
    min: number, 
    max: number, 
    defaultValue: number, 
    onChange: (value: string) => void,
    step: number = 1
): { container: HTMLElement, rangeInput: HTMLInputElement } {
    const container = document.createElement('div');
    Object.assign(container.style, {
        marginBottom: '10px'
    });
    
    const labelRow = document.createElement('div');
    Object.assign(labelRow.style, {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '5px'
    });
    
    const labelText = document.createElement('label');
    labelText.textContent = label;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = defaultValue.toString();
    
    labelRow.appendChild(labelText);
    labelRow.appendChild(valueDisplay);
    
    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    rangeInput.min = min.toString();
    rangeInput.max = max.toString();
    rangeInput.step = step.toString();
    rangeInput.value = defaultValue.toString();
    
    Object.assign(rangeInput.style, {
        width: '100%',
        accentColor: '#4a80ff'
    });
    
    rangeInput.addEventListener('input', () => {
        valueDisplay.textContent = rangeInput.value;
        onChange(rangeInput.value);
    });
    
    container.appendChild(labelRow);
    container.appendChild(rangeInput);
    
    return { container, rangeInput };
}

/**
 * Creates a toggle switch
 */
function createToggleSwitch(label: string, defaultValue: boolean, onChange: (enabled: boolean) => void): HTMLElement {
    const container = document.createElement('div');
    Object.assign(container.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    const labelText = document.createElement('label');
    labelText.textContent = label;
    
    const toggleContainer = document.createElement('div');
    Object.assign(toggleContainer.style, {
        position: 'relative',
        width: '40px',
        height: '20px'
    });
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = defaultValue;
    Object.assign(toggleInput.style, {
        opacity: '0',
        width: '0',
        height: '0'
    });
    
    const toggleSlider = document.createElement('span');
    Object.assign(toggleSlider.style, {
        position: 'absolute',
        cursor: 'pointer',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: defaultValue ? 'rgba(80, 150, 255, 0.7)' : 'rgba(80, 80, 80, 0.7)',
        borderRadius: '10px',
        transition: '0.3s',
        boxShadow: 'inset 0 0 3px rgba(0, 0, 0, 0.3)'
    });
    
    // Create the toggle button
    const toggleButton = document.createElement('span');
    Object.assign(toggleButton.style, {
        position: 'absolute',
        height: '16px',
        width: '16px',
        left: defaultValue ? '22px' : '2px',
        bottom: '2px',
        backgroundColor: 'white',
        borderRadius: '50%',
        transition: '0.3s',
        boxShadow: '0 0 2px rgba(0, 0, 0, 0.3)'
    });
    
    toggleSlider.appendChild(toggleButton);
    
    toggleInput.addEventListener('change', () => {
        toggleSlider.style.backgroundColor = toggleInput.checked 
            ? 'rgba(80, 150, 255, 0.7)' 
            : 'rgba(80, 80, 80, 0.7)';
        toggleButton.style.left = toggleInput.checked ? '22px' : '2px';
        onChange(toggleInput.checked);
    });
    
    toggleContainer.appendChild(toggleInput);
    toggleContainer.appendChild(toggleSlider);
    
    container.appendChild(labelText);
    container.appendChild(toggleContainer);
    
    return container;
} 