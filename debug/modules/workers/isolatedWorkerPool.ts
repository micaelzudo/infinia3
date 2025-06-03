import Worker from 'web-worker';
import type { NoiseLayers, Seed, NoiseMap } from '../../types_debug';

// --- Constants ---
// Dynamically determine number of workers based on hardware
export const NUM_ISOLATED_WORKERS = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
    ? Math.min(12, Math.max(2, navigator.hardwareConcurrency)) // Use available cores, min 2, max 12
    : 4; // Fallback if hardwareConcurrency not available

console.log(`Initializing with ${NUM_ISOLATED_WORKERS} workers based on hardware capabilities`);

// --- Queue Management (NEW) ---
type QueuedTask = {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    noiseLayers: NoiseLayers;
    seed: Seed;
    priority: number; // Lower = higher priority
};

let taskQueue: QueuedTask[] = [];
let processingTasks: Set<string> = new Set(); // Track currently processing tasks by key
let taskProcessingInterval: number | null = null;

// --- Types (matching worker and isolatedFirstPerson) ---
type WorkerNoiseGenMessage = [chunkX: number, chunkY: number, chunkZ: number, noiseLayers: NoiseLayers, seed: Seed];

// Updated to reflect worker sending back geometry data (positions) and the original noiseMap
type WorkerReturnPayload = {
    positionBuffer: Float32Array | null; // Vertex positions
    // normalsBuffer?: Float32Array | null; // Optional: if worker also calculates normals
    // uvsBuffer?: Float32Array | null;     // Optional: if worker also calculates UVs
    noiseMap: NoiseMap | null;           // The noiseMap for the central chunk
};
type WorkerReturnMessage = [chunkX: number, chunkY: number, chunkZ: number, payload: WorkerReturnPayload];

type WorkerResultObject = {
    chunkX: number;
    chunkY: number;
    chunkZ: number;
    // positionBuffer: Float32Array | null; // This was the old field, now nested in payload
    // noiseMap: NoiseMap | null;           // This was the old field, now nested in payload
    payload: WorkerReturnPayload; // The new payload from the worker
};
type PositionResultCallback = (result: WorkerResultObject) => void;

// --- Module State ---
let workers: Worker[] = [];
let nextWorkerIndex = 0;
let resultCallback: PositionResultCallback | null = null;
let isInitialized = false;
let workerFailureCount: number[] = []; // Track failures per worker for potential restart

// Add tracking for worker task submission times
let workerLastTaskTime: number[] = [];
let workerStuckTimeout = 30000; // 30 seconds timeout for stuck workers

// --- Initialization ---
export function initIsolatedWorkerPool(onResult: PositionResultCallback): boolean {
    if (isInitialized) {
        console.warn("IsolatedWorkerPool already initialized.");
        return true;
    }
    console.log(`Initializing IsolatedWorkerPool with ${NUM_ISOLATED_WORKERS} workers...`);
    resultCallback = onResult;
    workers = [];
    workerFailureCount = new Array(NUM_ISOLATED_WORKERS).fill(0);
    workerLastTaskTime = new Array(NUM_ISOLATED_WORKERS).fill(0);
    nextWorkerIndex = 0;
    taskQueue = [];
    processingTasks.clear();

    try {
        for (let i = 0; i < NUM_ISOLATED_WORKERS; i++) {
            createWorker(i);
        }
        
        // Start task processing loop
        if (!taskProcessingInterval) {
            taskProcessingInterval = window.setInterval(processQueuedTasks, 50); // Process queue every 50ms
        }
        
        // Start worker health monitor
        startWorkerHealthMonitor();
        
        isInitialized = true;
        console.log("IsolatedWorkerPool Initialized successfully.");
        return true;
    } catch (error) {
        console.error("Failed to initialize IsolatedWorkerPool:", error);
        terminateIsolatedWorkerPool(); // Clean up any partially created workers
        isInitialized = false;
        return false;
    }
}

// Helper to create an individual worker
function createWorker(index: number): boolean {
    try {
        // Adjust path relative to *this file's location* if needed, or use absolute
        const worker = new Worker(new URL('../../worker_debug.mts', import.meta.url), { type: 'module' });

        // Update this handler to work with the new format
        worker.onmessage = (event: MessageEvent<WorkerReturnMessage>) => {
            if (resultCallback) {
                // Convert array format to object format
                const [chunkX, chunkY, chunkZ, payload] = event.data;
                console.log(`WorkerPool: Received data for [${chunkX},${chunkY},${chunkZ}]. Position buffer present: ${!!payload.positionBuffer}, NoiseMap present: ${!!payload.noiseMap}`);
                
                // Remove from processing set
                const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
                processingTasks.delete(chunkKey);
                
                // Reset failure count for this worker on success
                workerFailureCount[index] = 0;
                
                // Create result object with the received payload
                const resultObject: WorkerResultObject = {
                    chunkX, 
                    chunkY, 
                    chunkZ,
                    payload // Pass the whole payload
                };
                
                resultCallback(resultObject);
            }
        };

        worker.onerror = (error) => {
            console.error(`IsolatedWorkerPool Worker ${index} Error:`, error);
            
            // Increment failure count
            workerFailureCount[index]++;
            
            // Restart worker if it's failed too many times
            if (workerFailureCount[index] > 5) {
                console.warn(`Worker ${index} has failed ${workerFailureCount[index]} times. Restarting...`);
                try {
                    worker.terminate();
                    createWorker(index);
                    console.log(`Worker ${index} restarted successfully`);
                } catch (e) {
                    console.error(`Failed to restart worker ${index}:`, e);
                }
            }
        };
        
        workers[index] = worker;
        console.log(`IsolatedWorkerPool: Worker ${index} created.`);
        return true;
    } catch (error) {
        console.error(`Failed to create worker ${index}:`, error);
        return false;
    }
}

// --- Task Processing Logic ---
function processQueuedTasks() {
    if (!isInitialized || workers.length === 0 || taskQueue.length === 0) return;
    
    // Sort queue by priority if needed
    if (taskQueue.length > 1) {
        taskQueue.sort((a, b) => a.priority - b.priority);
    }
    
    // Performance enhancement: Adaptive batch size based on queue length
    const ADAPTIVE_BATCH_SIZE = Math.min(
        Math.max(2, Math.floor(taskQueue.length / 4)), // Scale with queue size
        NUM_ISOLATED_WORKERS * 2 // But never more than 2x workers
    );
    
    // Group tasks by priority for batch processing
    const priorityGroups: Record<number, QueuedTask[]> = {};
    
    // ENHANCEMENT: Special handling for boundary chunks
    // First, identify boundary chunks (chunks that are at the edge of edited regions)
    const boundaryChunks = new Set<string>();
    for (const task of taskQueue) {
        const key = `${task.chunkX},${task.chunkY},${task.chunkZ}`;
        
        // Check if this is a boundary chunk by looking for neighbors in the queue
        const hasYPosNeighbor = taskQueue.some(t => 
            t.chunkX === task.chunkX && t.chunkZ === task.chunkZ && t.chunkY === task.chunkY + 1);
        const hasYNegNeighbor = taskQueue.some(t => 
            t.chunkX === task.chunkX && t.chunkZ === task.chunkZ && t.chunkY === task.chunkY - 1);
            
        // If a chunk has a neighbor in one direction but not another, it's likely a boundary chunk
        if ((hasYPosNeighbor && !hasYNegNeighbor) || (!hasYPosNeighbor && hasYNegNeighbor)) {
            boundaryChunks.add(key);
        }
    }
    
    // Now group tasks by priority, with special handling for boundary chunks
    taskQueue.forEach(task => {
        // Check if this is a boundary chunk
        const key = `${task.chunkX},${task.chunkY},${task.chunkZ}`;
        let effectivePriority = task.priority;
        
        // Boost priority of boundary chunks
        if (boundaryChunks.has(key)) {
            effectivePriority -= 1; // Higher priority (lower number)
        }
        
        if (!priorityGroups[effectivePriority]) {
            priorityGroups[effectivePriority] = [];
        }
        priorityGroups[effectivePriority].push(task);
    });
    
    // Process tasks in priority order
    const priorities = Object.keys(priorityGroups).map(Number).sort((a, b) => a - b);
    
    // Process as many tasks as we have workers available
    let tasksProcessed = 0;
    const maxTasksPerCycle = ADAPTIVE_BATCH_SIZE;
    
    // First, find how many workers are currently "free" (not processing long-running tasks)
    const now = Date.now();
    let availableWorkers = 0;
    let freeWorkerIndices: number[] = [];
    
    for (let i = 0; i < workers.length; i++) {
        // Consider a worker available if it's either not doing a task or the task is very recent
        // (to prevent immediate back-to-back assignments which could lead to memory issues)
        if (workerLastTaskTime[i] === 0 || (now - workerLastTaskTime[i] > 200)) {
            availableWorkers++;
            freeWorkerIndices.push(i);
        }
    }
    
    console.log(`WorkerPool: ${availableWorkers} workers available, ${taskQueue.length} tasks in queue`);
    
    // Distribute tasks fairly among priority groups
    let totalProcessed = 0;
    
    // Improved load balancing: Assign tasks to most idle workers first
    // Sort workers by idle time (longest idle first)
    freeWorkerIndices.sort((a, b) => {
        if (workerLastTaskTime[a] === 0) return -1; // Worker a never used, prioritize it
        if (workerLastTaskTime[b] === 0) return 1;  // Worker b never used, prioritize it
        return workerLastTaskTime[a] - workerLastTaskTime[b]; // Longest idle first
    });
    
    // First pass: assign at least one task from each priority if possible
    for (const priority of priorities) {
        if (totalProcessed >= maxTasksPerCycle || totalProcessed >= availableWorkers) break;
        
        const priorityTasks = priorityGroups[priority];
        if (priorityTasks.length === 0) continue;
        
        // Take the first task from this priority
        const task = priorityTasks.shift()!;
        const chunkKey = `${task.chunkX},${task.chunkY},${task.chunkZ}`;
        
        // Skip if already processing this chunk
        if (processingTasks.has(chunkKey)) continue;
        
        // Find most idle worker
        if (freeWorkerIndices.length > 0) {
            const workerIdx = freeWorkerIndices.shift()!; // Get most idle worker
            const success = postTaskToWorker(workerIdx, task);
            if (success) {
                processingTasks.add(chunkKey);
                totalProcessed++;
                
                // Update next worker index to keep round-robin working
                nextWorkerIndex = (workerIdx + 1) % workers.length;
            } else {
                // If posting fails, put worker back in the queue (at the end)
                freeWorkerIndices.push(workerIdx);
                // And put task back at front of its priority queue
                priorityGroups[priority].unshift(task);
            }
        }
    }
    
    // Second pass: process more tasks from highest priority groups if workers available
    for (const priority of priorities) {
        if (totalProcessed >= maxTasksPerCycle || freeWorkerIndices.length === 0) break;
        
        const priorityTasks = priorityGroups[priority];
        const tasksToProcess = Math.min(
            priorityTasks.length,
            Math.min(maxTasksPerCycle - totalProcessed, freeWorkerIndices.length)
        );
        
        for (let i = 0; i < tasksToProcess; i++) {
            if (freeWorkerIndices.length === 0) break;
            
            const task = priorityTasks.shift()!;
            const chunkKey = `${task.chunkX},${task.chunkY},${task.chunkZ}`;
            
            // Skip if already processing this chunk
            if (processingTasks.has(chunkKey)) continue;
            
            // Get next free worker
            const workerIdx = freeWorkerIndices.shift()!;
            const success = postTaskToWorker(workerIdx, task);
            
            if (success) {
                processingTasks.add(chunkKey);
                totalProcessed++;
                
                // Update next worker index for round-robin
                nextWorkerIndex = (workerIdx + 1) % workers.length;
            } else {
                // If posting fails, put worker back in the queue and stop processing this priority
                freeWorkerIndices.push(workerIdx);
                priorityTasks.unshift(task);
                break;
            }
        }
    }
    
    // Rebuild task queue from remaining tasks in priority groups
    taskQueue = [];
    for (const priority of priorities) {
        taskQueue.push(...priorityGroups[priority]);
    }
    
    if (totalProcessed > 0) {
        console.log(`WorkerPool: Processed ${totalProcessed}/${availableWorkers} tasks, ${taskQueue.length} remaining`);
    }
}

// Post a task to a specific worker
function postTaskToWorker(workerIdx: number, task: QueuedTask): boolean {
    const { chunkX, chunkY, chunkZ, noiseLayers, seed } = task;
    
    if (!workers[workerIdx] || typeof workers[workerIdx].postMessage !== 'function') {
        console.error(`IsolatedWorkerPool: Worker ${workerIdx} is invalid or postMessage is not a function. Task for [${chunkX},${chunkY},${chunkZ}] cannot be sent.`);
        // Optionally, re-queue the task or mark worker for restart
        workerFailureCount[workerIdx] = (workerFailureCount[workerIdx] || 0) + 1; // Ensure initialization
        if (workerFailureCount[workerIdx] > 5) {
            console.warn(`IsolatedWorkerPool: Worker ${workerIdx} consistently invalid. Attempting restart.`);
            try {
                if (workers[workerIdx]) workers[workerIdx].terminate();
            } catch (e) { /* ignore termination error */ }
            createWorker(workerIdx); // Attempt to recreate
        }
        // Re-queue the task with a slight delay or lower priority? For now, just fail.
        // taskQueue.unshift(task); // Put it back at the front with high priority
        return false;
    }
    const worker = workers[workerIdx];

    const message: WorkerNoiseGenMessage = [chunkX, chunkY, chunkZ, noiseLayers, seed];
    
    try {
        // Performance enhancement: Track memory usage if available
        let memoryInfo = '';
        if (typeof performance !== 'undefined' && (performance as any).memory) {
            const mem = (performance as any).memory;
            if (mem && mem.usedJSHeapSize && mem.jsHeapSizeLimit) {
                const used = Math.round(mem.usedJSHeapSize / (1024 * 1024));
                const limit = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
                const percent = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
                memoryInfo = ` [Memory: ${used}MB/${limit}MB (${percent}%)]`;
            }
        }
        
        console.log(`IsolatedWorkerPool: Worker ${workerIdx} processing chunk [${chunkX},${chunkY},${chunkZ}]${memoryInfo}`);
        worker.postMessage(message);
        workerLastTaskTime[workerIdx] = Date.now(); // Record task start time
        return true;
    } catch (err) {
        console.error(`IsolatedWorkerPool: Error posting message to worker for chunk [${chunkX},${chunkY},${chunkZ}]:`, err);
        
        // Increment failure count for this worker
        workerFailureCount[workerIdx] = (workerFailureCount[workerIdx] || 0) + 1; // Ensure initialization
        
        // If out of memory, try to recover
        if (err instanceof Error && err.message.includes('memory')) {
            console.warn(`Worker ${workerIdx} appears to be out of memory. Attempting to restart...`);
            try {
                worker.terminate();
                createWorker(workerIdx);
                console.log(`Worker ${workerIdx} restarted after memory error`);
            } catch (restartError) {
                console.error(`Failed to restart worker ${workerIdx} after memory error:`, restartError);
            }
        }
        
        return false;
    }
}

// --- Task Distribution ---
export function requestChunkGeometry(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    noiseLayers: NoiseLayers,
    seed: Seed,
    priority: number = 1 // Default priority, lower = higher priority
): boolean {
    if (!isInitialized || workers.length === 0) {
        console.error("IsolatedWorkerPool not initialized or has no workers.");
        return false;
    }

    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    
    // Don't queue if already processing or in queue
    if (processingTasks.has(chunkKey)) {
        return true; // Already being processed
    }
    
    // Check if already in queue
    const existingTaskIndex = taskQueue.findIndex(
        task => task.chunkX === chunkX && task.chunkY === chunkY && task.chunkZ === chunkZ
    );
    
    // Dynamic priority adjustment based on Y coordinate
    // Chunks closer to ground level (Y=0) get higher priority
    const yDistanceFromZero = Math.abs(chunkY);
    const adjustedPriority = Math.max(1, priority + yDistanceFromZero);
    
    if (existingTaskIndex >= 0) {
        // Update priority if lower (higher priority) than current
        if (adjustedPriority < taskQueue[existingTaskIndex].priority) {
            taskQueue[existingTaskIndex].priority = adjustedPriority;
            // Resort queue when priority changes
            if (taskQueue.length > 1) {
                taskQueue.sort((a, b) => a.priority - b.priority);
            }
        }
        return true; // Already queued
    }
    
    // Queue the task with adjusted priority
    taskQueue.push({
        chunkX,
        chunkY,
        chunkZ,
        noiseLayers,
        seed,
        priority: adjustedPriority
    });
    
    // Immediately process if queue was empty
    if (taskQueue.length === 1) {
        processQueuedTasks();
    }
    
    return true;
}

// Monitor worker health and restart any stuck workers
function startWorkerHealthMonitor() {
    // Every 10 seconds, check if any workers are stuck
    const monitorInterval = window.setInterval(() => {
        if (!isInitialized) {
            clearInterval(monitorInterval);
            return;
        }
        
        const now = Date.now();
        
        for (let i = 0; i < workers.length; i++) {
            // If a worker has been processing a task for too long, restart it
            if (workerLastTaskTime[i] > 0 && (now - workerLastTaskTime[i] > workerStuckTimeout)) {
                console.warn(`IsolatedWorkerPool: Worker ${i} appears stuck (${Math.round((now - workerLastTaskTime[i])/1000)}s). Restarting...`);
    
    try {
                    workers[i].terminate();
                    createWorker(i);
                    workerLastTaskTime[i] = 0;
                    console.log(`IsolatedWorkerPool: Worker ${i} restarted due to timeout`);
                } catch (error) {
                    console.error(`IsolatedWorkerPool: Failed to restart stuck worker ${i}:`, error);
                }
            }
        }
        
        // Log worker pool health stats
        const stats = getWorkerPoolStats();
        console.log(`IsolatedWorkerPool Health: ${stats.queueLength} queued, ${stats.processingCount} processing, Workers: ${stats.workerCount}`);
        
    }, 10000); // Check every 10 seconds
    
    // Store interval ID for cleanup
    (window as any).__workerHealthMonitor = monitorInterval;
}

// --- Clean Up ---
export function terminateIsolatedWorkerPool() {
    console.log("Terminating IsolatedWorkerPool...");
    
    if (taskProcessingInterval) {
        clearInterval(taskProcessingInterval);
        taskProcessingInterval = null;
    }
    
    // Clear worker health monitor
    if ((window as any).__workerHealthMonitor) {
        clearInterval((window as any).__workerHealthMonitor);
        delete (window as any).__workerHealthMonitor;
    }
    
    workers.forEach((worker, i) => {
        worker.terminate();
        console.log(`IsolatedWorkerPool: Worker ${i} terminated.`);
    });
    
    workers = [];
    nextWorkerIndex = 0;
    resultCallback = null;
    isInitialized = false;
    taskQueue = [];
    processingTasks.clear();
    workerLastTaskTime = [];
    
    console.log("IsolatedWorkerPool Terminated.");
}

// --- Statistics and Diagnostics ---
export function getWorkerPoolStats() {
    // Enhanced statistics with memory usage if available
    const memoryStats: Record<string, number | string> = {};
    
    if (typeof performance !== 'undefined' && (performance as any).memory) {
        const mem = (performance as any).memory;
        if (mem) {
            if (mem.usedJSHeapSize !== undefined) {
                memoryStats.heapUsedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
            }
            if (mem.jsHeapSizeLimit !== undefined) {
                memoryStats.heapLimitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
            }
            if (mem.usedJSHeapSize !== undefined && mem.jsHeapSizeLimit !== undefined) {
                memoryStats.heapUsagePercent = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
            }
        }
    }
    
    // Worker utilization stats
    const nowTime = Date.now();
    const workerUtilization = workerLastTaskTime.map(time => {
        if (time === 0) return 0; // Never used
        const elapsedSec = (nowTime - time) / 1000;
        if (elapsedSec < 0.5) return 100; // Active
        if (elapsedSec < 5) return 50;    // Recently active
        return 0;                         // Idle
    });
    
    // Average worker utilization - fix typings for reduce
    const avgUtilization = workerUtilization.reduce((sum: number, val: number) => sum + val, 0) / workerUtilization.length;
    
    return {
        initialized: isInitialized,
        workerCount: workers.length,
        queueLength: taskQueue.length,
        processingCount: processingTasks.size,
        workerFailures: [...workerFailureCount],
        memoryStats,
        workerUtilization: Math.round(avgUtilization),
        idleWorkers: workerUtilization.filter(u => u === 0).length,
        activeWorkers: workerUtilization.filter(u => u > 0).length
    };
} 