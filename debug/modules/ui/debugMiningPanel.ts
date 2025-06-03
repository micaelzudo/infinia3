import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Needed for isolated view
import { CHUNK_SIZE } from '../../constants_debug'; // Still potentially useful
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug'; // Keep for adapting generation
import { createUnifiedPlanetMaterial } from '../rendering/materials'; // Keep for adapting generation
import { disposeNode } from '../../disposeNode_debug'; // Keep for adapting cleanup
import { generateNoiseMap } from '../../noiseMapGenerator_debug'; // Need this for generation
import { editNoiseMapChunks } from '../../noiseMapEditor_debug'; // Need this for editing
import { toggleInternalGridVisualizer } from './isolatedTerrainViewer'; // Import the toggle function

// Import mining system
import {
    ResourceInventory,
    createInventory
} from '../mining/resourceInventory';
import {
    createInventoryUI,
    updateInventoryUI,
    addInventoryStyles
} from '../mining/resourceInventoryUI';
import {
    MiningTool,
    MiningToolType,
    createDefaultTools,
    mineAtPoint,
    damageTool
} from '../mining/miningSystem';
import {
    createMiningToolsUI,
    updateToolsUI,
    addMiningToolsStyles
} from '../mining/miningToolsUI';
import type { NoiseMap, NoiseLayers, Seed, LoadedChunks } from '../../types_debug'; // Need NoiseMap/LoadedChunks here
import type { TopElementsData } from '../types/renderingTypes'; // Keep for generation types

// --- Helper Function for Adding Tooltips ---
function addTooltip(element: HTMLElement, text: string) {
    if (text) {
        element.title = text;
    }
}

// Interface for dependencies passed from main panel
interface MiningDebugDependencies {
    // Only keep dependencies needed for the *isolated* generation
    noiseLayers: NoiseLayers;
    seed: Seed;
    compInfo: { topElements: TopElementsData | null };
    // Removed main scene/camera/chunks/initFn/cleanupFn as they are likely not used by the isolated view
}

// --- Module State for the Embedded Isolated Viewer ---
let miningPanelContainer: HTMLElement | null = null;
let miningCanvas: HTMLCanvasElement | null = null;
let utilitiesContainer: HTMLElement | null = null; // << NEW
let canvasContainer: HTMLElement | null = null; // << NEW
let miningRenderer: THREE.WebGLRenderer | null = null;
let miningScene: THREE.Scene | null = null;
let miningCamera: THREE.PerspectiveCamera | null = null;
let miningControls: OrbitControls | null = null;
let miningLight: THREE.DirectionalLight | null = null;
let miningTerrainMesh: THREE.Mesh | null = null;
let miningAnimationFrameId: number | null = null;
let isMiningViewInitialized = false;
let miningStatusElement: HTMLElement | null = null; // To display status/feedback
let miningTerrainNoiseMap: NoiseMap | null = null; // Store the noise map for editing

// --- Brush Controls State ---
let editBrushRadius = 3; // Default brush radius
let editBrushStrength = 0.5; // Default brush strength
let editBrushShape = 'sphere'; // Default brush shape: 'sphere', 'cube', 'cylinder'
let editBrushMode = 'add'; // Default mode: 'add' or 'remove'
let editBrushMesh: THREE.Mesh | null = null; // Visual representation of the brush

// --- Mining System State ---
let playerInventory: ResourceInventory = createInventory(100); // Player's resource inventory with capacity of 100
let inventoryPanel: HTMLElement | null = null; // UI panel for inventory
let miningTools: { [key in MiningToolType]: MiningTool } = createDefaultTools(); // Available mining tools
let activeTool: MiningToolType = MiningToolType.HAND; // Currently selected tool
let toolsPanel: HTMLElement | null = null; // UI panel for tools
let miningEffectsContainer: HTMLElement | null = null; // Container for mining effects
let internalGridVisible: boolean = false; // Whether internal grid visualizer is visible

let storedMiningDependencies: MiningDebugDependencies | null = null;
let miningLogCallback: ((keys: string[]) => void) | null = null; // Callback placeholder (maybe unused)
const MINING_CHUNK_KEY = '0,0'; // Constant key for the single chunk
let miningStatusTimeoutId: number | null = null; // For status message timeout
let miningResizeObserver: ResizeObserver | null = null; // Store resize observer

// --- Brush Visualizer ---
function updateBrushVisualizer() {
    if (!miningScene) return;

    // Remove existing brush mesh if it exists
    if (editBrushMesh) {
        miningScene.remove(editBrushMesh);
        if (editBrushMesh.geometry) editBrushMesh.geometry.dispose();
        if (editBrushMesh.material instanceof THREE.Material) editBrushMesh.material.dispose();
        editBrushMesh = null;
    }

    // Create brush geometry based on shape
    let geometry: THREE.BufferGeometry;

    // Horizontal and vertical radius for ellipsoid shapes
    const horizontalRadius = editBrushRadius;
    const verticalRadius = editBrushRadius * 20; // 20x vertical radius for deep editing

    switch (editBrushShape) {
        case 'cube':
            geometry = new THREE.BoxGeometry(
                horizontalRadius * 2,
                verticalRadius * 2,
                horizontalRadius * 2
            );
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(
                horizontalRadius,
                horizontalRadius,
                verticalRadius * 2,
                32
            );
            break;
        case 'sphere':
        default:
            // Create a sphere and scale it to an ellipsoid
            geometry = new THREE.SphereGeometry(1, 16, 16);
            const matrix = new THREE.Matrix4().makeScale(horizontalRadius, verticalRadius, horizontalRadius);
            geometry.applyMatrix4(matrix);
            break;
    }

    // Create material
    const material = new THREE.MeshBasicMaterial({
        color: editBrushMode === 'add' ? 0x00ff00 : 0xff0000, // Green for add, red for remove
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthWrite: false
    });

    // Create and add the brush mesh
    editBrushMesh = new THREE.Mesh(geometry, material);
    editBrushMesh.visible = false; // Initially hidden until mouse hover
    miningScene.add(editBrushMesh);

    console.log(`[MiningPanel] Brush visualizer updated: Shape=${editBrushShape}, Radius=${editBrushRadius}, Mode=${editBrushMode}`);
}

// --- Initialization ---
function initMiningView(container: HTMLDivElement, canvas: HTMLCanvasElement) {
    if (!container || !canvas) {
        console.error("[MiningPanel] Container or Canvas element is required for init.");
        throw new Error("Container or Canvas element is required.");
    }
    miningPanelContainer = container;

    // Basic Scene Setup
    miningScene = new THREE.Scene();
    miningScene.background = new THREE.Color('#1a202c');

    // Renderer
    miningRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    miningRenderer.setSize(container.clientWidth, container.clientHeight); // Initial size based on container
    // Renderer size now handled by CSS + ResizeObserver

    // Camera (Perspective, top-down view)
    const aspect = container.clientWidth / container.clientHeight;
    miningCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    miningCamera.position.set(0, 50, 0);
    miningCamera.lookAt(0, 0, 0);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    miningScene.add(ambientLight);
    miningLight = new THREE.DirectionalLight(0xffffff, 0.8);
    miningLight.position.set(5, 10, 7.5);
    miningScene.add(miningLight);

    // Controls
    miningControls = new OrbitControls(miningCamera, miningRenderer.domElement);
    miningControls.target.set(0, 0, 0);
    miningControls.enablePan = true;
    miningControls.enableZoom = true;
    miningControls.update();

    // Handle Resize (Listen on the canvas container element - ID from CSS)
    const canvasContainerElement = document.getElementById('mining-panel-canvas-container');
    if (!canvasContainerElement) {
        console.error("[MiningPanel] Could not find canvas container (#mining-panel-canvas-container) for resize observer.");
        return;
    }
    const onResize = () => {
        if (!miningRenderer || !miningCamera || !canvasContainerElement) return;
        const width = canvasContainerElement.clientWidth;
        const height = canvasContainerElement.clientHeight;

        if (width > 0 && height > 0 && (miningRenderer.domElement.width !== width || miningRenderer.domElement.height !== height)) {
             console.log(`[MiningPanel] Resizing renderer to ${width}x${height}`);
             miningRenderer.setSize(width, height);
             if (miningCamera instanceof THREE.PerspectiveCamera) {
                 miningCamera.aspect = width / height;
             }
             miningCamera.updateProjectionMatrix();
        }
    };
    miningResizeObserver = new ResizeObserver(onResize);
    miningResizeObserver.observe(canvasContainerElement);

    // Start Render Loop (Will be called after init)
    console.log("[MiningPanel] Isolated View Initialized");
    isMiningViewInitialized = true;
}

// --- View Reset Function ---
function resetMiningView() {
    if (miningCamera && miningControls) {
        miningCamera.position.set(0, 50, 0);
        miningCamera.lookAt(0, 0, 0);
        miningControls.target.set(0, 0, 0);
        miningControls.update();
        console.log("[MiningPanel] View Reset.");
        if (miningStatusElement) {
            miningStatusElement.textContent = 'View reset.';
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready';
            }, 1500);
        }
    } else {
        console.warn("[MiningPanel] Cannot reset view, camera or controls missing.");
    }
}

// --- Terrain Generation ---
function generateMiningTerrain(params: MiningDebugDependencies) {
    if (!miningScene) {
        console.error("[MiningPanel] Scene not initialized for terrain generation.");
        return;
    }
    // Store params in storedMiningDependencies for potential regeneration
    storedMiningDependencies = params;

    if (miningTerrainMesh) {
        disposeNode(miningScene, miningTerrainMesh);
        miningTerrainMesh = null;
        miningTerrainNoiseMap = null;
    }

    console.log("[MiningPanel] Generating noise map for isolated chunk...");
    try {
        // Use stored dependencies for generation
        miningTerrainNoiseMap = generateNoiseMap(0, 0, 0, params.noiseLayers, params.seed, false);
        console.log("[MiningPanel] Noise map generated successfully.");
    } catch (error: any) {
        console.error("[MiningPanel] Error generating noise map:", error);
        miningTerrainNoiseMap = null;
        if (miningStatusElement) miningStatusElement.textContent = 'Error: Noise gen failed.';
        return;
    }

    regenerateMiningMesh(); // Call the adapted mesh regeneration

     if (miningControls && miningCamera) {
        // Reset view after generation
        resetMiningView();
     }
}

// --- Mesh Regeneration ---
function regenerateMiningMesh() {
     if (!miningScene || !miningTerrainNoiseMap || !storedMiningDependencies?.compInfo) {
          console.error("[MiningPanel] Cannot regenerate mesh, missing scene, noise map, or compInfo.");
          if (miningStatusElement) miningStatusElement.textContent = 'Error: Mesh regen failed (deps).';
          return;
     }
     if (miningTerrainMesh) {
         disposeNode(miningScene, miningTerrainMesh);
         miningTerrainMesh = null;
     }

      console.log("[MiningPanel] Regenerating mesh...");
      const vertices = generateMeshVertices(0, 0, 0, { noiseMap: miningTerrainNoiseMap }, true);

      if (!vertices || vertices.length === 0) {
          console.warn("[MiningPanel] Mesh generation produced no vertices.");
          if (miningStatusElement) miningStatusElement.textContent = 'Warning: No vertices generated.';
          return;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();

      const material = createUnifiedPlanetMaterial(storedMiningDependencies.compInfo.topElements);
      miningTerrainMesh = new THREE.Mesh(geometry, material);
      miningTerrainMesh.name = `mining_chunk_${MINING_CHUNK_KEY}`;
      miningScene.add(miningTerrainMesh);
      console.log("[MiningPanel] Mesh regenerated and added to scene.");
      if (miningStatusElement) miningStatusElement.textContent = 'Ready';
}

// --- Editing Setup ---
function setupMiningEditing(
    callback?: (keys: string[]) => void // Keep callback optional
) {
    if (!miningRenderer || !miningCamera || !miningScene) {
         console.error("[MiningPanel] Cannot set up editing - viewer not fully initialized.");
         return;
    }
    miningLogCallback = callback ?? null; // Store the callback if provided
    // miningStatusElement is already set during populate

    if (miningStatusElement) {
        miningStatusElement.textContent = 'Ready (Click to Edit)'; // Update status
    }

    // Create initial brush visualizer
    updateBrushVisualizer();

    const canvas = miningRenderer.domElement;
    canvas.addEventListener('mousedown', handleMiningEdit); // Use adapted handler
    canvas.addEventListener('mousemove', handleMouseMove); // Add mouse move handler for brush preview
    // Prevent context menu on the canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    console.log("[MiningPanel] Editing setup complete.");
}

// --- Mouse Move Handler for Brush Preview ---
function handleMouseMove(event: MouseEvent) {
    if (!miningRenderer || !miningCamera || !miningScene || !miningTerrainMesh || !editBrushMesh) {
        return;
    }

    const rect = miningRenderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, miningCamera);

    const intersects = raycaster.intersectObject(miningTerrainMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;

        // Position the brush visualizer at the intersection point
        editBrushMesh.position.copy(point);
        editBrushMesh.visible = true;

        // Update status with coordinates
        if (miningStatusElement) {
            miningStatusElement.textContent = `Position: X=${point.x.toFixed(1)}, Y=${point.y.toFixed(1)}, Z=${point.z.toFixed(1)}`;
        }
    } else {
        // Hide the brush visualizer when not hovering over terrain
        editBrushMesh.visible = false;
    }
}

// --- Editing Handler ---
function handleMiningEdit(event: MouseEvent) {
    if (!miningRenderer || !miningCamera || !miningScene || !miningTerrainMesh || !miningTerrainNoiseMap || !storedMiningDependencies) {
        console.warn("[MiningPanel] Cannot perform edit, dependencies missing.");
        return;
    }

    const rect = miningRenderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, miningCamera);

    const intersects = raycaster.intersectObject(miningTerrainMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;

        // Determine if we're removing or adding terrain
        // Use the editBrushMode setting, but allow right-click to override
        let remove: boolean;
        if (event.button === 2) { // Right click always removes
            remove = true;
        } else if (event.button === 0) { // Left click
            remove = editBrushMode === 'remove'; // Use the current mode
        } else {
            return; // Ignore other mouse buttons
        }

        const coordsText = `[X: ${point.x.toFixed(1)}, Y: ${point.y.toFixed(1)}, Z: ${point.z.toFixed(1)}]`;
        let statusMessage = '';

        // If removing terrain, mine resources
        if (remove) {
            // Use the mining system to mine resources
            const miningResult = mineAtPoint(
                point,
                storedMiningDependencies.compInfo.topElements!,
                0.1, // Default noise scale
                new THREE.Vector3(0, 0, 0), // Default planet offset
                miningTools[activeTool],
                playerInventory
            );

            // Apply damage to the tool
            const toolBroken = damageTool(miningTools[activeTool], miningResult.toolDamage);

            // Update tool UI
            if (toolsPanel) {
                updateToolsUI(
                    toolsPanel,
                    miningTools,
                    activeTool,
                    (toolType) => {
                        activeTool = toolType;
                        console.log(`[MiningPanel] Switched to tool: ${miningTools[toolType].name}`);
                    }
                );
            }

            // If tool broke, switch to hand
            if (toolBroken && activeTool !== MiningToolType.HAND) {
                console.log(`[MiningPanel] Tool broke: ${miningTools[activeTool].name}`);
                activeTool = MiningToolType.HAND;

                // Update tool UI again
                if (toolsPanel) {
                    updateToolsUI(
                        toolsPanel,
                        miningTools,
                        activeTool,
                        (toolType) => {
                            activeTool = toolType;
                            console.log(`[MiningPanel] Switched to tool: ${miningTools[toolType].name}`);
                        }
                    );
                }
            }

            // Update inventory UI
            if (inventoryPanel) {
                updateInventoryUI(inventoryPanel, playerInventory);
            }

            // Set status message
            statusMessage = miningResult.message;

            // Create mining effect
            createMiningEffect(point, miningResult);

            console.log(`[MiningPanel] Mining result: ${miningResult.message}`);
        } else {
            // Adding terrain
            statusMessage = `Added terrain at ${coordsText}`;
        }

        console.log(`[MiningPanel] Edit: ${statusMessage} with Radius=${editBrushRadius}, Strength=${editBrushStrength}, Shape=${editBrushShape}`);

        // Update Status Bar
        if (miningStatusElement) {
            miningStatusElement.textContent = statusMessage;
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready (Click to Edit)'; // Back to ready state
            }, 3000);
        }

        // Create a temporary structure matching what editNoiseMapChunks expects
        const pseudoLoadedChunks: LoadedChunks = {
             [MINING_CHUNK_KEY]: {
                 noiseMap: miningTerrainNoiseMap,
                 mesh: miningTerrainMesh as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
             }
        };

        // Call editing function with brush parameters
        const editChunksCoordsResult: number[][] = editNoiseMapChunks(
            pseudoLoadedChunks, // Use the pseudo chunk data
            point,
            remove,
            storedMiningDependencies.noiseLayers,
            storedMiningDependencies.seed,
            editBrushRadius,      // Pass current brush radius
            editBrushStrength     // Pass current brush strength
        );

        if (editChunksCoordsResult && editChunksCoordsResult.length > 0) {
            console.log("[MiningPanel] Noise map edited, regenerating mesh...");
            // Update the stored noise map (editNoiseMapChunks modifies it in place)
            miningTerrainNoiseMap = pseudoLoadedChunks[MINING_CHUNK_KEY].noiseMap;
            regenerateMiningMesh(); // Regenerate the single mesh

            // If a callback was provided, call it (though likely unused here)
            if (miningLogCallback) {
                miningLogCallback([MINING_CHUNK_KEY]);
            }
        } else {
             console.log("[MiningPanel] Edit did not affect the noise map.");
        }
    } else {
        console.log("[MiningPanel] Edit ray missed terrain.");
        if (miningStatusElement) {
            miningStatusElement.textContent = 'Edit miss';
            if (miningStatusTimeoutId) clearTimeout(miningStatusTimeoutId);
            miningStatusTimeoutId = window.setTimeout(() => {
                if (miningStatusElement) miningStatusElement.textContent = 'Ready (Click to Edit)';
            }, 1500);
        }
    }
}

// Create a visual effect when mining
function createMiningEffect(position: THREE.Vector3, miningResult: MiningResult) {
    if (!miningScene || !miningEffectsContainer) return;

    // Create a DOM element for the mining effect
    const effectElement = document.createElement('div');
    effectElement.className = 'mining-effect';
    effectElement.textContent = `+${miningResult.amount} ${miningResult.materialSymbol}`;

    // Set color based on material
    const colorHex = '#' + miningResult.materialColor.getHexString();
    effectElement.style.color = colorHex;
    effectElement.style.textShadow = `0 0 5px ${colorHex}`;

    // Add to container
    miningEffectsContainer.appendChild(effectElement);

    // Create a particle effect in the 3D scene
    const particleCount = Math.min(10, miningResult.amount * 2);
    const particleGeometry = new THREE.BufferGeometry();
    const particleMaterial = new THREE.PointsMaterial({
        color: miningResult.materialColor,
        size: 0.5,
        transparent: true,
        opacity: 0.8
    });

    // Create random positions around the mining point
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        particlePositions[i3] = position.x + (Math.random() - 0.5) * 2;
        particlePositions[i3 + 1] = position.y + (Math.random() - 0.5) * 2;
        particlePositions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;

        // Create random velocity
        particleVelocities.push(new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.3,
            (Math.random() - 0.5) * 0.2
        ));
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = 'mining-particles-' + Date.now();
    miningScene.add(particles);

    // Animate particles
    let frame = 0;
    const maxFrames = 30;

    function animateParticles() {
        if (frame >= maxFrames || !miningScene) {
            // Remove particles when animation is done
            if (miningScene && particles.parent === miningScene) {
                miningScene.remove(particles);
                particleGeometry.dispose();
                particleMaterial.dispose();
            }
            return;
        }

        frame++;

        // Update particle positions
        const positions = particleGeometry.attributes.position.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] += particleVelocities[i].x;
            positions[i3 + 1] += particleVelocities[i].y;
            positions[i3 + 2] += particleVelocities[i].z;

            // Apply gravity
            particleVelocities[i].y -= 0.01;
        }

        particleGeometry.attributes.position.needsUpdate = true;

        // Fade out
        particleMaterial.opacity = 0.8 * (1 - frame / maxFrames);

        requestAnimationFrame(animateParticles);
    }

    // Start animation
    animateParticles();

    // Remove the DOM element after animation
    setTimeout(() => {
        if (effectElement.parentNode === miningEffectsContainer) {
            miningEffectsContainer.removeChild(effectElement);
        }
    }, 2000);
}

// --- Render Loop ---
function miningAnimate() {
    // Check if cleanup has occurred
    if (!miningRenderer || !miningScene || !miningCamera) {
        miningAnimationFrameId = null;
        return;
    }
    miningAnimationFrameId = requestAnimationFrame(miningAnimate);

    if (miningControls) {
        miningControls.update();
    }
    miningRenderer.render(miningScene, miningCamera);
}

// --- Cleanup ---
function cleanupMiningView() {
     console.log("[MiningPanel] Cleaning up isolated view...");
     if (miningAnimationFrameId) {
        cancelAnimationFrame(miningAnimationFrameId);
        miningAnimationFrameId = null;
    }
    // Disconnect resize observer
    if (miningResizeObserver) {
        miningResizeObserver.disconnect();
        miningResizeObserver = null;
    }
    // Remove listeners from canvas
    if (miningRenderer) {
         const canvas = miningRenderer.domElement;
         canvas.removeEventListener('mousedown', handleMiningEdit);
         canvas.removeEventListener('mousemove', handleMouseMove);
         // Remove context menu listener
         canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
    }

    if (miningControls) {
        miningControls.dispose();
        miningControls = null;
    }
    if (miningScene) {
        disposeNode(miningScene); // Use disposeNode for thorough cleanup
        miningScene = null;
    }
    if (miningRenderer) {
        miningRenderer.dispose();
        miningRenderer = null;
    }
    // Nullify other THREE object references
    miningCamera = null;
    miningLight = null;
    miningTerrainMesh = null;
    miningTerrainNoiseMap = null;
    miningLogCallback = null;
    isMiningViewInitialized = false; // Reset init flag
    console.log("[MiningPanel] Isolated view cleanup complete.");
}

// ---------------------------------------------------------------


/**
 * Populates the provided section element with the NEW mining panel UI layout using CSS classes.
 */
export function populateMiningSection(
    sectionElement: HTMLElement,
    dependencies: MiningDebugDependencies
) {
    console.log("[MiningPanel] Populating section with NEW layout...");
    // --- Dependency Check ---
    let dependenciesValid = true;
    if (!dependencies) {
        console.error("[MiningPanel] FATAL: dependencies object was not provided!");
        dependenciesValid = false;
    }
    else {
        const requiredKeys: (keyof MiningDebugDependencies)[] = [
            'noiseLayers', 'seed', 'compInfo'
        ];
        for (const key of requiredKeys) {
            if (!(key in dependencies) || dependencies[key] === undefined || dependencies[key] === null) {
                console.error(`[MiningPanel] FATAL: Missing or invalid dependency: '${key}'`);
                dependenciesValid = false;
            }
        }
     }
    if (!dependenciesValid) {
         console.error("[MiningPanel] Cannot populate mining panel due to missing dependencies.");
         sectionElement.innerHTML = '<p style="color: red;">Error: Missing dependencies for isolated view.</p>';
         return; // Stop population
     }
    // ----------------------

    storedMiningDependencies = dependencies;
    miningPanelContainer = sectionElement;

    // Clear any previous content
    sectionElement.innerHTML = '';
    // sectionElement itself might need classes if it's not the one with ID main-debug-section-mining
    // Assuming sectionElement IS #main-debug-section-mining from mainDebugPanel.ts

    // --- Create Utilities Container ---
    utilitiesContainer = document.createElement('div');
    utilitiesContainer.id = 'mining-utilities-container'; // ID used by CSS
    sectionElement.appendChild(utilitiesContainer);

    // --- Add Utilities --- (Buttons styled by CSS selector)
    const utilsTitle = document.createElement('h5'); // h5 styled by CSS
    utilsTitle.textContent = 'Mining/Editing Utilities';
    utilitiesContainer.appendChild(utilsTitle);

    const resetButton = document.createElement('button'); // Button styled by CSS
    resetButton.textContent = 'Reset View';
    addTooltip(resetButton, "Reset the camera view");
    resetButton.onclick = resetMiningView;
    utilitiesContainer.appendChild(resetButton);

    // Add brush size slider
    utilitiesContainer.appendChild(createSliderControl('Brush Size', '1', '10', '1', '3'));

    // Add brush strength slider
    utilitiesContainer.appendChild(createSliderControl('Strength', '0.1', '1.0', '0.1', '0.5'));

    // Add brush shape dropdown
    utilitiesContainer.appendChild(createDropdownControl('Brush Shape', ['Sphere', 'Cube', 'Cylinder'], 'Sphere'));

    // Add mode toggle button
    const modeButton = document.createElement('button');
    modeButton.id = 'mining-mode-button';
    modeButton.textContent = 'Mode: Add';
    modeButton.className = 'mode-add'; // For styling
    addTooltip(modeButton, "Toggle between Add and Remove modes");

    // Add click handler to toggle mode
    modeButton.onclick = () => {
        editBrushMode = editBrushMode === 'add' ? 'remove' : 'add';
        modeButton.textContent = `Mode: ${editBrushMode.charAt(0).toUpperCase() + editBrushMode.slice(1)}`;
        modeButton.className = editBrushMode === 'add' ? 'mode-add' : 'mode-remove';
        updateBrushVisualizer(); // Update brush color
        console.log(`[MiningPanel] Brush mode set to ${editBrushMode}`);
        if (miningStatusElement) miningStatusElement.textContent = `Brush Mode: ${editBrushMode}`;
    };

    utilitiesContainer.appendChild(modeButton);

    // Add internal grid visualizer toggle button
    const gridButton = document.createElement('button');
    gridButton.id = 'internal-grid-button';
    gridButton.textContent = 'Show Internal Grid';
    gridButton.className = 'grid-hidden'; // For styling
    addTooltip(gridButton, "Toggle internal material grid visualizer");

    // Add click handler to toggle internal grid
    gridButton.onclick = () => {
        internalGridVisible = !internalGridVisible;
        const isVisible = toggleInternalGridVisualizer(internalGridVisible); // Toggle and get current state
        gridButton.textContent = isVisible ? 'Hide Internal Grid' : 'Show Internal Grid';
        gridButton.className = isVisible ? 'grid-visible' : 'grid-hidden';
        console.log(`[MiningPanel] Internal grid visualizer ${isVisible ? 'shown' : 'hidden'}`);
    };

    utilitiesContainer.appendChild(gridButton);

    // --- Create Large Canvas Container ---
    canvasContainer = document.createElement('div') as HTMLDivElement;
    canvasContainer.id = 'mining-panel-canvas-container'; // ID used by CSS
    sectionElement.appendChild(canvasContainer);

    // --- Create Canvas Element --- (Styled by parent CSS)
    miningCanvas = document.createElement('canvas');
    canvasContainer.appendChild(miningCanvas);

    // --- Add Mining System UI ---

    // Add mining effects container
    miningEffectsContainer = document.createElement('div');
    miningEffectsContainer.className = 'mining-effects-container';
    canvasContainer.appendChild(miningEffectsContainer);

    // Add mining inventory container
    const inventoryContainer = document.createElement('div');
    inventoryContainer.className = 'mining-inventory-container';
    canvasContainer.appendChild(inventoryContainer);

    // Add mining tools container
    const toolsContainer = document.createElement('div');
    toolsContainer.className = 'mining-tools-container';
    canvasContainer.appendChild(toolsContainer);

    // Create inventory UI
    inventoryPanel = createInventoryUI('mining-inventory-container');
    updateInventoryUI(inventoryPanel, playerInventory);
    addInventoryStyles();

    // Create tools UI
    toolsPanel = createMiningToolsUI('mining-tools-container');
    updateToolsUI(
        toolsPanel,
        miningTools,
        activeTool,
        (toolType) => {
            activeTool = toolType;
            console.log(`[MiningPanel] Switched to tool: ${miningTools[toolType].name}`);
        }
    );
    addMiningToolsStyles();

    // Add CSS for mining effects
    const linkElement = document.createElement('link');
    linkElement.rel = 'stylesheet';
    linkElement.href = 'debug/styles/miningEffects.css';
    document.head.appendChild(linkElement);

    // --- Status Text ---
    miningStatusElement = document.createElement('div');
    miningStatusElement.id = 'mining-status-element'; // ID used by CSS
    miningStatusElement.className = 'mining-status-bar'; // Add class for styling
    miningStatusElement.textContent = 'Initializing...';
    canvasContainer.appendChild(miningStatusElement);

    // --- Initialize the Isolated View (Deferred) ---
    requestAnimationFrame(() => {
        if (miningCanvas && canvasContainer) { // Type guard ensures canvasContainer is not null
            try {
                console.log("[MiningPanel] Initializing Three.js instance...");
                 // Pass canvasContainer for sizing/resize, miningCanvas for rendering
                initMiningView(canvasContainer as HTMLDivElement, miningCanvas); // Cast to satisfy linter

                console.log("[MiningPanel] Generating initial terrain...");
                generateMiningTerrain(storedMiningDependencies!);

                console.log("[MiningPanel] Setting up editing...");
                setupMiningEditing(); // Setup editing listeners

                console.log("[MiningPanel] Starting render loop...");
                miningAnimate(); // Start the render loop

                if(miningStatusElement) miningStatusElement.textContent = 'Ready (Click Canvas to Edit)';

            } catch (error) {
                 console.error("[MiningPanel] Error during initialization:", error);
                 if(miningStatusElement) miningStatusElement.textContent = 'Error: Init failed.';
                 cleanupMiningView(); // Attempt cleanup if init fails
            }
        } else {
            console.error("[MiningPanel] Canvas elements not found for deferred init.");
             if(miningStatusElement) miningStatusElement.textContent = 'Error: Canvas init failed.';
        }
    });

    console.log("[MiningPanel] NEW Section layout populated.");
}

/**
 * Updates visuals (Resize Handling)
 */
export function updateMiningDebugVisuals() {
    console.log("[MiningPanel] Updating visuals (resize check)...");
    // Trigger resize handling logic manually if needed,
    // but ResizeObserver in initMiningView should handle most cases.
    if (isMiningViewInitialized && miningRenderer && miningCamera && miningCanvas && canvasContainer) {
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        if(width > 0 && height > 0) {
           if (miningRenderer.domElement.width !== width || miningRenderer.domElement.height !== height) {
              miningRenderer.setSize(width, height);
              miningCamera.aspect = width / height;
              miningCamera.updateProjectionMatrix();
              console.log(`[MiningPanel] Resized renderer via updateVisuals to ${width}x${height}.`);
           }
        }
    } else {
         // console.log("[MiningPanel] Skipping resize update - view not initialized or elements missing.");
    }
}

/**
 * Cleans up resources used by the mining debug panel.
 */
export function cleanupMiningDebugPanel() {
    console.log("[MiningPanel] Cleaning up (new layout)...");
    cleanupMiningView(); // <<< Call the adapted cleanup function

    // Clear non-THREE state variables
    miningPanelContainer = null;
    miningCanvas = null;
    utilitiesContainer = null;
    canvasContainer = null;
    // Renderer, Scene, Camera etc are nulled within cleanupMiningView
    miningStatusElement = null;
    storedMiningDependencies = null;
    if (miningStatusTimeoutId) {
        clearTimeout(miningStatusTimeoutId);
        miningStatusTimeoutId = null;
    }

    // Clean up mining system resources
    miningEffectsContainer = null;
    inventoryPanel = null;
    toolsPanel = null;

    // Reset mining system state
    playerInventory = createInventory(100);
    miningTools = createDefaultTools();
    activeTool = MiningToolType.HAND;
    internalGridVisible = false;
    console.log("[MiningPanel] Cleanup complete (new layout).");
}

// --- Helper Function for creating controls (Using CSS classes) ---
function createSliderControl(label: string, min: string, max: string, step: string, value: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'slider-control-row'; // Class for styling row

    const labelEl = document.createElement('label'); // Label styled by CSS
    labelEl.textContent = label;

    const inputEl = document.createElement('input'); // Input styled by CSS
    inputEl.type = 'range';
    inputEl.min = min;
    inputEl.max = max;
    inputEl.step = step;
    inputEl.value = value;
    inputEl.id = `slider-${label.replace(/\s+/g, '_')}`; // Create ID based on label

    // Add value display
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'slider-value';
    valueDisplay.textContent = value;

    // Add event listener based on the slider type
    inputEl.oninput = (event) => {
        const newValue = parseFloat((event.target as HTMLInputElement).value);
        valueDisplay.textContent = newValue.toString();

        if (label === 'Brush Size') {
            editBrushRadius = newValue;
            updateBrushVisualizer();
            console.log(`[MiningPanel] Brush radius set to ${editBrushRadius}`);
            if (miningStatusElement) miningStatusElement.textContent = `Brush Radius: ${editBrushRadius.toFixed(1)}`;
        }
        else if (label === 'Strength') {
            editBrushStrength = newValue;
            console.log(`[MiningPanel] Brush strength set to ${editBrushStrength}`);
            if (miningStatusElement) miningStatusElement.textContent = `Brush Strength: ${editBrushStrength.toFixed(2)}`;
        }
    };

    row.appendChild(labelEl);
    row.appendChild(inputEl);
    row.appendChild(valueDisplay);
    return row;
}

// --- Helper Function for creating dropdown controls ---
function createDropdownControl(label: string, options: string[], defaultValue: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'dropdown-control-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const selectEl = document.createElement('select');
    selectEl.id = `dropdown-${label.replace(/\s+/g, '_')}`;

    options.forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option.toLowerCase();
        optionEl.textContent = option;
        if (option.toLowerCase() === defaultValue.toLowerCase()) {
            optionEl.selected = true;
        }
        selectEl.appendChild(optionEl);
    });

    // Add event listener based on the dropdown type
    selectEl.onchange = (event) => {
        const newValue = (event.target as HTMLSelectElement).value;

        if (label === 'Brush Shape') {
            editBrushShape = newValue;
            updateBrushVisualizer();
            console.log(`[MiningPanel] Brush shape set to ${editBrushShape}`);
            if (miningStatusElement) miningStatusElement.textContent = `Brush Shape: ${editBrushShape}`;
        }
    };

    row.appendChild(labelEl);
    row.appendChild(selectEl);
    return row;
}