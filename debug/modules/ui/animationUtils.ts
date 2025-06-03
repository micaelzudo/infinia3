import * as THREE from 'three';
import { appendToCustomLog } from './customLogger'; // Assuming appendToCustomLog is in customLogger.ts

/**
 * Gets the corresponding animation name for a given state.
 * @param stateName The name of the state.
 * @returns The corresponding animation name
 */
export function getAnimationForState(stateName: string): string {
    // Enhanced mapping of state names to animations with better support for walk transitions
    const stateToAnimMap: Record<string, string> = {
        'Idle': 'idle',
        'Walk': 'run',  // Using 'run' since 'walk' doesn't exist
        'Run': 'run',
        'Sprint': 'run',
        'JumpIdle': 'jump_idle',
        'JumpRunning': 'jump_running',
        'Falling': 'falling',
        // Add the transition states with appropriate animations
        'StartWalkForward': 'run',
        'StartWalkForwardState': 'run',
        'AdaptedStartWalkForwardState': 'run',
        'StartWalkLeft': 'run', 
        'StartWalkLeftState': 'run',
        'AdaptedStartWalkLeftState': 'run',
        'StartWalkRight': 'run',
        'StartWalkRightState': 'run',
        'AdaptedStartWalkRightState': 'run',
        'EndWalk': 'idle',  // Changed from 'stop' to 'idle' since 'stop' doesn't exist
        'EndWalkState': 'idle', // Changed from 'stop' to 'idle'
        'AdaptedEndWalk': 'idle', // Changed from 'stop' to 'idle'
        'IdleRotateLeft': 'run',
        'IdleRotateRight': 'run'
    };
    
    // Get the animation from the map, or fall back to 'idle' if not found
    return stateToAnimMap[stateName] || 'idle';
}

/**
 * Directly play an animation on a character
 * 
 * @param character The character to play the animation on
 * @param animName The name of the animation to play
 * @param fadeIn The fade-in time for the animation
 * @param loop Whether the animation should loop
 * @returns Whether the animation was successfully played
 */
export function directPlayAnimation(
    character: any,
    animName: string,
    fadeIn: number = 0.2,
    loop: number = THREE.LoopRepeat
): boolean {
    const charId = character && character.debugId ? character.debugId : 'unknown';
    
    // Animation mapping for fallbacks when requested animations don't exist
    const animationMapping: {[key: string]: {name: string, loop: number, fadeTime: number}} = {
        'walk': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 },
        'run': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 },
        'rotate_left': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'rotate_right': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'turn_left': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'turn_right': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.05 },
        'idle': { name: 'idle', loop: THREE.LoopRepeat, fadeTime: 0.2 },
        'stop': { name: 'idle', loop: THREE.LoopRepeat, fadeTime: 0.2 }, // Changed to LoopRepeat for smoother transitions
        'sprint': { name: 'run', loop: THREE.LoopRepeat, fadeTime: 0.1 } // Added sprint mapping
    };
    
    // Apply animation mapping
    let targetAnimName = animName;
    let targetFadeIn = fadeIn;
    let targetLoop = loop;
    
    if (animationMapping[animName]) {
        const mapping = animationMapping[animName];
        targetAnimName = mapping.name;
        targetLoop = mapping.loop;
        
        // Only use the mapping's fade time if it's faster than requested
        // This allows callers to request even quicker fades when needed
        targetFadeIn = Math.min(fadeIn, mapping.fadeTime);
        
        // Log mapping
        if (targetAnimName !== animName) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Mapping '${animName}' to '${targetAnimName}' animation`, 'log', `DirectPlay_MapAnim_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
        }
    }
    
    // Store previous animation for better transition logging
    const prevAnim = character._currentAnimation || 'none';
    
    // IMPORTANT: Don't change animation if it's already playing the same one
    // This prevents constant animation resets that break the animation flow
    if (character._currentAnimation === targetAnimName) {
        // Skip logging most of the time to reduce spam
        const now = Date.now();
        const lastSkipLog = character._lastSkipLogTime || 0;
        if (now - lastSkipLog > 1000) { // Log only every second
        appendToCustomLog(
                `[directPlayAnimation ID: ${charId}] Skipping animation change - already playing '${targetAnimName}'`,
                'log',
                `DirectPlay_AlreadyPlaying_${charId}`,
                2000,
                undefined,
                'normal',
                'animationUtils.ts'
        );
            character._lastSkipLogTime = now;
        }
        return true; // Return true since animation is already playing as requested
        }
        
    // Log animation transition for debugging
    appendToCustomLog(`[Animation Transition ID: ${charId}] ${prevAnim} -> ${targetAnimName}`, 'log', `AnimTransition_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
        
    try {
        // Get the animation from the character's animations (added in constructor)
        const foundClip = character.animations?.find((clip: THREE.AnimationClip) => 
            clip.name === targetAnimName || clip.name.toLowerCase() === targetAnimName.toLowerCase()
        );
        
        if (!foundClip) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] No animation found with name '${targetAnimName}'`, 'error', `DirectPlay_NoClip_${charId}`, 0, undefined, 'critical', 'animationUtils.ts');
            
            // Try fallback to idle
            if (targetAnimName !== 'idle' && targetAnimName !== 'run') {
                appendToCustomLog(`[directPlayAnimation ID: ${charId}] Trying fallback to idle/run animation`, 'log', `DirectPlay_Fallback_${charId}`, 0, undefined, 'normal', 'animationUtils.ts');
                return directPlayAnimation(character, targetAnimName === 'stop' ? 'idle' : 'run', targetFadeIn, targetLoop);
            }
            
            return false;
        }
        
        if (!character.mixer) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Character has no mixer`, 'error', `DirectPlay_NoMixer_${charId}`, 0, undefined, 'critical', 'animationUtils.ts');
            return false;
        }
        
        // Get or create action for this animation
        const existingAction = character.mixer.existingAction(foundClip);
        const action = existingAction || character.mixer.clipAction(foundClip);
        
        if (!action) {
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Failed to create action for '${targetAnimName}'`, 'error', `DirectPlay_NoAction_${charId}`, 0, undefined, 'critical', 'animationUtils.ts');
            return false;
        }
        
        // Configure the action
        action.loop = targetLoop;
        action.clampWhenFinished = true;
        action.timeScale = 1;
        
        // Special case for turning animations - slightly faster playback
        if (animName.includes('turn') || animName.includes('rotate')) {
            action.timeScale = 1.2; // 20% faster for more responsive turns
            appendToCustomLog(`[directPlayAnimation ID: ${charId}] Using faster timeScale (${action.timeScale}) for turn animation`, 'log', `DirectPlay_TurnFaster_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
        }
        
        // Log animation parameters for debugging
        appendToCustomLog(`[Animation Parameters ID: ${charId}] {duration: ${foundClip.duration.toFixed(4)}, timeScale: ${action.timeScale}, loop: ${targetLoop}, fadeIn: ${targetFadeIn}}`, 'log', `AnimParams_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
        
        // Check if animation is currently active and running
        if (existingAction && existingAction.isRunning()) {
            // If it's already running, we don't need to restart it
            // Just make sure it has the right parameters
            existingAction.loop = targetLoop;
            existingAction.timeScale = action.timeScale;
        
        appendToCustomLog(
                `[directPlayAnimation ID: ${charId}] Animation '${targetAnimName}' already running, updated parameters`,
                'log',
                `DirectPlay_AlreadyRunning_${charId}`,
                1000,
                undefined,
                'normal',
                'animationUtils.ts'
            );
            
            // Update current animation reference
            character._currentAnimation = targetAnimName;
            
        return true;
        }
        
        // Add a timestamp check to prevent too many animation changes in quick succession
        const now = Date.now();
        const lastAnimChange = character._lastAnimChangeTime || 0;
        
        // Don't enforce minimum time for turning animations to ensure responsiveness
        let minTimeBetweenChanges = 200;
        if (animName.includes('turn') || animName.includes('rotate')) {
            minTimeBetweenChanges = 0; // No minimum time for turn animations
        }
        
        if (character._currentAnimation && character._currentAnimation !== targetAnimName) {
            // Check if enough time has passed since last animation change
            if (now - lastAnimChange < minTimeBetweenChanges) {
                // Too soon since last change, log but don't force a new animation
                appendToCustomLog(`[Animation Skip ID: ${charId}] Skipping ${character._currentAnimation} -> ${targetAnimName} change (too soon, ${now - lastAnimChange}ms < ${minTimeBetweenChanges}ms)`, 'log', `AnimSkip_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
                
                // Still return true to prevent cascading animation attempts
                return true;
            }
            
            // Get the current action
            const currentClip = character.animations?.find((clip: THREE.AnimationClip) => 
                clip.name === character._currentAnimation || clip.name.toLowerCase() === character._currentAnimation.toLowerCase()
            );
            
            if (currentClip) {
                const currentAction = character.mixer.existingAction(currentClip);
                if (currentAction && currentAction.isRunning()) {
                    // For turning animations, use shorter crossfade for responsiveness
                    let actualFadeIn = targetFadeIn;
                    if (!animName.includes('turn') && !animName.includes('rotate')) {
                        actualFadeIn = Math.max(targetFadeIn, 0.3); // At least 0.3s fade for non-turning animations
                    }
                    
                    appendToCustomLog(`[Animation Crossfade ID: ${charId}] ${character._currentAnimation} -> ${targetAnimName} with fadeIn: ${actualFadeIn}`, 'log', `AnimCrossfade_${charId}`, 500, undefined, 'normal', 'animationUtils.ts');
                    currentAction.crossFadeTo(action, actualFadeIn, true);
                } else {
                    // Fade in the new animation
                    action.reset();
                    action.fadeIn(targetFadeIn);
                }
            } else {
                // Fade in the new animation
                action.reset();
                action.fadeIn(targetFadeIn);
            }
        } else {
            // Reset and fade in
            action.reset();
            action.fadeIn(targetFadeIn);
        }
        
        // Record timestamp of this animation change
        character._lastAnimChangeTime = now;
        
        action.play();
        
        // Update current animation reference
        character._currentAnimation = targetAnimName;
        
        appendToCustomLog(`[Animation Play ID: ${charId}] Successfully playing '${targetAnimName}' animation`, 'log', `AnimPlay_${charId}`, 2000, undefined, 'normal', 'animationUtils.ts');
        
        return true;
    } catch (error: any) {
        appendToCustomLog(`[directPlayAnimation ID: ${charId}] Error playing animation '${targetAnimName}': ${error.message}`, 'error', `DirectPlay_Error_${charId}`, 0, undefined, 'critical', 'animationUtils.ts');
        return false;
    }
} 