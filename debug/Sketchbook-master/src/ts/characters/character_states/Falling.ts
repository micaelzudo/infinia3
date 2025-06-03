import { CharacterStateBase } from './CharacterStateBase';
import { ICharacterState } from '../../interfaces/ICharacterState';
import { Character } from '../Character';
import { EntityType } from '../../enums/EntityType';

export class Falling extends CharacterStateBase implements ICharacterState
{
	constructor(character: Character)
	{
		super(character);

		this.character.velocitySimulator.mass = 100;
		this.character.rotationSimulator.damping = 0.3;

		this.character.arcadeVelocityIsAdditive = true;
		this.character.setArcadeVelocityInfluence(0.05, 0, 0.05);

		this.playAnimation('falling', 0.3);

		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';

		const hasOwnMethod = Object.prototype.hasOwnProperty.call(this, 'setAppropriateDropState');
		const proto = Object.getPrototypeOf(this);
		const hasProtoMethod = proto && Object.prototype.hasOwnProperty.call(proto, 'setAppropriateDropState');
		const baseProto = proto ? Object.getPrototypeOf(proto) : null;
		const hasBaseProtoMethod = baseProto && Object.prototype.hasOwnProperty.call(baseProto, 'setAppropriateDropState');
        const methodExists = typeof (this as any).setAppropriateDropState === 'function';

		appendToCustomLogBase(
			`[Falling Constructor ID: ${charId}] Method check: ` +
			`setAppropriateDropState exists: ${methodExists}, ` +
            `Own: ${hasOwnMethod}, Proto: ${hasProtoMethod} (Name: ${proto?.constructor?.name}), ` +
            `BaseProto: ${hasBaseProtoMethod} (Name: ${baseProto?.constructor?.name})`,
			'log', 
            `Falling_constructor_check_${charId}`,
            0, 
            undefined, 
            'critical'
		);
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);

		this.character.setCameraRelativeOrientationTarget();
		this.character.setArcadeVelocityTarget(this.anyDirection() ? 0.8 : 0);

		if (this.character.rayHasHit)
		{
			// ---- DEBUG LOGGING ----
			const charId = this.character.entityType === EntityType.Character ? (this.character as any).debugId : 'N/A';
			let appendToCustomLog: any = console.log;
			try {
			    if (typeof (window as any).appendToCustomLog === 'function') {
			        appendToCustomLog = (window as any).appendToCustomLog;
			    }
			} catch (e) { /* ignore */ }

			const methodExistsInUpdate = typeof (this as any).setAppropriateDropState === 'function';
			appendToCustomLog(
			    `[Falling.update ID: ${charId}] Pre-call check: setAppropriateDropState exists: ${methodExistsInUpdate}`,
			    'log', 
			    `Falling_update_check_${charId}`,
			    0, 
			    undefined, 
			    'critical'
			);
			if (!methodExistsInUpdate) {
			     const proto = Object.getPrototypeOf(this);
			     const baseProto = proto ? Object.getPrototypeOf(proto) : null;
			     appendToCustomLog(
			        `[Falling.update ID: ${charId}] Method missing! Proto: ${proto?.constructor?.name}, BaseProto: ${baseProto?.constructor?.name}`,
			        'error', 
			        `Falling_update_missing_${charId}`,0,undefined,'critical'
			    );
			    console.error("[Falling.update] Properties of 'this':", Object.getOwnPropertyNames(this));
			    if (proto) console.error("[Falling.update] Properties of 'this.__proto__' (Falling.prototype):", Object.getOwnPropertyNames(proto));
			    if (baseProto) console.error("[Falling.update] Properties of 'this.__proto__.__proto__' (CharacterStateBase.prototype):", Object.getOwnPropertyNames(baseProto));
			}
			// ---- END DEBUG LOGGING ----
			this.setAppropriateDropState();
		}
	}
}