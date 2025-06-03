// marchingcubes/debug/workers/navMeshWorker.js

// Use importScripts() to load the UMD/IIFE bundle from CDN
importScripts('https://cdn.jsdelivr.net/npm/yuka@0.7.8/build/yuka.min.js');

// Check if YUKA global object and necessary classes exist after importScripts
if (typeof YUKA === 'undefined' || !YUKA.Polygon || !YUKA.Vector3 || !YUKA.NavMesh) { 
    console.error("NavMeshWorker: YUKA library or its classes failed to load via importScripts().");
    // Post an error back to the main thread
    self.postMessage({ type: 'error', error: 'Failed to load YUKA library or its classes in worker via importScripts().' });
    // Optional: throw an error to halt the worker
    throw new Error('YUKA library failed to load');
} else {
    console.log("[NavMeshWorker] YUKA library loaded successfully via importScripts().");
}

self.onmessage = function(event) {
    // Check again before use (might be redundant after initial check, but safe)
    if (typeof YUKA === 'undefined' || !YUKA.Polygon || !YUKA.Vector3 || !YUKA.NavMesh) { 
        console.error("NavMeshWorker: YUKA library or its classes not available. Cannot process message.");
        self.postMessage({ type: 'error', error: 'YUKA library or its classes not available in worker.' });
        return;
    }

    const { type, polygons: serializedPolygons, geometryData, navMeshId, pathfindingRequestId, from, to, position } = event.data;

    if (type === 'navmesh' && navMeshId) {
        console.log(`[NavMeshWorker ${navMeshId}] Received navmesh generation request`);
        try {
            const start = performance.now();
            let yukaPolygons = [];

            if (serializedPolygons) {
                // Handle pre-processed polygons
                console.log(`[NavMeshWorker ${navMeshId}] Processing ${serializedPolygons.length} pre-processed polygons.`);
                if (!Array.isArray(serializedPolygons)) {
                    throw new Error('Invalid input: polygons must be an array');
                }

                // Reconstruct YUKA.Polygon objects from serialized data
                yukaPolygons = serializedPolygons.map((data, index) => {
                    // Validate polygon data
                    if (!data || !Array.isArray(data.vertices)) {
                        console.warn(`[NavMeshWorker ${navMeshId}] Skipping invalid polygon at index ${index}`);
                        return null;
                    }

                    // Validate vertices
                    const validVertices = data.vertices.filter(v => v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number');
                    if (validVertices.length < 3) {
                        console.warn(`[NavMeshWorker ${navMeshId}] Skipping polygon at index ${index} with insufficient valid vertices`);
                        return null;
                    }

                    const poly = new YUKA.Polygon();
                    const vertices = validVertices.map(v => new YUKA.Vector3(v.x, v.y, v.z));
                    
                    try {
                        poly.fromContour(vertices);
                        
                        // Only set centroid and plane if they exist and are valid
                        if (data.centroid && typeof data.centroid.x === 'number') {
                            poly.centroid.set(data.centroid.x, data.centroid.y, data.centroid.z);
                        }
                        
                        if (data.plane && data.plane.normal && typeof data.plane.normal.x === 'number') {
                            poly.plane.normal.set(data.plane.normal.x, data.plane.normal.y, data.plane.normal.z);
                            poly.plane.constant = typeof data.plane.constant === 'number' ? data.plane.constant : 0;
                        }
                        
                        return poly;
                    } catch (polyError) {
                        console.warn(`[NavMeshWorker ${navMeshId}] Error creating polygon at index ${index}:`, polyError);
                        return null;
                    }
                }).filter(p => p !== null);
            } else if (geometryData && Array.isArray(geometryData)) {
                // Handle raw geometry data (array of numbers: [x1,y1,z1, x2,y2,z2, ...])
                console.log(`[NavMeshWorker ${navMeshId}] Processing raw geometry data (${geometryData.length} vertices)...`);
                
                // Convert flat array of numbers to array of YUKA.Vector3
                for (let i = 0; i < geometryData.length; i += 9) {
                    // Each triangle is 3 vertices * 3 components (x,y,z)
                    if (i + 8 >= geometryData.length) break;
                    
                    const v1 = new YUKA.Vector3(
                        geometryData[i], geometryData[i+1], geometryData[i+2]
                    );
                    const v2 = new YUKA.Vector3(
                        geometryData[i+3], geometryData[i+4], geometryData[i+5]
                    );
                    const v3 = new YUKA.Vector3(
                        geometryData[i+6], geometryData[i+7], geometryData[i+8]
                    );
                    
                    // Create a polygon for each triangle
                    const poly = new YUKA.Polygon();
                    try {
                        poly.fromContour([v1, v2, v3]);
                        yukaPolygons.push(poly);
                    } catch (e) {
                        console.warn(`[NavMeshWorker ${navMeshId}] Error creating polygon from vertices:`, e);
                    }
                }
                
                console.log(`[NavMeshWorker ${navMeshId}] Created ${yukaPolygons.length} polygons from raw geometry.`);
            } else {
                throw new Error('No valid polygon or geometry data provided');
            }

            if (yukaPolygons.length === 0) {
                throw new Error('No valid polygons could be created from the input data');
            }

            console.log(`[NavMeshWorker ${navMeshId}] Processing ${yukaPolygons.length} valid polygons.`);

            // Create NavMesh using fromPolygons
            const navMeshInstance = new YUKA.NavMesh();
            console.log(`[NavMeshWorker ${navMeshId}] Creating NavMesh from ${yukaPolygons.length} polygons...`);
            navMeshInstance.fromPolygons(yukaPolygons);
            
            // Store the generated NavMesh instance in the worker
            self.navMeshInstance = navMeshInstance;

            const generationTime = performance.now() - start;
            console.log(`[NavMeshWorker ${navMeshId}] NavMesh generated in ${generationTime.toFixed(2)} ms. Regions: ${navMeshInstance.regions.length}`);

            // Serialize the generated NavMesh back to the main thread
            const serializedNavMeshData = serializeNavMesh(navMeshInstance);

            // Post the result back
            self.postMessage({ 
                type: 'navmesh', 
                navMeshId: navMeshId, 
                navMeshData: serializedNavMeshData 
            });

        } catch (e) {
            console.error(`[NavMeshWorker ${navMeshId}] Error processing navmesh:`, e);
            self.postMessage({ 
                type: 'error', 
                navMeshId: navMeshId, 
                error: e.message || 'Unknown error in worker' 
            });
        }
    } else if (type === 'path' && pathfindingRequestId !== undefined) { 
        // Handle pathfinding requests
        try {
            // Validate the message structure
            if (!self.navMeshInstance) {
                throw new Error('NavMesh not initialized in worker');
            }

            // Validate required fields
            if (!from || !to) {
                throw new Error('Invalid pathfinding request. Missing required fields.');
            }

            // Validate vector components
            const validateVector = (v, name) => {
                return v && 
                       typeof v.x === 'number' && 
                       typeof v.y === 'number' && 
                       typeof v.z === 'number';
            };

            if (!validateVector(from, 'from') || !validateVector(to, 'to')) {
                throw new Error('Invalid vector data in pathfinding request');
            }

            console.log(`[NavMeshWorker] Received pathfinding request ID ${pathfindingRequestId} from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`);
            
            // Convert plain objects to YUKA.Vector3
            const fromVec = new YUKA.Vector3(from.x, from.y, from.z);
            const toVec = new YUKA.Vector3(to.x, to.y, to.z);

            // Find the path
            const path = self.navMeshInstance.findPath(fromVec, toVec);

            // Serialize the path (array of YUKA.Vector3) to plain objects
            const serializedPath = path ? path.map(v => ({ x: v.x, y: v.y, z: v.z })) : null;

            console.log(`[NavMeshWorker] Pathfinding request ${pathfindingRequestId} complete. Path length: ${serializedPath ? serializedPath.length : 0}.`);

            // Post the result back
            self.postMessage({
                type: 'path',
                path: serializedPath,
                pathfindingRequestId: pathfindingRequestId
            });

        } catch (error) {
            console.error(`[NavMeshWorker] Error in pathfinding request ${pathfindingRequestId}:`, error);
            self.postMessage({
                type: 'error',
                pathfindingRequestId: pathfindingRequestId,
                error: error.message || 'Error during pathfinding'
            });
        }
    } else if (type === 'closestPoint' && pathfindingRequestId !== undefined) {
        // Handle closest point requests
        try {
            if (!self.navMeshInstance) {
                throw new Error('NavMesh not initialized in worker');
            }

            if (!position) {
                throw new Error('Invalid closest point request. Missing position.');
            }

            // Validate position
            if (typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
                throw new Error('Invalid position data in closest point request');
            }

            const point = new YUKA.Vector3(position.x, position.y, position.z);
            const closestPoint = self.navMeshInstance.getClosestPoint(point);
            
            const result = closestPoint ? { 
                x: closestPoint.x, 
                y: closestPoint.y, 
                z: closestPoint.z 
            } : null;

            self.postMessage({
                type: 'closestPoint',
                closestPoint: result,
                pathfindingRequestId: pathfindingRequestId
            });

        } catch (error) {
            console.error(`[NavMeshWorker] Error in closest point request ${pathfindingRequestId}:`, error);
            self.postMessage({
                type: 'error',
                pathfindingRequestId: pathfindingRequestId,
                error: error.message || 'Error finding closest point'
            });
        }
    } else {
        // Handle unknown message types
        console.warn(`[NavMeshWorker] Received unknown message type:`, event.data);
        if (event.data && event.data.pathfindingRequestId !== undefined) {
            self.postMessage({
                type: 'error',
                pathfindingRequestId: event.data.pathfindingRequestId,
                error: `Unknown message type: ${event.data.type}`
            });
        }
    }
};

// Helper function to serialize NavMesh data
function serializeNavMesh(navMesh) {
    const serializedRegions = navMesh.regions.map(region => {
        const vertices = region.getContour([]);
        return {
            vertices: vertices.map(v => ({ x: v.x, y: v.y, z: v.z })),
            centroid: { x: region.centroid.x, y: region.centroid.y, z: region.centroid.z },
            plane: {
                normal: { x: region.plane.normal.x, y: region.plane.normal.y, z: region.plane.normal.z },
                constant: region.plane.constant
            },
            // Include region ID if it exists (YUKA regions might have one or be index-based)
            id: region.id !== undefined ? region.id : undefined
        };
    });

    // Serialize graph (optional, Yuka might rebuild it)
    const serializedGraph = {
        // Attempt to get nodes/edges if graph exists
        nodes: navMesh.graph ? navMesh.graph.getNodes().map(node => ({
            index: node.index,
            position: { x: node.position.x, y: node.position.y, z: node.position.z },
        })) : [],
        edges: navMesh.graph ? navMesh.graph.getEdges().map(edge => ({
            from: edge.from,
            to: edge.to,
            cost: edge.cost
        })) : []
    };

    return {
        regions: serializedRegions,
        graph: serializedGraph
    };
}

console.log("[NavMeshWorker] Worker script loaded and ready.");
