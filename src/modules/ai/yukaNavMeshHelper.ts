import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';

export class YukaNavMeshHelper {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private navMesh: any;
    private debugMode: boolean = false;
    private debugObjects: THREE.Object3D[] = [];

    constructor(scene: THREE.Scene, navMesh: any) {
        this.scene = scene;
        this.navMesh = navMesh;

        this.container = document.createElement('div');
        this.container.id = 'yuka-nav-mesh-helper';
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.zIndex = '1000';

        this.initializeHelper();
    }

    private initializeHelper(): void {
        // Create debug mode toggle button
        const debugButton = createStyledButton('Toggle NavMesh Debug', () => {
            this.debugMode = !this.debugMode;
            debugButton.textContent = this.debugMode ? 'Disable NavMesh Debug' : 'Enable NavMesh Debug';
            this.updateDebugVisualization();
        });
        this.container.appendChild(debugButton);

        // Create navmesh info display
        const navMeshInfo = document.createElement('div');
        navMeshInfo.id = 'navmesh-info';
        navMeshInfo.style.marginTop = '10px';
        navMeshInfo.style.fontSize = '12px';
        this.container.appendChild(navMeshInfo);
    }

    private updateDebugVisualization(): void {
        // Clear existing debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];

        if (!this.debugMode || !this.navMesh) return;

        // Create navmesh visualization
        this.createNavMeshDebugVisualization();
    }

    private createNavMeshDebugVisualization(): void {
        if (!this.navMesh) return;

        // Create polygon visualization
        this.navMesh.polygons.forEach((polygon: any) => {
            const vertices = polygon.vertices;
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

            // Create polygon edges
            const edges = [];
            for (let i = 0; i < vertices.length; i++) {
                const start = vertices[i];
                const end = vertices[(i + 1) % vertices.length];
                edges.push(start, end);
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(edges.flatMap(v => [v.x, v.y, v.z]), 3));
            const line = new THREE.LineSegments(geometry, material);
            this.scene.add(line);
            this.debugObjects.push(line);

            // Create polygon center marker
            const center = new THREE.Vector3();
            vertices.forEach((v: THREE.Vector3) => center.add(v));
            center.divideScalar(vertices.length);

            const markerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.copy(center);
            this.scene.add(marker);
            this.debugObjects.push(marker);

            // Create polygon ID label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                canvas.width = 64;
                canvas.height = 64;
                context.fillStyle = 'black';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.font = '24px Arial';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(polygon.id.toString(), canvas.width / 2, canvas.height / 2);

                const texture = new THREE.CanvasTexture(canvas);
                const labelMaterial = new THREE.SpriteMaterial({ map: texture });
                const labelSprite = new THREE.Sprite(labelMaterial);
                labelSprite.position.copy(center);
                labelSprite.position.y += 0.2;
                labelSprite.scale.set(0.5, 0.5, 1);
                this.scene.add(labelSprite);
                this.debugObjects.push(labelSprite);
            }
        });

        // Create portal visualization
        this.navMesh.portals.forEach((portal: any) => {
            const start = portal.start;
            const end = portal.end;

            const geometry = new THREE.BufferGeometry();
            const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
            const points = [start, end];
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(v => [v.x, v.y, v.z]), 3));
            const line = new THREE.Line(geometry, material);
            this.scene.add(line);
            this.debugObjects.push(line);
        });
    }

    public update(): void {
        if (!this.debugMode) return;

        // Update navmesh info display
        const navMeshInfo = document.getElementById('navmesh-info');
        if (navMeshInfo && this.navMesh) {
            navMeshInfo.innerHTML = `
                <div>Polygons: ${this.navMesh.polygons.length}</div>
                <div>Portals: ${this.navMesh.portals.length}</div>
                <div>Vertices: ${this.navMesh.vertices.length}</div>
            `;
        }

        // Update debug visualization
        this.updateDebugVisualization();
    }

    public getContainer(): HTMLElement {
        return this.container;
    }

    public dispose(): void {
        // Clean up debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];
    }
} 