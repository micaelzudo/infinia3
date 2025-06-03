import * as THREE from 'three';
import * as CANNON from 'cannon';
import { disposeNode } from '../disposeNode_debug'; // Adjusted path
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../constants_debug'; // Adjusted path
import { getChunkKeyY } from '../utils_debug'; // Adjusted path
import type { NoiseMap, NoiseLayers, Seed, Generate } from '../types_debug'; // Adjusted path
import type { TopElementsData } from './types/renderingTypes'; // Path for TopElementsData if it's specific to ui subfolder
import { generateNoiseMap } from '../noiseMapGenerator_debug'; // Adjusted path
import { generateMesh as generateMeshVertices } from '../meshGenerator_debug'; // Adjusted path
import { createUnifiedPlanetMaterial } from './rendering/materials'; // Path for materials if specific to ui subfolder
// We might need a worker pool here too, similar to isolatedTerrainLoader.ts
// For now, synchronous generation, can be adapted to use workers later.

export interface ManagedChunkData {
    noiseMap: NoiseMap | null;
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null; // Using specific material type
    physicsBody: CANNON.Body | null;
    lastAccessTime: number;
    playerEditMask?: boolean[][][] | null; // Keep if needed for isolated editing logic
    // Add other relevant fields from isolatedTerrainViewer's chunk data structure
}

export class TerrainChunkManager {
    private scene: THREE.Scene;
    private physicsWorld: CANNON.World;
    private groundMaterial: CANNON.Material; // Material for terrain physics bodies

    private managedChunks: { [key: string]: ManagedChunkData } = {};

    // Generation parameters - will be set via a method
    private noiseLayers: NoiseLayers | null = null;
    private seed: Seed | null = null;
    private compInfo: { topElements: TopElementsData | null } | null = null;
    private noiseScale: number = 1.0;
    private planetOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    constructor(scene: THREE.Scene, physicsWorld: CANNON.World, groundMaterial: CANNON.Material) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.groundMaterial = groundMaterial;
        console.log("TerrainChunkManager initialized.");
    }

    public updateGenerationParameters(
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
        console.log("TerrainChunkManager: Generation parameters updated.");
    }

    public getManagedChunkData(chunkKey: string): ManagedChunkData | null {
        return this.managedChunks[chunkKey] || null;
    }

    public getChunkMesh(chunkKey: string): THREE.Mesh | null {
        return this.managedChunks[chunkKey]?.mesh || null;
    }
    
    public getAllChunkMeshes(): { [key: string]: THREE.Mesh | null } {
        const meshes: { [key: string]: THREE.Mesh | null } = {};
        for (const key in this.managedChunks) {
            meshes[key] = this.managedChunks[key].mesh;
        }
        return meshes;
    }

    public getChunkNoiseMap(chunkKey: string): NoiseMap | null {
        return this.managedChunks[chunkKey]?.noiseMap || null;
    }

    private _createPlayerEditMask(): boolean[][][] {
        const mask: boolean[][][] = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            mask[x] = [];
            for (let y = 0; y <= CHUNK_HEIGHT + 1; y++) { // Match NoiseMap dimensions
                mask[x][y] = [];
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    mask[x][y][z] = false;
                }
            }
        }
        return mask;
    }

    /**
     * Generates or retrieves the noise map for a given chunk.
     * If it doesn't exist in managedChunks, it's generated and stored.
     */
    public ensureNoiseMapForChunk(chunkX: number, chunkY: number, chunkZ: number): NoiseMap | null {
        if (!this.noiseLayers || !this.seed) {
            console.error("TerrainChunkManager: Cannot generate noise map, generation parameters not set.");
            return null;
        }
        const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
        let chunkData = this.managedChunks[chunkKey];

        if (chunkData && chunkData.noiseMap) {
            chunkData.lastAccessTime = Date.now();
            return chunkData.noiseMap;
        }

        const generatedNoiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, this.noiseLayers, this.seed);

        if (generatedNoiseMap) {
            if (chunkData) {
                chunkData.noiseMap = generatedNoiseMap;
                chunkData.lastAccessTime = Date.now();
            } else {
                this.managedChunks[chunkKey] = {
                    noiseMap: generatedNoiseMap,
                    mesh: null,
                    physicsBody: null,
                    lastAccessTime: Date.now(),
                    playerEditMask: this._createPlayerEditMask() // Create edit mask
                };
            }
            return generatedNoiseMap;
        }
        return null;
    }

    /**
     * Generates and adds a mesh for the specified chunk if it has a noise map.
     * Handles physics body creation and scene updates.
     * Returns the created mesh or null.
     */
    public generateAndAddMeshForChunk(
        chunkKey: string,
        forceRecreate: boolean = false
    ): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null {
        const chunkData = this.managedChunks[chunkKey];

        if (!chunkData || !chunkData.noiseMap) {
            console.warn("TerrainChunkManager: No noise map for chunk " + chunkKey + ", cannot generate mesh.");
            return null;
        }
        if (!this.compInfo || !this.compInfo.topElements || this.noiseScale === null || !this.planetOffset) {
             console.error("TerrainChunkManager: Cannot create material, essential compInfo, noiseScale, or planetOffset missing.");
             return null;
        }

        if (chunkData.mesh && !forceRecreate) {
            return chunkData.mesh; // Mesh already exists and no force recreate
        }

        // If forcing recreate or mesh exists, dispose old mesh and physics body first
        if (chunkData.mesh) {
            this.removeMeshForChunk(chunkKey, true); // Dispose node will be true
        }

        const coords = chunkKey.split(',').map(Number);
        if (coords.length !== 3 || coords.some(isNaN)) {
            console.error("TerrainChunkManager: Invalid chunk key format: " + chunkKey);
            return null;
        }
        const [chunkX, chunkY, chunkZ] = coords;

        // Fetch neighbor noise maps (essential for stitching)
        const noiseMapBelow = this.ensureNoiseMapForChunk(chunkX, chunkY - 1, chunkZ);
        const noiseMapAbove = this.ensureNoiseMapForChunk(chunkX, chunkY + 1, chunkZ);
        const noiseMapXNeg  = this.ensureNoiseMapForChunk(chunkX - 1, chunkY, chunkZ);
        const noiseMapXPos  = this.ensureNoiseMapForChunk(chunkX + 1, chunkY, chunkZ);
        const noiseMapZNeg  = this.ensureNoiseMapForChunk(chunkX, chunkY, chunkZ - 1);
        const noiseMapZPos  = this.ensureNoiseMapForChunk(chunkX, chunkY, chunkZ + 1);

        const neighborFlags = {
            neighborXPosExists: !!noiseMapXPos,
            neighborXNegExists: !!noiseMapXNeg,
            neighborYPosExists: !!noiseMapAbove,
            neighborYNegExists: !!noiseMapBelow,
            neighborZPosExists: !!noiseMapZPos,
            neighborZNegExists: !!noiseMapZNeg,
        };

        const generateOpts: Generate = { noiseMap: chunkData.noiseMap };
        const geometry = generateMeshVertices(
            chunkX, chunkY, chunkZ,
            generateOpts,
            false, // interpolate setting
            noiseMapBelow, noiseMapAbove, noiseMapXNeg, noiseMapXPos, noiseMapZNeg, noiseMapZPos,
            neighborFlags
        );

        if (!geometry || !(geometry instanceof THREE.BufferGeometry) || !geometry.getAttribute('position') || geometry.getAttribute('position').count === 0) {
            console.error("TerrainChunkManager: Mesh generation failed for " + chunkKey + ", invalid geometry.");
            return null;
        }
        
        const material = createUnifiedPlanetMaterial(
            this.compInfo.topElements,
            this.noiseScale,
            this.planetOffset
        );
        material.side = THREE.DoubleSide; // Match isolatedTerrainViewer

        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = "managed_chunk_" + chunkKey;
        newMesh.position.set(chunkX * CHUNK_SIZE, chunkY * CHUNK_HEIGHT, chunkZ * CHUNK_SIZE); // Position the mesh correctly in world space

        this.scene.add(newMesh);
        chunkData.mesh = newMesh;
        chunkData.lastAccessTime = Date.now();

        // Create and add physics body
        const shape = this.createPhysicsShapeForMesh(newMesh);
        if (shape) {
            const body = new CANNON.Body({
                mass: 0, // Static body
                material: this.groundMaterial
            });
            body.addShape(shape);
            body.position.copy(newMesh.position as any); // Sync with mesh position
            this.physicsWorld.addBody(body);
            chunkData.physicsBody = body;
        }
        return newMesh;
    }
    
    public regenerateMultipleMeshes(chunkKeys: string[]): void {
        console.log("TerrainChunkManager: Regenerating meshes for keys: " + chunkKeys.join(', '));
        // In the future, this could be batched or use workers.
        // For now, simple loop.
        chunkKeys.forEach(key => {
            this.generateAndAddMeshForChunk(key, true); // Force recreate
        });
    }

    public removeMeshForChunk(chunkKey: string, disposeGeometryMaterial: boolean = true): void {
        const chunkData = this.managedChunks[chunkKey];
        if (!chunkData) return;

        if (chunkData.mesh) {
            this.scene.remove(chunkData.mesh);
            if (disposeGeometryMaterial) {
                disposeNode(this.scene, chunkData.mesh); // disposeNode handles geometry and material
            }
            chunkData.mesh = null;
        }

        if (chunkData.physicsBody) {
            this.physicsWorld.removeBody(chunkData.physicsBody);
            chunkData.physicsBody = null;
        }
    }

    private createPhysicsShapeForMesh(mesh: THREE.Mesh): CANNON.Trimesh | null {
        const geometry = mesh.geometry;
        if (!geometry || !geometry.attributes.position) {
            console.warn("TerrainChunkManager: Cannot create physics shape, mesh has no geometry or position attribute.");
            return null;
        }

        const vertices = geometry.attributes.position.array as Float32Array;
        const indices = geometry.index ? geometry.index.array as Uint16Array | Uint32Array : undefined;

        if (!indices) {
             // If no indices, attempt to create a shape from raw vertices (assuming triangles)
             // This is less efficient and might not be perfectly accurate for complex, non-indexed meshes
             const verts = [];
             for(let i = 0; i < vertices.length; i+=3){
                 verts.push(new CANNON.Vec3(vertices[i], vertices[i+1], vertices[i+2]));
             }
             if(verts.length % 3 !== 0){
                 console.warn("TerrainChunkManager: Vertex count not multiple of 3 for non-indexed mesh. Cannot create Trimesh reliably.");
                 return null;
             }
             const idxs = [];
             for(let i = 0; i < verts.length / 3; ++i){
                 idxs.push(i*3, i*3+1, i*3+2);
             }
            return new CANNON.Trimesh(Array.from(vertices), idxs); // Pass Array.from(vertices) for CANNON
        }
        // CANNON.Trimesh expects number[] for vertices and indices
        return new CANNON.Trimesh(Array.from(vertices), Array.from(indices));
    }

    public clearAllChunks(): void {
        console.log("TerrainChunkManager: Clearing all managed chunks.");
        for (const key in this.managedChunks) {
            this.removeMeshForChunk(key, true); // Dispose geometry and material
        }
        this.managedChunks = {};
    }

    // Add methods for editing noise maps, similar to editNoiseMapChunks
    // This would involve:
    // 1. Identifying affected voxels in world space.
    // 2. Translating world voxels to local chunk voxels and noise map indices.
    // 3. Modifying the NoiseMap data in managedChunks[chunkKey].noiseMap.
    // 4. Calling regenerateMultipleMeshes for affected chunk keys.
    // This will be added in a subsequent step.
} 