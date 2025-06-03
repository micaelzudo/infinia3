import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

let modelCache: THREE.Object3D | null = null;

export async function loadBoxmanModel(): Promise<THREE.Object3D> {
    if (modelCache) {
        return modelCache;
    }

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        loader.load(
            '/models/boxman.glb', // Adjust path as needed
            (gltf) => {
                modelCache = gltf.scene;
                resolve(gltf.scene);
            },
            (progress) => {
                console.log('[modelLoader] Loading progress:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('[modelLoader] Error loading model:', error);
                reject(error);
            }
        );
    });
} 