import * as THREE from "three";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { CHUNK_HEIGHT, CHUNK_SIZE, storageKeys } from "./constants";
import { generateNoiseMap } from "./noiseMapGenerator";
import { edgeCorners, edges, table } from "./triangulation";
import { Generate } from "./types";

const SURFACE_LEVEL = 0;

// Define the 8 corners of the unit cube relative to its origin (0,0,0)
const cornerPositions = [
  new THREE.Vector3(0, 0, 0), // Corner 0
  new THREE.Vector3(1, 0, 0), // Corner 1
  new THREE.Vector3(1, 0, 1), // Corner 2
  new THREE.Vector3(0, 0, 1), // Corner 3
  new THREE.Vector3(0, 1, 0), // Corner 4
  new THREE.Vector3(1, 1, 0), // Corner 5
  new THREE.Vector3(1, 1, 1), // Corner 6
  new THREE.Vector3(0, 1, 1), // Corner 7
];

export function generateMesh(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  generate?: Generate | null,
  interpolate?: boolean,
  wireframe?: boolean
) {
  let geoms = [];

  let noiseMap = generate?.noiseMap;
  if (!noiseMap) {
    if (generate?.noiseLayers) {
      noiseMap = generateNoiseMap(
        chunkX,
        chunkY,
        chunkZ,
        generate.noiseLayers,
        generate.seed
      );
    } else {
      noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, null, generate?.seed);
    }
  }

  if (interpolate === undefined)
    interpolate = sessionStorage.getItem(storageKeys.INTERPOLATE) === "true";
  if (wireframe === undefined)
    wireframe = sessionStorage.getItem(storageKeys.WIREFRAME) === "true";

  // Create cube based on noise map
  let y = 0;
  while (y < CHUNK_HEIGHT) {
    let z = 0;
    while (z < CHUNK_SIZE) {
      let x = 0;
      while (x < CHUNK_SIZE) {
        let cubeIndex = 0;
        const noiseMapYBot = noiseMap[y];
        const noiseMapYTop = noiseMap[y + 1];

        // Get noise value of each corner of the cube
        let cornerNoises = [
          noiseMapYBot[z][x],
          noiseMapYBot[z][x + 1],
          noiseMapYBot[z + 1][x + 1],
          noiseMapYBot[z + 1][x],
          noiseMapYTop[z][x],
          noiseMapYTop[z][x + 1],
          noiseMapYTop[z + 1][x + 1],
          noiseMapYTop[z + 1][x],
        ];

        // Calculate cube index based on corner noises
        for (let n = 0; n < cornerNoises.length; n++) {
          if (cornerNoises[n] < SURFACE_LEVEL) {
            cubeIndex += 1 << n;
          }
        }

        if (cubeIndex !== 0 && cubeIndex !== 255) {
          // Get edges from table based on cube index
          const tableEdges = table[cubeIndex];

          // Get the base world coordinates for the corner (0,0,0) of the current cube (x, y, z)
          const baseX = x + chunkX * CHUNK_SIZE;
          const baseY = y + chunkY * CHUNK_HEIGHT;
          const baseZ = z + chunkZ * CHUNK_SIZE;

          let e = 0;
          while (e < tableEdges.length) {
            let geom = new THREE.BufferGeometry();
            // Define vertices using Vector3 for easier interpolation
            const triVertices: THREE.Vector3[] = [];

            // Process 3 edges to form one triangle
            for (let i = 0; i < 3; i++) {
              const edgeIndex = tableEdges[e + i];
              const [cornerIndex0, cornerIndex1] = edgeCorners[edgeIndex];

              const noise0 = cornerNoises[cornerIndex0];
              const noise1 = cornerNoises[cornerIndex1];
              const pos0 = cornerPositions[cornerIndex0];
              const pos1 = cornerPositions[cornerIndex1];

              let vertexPos: THREE.Vector3;

              if (interpolate) {
                const diff = noise1 - noise0;
                // Avoid division by zero or near-zero
                if (Math.abs(diff) < 1e-6) {
                  // If noises are too close, just take the midpoint
                  vertexPos = pos0.clone().lerp(pos1, 0.5);
                } else {
                  const t = (SURFACE_LEVEL - noise0) / diff;
                  // Clamp t to avoid potential issues with floating point inaccuracies near boundaries
                  const tClamped = Math.max(0, Math.min(1, t)); 
                  vertexPos = pos0.clone().lerp(pos1, tClamped);
                }
              } else {
                // No interpolation, use midpoint
                vertexPos = pos0.clone().lerp(pos1, 0.5);
              }
              triVertices.push(vertexPos);
            }

            // Convert Vector3 array to Float32Array for BufferGeometry
            const vertices = new Float32Array(9);
            vertices[0] = triVertices[0].x;
            vertices[1] = triVertices[0].y;
            vertices[2] = triVertices[0].z;
            vertices[3] = triVertices[1].x;
            vertices[4] = triVertices[1].y;
            vertices[5] = triVertices[1].z;
            vertices[6] = triVertices[2].x;
            vertices[7] = triVertices[2].y;
            vertices[8] = triVertices[2].z;

            // Create surface from vertices (relative to cube corner 0,0,0)
            geom.setAttribute(
              "position",
              new THREE.BufferAttribute(vertices, 3)
            );
            // Translate the triangle geometry to its correct world position by adding the cube's corner world coordinate
            geom.translate(baseX, baseY, baseZ);
            geoms.push(geom);

            e += 3;
          }
        }
        x++;
      }
      z++;
    }
    y++;
  }

  // Merge chunk
  let chunk = mergeBufferGeometries(geoms);
  // chunk.computeVertexNormals(); // Temporarily disabled for debugging boundary issue
  let mesh = new THREE.Mesh(
    chunk,
    new THREE.MeshNormalMaterial({
      side: THREE.DoubleSide,
      wireframe: !!wireframe,
    })
  );

  return mesh;
}
