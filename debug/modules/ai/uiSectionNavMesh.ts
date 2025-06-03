import { visualizeNavMeshPolygons } from './navMeshDebugger';
import { regenerateNavMesh } from './yukaController';
import * as THREE from 'three';
import { createUISection, createEnhancedButton } from './yukaUICommon';
import { aiNavMeshManager } from './aiNavMeshManager';

export function createNavMeshSection(): {
    sectionDiv: HTMLDivElement,
    toggleVisibilityBtn: HTMLButtonElement,
    regenerateBtn: HTMLButtonElement,
    clearBtn: HTMLButtonElement
} {
    const { sectionDiv, contentDiv } = createUISection('Navigation Mesh', true);

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
    `;
    contentDiv.appendChild(buttonContainer);

    // Create enhanced buttons
    const { button: toggleVisibilityBtn } = createEnhancedButton('🔍 Toggle Visibility', () => {
        aiNavMeshManager.toggleVisibility();
    });
    
    const { button: regenerateBtn } = createEnhancedButton('🔄 Regenerate', () => {
        regenerateNavMesh();
    });
    
    const { button: clearBtn } = createEnhancedButton('🗑️ Clear', () => {
        aiNavMeshManager.clearNavMesh();
    });

    buttonContainer.appendChild(toggleVisibilityBtn);
    buttonContainer.appendChild(regenerateBtn);
    buttonContainer.appendChild(clearBtn);

    // NavMesh info display
    const navMeshInfo = document.createElement('div');
    navMeshInfo.style.cssText = `
        margin-top: 12px;
        padding: 8px;
        background: rgba(102,252,241,0.05);
        border-radius: 6px;
        border: 1px solid rgba(102,252,241,0.1);
    `;

    const infoTitle = document.createElement('div');
    infoTitle.style.cssText = `
        color: #a7c0c9;
        font-size: 12px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    `;
    infoTitle.innerHTML = '📊 NavMesh Info';
    navMeshInfo.appendChild(infoTitle);

    // Create info content using shared utilities
    const infoContent = document.createElement('div');
    infoContent.style.cssText = `
        color: #66fcf1;
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
        line-height: 1.6;
    `;

    // Create info displays
    const statusDisplay = document.createElement('div');
    statusDisplay.textContent = 'Status: Not Generated';
    
    const regionsDisplay = document.createElement('div');
    regionsDisplay.textContent = 'Regions: 0';
    
    const verticesDisplay = document.createElement('div');
    verticesDisplay.textContent = 'Vertices: 0';
    
    const polygonsDisplay = document.createElement('div');
    polygonsDisplay.textContent = 'Polygons: 0';

    infoContent.appendChild(statusDisplay);
    infoContent.appendChild(regionsDisplay);
    infoContent.appendChild(verticesDisplay);
    infoContent.appendChild(polygonsDisplay);
    
    navMeshInfo.appendChild(infoContent);
    contentDiv.appendChild(navMeshInfo);

    return { 
        sectionDiv, 
        toggleVisibilityBtn, 
        regenerateBtn, 
        clearBtn 
    };
}