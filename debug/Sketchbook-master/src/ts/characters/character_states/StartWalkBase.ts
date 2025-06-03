import * as Utils from '../../core/FunctionLibrary';
import
{
	CharacterStateBase,
	Idle,
	IdleRotateLeft,
	IdleRotateRight,
	JumpRunning,
	Sprint,
	Walk,
} from './_stateLibrary';
import { Character } from '../Character';

export class StartWalkBase extends CharacterStateBase
{
	constructor(character: Character)
	{
		super(character);

		this.canEnterVehicles = true;
		this.character.rotationSimulator.mass = 20;
		this.character.rotationSimulator.damping = 0.7;

		this.character.setArcadeVelocityTarget(0.8);
		// this.character.velocitySimulator.damping = 0.5;
		// this.character.velocitySimulator.mass = 1;
	}

	public update(timeStep: number): void
	{
		super.update(timeStep);
        // @ts-ignore
        const charId = this.character.debugId || 'UnknownChar_SWB_Update';
        // @ts-ignore
        const ended = this.animationEnded(timeStep);
        // @ts-ignore
        console.warn(`[StartWalkBase UPDATE ID: ${charId}] Timer: ${this.timer?.toFixed ? this.timer.toFixed(3) : this.timer}, AnimLength: ${this.animationLength?.toFixed ? this.animationLength.toFixed(3) : this.animationLength}, AnimationEnded: ${ended}`);

		if (ended)
		{
            // @ts-ignore
            console.warn(`[StartWalkBase UPDATE ID: ${charId}] Animation ended. Attempting to set state to Walk.`);
			this.character.setState(new Walk(this.character));
		}

		this.character.setCameraRelativeOrientationTarget();

		//
		// Different velocity treating experiments
		//

		// let matrix = new THREE.Matrix3();
		// let o =  new THREE.Vector3().copy(this.character.orientation);
		// matrix.set(
		//     o.z,  0,  o.x,
		//     0,    1,  0,
		//     -o.x, 0,  o.z);
		// let inverse = new THREE.Matrix3().getInverse(matrix);
		// let directionVector = this.character.getCameraRelativeMovementVector();
		// directionVector = directionVector.applyMatrix3(inverse);
		// directionVector.normalize();

		// this.character.setArcadeVelocity(directionVector.z * 0.8, directionVector.x * 0.8);

		this.fallInAir(timeStep);
	}

	public onInputChange(): void
	{
		// super.onInputChange(); // This was causing an error as CharacterStateBase.onInputChange is abstract
        // @ts-ignore
        const charId = this.character.debugId || 'UnknownChar_SWB_InputChange';
        // @ts-ignore
        const noDir = this.noDirection();
        // @ts-ignore
        const anyDirection = this.anyDirection();
        // @ts-ignore
        const upPressed = this.character.actions.up.isPressed;
        const downPressed = this.character.actions.down.isPressed;
        const leftPressed = this.character.actions.left.isPressed;
        const rightPressed = this.character.actions.right.isPressed;

        // Important: Enable patched behavior for StartWalkBase states
        // @ts-ignore
        console.warn(`[Patched StartWalkBase.onInputChange ID: ${charId}] anyDirection is ${anyDirection ? 'TRUE' : 'FALSE'}. ${anyDirection ? 'Calling original onInputChange' : 'Skipping original onInputChange\'s noDirection()->Idle'}. Input: up=${upPressed},down=${downPressed},left=${leftPressed},right=${rightPressed}`);
        
        // Only proceed with input change checks if the animation hasn't just started
        // @ts-ignore
        if (this.timer < 0.2) {
            // @ts-ignore
            console.warn(`[StartWalkBase.onInputChange ID: ${charId}] Animation just started (timer: ${this.timer?.toFixed ? this.timer.toFixed(3) : this.timer}), deferring input check`);
            return; // Don't interrupt the start walk animation
        }
		
		// Only handle jump if any direction is still being pressed 
		if (anyDirection && this.character.actions.jump.justPressed)
		{
            // @ts-ignore
            console.warn(`[StartWalkBase ON_INPUT_CHANGE ID: ${charId}] Jump detected. Setting state to JumpRunning.`);
			this.character.setState(new JumpRunning(this.character));
            return;
		}

		// Only transition to idle if definitely no direction and we've allowed enough time for animation
		if (noDir)
		{
			// Simplified: if no direction input, always transition to Idle.
            // @ts-ignore
            console.warn(`[StartWalkBase ON_INPUT_CHANGE ID: ${charId}] No direction input. Setting state to Idle.`);
			this.character.setState(new Idle(this.character));
			return; // Exit after setting state
		}

		// Only allow sprint transition if we're still holding a direction
		if (anyDirection && this.character.actions.run.isPressed) // Changed from justPressed to isPressed
		{
            // @ts-ignore
            console.warn(`[StartWalkBase ON_INPUT_CHANGE ID: ${charId}] Run pressed with direction. Setting state to Sprint.`);
			this.character.setState(new Sprint(this.character));
            return;
		}
	}
}