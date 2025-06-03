import
{
	CharacterStateBase,
	Idle,
	JumpIdle,
	Walk,
} from './_stateLibrary';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { EntityType } from '../../enums/EntityType';

export class IdleRotateLeft extends CharacterStateBase implements ICharacterState
{
	private rotationAnimTimer: number = 0; 
	private minRotationAnimTime: number = 0.25;
	private _patchedAnimStartTime: number = 0;
	
	constructor(character: Character)
	{
		super(character);

		this.character.rotationSimulator.mass = 30;
		this.character.rotationSimulator.damping = 0.6;

		this.character.velocitySimulator.damping = 0.6;
		this.character.velocitySimulator.mass = 10;

		this.character.setArcadeVelocityTarget(0);
		this.playAnimation('rotate_left', 0.1);
		
		this._patchedAnimStartTime = Date.now();
		
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		
		appendToCustomLogBase(`[IdleRotateLeft.constructor ID: ${charId}] ENTERED state. Set animation 'rotate_left' with 0.1s blend time. Timer initialized.`, 'log', undefined, undefined, undefined, 'critical');
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);
		
		this.rotationAnimTimer += timeStep;
		
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		
		if (Math.random() < 0.1) {
		    appendToCustomLogBase(`[IdleRotateLeft.update ID: ${charId}] rotationAnimTimer: ${this.rotationAnimTimer.toFixed(3)}s, minTime: ${this.minRotationAnimTime}s`, 'log', `IdleRotLeft_update_${charId}`, 500, undefined, 'normal');
		}

		if (this.rotationAnimTimer >= this.minRotationAnimTime) {
			if (this.animationEnded(timeStep)) {
				appendToCustomLogBase(`[IdleRotateLeft.update ID: ${charId}] Animation ended after ${this.rotationAnimTimer.toFixed(3)}s. Transitioning to Idle.`, 'log', undefined, undefined, undefined, 'critical');
				this.character.setState(new Idle(this.character));
				return;
			}
		}

		this.fallInAir();
	}

	public animationEnded(timeStep: number): boolean {
		const elapsed = (Date.now() - this._patchedAnimStartTime) / 1000;
		
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		
		if (elapsed < 0.3) {
			if (Math.random() < 0.05) {
				appendToCustomLogBase(`[IdleRotateLeft.animationEnded ID: ${charId}] Enforcing minimum play time. Elapsed: ${elapsed.toFixed(3)}s, waiting for at least 0.3s`, 'log', `IdleRotLeft_animEnd_${charId}`, 1000, undefined, 'normal');
			}
			return false;
		}
		
		let animEnded = super.animationEnded(timeStep);
		
		if (Math.random() < 0.05) {
			appendToCustomLogBase(`[IdleRotateLeft.animationEnded ID: ${charId}] Animation ${animEnded ? 'HAS ENDED' : 'still playing'} after ${elapsed.toFixed(3)}s`, 'log', `IdleRotLeft_animEnd_${charId}`, 1000, undefined, 'normal');
		}
		
		return animEnded;
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
		
		appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] Input changed. rotationAnimTimer: ${this.rotationAnimTimer.toFixed(3)}s`, 'log', undefined, undefined, undefined, 'critical');
		
		if (this.character.actions.jump.justPressed)
		{
			appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] Jump pressed, transitioning to JumpIdle`, 'log', undefined, undefined, undefined, 'critical');
			this.character.setState(new JumpIdle(this.character));
			return;
		}

		if (this.noDirection())
		{
			if (this.rotationAnimTimer >= this.minRotationAnimTime) {
				appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] No direction input after min rotation time, transitioning to Idle`, 'log', undefined, undefined, undefined, 'critical');
				this.character.setState(new Idle(this.character));
			} else {
				appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] No direction but preventing early Idle transition. Current timer: ${this.rotationAnimTimer.toFixed(3)}s`, 'log', undefined, undefined, undefined, 'critical');
			}
			return;
		}

		if (this.anyDirection())
		{
			if (this.character.velocity.length() > 0.5)
			{
				appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] Direction input with velocity > 0.5, transitioning to Walk`, 'log', undefined, undefined, undefined, 'critical');
				this.character.setState(new Walk(this.character));
			}
			else
			{
				appendToCustomLogBase(`[IdleRotateLeft.onInputChange ID: ${charId}] Direction input with low velocity, setting appropriate start walk state`, 'log', undefined, undefined, undefined, 'critical');
				this.setAppropriateStartWalkState();
			}
		}
	}
}