import { createUISection, createInfoDisplay, createInfoSection, createStyledInput, formatVector3, formatNumber } from './yukaUICommon';

export function createAgentInfoSection(
    onUpdateAgent: (property: string, value: any) => void
): {
    sectionDiv: HTMLDivElement,
    nameDisplay: HTMLElement,
    positionDisplay: HTMLElement,
    velocityDisplay: HTMLElement,
    maxSpeedInput: HTMLInputElement,
    massInput: HTMLInputElement,
    animationDisplay: HTMLElement,
    stateDisplay: HTMLElement,
    controlledByDisplay: HTMLElement
} {
    const { sectionDiv, contentDiv } = createUISection('Agent Info', true);

    // Basic Info Section
    const basicInfoSection = createInfoSection('Basic Info', '👤');
    const { container: nameContainer, valueElement: nameDisplay } = createInfoDisplay('Name:', 'N/A');
    basicInfoSection.appendChild(nameContainer);
    contentDiv.appendChild(basicInfoSection);

    // Position & Velocity Section
    const movementSection = createInfoSection('Movement', '🚀');
    const { container: positionContainer, valueElement: positionDisplay } = createInfoDisplay('Position:', 'N/A');
    const { container: velocityContainer, valueElement: velocityDisplay } = createInfoDisplay('Velocity:', 'N/A');
    movementSection.appendChild(positionContainer);
    movementSection.appendChild(velocityContainer);
    contentDiv.appendChild(movementSection);

    // Properties Section
    const propertiesSection = createInfoSection('Properties', '⚙️');
    
    const createPropertyInput = (label: string, property: string, initialValue: string) => {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        `;
        
        const labelEl = document.createElement('span');
        labelEl.style.color = '#a7c0c9';
        labelEl.textContent = label;
        
        const input = createStyledInput('number');
        input.value = initialValue;
        input.style.width = '80px';
        
        input.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            onUpdateAgent(property, parseFloat(target.value));
        });
        
        container.appendChild(labelEl);
        container.appendChild(input);
        return { container, input };
    };

    const { container: maxSpeedContainer, input: maxSpeedInput } = createPropertyInput('Max Speed:', 'maxSpeed', '1.0');
    const { container: massContainer, input: massInput } = createPropertyInput('Mass:', 'mass', '1.0');

    propertiesSection.appendChild(maxSpeedContainer);
    propertiesSection.appendChild(massContainer);
    contentDiv.appendChild(propertiesSection);

    // State Section
    const stateSection = createInfoSection('State', '🔄');
    const { container: stateContainer, valueElement: stateDisplay } = createInfoDisplay('Current State:', 'N/A');
    const { container: animationContainer, valueElement: animationDisplay } = createInfoDisplay('Animation:', 'N/A');
    const { container: controlledByContainer, valueElement: controlledByDisplay } = createInfoDisplay('Controlled By:', 'N/A');
    
    stateSection.appendChild(stateContainer);
    stateSection.appendChild(animationContainer);
    stateSection.appendChild(controlledByContainer);
    contentDiv.appendChild(stateSection);

    return {
        sectionDiv,
        nameDisplay,
        positionDisplay,
        velocityDisplay,
        maxSpeedInput,
        massInput,
        animationDisplay,
        stateDisplay,
        controlledByDisplay
    };
}