import {
	CharacterStateBase,
	Idle,
	JumpIdle,
	StartWalkForward,
	Falling,
} from './_stateLibrary';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { EntityType } from '../../enums/EntityType';

export class DropIdle extends CharacterStateBase implements ICharacterState
{
	constructor(character: Character)
	{
		super(character);

		this.character.velocitySimulator.damping = 0.5;
		this.character.velocitySimulator.mass = 7;

		this.character.setArcadeVelocityTarget(0);
		this.playAnimation('drop_idle', 0.1);

		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
			if (typeof (window as any).appendToCustomLog === 'function') {
				appendToCustomLogBase = (window as any).appendToCustomLog;
			}
		} catch (e) { /* ignore */ }
		appendToCustomLogBase(`[DropIdle Constructor ID: ${charId}] Entered. anyDirection was: ${this.anyDirection()}. Removed immediate StartWalkForward transition.`, 'log', `DropIdle_Constructor_${charId}`, 0, undefined, 'critical');
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

		if (this.character.charState instanceof Falling) {
			appendToCustomLog(`[DropIdle.update ID: ${charId}] Already in Falling state due to super.update(). Skipping rest of DropIdle update.`, 'warn', `DropIdle_AlreadyFalling_${charId}`, 0, undefined, 'critical');
			return;
		}

		this.character.setCameraRelativeOrientationTarget();
		
		const ended = this.animationEnded(timeStep);
		appendToCustomLog(
			`[DropIdle.update ID: ${charId}] Animation check: ended=${ended}, timer=${this.timer.toFixed(3)}, animLength=${this.animationLength}, timeStep=${timeStep.toFixed(3)}`,
			'log',
			`DropIdle_AnimCheck_${charId}`,
			0,
			undefined,
			'normal'
		);

		if (ended)
		{
			appendToCustomLog(`[DropIdle.update ID: ${charId}] Animation ended. Transitioning to Idle.`, 'log', `DropIdle_AnimEndToIdle_${charId}`, 0, undefined, 'critical');
			this.character.setState(new Idle(this.character));
		}
	}

	public onInputChange(): void
	{
		if (this.character.actions.jump.justPressed)
		{
			this.character.setState(new JumpIdle(this.character));
		}

		if (this.anyDirection())
		{
			this.character.setState(new StartWalkForward(this.character));
		}
	}
}