/**
 * Terrain Physics Integration
 * 
 * This file handles the integration between marching cubes terrain chunks and
 * Sketchbook's physics system using CANNON.js.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';
import { TrimeshCollider } from '../../Sketchbook-master/src/ts/physics/colliders/TrimeshCollider';
import { CollisionGroups, configureTerrainCollision } from './sketchbookEnums';
import { SketchbookWorldAdapter } from './sketchbookInterfaces';
import * as Utils from '../../Sketchbook-master/src/ts/core/FunctionLibrary';

/**
 * Add a terrain chunk mesh to the physics world as a TrimeshCollider
 * 
 * @param mesh The terrain chunk THREE.Mesh
 * @param sketchbookAdapter The world adapter to add the physics body to
 * @param customFriction Optional friction value (default: 0.3)
 * @returns The created TrimeshCollider
 */
export function addTerrainChunkToPhysics(
    mesh: THREE.Mesh,
    sketchbookAdapter: SketchbookWorldAdapter,
    customFriction: number = 0.3
): CANNON.Body {
    // Ensure mesh has geometry
    if (!mesh.geometry) {
        console.error('[TerrainPhysics] Cannot add terrain chunk to physics - mesh has no geometry:', mesh);
        return null;
    }

    try {
        // Create a TrimeshCollider using Sketchbook's utility
        const collider = new TrimeshCollider(mesh, {
            mass: 0, // Static body
            position: mesh.position,
            rotation: mesh.quaternion,
            friction: customFriction
        });
        
        // Configure collision filtering
        configureTerrainCollision(collider.body);
        
        // Add to physics world
        (sketchbookAdapter as any).physicsWorld.addBody(collider.body);
        
        // Store reference to body in mesh's userData for later removal
        mesh.userData.physicsBody = collider.body;
        
        console.log(`[TerrainPhysics] Added terrain chunk to physics at position:`, 
            mesh.position.x, mesh.position.y, mesh.position.z);
            
        return collider.body;
    } catch (error) {
        console.error('[TerrainPhysics] Error adding terrain chunk to physics:', error);
        return null;
    }
}

/**
 * Remove a terrain chunk from the physics world
 * 
 * @param mesh The terrain chunk mesh to remove physics for
 * @param sketchbookAdapter The world adapter to remove the physics body from
 */
export function removeTerrainChunkFromPhysics(
    mesh: THREE.Mesh,
    sketchbookAdapter: SketchbookWorldAdapter
): void {
    // Check if mesh has a physics body reference
    if (mesh.userData && mesh.userData.physicsBody) {
        try {
            // Remove body from physics world
            (sketchbookAdapter as any).physicsWorld.removeBody(mesh.userData.physicsBody);
            console.log('[TerrainPhysics] Removed terrain chunk from physics');
            
            // Clear reference
            mesh.userData.physicsBody = null;
        } catch (error) {
            console.error('[TerrainPhysics] Error removing terrain chunk from physics:', error);
        }
    }
}

/**
 * Update a terrain chunk's physics body position and rotation
 * Useful if you need to move terrain chunks
 * 
 * @param mesh The terrain chunk mesh
 */
export function updateTerrainChunkPhysics(mesh: THREE.Mesh): void {
    if (mesh.userData && mesh.userData.physicsBody) {
        const body = mesh.userData.physicsBody as CANNON.Body;
        
        // Update position
        body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        
        // Update rotation
        body.quaternion.set(
            mesh.quaternion.x,
            mesh.quaternion.y,
            mesh.quaternion.z,
            mesh.quaternion.w
        );
        
        // Wake up the body if it was sleeping
        body.wakeUp();
    }
}

/**
 * Create a box-shaped physics body for simple terrain bounds
 * Useful for large flat areas where trimesh would be overkill
 * 
 * @param dimensions Box dimensions (width, height, depth)
 * @param position Position in world space
 * @param rotation Quaternion for rotation
 * @param sketchbookAdapter The world adapter
 * @returns The created physics body
 */
export function createTerrainBoxCollider(
    dimensions: THREE.Vector3,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    sketchbookAdapter: SketchbookWorldAdapter
): CANNON.Body {
    // Create box shape
    const shape = new CANNON.Box(new CANNON.Vec3(
        dimensions.x / 2,
        dimensions.y / 2,
        dimensions.z / 2
    ));
    
    // Create material
    const terrainMaterial = new CANNON.Material('terrainMat');
    terrainMaterial.friction = 0.3;
    
    // Create body
    const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(position.x, position.y, position.z),
        quaternion: new CANNON.Quaternion(
            rotation.x,
            rotation.y,
            rotation.z,
            rotation.w
        ),
        material: terrainMaterial
    });
    
    body.addShape(shape);
    
    // Configure collision
    configureTerrainCollision(body);
    
    // Add to world
    (sketchbookAdapter as any).physicsWorld.addBody(body);
    
    return body;
} 