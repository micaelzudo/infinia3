/**
 * Animation Utilities
 * 
 * This file provides utility functions for handling character animations.
 */

// External libraries
import * as THREE from 'three';

// Types
import type { EnhancedCharacter } from '../entities/characters/core/characterTypes';

/**
 * Handle animation transition with proper blending
 */
export function handleAnimationTransition(
    character: EnhancedCharacter,
    animationName: string,
    fadeIn: number = 0.2
): void {
    if (!character?.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;
    const newClip = mixer.clipAction(animationName as unknown as THREE.AnimationClip);

    if (currentClip) {
        currentClip.fadeOut(fadeIn);
    }

    newClip.reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(fadeIn)
        .play();

    character.animations.previous = character.animations.current;
    character.animations.current = animationName;
    character.animations.blendTime = fadeIn;
}

/**
 * Check if the current animation has ended
 */
export function hasAnimationEnded(character: EnhancedCharacter): boolean {
    if (!character?.animations?.mixer) return false;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (!currentClip) return false;

    return currentClip.time >= currentClip.getClip().duration;
}

/**
 * Set animation speed
 */
export function setAnimationSpeed(character: EnhancedCharacter, speed: number): void {
    if (!character?.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (currentClip) {
        currentClip.setEffectiveTimeScale(speed);
    }

    character.animations.speed = speed;
}

/**
 * Get animation progress (0 to 1)
 */
export function getAnimationProgress(character: EnhancedCharacter): number {
    if (!character?.animations?.mixer) return 0;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (!currentClip) return 0;

    return currentClip.time / currentClip.getClip().duration;
}

/**
 * Check if animation is playing
 */
export function isAnimationPlaying(character: EnhancedCharacter): boolean {
    if (!character?.animations?.mixer) return false;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    return currentClip?.isRunning() || false;
}

/**
 * Stop current animation
 */
export function stopAnimation(character: EnhancedCharacter, fadeOut: number = 0.2): void {
    if (!character?.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (currentClip) {
        currentClip.fadeOut(fadeOut);
    }
}

/**
 * Pause current animation
 */
export function pauseAnimation(character: EnhancedCharacter): void {
    if (!character?.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (currentClip) {
        currentClip.paused = true;
    }
}

/**
 * Resume current animation
 */
export function resumeAnimation(character: EnhancedCharacter): void {
    if (!character?.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const currentClip = character.animations.current ? mixer.clipAction(character.animations.current as unknown as THREE.AnimationClip) : null;

    if (currentClip) {
        currentClip.paused = false;
    }
}

/**
 * Update animation mixer
 */
export function updateAnimationMixer(character: EnhancedCharacter, deltaTime: number): void {
    if (!character?.animations?.mixer) return;

    character.animations.mixer.update(deltaTime);
}

/**
 * Maps state names to animation names
 */
export function getAnimationNameForState(state: string): string {
    const stateMap: { [key: string]: string } = {
        'idle': 'idle',
        'walk': 'walk',
        'walkBackward': 'walk_backward',
        'strafeLeft': 'strafe_left',
        'strafeRight': 'strafe_right',
        'sprint': 'sprint',
        'jump': 'jump',
        'jumpIdle': 'jump_idle',
        'jumpRunning': 'jump_running',
        'fall': 'fall',
        'land': 'land',
        'drive': 'drive',
        'exit_vehicle': 'exit_vehicle',
        'sit': 'sit',
        'dropIdle': 'drop_idle',
        'dropRolling': 'drop_rolling',
        'dropRunning': 'drop_running'
    };

    return stateMap[state.toLowerCase()] || 'idle';
}

/**
 * Blend between two animations
 */
export function blendAnimations(
    character: EnhancedCharacter,
    fromState: string,
    toState: string,
    blendTime: number = 0.2
): void {
    if (!character.animations?.mixer) return;

    const mixer = character.animations.mixer;
    const fromAnimation = getAnimationNameForState(fromState);
    const toAnimation = getAnimationNameForState(toState);

    const fromAction = mixer.clipAction(fromAnimation as unknown as THREE.AnimationClip);
    const toAction = mixer.clipAction(toAnimation as unknown as THREE.AnimationClip);

    if (fromAction && toAction) {
        fromAction.crossFadeTo(toAction, blendTime, false);
        toAction.play();
    } else if (toAction) {
        toAction.reset().fadeIn(blendTime).play();
    }
}

/**
 * Get animation weight for blending
 */
export function getAnimationWeight(
    character: EnhancedCharacter,
    state: string,
    blendTime: number = 0.2
): number {
    if (!character.animations?.mixer) return 0;
    const mixer = character.animations.mixer;
    const action = mixer.clipAction(getAnimationNameForState(state) as unknown as THREE.AnimationClip);
    if (!action) return 0;
    const progress = action.time / (action.getClip().duration * blendTime);
    return Math.min(progress, 1.0);
} 