import * as THREE from 'three';

export class SpatialIndex<T> {
    private grid: (T | null)[][][] = [];
    private bounds: THREE.Box3;
    private resolution: THREE.Vector3; // Number of cells along each axis
    private cellSize: THREE.Vector3;
    // Keep track of which cells are considered "inside" the target geometry
    private insideCells: boolean[][][] = []; 

    constructor(bounds: THREE.Box3, resolution: THREE.Vector3) {
        this.bounds = bounds.clone();
        this.resolution = resolution.clone();

        this.cellSize = new THREE.Vector3(
            (bounds.max.x - bounds.min.x) / resolution.x,
            (bounds.max.y - bounds.min.y) / resolution.y,
            (bounds.max.z - bounds.min.z) / resolution.z
        );

        this.initializeGrid();
    }

    private initializeGrid(): void {
        this.grid = new Array(this.resolution.x);
        this.insideCells = new Array(this.resolution.x); // Initialize insideCells grid
        for (let i = 0; i < this.resolution.x; i++) {
            this.grid[i] = new Array(this.resolution.y);
            this.insideCells[i] = new Array(this.resolution.y);
            for (let j = 0; j < this.resolution.y; j++) {
                this.grid[i][j] = new Array(this.resolution.z).fill(null);
                this.insideCells[i][j] = new Array(this.resolution.z).fill(false); // Default to outside
            }
        }
        console.log(`📦 Initialized Spatial Index: ${this.resolution.x}x${this.resolution.y}x${this.resolution.z} cells`);
    }

    public worldToGridCoords(worldPos: THREE.Vector3): THREE.Vector3 | null {
        if (!this.bounds.containsPoint(worldPos)) {
            return null; // Point is outside the grid bounds
        }

        const localPos = worldPos.clone().sub(this.bounds.min);
        const gridX = Math.floor(localPos.x / this.cellSize.x);
        const gridY = Math.floor(localPos.y / this.cellSize.y);
        const gridZ = Math.floor(localPos.z / this.cellSize.z);

        // Clamp indices to be within grid dimensions
        const i = Math.max(0, Math.min(gridX, this.resolution.x - 1));
        const j = Math.max(0, Math.min(gridY, this.resolution.y - 1));
        const k = Math.max(0, Math.min(gridZ, this.resolution.z - 1));

        return new THREE.Vector3(i, j, k);
    }

    public gridCoordsToWorldCenter(gridCoords: THREE.Vector3): THREE.Vector3 {
        const i = Math.floor(gridCoords.x);
        const j = Math.floor(gridCoords.y);
        const k = Math.floor(gridCoords.z);

        const worldX = this.bounds.min.x + (i + 0.5) * this.cellSize.x;
        const worldY = this.bounds.min.y + (j + 0.5) * this.cellSize.y;
        const worldZ = this.bounds.min.z + (k + 0.5) * this.cellSize.z;

        return new THREE.Vector3(worldX, worldY, worldZ);
    }

    public setCell(gridCoords: THREE.Vector3, data: T): boolean {
        const i = Math.floor(gridCoords.x);
        const j = Math.floor(gridCoords.y);
        const k = Math.floor(gridCoords.z);

        if (this.isValidGridCoords(i, j, k)) {
            // Only allow setting data for cells marked as inside
            if (this.insideCells[i][j][k]) { 
                this.grid[i][j][k] = data;
                return true;
            } else {
                // console.warn(`Attempted to set data for cell (${i},${j},${k}) outside marked geometry.`);
                return false;
            }
        }
        return false;
    }

     public setCellFromWorld(worldPos: THREE.Vector3, data: T): boolean {
        const gridCoords = this.worldToGridCoords(worldPos);
        if (gridCoords) {
           return this.setCell(gridCoords, data);
        }
        return false;
    }

    public getCell(gridCoords: THREE.Vector3): T | null {
        const i = Math.floor(gridCoords.x);
        const j = Math.floor(gridCoords.y);
        const k = Math.floor(gridCoords.z);

        if (this.isValidGridCoords(i, j, k) && this.insideCells[i][j][k]) {
            return this.grid[i][j][k];
        }
        return null;
    }

    public getCellFromWorld(worldPos: THREE.Vector3): T | null {
        const gridCoords = this.worldToGridCoords(worldPos);
        if (gridCoords) {
            return this.getCell(gridCoords);
        }
        return null;
    }

     public isValidGridCoords(i: number, j: number, k: number): boolean {
        return (
            i >= 0 && i < this.resolution.x &&
            j >= 0 && j < this.resolution.y &&
            k >= 0 && k < this.resolution.z
        );
    }

    /**
     * Marks grid cells whose centers are inside the provided geometry.
     * NOTE: Uses raycasting from cell center. Can be slow for high-res grids/complex geometry.
     * Consider approximations (like bounding box) for performance if needed.
     * Assumes geometry is centered appropriately or use the transform matrix.
     */
    public markCellsInsideGeometry(mesh: THREE.Mesh): number {
        console.log(` Marking cells inside geometry: ${mesh.name}...`);
        const geometry = mesh.geometry;
        const transform = mesh.matrixWorld; // Use world matrix for accurate raycasting

        if (!geometry.boundingBox) {
            geometry.computeBoundingBox();
        }
        const geometryBounds = geometry.boundingBox!.clone().applyMatrix4(transform);

        let insideCount = 0;
        const raycaster = new THREE.Raycaster();
        // Ray direction doesn't strictly matter for inside/outside check with closed manifold geometry
        // but consistency helps. Using +X axis.
        const rayDirection = new THREE.Vector3(1, 0, 0); 

        console.time("markCellsInsideGeometry");

        for (let i = 0; i < this.resolution.x; i++) {
            for (let j = 0; j < this.resolution.y; j++) {
                for (let k = 0; k < this.resolution.z; k++) {
                    const cellCenter = this.gridCoordsToWorldCenter(new THREE.Vector3(i, j, k));

                    // Optimization: Quick check if cell center is roughly within geometry bounds
                    if (!geometryBounds.containsPoint(cellCenter)) {
                        this.insideCells[i][j][k] = false;
                        continue;
                    }

                    // Perform raycast from cell center
                    raycaster.set(cellCenter, rayDirection);
                    const intersects = raycaster.intersectObject(mesh, false); // Don't check children

                    // If the number of intersections is odd, the point is inside
                    // This assumes the mesh is a closed manifold (watertight)
                    const isInside = intersects.length % 2 === 1;
                    
                    this.insideCells[i][j][k] = isInside;
                    if (isInside) {
                        insideCount++;
                    }
                }
            }
             // Log progress occasionally
            if (i > 0 && i % Math.floor(this.resolution.x / 10) === 0) {
                console.log(`  ... marked ${i}/${this.resolution.x} X-slices`);
            }
        }
        console.timeEnd("markCellsInsideGeometry");
        console.log(`✅ Marked ${insideCount} cells as inside the geometry.`);
        return insideCount;
    }

     /**
     * Creates a THREE.DataTexture3D representing the 'inside' status of cells.
     * Values are 1.0 for inside, 0.0 for outside.
     * Suitable for passing grid occupancy to shaders.
     */
    public createInsideStatusTexture(): THREE.DataTexture3D {
        const width = this.resolution.x;
        const height = this.resolution.y;
        const depth = this.resolution.z;
        
        const data = new Float32Array(width * height * depth);
        let index = 0;
        for (let k = 0; k < depth; k++) {
            for (let j = 0; j < height; j++) {
                for (let i = 0; i < width; i++) {
                    data[index++] = this.insideCells[i][j][k] ? 1.0 : 0.0;
                }
            }
        }

        const texture = new THREE.DataTexture3D(data, width, height, depth);
        texture.format = THREE.RedFormat; // Only need one channel (red)
        texture.type = THREE.FloatType;
        texture.minFilter = THREE.NearestFilter; // Use nearest for exact cell lookup
        texture.magFilter = THREE.NearestFilter;
        texture.unpackAlignment = 1; // Important for non-RGBA textures
        texture.needsUpdate = true;
        console.log("💾 Created DataTexture3D for spatial index occupancy.");
        return texture;
    }

    // --- Getters ---
    public getResolution(): THREE.Vector3 {
        return this.resolution.clone();
    }

    public getBounds(): THREE.Box3 {
        return this.bounds.clone();
    }

    public getCellSize(): THREE.Vector3 {
        return this.cellSize.clone();
    }

    /** Returns the raw internal grid data. Use with caution. */
    public getRawGrid(): (T | null)[][][] {
        return this.grid;
    }

    /** Returns the boolean grid indicating which cells are inside the marked geometry. */
    public getInsideStatusGrid(): boolean[][][] {
        return this.insideCells;
    }

    // --- Methods to be added later --- 
    // - queryRegion(minBounds: THREE.Box3, maxBounds: THREE.Box3)
    // - getAllCells(): (T | null)[][][]
    // --- 
} 