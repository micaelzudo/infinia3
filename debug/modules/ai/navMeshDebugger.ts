import * as THREE from 'three';
import * as YUKA from 'yuka';

const DEBUG_GROUP_NAME = 'NavMeshDebugObjects';

function getDebugGroup(scene: THREE.Scene): THREE.Group {
    let group = scene.getObjectByName(DEBUG_GROUP_NAME) as THREE.Group;
    if (!group) {
        group = new THREE.Group();
        group.name = DEBUG_GROUP_NAME;
        scene.add(group);
    }
    return group;
}

export function clearNavMeshDebug(scene: THREE.Scene): void {
    const group = scene.getObjectByName(DEBUG_GROUP_NAME);
    if (group) {
        while (group.children.length > 0) {
            const child = group.children[0];
            if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
            group.remove(child);
        }
        scene.remove(group);
    }
}

export function visualizeNavMeshPolygons(scene: THREE.Scene, navMesh: YUKA.NavMesh | null, color: number = 0x00ff00, wireframe: boolean = true): void {
    if (!navMesh) {
        console.warn('[NavMeshDebugger] NavMesh is null, cannot visualize.');
        return;
    }

    const debugGroup = getDebugGroup(scene);
    // Clear previous polygons if any
    const toRemove: THREE.Object3D[] = [];
    debugGroup.children.forEach(child => {
        if (child.userData.type === 'navMeshPolygon') {
            toRemove.push(child);
        }
    });
    toRemove.forEach(child => {
         if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
            } else {
                child.material?.dispose();
            }
        }
        debugGroup.remove(child)
    });

    const material = new THREE.MeshBasicMaterial({ color, wireframe, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });

    navMesh.regions.forEach((region, index) => {
        const points = region.polygon.map(v => new THREE.Vector3(v.x, v.y + 0.05, v.z)); // Add small Y offset for visibility

        if (points.length >= 3) {
            // Create a shape for the polygon
            const shape = new THREE.Shape();
            shape.moveTo(points[0].x, points[0].z);
            for (let i = 1; i < points.length; i++) {
                shape.lineTo(points[i].x, points[i].z);
            }
            shape.closePath();

            const geometry = new THREE.ShapeGeometry(shape);
            // Rotate to lay flat on XZ plane, then move to correct Y
            geometry.rotateX(Math.PI / 2);
            
            // Calculate average Y for correct height placement
            let avgY = 0;
            points.forEach(p => avgY += p.y);
            avgY /= points.length;
            geometry.translate(0, avgY, 0);


            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData.type = 'navMeshPolygon';
            mesh.userData.regionIndex = index;
            debugGroup.add(mesh);

            // Add outline
            const outlinePoints = points.map(p => p.clone());
            if (outlinePoints.length > 0) outlinePoints.push(outlinePoints[0].clone()); // Close the loop
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData.type = 'navMeshPolygon'; // Also tag for removal
            debugGroup.add(line);
        }
    });
    console.log(`[NavMeshDebugger] Visualized ${navMesh.regions.length} NavMesh polygons.`);
}

export function visualizePath(scene: THREE.Scene, pathPoints: THREE.Vector3[], color: number = 0xff0000, clearPrevious: boolean = true): void {
    const debugGroup = getDebugGroup(scene);
    if (clearPrevious) {
        const toRemove: THREE.Object3D[] = [];
        debugGroup.children.forEach(child => {
            if (child.userData.type === 'navPathLine' || child.userData.type === 'navPathPoint') {
                toRemove.push(child);
            }
        });
        toRemove.forEach(child => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                child.geometry?.dispose();
                 if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
            debugGroup.remove(child);
        });
    }

    if (pathPoints.length < 2) return;

    const material = new THREE.LineBasicMaterial({ color, linewidth: 3 });
    const geometry = new THREE.BufferGeometry().setFromPoints(pathPoints.map(p => p.clone().setY(p.y + 0.1))); // Elevate slightly
    const line = new THREE.Line(geometry, material);
    line.userData.type = 'navPathLine';
    debugGroup.add(line);

    // Visualize points
    pathPoints.forEach(p => visualizePoint(scene, p, color, 0.2, false));
}

export function visualizePoint(scene: THREE.Scene, point: THREE.Vector3, color: number = 0xffff00, size: number = 0.25, clearPreviousOfType: boolean = true, tag: string = 'debugPoint'): void {
    const debugGroup = getDebugGroup(scene);

    if (clearPreviousOfType) {
         const toRemove: THREE.Object3D[] = [];
        debugGroup.children.forEach(child => {
            if (child.userData.type === tag) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(child => {
             if (child instanceof THREE.Mesh) { // Points are meshes
                child.geometry?.dispose();
                child.material?.dispose();
            }
            debugGroup.remove(child)
        });
    }

    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point).setY(point.y + size / 2 + 0.05); // Elevate slightly
    sphere.userData.type = tag;
    debugGroup.add(sphere);
} 