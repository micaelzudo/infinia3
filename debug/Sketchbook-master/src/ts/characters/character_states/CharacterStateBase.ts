import * as THREE from 'three';
import * as Utils from '../../core/FunctionLibrary';
import {
	DropIdle,
	DropRolling,
	DropRunning,
	Falling,
	Idle,
	Sprint,
	StartWalkBackLeft,
	StartWalkBackRight,
	StartWalkForward,
	StartWalkLeft,
	StartWalkRight,
	Walk,
} from './_stateLibrary';
import { Character } from '../Character';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { EntityType } from '../../enums/EntityType';

export abstract class CharacterStateBase implements ICharacterState
{
	public character: Character;
	public timer: number;
	public animationLength: any;

	public canFindVehiclesToEnter: boolean;
	public canEnterVehicles: boolean;
	public canLeaveVehicles: boolean;

	constructor(character: Character)
	{
		this.character = character;

		this.canFindVehiclesToEnter = true;
		this.canEnterVehicles = false;
		this.canLeaveVehicles = false;

		this.character.velocitySimulator.damping = this.character.defaultVelocitySimulatorDamping;
		this.character.velocitySimulator.mass = this.character.defaultVelocitySimulatorMass;

		this.character.rotationSimulator.damping = this.character.defaultRotationSimulatorDamping;
		this.character.rotationSimulator.mass = this.character.defaultRotationSimulatorMass;

		this.character.arcadeVelocityIsAdditive = true;
		this.character.setArcadeVelocityInfluence(0.05, 0.05, 0.05);

		this.timer = 0;
	}

	public update(timeStep: number, unscaledTimeStep?: number): void
	{
		this.timer += timeStep;

        const currentStateName = this.constructor.name;
        let appendToCustomLogBase: any = console.log;
        try {
            if (typeof (window as any).appendToCustomLog === 'function') {
                appendToCustomLogBase = (window as any).appendToCustomLog;
            }
        } catch (e) { /* ignore */ }

        if (currentStateName === 'DropIdle' || currentStateName === 'Idle' || currentStateName === 'Walk') {
            const activeInputs = Object.entries(this.character.actions)
                .filter(([_, action]) => action.isPressed)
                .map(([key, _]) => key)
                .join(', ') || 'None';
            appendToCustomLogBase(
                `[${currentStateName}.update PRE-FALL_CHECK ID: ${this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A'}] ` +
                `rayHasHit: ${this.character.rayHasHit}, ` +
                `Body Vel Y: ${this.character.characterCapsule.body.velocity.y.toFixed(2)}, ` +
                `Active Inputs: ${activeInputs}, ` +
                `Char Pos Y: ${this.character.position.y.toFixed(2)}`,
                'log',
                `CSB_preFallCheck_${currentStateName}`,
                10000,
                undefined,
                'critical'
            );
        }

		this.fallInAir(timeStep);
	}

	public abstract onInputChange(): void;

	public fallInAir(timeStep: number): void
	{
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';

		if (!this.character.rayHasHit)
		{
			this.character.timeSinceLastGroundContact += timeStep;
			appendToCustomLogBase(`[CharacterStateBase.fallInAir ID: ${charId}] Ray no hit. timeSinceLastGroundContact: ${this.character.timeSinceLastGroundContact.toFixed(3)}s (Grace: ${this.character.GROUNDED_GRACE_PERIOD}s)`, 'log', `CSB_fallInAir_NoHit_${charId}`, 250, undefined, 'normal');

			if (this.character.timeSinceLastGroundContact > this.character.GROUNDED_GRACE_PERIOD)
			{
				if (!(this.character.charState instanceof Falling)) {
					appendToCustomLogBase(`[CharacterStateBase.fallInAir ID: ${charId}] Grace period exceeded. Current state: ${this.character.charState ? this.character.charState.constructor.name : 'None'}. Setting state to Falling. BodyVelY: ${this.character.characterCapsule.body.velocity.y.toFixed(3)}`, 'warn', `CSB_fallInAir_ToFalling_${charId}`, 0, undefined, 'critical');
					this.character.setState(new Falling(this.character));
				} else {
					appendToCustomLogBase(`[CharacterStateBase.fallInAir ID: ${charId}] Grace period exceeded BUT current state is already Falling. No state change. BodyVelY: ${this.character.characterCapsule.body.velocity.y.toFixed(3)}`, 'log', `CSB_fallInAir_GraceAlreadyFalling_${charId}`, 2000, undefined, 'normal');
				}
			}
			// Else, grace period not exceeded, do nothing yet, stay in current grounded state
		}
		else // Character.rayHasHit is true
		{
			if (this.character.timeSinceLastGroundContact > 0) {
				appendToCustomLogBase(`[CharacterStateBase.fallInAir ID: ${charId}] Ray HAS hit. Resetting timeSinceLastGroundContact (was ${this.character.timeSinceLastGroundContact.toFixed(3)}s).`, 'log', `CSB_fallInAir_ResetGrace_${charId}`, 250, undefined, 'normal');
			}
			this.character.timeSinceLastGroundContact = 0;
			// Original logging for ray hit can remain if needed for other debug purposes, or be throttled more.
			// appendToCustomLogBase(`[CharacterStateBase.fallInAir ID: ${charId}] Condition NOT met (this.character.rayHasHit = ${this.character.rayHasHit}). Current state: ${this.constructor.name}. NOT setting state to Falling. HitPoint: (${this.character.rayResult.hitPointWorld.x.toFixed(2)}, ${this.character.rayResult.hitPointWorld.y.toFixed(2)}, ${this.character.rayResult.hitPointWorld.z.toFixed(2)}), HitDistance: ${this.character.rayResult.distance.toFixed(2)}, BodyVelY: ${this.character.characterCapsule.body.velocity.y.toFixed(3)}`, 'log', `CSB_fallInAir_False_${charId}`, 2000, undefined, 'normal');
        }
	}

	public findVehicleToEnter(wantsToDrive: boolean): void
	{
		this.character.findVehicleToEnter(wantsToDrive);
	}

	public getAppropriateStationaryState(): ICharacterState
	{
		return new Idle(this.character);
	}

	public getAppropriateDropState(): void
	{
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		const currentVelLength = this.character.velocity.length();
		const anyDir = this.anyDirection();

		appendToCustomLogBase(`[CharacterStateBase.getAppropriateDropState ID: ${charId}] Called. Current state: ${this.constructor.name}. Velocity Length: ${currentVelLength.toFixed(2)}. anyDirection: ${anyDir}`, 'log', `CSB_getDropState_Entry_${charId}`, 0, undefined, 'critical');

		if (currentVelLength > 1) // Threshold for rolling might need adjustment
		{
			appendToCustomLogBase(`[CharacterStateBase.getAppropriateDropState ID: ${charId}] Condition: VelLength (${currentVelLength.toFixed(2)}) > 1. Setting state to DropRolling.`, 'log', `CSB_getDropState_ToRoll_${charId}`, 0, undefined, 'critical');
			this.character.setState(new DropRolling(this.character));
		}
		else if (anyDir)
		{
			appendToCustomLogBase(`[CharacterStateBase.getAppropriateDropState ID: ${charId}] Condition: anyDirection is true. Setting state to DropRunning.`, 'log', `CSB_getDropState_ToRun_${charId}`, 0, undefined, 'critical');
			this.character.setState(new DropRunning(this.character));
		}
		else
		{
			appendToCustomLogBase(`[CharacterStateBase.getAppropriateDropState ID: ${charId}] Condition: No significant velocity and no direction. Setting state to DropIdle.`, 'log', `CSB_getDropState_ToIdle_${charId}`, 0, undefined, 'critical');
			this.character.setState(new DropIdle(this.character));
		}
	}

	public setAppropriateDropState(): void
    {
        this.getAppropriateDropState();
    }

	public setAppropriateStartWalkState(): void
	{
		let character = this.character;
		let newAnimName = this.getNewAnimationName(character);

		if (newAnimName === '') return;

		let targetState: any;
		switch(newAnimName)
		{
			case 'start_forward':
				targetState = StartWalkForward;
				break;
			case 'start_backward':
				targetState = StartWalkBackRight;
				break;
			case 'start_left':
				targetState = StartWalkLeft;
				break;
			case 'start_right':
				targetState = StartWalkRight;
				break;
			case 'start_back_left': 
				targetState = StartWalkBackLeft;
				break;
			case 'start_back_right':
				targetState = StartWalkBackRight;
				break;
			default:
				// Use appendToCustomLogBase if available, otherwise console.warn
				let logger = console.warn;
				try {
				    if (typeof (window as any).appendToCustomLog === 'function') {
				        logger = (text: string) => (window as any).appendToCustomLog(text, 'warn', `CSB_setAppropriateStart_Unhandled_${(this.character as any).debugId || 'char'}_${newAnimName}`, 0, undefined, 'critical');
				    }
				} catch (e) { /* ignore */ }
				logger('Unhandled move animation name in setAppropriateStartWalkState: ' + newAnimName + '. CharID: ' + ((this.character as any).debugId || 'N/A'));
				return;
		}

		// Ensure targetState is not undefined before proceeding
		if (targetState) {
		    // Use appendToCustomLogBase if available, otherwise console.warn
		    let logger = console.warn;
		    const charId = (this.character as any).debugId || 'N/A';
		    try {
		        if (typeof (window as any).appendToCustomLog === 'function') {
		            logger = (text: string) => (window as any).appendToCustomLog(text, 'warn', `CSB_setAppropriateStart_TransTo_${charId}_${targetState.name}`, 0, undefined, 'critical');
		        }
		    } catch (e) { /* ignore */ }

		    logger(`[CharacterStateBase.setAppropriateStartWalkState ID: ${charId}] Attempting to transition to: ${targetState.name} (from anim: ${newAnimName})`);
		    this.character.setState(new targetState(this.character));
		} else {
		    // Fallback or error logging if targetState remained undefined (shouldn't happen if newAnimName was valid)
		    let logger = console.error;
		    const charId = (this.character as any).debugId || 'N/A';
		    try {
		        if (typeof (window as any).appendToCustomLog === 'function') {
		            logger = (text: string) => (window as any).appendToCustomLog(text, 'error', `CSB_setAppropriateStart_TargetNull_${charId}_${newAnimName}`, 0, undefined, 'critical');
		        }
		    } catch (e) { /* ignore */ }
		    logger(`[CharacterStateBase.setAppropriateStartWalkState ID: ${charId}] CRITICAL: targetState is undefined for newAnimName: ${newAnimName}. Cannot transition.`);
		}
	}

	public anyDirection(): boolean
	{
		return this.character.actions.up.isPressed || 
			this.character.actions.down.isPressed || 
			this.character.actions.left.isPressed || 
			this.character.actions.right.isPressed;
	}

	public getNewAnimationName(character: Character): string
	{
		let newAnimName: string = '';

        // Conditional logging to avoid breaking pristine Sketchbook if our custom properties aren't there
        if ((character as any).debugId && typeof console !== 'undefined' && console.warn) {
            const charIdForLog = (character as any).debugId || 'UnknownChar';
            const upJP = character.actions.up.justPressed;
            const downJP = character.actions.down.justPressed;
            const leftJP = character.actions.left.justPressed;
            const rightJP = character.actions.right.justPressed;
            const upIP = character.actions.up.isPressed;
            const downIP = character.actions.down.isPressed;
            const leftIP = character.actions.left.isPressed;
            const rightIP = character.actions.right.isPressed;
            console.warn(`[CSB.getNewAnimationName ID: ${charIdForLog}] DETAILED Inputs: upIP:${upIP}(jp:${upJP}), downIP:${downIP}(jp:${downJP}), leftIP:${leftIP}(jp:${leftJP}), rightIP:${rightIP}(jp:${rightJP})`);
        }

		if (character.actions.up.justPressed)
		{
			if (character.actions.left.isPressed) newAnimName = 'start_forward_left';
			else if (character.actions.right.isPressed) newAnimName = 'start_forward_right';
			else newAnimName = 'start_forward';
		}
		else if (character.actions.down.justPressed)
		{
			if (character.actions.left.isPressed) newAnimName = 'start_back_left';
			else if (character.actions.right.isPressed) newAnimName = 'start_back_right';
			else newAnimName = 'start_backward';
		}
		else if (character.actions.left.justPressed)
		{
			if (character.actions.up.isPressed) newAnimName = 'start_forward_left';
			else if (character.actions.down.isPressed) newAnimName = 'start_back_left';
			else newAnimName = 'start_left';
		}
		else if (character.actions.right.justPressed)
		{
			if (character.actions.up.isPressed) newAnimName = 'start_forward_right';
			else if (character.actions.down.isPressed) newAnimName = 'start_back_right';
			else newAnimName = 'start_right';
		}

        if ((character as any).debugId && typeof console !== 'undefined' && console.warn) {
            const charIdForLog = (character as any).debugId || 'UnknownChar';
            console.warn(`[CSB.getNewAnimationName ID: ${charIdForLog}] Determined newAnimName: '${newAnimName}'`);
        }

		return newAnimName;
	}

	public noDirection(): boolean
	{
		return !this.character.actions.up.isPressed && !this.character.actions.down.isPressed && !this.character.actions.left.isPressed && !this.character.actions.right.isPressed;
	}

	public animationEnded(timeStep: number): boolean
	{
		if (this.character.mixer !== undefined)
		{
			if (this.animationLength === undefined)
			{
				console.error(this.constructor.name + ' state has no animationLength defined');
				return false;
		    }
			
			// Add detailed logging 
			const charId = (this.character as any).debugId || 'N/A';
			const stateName = this.constructor.name;
			const thisTimer = this.timer;
			const thisAnimationLength = this.animationLength;
			const result = this.timer > this.animationLength - timeStep;
			
			try {
				if (typeof (window as any).appendToCustomLog === 'function') {
					(window as any).appendToCustomLog(
						`[CharState.animationEnded ID: ${charId}] State: ${stateName}, Timer: ${thisTimer?.toFixed ? thisTimer.toFixed(3) : thisTimer}, AnimLength: ${thisAnimationLength?.toFixed ? thisAnimationLength.toFixed(3) : thisAnimationLength}, TimeStep: ${timeStep.toFixed(5)}, Result: ${result}`,
						'warn',
						`CSB_AnimEnd_${charId}_${stateName}`,
						0,
						undefined,
						'critical'
					);
				}
			} catch (e) { /* ignore */ }
			
			return result;
		}
		else { return false; }
	}

	public playAnimation(animationName: string, fadeIn: number): void
	{
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A_BaseStatePlayAnim';
		let appendToCustomLog: any = console.log;
		try {
			if (typeof (window as any).appendToCustomLog === 'function') {
				appendToCustomLog = (window as any).appendToCustomLog;
			}
		} catch (e) { /* ignore */ }

		appendToCustomLog(`[CSB playAnimation ID: ${charId}] Called for clip: '${animationName}', fadeIn: ${fadeIn}. Current state: ${this.constructor.name}`, 'log', `CSB_playAnimation_Call_${charId}_${animationName}`, 0, undefined, 'critical');
		
		const returnedDuration = this.character.setAnimation(animationName, fadeIn);
		this.animationLength = returnedDuration;

		appendToCustomLog(`[CSB playAnimation ID: ${charId}] AFTER this.character.setAnimation('${animationName}'). Returned duration: ${returnedDuration} (type: ${typeof returnedDuration}). this.animationLength is now: ${this.animationLength} (type: ${typeof this.animationLength})`, 'log', `CSB_playAnimation_Result_${charId}_${animationName}`, 0, undefined, 'critical');

		if (typeof returnedDuration !== 'number' || returnedDuration <= 0) {
			appendToCustomLog(`[CSB playAnimation ID: ${charId}] CRITICAL WARNING: setAnimation for '${animationName}' did NOT return a positive number. Animation will likely fail or have issues. Duration was: ${returnedDuration}`, 'error', `CSB_playAnimation_BadReturn_${charId}_${animationName}`, 0, undefined, 'critical');
		}
	}

	public enter(oldState: ICharacterState): void
	{
		// Default behavior
	}

	public exit(): void
	{
		// Default behavior
	}
}