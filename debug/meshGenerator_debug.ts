import * as THREE from "three";
import { mergeBufferGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import { CHUNK_HEIGHT, CHUNK_SIZE } from "./constants_debug";
import { Generate, NoiseMap, PlayerEditMask } from "./types_debug";
import { generateNoiseMap } from './noiseMapGenerator_debug';
import { edgeCorners, edges, table } from "./triangulation_debug";
import { logThrottled } from './logThrottler';
import {
  getNoiseValue,
  setNoiseValue,
  getEditMaskValue,
  setEditMaskValue,
  dumpNoiseMapDimensions,
  dumpEditMaskDimensions
} from "./directAccess_debug";

// Declare global type for boundary vertex cache
declare global {
  interface Window {
    __boundaryVertexCoordinates: Map<string, THREE.Vector3>;
  }
}

// Add extra options for boundary neighbor presence
type NeighborPresence = {
  neighborXPosExists?: boolean,
  neighborYPosExists?: boolean,
  neighborZPosExists?: boolean,
  neighborXNegExists?: boolean,
  neighborYNegExists?: boolean,
  neighborZNegExists?: boolean,
  playerEditMaskXNeg?: PlayerEditMask | null,
  playerEditMaskXPos?: PlayerEditMask | null,
  playerEditMaskYNeg?: PlayerEditMask | null,
  playerEditMaskYPos?: PlayerEditMask | null,
  playerEditMaskZNeg?: PlayerEditMask | null,
  playerEditMaskZPos?: PlayerEditMask | null,
  noiseMapXNeg?: NoiseMap | null,
  noiseMapXPos?: NoiseMap | null,
  noiseMapYNeg?: NoiseMap | null,
  noiseMapYPos?: NoiseMap | null,
  noiseMapZNeg?: NoiseMap | null,
  noiseMapZPos?: NoiseMap | null,
};

// CRITICAL: Use fixed surface level like reference implementation - matches reference exactly
const SURFACE_LEVEL = 0.0;

// Enhanced to more reliably get noise values at chunk boundaries using neighbor chunks
function getNoise(
    x: number, y: number, z: number,
    currentMap: NoiseMap,
    neighbors: { [key: string]: NoiseMap | null | undefined } // Use more flexible type from reference
): number | null {
    // Ensure consistent extrapolation at boundaries
    
    // Y-axis boundaries
    if (y < 0) {
        if (!neighbors.below) {
            // FIXED: Instead of a simple offset, use a smooth transition function based on distance
            // This avoids sharp edges at chunk boundaries
            if (currentMap[0] && currentMap[0][z] && typeof currentMap[0][z][x] !== 'undefined') {
                const topValue = currentMap[0][z][x];
                const distanceBelow = -y; // How far below we are (positive number)
                // Apply smooth transition: value decreases with greater distance below
                return topValue - 0.3 * Math.pow(distanceBelow, 0.75);
            }
            return null;
        }
        return neighbors.below[y + CHUNK_HEIGHT][z][x];
    } 
    else if (y >= CHUNK_HEIGHT) {
        if (!neighbors.above) {
            // FIXED: Use consistent transition function for top edges too
            if (currentMap[CHUNK_HEIGHT-1] && currentMap[CHUNK_HEIGHT-1][z] && typeof currentMap[CHUNK_HEIGHT-1][z][x] !== 'undefined') {
                const bottomValue = currentMap[CHUNK_HEIGHT-1][z][x];
                const distanceAbove = y - (CHUNK_HEIGHT-1); // How far above we are
                // Apply smooth transition: value decreases with greater distance above
                return bottomValue - 0.3 * Math.pow(distanceAbove, 0.75);
            }
            return null;
        }
        return neighbors.above[y - CHUNK_HEIGHT][z][x];
    }
    
    // Z-axis boundaries
    if (z < 0) {
        if (!neighbors.zNeg) {
            // FIXED: More sophisticated extrapolation from current map edge
            if (currentMap[y] && currentMap[y][0] && typeof currentMap[y][0][x] !== 'undefined') {
                // Check if we have more depth information to create a gradient
                if (currentMap[y][1] && typeof currentMap[y][1][x] !== 'undefined') {
                    // Create gradient based on first two Z values
                    const firstValue = currentMap[y][0][x];
                    const secondValue = currentMap[y][1][x];
                    const slope = firstValue - secondValue;
                    return firstValue + slope * (-z);
                }
                // If no gradient, use constant extrapolation
                return currentMap[y][0][x];
            }
            return null;
        }
        return neighbors.zNeg[y][z + CHUNK_SIZE][x];
    }
    else if (z >= CHUNK_SIZE) {
        if (!neighbors.zPos) {
            // FIXED: More sophisticated extrapolation from current map edge
            if (currentMap[y] && currentMap[y][CHUNK_SIZE-1] && typeof currentMap[y][CHUNK_SIZE-1][x] !== 'undefined') {
                // Check if we have more depth information to create a gradient
                if (currentMap[y][CHUNK_SIZE-2] && typeof currentMap[y][CHUNK_SIZE-2][x] !== 'undefined') {
                    // Create gradient based on last two Z values
                    const lastValue = currentMap[y][CHUNK_SIZE-1][x];
                    const secondLastValue = currentMap[y][CHUNK_SIZE-2][x];
                    const slope = lastValue - secondLastValue;
                    return lastValue + slope * (z - (CHUNK_SIZE-1));
                }
                // If no gradient, use constant extrapolation
                return currentMap[y][CHUNK_SIZE-1][x];
            }
            return null;
        }
        return neighbors.zPos[y][z - CHUNK_SIZE][x];
    }
    
    // X-axis boundaries - same pattern as Z-axis
    if (x < 0) {
        if (!neighbors.xNeg) {
            // FIXED: More sophisticated extrapolation from current map edge
            if (currentMap[y] && currentMap[y][z] && typeof currentMap[y][z][0] !== 'undefined') {
                // Check if we have more depth information to create a gradient
                if (currentMap[y][z][1] && typeof currentMap[y][z][1] !== 'undefined') {
                    // Create gradient based on first two X values
                    const firstValue = currentMap[y][z][0];
                    const secondValue = currentMap[y][z][1];
                    const slope = firstValue - secondValue;
                    return firstValue + slope * (-x);
                }
                // If no gradient, use constant extrapolation
                return currentMap[y][z][0];
            }
            return null;
        }
        return neighbors.xNeg[y][z][x + CHUNK_SIZE];
    }
    else if (x >= CHUNK_SIZE) {
        if (!neighbors.xPos) {
            // FIXED: More sophisticated extrapolation from current map edge
            if (currentMap[y] && currentMap[y][z] && typeof currentMap[y][z][CHUNK_SIZE-1] !== 'undefined') {
                // Check if we have more depth information to create a gradient
                if (currentMap[y][z][CHUNK_SIZE-2] && typeof currentMap[y][z][CHUNK_SIZE-2] !== 'undefined') {
                    // Create gradient based on last two X values
                    const lastValue = currentMap[y][z][CHUNK_SIZE-1];
                    const secondLastValue = currentMap[y][z][CHUNK_SIZE-2];
                    const slope = lastValue - secondLastValue;
                    return lastValue + slope * (x - (CHUNK_SIZE-1));
                }
                // If no gradient, use constant extrapolation
                return currentMap[y][z][CHUNK_SIZE-1];
            }
            return null;
        }
        return neighbors.xPos[y][z][x - CHUNK_SIZE];
    }
    
    // Within current chunk
    if (!currentMap[y] || !currentMap[y][z] || typeof currentMap[y][z][x] === 'undefined') {
        return null;
    }
    
    return currentMap[y][z][x];
}

// Add a snap vertices function to ensure consistent boundaries between chunks
function snapVerticesToBoundaries(positions: Float32Array, chunkX: number, chunkY: number, chunkZ: number): void {
  // FIXED: Increased threshold to catch more boundary vertices
  const SNAP_THRESHOLD = 0.015; // Increased from 0.01 to 0.015

  // Calculate exact boundary positions
  const xLeftBoundary = (chunkX - 0.5) * CHUNK_SIZE;
  const xRightBoundary = (chunkX + 0.5) * CHUNK_SIZE;
  const yBottomBoundary = chunkY * CHUNK_HEIGHT;
  const yTopBoundary = (chunkY + 1) * CHUNK_HEIGHT;
  const zBackBoundary = (chunkZ - 0.5) * CHUNK_SIZE;
  const zFrontBoundary = (chunkZ + 0.5) * CHUNK_SIZE;

  // Snap vertices to boundaries and apply precision rounding
  for (let i = 0; i < positions.length; i += 3) {
    let vx = positions[i];
    let vy = positions[i+1];
    let vz = positions[i+2];

    // X boundaries
    if (Math.abs(vx - xLeftBoundary) < SNAP_THRESHOLD) {
      vx = xLeftBoundary;
    } else if (Math.abs(vx - xRightBoundary) < SNAP_THRESHOLD) {
      vx = xRightBoundary;
    }

    // Y boundaries - critical for vertical chunk stitching
    if (Math.abs(vy - yBottomBoundary) < SNAP_THRESHOLD) {
      vy = yBottomBoundary;
    } else if (Math.abs(vy - yTopBoundary) < SNAP_THRESHOLD) {
      vy = yTopBoundary;
    }

    // Z boundaries
    if (Math.abs(vz - zBackBoundary) < SNAP_THRESHOLD) {
      vz = zBackBoundary;
    } else if (Math.abs(vz - zFrontBoundary) < SNAP_THRESHOLD) {
      vz = zFrontBoundary;
    }

    // Apply high precision fix and update positions
    // Use 10 million precision to avoid floating point issues
    positions[i] = Math.round(vx * 10000000) / 10000000;
    positions[i+1] = Math.round(vy * 10000000) / 10000000;
    positions[i+2] = Math.round(vz * 10000000) / 10000000;
  }
}

export function generateMesh(
  chunkX: number,
  chunkY: number,
  chunkZ: number,
  generate?: Generate | null,
  interpolate?: boolean,
  noiseMapBelow?: NoiseMap | null,
  noiseMapAbove?: NoiseMap | null,
  noiseMapXNeg?: NoiseMap | null,
  noiseMapXPos?: NoiseMap | null,
  noiseMapZNeg?: NoiseMap | null,
  noiseMapZPos?: NoiseMap | null,
  neighborFlags: NeighborPresence = {},
  // <<< DISABLE MASK >>>
  // playerEditMask?: PlayerEditMask | null
): THREE.BufferGeometry {
  // Add robust error handling to the entire function
  try {
    const geoms: THREE.BufferGeometry[] = [];
    
    let noiseMap = generate?.noiseMap;

    // Generate noise map if none provided
    if (!noiseMap) {
      console.debug(`MeshGen: NoiseMap for [${chunkX}, ${chunkY}, ${chunkZ}] not provided, generating...`);
      if (generate?.noiseLayers) {
        noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, generate.noiseLayers, generate.seed);
      } else {
        noiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, null, generate?.seed);
      }
      
      if (!noiseMap) {
        console.error(`MeshGen: Failed to generate noise map for [${chunkX},${chunkY},${chunkZ}]`);
        return new THREE.BufferGeometry();
      }
    }

    // Basic validation
    if (!noiseMap || noiseMap.length < CHUNK_HEIGHT + 1 ||
        !noiseMap[0] || noiseMap[0].length < CHUNK_SIZE + 1 ||
        !noiseMap[0][0] || noiseMap[0][0].length < CHUNK_SIZE + 1) {
      console.error(`MeshGen: Invalid noise map for [${chunkX}, ${chunkY}, ${chunkZ}]`);
      return new THREE.BufferGeometry();
    }

    const useInterpolate = interpolate === true;
    
    // Log key noise map information for debugging
    if (chunkX === 0 && chunkY === 0 && chunkZ === 0) {
      console.log(`MeshGen: Processing ORIGIN chunk with noise map dimensions: ${noiseMap.length}x${noiseMap[0].length}x${noiseMap[0][0].length}`);
      // Log some central values to verify content
      const midY = Math.floor(CHUNK_HEIGHT/2);
      const midZ = Math.floor(CHUNK_SIZE/2);
      const midX = Math.floor(CHUNK_SIZE/2);
      console.log(`MeshGen: Central value: ${noiseMap[midY][midZ][midX]}`);
    }

    // Bundle neighbors for getNoise function
    const neighborMaps = {
        above: noiseMapAbove,
        below: noiseMapBelow,
        xNeg: noiseMapXNeg,
        xPos: noiseMapXPos,
        zNeg: noiseMapZNeg,
        zPos: noiseMapZPos
    };

    // Track special edge triangles for additional handling
    const edgeTriangles = {
      bottomEdge: [] as THREE.BufferGeometry[],
      topEdge: [] as THREE.BufferGeometry[],
      xMinEdge: [] as THREE.BufferGeometry[],
      xMaxEdge: [] as THREE.BufferGeometry[],
      zMinEdge: [] as THREE.BufferGeometry[],
      zMaxEdge: [] as THREE.BufferGeometry[]
    };
    
    // Create cube based on noise map - MATCH THE REFERENCE IMPLEMENTATION structure
    let cubeCounter = 0;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          // FIXED: Give special attention to boundary cubes
          const isXEdge = x === 0 || x === CHUNK_SIZE - 1;
          const isYEdge = y === 0 || y === CHUNK_HEIGHT - 1;
          const isZEdge = z === 0 || z === CHUNK_SIZE - 1;
          const isOnEdge = isXEdge || isYEdge || isZEdge;
          
          let cubeIndex = 0;
          
          // Define the 8 corners of the cube
          const corners = [
              [x    , y    , z    ], // 0: Bottom-left-back
              [x + 1, y    , z    ], // 1: Bottom-right-back
              [x + 1, y    , z + 1], // 2: Bottom-right-front
              [x    , y    , z + 1], // 3: Bottom-left-front
              [x    , y + 1, z    ], // 4: Top-left-back
              [x + 1, y + 1, z    ], // 5: Top-right-back
              [x + 1, y + 1, z + 1], // 6: Top-right-front
              [x    , y + 1, z + 1]  // 7: Top-left-front
          ];

          // Get noise value for each corner using getNoise (handles boundaries)
          const cornerNoises: (number | null)[] = corners.map(([cx, cy, cz]) => 
              getNoise(cx, cy, cz, noiseMap!, neighborMaps)
          );

          // ENHANCEMENT: Instead of skipping cubes with missing corner values completely,
          // attempt to interpolate from available values
          if (cornerNoises.some(noise => noise === null)) {
              // Count how many nulls we have
              const nullCount = cornerNoises.filter(n => n === null).length;
              
              // Only attempt to salvage if most corners have values (maximum 2 missing corners)
              if (nullCount <= 2) {
                  // Calculate average of non-null values
                  const nonNullValues = cornerNoises.filter(n => n !== null) as number[];
                  const average = nonNullValues.reduce((sum, val) => sum + val, 0) / nonNullValues.length;
                  
                  // Replace nulls with interpolated values
                  for (let c = 0; c < cornerNoises.length; c++) {
                      if (cornerNoises[c] === null) {
                          cornerNoises[c] = average;
                      }
                  }
                  
                  // Continue with interpolated values
              } else {
                  // Too many missing corners, skip this cube
              cubeCounter++;
              continue;
              }
          }

          // Calculate cube index based on noise values vs threshold
          for (let n = 0; n < cornerNoises.length; n++) {
              if ((cornerNoises[n] as number) < SURFACE_LEVEL) { 
                  cubeIndex += 1 << n;
              }
          }

          // Skip empty cubes (0) and fully filled cubes (255)
          if (cubeIndex !== 0 && cubeIndex !== 255) {
              // Get edges from triangulation table
              const tableEdges = table[cubeIndex];

              // Process each triangle (3 edges per triangle)
              for (let e = 0; e < tableEdges.length; e += 3) {
                  // Get the three edges that form this triangle
                  const edge1 = edges[tableEdges[e]];
                  const edge2 = edges[tableEdges[e + 1]];
                  const edge3 = edges[tableEdges[e + 2]];

                  let vertices: Float32Array;

                  // FIXED: Create slightly different logic for boundary cubes
                  if (isOnEdge) {
                      // For edge cubes, create a bit more precision to ensure a better match
                      // Use actual edge calculations with fixed points
                  vertices = new Float32Array([
                      edge1[0], edge1[1], edge1[2],
                      edge2[0], edge2[1], edge2[2],
                      edge3[0], edge3[1], edge3[2]
                  ]);
                      
                      // Round to higher precision for boundary vertices
                      for (let i = 0; i < vertices.length; i++) {
                          vertices[i] = Math.round(vertices[i] * 10000) / 10000;
                      }
                  } else {
                      // Non-boundary cubes use standard vertex positions
                      vertices = new Float32Array([
                          edge1[0], edge1[1], edge1[2],
                          edge2[0], edge2[1], edge2[2],
                          edge3[0], edge3[1], edge3[2]
                      ]);
                  }

                  // Create a geometry and add the vertices
                  const geom = new THREE.BufferGeometry();
                  geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                  
                  // Apply offset - EXACTLY match reference implementation for consistency
                  const xOffset = x + (chunkX - 0.5) * CHUNK_SIZE;
                  const yOffset = y + chunkY * CHUNK_HEIGHT;
                  const zOffset = z + (chunkZ - 0.5) * CHUNK_SIZE;
                  geom.translate(xOffset, yOffset, zOffset);
                  
                  // FIXED: Store boundary triangles separately for special handling
                  if (isOnEdge) {
                      if (y === 0) {
                          edgeTriangles.bottomEdge.push(geom);
                      } else if (y === CHUNK_HEIGHT - 1) {
                          edgeTriangles.topEdge.push(geom);
                      }
                      
                      if (x === 0) {
                          edgeTriangles.xMinEdge.push(geom);
                      } else if (x === CHUNK_SIZE - 1) {
                          edgeTriangles.xMaxEdge.push(geom);
                      }
                      
                      if (z === 0) {
                          edgeTriangles.zMinEdge.push(geom);
                      } else if (z === CHUNK_SIZE - 1) {
                          edgeTriangles.zMaxEdge.push(geom);
                      }
                  }
                  
                  // Add this triangle to our collection
                  geoms.push(geom);
              }
          }
          cubeCounter++;
        }
      }
    }

    // If no geometries were created, return an empty geometry
    if (geoms.length === 0) {
      console.log(`MeshGen: No triangles generated for chunk [${chunkX},${chunkY},${chunkZ}]`);
      const emptyGeometry = new THREE.BufferGeometry();
      emptyGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
      return emptyGeometry;
    }

    // Merge all triangle geometries into a single mesh
    try {
      const mergedGeometry = mergeBufferGeometries(geoms);
      if (!mergedGeometry) {
        console.error(`MeshGen: Failed to merge geometries for [${chunkX},${chunkY},${chunkZ}]`);
        const emptyGeometry = new THREE.BufferGeometry();
        emptyGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
        return emptyGeometry;
      }
      
      // Compute normals for lighting
      mergedGeometry.computeVertexNormals();
      
      // CRITICAL FIX: Apply boundary snapping to ensure consistent vertices at chunk boundaries
      // This ensures that vertices from adjacent chunks will perfectly align at boundaries
      if (mergedGeometry.attributes.position) {
        const positions = mergedGeometry.attributes.position.array as Float32Array;
        snapVerticesToBoundaries(positions, chunkX, chunkY, chunkZ);
        mergedGeometry.attributes.position.needsUpdate = true;
      }
      
      // Log generation stats
      console.log(`MeshGen: Created geometry for [${chunkX},${chunkY},${chunkZ}] with ${mergedGeometry.attributes.position.count} vertices from ${geoms.length} triangles`);
      
      // FIXED: Log boundary triangle stats to help with debugging
      if (Object.values(edgeTriangles).some(arr => arr.length > 0)) {
        console.log(`MeshGen: Boundary triangles for [${chunkX},${chunkY},${chunkZ}]: ` +
          `Bottom=${edgeTriangles.bottomEdge.length}, ` +
          `Top=${edgeTriangles.topEdge.length}, ` +
          `XMin=${edgeTriangles.xMinEdge.length}, ` +
          `XMax=${edgeTriangles.xMaxEdge.length}, ` +
          `ZMin=${edgeTriangles.zMinEdge.length}, ` +
          `ZMax=${edgeTriangles.zMaxEdge.length}`);
      }
      
      return mergedGeometry;
    } catch (e) {
      console.error(`MeshGen: Error merging geometries:`, e);
      const emptyGeometry = new THREE.BufferGeometry();
      emptyGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
      return emptyGeometry;
    }
  } catch (error) {
    console.error(`MeshGen: Critical error for [${chunkX},${chunkY},${chunkZ}]:`, error);
    return new THREE.BufferGeometry();
  }
}

