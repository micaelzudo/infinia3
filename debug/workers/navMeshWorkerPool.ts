import * as YUKA from 'yuka'; // Import YUKA for type hints and reconstruction

// Import the interfaces from yukaNavMeshHelper.ts
import type { YukaNavMeshRepresentation } from '../modules/ai/yukaNavMeshHelper';

// --- Interfaces ---
export interface SerializedNavMeshRegion {
    vertices: { x: number, y: number, z: number }[];
    centroid: { x: number, y: number, z: number };
    plane: {
        normal: { x: number, y: number, z: number };
        constant: number;
    };
    id?: number;
}

interface SerializedNavMeshGraphNode {
    index: number;
    position: { x: number, y: number, z: number };
}

interface SerializedNavMeshGraphEdge {
    from: number;
    to: number;
    cost: number;
}

export interface SerializedNavMeshData {
    regions: SerializedNavMeshRegion[];
    graph: {
        nodes: SerializedNavMeshGraphNode[];
        edges: SerializedNavMeshGraphEdge[];
    };
}

interface WorkerMessage {
    type: 'navmesh' | 'path' | 'closestPoint' | 'error' | 'ready' | 'pathfinding' | 'closestPointRequest';
    navMeshId?: string;
    pathfindingRequestId?: string;
    closestPointRequestId?: string;
    error?: string;
    path?: Array<{x: number, y: number, z: number}>;
    closestPoint?: {x: number, y: number, z: number};
    regions?: any[];  // For navmesh data
    polygons?: any[];  // For navmesh data
    from?: {x: number, y: number, z: number};  // For pathfinding
    to?: {x: number, y: number, z: number};    // For pathfinding
    position?: {x: number, y: number, z: number}; // For closest point
    navMeshData?: any; // For navmesh data transfer
}

interface PendingNavMeshRequest {
    resolve: (navMesh: YUKA.NavMesh) => void;
    reject: (error: Error) => void;
    startTime: number;
}

interface PendingPathfindingRequest {
    resolve: (path: { x: number, y: number, z: number }[] | null) => void;
    reject: (error: Error) => void;
    startTime: number;
}

interface PendingClosestPointRequest {
    resolve: (point: { x: number, y: number, z: number } | null) => void;
    reject: (error: Error) => void;
    startTime: number;
}

// --- NavMesh Worker Pool Class ---
class NavMeshWorkerPool {
    private workers: Worker[] = [];
    private taskQueue: { geometryData: number[], request: PendingNavMeshRequest, navMeshId: string }[] = [];
    private pathfindingQueue: { from: { x: number, y: number, z: number }, to: { x: number, y: number, z: number }, request: PendingPathfindingRequest, requestId: string }[] = [];
    private closestPointQueue: { position: { x: number, y: number, z: number }, request: PendingClosestPointRequest, requestId: string }[] = [];
    private workerStatus: ('idle' | 'busy')[] = [];
    // isInitialized is used internally but marked as never read by TypeScript
    // @ts-ignore - We know this is used internally
    private isInitialized = false;
    private initializationPromise: Promise<void> | null = null;
    // @ts-ignore - Used internally
    private poolSize: number;
    
    // Request tracking
    private pendingRequests = new Map<string, PendingNavMeshRequest>();
    private pendingPathfindingRequests = new Map<string, PendingPathfindingRequest>();
    private pendingClosestPointRequests = new Map<string, PendingClosestPointRequest>();
    
    // ID generation
    private nextId = 0;

    private generateId(prefix: string = ''): string {
        return `${prefix}${this.nextId++}-${Date.now()}`;
    }
    
    // Helper to generate pathfinding request IDs
    private generatePathfindingId(): string {
        return this.generateId('path-');
    }

    constructor(poolSize: number) {
        this.poolSize = poolSize;
        this.initializationPromise = this.initializeWorkers(poolSize);
    }

    private async initializeWorkers(poolSize: number): Promise<void> {
        console.log(`[NavMeshWorkerPool] Initializing ${poolSize} workers...`);
        
        const workerPromises: Promise<void>[] = [];
        
        for (let i = 0; i < poolSize; i++) {
            const worker = new Worker(new URL('./navMeshWorker.js', import.meta.url));
            
            // Create a promise that resolves when the worker is ready
            const workerReady = new Promise<void>((resolve) => {
                const onMessage = (event: MessageEvent) => {
                    if (event.data?.type === 'ready') {
                        worker.removeEventListener('message', onMessage);
                        resolve();
                    }
                };
                worker.addEventListener('message', onMessage);
            });
            
            worker.onmessage = (event) => this.handleWorkerMessage(i, event.data);
            worker.onerror = (event) => this.handleWorkerError(i, event);
            
            this.workers.push(worker);
            this.workerStatus.push('idle');
            workerPromises.push(workerReady);
        }
        
        await Promise.all(workerPromises);
        this.isInitialized = true;
        console.log(`[NavMeshWorkerPool] Successfully initialized ${this.workers.length} workers.`);
    }

    private handleWorkerMessage(workerIndex: number, data: WorkerMessage): void {
        const { 
            type, 
            navMeshId, 
            pathfindingRequestId, 
            closestPointRequestId, 
            error, 
            path, 
            closestPoint, 
            regions,
            polygons,
            from,
            to,
            position,
            navMeshData
        } = data;
        
        if (type === 'navmesh' && navMeshId) {
            const request = this.pendingRequests.get(navMeshId);
            if (request) {
                // Reconstruct the navmesh from regions if available
                if (regions) {
                    try {
                        const navMesh = this.reconstructNavMesh(regions);
                        request.resolve(navMesh);
                    } catch (err) {
                        console.error('[NavMeshWorkerPool] Error reconstructing navmesh:', err);
                        request.reject(new Error(`Failed to reconstruct navmesh: ${err instanceof Error ? err.message : 'Unknown error'}`));
                    }
                } else {
                    request.reject(new Error('No regions data received in navmesh message'));
                }
                this.pendingRequests.delete(navMeshId);
                
                const duration = (Date.now() - request.startTime) / 1000;
                console.log(`[NavMeshWorkerPool] NavMesh generation completed in ${duration.toFixed(2)}s`);
            } else {
                console.warn(`[NavMeshWorkerPool] Received NavMesh for unknown ID: ${navMeshId}`);
            }
            
            this.workerStatus[workerIndex] = 'idle';
            this.dispatchTask();
            
        } else if (type === 'path' && pathfindingRequestId) {
            console.log(`[NavMeshWorkerPool] Worker ${workerIndex} found a path`);
            
            const request = this.pendingPathfindingRequests.get(pathfindingRequestId);
            if (request) {
                try {
                    // Convert path to array of points
                    const pathArray = path ? path.map((p: {x: number, y: number, z: number}) => ({
                        x: p.x,
                        y: p.y,
                        z: p.z
                    })) : null;
                    
                    request.resolve(pathArray);
                    this.pendingPathfindingRequests.delete(pathfindingRequestId);
                    
                    const duration = (Date.now() - request.startTime) / 1000;
                    console.log(`[NavMeshWorkerPool] Pathfinding task ${pathfindingRequestId} completed by worker ${workerIndex} in ${duration.toFixed(2)}s.`);
                } catch (err) {
                    console.error(`[NavMeshWorkerPool] Error processing path:`, err);
                    request.reject(new Error(`Failed to process path: ${err instanceof Error ? err.message : 'Unknown error'}`));
                }
            } else {
                console.warn(`[NavMeshWorkerPool] Received path for unknown request ID: ${pathfindingRequestId}`);
            }
            
            this.workerStatus[workerIndex] = 'idle';
            this.dispatchTask();
            
        } else if (type === 'closestPoint' && closestPointRequestId) {
            console.log(`[NavMeshWorkerPool] Worker ${workerIndex} found closest point`);
            
            const request = this.pendingClosestPointRequests.get(closestPointRequestId);
            if (request) {
                try {
                    // Convert point to simple object
                    const point = closestPoint ? {
                        x: closestPoint.x,
                        y: closestPoint.y,
                        z: closestPoint.z
                    } : null;
                    
                    request.resolve(point);
                    this.pendingClosestPointRequests.delete(closestPointRequestId);
                    
                    const duration = (Date.now() - request.startTime) / 1000;
                    console.log(`[NavMeshWorkerPool] Closest point task ${closestPointRequestId} completed by worker ${workerIndex} in ${duration.toFixed(2)}s.`);
                } catch (err) {
                    console.error(`[NavMeshWorkerPool] Error processing closest point:`, err);
                    request.reject(new Error(`Failed to process closest point: ${err instanceof Error ? err.message : 'Unknown error'}`));
                }
            } else {
                console.warn(`[NavMeshWorkerPool] Received closest point for unknown request ID: ${closestPointRequestId}`);
            }
            
            this.workerStatus[workerIndex] = 'idle';
            this.dispatchTask();
            
        } else if (type === 'error') {
            // Handle error message
            const id = navMeshId ?? pathfindingRequestId ?? closestPointRequestId;
            let request: any;
            
            if (navMeshId) {
                request = this.pendingRequests.get(navMeshId);
                if (request) this.pendingRequests.delete(navMeshId);
            } else if (pathfindingRequestId) {
                request = this.pendingPathfindingRequests.get(pathfindingRequestId);
                if (request) this.pendingPathfindingRequests.delete(pathfindingRequestId);
            } else if (closestPointRequestId) {
                request = this.pendingClosestPointRequests.get(closestPointRequestId);
                if (request) this.pendingClosestPointRequests.delete(closestPointRequestId);
            }
            
            if (request) {
                const errorMessage = error || 'Unknown worker error';
                console.error(`[NavMeshWorkerPool] Worker ${workerIndex} reported error for ID ${id}:`, errorMessage);
                request.reject(new Error(errorMessage));
            } else {
                console.error(`[NavMeshWorkerPool] Worker ${workerIndex} reported error for unknown ID ${id}:`, error);
            }
            
            this.workerStatus[workerIndex] = 'idle';
            this.dispatchTask();
            
        } else if ((type as string) === 'progress' && 'progress' in data) {
            // Handle progress updates if needed
            const progress = (data as any).progress;
            if (typeof progress === 'number') {
                console.log(`[NavMeshWorkerPool] Worker ${workerIndex} progress: ${progress}%`);
            }
            
        } else {
            console.warn(`[NavMeshWorkerPool] Unknown message type from worker ${workerIndex}:`, data);
        }
    }

    private handleWorkerError(workerIndex: number, event: ErrorEvent): void {
        console.error(`[NavMeshWorkerPool] Uncaught error in Worker ${workerIndex}:`, event.message, event);
        // Attempt to recover or terminate the worker? For now, just log.
        // We need to handle associated tasks if the worker dies.
        this.workerStatus[workerIndex] = 'idle'; // Mark as idle, might not be accurate if worker terminated
        this.dispatchTask(); // Try to dispatch tasks to other workers
        
        // Mark pending requests associated with this worker as failed? (More complex tracking needed)
        // For simplicity, let's rely on timeouts or manual cancellation for now.
    }

    public async requestNavMeshGeneration(geometryData: any): Promise<SerializedNavMeshData> {
        if (!this.initializationPromise) {
            throw new Error('Worker pool not initialized');
        }
        
        // Wait for workers to be ready
        await this.initializationPromise;
        
        return new Promise((resolve, reject) => {
            const navMeshId = this.generateId();
            const request: PendingNavMeshRequest = {
                resolve,
                reject,
                startTime: Date.now()
            };
            
            // Store the request
            this.pendingRequests.set(navMeshId, request);
            
            // Add to queue and try to process it
            this.taskQueue.push({ geometryData, request, navMeshId });
            this.dispatchTask();
            
            // Set a timeout to clean up if the request takes too long
            const timeoutId = setTimeout(() => {
                if (this.pendingRequests.has(navMeshId)) {
                    console.warn(`[NavMeshWorkerPool] NavMesh generation request ${navMeshId} timed out`);
                    const req = this.pendingRequests.get(navMeshId);
                    if (req) {
                        req.reject(new Error('NavMesh generation timed out'));
                        this.pendingRequests.delete(navMeshId);
                    }
                    
                    // Remove from queue if still there
                    const index = this.taskQueue.findIndex(t => t.navMeshId === navMeshId);
                    if (index !== -1) {
                        this.taskQueue.splice(index, 1);
                    }
                }
            }, 30000); // 30 second timeout
        });
    }

    public async requestNavMeshPathfinding(from: { x: number, y: number, z: number }, to: { x: number, y: number, z: number }): Promise<{ x: number, y: number, z: number }[] | null> {
        if (!this.initializationPromise) {
            throw new Error('Worker pool not initialized');
        }
        
        // Wait for workers to be ready
        await this.initializationPromise;
        
        return new Promise((resolve, reject) => {
            const requestId = this.generateId();
            const request: PendingPathfindingRequest = {
                resolve,
                reject,
                startTime: Date.now()
            };
            
            // Store the request
            this.pendingPathfindingRequests.set(requestId, request);
            
            // Add to queue and try to process it
            this.pathfindingQueue.push({ from, to, request, requestId });
            this.dispatchTask();
            
            // Set a timeout to clean up if the request takes too long
            const timeoutId = setTimeout(() => {
                if (this.pendingPathfindingRequests.has(requestId)) {
                    console.warn(`[NavMeshWorkerPool] Pathfinding request ${requestId} timed out`);
                    const req = this.pendingPathfindingRequests.get(requestId);
                    if (req) {
                        req.reject(new Error('Pathfinding request timed out'));
                        this.pendingPathfindingRequests.delete(requestId);
                    }
                    
                    // Remove from queue if still there
                    const index = this.pathfindingQueue.findIndex(r => r.requestId === requestId);
                    if (index !== -1) {
                        this.pathfindingQueue.splice(index, 1);
                    }
                }
            }, 30000); // 30 second timeout
            
            // Clean up timeout when promise settles
            resolve.finally(() => {
                clearTimeout(timeoutId);
            });
        });
    }

    public async requestNavMeshClosestPoint(position: { x: number, y: number, z: number }): Promise<{ x: number, y: number, z: number } | null> {
        if (!this.initializationPromise) {
            throw new Error('Worker pool not initialized');
        }
        
        // Wait for workers to be ready
        await this.initializationPromise;
        
        return new Promise((resolve, reject) => {
            const requestId = this.generateId();
            const request: PendingClosestPointRequest = {
                resolve,
                reject,
                startTime: Date.now()
            };
            
            // Store the request
            this.pendingClosestPointRequests.set(requestId, request);
            
            // Add to queue and try to process it
            this.closestPointQueue.push({ position, request, requestId });
            this.dispatchTask();
            
            // Set a timeout to clean up if the request takes too long
            const timeoutId = setTimeout(() => {
                if (this.pendingClosestPointRequests.has(requestId)) {
                    console.warn(`[NavMeshWorkerPool] Closest point request ${requestId} timed out`);
                    const req = this.pendingClosestPointRequests.get(requestId);
                    if (req) {
                        req.reject(new Error('Closest point request timed out'));
                        this.pendingClosestPointRequests.delete(requestId);
                    }
                    
                    // Remove from queue if still there
                    const index = this.closestPointQueue.findIndex(r => r.requestId === requestId);
                    if (index !== -1) {
                        this.closestPointQueue.splice(index, 1);
                    }
                }
            }, 30000); // 30 second timeout
            
            // Clean up timeout when promise settles
            resolve.finally(() => {
                clearTimeout(timeoutId);
            });
        });
    }

    private dispatchTask(): void {
        if (this.taskQueue.length === 0 && this.pathfindingQueue.length === 0 && this.closestPointQueue.length === 0) {
            return; // No tasks to dispatch
        }

        const idleWorkerIndex = this.workerStatus.findIndex(status => status === 'idle');
        if (idleWorkerIndex === -1) {
            return; // All workers are busy
        }

        // Prioritize NavMesh generation tasks, then pathfinding, then closest point
        if (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift(); // Get the next task
            if (!task) return; // Safety check

            this.workerStatus[idleWorkerIndex] = 'busy';
            console.log(`[NavMeshWorkerPool] Assigning NavMesh generation task ID ${task.navMeshId} to worker ${idleWorkerIndex}.`);

            // --- Serialize raw geometry data into polygon objects for Transfer ---
            const serializablePolygons: { vertices: { x: number, y: number, z: number }[] }[] = [];
            
            try {
                // Process geometry data in chunks of 9 (3 vertices per triangle)
                for (let i = 0; i < task.geometryData.length; i += 9) {
                    // Ensure we have enough data for a complete triangle
                    if (i + 8 >= task.geometryData.length) {
                        console.warn(`[NavMeshWorkerPool] Incomplete triangle data at index ${i}, skipping...`);
                        break;
                    }

                    // Create a polygon with 3 vertices
                    const polygon = {
                        vertices: [
                            { 
                                x: task.geometryData[i], 
                                y: task.geometryData[i + 1], 
                                z: task.geometryData[i + 2] 
                            },
                            { 
                                x: task.geometryData[i + 3], 
                                y: task.geometryData[i + 4], 
                                z: task.geometryData[i + 5] 
                            },
                            { 
                                x: task.geometryData[i + 6], 
                                y: task.geometryData[i + 7], 
                                z: task.geometryData[i + 8] 
                            }
                        ]
                    };

                    // Validate the polygon data
                    const isValid = polygon.vertices.every(v => 
                        typeof v.x === 'number' && 
                        typeof v.y === 'number' && 
                        typeof v.z === 'number' &&
                        !isNaN(v.x) && 
                        !isNaN(v.y) && 
                        !isNaN(v.z)
                    );

                    if (isValid) {
                        serializablePolygons.push(polygon);
                    } else {
                        console.warn(`[NavMeshWorkerPool] Invalid vertex data in triangle at index ${i}, skipping...`);
                    }
                }

                if (serializablePolygons.length === 0) {
                    throw new Error('No valid polygons could be created from the geometry data');
                }

                const message: WorkerMessage = {
                    type: 'navmesh',
                    polygons: serializablePolygons,
                    navMeshId: task.navMeshId
                };

                this.workers[idleWorkerIndex].postMessage(message);
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[NavMeshWorkerPool] Error preparing NavMesh data:`, errorMessage);
                this.workerStatus[idleWorkerIndex] = 'idle';
                this.taskQueue.unshift(task);
                task.request.reject(new Error(`Failed to prepare NavMesh data: ${errorMessage}`));
                this.pendingRequests.delete(task.navMeshId);
            }
        } else if (this.pathfindingQueue.length > 0) {
            const task = this.pathfindingQueue.shift();
            if (!task) return; // Safety check

            this.workerStatus[idleWorkerIndex] = 'busy';
            console.log(`[NavMeshWorkerPool] Assigning pathfinding task ID ${task.requestId} to worker ${idleWorkerIndex}.`);

            const message: WorkerMessage = {
                type: 'path',
                from: task.from,
                to: task.to,
                pathfindingRequestId: task.requestId
            };

            try {
                this.workers[idleWorkerIndex].postMessage(message);
            } catch (postError) {
                console.error(`[NavMeshWorkerPool] Error posting pathfinding message to worker ${idleWorkerIndex}:`, postError);
                this.workerStatus[idleWorkerIndex] = 'idle';
                this.pathfindingQueue.unshift(task);
                task.request.reject(new Error(`Failed to send pathfinding task to worker ${idleWorkerIndex}`));
                this.pendingPathfindingRequests.delete(task.requestId);
            }
        } else if (this.closestPointQueue.length > 0) {
            const task = this.closestPointQueue.shift();
            if (!task) return; // Safety check

            this.workerStatus[idleWorkerIndex] = 'busy';
            console.log(`[NavMeshWorkerPool] Assigning closest point task ID ${task.requestId} to worker ${idleWorkerIndex}.`);

            const message: WorkerMessage = {
                type: 'closestPoint',
                position: task.position,
                closestPointRequestId: task.requestId
            };

            try {
                this.workers[idleWorkerIndex].postMessage(message);
            } catch (postError) {
                console.error(`[NavMeshWorkerPool] Error posting closest point message to worker ${idleWorkerIndex}:`, postError);
                this.workerStatus[idleWorkerIndex] = 'idle';
                this.closestPointQueue.unshift(task);
                task.request.reject(new Error(`Failed to send closest point task to worker ${idleWorkerIndex}`));
                this.pendingClosestPointRequests.delete(task.requestId);
            }
        }
    }

    public async terminateAll(): Promise<void> {
        console.log('[NavMeshWorkerPool] Terminating all workers');
        this.cleanup();
        
        // Terminate all workers
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.workerStatus = [];
        this.taskQueue = [];
        this.pathfindingQueue = [];
        this.closestPointQueue = [];
        this.isInitialized = false;
        
        // Reset ID counters
        this.nextId = 0;
        
        // Create a new promise for reinitialization if needed
        this.initializationPromise = new Promise<void>(() => {
            // This promise will never resolve, indicating the pool is terminated
            // To reuse the pool, a new instance should be created
        });
    }

    private cleanup() {
        // Helper to reject all pending requests in a map
        const rejectAll = (map: Map<string, { reject: (error: Error) => void }>) => {
            map.forEach(({ reject }) => {
                try {
                    reject(new Error('NavMeshWorkerPool is being terminated'));
                } catch (err) {
                    console.error('Error rejecting promise:', err);
                }
            });
            map.clear();
        };
        
        // Reject all pending requests with proper type assertions
        rejectAll(this.pendingRequests as any);
        rejectAll(this.pendingPathfindingRequests as any);
        rejectAll(this.pendingClosestPointRequests as any);
    }

    /**
     * Reconstructs regions from serialized data
     */
    private reconstructRegions(regionsData: any[]): any[] {
        if (!Array.isArray(regionsData)) {
            console.warn('[NavMeshWorkerPool] Invalid regions data format');
            return [];
        }

        return regionsData.map(regionData => {
            try {
                // Create a simple object to hold the region data
                const region: any = {};
                
                // Copy all properties from regionData
                Object.assign(region, regionData);
                
                // Convert vertices to YUKA.Vector3 if they exist
                if (Array.isArray(regionData.vertices)) {
                    region.vertices = regionData.vertices.map((v: {x: number, y: number, z: number}) => 
                        new YUKA.Vector3(v.x, v.y, v.z)
                    );
                }
                
                return region;
            } catch (err) {
                console.error('[NavMeshWorkerPool] Error reconstructing region:', err);
                return null;
            }
        }).filter(Boolean);
    }
    
    /**
     * Reconstructs a complete NavMesh from serialized data
     */
    // Reconstructs a YUKA NavMesh from serialized data
    private reconstructNavMesh(regions: any[]): YUKA.NavMesh {
        const navMesh = new YUKA.NavMesh();
        
        // Reconstruct regions and add them to the navmesh
        if (Array.isArray(regions)) {
            regions.forEach(regionData => {
                const polygon = new (YUKA as any).Polygon();
                if (Array.isArray(regionData.vertices)) {
                    regionData.vertices.forEach((v: {x: number, y: number, z: number}) => {
                        polygon.add(new YUKA.Vector3(v.x, v.y, v.z));
                    });
                }
                (navMesh as any).regions = (navMesh as any).regions || [];
                (navMesh as any).regions.push(polygon);
            });
        }
        
        return navMesh;
    }
}

// Create a single instance of the worker pool
const navMeshWorkerPool = new NavMeshWorkerPool(navigator.hardwareConcurrency || 4);

// Export types for external use
export type { YukaNavMeshRepresentation, SerializedNavMeshRegion };

// Helper function to initialize the worker pool
async function initializeWorkerPool(poolSize: number = navigator.hardwareConcurrency || 4): Promise<void> {
    // The worker pool is already initialized in the constructor with the default pool size
    console.log(`[NavMeshWorkerPool] Worker pool initialized with ${poolSize} workers`);
}

// Helper function to terminate the worker pool
function terminateWorkerPool(): Promise<void> {
    return navMeshWorkerPool.terminateAll();
}

// Pathfinding request function with input validation
async function requestNavMeshPathfindingWrapper(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
): Promise<Array<{ x: number; y: number; z: number }> | null> {
    if (!navMeshWorkerPool) {
        throw new Error('NavMeshWorkerPool not initialized. Call initializeWorkerPool() first.');
    }
    
    // Validate input vectors
    const validateVector = (v: any, name: string) => {
        if (!v || typeof v !== 'object') {
            throw new Error(`Invalid ${name} position: must be an object with x, y, z properties`);
        }
        if (typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number') {
            throw new Error(`Invalid ${name} position: x, y, z must be numbers`);
        }
    };

    validateVector(from, 'start');
    validateVector(to, 'end');
    
    return navMeshWorkerPool.requestNavMeshPathfinding(from, to);
}

// Closest point request function with input validation
async function requestNavMeshClosestPointWrapper(
    position: { x: number; y: number; z: number }
): Promise<{ x: number; y: number; z: number } | null> {
    if (!navMeshWorkerPool) {
        throw new Error('NavMeshWorkerPool not initialized. Call initializeWorkerPool() first.');
    }
    
    // Validate input vector
    if (!position || typeof position !== 'object') {
        throw new Error('Invalid position: must be an object with x, y, z properties');
    }
    if (typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
        throw new Error('Invalid position: x, y, z must be numbers');
    }
    
    return navMeshWorkerPool.requestNavMeshClosestPoint(position);
}

// Re-export worker pool methods for convenience
const requestNavMeshGeneration = navMeshWorkerPool.requestNavMeshGeneration.bind(navMeshWorkerPool);
const requestNavMeshPathfinding = requestNavMeshPathfindingWrapper;
const requestNavMeshClosestPoint = requestNavMeshClosestPointWrapper;

// Export the pool instance and helper functions
export {
    navMeshWorkerPool,
    initializeWorkerPool,
    terminateWorkerPool,
    requestNavMeshGeneration,
    requestNavMeshPathfinding,
    requestNavMeshClosestPoint
}; 