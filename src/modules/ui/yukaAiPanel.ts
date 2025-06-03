import * as THREE from 'three';
import { createStyledButton, BUTTON_STYLE } from '../ai/yukaUICommon';
import { YukaAIControls } from '../ai/yukaAIControls';
import { YukaDebugger } from '../ai/yukaDebugger';
import { YukaSteeringDebug } from '../ai/yukaSteeringDebug';
import { YukaStateMachineDebug } from '../ai/yukaStateMachineDebug';
import { YukaPathEditor } from '../ai/yukaPathEditor';
import { YukaNavMeshHelper } from '../ai/yukaNavMeshHelper';
import { getAgents, getSelectedAgent, selectAgent, spawnAgent, removeAgent, onAgentChange } from '../ai/agentService';
import { on as onEvent, emit as emitEvent } from '../ai/eventBus';
import { setIsYukaSystemPaused, getIsYukaSystemPaused } from '../ai/yukaManager';
import { setAgentAIControlled } from '../ai/yukaController';
import { isMobile, isTablet } from '../../../utils/deviceUtils';

declare global {
    interface Window {
        isolatedTerrainViewer?: any;
    }
}

let yukaPanelInstance: HTMLElement | null = null;
let yukaControls: YukaAIControls | null = null;
let yukaDebugger: YukaDebugger | null = null;
let steeringDebug: YukaSteeringDebug | null = null;
let stateMachineDebug: YukaStateMachineDebug | null = null;
let pathEditor: YukaPathEditor | null = null;
let navMeshHelper: YukaNavMeshHelper | null = null;

export interface YukaAIPanelOptions {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    agent: any;
    navMesh: any;
    chunkMeshes: Record<string, THREE.Mesh>;
    container?: HTMLElement;
    spawnAgent?: () => Promise<any>;
}

export function createYukaAIPanel(container: HTMLElement, options: YukaAIPanelOptions): HTMLElement {
    if (yukaPanelInstance) {
        return yukaPanelInstance;
    }

    const panel = document.createElement('div');
    panel.id = 'yuka-ai-panel';
    // Base styles
    panel.style.position = 'fixed';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    panel.style.padding = '12px';
    panel.style.borderRadius = '8px';
    panel.style.color = 'white';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.zIndex = '1000';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '8px';
    panel.style.maxWidth = '300px';
    panel.style.overflow = 'auto';
    panel.style.maxHeight = '90vh';

    // Responsive positioning
    if (isMobile() || isTablet()) {
        // Mobile/Tablet styles
        panel.style.bottom = '10px';
        panel.style.left = '10px';
        panel.style.right = 'auto';
        panel.style.top = 'auto';
        panel.style.width = 'calc(100% - 40px)';
        panel.style.maxHeight = '40vh';
        panel.style.fontSize = '16px';

        // Make buttons larger for touch
        const style = document.createElement('style');
        style.textContent = `
            #yuka-ai-panel button {
                min-height: 48px;
                padding: 12px 16px;
                font-size: 16px;
                margin: 4px 0;
            }
        `;
        document.head.appendChild(style);
    } else {
        // Desktop styles
        panel.style.top = '10px';
        panel.style.right = '10px';
        panel.style.width = 'auto';
    }

    // Create spawn button with touch support
    const spawnButton = createStyledButton('Spawn Agent', async (e) => {
        // Prevent default to avoid any touch delay
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        try {
            const agent = await spawnAgent();
            if (agent) {
                console.log('Agent spawned successfully');
            } else {
                console.error('Failed to spawn agent');
            }
        } catch (error) {
            console.error('Error spawning agent:', error);
        }
    });
    panel.appendChild(spawnButton);

    // Create remove button with touch support
    const removeButton = createStyledButton('Remove Agent', (e) => {
        // Prevent default to avoid any touch delay
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const selectedAgent = getSelectedAgent();
        if (selectedAgent) {
            removeAgent(selectedAgent);
        }
    });
    panel.appendChild(removeButton);

    // Create pause/resume button with touch support
    const pauseResumeButton = createStyledButton(
        getIsYukaSystemPaused() ? 'Resume System' : 'Pause System',
        (e) => {
            // Prevent default to avoid any touch delay
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            setIsYukaSystemPaused(!getIsYukaSystemPaused());
            pauseResumeButton.textContent = getIsYukaSystemPaused() ? 'Resume System' : 'Pause System';
        }
    );
    panel.appendChild(pauseResumeButton);

    // Add event listeners
    onAgentChange((agents, selected) => {
        removeButton.disabled = !selected;
    });

    // Initialize debug tools if needed
    if (options.enableDebugger) {
        yukaDebugger = new YukaDebugger(options.scene, options.camera);
        steeringDebug = new YukaSteeringDebug(options.scene);
        stateMachineDebug = new YukaStateMachineDebug(options.scene);
        pathEditor = new YukaPathEditor(options.scene);
        navMeshHelper = new YukaNavMeshHelper(options.scene);
    }

    // Add to container
    if (options.container) {
        options.container.appendChild(panel);
    } else {
        container.appendChild(panel);
    }

    yukaPanelInstance = panel;
    return panel;
} 