// d:\InfiniaFULL\MARCHINGCUBES\MARCHINGCUBES13\debug\modules\ui\multiplayer\MultiplayerPanelLoader.ts

import * as THREE from 'three';
import { appendToCustomLog } from '../customLogger';
import { createRenderer, createScene, createCamera } from '../../core/setup';

// Create logToFile function using appendToCustomLog
function logToFile(message: string, type: string = 'info') {
    appendToCustomLog(message, type);
}

let multiplayerPanel: HTMLElement | null = null;

function styleButton(button: HTMLButtonElement, primary = false) {
    button.style.padding = '8px 15px';
    button.style.border = '1px solid #61dafb';
    button.style.borderRadius = '4px';
    button.style.backgroundColor = 'transparent';
    button.style.color = '#61dafb';
    button.style.cursor = 'pointer';
    button.style.transition = 'background-color 0.2s, color 0.2s';
    button.onmouseover = () => {
        button.style.backgroundColor = '#61dafb';
        button.style.color = '#282c34';
    };
    button.onmouseout = () => {
        button.style.backgroundColor = 'transparent';
        button.style.color = '#61dafb';
    };
}

function createMultiplayerPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'multiplayer-panel';
    panel.style.position = 'fixed';
    panel.style.top = '10%'; // Changed from 50% to 10% to ensure it's visible
    panel.style.left = '10%'; // Changed from 50% to 10%
    panel.style.transform = 'none'; // Removed translate transform that might cause positioning issues
    panel.style.width = '400px';
    panel.style.minHeight = '300px';
    panel.style.backgroundColor = 'rgba(40, 40, 40, 0.95)';
    panel.style.border = '2px solid #555';
    panel.style.borderRadius = '8px';
    panel.style.color = '#eee';
    panel.style.padding = '20px';
    panel.style.zIndex = '9999'; // Ensure it's above other debug UI
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)'; // Add shadow for visibility

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '20px';

    const title = document.createElement('h2');
    title.textContent = 'Multiplayer Panel';
    title.style.margin = '0';
    title.style.color = '#61dafb'; // A distinct color for the title

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.color = '#aaa';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = toggleMultiplayerPanelVisibility;

    header.appendChild(title);
    header.appendChild(closeButton);
    panel.appendChild(header);

    // Placeholder Content
    const contentArea = document.createElement('div');
    contentArea.style.flexGrow = '1';
    contentArea.style.overflowY = 'auto';

    // Server Connection Status
    const statusSection = document.createElement('div');
    statusSection.style.marginBottom = '15px';
    const statusLabel = document.createElement('p');
    statusLabel.textContent = 'Status: ';
    const statusValue = document.createElement('span');
    statusValue.textContent = 'Disconnected';
    statusValue.style.color = '#ff6b6b'; // Red for disconnected
    statusLabel.appendChild(statusValue);
    statusSection.appendChild(statusLabel);
    const connectButton = document.createElement('button');
    connectButton.textContent = 'Connect to Server';
    styleButton(connectButton);
    connectButton.onclick = () => { 
        statusValue.textContent = 'Connecting...'; 
        statusValue.style.color = '#f9ca24'; // Yellow for connecting
        // Simulate connection attempt
        setTimeout(() => {
            const success = Math.random() > 0.5;
            if (success) {
                statusValue.textContent = 'Connected';
                statusValue.style.color = '#6ab04c'; // Green for connected
                connectButton.textContent = 'Disconnect';
                connectButton.onclick = () => { /* Implement disconnect */ }; 
            } else {
                statusValue.textContent = 'Failed to Connect';
                statusValue.style.color = '#ff6b6b';
            }
        }, 1500);
    };
    statusSection.appendChild(connectButton);
    contentArea.appendChild(statusSection);

    // Player List Placeholder
    const playerListSection = document.createElement('div');
    playerListSection.style.marginBottom = '15px';
    const playerListTitle = document.createElement('h3');
    playerListTitle.textContent = 'Players Online (0)';
    playerListTitle.style.fontSize = '16px';
    playerListTitle.style.color = '#bbb';
    playerListTitle.style.marginBottom = '8px';
    playerListSection.appendChild(playerListTitle);
    const playerList = document.createElement('ul');
    playerList.style.listStyle = 'none';
    playerList.style.padding = '0';
    playerList.style.maxHeight = '100px';
    playerList.style.overflowY = 'auto';
    const noPlayersMsg = document.createElement('li');
    noPlayersMsg.textContent = 'No other players connected.';
    noPlayersMsg.style.fontStyle = 'italic';
    noPlayersMsg.style.color = '#888';
    playerList.appendChild(noPlayersMsg);
    playerListSection.appendChild(playerList);
    contentArea.appendChild(playerListSection);

    // Chat Placeholder
    const chatSection = document.createElement('div');
    const chatTitle = document.createElement('h3');
    chatTitle.textContent = 'Chat';
    chatTitle.style.fontSize = '16px';
    chatTitle.style.color = '#bbb';
    chatTitle.style.marginBottom = '8px';
    chatSection.appendChild(chatTitle);
    const chatMessages = document.createElement('div');
    chatMessages.style.height = '80px';
    chatMessages.style.border = '1px solid #444';
    chatMessages.style.borderRadius = '4px';
    chatMessages.style.padding = '8px';
    chatMessages.style.marginBottom = '8px';
    chatMessages.style.overflowY = 'auto';
    chatMessages.style.fontSize = '12px';
    chatMessages.innerHTML = '<div><em>Chat system placeholder...</em></div>';
    chatSection.appendChild(chatMessages);
    const chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.placeholder = 'Type a message...';
    chatInput.style.width = 'calc(100% - 18px)'; // Account for padding/border
    chatInput.style.padding = '8px';
    chatInput.style.border = '1px solid #555';
    chatInput.style.borderRadius = '4px';
    chatInput.style.backgroundColor = '#333';
    chatInput.style.color = '#eee';
    chatSection.appendChild(chatInput);
    contentArea.appendChild(chatSection);

    // Isolated Third Person Character Section
    const characterSection = document.createElement('div');
    characterSection.style.marginTop = '15px';
    characterSection.style.paddingTop = '15px';
    characterSection.style.borderTop = '1px solid #444';
    
    const characterTitle = document.createElement('h3');
    characterTitle.textContent = 'Character Controls';
    characterTitle.style.fontSize = '16px';
    characterTitle.style.color = '#bbb';
    characterTitle.style.marginBottom = '8px';
    characterSection.appendChild(characterTitle);
    
    const spawnCharacterButton = document.createElement('button');
    spawnCharacterButton.textContent = 'Spawn Isolated Third Person Character';
    spawnCharacterButton.style.width = '100%';
    spawnCharacterButton.style.marginBottom = '8px';
    styleButton(spawnCharacterButton);
    spawnCharacterButton.onclick = async () => {
        console.log('Spawn Isolated Third Person Character button clicked');
        // Import and call the isolated third person function
        import('../isolatedThirdPerson_copy').then(async module => {
            if (module.initIsolatedThirdPersonView) {
                console.log('Initializing isolated third person view...');
                try {
                    // Create THREE.js objects if they don't exist on window
                    let scene = (window as any).scene;
                    let camera = (window as any).camera;
                    let renderer = (window as any).renderer;
                    
                    if (!scene) {
                        scene = createScene();
                        (window as any).scene = scene;
                    }
                    if (!camera) {
                        camera = createCamera();
                        (window as any).camera = camera;
                    }
                    if (!renderer) {
                        renderer = createRenderer();
                        (window as any).renderer = renderer;
                    }
                    
                    // Import and call enterThirdPersonMode to set the camera mode flag
                    const { enterThirdPersonMode } = await import('../isolatedTerrainViewer/index');
                    enterThirdPersonMode();
                    
                    await module.initIsolatedThirdPersonView(scene, camera, renderer);
                } catch (initError) {
                    console.error('Error initializing THREE.js objects:', initError);
                }
            } else {
                console.error('initIsolatedThirdPersonView function not found in isolatedThirdPerson_copy module');
            }
        }).catch(error => {
            console.error('Failed to load isolatedThirdPerson_copy module:', error);
        });
    };
    characterSection.appendChild(spawnCharacterButton);
    
    contentArea.appendChild(characterSection);

    panel.appendChild(contentArea);

    return panel;
}



function toggleMultiplayerPanelVisibility() {
    if (!multiplayerPanel) {
        multiplayerPanel = createMultiplayerPanel();
        document.body.appendChild(multiplayerPanel);
        
        // Force visibility with additional properties
        multiplayerPanel.style.visibility = 'visible';
        multiplayerPanel.style.opacity = '1';
        multiplayerPanel.style.pointerEvents = 'auto';
        
        // Ensure it's on top of everything
        multiplayerPanel.style.zIndex = '999999';
        
        // Force a reflow to ensure the element is rendered
        multiplayerPanel.offsetHeight;
        
        console.log('Multiplayer panel created and shown.');
        console.log('Panel position:', {
            top: multiplayerPanel.style.top,
            left: multiplayerPanel.style.left,
            zIndex: multiplayerPanel.style.zIndex,
            display: multiplayerPanel.style.display,
            visibility: multiplayerPanel.style.visibility,
            opacity: multiplayerPanel.style.opacity,
            isConnected: multiplayerPanel.isConnected
        });
        
        // Additional check to verify the element is in the DOM
        const elementInDOM = document.getElementById('multiplayer-panel');
        console.log('Element found in DOM:', !!elementInDOM);
        if (elementInDOM) {
            console.log('Element computed style:', window.getComputedStyle(elementInDOM).display);
        }
    } else {
        const isCurrentlyVisible = multiplayerPanel.style.display !== 'none';
        if (isCurrentlyVisible) {
            multiplayerPanel.style.display = 'none';
            multiplayerPanel.style.visibility = 'hidden';
            console.log('Multiplayer panel hidden.');
        } else {
            if (!multiplayerPanel.isConnected) {
                document.body.appendChild(multiplayerPanel);
                console.log('Multiplayer panel re-appended to body.');
            }
            multiplayerPanel.style.display = 'flex';
            multiplayerPanel.style.visibility = 'visible';
            multiplayerPanel.style.opacity = '1';
            multiplayerPanel.style.pointerEvents = 'auto';
            multiplayerPanel.style.zIndex = '999999';
            
            // Force a reflow
            multiplayerPanel.offsetHeight;
            
            console.log('Multiplayer panel shown.');
            console.log('Panel position:', {
                top: multiplayerPanel.style.top,
                left: multiplayerPanel.style.left,
                zIndex: multiplayerPanel.style.zIndex,
                display: multiplayerPanel.style.display,
                visibility: multiplayerPanel.style.visibility,
                opacity: multiplayerPanel.style.opacity,
                isConnected: multiplayerPanel.isConnected
            });
        }
    }
    // Log the actual display style for better debugging
    if (multiplayerPanel) {
        console.log(`Multiplayer panel display style: ${multiplayerPanel.style.display}`);
    }
}

export function loadMultiplayerPanel() {
    console.log('[MultiplayerPanelLoader] loadMultiplayerPanel called');
    toggleMultiplayerPanelVisibility();
}

// Optional: Add a keybinding to toggle the panel (e.g., Ctrl+M)
// document.addEventListener('keydown', (event) => {
//     if (event.ctrlKey && event.key === 'm') {
//         event.preventDefault();
//         loadMultiplayerPanel();
//     }
// });

console.log('[MultiplayerPanelLoader] Script loaded.');