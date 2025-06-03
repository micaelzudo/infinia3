import * as THREE from 'three';
import { NoiseMap } from '../types';

interface ChunkInputData {
    x: number;
    y: number;
    z: number;
    noiseMap: NoiseMap;
}

interface WorkerTaskData {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    noiseMap: NoiseMap;
    neighbors: {
        below: NoiseMap | null;
        above: NoiseMap | null;
        xNeg: NoiseMap | null;
        xPos: NoiseMap | null;
        zNeg: NoiseMap | null;
        zPos: NoiseMap | null;
    };
    interpolate: boolean;
    wireframe: boolean;
}

interface PendingTask {
    chunkKey: string;
    taskData: WorkerTaskData;
    taskInfo: WorkerTaskInfo;
}

interface WorkerTaskInfo {
    resolve: (geometry: THREE.BufferGeometry) => void;
    reject: (error: Error) => void;
    startTime: number;
    priority: number; // Priority remains, could be used for sorting pendingTasks later
}

interface WorkerStats {
    activeWorkers: number;
    queuedTasks: number; // Will now represent tasks waiting in pendingTasks
    completedTasks: number;
    failedTasks: number;
    averageProcessingTime: number;
    totalWorkers: number; // Add total workers stat
}

export class WorkerMeshGenerator {
    private workers: Worker[] = [];
    private idleWorkers: Worker[] = []; // Queue of available workers
    private pendingTasks: PendingTask[] = []; // Queue of tasks waiting for a worker
    private activeTaskPromises: Map<string, WorkerTaskInfo> = new Map(); // Tracks promises for active/pending tasks
    private debugStats: WorkerStats = {
        activeWorkers: 0,
        queuedTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageProcessingTime: 0,
        totalWorkers: 0,
    };
    private isDisposed: boolean = false;

    constructor(
        // Removed hardwareConcurrency default. User must specify.
        private numWorkers: number,
        // batchSize remains, but is not used in this refactoring pass
        private batchSize: number = 1,
        private onDebugUpdate?: (stats: WorkerStats) => void
    ) {
        if (this.numWorkers > 20) { // Arbitrary high number warning
             console.warn(`WorkerMeshGenerator: Initializing with a high number of workers (${this.numWorkers}). Performance may degrade due to overhead.`);
        }
        if (this.numWorkers <= 0) {
            throw new Error("WorkerMeshGenerator: numWorkers must be greater than 0.");
        }
        this.debugStats.totalWorkers = this.numWorkers;
        this.initializeWorkers();
    }

    private initializeWorkers() {
        for (let i = 0; i < this.numWorkers; i++) {
            try {
                const worker = new Worker(new URL('./meshWorker.ts', import.meta.url), { type: 'module' });
                // Pass worker ID for potential debugging in worker
                worker.postMessage({ type: 'init', workerId: i }); 
                worker.onmessage = (event) => this.handleWorkerMessage(event, worker); // Pass worker ref
                worker.onerror = (event) => this.handleWorkerError(event, worker); // Add error handling
                this.workers.push(worker);
                this.idleWorkers.push(worker); // Start as idle
            } catch (error) {
                 console.error(`Failed to initialize worker ${i}:`, error);
                 // Decrement total workers if one fails to initialize
                 this.debugStats.totalWorkers--; 
            }
        }
         // Update numWorkers to reflect successfully initialized workers
         this.numWorkers = this.workers.length; 
         console.log(`Initialized ${this.numWorkers} mesh generation workers successfully.`);
         if (this.numWorkers === 0 && this.debugStats.totalWorkers > 0) {
             console.error("WorkerMeshGenerator: Failed to initialize ANY workers!");
         }
    }

    // Added worker reference to know which one finished
    private handleWorkerMessage(event: MessageEvent, worker: Worker) {
        if (this.isDisposed) return; // Ignore messages if disposed

        const { success, chunkKey, data, error } = event.data;

        // Check if it's a result message (meshWorker sends results)
        if (chunkKey === undefined) {
            console.log("Worker sent non-result message:", event.data);
            // Potentially handle other message types from worker if needed
            // Make worker idle again ONLY if it wasn't a task result? Needs careful thought.
            // For now, assume any message means it might be ready for more work IF it's not an error
            if (!this.idleWorkers.includes(worker)) {
                 this.idleWorkers.push(worker);
            }
            this.dispatchTasks(); // Try dispatching if a worker potentially became free
            return; 
        }


        const taskInfo = this.activeTaskPromises.get(chunkKey);

        if (!taskInfo) {
            console.warn(`Received result for unknown or already completed task: ${chunkKey}`);
            // Ensure worker becomes idle even if task is unknown
            if (!this.idleWorkers.includes(worker)) {
                this.idleWorkers.push(worker);
            }
            this.dispatchTasks(); // Try dispatching tasks
            return;
        }

        const processingTime = performance.now() - taskInfo.startTime;
        // Avoid division by zero if completedTasks is 0
        const newAvgNumerator = this.debugStats.averageProcessingTime * this.debugStats.completedTasks + processingTime;
        const newCompletedCount = this.debugStats.completedTasks + (success ? 1 : 0);
        this.debugStats.averageProcessingTime = newCompletedCount > 0 ? newAvgNumerator / newCompletedCount : 0;


        if (success) {
            const geometry = new THREE.BufferGeometry();
             // Ensure data exists before accessing attributes
             if (data && data.positions && data.normals) {
                 geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
                 geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
                 if (data.indices) {
                     geometry.setIndex(new THREE.Uint32BufferAttribute(data.indices, 1));
                 }
                 this.debugStats.completedTasks++;
                 taskInfo.resolve(geometry);
             } else {
                 console.error(`Worker success message for ${chunkKey} missing geometry data.`);
                 this.debugStats.failedTasks++;
                 taskInfo.reject(new Error(`Worker success message for ${chunkKey} missing geometry data.`));
             }
        } else {
            this.debugStats.failedTasks++;
            taskInfo.reject(new Error(error || `Worker failed for task ${chunkKey}`));
        }

        this.activeTaskPromises.delete(chunkKey); // Task finished, remove promise info
        this.debugStats.activeWorkers--; // Worker is no longer active on this task

        // Make worker idle and try dispatching next task
        if (!this.idleWorkers.includes(worker)) { // Avoid adding duplicates
             this.idleWorkers.push(worker);
        }
        this.dispatchTasks(); // A worker is free, check pending queue

        if (this.onDebugUpdate) {
            // Update queuedTasks stat before callback
            this.debugStats.queuedTasks = this.pendingTasks.length; 
            this.onDebugUpdate({ ...this.debugStats });
        }
    }

     // Basic error handler for worker failures
     private handleWorkerError(event: ErrorEvent, worker: Worker) {
         console.error(`Worker error: ${event.message}`, event);
         // Optionally try to find which task failed, though event might not contain chunkKey
         // For simplicity, mark worker as idle and let pending tasks potentially be picked up by others.
         // Consider more robust handling: terminate/replace worker?
         this.debugStats.activeWorkers = Math.max(0, this.debugStats.activeWorkers - 1); // Assume it was active

         if (!this.idleWorkers.includes(worker)) {
             this.idleWorkers.push(worker);
         }
         this.dispatchTasks();

         // Maybe mark associated tasks as failed if possible? Difficult without chunkKey.
     }

    async generateChunkMesh(
        chunkData: ChunkInputData,
        neighbors: {
            below: NoiseMap | null;
            above: NoiseMap | null;
            xNeg: NoiseMap | null;
            xPos: NoiseMap | null;
            zNeg: NoiseMap | null;
            zPos: NoiseMap | null;
        },
        interpolate: boolean = true,
        wireframe: boolean = false,
        priority: number = 0 // Priority can be used later to sort pendingTasks
    ): Promise<THREE.BufferGeometry> {
         if (this.isDisposed) {
             return Promise.reject(new Error("WorkerMeshGenerator has been disposed."));
         }
          if (this.numWorkers === 0) {
              return Promise.reject(new Error("WorkerMeshGenerator has no initialized workers."));
          }


        const chunkKey = `${chunkData.x},${chunkData.y},${chunkData.z}`;

        // If task already active/pending, return existing promise
        if (this.activeTaskPromises.has(chunkKey)) {
             console.warn(`Task ${chunkKey} is already active or pending. Returning existing promise.`);
             // This requires storing the Promise itself, not just WorkerTaskInfo. Refactoring needed.
             // For now, let's reject duplicates to avoid complex state.
             return Promise.reject(new Error(`Task ${chunkKey} is already active or pending.`));
             // TODO: Store and return existing Promise<THREE.BufferGeometry> instead of rejecting.
        }

        return new Promise((resolve, reject) => {
            const taskInfo: WorkerTaskInfo = {
                resolve,
                reject,
                startTime: performance.now(), // Start time when queued
                priority
            };

            const taskData: WorkerTaskData = {
                chunkX: chunkData.x,
                chunkY: chunkData.y,
                chunkZ: chunkData.z,
                noiseMap: chunkData.noiseMap,
                neighbors,
                interpolate,
                wireframe
            };

            const pendingTask: PendingTask = { chunkKey, taskData, taskInfo };

            // Add task to the pending queue
            // TODO: Implement priority sorting if needed: this.pendingTasks.push(pendingTask); this.pendingTasks.sort(...)
            this.pendingTasks.push(pendingTask);
            this.activeTaskPromises.set(chunkKey, taskInfo); // Track promise immediately

            // Update stats and attempt to dispatch
            this.debugStats.queuedTasks = this.pendingTasks.length;
            if (this.onDebugUpdate) {
                this.onDebugUpdate({ ...this.debugStats });
            }

            this.dispatchTasks(); // Check if an idle worker can take this task now
        });
    }

    // New method to assign tasks from queue to idle workers
    private dispatchTasks() {
        if (this.isDisposed) return;

        // Sort pending tasks by priority (higher first) - Optional
        // this.pendingTasks.sort((a, b) => b.taskInfo.priority - a.taskInfo.priority);

        while (this.idleWorkers.length > 0 && this.pendingTasks.length > 0) {
            const worker = this.idleWorkers.shift(); // Take an idle worker
            if (!worker) continue; // Should not happen if length > 0, but safety check

            const task = this.pendingTasks.shift(); // Take a pending task
            if (!task) { // Should not happen, but safety check
                this.idleWorkers.unshift(worker); // Put worker back
                continue; 
            }

            // Update stats: task moves from queued to active
            this.debugStats.activeWorkers++;
            this.debugStats.queuedTasks = this.pendingTasks.length; // Update queue count

            // Record start time *when dispatched*, not when queued? debatable. Let's keep queued time.
            // task.taskInfo.startTime = performance.now(); 

            // Send task to worker
            try {
                 // Pass only the task data needed by meshWorker.ts
                 worker.postMessage(task.taskData); 
            } catch (error) {
                 console.error(`Failed to post message to worker for task ${task.chunkKey}:`, error);
                 task.taskInfo.reject(error instanceof Error ? error : new Error(String(error)));
                 this.activeTaskPromises.delete(task.chunkKey); // Remove failed task promise
                 this.debugStats.activeWorkers--; // Worker didn't actually start task
                 this.debugStats.failedTasks++;
                 this.idleWorkers.push(worker); // Worker is still idle
                 // Don't continue loop, maybe try dispatching others later
            }


            // Update debug stats if callback provided
            if (this.onDebugUpdate) {
                this.onDebugUpdate({ ...this.debugStats });
            }
        }
    }


    dispose() {
        this.isDisposed = true;
         console.log("Disposing WorkerMeshGenerator...");
        this.workers.forEach(worker => {
             try {
                 worker.terminate();
             } catch (e) {
                 console.warn("Error terminating worker:", e);
             }
         });
        this.workers = [];
        this.idleWorkers = [];
        this.pendingTasks = [];

        // Reject any outstanding promises
        this.activeTaskPromises.forEach((taskInfo, chunkKey) => {
            taskInfo.reject(new Error(`WorkerMeshGenerator disposed while task ${chunkKey} was pending.`));
        });
        this.activeTaskPromises.clear();

        this.debugStats = {
            activeWorkers: 0,
            queuedTasks: 0,
            completedTasks: this.debugStats.completedTasks, // Keep completed count
            failedTasks: this.debugStats.failedTasks, // Keep failed count
            averageProcessingTime: this.debugStats.averageProcessingTime, // Keep avg time
            totalWorkers: 0,
        };
         console.log("WorkerMeshGenerator disposed.");
         // Clear update callback
         this.onDebugUpdate = undefined;
    }
}