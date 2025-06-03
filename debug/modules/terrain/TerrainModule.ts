import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TerrainChunkManager, ManagedChunkData } from '../ui/terrainChunkManager';
import { addTerrainChunkToPhysics, removeTerrainChunkFromPhysics, updateTerrainChunkPhysics } from '../ui/terrainPhysicsIntegration';
import { SketchbookWorldAdapter } from '../ui/sketchbookInterfaces';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../constants_debug';
import { getChunkKeyY } from '../utils_debug';
import type { NoiseMap, NoiseLayers, Seed, Generate } from '../types_debug';
import type { TopElementsData } from '../ui/types/renderingTypes';

/**
 * TerrainModule - Manages terrain generation and physics
 * Integrates with Sketchbook's terrain system while providing our own extensions
 */
export class TerrainModule {
    private chunkManager: TerrainChunkManager;
    private worldAdapter: SketchbookWorldAdapter;
    private scene: THREE.Scene;
    private debugId: string;

    constructor(
        worldAdapter: SketchbookWorldAdapter,
        scene: THREE.Scene
    ) {
        this.worldAdapter = worldAdapter;
        this.scene = scene;
        this.debugId = `terrain_${Math.random().toString(36).substr(2, 9)}`;

        // Create chunk manager with physics world
        const physicsWorld = this.worldAdapter.physicsWorld as unknown as CANNON.World;
        const groundMaterial = new CANNON.Material('terrainMat');
        groundMaterial.friction = 0.3;
        this.chunkManager = new TerrainChunkManager(scene, physicsWorld, groundMaterial);
    }

    /**
     * Initialize terrain generation parameters
     */
    public init(
        noiseLayers: NoiseLayers,
        seed: Seed,
        compInfo: { topElements: TopElementsData | null },
        noiseScale: number = 1.0,
        planetOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
    ): void {
        try {
            this.chunkManager.updateGenerationParameters(
                noiseLayers,
                seed,
                compInfo,
                noiseScale,
                planetOffset
            );
        } catch (error) {
            console.error('[TerrainModule] Failed to initialize terrain:', error);
            throw error;
        }
    }

    /**
     * Generate or retrieve a chunk's noise map
     */
    public ensureNoiseMap(chunkX: number, chunkY: number, chunkZ: number): NoiseMap | null {
        try {
            return this.chunkManager.ensureNoiseMapForChunk(chunkX, chunkY, chunkZ);
        } catch (error) {
            console.error(`[TerrainModule] Failed to ensure noise map for chunk (${chunkX},${chunkY},${chunkZ}):`, error);
            return null;
        }
    }

    /**
     * Generate and add a mesh for a chunk
     */
    public generateChunkMesh(chunkX: number, chunkY: number, chunkZ: number, forceRecreate: boolean = false): THREE.Mesh | null {
        try {
            const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
            return this.chunkManager.generateAndAddMeshForChunk(chunkKey, forceRecreate);
        } catch (error) {
            console.error(`[TerrainModule] Failed to generate mesh for chunk (${chunkX},${chunkY},${chunkZ}):`, error);
            return null;
        }
    }

    /**
     * Regenerate multiple chunk meshes
     */
    public regenerateChunks(chunkCoords: { x: number, y: number, z: number }[]): void {
        try {
            const chunkKeys = chunkCoords.map(coord => 
                getChunkKeyY(coord.x, coord.y, coord.z)
            );
            this.chunkManager.regenerateMultipleMeshes(chunkKeys);
        } catch (error) {
            console.error('[TerrainModule] Failed to regenerate chunks:', error);
        }
    }

    /**
     * Remove a chunk's mesh and physics
     */
    public removeChunk(chunkX: number, chunkY: number, chunkZ: number, disposeGeometryMaterial: boolean = true): void {
        try {
            const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
            this.chunkManager.removeMeshForChunk(chunkKey, disposeGeometryMaterial);
        } catch (error) {
            console.error(`[TerrainModule] Failed to remove chunk (${chunkX},${chunkY},${chunkZ}):`, error);
        }
    }

    /**
     * Get a chunk's mesh
     */
    public getChunkMesh(chunkX: number, chunkY: number, chunkZ: number): THREE.Mesh | null {
        try {
            const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
            return this.chunkManager.getChunkMesh(chunkKey);
        } catch (error) {
            console.error(`[TerrainModule] Failed to get mesh for chunk (${chunkX},${chunkY},${chunkZ}):`, error);
            return null;
        }
    }

    /**
     * Get all chunk meshes
     */
    public getAllChunkMeshes(): { [key: string]: THREE.Mesh | null } {
        try {
            return this.chunkManager.getAllChunkMeshes();
        } catch (error) {
            console.error('[TerrainModule] Failed to get all chunk meshes:', error);
            return {};
        }
    }

    /**
     * Get a chunk's noise map
     */
    public getChunkNoiseMap(chunkX: number, chunkY: number, chunkZ: number): NoiseMap | null {
        try {
            const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
            return this.chunkManager.getChunkNoiseMap(chunkKey);
        } catch (error) {
            console.error(`[TerrainModule] Failed to get noise map for chunk (${chunkX},${chunkY},${chunkZ}):`, error);
            return null;
        }
    }

    /**
     * Update a chunk's physics
     */
    public updateChunkPhysics(chunkX: number, chunkY: number, chunkZ: number): void {
        try {
            const mesh = this.getChunkMesh(chunkX, chunkY, chunkZ);
            if (mesh) {
                updateTerrainChunkPhysics(mesh);
            }
        } catch (error) {
            console.error(`[TerrainModule] Failed to update physics for chunk (${chunkX},${chunkY},${chunkZ}):`, error);
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        try {
            // Clear all chunks
            this.chunkManager.clearAllChunks();
        } catch (error) {
            console.error('[TerrainModule] Failed to dispose terrain:', error);
        }
    }
} 