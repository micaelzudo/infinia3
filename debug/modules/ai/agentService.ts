import * as THREE from 'three';
import { yukaEntityManager } from './yukaManager';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { spawnYukaAgent as controllerSpawnYukaAgent } from './yukaController';

// Simple event emitter
const listeners: ((agents: IsolatedYukaCharacter[], selected: IsolatedYukaCharacter | null) => void)[] = [];
let selectedAgent: IsolatedYukaCharacter | null = null;

export function getAgents(): IsolatedYukaCharacter[] {
    return (yukaEntityManager as any).entities.filter((e: any) => e instanceof IsolatedYukaCharacter);
}

export function getSelectedAgent(): IsolatedYukaCharacter | null {
    return selectedAgent;
}

export function selectAgent(agent: IsolatedYukaCharacter | null) {
    selectedAgent = agent;
    emitChange();
}

export async function spawnAgent(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement, position?: THREE.Vector3, name?: string, aiControlled: boolean = true): Promise<IsolatedYukaCharacter | null> {
    if (!scene || !camera || !domElement) {
        console.error('Scene, camera, and DOM element are required for spawning Yuka agents');
        return null;
    }
    try {
        const spawnPosition = position || new THREE.Vector3(0, 0, 0);
        const agent = await controllerSpawnYukaAgent(spawnPosition, scene, camera, domElement);
        if (agent) {
            // Set AI control
            agent.setAIControlled(aiControlled);
            
            // Initialize with patrol state if AI controlled
            if (aiControlled && agent.stateMachine && typeof agent.stateMachine.changeState === 'function') {
                const PatrolState = (window as any).PatrolState;
                if (PatrolState) {
                    try {
                        agent.stateMachine.changeState(new PatrolState());
                    } catch (error) {
                        console.warn('[AgentService] Failed to initialize patrol state:', error);
                    }
                }
            }
            
            selectAgent(agent);
            console.log(`[AgentService] Spawned agent at position:`, spawnPosition, `AI Controlled: ${aiControlled}`);
        }
        return agent;
    } catch (error) {
        console.error('Error spawning Yuka agent:', error);
        return null;
    }
}

export function removeAgent(agent: IsolatedYukaCharacter) {
    (yukaEntityManager as any).remove(agent);
    if (selectedAgent === agent) {
        selectedAgent = null;
    }
    emitChange();
}

// Enhanced AI management functions
export function setAllAgentsAIControl(enabled: boolean): void {
    const agents = getAgents();
    agents.forEach(agent => {
        agent.setAIControlled(enabled);
    });
    console.log(`[AgentService] Set AI control to ${enabled} for all agents`);
}

export function getAgentsByState(stateName: string): IsolatedYukaCharacter[] {
    const agents = getAgents();
    return agents.filter(agent => {
        return agent.stateMachine?.currentState?.name === stateName;
    });
}

export function getAIControlledAgents(): IsolatedYukaCharacter[] {
    const agents = getAgents();
    return agents.filter(agent => agent.isAIControlled);
}

export function getAgentsInRange(position: THREE.Vector3, range: number): IsolatedYukaCharacter[] {
    const agents = getAgents();
    return agents.filter(agent => {
        const distance = agent.position.distanceTo(new (window as any).YUKA.Vector3(position.x, position.y, position.z));
        return distance <= range;
    });
}

export function alertAgentsInRange(position: THREE.Vector3, range: number, alertLevel: number = 0.8): void {
    const agentsInRange = getAgentsInRange(position, range);
    agentsInRange.forEach(agent => {
        if (agent.isAIControlled && agent.memorySystem) {
            // Add memory record of disturbance
            const YUKA = (window as any).YUKA;
            const memoryRecord = new YUKA.MemoryRecord();
            memoryRecord.entity = null; // No specific entity, just a disturbance
            memoryRecord.timeStamp = Date.now();
            memoryRecord.visible = false;
            agent.memorySystem.createRecord(memoryRecord);
            
            // Increase alert level
            if (agent.alertLevel !== undefined) {
                agent.alertLevel = Math.min(1.0, agent.alertLevel + alertLevel);
            }
        }
    });
    console.log(`[AgentService] Alerted ${agentsInRange.length} agents in range ${range} from position:`, position);
}

export function makeAgentChaseTarget(agent: IsolatedYukaCharacter, target: THREE.Vector3): boolean {
    if (agent && agent.stateMachine) {
        const ChaseState = (window as any).ChaseState;
        if (ChaseState) {
            const chaseState = new ChaseState();
            chaseState.setTarget(target);
            agent.stateMachine.changeState(chaseState);
            console.log(`[AgentService] Agent now chasing target:`, target);
            return true;
        }
    }
    return false;
}

export function makeAgentFleeFromThreat(agent: IsolatedYukaCharacter, threat: THREE.Vector3): boolean {
    if (agent && agent.stateMachine) {
        const FleeState = (window as any).FleeState;
        if (FleeState) {
            const fleeState = new FleeState();
            fleeState.setThreat(threat);
            agent.stateMachine.changeState(fleeState);
            console.log(`[AgentService] Agent now fleeing from threat:`, threat);
            return true;
        }
    }
    return false;
}

export function onAgentChange(cb: (agents: IsolatedYukaCharacter[], selected: IsolatedYukaCharacter | null) => void) {
    listeners.push(cb);
}

function emitChange() {
    const agents = getAgents();
    listeners.forEach(cb => cb(agents, selectedAgent));
}