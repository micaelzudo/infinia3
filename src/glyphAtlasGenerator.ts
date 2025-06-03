import * as THREE from 'three';

export interface GlyphAtlas {
    texture: THREE.Texture;
    metadata: {
        atlasSize: { width: number; height: number }; // Total pixels
        gridSize: { cols: number; rows: number };    // Grid dimensions
        glyphSize: { width: number; height: number }; // Pixels per glyph
        charset: string;
        glyphUVs: { [char: string]: { u: number; v: number; u2: number; v2: number } }; // UV rect per char
    };
}

// Simple Katakana subset + numbers + symbols for Matrix effect
export const DEFAULT_CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{};':\",./<>?`~"; // Exported
//const DEFAULT_CHARSET = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";


/**
 * Creates a texture atlas containing specified characters.
 * @param charset The string of characters to include in the atlas.
 * @param fontSize The pixel font size to render characters at.
 * @param fontName The CSS font name to use (must be loaded).
 * @param atlasWidth Desired width of the atlas texture (power of 2 recommended).
 * @param atlasHeight Desired height of the atlas texture (power of 2 recommended).
 * @param textColor CSS color for the glyphs.
 * @returns GlyphAtlas object containing the texture and metadata, or null on error.
 */
export function createGlyphAtlasTexture(
    charset: string = DEFAULT_CHARSET,
    fontSize: number = 32, // Base size, might need adjustment
    fontName: string = 'monospace', // Generic fallback
    atlasWidth: number = 512,
    atlasHeight: number = 512,
    textColor: string = 'white'
): GlyphAtlas | null {
    const canvas = document.createElement('canvas');
    canvas.width = atlasWidth;
    canvas.height = atlasHeight;
    const context = canvas.getContext('2d');

    if (!context) {
        console.error("Failed to get 2D context for glyph atlas");
        return null;
    }

    // Clear canvas (transparent background)
    context.clearRect(0, 0, atlasWidth, atlasHeight);

    // --- Calculate grid layout ---
    // Estimate glyph size (can be inaccurate, adjust if needed)
    context.font = `${fontSize}px ${fontName}`;
    context.textAlign = 'left';
    context.textBaseline = 'top'; // Draw from top-left

    // Measure a representative character like 'M' or 'W' for width, use fontSize for height approx
    const metrics = context.measureText('W');
    // Add padding around each glyph
    const padding = Math.ceil(fontSize * 0.2);
    const glyphWidth = Math.ceil(metrics.width) + padding * 2;
    const glyphHeight = Math.ceil(fontSize * 1.2) + padding * 2; // Approx height + padding

    if (glyphWidth <= 0 || glyphHeight <= 0) {
         console.error("Calculated glyph size is invalid:", glyphWidth, glyphHeight);
         return null;
    }

    const cols = Math.floor(atlasWidth / glyphWidth);
    const rows = Math.floor(atlasHeight / glyphHeight);
    const numCells = cols * rows;

    if (charset.length > numCells) {
        console.warn(`Charset (${charset.length} chars) exceeds atlas capacity (${numCells} cells). Truncating.`);
        charset = charset.substring(0, numCells);
    }
     if (cols === 0 || rows === 0) {
        console.error("Atlas size too small for calculated glyph size.");
        return null;
    }


    // --- Draw glyphs and record UVs ---
    context.fillStyle = textColor;
    context.font = `${fontSize}px ${fontName}`; // Re-set font for drawing
    context.textAlign = 'center'; // Center within cell
    context.textBaseline = 'middle';// Center within cell

    const glyphUVs: { [char: string]: { u: number; v: number; u2: number; v2: number } } = {};

    for (let i = 0; i < charset.length; i++) {
        const char = charset[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        const cellX = col * glyphWidth;
        const cellY = row * glyphHeight;

        // Calculate center point of the cell for drawing
        const drawX = cellX + glyphWidth / 2;
        const drawY = cellY + glyphHeight / 2;

        // Draw the character centered in its cell
        context.fillText(char, drawX, drawY);

        // Calculate UV coordinates for this glyph (normalized 0-1)
        const u = cellX / atlasWidth;
        const v = cellY / atlasHeight;
        const u2 = (cellX + glyphWidth) / atlasWidth;
        const v2 = (cellY + glyphHeight) / atlasHeight;
        glyphUVs[char] = { u, v, u2, v2 };
    }

    // --- Create Texture ---
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.NearestFilter; // DEBUG: Use NearestFilter
    texture.magFilter = THREE.NearestFilter; // DEBUG: Use NearestFilter
    // texture.colorSpace = THREE.SRGBColorSpace; // Removed for compatibility

    console.log(`Generated glyph atlas: ${cols}x${rows} grid, ${charset.length} chars.`);

    return {
        texture,
        metadata: {
            atlasSize: { width: atlasWidth, height: atlasHeight },
            gridSize: { cols, rows },
            glyphSize: { width: glyphWidth, height: glyphHeight },
            charset,
            glyphUVs,
        },
    };
} 