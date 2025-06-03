import * as THREE from 'three';
import { SpacetimeDBManager, type CharacterReference } from './SpacetimeDBManager';
import type { SpacetimeDBContextType } from './SpacetimeDBContext';

// === INTEGRATION INTERFACE ===
interface ThirdPersonMultiplayerConfig {
  scene: THREE.Scene;
  character: any; // The Sketchbook character instance
  camera?: THREE.Camera;
  enableAutoSync?: boolean;
  updateInterval?: number;
  positionThreshold?: number;
  rotationThreshold?: number;
}

// === THIRD PERSON MULTIPLAYER INTEGRATION CLASS ===
export class ThirdPersonMultiplayerIntegration {
  private spacetimeDBManager: SpacetimeDBManager;
  private character: any;
  private scene: THREE.Scene;
  private camera?: THREE.Camera;
  
  // Configuration
  private enableAutoSync: boolean;
  private updateInterval: number;
  private positionThreshold: number;
  private rotationThreshold: number;
  
  // State tracking
  private isInitialized = false;
  private lastUpdateTime = 0;
  private animationFrameId?: number;
  
  constructor(config: ThirdPersonMultiplayerConfig) {
    this.scene = config.scene;
    this.character = config.character;
    this.camera = config.camera;
    this.enableAutoSync = config.enableAutoSync ?? true;
    this.updateInterval = config.updateInterval ?? 50;
    this.positionThreshold = config.positionThreshold ?? 0.1;
    this.rotationThreshold = config.rotationThreshold ?? 0.05;
    
    // Create character reference for SpacetimeDB manager
    const characterRef: CharacterReference = {
      get position() { return config.character?.position || new THREE.Vector3(); },
      get rotation() { return config.character?.rotation || new THREE.Euler(); },
      get actions() { return config.character?.actions || {}; }
    };
    
    this.spacetimeDBManager = new SpacetimeDBManager(this.scene, characterRef);
  }
  
  // === INITIALIZATION ===
  public initialize(context: SpacetimeDBContextType): boolean {
    try {
      const success = this.spacetimeDBManager.initialize(context);
      
      if (success) {
        this.isInitialized = true;
        
        if (this.enableAutoSync) {
          this.startAutoSync();
        }
        
        console.log('[ThirdPersonMultiplayerIntegration] Initialized successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[ThirdPersonMultiplayerIntegration] Initialization failed:', error);
      return false;
    }
  }
  
  // === AUTO SYNC ===
  private startAutoSync(): void {
    const updateLoop = (currentTime: number) => {
      if (!this.isInitialized) return;
      
      const deltaTime = currentTime - this.lastUpdateTime;
      this.spacetimeDBManager.update(deltaTime);
      this.lastUpdateTime = currentTime;
      
      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    
    this.animationFrameId = requestAnimationFrame(updateLoop);
    console.log('[ThirdPersonMultiplayerIntegration] Auto sync started');
  }
  
  private stopAutoSync(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
      console.log('[ThirdPersonMultiplayerIntegration] Auto sync stopped');
    }
  }
  
  // === MANUAL UPDATE ===
  public update(deltaTime: number): void {
    if (this.isInitialized) {
      this.spacetimeDBManager.update(deltaTime);
    }
  }
  
  // === UTILITY METHODS ===
  public isEnabled(): boolean {
    return this.isInitialized && this.spacetimeDBManager.isEnabled();
  }
  
  public getLocalPlayerId(): string | null {
    return this.spacetimeDBManager.getLocalPlayerId();
  }
  
  public getRemotePlayerCount(): number {
    return this.spacetimeDBManager.getRemotePlayerCount();
  }
  
  public getRemotePlayerIds(): string[] {
    return this.spacetimeDBManager.getRemotePlayerIds();
  }
  
  // === CONFIGURATION ===
  public setAutoSync(enabled: boolean): void {
    this.enableAutoSync = enabled;
    
    if (enabled && this.isInitialized) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }
  
  public setUpdateInterval(interval: number): void {
    this.updateInterval = interval;
  }
  
  public setThresholds(position: number, rotation: number): void {
    this.positionThreshold = position;
    this.rotationThreshold = rotation;
  }
  
  // === CONNECTION EVENTS ===
  public onConnectionStateChanged(state: string): void {
    this.spacetimeDBManager.onConnectionStateChanged(state);
    
    if (state !== 'connected') {
      this.stopAutoSync();
    } else if (this.enableAutoSync && this.isInitialized) {
      this.startAutoSync();
    }
  }
  
  // === CLEANUP ===
  public dispose(): void {
    this.stopAutoSync();
    this.spacetimeDBManager.dispose();
    this.isInitialized = false;
    
    console.log('[ThirdPersonMultiplayerIntegration] Disposed');
  }
}

// === HELPER FUNCTIONS FOR INTEGRATION ===

/**
 * Creates a multiplayer integration instance for the third-person character
 * @param config - Configuration object
 * @returns ThirdPersonMultiplayerIntegration instance
 */
export function createThirdPersonMultiplayer(config: ThirdPersonMultiplayerConfig): ThirdPersonMultiplayerIntegration {
  return new ThirdPersonMultiplayerIntegration(config);
}

/**
 * Initializes multiplayer for an existing third-person character setup
 * @param scene - Three.js scene
 * @param character - Sketchbook character instance
 * @param context - SpacetimeDB context
 * @param options - Optional configuration
 * @returns ThirdPersonMultiplayerIntegration instance or null if failed
 */
export function initializeThirdPersonMultiplayer(
  scene: THREE.Scene,
  character: any,
  context: SpacetimeDBContextType,
  options: Partial<ThirdPersonMultiplayerConfig> = {}
): ThirdPersonMultiplayerIntegration | null {
  try {
    const integration = createThirdPersonMultiplayer({
      scene,
      character,
      ...options
    });
    
    const success = integration.initialize(context);
    
    if (success) {
      return integration;
    } else {
      integration.dispose();
      return null;
    }
  } catch (error) {
    console.error('[ThirdPersonMultiplayer] Initialization failed:', error);
    return null;
  }
}

/**
 * Gets the global SpacetimeDB context from window object
 * @returns SpacetimeDB context or null if not available
 */
export function getGlobalSpacetimeDBContext(): SpacetimeDBContextType | null {
  if (typeof window !== 'undefined' && (window as any).spacetimeDBContext) {
    return (window as any).spacetimeDBContext;
  }
  return null;
}

/**
 * Checks if multiplayer is available and ready
 * @returns boolean indicating if multiplayer is ready
 */
export function isMultiplayerReady(): boolean {
  const context = getGlobalSpacetimeDBContext();
  return context !== null && context.connection.state === 'connected';
}

// === INTEGRATION EXAMPLE FOR isolatedThirdPerson.ts ===

/**
 * Example function showing how to integrate this with isolatedThirdPerson.ts
 * This would be called from within the initIsolatedThirdPerson function
 */
export function exampleIntegration(
  scene: THREE.Scene,
  character: any,
  camera: THREE.Camera
): ThirdPersonMultiplayerIntegration | null {
  // Get the global SpacetimeDB context
  const spacetimeDBContext = getGlobalSpacetimeDBContext();
  
  if (!spacetimeDBContext) {
    console.log('[ThirdPersonMultiplayer] SpacetimeDB context not available, running in single-player mode');
    return null;
  }
  
  // Check if multiplayer is enabled
  if (spacetimeDBContext.connection.state !== 'connected') {
    console.log('[ThirdPersonMultiplayer] SpacetimeDB not connected, running in single-player mode');
    return null;
  }
  
  // Initialize multiplayer integration
  const multiplayerIntegration = initializeThirdPersonMultiplayer(
    scene,
    character,
    spacetimeDBContext,
    {
      camera,
      enableAutoSync: true,
      updateInterval: 50, // 20 FPS
      positionThreshold: 0.1,
      rotationThreshold: 0.05
    }
  );
  
  if (multiplayerIntegration) {
    console.log('[ThirdPersonMultiplayer] Multiplayer enabled successfully');
    console.log(`[ThirdPersonMultiplayer] Local player ID: ${multiplayerIntegration.getLocalPlayerId()}`);
  } else {
    console.warn('[ThirdPersonMultiplayer] Failed to initialize multiplayer');
  }
  
  return multiplayerIntegration;
}

// === EXPORTS ===
export default ThirdPersonMultiplayerIntegration;
export type { ThirdPersonMultiplayerConfig };