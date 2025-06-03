import { WorkerMeshGenerator } from '../src/workers/WorkerMeshGenerator';

// Initialize the worker mesh generator instance for the debug environment
// You might want to customize the number of workers or batch size here if needed
export const workerMeshGen = new WorkerMeshGenerator();

console.log("Initialized debug worker mesh generator instance."); 