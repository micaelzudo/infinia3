import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

export class YukaSteeringDebug {
    private scene: THREE.Scene;
    private debugObjects: THREE.Object3D[] = [];
    private debugMode: boolean = false;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        this.updateDebugVisualization();
    }

    private updateDebugVisualization(): void {
        // Clear existing debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];

        if (!this.debugMode) return;

        const agent = getSelectedAgent() as IsolatedYukaCharacter;
        if (!agent) return;

        // Create steering behavior visualization
        this.createSteeringDebugVisualization(agent);
    }

    private createSteeringDebugVisualization(agent: IsolatedYukaCharacter): void {
        // Create current velocity vector
        if (agent.velocity) {
            const currentVelocityVector = new THREE.ArrowHelper(
                agent.velocity.clone().normalize(),
                agent.position,
                agent.velocity.length(),
                0xff0000
            );
            this.scene.add(currentVelocityVector);
            this.debugObjects.push(currentVelocityVector);
        }

        // Create target position marker if available
        if (agent.target) {
            const targetGeometry = new THREE.SphereGeometry(0.2, 16, 16);
            const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const targetMarker = new THREE.Mesh(targetGeometry, targetMaterial);
            targetMarker.position.copy(agent.target);
            this.scene.add(targetMarker);
            this.debugObjects.push(targetMarker);
        }

        // Create behavior visualization
        const currentState = agent.getCurrentState();
        if (currentState) {
            const behaviorGeometry = new THREE.SphereGeometry(0.1, 16, 16);
            const behaviorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const behaviorMarker = new THREE.Mesh(behaviorGeometry, behaviorMaterial);
            behaviorMarker.position.copy(agent.position);
            behaviorMarker.position.y += 1;
            this.scene.add(behaviorMarker);
            this.debugObjects.push(behaviorMarker);

            // Add behavior label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (context) {
                canvas.width = 256;
                canvas.height = 64;
                context.fillStyle = 'black';
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.font = '24px Arial';
                context.fillStyle = 'white';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(currentState, canvas.width / 2, canvas.height / 2);

                const texture = new THREE.CanvasTexture(canvas);
                const labelMaterial = new THREE.SpriteMaterial({ map: texture });
                const labelSprite = new THREE.Sprite(labelMaterial);
                labelSprite.position.copy(behaviorMarker.position);
                labelSprite.position.y += 0.2;
                labelSprite.scale.set(2, 0.5, 1);
                this.scene.add(labelSprite);
                this.debugObjects.push(labelSprite);
            }
        }
    }

    public update(): void {
        if (!this.debugMode) return;
        this.updateDebugVisualization();
    }

    public dispose(): void {
        // Clean up debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];
    }
} 