import * as THREE from 'three';
// Remove THREE.FontLoader imports if no longer needed directly here
// import { FontLoader, Font as ThreeFont } from 'three/examples/jsm/loaders/FontLoader.js'; 
import * as opentype from 'opentype.js'; // Import opentype.js

/**
 * Loads a specific font using the FontFace API.
 * @param fontFamily The desired CSS font-family name.
 * @param fontUrl The URL of the font file (obtained via import).
 * @returns Promise<boolean> indicating success or failure.
 */
export async function loadFont(fontFamily: string, fontUrl: string): Promise<boolean> {
    try {
        // Check if the font might already be loaded by the browser
        // Note: document.fonts.check() might be unreliable before first load attempt
        // if (document.fonts.check(`1em ${fontFamily}`)) {
        //     console.log(`Font "${fontFamily}" already available.`);
        //     return true;
        // }

        // Create a new FontFace object using the resolved URL
        const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
        
        // Wait for the font to load
        const loadedFace = await fontFace.load();
        
        // Add the font to the document's font set (using 'any' cast to bypass type error)
        (document.fonts as any).add(loadedFace);
        
        console.log(`Font "${fontFamily}" loaded successfully from URL!`);
        return true;
    } catch (error) {
        console.error(`Failed to load font "${fontFamily}" from URL ${fontUrl}:`, error);
        return false;
    }
}

// Adapted from REFERENCE/src/canvasTextRenderer.ts

// Font configurations - update to store opentype.Font
export interface FontConfig {
    name: string;       // CSS font-family name
    path: string;       // Path to font file
    format: string;     // 'otf' or 'ttf'
    displayName: string; // Name for logging
    type: 'matrix' | 'alien'; // Type of font for categorization
    loadedFont?: opentype.Font; // Store the loaded opentype.Font object
}

// List of available fonts - Include all fonts from the reference implementation
export const FONTS: FontConfig[] = [
    // Matrix font (primary for matrix rain effect)
    {
        name: 'MatrixCodeNFI', 
        path: '/fonts/matrix code nfi.ttf',
        format: 'ttf',
        displayName: 'Matrix Code NFI',
        type: 'matrix'
    },
    // Alien fonts (from the reference implementation)
    {
        name: 'AlienAlphabet',
        path: '/fonts/AlienAlphabet-nRRqJ.otf',
        format: 'otf',
        displayName: 'Alien Alphabet',
        type: 'alien'
    },
    {
        name: 'WereAlien',
        path: '/fonts/wearealien.ttf',
        format: 'ttf',
        displayName: 'Were Alien',
        type: 'alien'
    },
    {
        name: 'AlienClassic',
        path: '/fonts/alien.ttf',
        format: 'ttf',
        displayName: 'Alien Classic',
        type: 'alien'
    },
    {
        name: 'NeotriadFree',
        path: '/fonts/NeotriadFree-1jzAg.otf',
        format: 'otf',
        displayName: 'Neotriad Free',
        type: 'alien'
    },
    {
        name: 'DochetScript',
        path: '/fonts/DochetScript-Regular.ttf',
        format: 'ttf',
        displayName: 'Dochet Script',
        type: 'alien'
    },
    {
        name: 'AlphacodeBeyond',
        path: '/fonts/AlphacodeBeyond-Regular.ttf',
        format: 'ttf',
        displayName: 'Alphacode Beyond',
        type: 'alien'
    },
    {
        name: 'Dugun',
        path: '/fonts/Dugun.otf',
        format: 'otf',
        displayName: 'Dugun',
        type: 'alien'
    },
    {
        name: 'Glubgraff',
        path: '/fonts/Glubgraff.ttf',
        format: 'ttf',
        displayName: 'Glubgraff',
        type: 'alien'
    },
    {
        name: 'TheCalling',
        path: '/fonts/TheCalling.ttf',
        format: 'ttf',
        displayName: 'The Calling',
        type: 'alien'
    },
    {
        name: 'LSWDrachenklaue',
        path: '/fonts/LSW-Drachenklaue-Samys-0.1.otf',
        format: 'otf',
        displayName: 'LSW Drachenklaue',
        type: 'alien'
    },
    {
        name: 'AlienS',
        path: '/fonts/Alien_S.ttf',
        format: 'ttf',
        displayName: 'Alien S',
        type: 'alien'
    },
    {
        name: 'Sprykski',
        path: '/fonts/Sprykski.otf',
        format: 'otf',
        displayName: 'Sprykski',
        type: 'alien'
    },
    {
        name: 'TemphisDirty',
        path: '/fonts/Temphis Dirty.ttf',
        format: 'ttf',
        displayName: 'Temphis Dirty',
        type: 'alien'
    },
    {
        name: 'Echolot',
        path: '/fonts/Echolot.ttf',
        format: 'ttf',
        displayName: 'Echolot',
        type: 'alien'
    },
    {
        name: 'TemphisKnotwork',
        path: '/fonts/Temphis Knotwork.ttf',
        format: 'ttf',
        displayName: 'Temphis Knotwork',
        type: 'alien'
    },
    {
        name: 'TemphisBrick',
        path: '/fonts/Temphis Brick.ttf',
        format: 'ttf',
        displayName: 'Temphis Brick',
        type: 'alien'
    },
    {
        name: 'TemphisSweatermonkey',
        path: '/fonts/Temphis Sweatermonkey.ttf',
        format: 'ttf',
        displayName: 'Temphis Sweatermonkey',
        type: 'alien'
    },
    {
        name: 'Roswreck',
        path: '/fonts/roswreck.ttf',
        format: 'ttf',
        displayName: 'Roswreck',
        type: 'alien'
    },
    {
        name: 'LovecraftsDiary',
        path: "/fonts/Lovecraft's Diary.ttf",
        format: 'ttf',
        displayName: "Lovecraft's Diary",
        type: 'alien'
    }
];

// Store loaded opentype.Font objects
const loadedOpentypeFonts: { [name: string]: opentype.Font } = {};

// Default font for matrix rain
export const MATRIX_FONT = FONTS[0];

/**
 * Gets a random font from the available fonts
 * @param type Optional font type to filter by
 * @returns Random font configuration
 */
export function getRandomFont(type?: 'matrix' | 'alien'): FontConfig {
    let availableFonts = FONTS;
    
    if (type) {
        availableFonts = FONTS.filter(font => font.type === type);
    }
    
    if (availableFonts.length === 0) {
        console.warn(`No fonts available for type ${type}, returning default matrix font`);
        return MATRIX_FONT;
    }
    
    const randomIndex = Math.floor(Math.random() * availableFonts.length);
    return availableFonts[randomIndex];
}

/**
 * Gets a font by name
 * @param name The name of the font to retrieve
 * @returns The font configuration or null if not found
 */
export function getFontByName(name: string): FontConfig | null {
    const font = FONTS.find(f => f.name === name);
    return font || null;
}

/**
 * Loads fonts defined in the FONTS array using opentype.js.
 * @returns Promise that resolves when all fonts are attempted.
 */
export async function loadFonts(): Promise<boolean> {
    const fontsToLoad = FONTS;
    if (fontsToLoad.length === 0) {
        console.warn("[FontLoader] No fonts defined in the FONTS array. Skipping load.");
        return true;
    }

    console.log(`%c[FontLoader] Attempting to load ${fontsToLoad.length} font(s) using opentype.js...`, 'color: yellow; font-weight: bold;');

    let successCount = 0;
    let failureCount = 0;

    const fontLoadPromises = fontsToLoad.map(fontConfig => 
        new Promise<void>((resolve) => { // Wrap in promise for Promise.all
            opentype.load(fontConfig.path, (err, font) => {
                if (err || !font) {
                    console.error(`  [FontLoader] Failed to load font "${fontConfig.displayName}" using opentype.js: ${err}`);
                    failureCount++;
                } else {
                    console.log(`  [FontLoader] Font "${fontConfig.displayName}" loaded successfully using opentype.js!`);
                    loadedOpentypeFonts[fontConfig.name] = font; // Store loaded opentype.Font
                    fontConfig.loadedFont = font; // Also store in config for easier access
                    successCount++;
                }
                resolve(); // Resolve the promise regardless of success/failure
            });
        })
    );

    try {
        await Promise.all(fontLoadPromises);

        console.log(`%c[FontLoader] Opentype font loading complete. Success: ${successCount}, Failed: ${failureCount}`, successCount > 0 ? 'color: lightgreen;' : 'color: orange;');
        
        // Check if any essential fonts failed (e.g., the first alien font)
        if (!loadedOpentypeFonts[FONTS[1].name]) { // Assuming index 1 is the first alien font
            console.warn("[FontLoader] WARNING: Failed to load the primary alien font for extrusion. Text might not render.");
            // Decide if this should be considered a failure
        }

        return successCount > 0; // Return true if at least one font loaded

    } catch (error) {
        console.error("[FontLoader] Global error during opentype font loading process:", error);
        return false;
    }
}

/**
 * Gets a loaded opentype.Font object by its CSS name.
 * @param name The CSS font-family name (e.g., 'AlienClassic')
 * @returns The loaded opentype.Font or undefined if not loaded.
 */
export function getLoadedFont(name: string): opentype.Font | undefined {
    return loadedOpentypeFonts[name];
}

// Optional: Add functions to get available fonts or set current font if needed later
export function getAvailableFonts(type?: 'matrix' | 'alien'): FontConfig[] {
    if (type) {
        return FONTS.filter(font => font.type === type);
    }
    return FONTS;
}

/**
 * Creates planet name in alien language
 * @param length Length of the name (default: 4-8 characters)
 * @returns String containing a random alien planet name
 */
export function generateAlienPlanetName(length?: number): string {
    // If no length provided, choose a random length between 4-8
    const nameLength = length || 4 + Math.floor(Math.random() * 5);
    
    // Characters to use for alien names (adapted from reference)
    const consonants = 'bdfghjklmnprstvxz';
    const vowels = 'aeiou';
    const specialChars = "'`-";
    
    let name = '';
    let useVowel = Math.random() > 0.5; // Randomly start with vowel or consonant
    
    for (let i = 0; i < nameLength; i++) {
        // Small chance to add special character, but never at the start or end
        if (i > 0 && i < nameLength - 1 && Math.random() < 0.1) {
            name += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
            continue;
        }
        
        if (useVowel) {
            name += vowels.charAt(Math.floor(Math.random() * vowels.length));
        } else {
            name += consonants.charAt(Math.floor(Math.random() * consonants.length));
        }
        
        // Alternate between vowels and consonants with some randomness
        useVowel = Math.random() < (useVowel ? 0.8 : 0.7) ? !useVowel : useVowel;
    }
    
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
} 