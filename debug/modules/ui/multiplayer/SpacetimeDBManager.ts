import * as THREE from 'three';
import type { SpacetimeDBContextType, PlayerData, Vector3, InputState } from './SpacetimeDBContext';

// === CONFIGURATION ===
const CONFIG = {
  UPDATE_INTERVAL: 50, // 20 FPS
  POSITION_THRESHOLD: 0.1,
  ROTATION_THRESHOLD: 0.05,
  INTERPOLATION_FACTOR: 0.1,
  MAX_INTERPOLATION_DISTANCE: 5.0,
  NAME_TAG_HEIGHT: 1.2,
  REMOTE_PLAYER_COLOR: 0x00ff00,
  REMOTE_PLAYER_OPACITY: 0.8
};

// === INTERFACES ===
interface RemotePlayerMesh {
  mesh: THREE.Mesh;
  nameTag: THREE.Sprite;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  lastUpdate: number;
}

interface CharacterReference {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  actions?: { [key: string]: { isPressed: boolean } };
}

// === SPACETIMEDB MANAGER CLASS ===
export class SpacetimeDBManager {
  private scene: THREE.Scene;
  private onRemotePlayerUpdate: (playerId: string, playerData: any) => void;
  private onRemotePlayerRemove: (playerId: string) => void;
  
  // Remote player management
  private remotePlayerMeshes = new Map<string, RemotePlayerMesh>();
  
  // Update timing
  private lastUpdateTime = 0;
  
  // State
  private isEnabled = false;
  
  constructor(config: {
    scene: THREE.Scene;
    onRemotePlayerUpdate: (playerId: string, playerData: any) => void;
    onRemotePlayerRemove: (playerId: string) => void;
  }) {
    this.scene = config.scene;
    this.onRemotePlayerUpdate = config.onRemotePlayerUpdate;
    this.onRemotePlayerRemove = config.onRemotePlayerRemove;
    this.isEnabled = true;
  }
  
  // === INITIALIZATION ===
  public initialize(): boolean {
    try {
      this.isEnabled = true;
      console.log('[SpacetimeDBManager] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[SpacetimeDBManager] Initialization failed:', error);
      return false;
    }
  }
  
  // === PLAYER UPDATE HANDLING ===
  public handlePlayerUpdate(playerData: any): void {
    if (!playerData || !playerData.id) return;
    
    // Delegate to the callback function
    this.onRemotePlayerUpdate(playerData.id, playerData);
  }
  
  public handlePlayerRemove(playerId: string): void {
    if (!playerId) return;
    
    // Delegate to the callback function
    this.onRemotePlayerRemove(playerId);
    
    // Clean up local tracking
    this.removeRemotePlayerMesh(playerId);
  }
  
  // === MAIN UPDATE LOOP ===
  public update(deltaTime: number): void {
    if (!this.isEnabled) return;
    
    // Update remote player interpolation
    this.updateRemotePlayerInterpolation(deltaTime);
  }
  
  // === CLEANUP ===
  public cleanup(): void {
    // Remove all remote player meshes
    for (const [playerId] of this.remotePlayerMeshes) {
      this.removeRemotePlayerMesh(playerId);
    }
    this.remotePlayerMeshes.clear();
    this.isEnabled = false;
    console.log('[SpacetimeDBManager] Cleaned up');
  }
  
  // === REMOTE PLAYER MESH MANAGEMENT ===
  private removeRemotePlayerMesh(playerId: string): void {
    const remotePlayer = this.remotePlayerMeshes.get(playerId);
    if (remotePlayer) {
      this.scene.remove(remotePlayer.mesh);
      this.scene.remove(remotePlayer.nameTag);
      this.remotePlayerMeshes.delete(playerId);
      console.log('[SpacetimeDBManager] Removed remote player mesh:', playerId);
    }
  }
  
  // === INCOMING PLAYER DATA HANDLING ===
  private handlePlayersUpdate(players: PlayerData[]): void {
    if (!this.context?.localPlayerId) return;
    
    const remotePlayers = players.filter(p => p.id !== this.context!.localPlayerId);
    
    // Update existing remote players
    for (const player of remotePlayers) {
      this.updateRemotePlayer(player);
    }
    
    // Remove players that are no longer in the list
    const activePlayerIds = new Set(remotePlayers.map(p => p.id));
    for (const [playerId] of this.remotePlayerMeshes) {
      if (!activePlayerIds.has(playerId)) {
        this.removeRemotePlayer(playerId);
      }
    }
  }
  
  private handlePlayerJoined(player: PlayerData): void {
    if (player.id !== this.context?.localPlayerId) {
      console.log('[SpacetimeDBManager] Player joined:', player.id);
      this.createRemotePlayer(player);
    }
  }
  
  private handlePlayerLeft(playerId: string): void {
    if (playerId !== this.context?.localPlayerId) {
      console.log('[SpacetimeDBManager] Player left:', playerId);
      this.removeRemotePlayer(playerId);
    }
  }
  
  private handlePlayerUpdate(player: PlayerData): void {
    if (player.id !== this.context?.localPlayerId) {
      this.updateRemotePlayer(player);
    }
  }
  
  // === REMOTE PLAYER MESH MANAGEMENT ===
  private createRemotePlayer(player: PlayerData): void {
    if (this.remotePlayerMeshes.has(player.id)) return;
    
    // Create player mesh
    const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
    const material = new THREE.MeshLambertMaterial({ 
      color: CONFIG.REMOTE_PLAYER_COLOR,
      transparent: true,
      opacity: CONFIG.REMOTE_PLAYER_OPACITY
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `remote_player_${player.id}`;
    mesh.position.set(player.position.x, player.position.y, player.position.z);
    mesh.rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
    
    // Create name tag
    const nameTag = this.createNameTag(player.id);
    
    // Create remote player object
    const remotePlayer: RemotePlayerMesh = {
      mesh,
      nameTag,
      targetPosition: new THREE.Vector3(player.position.x, player.position.y, player.position.z),
      targetRotation: new THREE.Euler(player.rotation.x, player.rotation.y, player.rotation.z),
      lastUpdate: Date.now()
    };
    
    // Add to scene
    this.scene.add(mesh);
    this.scene.add(nameTag);
    
    // Store reference
    this.remotePlayerMeshes.set(player.id, remotePlayer);
    
    console.log('[SpacetimeDBManager] Created remote player mesh for:', player.id);
  }
  
  private updateRemotePlayer(player: PlayerData): void {
    let remotePlayer = this.remotePlayerMeshes.get(player.id);
    
    if (!remotePlayer) {
      this.createRemotePlayer(player);
      return;
    }
    
    // Update target position and rotation for interpolation
    remotePlayer.targetPosition.set(player.position.x, player.position.y, player.position.z);
    remotePlayer.targetRotation.set(player.rotation.x, player.rotation.y, player.rotation.z);
    remotePlayer.lastUpdate = Date.now();
    
    // If the distance is too large, teleport instead of interpolating
    const distance = remotePlayer.mesh.position.distanceTo(remotePlayer.targetPosition);
    if (distance > CONFIG.MAX_INTERPOLATION_DISTANCE) {
      remotePlayer.mesh.position.copy(remotePlayer.targetPosition);
      remotePlayer.mesh.rotation.copy(remotePlayer.targetRotation);
      console.log('[SpacetimeDBManager] Teleported remote player due to large distance:', distance);
    }
  }
  
  private updateRemotePlayerInterpolation(deltaTime: number): void {
    for (const [playerId, remotePlayer] of this.remotePlayerMeshes) {
      // Interpolate position
      remotePlayer.mesh.position.lerp(remotePlayer.targetPosition, CONFIG.INTERPOLATION_FACTOR);
      
      // Interpolate rotation
      remotePlayer.mesh.rotation.x = THREE.MathUtils.lerp(
        remotePlayer.mesh.rotation.x, 
        remotePlayer.targetRotation.x, 
        CONFIG.INTERPOLATION_FACTOR
      );
      remotePlayer.mesh.rotation.y = THREE.MathUtils.lerp(
        remotePlayer.mesh.rotation.y, 
        remotePlayer.targetRotation.y, 
        CONFIG.INTERPOLATION_FACTOR
      );
      remotePlayer.mesh.rotation.z = THREE.MathUtils.lerp(
        remotePlayer.mesh.rotation.z, 
        remotePlayer.targetRotation.z, 
        CONFIG.INTERPOLATION_FACTOR
      );
      
      // Update name tag position
      remotePlayer.nameTag.position.copy(remotePlayer.mesh.position);
      remotePlayer.nameTag.position.y += CONFIG.NAME_TAG_HEIGHT;
    }
  }
  
  private removeRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayerMeshes.get(playerId);
    if (!remotePlayer) return;
    
    // Remove from scene
    this.scene.remove(remotePlayer.mesh);
    this.scene.remove(remotePlayer.nameTag);
    
    // Dispose of geometry and materials
    remotePlayer.mesh.geometry.dispose();
    if (remotePlayer.mesh.material instanceof THREE.Material) {
      remotePlayer.mesh.material.dispose();
    }
    if (remotePlayer.nameTag.material instanceof THREE.SpriteMaterial) {
      remotePlayer.nameTag.material.map?.dispose();
      remotePlayer.nameTag.material.dispose();
    }
    
    // Remove from map
    this.remotePlayerMeshes.delete(playerId);
    
    console.log('[SpacetimeDBManager] Removed remote player:', playerId);
  }
  
  // === NAME TAG CREATION ===
  private createNameTag(playerId: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Text
    context.fillStyle = 'white';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(playerId.substring(0, 8), canvas.width / 2, canvas.height / 2 + 8);
    
    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1, 0.25, 1);
    
    return sprite;
  }
  
  // === CONNECTION STATE MANAGEMENT ===
  public onConnectionStateChanged(state: string): void {
    this.isConnected = state === 'connected';
    
    if (!this.isConnected) {
      // Clear all remote players when disconnected
      for (const [playerId] of this.remotePlayerMeshes) {
        this.removeRemotePlayer(playerId);
      }
    }
    
    console.log('[SpacetimeDBManager] Connection state changed:', state);
  }
  
  // === UTILITY METHODS ===
  public isEnabled(): boolean {
    return this.isEnabled && this.isConnected;
  }
  
  public getLocalPlayerId(): string | null {
    return this.context?.localPlayerId || null;
  }
  
  public getRemotePlayerCount(): number {
    return this.remotePlayerMeshes.size;
  }
  
  public getRemotePlayerIds(): string[] {
    return Array.from(this.remotePlayerMeshes.keys());
  }
  
  // === CLEANUP ===
  public dispose(): void {
    // Remove all remote players
    for (const [playerId] of this.remotePlayerMeshes) {
      this.removeRemotePlayer(playerId);
    }
    
    // Clear references
    this.context = null;
    this.isEnabled = false;
    this.isConnected = false;
    
    console.log('[SpacetimeDBManager] Disposed');
  }
}

// === HELPER FUNCTIONS ===
export function createSpacetimeDBManager(
  scene: THREE.Scene, 
  characterRef: CharacterReference
): SpacetimeDBManager {
  return new SpacetimeDBManager(scene, characterRef);
}

export function setupGlobalSpacetimeDBContext(context: SpacetimeDBContextType): void {
  if (typeof window !== 'undefined') {
    (window as any).spacetimeDBContext = context;
    console.log('[SpacetimeDBManager] Global context set up');
  }
}

// === EXPORTS ===
export default SpacetimeDBManager;
export type { RemotePlayerMesh, CharacterReference };