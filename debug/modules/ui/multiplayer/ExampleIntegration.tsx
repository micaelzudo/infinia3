/*
 * Example Integration for Infinia Multiplayer
 * 
 * This file demonstrates how to integrate the Infinia Multiplayer system
 * with your existing React components and Three.js scene.
 * 
 * Copy and modify this example to fit your specific use case.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { InfiniaMultiplayerIntegration, useInfiniaMultiplayer, useInfiniaPlayers, useInfiniaConnectionStatus } from './InfiniaMultiplayerIntegration';
import { initIsolatedThirdPerson } from '../isolatedThirdPerson';

// === EXAMPLE COMPONENT ===
export const InfiniaGameWithMultiplayer: React.FC = () => {
  // Refs for Three.js objects
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const characterRef = useRef<any>(null);
  
  // State
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isThirdPersonActive, setIsThirdPersonActive] = useState(false);
  const [username, setUsername] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  
  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneRef.current = scene;
    
    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 10);
    cameraRef.current = camera;
    
    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    
    mountRef.current.appendChild(renderer.domElement);
    
    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Add a ground plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Create a simple character placeholder
    const characterGeometry = new THREE.BoxGeometry(1, 2, 1);
    const characterMaterial = new THREE.MeshLambertMaterial({ color: 0x0066ff });
    const character = new THREE.Mesh(characterGeometry, characterMaterial);
    character.position.y = 1;
    character.castShadow = true;
    scene.add(character);
    characterRef.current = character;
    
    // Basic render loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
    
    // Handle window resize
    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    
    setIsSceneReady(true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);
  
  // Multiplayer configuration
  const multiplayerConfig = {
    scene: sceneRef.current!,
    character: characterRef.current,
    camera: cameraRef.current!,
    serverUrl: 'ws://localhost:3000',
    databaseName: 'infinia_game',
    moduleName: 'infinia_multiplayer',
    autoConnect: true,
    enableDebug: true
  };
  
  // Start third-person mode
  const startThirdPerson = useCallback(() => {
    if (!sceneRef.current || !rendererRef.current || isThirdPersonActive) return;
    
    console.log('[Example] Starting third-person mode with multiplayer');
    
    const tpParams = {
      scene: sceneRef.current,
      renderer: rendererRef.current,
      initialLoadedChunks: {},
      initialChunkMeshes: {},
      noiseLayers: {
        continentalness: { scale: 0.001, octaves: 4, persistence: 0.5, lacunarity: 2 },
        erosion: { scale: 0.002, octaves: 3, persistence: 0.4, lacunarity: 2 },
        peaks_valleys: { scale: 0.003, octaves: 2, persistence: 0.3, lacunarity: 2 }
      },
      seed: { value: 12345 },
      compInfo: { topElements: null },
      noiseScale: 1.0,
      planetOffset: new THREE.Vector3(0, 0, 0),
      enableMultiplayer: true,
      infiniaMultiplayerAPI: (window as any).infiniaMultiplayer,
      onExit: () => {
        console.log('[Example] Exiting third-person mode');
        setIsThirdPersonActive(false);
      }
    };
    
    initIsolatedThirdPerson(tpParams);
    setIsThirdPersonActive(true);
  }, [isThirdPersonActive]);
  
  if (!isSceneReady) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#000',
        color: '#fff'
      }}>
        <div>Loading scene...</div>
      </div>
    );
  }
  
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {/* Three.js mount point */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Multiplayer Integration */}
      <InfiniaMultiplayerIntegration config={multiplayerConfig}>
        <MultiplayerUI 
          username={username}
          setUsername={setUsername}
          isRegistered={isRegistered}
          setIsRegistered={setIsRegistered}
          onStartThirdPerson={startThirdPerson}
          isThirdPersonActive={isThirdPersonActive}
        />
      </InfiniaMultiplayerIntegration>
    </div>
  );
};

// === MULTIPLAYER UI COMPONENT ===
interface MultiplayerUIProps {
  username: string;
  setUsername: (username: string) => void;
  isRegistered: boolean;
  setIsRegistered: (registered: boolean) => void;
  onStartThirdPerson: () => void;
  isThirdPersonActive: boolean;
}

const MultiplayerUI: React.FC<MultiplayerUIProps> = ({
  username,
  setUsername,
  isRegistered,
  setIsRegistered,
  onStartThirdPerson,
  isThirdPersonActive
}) => {
  const multiplayer = useInfiniaMultiplayer();
  const players = useInfiniaPlayers();
  const connectionStatus = useInfiniaConnectionStatus();
  
  const handleRegister = async () => {
    if (!multiplayer || !username.trim()) return;
    
    try {
      await multiplayer.registerPlayer(username.trim());
      setIsRegistered(true);
      console.log('[Example] Player registered successfully');
    } catch (error) {
      console.error('[Example] Registration failed:', error);
      alert('Registration failed. Please try again.');
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };
  
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '20px',
      borderRadius: '10px',
      fontFamily: 'Arial, sans-serif',
      minWidth: '300px',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 15px 0' }}>Infinia Multiplayer</h3>
      
      {/* Connection Status */}
      <div style={{ marginBottom: '10px' }}>
        <strong>Status:</strong> 
        <span style={{ 
          color: connectionStatus === 'connected' ? '#00ff00' : 
                 connectionStatus === 'error' ? '#ff0000' : '#ffff00',
          marginLeft: '5px'
        }}>
          {connectionStatus}
        </span>
      </div>
      
      {/* Player Count */}
      <div style={{ marginBottom: '15px' }}>
        <strong>Players Online:</strong> {players.length}
      </div>
      
      {/* Registration */}
      {!isRegistered ? (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your username"
              style={{
                marginLeft: '10px',
                padding: '5px',
                borderRadius: '3px',
                border: '1px solid #ccc',
                background: '#fff',
                color: '#000'
              }}
            />
          </div>
          <button
            onClick={handleRegister}
            disabled={!username.trim() || connectionStatus !== 'connected'}
            style={{
              padding: '8px 16px',
              borderRadius: '5px',
              border: 'none',
              background: connectionStatus === 'connected' && username.trim() ? '#007bff' : '#666',
              color: 'white',
              cursor: connectionStatus === 'connected' && username.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Join Game
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: '15px' }}>
          <div style={{ color: '#00ff00', marginBottom: '10px' }}>
            ✓ Registered as: {username}
          </div>
          
          {/* Third Person Mode Button */}
          <button
            onClick={onStartThirdPerson}
            disabled={isThirdPersonActive}
            style={{
              padding: '8px 16px',
              borderRadius: '5px',
              border: 'none',
              background: isThirdPersonActive ? '#666' : '#28a745',
              color: 'white',
              cursor: isThirdPersonActive ? 'not-allowed' : 'pointer',
              marginRight: '10px'
            }}
          >
            {isThirdPersonActive ? 'Third Person Active' : 'Start Third Person'}
          </button>
        </div>
      )}
      
      {/* Player List */}
      {players.length > 0 && (
        <div>
          <strong>Players:</strong>
          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
            {players.map((player) => (
              <li key={player.identity} style={{ marginBottom: '2px' }}>
                {player.username} 
                {player.identity === multiplayer?.localPlayer?.identity && ' (You)'}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Instructions */}
      <div style={{ 
        marginTop: '15px', 
        fontSize: '12px', 
        color: '#ccc',
        borderTop: '1px solid #444',
        paddingTop: '10px'
      }}>
        <div>1. Enter a username and click "Join Game"</div>
        <div>2. Click "Start Third Person" to enter multiplayer mode</div>
        <div>3. Use WASD to move, Space to jump, Shift to run</div>
        <div>4. Other players will appear as green boxes</div>
      </div>
    </div>
  );
};

// === USAGE EXAMPLE ===
/*

To use this example in your main App component:

import React from 'react';
import { InfiniaGameWithMultiplayer } from './modules/ui/multiplayer/ExampleIntegration';

function App() {
  return (
    <div className="App">
      <InfiniaGameWithMultiplayer />
    </div>
  );
}

export default App;

*/

export default InfiniaGameWithMultiplayer;