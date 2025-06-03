import
{
	CharacterStateBase,
	EndWalk,
	JumpRunning,
	Walk,
} from './_stateLibrary';
import { Character } from '../Character';

export class Sprint extends CharacterStateBase
{
	constructor(character: Character)
	{
		super(character);

		this.canEnterVehicles = true;

		this.character.velocitySimulator.mass = 10;
		this.character.rotationSimulator.damping = 0.8;
		this.character.rotationSimulator.mass = 50;

		this.character.setArcadeVelocityTarget(1.4);
		this.playAnimation('sprint', 0.1);
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);
		this.character.setCameraRelativeOrientationTarget();

		// If sprint action is pressed, and a directional key is pressed, but character is not moving fast enough,
		// transition to Walk. This handles getting stuck on slopes while trying to sprint.
		const charId = (this.character as any).debugId || 'SprintState'; // Safely get charId for logging
		let appendToCustomLogBase: any = console.log;
		try {
			if (typeof (window as any).appendToCustomLog === 'function') {
				appendToCustomLogBase = (window as any).appendToCustomLog;
			}
		} catch (e) { /* ignore */ }

		if (this.character.actions.run.isPressed && this.anyDirection() && this.character.velocity.length() < 0.15) { // Threshold for being 'stuck'
			let slopeInfo = '';
			if (this.character.rayHasHit) {
				slopeInfo = ` Slope Normal Y: ${this.character.rayResult.hitNormalWorld.y.toFixed(3)}.`;
			}
			appendToCustomLogBase(`[Sprint.update ID: ${charId}] Sprinting but stuck (velocity: ${this.character.velocity.length().toFixed(2)}).${slopeInfo} Transitioning to Walk.`, 'warn', `Sprint_StuckToWalk_${charId}`, 0, undefined, 'critical');
			this.character.setState(new Walk(this.character));
		}
	}

	public onInputChange(): void
	{
		if (!this.character.actions.run.isPressed)
		{
			this.character.setState(new Walk(this.character));
		}

		if (this.character.actions.jump.justPressed)
		{
			this.character.setState(new JumpRunning(this.character));
		}

		if (this.noDirection())
		{
			this.character.setState(new EndWalk(this.character));
		}
	}
}