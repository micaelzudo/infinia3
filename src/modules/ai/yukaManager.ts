import * as THREE from 'three';
import * as YUKA from 'yuka';
import { on as onEvent, emit as emitEvent, eventBus } from './eventBus';

let isYukaSystemPaused: boolean = false;
let time: YUKA.Time | null = null;
let entityManager: YUKA.EntityManager | null = null;
let navMesh: YUKA.NavMesh | null = null;
let navMeshGenerator: YUKA.NavMeshGenerator | null = null;
let systemInitialized: boolean = false;
let debugMode: boolean = false;

// System configuration
const config = {
    updateRate: 60, // Updates per second
    maxAgents: 100,
    navMeshSettings: {
        cellSize: 0.3,
        cellHeight: 0.2,
        walkableSlopeAngle: 45,
        walkableHeight: 2.0,
        walkableRadius: 0.6,
        walkableClimb: 0.9,
        minRegionArea: 8,
        mergeRegionArea: 20,
        maxEdgeLen: 12,
        maxSimplificationError: 1.3,
        maxVertsPerPoly: 6,
        detailSampleDist: 6,
        detailSampleMaxError: 1
    }
};

export function initializeYukaSystem(): void {
    if (systemInitialized) {
        console.warn('[yukaManager] YUKA system already initialized');
        return;
    }

    try {
        time = new YUKA.Time();
        entityManager = new YUKA.EntityManager();
        navMeshGenerator = new YUKA.NavMeshGenerator();
        
        // Configure time
        time.setFixedTimeStep(1 / config.updateRate);
        
        systemInitialized = true;
        console.log('[yukaManager] YUKA system initialized successfully');
        eventBus.emit('yukaSystemInitialized');
    } catch (error) {
        console.error('[yukaManager] Failed to initialize YUKA system:', error);
        throw error;
    }
}

export function updateYukaSystem(deltaTime: number): void {
    if (!systemInitialized || !time || !entityManager) {
        console.warn('[yukaManager] YUKA system not initialized');
        return;
    }

    if (!isYukaSystemPaused) {
        try {
            time.update();
            entityManager.update(deltaTime);
            eventBus.emit('yukaSystemUpdated', { deltaTime });
        } catch (error) {
            console.error('[yukaManager] Error during YUKA system update:', error);
        }
    }
}

export function setIsYukaSystemPaused(paused: boolean): void {
    isYukaSystemPaused = paused;
    eventBus.emit('yukaSystemPauseStateChanged', paused);
}

export function getIsYukaSystemPaused(): boolean {
    return isYukaSystemPaused;
}

export function getEntityManager(): YUKA.EntityManager | null {
    return entityManager;
}

export function getTime(): YUKA.Time | null {
    return time;
}

export function getNavMesh(): YUKA.NavMesh | null {
    return navMesh;
}

export function setNavMesh(newNavMesh: YUKA.NavMesh): void {
    navMesh = newNavMesh;
    eventBus.emit('navMeshUpdated', navMesh);
}

export function generateNavMesh(geometry: THREE.BufferGeometry): YUKA.NavMesh | null {
    if (!navMeshGenerator) {
        throw new Error('NavMeshGenerator not initialized');
    }

    try {
        // Apply navmesh settings
        Object.entries(config.navMeshSettings).forEach(([key, value]) => {
            if (key in navMeshGenerator) {
                (navMeshGenerator as any)[key] = value;
            }
        });

        navMesh = navMeshGenerator.fromGeometry(geometry);
        eventBus.emit('navMeshGenerated', navMesh);
        return navMesh;
    } catch (error) {
        console.error('[yukaManager] Failed to generate navmesh:', error);
        return null;
    }
}

export function findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] | null {
    if (!navMesh) return null;
    
    try {
        const yukaStart = new YUKA.Vector3(start.x, start.y, start.z);
        const yukaEnd = new YUKA.Vector3(end.x, end.y, end.z);
        const path = navMesh.findPath(yukaStart, yukaEnd);
        
        if (!path || path.length === 0) {
            console.warn('[yukaManager] No path found between points');
            return null;
        }

        return path.map(p => new THREE.Vector3(p.x, p.y, p.z));
    } catch (error) {
        console.error('[yukaManager] Error finding path:', error);
        return null;
    }
}

export function getClosestNavMeshPoint(point: THREE.Vector3): THREE.Vector3 | null {
    if (!navMesh) return null;
    
    try {
        const yukaPoint = new YUKA.Vector3(point.x, point.y, point.z);
        const closest = navMesh.getClosestPoint(yukaPoint);
        return new THREE.Vector3(closest.x, closest.y, closest.z);
    } catch (error) {
        console.error('[yukaManager] Error getting closest navmesh point:', error);
        return null;
    }
}

export function isPointOnNavMesh(point: THREE.Vector3): boolean {
    if (!navMesh) return false;
    
    try {
        const yukaPoint = new YUKA.Vector3(point.x, point.y, point.z);
        return navMesh.isPointOnNavMesh(yukaPoint);
    } catch (error) {
        console.error('[yukaManager] Error checking point on navmesh:', error);
        return false;
    }
}

export function getRandomNavMeshPoint(): THREE.Vector3 | null {
    if (!navMesh) return null;
    
    try {
        const point = navMesh.getRandomPoint();
        return new THREE.Vector3(point.x, point.y, point.z);
    } catch (error) {
        console.error('[yukaManager] Error getting random navmesh point:', error);
        return null;
    }
}

export function setDebugMode(enabled: boolean): void {
    debugMode = enabled;
    eventBus.emit('yukaDebugModeChanged', enabled);
}

export function isDebugMode(): boolean {
    return debugMode;
}

export function getSystemConfig(): typeof config {
    return { ...config };
}

export function dispose(): void {
    isYukaSystemPaused = false;
    systemInitialized = false;
    debugMode = false;
    time = null;
    entityManager = null;
    navMesh = null;
    navMeshGenerator = null;
    eventBus.emit('yukaSystemDisposed');
} 