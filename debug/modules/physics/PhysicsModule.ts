import * as THREE from 'three';
import * as CANNON from 'cannon';
import { addPhysicsToChunks, updateChunkPhysicsDebugVisualization, updateCharacterPhysicsDebugVisualization } from '../ui/physicsUtils';
import { addTerrainChunkToPhysics, removeTerrainChunkFromPhysics, updateTerrainChunkPhysics, createTerrainBoxCollider } from '../ui/terrainPhysicsIntegration';
import { SketchbookWorldAdapter } from '../ui/sketchbookInterfaces';
import { CollisionGroups } from '../ui/sketchbookEnums';

/**
 * PhysicsModule - Manages physics simulation and integration
 * Integrates with Sketchbook's physics system while providing our own extensions
 */
export class PhysicsModule {
    private worldAdapter: SketchbookWorldAdapter;
    private scene: THREE.Scene;
    private materials: { [key: string]: CANNON.Material };
    private chunkMeshes: { [key: string]: THREE.Mesh };
    private currentChunkPhysicsDebugMesh: { current: THREE.Mesh | null };
    private characterPhysicsDebugMeshes: { current: THREE.Mesh[] };
    private debugId: string;
    private timeStep: number = 1 / 60;
    private maxSubSteps: number = 3;

    constructor(
        worldAdapter: SketchbookWorldAdapter,
        scene: THREE.Scene
    ) {
        this.worldAdapter = worldAdapter;
        this.scene = scene;
        this.materials = {
            terrain: new CANNON.Material('terrainMat'),
            character: new CANNON.Material('characterMat')
        };
        this.chunkMeshes = {};
        this.currentChunkPhysicsDebugMesh = { current: null };
        this.characterPhysicsDebugMeshes = { current: [] };
        this.debugId = `phys_${Math.random().toString(36).substr(2, 9)}`;

        // Configure materials
        this.materials.terrain.friction = 0.3;
        this.materials.character.friction = 0.1;

        // Configure physics world
        const physicsWorld = (this.worldAdapter as any).physicsWorld;
        if (physicsWorld) {
            physicsWorld.gravity.set(0, -9.82, 0);
            physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
            physicsWorld.solver.iterations = 10;
            physicsWorld.defaultContactMaterial.friction = 0.5;
            physicsWorld.defaultContactMaterial.restitution = 0.1;
        }
    }

    /**
     * Initialize physics world
     */
    public init(): void {
        try {
            // Configure collision groups
            const terrainCollisionGroup = CollisionGroups.Default;
            const terrainCollisionMask = CollisionGroups.Characters | CollisionGroups.Default;

            // Set up physics world
            if (this.worldAdapter.physicsWorld) {
                const world = this.worldAdapter.physicsWorld as unknown as CANNON.World;
                world.gravity.set(0, -9.82, 0);
                world.broadphase = new CANNON.SAPBroadphase(world);
                (world.solver as any).iterations = 10;
            }
        } catch (error) {
            console.error('[PhysicsModule] Failed to initialize physics:', error);
            throw error;
        }
    }

    /**
     * Add a terrain chunk to physics simulation
     */
    public addTerrainChunk(chunkKey: string, mesh: THREE.Mesh): void {
        try {
            this.chunkMeshes[chunkKey] = mesh;
            addPhysicsToChunks(this.chunkMeshes, this.materials, this.worldAdapter);
        } catch (error) {
            console.error(`[PhysicsModule] Failed to add terrain chunk ${chunkKey}:`, error);
        }
    }

    /**
     * Remove a terrain chunk from physics simulation
     */
    public removeTerrainChunk(chunkKey: string): void {
        try {
            const mesh = this.chunkMeshes[chunkKey];
            if (mesh) {
                removeTerrainChunkFromPhysics(mesh, this.worldAdapter);
                delete this.chunkMeshes[chunkKey];
            }
        } catch (error) {
            console.error(`[PhysicsModule] Failed to remove terrain chunk ${chunkKey}:`, error);
        }
    }

    /**
     * Update terrain chunk physics
     */
    public updateTerrainChunk(chunkKey: string): void {
        try {
            const mesh = this.chunkMeshes[chunkKey];
            if (mesh) {
                updateTerrainChunkPhysics(mesh);
            }
        } catch (error) {
            console.error(`[PhysicsModule] Failed to update terrain chunk ${chunkKey}:`, error);
        }
    }

    /**
     * Create a box collider for terrain
     */
    public createTerrainBox(
        dimensions: THREE.Vector3,
        position: THREE.Vector3,
        rotation: THREE.Quaternion
    ): CANNON.Body | null {
        try {
            const body = createTerrainBoxCollider(
                dimensions,
                position,
                rotation,
                this.worldAdapter
            );
            return body as unknown as CANNON.Body;
        } catch (error) {
            console.error('[PhysicsModule] Failed to create terrain box:', error);
            return null;
        }
    }

    /**
     * Update physics debug visualization
     */
    public updateDebugVisualization(
        chunkX: number,
        chunkY: number,
        chunkZ: number,
        character: any
    ): void {
        try {
            // Update chunk physics debug visualization
            updateChunkPhysicsDebugVisualization(
                chunkX,
                chunkY,
                chunkZ,
                this.scene,
                this.chunkMeshes,
                this.currentChunkPhysicsDebugMesh
            );

            // Update character physics debug visualization
            updateCharacterPhysicsDebugVisualization(
                this.scene,
                character,
                this.characterPhysicsDebugMeshes
            );
        } catch (error) {
            console.error('[PhysicsModule] Failed to update debug visualization:', error);
        }
    }

    /**
     * Update physics simulation
     */
    public update(deltaTime: number): void {
        const physicsWorld = (this.worldAdapter as any).physicsWorld;
        if (physicsWorld) {
            physicsWorld.step(this.timeStep, deltaTime, this.maxSubSteps);
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        try {
            // Remove all terrain chunks
            Object.keys(this.chunkMeshes).forEach(chunkKey => {
                this.removeTerrainChunk(chunkKey);
            });

            // Clear debug meshes
            if (this.currentChunkPhysicsDebugMesh.current) {
                this.scene.remove(this.currentChunkPhysicsDebugMesh.current);
                this.currentChunkPhysicsDebugMesh.current.geometry.dispose();
                if (Array.isArray(this.currentChunkPhysicsDebugMesh.current.material)) {
                    this.currentChunkPhysicsDebugMesh.current.material.forEach(m => m.dispose());
                } else {
                    this.currentChunkPhysicsDebugMesh.current.material.dispose();
                }
                this.currentChunkPhysicsDebugMesh.current = null;
            }

            this.characterPhysicsDebugMeshes.current.forEach(mesh => {
                this.scene.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            });
            this.characterPhysicsDebugMeshes.current = [];
        } catch (error) {
            console.error('[PhysicsModule] Failed to dispose physics:', error);
        }
    }
} 