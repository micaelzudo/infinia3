import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { appendToCustomLog } from './customLogger';
import { getChunkKeyY } from '../../utils_debug';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionGroups } from '../../Sketchbook-master/src/ts/enums/CollisionGroups';
import type { ChunkMeshesRef } from './playerMovement';

// These will need to be passed in or managed by the caller:
// - sketchbookAdapterInstance
// - sceneRef
// - characterRef
// - currentChunkPhysicsDebugMesh
// - characterPhysicsDebugMeshes
// - etc.

export function addPhysicsToChunks(chunkMeshes: ChunkMeshesRef, materials: { [key: string]: CANNON.Material }, sketchbookAdapterInstance: any) {
    if (!chunkMeshes || !sketchbookAdapterInstance || !sketchbookAdapterInstance.physicsWorld) {
        appendToCustomLog("[TP Physics] Cannot add physics - missing chunks, adapter, or physics world", 'error', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
        return;
    }
    appendToCustomLog("[TP Physics] Adding physics to chunks...", 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
    let chunksWithPhysics: string[] = [];
    let trimeshSuccessCount = 0;
    let boxFallbackCount = 0;
    const terrainCollisionGroup = CollisionGroups.Default;
    const terrainCollisionMask = CollisionGroups.Characters | CollisionGroups.Default;
    appendToCustomLog(`[TP Physics] Setting terrain to Group: ${terrainCollisionGroup}, Mask: ${terrainCollisionMask}`, 'info', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
    for (const chunkKey in chunkMeshes) {
        const mesh = chunkMeshes[chunkKey];
        if (!mesh || !mesh.geometry) {
            appendToCustomLog(`[TP Physics] Skipping chunk ${chunkKey} - mesh or geometry is null/undefined.`, 'warn', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
            continue;
        }
        const [cxStr, cyStr, czStr] = chunkKey.split(',');
        const cx = parseInt(cxStr);
        const cy = parseInt(cyStr);
        const cz = parseInt(czStr);
        const isTargetSpawnChunk = cx === 0 && cz === 0;
        if (isTargetSpawnChunk) {
            appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Processing chunk under/near spawn. Mesh position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
        }
        try {
            let physicsGeometry = mesh.geometry.clone();
            physicsGeometry = BufferGeometryUtils.mergeVertices(physicsGeometry);
            const vertices = physicsGeometry.attributes.position.array;
            const indices = physicsGeometry.index ? physicsGeometry.index.array : null;
            if (indices && indices.length > 0) {
                appendToCustomLog(`[TP Physics] Chunk ${chunkKey} has an index buffer after mergeVertices. Vertices: ${vertices.length / 3}, Indices: ${indices.length / 3} tris`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                const trimeshShape = new CANNON.Trimesh(vertices as unknown as number[], indices as unknown as number[]);
                const body = new CANNON.Body({
                    mass: 0,
                    material: materials.terrain,
                    shape: trimeshShape,
                    collisionFilterGroup: terrainCollisionGroup,
                    collisionFilterMask: terrainCollisionMask
                });
                body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
                if (isTargetSpawnChunk) {
                    const trimeshVertices = vertices as unknown as number[];
                    let minX = Infinity, minY = Infinity, minZ = Infinity;
                    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
                    for (let i = 0; i < trimeshVertices.length; i += 3) {
                        minX = Math.min(minX, trimeshVertices[i]);
                        maxX = Math.max(maxX, trimeshVertices[i]);
                        minY = Math.min(minY, trimeshVertices[i+1]);
                        maxY = Math.max(maxY, trimeshVertices[i+1]);
                        minZ = Math.min(minZ, trimeshVertices[i+2]);
                        maxZ = Math.max(maxZ, trimeshVertices[i+2]);
                    }
                    appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Trimesh created. Local Vertices BBox: Y_min=${minY.toFixed(2)}, Y_max=${maxY.toFixed(2)}. Body Global Pos Y: ${body.position.y.toFixed(2)}. Expected Ground at Y approx ${body.position.y + maxY}`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                }
                appendToCustomLog(`[TP Physics] Trimesh body for ${chunkKey} created at Y: ${body.position.y.toFixed(2)}. Group: ${body.collisionFilterGroup}, Mask: ${body.collisionFilterMask}`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                sketchbookAdapterInstance.physicsWorld.addBody(body);
                (mesh as any).physicsBody = body;
                chunksWithPhysics.push(chunkKey);
                trimeshSuccessCount++;
            } else {
                appendToCustomLog(`[TP Physics] Chunk ${chunkKey} still has no index buffer (or empty) after mergeVertices - creating simple collision box instead`, 'warn', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                boxFallbackCount++;
                mesh.geometry.computeBoundingBox();
                const boundingBox = mesh.geometry.boundingBox;
                if (!boundingBox) {
                    appendToCustomLog(`[TP Physics] Cannot create fallback collision for chunk ${chunkKey} - no bounding box on original geometry`, 'warn', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                    continue;
                }
                const size = new THREE.Vector3();
                boundingBox.getSize(size);
                const boxShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
                const body = new CANNON.Body({
                    mass: 0,
                    material: materials.terrain,
                    shape: boxShape,
                    collisionFilterGroup: terrainCollisionGroup,
                    collisionFilterMask: terrainCollisionMask
                });
                const center = new THREE.Vector3();
                boundingBox.getCenter(center);
                body.position.set(
                    mesh.position.x + center.x,
                    mesh.position.y + center.y,
                    mesh.position.z + center.z
                );
                if (isTargetSpawnChunk) {
                    appendToCustomLog(`[TP Physics - Target Chunk ${chunkKey}] Box fallback created. BBox MinY: ${boundingBox.min.y.toFixed(2)}, MaxY: ${boundingBox.max.y.toFixed(2)}. Body Global Pos Y: ${body.position.y.toFixed(2)}. Expected Ground at Y approx ${body.position.y + boundingBox.max.y}`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                }
                appendToCustomLog(`[TP Physics] Box fallback body for ${chunkKey} created at Y: ${body.position.y.toFixed(2)}. Group: ${body.collisionFilterGroup}, Mask: ${body.collisionFilterMask}`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
                sketchbookAdapterInstance.physicsWorld.addBody(body);
                (mesh as any).physicsBody = body;
                chunksWithPhysics.push(chunkKey);
            }
        } catch (error) {
            appendToCustomLog(`[TP Physics] Error adding physics to chunk ${chunkKey}: ` + (error as Error).message, 'error', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
        }
    }
    appendToCustomLog(`[TP Physics] Added physics to ${chunksWithPhysics.length} chunks. Trimesh: ${trimeshSuccessCount}, Box Fallback: ${boxFallbackCount}`, 'log', undefined, undefined, undefined, 'normal', 'physicsUtils.ts');
}

export function updateChunkPhysicsDebugVisualization(chunkX: number, chunkY: number, chunkZ: number, sceneRef: THREE.Scene, tpChunkMeshes: ChunkMeshesRef, currentChunkPhysicsDebugMeshRef: { current: THREE.Mesh | null }): void {
    if (!sceneRef) return;
    let currentChunkPhysicsDebugMesh = currentChunkPhysicsDebugMeshRef.current;
    if (currentChunkPhysicsDebugMesh) {
        if (currentChunkPhysicsDebugMesh.parent && sceneRef) {
            sceneRef.remove(currentChunkPhysicsDebugMesh);
        }
        currentChunkPhysicsDebugMesh.geometry.dispose();
        if (Array.isArray(currentChunkPhysicsDebugMesh.material)) {
            currentChunkPhysicsDebugMesh.material.forEach(m => m.dispose());
        } else {
            (currentChunkPhysicsDebugMesh.material as THREE.Material).dispose();
        }
        currentChunkPhysicsDebugMesh = null;
        currentChunkPhysicsDebugMeshRef.current = null;
    }
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
    const visualChunkMesh = tpChunkMeshes[chunkKey];
    if (!visualChunkMesh || !(visualChunkMesh as any).physicsBody) {
        return;
    }
    const physicsBody = (visualChunkMesh as any).physicsBody as CANNON.Body;
    if (!physicsBody.shapes.length || !(physicsBody.shapes[0] instanceof CANNON.Trimesh)) {
        appendToCustomLog(`[PhysicsDebugViz] Physics body for chunk ${chunkKey} has no shapes or is not a Trimesh. Shape type: ${physicsBody.shapes[0]?.constructor?.name}`, 'warn', `PhysViz_NotTrimesh_${chunkKey}`, 5000, undefined, 'normal', 'physicsUtils.ts');
        return;
    }
    const trimeshShape = physicsBody.shapes[0] as CANNON.Trimesh;
    const vertices = trimeshShape.vertices;
    const indices = trimeshShape.indices;
    if (!vertices || vertices.length === 0 || !indices || indices.length === 0) {
        appendToCustomLog(`[PhysicsDebugViz] Trimesh for chunk ${chunkKey} has no vertices or indices.`, 'warn', `PhysViz_NoGeomData_${chunkKey}`, 5000, undefined, 'normal', 'physicsUtils.ts');
        return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    const material = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        depthTest: false
    });
    currentChunkPhysicsDebugMesh = new THREE.Mesh(geometry, material);
    currentChunkPhysicsDebugMesh.position.copy(physicsBody.position as any);
    currentChunkPhysicsDebugMesh.quaternion.copy(physicsBody.quaternion as any);
    currentChunkPhysicsDebugMesh.renderOrder = 1000;
    sceneRef.add(currentChunkPhysicsDebugMesh);
    currentChunkPhysicsDebugMeshRef.current = currentChunkPhysicsDebugMesh;
    appendToCustomLog(`[PhysicsDebugViz] Added terrain physics debug mesh for chunk ${chunkKey}`, 'log', `PhysViz_AddTerrain_${chunkKey}`, 5000, undefined, 'normal', 'physicsUtils.ts');
}

export function updateCharacterPhysicsDebugVisualization(sceneRef: THREE.Scene, characterRef: any, characterPhysicsDebugMeshesRef: { current: THREE.Mesh[] }): void {
    if (!sceneRef || !characterRef || !characterRef.characterCapsule || !characterRef.characterCapsule.body) {
        if (characterPhysicsDebugMeshesRef.current.length > 0) {
            characterPhysicsDebugMeshesRef.current.forEach(mesh => {
                if (mesh.parent && sceneRef) sceneRef.remove(mesh);
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    (mesh.material as THREE.Material).dispose();
                }
            });
            characterPhysicsDebugMeshesRef.current = [];
        }
        return;
    }
    const physicsBody = characterRef.characterCapsule.body as CANNON.Body;
    const charIdForLog = characterRef.debugId || 'char_unknown';
    appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Update called. Body has ${physicsBody.shapes.length} shapes. Meshes: ${characterPhysicsDebugMeshesRef.current.length}.`, 'log', `PhysVizChar_Update_${charIdForLog}`, 2000, undefined, 'normal', 'physicsUtils.ts');
    if (characterPhysicsDebugMeshesRef.current.length !== physicsBody.shapes.length) {
        appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Shape count mismatch (body: ${physicsBody.shapes.length}, viz: ${characterPhysicsDebugMeshesRef.current.length}). Recreating viz meshes.`, 'warn', `PhysVizChar_Recreate_${charIdForLog}`, 0, undefined, 'critical', 'physicsUtils.ts');
        characterPhysicsDebugMeshesRef.current.forEach(mesh => {
            if (mesh.parent && sceneRef) sceneRef.remove(mesh);
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else {
                (mesh.material as THREE.Material).dispose();
            }
        });
        characterPhysicsDebugMeshesRef.current = [];
        physicsBody.shapes.forEach((shape, index) => {
            let debugMesh: THREE.Mesh | null = null;
            const material = new THREE.MeshBasicMaterial({
                color: 0xff00ff,
                wireframe: true,
                transparent: true,
                opacity: 0.5,
                depthTest: false
            });
            let shapeType = 'Unknown';
            let shapeParams = '{}';
            if (shape instanceof CANNON.Sphere) {
                shapeType = 'Sphere';
                const sphereShape = shape as CANNON.Sphere;
                shapeParams = `radius: ${sphereShape.radius.toFixed(3)}`;
                const geometry = new THREE.SphereGeometry(sphereShape.radius, 16, 16);
                debugMesh = new THREE.Mesh(geometry, material);
            } else if (shape instanceof CANNON.Box) {
                shapeType = 'Box';
                const boxShape = shape as CANNON.Box;
                shapeParams = `halfExtents: (${boxShape.halfExtents.x.toFixed(3)}, ${boxShape.halfExtents.y.toFixed(3)}, ${boxShape.halfExtents.z.toFixed(3)})`;
                const geometry = new THREE.BoxGeometry(boxShape.halfExtents.x*2, boxShape.halfExtents.y*2, boxShape.halfExtents.z*2);
                debugMesh = new THREE.Mesh(geometry, material);
            } else {
                shapeType = shape.constructor.name;
            }
            appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Shape ${index}: Type=${shapeType}, Params=${shapeParams}`, 'log', `PhysVizChar_ShapeInfo_${charIdForLog}_${index}`, 5000, undefined, 'normal', 'physicsUtils.ts');
            if (debugMesh) {
                debugMesh.renderOrder = 1001;
                if (sceneRef) sceneRef.add(debugMesh);
                characterPhysicsDebugMeshesRef.current.push(debugMesh);
            } else {
                appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Could not create debug mesh for shape ${index} (Type: ${shapeType})`, 'warn', `PhysVizChar_NoMesh_${charIdForLog}_${index}`, 5000, undefined, 'critical', 'physicsUtils.ts');
            }
        });
        if (characterPhysicsDebugMeshesRef.current.length > 0) {
            appendToCustomLog(`[PhysVizChar ID: ${charIdForLog}] Created ${characterPhysicsDebugMeshesRef.current.length} character physics debug meshes.`, 'log', `PhysVizChar_Created_${charIdForLog}`, 0, undefined, 'critical', 'physicsUtils.ts');
        }
    }
    characterPhysicsDebugMeshesRef.current.forEach((debugMesh, i) => {
        if (i < physicsBody.shapes.length) {
            const shapeOffset = physicsBody.shapeOffsets[i];
            const shapeOrientation = physicsBody.shapeOrientations[i];
            const threeShapeOffset = new THREE.Vector3(shapeOffset.x, shapeOffset.y, shapeOffset.z);
            const threeShapeOrientation = new THREE.Quaternion(shapeOrientation.x, shapeOrientation.y, shapeOrientation.z, shapeOrientation.w);
            const threeBodyPosition = new THREE.Vector3(physicsBody.position.x, physicsBody.position.y, physicsBody.position.z);
            const threeBodyQuaternion = new THREE.Quaternion(physicsBody.quaternion.x, physicsBody.quaternion.y, physicsBody.quaternion.z, physicsBody.quaternion.w);
            const worldOffset = threeShapeOffset.clone().applyQuaternion(threeBodyQuaternion);
            debugMesh.position.copy(threeBodyPosition).add(worldOffset);
            debugMesh.quaternion.copy(threeBodyQuaternion).multiply(threeShapeOrientation);
            if (i === 0 && Math.random() < 0.05) {
                 appendToCustomLog(
                    `[PhysVizChar ID: ${charIdForLog}] Shape ${i} Viz: ` +
                    `BodyPos: (${threeBodyPosition.x.toFixed(2)}, ${threeBodyPosition.y.toFixed(2)}, ${threeBodyPosition.z.toFixed(2)}), ` +
                    `ShapeOffsetLocal: (${threeShapeOffset.x.toFixed(2)}, ${threeShapeOffset.y.toFixed(2)}, ${threeShapeOffset.z.toFixed(2)}), ` +
                    `DebugMeshPos: (${debugMesh.position.x.toFixed(2)}, ${debugMesh.position.y.toFixed(2)}, ${debugMesh.position.z.toFixed(2)})`,
                    'log', 
                    `PhysVizChar_DebugPos_${charIdForLog}_${i}`,
                    2000, // throttleMs
                    undefined, 'normal', 'physicsUtils.ts'
                );
            }
        }
    });
} 