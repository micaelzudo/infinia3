import * as THREE from 'three';
import { CHUNK_SIZE } from '../../constants_debug';
import type { LoadedChunks } from '../../types_debug';
import { getChunkKey } from '../../utils_debug';
import { logThrottled, eventThrottled } from '../../logThrottler';
import { keys, jump, mobileMove } from './controls'; // Import input state

// Movement Constants (Match reference)
const MOVE_SPEED = 0.8;
const JUMP_VELOCITY = 1.5;
const MAX_Y_VELOCITY = 1.5;
const GRAVITY = 0.03;

// Movement State (Match reference)
let yVelocity = 0;
let grounded = false;

// Camera Direction (Use module-level variable, updated from argument)
const _cameraDir = new THREE.Vector3(); 

// Raycasters for Collision (Match reference)
const groundRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(0, -1, 0)
);
const frontRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(1, 0, 0) // Direction set dynamically
);
const backRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(-1, 0, 0) // Direction set dynamically
);
const leftRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(0, 0, 1) // Direction set dynamically
);
const rightRaycaster = new THREE.Raycaster(
    new THREE.Vector3(), 
    new THREE.Vector3(0, 0, -1) // Direction set dynamically
);

// Collision check helper (Match reference)
const checkIntersects = (
    raycaster: THREE.Raycaster,
    mesh: THREE.Mesh, // Use simple Mesh type like reference
    distance: number
) => {
    const intersects = raycaster.intersectObject(mesh);
    // Reference check was intersects.length > 0 first, then distance
    if (intersects.length) {
        if (intersects[0].distance <= distance) {
            return true;
        }
    }
    return false;
};

// Update player position - Reverted logic closer to reference
export function updatePlayerPosition(
    camera: THREE.PerspectiveCamera, 
    cameraDirection: THREE.Vector3, // Use passed direction
    loadedChunks: LoadedChunks,
    isMobile: boolean
) {
    // Get current chunk coordinates (needed for return value and ground mesh)
    const chunkX = Math.floor((camera.position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const chunkZ = Math.floor((camera.position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const currentChunkKey = getChunkKey(chunkX, chunkZ);
    const groundMesh = loadedChunks[currentChunkKey]?.mesh;

    // Use passed camera direction
    _cameraDir.copy(cameraDirection); 

    const normalizedCameraDir = new THREE.Vector2(
        _cameraDir.x,
        _cameraDir.z
    ).normalize();
    let moveX = normalizedCameraDir.x * MOVE_SPEED;
    let moveZ = normalizedCameraDir.y * MOVE_SPEED;

    // Set raycaster origins and directions (Match reference)
    const rayOriginOffset = new THREE.Vector3(0, 10, 0); // Original high offset
    const horizontalRayOrigin = camera.position.clone().add(rayOriginOffset);
    
    frontRaycaster.set(horizontalRayOrigin, new THREE.Vector3(_cameraDir.x, 0, _cameraDir.z).normalize());
    backRaycaster.set(horizontalRayOrigin, new THREE.Vector3(-_cameraDir.x, 0, -_cameraDir.z).normalize());
    // Use simpler perpendicular calculation from reference for strafe
    leftRaycaster.set(horizontalRayOrigin, new THREE.Vector3(-_cameraDir.z, 0, _cameraDir.x).normalize());
    rightRaycaster.set(horizontalRayOrigin, new THREE.Vector3(_cameraDir.z, 0, -_cameraDir.x).normalize());
    // Ground raycaster origin is camera position (Match reference)
    groundRaycaster.set(camera.position, new THREE.Vector3(0, -1, 0));

    // --- Horizontal Movement & Collision (Match reference logic) ---
    if (!isMobile) {
        if (groundMesh) { // Only check collision if ground mesh exists
            const collisionDistance = 3; // Original distance
            const frontIntersects = checkIntersects(frontRaycaster, groundMesh, collisionDistance);
            const backIntersects = checkIntersects(backRaycaster, groundMesh, collisionDistance);
            const leftIntersects = checkIntersects(leftRaycaster, groundMesh, collisionDistance);
            const rightIntersects = checkIntersects(rightRaycaster, groundMesh, collisionDistance);

            if (keys[0]) {
                if (!frontIntersects) {
                    camera.position.x += moveX;
                    camera.position.z += moveZ;
                }
                eventThrottled('move-fwd', 500, "🚶 Move Forward (Ref logic)");
            }
            if (keys[1]) {
                if (!backIntersects) {
                    camera.position.x -= moveX;
                    camera.position.z -= moveZ;
                }
                eventThrottled('move-back', 500, "🚶 Move Backward (Ref logic)");
            }
            if (keys[2]) {
                if (!leftIntersects) {
                    // Use reference strafe calculation
                    camera.position.x += moveZ;
                    camera.position.z -= moveX;
                }
                eventThrottled('strafe-left', 500, "🚶 Strafe Left (Ref logic)");
            }
            if (keys[3]) {
                if (!rightIntersects) {
                    // Use reference strafe calculation
                    camera.position.x -= moveZ;
                    camera.position.z += moveX;
                }
                eventThrottled('strafe-right', 500, "🚶 Strafe Right (Ref logic)");
            }
        } else { 
            // Reference logic: If no ground mesh, still apply movement without collision checks
            if (keys[0]) { camera.position.x += moveX; camera.position.z += moveZ; }
            if (keys[1]) { camera.position.x -= moveX; camera.position.z -= moveZ; }
            if (keys[2]) { camera.position.x += moveZ; camera.position.z -= moveX; }
            if (keys[3]) { camera.position.x -= moveZ; camera.position.z += moveX; }
            logThrottled('no-ground-move', 1000, `🚫 No ground mesh at [${chunkX}, ${chunkZ}], applying movement without collision.`);
        }
    }
    // --- Mobile Movement (Match reference logic) ---
     else { // isMobile
        if (mobileMove.x !== 0 || mobileMove.y !== 0) {
            // Use reference calculation based on acos
            const theta =
                (Math.abs(mobileMove.x) / mobileMove.x) * Math.acos(mobileMove.y);
            const mobileMoveX =
                normalizedCameraDir.x * Math.cos(theta) -
                normalizedCameraDir.y * Math.sin(theta);
            const mobileMoveZ =
                normalizedCameraDir.x * Math.sin(theta) +
                normalizedCameraDir.y * Math.cos(theta);
            // Apply halved speed like reference
            camera.position.x += (mobileMoveX * MOVE_SPEED) / 2;
            camera.position.z += (mobileMoveZ * MOVE_SPEED) / 2;
            eventThrottled('move-mobile', 500, "📱 Mobile Move (Ref logic)");
        }
    }

    // --- Vertical Movement (Gravity & Jump) - Match reference logic ---
    if (jump && grounded) {
        yVelocity = -JUMP_VELOCITY; // Negative Y is up 
        camera.position.y -= yVelocity; // Apply jump immediately
        grounded = false;
        (console as any).event("🤸 Jump Action (Ref logic)");
    } else {
        // try...catch removed as it's generally not good for physics loops
        if (groundMesh) {
            const intersects = groundRaycaster.intersectObject(groundMesh);
            if (intersects.length) {
                const distance = intersects[0].distance;
                const groundCheckDistanceRef = 10; // Original distance
                if (distance <= groundCheckDistanceRef) {
                    camera.position.y += groundCheckDistanceRef - distance; // Snap up
                    yVelocity = 0;
                    grounded = true;
                } else {
                    // Original complex check
                    if (distance - yVelocity < groundCheckDistanceRef) {
                        camera.position.y -= distance - groundCheckDistanceRef; // Snap down partially
                        yVelocity = 0; // Reset velocity here in reference
                        grounded = true;
                    } else {
                        camera.position.y -= yVelocity; // Apply gravity fall
                        grounded = false;
                    }
                    // Apply gravity / clamp fall speed (always done if distance > 10 in ref)
                    if (yVelocity < MAX_Y_VELOCITY) {
                        yVelocity += GRAVITY;
                    } else {
                        yVelocity = MAX_Y_VELOCITY;
                    }
                }
            } else { // No intersection - apply gravity
                 camera.position.y -= yVelocity;
                 grounded = false;
                 if (yVelocity < MAX_Y_VELOCITY) {
                     yVelocity += GRAVITY;
                 } else {
                     yVelocity = MAX_Y_VELOCITY;
                 }
            }
        } else { // No ground mesh case (apply basic gravity like reference, but no safety floor check needed here)
            logThrottled('no-ground-physics', 2000, `🚫 No ground mesh at [${chunkX}, ${chunkZ}] for physics (Ref logic).`);
            camera.position.y -= yVelocity;
            grounded = false;
            if (yVelocity < MAX_Y_VELOCITY) {
                yVelocity += GRAVITY;
            } else {
                yVelocity = MAX_Y_VELOCITY;
            }
        }
    }
    logThrottled('ground-check', 1000, `Ground check (Ref logic): grounded=${grounded}, yVelocity=${yVelocity.toFixed(2)}`);

    // Return current chunk coordinates (required by calling function)
    return { chunkX, chunkZ };
} 