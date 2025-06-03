import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

export class YukaPathEditor {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private raycaster: THREE.Raycaster;
    private mouse: THREE.Vector2;
    private pathPoints: THREE.Vector3[] = [];
    private pathLine: THREE.Line | null = null;
    private pathPointMarkers: THREE.Mesh[] = [];
    private isEditing: boolean = false;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.container = document.createElement('div');
        this.container.id = 'yuka-path-editor';
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.zIndex = '1000';

        this.initializeEditor();
    }

    private initializeEditor(): void {
        // Create edit mode toggle button
        const editButton = createStyledButton('Toggle Path Editing', () => {
            this.isEditing = !this.isEditing;
            editButton.textContent = this.isEditing ? 'Disable Path Editing' : 'Enable Path Editing';
            this.updatePathVisualization();
        });
        this.container.appendChild(editButton);

        // Create clear path button
        const clearButton = createStyledButton('Clear Path', () => {
            this.clearPath();
        });
        this.container.appendChild(clearButton);

        // Create apply path button
        const applyButton = createStyledButton('Apply Path', () => {
            this.applyPathToAgent();
        });
        this.container.appendChild(applyButton);

        // Add event listeners
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
    }

    private onMouseDown(event: MouseEvent): void {
        if (!this.isEditing) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.addPathPoint(point);
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isEditing) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            this.updatePathPreview(point);
        }
    }

    private addPathPoint(point: THREE.Vector3): void {
        this.pathPoints.push(point.clone());
        this.updatePathVisualization();
    }

    private updatePathPreview(point: THREE.Vector3): void {
        if (this.pathPoints.length > 0) {
            const lastPoint = this.pathPoints[this.pathPoints.length - 1];
            const previewGeometry = new THREE.BufferGeometry();
            const previewMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, dashed: true });
            const previewPoints = [lastPoint, point];
            previewGeometry.setFromPoints(previewPoints);
            const previewLine = new THREE.Line(previewGeometry, previewMaterial);
            this.scene.add(previewLine);
            requestAnimationFrame(() => this.scene.remove(previewLine));
        }
    }

    private updatePathVisualization(): void {
        // Clear existing path visualization
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
        }
        this.pathPointMarkers.forEach(marker => this.scene.remove(marker));
        this.pathPointMarkers = [];

        if (this.pathPoints.length > 0) {
            // Create path line
            const pathGeometry = new THREE.BufferGeometry();
            const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            pathGeometry.setFromPoints(this.pathPoints);
            this.pathLine = new THREE.Line(pathGeometry, pathMaterial);
            this.scene.add(this.pathLine);

            // Create path point markers
            this.pathPoints.forEach((point, index) => {
                const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
                const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                marker.position.copy(point);
                this.scene.add(marker);
                this.pathPointMarkers.push(marker);

                // Add point number label
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
                    context.fillText(index.toString(), canvas.width / 2, canvas.height / 2);

                    const texture = new THREE.CanvasTexture(canvas);
                    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
                    const labelSprite = new THREE.Sprite(labelMaterial);
                    labelSprite.position.copy(point);
                    labelSprite.position.y += 0.5;
                    labelSprite.scale.set(0.5, 0.5, 1);
                    this.scene.add(labelSprite);
                    this.pathPointMarkers.push(labelSprite);
                }
            });
        }
    }

    private clearPath(): void {
        this.pathPoints = [];
        this.updatePathVisualization();
    }

    private applyPathToAgent(): void {
        const agent = getSelectedAgent() as IsolatedYukaCharacter;
        if (agent && this.pathPoints.length > 0) {
            // Set the first point as the target
            const target = new THREE.Vector3(
                this.pathPoints[0].x,
                this.pathPoints[0].y,
                this.pathPoints[0].z
            );
            agent.setTarget(target);
        }
    }

    public getContainer(): HTMLElement {
        return this.container;
    }

    public dispose(): void {
        // Remove event listeners
        window.removeEventListener('mousedown', this.onMouseDown.bind(this));
        window.removeEventListener('mousemove', this.onMouseMove.bind(this));

        // Clean up path visualization
        if (this.pathLine) {
            this.scene.remove(this.pathLine);
        }
        this.pathPointMarkers.forEach(marker => this.scene.remove(marker));
        this.pathPointMarkers = [];
        this.pathPoints = [];
    }
} 