/**
 * Updates the instruction text display based on the current control mode.
 * @param isFirstPerson True if first-person mode is active, false otherwise.
 */
export function updateInstructions(isFirstPerson: boolean) {
    const instructionsDiv = document.getElementById('instructions');
    if (!instructionsDiv) {
        // If the game controls haven't been created yet, this might be null.
        // console.warn("Instructions div not found during update!"); 
        return;
    }

    if (isFirstPerson) {
        instructionsDiv.innerHTML = ` 
            <strong>First Person Controls:</strong><br>
            WASD / Arrow Keys: Move<br>
            Mouse: Look around<br>
            Space: Jump<br>
            Shift: Sprint<br>
            ESC: Exit mode
        `;
    } else {
        instructionsDiv.innerHTML = `
            <strong>Orbit Controls:</strong><br>
            Left Mouse: Add terrain<br>
            Right Mouse: Remove terrain<br>
            Mouse Wheel: Zoom<br>
            Drag: Rotate view
        `;
    }
} 