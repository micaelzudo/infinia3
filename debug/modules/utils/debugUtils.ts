import * as THREE from 'three';

/**
 * Helper function to create text sprites using Canvas 2D API.
 * 
 * Parameters object can include:
 * - fontface (string, default: 'Arial')
 * - fontsize (number, default: 18)
 * - borderThickness (number, default: 4)
 * - borderColor (object {r,g,b,a}, default: black)
 * - backgroundColor (object {r,g,b,a}, default: white)
 * - textColor (object {r,g,b,a}, default: black)
 */
export function createTextSprite(message: string, parameters: any = {}): THREE.Sprite | null {
    const fontface = parameters.fontface || 'Arial';
    const fontsize = parameters.fontsize || 18;
    const borderThickness = parameters.borderThickness || 4;
    const borderColor = parameters.borderColor || { r: 0, g: 0, b: 0, a: 1.0 };
    const backgroundColor = parameters.backgroundColor || { r: 255, g: 255, b: 255, a: 1.0 };
    const textColor = parameters.textColor || { r: 0, g: 0, b: 0, a: 1.0 };

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        console.error("Failed to get 2D context for text sprite");
        return null; // Return null if context fails
    }
    
    context.font = "Bold " + fontsize + "px " + fontface;

    // get size data (summed widths of letters)
    const metrics = context.measureText(message);
    const textWidth = metrics.width;

    // Adjust canvas size for border and padding
    canvas.width = textWidth + borderThickness * 2 + 10; // Add padding
    canvas.height = fontsize * 1.4 + borderThickness * 2; // Approximate height + border
    context.font = "Bold " + fontsize + "px " + fontface; // Re-set font after resize

    // background color
    context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
    // border color
    context.strokeStyle = `rgba(${borderColor.r},${borderColor.g},${borderColor.b},${borderColor.a})`;
    context.lineWidth = borderThickness;
    
    // Simple rect for background and border
    context.fillRect(borderThickness / 2, borderThickness / 2, canvas.width - borderThickness, canvas.height - borderThickness);
    context.strokeRect(borderThickness / 2, borderThickness / 2, canvas.width - borderThickness, canvas.height - borderThickness);

    // text color
    context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, 1.0)`;
    // Adjust text position for padding and baseline
    context.textBaseline = 'middle'; // Align vertically better
    context.fillText(message, borderThickness + 5, canvas.height / 2); 

    // canvas contents will be used for a texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);

    // Scale sprite proportional to canvas size to maintain aspect ratio
    const aspectRatio = canvas.width / canvas.height;
    const spriteHeight = 0.5; // Adjust overall size of sprite in scene units
    sprite.scale.set(spriteHeight * aspectRatio, spriteHeight, 1);

    return sprite;
}

// Example of another potential debug utility
export function createDebugArrow(
    origin: THREE.Vector3, 
    direction: THREE.Vector3, 
    length: number, 
    color: number | string, 
    headLength?: number, 
    headWidth?: number
): THREE.ArrowHelper {
    const dir = direction.clone().normalize();
    return new THREE.ArrowHelper(dir, origin, length, color, headLength, headWidth);
} 