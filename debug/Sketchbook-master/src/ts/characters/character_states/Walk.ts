import
{
	CharacterStateBase,
	EndWalk,
	Idle,
	JumpRunning,
	Sprint,
} from './_stateLibrary';
import { Character } from '../Character';
import * as THREE from 'three'; // No longer strictly needed here if we play one anim
import { EntityType } from '../../enums/EntityType'; // Added for logging

export class Walk extends CharacterStateBase
{
	private currentWalkAnim: string = '';
	private lastSignificantMoveDirection: THREE.Vector3 = new THREE.Vector3(0,0,1); // Used for strafing orientation
	private _walkGraceTimer: number = -1;

	constructor(character: Character)
	{
		super(character);

		this.canEnterVehicles = true;
		this.character.setArcadeVelocityTarget(0.8);
		// Initial animation set in first update or onInputChange
	}

	private getTargetAnimationAndOrientation(localMovementDirection: THREE.Vector3): {
		animName: string,
		orientationTarget?: THREE.Vector3
	} {
		const x = localMovementDirection.x;
		const z = localMovementDirection.z;
		let animName = 'walk';
		let characterRelativeOrientationTarget: THREE.Vector3 | undefined = undefined;

		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		appendToCustomLogBase(`[Walk.getTargetAnimationAndOrientation ID: ${charId}] Input localMoveDir: (${x.toFixed(2)}, ${z.toFixed(2)})`, 'log', `Walk_getTargetAnim_${charId}`, 1000, undefined, 'normal');

		const cameraRelativeMovementVector = this.character.getCameraRelativeMovementVector();

		if (Math.abs(x) > 0.5 && Math.abs(z) < 0.5) { // Pure strafe (A or D, not W/S)
			animName = 'walk';
			// For pure strafe, maintain current forward orientation (or camera's forward)
			// Here we use the character's current orientation projected flat. 
			// More advanced: use camera's forward direction if preferred.
			characterRelativeOrientationTarget = this.character.orientation.clone().setY(0).normalize(); 
			if (characterRelativeOrientationTarget.lengthSq() === 0) { // If current orientation is vertical, default to world Z
				characterRelativeOrientationTarget.set(0,0,1);
			}
		} else if (z > 0.5) { // Moving forward or forward-diagonal
			if (Math.abs(x) > 0.5) { // Forward diagonal W+A or W+D
				// Option 1: Play a specific diagonal animation if you have it
				// animName = x < 0 ? 'run_forward_left' : 'run_forward_right';
				// Option 2: Play strafe animation but orient diagonally
				animName = 'walk';
				characterRelativeOrientationTarget = cameraRelativeMovementVector; // Orient towards the actual movement
			} else { // Pure forward
				animName = 'walk';
				characterRelativeOrientationTarget = cameraRelativeMovementVector;
			}
		} else if (z < -0.5) { // Moving backward or backward-diagonal
			animName = 'walk';
			characterRelativeOrientationTarget = cameraRelativeMovementVector;
		} else if (this.anyDirection()) {
            // Some minor input, default to forward run and orient that way
            animName = 'walk';
            characterRelativeOrientationTarget = cameraRelativeMovementVector;
        } else {
            // No input, default to run_forward (though should transition out of Walk soon)
            animName = 'walk';
			// Keep last orientation if no new input to determine target
			characterRelativeOrientationTarget = this.character.orientation.clone().setY(0).normalize();
        }

		appendToCustomLogBase(`[Walk.getTargetAnimationAndOrientation ID: ${charId}] Result: animName='${animName}', orientationTarget=(${(characterRelativeOrientationTarget ? characterRelativeOrientationTarget.x.toFixed(2) + ',' + characterRelativeOrientationTarget.z.toFixed(2) : 'undefined')})`, 'log', `Walk_getTargetAnimResult_${charId}`, 1000, undefined, 'normal');
		return { animName, orientationTarget: characterRelativeOrientationTarget };
	}

	public update(timeStep: number, unscaledTimeStep?: number): void
	{
		super.update(timeStep, unscaledTimeStep);

		this.timer += timeStep;

		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		// Get state information but don't log it on every frame
		const anyDir = this.anyDirection();
		const noDir = this.noDirection();
		const velocityLength = this.character.velocity.length();
		const groundNormalY = this.character.rayHasHit ? this.character.rayResult.hitNormalWorld.y : 1.0;
		
		// Only log if there's an actual state change or only occasionally (once per second)
		if (Math.floor(this.timer) % 5 === 0 && Math.floor(this.timer) !== Math.floor(this.timer - timeStep)) {  // Log approximately once every 5 seconds
			appendToCustomLogBase(`[Walk.update ID: ${charId}] State info: anyDir: ${anyDir}, noDir: ${noDir}, velLen: ${velocityLength.toFixed(3)}, GroundNormalY: ${groundNormalY.toFixed(3)}, CurrentState: ${this.constructor.name}`, 'log', `Walk_StateInfo_${charId}`, 1000, undefined, 'normal');
		}

		// Private Walk state property for grace period
		if (this._walkGraceTimer === undefined) {
			this._walkGraceTimer = -1;
		}

		// Check if stuck, but ONLY if we've been stuck for a while
		// This prevents the character from immediately transitioning to EndWalk on slopes
		if (anyDir && velocityLength < 0.1) { // Threshold for being 'stuck'
			// Only consider "stuck" if on a mostly flat surface (steep slopes are handled differently)
			const onSteepSlope = groundNormalY < 0.85; // More than ~30 degrees slope
			
			// Start grace timer if not already started
			if (this._walkGraceTimer < 0) {
				this._walkGraceTimer = 0;
				appendToCustomLogBase(`[Patched Walk.update ID: ${charId}] Velocity low while input pressed. Starting grace timer. Velocity: ${velocityLength.toFixed(3)}, Slope: ${groundNormalY.toFixed(3)}`, 'warn', `Walk_GraceStart_${charId}`, 0, undefined, 'critical');
			} else {
				// Increment grace timer
				this._walkGraceTimer += timeStep;
				
				// Only transition if we've been stuck for a while AND not on a steep slope
				if (this._walkGraceTimer > 0.5 && !onSteepSlope) { // 500ms grace period
					appendToCustomLogBase(`[Patched Walk.update ID: ${charId}] Walking but stuck for ${this._walkGraceTimer.toFixed(2)}s (velocity: ${velocityLength.toFixed(3)}). Slope Normal Y: ${groundNormalY.toFixed(3)}. Transitioning to EndWalk.`, 'warn', `Walk_StuckToEndWalk_${charId}`, 0, undefined, 'critical');
					this.character.setState(new EndWalk(this.character));
					return; // Transitioned, so skip rest of update
				}
			}
		} else {
			// Reset grace timer if we're not stuck
			if (this._walkGraceTimer >= 0) {
				appendToCustomLogBase(`[Patched Walk.update ID: ${charId}] No longer stuck. Resetting grace timer. Velocity: ${velocityLength.toFixed(3)}`, 'log', `Walk_GraceReset_${charId}`, 0, undefined, 'normal');
				this._walkGraceTimer = -1;
			}
		}

		const localMovementDirection = this.character.getLocalMovementDirection();
		appendToCustomLogBase(`[Walk.update ID: ${charId}] localMovementDirection: (${localMovementDirection.x.toFixed(2)}, ${localMovementDirection.z.toFixed(2)})`, 'log', `Walk_update_localMove_${charId}`, 1000, undefined, 'normal');

		const { animName, orientationTarget } = this.getTargetAnimationAndOrientation(localMovementDirection);

		if (orientationTarget && orientationTarget.lengthSq() > 0.001) {
			appendToCustomLogBase(`[Walk.update ID: ${charId}] Setting orientation from getTarget: (${orientationTarget.x.toFixed(2)}, ${orientationTarget.z.toFixed(2)})`, 'log', `Walk_update_setOrient_${charId}`, 1000, undefined, 'normal');
			this.character.setOrientation(orientationTarget);
		} else {
			// Default orientation behavior if not specified by strafing/etc.
			appendToCustomLogBase(`[Walk.update ID: ${charId}] Setting camera relative orientation target.`, 'log', `Walk_update_setCamRelOrient_${charId}`, 1000, undefined, 'normal');
			this.character.setCameraRelativeOrientationTarget();
		}
		
		if (animName && this.currentWalkAnim !== animName) {
			appendToCustomLogBase(`[Walk.update ID: ${charId}] Playing animation: ${animName} (current was: ${this.currentWalkAnim})`, 'log', `Walk_update_playAnim_${charId}`, 1000, undefined, 'normal');
			this.currentWalkAnim = animName;
			this.playAnimation(this.currentWalkAnim, 0.1);
		}
	}

	public onInputChange(): void
	{
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		// More detailed logging of input states
		const upPressed = this.character.actions.up.isPressed;
		const downPressed = this.character.actions.down.isPressed;
		const leftPressed = this.character.actions.left.isPressed;
		const rightPressed = this.character.actions.right.isPressed;
		const noDirectionResult = this.noDirection();
		
		appendToCustomLogBase(`[Patched Walk.onInputChange ID: ${charId}] Input state: up=${upPressed}, down=${downPressed}, left=${leftPressed}, right=${rightPressed}, noDirection()=${noDirectionResult}, _walkGraceTimer=${this._walkGraceTimer?.toFixed(3) || 'undefined'}`, 'log', `Walk_onInputChange_Detail_${charId}`, 0, undefined, 'critical');

		if (noDirectionResult)
		{
			appendToCustomLogBase(`[Patched Walk.onInputChange ID: ${charId}] CRITICAL: noDirection() is TRUE and _walkGraceTimer (${this._walkGraceTimer?.toFixed(3) || 'N/A'}) is <= 0. Transitioning to EndWalk.`, 'warn', `Walk_to_EndWalk_${charId}`, 0, undefined, 'critical');
			this.character.setState(new EndWalk(this.character));
			return;
		}
		
		if (this.character.actions.run.isPressed)
		{
			appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] 'run' is pressed. Transitioning to Sprint.`, 'log', `Walk_to_Sprint_${charId}`, 0, undefined, 'normal');
			this.character.setState(new Sprint(this.character));
			return;
		}
		
		if (this.character.actions.jump.justPressed)
		{
			appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] 'jump' just pressed. Transitioning to JumpRunning.`, 'log', `Walk_to_JumpRunning_${charId}`, 0, undefined, 'normal');
			this.character.setState(new JumpRunning(this.character));
			return;
		}

		// Re-evaluate animation and orientation on input change if not transitioning out
		const localMovementDirection = this.character.getLocalMovementDirection();
		appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] Re-evaluating anim/orient. localMovementDirection: (${localMovementDirection.x.toFixed(2)}, ${localMovementDirection.z.toFixed(2)})`, 'log', `Walk_onInputChange_reeval_${charId}`, 1000, undefined, 'normal');

		const { animName, orientationTarget } = this.getTargetAnimationAndOrientation(localMovementDirection);
		
		if (orientationTarget && orientationTarget.lengthSq() > 0.001) {
			appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] Setting orientation (instant) from getTarget: (${orientationTarget.x.toFixed(2)}, ${orientationTarget.z.toFixed(2)})`, 'log', `Walk_onInputChange_setOrient_${charId}`, 1000, undefined, 'normal');
			this.character.setOrientation(orientationTarget, true); // Set instantly on input change for responsiveness
		} else {
			appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] Setting camera relative orientation target.`, 'log', `Walk_onInputChange_setCamRelOrient_${charId}`, 1000, undefined, 'normal');
			this.character.setCameraRelativeOrientationTarget(); // Fallback
		}

		if (animName && this.currentWalkAnim !== animName) {
			appendToCustomLogBase(`[Walk.onInputChange ID: ${charId}] Playing animation: ${animName} (current was: ${this.currentWalkAnim})`, 'log', `Walk_onInputChange_playAnim_${charId}`, 1000, undefined, 'normal');
			this.currentWalkAnim = animName;
			this.playAnimation(this.currentWalkAnim, 0.1);
		}
	}
}