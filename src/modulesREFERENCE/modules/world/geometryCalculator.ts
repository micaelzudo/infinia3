import * as THREE from 'three'; // Still needed for Vector types? Maybe not. Let's remove THREE dependency.
import { NoiseMap } from '../../types_debug';
import { edgeCorners, edges, table } from "../../triangulation_debug"; // Assuming triangulation data is accessible
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug'; // Needed? Only for world origin offset maybe.

// --- Constants ---
const SURFACE_LEVEL = 0; // Assuming this is constant

// --- Helper Types ---
interface GeometryData {
    positions: Float32Array;
    normals: Float32Array;
    // Optional: indices?: Uint32Array | Uint16Array;
}

/**
 * Calculates vertex positions and normals for a chunk based on a noise map.
 * Does NOT create THREE.js objects. Designed to be worker-friendly.
 * NOTE: This implementation does basic triangle calculation and duplicates vertices.
 * It does NOT perform vertex merging/indexing like mergeVertices.
 * Normals are calculated per-triangle and assigned to vertices; they won't be smooth.
 */
export function calculateGeometryData(
    chunkX: number,
    chunkY: number, // Usually 0
    chunkZ: number,
    noiseMap: NoiseMap, // Expects PADDED noise map
    padding: number,
    interpolate: boolean,
    resolutionFactor: number = 1
): GeometryData {

    const calculatedPositions: number[] = [];
    const calculatedNormals: number[] = [];

    resolutionFactor = Math.max(1, Math.floor(resolutionFactor));
    const step = resolutionFactor;

    const sizeY = noiseMap.length - 1; // Dimensions from the noise map itself
    const sizeZ = noiseMap[0]?.length -1; // Remove ?? 0
    const sizeX = noiseMap[0]?.[0]?.length -1; // Remove ?? 0

    // Check for potential undefined lengths if noiseMap structure is unexpected
    if (sizeX === undefined || sizeX < 0 || sizeY < 0 || sizeZ === undefined || sizeZ < 0) {
        console.warn(`calculateGeometryData received invalid noise map dimensions for chunk [${chunkX},${chunkZ}]`);
        return { positions: new Float32Array(0), normals: new Float32Array(0) };
    }

    // Calculate the origin offset based on chunk coords and padding
    // This assumes the noise map *includes* padding.
    // const chunkWorldOriginX = chunkX * CHUNK_SIZE;
    // const chunkWorldOriginY = chunkY * CHUNK_HEIGHT;
    // const chunkWorldOriginZ = chunkZ * CHUNK_SIZE;
    
    // Corrected origin calculation? Assume chunk (0,0) starts near world origin (0,0,0)
    // The corner of the *padded* data needs to align with the world-space corner.
    const paddedWorldOriginX = chunkX * CHUNK_SIZE - padding;
    const paddedWorldOriginY = chunkY * CHUNK_HEIGHT - padding;
    const paddedWorldOriginZ = chunkZ * CHUNK_SIZE - padding;


    let y = 0;
    while (y < sizeY) {
        let z = 0;
        while (z < sizeZ) {
            let x = 0;
            while (x < sizeX) {
                const x0 = x, x1 = x + step;
                const y0 = y, y1 = y + step;
                const z0 = z, z1 = z + step;

                // Boundary check based on the actual noise map dimensions
                if (x1 >= sizeX + 1 || y1 >= sizeY + 1 || z1 >= sizeZ + 1) {
                     x += step; // Skip incomplete cubes at the boundary
                     continue;
                 }

                let cubeIndex = 0;
                let cornerNoises: number[] = [];
                try {
                    cornerNoises = [
                        noiseMap[y0][z0][x0], noiseMap[y0][z0][x1],
                        noiseMap[y0][z1][x1], noiseMap[y0][z1][x0],
                        noiseMap[y1][z0][x0], noiseMap[y1][z0][x1],
                        noiseMap[y1][z1][x1], noiseMap[y1][z1][x0],
                    ];
                } catch (e) {
                    console.error(`Noise map indexing error at [${x},${y},${z}] step ${step}`, e);
                    console.log(`Indices: y0=${y0},y1=${y1}, z0=${z0},z1=${z1}, x0=${x0},x1=${x1}`);
                    x += step;
                    continue;
                }

                for (let n = 0; n < cornerNoises.length; n++) {
                    if (cornerNoises[n] < SURFACE_LEVEL) {
                        cubeIndex += 1 << n;
                    }
                }

                if (cubeIndex !== 0 && cubeIndex !== 255) {
                    const tableEdges = table[cubeIndex];
                    let e = 0;
                    while (e < tableEdges.length) {
                        let vertexOffsets = new Float32Array(9); // x1,y1,z1, x2,y2,z2, x3,y3,z3 relative to cube corner (0,0,0) to (step,step,step)

                        const edge1 = edges[tableEdges[e]];
                        const edge2 = edges[tableEdges[e + 1]];
                        const edge3 = edges[tableEdges[e + 2]];

                        if (interpolate) {
                             const edgeCorners1 = edgeCorners[tableEdges[e]];
                             const edgeCorners2 = edgeCorners[tableEdges[e + 1]];
                             const edgeCorners3 = edgeCorners[tableEdges[e + 2]];

                            // Clamp interpolation values between 0 and 1
                             let edgeInterpolate1 = Math.max(0.0, Math.min(1.0,
                                 Math.abs(cornerNoises[edgeCorners1[0]] - SURFACE_LEVEL) /
                                 Math.abs(cornerNoises[edgeCorners1[1]] - cornerNoises[edgeCorners1[0]])
                             ));
                             let edgeInterpolate2 = Math.max(0.0, Math.min(1.0,
                                 Math.abs(cornerNoises[edgeCorners2[0]] - SURFACE_LEVEL) /
                                 Math.abs(cornerNoises[edgeCorners2[1]] - cornerNoises[edgeCorners2[0]])
                             ));
                             let edgeInterpolate3 = Math.max(0.0, Math.min(1.0,
                                 Math.abs(cornerNoises[edgeCorners3[0]] - SURFACE_LEVEL) /
                                 Math.abs(cornerNoises[edgeCorners3[1]] - cornerNoises[edgeCorners3[0]])
                             ));

                            // Handle potential division by zero if corner noises are identical
                             if (isNaN(edgeInterpolate1)) edgeInterpolate1 = 0.5;
                             if (isNaN(edgeInterpolate2)) edgeInterpolate2 = 0.5;
                             if (isNaN(edgeInterpolate3)) edgeInterpolate3 = 0.5;

                            vertexOffsets = new Float32Array([
                                (edge1[0] === 0.5 ? edgeInterpolate1 : edge1[0]) * step,
                                (edge1[1] === 0.5 ? edgeInterpolate1 : edge1[1]) * step,
                                (edge1[2] === 0.5 ? edgeInterpolate1 : edge1[2]) * step,
                                (edge2[0] === 0.5 ? edgeInterpolate2 : edge2[0]) * step,
                                (edge2[1] === 0.5 ? edgeInterpolate2 : edge2[1]) * step,
                                (edge2[2] === 0.5 ? edgeInterpolate2 : edge2[2]) * step,
                                (edge3[0] === 0.5 ? edgeInterpolate3 : edge3[0]) * step,
                                (edge3[1] === 0.5 ? edgeInterpolate3 : edge3[1]) * step,
                                (edge3[2] === 0.5 ? edgeInterpolate3 : edge3[2]) * step,
                            ]);
                        } else {
                            vertexOffsets = new Float32Array([
                                edge1[0] * step, edge1[1] * step, edge1[2] * step,
                                edge2[0] * step, edge2[1] * step, edge2[2] * step,
                                edge3[0] * step, edge3[1] * step, edge3[2] * step,
                            ]);
                        }

                        // Calculate absolute world positions for the triangle vertices
                        const p1x = vertexOffsets[0] + x + paddedWorldOriginX;
                        const p1y = vertexOffsets[1] + y + paddedWorldOriginY;
                        const p1z = vertexOffsets[2] + z + paddedWorldOriginZ;
                        const p2x = vertexOffsets[3] + x + paddedWorldOriginX;
                        const p2y = vertexOffsets[4] + y + paddedWorldOriginY;
                        const p2z = vertexOffsets[5] + z + paddedWorldOriginZ;
                        const p3x = vertexOffsets[6] + x + paddedWorldOriginX;
                        const p3y = vertexOffsets[7] + y + paddedWorldOriginY;
                        const p3z = vertexOffsets[8] + z + paddedWorldOriginZ;

                        calculatedPositions.push(p1x, p1y, p1z);
                        calculatedPositions.push(p2x, p2y, p2z);
                        calculatedPositions.push(p3x, p3y, p3z);

                        // Calculate face normal
                        const uX = p2x - p1x; const uY = p2y - p1y; const uZ = p2z - p1z; // Vector U = P2 - P1
                        const vX = p3x - p1x; const vY = p3y - p1y; const vZ = p3z - p1z; // Vector V = P3 - P1

                        let nX = uY * vZ - uZ * vY; // Cross product U x V
                        let nY = uZ * vX - uX * vZ;
                        let nZ = uX * vY - uY * vX;

                        // Normalize
                        const len = Math.sqrt(nX*nX + nY*nY + nZ*nZ);
                        if (len > 0.00001) { // Avoid division by zero
                            nX /= len;
                            nY /= len;
                            nZ /= len;
                        } else {
                            nX = 0; nY = 1; nZ = 0; // Default to up if degenerate triangle
                        }

                        // Add same normal for all 3 vertices of the triangle
                        calculatedNormals.push(nX, nY, nZ);
                        calculatedNormals.push(nX, nY, nZ);
                        calculatedNormals.push(nX, nY, nZ);

                        e += 3;
                    }
                }
                x += step;
            }
            z += step;
        }
        y += step;
    }

    return {
        positions: new Float32Array(calculatedPositions),
        normals: new Float32Array(calculatedNormals)
    };
} 