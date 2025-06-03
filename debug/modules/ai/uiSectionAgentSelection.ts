import { createUISection, createInfoSection, createStyledSelect, createEnhancedButton } from './yukaUICommon';

export function createAgentSelectionSection(
    onSpawnAgent: () => void,
    onRemoveAgent: () => void,
    onFollowAgent: () => void,
    onAgentSelect: (agentId: string) => void
): {
    sectionDiv: HTMLDivElement,
    agentSelect: HTMLSelectElement,
    spawnAgentBtn: HTMLButtonElement,
    removeAgentBtn: HTMLButtonElement,
    followAgentBtn: HTMLButtonElement
} {
    const { sectionDiv, contentDiv } = createUISection('Agent Selection', true);

    // Create agent selection container using shared utilities
    const selectContainer = createInfoSection('Select Agent', '👥');
    const agentSelect = createStyledSelect();
    agentSelect.onchange = (e) => onAgentSelect((e.target as HTMLSelectElement).value);
    selectContainer.appendChild(agentSelect);
    contentDiv.appendChild(selectContainer);

    // Create button container for better layout
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Create enhanced buttons with icons
    const { button: spawnAgentBtn } = createEnhancedButton('➕ Spawn Agent', onSpawnAgent, { flex: '1', minWidth: '120px' });
    const { button: removeAgentBtn } = createEnhancedButton('➖ Remove Agent', onRemoveAgent, { flex: '1', minWidth: '120px' });
    const { button: followAgentBtn } = createEnhancedButton('👁️ Follow Agent', onFollowAgent, { flex: '1', minWidth: '120px' });

    buttonContainer.appendChild(spawnAgentBtn);
    buttonContainer.appendChild(removeAgentBtn);
    buttonContainer.appendChild(followAgentBtn);

    // Add active state for follow button
    followAgentBtn.addEventListener('click', () => {
        const isActive = followAgentBtn.classList.toggle('active');
        followAgentBtn.style.backgroundColor = isActive ? 'rgba(102,252,241,0.2)' : 'rgba(102,252,241,0.1)';
        followAgentBtn.style.borderColor = isActive ? 'rgba(102,252,241,0.5)' : 'rgba(102,252,241,0.3)';
    });

    return { 
        sectionDiv, 
        agentSelect, 
        spawnAgentBtn, 
        removeAgentBtn, 
        followAgentBtn 
    };
}