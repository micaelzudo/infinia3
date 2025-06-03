import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// Adjust these paths if they are incorrect for your structure
import { PlanetCompositionInfo } from '../world/planetComposition';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { MAX_SHADER_ELEMENTS } from '../rendering/constants'; // MAX_SHADER_ELEMENTS is already imported correctly
// Import element data
import { periodicTableElements } from '../../terrainGenerationUtils/elements.js';
// Import mesh generation utilities
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
// Correctly import the exported function
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { disposeNode } from '../../disposeNode_debug'; // Import disposeNode
// Import necessary types
import type { NoiseMap, NoiseLayers, Seed } from '../../types_debug'; 
import type { TopElementsData, VisualParams } from '../types/renderingTypes';

// --- Type Definition for Element Data ---
interface PeriodicElement {
    "Z": number;
    "Sym.": string;
    "Element": string;
    [key: string]: any; // Allow other properties
}

// --- Module State ---
let isVisible = false;
let previewContainer: HTMLElement | null = null;
let generalInfoContainer: HTMLElement | null = null;
let detailsContainer: HTMLElement | null = null;

// Store current terrain parameters for swatch initialization
let currentNoiseScale: number = 0.1;
let currentPlanetOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

// State for Main Preview
let mainPreviewCanvas: HTMLCanvasElement | null = null;
let mainPreviewRenderer: THREE.WebGLRenderer | null = null;
let mainPreviewScene: THREE.Scene | null = null;
let mainPreviewCamera: THREE.PerspectiveCamera | null = null;
let mainPreviewLight: THREE.DirectionalLight | null = null;
let mainPreviewMesh: THREE.Mesh | null = null;
let mainPreviewControls: OrbitControls | null = null;

// Add state for multiple swatch setups
interface SwatchRenderSetup {
    canvas: HTMLCanvasElement;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // Allow both types
    light: THREE.DirectionalLight;
    mesh: THREE.Mesh;
}
let swatchSetups: SwatchRenderSetup[] = [];

// --- Temporary storage for deferred setup ---
interface PendingSwatchSetup {
    symbol: string;
    color: THREE.Color;
    swatchCanvasContainer: HTMLElement;
    swatchCanvas: HTMLCanvasElement;
    topElementsData: TopElementsData;
}
let pendingSwatchSetups: PendingSwatchSetup[] = [];

// --- State for Zoomed Swatch Preview ---
let zoomOverlay: HTMLDivElement | null = null;
let zoomCanvas: HTMLCanvasElement | null = null;
let zoomRenderer: THREE.WebGLRenderer | null = null;
let zoomScene: THREE.Scene | null = null;
let zoomCamera: THREE.PerspectiveCamera | null = null;
let zoomMesh: THREE.Mesh | null = null;
let zoomControls: OrbitControls | null = null; 
let zoomAnimationFrameId: number | null = null;
let isZoomVisible = false;
// ----------------------------------------

// Helper function to get full element name from symbol
function getFullNameFromSymbol(symbol: string): string {
    const elementData = periodicTableElements.find((el: PeriodicElement) => el["Sym."] === symbol);
    return elementData ? elementData["Element"] : symbol; // Fallback to symbol if not found
}

/**
 * Creates the HTML elements for the preview UI panel (initially hidden).
 */
export function createDebugPreviewUI() {
    // --- Prevent Duplicates: Remove existing modal first ---
    const existingModal = document.getElementById('debug-preview-modal');
    if (existingModal) {
        console.warn("Removing existing debug preview modal before creating a new one.");
        existingModal.remove(); // Use remove() for modern browsers
    }
    previewContainer = null; // Ensure state is reset
    // ------------------------------------------------------

    // Main Modal Container
    previewContainer = document.createElement('div');
    previewContainer.id = 'debug-preview-modal';
    Object.assign(previewContainer.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'clamp(80vw, 900px, 90vw)', // More flexible width
        height: 'clamp(80vh, 700px, 90vh)', // More flexible height
        maxWidth: '1100px',
        maxHeight: '850px',
        backgroundColor: '#2d3748', // Consistent dark blue-gray
        border: '1px solid #4a5568', // Consistent border
        borderRadius: '8px',
        zIndex: '20000',
        display: 'none',
        boxShadow: '0 15px 40px rgba(0,0,0,0.6)', // Consistent shadow
        padding: '0', // Remove padding, handle internally
        boxSizing: 'border-box',
        flexDirection: 'column',
        color: '#cbd5e0', // Consistent light text
        overflow: 'hidden' // Prevent content overflow
    });

    // Create Header/Title Bar (Similar to Isolated Editor)
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '10px 18px', // Consistent padding
        backgroundColor: '#1a202c', // Consistent dark header
        borderBottom: '1px solid #4a5568', // Separator line
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: '0'
    });
    const title = document.createElement('h4'); // Use h4 for consistency
    title.innerText = 'Planet Shader Preview';
    title.style.margin = '0';
    title.style.color = '#e2e8f0'; // Consistent off-white
    title.style.fontWeight = '600'; // Semibold
    header.appendChild(title);

    // Close Button (Consistent Style)
    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.title = 'Close Shader Preview'; // Add tooltip
    Object.assign(closeButton.style, {
        backgroundColor: 'transparent',
        color: '#a0aec0', // Consistent light gray
        border: 'none',
        borderRadius: '50%',
        width: '28px',
        height: '28px',
        lineHeight: '26px',
        textAlign: 'center',
        cursor: 'pointer',
        fontSize: '1.4em',
        fontWeight: 'bold',
        transition: 'color 0.2s ease, background-color 0.2s ease'
    });
    closeButton.onmouseover = () => { closeButton.style.color = '#fff'; closeButton.style.backgroundColor = '#e53e3e'; }; // Red hover
    closeButton.onmouseout = () => { closeButton.style.color = '#a0aec0'; closeButton.style.backgroundColor = 'transparent'; };
    closeButton.onclick = hideDebugPreview;
    header.appendChild(closeButton);
    previewContainer.appendChild(header);

    // --- Main Content Area (Below Header) ---
    const contentArea = document.createElement('div');
    Object.assign(contentArea.style, {
        padding: '15px 20px',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: '1', // Take remaining space
        overflowY: 'auto', // Allow scrolling if needed
        gap: '20px' // Add gap between canvas and details panel
    });
    previewContainer.appendChild(contentArea);
    // --- END Main Content Area ---

    // --- Container for the MAIN 3D Canvas (Inside Content Area) ---
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'debug-main-canvas-container';
    Object.assign(canvasContainer.style, {
        flexShrink: '0',
        flexGrow: '1', // Let canvas grow more initially
        position: 'relative',
        minHeight: '250px', // Reduced min height slightly
        backgroundColor: '#1a202c',
        borderRadius: '6px',
        border: '1px solid #4a5568',
        overflow: 'hidden'
    });
    contentArea.appendChild(canvasContainer);

    // Main Canvas for 3D rendering (inside its container)
    mainPreviewCanvas = document.createElement('canvas');
    mainPreviewCanvas.style.width = '100%';
    mainPreviewCanvas.style.height = '100%';
    mainPreviewCanvas.style.display = 'block';
    canvasContainer.appendChild(mainPreviewCanvas);
    // --------------------------------------------------

    // Back Panel for ALL Details (Inside Content Area)
    const detailsBackPanel = document.createElement('div');
    detailsBackPanel.id = 'debug-details-backpanel';
    Object.assign(detailsBackPanel.style, {
        width: '100%',
        padding: '15px', // Uniform padding
        backgroundColor: 'rgba(26, 32, 44, 0.7)',
        borderRadius: '6px',
        border: '1px solid #4a5568',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px', // Increased gap between general info and cards
        flexGrow: '0', // Don't grow, size based on content initially
        flexShrink: '0' 
    });
    contentArea.appendChild(detailsBackPanel);

    // General Info Section (Inside Back Panel)
    generalInfoContainer = document.createElement('div');
    generalInfoContainer.id = 'debug-general-info';
    Object.assign(generalInfoContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px 25px', // Adjusted gap
        paddingBottom: '10px', // More padding below
        borderBottom: '1px dashed #4a5568'
    });
    detailsBackPanel.appendChild(generalInfoContainer);

    // Element Details Container (This will hold the cards)
    detailsContainer = document.createElement('div');
    detailsContainer.id = 'debug-details-container';
    Object.assign(detailsContainer.style, {
        width: '100%',
        display: 'flex',
        justifyContent: 'flex-start',
        flexWrap: 'wrap',
        gap: '12px', // Increased gap between cards
        maxHeight: '200px', // Allow slightly more height
        overflowY: 'auto',
        padding: '5px' // Uniform padding
    });
    detailsBackPanel.appendChild(detailsContainer);

    document.body.appendChild(previewContainer);
    console.log("Debug Preview UI container created with updated styles.");
    console.log("previewContainer element:", previewContainer);
    
    // Verify the container was properly created and added
    if (previewContainer && document.getElementById('debug-preview-modal')) {
        console.log("Debug Preview UI successfully created and added to DOM.");
    } else {
        console.error("Failed to create or add Debug Preview UI to DOM.");
    }
}

/**
 * Handles window resize for the preview canvas.
 */
function onPreviewResize() {
    if (!isVisible) return;
    
    // --- Resize Main Preview ---
    if (mainPreviewCanvas && mainPreviewRenderer && mainPreviewCamera) {
        const container = mainPreviewCanvas.parentElement;
        if (container) {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width > 0 && height > 0 && (mainPreviewCanvas.width !== width || mainPreviewCanvas.height !== height)) {
                mainPreviewRenderer.setSize(width, height);
                mainPreviewCamera.aspect = width / height;
                mainPreviewCamera.updateProjectionMatrix();
            }
        }
    }
    // ---------------------------

    // --- Resize Swatch Previews --- 
    swatchSetups.forEach(setup => {
        const canvas = setup.canvas;
        const container = canvas.parentElement;
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
            setup.renderer.setSize(width, height);
            setup.renderer.setViewport(0, 0, width, height); // Also update viewport on resize
            
            const aspect = width / height;
            if (setup.camera instanceof THREE.PerspectiveCamera) {
                setup.camera.aspect = aspect;
            }
             else if (setup.camera instanceof THREE.OrthographicCamera) {
                const orthoSize = 5; 
                setup.camera.left = -orthoSize * aspect / 2;
                setup.camera.right = orthoSize * aspect / 2;
                setup.camera.top = orthoSize / 2;
                setup.camera.bottom = -orthoSize / 2;
             }
             setup.camera.updateProjectionMatrix();
        }
    });
}

// Add resize listener
window.addEventListener('resize', onPreviewResize);

function cleanupDebugPreviewUIContent() {
    console.log("cleanupDebugPreviewUIContent: Starting cleanup of 3D content.");

    // Dispose main preview scene resources
    if (mainPreviewRenderer) {
        mainPreviewRenderer.dispose();
        mainPreviewRenderer = null;
        console.log("cleanupDebugPreviewUIContent: Disposed main preview renderer.");
    }
    if (mainPreviewScene) {
        if (mainPreviewMesh) {
            if (mainPreviewMesh.geometry) mainPreviewMesh.geometry.dispose();
            if (mainPreviewMesh.material && !(mainPreviewMesh.material instanceof Array)) {
                (mainPreviewMesh.material as THREE.Material).dispose();
            }
            mainPreviewScene.remove(mainPreviewMesh);
            mainPreviewMesh = null;
            console.log("cleanupDebugPreviewUIContent: Disposed and removed main preview mesh.");
        }
        // Removed invalid mainPreviewMesh.material assignment here
        mainPreviewScene = null;
        console.log("cleanupDebugPreviewUIContent: Nullified main preview scene.");
    }
    mainPreviewCamera = null; // Typically no dispose method, just dereference
    mainPreviewLight = null;  // Typically no dispose method, just dereference

    // Dispose swatch setups
    if (swatchSetups && swatchSetups.length > 0) {
        console.log(`cleanupDebugPreviewUIContent: Cleaning up ${swatchSetups.length} swatch setups.`);
        swatchSetups.forEach((setup, index) => {
            if (setup.renderer) setup.renderer.dispose();
            if (setup.scene) {
                setup.scene.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        if (object.geometry) object.geometry.dispose();
                        if (object.material && !(object.material instanceof Array)) {
                            (object.material as THREE.Material).dispose();
                        }
                    }
                });
            }
            // Remove canvas from DOM if it's still there
            if (setup.canvas && setup.canvas.parentElement) {
                setup.canvas.parentElement.removeChild(setup.canvas);
            }
            console.log(`cleanupDebugPreviewUIContent: Cleaned swatch setup ${index}.`);
        });
        swatchSetups = []; // Clear the array
    }

    // Clear pending swatches as well, as their target containers might be gone
    // or the context for their setup is no longer valid.
    if (pendingSwatchSetups && pendingSwatchSetups.length > 0) {
        console.log(`cleanupDebugPreviewUIContent: Clearing ${pendingSwatchSetups.length} pending swatch setups.`);
        pendingSwatchSetups.forEach(pending => {
            if (pending.container && pending.container.parentElement) {
                // Optionally, clear the container's content if it was partially populated
                // pending.container.innerHTML = ''; 
            }
        });
        pendingSwatchSetups = [];
    }

    console.log("cleanupDebugPreviewUIContent: Finished cleanup of 3D content.");
}

/**
 * Sets up the Three.js scene, camera, renderer, lights, and meshes for the preview.
 * Assumes createDebugPreviewUI has been called and previewContainer exists and is visible.
 */
export function setupDebugPreviewScene(
    compInfo: PlanetCompositionInfo,
    planetOffset: THREE.Vector3,
    planetType: string,
    seed: number | string,
    noiseScale?: number
) {
    // Store parameters for swatch initialization
    currentPlanetOffset = planetOffset;
    currentNoiseScale = noiseScale || 0.1;
    console.log(`setupDebugPreviewScene: Called. isVisible: ${isVisible}, previewContainer display: ${previewContainer?.style.display}`);
    console.log("setupDebugPreviewScene with data:", { compInfo, planetOffset, planetType, seed });

    if (!previewContainer) {
        console.error("setupDebugPreviewScene: CRITICAL - previewContainer is null. UI not created or showDebugPreview not called first. Aborting scene setup.");
        return;
    }
    if (previewContainer.style.display === 'none') {
        console.warn("setupDebugPreviewScene: previewContainer is not visible (display: 'none'). Content might not render correctly or at all. Ensure showDebugPreview sets it to 'flex'.");
        // Proceeding, but this is a warning sign.
    }

    // 1. Cleanup old 3D content (keeps HTML structure intact if already created by createDebugPreviewUI)
    console.log("setupDebugPreviewScene: Cleaning up previous 3D resources (if any)...");
    cleanupDebugPreviewUIContent(); // New function to only clean 3D, not HTML

    // 2. Ensure DOM element references are fresh (in case they were somehow cleared, though they shouldn't be if createDebugPreviewUI isn't re-called)
    // These should ideally be stable after initial createDebugPreviewUI call.
    generalInfoContainer = document.getElementById('debug-general-info') as HTMLElement;
    detailsContainer = document.getElementById('debug-details-container') as HTMLElement;
    mainPreviewCanvas = previewContainer.querySelector('#debug-main-canvas-container canvas') as HTMLCanvasElement;

    console.log("setupDebugPreviewScene: Container references:", {
        previewContainer: !!previewContainer,
        generalInfoContainer: !!generalInfoContainer,
        detailsContainer: !!detailsContainer,
        mainPreviewCanvas: !!mainPreviewCanvas
    });

    if (!generalInfoContainer || !detailsContainer || !mainPreviewCanvas) {
        console.error("setupDebugPreviewScene: Essential UI elements (generalInfo, detailsContainer, or mainPreviewCanvas) not found. Aborting scene setup.");
        // This might happen if createDebugPreviewUI failed or its structure changed.
        return;
    }
    if (!compInfo || !compInfo.topElements) {
        console.warn("setupDebugPreviewScene: Missing composition info. Cannot populate scene.", compInfo);
        return;
    }

    console.log("setupDebugPreviewScene: Starting content population with valid containers and composition info...");

    // --- Setup General Info Display --- 
    if (generalInfoContainer) {
        generalInfoContainer.innerHTML = '';
        const infoStyle = { margin: '0', fontSize: '0.88em', color: '#a0aec0' }; // Consistent info style
        const valueStyle = { fontWeight: '600', color: '#e2e8f0' }; // Consistent value style

        const typeP = document.createElement('p');
        Object.assign(typeP.style, infoStyle);
        typeP.innerHTML = `Planet Type: <span style="font-weight:${valueStyle.fontWeight}; color:${valueStyle.color};">${planetType}</span>`;
        generalInfoContainer.appendChild(typeP);

        const seedP = document.createElement('p');
        Object.assign(seedP.style, infoStyle);
        seedP.innerHTML = `Seed: <span style="font-weight:${valueStyle.fontWeight}; color:${valueStyle.color}; word-break: break-all;">${String(seed)}</span>`; // Wrap seed
        generalInfoContainer.appendChild(seedP);
        
        const offsetP = document.createElement('p');
        Object.assign(offsetP.style, infoStyle);
        offsetP.innerHTML = `Offset: <span style="font-weight:${valueStyle.fontWeight}; color:${valueStyle.color};">[${planetOffset.toArray().map(v => v.toFixed(1)).join(', ')}]</span>`;
        generalInfoContainer.appendChild(offsetP);

        const dominantP = document.createElement('p');
        Object.assign(dominantP.style, infoStyle);
        const dominantSymbol = compInfo.dominantElement || 'N/A';
        dominantP.innerHTML = `Dominant: <span style="font-weight:${valueStyle.fontWeight}; color:${valueStyle.color};">${getFullNameFromSymbol(dominantSymbol)} (${dominantSymbol})</span>`;
        generalInfoContainer.appendChild(dominantP);
    } else {
        console.error("General info container is null, cannot add info!");
    }
    // ----------------------------------

    // --- Setup MAIN Preview Scene --- 
    if (mainPreviewCanvas) {
        const width = mainPreviewCanvas.clientWidth;
        const height = mainPreviewCanvas.clientHeight;

        mainPreviewRenderer = new THREE.WebGLRenderer({ canvas: mainPreviewCanvas, antialias: true });
        mainPreviewRenderer.setSize(width, height);
        mainPreviewRenderer.setPixelRatio(window.devicePixelRatio);
            mainPreviewRenderer.setClearColor(0xff0000, 1); // Bright red clear color for debugging
            console.log('[DebugPreview] mainPreviewCanvas initial dimensions in setup:', { width, height, offsetWidth: mainPreviewCanvas.offsetWidth, offsetHeight: mainPreviewCanvas.offsetHeight });

        mainPreviewScene = new THREE.Scene();
        mainPreviewCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000); // Wider FoV, larger far plane
        mainPreviewCamera.position.set(0, 2, 20); // Moved camera further back
        mainPreviewCamera.lookAt(0, 0, 0); // Ensure it looks at the origin

        mainPreviewLight = new THREE.DirectionalLight(0xffffff, 1.2);
        mainPreviewLight.position.set(0.5, 0.8, 0.5).normalize();
        mainPreviewScene.add(mainPreviewLight);
        mainPreviewScene.add(new THREE.AmbientLight(0xaaaaee, 0.6));

        const previewGeometry = new THREE.TorusKnotGeometry(4, 1.2, 128, 16);
        // Use currentNoiseScale and currentPlanetOffset for the main preview material
        const previewMaterial = createUnifiedPlanetMaterial(
            compInfo.topElements, 
            currentNoiseScale,      // Pass currentNoiseScale
            currentPlanetOffset     // Pass currentPlanetOffset
        );

        // Explicitly set/update uniforms after material creation to be certain
        if (previewMaterial.uniforms.planetOffset) {
            previewMaterial.uniforms.planetOffset.value.copy(currentPlanetOffset);
        } else {
            console.warn("Main preview material does not have planetOffset uniform");
        }
        if (previewMaterial.uniforms.noiseScale) {
            previewMaterial.uniforms.noiseScale.value = currentNoiseScale;
        } else {
            console.warn("Main preview material does not have noiseScale uniform");
        }
        // Ensure other critical uniforms are set if they exist and are not handled by createUnifiedPlanetMaterial overrides
        // For example, if topElements were not deeply cloned or if shader expects direct array assignments:
        if (previewMaterial.uniforms.elementColors && compInfo.topElements?.colors) {
            const paddedColors = [...compInfo.topElements.colors];
            while (paddedColors.length < MAX_SHADER_ELEMENTS) paddedColors.push(new THREE.Color(0x000000));
            if (paddedColors.length > MAX_SHADER_ELEMENTS) paddedColors.length = MAX_SHADER_ELEMENTS;
            previewMaterial.uniforms.elementColors.value = paddedColors;
        }
        if (previewMaterial.uniforms.elementWeights && compInfo.topElements?.weights) {
            const paddedWeights = [...compInfo.topElements.weights];
            while (paddedWeights.length < MAX_SHADER_ELEMENTS) paddedWeights.push(0.0);
            if (paddedWeights.length > MAX_SHADER_ELEMENTS) paddedWeights.length = MAX_SHADER_ELEMENTS;
            previewMaterial.uniforms.elementWeights.value = paddedWeights;
        }
        // Add similar explicit settings for metallic, roughness, patternIntensity if issues persist

        previewMaterial.side = THREE.DoubleSide;
        if (previewMaterial.uniforms.u_showInternalMaterial) {
            previewMaterial.uniforms.u_showInternalMaterial.value = false;
        }
        previewMaterial.needsUpdate = true;

        mainPreviewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
        mainPreviewMesh.name = "main_debug_preview_mesh";
        mainPreviewMesh.position.set(0, 0, 0);
        if (!mainPreviewScene.children.includes(mainPreviewMesh)) { // Ensure mesh is added
            mainPreviewScene.add(mainPreviewMesh);
        }
        console.log('[DebugPreview] mainPreviewMesh position:', mainPreviewMesh.position);
        console.log('[DebugPreview] mainPreviewMesh scale:', mainPreviewMesh.scale);
        console.log('[DebugPreview] mainPreviewCamera position:', mainPreviewCamera.position);
        mainPreviewScene.add(mainPreviewMesh);

        // --- Instantiate OrbitControls --- 
        if (mainPreviewCamera && mainPreviewRenderer) { 
            mainPreviewControls = new OrbitControls(mainPreviewCamera, mainPreviewRenderer.domElement);
            mainPreviewControls.enableDamping = true; 
            mainPreviewControls.dampingFactor = 0.1;
            mainPreviewControls.screenSpacePanning = false; 
            mainPreviewControls.target.set(0, 0, 0); 
            mainPreviewControls.update(); 
        } else {
            console.error("Camera or Renderer missing for OrbitControls setup.");
        }
    } else {
        console.error("Main preview canvas not available for setup.");
    }
    // --------------------------------

    // --- Create Element Cards with Swatches --- 
    const topElements = compInfo.topElements!;
    swatchSetups = []; // Reset the setups array
    if (detailsContainer) detailsContainer.innerHTML = ''; // Clear container
    else return; 

    pendingSwatchSetups = []; // Clear pending setups before creating new ones

    // Swatch Generation Params
    const swatchChunkSize = 8; 
    const swatchChunkHeight = 8;
    const swatchNoiseLayers: [number, number, number] = [10, 5, 5];
    const swatchSeed = 12345;
    
    // --- Card Detail Style Helper ---
    const cardDetailStyle = { margin: '2px 0', fontSize: '0.8em', color: '#a0aec0', lineHeight: '1.4' }; // Updated style
    // --------------------------------

    for (let i = 0; i < topElements.symbols.length; i++) {
        const symbol = topElements.symbols[i];
        if (!symbol || topElements.colors[i].getHexString() === 'aaaaaa') continue;
        console.log(`  -> Creating Card for element: ${symbol}`); 

        const elementColor = topElements.colors[i];
        const elementVisualParams = topElements.visualParams[i]; // Store for zoom

        // 1. Create the Element Card Div (holds details + canvas)
        const elementCard = document.createElement('div');
        elementCard.className = 'debug-element-card';
        Object.assign(elementCard.style, {
            padding: '10px 12px', // Adjusted padding
            backgroundColor: 'rgba(45, 55, 72, 0.8)', // Slightly different bg
            borderRadius: '5px',
            border: '1px solid #4a5568', // Consistent border
            textAlign: 'left',
            minWidth: '160px', // Slightly wider
            display: 'flex',
            flexDirection: 'column',
            gap: '6px', // Consistent gap
            cursor: 'pointer' // Add pointer cursor to indicate hover action
        });

        // --- Add Hover Listeners for Zoom --- 
        elementCard.onmouseover = () => {
            // Pass necessary info to the zoom function
            showZoomedSwatch(symbol, elementColor, elementVisualParams);
        };
        elementCard.onmouseout = (event) => {
            // Check if the mouse is moving to the zoom overlay itself
            if (zoomOverlay && event.relatedTarget instanceof Node && zoomOverlay.contains(event.relatedTarget)) {
                return; // Don't hide if moving onto the zoom overlay
            }
            hideZoomedSwatch();
        };
        // ------------------------------------

        // 2. Create HTML Details (Append directly to card)
        
        // --- Header (Color Box + Name) --- 
        const headerDiv = document.createElement('div');
        Object.assign(headerDiv.style, { 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '5px' // Adjust spacing
        });
        const colorBox = document.createElement('div');
        Object.assign(colorBox.style, {
            width: '16px', // Slightly larger
            height: '16px',
            backgroundColor: `#${topElements.colors[i].getHexString()}`,
            border: '1px solid #718096', // Lighter border
            borderRadius: '3px', 
            flexShrink: '0'
        });
        const nameP = document.createElement('p');
        const fullName = getFullNameFromSymbol(symbol);
        nameP.innerText = `${fullName} (${symbol})`;
        Object.assign(nameP.style, { margin: '0', fontWeight: '600', fontSize: '0.95em', color: '#e2e8f0' }); // Adjusted style
        headerDiv.appendChild(colorBox);
        headerDiv.appendChild(nameP);
        elementCard.appendChild(headerDiv);
        // ---------------------------------

        // --- Weight, Metallic, Roughness, Pattern --- 
        const weightP = document.createElement('p');
        const weightPercent = (topElements.weights[i] * 100).toFixed(1);
        weightP.innerText = `Weight: ${weightPercent}%`;
        Object.assign(weightP.style, cardDetailStyle);
        elementCard.appendChild(weightP); 

        const metallicP = document.createElement('p');
        metallicP.innerText = `Metallic: ${(topElements.visualParams[i]?.metallic ?? 0.5).toFixed(2)}`;
        Object.assign(metallicP.style, cardDetailStyle);
        elementCard.appendChild(metallicP); 

        const roughnessP = document.createElement('p');
        roughnessP.innerText = `Roughness: ${(topElements.visualParams[i]?.roughness ?? 0.5).toFixed(2)}`;
        Object.assign(roughnessP.style, cardDetailStyle);
        elementCard.appendChild(roughnessP);
        
        const patternP = document.createElement('p');
        patternP.innerText = `Pattern: ${(topElements.visualParams[i]?.patternIntensity ?? 0.0).toFixed(2)}`;
        Object.assign(patternP.style, cardDetailStyle);
        elementCard.appendChild(patternP); 
        // -------------------------------------------

        // 3. Create Swatch Canvas Container (inside card)
        const swatchCanvasContainer = document.createElement('div');
        Object.assign(swatchCanvasContainer.style, {
            width: '120px', // Larger swatch area
            height: '120px',
            margin: '10px auto 0 auto', // Center and add margin
            backgroundColor: '#1a202c', // Darker swatch bg
            borderRadius: '4px',
            border: '1px solid #4a5568', // Consistent border
            overflow: 'hidden',
            position: 'relative' 
        });
        elementCard.appendChild(swatchCanvasContainer);

        // 4. Create Swatch Canvas (inside container)
        const swatchCanvas = document.createElement('canvas');
        swatchCanvas.id = `swatch-canvas-${symbol}`; 
        Object.assign(swatchCanvas.style, {
            display: 'block', 
            width: '100%',   
            height: '100%',  
            position: 'absolute', 
            top: '0',
            left: '0'
        });
        swatchCanvasContainer.appendChild(swatchCanvas);
        
        // *** Append Card to DOM BEFORE setting up WebGL ***
        detailsContainer.appendChild(elementCard);

        // Store data for deferred setup (for small swatches)
        pendingSwatchSetups.push({
            symbol: symbol,
            color: elementColor,
            swatchCanvasContainer: swatchCanvasContainer,
            swatchCanvas: swatchCanvas,
            topElementsData: {
                symbols: [symbol, ...Array(MAX_SHADER_ELEMENTS-1).fill("")],
                colors: [elementColor, ...Array(MAX_SHADER_ELEMENTS-1).fill(new THREE.Color(0x000000))],
                weights: [1.0, ...Array(MAX_SHADER_ELEMENTS-1).fill(0.0)],
                visualParams: [elementVisualParams, ...Array(MAX_SHADER_ELEMENTS-1).fill({ metallic: 0.0, roughness: 1.0, patternIntensity: 0.0 })]
            }
        });
    }
    console.log(`🎨 Debug Preview Scene Setup: Main preview setup complete. Stored ${pendingSwatchSetups.length} swatches for deferred initialization.`);
    
    // Initialize swatches if the preview container is visible
    if (previewContainer && previewContainer.style.display !== 'none') {
        console.log("setupDebugPreviewScene: Calling initializePendingSwatches since modal is visible.");
        initializePendingSwatches();
    }
}

// --- Functions for Zoomed Swatch Preview ---

function showZoomedSwatch(symbol: string, color: THREE.Color, visualParams: VisualParams | undefined) {
    console.log(`[+] showZoomedSwatch START for ${symbol}`);
    if (isZoomVisible || zoomOverlay) {
        console.log(`[!] showZoomedSwatch ABORTED for ${symbol} - already visible or overlay exists.`);
        return;
    }
    isZoomVisible = true;
    console.log(`Showing zoomed swatch for: ${symbol}`);

    // --- Create Overlay HTML ---
    zoomOverlay = document.createElement('div');
    zoomOverlay.id = 'debug-zoom-swatch-overlay';
    Object.assign(zoomOverlay.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'clamp(400px, 50vw, 600px)', // Size for the zoom view
        height: 'clamp(400px, 50vh, 600px)',
        backgroundColor: '#2d3748', 
        border: '1px solid #4a5568',
        borderRadius: '8px',
        zIndex: '25000', // Higher than main preview
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
        overflow: 'hidden'
    });
    // Hide zoom if clicking outside overlay (on the backdrop effectively)
     zoomOverlay.onmouseleave = hideZoomedSwatch; // Hide if mouse leaves overlay too

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '8px 15px',
        backgroundColor: '#1a202c',
        borderBottom: '1px solid #4a5568',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: '0'
    });
    const title = document.createElement('h5');
    title.textContent = `Zoom Preview: ${getFullNameFromSymbol(symbol)} (${symbol})`;
    title.style.margin = '0';
    title.style.color = '#e2e8f0';
    title.style.fontWeight = '500';
    header.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.innerText = '×';
    closeButton.title = 'Close Zoom Preview';
    Object.assign(closeButton.style, { /* ... Use consistent close button style ... */ 
        backgroundColor: 'transparent', color: '#a0aec0', border: 'none', borderRadius: '50%',
        width: '24px', height: '24px', lineHeight: '22px', textAlign: 'center',
        cursor: 'pointer', fontSize: '1.3em', fontWeight: 'bold', 
        transition: 'color 0.2s ease, background-color 0.2s ease'
    });
    closeButton.onmouseover = () => { closeButton.style.color = '#fff'; closeButton.style.backgroundColor = '#e53e3e'; };
    closeButton.onmouseout = () => { closeButton.style.color = '#a0aec0'; closeButton.style.backgroundColor = 'transparent'; };
    closeButton.onclick = hideZoomedSwatch;
    header.appendChild(closeButton);
    zoomOverlay.appendChild(header);

    // Canvas Container
    const canvasContainer = document.createElement('div');
    canvasContainer.style.flexGrow = '1';
    canvasContainer.style.position = 'relative';
    canvasContainer.style.overflow = 'hidden';
    zoomOverlay.appendChild(canvasContainer);

    // Canvas
    zoomCanvas = document.createElement('canvas');
    zoomCanvas.style.display = 'block';
    zoomCanvas.style.width = '100%';
    zoomCanvas.style.height = '100%';
    canvasContainer.appendChild(zoomCanvas);

    document.body.appendChild(zoomOverlay);
    // --------------------------

    // --- Initialize Three.js for Zoom AFTER appending to DOM ---
    requestAnimationFrame(() => {
        console.log(`[+] showZoomedSwatch rAF START for ${symbol}`);
        
        // --- RACE CONDITION FIX --- 
        if (!isZoomVisible) { 
            console.log(`[!] showZoomedSwatch rAF ABORTED for ${symbol} - Zoom is no longer visible (mouse likely moved out).`);
            // No need to call hideZoomedSwatch here, it should have already been called or is in progress.
            return; 
        }
        // --------------------------

        if (!zoomCanvas || !canvasContainer) {
             console.log(`[!] showZoomedSwatch rAF ABORTED for ${symbol} - canvas or container missing.`);
             hideZoomedSwatch(); // Ensure cleanup if elements somehow vanished differently
             return;
        }
        try {
            const width = canvasContainer.clientWidth;
            const height = canvasContainer.clientHeight;
            if (width <= 0 || height <= 0) {
                 console.warn("Zoom canvas container has no dimensions yet.");
                 hideZoomedSwatch();
                 return; 
            }

            // --- Renderer, Scene, Camera, Lights --- 
            zoomRenderer = new THREE.WebGLRenderer({ canvas: zoomCanvas, antialias: true });
            zoomRenderer.setSize(width, height);
            zoomRenderer.setPixelRatio(window.devicePixelRatio);
            zoomRenderer.setClearColor(0x1a1c20, 1);
            zoomRenderer.outputEncoding = THREE.sRGBEncoding;

            zoomScene = new THREE.Scene();
            const aspect = width / height;
            zoomCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100);
            zoomCamera.position.set(15, 15, 15); // Adjust camera for terrain view
            zoomCamera.lookAt(0,0,0);

            const zoomLight = new THREE.DirectionalLight(0xffffff, 1.0);
            zoomLight.position.set(0.5, 1, 1).normalize();
            zoomScene.add(zoomLight);
            zoomScene.add(new THREE.AmbientLight(0xcccccc, 0.7));
            // ----------------------------------------

            // --- Generate Small Terrain for Preview --- 
            console.log(`   -> Zoom Swatch ${symbol}: Generating preview terrain...`);
            // Fixed parameters for preview noise/mesh
            const previewNoiseLayers: NoiseLayers = [20, 10, 5]; // Correct type, adjust values for small preview
            const previewSeed: Seed = 12345; // Correct type
            
            // Corrected generateNoiseMap call (6 arguments max)
            const previewNoiseMap: NoiseMap = generateNoiseMap(0, 0, 0, previewNoiseLayers, previewSeed, false);

            // const previewVertices = generateMeshVertices(0, 0, 0, { noiseMap: previewNoiseMap }, true);
            // if (!previewVertices || previewVertices.length === 0) {
            //     throw new Error("Zoom preview mesh generation failed.");
            // }

            // const zoomGeometry = new THREE.BufferGeometry();
            // zoomGeometry.setAttribute('position', new THREE.BufferAttribute(previewVertices, 3));
            // zoomGeometry.computeVertexNormals(); 

            const zoomGeometry = generateMeshVertices(0, 0, 0, { noiseMap: previewNoiseMap }, true);
            if (!zoomGeometry || !zoomGeometry.getAttribute('position') || (zoomGeometry.getAttribute('position') as THREE.BufferAttribute).count === 0) {
                throw new Error("Zoom preview mesh generation failed or returned empty geometry.");
            }
            // Normals should already be computed by generateMeshVertices if it returns a complete geometry
            // If not, uncomment: zoomGeometry.computeVertexNormals(); 
            // ------------------------------------------

            // --- Create Material for Single Element --- 
            // --- >> PAD the TopElementsData for the shader << ---
            const paddedSymbols: string[] = [symbol];
            const paddedColors: THREE.Color[] = [color];
            const paddedWeights: number[] = [1.0];
            const paddedVisualParams: VisualParams[] = [visualParams ?? { metallic: 0.5, roughness: 0.6, patternIntensity: 0.1 }];
            
            const defaultColor = new THREE.Color(0x000000); // Black for padding
            const defaultVisualParams: VisualParams = { metallic: 0.0, roughness: 1.0, patternIntensity: 0.0 }; // Default for padding

            for (let i = 1; i < MAX_SHADER_ELEMENTS; i++) {
                paddedSymbols.push(''); // Pad symbol (not directly used by shader uniform)
                paddedColors.push(defaultColor);
                paddedWeights.push(0.0);
                paddedVisualParams.push(defaultVisualParams);
            }
            // -------------------------------------------------

            const singleElementCompPadded: TopElementsData = {
                symbols: paddedSymbols,
                colors: paddedColors,
                weights: paddedWeights,
                visualParams: paddedVisualParams
            };
            
            const zoomMaterial = createUnifiedPlanetMaterial(singleElementCompPadded); // Use padded data
            
            // Ensure the uniforms are correctly set
            if (zoomMaterial.uniforms && zoomMaterial.uniforms.topElementColors) {
                zoomMaterial.uniforms.topElementColors.value = paddedColors.map(color => color.toArray());
            }
            if (zoomMaterial.uniforms && zoomMaterial.uniforms.topElementVisualParams) {
                zoomMaterial.uniforms.topElementVisualParams.value = paddedVisualParams.map(params => [params.metallic, params.roughness, params.patternIntensity]);
            }
            zoomMaterial.needsUpdate = true;

            zoomMesh = new THREE.Mesh(zoomGeometry, zoomMaterial);
            zoomMesh.name = `zoom_swatch_${symbol}`;
            zoomScene.add(zoomMesh);

            // --- Controls --- 
            zoomControls = new OrbitControls(zoomCamera, zoomRenderer.domElement);
            zoomControls.enableDamping = true;
            zoomControls.dampingFactor = 0.1;
            // Ensure target is initialized correctly here
            if (!zoomControls.target) {
                 console.warn(`[!] Initializing zoomControls.target for ${symbol} as it was falsy.`);
                 zoomControls.target = new THREE.Vector3(0, 0, 0);
            } else {
                 zoomControls.target.set(0, 0, 0); // Target center of the small mesh
            }
            zoomControls.update(); // Initial update
            // ----------------

            zoomAnimate();
             console.log(`[+] Zoom view for ${symbol} initialized successfully.`);

        } catch (error) {
            console.error(`Error setting up zoom swatch for ${symbol}:`, error);
            hideZoomedSwatch(); // Clean up if setup fails
        } finally {
             console.log(`[+] showZoomedSwatch rAF END for ${symbol}`);
        }
    });
    console.log(`[+] showZoomedSwatch END for ${symbol}`);
}

function hideZoomedSwatch() {
    console.log("[-] hideZoomedSwatch START");
    if (!isZoomVisible) {
        console.log("[-] hideZoomedSwatch ABORTED - not visible.");
        return;
    }
    console.log("Hiding zoomed swatch.");
    isZoomVisible = false;

    if (zoomAnimationFrameId) {
        cancelAnimationFrame(zoomAnimationFrameId);
        zoomAnimationFrameId = null;
    }
    if (zoomControls) {
        zoomControls.dispose();
        zoomControls = null;
    }
    // --- Manual Scene Disposal --- 
    if (zoomScene) {
        // Traverse and dispose geometries and materials
        zoomScene.traverse(object => {
            if (object instanceof THREE.Mesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    // Handle multi-materials if necessary
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
            // Dispose other resource types if added (textures, lights?, etc.)
        });
        // Optionally remove children explicitly before nullifying scene
        while(zoomScene.children.length > 0){ 
            zoomScene.remove(zoomScene.children[0]); 
        }
        zoomScene = null; // Release reference after cleanup
    }
    // ---------------------------
    if (zoomRenderer) {
        zoomRenderer.dispose(); // Dispose renderer resources
        zoomRenderer = null;
    }
    // Nullify references
    zoomCamera = null;
    zoomMesh = null; // Reference is cleared by scene traversal/removal
    zoomCanvas = null;
    
    if (zoomOverlay) {
        zoomOverlay.onmouseleave = null; // Remove listener
        if (zoomOverlay.parentElement) {
            zoomOverlay.parentElement.removeChild(zoomOverlay);
        }
        zoomOverlay = null;
    }
    console.log("[-] hideZoomedSwatch END");
}

function zoomAnimate() {
    if (!isZoomVisible || !zoomRenderer || !zoomScene || !zoomCamera) {
        zoomAnimationFrameId = null;
        return; // Stop animation if hidden or not set up
    }
    zoomAnimationFrameId = requestAnimationFrame(zoomAnimate);

    if (zoomControls) {
        try {
            // Simplified Safeguard: Only check if target is falsy
            if (!zoomControls.target) {
                console.warn("ZoomControls target was falsy! Resetting:", zoomControls.target);
                zoomControls.target = new THREE.Vector3(0, 0, 0);
            }
            zoomControls.update(); // Update controls
        } catch (error) {
            console.error("Error updating zoom controls:", error);
            // Potentially stop animation or controls if critical error
        }
    }

    zoomRenderer.render(zoomScene, zoomCamera); // <<< ADDED THIS LINE
}




/**
 * Renders the preview scene(s).
 */
export function renderDebugPreviewScene(mainLightDirection: THREE.Vector3, time: number) {
    customLogger.log(`renderDebugPreviewScene: Called. Visible: ${isVisible}, Renderer: ${!!mainPreviewRenderer}, Scene: ${!!mainPreviewScene}, Camera: ${!!mainPreviewCamera}`, "debug");
    if (!isVisible) return;

    // --- Render Main Preview --- 
    if (mainPreviewRenderer && mainPreviewScene && mainPreviewCamera) { 
        const width = mainPreviewCanvas?.width || 0;
        const height = mainPreviewCanvas?.height || 0;
        if (width === 0 || height === 0) {
            console.warn("Main preview canvas has zero width or height, skipping render.");
            return;
        }
        if(mainPreviewLight) mainPreviewLight.position.copy(mainLightDirection);
        
        if(mainPreviewMesh && mainPreviewMesh.material instanceof THREE.ShaderMaterial) {
             const mat = mainPreviewMesh.material;
             if (mat.uniforms) {
                 if (mat.uniforms.time) mat.uniforms.time.value = time;
                 if (mat.uniforms.lightDirection) mat.uniforms.lightDirection.value.copy(mainLightDirection);
             }
        }

        if (mainPreviewControls) {
            mainPreviewControls.update();
        } else if (mainPreviewMesh) { 
            mainPreviewMesh.rotation.y += 0.005;
            mainPreviewMesh.rotation.x += 0.002;
        }

        console.log("[DebugPreview] renderDebugPreviewScene: Rendering main scene...");
        mainPreviewRenderer.render(mainPreviewScene, mainPreviewCamera);
        console.log('[DebugPreview] mainPreviewRenderer.info:', mainPreviewRenderer.info.render);
    } 
    // --------------------------

    // --- Render Swatch Previews --- 
    swatchSetups.forEach((setup, index) => {
        setup.mesh.rotation.y += 0.01;
        setup.mesh.rotation.x += 0.005;

        try {
             // console.log(`Rendering swatch ${index}`); 
             setup.renderer.render(setup.scene, setup.camera);
        } catch (renderError) {
             console.error(`Error rendering swatch scene ${index}:`, renderError, setup);
        }
    });
}

/**
 * Makes the debug preview UI visible.
 */
export function showDebugPreview() {
    console.log("showDebugPreview: Called. Current isVisible:", isVisible);

    if (!previewContainer) {
        console.log("showDebugPreview: UI container not found. Creating debug preview UI...");
        createDebugPreviewUI();
        previewContainer = document.getElementById('debug-preview-modal') as HTMLElement;
        if (!previewContainer) {
            console.error("showDebugPreview: CRITICAL - Failed to create debug preview UI. Aborting.");
            return;
        }
        console.log("showDebugPreview: UI created successfully.", previewContainer);
    } else {
        console.log("showDebugPreview: UI container already exists.");
    }

    // Always ensure the container is visible when this function is called
    previewContainer.style.display = 'flex';
    isVisible = true;
    console.log(`showDebugPreview: Set display to 'flex'. Actual display: ${previewContainer.style.display}, isVisible: ${isVisible}`);

    // Force a reflow to ensure the modal is properly displayed before content setup
    previewContainer.offsetHeight;

    // Check if scene content needs to be (re)populated
    // We can check for a specific element that setupDebugPreviewScene creates, e.g., mainPreviewCanvas or generalInfo content
    const mainCanvasExists = previewContainer.querySelector('#debug-main-canvas-container canvas');
    const generalInfoHasContent = generalInfoContainer && generalInfoContainer.hasChildNodes();

    // if (!mainCanvasExists || !generalInfoHasContent) { // Condition to re-setup scene
    // For now, let's always try to get fresh planet data and setup scene, 
    // as setupDebugPreviewScene itself handles cleanup.
    // This ensures that if planet data changes, the preview updates.
    console.log("showDebugPreview: Proceeding to (re)setup scene content.");

    console.log("showDebugPreview: Attempting to import isolatedTerrainViewer planet data...");
    import('./isolatedTerrainViewer/core').then(({ getCurrentCompInfo, getCurrentPlanetOffset, getCurrentSeed, getCurrentNoiseLayers, getCurrentNoiseScale }) => {
        console.log("showDebugPreview: Successfully imported isolatedTerrainViewer data functions.");
        const compInfo = getCurrentCompInfo();
        const planetOffset = getCurrentPlanetOffset();
        const seed = getCurrentSeed();
        const noiseLayers = getCurrentNoiseLayers();
        const noiseScale = getCurrentNoiseScale();
        
        console.log("showDebugPreview: Retrieved terrain data:", {
            compInfo,
            planetOffset,
            seed,
            noiseLayers,
            noiseScale
        });

        if (compInfo && compInfo.topElements && seed !== null && noiseLayers) {
            console.log("showDebugPreview: Setting up scene with isolatedTerrainViewer data.");
            setupDebugPreviewScene(
                compInfo,
                planetOffset || new THREE.Vector3(0, 0, 0),
                'earth',
                seed,
                noiseScale || 0.1
            );
        } else {
            console.warn("showDebugPreview: No valid isolatedTerrainViewer data. Falling back to default.", {
                compInfo,
                planetOffset,
                seed,
                noiseLayers,
                noiseScale
            });
            import('../world/planetComposition').then(({ getPlanetCompositionInfo }) => {
                const planetType = 'earth';
                const fallbackSeed = 12345;
                const fallbackPlanetOffset = new THREE.Vector3(0, 0, 0);
                const fallbackCompInfo = getPlanetCompositionInfo(planetType);
                console.log("showDebugPreview: Setting up scene with fallback default data.");
                setupDebugPreviewScene(fallbackCompInfo, fallbackPlanetOffset, planetType, fallbackSeed, 0.1);
            }).catch(err => {
                console.error("showDebugPreview: Error importing getPlanetCompositionInfo for fallback:", err);
            });
        }
    }).catch(err => {
        console.error("showDebugPreview: Error importing isolatedTerrainViewer data. Using final fallback.", err);
        import('../world/planetComposition').then(({ getPlanetCompositionInfo }) => {
            const planetType = 'earth';
            const fallbackSeed = 12345;
            const fallbackPlanetOffset = new THREE.Vector3(0, 0, 0);
            const fallbackCompInfo = getPlanetCompositionInfo(planetType);
            console.log("showDebugPreview: Setting up scene with FINAL fallback default data.");
            setupDebugPreviewScene(fallbackCompInfo, fallbackPlanetOffset, planetType, fallbackSeed, 0.1);
        }).catch(finalErr => {
            console.error("showDebugPreview: CRITICAL - Error importing getPlanetCompositionInfo for FINAL fallback:", finalErr);
            console.error("showDebugPreview: All fallbacks failed. Debug preview content cannot be set up.");
        });
    });
    // } else {
    //     console.log("showDebugPreview: Scene content (main canvas and general info) appears to be already set up. Skipping scene setup.");
    //     // If content is already there, we might still need to re-init swatches if they weren't done
    //     if (pendingSwatchSetups.length > 0) {
    //         console.log("showDebugPreview: Initiating deferred swatch setup for pending swatches as modal is now visible.");
    //         initializePendingSwatches(); // New helper function
    //     }
    // }

    // Deferred swatch initialization is now handled at the end of setupDebugPreviewScene, 
    // which is called after the modal is confirmed visible by this function.

    onPreviewResize(); // Ensure layout is correct
    console.log("showDebugPreview: Finished.");
}

// Helper function for swatch initialization (can be moved or kept here)
async function initializePendingSwatches() {
    if (!previewContainer || previewContainer.style.display === 'none') {
        console.warn("initializePendingSwatches: Aborted. Preview container not visible or not found.");
        return;
    }
    console.log(`initializePendingSwatches: Initializing ${pendingSwatchSetups.length} pending swatches.`);
    swatchSetups = []; // Clear existing setups before re-initializing
    pendingSwatchSetups.forEach(pending => {
        ((p) => {
            const { symbol, color, swatchCanvasContainer, swatchCanvas } = p;
            // Double requestAnimationFrame to wait for layout stabilization
            requestAnimationFrame(() => {
                requestAnimationFrame(async () => {
                    try {
                        if (!swatchCanvasContainer || !document.body.contains(swatchCanvasContainer)) {
                            console.warn(`   -> Swatch ${symbol} - rAFx2 Init: Swatch container no longer in DOM. Skipping.`);
                            return;
                        }
                        const containerWidth = swatchCanvasContainer.clientWidth;
                        const containerHeight = swatchCanvasContainer.clientHeight;
                        console.log(`  -> Swatch ${symbol} - rAFx2 Init: Container dimensions: ${containerWidth}x${containerHeight}`);

                        if (containerWidth <= 0 || containerHeight <= 0) {
                            console.warn(`   -> Swatch ${symbol} - rAFx2 Init: Container still has zero dimensions. Cannot initialize WebGL.`);
                            swatchCanvasContainer.innerHTML = '<p style="color: orange; font-size: 10px; text-align: center; margin-top: 30px;">Size Zero</p>';
                            return;
                        }
                        swatchCanvas.width = containerWidth;
                        swatchCanvas.height = containerHeight;

                        const swatchRenderer = new THREE.WebGLRenderer({ canvas: swatchCanvas, antialias: true });
                        swatchRenderer.setSize(containerWidth, containerHeight);
                        swatchRenderer.setViewport(0, 0, containerWidth, containerHeight);
                        swatchRenderer.setPixelRatio(window.devicePixelRatio);
                        swatchRenderer.setClearColor(0x22252a, 1);

                        const swatchScene = new THREE.Scene();
                        const aspect = containerWidth / containerHeight;
                        const swatchCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
                        swatchCamera.position.z = 20;
                        swatchCamera.lookAt(0, 0, 0);

                        const swatchLight = new THREE.DirectionalLight(0xffffff, 1.0);
                        swatchLight.position.set(0.5, 1, 0.75).normalize();
                        swatchScene.add(swatchLight);
                        swatchScene.add(new THREE.AmbientLight(0xcccccc, 0.5));

                        const swatchGeometry = new THREE.SphereGeometry(1.5, 16, 12);
                        
                        // Import the material creation function synchronously
                        const { createUnifiedPlanetMaterial } = await import('../rendering/materials');
                        
                        // Create proper shader material with noise maps for the swatch
                        const swatchMaterial = createUnifiedPlanetMaterial(
                            p.topElementsData, // Use the topElementsData from the pending setup item
                            currentNoiseScale,
                            currentPlanetOffset
                        );
                        
                        const swatchMesh = new THREE.Mesh(swatchGeometry, swatchMaterial);
                        swatchScene.add(swatchMesh);

                        swatchSetups.push({
                            canvas: swatchCanvas,
                            renderer: swatchRenderer,
                            scene: swatchScene,
                            camera: swatchCamera,
                            light: swatchLight,
                            mesh: swatchMesh
                        });
                        console.log(`   -> Swatch ${symbol} - Setup Complete. Total final setups: ${swatchSetups.length}`);
                    } catch (error) {
                        console.error(`   -> Swatch ${symbol} - Error during deferred setup:`, error);
                        if (swatchCanvasContainer && document.body.contains(swatchCanvasContainer)) {
                           swatchCanvasContainer.innerHTML = '<p style="color: red; font-size: 10px; text-align: center; margin-top: 30px;">Setup Error</p>';
                        }
                    }
                });
            });
        })(pending);
    });
    pendingSwatchSetups = []; // Clear after attempting initialization
    console.log("initializePendingSwatches: Finished processing pending swatches.");
}



    if (mainPreviewScene) {
        if (mainPreviewMesh) {
            if (mainPreviewMesh.geometry) mainPreviewMesh.geometry.dispose();
            if (mainPreviewMesh.material && !(mainPreviewMesh.material instanceof Array)) {
                mainPreviewMesh.material.dispose();
            }
            mainPreviewScene.remove(mainPreviewMesh);
            mainPreviewMesh = null;
            console.log("cleanupDebugPreviewUIContent: Disposed and removed main preview mesh.");
        }
        // . Ensure main swatch uses unified planet shader by setting the material directly.
        if (mainPreviewMesh) {
            mainPreviewMesh.material = createUnifiedPlanetMaterial(compInfo.topElements, currentNoiseScale, currentPlanetOffset);
            mainPreviewMesh.material.needsUpdate = true;
        }
        mainPreviewScene = null;
        console.log("cleanupDebugPreviewUIContent: Nullified main preview scene.");
    }
    mainPreviewCamera = null;
    mainPreviewLight = null;
    if (swatchSetups.length > 0) {
        console.log(`cleanupDebugPreviewUIContent: Cleaning up ${swatchSetups.length} swatch setups.`);
        swatchSetups.forEach((setup, index) => {
            if (setup.renderer) setup.renderer.dispose();
            if (setup.scene) {
                setup.scene.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        if (object.geometry) object.geometry.dispose();
                        if (object.material && !(object.material instanceof Array)) {
                            object.material.dispose();
                        }
                    }
                });
            }
            console.log(`cleanupDebugPreviewUIContent: Cleaned swatch setup ${index}.`);
        });
        swatchSetups = [];
    }
    pendingSwatchSetups = [];
    console.log("cleanupDebugPreviewUIContent: Finished cleanup of 3D content.");

/**
 * Cleans up ALL Debug Preview UI resources, including HTML and 3D content.
 * Call this when the debug preview is to be completely removed and reset.
 */
export function cleanupDebugPreviewUI() {
    console.log("cleanupDebugPreviewUI: Starting full cleanup (HTML and 3D).");
    cleanupDebugPreviewUIContent(); // Clean up 3D resources first

    // Remove the main container from DOM
    if (previewContainer) {
        if (previewContainer.parentElement) {
            previewContainer.parentElement.removeChild(previewContainer);
            console.log("cleanupDebugPreviewUI: Removed previewContainer from DOM.");
        }
        previewContainer = null;
    }
    // Nullify other HTML element references
    detailsContainer = null;
    generalInfoContainer = null;
    mainPreviewCanvas = null; // It's inside previewContainer, so removed with it.

    isVisible = false; // Reset visibility state
    console.log("cleanupDebugPreviewUI: Full cleanup complete. UI is fully reset.");
}
export function hideDebugPreview() {
    if (previewContainer) {
        previewContainer.style.display = 'none';
        isVisible = false;
    }
}