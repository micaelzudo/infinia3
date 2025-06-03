import * as THREE from 'three';
import { ResourceInventory, createInventory, getResourcesArray } from '../../mining/resourceInventory';
import { MiningTool, MiningToolType, createDefaultTools, mineAtPoint, damageTool } from '../../mining/miningSystem';
import { mineAreaAtPoint, AreaMiningResult } from '../../mining/areaMiningSystem';
import { ResourceCalculationResult, estimateTotalResources, calculateTotalResourceUnits } from '../../mining/resourceCalculator';
import { getScene } from './core';

// Mining state
let playerInventory: ResourceInventory = createInventory(100);
let miningTools: { [key in MiningToolType]: MiningTool } = createDefaultTools();
let activeTool: MiningToolType = MiningToolType.HAND;
let resourceCalculationResult: ResourceCalculationResult | null = null;
let miningEffectsContainer: HTMLElement | null = null;
let miningPanelVisible = false;

// UI Elements
let miningPanelContainer: HTMLElement | null = null;
let resourceStatsPanel: HTMLElement | null = null;
let miningInfoPanel: HTMLElement | null = null;
let inventoryPanel: HTMLElement | null = null;

// Mining effects
const miningParticles: THREE.Points[] = [];
const MAX_PARTICLES = 1000;
const PARTICLE_LIFETIME = 2000; // ms

export function initMining(container: HTMLElement) {
    miningPanelContainer = container;
    createMiningUI();
}

function createMiningUI() {
    if (!miningPanelContainer) return;

    // Create panels
    resourceStatsPanel = document.createElement('div');
    miningInfoPanel = document.createElement('div');
    inventoryPanel = document.createElement('div');
    miningEffectsContainer = document.createElement('div');

    // Style panels
    const panelStyle = {
        position: 'absolute',
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        borderRadius: '5px',
        fontFamily: 'Arial, sans-serif',
    };

    Object.assign(resourceStatsPanel.style, panelStyle, { top: '10px', right: '10px' });
    Object.assign(miningInfoPanel.style, panelStyle, { bottom: '10px', left: '10px' });
    Object.assign(inventoryPanel.style, panelStyle, { top: '10px', left: '10px' });
    Object.assign(miningEffectsContainer.style, { position: 'absolute', pointerEvents: 'none' });

    // Add panels to container
    miningPanelContainer.appendChild(resourceStatsPanel);
    miningPanelContainer.appendChild(miningInfoPanel);
    miningPanelContainer.appendChild(inventoryPanel);
    miningPanelContainer.appendChild(miningEffectsContainer);

    // Initial update
    updateMiningUI();
}

export function updateMiningUI() {
    if (!resourceStatsPanel || !miningInfoPanel || !inventoryPanel) return;

    // Update resource stats
    const resources = getResourcesArray(playerInventory);
    resourceStatsPanel.innerHTML = resources
        .map(resource => `${resource.name}: ${resource.amount}`)
        .join('<br>');

    // Update mining info
    const tool = miningTools[activeTool];
    miningInfoPanel.innerHTML = `
        Active Tool: ${tool.name}<br>
        Durability: ${tool.durability}/${tool.maxDurability}<br>
        Power: ${tool.power}
    `;

    // Update inventory
    inventoryPanel.innerHTML = `
        <h3>Inventory</h3>
        ${resources.map(resource => `
            <div>
                ${resource.name}: ${resource.amount}
                <button onclick="useResource('${resource.name}')">Use</button>
            </div>
        `).join('')}
    `;
}

export function createMiningEffect(position: THREE.Vector3, color: THREE.Color, amount: number = 1, materialSymbol?: string) {
    const scene = getScene();
    if (!scene) return;

    // Create particles
    const particleCount = Math.min(amount * 10, MAX_PARTICLES);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        positions[i3] = position.x + (Math.random() - 0.5) * 2;
        positions[i3 + 1] = position.y + (Math.random() - 0.5) * 2;
        positions[i3 + 2] = position.z + (Math.random() - 0.5) * 2;

        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    miningParticles.push(particles);

    // Remove particles after lifetime
    setTimeout(() => {
        scene.remove(particles);
        geometry.dispose();
        material.dispose();
        const index = miningParticles.indexOf(particles);
        if (index !== -1) {
            miningParticles.splice(index, 1);
        }
    }, PARTICLE_LIFETIME);
}

export function updateMiningEffects() {
    const scene = getScene();
    if (!scene) return;

    // Update particle positions
    miningParticles.forEach(particles => {
        const positions = particles.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += 0.01; // Move particles upward
        }
        particles.geometry.attributes.position.needsUpdate = true;
    });
}

export function cleanupMining() {
    // Clean up UI
    if (miningPanelContainer) {
        miningPanelContainer.innerHTML = '';
        miningPanelContainer = null;
    }

    resourceStatsPanel = null;
    miningInfoPanel = null;
    inventoryPanel = null;
    miningEffectsContainer = null;

    // Clean up particles
    const scene = getScene();
    if (scene) {
        miningParticles.forEach(particles => {
            scene.remove(particles);
            particles.geometry.dispose();
            (particles.material as THREE.Material).dispose();
        });
    }
    miningParticles.length = 0;
}

// Getters
export function getPlayerInventory() { return playerInventory; }
export function getMiningTools() { return miningTools; }
export function getActiveTool() { return activeTool; }
export function getResourceCalculationResult() { return resourceCalculationResult; }
export function isMiningPanelVisible() { return miningPanelVisible; }

// Setters
export function setActiveTool(tool: MiningToolType) {
    activeTool = tool;
    updateMiningUI();
}

export function toggleMiningPanel(visible?: boolean) {
    if (visible !== undefined) {
        miningPanelVisible = visible;
    } else {
        miningPanelVisible = !miningPanelVisible;
    }

    if (miningPanelContainer) {
        miningPanelContainer.style.display = miningPanelVisible ? 'block' : 'none';
    }
} 