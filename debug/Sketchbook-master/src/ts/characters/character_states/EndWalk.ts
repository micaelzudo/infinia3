import
{
	CharacterStateBase,
	Idle,
	JumpIdle,
	Sprint,
	Walk,
} from './_stateLibrary';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { appendToCustomLog } from '../../../../../modules/ui/customLogger';

export class EndWalk extends CharacterStateBase implements ICharacterState
{
	public timer: number;
	public animationLength: number;

	constructor(character: Character)
	{
		super(character);
		this.character.velocitySimulator.damping = 0.6;
		this.character.velocitySimulator.mass = 7;

		this.timer = 0;
		this.animationLength = 0;

		const charId = (this.character as any).debugId || 'unknown_EW_Constr';
		appendToCustomLog(`[EndWalk CONSTRUCTOR ID: ${charId}] Initialized. Timer: ${this.timer}, AnimLen: ${this.animationLength}. Waiting for enter().`, 'log', `EndWalk_Construct_${charId}`, 0, undefined, 'critical');
	}

	public enter(previousState: CharacterStateBase): void {
		super.enter(previousState);

		const charId = (this.character as any).debugId || 'unknown_EW_Enter';
		this.timer = 0;

		let durationFromSetAnimation = this.character.setAnimation('stop', 0.1);
		appendToCustomLog(`[EndWalk.enter ID: ${charId}] Step 1: setAnimation('stop') returned: ${typeof durationFromSetAnimation} value: ${durationFromSetAnimation}`, 'log', `EndWalk_Enter_S1_${charId}`, 0, undefined, 'critical');

		let numericDuration = Number(durationFromSetAnimation);

		if (isNaN(numericDuration) || numericDuration <= 0) {
			appendToCustomLog(`[EndWalk.enter ID: ${charId}] Step 2: durationFromSetAnimation ('${durationFromSetAnimation}') is invalid or not positive. numericDuration=${numericDuration}. Applying failsafe.`, 'warn', `EndWalk_Enter_S2_FailSafe_${charId}`, 0, undefined, 'critical');
			this.animationLength = 0.5;
			appendToCustomLog(`[EndWalk.enter ID: ${charId}] Step 3: animationLength (after failsafe) is: ${this.animationLength.toFixed(3)}`, 'log', `EndWalk_Enter_S3_AfterFailSafe_${charId}`, 0, undefined, 'critical');
		} else {
			this.animationLength = numericDuration;
			appendToCustomLog(`[EndWalk.enter ID: ${charId}] Step 2: animationLength (from setAnimation) is valid: ${this.animationLength.toFixed(3)}. No failsafe needed.`, 'log', `EndWalk_Enter_S2_Valid_${charId}`, 0, undefined, 'critical');
		}

		appendToCustomLog(`[EndWalk.enter ID: ${charId}] FINAL at exit of enter(): animationLength = ${this.animationLength.toFixed(3)}, timer = ${this.timer.toFixed(3)}`, 'log', `EndWalk_Enter_Final_${charId}`, 0, undefined, 'critical');
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);

		this.timer += timeStep;

		const charId = (this.character as any).debugId || 'unknown_EW_Update';
		appendToCustomLog(`[EndWalk.update ID: ${charId}] Timer: ${this.timer.toFixed(3)}, AnimLen: ${this.animationLength.toFixed(3)}. Transition Cond: ${this.timer > this.animationLength}`, 'log', `EndWalk_Update_${charId}`, 0, undefined, 'critical');

		/*
		if (this.timer > this.animationLength)
		{
			appendToCustomLog(`[EndWalk.update ID: ${charId}] Timer (${this.timer.toFixed(3)}) > AnimLen (${this.animationLength.toFixed(3)}). SETTING STATE TO IDLE.`, 'log', `EndWalk_ToIdle_${charId}`, 0, undefined, 'critical');
			this.character.setState(new Idle(this.character));
			return;
		}
		*/

		this.fallInAir(timeStep);
	}

	public onInputChange(): void
	{
		const charId = (this.character as any).debugId || 'unknown_EW_InputChange';

		if (this.character.actions.jump.justPressed)
		{
			appendToCustomLog(`[EndWalk.onInputChange ID: ${charId}] Jump detected. Transitioning to JumpIdle.`, 'log', `EndWalk_ToJump_${charId}`, 0, undefined, 'critical');
			this.character.setState(new JumpIdle(this.character));
			return;
		}

		if (this.anyDirection())
		{
			if (this.character.actions.run.isPressed)
			{
				appendToCustomLog(`[EndWalk.onInputChange ID: ${charId}] Input detected (anyDirection + run). Transitioning to Sprint.`, 'log', `EndWalk_ToSprint_${charId}`, 0, undefined, 'critical');
				this.character.setState(new Sprint(this.character));
			}
			else
			{
				appendToCustomLog(`[EndWalk.onInputChange ID: ${charId}] Input detected (anyDirection). Transitioning to Walk.`, 'log', `EndWalk_ToWalk_${charId}`, 0, undefined, 'critical');
				this.character.setState(new Walk(this.character));
			}
		}
	}
}