import { createUISection, createEnhancedButton } from './yukaUICommon';

export function createGeneralControlsSection(
    onTogglePause: () => void,
    onToggleAIControl: () => void
): {
    sectionDiv: HTMLDivElement,
    pauseBtn: HTMLButtonElement,
    aiControlBtn: HTMLButtonElement
} {
    const { sectionDiv, contentDiv } = createUISection('General Controls', true);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Pause/Resume button
    const { button: pauseBtn, updateText: updatePauseText } = createEnhancedButton('⏸️ Pause System', onTogglePause);
    buttonContainer.appendChild(pauseBtn);

    // AI Control toggle button
    const { button: aiControlBtn, updateText: updateAIControlText } = createEnhancedButton('🤖 Toggle AI Control', onToggleAIControl);
    buttonContainer.appendChild(aiControlBtn);

    return { sectionDiv, pauseBtn, aiControlBtn };
}