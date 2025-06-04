// NavMesh Worker - Simplified implementation without external dependencies
// This worker handles NavMesh generation without relying on external CDN loading

// Simple NavMesh data structures
class SimpleVector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    
    set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }
    
    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    
    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
        return this;
    }
    
    normalize() {
        const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (length > 0) {
            this.x /= length;
            this.y /= length;
            this.z /= length;
        }
        return this;
    }
    
    cross(v) {
        const x = this.y * v.z - this.z * v.y;
        const y = this.z * v.x - this.x * v.z;
        const z = this.x * v.y - this.y * v.x;
        return new SimpleVector3(x, y, z);
    }
    
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
    
    clone() {
        return new SimpleVector3(this.x, this.y, this.z);
    }
}

class SimplePlane {
    constructor() {
        this.normal = new SimpleVector3(0, 1, 0);
        this.constant = 0;
    }
    
    setFromCoplanarPoints(a, b, c) {
        const v1 = new SimpleVector3().copy(c).add(new SimpleVector3().copy(a).multiplyScalar(-1));
        const v2 = new SimpleVector3().copy(b).add(new SimpleVector3().copy(a).multiplyScalar(-1));
        
        this.normal = v1.cross(v2).normalize();
        this.constant = -a.dot(this.normal);
        
        return this;
    }
}

class SimplePolygon {
    constructor() {
        this.vertices = [];
        this.centroid = new SimpleVector3();
        this.plane = new SimplePlane();
    }
    
    fromContour(vertices) {
        this.vertices = vertices.map(v => v.clone());
        
        // Calculate centroid
        this.centroid.set(0, 0, 0);
        for (const vertex of this.vertices) {
            this.centroid.add(vertex);
        }
        this.centroid.multiplyScalar(1 / this.vertices.length);
        
        // Calculate plane
        if (this.vertices.length >= 3) {
            this.plane.setFromCoplanarPoints(
                this.vertices[0],
                this.vertices[1],
                this.vertices[2]
            );
        }
        
        return this;
    }
    
    serialize() {
        return {
            vertices: this.vertices.map(v => ({ x: v.x, y: v.y, z: v.z })),
            centroid: { x: this.centroid.x, y: this.centroid.y, z: this.centroid.z },
            plane: {
                normal: { x: this.plane.normal.x, y: this.plane.normal.y, z: this.plane.normal.z },
                constant: this.plane.constant
            }
        };
    }
}

// Simple NavMesh generation
function generateSimpleNavMesh(geometryData) {
    const regions = [];
    
    // Process geometry data in chunks of 9 (3 vertices per triangle)
    for (let i = 0; i < geometryData.length; i += 9) {
        if (i + 8 >= geometryData.length) break;
        
        const v1 = new SimpleVector3(geometryData[i], geometryData[i + 1], geometryData[i + 2]);
        const v2 = new SimpleVector3(geometryData[i + 3], geometryData[i + 4], geometryData[i + 5]);
        const v3 = new SimpleVector3(geometryData[i + 6], geometryData[i + 7], geometryData[i + 8]);
        
        // Create polygon
        const polygon = new SimplePolygon();
        polygon.fromContour([v1, v2, v3]);
        
        regions.push(polygon.serialize());
    }
    
    return {
        regions: regions,
        graph: {
            nodes: [],
            edges: []
        }
    };
}

// Worker message handler
self.onmessage = function(event) {
    const { type, geometryData, polygons, navMeshId, from, to, position } = event.data;
    
    try {
        if (type === 'navmesh' && navMeshId) {
            console.log(`[SimpleNavMeshWorker] Processing NavMesh generation for ID: ${navMeshId}`);
            
            let navMeshData;
            
            if (geometryData && Array.isArray(geometryData)) {
                // Process raw geometry data
                navMeshData = generateSimpleNavMesh(geometryData);
            } else if (polygons && Array.isArray(polygons)) {
                // Process pre-processed polygons
                const regions = polygons.map(polyData => {
                    if (!polyData.vertices || !Array.isArray(polyData.vertices)) {
                        return null;
                    }
                    
                    const vertices = polyData.vertices.map(v => new SimpleVector3(v.x, v.y, v.z));
                    const polygon = new SimplePolygon();
                    polygon.fromContour(vertices);
                    return polygon.serialize();
                }).filter(r => r !== null);
                
                navMeshData = {
                    regions: regions,
                    graph: {
                        nodes: [],
                        edges: []
                    }
                };
            } else {
                throw new Error('No valid geometry data or polygons provided');
            }
            
            console.log(`[SimpleNavMeshWorker] Generated NavMesh with ${navMeshData.regions.length} regions`);
            
            // Send result back to main thread
            self.postMessage({
                type: 'navmesh',
                navMeshId: navMeshId,
                navMeshData: navMeshData
            });
            
        } else if (type === 'path' && from && to) {
            // Simple pathfinding - just return direct path for now
            const path = [from, to];
            
            self.postMessage({
                type: 'path',
                pathfindingRequestId: event.data.pathfindingRequestId,
                path: path
            });
            
        } else if (type === 'closestPoint' && position) {
            // Simple closest point - just return the input position for now
            self.postMessage({
                type: 'closestPoint',
                closestPointRequestId: event.data.closestPointRequestId,
                closestPoint: position
            });
            
        } else {
            console.warn('[SimpleNavMeshWorker] Unknown message type or missing data:', type);
        }
        
    } catch (error) {
        console.error('[SimpleNavMeshWorker] Error processing message:', error);
        self.postMessage({
            type: 'error',
            navMeshId: navMeshId,
            error: error.message
        });
    }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });
console.log('[SimpleNavMeshWorker] Worker initialized and ready');
