import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';

export class YukaDebugger {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private debugMode: boolean = false;
    private debugObjects: THREE.Object3D[] = [];

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;

        this.container = document.createElement('div');
        this.container.id = 'yuka-debugger';
        this.container.style.position = 'absolute';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.zIndex = '1000';

        this.initializeDebugger();
    }

    private initializeDebugger(): void {
        // Create debug mode toggle button
        const debugButton = createStyledButton('Toggle Debug Mode', () => {
            this.debugMode = !this.debugMode;
            debugButton.textContent = this.debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode';
            this.updateDebugVisualization();
        });
        this.container.appendChild(debugButton);

        // Create debug info display
        const debugInfo = document.createElement('div');
        debugInfo.id = 'debug-info';
        debugInfo.style.marginTop = '10px';
        debugInfo.style.fontSize = '12px';
        this.container.appendChild(debugInfo);
    }

    private updateDebugVisualization(): void {
        // Clear existing debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];

        if (!this.debugMode) return;

        const agent = getSelectedAgent();
        if (!agent) return;

        // Create debug visualization for agent
        this.createAgentDebugVisualization(agent);
    }

    private createAgentDebugVisualization(agent: any): void {
        // Create velocity vector visualization
        const velocityVector = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            agent.position,
            agent.maxSpeed,
            0xff0000
        );
        this.scene.add(velocityVector);
        this.debugObjects.push(velocityVector);

        // Create rotation visualization
        const rotationHelper = new THREE.AxesHelper(1);
        rotationHelper.position.copy(agent.position);
        this.scene.add(rotationHelper);
        this.debugObjects.push(rotationHelper);

        // Create path visualization if available
        if (agent.path) {
            const pathGeometry = new THREE.BufferGeometry();
            const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            const pathPoints = agent.path.map((point: THREE.Vector3) => new THREE.Vector3(point.x, point.y, point.z));
            pathGeometry.setFromPoints(pathPoints);
            const pathLine = new THREE.Line(pathGeometry, pathMaterial);
            this.scene.add(pathLine);
            this.debugObjects.push(pathLine);
        }
    }

    public update(): void {
        if (!this.debugMode) return;

        const agent = getSelectedAgent();
        if (!agent) return;

        // Update debug info display
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = `
                <div>Position: (${agent.position.x.toFixed(2)}, ${agent.position.y.toFixed(2)}, ${agent.position.z.toFixed(2)})</div>
                <div>Velocity: (${agent.velocity.x.toFixed(2)}, ${agent.velocity.y.toFixed(2)}, ${agent.velocity.z.toFixed(2)})</div>
                <div>Speed: ${agent.velocity.length().toFixed(2)}</div>
                <div>AI Controlled: ${agent.aiControlled ? 'Yes' : 'No'}</div>
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