import { StartWalkBase } from './_stateLibrary';
import { Character } from '../Character';

export class StartWalkBackLeft extends StartWalkBase
{
	constructor(character: Character)
	{
		super(character);
		try {
			// Try to use the original animation
			this.animationLength = character.setAnimation('start_back_left', 0.1);
		} catch (error) {
			// Fallback to an existing animation if 'start_back_left' is not available
			console.log('Animation "start_back_left" not found, using "start_back_right" as fallback');
			this.animationLength = character.setAnimation('start_back_right', 0.1);
		}
	}
}