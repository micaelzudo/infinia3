import { CHUNK_HEIGHT, CHUNK_SIZE } from "./constants_debug";
import { generateNoiseMap } from "./noiseMapGenerator_debug";
import { LoadedChunks, NoiseLayers, NoiseMap, Seed, PlayerEditMask } from "./types_debug";
import { getChunkKeyY } from "./utils_debug";
import {
  getNoiseValue,
  setNoiseValue,
  getEditMaskValue,
  setEditMaskValue,
  createNewEditMask,
  dumpNoiseMapDimensions,
  dumpEditMaskDimensions
} from "./directAccess_debug";

// Debug counter for logging
let debugCount = 0;

/**
 * Brush options for terrain editing
 */
export interface BrushOptions {
  radius?: number;
  strength?: number;
  shape?: 'sphere' | 'cube' | 'cylinder';
  verticality?: number;
}

/**
 * Modifies noise map data across potentially multiple chunks based on an edit point.
 *
 * @param loadedChunks The main cache of loaded chunk data.
 * @param worldPoint The world-space coordinates of the edit center.
 * @param remove True to remove terrain (dig), false to add terrain.
 * @param noiseLayers Optional noise layers for generating missing maps.
 * @param seed Optional seed for generating missing maps.
 * @param radius Optional radius of the spherical edit brush. Defaults to 4.
 * @param strength Optional strength factor (0 to 1) for the edit. Defaults to 0.5.
 * @param brushOptions Optional advanced brush options (shape, verticality, etc.)
 * @returns An array of chunk coordinates [x, y, z] that were affected.
 */
export function editNoiseMapChunks(
  loadedChunks: LoadedChunks,
  worldPoint: THREE.Vector3,
  remove: boolean,
  noiseLayers?: NoiseLayers | null,
  seed?: Seed | null,
  radius: number = 4,
  strength: number = 0.5,
  brushOptions?: BrushOptions
): [number, number, number][] {

  // Use brush options if provided, otherwise use default parameters
  const actualRadius = brushOptions?.radius !== undefined ? brushOptions.radius : radius;
  const actualStrength = brushOptions?.strength !== undefined ? brushOptions.strength : strength;
  const brushShape = brushOptions?.shape || 'sphere';
  const verticality = brushOptions?.verticality !== undefined ? brushOptions.verticality : 20;

  console.log(`editNoiseMapChunks called with worldPoint:`, worldPoint,
    `Radius: ${actualRadius}, Strength: ${actualStrength}, Shape: ${brushShape}, Verticality: ${verticality}, Remove: ${remove}`);

  const chunkX = Math.floor((worldPoint.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
  const chunkY = Math.floor(worldPoint.y / CHUNK_HEIGHT);
  const chunkZ = Math.floor((worldPoint.z + CHUNK_SIZE / 2) / CHUNK_SIZE);

  console.log(`Calculated base chunk: X=${chunkX}, Y=${chunkY}, Z=${chunkZ}`);

  const localX = worldPoint.x - chunkX * CHUNK_SIZE;
  const localY = worldPoint.y;
  const localZ = worldPoint.z - chunkZ * CHUNK_SIZE;

  const baseChunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);

  let baseNoiseMap =
    baseChunkKey in loadedChunks
      ? loadedChunks[baseChunkKey].noiseMap
      : null;

  if (!baseNoiseMap) {
    console.log(`Generating base noise map for edited chunk: ${baseChunkKey}`);
    baseNoiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
    if (baseNoiseMap) {
        if (!(baseChunkKey in loadedChunks)) {
            loadedChunks[baseChunkKey] = { mesh: null, noiseMap: baseNoiseMap, playerEditMask: null };
        } else {
             loadedChunks[baseChunkKey].noiseMap = baseNoiseMap;
        }
    } else {
         console.error(`Failed to generate base noise map for ${baseChunkKey}. Edit aborted.`);
         return [];
    }
  }

  let basePlayerEditMask =
    baseChunkKey in loadedChunks && loadedChunks[baseChunkKey].playerEditMask
      ? loadedChunks[baseChunkKey].playerEditMask
      : null;
  if (!basePlayerEditMask) {
    basePlayerEditMask = createPlayerEditMask();
    if (!(baseChunkKey in loadedChunks)) {
      loadedChunks[baseChunkKey] = { mesh: null, noiseMap: baseNoiseMap, playerEditMask: basePlayerEditMask };
    } else {
      loadedChunks[baseChunkKey].playerEditMask = basePlayerEditMask;
    }
  }

  if (!baseNoiseMap) {
    console.error(`Base noise map is unexpectedly null for ${baseChunkKey} before cloning. Edit aborted.`);
    return [];
  }
  const modifiedNoiseMaps: { [key: string]: NoiseMap } = {
      [baseChunkKey]: structuredClone(baseNoiseMap)
  };
  // <<< DISABLE MASK >>>
  // const modifiedPlayerEditMasks: { [key: string]: PlayerEditMask } = {
  //     [baseChunkKey]: structuredClone(basePlayerEditMask)
  // };
  const affectedChunkCoords: [number, number, number][] = [[chunkX, chunkY, chunkZ]];

  // Set up brush dimensions based on parameters
  const horizontalRadius = actualRadius;
  const verticalRadius = actualRadius;

  const horizontalRadiusSq = horizontalRadius * horizontalRadius;
  const verticalRadiusSq = verticalRadius * verticalRadius;

  const intHorizontalRadius = Math.ceil(horizontalRadius);
  const intVerticalRadius = Math.ceil(verticalRadius);

  // Keep verticality for SHAPE/FALLOFF calculations later, but not for iteration range
  const shapeVerticalRadius = actualRadius * verticality; 
  const shapeVerticalRadiusSq = shapeVerticalRadius * shapeVerticalRadius;

  // --- VERTICAL EDITING FIX: Calculate vertical iteration range based on the SHAPE radius --- 
  const intShapeVerticalRadius = Math.ceil(shapeVerticalRadius);
  // ---------------------------------------------------------------------------------------

  console.log(`Edit brush: shape=${brushShape}, horizontalRadius=${horizontalRadius}, ITERATION verticalRadius=${intShapeVerticalRadius}, SHAPE verticalRadius=${shapeVerticalRadius}`);
  console.log(`Edit brush: intHorizontalRadius=${intHorizontalRadius}, intVerticalRadius=${intShapeVerticalRadius}`);

  // Use different ranges for horizontal and vertical dimensions
  // Much larger vertical range to allow editing far beyond chunk boundaries
  // --- VERTICAL EDITING FIX: Use intShapeVerticalRadius for the dy loop range --- 
  for (let dy = -intShapeVerticalRadius; dy <= intShapeVerticalRadius; dy++) {
  // --------------------------------------------------------------------------
    for (let dz = -intHorizontalRadius; dz <= intHorizontalRadius; dz++) {
      for (let dx = -intHorizontalRadius; dx <= intHorizontalRadius; dx++) {
        const offsetX = localX + dx;
        const offsetY = localY + dy;
        const offsetZ = localZ + dz;

        // Calculate if the current voxel is inside the brush shape
        const voxelCenterX = dx + 0.5;
        const voxelCenterY = dy + 0.5;
        const voxelCenterZ = dz + 0.5;

        // Check if the voxel is inside the brush based on the brush shape
        let isInside = false;
        let falloff = 0;

        switch (brushShape) {
          case 'cube':
            // For cube, check if within the box dimensions
            isInside = Math.abs(voxelCenterX) <= horizontalRadius &&
                      Math.abs(voxelCenterY) <= shapeVerticalRadius &&
                      Math.abs(voxelCenterZ) <= horizontalRadius;

            // Calculate falloff based on distance from center (linear)
            if (isInside) {
              const distFromCenter = Math.max(
                Math.abs(voxelCenterX) / horizontalRadius,
                Math.abs(voxelCenterY) / shapeVerticalRadius,
                Math.abs(voxelCenterZ) / horizontalRadius
              );
              falloff = 1 - distFromCenter;
            }
            break;

          case 'cylinder':
            // For cylinder, check horizontal distance (ignoring Y)
            const horizontalDistSq = (voxelCenterX * voxelCenterX + voxelCenterZ * voxelCenterZ) / horizontalRadiusSq;
            const inHorizontalRange = horizontalDistSq <= 1.0;
            const inVerticalRange = Math.abs(voxelCenterY) <= shapeVerticalRadius;
            isInside = inHorizontalRange && inVerticalRange;

            // Calculate falloff based on distance from center
            if (isInside) {
              const horizontalDist = Math.sqrt(horizontalDistSq);
              const verticalDist = Math.abs(voxelCenterY) / shapeVerticalRadius;
              falloff = 1 - Math.max(horizontalDist, verticalDist);
            }
            break;

          case 'sphere':
          default:
            // For sphere/ellipsoid, normalize coordinates
            const normalizedX = voxelCenterX / horizontalRadius;
            const normalizedY = voxelCenterY / shapeVerticalRadius;
            const normalizedZ = voxelCenterZ / horizontalRadius;

            // Calculate squared distance in normalized space
            const distSq = normalizedX * normalizedX + normalizedY * normalizedY + normalizedZ * normalizedZ;
            isInside = distSq <= 1.0;

            // Calculate falloff based on distance from center
            if (isInside) {
              falloff = 1 - Math.sqrt(distSq);
            }
            break;
        }

        // Skip if outside the brush shape
        if (!isInside) continue;

        const targetWorldX = chunkX * CHUNK_SIZE + offsetX;
        const targetWorldY = chunkY * CHUNK_HEIGHT + localY + dy;
        const targetWorldZ = chunkZ * CHUNK_SIZE + offsetZ;

        const targetChunkX = Math.floor((targetWorldX + CHUNK_SIZE / 2) / CHUNK_SIZE);
        const targetChunkY = Math.floor(targetWorldY / CHUNK_HEIGHT);
        const targetChunkZ = Math.floor((targetWorldZ + CHUNK_SIZE / 2) / CHUNK_SIZE);

        // Calculate local coordinates within the chunk
        const targetMapX = ((Math.floor(targetWorldX + CHUNK_SIZE / 2) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        // For Y coordinate, we need to handle it differently to allow editing beyond chunk boundaries
        // First, calculate the local Y coordinate within the chunk
        const targetMapY = Math.floor(targetWorldY) - targetChunkY * CHUNK_HEIGHT;

        // IMPORTANT: Do NOT clamp the Y coordinate here - instead, we'll check if we need to edit a different chunk
        // If targetMapY is outside the current chunk's bounds, we need to generate and edit a different chunk
        let actualChunkY = targetChunkY;
        let actualMapY = targetMapY;

        // If targetMapY is negative, we need to edit the chunk below
        if (targetMapY < 0) {
            actualChunkY = targetChunkY - 1;
            actualMapY = CHUNK_HEIGHT + targetMapY; // Convert to local coordinates in the chunk below
        }
        // If targetMapY is greater than CHUNK_HEIGHT, we need to edit the chunk above
        else if (targetMapY > CHUNK_HEIGHT) {
            actualChunkY = targetChunkY + 1;
            actualMapY = targetMapY - CHUNK_HEIGHT; // Convert to local coordinates in the chunk above
        }

        // Ensure actualMapY is within valid bounds for the noise map [0, CHUNK_HEIGHT]
        if (actualMapY < 0 || actualMapY > CHUNK_HEIGHT) {
            console.warn(`actualMapY ${actualMapY} out of bounds for chunk ${targetChunkKey}, skipping voxel`);
            continue; // Skip this voxel if Y coordinate is still out of bounds
        }

        const targetMapZ = ((Math.floor(targetWorldZ + CHUNK_SIZE / 2) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

        // Use the actual chunk coordinates after adjusting for Y boundaries
        const targetChunkKey = getChunkKeyY(targetChunkX, actualChunkY, targetChunkZ);

        if (!(targetChunkKey in modifiedNoiseMaps)) {
            let noiseMapForTarget: NoiseMap | null = null;

            if (targetChunkKey in loadedChunks) {
                noiseMapForTarget = loadedChunks[targetChunkKey].noiseMap;
            }

            if (!noiseMapForTarget) {
                console.log(`Generating noise map for neighbor ${targetChunkKey}...`);
                // CRITICAL FIX: We need to use actualChunkY instead of targetChunkY
                // targetChunkY is the chunk Y coordinate of the world position
                // actualChunkY is the chunk Y coordinate after adjusting for Y boundaries
                // This mismatch is causing the terrain editing to fail beyond vertical chunk boundaries
                const generatedMap = generateNoiseMap(
                    targetChunkX,
                    actualChunkY, // Use actualChunkY instead of targetChunkY
                    targetChunkZ,
                    noiseLayers,
                    seed
                );
                if (generatedMap) {
                  modifiedNoiseMaps[targetChunkKey] = generatedMap;
                  if (!(targetChunkKey in loadedChunks)) {
                    // Store the newly generated map in loadedChunks if it wasn't there
                    loadedChunks[targetChunkKey] = { mesh: null, noiseMap: generatedMap, playerEditMask: createPlayerEditMask() };
                  }
                } else {
                   console.error(`Failed to generate map for ${targetChunkKey}.`);
                   continue; // Skip this voxel if map generation failed
                }
            } else {
                // Clone if it exists but isn't in modified list yet
                modifiedNoiseMaps[targetChunkKey] = structuredClone(noiseMapForTarget);
            }

            // Track affected chunk coordinates
            if (!affectedChunkCoords.some(coord => coord[0] === targetChunkX && coord[1] === actualChunkY && coord[2] === targetChunkZ)) {
                affectedChunkCoords.push([targetChunkX, actualChunkY, targetChunkZ]);
            }
        }

        // <<< Retrieve the map to modify *after* potentially generating/cloning it >>>
        const mapToModify = modifiedNoiseMaps[targetChunkKey];

        // <<< DISABLE MASK >>>
        /*
        if (!(targetChunkKey in modifiedPlayerEditMasks)) {
            let maskForTarget = (targetChunkKey in loadedChunks && loadedChunks[targetChunkKey].playerEditMask)
                ? loadedChunks[targetChunkKey].playerEditMask
                : createPlayerEditMask();
            modifiedPlayerEditMasks[targetChunkKey] = structuredClone(maskForTarget);
        }
        const maskToModify = modifiedPlayerEditMasks[targetChunkKey];
        */

        if (mapToModify) {
            try {
                // CRITICAL FIX: Use actualMapY for indexing, not targetMapY
                // Add bounds checking to prevent array access errors
                if (actualMapY >= 0 && actualMapY < mapToModify.length &&
                    targetMapZ >= 0 && targetMapZ < (mapToModify[actualMapY]?.length || 0) &&
                    targetMapX >= 0 && targetMapX < (mapToModify[actualMapY]?.[targetMapZ]?.length || 0) &&
                    mapToModify[actualMapY]?.[targetMapZ]?.[targetMapX] !== undefined) {
                    const editAmount = actualStrength * falloff * (remove ? -1 : 1); // Adjusted logic: negative for remove, positive for add
                    
                    mapToModify[actualMapY][targetMapZ][targetMapX] += editAmount;

                    // <<< DISABLE MASK >>>
                    /*
                    // Apply edit to player mask as well
                    if (maskToModify && maskToModify[actualMapY]?.[targetMapZ]?.[targetMapX] !== undefined) {
                        maskToModify[actualMapY][targetMapZ][targetMapX] = true; // Mark as edited
                    } else {
                         console.warn(`Mask access out of bounds: Key=${targetChunkKey}, Y=${actualMapY}, Z=${targetMapZ}, X=${targetMapX}`);
                    }
                    */
                } else {
                    // Log out-of-bounds access using the CORRECT y-index with more detailed info
                    console.warn(`Noise map access out of bounds: Key=${targetChunkKey}, Y=${actualMapY}/${mapToModify.length}, Z=${targetMapZ}/${mapToModify[actualMapY]?.length || 'undefined'}, X=${targetMapX}/${mapToModify[actualMapY]?.[targetMapZ]?.length || 'undefined'}`);
                }
            } catch (e) {
                console.error(`Error applying edit to ${targetChunkKey} at [${actualMapY}][${targetMapZ}][${targetMapX}]`, e);
            }
        } else {
            console.warn(`Map not found in modifiedNoiseMaps for key ${targetChunkKey} during edit application.`);
        }
      }
    }
  }

   console.log("Applying modifications back to loadedChunks...");
   for (const key in modifiedNoiseMaps) {
       console.log(`[ApplyBack] Attempting to update key: ${key} in loadedChunks`);
       if (loadedChunks[key]) {
            // Apply the noise map and edit mask changes ONLY
            loadedChunks[key].noiseMap = modifiedNoiseMaps[key];
            // <<< DISABLE MASK >>>
            // if (key in modifiedPlayerEditMasks) {
            //     loadedChunks[key].playerEditMask = modifiedPlayerEditMasks[key];
            // }
            
            // Update the lastAccessTime to ensure this chunk stays loaded
            if ('lastAccessTime' in loadedChunks[key]) {
                // Only update lastAccessTime if the property exists
                loadedChunks[key].lastAccessTime = Date.now();
            }
        } else {
            // New chunk created during edit - ensure it has all required properties
            // Initialize mesh to null, regeneration will handle creation.
            const coords = key.split(',').map(Number);
            if (coords.length === 3) {
                const [newX, newY, newZ] = coords;
                
                // Create the new chunk with a null mesh (will be generated later)
                loadedChunks[key] = {
                    mesh: null, // Always start with null mesh for NEW chunks
                    noiseMap: modifiedNoiseMaps[key],
                    // <<< DISABLE MASK >>>
                    // playerEditMask: key in modifiedPlayerEditMasks ? modifiedPlayerEditMasks[key] : createPlayerEditMask(),
                    playerEditMask: null, // Set mask to null
                    lastAccessTime: Date.now()
                };
                
                console.log(`Created new chunk at ${key} during terrain edit.`);
            }
        }
   }
   console.log("Modifications applied.");

  // Update lastAccessTime for all potentially affected chunks (those whose maps were touched)
  for (const [x, y, z] of affectedChunkCoords) {
      const key = getChunkKeyY(x, y, z);
      const chunkData = loadedChunks[key];
      
      // Update the lastAccessTime to ensure this chunk stays loaded (if property exists)
      if (chunkData && typeof chunkData === 'object' && 'lastAccessTime' in chunkData) {
          // Only update lastAccessTime if the property exists
          (chunkData as any).lastAccessTime = Date.now();
      }
  }

  console.log(`Noise map editing complete. ${affectedChunkCoords.length} chunks affected: [${affectedChunkCoords.map(coords => coords.join(',')).join('] [')}]`);

  // For each affected chunk coordinate...
  for (const [chunkX, chunkY, chunkZ] of affectedChunkCoords) {
    // Get the chunk key
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
    
    // VERTICAL TERRAIN EDITING FIX: Better handling for negative Y chunks
    // This ensures that when editing deep below the surface, chunks are properly loaded
    let chunkData = loadedChunks[chunkKey];
    
    // If this is a chunk at negative Y coordinate, use special handling
    if (chunkY < 0 && (!chunkData || !chunkData.noiseMap)) {
      // <<< DISABLE MASK - Simplified Call >>>
      chunkData = handleChunkCoordAtNegativeY(chunkX, chunkY, chunkZ, loadedChunks, noiseLayers!, seed!, null);
    }
    
    // If we still don't have chunk data, skip this coordinate
    if (!chunkData || !chunkData.noiseMap) {
      console.warn(`editNoiseMapChunks: Missing chunk data for ${chunkKey}, skipping.`);
      continue;
    }
    
    // Update lastAccessTime to keep this chunk loaded
    if (chunkData.lastAccessTime !== undefined) {
      chunkData.lastAccessTime = Date.now();
    }
  }

  return affectedChunkCoords;
}

// Utility to initialize a playerEditMask
// IMPORTANT: Use the direct access function to create a PlayerEditMask
// This ensures consistent dimensions and structure
function createPlayerEditMask(): PlayerEditMask {
  return createNewEditMask();
}

// Type-safe error handling
function handleError(err: unknown, message: string): void {
  if (err instanceof Error) {
    console.error(`${message}: ${err.message}`);
  } else {
    console.error(`${message}: Unknown error`);
  }
}

// Fix for the catch blocks with unknown errors
try {
  // Code that might throw
} catch (err: unknown) {
  handleError(err, "Debug logging error in vertical boundary handling");
}

/* VERTICAL TERRAIN EDITING ENHANCEMENTS */
function handleChunkCoordAtNegativeY(chunkX: number, chunkY: number, chunkZ: number, loadedChunks: LoadedChunks, noiseLayers: NoiseLayers, seed: Seed, playerEditMask: PlayerEditMask | null = null) {
    // Special handling for negative Y chunks
    const chunkKey = getChunkKeyY(chunkX, chunkY, chunkZ);
    
    // If chunk doesn't exist yet, create it
    if (!loadedChunks[chunkKey]) {
        console.log(`Creating new chunk at negative Y: ${chunkKey}`);
        
        // Generate a new noise map for this chunk
        const newNoiseMap = generateNoiseMap(chunkX, chunkY, chunkZ, noiseLayers, seed);
        
        // <<< DISABLE MASK >>>
        // const newPlayerEditMask = createPlayerEditMask();
        
        // Add chunk to loaded chunks - CRITICAL: for continuity, we intentionally start with mesh: null
        // This ensures the mesh will be properly generated by the regeneration function
        loadedChunks[chunkKey] = {
            mesh: null, // Will be created during regeneration
            noiseMap: newNoiseMap,
            // <<< DISABLE MASK >>>
            // playerEditMask: newPlayerEditMask,
            playerEditMask: null,
            lastAccessTime: Date.now() // Set access time
        };
        
        console.log(`Successfully created chunk data for ${chunkKey} at negative Y=${chunkY}`);
        return loadedChunks[chunkKey];
    }
    
    // Update the lastAccessTime to ensure this chunk stays loaded
    if (loadedChunks[chunkKey].lastAccessTime !== undefined) {
        loadedChunks[chunkKey].lastAccessTime = Date.now();
    }
    
    return loadedChunks[chunkKey];
}
