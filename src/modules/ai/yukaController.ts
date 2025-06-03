import * as THREE from 'three';
import { getSelectedAgent } from './agentService';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';

export function setAgentAIControlled(agent: IsolatedYukaCharacter, isAIControlled: boolean): void {
    if (agent) {
        agent.setAIControlled(isAIControlled);
    }
}

export function handleAgentInput(event: KeyboardEvent): void {
    const agent = getSelectedAgent() as IsolatedYukaCharacter;
    if (!agent || agent.aiControlled) return;

    const moveSpeed = 0.1;
    const rotationSpeed = 0.05;

    switch (event.key.toLowerCase()) {
        case 'w':
            agent.position.z -= moveSpeed;
            break;
        case 's':
            agent.position.z += moveSpeed;
            break;
        case 'a':
            agent.position.x -= moveSpeed;
            break;
        case 'd':
            agent.position.x += moveSpeed;
            break;
        case 'q':
            agent.rotation.y += rotationSpeed;
            break;
        case 'e':
            agent.rotation.y -= rotationSpeed;
            break;
    }
}

export function updateAgentMovement(deltaTime: number): void {
    const agent = getSelectedAgent() as IsolatedYukaCharacter;
    if (!agent) return;

    if (agent.aiControlled) {
        // Update AI-controlled movement
        agent.update(deltaTime);
    } else {
        // Update manual movement
        // This is handled by handleAgentInput
    }
}

export function initializeAgentControls(): void {
    // Add keyboard event listeners
    window.addEventListener('keydown', handleAgentInput);
}

export function cleanupAgentControls(): void {
    // Remove keyboard event listeners
    window.removeEventListener('keydown', handleAgentInput);
} 