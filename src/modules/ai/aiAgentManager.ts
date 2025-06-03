import * as THREE from 'three';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { getEntityManager, getTime } from './yukaManager';
import { loadBoxmanModel } from './modelLoader';
import { CHUNK_HEIGHT } from '../core/constants';
import { Character } from '../../debug/modules/ui/REFERENCE/modules/Sketchbook-master/src/ts/characters/Character';
// import { initializeCharacter } from '../../debug/modules/ui/REFERENCE/modules/ui/sketchbookImports'; // Removed redundant import

// Global state
let loadedBoxmanGLTF: THREE.Object3D | null = null;
let sketchbookWorldAdapterInstance: any = null;
let genParams: { noiseLayers: any; seed: number | null } = { noiseLayers: null, seed: null };

// Maps for agent state
const yukaAgentPhysicsStates = new Map<string, {
    yVelocity: number;
    grounded: boolean;
    position: THREE.Vector3;
}>();

const yukaAgentProxyCameras = new Map<string, THREE.PerspectiveCamera>();

// Initialize the model loader
let modelLoadPromise: Promise<THREE.Object3D> | null = null;

async function ensureModelLoaded(): Promise<THREE.Object3D> {
    if (loadedBoxmanGLTF) {
        return loadedBoxmanGLTF;
    }
    
    if (!modelLoadPromise) {
        modelLoadPromise = loadBoxmanModel();
    }
    
    try {
        loadedBoxmanGLTF = await modelLoadPromise;
        return loadedBoxmanGLTF;
    } catch (error) {
        console.error('[aiAgentManager] Failed to load Boxman model:', error);
        throw error;
    }
}

// Initialize the world adapter
export function initializeWorldAdapter(adapter: any) {
    sketchbookWorldAdapterInstance = adapter;
}

// Initialize generation parameters
export function initializeGenParams(params: { noiseLayers: any; seed: number | null }) {
    genParams = params;
}

export async function spawnYukaAgent(position: THREE.Vector3 = new THREE.Vector3(0, CHUNK_HEIGHT / 2 + 2, 0)) {
    const entityManager = getEntityManager();
    const time = getTime();
    
    if (!entityManager || !time || !sketchbookWorldAdapterInstance) {
        console.warn('Yuka system or SketchbookWorldAdapter not initialized. Cannot spawn agent.');
        return null;
    }
    
    try {
        // Ensure model is loaded
        const model = await ensureModelLoaded();
        if (!model) {
            throw new Error('Failed to load model');
        }
        
        if (!genParams.noiseLayers || genParams.seed === null) {
            console.warn('Generation parameters missing. Cannot spawn agent with terrain interaction.');
            // Continue anyway, but the agent might float
        }
        
        // Create Sketchbook character, passing the model to the constructor
        const sketchbookCharacter = new Character(model);
        
        // Ensure sketchbookCharacter is valid and has a position before proceeding
        if (!sketchbookCharacter || !sketchbookCharacter.position) {
             console.error('[aiAgentManager] Failed to create Sketchbook character or position is undefined.', sketchbookCharacter);
             throw new Error('Sketchbook character creation failed or position is undefined.');
        }

        // Set initial position
        sketchbookCharacter.position.set(position.x, position.y, position.z);
        
        // Add to world
        if (sketchbookWorldAdapterInstance) {
            sketchbookWorldAdapterInstance.add(sketchbookCharacter);
        }

        // Disable frustum culling
        sketchbookCharacter.frustumCulled = false;
        sketchbookCharacter.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) child.frustumCulled = false;
        });

        // Create Yuka AI character wrapper
        const agentName = `yuka-agent-${Date.now().toString(36)}`;
        
        // Create the character with proper position initialization
        const newCharacter = new IsolatedYukaCharacter(sketchbookCharacter);
        
        if (!newCharacter) {
            throw new Error('Failed to create Yuka character');
        }

        // Initialize physics state for this agent
        const physicsState = {
            yVelocity: 0,
            grounded: false,
            position: new THREE.Vector3(position.x, position.y, position.z)
        };
        yukaAgentPhysicsStates.set(newCharacter.uuid, physicsState);
        
        // Initialize camera proxy for this agent
        const proxyCamera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
        proxyCamera.position.set(position.x, position.y, position.z);
        yukaAgentProxyCameras.set(newCharacter.uuid, proxyCamera);

        console.log('New IsolatedYukaCharacter spawned at:', position);

        // Set AI control
        newCharacter.setAIControlled(true);

        return newCharacter;
    } catch (err) {
        console.error('[aiAgentManager] Error during Sketchbook character agent spawn:', err);
        return null;
    }
} 