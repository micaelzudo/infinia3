import * as THREE from 'three';
import { CHUNK_HEIGHT, CHUNK_SIZE } from '../../constants_debug';

let theoreticalVisualizerGroup: THREE.Group | null = null;
const THEORETICAL_BOX_COLOR = 0xffffff; // WHITE color
const THEORETICAL_BOX_OPACITY = 0.3; // Slightly different opacity
const TEXT_COLOR = '#FFFFFF'; // White text
const TEXT_BACKGROUND_COLOR = 'rgba(0, 0, 0, 0.2)'; // Semi-transparent black background for readability
const FONT_SIZE = 48; // Increased font size for better visibility
const SPRITE_SCALE_FACTOR = 10; // Adjust as needed to make text reasonably sized in world space

// Helper function to create text sprites
function createTextSprite(text: string, position: THREE.Vector3, color: string, fontSize: number, backgroundColor: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error("Failed to get 2D context");
    }

    const font = `${fontSize}px Arial`;
    context.font = font;
    const textMetrics = context.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize; // Approximate height

    // Add some padding
    const padding = fontSize / 4;
    canvas.width = textWidth + padding * 2;
    canvas.height = textHeight + padding * 2;

    // Redraw with padding
    context.font = font; // Font needs to be reset after canvas resize
    
    // Background for readability
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    // Scale sprite to be readable in world space
    sprite.scale.set(canvas.width / SPRITE_SCALE_FACTOR, canvas.height / SPRITE_SCALE_FACTOR, 1.0);
    
    return sprite;
}

// Returns void as the caller (proceduralGenerationPanel) already has the keys.
export function addTheoreticalChunkBoundaries(scene: THREE.Scene, chunkKeys: string[]): void {
    if (!scene) {
        console.error("[TheoreticalBoundaryViz] Scene is not available.");
        return;
    }

    // Log how many keys are received
    console.log(`[TheoreticalBoundaryViz] Received ${chunkKeys.length} keys to process.`);

    if (!theoreticalVisualizerGroup) {
        theoreticalVisualizerGroup = new THREE.Group();
        theoreticalVisualizerGroup.name = "theoretical_chunk_boundaries_group";
        scene.add(theoreticalVisualizerGroup);
    } else if (!theoreticalVisualizerGroup.parent) {
        // Ensure it's added back to the scene if it was removed
        scene.add(theoreticalVisualizerGroup);
    }

    // Clear existing boxes and sprites first
    while (theoreticalVisualizerGroup.children.length > 0) {
        const child = theoreticalVisualizerGroup.children[0];
        theoreticalVisualizerGroup.remove(child);
        if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m.map) m.map.dispose(); // Dispose texture for sprites
                        m.dispose();
                    });
                } else {
                    if ((child.material as THREE.Material & { map?: THREE.Texture }).map) {
                        (child.material as THREE.Material & { map?: THREE.Texture }).map?.dispose(); // Dispose texture for sprites
                    }
                    (child.material as THREE.Material).dispose();
                }
            }
        }
    }
    // console.log(`[TheoreticalBoundaryViz] Cleared old theoretical boxes. Processing ${chunkKeys.length} keys.`);

    let addedCount = 0;
    for (const chunkKey of chunkKeys) {
        const parts = chunkKey.split(',').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) {
            console.warn(`[TheoreticalBoundaryViz] Invalid chunk key format: ${chunkKey}. Skipping.`);
            continue;
        }
        const [cx, cy, cz] = parts;

        const boxGeometry = new THREE.BoxGeometry(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE);
        const material = new THREE.MeshBasicMaterial({
            color: THEORETICAL_BOX_COLOR,
            wireframe: false,
            transparent: true,
            opacity: 0.25,
            depthWrite: false
        });
        const debugBox = new THREE.Mesh(boxGeometry, material);
        const boxCenterY = cy * CHUNK_HEIGHT + CHUNK_HEIGHT / 2;
        debugBox.position.set(
            cx * CHUNK_SIZE + CHUNK_SIZE / 2,
            boxCenterY,
            cz * CHUNK_SIZE + CHUNK_SIZE / 2
        );
        debugBox.name = `theoretical_boundary_box_${chunkKey}`;
        theoreticalVisualizerGroup.add(debugBox);
        addedCount++;
        console.log(`[TheoreticalBoundaryViz] Added box at: ${chunkKey}`);

        // Create and add Y-index text sprite
        const yLabelPosition = new THREE.Vector3(
            debugBox.position.x,
            boxCenterY + CHUNK_HEIGHT / 2 + 7, // Position Y-label a bit higher
            debugBox.position.z
        );
        const yIndexText = `Y:${cy.toString()}`;
        const yTextSprite = createTextSprite(yIndexText, yLabelPosition, TEXT_COLOR, FONT_SIZE, TEXT_BACKGROUND_COLOR);
        yTextSprite.name = `theoretical_y_label_${chunkKey}`;
        theoreticalVisualizerGroup.add(yTextSprite);
        // (No need to log for label sprite)
    }
    console.log(`[TheoreticalBoundaryViz] Finished. Actually added ${addedCount} theoretical boxes for ${chunkKeys.length} processed keys.`);
}

export function removeTheoreticalChunkBoundaries(scene: THREE.Scene): void {
    if (!theoreticalVisualizerGroup || !theoreticalVisualizerGroup.parent) {
        // console.log("[TheoreticalBoundaryViz] Group not found or not in scene, nothing to remove.");
        return;
    }
    
    // console.log(`[TheoreticalBoundaryViz] Removing ${theoreticalVisualizerGroup.children.length} theoretical items.`);
    while (theoreticalVisualizerGroup.children.length > 0) {
        const child = theoreticalVisualizerGroup.children[0];
        theoreticalVisualizerGroup.remove(child);
         if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m.map) m.map.dispose(); // Dispose texture for sprites
                        m.dispose();
                    });
                } else {
                    // Ensure map property exists before trying to dispose it
                    const matWithMap = child.material as THREE.Material & { map?: THREE.Texture };
                    if (matWithMap.map) {
                        matWithMap.map.dispose();
                    }
                    (child.material as THREE.Material).dispose();
                }
            }
        }
    }
    console.log("[TheoreticalBoundaryViz] All theoretical boxes and labels removed.");
} 