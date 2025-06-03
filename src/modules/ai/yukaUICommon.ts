export const BUTTON_STYLE = {
    backgroundColor: '#4CAF50',
    border: 'none',
    color: 'white',
    padding: '10px 20px',
    textAlign: 'center',
    textDecoration: 'none',
    display: 'inline-block',
    fontSize: '14px',
    margin: '4px 2px',
    cursor: 'pointer',
    borderRadius: '4px',
    transition: 'background-color 0.3s ease',
    ':hover': {
        backgroundColor: '#45a049'
    },
    ':disabled': {
        backgroundColor: '#cccccc',
        cursor: 'not-allowed'
    }
};

export function createStyledButton(text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.backgroundColor = BUTTON_STYLE.backgroundColor;
    button.style.border = BUTTON_STYLE.border;
    button.style.color = BUTTON_STYLE.color;
    button.style.padding = BUTTON_STYLE.padding;
    button.style.textAlign = BUTTON_STYLE.textAlign;
    button.style.textDecoration = BUTTON_STYLE.textDecoration;
    button.style.display = BUTTON_STYLE.display;
    button.style.fontSize = BUTTON_STYLE.fontSize;
    button.style.margin = BUTTON_STYLE.margin;
    button.style.cursor = BUTTON_STYLE.cursor;
    button.style.borderRadius = BUTTON_STYLE.borderRadius;
    button.style.transition = BUTTON_STYLE.transition;

    button.addEventListener('mouseover', () => {
        button.style.backgroundColor = BUTTON_STYLE[':hover'].backgroundColor;
    });

    button.addEventListener('mouseout', () => {
        button.style.backgroundColor = BUTTON_STYLE.backgroundColor;
    });

    button.addEventListener('click', onClick);

    return button;
} 