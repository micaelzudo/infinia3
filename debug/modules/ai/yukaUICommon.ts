// Shared UI utilities for Yuka AI debug interface
// Consolidates common patterns across UI section files

export const BUTTON_STYLE = 'margin: 0 6px 6px 0; padding: 4px 10px; border-radius: 6px; border: none; background: #444; color: #fff; font-size: 13px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transition: background 0.2s;';

export interface UISection {
    sectionDiv: HTMLDivElement;
    contentDiv: HTMLDivElement;
    titleEl: HTMLElement;
}

export interface UIButton {
    button: HTMLButtonElement;
    updateText: (text: string) => void;
    setEnabled: (enabled: boolean) => void;
}

/**
 * Creates a standardized UI section with consistent styling and collapse/expand functionality
 * This consolidates the redundant code across all uiSection*.ts files
 */
export function createUISection(title: string, collapsible: boolean = true): UISection {
    const sectionDiv = document.createElement('div');
    sectionDiv.style.cssText = `
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(70,80,90,0.5);
        transition: all 0.3s ease;
    `;

    const titleEl = document.createElement('h3');
    titleEl.innerText = title;
    titleEl.style.cssText = `
        margin: 0 0 10px 0;
        color: #66fcf1;
        font-size: 16px;
        border-bottom: 1px solid #45a29e;
        padding-bottom: 5px;
        cursor: ${collapsible ? 'pointer' : 'default'};
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.2s ease;
    `;

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
        padding-left: 5px;
        transition: all 0.3s ease;
        opacity: 1;
        max-height: 1000px;
        overflow: hidden;
    `;

    if (collapsible) {
        // Add collapse/expand icon
        const icon = document.createElement('span');
        icon.innerHTML = '▼';
        icon.style.cssText = `
            font-size: 12px;
            transition: transform 0.3s ease;
        `;
        titleEl.appendChild(icon);

        // Add collapse/expand functionality
        let isCollapsed = false;
        titleEl.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            if (isCollapsed) {
                contentDiv.style.opacity = '0';
                contentDiv.style.maxHeight = '0';
                icon.style.transform = 'rotate(-90deg)';
                titleEl.style.color = '#45a29e';
            } else {
                contentDiv.style.opacity = '1';
                contentDiv.style.maxHeight = '1000px';
                icon.style.transform = 'rotate(0deg)';
                titleEl.style.color = '#66fcf1';
            }
        });

        // Hover effects
        titleEl.addEventListener('mouseenter', () => {
            if (!isCollapsed) {
                titleEl.style.color = '#7ffff3';
            }
        });

        titleEl.addEventListener('mouseleave', () => {
            if (!isCollapsed) {
                titleEl.style.color = '#66fcf1';
            }
        });
    }

    sectionDiv.appendChild(titleEl);
    sectionDiv.appendChild(contentDiv);

    return { sectionDiv, contentDiv, titleEl };
}

/**
 * Creates a standardized info section container with icon and title
 */
export function createInfoSection(title: string, icon: string): HTMLDivElement {
    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 12px;
        padding: 8px;
        background: rgba(102,252,241,0.05);
        border-radius: 6px;
        border: 1px solid rgba(102,252,241,0.1);
    `;

    const sectionTitle = document.createElement('div');
    sectionTitle.style.cssText = `
        color: #a7c0c9;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    sectionTitle.innerHTML = `
        <span style="font-size: 14px;">${icon}</span>
        ${title}
    `;
    section.appendChild(sectionTitle);

    return section;
}

/**
 * Creates a standardized styled input field
 */
export function createStyledInput(type: string = 'text', placeholder?: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = type;
    if (placeholder) input.placeholder = placeholder;
    
    input.style.cssText = `
        width: 100%;
        background: rgba(102,252,241,0.1);
        border: 1px solid rgba(102,252,241,0.3);
        color: #66fcf1;
        padding: 6px 8px;
        border-radius: 4px;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        transition: all 0.2s ease;
    `;

    input.addEventListener('focus', () => {
        input.style.borderColor = '#66fcf1';
        input.style.boxShadow = '0 0 5px rgba(102, 252, 241, 0.3)';
    });

    input.addEventListener('blur', () => {
        input.style.borderColor = 'rgba(102,252,241,0.3)';
        input.style.boxShadow = 'none';
    });

    return input;
}

/**
 * Creates a standardized select dropdown
 */
export function createStyledSelect(): HTMLSelectElement {
    const select = document.createElement('select');
    
    select.style.cssText = `
        width: 100%;
        background: rgba(102,252,241,0.1);
        border: 1px solid rgba(102,252,241,0.3);
        color: #66fcf1;
        padding: 8px;
        border-radius: 4px;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2366fcf1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
        padding-right: 32px;
    `;

    select.addEventListener('focus', () => {
        select.style.borderColor = '#66fcf1';
    });

    select.addEventListener('blur', () => {
        select.style.borderColor = 'rgba(102,252,241,0.3)';
    });

    return select;
}

/**
 * Creates a standardized info display element
 */
export function createInfoDisplay(label: string, initialValue: string = 'N/A'): { container: HTMLDivElement, valueElement: HTMLSpanElement, updateValue: (value: string) => void } {
    const container = document.createElement('div');
    container.style.cssText = `
        color: #66fcf1;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    const labelElement = document.createElement('span');
    labelElement.innerText = label;
    labelElement.style.color = '#a7c0c9';

    const valueElement = document.createElement('span');
    valueElement.innerText = initialValue;
    valueElement.style.color = '#66fcf1';

    container.appendChild(labelElement);
    container.appendChild(valueElement);

    const updateValue = (value: string) => {
        valueElement.innerText = value;
    };

    return { container, valueElement, updateValue };
}

export function createStyledButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.setAttribute('style', BUTTON_STYLE);
    btn.onclick = onClick;
    return btn;
}

/**
 * Enhanced button creation with additional functionality
 */
export function createEnhancedButton(text: string, onClick: () => void, style?: Partial<CSSStyleDeclaration>): UIButton {
    const button = document.createElement('button');
    button.innerText = text;
    
    const defaultStyle = {
        padding: '8px 12px',
        margin: '4px 2px',
        backgroundColor: 'rgba(102,252,241,0.1)',
        color: '#66fcf1',
        border: '1px solid rgba(102,252,241,0.3)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'Roboto Mono, monospace',
        transition: 'all 0.2s ease',
        minWidth: '80px'
    };

    // Apply default styles
    Object.assign(button.style, defaultStyle, style);

    // Add hover effects
    button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
            button.style.backgroundColor = 'rgba(102,252,241,0.2)';
            button.style.borderColor = '#66fcf1';
        }
    });

    button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
            button.style.backgroundColor = 'rgba(102,252,241,0.1)';
            button.style.borderColor = 'rgba(102,252,241,0.3)';
        }
    });

    button.addEventListener('click', onClick);

    const updateText = (newText: string) => {
        button.innerText = newText;
    };

    const setEnabled = (enabled: boolean) => {
        button.disabled = !enabled;
        if (enabled) {
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        } else {
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
            button.style.backgroundColor = 'rgba(102,252,241,0.05)';
        }
    };

    return { button, updateText, setEnabled };
}

/**
 * Utility functions for formatting display values
 */
export function formatVector3(vector: { x: number, y: number, z: number }): string {
    return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)})`;
}

export function formatNumber(value: number, decimals: number = 2): string {
    return value.toFixed(decimals);
}