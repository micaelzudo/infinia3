import { getEntityManager } from './yukaManager';
import { IsolatedYukaCharacter } from './isolatedYukaCharacter';
import { spawnYukaAgent as controllerSpawnYukaAgent } from './aiAgentManager';

// Simple event emitter
const listeners: ((agents: IsolatedYukaCharacter[], selected: IsolatedYukaCharacter | null) => void)[] = [];
let selectedAgent: IsolatedYukaCharacter | null = null;

export function getAgents(): IsolatedYukaCharacter[] {
    const entityManager = getEntityManager();
    if (!entityManager) return [];
    return entityManager.entities.filter((e: any) => e instanceof IsolatedYukaCharacter);
}

export function getSelectedAgent(): IsolatedYukaCharacter | null {
    return selectedAgent;
}

export function selectAgent(agent: IsolatedYukaCharacter | null): void {
    selectedAgent = agent;
    console.log('[agentService] Agent selected:', selectedAgent);
    notifyListeners();
}

export function onAgentChange(listener: (agents: IsolatedYukaCharacter[], selected: IsolatedYukaCharacter | null) => void): void {
    listeners.push(listener);
}

function notifyListeners(): void {
    const agents = getAgents();
    listeners.forEach(listener => listener(agents, selectedAgent));
}

export async function spawnAgent(...args: any[]): Promise<IsolatedYukaCharacter | null> {
    const agent = await controllerSpawnYukaAgent(...args);
    if (agent) selectAgent(agent);
    return agent;
}

export function removeAgent(agent: IsolatedYukaCharacter): void {
    if (agent === selectedAgent) {
        selectedAgent = null;
    }
    agent.dispose();
    notifyListeners();
} 