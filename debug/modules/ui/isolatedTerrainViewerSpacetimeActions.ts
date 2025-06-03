import * as THREE from 'three';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '../constants_debug';
import { generateNoiseMap } from './noiseMapGenerator_debug';

// Helper function to generate chunk keys around a center point
function generateChunkKeysAroundZero(radius: number, planetType: string): string[] {
    const chunkKeys: string[] = [];
    for (let x = -radius; x <= radius; x++) {
        for (let y = -1; y <= 0; y++) { // Two vertical layers
            for (let z = -radius; z <= radius; z++) {
                chunkKeys.push(`${x},${y},${z}_${planetType}`);
            }
        }
    }
    return chunkKeys;
}


//  This function does the get load and set variables to local function //For local file, 
// If it is used then there should be nothing in  - Clean Function


//  loadPersistentData(): This is the data used by planet loader that runs on start, no key, data required at root.   Do not call it for chunks

//Add call, I expect to see that here that it does load if successful and otherwise it fails.

//THIS DOES NOT USE ANY OF THE CHUNKKEY to help, just the planeInfo which you do on start not later.
//export async function checkAllVariablesLoaded() {

    //Check data values
    //if (window.currentNoiseLayers &&
    //    window.currentSeed &&
    //    window.currentCompInfo &&
    //    window.currentNoiseScale &&
    //    window.currentPlanetOffset)
    //    {
    //    console.warn("[IsolatedTerrainViewerSpacetime] Setting all Variables called.")
    //    return true;
    //    }

       //To fix problems with tests that has to do with loading order not working, and not checking well.   Load this in so variables exist.
        //All  checks for the simulation is performed after it, what matters IS THIS TEST HERE. So the function returns false and the system still creates the chunk
        //This returns a simulation boolean, not to see load test so then, use more local
        
    //console.warn("[IsolatedTerrainViewerSpacetime] Was an empty Load From Memory request ");
    //return false //Load the scene after vars have loaded from storage and local variables are made
   
  //Load Fail, try again another time
//}
