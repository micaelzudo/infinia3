import * as THREE from 'three';

// Define a type that represents materials with texture properties
type MaterialWithTextures = THREE.Material & {
    map?: THREE.Texture;
    normalMap?: THREE.Texture;
    roughnessMap?: THREE.Texture;
    metalnessMap?: THREE.Texture;
    aoMap?: THREE.Texture;
    emissiveMap?: THREE.Texture;
    needsUpdate: boolean;
};

/**
 * Loads a texture and applies it to the specified material
 * @param material The THREE.Material to apply the texture to
 * @param texturePath Path to the texture file
 * @param mapType The type of map (e.g., 'map', 'normalMap', etc.)
 * @returns Promise that resolves when the texture is loaded
 */
export function loadAndApplyTexture(
    material: MaterialWithTextures, 
    texturePath: string, 
    mapType: 'map' | 'normalMap' | 'roughnessMap' | 'metalnessMap' | 'aoMap' | 'emissiveMap' = 'map'
): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            texturePath,
            (texture) => {
                // Apply the texture to the appropriate map of the material
                material[mapType] = texture;
                material.needsUpdate = true;
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading texture:', error);
                reject(error);
            }
        );
    });
}

/**
 * Loads a texture asynchronously
 * @param texturePath Path to the texture file
 * @returns Promise that resolves with the loaded texture
 */
export function loadTexture(texturePath: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        
        textureLoader.load(
            texturePath,
            (texture) => {
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading texture:', error);
                reject(error);
            }
        );
    });
} 