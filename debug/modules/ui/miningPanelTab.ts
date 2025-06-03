// All imports are intentionally removed for this diagnostic version.
import { logThrottled } from '../../logThrottler'; // Import the throttler

logThrottled('MINING_PANEL_SCRIPT_EXEC', 5000, '[MiningPanelTab-DIAGNOSTIC] SCRIPT EXECUTION STARTED. All imports are disabled.');

// Define a stubbed interface for composition results to satisfy type checking
interface StubbedVolumeCompositionResult {
    surfaceComposition: Record<string, number>;
    internalComposition: Record<string, number>;
    totalVolume: number;
    timestamp: number;
}

// Add missing variable declarations for current hover state
let currentHoverComposition: any | null = null;
let currentHoverPoint: THREE.Vector3 | null = null;
let currentBrushInfo: any | null = null;
let miningPanelVisible = false; // Add missing variable

// Helper function to get a color for each material
function getColorForMaterial(materialName: string): string {
    // Map of common material names to colors
    const materialColors: Record<string, string> = {
        // Metals
        'Iron': '#a19d94',
        'Copper': '#b87333',
        'Gold': '#ffd700',
        'Silver': '#c0c0c0',
        'Aluminum': '#848789',
        'Titanium': '#878681',
        
        // Rocks and minerals
        'Stone': '#7d7d7d',
        'Granite': '#a7a7a7',
        'Basalt': '#5c5c5c', 
        'Obsidian': '#3d3d3d',
        'Quartz': '#f1f1f1',
        'Diamond': '#b9f2ff',
        'Emerald': '#50c878',
        'Ruby': '#e0115f',
        'Sapphire': '#0f52ba',
        
        // Other common materials
        'Wood': '#966f33',
        'Soil': '#9b7653',
        'Clay': '#cc7357',
        'Sand': '#c2b280',
        'Ice': '#a5f2f3',
        'Water': '#1ca3ec',
        'Lava': '#e25822'
    };
    
    // Return the color if found in the map
    if (materialName && materialColors[materialName]) {
        return materialColors[materialName];
    }
    
    // Generate a deterministic color based on the material name if not in the map
    let hash = 0;
    for (let i = 0; i < materialName.length; i++) {
        hash = materialName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert the hash to a hex color
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    
    return color;
}

// Declare the miningPanelTabUtils property on the Window interface for TypeScript
declare global {
    interface Window {
        miningPanelTabUtils: {
            updateHoverCompositionInfo: (composition: any | null, point: THREE.Vector3 | null, brushInfo: any | null) => void;
            updateBrushChunkCompositionInfo: (composition: StubbedVolumeCompositionResult | null) => void;
            getIsMiningTabActive: () => boolean;
            setMiningTabActiveStatus: (isActive: boolean) => void;
            updateMiningPanelWithCurrentChunkData: () => void;
            setEmergencyPanelVisible: (visible: boolean) => void;
        };
        // If you have other global utilities defined elsewhere, declare them here too if needed
        // analyzeVolumeComposition?: (params: any) => StubbedVolumeCompositionResult; 
    }
}

let isMiningTabActive = false;
let emergencyMiningPanelCreated = false; // This flag indicates if we've *attempted* creation and setup.

// NEW: Emergency helper to ensure mining panel elements exist regardless of main panel state
function ensureMiningPanelElementsExist() {
    logThrottled('MINING_PANEL_ENSURE_ELEMENTS', 2000, '[MiningPanelTab-EMERGENCY] ensureMiningPanelElementsExist called.');
    const existingHoverInfoDiv = document.getElementById('diagnostic-hover-info');
    const existingBrushInfoDiv = document.getElementById('diagnostic-brush-info');
    const existingPanel = document.getElementById('emergency-mining-panel');
    
    // Check if panel already exists
    if (existingPanel && existingHoverInfoDiv && existingBrushInfoDiv) {
        return { 
            hoverInfoDiv: existingHoverInfoDiv, 
            brushInfoDiv: existingBrushInfoDiv,
            panelShell: existingPanel
        };
    }
    
    logThrottled('MINING_PANEL_EMERGENCY_CREATE', 5000, '[MiningPanelTab-EMERGENCY] Emergency panel creation/setup needed (one or more elements missing).', 'warn');
    
    // DIAGNOSTIC: Force attachment to document.body to rule out hidden parent containers
    let container = document.body;
    logThrottled('MINING_PANEL_EMERGENCY_DIAG_OVERRIDE', 2000, '[MiningPanelTab-EMERGENCY] DIAGNOSTIC OVERRIDE: Forcing container for emergency panel to document.body.');
            
            // Create emergency container
            const emergencyPanel = document.createElement('div');
            emergencyPanel.id = 'emergency-mining-panel';
    
    // AGGRESSIVE STYLING: Apply directly to make sure it's visible
    emergencyPanel.style.setProperty('position', 'fixed', 'important');
    emergencyPanel.style.setProperty('top', '20px', 'important');
    emergencyPanel.style.setProperty('right', '20px', 'important');
    emergencyPanel.style.setProperty('width', '380px', 'important');
    emergencyPanel.style.setProperty('padding', '16px', 'important');
    emergencyPanel.style.setProperty('z-index', '9999999', 'important');
    emergencyPanel.style.setProperty('background-color', 'rgba(30, 41, 59, 0.97)', 'important');
    emergencyPanel.style.setProperty('color', 'white', 'important');
    emergencyPanel.style.setProperty('border', '2px solid #3b82f6', 'important');
    emergencyPanel.style.setProperty('border-radius', '8px', 'important');
    emergencyPanel.style.setProperty('font-family', 'Arial, sans-serif', 'important');
    emergencyPanel.style.setProperty('font-size', '14px', 'important');
    emergencyPanel.style.setProperty('box-shadow', '0 8px 20px rgba(0, 0, 0, 0.4)', 'important');
    emergencyPanel.style.setProperty('transition', 'all 0.3s ease', 'important');
    emergencyPanel.style.setProperty('display', 'block', 'important');
    
    // Add a more subtle pulsating animation
    emergencyPanel.style.setProperty('animation', 'emergencyPulsate 3s infinite', 'important');
    
    // Add keyframes for pulsating effect
    const style = document.createElement('style');
    style.textContent = `
        @keyframes emergencyPulsate {
            0% { box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3); border-color: #3b82f6; }
            50% { box-shadow: 0 8px 24px rgba(59, 130, 246, 0.5), 0 0 30px rgba(59, 130, 246, 0.3); border-color: #60a5fa; }
            100% { box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3); border-color: #3b82f6; }
        }
    `;
    document.head.appendChild(style);
    
    // Create header with controls
    const header = document.createElement('div');
    header.style.setProperty('display', 'flex', 'important');
    header.style.setProperty('justify-content', 'space-between', 'important');
    header.style.setProperty('align-items', 'center', 'important');
    header.style.setProperty('margin-bottom', '12px', 'important');
    header.style.setProperty('border-bottom', '2px solid rgba(255, 255, 255, 0.2)', 'important');
    header.style.setProperty('padding-bottom', '8px', 'important');
    
    // Add title
    const title = document.createElement('div');
    title.style.setProperty('font-weight', 'bold', 'important');
    title.style.setProperty('font-size', '16px', 'important');
    title.style.setProperty('display', 'flex', 'important');
    title.style.setProperty('align-items', 'center', 'important');
    title.style.setProperty('gap', '6px', 'important');
    title.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10h.01"></path><path d="M15 4h2a2 2 0 0 1 2 2v3.4a2 2 0 0 1-.7 1.5L14 14"></path><path d="M14 14v2a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2h.5"></path></svg>MINING DATA MONITOR';
    
    // Add controls container with improved styling
    const controls = document.createElement('div');
    controls.style.setProperty('display', 'flex', 'important');
    controls.style.setProperty('gap', '8px', 'important');
    
    // Add minimize button with improved styling
    const minimizeButton = document.createElement('button');
    minimizeButton.textContent = '_';
    minimizeButton.style.setProperty('background-color', 'rgba(255, 255, 255, 0.1)', 'important');
    minimizeButton.style.setProperty('border', 'none', 'important');
    minimizeButton.style.setProperty('color', 'white', 'important');
    minimizeButton.style.setProperty('width', '26px', 'important');
    minimizeButton.style.setProperty('height', '26px', 'important');
    minimizeButton.style.setProperty('border-radius', '4px', 'important');
    minimizeButton.style.setProperty('cursor', 'pointer', 'important');
    minimizeButton.style.setProperty('font-size', '14px', 'important');
    minimizeButton.style.setProperty('display', 'flex', 'important');
    minimizeButton.style.setProperty('align-items', 'center', 'important');
    minimizeButton.style.setProperty('justify-content', 'center', 'important');
    minimizeButton.style.setProperty('padding', '0', 'important');
    minimizeButton.style.setProperty('line-height', '1', 'important');
    minimizeButton.style.setProperty('transition', 'background-color 0.2s', 'important');
    
    // Add hover effect using addEventListener instead of direct assignment
    minimizeButton.addEventListener('mouseover', function() {
        (this as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    });
    minimizeButton.addEventListener('mouseout', function() {
        (this as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    // Add close button with improved styling
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.setProperty('background-color', 'rgba(255, 255, 255, 0.1)', 'important');
    closeButton.style.setProperty('border', 'none', 'important');
    closeButton.style.setProperty('color', 'white', 'important');
    closeButton.style.setProperty('width', '26px', 'important');
    closeButton.style.setProperty('height', '26px', 'important');
    closeButton.style.setProperty('border-radius', '4px', 'important');
    closeButton.style.setProperty('cursor', 'pointer', 'important');
    closeButton.style.setProperty('font-size', '14px', 'important');
    closeButton.style.setProperty('display', 'flex', 'important');
    closeButton.style.setProperty('align-items', 'center', 'important');
    closeButton.style.setProperty('justify-content', 'center', 'important');
    closeButton.style.setProperty('padding', '0', 'important');
    closeButton.style.setProperty('line-height', '1', 'important');
    closeButton.style.setProperty('margin-left', '8px', 'important');
    closeButton.style.setProperty('transition', 'all 0.2s', 'important');
    
    // Add hover effect for close button
    closeButton.addEventListener('mouseover', function() {
        (this as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.7)';
    });
    closeButton.addEventListener('mouseout', function() {
        (this as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    // Restore close button functionality
    closeButton.onclick = function() {
        // Hide the panel
        emergencyPanel.style.display = 'none';
        miningPanelVisible = false;
        // Store the state
        try {
            localStorage.setItem('emergencyPanelVisible', 'false');
        } catch (e) {
            console.error('Could not save panel state to localStorage', e);
        }
    };
    
    controls.appendChild(minimizeButton);
    controls.appendChild(closeButton);
    header.appendChild(title);
    header.appendChild(controls);
    emergencyPanel.appendChild(header);

    // Make the panel draggable
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    
    // Try to restore position from localStorage
    try {
        const savedTop = localStorage.getItem('emergencyPanelTop');
        const savedRight = localStorage.getItem('emergencyPanelRight');
        if (savedTop && savedRight) {
            emergencyPanel.style.setProperty('top', savedTop, 'important');
            emergencyPanel.style.setProperty('right', savedRight, 'important');
        }
    } catch (e) {
        console.error('Could not restore panel position from localStorage', e);
    }
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = emergencyPanel.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        emergencyPanel.style.transition = 'none';
        
        // Change cursor to indicate dragging
        document.body.style.cursor = 'grabbing';
        header.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const x = e.clientX - dragOffsetX;
        const y = e.clientY - dragOffsetY;
        
        // Calculate right position (since the panel is positioned from the right)
        const windowWidth = window.innerWidth;
        const panelWidth = emergencyPanel.offsetWidth;
        const rightPos = windowWidth - x - panelWidth;
        
        // Ensure the panel stays within the screen bounds
        if (y >= 0 && y <= window.innerHeight - 100 && rightPos >= 0 && rightPos <= windowWidth - 100) {
            emergencyPanel.style.setProperty('top', `${y}px`, 'important');
            emergencyPanel.style.setProperty('right', `${rightPos}px`, 'important');
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            emergencyPanel.style.transition = 'all 0.3s ease';
            
            // Save position to localStorage
            try {
                localStorage.setItem('emergencyPanelTop', emergencyPanel.style.top);
                localStorage.setItem('emergencyPanelRight', emergencyPanel.style.right);
            } catch (e) {
                console.error('Could not save panel position to localStorage', e);
            }
            
            // Reset cursor
            document.body.style.cursor = '';
            header.style.cursor = '';
        }
    });
    
    // Handle escape key to close panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && emergencyPanel.style.display !== 'none') {
            closeButton.click();
        }
    });
    
    // Create content container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'emergency-panel-content';
    contentContainer.style.setProperty('display', 'block', 'important');
    emergencyPanel.appendChild(contentContainer);
    
    // Add hover info section with improved styling
            const newHoverInfoDiv = document.createElement('div');
            newHoverInfoDiv.id = 'diagnostic-hover-info';
    newHoverInfoDiv.innerHTML = '<div style="color: #a0aec0; font-style: italic; text-align: center; padding: 20px;">Hover over terrain to analyze composition</div>';
    newHoverInfoDiv.style.marginTop = '10px';
    newHoverInfoDiv.style.padding = '12px';
    newHoverInfoDiv.style.backgroundColor = 'rgba(15, 23, 42, 0.5)';
    newHoverInfoDiv.style.borderRadius = '6px';
    newHoverInfoDiv.style.lineHeight = '1.6';
    newHoverInfoDiv.style.fontSize = '13px';
    newHoverInfoDiv.style.border = '1px solid rgba(148, 163, 184, 0.2)';
    newHoverInfoDiv.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    contentContainer.appendChild(newHoverInfoDiv);
    
    // Add brush info section with improved styling
    const brushInfoSection = document.createElement('div');
    brushInfoSection.style.marginTop = '16px';
    brushInfoSection.style.borderRadius = '6px';
    brushInfoSection.style.overflow = 'hidden';
    brushInfoSection.style.border = '1px solid rgba(148, 163, 184, 0.2)';
    brushInfoSection.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    
    const brushInfoTitle = document.createElement('div');
    brushInfoTitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m8 12 2 2 4-4"></path></svg>Brush Analysis';
    brushInfoTitle.style.padding = '8px 12px';
    brushInfoTitle.style.backgroundColor = 'rgba(15, 23, 42, 0.7)';
    brushInfoTitle.style.fontSize = '14px';
    brushInfoTitle.style.fontWeight = 'bold';
    brushInfoTitle.style.borderBottom = '1px solid rgba(148, 163, 184, 0.2)';
    brushInfoTitle.style.display = 'flex';
    brushInfoTitle.style.alignItems = 'center';
    brushInfoSection.appendChild(brushInfoTitle);
            
            const newBrushInfoDiv = document.createElement('div');
            newBrushInfoDiv.id = 'diagnostic-brush-info';
    newBrushInfoDiv.innerHTML = '<div style="color: #a0aec0; font-style: italic; text-align: center; padding: 20px;">Place brush on terrain to analyze volume</div>';
    newBrushInfoDiv.style.padding = '12px';
    newBrushInfoDiv.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
    newBrushInfoDiv.style.lineHeight = '1.6';
    newBrushInfoDiv.style.fontSize = '13px';
    brushInfoSection.appendChild(newBrushInfoDiv);
    
    contentContainer.appendChild(brushInfoSection);
    
    // Add a footer with helpful instructions
    const infoFooter = document.createElement('div');
    infoFooter.style.marginTop = '16px';
    infoFooter.style.padding = '10px';
    infoFooter.style.backgroundColor = 'rgba(15, 23, 42, 0.3)';
    infoFooter.style.borderRadius = '6px';
    infoFooter.style.fontSize = '12px';
    infoFooter.style.color = '#94a3b8';
    infoFooter.style.textAlign = 'center';
    infoFooter.style.border = '1px solid rgba(148, 163, 184, 0.1)';
    infoFooter.innerHTML = '<strong style="color: #e2e8f0;">TIP:</strong> Use mouse wheel to adjust brush size while hovering terrain';
    contentContainer.appendChild(infoFooter);
    
            container.appendChild(emergencyPanel);
    emergencyMiningPanelCreated = true; // Set flag: we've successfully created and appended it.
    logThrottled('MINING_PANEL_EMERGENCY_CREATE', 5000, '[MiningPanelTab-EMERGENCY] Emergency mining panel shell CREATED and added to:', container.id || container.tagName);
    
    // Initially hide the panel - only show when explicitly requested
    emergencyPanel.style.setProperty('display', 'none', 'important');
    
    // Minimize/maximize functionality
    minimizeButton.onclick = function() {
        const content = document.getElementById('emergency-panel-content');
        if (!content) return;
        
        if (content.style.display === 'none') {
            // Maximize
            content.style.display = 'block';
            minimizeButton.textContent = '_';
            emergencyPanel.style.setProperty('width', '380px', 'important');
        } else {
            // Minimize
            content.style.display = 'none';
            minimizeButton.textContent = '□';
            emergencyPanel.style.setProperty('width', '220px', 'important');
        }
    };
    
    return { 
        hoverInfoDiv: newHoverInfoDiv, 
        brushInfoDiv: newBrushInfoDiv,
        panelShell: emergencyPanel 
    };
}

logThrottled('MINING_PANEL_DIAG_ASSIGN', 5000, '[MiningPanelTab-DIAGNOSTIC] About to assign to window.miningPanelTabUtils.');

window.miningPanelTabUtils = {
    updateHoverCompositionInfo: (composition: any | null, point: THREE.Vector3 | null, brushInfo: any | null) => {
        logThrottled('MINING_PANEL_UPDATE_HOVER', 2000, '[MiningPanelTab-DIAGNOSTIC] updateHoverCompositionInfo CALLED. Active?:', isMiningTabActive, 'Received Data:', composition ? composition : 'null');
        currentHoverComposition = composition;
        currentHoverPoint = point;
        currentBrushInfo = brushInfo;

        // Always ensure elements exist when data is received
        ensureMiningPanelElementsExist();
        
        // Removed the auto-showing code to prevent panel from appearing automatically
        // Let the toggle button control visibility exclusively
        
        // Original update code
        const hoverInfoDiv = document.getElementById('diagnostic-hover-info');
        if (hoverInfoDiv) {
            if (composition && composition.materialCounts && isMiningTabActive) {
                let html = '<div style="margin-bottom: 10px;">';
                
                // Point coordinates with styling
                html += `<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong style="color: #e2e8f0;">Location:</strong>
                    <span style="color: #60a5fa; font-family: monospace; background-color: rgba(15, 23, 42, 0.5); padding: 4px 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); font-size: 12px;">
                        ${point ? `${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}` : 'N/A'}
                    </span>
                </div>`;
                
                // Brush info with icon
                html += `<div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong style="color: #e2e8f0;">Brush:</strong>
                    <span style="color: #f97316; background-color: rgba(15, 23, 42, 0.5); padding: 4px 8px; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                        ${brushInfo ? `${brushInfo.shape} (radius: ${brushInfo.radius})` : 'N/A'}
                    </span>
                </div>`;
                
                // Analysis stats with better layout
                html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                    <div style="background-color: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">SAMPLE POINTS</div>
                        <div style="font-size: 16px; font-weight: bold; color: #60a5fa;">${composition.totalPoints || 'N/A'}</div>
                    </div>
                    <div style="background-color: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px;">CALC TIME</div>
                        <div style="font-size: 16px; font-weight: bold; color: #60a5fa;">${composition.calculationTime ? composition.calculationTime.toFixed(1) + 'ms' : 'N/A'}</div>
                    </div>
                </div>`;
                
                // Material composition section with improved visuals
                html += '<div style="background-color: rgba(15, 23, 42, 0.5); border-radius: 6px; padding: 12px; margin-top: 12px;">';
                html += '<div style="font-weight: bold; color: #e2e8f0; margin-bottom: 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.2); padding-bottom: 6px; display: flex; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M12 3v6"></path><circle cx="12" cy="12" r="3"></circle><path d="M12 15v6"></path><path d="M6 9v6"></path><path d="M18 9v6"></path></svg>Material Composition</div>';

                const materialEntries = Object.entries(composition.materialCounts) as [string, { count: number, percentage: number, materialName: string }][];
                
                const sortedMaterials = materialEntries
                    .sort(([, a], [, b]) => b.percentage - a.percentage)
                    .slice(0, 5);

                if (sortedMaterials.length > 0) {
                    for (const [, matData] of sortedMaterials) {
                        // Create a color bar to visualize percentage with improved styling
                        const colorBar = `<div style="width: 100%; height: 8px; background-color: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);">
                            <div style="height: 100%; width: ${Math.min(100, matData.percentage)}%; background-color: ${getColorForMaterial(matData.materialName)}; border-radius: 4px; transition: width 0.5s ease-out; animation: pulseBar 2s infinite alternate ease-in-out;" title="${matData.percentage.toFixed(1)}%"></div>
                        </div>`;
                        
                        // Add animation keyframes if not already added
                        if (!document.getElementById('bar-animation-style')) {
                            const animStyle = document.createElement('style');
                            animStyle.id = 'bar-animation-style';
                            animStyle.textContent = `
                                @keyframes pulseBar {
                                    0% { opacity: 0.85; }
                                    100% { opacity: 1; }
                                }
                            `;
                            document.head.appendChild(animStyle);
                        }
                        
                        html += `<div style="margin: 8px 0; background-color: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center;">
                                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: ${getColorForMaterial(matData.materialName)}; margin-right: 6px;"></span>
                                    <span style="color: #e2e8f0; font-weight: 600;">${matData.materialName || 'Unknown'}</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="color: #60a5fa; font-weight: bold;">${matData.percentage.toFixed(1)}%</span>
                                    <span style="color: #94a3b8; font-size: 11px;">(${matData.count})</span>
                                </div>
                            </div>
                            ${colorBar}
                        </div>`;
                    }
                    if (materialEntries.length > 5) {
                        html += '<div style="margin-top: 8px; font-style: italic; text-align: center; color: #94a3b8; font-size: 11px; background-color: rgba(15, 23, 42, 0.5); padding: 6px; border-radius: 4px;">...and ${materialEntries.length - 5} more materials not shown</div>';
                    }
                } else {
                    html += '<div style="color: #94a3b8; text-align: center; padding: 15px; background-color: rgba(15, 23, 42, 0.5); border-radius: 4px;">No specific materials found or data empty.</div>';
                }
                
                html += '</div>';
                
                hoverInfoDiv.innerHTML = html;
            } else if (!isMiningTabActive && hoverInfoDiv.innerHTML !== 'Mining tab not active. Data cleared.') {
                hoverInfoDiv.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background-color: rgba(15, 23, 42, 0.5); border-radius: 6px; text-align: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 10px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <div style="color: #e2e8f0; font-weight: bold; margin-bottom: 6px;">Mining Tab Not Active</div>
                        <div style="color: #94a3b8; font-size: 12px;">Activate the mining tab to see real-time composition data.</div>
                    </div>
                `;
            } else if (!(composition && composition.materialCounts) && hoverInfoDiv.innerHTML !== 'No composition data (or materialCounts missing) at this point.'){
                hoverInfoDiv.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background-color: rgba(15, 23, 42, 0.5); border-radius: 6px; text-align: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 10px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <div style="color: #e2e8f0; font-weight: bold; margin-bottom: 6px;">No Composition Data</div>
                        <div style="color: #94a3b8; font-size: 12px;">Hover over terrain to analyze material composition.</div>
                    </div>
                `;
            }
        } else {
            console.error('[MiningPanelTab-DIAGNOSTIC] CRITICAL ERROR: diagnostic-hover-info div still not found after emergency creation in updateHoverCompositionInfo!');
        }
        
        // Update brush info div with improved formatting
        const brushInfoDiv = document.getElementById('diagnostic-brush-info');
        if (brushInfoDiv && brushInfo && isMiningTabActive && composition) {
            let html = '<div>';
            
            // Volume analysis header with box
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background-color: rgba(15, 23, 42, 0.5); padding: 10px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);">
                <div style="display: flex; align-items: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M19 15V9"></path><path d="M5 9v6"></path><rect x="1" y="9" width="4" height="6" rx="2"></rect><rect x="19" y="9" width="4" height="6" rx="2"></rect><rect x="9" y="5" width="6" height="14" rx="2"></rect></svg>
                    <strong style="color: #e2e8f0;">Volume Analysis:</strong>
                </div>
                <span style="color: #60a5fa; font-weight: bold; font-size: 16px;">${composition.totalVolume || 'N/A'} pts</span>
            </div>`;
            
            // Surface composition section with improved styles
            if (composition.surfaceComposition && Object.keys(composition.surfaceComposition).length > 0) {
                html += '<div style="margin-top: 12px; padding: 12px; background-color: rgba(79, 209, 197, 0.1); border-radius: 6px; border: 1px solid rgba(79, 209, 197, 0.2);">';
                html += `<div style="font-weight: bold; color: #4fd1c5; margin-bottom: 10px; border-bottom: 1px solid rgba(79, 209, 197, 0.2); padding-bottom: 6px; display: flex; align-items: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M2 22a8 8 0 1 1 16 0H2z"></path><path d="M16 8a6 6 0 0 0-12 0c0 8-4 13-4 13h20s-4-5-4-13z"></path><path d="M7 8a1 1 0 0 0 2 0H7z"></path><path d="M15 8a1 1 0 0 0 2 0h-2z"></path></svg>
                    Surface Composition
                </div>`;
                
                // Create a flex layout for material bars
                html += '<div style="display: flex; flex-direction: column; gap: 8px;">';
                
                // Sort materials by percentage
                const surfaceMaterials = Object.entries(composition.surfaceComposition)
                    .sort(([, a], [, b]) => (b as number) - (a as number));
                
                for (const [material, percentage] of surfaceMaterials) {
                    const percentValue = (percentage as number) * 100;
                    // Create a color bar to visualize percentage with animation
                    const colorBar = `<div style="width: 100%; height: 8px; background-color: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);">
                        <div style="height: 100%; width: ${Math.min(100, percentValue)}%; background-color: ${getColorForMaterial(material)}; border-radius: 4px; transition: width 0.5s ease-out; animation: pulseBar 2s infinite alternate ease-in-out;" title="${percentValue.toFixed(1)}%"></div>
                    </div>`;
                    
                    html += `<div style="background-color: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center;">
                                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: ${getColorForMaterial(material)}; margin-right: 6px;"></span>
                                <span style="color: #e2e8f0;">${material}</span>
                            </div>
                            <span style="color: #4fd1c5; font-weight: bold;">${percentValue.toFixed(1)}%</span>
                        </div>
                        ${colorBar}
                    </div>`;
                }
                
                html += '</div>'; // Close flex container
                html += '</div>'; // Close surface composition section
            } else if (composition.surfaceComposition) {
                html += '<div style="margin-top: 12px; padding: 12px; background-color: rgba(79, 209, 197, 0.1); border-radius: 6px; border: 1px solid rgba(79, 209, 197, 0.2);">';
                html += '<div style="font-weight: bold; color: #4fd1c5; margin-bottom: 10px; display: flex; align-items: center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><path d="M2 22a8 8 0 1 1 16 0H2z"></path><path d="M16 8a6 6 0 0 0-12 0c0 8-4 13-4 13h20s-4-5-4-13z"></path><path d="M7 8a1 1 0 0 0 2 0H7z"></path><path d="M15 8a1 1 0 0 0 2 0h-2z"></path></svg>Surface Composition</div>';
                html += '<div style="color: #94a3b8; text-align: center; padding: 10px; background-color: rgba(15, 23, 42, 0.5); border-radius: 4px;">No surface data available.</div>';
                html += '</div>';
            }
            
            // Internal composition section with improved styling
            if (composition.internalComposition && Object.keys(composition.internalComposition).length > 0) {
                html += '<div style="margin-top: 16px; padding: 12px; background-color: rgba(66, 153, 225, 0.1); border-radius: 6px; border: 1px solid rgba(66, 153, 225, 0.2);">';
                html += `<div style="font-weight: bold; color: #4299e1; margin-bottom: 10px; border-bottom: 1px solid rgba(66, 153, 225, 0.2); padding-bottom: 6px; display: flex; align-items: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle><circle cx="8.5" cy="15.5" r="1.5"></circle></svg>
                    Internal Composition
                </div>`;
                
                // Create a flex layout for material bars
                html += '<div style="display: flex; flex-direction: column; gap: 8px;">';
                
                // Sort materials by percentage
                const internalMaterials = Object.entries(composition.internalComposition)
                    .sort(([, a], [, b]) => (b as number) - (a as number));
                
                for (const [material, percentage] of internalMaterials) {
                    const percentValue = (percentage as number) * 100;
                    // Create a color bar to visualize percentage with animation
                    const colorBar = `<div style="width: 100%; height: 8px; background-color: rgba(255,255,255,0.1); border-radius: 4px; margin-top: 4px; overflow: hidden; box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);">
                        <div style="height: 100%; width: ${Math.min(100, percentValue)}%; background-color: ${getColorForMaterial(material)}; border-radius: 4px; transition: width 0.5s ease-out; animation: pulseBar 2s infinite alternate ease-in-out;" title="${percentValue.toFixed(1)}%"></div>
                    </div>`;
                    
                    html += `<div style="background-color: rgba(15, 23, 42, 0.5); padding: 8px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center;">
                                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: ${getColorForMaterial(material)}; margin-right: 6px;"></span>
                                <span style="color: #e2e8f0;">${material}</span>
                            </div>
                            <span style="color: #4299e1; font-weight: bold;">${percentValue.toFixed(1)}%</span>
                        </div>
                        ${colorBar}
                    </div>`;
                }
                
                html += '</div>'; // Close flex container
                html += '</div>'; // Close internal composition section
            } else if (composition.internalComposition) {
                html += '<div style="margin-top: 16px; padding: 12px; background-color: rgba(66, 153, 225, 0.1); border-radius: 6px; border: 1px solid rgba(66, 153, 225, 0.2);">';
                html += `<div style="font-weight: bold; color: #4299e1; margin-bottom: 10px; display: flex; align-items: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle><circle cx="8.5" cy="15.5" r="1.5"></circle></svg>
                    Internal Composition
                </div>`;
                html += '<div style="color: #94a3b8; text-align: center; padding: 10px; background-color: rgba(15, 23, 42, 0.5); border-radius: 4px;">No internal data available.</div>';
                html += '</div>';
            }
            
            html += '</div>';
            brushInfoDiv.innerHTML = html;
        } else if (brushInfoDiv) {
            brushInfoDiv.innerHTML = '<div style="color: #a0aec0; text-align: center; padding: 15px;">No brush composition data available.</div>';
        } else {
            console.error('[MiningPanelTab-DIAGNOSTIC] CRITICAL ERROR: diagnostic-brush-info div not found after emergency creation in updateBrushChunkCompositionInfo!');
        }
    },
    updateBrushChunkCompositionInfo: (composition: StubbedVolumeCompositionResult | null) => {
        logThrottled('MINING_PANEL_UPDATE_BRUSH', 2000, '[MiningPanelTab-DIAGNOSTIC] updateBrushChunkCompositionInfo CALLED:', composition, 'Active?:', isMiningTabActive);
        
        ensureMiningPanelElementsExist();
        
        // Removed auto-showing code to prevent panel from appearing automatically
        
        const brushInfoDiv = document.getElementById('diagnostic-brush-info');
        if (brushInfoDiv && composition) {
            let html = '<strong style="display: block; margin-bottom: 5px;">Brush Volume Analysis:</strong>';
            html += `Total Points: ${composition.totalVolume || 'N/A'}<br>`;
            
            if (composition.surfaceComposition && Object.keys(composition.surfaceComposition).length > 0) {
                html += '<strong style="display: block; margin-top: 8px; margin-bottom: 3px;">Surface Composition:</strong>';
                for (const [material, percentage] of Object.entries(composition.surfaceComposition)) {
                    html += `&nbsp;&nbsp;${material}: ${(percentage as number * 100).toFixed(1)}%<br>`;
                }
            } else if (composition.surfaceComposition) {
                html += '<strong style="display: block; margin-top: 8px; margin-bottom: 3px;">Surface Composition:</strong>';
                html += '&nbsp;&nbsp;No surface data.<br>';
            }
            
            if (composition.internalComposition && Object.keys(composition.internalComposition).length > 0) {
                html += '<strong style="display: block; margin-top: 8px; margin-bottom: 3px;">Internal Composition:</strong>';
                for (const [material, percentage] of Object.entries(composition.internalComposition)) {
                    html += `&nbsp;&nbsp;${material}: ${(percentage as number * 100).toFixed(1)}%<br>`;
                }
            } else if (composition.internalComposition) {
                html += '<strong style="display: block; margin-top: 8px; margin-bottom: 3px;">Internal Composition:</strong>';
                html += '&nbsp;&nbsp;No internal data.<br>';
            }
            
            brushInfoDiv.innerHTML = html;
        } else if (brushInfoDiv) {
            brushInfoDiv.innerHTML = 'No brush composition data available.';
        } else {
            console.error('[MiningPanelTab-DIAGNOSTIC] CRITICAL ERROR: diagnostic-brush-info div not found after emergency creation in updateBrushChunkCompositionInfo!');
        }
    },
    getIsMiningTabActive: () => {
        return isMiningTabActive;
    },
    setMiningTabActiveStatus: (isActive: boolean) => {
        logThrottled('MINING_PANEL_SET_ACTIVE', 2000, '[MiningPanelTab-DIAGNOSTIC] setMiningTabActiveStatus CALLED with:', isActive);
        isMiningTabActive = isActive;
        
        if (isActive) {
            ensureMiningPanelElementsExist();
        }
    },
    setEmergencyPanelVisible: (visible: boolean) => {
        logThrottled('MINING_PANEL_SET_EMERGENCY', 2000, '[MiningPanelTab-DIAGNOSTIC] setEmergencyPanelVisible CALLED with:', visible);
        const emergencyPanel = document.getElementById('emergency-mining-panel');
        if (!emergencyPanel) {
            console.error('[MiningPanelTab-DIAGNOSTIC] Cannot toggle emergency panel visibility: element not found');
            // Try to create it first
            ensureMiningPanelElementsExist();
            const emergencyPanelRetry = document.getElementById('emergency-mining-panel');
            if (!emergencyPanelRetry) {
                console.error('[MiningPanelTab-DIAGNOSTIC] CRITICAL ERROR: Emergency panel STILL not available after creation attempt.');
                return;
            }
            
            if (visible) {
                emergencyPanelRetry.style.setProperty('display', 'block', 'important');
                emergencyPanelRetry.style.setProperty('position', 'fixed', 'important');
                emergencyPanelRetry.style.setProperty('top', '50px', 'important');
                emergencyPanelRetry.style.setProperty('right', '50px', 'important');
                emergencyPanelRetry.style.setProperty('z-index', '999999', 'important'); 
                emergencyPanelRetry.style.setProperty('background-color', 'rgba(255, 0, 0, 0.85)', 'important');
                emergencyPanelRetry.style.setProperty('border', '2px solid white', 'important');
                console.log('[MiningPanelTab-DIAGNOSTIC] Applied AGGRESSIVE VISIBLE styles (increased z-index) to emergency panel.');
            } else {
                emergencyPanelRetry.style.setProperty('display', 'none', 'important');
                console.log('[MiningPanelTab-DIAGNOSTIC] Set emergency panel to HIDDEN.');
            }
            return;
        }
        
        // Original panel found - apply visibility setting
        if (visible) {
            emergencyPanel.style.setProperty('display', 'block', 'important');
            emergencyPanel.style.setProperty('position', 'fixed', 'important');
            emergencyPanel.style.setProperty('top', '50px', 'important');
            emergencyPanel.style.setProperty('right', '50px', 'important');
            emergencyPanel.style.setProperty('z-index', '999999', 'important');
            emergencyPanel.style.setProperty('background-color', 'rgba(255, 0, 0, 0.85)', 'important');
            emergencyPanel.style.setProperty('border', '2px solid white', 'important');
            console.log('[MiningPanelTab-DIAGNOSTIC] Applied AGGRESSIVE VISIBLE styles (increased z-index) to emergency panel.');
        } else {
            emergencyPanel.style.setProperty('display', 'none', 'important');
            console.log('[MiningPanelTab-DIAGNOSTIC] Set emergency panel to HIDDEN.');
        }
    },
    updateMiningPanelWithCurrentChunkData: () => {
        logThrottled('MINING_PANEL_UPDATE_CHUNK', 2000, '[MiningPanelTab-DIAGNOSTIC] updateMiningPanelWithCurrentChunkData CALLED');
        ensureMiningPanelElementsExist();
    }
};

logThrottled('MINING_PANEL_DIAG_ASSIGN', 5000, '[MiningPanelTab-DIAGNOSTIC] GLOBAL UTILITIES ASSIGNED. window.miningPanelTabUtils should now be available.');

export function createMiningPanelTab(dependencies?: MiningTabDependencies) { // Accept optional dependencies
    logThrottled('MINING_PANEL_CREATE', 2000, '[MiningPanelTab-DIAGNOSTIC] createMiningPanelTab FUNCTION CALLED.', dependencies ? 'with dependencies' : 'without dependencies');
    
    // Check if the actual emergency panel shell is in the DOM, not just the flag.
    const emergencyShellExists = !!document.getElementById('emergency-mining-panel');

    if (emergencyShellExists) {
        logThrottled('MINING_PANEL_EMERGENCY_DETECT', 2000, '[MiningPanelTab-DIAGNOSTIC] Emergency panel shell detected in DOM by createMiningPanelTab, returning a reference wrapper div.');
        const wrapper = document.createElement('div');
        wrapper.innerHTML = '<p>Mining panel elements were created in emergency mode. See fixed panel on screen.</p>';
        return wrapper;
    }
    
    // The diagnostic version doesn't use dependencies, but accepts them to match the caller.
    const container = document.createElement('div');
    container.innerHTML = `<h4>Mining Info (DIAGNOSTIC - All Imports Disabled)</h4>
                           <p>This panel is for testing script execution.</p>
                           <div id="diagnostic-hover-info">Hover data will appear here if utils are working.</div>
                           <div id="diagnostic-brush-info">Brush chunk data will appear here if utils are working.</div>`;
    return container;
}

export function updateMiningPanelTab() { // Stub for this diagnostic version
    logThrottled('MINING_PANEL_UPDATE', 2000, '[MiningPanelTab-DIAGNOSTIC] updateMiningPanelTab FUNCTION CALLED.');
    ensureMiningPanelElementsExist();
}

// Minimal dependencies interface for this diagnostic version
export interface MiningTabDependencies {
    topElements?: any; 
    noiseScale?: number;
    planetOffset?: any; 
    chunkSize?: number;
}

logThrottled('MINING_PANEL_DIAG_FINISHED', 5000, '[MiningPanelTab-DIAGNOSTIC] Script execution finished.');
