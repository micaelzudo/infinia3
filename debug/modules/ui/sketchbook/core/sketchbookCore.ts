/**
 * Sketchbook Core Bridge
 * 
 * This file provides core functionality for the Sketchbook system.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon';

// Import our own implementations
import { CharacterManager } from '../entities/characters/core/characterManager';
import { CharacterInputHandler } from '../entities/characters/core/characterInput';
import { CharacterInitializer } from '../entities/characters/core/characterInitializer';
import { createCharacterStates } from '../entities/characters/states/characterStates';

// Re-export our implementations
export {
    CharacterManager,
    CharacterInputHandler,
    CharacterInitializer,
    createCharacterStates
};

// Vector and quaternion conversion utilities
export class VectorConverter {
    static toCannonVec(v: THREE.Vector3): CANNON.Vec3 {
        return new CANNON.Vec3(v.x, v.y, v.z);
    }
    
    static toThreeVec(v: CANNON.Vec3): THREE.Vector3 {
        return new THREE.Vector3(v.x, v.y, v.z);
    }
    
    static toCannonQuat(q: THREE.Quaternion): CANNON.Quaternion {
        return new CANNON.Quaternion(q.x, q.y, q.z, q.w);
    }
    
    static toThreeQuat(q: CANNON.Quaternion): THREE.Quaternion {
        return new THREE.Quaternion(q.x, q.y, q.z, q.w);
    }

    static getAngleBetweenVectors(v1: THREE.Vector3, v2: THREE.Vector3): number {
        return v1.angleTo(v2);
    }

    static getSignedAngleBetweenVectors(v1: THREE.Vector3, v2: THREE.Vector3, normal: THREE.Vector3): number {
        const angle = v1.angleTo(v2);
        const cross = new THREE.Vector3().crossVectors(v1, v2);
        return cross.dot(normal) < 0 ? -angle : angle;
    }

    static readonly UP = new THREE.Vector3(0, 1, 0);
    static readonly RIGHT = new THREE.Vector3(1, 0, 0);
    static readonly FORWARD = new THREE.Vector3(0, 0, 1);
    static readonly BACK = new THREE.Vector3(0, 0, -1);
}