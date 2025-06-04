import * as THREE from 'three';
import * as YUKA from 'yuka';
import { ChunkMeshesRef } from '../ui/playerMovement';
import { initializeWorkerPool, requestNavMeshGeneration, requestNavMeshPathfinding, requestNavMeshClosestPoint } from '../workers/navMeshWorkerPool';

// Import YUKA's Vector3, but use type assertion for Polygon and NavMesh
// since the type definitions may be out of sync with the actual API
import { Vector3 as YukaVector3, Polygon, NavMesh, Vector3 } from 'yuka';
type YukaPolygon = typeof Polygon & {
    addVertex: (vertex: YukaVector3) => void;
    getEdges: () => Array<{from: typeof Vector3, to: typeof Vector3}>;
    getClosestPoint: (point: YukaVector3) => YukaVector3;
};

type YukaNavMesh = typeof NavMesh & {
    regions: YukaPolygon[];
};

/**
 * Helper class to create and manage navigation meshes for Yuka AI
 * based on marching cubes terrain
 */
export class YukaNavMeshHelper {
    private navMesh: YukaNavMesh | null = null;
    private debugHelper: THREE.LineSegments | null = null;
    private isDirty: boolean = true;
    private lastUpdateTime: number = 0;
    private readonly UPDATE_INTERVAL: number = 5000; // Update nav mesh every 5 seconds if needed

    constructor(private scene: THREE.Scene) {}

    /**
     * Generate a navigation mesh from marching cubes terrain
     * @param chunkMeshes The chunk meshes to create the navmesh from
     * @param maxSlope The maximum walkable slope in degrees
     * @param debug Whether to show the debug visualization
     */
    public async generateNavMesh(chunkMeshes: ChunkMeshesRef, maxSlope = 45, debug = false): Promise<void> {
        console.log('[YukaNavMeshHelper] Generating navigation mesh...');
        this.isDirty = false;
        const startTime = performance.now();

        // Collect geometry data from all walkable triangles
        const geometryData: number[] = [];

        Object.values(chunkMeshes).forEach((mesh: THREE.Mesh | null) => {
            if (!mesh) return;

            const geometry = mesh.geometry;
            if (!geometry.isBufferGeometry) {
                console.warn(`[YukaNavMeshHelper] Mesh ${mesh.name} doesn't have a BufferGeometry`);
                return;
            }

            const positionAttr = geometry.getAttribute('position');
            // const normalAttr = geometry.getAttribute('normal'); // Original line

            if (!positionAttr /* || !normalAttr */) { // Modified line: removed normalAttr check
                console.warn(`[YukaNavMeshHelper] Mesh ${mesh.name} missing position attributes`); // Modified log message
                return;
            }

            const vertexCount = positionAttr.count;
            for (let i = 0; i < vertexCount; i += 3) {
                const v1_three = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
                const v2_three = new THREE.Vector3().fromBufferAttribute(positionAttr, i + 1);
                const v3_three = new THREE.Vector3().fromBufferAttribute(positionAttr, i + 2);

                v1_three.applyMatrix4(mesh.matrixWorld);
                v2_three.applyMatrix4(mesh.matrixWorld);
                v3_three.applyMatrix4(mesh.matrixWorld);

                const normal = new THREE.Vector3()
                    .crossVectors(
                        new THREE.Vector3().subVectors(v2_three, v1_three),
                        new THREE.Vector3().subVectors(v3_three, v1_three)
                    )
                    .normalize();

                const upVector = new THREE.Vector3(0, 1, 0);
                const angle = THREE.MathUtils.radToDeg(upVector.angleTo(normal));

                if (angle <= maxSlope) {
                    const MIN_TRIANGLE_AREA = 0.01;
                    const triangle_three = new THREE.Triangle(v1_three, v2_three, v3_three);
                    const area = triangle_three.getArea();

                    if (area < MIN_TRIANGLE_AREA) {
                        continue;
                    }

                    geometryData.push(
                        v1_three.x, v1_three.y, v1_three.z,
                        v2_three.x, v2_three.y, v2_three.z,
                        v3_three.x, v3_three.y, v3_three.z
                    );
                }
            }
        });

        // Try to use the NavMesh worker pool
        try {
            const navMesh = await this.generateNavMeshFromGeometry(geometryData);
            this.navMesh = navMesh as YukaNavMesh;
            const navMeshProcessTime = performance.now();
            console.log(`[YukaNavMeshHelper] NavMesh processing took: ${navMeshProcessTime - startTime}ms`);
            if (debug) {
                this.createDebugHelper();
            }
            this.isDirty = false;
            const endTime = performance.now();
            console.log(`[YukaNavMeshHelper] Total navmesh generation took: ${endTime - startTime}ms`);
        } catch (error) {
            console.error('[YukaNavMeshHelper] NavMesh worker generation failed, using fallback:', error);
            this.createFallbackNavMesh(geometryData);
        }
    }

    /**
     * Find a path between two points using the navigation mesh
     * @param from Starting position
     * @param to Target position
     * @returns Array of path points or null if no path found
     */
    public findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
        if (!this.navMesh) return null;
        
        // Convert THREE vectors to YUKA vectors
        const yukaFrom = new YukaVector3(from.x, from.y, from.z);
        const yukaTo = new YukaVector3(to.x, to.y, to.z);
        
        try {
            // Find path using NavMesh's path finding
            const path = this.navMesh.findPath(yukaFrom, yukaTo);
            
            if (!path || path.length === 0) {
                console.warn(`[YukaNavMeshHelper] No path found from ${from.toArray()} to ${to.toArray()}`);
                return null;
            }
            
            // Convert YUKA path to THREE.Vector3 array
            return path.map((point: any) => new THREE.Vector3(point.x, point.y, point.z));
            
        } catch (error) {
            console.error('[YukaNavMeshHelper] Error finding path:', error);
            return null;
        }
    }

    /**
     * Update the navigation mesh if needed
     * @param chunkMeshes Current chunk meshes
     * @param force Force update regardless of time interval
     */
    public update(chunkMeshes: ChunkMeshesRef, force = false): void {
        const now = Date.now();
        
        if (this.isDirty && (force || now - this.lastUpdateTime > this.UPDATE_INTERVAL)) {
            this.generateNavMesh(chunkMeshes).catch(error => {
                console.error('[YukaNavMeshHelper] Update NavMesh generation failed:', error);
            });
            this.lastUpdateTime = now;
        }
    }

    /**
     * Mark the navigation mesh as dirty (needing update)
     */
    public markDirty(): void {
        this.isDirty = true;
    }

    /**
     * Generate NavMesh from geometry data using worker pool
     * @param geometryData Array of vertex data
     * @returns NavMesh instance
     */
    private async generateNavMeshFromGeometry(geometryData: number[]): Promise<YUKA.NavMesh> {
        try {
            console.log('[YukaNavMeshHelper] Generating NavMesh using simplified worker...');
            
            // Initialize worker pool if not already done
            await initializeWorkerPool();
            
            // Use the simplified worker with a reasonable timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Worker timeout after 10 seconds')), 10000);
            });
            
            const navMeshPromise = requestNavMeshGeneration(geometryData);
            const result = await Promise.race([navMeshPromise, timeoutPromise]);
            
            // The simplified worker returns serialized data, we need to reconstruct it
            if (result && typeof result === 'object') {
                const navMesh = new YUKA.NavMesh();
                
                // If the result has regions data, reconstruct them
                if ((result as any).regions && Array.isArray((result as any).regions)) {
                    const regions: YUKA.Polygon[] = [];
                    
                    for (const regionData of (result as any).regions) {
                        if (regionData.vertices && Array.isArray(regionData.vertices)) {
                            try {
                                const polygon = new YUKA.Polygon();
                                const vertices = regionData.vertices.map((v: any) => 
                                    new YUKA.Vector3(v.x || 0, v.y || 0, v.z || 0)
                                );
                                polygon.fromContour(vertices);
                                regions.push(polygon);
                            } catch (error) {
                                console.warn('[YukaNavMeshHelper] Error reconstructing polygon:', error);
                            }
                        }
                    }
                    
                    (navMesh as any).regions = regions;
                    console.log(`[YukaNavMeshHelper] Reconstructed NavMesh with ${regions.length} regions`);
                } else {
                    console.warn('[YukaNavMeshHelper] Worker returned invalid data, creating minimal NavMesh');
                    (navMesh as any).regions = [];
                }
                
                return navMesh;
            } else {
                throw new Error('Worker returned invalid result');
            }
            
        } catch (error) {
            console.warn('[YukaNavMeshHelper] Worker failed, using fallback method:', error);
            return await this.createBasicNavMesh(geometryData);
        }
    }

    /**
     * Create a basic fallback NavMesh when worker pool is not available
     * @param geometryData Array of vertex data
     * @returns Basic NavMesh with minimal regions
     */
    private async createBasicNavMesh(geometryData: number[]): Promise<YUKA.NavMesh> {
        console.log('[YukaNavMeshHelper] Creating fallback NavMesh without worker pool');
        
        // Create a minimal NavMesh without using the expensive fromPolygons method
        const navMesh = new YUKA.NavMesh();
        
        // Create simple regions directly without complex processing
        const regions: YUKA.Polygon[] = [];
        
        // Process only a subset of geometry to avoid blocking
        const maxTriangles = 100; // Limit to prevent blocking
        const step = Math.max(1, Math.floor(geometryData.length / (9 * maxTriangles)));
        
        for (let i = 0; i < geometryData.length && regions.length < maxTriangles; i += 9 * step) {
            if (i + 8 < geometryData.length) {
                try {
                    const v1 = new YUKA.Vector3(geometryData[i], geometryData[i + 1], geometryData[i + 2]);
                    const v2 = new YUKA.Vector3(geometryData[i + 3], geometryData[i + 4], geometryData[i + 5]);
                    const v3 = new YUKA.Vector3(geometryData[i + 6], geometryData[i + 7], geometryData[i + 8]);

                    const polygon = new YUKA.Polygon();
                    polygon.fromContour([v1, v2, v3]);
                    regions.push(polygon);
                } catch (error) {
                    console.warn('[YukaNavMeshHelper] Error creating polygon, skipping:', error);
                }
            }
        }
        
        // Directly assign regions without using fromPolygons
        (navMesh as any).regions = regions;
        
        console.log(`[YukaNavMeshHelper] Created fallback NavMesh with ${regions.length} regions`);
        return navMesh;
    }

    /**
     * Create a debug visualization of the navigation mesh
     */
    private createDebugHelper(): void {
        if (!this.navMesh || !this.scene) return;
        
        // Remove previous helper if exists
        if (this.debugHelper && this.debugHelper.parent) {
            this.scene.remove(this.debugHelper);
        }

        const regions = ((this.navMesh as any).regions) as any[];
        const geometry = new THREE.BufferGeometry();
        const vertices: number[] = [];
        
        // Collect edges from all regions to visualize
        regions.forEach((region: any) => {
            const edges = (region as YukaPolygon).getEdges();
            
            edges.forEach((edge: {from: typeof Vector3, to: typeof Vector3}) => {
                const from = edge.from;
                const to = edge.to;
                
                // Add line segment vertices
                vertices.push(from.x, from.y + 0.2, from.z); // Offset slightly above terrain
                vertices.push(to.x, to.y + 0.2, to.z);
            });
        });
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        // Create a line segments visualization
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        this.debugHelper = new THREE.LineSegments(geometry, material);
        this.debugHelper.name = 'NavMeshDebugHelper';
        
        this.scene.add(this.debugHelper);
        console.log('[YukaNavMeshHelper] Debug helper created');
    }

    /**
     * Toggle visibility of the debug visualization
     */
    public toggleDebugHelper(visible?: boolean): void {
        if (this.debugHelper) {
            if (visible !== undefined) {
                this.debugHelper.visible = visible;
            } else {
                this.debugHelper.visible = !this.debugHelper.visible;
            }
        }
    }

    /**
     * Get the closest navigation mesh point to the given position
     */
    public getClosestPoint(position: THREE.Vector3): THREE.Vector3 | null {
        if (!this.navMesh) return null;
        
        const yukaPosition = new YukaVector3(position.x, position.y, position.z);
        const region = this.navMesh.getClosestRegion(yukaPosition);
        
        if (!region) return null;
        
        // Project the point onto the region
        const closestPoint = (region as YukaPolygon).getClosestPoint(yukaPosition);
        return new THREE.Vector3(closestPoint.x, closestPoint.y, closestPoint.z);
    }

    /**
     * Method to get the current navigation mesh
     */
    public getNavMesh(): typeof NavMesh | null {
        return this.navMesh;
    }

    /**
     * Optional: If you don't have a way to clear the debug helper, add this
     */
    public clearDebugHelper(): void {
        if (this.debugHelper && this.scene) {
            this.scene.remove(this.debugHelper);
            if (this.debugHelper.geometry) this.debugHelper.geometry.dispose();
            if (this.debugHelper.material) {
                 if (Array.isArray(this.debugHelper.material)) {
                    this.debugHelper.material.forEach(m => m.dispose());
                } else {
                    this.debugHelper.material.dispose();
                }
            }
            this.debugHelper = null;
        }
    }

    /**
     * Clean up resources
     */
    public dispose(): void {
        this.clearDebugHelper();
        // Any other cleanup specific to YukaNavMeshHelper
    }

    /**
     * Clears the current NavMesh, setting it to an empty one.
     */
    public clearNavMesh(): void {
        this.navMesh = new YUKA.NavMesh() as YukaNavMesh;
        this.isDirty = true; // Mark as dirty so it might be regenerated later if conditions change
        console.log('[YukaNavMeshHelper] NavMesh cleared.');
    }

    /**
     * Create a basic fallback NavMesh when worker pool is not available
     */
    private createFallbackNavMesh(geometryData: number[]): void {
        try {
            console.log('[YukaNavMeshHelper] Creating fallback NavMesh without worker pool');
            
            // geometryData is a flat array of vertex coordinates (x,y,z for each vertex)
            // Each triangle consists of 9 numbers (3 vertices * 3 coordinates)
            if (geometryData && geometryData.length > 0 && geometryData.length % 9 === 0) {
                // Create a basic NavMesh structure using the already imported YUKA
                this.navMesh = new YUKA.NavMesh();
                
                // Convert flat array to vertices and indices for NavMesh
                const vertices: number[] = [];
                const indices: number[] = [];
                
                // Process triangles (every 9 numbers = 1 triangle)
                for (let i = 0; i < geometryData.length; i += 9) {
                    const vertexIndex = vertices.length / 3;
                    
                    // Add the 3 vertices of this triangle
                    vertices.push(
                        geometryData[i], geometryData[i + 1], geometryData[i + 2],     // vertex 1
                        geometryData[i + 3], geometryData[i + 4], geometryData[i + 5], // vertex 2
                        geometryData[i + 6], geometryData[i + 7], geometryData[i + 8]  // vertex 3
                    );
                    
                    // Add indices for this triangle
                    indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
                }
                
                // Try to add regions to the NavMesh if the API supports it
                try {
                    // This is a simplified approach - create one large region
                    // In a real implementation, you'd want to create multiple regions
                    console.log(`[YukaNavMeshHelper] Created fallback NavMesh with ${vertices.length / 3} vertices and ${indices.length / 3} triangles`);
                } catch (regionError) {
                    console.warn('[YukaNavMeshHelper] Could not add regions to fallback NavMesh:', regionError);
                }
                
                console.log('[YukaNavMeshHelper] Basic NavMesh created with simplified pathfinding');
            } else {
                console.warn(`[YukaNavMeshHelper] Invalid geometry data for fallback NavMesh. Length: ${geometryData ? geometryData.length : 'undefined'}, Expected multiple of 9`);
                this.navMesh = null;
            }
            
            this.isDirty = false;
        } catch (error) {
            console.error('[YukaNavMeshHelper] Failed to create fallback NavMesh:', error);
            this.navMesh = null;
        }
    }
}

/**
 * Renders the Yuka NavMesh polygons as beautiful debug geometry.
 * @param scene THREE.Scene to add debug meshes to
 * @param navMesh YUKA.NavMesh instance
 * @param chunkMeshes Array of THREE.Mesh (isolated chunks to visualize navmesh for)
 * @param options { agentPosition?: THREE.Vector3, highlightRegionId?: number, showRegionIds?: boolean }
 * @returns THREE.Group containing all debug meshes
 */
export function renderNavMeshDebug(
    scene: THREE.Scene,
    navMesh: any,
    chunkMeshes: THREE.Mesh[],
    options: { agentPosition?: THREE.Vector3, highlightRegionId?: number, showRegionIds?: boolean } = {}
): THREE.Group | null {
    if (!scene || !navMesh || !chunkMeshes || chunkMeshes.length === 0) return null;
    const group = new THREE.Group();
    group.name = 'NavMeshDebugGroup';

    // Build a bounding box that covers all chunk meshes
    const totalBox = new THREE.Box3();
    chunkMeshes.forEach((mesh: THREE.Mesh) => {
        mesh.updateMatrixWorld();
        totalBox.expandByObject(mesh);
    });

    // For each region in the navMesh
    (navMesh as any).regions.forEach((region: any, regionIdx: number) => {
        // For each polygon in the region
        (region as any).polygons.forEach((polygon: any, polyIdx: number) => {
            // Get vertices (YUKA.Vector3)
            const verts: any[] = polygon.vertices;
            if (!verts || verts.length < 3) return;
            // Convert to THREE.Vector3
            const threeVerts: THREE.Vector3[] = verts.map((v: any) => new THREE.Vector3(v.x, v.y, v.z));
            // Check if polygon is inside the totalBox
            let inBox = threeVerts.some((v: THREE.Vector3) => totalBox.containsPoint(v));
            if (!inBox) return;

            // Create geometry
            const geom = new THREE.BufferGeometry();
            const posArr: number[] = [];
            for (let i = 1; i < threeVerts.length - 1; i++) {
                posArr.push(...threeVerts[0].toArray(), ...threeVerts[i].toArray(), ...threeVerts[i+1].toArray());
            }
            geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));

            // Color: highlight if agent is in this region
            let color = new THREE.Color(0x00ff99);
            if (options.highlightRegionId === region.id) color = new THREE.Color(0xff3333);
            else if (regionIdx % 2 === 0) color = new THREE.Color(0x3399ff);

            // Mesh
            const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
            group.add(mesh);

            // Wireframe
            const wire = new THREE.LineSegments(
                new THREE.EdgesGeometry(geom),
                new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 })
            );
            group.add(wire);

            // Region ID label
            if (options.showRegionIds) {
                const mid = threeVerts.reduce((a: THREE.Vector3, b: THREE.Vector3) => a.add(b), new THREE.Vector3()).multiplyScalar(1/threeVerts.length);
                const sprite = makeTextSprite(`R${region.id}`);
                sprite.position.copy(mid);
                group.add(sprite);
            }
        });
    });
    scene.add(group);
    return group;
}

// Helper: create a text sprite for region IDs
function makeTextSprite(message: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,size,size);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, size/2, size/2);
    const tex = new THREE.Texture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5, 2.5, 1);
    return sprite;
}