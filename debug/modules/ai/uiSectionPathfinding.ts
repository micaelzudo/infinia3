import { createUISection, createEnhancedButton } from './yukaUICommon';

export function createPathfindingSection(
    onTogglePath: () => void,
    onSetDestination: () => void,
    onToggleClickToMove: () => void
): {
    sectionDiv: HTMLDivElement,
    togglePathBtn: HTMLButtonElement,
    setDestinationBtn: HTMLButtonElement,
    clickToMoveBtn: HTMLButtonElement,
    pathInfo: HTMLElement
} {
    const { sectionDiv, contentDiv } = createUISection('Pathfinding', true);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Create enhanced buttons
    const { button: togglePathBtn } = createEnhancedButton('🛣️ Toggle Path', onTogglePath);
    const { button: setDestinationBtn } = createEnhancedButton('🎯 Set Destination', onSetDestination);
    const { button: clickToMoveBtn } = createEnhancedButton('🖱️ Click to Move', onToggleClickToMove);

    buttonContainer.appendChild(togglePathBtn);
    buttonContainer.appendChild(setDestinationBtn);
    buttonContainer.appendChild(clickToMoveBtn);

    // Enhanced path info display
    const pathInfo = document.createElement('div');
    pathInfo.style.cssText = `
        margin-top: 12px;
        padding: 8px;
        background: rgba(102,252,241,0.05);
        border-radius: 6px;
        border: 1px solid rgba(102,252,241,0.1);
    `;

    const infoTitle = document.createElement('div');
    infoTitle.style.cssText = `
        color: #a7c0c9;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    infoTitle.innerHTML = `
        <span style="font-size: 14px;">📊</span>
        Path Info
    `;
    pathInfo.appendChild(infoTitle);

    const infoContent = document.createElement('div');
    infoContent.style.cssText = `
        color: #66fcf1;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        line-height: 1.6;
    `;

    // Create simple info displays
    const statusDisplay = document.createElement('div');
    statusDisplay.textContent = 'Status: No Path';
    
    const pointsDisplay = document.createElement('div');
    pointsDisplay.textContent = 'Points: 0';
    
    const distanceDisplay = document.createElement('div');
    distanceDisplay.textContent = 'Distance: 0.00';
    
    const modeDisplay = document.createElement('div');
    modeDisplay.textContent = 'Mode: Manual';

    infoContent.appendChild(statusDisplay);
    infoContent.appendChild(pointsDisplay);
    infoContent.appendChild(distanceDisplay);
    infoContent.appendChild(modeDisplay);
    
    pathInfo.appendChild(infoContent);
    contentDiv.appendChild(pathInfo);

    return {
        sectionDiv,
        togglePathBtn, 
        setDestinationBtn,
        clickToMoveBtn,
        pathInfo: infoContent 
    };
}