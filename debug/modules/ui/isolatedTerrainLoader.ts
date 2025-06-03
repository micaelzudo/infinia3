import * as THREE from 'three';
import { disposeNode } from '../../disposeNode_debug';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';
import { getChunkKeyY } from '../../utils_debug';
import type { NoiseMap, NoiseLayers, Seed, Generate, LoadedChunks } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { generateMesh } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';
import { initIsolatedWorkerPool, terminateIsolatedWorkerPool, requestChunkGeometry } from '../workers/isolatedWorkerPool';
import { logThrottled } from '../../logThrottler';

// Constants for dynamic chunk loading
export const DEFAULT_LOAD_CHUNK_RADIUS = 3;
export const DEFAULT_VERTICAL_LOAD_RADIUS_BELOW = 1;
export const DEFAULT_VERTICAL_LOAD_RADIUS_ABOVE = 0;
export const DEFAULT_LOAD_CHECK_INTERVAL = 0.2;

// Interface for chunks stored in the terrain loader
export interface IsolatedChunkData {
    noiseMap: NoiseMap | null;
    lastAccessTime: number;
    mesh: THREE.Mesh | null;
    playerEditMask?: boolean[][][] | null;
    physicsBody?: CANNON.Body | null;
}

// Interface for worker results
interface WorkerResult {
    key: string;
    payload: {
        geometry: THREE.BufferGeometry;
        noiseMap: NoiseMap;
        position: THREE.Vector3;
    };
}

// Export ChunkMeshesRef type for consistency
export type ChunkMeshesRef = { [key: string]: THREE.Mesh | null };

// Interface for terrain loading configuration
export interface TerrainLoadingConfig {
    loadChunkRadius: number;
    unloadChunkRadius: number;
    loadCheckInterval: number;
    unloadCheckInterval: number;
    verticalLoadRadiusAbove: number;
    verticalLoadRadiusBelow: number;
    maxWorkerPoolSize: number;
}

// Default terrain loading configuration
export const DEFAULT_TERRAIN_CONFIG: TerrainLoadingConfig = {
    loadChunkRadius: 5,
    unloadChunkRadius: 8,
    loadCheckInterval: 0.1,
    unloadCheckInterval: 5.0,
    verticalLoadRadiusAbove: 1,
    verticalLoadRadiusBelow: 2,
    maxWorkerPoolSize: 4
};

// Class to handle terrain loading for both first-person and third-person modes
export class IsolatedTerrainLoader {
    private scene: THREE.Scene | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private loadedChunks: { [key: string]: IsolatedChunkData } = {};
    private chunkMeshes: { [key: string]: THREE.Mesh } = {};
    private pendingRequests = new Set<string>();
    private showChunkBoundaries = false;
    private debugBoxes: { [key: string]: THREE.LineSegments } = {};
    private config: TerrainLoadingConfig;
    private timeSinceLastLoadCheck = 0;
    private timeSinceLastUnloadCheck = 0;

    // Terrain generation parameters
    private noiseLayers: NoiseLayers | null = null;
    private seed: Seed | null = null;
    private compInfo: { topElements: TopElementsData | null } | null = null;
    private noiseScale: number | null = null;
    private planetOffset: THREE.Vector3 | null = null;

    // Event callbacks
    private onChunkLoadedCallback?: (chunkKey: string, mesh: THREE.Mesh) => void;
    private onChunkUnloadedCallback?: (chunkKey: string) => void;

    constructor(
        scene: THREE.Scene,
        renderer: THREE.WebGLRenderer,
        noiseLayers: NoiseLayers,
        seed: Seed,
        compInfo: { topElements: TopElementsData | null },
        noiseScale: number,
        planetOffset: THREE.Vector3,
        config: Partial<TerrainLoadingConfig> = {}
    ) {
        this.scene = scene;
        this.renderer = renderer;
        this.noiseLayers = noiseLayers;
        this.seed = seed;
        this.compInfo = compInfo;
        this.noiseScale = noiseScale;
        this.planetOffset = planetOffset;
        
        // Merge with default config
        this.config = {
            ...DEFAULT_TERRAIN_CONFIG,
            ...config
        };

        // Initialize worker pool
        initIsolatedWorkerPool(() => {});
    }

    // Set callbacks for events
    public setCallbacks(
        onChunkLoaded?: (chunkKey: string, mesh: THREE.Mesh) => void,
        onChunkUnloaded?: (chunkKey: string) => void
    ): void {
        this.onChunkLoadedCallback = onChunkLoaded;
        this.onChunkUnloadedCallback = onChunkUnloaded;
    }

    // Toggle debug visualization
    public toggleChunkBoundaries(visible?: boolean): boolean {
        if (visible !== undefined) {
            this.showChunkBoundaries = visible;
        } else {
            this.showChunkBoundaries = !this.showChunkBoundaries;
        }
        
        // Update existing debug boxes
        if (this.scene) {
            Object.values(this.debugBoxes).forEach(box => {
                if (box) {
                    box.visible = this.showChunkBoundaries;
                }
            });
        }
        
        return this.showChunkBoundaries;
    }

    // Update chunk loading based on player position
    public updateChunkLoading(
        playerPosition: THREE.Vector3, 
        delta: number
    ): { chunksLoaded: number, chunksUnloaded: number } {
        if (!this.scene || !this.noiseLayers || !this.seed || !this.compInfo) {
            return { chunksLoaded: 0, chunksUnloaded: 0 };
        }
        
        // Update timers
        this.timeSinceLastLoadCheck += delta;
        this.timeSinceLastUnloadCheck += delta;
        
        let chunksLoaded = 0;
        let chunksUnloaded = 0;

        // Calculate player's chunk coordinates
        const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
        const playerChunkY = Math.floor(playerPosition.y / CHUNK_HEIGHT);
        const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);

        // Handle chunk loading
        if (this.timeSinceLastLoadCheck >= this.config.loadCheckInterval) {
            this.timeSinceLastLoadCheck = 0;
            
            // Load chunks around player
            for (let cx = playerChunkX - this.config.loadChunkRadius; cx <= playerChunkX + this.config.loadChunkRadius; cx++) {
                for (let cy = playerChunkY - this.config.verticalLoadRadiusBelow; cy <= playerChunkY + this.config.verticalLoadRadiusAbove; cy++) {
                    for (let cz = playerChunkZ - this.config.loadChunkRadius; cz <= playerChunkZ + this.config.loadChunkRadius; cz++) {
                        const chunkKey = getChunkKeyY(cx, cy, cz);
                        
                        if (!this.loadedChunks[chunkKey] && !this.pendingRequests.has(chunkKey)) {
                            // Start loading this chunk
                            this.pendingRequests.add(chunkKey);
                            
                            // Queue generation
                            this.requestChunkGeometry(cx, cy, cz)
                                .then(result => {
                                    this.handleWorkerResult(result);
                                    chunksLoaded++;
                                })
                                .catch(err => {
                                    console.error(`Error generating chunk ${chunkKey}:`, err);
                                    this.pendingRequests.delete(chunkKey);
                                });
                        }
                    }
                }
            }
        }
        
        // Handle chunk unloading
        if (this.timeSinceLastUnloadCheck >= this.config.unloadCheckInterval) {
            this.timeSinceLastUnloadCheck = 0;
            
            // Find chunks to unload
            const chunksToUnload: string[] = [];
            
            for (const key in this.loadedChunks) {
                const parts = key.split(',');
                if (parts.length !== 3) continue;
                
                const cx = parseInt(parts[0]);
                const cy = parseInt(parts[1]);
                const cz = parseInt(parts[2]);
                
                const dx = Math.abs(cx - playerChunkX);
                const dy = Math.abs(cy - playerChunkY);
                const dz = Math.abs(cz - playerChunkZ);
                
                if (dx > this.config.unloadChunkRadius || dy > this.config.unloadChunkRadius || dz > this.config.unloadChunkRadius) {
                    chunksToUnload.push(key);
                }
            }
            
            // Unload chunks that are too far away
            chunksToUnload.forEach(key => {
                this.unloadChunk(key);
                chunksUnloaded++;
            });
        }

        return { chunksLoaded, chunksUnloaded };
    }

    // Unload a specific chunk
    private unloadChunk(chunkKey: string): void {
        const chunkData = this.loadedChunks[chunkKey];
        if (!chunkData) return;

        // Remove mesh from scene
        if (chunkData.mesh && this.scene) {
            this.scene.remove(chunkData.mesh);
            chunkData.mesh.geometry.dispose();
            if (Array.isArray(chunkData.mesh.material)) {
                chunkData.mesh.material.forEach(m => m.dispose());
            } else if (chunkData.mesh.material) {
                chunkData.mesh.material.dispose();
            }
        }

        // Remove debug box if exists
        if (this.debugBoxes[chunkKey] && this.scene) {
            this.scene.remove(this.debugBoxes[chunkKey]);
            this.debugBoxes[chunkKey].geometry.dispose();
            if (Array.isArray(this.debugBoxes[chunkKey].material)) {
                this.debugBoxes[chunkKey].material.forEach(m => m.dispose());
            } else if (this.debugBoxes[chunkKey].material) {
                this.debugBoxes[chunkKey].material.dispose();
            }
            delete this.debugBoxes[chunkKey];
        }

        // Remove from loaded chunks and meshes
        delete this.loadedChunks[chunkKey];
        delete this.chunkMeshes[chunkKey];

        // Update currentChunkMeshesForCollision in isolatedTerrainViewer
        if (window.isolatedTerrainViewer && typeof window.isolatedTerrainViewer.updateCurrentChunkMeshesForCollision === 'function') {
            window.isolatedTerrainViewer.updateCurrentChunkMeshesForCollision(this.chunkMeshes);
        }

        // Call chunk unloaded callback
        if (this.onChunkUnloadedCallback) {
            this.onChunkUnloadedCallback(chunkKey);
        }
    }

    // Handle worker result with noise map and geometry data
    private handleWorkerResult(result: WorkerResult): void {
        try {
            if (!result || !result.payload) {
                console.error('[IsolatedTerrainLoader] Invalid worker result:', result);
                return;
            }

            const { key, payload } = result;
            if (!key || !payload) {
                console.error('[IsolatedTerrainLoader] Missing key or payload in worker result');
                return;
            }

            // Create mesh from position buffer
            const mesh = this.createMeshFromBuffer(key, payload);
            if (!mesh) {
                console.error('[IsolatedTerrainLoader] Failed to create mesh from buffer');
                return;
            }

            // Store chunk data
            this.loadedChunks[key] = {
                mesh,
                noiseMap: payload.noiseMap,
                lastAccessTime: Date.now(),
                playerEditMask: null
            };

            // Update chunk meshes
            this.chunkMeshes[key] = mesh;

            // Create debug box if enabled
            if (this.showChunkBoundaries) {
                this.createDebugBox(key, payload.position);
            }

            // Call chunk loaded callback if defined
            if (this.onChunkLoadedCallback) {
                this.onChunkLoadedCallback(key, mesh);
            }
        } catch (error) {
            console.error('[IsolatedTerrainLoader] Error handling worker result:', error);
        }
    }

    // Create mesh from buffer data
    private createMeshFromBuffer(key: string, payload: WorkerResult['payload']): THREE.Mesh | null {
        if (!this.scene || !this.compInfo) return null;
        if (!payload.geometry) {
            console.log(`Empty geometry for chunk ${key}, skipping`);
            return null;
        }
        try {
            // Create material
            let material: THREE.Material;
            if (this.compInfo.topElements) {
                material = createUnifiedPlanetMaterial(this.compInfo.topElements);
            } else {
                material = new THREE.MeshNormalMaterial({ wireframe: false });
            }
            // Create mesh
            const mesh = new THREE.Mesh(payload.geometry, material);
            // Position mesh
            mesh.position.copy(payload.position);
            // Store references
            if (this.loadedChunks[key]) {
                this.loadedChunks[key].mesh = mesh;
            }
            // Add to scene
            this.scene.add(mesh);
            return mesh;
        } catch (error) {
            console.error(`Error creating mesh for chunk ${key}:`, error);
            return null;
        }
    }

    // Create debug box for chunk visualization
    private createDebugBox(key: string, position: THREE.Vector3): void {
        if (!this.scene) return;
        
        // Create wireframe box
        const geometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const line = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            material
        );
        
        line.position.copy(position).add(new THREE.Vector3(
            CHUNK_SIZE/2,
            CHUNK_HEIGHT/2,
            CHUNK_SIZE/2
        ));
        
        this.debugBoxes[key] = line;
        this.scene.add(line);
    }

    // Get the active chunk meshes for collision detection
    public getActiveChunkMeshes(
        playerPosition: THREE.Vector3,
        radius: number = 3
    ): ChunkMeshesRef {
        const result: ChunkMeshesRef = {};
        
        // Calculate player's chunk coordinates
        const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
        const playerChunkY = Math.floor(playerPosition.y / CHUNK_HEIGHT); 
        const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
        
        // Check each chunk in the reference
        for (const key in this.chunkMeshes) {
            const mesh = this.chunkMeshes[key];
            if (!mesh) continue;
            
            // Parse chunk coordinates from key
            const parts = key.split(',');
            if (parts.length !== 3) continue;
            
            const chunkX = parseInt(parts[0]);
            const chunkY = parseInt(parts[1]);
            const chunkZ = parseInt(parts[2]);
            
            // Check if this chunk is within radius of player
            const dx = Math.abs(chunkX - playerChunkX);
            const dy = Math.abs(chunkY - playerChunkY);
            const dz = Math.abs(chunkZ - playerChunkZ);
            
            if (dx <= radius && dy <= radius && dz <= radius) {
                result[key] = mesh;
            }
        }
        
        return result;
    }

    // Get all loaded chunks
    public getLoadedChunks(): { [key: string]: IsolatedChunkData } {
        return this.loadedChunks;
    }

    // Get all chunk meshes
    public getChunkMeshes(): { [key: string]: THREE.Mesh } {
        return this.chunkMeshes;
    }

    // Set terrain generation parameters
    public setTerrainGenerationParams(
        noiseLayers: NoiseLayers,
        seed: Seed,
        compInfo: { topElements: TopElementsData | null },
        noiseScale: number,
        planetOffset: THREE.Vector3
    ): void {
        this.noiseLayers = noiseLayers;
        this.seed = seed;
        this.compInfo = compInfo;
        this.noiseScale = noiseScale;
        this.planetOffset = planetOffset;
    }

    // Clean up resources
    public cleanup(): void {
        // Clean up all meshes
        if (this.scene) {
            Object.values(this.chunkMeshes).forEach(mesh => {
                if (mesh) {
                    this.scene!.remove(mesh);
                    disposeNode(this.scene!, mesh);
                }
            });
        }

        // Clear all state
        this.loadedChunks = {};
        this.chunkMeshes = {};
        this.pendingRequests.clear();

        // Clear debug visualization
        if (this.scene) {
            Object.values(this.debugBoxes).forEach(box => {
                if (box) {
                    this.scene!.remove(box);
                    if (box.geometry) box.geometry.dispose();
                    if (box.material) {
                        if (Array.isArray(box.material)) {
                            box.material.forEach(m => m.dispose());
                        } else {
                            box.material.dispose();
                        }
                    }
                }
            });
            this.debugBoxes = {};
        }
    }

    private requestChunkGeometry(cx: number, cy: number, cz: number): Promise<WorkerResult> {
        return new Promise((resolve, reject) => {
            try {
                const key = getChunkKeyY(cx, cy, cz);
                if (this.pendingRequests.has(key)) {
                    reject(new Error(`Chunk ${key} is already being requested`));
                    return;
                }

                this.pendingRequests.add(key);

                // Generate noise map and geometry
                const noiseMap = generateNoiseMap(
                    cx, cy, cz,
                    this.noiseLayers!,
                    this.seed!
                );
                
                if (!noiseMap) {
                    console.error(`Failed to generate noise map for chunk ${cx},${cy},${cz}`);
                    return;
                }

                const geometry = generateMesh(
                    cx, cy, cz,
                    null, // generate - we already have the noiseMap
                    true, // interpolate
                    undefined, // noiseMapBelow
                    undefined, // noiseMapAbove
                    undefined, // noiseMapXNeg
                    undefined, // noiseMapXPos
                    undefined, // noiseMapZNeg
                    undefined  // noiseMapZPos
                );

                const result: WorkerResult = {
                    key,
                    payload: {
                        geometry,
                        noiseMap,
                        position: new THREE.Vector3(
                            cx * CHUNK_SIZE,
                            cy * CHUNK_HEIGHT,
                            cz * CHUNK_SIZE
                        )
                    }
                };

                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Factory function to create a terrain loader instance
export function createIsolatedTerrainLoader(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    noiseLayers: NoiseLayers,
    seed: Seed,
    compInfo: { topElements: TopElementsData | null },
    noiseScale: number,
    planetOffset: THREE.Vector3,
    config?: Partial<TerrainLoadingConfig>
): IsolatedTerrainLoader {
    return new IsolatedTerrainLoader(
        scene,
        renderer,
        noiseLayers,
        seed,
        compInfo,
        noiseScale,
        planetOffset,
        config
    );
}

// Function to get active chunk meshes for collision detection
export function getActiveChunkMeshesForCollision(
    chunkMeshes: ChunkMeshesRef,
    playerPosition: THREE.Vector3,
    radius: number = 3
): ChunkMeshesRef {
    const result: ChunkMeshesRef = {};
    
    // Calculate player's chunk coordinates
    const playerChunkX = Math.floor(playerPosition.x / CHUNK_SIZE);
    const playerChunkY = Math.floor(playerPosition.y / CHUNK_HEIGHT); 
    const playerChunkZ = Math.floor(playerPosition.z / CHUNK_SIZE);
    
    // Check each chunk in the reference
    for (const key in chunkMeshes) {
        const mesh = chunkMeshes[key];
        if (!mesh) continue;
        
        // Parse chunk coordinates from key
        const parts = key.split(',');
        if (parts.length !== 3) continue;
        
        const chunkX = parseInt(parts[0]);
        const chunkY = parseInt(parts[1]);
        const chunkZ = parseInt(parts[2]);
        
        // Check if this chunk is within radius of player
        const dx = Math.abs(chunkX - playerChunkX);
        const dy = Math.abs(chunkY - playerChunkY);
        const dz = Math.abs(chunkZ - playerChunkZ);
        
        if (dx <= radius && dy <= radius && dz <= radius) {
            result[key] = mesh;
        }
    }
    
    return result;
} 