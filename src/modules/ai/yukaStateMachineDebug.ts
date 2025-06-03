import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { createStyledButton, BUTTON_STYLE } from './yukaUICommon';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

export class YukaStateMachineDebug {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private debugMode: boolean = false;
    private debugObjects: THREE.Object3D[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        this.container = document.createElement('div');
        this.container.id = 'yuka-state-machine-debug';
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
        const debugButton = createStyledButton('Toggle State Machine Debug', () => {
            this.debugMode = !this.debugMode;
            debugButton.textContent = this.debugMode ? 'Disable State Machine Debug' : 'Enable State Machine Debug';
            this.updateDebugVisualization();
        });
        this.container.appendChild(debugButton);

        // Create state info display
        const stateInfo = document.createElement('div');
        stateInfo.id = 'state-info';
        stateInfo.style.marginTop = '10px';
        stateInfo.style.fontSize = '12px';
        this.container.appendChild(stateInfo);
    }

    private updateDebugVisualization(): void {
        // Clear existing debug objects
        this.debugObjects.forEach(obj => this.scene.remove(obj));
        this.debugObjects = [];

        if (!this.debugMode) return;

        const agent = getSelectedAgent() as IsolatedYukaCharacter;
        if (!agent) return;

        // Create state visualization
        this.createStateDebugVisualization(agent);
    }

    private createStateDebugVisualization(agent: IsolatedYukaCharacter): void {
        const currentState = agent.getCurrentState();
        const behaviors = ['arrive', 'seek', 'wander', 'avoid', 'separation', 'alignment', 'cohesion'];

        // Create state visualization
        behaviors.forEach((behaviorName, index) => {
            const isCurrentState = behaviorName === currentState;
            const color = isCurrentState ? 0x00ff00 : 0xffffff;
            const position = new THREE.Vector3(
                agent.position.x + (index - behaviors.length / 2) * 2,
                agent.position.y + 2,
                agent.position.z
            );

            // Create state sphere
            const stateGeometry = new THREE.SphereGeometry(0.3, 16, 16);
            const stateMaterial = new THREE.MeshBasicMaterial({ color });
            const stateSphere = new THREE.Mesh(stateGeometry, stateMaterial);
            stateSphere.position.copy(position);
            this.scene.add(stateSphere);
            this.debugObjects.push(stateSphere);

            // Create state label
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
                context.fillText(behaviorName, canvas.width / 2, canvas.height / 2);

                const texture = new THREE.CanvasTexture(canvas);
                const labelMaterial = new THREE.SpriteMaterial({ map: texture });
                const labelSprite = new THREE.Sprite(labelMaterial);
                labelSprite.position.copy(position);
                labelSprite.position.y += 0.5;
                labelSprite.scale.set(2, 0.5, 1);
                this.scene.add(labelSprite);
                this.debugObjects.push(labelSprite);
            }
        });
    }

    public update(): void {
        if (!this.debugMode) return;

        const agent = getSelectedAgent() as IsolatedYukaCharacter;
        if (!agent) return;

        // Update state info display
        const stateInfo = document.getElementById('state-info');
        if (stateInfo) {
            const currentState = agent.getCurrentState();
            const behaviors = ['arrive', 'seek', 'wander', 'avoid', 'separation', 'alignment', 'cohesion'];

            stateInfo.innerHTML = `
                <div>Current State: ${currentState}</div>
                <div>Available Behaviors:</div>
                <ul>
                    ${behaviors.map(behavior => `
                        <li>${behavior}${behavior === currentState ? ' (current)' : ''}</li>
                    `).join('')}
                </ul>
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