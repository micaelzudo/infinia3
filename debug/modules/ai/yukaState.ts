import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type SketchbookWorldAdapter from './sketchbookWorldAdapter';

// Shared state for Yuka AI system

// Track initialization state
let isInitialized = false;

// Store the SketchbookWorldAdapter instance
let sketchbookWorldAdapterInstance: SketchbookWorldAdapter | null = null;

export function setInitialized(value: boolean) {
    isInitialized = value;
}

export function getIsInitialized() {
    return isInitialized;
}

export function setSketchbookWorldAdapter(adapter: SketchbookWorldAdapter | null) {
    sketchbookWorldAdapterInstance = adapter;
    return sketchbookWorldAdapterInstance;
}

export function getSketchbookWorldAdapter() {
    return sketchbookWorldAdapterInstance;
}

// Export the instance for backward compatibility
export const sketchbookWorldAdapter = sketchbookWorldAdapterInstance;

export let loadedBoxmanGLTF: GLTF | null = null;

export function setLoadedBoxmanGLTF(gltf: GLTF | null) {
    loadedBoxmanGLTF = gltf;
}
