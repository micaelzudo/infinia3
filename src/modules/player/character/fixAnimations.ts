/**
 * Character Animation Fix
 * 
 * This file provides utilities to fix animation issues with the Sketchbook character system.
 */

import * as THREE from 'three';

/**
 * Fix animation system for a Sketchbook character
 * 
 * @param character The Sketchbook character instance
 * @param gltf The loaded GLTF model with animations
 */
export function fixCharacterAnimations(character: any, gltf: any): void {
    if (!character || !gltf) {
        console.error("[Animation Fix] Character or GLTF model is missing");
        return;
    }

    console.log("[Animation Fix] Applying animation fixes to character");

    // Make sure animations are properly assigned to the character
    if (gltf.animations && gltf.animations.length > 0) {
        console.log(`[Animation Fix] Found ${gltf.animations.length} animations in GLTF model`);
        
        // Store animations in character
        character.animations = gltf.animations;
        
        // Log available animations for debugging
        const animationNames = gltf.animations.map((anim: THREE.AnimationClip) => anim.name);
        console.log(`[Animation Fix] Animation names: ${animationNames.join(', ')}`);
        
        // Fix common animation name issues and normalize directional animations
        gltf.animations.forEach((clip: THREE.AnimationClip) => {
            // Normalize base animation names
            if (clip.name.toLowerCase().includes("idle")) {
                clip.name = "idle";
            } else if (clip.name.toLowerCase().includes("walk")) {
                clip.name = clip.name.toLowerCase(); // Keep directional suffixes
            } else if (clip.name.toLowerCase().includes("run")) {
                clip.name = clip.name.toLowerCase(); // Keep directional suffixes
            } else if (clip.name.toLowerCase().includes("sprint")) {
                clip.name = clip.name.toLowerCase(); // Keep directional suffixes
            }
            
            // Log the animation name for debugging
            console.log(`[Animation Fix] Normalized animation name: ${clip.name}`);
        });
    } else {
        console.error("[Animation Fix] No animations found in GLTF model");
    }
    
    // Make sure mixer is properly created
    if (!character.mixer) {
        console.log("[Animation Fix] Creating animation mixer for character");
        character.mixer = new THREE.AnimationMixer(gltf.scene);
    }
    
    // Define animation mapping
    const animationMap: Record<string, string> = {
        // Basic movements
        'walk_forward': 'walk',
        'walk_backward': 'walk',
        'walk_left': 'walk',
        'walk_right': 'walk',
        'run_forward': 'run',
        'run_backward': 'run',
        'run_left': 'run',
        'run_right': 'run',
        'sprint_forward': 'run',
        'sprint_backward': 'run',
        'sprint_strafe_left': 'run',
        'sprint_strafe_right': 'run',
        
        // Rotations
        'turn_left': 'idle',
        'turn_right': 'idle',
        'rotate_left': 'idle',
        'rotate_right': 'idle',
        'idle_rotate_left': 'idle',
        'idle_rotate_right': 'idle',
        
        // Start/stop walking
        'start_forward': 'walk',
        'start_backward': 'walk',
        'start_left': 'walk',
        'start_right': 'walk',
        'start_walk_forward': 'walk',
        'start_walk_left': 'walk',
        'start_walk_right': 'walk',
        'end_walk': 'idle',
        'stop': 'idle',
        
        // Jumping
        'jump_idle': 'idle',
        'jump_running': 'run',
    };
    
    // Replace the original setAnimation method with a fixed version
    const originalSetAnimation = character.setAnimation.bind(character);
    character.setAnimation = function(
        clipName: string, 
        fadeIn: number = 0.1,
        loop: number = THREE.LoopRepeat,
        resetAnimation: boolean = true
    ): number {
        // Debug message
        console.log(`[Animation Fix] Setting animation: ${clipName}, fadeIn: ${fadeIn}, loop: ${loop}`);
        
        // Check if the animation name is in our mapping
        let finalClipName = clipName;
        if (animationMap[clipName]) {
            finalClipName = animationMap[clipName];
            console.log(`[Animation Fix] Mapped ${clipName} to ${finalClipName}`);
        }
        
        // Get available animations
        let availableAnimations: string[] = [];
        if (this.animations && this.animations.length > 0) {
            availableAnimations = this.animations.map((anim: THREE.AnimationClip) => anim.name);
        }
        
        // Check if animation exists
        if (!availableAnimations.includes(finalClipName)) {
            console.warn(`[Animation Fix] Animation ${finalClipName} not found`);
            
            // Use fallback animations
            if (availableAnimations.includes('idle')) {
                finalClipName = 'idle';
            } else if (availableAnimations.includes('walk')) {
                finalClipName = 'walk';
            } else if (availableAnimations.includes('run')) {
                finalClipName = 'run';
            } else if (availableAnimations.length > 0) {
                finalClipName = availableAnimations[0];
            } else {
                console.error("[Animation Fix] No animations available!");
                return 0;
            }
            
            console.log(`[Animation Fix] Using fallback animation: ${finalClipName}`);
        }
        
        // Call the original method with our fixed clip name
        const result = originalSetAnimation(finalClipName, fadeIn, loop, resetAnimation);
        
        // If the mixer exists, check that the animation action was properly created
        if (this.mixer) {
            const action = this.mixer.existingAction(finalClipName);
            if (action) {
                // Make sure looping animations are set to repeat
                if (finalClipName === 'idle' || finalClipName === 'walk' || finalClipName === 'run') {
                    action.loop = THREE.LoopRepeat;
                }
                
                console.log(`[Animation Fix] Animation action created: ${finalClipName}, loop: ${action.loop}, weight: ${action.weight}`);
            } else {
                console.warn(`[Animation Fix] Failed to create animation action for ${finalClipName}`);
            }
        }
        
        return result;
    };
    
    // Force play the idle animation to initialize the mixer
    character.setAnimation('idle', 0);
    
    console.log("[Animation Fix] Animation fixes applied successfully");
}

/**
 * Fix the animation update mechanism for a character
 * 
 * @param character The Sketchbook character instance
 */
export function fixAnimationUpdate(character: any): void {
    if (!character) {
        console.error("[Animation Fix] Character is missing");
        return;
    }
    
    const originalUpdate = character.update.bind(character);
    character.update = function(timeStep: number): void {
        // Call the original update method
        originalUpdate(timeStep);
        
        // Make sure the mixer is updated
        if (this.mixer) {
            this.mixer.update(timeStep);
        }
    };
    
    console.log("[Animation Fix] Animation update mechanism fixed");
} 