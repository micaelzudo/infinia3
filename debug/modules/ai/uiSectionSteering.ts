import { createUISection, createEnhancedButton } from './yukaUICommon';

export function createSteeringSection(
    onToggleForces: () => void,
    onToggleBehaviors: () => void
): {
    sectionDiv: HTMLDivElement,
    toggleForcesBtn: HTMLButtonElement,
    toggleBehaviorsBtn: HTMLButtonElement,
    behaviorsList: HTMLElement
} {
    const { sectionDiv, contentDiv } = createUISection('Steering', true);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Create enhanced buttons
    const { button: toggleForcesBtn } = createEnhancedButton('→ Toggle Force Arrows', onToggleForces);
    const { button: toggleBehaviorsBtn } = createEnhancedButton('⚡ Toggle Behaviors', onToggleBehaviors);

    buttonContainer.appendChild(toggleForcesBtn);
    buttonContainer.appendChild(toggleBehaviorsBtn);

    // Enhanced behaviors list
    const behaviorsList = document.createElement('div');
    behaviorsList.style.cssText = `
        margin-top: 12px;
        padding: 8px;
        background: rgba(102,252,241,0.05);
        border-radius: 6px;
        border: 1px solid rgba(102,252,241,0.1);
    `;

    const behaviorsTitle = document.createElement('div');
    behaviorsTitle.style.cssText = `
        color: #a7c0c9;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    behaviorsTitle.innerHTML = `
        <span style="font-size: 14px;">📋</span>
        Active Behaviors
    `;
    behaviorsList.appendChild(behaviorsTitle);

    const behaviorsContent = document.createElement('div');
    behaviorsContent.style.cssText = `
        color: #66fcf1;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        line-height: 1.6;
    `;
    behaviorsContent.innerText = 'No active behaviors';
    behaviorsList.appendChild(behaviorsContent);

    contentDiv.appendChild(behaviorsList);

    return { 
        sectionDiv, 
        toggleForcesBtn, 
        toggleBehaviorsBtn, 
        behaviorsList: behaviorsContent 
    };
}