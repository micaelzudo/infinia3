import * as THREE from 'three';
import
{
	CharacterStateBase,
	JumpIdle,
	Walk,
} from './_stateLibrary';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { EntityType } from '../../enums/EntityType';

export class Idle extends CharacterStateBase implements ICharacterState
{
	constructor(character: Character)
	{
		super(character);

		this.character.velocitySimulator.damping = 0.6;
		this.character.velocitySimulator.mass = 10;

		this.character.setArcadeVelocityTarget(0);
		this.character.velocitySimulator.init();
		this.playAnimation('idle', 0.1);
	}

	public update(timeStep: number, unscaledTimeStep?: number): void
	{
		super.update(timeStep, unscaledTimeStep);
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

		if (this.character.actions.jump.justPressed)
		{
			appendToCustomLogBase(`[Idle.onInputChange ID: ${charId}] 'jump' just pressed. Transitioning to JumpIdle.`, 'log', `Idle_to_JumpIdle_${charId}`, 0, undefined, 'normal');
			this.character.setState(new JumpIdle(this.character));
			return; // Exit after handling jump
		}

		// Check for translational movement intent
		const right = this.character.actions.right.isPressed ? 1 : 0;
		const left = this.character.actions.left.isPressed ? -1 : 0;
		const up = this.character.actions.up.isPressed ? 1 : 0;
		const down = this.character.actions.down.isPressed ? -1 : 0;

		const localMoveDirection = new THREE.Vector3(right + left, 0, up + down);

		if (localMoveDirection.lengthSq() > 0.01) // If there is significant translational input
		{
			appendToCustomLogBase(`[Idle.onInputChange ID: ${charId}] Translational input detected (Dir: ${localMoveDirection.x.toFixed(1)},${localMoveDirection.z.toFixed(1)}). Processing walk/start_walk.`, 'log', `Idle_TransInput_${charId}`, 0, undefined, 'normal');
			const velocityLength = this.character.velocity.length();
			if (velocityLength > 0.5) // If already moving somewhat fast
			{
				appendToCustomLogBase(`[Idle.onInputChange ID: ${charId}] Velocity (${velocityLength.toFixed(2)}) > 0.5. Transitioning to Walk.`, 'log', `Idle_to_Walk_${charId}`, 0, undefined, 'normal');
				this.character.setState(new Walk(this.character));
			}
			else // Translational input detected, but not moving much (or at all)
			{
				appendToCustomLogBase(`[Idle.onInputChange ID: ${charId}] Velocity (${velocityLength.toFixed(2)}) <= 0.5. Setting appropriate start walk state.`, 'log', `Idle_to_StartWalk_${charId}`, 0, undefined, 'normal');
				this.setAppropriateStartWalkState();
			}
		} else {
			appendToCustomLogBase(`[Idle.onInputChange ID: ${charId}] No significant translational input (Dir: ${localMoveDirection.x.toFixed(1)},${localMoveDirection.z.toFixed(1)}). Remaining in Idle.`, 'log', `Idle_NoTransInput_${charId}`, 2000, undefined, 'normal');
		}
	}
}