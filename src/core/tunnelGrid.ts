import * as THREE from 'three';

/**
 * Represents the spatial bounds of the grid.
 */
interface GridBounds {
    min: THREE.Vector3;
    max: THREE.Vector3;
}

/**
 * Represents the resolution (number of cells) along each axis.
 */
interface GridResolution {
    x: number;
    y: number;
    z: number;
}

/**
 * Stores data associated with a grid cell.
 * Can be expanded later (e.g., density, type, object references).
 */
interface CellData {
    isInside: boolean; 
    // Add other potential data fields here
    // E.g., glyphInstanceId?: number;
}

/**
 * A uniform grid for spatially indexing the tunnel interior.
 */
export class TunnelGrid {
    private bounds: GridBounds;
    private resolution: GridResolution;
    private cellSize: THREE.Vector3;
    private gridData: CellData[][][]; // 3D array for cell data
    private tunnelMesh: THREE.Mesh | null = null; // Reference to the tunnel mesh for inside checks

    /**
     * Creates a TunnelGrid instance.
     * @param bounds The world-space boundaries of the grid.
     * @param resolution The number of cells along each axis.
     */
    constructor(bounds: GridBounds, resolution: GridResolution) {
        this.bounds = bounds;
        this.resolution = resolution;

        const size = new THREE.Vector3().subVectors(this.bounds.max, this.bounds.min);
        this.cellSize = new THREE.Vector3(
            size.x / this.resolution.x,
            size.y / this.resolution.y,
            size.z / this.resolution.z
        );

        // Initialize grid data
        this.gridData = new Array(this.resolution.x);
        for (let i = 0; i < this.resolution.x; i++) {
            this.gridData[i] = new Array(this.resolution.y);
            for (let j = 0; j < this.resolution.y; j++) {
                this.gridData[i][j] = new Array(this.resolution.z).fill({ isInside: false });
            }
        }

        console.log(`🧊 TunnelGrid created with resolution ${resolution.x}x${resolution.y}x${resolution.z}`);
        console.log(`   Cell size: ${this.cellSize.x.toFixed(2)}, ${this.cellSize.y.toFixed(2)}, ${this.cellSize.z.toFixed(2)}`);
    }

    /**
     * Sets the tunnel mesh reference used for checking if cells are inside.
     * @param mesh The tunnel mesh object.
     */
    setTunnelMesh(mesh: THREE.Mesh) {
        this.tunnelMesh = mesh;
        console.log("   Tunnel mesh set for grid population.");
    }

    /**
     * Populates the grid by determining which cells are inside the tunnel mesh.
     * This is a placeholder and needs a robust implementation (e.g., raycasting).
     */
    populateGrid() {
        if (!this.tunnelMesh) {
            console.warn("Cannot populate grid: Tunnel mesh not set.");
            return;
        }
        console.log("Populating grid (placeholder implementation)...");

        // Basic Placeholder Logic: Assume all cells are inside for now
        // TODO: Replace with actual geometry intersection test (raycasting or sampling)
        for (let i = 0; i < this.resolution.x; i++) {
            for (let j = 0; j < this.resolution.y; j++) {
                for (let k = 0; k < this.resolution.z; k++) {
                    // const cellCenter = this.gridCoordsToWorld(i, j, k);
                    // const isInside = this.isPointInsideMesh(cellCenter, this.tunnelMesh);
                    const isInside = true; // Placeholder
                    this.gridData[i][j][k] = { isInside: isInside };
                }
            }
        }
        console.log("Grid population complete (using placeholder).");
    }

    /**
     * Converts world coordinates to grid indices.
     * @param worldPos The position in world space.
     * @returns The grid indices {i, j, k}, or null if outside bounds.
     */
    worldToGridCoords(worldPos: THREE.Vector3): { i: number; j: number; k: number } | null {
        const localPos = new THREE.Vector3().subVectors(worldPos, this.bounds.min);

        const i = Math.floor(localPos.x / this.cellSize.x);
        const j = Math.floor(localPos.y / this.cellSize.y);
        const k = Math.floor(localPos.z / this.cellSize.z);

        // Check bounds
        if (i < 0 || i >= this.resolution.x ||
            j < 0 || j >= this.resolution.y ||
            k < 0 || k >= this.resolution.z) {
            return null; // Outside grid bounds
        }

        return { i, j, k };
    }

    /**
     * Converts grid indices to the world coordinates of the cell center.
     * @param i The grid index along the x-axis.
     * @param j The grid index along the y-axis.
     * @param k The grid index along the z-axis.
     * @returns The world position of the cell center.
     */
    gridCoordsToWorld(i: number, j: number, k: number): THREE.Vector3 {
        const halfCell = new THREE.Vector3().copy(this.cellSize).multiplyScalar(0.5);
        const localPos = new THREE.Vector3(
            i * this.cellSize.x,
            j * this.cellSize.y,
            k * this.cellSize.z
        );
        return localPos.add(this.bounds.min).add(halfCell);
    }

    /**
     * Gets the data associated with a specific grid cell.
     * @param i The grid index along the x-axis.
     * @param j The grid index along the y-axis.
     * @param k The grid index along the z-axis.
     * @returns The CellData, or null if indices are out of bounds.
     */
    getCellData(i: number, j: number, k: number): CellData | null {
        if (i < 0 || i >= this.resolution.x ||
            j < 0 || j >= this.resolution.y ||
            k < 0 || k >= this.resolution.z) {
            return null; // Out of bounds
        }
        return this.gridData[i][j][k];
    }

     /**
     * Gets the data associated with the cell containing a world point.
     * @param worldPos The position in world space.
     * @returns The CellData, or null if the point is outside the grid.
     */
    getCellDataFromWorldPos(worldPos: THREE.Vector3): CellData | null {
        const coords = this.worldToGridCoords(worldPos);
        if (!coords) {
            return null;
        }
        return this.getCellData(coords.i, coords.j, coords.k);
    }

    /**
     * Gets all grid cell centers that are marked as inside the tunnel.
     * @returns An array of world positions for the centers of inside cells.
     */
    getInsideCellCenters(): THREE.Vector3[] {
        const centers: THREE.Vector3[] = [];
        for (let i = 0; i < this.resolution.x; i++) {
            for (let j = 0; j < this.resolution.y; j++) {
                for (let k = 0; k < this.resolution.z; k++) {
                    if (this.gridData[i][j][k]?.isInside) {
                        centers.push(this.gridCoordsToWorld(i, j, k));
                    }
                }
            }
        }
        return centers;
    }

    // --- Helper for population (Needs robust implementation) ---
    /**
     * Checks if a point is inside a given mesh.
     * Placeholder: Requires a proper point-in-mesh test (e.g., raycasting).
     * @param point The point to test in world coordinates.
     * @param mesh The mesh to test against.
     * @returns True if the point is considered inside, false otherwise.
     */
    private isPointInsideMesh(point: THREE.Vector3, mesh: THREE.Mesh): boolean {
        // TODO: Implement a robust point-in-mesh test.
        // This is complex. Options:
        // 1. Raycasting: Cast a ray from the point in any direction.
        //    Count intersections. Odd number = inside (for closed, watertight meshes).
        //    Needs careful handling of ray direction and edge cases.
        // 2. Voxelization of the mesh: Pre-calculate which voxels the mesh occupies.
        // 3. Signed Distance Fields (SDFs): If an SDF of the tunnel is available.
        // 4. Bounding Box/Sphere Check (Approximation): Fast but inaccurate.

        // Simplistic Bounding Box Check (Highly inaccurate for non-box shapes like tunnels)
        // mesh.geometry.computeBoundingBox();
        // const box = mesh.geometry.boundingBox;
        // if (!box) return false;
        // const worldBox = new THREE.Box3().copy(box).applyMatrix4(mesh.matrixWorld);
        // return worldBox.containsPoint(point);

        // For now, returning true as a placeholder.
        console.warn("isPointInsideMesh is using a placeholder implementation!");
        return true;
    }
} 