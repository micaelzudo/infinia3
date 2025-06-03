import { createUISection, createEnhancedButton } from './yukaUICommon';

export function createStateMachineSection(
    onToggleStateViz: () => void,
    onToggleGraphViz: () => void
): {
    sectionDiv: HTMLDivElement,
    toggleStateVizBtn: HTMLButtonElement,
    toggleGraphVizBtn: HTMLButtonElement,
    stateInfo: HTMLElement
} {
    const { sectionDiv, contentDiv, titleEl } = createUISection('State Machine', true);
    sectionDiv.appendChild(contentDiv);

    // Create button container for better layout
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Create enhanced buttons
    const { button: toggleStateVizBtn } = createEnhancedButton('📝 Toggle State Text', onToggleStateViz, { flex: '1' });
    const { button: toggleGraphVizBtn } = createEnhancedButton('📊 Toggle Graph', onToggleGraphViz, { flex: '1' });

    buttonContainer.appendChild(toggleStateVizBtn);
    buttonContainer.appendChild(toggleGraphVizBtn);

    // Enhanced state info display
    const stateInfo = document.createElement('div');
    stateInfo.style.cssText = `
        margin-top: 12px;
        padding: 8px;
        background: rgba(102,252,241,0.05);
        border-radius: 6px;
        border: 1px solid rgba(102,252,241,0.1);
    `;

    const stateTitle = document.createElement('div');
    stateTitle.style.cssText = `
        color: #a7c0c9;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    stateTitle.innerHTML = `
        <span style="font-size: 14px;">🔄</span>
        Current State
    `;
    stateInfo.appendChild(stateTitle);

    const stateContent = document.createElement('div');
    stateContent.style.cssText = `
        color: #66fcf1;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        line-height: 1.6;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    stateContent.innerHTML = `
        <span style="
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #66fcf1;
            border-radius: 50%;
            animation: pulse 2s infinite;
        "></span>
        <span>No state machine active</span>
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    stateInfo.appendChild(stateContent);
    contentDiv.appendChild(stateInfo);



    return { 
        sectionDiv, 
        toggleStateVizBtn, 
        toggleGraphVizBtn, 
        stateInfo: stateContent 
    };
}