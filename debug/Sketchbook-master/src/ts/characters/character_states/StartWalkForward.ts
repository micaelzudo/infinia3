import {StartWalkBase} from './_stateLibrary';
import { Character } from '../Character';

export class StartWalkForward extends StartWalkBase
{
	constructor(character: Character)
	{
		super(character);
        // @ts-ignore
        const charId = character.debugId || 'UnknownChar_SWF';
        // @ts-ignore
        console.warn(`[StartWalkForward CONSTRUCTOR ID: ${charId}] Entered. About to set 'start_forward' animation.`);
		this.animationLength = character.setAnimation('start_forward', 0.1);
        // @ts-ignore
        console.warn(`[StartWalkForward CONSTRUCTOR ID: ${charId}] 'start_forward' animation set. Received animationLength: ${this.animationLength?.toFixed ? this.animationLength.toFixed(3) : this.animationLength}`);
	}
}