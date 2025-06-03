import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import cannonDebugger from 'cannon-es-debugger';
import { getScene } from './core';

// Physics state
let physicsWorld: CANNON.World | null = null;
let physicsDebugger: { update: () => void } | null = null;
let physicsInitialized = false;

// Physics materials
let groundMaterial: CANNON.Material | null = null;
let characterMaterial: CANNON.Material | null = null;

// Constants
const PHYSICS_TIME_STEP = 1 / 60;

export function initPhysics() {
    if (physicsInitialized) {
        console.warn("Physics already initialized");
        return;
    }

    // Initialize physics world
    physicsWorld = new CANNON.World();
    physicsWorld.gravity.set(0, -9.81, 0);
    physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
    physicsWorld.solver = new CANNON.GSSolver();
    (physicsWorld.solver as CANNON.GSSolver).iterations = 10;
    physicsWorld.allowSleep = true;

    // Initialize materials
    groundMaterial = new CANNON.Material("groundMaterial");
    characterMaterial = new CANNON.Material("characterMaterial");

    // Define contact material properties
    const groundCharacterContactMaterial = new CANNON.ContactMaterial(
        groundMaterial,
        characterMaterial,
        {
            friction: 0.4,
            restitution: 0.0,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3,
        }
    );
    physicsWorld.addContactMaterial(groundCharacterContactMaterial);

    // Initialize debugger
    const scene = getScene();
    if (scene && physicsWorld) {
        physicsDebugger = cannonDebugger(scene, physicsWorld, {
            color: 0x00ff00,
            scale: 1.0,
            onUpdate: () => {},
        });
        console.log("Cannon-es debugger initialized.");
    }

    physicsInitialized = true;
    console.log("Physics World Initialized.");
}

export function cleanupPhysics() {
    if (!physicsInitialized) return;

    if (physicsWorld) {
        // Remove all bodies
        while (physicsWorld.bodies.length > 0) {
            physicsWorld.removeBody(physicsWorld.bodies[0]);
        }
        physicsWorld = null;
    }

    if (physicsDebugger) {
        physicsDebugger = null;
    }

    groundMaterial = null;
    characterMaterial = null;
    physicsInitialized = false;
}

export function updatePhysics() {
    if (!physicsWorld || !physicsInitialized) return;

    // Step the physics world
    physicsWorld.step(PHYSICS_TIME_STEP);

    // Update debugger if enabled
    if (physicsDebugger) {
        physicsDebugger.update();
    }
}

export function createChunkPhysicsBody(chunkData: { 
    mesh: THREE.Mesh | null;
    position: THREE.Vector3;
    size: THREE.Vector3;
}) {
    if (!physicsWorld || !groundMaterial || !chunkData.mesh) return null;

    // Create a box shape for the chunk
    const shape = new CANNON.Box(new CANNON.Vec3(
        chunkData.size.x / 2,
        chunkData.size.y / 2,
        chunkData.size.z / 2
    ));

    // Create the physics body
    const body = new CANNON.Body({
        mass: 0, // Static body
        position: new CANNON.Vec3(
            chunkData.position.x,
            chunkData.position.y,
            chunkData.position.z
        ),
        shape: shape,
        material: groundMaterial
    });

    // Add the body to the world
    physicsWorld.addBody(body);

    return body;
}

export function removeChunkPhysicsBody(body: CANNON.Body | null) {
    if (!physicsWorld || !body) return;
    physicsWorld.removeBody(body);
}

// Getters
export function getPhysicsWorld() { return physicsWorld; }
export function getGroundMaterial() { return groundMaterial; }
export function getCharacterMaterial() { return characterMaterial; }
export function isPhysicsInitialized() { return physicsInitialized; }

// Body management
export function addBody(body: CANNON.Body) {
    if (!physicsWorld) return;
    physicsWorld.addBody(body);
}

export function removeBody(body: CANNON.Body) {
    if (!physicsWorld) return;
    physicsWorld.removeBody(body);
}

// Debug visualization
export function togglePhysicsDebug(visible: boolean) {
    if (!physicsDebugger) return;
    // Note: You might need to implement this based on your debugger's API
    // This is a placeholder for the actual implementation
} 