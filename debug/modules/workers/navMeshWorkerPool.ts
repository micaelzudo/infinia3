import * as THREE from 'three';
import * as YUKA from 'yuka';

// Types for NavMesh generation
type NavMeshGenerationCallback = (navMesh: YUKA.NavMesh) => void;
type GeometryData = number[];

// Worker pool state
let isInitialized = false;
let workers: Worker[] = [];
let nextWorkerIndex = 0;
const NUM_NAVMESH_WORKERS = Math.min(4, navigator.hardwareConcurrency || 2);

// Task queue for NavMesh generation
interface NavMeshTask {
    id: string;
    geometryData: GeometryData;
    callback: NavMeshGenerationCallback;
    timestamp: number;
}

let taskQueue: NavMeshTask[] = [];
let processingTasks = new Map<string, NavMeshTask>();

/**
 * Initialize the NavMesh worker pool and expose it to window.workerPool
 */
export function initializeWorkerPool(): boolean {
    if (isInitialized) {
        console.warn('[NavMeshWorkerPool] Already initialized');
        return true;
    }

    console.log(`[NavMeshWorkerPool] Initializing with ${NUM_NAVMESH_WORKERS} workers...`);

    try {
        // Create workers (for now, we'll use a fallback approach)
        for (let i = 0; i < NUM_NAVMESH_WORKERS; i++) {
            // Note: In a full implementation, you'd create actual web workers here
            // For now, we'll create a mock worker structure
            workers.push(null as any); // Placeholder
        }

        // Expose the NavMesh functionality to window.workerPool
        if (typeof window !== 'undefined') {
            (window as any).workerPool = {
                generateNavMesh: generateNavMesh,
                isInitialized: () => isInitialized
            };
        }

        isInitialized = true;
        console.log('[NavMeshWorkerPool] Initialized successfully');
        return true;
    } catch (error) {
        console.error('[NavMeshWorkerPool] Failed to initialize:', error);
        return false;
    }
}

/**
 * Generate a NavMesh from geometry data
 */
function generateNavMesh(geometryData: GeometryData, callback: NavMeshGenerationCallback): void {
    const taskId = `navmesh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: NavMeshTask = {
        id: taskId,
        geometryData,
        callback,
        timestamp: Date.now()
    };

    // For immediate processing (fallback approach)
    processNavMeshTask(task);
}

/**
 * Process a NavMesh generation task
 */
function processNavMeshTask(task: NavMeshTask): void {
    try {
        console.log(`[NavMeshWorkerPool] Processing NavMesh task ${task.id}`);
        
        // Create a basic NavMesh from the geometry data
        const navMesh = createNavMeshFromGeometry(task.geometryData);
        
        // Call the callback with the generated NavMesh
        setTimeout(() => {
            task.callback(navMesh);
            console.log(`[NavMeshWorkerPool] NavMesh task ${task.id} completed`);
        }, 10); // Small delay to simulate async processing
        
    } catch (error) {
        console.error(`[NavMeshWorkerPool] Error processing task ${task.id}:`, error);
        
        // Create a fallback empty NavMesh
        const fallbackNavMesh = new YUKA.NavMesh();
        task.callback(fallbackNavMesh);
    }
}

/**
 * Create a NavMesh from geometry data
 */
function createNavMeshFromGeometry(geometryData: GeometryData): YUKA.NavMesh {
    const navMesh = new YUKA.NavMesh();
    
    if (!geometryData || geometryData.length === 0) {
        console.warn('[NavMeshWorkerPool] No geometry data provided, returning empty NavMesh');
        return navMesh;
    }

    try {
        const polygons: any[] = [];
        
        // Process geometry data in groups of 9 (3 vertices * 3 components)
        for (let i = 0; i < geometryData.length; i += 9) {
            if (i + 8 < geometryData.length) {
                // Create vertices
                const v1 = new YUKA.Vector3(geometryData[i], geometryData[i + 1], geometryData[i + 2]);
                const v2 = new YUKA.Vector3(geometryData[i + 3], geometryData[i + 4], geometryData[i + 5]);
                const v3 = new YUKA.Vector3(geometryData[i + 6], geometryData[i + 7], geometryData[i + 8]);
                
                // Create polygon using fromContour to properly set up half-edge structure
                const polygon = new YUKA.Polygon();
                polygon.fromContour([v1, v2, v3]);
                
                // Only add valid polygons (with proper edge structure)
                if (polygon.edge !== null) {
                    polygons.push(polygon);
                }
            }
        }
        
        // Only proceed if we have valid polygons
        if (polygons.length > 0) {
            // Use fromPolygons to properly initialize the NavMesh
            navMesh.fromPolygons(polygons);
        }

        console.log(`[NavMeshWorkerPool] Created NavMesh with ${navMesh.regions.length} regions`);
        
    } catch (error) {
        console.error('[NavMeshWorkerPool] Error creating NavMesh from geometry:', error);
    }

    return navMesh;
}

/**
 * Request pathfinding between two points
 */
export function requestNavMeshPathfinding(
    from: YUKA.Vector3, 
    to: YUKA.Vector3, 
    callback: (path: YUKA.Vector3[] | null) => void
): void {
    // This would typically use the NavMesh for pathfinding
    // For now, return a simple direct path
    setTimeout(() => {
        callback([from.clone(), to.clone()]);
    }, 10);
}

/**
 * Find the closest point on the NavMesh
 */
export function requestNavMeshClosestPoint(
    point: YUKA.Vector3,
    callback: (closestPoint: YUKA.Vector3) => void
): void {
    // For now, return the original point
    setTimeout(() => {
        callback(point.clone());
    }, 10);
}

/**
 * Terminate the worker pool
 */
export function terminateWorkerPool(): void {
    if (!isInitialized) return;

    console.log('[NavMeshWorkerPool] Terminating worker pool...');
    
    // Clean up workers
    workers.forEach(worker => {
        if (worker && typeof worker.terminate === 'function') {
            worker.terminate();
        }
    });
    
    workers = [];
    taskQueue = [];
    processingTasks.clear();
    
    // Remove from window object
    if (typeof window !== 'undefined' && (window as any).workerPool) {
        delete (window as any).workerPool;
    }
    
    isInitialized = false;
    console.log('[NavMeshWorkerPool] Terminated successfully');
}

// Note: Auto-initialization removed to prevent duplicate initialization warnings
// The worker pool will be initialized when first needed by calling initializeWorkerPool()