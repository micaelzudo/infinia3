import * as THREE from 'three';
import { FONTS, loadFonts, getLoadedFont } from './utils/fontLoader';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { ExtrudeGeometry, Shape, Path, Vector2 } from 'three';
import * as opentype from 'opentype.js'; // Import opentype.js

// Default text size for canvas rendering
const DEFAULT_TEXT_SIZE = 64;
// Default canvas size (power of 2 for better texture performance)
const CANVAS_SIZE = 256;

// Import shader files
import text3DVertexShader from './shaders/text3d.vert?raw';
import text3DFragmentShader from './shaders/text3d.frag?raw';
import hexagonVertexShader from './shaders/hexagon.vert?raw';
import hexagonFragmentShader from './shaders/hexagon.frag?raw';

// Current active font
let currentFont = FONTS[0];

/**
 * Set the current font to use for text rendering
 * @param fontIndex Index in the FONTS array
 * @returns The selected font config
 */
export function setCurrentFont(fontIndex: number) {
    if (fontIndex >= 0 && fontIndex < FONTS.length) {
        currentFont = FONTS[fontIndex];
        console.log(`Set current font to "${currentFont.displayName}"`);
    } else {
        console.warn(`Invalid font index ${fontIndex}, using default`);
    }
    return currentFont;
}

/**
 * Creates a canvas with rendered text using the current alien font
 */
export function createTextCanvas(
    text: string, 
    fontSize: number = DEFAULT_TEXT_SIZE,
    textColor: string = '#c0f0ff',
    canvasSize: number = CANVAS_SIZE
): HTMLCanvasElement {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Get 2D context and configure it
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context from canvas');
    
    // Clear canvas with transparency
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configure text rendering with the specified font
    context.font = `${fontSize}px ${currentFont.name}`;
    context.fillStyle = textColor;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Apply a slight blur for glow effect
    context.shadowColor = textColor;
    context.shadowBlur = fontSize * 0.1;
    
    // Draw text in center of canvas
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Add some noise for more alien tech feel
    applyTextureNoise(canvas, context, 0.05);
    
    return canvas;
}

/**
 * Apply noise to a canvas texture for a distressed look
 */
function applyTextureNoise(
    canvas: HTMLCanvasElement, 
    context: CanvasRenderingContext2D,
    intensity: number = 0.05
): void {
    // Get the image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Apply random noise to each pixel
    for (let i = 0; i < data.length; i += 4) {
        // Only add noise where there's some opacity (text pixels)
        if (data[i + 3] > 0) {
            // Add random noise to RGB channels
            const noise = (Math.random() * 2 - 1) * intensity * 255;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
            
            // Occasionally add transparency noise
            if (Math.random() < 0.1) {
                data[i + 3] = Math.max(0, Math.min(255, data[i + 3] - Math.random() * 100));
            }
        }
    }
    
    // Put the modified image data back
    context.putImageData(imageData, 0, 0);
}

/**
 * Creates a THREE.js texture from a canvas
 */
export function createCanvasTexture(canvas: HTMLCanvasElement): THREE.Texture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
}

/**
 * Creates a 3D text mesh using the original shader approach (PlaneGeometry + displacement)
 * Kept for potential fallback or alternative use.
 */
export function createTextMesh(
    text: string,
    fontSize: number = DEFAULT_TEXT_SIZE,
    color: string = '#c0f0ff'
): THREE.Mesh {
    console.log(`    [CanvasTextRenderer] createTextMesh (Original Shader) START - Text: "${text}"`);
    // Create canvas with text (using the multi-font canvas for texture source)
    const canvas = createMultiFontAlienTextCanvas(text, fontSize, color);
    const texture = createCanvasTexture(canvas);
    
    // Create plane geometry sized appropriately (e.g., 4x4 with 32x32 segments)
    const aspect = 1.0;
    const width = 4;
    const height = width / aspect;
    const geometry = new THREE.PlaneGeometry(width, height, 32, 32);
    
    // Create shader material using the original text shaders
    const glowColor = new THREE.Color(0x36f4ff);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: texture },
            uTime: { value: 0.0 },
            uGlowColor: { value: glowColor },
            uHoloPulse: { value: 0.4 },
            uDepth: { value: 0.6 } // Using reference depth value
        },
        vertexShader: text3DVertexShader,
        fragmentShader: text3DFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `shader-text-${text.replace(/\s+/g, '-').toLowerCase()}`;
    mesh.position.z = 0.02;
    mesh.renderOrder = 10;

    console.log(`    [CanvasTextRenderer] createTextMesh (Original Shader) END - Text: "${text}"`);
    return mesh;
}

/**
 * Updates the time uniform in a ShaderMaterial (used by original text mesh and hexagon)
 */
export function updateShaderTime(mesh: THREE.Mesh, time: number): void {
    if (mesh && mesh.material instanceof THREE.ShaderMaterial) {
        if (mesh.material.uniforms.uTime) {
            mesh.material.uniforms.uTime.value = time;
        }
    }
}

/**
 * Creates a canvas with rendered text using random alien fonts for each character
 * Each character gets a randomly selected font from the available fonts
 */
export function createMultiFontAlienTextCanvas(
    text: string, 
    fontSize: number = DEFAULT_TEXT_SIZE,
    textColor: string = '#c0f0ff',
    canvasSize: number = CANVAS_SIZE
): HTMLCanvasElement {
    console.log(`  [CanvasTextRenderer] createMultiFontAlienTextCanvas START - Text: "${text}"`);
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Get 2D context and configure it
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context from canvas');
    
    // Clear canvas with transparency
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Measure total width to calculate positioning
    // First pass: measure with default font to get approximate width
    context.font = `bold ${fontSize}px ${FONTS[0].name}, Arial`; // Use a known font for initial measurement
    const metrics = context.measureText(text);
    const estimatedWidth = metrics.width;
    
    // Calculate starting X position and character spacing
    const totalSpace = canvas.width * 0.8; // Use 80% of canvas width
    const scaleFactor = Math.min(1.0, totalSpace / estimatedWidth);
    const adjustedFontSize = fontSize * scaleFactor;
    
    // Calculate starting position for centered text
    let startX = (canvas.width - (estimatedWidth * scaleFactor)) / 2;
    const y = canvas.height / 2; // Center vertically
    
    // Log font usage for this planet name (optional, good for debugging)
    console.log(`%c  [CanvasTextRenderer] Font assignment for "${text}":`, "color: #00aaff; font-weight: bold;");
    const fontDetails: { char: string; font: string }[] = [];
    
    // Draw each character with a random font
    let currentX = startX;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Select a random font for this character
        const randomFontIndex = Math.floor(Math.random() * FONTS.length);
        const randomFont = FONTS[randomFontIndex];
        
        // Set font for this character
        const fontStyleString = `bold ${adjustedFontSize}px ${randomFont.name}, Arial`;
        
        // Measure this character width with the selected font
        context.font = fontStyleString;
        const charMetrics = context.measureText(char);
        const charWidth = charMetrics.width;
        
        // For a handcrafted look, draw the character with slight shifts multiple times
        // First pass - subtle shadow/glow underneath
        context.globalAlpha = 0.4;
        context.fillStyle = '#80e0ff'; // Lighter color for glow
        context.fillText(char, currentX + 2, y + 2);
        
        // Second pass - subtle variation color
        context.globalAlpha = 0.3;
        context.fillStyle = '#40a0ff'; // Slightly different blue tone
        context.fillText(char, currentX - 1, y - 1);
        
        // Main character layer
        context.globalAlpha = 1.0;
        context.fillStyle = textColor;
        context.fillText(char, currentX, y);
        
        // Log details (optional)
        fontDetails.push({ char, font: randomFont.displayName });
        
        // Move to the next character position
        currentX += charWidth;
    }
    
    // Log all used fonts (optional)
    fontDetails.forEach(detail => console.log(`      [CanvasTextRenderer]   ${detail.char}: ${detail.font}`));
    
    // Add noise after all text is drawn
    applyTextureNoise(canvas, context, 0.05);
    
    console.log(`  [CanvasTextRenderer] createMultiFontAlienTextCanvas END - Text: "${text}"`);
    return canvas;
}

/**
 * Creates a stylized hexagonal background with sci-fi effects
 */
export function createHexagonalBackground(
    size: number = 2.2, // Match reference size
    color: string = '#051015' // Match reference color
): THREE.Mesh {
    console.log(`    [CanvasTextRenderer] createHexagonalBackground START - Size: ${size}`);
    
    // Create regular hexagon geometry with more segments for better effects
    const shape = new THREE.Shape();
    const R = size / 2; // Radius based on overall size
    
    // Define hexagon vertices
    shape.moveTo(R * Math.cos(0), R * Math.sin(0));
    for (let i = 1; i <= 6; i++) {
        shape.lineTo(R * Math.cos(i * Math.PI / 3), R * Math.sin(i * Math.PI / 3));
    }
    
    // Use more segments for smoother edges and better animation
    const geometry = new THREE.ShapeGeometry(shape, 24);
    
    // Create color objects for the shader
    const baseColor = new THREE.Color(color);
    const glowColor = new THREE.Color(0x36f4ff); // Cyan glow
    
    // Create a shader material with sci-fi effects
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: baseColor },
            uGlowColor: { value: glowColor },
            uTime: { value: 0.0 },
            uOpacity: { value: 0.4 }, // Increased transparency (was 0.7)
            uBorderWidth: { value: 0.15 },
            uGlowIntensity: { value: 1.2 },
            uPulse: { value: 1.0 }
        },
        vertexShader: hexagonVertexShader,
        fragmentShader: hexagonFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    
    // Create and return the mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'hexagon-background';
    
    console.log(`    [CanvasTextRenderer] createHexagonalBackground END - Size: ${size}`);
    return mesh;
}

/**
 * Converts opentype.js path commands to THREE.Path or THREE.Shape objects.
 * Inspired by THREE.SVGLoader's parsePathData method.
 */
function createShapesFromOpentypePath(path: opentype.Path, scale: number): THREE.Shape[] {
    const shapes: THREE.Shape[] = [];
    let currentShape: THREE.Shape | null = null;
    let currentPath: THREE.Path | null = null; // Can be the shape's main path or a hole

    path.commands.forEach(command => {
        // Helper to scale and flip Y coordinate
        const transformX = (val: number | undefined) => (val !== undefined ? val * scale : undefined);
        const transformY = (val: number | undefined) => (val !== undefined ? val * -scale : undefined);

        switch (command.type) {
            case 'M': // moveTo
                const xM = transformX(command.x);
                const yM = transformY(command.y);
                
                // Determine if this M starts a new shape or a hole
                if (currentShape === null) {
                    // Start a new shape
                    currentShape = new Shape();
                    currentPath = currentShape; // Operate directly on the shape
                    shapes.push(currentShape);
                } else {
                    // Start a new path for a hole
                    currentPath = new Path();
                    currentShape.holes.push(currentPath);
                }

                if (currentPath && xM !== undefined && yM !== undefined) {
                    currentPath.moveTo(xM, yM);
                }
                break;
            case 'L': // lineTo
                const xL = transformX(command.x);
                const yL = transformY(command.y);
                if (currentPath && xL !== undefined && yL !== undefined) {
                    currentPath.lineTo(xL, yL);
                }
                break;
            case 'C': // cubic Bézier curveTo
                const x1C = transformX(command.x1);
                const y1C = transformY(command.y1);
                const x2C = transformX(command.x2);
                const y2C = transformY(command.y2);
                const xC = transformX(command.x);
                const yC = transformY(command.y);
                if (currentPath && x1C !== undefined && y1C !== undefined && x2C !== undefined && y2C !== undefined && xC !== undefined && yC !== undefined) {
                    currentPath.bezierCurveTo(x1C, y1C, x2C, y2C, xC, yC);
                }
                break;
            case 'Q': // quadratic Bézier curveTo
                const x1Q = transformX(command.x1);
                const y1Q = transformY(command.y1);
                const xQ = transformX(command.x);
                const yQ = transformY(command.y);
                if (currentPath && x1Q !== undefined && y1Q !== undefined && xQ !== undefined && yQ !== undefined) {
                    currentPath.quadraticCurveTo(x1Q, y1Q, xQ, yQ);
                }
                break;
            case 'Z': // closePath
                if (currentPath) {
                    currentPath.closePath();
                    // Determine if we closed the main shape or a hole
                    if (currentShape && currentPath !== currentShape) { 
                        // Closed a hole, stay with current shape
                        currentPath = null; // Next M will start a new hole path
                    } else {
                        // Closed the main shape path
                        currentShape = null;
                        currentPath = null;
                    }
                }
                break;
            default:
                 console.warn('Unhandled opentype command type encountered');
        }
    });

    return shapes;
}

/**
 * Creates a 3D text mesh using ExtrudeGeometry and opentype.js
 */
export function createExtrudedTextMesh(
    text: string,
    fontSize: number = 1, // Size relative to the extrusion geometry
    color: string = '#c0f0ff',
    depth: number = 0.2, // Depth of the extrusion
    fontName?: string // Optional: Specify which font to use
): THREE.Mesh | null { // Return null if font not loaded
    console.log(`    [CanvasTextRenderer] createExtrudedTextMesh START - Text: "${text}"`);

    let font: opentype.Font | undefined = undefined;
    let actualFontName = 'Unknown';

    if (fontName) {
        // Try to use the specified font
        font = getLoadedFont(fontName);
        if (font) {
            actualFontName = fontName;
        } else {
            console.warn(`    [CanvasTextRenderer] Specified font '${fontName}' not loaded. Falling back...`);
        }
    }

    // Fallback: Find the first loaded alien font if specified one failed or none was given
    if (!font) {
        for (let i = 1; i < FONTS.length; i++) { // Start from 1 to skip Matrix font
            if (FONTS[i].type === 'alien') {
                 const fallbackFont = getLoadedFont(FONTS[i].name);
                 if (fallbackFont) {
                     font = fallbackFont;
                     actualFontName = FONTS[i].displayName;
                     console.log(`    [CanvasTextRenderer] Using fallback font: ${actualFontName}`);
                     break;
                 }
            }
        }
    }

    if (!font) {
        console.error(`    [CanvasTextRenderer] No suitable alien font loaded (neither specified nor fallback). Cannot create extruded text.`);
        return null; 
    }
    console.log(`    [CanvasTextRenderer] Final font: ${actualFontName}`);

    // --- Validate font unitsPerEm --- 
    if (!font.unitsPerEm || font.unitsPerEm <= 0) {
        console.error(`    [CanvasTextRenderer] Invalid font.unitsPerEm (${font.unitsPerEm}) for font ${actualFontName}. Cannot create text mesh.`);
        return null;
    }
    // ------------------------------

    // --- Generate THREE.Shapes from opentype path --- 
    const scale = fontSize / font.unitsPerEm;
    // Check for zero scale just in case fontSize is zero
    if (scale === 0) {
        console.warn(`    [CanvasTextRenderer] Calculated scale is zero for font ${actualFontName}. Text might be invisible.`);
        // Proceed, but geometry might be degenerate
    } else if (!isFinite(scale)) {
        console.error(`    [CanvasTextRenderer] Calculated scale is not finite (${scale}) for font ${actualFontName}. unitsPerEm: ${font.unitsPerEm}, fontSize: ${fontSize}. Cannot create text mesh.`);
        return null;
    }

    const opentypePath = font.getPath(text, 0, 0, font.unitsPerEm); 
    if (!opentypePath) {
        console.error(`    [CanvasTextRenderer] font.getPath returned null for text "${text}" with font ${actualFontName}.`);
        return null;
    }
    const shapes = createShapesFromOpentypePath(opentypePath, scale);
    if (shapes.length === 0) {
        console.warn(`    [CanvasTextRenderer] createShapesFromOpentypePath returned no shapes for text "${text}" with font ${actualFontName}.`);
        // It might be valid (e.g., for a space character), but ExtrudeGeometry might fail.
        // Let's return null for safety to avoid NaN issues downstream.
        return null;
    }
    // -------------------------------------------------

    // Extrusion settings
    const extrudeSettings = {
        steps: 1,
        depth: depth,
        bevelEnabled: true,
        bevelThickness: 0.05 * scale * font.unitsPerEm, 
        bevelSize: 0.04 * scale * font.unitsPerEm,      
        bevelOffset: 0,
        bevelSegments: 3
    };

    // --- Add checks for NaN in extrudeSettings --- 
    if (!isFinite(extrudeSettings.bevelThickness) || !isFinite(extrudeSettings.bevelSize)) {
        console.error(`    [CanvasTextRenderer] Invalid extrude settings for font ${actualFontName}. BevelThickness: ${extrudeSettings.bevelThickness}, BevelSize: ${extrudeSettings.bevelSize}. Scale: ${scale}, UnitsPerEm: ${font.unitsPerEm}`);
        return null;
    }
    // ---------------------------------------------

    // Create extruded geometry from the THREE.Shapes
    let geometry: THREE.ExtrudeGeometry | null = null;
    try {
        geometry = new ExtrudeGeometry(shapes, extrudeSettings);
    } catch (error) {
        console.error(`    [CanvasTextRenderer] Error creating ExtrudeGeometry for text "${text}", font ${actualFontName}:`, error);
        return null;
    }
    
    // --- Optional: Check geometry for NaN immediately --- 
    if (geometry && geometry.attributes.position) {
        const positions = geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i])) {
                console.error(`    [CanvasTextRenderer] NaN found in ExtrudeGeometry position attribute for text "${text}", font ${actualFontName}. Index: ${i}`);
                geometry.dispose(); // Clean up potentially corrupt geometry
                return null; 
            }
        }
    } else if (!geometry) {
         console.error(`    [CanvasTextRenderer] Geometry creation failed silently for text "${text}", font ${actualFontName}.`);
         return null;
    }
    // ----------------------------------------------------

    // Create material with onBeforeCompile for enhancements
    const textGlowColor = new THREE.Color(0x36f4ff);
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: textGlowColor,
        emissiveIntensity: 0.3,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.FrontSide 
    });

    // Add custom uniforms ONLY for effects we keep (noise)
    const customUniforms = {
        uTime: { value: 0.0 },
        uNoiseScale: { value: 15.0 },
        uNoiseIntensity: { value: 0.03 }
    };

    material.onBeforeCompile = (shader) => {
        // Add uniforms to the shader
        shader.uniforms.uTime = customUniforms.uTime;
        shader.uniforms.uNoiseScale = customUniforms.uNoiseScale;
        shader.uniforms.uNoiseIntensity = customUniforms.uNoiseIntensity;
        // Add uniforms for Fresnel and Aberration
        shader.uniforms.uFresnelColor = { value: new THREE.Color(0x88eeff) }; 
        shader.uniforms.uFresnelPower = { value: 2.5 };
        shader.uniforms.uAberrationIntensity = { value: 0.006 };

        // --- Vertex Shader Modifications --- 
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying float vDepth;
            uniform float uTime;

            // Simple hash function for noise
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                float a = hash(i + vec2(0.0, 0.0));
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
            }
            `
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>', // Inject displacement *before* standard calculations
            `
            #include <begin_vertex>

            // --- Vertex Jitter & Hyperverse Wave ---
            float jitterIntensity = 0.02;
            float jitterFreq = 8.0;
            float timeOffset = uTime * 1.2;
            vec3 worldPos = position.xyz;
            float displacementX = (noise(vec2(position.x * jitterFreq + timeOffset, position.y * jitterFreq)) - 0.5) * 2.0 * jitterIntensity;
            float displacementY = (noise(vec2(position.y * jitterFreq, position.x * jitterFreq - timeOffset)) - 0.5) * 2.0 * jitterIntensity;
            transformed.x += displacementX;
            transformed.y += displacementY;
            float dist = length(worldPos.xy);
            transformed.z += sin(dist * 10.0 - uTime * 2.5) * 0.03;
            `
        );
        // Remove the replacement targeting <project_vertex>
        // shader.vertexShader = shader.vertexShader.replace(
        //     '#include <project_vertex>', // Inject varying assignments *after* projection
        //     `
        //     #include <project_vertex>
        //     vWorldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
        //     vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // Use original position for world pos
        //     vViewPosition = -mvPosition.xyz;
        //     `
        // );

        // Inject varying assignments BEFORE <worldpos_vertex>
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            // Assign custom varyings before worldpos is calculated
            vWorldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // Use original position for world pos
            vViewPosition = -mvPosition.xyz;
            vDepth = gl_Position.z; // record depth for trippy extrusion effect

            #include <worldpos_vertex> // Now include the original block
            `
        );

        // --- Fragment Shader Modifications --- 
        shader.fragmentShader = shader.fragmentShader.replace(
            'varying vec3 vViewPosition;', // Add varyings and uniforms
            `
            varying vec3 vViewPosition;
            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying float vDepth;

            uniform float uTime;
            uniform float uNoiseScale;
            uniform float uNoiseIntensity;
            uniform vec3 uFresnelColor;
            uniform float uFresnelPower;
            uniform float uAberrationIntensity;
            
            // Convert HSV to RGB for procedural coloring
            vec3 hsv2rgb(vec3 c) {
                vec3 rgb = clamp(abs(mod(c.x*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
                return c.z * mix(vec3(1.0), rgb, c.y);
            }

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
            }
            `
        );

        // Modify the final color output
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            
            // --- Surface Noise ---
            vec2 screenPosNoise = gl_FragCoord.xy / vec2(1920.0, 1080.0);
            float surfaceNoise = hash(screenPosNoise * uNoiseScale + uTime * 0.1) * uNoiseIntensity;
            
            // --- Fresnel & Chromatic Aberration & Hyperverse Pulse (existing) ---
            vec3 viewDirection = normalize(vViewPosition);
            float fresnelTerm = dot(viewDirection, vWorldNormal);
            float fresnelFactor = pow(clamp(1.0 - fresnelTerm, 0.0, 1.0), uFresnelPower);
            vec3 fresnelGlow = uFresnelColor * fresnelFactor * (0.5 + 0.5 * sin(uTime * 3.0 + vWorldPosition.x * 2.0));
            
            vec2 uv = gl_FragCoord.xy / vec2(1920.0, 1080.0);
            vec2 aberrationOffset = (uv - 0.5) * 2.0 * uAberrationIntensity * (1.0 + 0.2*sin(uTime * 1.5));
            
            vec3 baseColor = gl_FragColor.rgb + vec3(surfaceNoise);
            baseColor = mix(baseColor, fresnelGlow, fresnelFactor);
            vec3 colorR = baseColor;
            vec3 colorG = baseColor;
            vec3 colorB = baseColor;
            colorR *= (1.0 + aberrationOffset.x * 0.5);
            colorG *= (1.0 + aberrationOffset.y * 0.3);
            colorB *= (1.0 - (aberrationOffset.x + aberrationOffset.y) * 0.4);
            gl_FragColor.rgb = vec3(colorR.r, colorG.g, colorB.b);

            // --- 3D Depth Extrusion Trippy Effect ---
            float depthEffect = sin(vDepth * 15.0 + uTime * 8.0) * 0.1;
            gl_FragColor.rgb += depthEffect;

            // --- Irregular Procedural Label Color ---
            float baseHue = fract(dot(vWorldPosition.xy, vec2(0.12, 0.17)) + uTime * 0.08);
            float noiseHue = (hash(vWorldPosition.xy * 5.0 + uTime * 2.0) - 0.5) * 0.1;
            float hue = fract(baseHue + noiseHue);
            vec3 cycColor = hsv2rgb(vec3(hue, 0.6, 1.0));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, cycColor, 0.35);
            `
        );
        
        // Store reference to uniforms for updateLabelGroup
        material.userData.shader = shader;
    };
    
    // Tag the material so updateLabelGroup can find the uniforms later
    material.userData.isTextMaterial = true;

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    // Store font info and original scale for potential width calculation later
    mesh.userData.fontInfo = { fontName: actualFontName, scale: scale }; 
    mesh.name = `extruded-char-${text.replace(/\s+/g, '-').toLowerCase()}`;

    // Remove positioning and renderOrder - handle in label group
    // mesh.position.z = 0.1; 
    // mesh.renderOrder = 10;

    console.log(`    [CanvasTextRenderer] createExtrudedTextMesh END - Char: "${text}", Font: ${actualFontName}`);
    return mesh;
}

/**
 * Creates a complete text label using individual EXTRUDED characters, cycling through alien fonts.
 */
export function createMultiFontTextLabel(
    text: string,
    fontSize: number = 1, // Base size for characters
    textColor: string = '#c0f0ff',
    bgColor: string = '#051015'
): THREE.Group | null { // Return null if text mesh fails
    console.log(`    [CanvasTextRenderer] createMultiFontTextLabel (Multi-Extrude per Char) START - Text: "${text}"`);
    const group = new THREE.Group();
    let currentX = 0;
    let totalWidth = 0;
    let maxHeight = 0;
    let minHeight = 0;

    // --- Get list of INTERNAL NAMES of loaded alien fonts --- 
    const loadedAlienFontNames = FONTS.filter(f => f.type === 'alien' && f.loadedFont)
                                      .map(f => f.name); // Get the internal names
    
    if (loadedAlienFontNames.length === 0) {
        console.error("    [CanvasTextRenderer] No alien fonts were loaded successfully! Cannot create varied labels.");
        return null;
    }
    // --------------------------------------

    let currentAlienFontIndex = 0; // Initialize index for cycling through font names

    // Loop through each character
    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // --- Select the next alien font NAME cyclically ---
        const fontNameForChar = loadedAlienFontNames[currentAlienFontIndex];
        const fontForChar = getLoadedFont(fontNameForChar); // Get the font object for metrics
        
        if (!fontForChar) {
             console.warn(`    [CanvasTextRenderer] Could not retrieve loaded font object for '${fontNameForChar}' even though it should be loaded. Skipping char '${char}'.`);
             // Move to the next font index anyway to avoid getting stuck
             currentAlienFontIndex = (currentAlienFontIndex + 1) % loadedAlienFontNames.length;
             continue; // Skip this character
        }

        console.log(`      [CanvasTextRenderer] Char: '${char}', Font Name: ${fontNameForChar}`);
        
        // Create mesh for this single character, passing the correct internal font NAME
        const charMesh = createExtrudedTextMesh(char, fontSize, textColor, 0.2, fontNameForChar);

        if (charMesh) {
            // Calculate character width using the font object for THIS CHARACTER
            const scale = fontSize / fontForChar.unitsPerEm;
            const advanceWidth = fontForChar.getAdvanceWidth(char, fontForChar.unitsPerEm) * scale;
            
            charMesh.position.x = currentX; 
            
            charMesh.geometry.computeBoundingBox();
            if (charMesh.geometry.boundingBox) {
                maxHeight = Math.max(maxHeight, charMesh.geometry.boundingBox.max.y);
                minHeight = Math.min(minHeight, charMesh.geometry.boundingBox.min.y);
            }
            
            group.add(charMesh);
            currentX += advanceWidth;
        } else {
            console.warn(`    [CanvasTextRenderer] Skipping character '${char}' with font ${fontNameForChar} due to mesh creation failure.`);
        }

        // Move to the next font index, wrapping around
        currentAlienFontIndex = (currentAlienFontIndex + 1) % loadedAlienFontNames.length;
    }

    // --- Center the group of characters --- 
    totalWidth = currentX; 
    const totalHeight = maxHeight - minHeight;
    group.position.x = -totalWidth / 2;
    group.position.y = -(minHeight + totalHeight / 2);
    // --------------------------------------

    // --- Create Background --- 
    const padding = 1.0; 
    const backgroundWidth = totalWidth + padding * 2;
    const backgroundHeight = totalHeight + padding * 2;
    const backgroundSize = Math.max(backgroundWidth, backgroundHeight); 
    const backgroundMesh = createHexagonalBackground(backgroundSize, bgColor);
    backgroundMesh.position.z = -0.1; 
    // -------------------------

    const finalGroup = new THREE.Group();
    finalGroup.add(backgroundMesh);
    finalGroup.add(group); 

    finalGroup.name = `multifont-label-${text.replace(/\s+/g, '-').toLowerCase()}`;
    finalGroup.scale.set(4, 4, 4); 

    console.log(`    [CanvasTextRenderer] createMultiFontTextLabel (Multi-Extrude per Char) END - Text: "${text}"`);
    return finalGroup;
}

/**
 * Updates time-based animations for a label group 
 */
export function updateLabelGroup(group: THREE.Group, time: number): void {
    if (!group) return;
    
    // Find the inner group containing characters and the background
    const charGroup = group.children.find(c => c.name !== 'hexagon-background') as THREE.Group;
    const bgMesh = group.children.find(c => c.name === 'hexagon-background') as THREE.Mesh;

    // Update hexagon background
    if (bgMesh && bgMesh.material instanceof THREE.ShaderMaterial) {
        updateShaderTime(bgMesh, time);
    }
    
    // Update individual character meshes (if animation needed)
    if (charGroup) {
        charGroup.children.forEach(child => {
            const textMesh = child as THREE.Mesh;
            if (textMesh && textMesh.material instanceof THREE.MeshStandardMaterial && textMesh.material.userData.shader) {
                const textShader = textMesh.material.userData.shader;
                if (textShader.uniforms.uTime) {
                    textShader.uniforms.uTime.value = time;
                }
                textMesh.material.emissiveIntensity = 0.2 + Math.sin(time * 1.5 + textMesh.position.x * 0.5) * 0.15; // Add positional offset to pulse
            }
        });
    }
}