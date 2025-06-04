import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { initializeWelcomeScreen } from "./welcomeScreen";
import { loadFonts } from './utils/fontLoader';
import { initMobileStyles, isMobile, isTablet } from './utils/deviceUtils';

// Setup basic THREE.js environment
export let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let orbitControls: OrbitControls;

// Game state
let gameInitialized = false;

// Device detection
export const isMobileDevice = isMobile();
export const isTabletDevice = isTablet();

// Initialize responsive design and mobile styles
let cleanupMobileStyles: (() => void) | null = null;

const initApp = () => {
    // Initialize mobile styles and get cleanup function
    cleanupMobileStyles = initMobileStyles();
    
    // Apply mobile-specific optimizations
    applyMobileOptimizations();
    
    // Set up window resize handler
    window.addEventListener('resize', handleResize);
    
    // Initialize the scene
    initializeScene();
    
    // Start the animation loop
    animate();
};

const cleanupApp = () => {
    // Clean up mobile styles and event listeners
    if (cleanupMobileStyles) {
        cleanupMobileStyles();
        cleanupMobileStyles = null;
    }
    
    // Remove resize listener
    window.removeEventListener('resize', handleResize);
    
    // Clean up Three.js resources
    if (renderer) {
        renderer.dispose();
    }
    
    if (orbitControls) {
        orbitControls.dispose();
    }
};

// Handle window resize events
const handleResize = () => {
    if (camera && renderer) {
        // Use visual viewport dimensions if available (for mobile)
        const visualViewport = window.visualViewport || {
            width: window.innerWidth,
            height: window.innerHeight
        };
        const width = Math.floor(visualViewport.width);
        const height = Math.floor(visualViewport.height);
        
        // Update camera
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        
        // Update renderer
        renderer.setSize(width, height, false);
        
        // Ensure canvas fills the viewport
        const canvas = renderer.domElement;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    }
    
    // Update UI for new screen size
    updateUIForScreenSize(window.innerWidth, window.innerHeight);
};

// Apply mobile-specific styles and optimizations
const applyMobileOptimizations = (): void => {
  const isMobileView = window.matchMedia('(max-width: 768px)').matches;
  const isPortrait = window.innerHeight > window.innerWidth;
  
  // Set viewport meta tag
  const viewportMeta = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
  viewportMeta.setAttribute('name', 'viewport');
  viewportMeta.setAttribute('content', [
    'width=device-width',
    'initial-scale=1.0',
    'maximum-scale=1.0',
    'user-scalable=no',
    'viewport-fit=cover',
    `height=${window.innerHeight}`
  ].join(', '));
  
  if (!document.querySelector('meta[name="viewport"]')) {
    document.head.appendChild(viewportMeta);
  }
  
  // Update CSS variables for mobile
  const root = document.documentElement;
  if (isMobileView) {
    root.style.setProperty('--panel-max-width', '95%');
    root.style.setProperty('--panel-max-height', isPortrait ? '60vh' : '80vh');
    root.style.setProperty('--panel-top', '10px');
    root.style.setProperty('--panel-right', '10px');
  } else {
    root.style.setProperty('--panel-max-width', '400px');
    root.style.setProperty('--panel-max-height', '80vh');
    root.style.setProperty('--panel-top', '20px');
    root.style.setProperty('--panel-right', '20px');
  }
  
  // Handle loading element
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.fontSize = isMobileView ? '1.5rem' : '1.2rem';
  }
  
  // Apply mobile-specific styles
  if (isMobileView) {
    // Disable pull-to-refresh
    document.body.style.overscrollBehaviorY = 'contain';
    
    // Prevent zoom on double-tap
    document.documentElement.style.touchAction = 'manipulation';
    
    // Prevent text selection on mobile
    document.body.style.webkitUserSelect = 'none';
    document.body.style.userSelect = 'none';
    
    // Add touch-action for better touch handling
    document.body.style.touchAction = 'pan-x pan-y';
    
    // Prevent iOS bounce effect
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    
    // Add mobile class to body
    document.body.classList.add('is-mobile');
    if (isPortrait) {
      document.body.classList.add('is-portrait');
      document.body.classList.remove('is-landscape');
    } else {
      document.body.classList.add('is-landscape');
      document.body.classList.remove('is-portrait');
    }
  } else {
    // Reset styles for desktop
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.overflow = '';
    document.body.classList.remove('is-mobile', 'is-portrait', 'is-landscape');
  }
  
  // Ensure canvas fills viewport
  if (renderer) {
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
  }
};

/**
 * Initialize the basic Three.js scene, camera, renderer, and controls
 */
function initializeScene(): void {
  // Create scene
  scene = new THREE.Scene();
  // Expose scene globally
  (window as any).globalScene = scene; 
  
  // Add fog for distance effect
  const fogColor = 0x050510; // Dark space blue
  scene.fog = new THREE.Fog(fogColor, 50, 600);
  
  // Create camera with mobile-optimized settings
  const fov = isMobileDevice ? 75 : 70; // Slightly wider FOV for mobile
  const near = 0.1;
  const far = isMobileDevice ? 10000 : 20000; // Shorter far plane for mobile performance
  
  camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    near,
    far
  );
  camera.position.set(0, 30, 300);
  
  // Adjust camera position for mobile
  if (isMobileDevice) {
    camera.position.z = 200; // Zoom out slightly
  }
  
  // Create renderer with mobile optimizations
  const rendererOptions: THREE.WebGLRendererParameters = {
    antialias: !isMobileDevice, // Disable antialiasing on mobile for better performance
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
    depth: true
  };
  
  renderer = new THREE.WebGLRenderer(rendererOptions);
  
  // Expose renderer globally for other modules to use
  (window as any).appRenderer = renderer;
  
  // Set up renderer for fullscreen
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050510); // Dark space blue
  
  // Ensure renderer canvas fills the screen
  const canvas = renderer.domElement;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  
  // Apply initial mobile optimizations
  applyMobileOptimizations();
  
  // Add event listeners for dynamic updates
  window.addEventListener('resize', () => {
    applyMobileOptimizations();
    handleResize();
  });
  
  window.addEventListener('orientationchange', applyMobileOptimizations);
  
  document.body.appendChild(renderer.domElement);
  
  // Add orbit controls for welcome screen
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.screenSpacePanning = false;
  orbitControls.minDistance = 10;
  orbitControls.maxDistance = 100;
  orbitControls.maxPolarAngle = Math.PI / 2;
  orbitControls.enabled = false; // Disable OrbitControls by default
  
  // Handle window resizing
  window.addEventListener("resize", onWindowResize);
}

/**
 * Handle window resize events
 */
function onWindowResize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Update camera
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  // Update renderer
  renderer.setSize(width, height, false);
  
  // Dispatch custom event for other components to handle resize
  window.dispatchEvent(new Event('app-resize'));
  
  // Update any UI elements that need to be resized
  updateUIForScreenSize(width, height);
}

// Update UI elements based on screen size
function updateUIForScreenSize(width: number, height: number): void {
  const debugPanels = document.querySelectorAll('.debug-panel');
  const isPortrait = height > width;
  
  debugPanels.forEach(panel => {
    const el = panel as HTMLElement;
    
    if (isMobileDevice) {
      // Make debug panels smaller on mobile
      const scale = Math.min(0.8, Math.min(width, height) / 500);
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = 'top left';
      
      // Adjust position to ensure it's fully visible
      el.style.maxWidth = '90vw';
      el.style.maxHeight = '90vh';
      el.style.overflow = 'auto';
      
      // Position differently in portrait vs landscape
      if (isPortrait) {
        el.style.top = '10px';
        el.style.left = '10px';
      } else {
        el.style.top = '10px';
        el.style.right = '10px';
        el.style.left = 'auto';
      }
    } else {
      // Reset styles for desktop
      el.style.transform = '';
      el.style.maxWidth = '';
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.top = '';
      el.style.left = '';
      el.style.right = '';
    }
  });
}

/**
 * Start the game after welcome screen
 */
async function startGame(): Promise<void> {
  if (gameInitialized) return;
  console.log("Starting game...");
  
  // Set game state
  gameInitialized = true;
  
  // 1. Clean up welcome screen
  // cleanupWelcomeScreen is now handled by the welcome screen module itself
  
  // 2. Disable welcome screen controls - REMOVED, already disabled
  // orbitControls.enabled = false;
  
  // 3. Load first-person experience
  // Instead of loading placeholders, we'll load the actual first-person module
  // that uses marching cubes for terrain generation
  
  // Store any relevant settings in session storage
  // sessionStorage.setItem("interpolate", "true");
  sessionStorage.setItem("wireframe", "false");
  
  // Create a seed if not exists
  if (!sessionStorage.getItem("map-seed")) {
    sessionStorage.setItem("map-seed", Math.random().toString());
  }
  
  // We'll create a dynamic import for the first-person module
  try {
    await import("./firstPerson");
    // The firstPerson module is self-initializing so we don't need to do anything else here
    console.log("First person mode loaded");
    
    // Remove the main renderer since firstPerson creates its own
    if (renderer && renderer.domElement) {
      renderer.domElement.remove();
      renderer.dispose();
    }
    
    // Cancel the main animation loop since firstPerson has its own
    cancelAnimationFrame(animationFrameId);
  } catch (err) {
    console.error("Error loading first-person mode:", err);
    // Fallback to placeholder if firstPerson module fails to load
    loadPlaceholderGameElements();
  }
}

/**
 * Fallback function to load placeholder game elements if the first-person module fails
 */
function loadPlaceholderGameElements(): void {
  // Add game lighting
  const ambientLight = new THREE.AmbientLight(0x404060, 1.0);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.name = "directionalLight";
  scene.add(directionalLight);
  
  // Add a ground plane as a placeholder for marching cubes terrain
  const groundGeometry = new THREE.PlaneGeometry(200, 200, 10, 10);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a7a50,
    wireframe: false,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -5;
  scene.add(ground);
  
  // Add a player representation
  const playerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 16);
  const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.set(0, 0, 0);
  scene.add(player);
  
  // Add a grid helper for reference
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444);
  scene.add(gridHelper);
  
  // Reposition camera for game view
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  
  // Add UI elements
  const infoDiv = document.createElement('div');
  infoDiv.style.position = 'absolute';
  infoDiv.style.top = '10px';
  infoDiv.style.left = '10px';
  infoDiv.style.color = 'white';
  infoDiv.style.fontFamily = 'Arial, sans-serif';
  infoDiv.style.fontSize = '14px';
  infoDiv.textContent = 'Game Mode - Ready for marching cubes implementation';
  document.body.appendChild(infoDiv);
  
  console.log("Fallback game initialized with placeholder elements.");
}

// Animation frame ID for cancellation
let animationFrameId: number;

/**
 * Main animation loop
 */
function animate(): void {
  animationFrameId = requestAnimationFrame(animate);
  
  // Update controls if enabled
  if (orbitControls?.enabled) {
    orbitControls.update();
  }
  
  // --- Log camera state if game has started (throttled) ---
  if (gameInitialized) {
    // Throttle camera position logging to once every 5 seconds
    const now = Date.now();
    if (!window.lastCameraLogTime || now - window.lastCameraLogTime > 5000) {
      console.log(
        `Camera Pos: x=${camera.position.x.toFixed(2)}, y=${camera.position.y.toFixed(2)}, z=${camera.position.z.toFixed(2)} | ` +
        `Camera Rot: x=${camera.rotation.x.toFixed(2)}, y=${camera.rotation.y.toFixed(2)}, z=${camera.rotation.z.toFixed(2)}`
      );
      window.lastCameraLogTime = now;
    }
  }
  // --------------------------------------------
  
  // Render scene
  renderer.render(scene, camera);
}

/**
 * Main function to initialize everything (kept for backward compatibility)
 * This is intentionally left as a no-op since we're using initApp instead
 * It's exported for backward compatibility
 * @ts-ignore - This is intentionally unused
 */
export const main = (): Promise<void> => {
  return startGame();
};

// Initialize the app when the window loads
window.addEventListener("load", async () => {
  try {
    // Initialize the app
    initApp();
    
    // Hide loading screen
    const loadingElement = document.getElementById("loading");
    if (loadingElement) {
      loadingElement.style.display = "none";
    }
    
    // Load fonts first as they're needed for the welcome screen
    await loadFonts();
    
    // Show welcome screen and wait for user to start
    await initializeWelcomeScreen(scene, camera, startGame);
    
    // Start animation loop
    animate();
    
    // Handle window resize and orientation changes
    window.addEventListener('resize', () => {
      applyMobileOptimizations();
      onWindowResize();
    });
    
    window.addEventListener('orientationchange', applyMobileOptimizations);
    
  } catch (error) {
    console.error('Error initializing the game:', error);
    
    // Show error to user
    const errorElement = document.getElementById('loading') || document.createElement('div');
    errorElement.innerHTML = 'Error loading application. Please refresh the page.';
    errorElement.style.color = 'red';
    errorElement.style.position = 'fixed';
    errorElement.style.top = '50%';
    errorElement.style.left = '50%';
    errorElement.style.transform = 'translate(-50%, -50%)';
    errorElement.style.textAlign = 'center';
    
    if (!document.body.contains(errorElement)) {
      document.body.appendChild(errorElement);
    }
    
    // Fallback to a basic scene if initialization fails
    try {
      loadPlaceholderGameElements();
      animate();
    } catch (fallbackError) {
      console.error('Fallback initialization failed:', fallbackError);
    }
  }
});

// Clean up when the page is unloaded
window.addEventListener('beforeunload', () => {
  // Cancel animation frame to prevent memory leaks
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Remove event listeners
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('orientationchange', applyMobileOptimizations);
  
  // Clean up app resources
  cleanupApp();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Pause the game when the page is hidden
    cancelAnimationFrame(animationFrameId);
  } else if (document.visibilityState === 'visible') {
    // Resume the game when the page becomes visible again
    if (!gameInitialized) {
      startGame().catch(console.error);
    } else {
      animate();
    }
  }
});