import * as THREE from 'three';
// REMOVE: import { TunnelGrid } from '../core/tunnelGrid'; // Adjust path if needed
// ADD: Import necessary text rendering and font loading utilities
import { createExtrudedTextMesh } from '../canvasTextRenderer'; // Assuming this creates the 3D char mesh
import { FONTS, getLoadedFont, loadFonts, FontConfig } from '../utils/fontLoader'; // Font utilities
import { disposeObjectTree } from '../utils/disposeObjectTree'; // Helper for cleanup

// REMOVE: Shaders are no longer needed for this approach // User removed
// const matrixRainVertexShader = `...`;
// const matrixRainFragmentShader = `...`;

// --- Effect Class (Overhauled) ---

export interface MatrixRainOptions {
    glyphCount: number;     // Max number of GLYPHS (falling streams) to display
    glyphScale?: number;    // Base scale for the 3D character meshes
    fallSpeed?: number;     // Base speed for falling streams
    // REMOVE: Atlas/Layering specific options // User removed
    // glyphSize?: number;
    // layersPerGlyph?: number;
    // layerSpacing?: number;
    // trailColor?: THREE.Color; // Color handled by text mesh material
    // leadColor?: THREE.Color;  // Color handled by text mesh material
    // ADD: Options for 3D text rendering // User removed
    extrusionDepth?: number; // Depth for the 3D text
    characterSet?: string; // Characters to randomly choose from
}

// Interface to hold state for each falling character
interface FallingChar {
    meshGroup: THREE.Group | null; // Group holding the extruded character mesh(es)
    currentY: number;
    initialPos: THREE.Vector3;
    seed: number;
    currentColId: number; // Maybe useful for effects later
    currentChar: string;
}

export class MatrixRainEffect {
    public effectGroup: THREE.Group; // Changed from mesh: InstancedMesh to Group
    private options: Required<MatrixRainOptions>; // Make all options required internally after defaults
    private fallingChars: FallingChar[] = [];
    private availableFonts: FontConfig[] = [];
    private columnMap: Map<string, number> = new Map();
    private nextColumnId: number = 0;
    private isInitialized: boolean = false;

    // ADD: Track grid dimensions for respawning
    private gridMinY: number = -Infinity;
    private gridMaxY: number = Infinity;

    constructor(options: Partial<MatrixRainOptions> = {}) {
        // --- Default values ---
        const defaultOptions: Required<MatrixRainOptions> = {
            // glyphCount: 100, // DEBUG: Further reduce count drastically
            glyphCount: 5000, // Restore default count
            // glyphScale: 5.0,  // DEBUG: Increase scale significantly
            glyphScale: 0.5,  // Restore default scale
            fallSpeed: 10.0,  // Adjust fall speed as needed
            extrusionDepth: 0.1, // Default extrusion depth
            characterSet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", // Simple default
        };

        this.options = { ...defaultOptions, ...options };

        this.effectGroup = new THREE.Group();
        this.effectGroup.name = "matrixRainEffect_Extruded";

        console.log(`🌧️ Initializing MatrixRainEffect (Extruded Text) with max ${this.options.glyphCount} glyphs.`);

        // Asynchronous initialization
        this.initialize();
    }

    private async initialize() {
        try {
            // 1. Load necessary fonts (assuming loadFonts loads all from FONTS array)
            await loadFonts(); // Make sure fonts are loaded
            this.availableFonts = FONTS.filter(f => f.type === 'alien' && getLoadedFont(f.name));
            if (this.availableFonts.length === 0) {
                console.warn("No alien fonts loaded for MatrixRainEffect! Falling back to any loaded font.");
                this.availableFonts = FONTS.filter(f => getLoadedFont(f.name));
                if (this.availableFonts.length === 0) {
                    throw new Error("No fonts loaded at all!");
                }
            }
             console.log(`   Available fonts for rain: ${this.availableFonts.map(f => f.name).join(', ')}`);

            // 2. Set manual Y bounds (approximating tunnel)
            // TODO: Get these dynamically or pass via options if possible
            const approxTunnelLength = 2500; // Based on TUNNEL_SEGMENT_LENGTH in tunnel.js
            const approxTunnelRadius = 100; // Based on radius in tunnel.js
            // Assuming tunnel centered around Z=0 initially before segments shift
            this.gridMinY = -approxTunnelRadius * 0.9; // Slightly inside radius
            this.gridMaxY = approxTunnelRadius * 0.9;
            console.log(`   Using approximate Y bounds: min=${this.gridMinY.toFixed(2)}, max=${this.gridMaxY.toFixed(2)}`);

            // 3. Populate initial characters
            this.populateCharacters();

            this.isInitialized = true;
            console.log("   MatrixRainEffect (Extruded Text) initialized.");

        } catch (error) {
            console.error("Failed to initialize MatrixRainEffect (Extruded Text):", error);
        }
    }

    // Method to create/replace the 3D mesh for a character
    private generateCharacterMesh(char: string): THREE.Group | null {
        if (this.availableFonts.length === 0) return null;

        // Pick a random alien font
        const fontConfig = this.availableFonts[Math.floor(Math.random() * this.availableFonts.length)];
        const font = getLoadedFont(fontConfig.name);

        if (!font) {
            console.warn(`Font ${fontConfig.name} not found in loaded fonts.`);
            return null;
        }

        try {
             // Use createExtrudedTextMesh directly (assuming it returns a Group or Mesh)
             // Adjust size/parameters as needed. createExtrudedTextMesh might need modification
             // if it doesn't handle single chars well or isn't flexible enough.
             const textMesh = createExtrudedTextMesh(
                 char,
                 this.options.glyphScale,  // fontSize (number)
                 '#00FF40',               // color (string)
                 this.options.extrusionDepth, // depth (number)
                 fontConfig.name           // fontName (string)
             );

             // Assume it returns a Mesh based on definition, wrap in Group
             if (textMesh) { // Check if not null
                 const group = new THREE.Group();
                 group.add(textMesh);
                 // Center the mesh within the group if needed (might depend on createExtrudedTextMesh output)
                 // textMesh.geometry.computeBoundingBox();
                 // const center = new THREE.Vector3();
                 // textMesh.geometry.boundingBox?.getCenter(center);
                 // textMesh.position.sub(center);
                 return group;
             }
             return null; // Or handle other return types

        } catch (error) {
            console.error(`Error creating extruded text mesh for char "${char}", font "${fontConfig.name}":`, error);
            return null;
        }
    }

    private getRandomChar(): string {
        const len = this.options.characterSet.length;
        if (len === 0) return '?';
        const randomIndex = Math.floor(Math.random() * len);
        return this.options.characterSet[randomIndex];
    }


    // Renamed from populateInstances
    private populateCharacters() {
        if (!this.isInitialized) {
             console.warn("populateCharacters called before initialization finished.");
             return;
        }

        const numToCreate = this.options.glyphCount;

        console.log(`   Populating ${numToCreate} extruded glyph objects.`);

        // Define approximate tunnel dimensions for random positioning
        const approxTunnelRadius = 100; // Match value used in initialize
        const approxSpawnLength = 500; // Spawn within a shorter Z range initially

        this.columnMap.clear();
        this.nextColumnId = 0;
        // Clear existing meshes before populating
        disposeObjectTree(this.effectGroup);
        // Make sure to remove children from the group as well
        while(this.effectGroup.children.length > 0){
            this.effectGroup.remove(this.effectGroup.children[0]);
        }
        this.fallingChars = [];


        for (let i = 0; i < numToCreate; i++) {
            // Generate random position within approximate cylinder
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * approxTunnelRadius * 0.95; // Place within 95% of radius
            const x = Math.cos(angle) * radius;
            const y = this.gridMaxY - Math.random() * (this.gridMaxY - this.gridMinY); // Random Y within bounds
            const z = (Math.random() - 0.5) * approxSpawnLength; // Random Z within spawn length
            const pos = new THREE.Vector3(x, y, z);

            const seed = Math.random();
            const initialChar = this.getRandomChar();

            // Determine column ID
            const columnKey = `${Math.floor(pos.x / 10)}_${Math.floor(pos.z / 10)}`;
            if (!this.columnMap.has(columnKey)) {
                this.columnMap.set(columnKey, this.nextColumnId++);
            }
            const columnId = this.columnMap.get(columnKey) || 0;

            const charMeshGroup = this.generateCharacterMesh(initialChar);

            const fallingChar: FallingChar = {
                meshGroup: charMeshGroup,
                initialPos: pos,
                currentY: pos.y, // Start at the grid cell's Y
                seed: seed,
                currentColId: columnId,
                currentChar: initialChar,
            };

            if (charMeshGroup) {
                charMeshGroup.position.copy(pos);
                // TODO: Adjust rotation to face outwards from tunnel center? Or keep upright?
                 charMeshGroup.rotation.y = Math.random() * Math.PI * 2; // Random initial rotation
                this.effectGroup.add(charMeshGroup);
            }

            this.fallingChars.push(fallingChar);
        }
        console.log(`   Finished populating ${this.fallingChars.length} extruded glyphs.`);
    }


    // Update method to be called in the animation loop
    update(elapsedTime: number, deltaTime: number) {
        if (!this.isInitialized || this.fallingChars.length === 0 || deltaTime <= 0) return;

        const fallDistance = this.options.fallSpeed * deltaTime;
        const respawnThreshold = this.gridMinY - 10; // Position slightly below lowest grid point to respawn
        const respawnTargetY = this.gridMaxY; // Respawn at the top

        for (const char of this.fallingChars) {
            if (!char.meshGroup) continue;

            // Update position
            char.currentY -= fallDistance * (0.8 + char.seed * 0.4); // Apply seed variation to speed
            char.meshGroup.position.y = char.currentY;

            // Recycle character if it falls below threshold
            if (char.currentY < respawnThreshold) {
                // Generate new random X/Z position within bounds
                const approxTunnelRadius = 100; // Match value used elsewhere
                const approxSpawnLength = 500;
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * approxTunnelRadius * 0.95;
                const x = Math.cos(angle) * radius;
                // Y position will be set by respawnTargetY
                const z = (Math.random() - 0.5) * approxSpawnLength;
                const newPos = new THREE.Vector3(x, respawnTargetY, z); // Use target Y for new position

                // Reset state
                char.initialPos.copy(newPos);
                char.currentY = respawnTargetY + Math.random() * 10; // Respawn slightly above top

                 // Optionally change character on respawn (less expensive than changing mid-fall)
                 const newChar = this.getRandomChar();
                 if (newChar !== char.currentChar) {
                     disposeObjectTree(char.meshGroup); // Dispose old geometry/material
                     this.effectGroup.remove(char.meshGroup); // Remove old mesh from group
                     char.currentChar = newChar;
                     char.meshGroup = this.generateCharacterMesh(char.currentChar); // Generate new mesh
                     if (char.meshGroup) {
                         char.meshGroup.position.copy(char.initialPos);
                         char.meshGroup.position.y = char.currentY;
                         char.meshGroup.rotation.y = Math.random() * Math.PI * 2; // Reset rotation
                         this.effectGroup.add(char.meshGroup); // Add new mesh to group
                     }
                 } else {
                     // Just reset position if char is the same
                     char.meshGroup.position.copy(char.initialPos);
                     char.meshGroup.position.y = char.currentY;
                 }

            }
        }
    }

    // Dispose method for cleanup
    dispose() {
        console.log("🌧️ Disposing MatrixRainEffect (Extruded Text)...");
        disposeObjectTree(this.effectGroup); // Dispose all children
         // Make sure to remove children from the group as well
         while(this.effectGroup.children.length > 0){
            this.effectGroup.remove(this.effectGroup.children[0]);
        }
        this.fallingChars = [];
        this.availableFonts = [];
        console.log("   MatrixRainEffect disposed.");
    }
} 