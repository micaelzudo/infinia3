import * as THREE from 'three';
// import type { TopElementsData } from '../../debug/modules/types/renderingTypes'; // Corrected path
// import { TopElementsData } from '../../debug/modules/types/renderingTypes'; // Use regular import
import type { TopElementsData } from '../debug/modules/types/renderingTypes'; // Changed to import type

// Constants (adjust as needed)
const MAX_SHADER_ELEMENTS = 118; // MUST match the value used in shaders
const DEFAULT_GRID_RESOLUTION = 10; // Spheres per axis
const DEFAULT_GRID_SIZE = 50; // World units extent of the grid cube

// --- Accurate Noise Functions (Mirroring GLSL in materials.ts) ---
const _VS = THREE.Vector3; // Alias for brevity

function hash(p: THREE.Vector3): number {
    p = new _VS(p.x * 0.1031, p.y * 0.1030, p.z * 0.0973);
    p.set(
        p.x - Math.floor(p.x),
        p.y - Math.floor(p.y),
        p.z - Math.floor(p.z)
    ); // fract(p)
    const pDot = p.dot(new _VS(p.y, p.z, p.x).addScalar(19.19));
    p.addScalar(pDot);
    const result = (p.x + p.y) * p.z;
    return result - Math.floor(result); // fract(result)
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

function noise(p: THREE.Vector3): number {
    const i = new _VS(
        Math.floor(p.x),
        Math.floor(p.y),
        Math.floor(p.z)
    );
    const f = new _VS(
        p.x - i.x,
        p.y - i.y,
        p.z - i.z
    );

    // Smoothstep interpolation factor (f = f*f*(3.0-2.0*f))
    f.set(
        f.x * f.x * (3.0 - 2.0 * f.x),
        f.y * f.y * (3.0 - 2.0 * f.y),
        f.z * f.z * (3.0 - 2.0 * f.z)
    );

    // Interpolate along x
    const ix0 = lerp(hash(i.clone().add(new _VS(0, 0, 0))), hash(i.clone().add(new _VS(1, 0, 0))), f.x);
    const ix1 = lerp(hash(i.clone().add(new _VS(0, 1, 0))), hash(i.clone().add(new _VS(1, 1, 0))), f.x);
    const ix2 = lerp(hash(i.clone().add(new _VS(0, 0, 1))), hash(i.clone().add(new _VS(1, 0, 1))), f.x);
    const ix3 = lerp(hash(i.clone().add(new _VS(0, 1, 1))), hash(i.clone().add(new _VS(1, 1, 1))), f.x);

    // Interpolate along y
    const iy0 = lerp(ix0, ix1, f.y);
    const iy1 = lerp(ix2, ix3, f.y);

    // Interpolate along z
    return lerp(iy0, iy1, f.z);
}

function fbm(p: THREE.Vector3, octaves: number, offset: THREE.Vector3): number {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    const tempP = new THREE.Vector3();

    for (let i = 0; i < octaves; ++i) {
        // Calculate (p * frequency + offset) without modifying p
        tempP.copy(p).multiplyScalar(frequency).add(offset);
        value += amplitude * noise(tempP);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
// --- End Accurate Noise Functions ---


// --- Accurate Material Index Selection (Mirroring selectElementIndex in GLSL) ---
export function getMaterialIndexAtPoint_TS(
    worldPos: THREE.Vector3,
    topElements: TopElementsData,
    noiseScale: number,
    planetOffset: THREE.Vector3,
    octaves: number = 4 // Default octaves match shader
): number {

    const scaledPos = worldPos.clone().multiplyScalar(noiseScale);
    let noiseVal = fbm(scaledPos, octaves, planetOffset); // Use accurate fbm

    noiseVal = noiseVal * 0.5 + 0.5; // Map FBM result (-0.5 to 0.5 approx) to 0-1 range
    noiseVal = Math.max(0.0, Math.min(1.0, noiseVal)); // clamp(noiseVal, 0.0, 1.0)

    let cumulativeWeight = 0.0;
    for (let i = 0; i < topElements.weights.length; i++) {
        if (i >= MAX_SHADER_ELEMENTS) break; // Respect shader limits
        if (topElements.weights[i] === 0.0) continue; // Skip zero-weight elements (padding)

        cumulativeWeight += topElements.weights[i];
        if (noiseVal <= cumulativeWeight + 0.001) { // Small tolerance for float errors
            return i;
        }
    }

     // Fallback: find last non-zero weight index within MAX_SHADER_ELEMENTS
    for (let i = Math.min(topElements.weights.length, MAX_SHADER_ELEMENTS) - 1; i >= 0; --i) {
        if (topElements.weights[i] > 0.0) return i;
    }
    return 0; // Ultimate fallback
}
// --- End Accurate Material Index Selection ---



/**
 * Creates an InstancedMesh representing the internal material grid.
 * Uses noise functions identical to the shader for visual consistency.
 *
 * @param topElementsData - Contains material colors and weights. Assumed padded to MAX_SHADER_ELEMENTS.
 * @param noiseScale - Scale factor for the noise function. MUST MATCH SHADER.
 * @param planetOffset - Offset for the noise function. MUST MATCH SHADER.
 * @param gridCenter - The center position of the grid volume.
 * @param gridSize - The total size (width, height, depth) of the grid volume.
 * @param gridResolution - The number of instances along each axis.
 * @returns A THREE.InstancedMesh containing the colored spheres.
 */
export function createInternalMaterialGrid(
    topElementsData: TopElementsData | null,
    noiseScale: number = 0.25, // Default value
    planetOffset: THREE.Vector3 = new THREE.Vector3(), // Default value
    gridCenter: THREE.Vector3 = new THREE.Vector3(),
    gridSize: number = DEFAULT_GRID_SIZE,
    gridResolution: number = DEFAULT_GRID_RESOLUTION
): THREE.InstancedMesh | null {

    if (!topElementsData || topElementsData.colors.length === 0 || topElementsData.weights.length === 0) {
        console.error("Cannot create InternalMaterialGrid: Invalid topElementsData.");
        return null;
    }

     // Ensure data is padded (essential for matching shader expectations)
     // This should ideally happen upstream, but safeguard here.
     const paddedColors = [...topElementsData.colors];
     const paddedWeights = [...topElementsData.weights];
     while (paddedColors.length < MAX_SHADER_ELEMENTS) paddedColors.push(new THREE.Color(0x000000));
     while (paddedWeights.length < MAX_SHADER_ELEMENTS) paddedWeights.push(0.0);
     if(paddedColors.length > MAX_SHADER_ELEMENTS) paddedColors.length = MAX_SHADER_ELEMENTS;
     if(paddedWeights.length > MAX_SHADER_ELEMENTS) paddedWeights.length = MAX_SHADER_ELEMENTS;

     const tempElementsData: TopElementsData = { colors: paddedColors, weights: paddedWeights };


    const count = gridResolution * gridResolution * gridResolution;
    const sphereRadius = (gridSize / gridResolution) * 0.4; // Adjust radius relative to spacing
    const geometry = new THREE.SphereGeometry(sphereRadius, 8, 6); // Low poly spheres
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true, // Use instance colors
        // transparent: true, // Optionally make them slightly transparent
        // opacity: 0.8
    });

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Might not need if static
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); // Might not need if static

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const color = new THREE.Color();
    const halfSize = gridSize / 2;
    const step = gridSize / gridResolution;

    let instanceIndex = 0;
    for (let x = 0; x < gridResolution; x++) {
        for (let y = 0; y < gridResolution; y++) {
            for (let z = 0; z < gridResolution; z++) {
                if (instanceIndex >= count) break; // Should not happen with correct loops

                // Calculate instance position centered around gridCenter
                position.set(
                    gridCenter.x - halfSize + step * (x + 0.5),
                    gridCenter.y - halfSize + step * (y + 0.5),
                    gridCenter.z - halfSize + step * (z + 0.5)
                );
                matrix.setPosition(position);
                mesh.setMatrixAt(instanceIndex, matrix);

                // Determine material index and color for this position using ACCURATE function
                const materialIndex = getMaterialIndexAtPoint_TS(
                    position, 
                    tempElementsData, 
                    noiseScale, // Pass the consistent noiseScale
                    planetOffset // Pass the consistent planetOffset
                    // Octaves default to 4 inside the function
                );
                color.copy(tempElementsData.colors[materialIndex] || new THREE.Color(0xff00ff)); // Fallback color pink

                // <<< ADD LOGGING for first few instances >>>
                if (instanceIndex < 5) { 
                    console.log(`Grid Instance ${instanceIndex}: Pos(${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}), MatIndex: ${materialIndex}, Color: #${color.getHexString()}`);
                }

                mesh.setColorAt(instanceIndex, color);

                instanceIndex++;
            }
        }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
    }

    console.log(`InternalMaterialGrid created with ${instanceIndex} instances using accurate noise.`);
    return mesh;
} 