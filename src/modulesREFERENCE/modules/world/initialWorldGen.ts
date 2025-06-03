import * as THREE from 'three';
import type { LoadedChunks, NoiseLayers, Seed } from '../../types_debug';
import type { TopElementsData } from '../types/renderingTypes'; 
import { getChunkKey } from '../../utils_debug';
import { loadNoiseMap } from '../../storageUtils_debug';
import { generateNoiseMap } from '../../noiseMapGenerator_debug';
import { generateMesh as generateMeshVertices } from '../../meshGenerator_debug';
import { createUnifiedPlanetMaterial } from '../rendering/materials';

// Define needed structures for clarity
interface PlanetCompositionInfo {
    dominantElement: string | null;
    topElements: TopElementsData | null;
}

export function generateInitialChunks(
    scene: THREE.Scene,
    loadedChunks: LoadedChunks, // The map to populate
    noiseLayers: NoiseLayers,
    seed: Seed,
    compInfo: PlanetCompositionInfo,
    initialRadius: number = 1 // Generate initial chunks around 0,0 (e.g., radius 1 -> -1 to 1)
) {
    console.log(`Generating initial ${ (initialRadius*2+1)**2 } chunks...`);
    for (let x = -initialRadius; x <= initialRadius; x++) {
        for (let z = -initialRadius; z <= initialRadius; z++) {
            const chunkKey = getChunkKey(x, z);
            console.debug(`Generating initial chunk [${x}, ${z}]...`);
            
            // Try loading first, otherwise generate
            let noiseMap = loadNoiseMap(x, z);
            if (!noiseMap) {
                console.debug(` -> Initial NoiseMap for [${x}, ${z}] not found, generating...`);
                noiseMap = generateNoiseMap(x, 0, z, noiseLayers, seed);
            } else {
                 console.debug(` -> Loaded existing NoiseMap for [${x}, ${z}].`);
            }

            // Generate mesh
            const vertices = generateMeshVertices(x, 0, z, { noiseMap }, true);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();

            // Create material
            const material = createUnifiedPlanetMaterial(compInfo.topElements);
            // TODO: Consider applying wireframe here if needed globally

            // Create mesh and add to scene
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `chunk_${chunkKey}`;
            scene.add(mesh);

            // Store in the main loaded chunks map
            loadedChunks[chunkKey] = { mesh: mesh, noiseMap: noiseMap };
            (console as any).event(`🌱 Generated initial chunk [${x}, ${z}]`);
        }
    }
    console.log("Initial chunk generation complete.");
} 