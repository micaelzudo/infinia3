import * as THREE from 'three';
import { appendToCustomLog } from './customLogger';
import { directPlayAnimation } from './animationUtils';
import { ICharacterState } from '../../Sketchbook-master/src/ts/interfaces/ICharacterState';
import { StartWalkForward } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkForward';
import { Walk } from '../../Sketchbook-master/src/ts/characters/character_states/Walk';
import { StartWalkRight } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkRight';
import { StartWalkLeft } from '../../Sketchbook-master/src/ts/characters/character_states/StartWalkLeft';
import { EndWalk } from '../../Sketchbook-master/src/ts/characters/character_states/EndWalk';
import { Idle } from '../../Sketchbook-master/src/ts/characters/character_states/Idle';
import { Sprint } from '../../Sketchbook-master/src/ts/characters/character_states/Sprint';
import { Falling } from '../../Sketchbook-master/src/ts/characters/character_states/Falling'; // Added based on usage in AdaptedIdleState

// Note: The order of class definitions matters if they instantiate each other directly at the point of definition.
// It's generally safer if they are all defined before any cross-instantiation in methods,
// or if using them as types which TypeScript can handle with forward references.

export class AdaptedStartWalkForwardState extends StartWalkForward {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7; // Force transition after this many seconds
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkForwardState ID: ${charId}] Created`, 'log', `AdaptedStartWalkForward_Create_${charId}`, 0, undefined, 'normal');
        
        // Force animation immediately for smoother transition with a longer fade-in
        directPlayAnimation(this.character, 'run', 0.2);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        
        // Increment transition timer
        this.transitionTimer += timeStep;
        
        // Before checking timer, ensure run animation is playing
        if ((this.character as any)._currentAnimation !== 'run') {
            directPlayAnimation(this.character, 'run', 0.1);
            appendToCustomLog(`[AdaptedStartWalkForwardState.update ID: ${charId}] Animation reinforcement: forcing 'run'`, 'warn', `StartWalk_AnimForce_${charId}`, 500, undefined, 'critical');
        }
        
        // Check for direction inputs - if no movement inputs, go to EndWalk
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        
        if (!anyDirectionPressed) {
            appendToCustomLog(`[AdaptedStartWalkForwardState.update ID: ${charId}] No direction keys pressed, transitioning to EndWalk`, 'warn', `StartWalk_ToEndWalk_${charId}`, 0, undefined, 'critical');
            directPlayAnimation(this.character, 'stop', 0.1, THREE.LoopOnce);
            this.character.setState(new AdaptedEndWalk(this.character)); // Assumes AdaptedEndWalk is defined
            return;
        }
        
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            const runPressed = this.character.actions.run.isPressed;
            
            appendToCustomLog(
                `[AdaptedStartWalkForwardState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Run key: ${runPressed}. Transitioning to ${runPressed ? 'AdaptedSprintState' : 'AdaptedWalkState'}.`,
                'log',
                `AdaptedStartWalkForward_Transition_${charId}`,
                500,
                undefined,
                'normal'
            );
            
            if (runPressed) {
                this.character.setState(new AdaptedSprintState(this.character)); // Assumes AdaptedSprintState is defined
            } else {
                this.character.setState(new AdaptedWalkState(this.character)); // Assumes AdaptedWalkState is defined
            }
            return;
        }
        
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        
        appendToCustomLog(
            `[Patched StartWalkBase.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`,
            'log', 
            `AdaptedStartWalkForward_InputChange_${charId}`,
            1000,
            undefined,
            'normal'
        );
        
        if (noDir) {
            appendToCustomLog(
                `[AdaptedStartWalkForwardState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`,
                'log',
                `AdaptedStartWalkForward_ToEndWalk_${charId}`,
                0,
                undefined,
                'normal'
            );
            this.character.setState(new AdaptedEndWalk(this.character)); // Assumes AdaptedEndWalk is defined
            return;
        }
        
        if (anyDir) {
            super.onInputChange();
        }
    }
}

export class AdaptedWalkState extends Walk {
    private _transitionCheckTimer: number = 0;
    private readonly _checkInterval: number = 0.1;
    private _lastAnimationTime: number = 0;
    private _animationThrottleInterval: number = 0.25;
    private _lastMovementDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
    private _lastInputDirection: THREE.Vector3 = new THREE.Vector3();
    private _noInputTimer: number = 0;
    private readonly _maxNoInputTime: number = 0.05;
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedWalkState ID: ${charId}] Created`, 'log', `AdaptedWalk_Create_${charId}`, 0, undefined, 'normal');
        this.playWalkingAnimation();
    }
    
    private playWalkingAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        if (this.timer - this._lastAnimationTime < this._animationThrottleInterval) {
            return;
        }
        this._lastAnimationTime = this.timer;
        const currentAnim = (this.character as any)._currentAnimation || null;
        if (currentAnim !== 'run') {
            appendToCustomLog(
                `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] Playing 'run' animation, current anim: '${currentAnim}'`,
                'log', `AdaptedWalk_PlayAnim_${charId}`, 500, undefined, 'normal'
            );
            const animPlayed = directPlayAnimation(this.character, 'run', 0.2);
            if (!animPlayed) {
                appendToCustomLog(
                    `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] Failed to play 'run' animation directly, using setAnimation fallback`,
                    'warn', `AdaptedWalk_AnimFail_${charId}`, 0, undefined, 'normal'
                );
                const animTime = this.character.setAnimation('run', 0.1);
                if (animTime < 0) {
                    appendToCustomLog(
                        `[AdaptedWalkState.playWalkingAnimation ID: ${charId}] CRITICAL ERROR: Failed to play 'run' animation with both methods!`,
                        'error', `AdaptedWalk_AnimCriticalFail_${charId}`, 0, undefined, 'critical'
                    );
                }
            }
        }
    }
    
    private hasChangedDirection(): boolean {
        const charId = (this.character as any)?.debugId || 'unknown';
        const currentDirectionVector = this.character.getLocalMovementDirection();
        const currentDirection = new THREE.Vector3(currentDirectionVector.x, currentDirectionVector.y, currentDirectionVector.z);
        if (this._lastInputDirection.lengthSq() === 0) {
            this._lastInputDirection.set(currentDirection.x, currentDirection.y, currentDirection.z);
            return false;
        }
        const angleChange = this._lastInputDirection.angleTo(currentDirection);
        const directionThreshold = Math.PI / 4; // 45 degrees
        if (angleChange > directionThreshold) {
            appendToCustomLog(`[AdaptedWalkState.hasChangedDirection ID: ${charId}] Direction changed by ${angleChange.toFixed(2)} radians. Old:(${this._lastInputDirection.x.toFixed(2)},${this._lastInputDirection.z.toFixed(2)}) New:(${currentDirection.x.toFixed(2)},${currentDirection.z.toFixed(2)})`, 'log', `AdaptedWalk_DirChange_${charId}`, 500, undefined, 'normal');
            this._lastInputDirection.set(currentDirection.x, currentDirection.y, currentDirection.z);
            return true;
        }
        return false;
    }

    private playTurningAnimation(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedWalkState.playTurningAnimation ID: ${charId}] Playing turning animation (mapped to 'run' with faster timescale)`, 'log', `AdaptedWalk_TurnAnim_${charId}`, 200, undefined, 'normal');
        directPlayAnimation(this.character, 'run', 0.05); // Fast fade for turns, directPlayAnimation handles timescale
    }

    public update(timeStep: number): void {
        super.update(timeStep); // Base Walk.update handles actual movement
        const charId = (this.character as any)?.debugId || 'unknown';
        this._transitionCheckTimer += timeStep;

        const velocity = this.character.characterCapsule.body.velocity;
        const velocityLength = new THREE.Vector3(velocity.x, 0, velocity.z).length();
        
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        const groundNormalYValue = (this.character.rayHasHit && this.character.rayResult.hitNormalWorld) ? this.character.rayResult.hitNormalWorld.y : null;
        const groundNormalY = groundNormalYValue !== null ? groundNormalYValue.toFixed(3) : 'N/A (no ray hit)';

        if (this._transitionCheckTimer >= this._checkInterval) {
            appendToCustomLog(`[Patched Walk.update ID: ${charId}] Inputs: up=${up}, down=${down}, left=${left}, right=${right}, velLen: ${velocityLength.toFixed(3)}, GroundNormalY: ${groundNormalY}`, 'log', `Walk_Update_${charId}`, 1000, undefined, 'normal');
            this._transitionCheckTimer = 0;
        }
        
        if (!anyDirectionPressed) {
            this._noInputTimer += timeStep;
            if (this._noInputTimer >= this._maxNoInputTime) {
                const now = Date.now();
                const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
                const minTimeBetweenStateChanges = 100;
                if (now - lastStateChange >= minTimeBetweenStateChanges) {
                    appendToCustomLog(`[AdaptedWalkState.update ID: ${charId}] No input detected for ${this._noInputTimer.toFixed(3)}s, transitioning to EndWalk`, 'warn', `AdaptedWalk_NoInputTransition_${charId}`, 0, undefined, 'critical');
                    (this.character as any)._lastStateChangeTime = now;
                    directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
                    this.character.setState(new AdaptedEndWalk(this.character));
                    return;
                }
            }
        } else {
            this._noInputTimer = 0;
            if (velocityLength > 0.1) {
                if (this.hasChangedDirection()) {
                    this.playTurningAnimation();
                } else if (this.timer - this._lastAnimationTime >= this._animationThrottleInterval) {
                    this.playWalkingAnimation();
                }
            }
        }
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const now = Date.now();
        const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
        const minTimeBetweenStateChanges = 100;
        
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        const moveDirection = this.character.getLocalMovementDirection();
        const isActuallyMoving = moveDirection.lengthSq() > 0.01;
        
        appendToCustomLog(
            `[AdaptedWalkState.onInputChange ID: ${charId}] Direction keys: ${anyDirectionPressed ? 'YES' : 'NO'}, Movement vector: (${moveDirection.x.toFixed(2)}, ${moveDirection.z.toFixed(2)}), isActuallyMoving: ${isActuallyMoving}`,
            'log', `AdaptedWalk_Input_${charId}`, 500, undefined, 'normal'
        );
        
        if (anyDirectionPressed) {
            if (isActuallyMoving) {
                if (this.hasChangedDirection()) {
                    this.playTurningAnimation();
                }
            }
            if (this.character.actions.run.isPressed) {
                if (now - lastStateChange >= minTimeBetweenStateChanges) {
                    appendToCustomLog(`[AdaptedWalkState.onInputChange ID: ${charId}] Run pressed, transitioning to AdaptedSprintState`, 'log', `AdaptedWalk_ToSprint_${charId}`, 0, undefined, 'normal');
                    (this.character as any)._lastStateChangeTime = now;
                    this.character.setState(new AdaptedSprintState(this.character));
                    return;
                } else {
                    appendToCustomLog(`[AdaptedWalkState.onInputChange ID: ${charId}] Run pressed but ignoring - too soon for state change (${now - lastStateChange}ms < ${minTimeBetweenStateChanges}ms)`, 'log', `AdaptedWalk_IgnoreSprint_${charId}`, 0, undefined, 'normal');
                }
            }
        } else {
            appendToCustomLog(`[AdaptedWalkState.onInputChange ID: ${charId}] *** No direction keys pressed, FORCING transition to EndWalk state ***`, 'warn', `AdaptedWalk_ToEndWalk_${charId}`, 0, undefined, 'critical');
            (this.character as any)._lastStateChangeTime = now;
            directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
            const adaptedEndWalkState = new AdaptedEndWalk(this.character);
            this.character.setState(adaptedEndWalkState);
            return;
        }
        super.onInputChange();
    }
}

export class AdaptedStartWalkRightState extends StartWalkRight {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7;
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkRightState ID: ${charId}] Created`, 'log', `AdaptedStartWalkRight_Create_${charId}`, 0, undefined, 'normal');
        directPlayAnimation(this.character, 'run', 0.1);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        this.transitionTimer += timeStep;
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            appendToCustomLog(`[AdaptedStartWalkRightState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Transitioning to Walk.`, 'log', `AdaptedStartWalkRight_ToWalk_${charId}`, 500, undefined, 'normal');
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        appendToCustomLog(`[AdaptedStartWalkRightState.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`, 'log', `AdaptedStartWalkRight_InputChange_${charId}`, 1000, undefined, 'normal');
        if (noDir) {
            appendToCustomLog(`[AdaptedStartWalkRightState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`, 'log', `AdaptedStartWalkRight_ToEndWalk_${charId}`, 0, undefined, 'normal');
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        if (anyDir) {
            super.onInputChange();
        }
    }
}

export class AdaptedStartWalkLeftState extends StartWalkLeft {
    protected transitionTimer = 0;
    protected readonly TRANSITION_TIMEOUT = 0.7;
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedStartWalkLeftState ID: ${charId}] Created`, 'log', `AdaptedStartWalkLeft_Create_${charId}`, 0, undefined, 'normal');
        directPlayAnimation(this.character, 'run', 0.1);
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        this.transitionTimer += timeStep;
        if (this.timer > 0.2 || this.transitionTimer >= this.TRANSITION_TIMEOUT) {
            appendToCustomLog(`[AdaptedStartWalkLeftState.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, Transition: ${this.transitionTimer.toFixed(3)}/${this.TRANSITION_TIMEOUT}. Transitioning to Walk.`, 'log', `AdaptedStartWalkLeft_ToWalk_${charId}`, 500, undefined, 'normal');
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        super.update(timeStep);
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const anyDir = this.anyDirection();
        const noDir = this.noDirection();
        appendToCustomLog(`[AdaptedStartWalkLeftState.onInputChange ID: ${charId}] anyDirection is ${anyDir}, noDirection is ${noDir}. Input: up=${this.character.actions.up.isPressed},down=${this.character.actions.down.isPressed},left=${this.character.actions.left.isPressed},right=${this.character.actions.right.isPressed}`, 'log', `AdaptedStartWalkLeft_InputChange_${charId}`, 1000, undefined, 'normal');
        if (noDir) {
            appendToCustomLog(`[AdaptedStartWalkLeftState.onInputChange ID: ${charId}] No direction keys pressed, transitioning to EndWalk state`, 'log', `AdaptedStartWalkLeft_ToEndWalk_${charId}`, 0, undefined, 'normal');
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        if (anyDir) {
            super.onInputChange();
        }
    }
}

export class AdaptedEndWalk extends EndWalk {
    private _lastLogTime: number = 0;
    private _animationAlreadyPlayed: boolean = false;
    
    constructor(character: any) {
        super(character);
        const charId = (this.character as any)?.debugId || 'unknown_AEW_Constr';
        this._animationAlreadyPlayed = false;
        appendToCustomLog(`[AdaptedEndWalk CONSTRUCTOR ID: ${charId}] Initialized. Timer: ${this.timer.toFixed(3)}, Base AnimLen: ${this.animationLength.toFixed(3)}.`, 'log', `AdaptedEndWalk_Construct_${charId}`, 0, undefined, 'normal');
    }
    
    public enter(oldState: ICharacterState): void {
        const charId = (this.character as any)?.debugId || 'unknown_AEW_Enter';
        super.enter(oldState as any);
        this._animationAlreadyPlayed = (this.animationLength > 0);
        appendToCustomLog(`[AdaptedEndWalk.enter ID: ${charId}] After super.enter(). Timer: ${this.timer.toFixed(3)}, AnimLen: ${this.animationLength.toFixed(3)}, AnimPlayedFlag: ${this._animationAlreadyPlayed}`, 'log', `AdaptedEndWalk_EnterComplete_${charId}`, 0, undefined, 'critical');
    }
        
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown_AEW_Update';
        super.update(timeStep);
        if (Date.now() - this._lastLogTime > 500) {
            appendToCustomLog(`[AdaptedEndWalk.update ID: ${charId}] Values - Timer: ${this.timer.toFixed(3)}, AnimLen: ${this.animationLength.toFixed(3)}, State: ${this.character.charState?.constructor.name}, Played: ${this._animationAlreadyPlayed}`, 'log', `AdaptedEndWalk_UpdateCycle_${charId}`, 0, undefined, 'normal');
            this._lastLogTime = Date.now();
        }
        if (this.animationLength <= 0 && this.character.charState === this) {
            appendToCustomLog(`[AdaptedEndWalk.update ID: ${charId}] AnimLen is ${this.animationLength.toFixed(3)}. This is unexpected after enter(). Setting to 0.5s failsafe.`, 'warn', `AdaptedEndWalk_AnimLenFailsafe_${charId}`, 0, undefined, 'normal');
            this.animationLength = 0.5;
            this._animationAlreadyPlayed = true;
        }
        if (this.timer >= this.animationLength && this.character.charState === this) {
            appendToCustomLog(`[AdaptedEndWalk.update ID: ${charId}] 'stop' animation timer condition met (Timer ${this.timer.toFixed(3)} >= AnimLen ${this.animationLength.toFixed(3)}). Transitioning to AdaptedIdleState.`, 'log', `AdaptedEndWalk_TransitionToIdle_${charId}`, 0, undefined, 'critical');
            this.character.setState(new AdaptedIdleState(this.character));
            return;
        }
    }

    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown_AEW_InputChange';
        appendToCustomLog(`[AdaptedEndWalk.onInputChange ID: ${charId}] Passing input change to super class (EndWalk).`, 'log', `AdaptedEndWalk_SuperInputChange_${charId}`, 0, undefined, 'normal');
        super.onInputChange();
    }
}

export class AdaptedIdleState extends Idle {
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown_AI_Constr';
        appendToCustomLog(`[AdaptedIdleState ID: ${charId}] Created. Base Idle constructor should have initiated 'idle' animation.`, 'log', `AdaptedIdle_Create_${charId}`, 0, undefined, 'critical');
    }
        
    public update(timeStep: number): void {
        super.update(timeStep);
        const charId = (this.character as any)?.debugId || 'unknown_AI_Update';
        const rayHasHit = (this.character as any).threeRayHit ?? false;
        const yVel = (this.character as any)?.characterCapsule?.body?.velocity?.y || 0;
        
        if (!rayHasHit && yVel < -0.1 && this.character.charState === this) {
            appendToCustomLog(`[AdaptedIdleState.update ID: ${charId}] Fall detected. Transitioning to Falling state. Ray hit: ${rayHasHit}, Char Y vel: ${yVel.toFixed(2)}`, 'log', `AdaptedIdle_ToFalling_${charId}`, 0, undefined, 'normal');
            this.character.setState(new Falling(this.character)); // Uses original Falling state
            return;
        }
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown_AI_InputChange';
        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Input received. Passing to super.onInputChange().`, 'log', `AdaptedIdle_SuperInputChange_${charId}`, 0, undefined, 'normal');
        super.onInputChange(); 

        if (this.character.charState === this) {
            const up = this.character.actions.up.isPressed;
            const down = this.character.actions.down.isPressed;
            const left = this.character.actions.left.isPressed;
            const right = this.character.actions.right.isPressed;
            const run = this.character.actions.run?.isPressed || false;
            const anyDirectionPressed = up || down || left || right;
        
            if (anyDirectionPressed) {
                appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Directional input detected (after super). Up=${up}, Left=${left}, Right=${right}, Run=${run}`, 'log', `AdaptedIdle_Directional_${charId}`, 0, undefined, 'normal');
                if (run) {
                    appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Transitioning to AdaptedSprintState.`, 'log', `AdaptedIdle_ToSprint_${charId}`, 0, undefined, 'normal');
                    this.character.setState(new AdaptedSprintState(this.character));
                } else {
                    if (up) {
                        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Transitioning to AdaptedStartWalkForwardState.`, 'log', `AdaptedIdle_ToStartWalkFwd_${charId}`, 0, undefined, 'normal');
                        this.character.setState(new AdaptedStartWalkForwardState(this.character));
                    } else if (left) {
                        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Transitioning to AdaptedStartWalkLeftState.`, 'log', `AdaptedIdle_ToStartWalkLeft_${charId}`, 0, undefined, 'normal');
                        this.character.setState(new AdaptedStartWalkLeftState(this.character));
                    } else if (right) {
                        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Transitioning to AdaptedStartWalkRightState.`, 'log', `AdaptedIdle_ToStartWalkRight_${charId}`, 0, undefined, 'normal');
                        this.character.setState(new AdaptedStartWalkRightState(this.character));
                    } else if (down) {
                        appendToCustomLog(`[AdaptedIdleState.onInputChange ID: ${charId}] Down pressed. No AdaptedStartWalkBackwardState. Defaulting to AdaptedWalkState.`, 'warn', `AdaptedIdle_ToWalkFallbackDown_${charId}`, 0, undefined, 'normal');
                        this.character.setState(new AdaptedWalkState(this.character)); 
                    }
                }
                return; 
            }
        }
    }
}

export class AdaptedSprintState extends Sprint {
    private _animationCheckTimer: number = 0;
    private readonly _checkInterval: number = 0.1;
    private _lastAnimationTime: number = 0;
    private _noInputTimer: number = 0;
    private readonly _maxNoInputTime: number = 0.05;
    
    constructor(character: any) {
        super(character);
        const charId = (character as any)?.debugId || 'unknown';
        appendToCustomLog(`[AdaptedSprintState ID: ${charId}] Created.`, 'log', `AdaptedSprint_Create_${charId}`, 0, undefined, 'normal');
        this.playSprintAnimation(0.05);
    }
    
    private playSprintAnimation(fadeIn: number = 0.1): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const now = Date.now() / 1000;
        if (now - this._lastAnimationTime < 0.1) {
            return;
        }
        this._lastAnimationTime = now;
        const currentAnim = (this.character as any)._currentAnimation || null;
        const sprintTimeScale = 1.0;
        appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Current anim: '${currentAnim}', ensuring 'run' animation with sprint speed`, 'log', `AdaptedSprint_AnimCheck_${charId}`, 500, undefined, 'normal');
        const animPlayed = directPlayAnimation(this.character, 'run', fadeIn);
        if (!animPlayed) {
            appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Failed to play 'run' animation directly, trying fallback`, 'warn', `AdaptedSprint_DirectFail_${charId}`, 0, undefined, 'normal');
            const setAnimResult = this.character.setAnimation('run', fadeIn);
            if (setAnimResult < 0) {
                appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] CRITICAL: Both animation methods failed!`, 'error', `AdaptedSprint_AnimFail_${charId}`, 0, undefined, 'critical');
                return;
            }
        }
        try {
            const runClip = this.character.animations?.find((clip: THREE.AnimationClip) => clip.name === 'run' || clip.name.toLowerCase() === 'run');
            if (runClip && this.character.mixer) {
                const action = this.character.mixer.existingAction(runClip);
                if (action) {
                    action.timeScale = sprintTimeScale;
                    appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Applied timeScale: ${sprintTimeScale} to run animation for sprint effect`, 'log', `AdaptedSprint_TimeScale_${charId}`, 500, undefined, 'normal');
                }
            }
        } catch (error) {
            appendToCustomLog(`[AdaptedSprintState.playSprintAnimation ID: ${charId}] Error applying timeScale: ${(error as Error).message}`, 'error', `AdaptedSprint_TimeScaleError_${charId}`, 0, undefined, 'critical');
        }
    }
    
    public update(timeStep: number): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        const runKeyPressed = this.character.actions.run.isPressed;
        
        if (Math.floor(this.timer * 10) % 10 === 0) {
            appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Input: up=${up}, down=${down}, left=${left}, right=${right}, run=${runKeyPressed}`, 'log', `AdaptedSprint_InputCheck_${charId}`, 1000, undefined, 'normal');
        }
        
        if (!anyDirectionPressed) {
            this._noInputTimer += timeStep;
            const now = Date.now();
            const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
            const minTimeBetweenStateChanges = 100;
            if (now - lastStateChange >= minTimeBetweenStateChanges && this._noInputTimer >= this._maxNoInputTime) {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] No input detected, immediately transitioning to EndWalk`, 'warn', `AdaptedSprint_NoInputTransition_${charId}`, 0, undefined, 'critical');
                (this.character as any)._lastStateChangeTime = now;
                directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
                this.character.setState(new AdaptedEndWalk(this.character));
                return;
            } else {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] No input detected but too soon (${now - lastStateChange}ms) since last state change. Waiting.`, 'log', `AdaptedSprint_WaitingForTransition_${charId}`, 1000, undefined, 'normal');
            }
        } else {
            this._noInputTimer = 0;
            if (Date.now() / 1000 - this._lastAnimationTime >= 0.25) {
                this.playSprintAnimation(0.1);
            }
        }
        
        super.update(timeStep);
        this._animationCheckTimer += timeStep;
        
        if (this._animationCheckTimer >= this._checkInterval) {
            this._animationCheckTimer = 0;
            if (anyDirectionPressed) {
                const currentAnim = (this.character as any)._currentAnimation || null;
                if (currentAnim !== 'run') {
                    appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Animation mismatch detected. Current: '${currentAnim}', forcing 'run'`, 'warn', `AdaptedSprint_AnimMismatch_${charId}`, 0, undefined, 'critical');
                    this.playSprintAnimation(0.05);
                }
            }
        }
        
        if (!runKeyPressed && anyDirectionPressed) {
            const now = Date.now();
            const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
            const minTimeBetweenStateChanges = 150;
            if (now - lastStateChange >= minTimeBetweenStateChanges) {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Run key released while moving, transitioning to AdaptedWalkState`, 'log', `AdaptedSprint_ToWalk_${charId}`, 0, undefined, 'normal');
                (this.character as any)._lastStateChangeTime = now;
                this.character.setState(new AdaptedWalkState(this.character));
                return;
            } else {
                appendToCustomLog(`[AdaptedSprintState.update ID: ${charId}] Run key released but suppressing transition (${now - lastStateChange}ms < ${minTimeBetweenStateChanges}ms)`, 'log', `AdaptedSprint_SuppressTransition_${charId}`, 500, undefined, 'normal');
            }
        }
    }
    
    public onInputChange(): void {
        const charId = (this.character as any)?.debugId || 'unknown';
        const now = Date.now();
        const lastStateChange = (this.character as any)._lastStateChangeTime || 0;
        const minTimeBetweenStateChanges = 100;
        
        const up = this.character.actions.up.isPressed;
        const down = this.character.actions.down.isPressed;
        const left = this.character.actions.left.isPressed;
        const right = this.character.actions.right.isPressed;
        const anyDirectionPressed = up || down || left || right;
        
        appendToCustomLog(`[AdaptedSprintState.onInputChange ID: ${charId}] Direction keys: up=${up}, down=${down}, left=${left}, right=${right}`, 'log', `AdaptedSprint_InputDetails_${charId}`, 500, undefined, 'normal');
        
        if (!this.character.actions.run.isPressed && anyDirectionPressed) {
            appendToCustomLog(`[AdaptedSprintState.onInputChange ID: ${charId}] Run released but still has direction input, transitioning to Walk`, 'log', `AdaptedSprint_ToWalk_${charId}`, 0, undefined, 'normal');
            (this.character as any)._lastStateChangeTime = now;
            this.character.setState(new AdaptedWalkState(this.character));
            return;
        }
        
        if (!anyDirectionPressed) {
            appendToCustomLog(`[AdaptedSprintState.onInputChange ID: ${charId}] *** No direction keys pressed, FORCING transition to EndWalk ***`, 'warn', `AdaptedSprint_ToEndWalk_${charId}`, 0, undefined, 'critical');
            (this.character as any)._lastStateChangeTime = now;
            directPlayAnimation(this.character, 'stop', 0.05, THREE.LoopOnce);
            this.character.setState(new AdaptedEndWalk(this.character));
            return;
        }
        super.onInputChange();
    }
} 