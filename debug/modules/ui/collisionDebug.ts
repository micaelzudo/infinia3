/**
 * Collision Debug Tools
 * 
 * This module adds debugging functionality for physics collision detection
 * between terrain chunks and character.
 */

/**
 * Add debugging properties to the window object
 */
export function setupCollisionDebugTools(): void {
    // Add debug flag to window object
    if (typeof window !== 'undefined') {
        (window as any).DEBUG_COLLISION_RAYS_ENABLED = false;
        
        // Add a toggle function accessible from the console
        (window as any).toggleCollisionDebug = () => {
            (window as any).DEBUG_COLLISION_RAYS_ENABLED = !(window as any).DEBUG_COLLISION_RAYS_ENABLED;
            console.log(`Collision debug rays ${(window as any).DEBUG_COLLISION_RAYS_ENABLED ? 'ENABLED' : 'DISABLED'}`);
            
            // Update button state if it exists
            const debugButton = document.getElementById('collision-debug-button');
            if (debugButton) {
                debugButton.textContent = (window as any).DEBUG_COLLISION_RAYS_ENABLED 
                    ? 'Disable Collision Debug' 
                    : 'Enable Collision Debug';
                debugButton.classList.toggle('active', (window as any).DEBUG_COLLISION_RAYS_ENABLED);
            }
        };
        
        // Add a function to create the debug UI button
        (window as any).createCollisionDebugButton = () => {
            // Create button if it doesn't exist
            if (!document.getElementById('collision-debug-button')) {
                const buttonContainer = document.createElement('div');
                buttonContainer.style.position = 'fixed';
                buttonContainer.style.bottom = '20px';
                buttonContainer.style.left = '20px';
                buttonContainer.style.zIndex = '1000';
                
                const button = document.createElement('button');
                button.id = 'collision-debug-button';
                button.textContent = 'Enable Collision Debug';
                button.style.padding = '8px 16px';
                button.style.backgroundColor = '#2d3748';
                button.style.color = 'white';
                button.style.border = 'none';
                button.style.borderRadius = '4px';
                button.style.cursor = 'pointer';
                button.style.fontFamily = 'sans-serif';
                button.style.fontSize = '14px';
                button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                
                button.addEventListener('mouseover', () => {
                    button.style.backgroundColor = '#4a5568';
                });
                
                button.addEventListener('mouseout', () => {
                    button.style.backgroundColor = (window as any).DEBUG_COLLISION_RAYS_ENABLED 
                        ? '#38a169' // Green when active
                        : '#2d3748'; // Default gray
                });
                
                button.addEventListener('click', () => {
                    (window as any).toggleCollisionDebug();
                });
                
                buttonContainer.appendChild(button);
                document.body.appendChild(buttonContainer);
                
                console.log('[CollisionDebug] Added collision debug button to UI');
            }
        };
        
        console.log('[CollisionDebug] Debug tools initialized. Use window.toggleCollisionDebug() to toggle.');
        
        // Create the UI button automatically
        setTimeout(() => {
            if (typeof (window as any).createCollisionDebugButton === 'function') {
                (window as any).createCollisionDebugButton();
            }
        }, 1000); // Delay to ensure DOM is ready
    }
}

/**
 * Check if collision debug is enabled
 */
export function isCollisionDebugEnabled(): boolean {
    return typeof window !== 'undefined' && !!(window as any).DEBUG_COLLISION_RAYS_ENABLED;
}

/**
 * Toggle collision debug state
 * @param forceState Optional state to force
 */
export function toggleCollisionDebug(forceState?: boolean): void {
    if (typeof window !== 'undefined') {
        if (forceState !== undefined) {
            (window as any).DEBUG_COLLISION_RAYS_ENABLED = forceState;
        } else {
            (window as any).DEBUG_COLLISION_RAYS_ENABLED = !(window as any).DEBUG_COLLISION_RAYS_ENABLED;
        }
        
        console.log(`Collision debug rays ${(window as any).DEBUG_COLLISION_RAYS_ENABLED ? 'ENABLED' : 'DISABLED'}`);
        
        // Call window toggle function for UI updates
        if (typeof (window as any).toggleCollisionDebug === 'function') {
            (window as any).toggleCollisionDebug();
        }
    }
}

/**
 * Create a debug visualization object to show the character's ground ray
 * 
 * @param scene The THREE.Scene to add the debug ray to
 * @param position The starting position for the ray
 * @param hit Whether the ray hit the ground
 * @returns The created debug ray object
 */
export function createDebugRay(
    scene: THREE.Scene, 
    position: THREE.Vector3, 
    hit: boolean = false
): THREE.Line {
    // Import THREE dynamically to avoid circular imports
    const THREE = (window as any).THREE;
    if (!THREE) {
        console.error('THREE not found on window object. Debug rays unavailable.');
        return null;
    }
    
    // Create geometry for the ray
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -1, 0)
    ]);
    
    // Create material - green if hit, red if not
    const rayMaterial = new THREE.LineBasicMaterial({ 
        color: hit ? 0x00ff00 : 0xff0000,
        linewidth: 3
    });
    
    // Create the ray
    const rayLine = new THREE.Line(rayGeometry, rayMaterial);
    rayLine.name = 'debug-ground-ray';
    rayLine.position.copy(position);
    
    // Add to scene
    scene.add(rayLine);
    
    return rayLine;
}

/**
 * Update an existing debug ray visualization
 * 
 * @param ray The debug ray object to update
 * @param position The new position for the ray
 * @param hit Whether the ray hit the ground
 */
export function updateDebugRay(
    ray: THREE.Line, 
    position: THREE.Vector3, 
    hit: boolean = false
): void {
    if (!ray) return;
    
    // Update position
    ray.position.copy(position);
    
    // Update color
    if (ray.material) {
        (ray.material as THREE.LineBasicMaterial).color.set(hit ? 0x00ff00 : 0xff0000);
    }
} 