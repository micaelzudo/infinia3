import
{
	CharacterStateBase,
	EndWalk,
	JumpRunning,
	Sprint,
	Walk,
	Falling,
} from './_stateLibrary';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { EntityType } from '../../enums/EntityType';

export class DropRunning extends CharacterStateBase implements ICharacterState
{
	constructor(character: Character)
	{
		super(character);

		this.character.setArcadeVelocityTarget(0.8);
		this.playAnimation('drop_running', 0.1);
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);

		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLog: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLog = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		if (this.character.charState !== this && this.character.charState instanceof Falling) { 
            appendToCustomLog(`[DropRunning.update ID: ${charId}] State changed to Falling by super.update(). Skipping rest of DropRunning update.`, 'warn', `DropRunning_AlreadyFalling_${charId}`, 0, undefined, 'critical');
            return;
        }

		this.character.setCameraRelativeOrientationTarget();

		const ended = this.animationEnded(timeStep);
		appendToCustomLog(
			`[DropRunning.update ID: ${charId}] Animation check: ended=${ended}, timer=${this.timer.toFixed(3)}, animLength=${this.animationLength}, timeStep=${timeStep.toFixed(3)}`,
			'log',
			`DropRunning_AnimCheck_${charId}`,
			0,
			undefined,
			'normal'
		);

		if (ended)
		{
			appendToCustomLog(`[DropRunning.update ID: ${charId}] Animation ended. Transitioning to Walk.`, 'log', `DropRunning_AnimEndToWalk_${charId}`, 0, undefined, 'critical');
			this.character.setState(new Walk(this.character));
		}
	}

	public onInputChange(): void
	{
		if (this.noDirection())
		{
			this.character.setState(new EndWalk(this.character));
		}

		if (this.anyDirection() && this.character.actions.run.justPressed)
		{
			this.character.setState(new Sprint(this.character));
		}

		if (this.character.actions.jump.justPressed)
		{
			this.character.setState(new JumpRunning(this.character));
		}
	}
}