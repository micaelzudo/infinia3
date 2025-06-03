import * as THREE from 'three';
import * as Utils from './FunctionLibrary';
import { World } from '../world/World';
import { IInputReceiver } from '../interfaces/IInputReceiver';
import { KeyBinding } from './KeyBinding';
import { Character } from '../characters/Character';
import * as _ from 'lodash';
import { IUpdatable } from '../interfaces/IUpdatable';

export class CameraOperator implements IInputReceiver, IUpdatable
{
	public updateOrder: number = 4;

	public world: World;
	public camera: THREE.Camera;
	public target: THREE.Vector3;
	public sensitivity: THREE.Vector2;
	public radius: number = 1;
	public theta: number;
	public phi: number;
	public onMouseDownPosition: THREE.Vector2;
	public onMouseDownTheta: any;
	public onMouseDownPhi: any;
	public targetRadius: number = 1;

	public movementSpeed: number;
	public actions: { [action: string]: KeyBinding };

	public upVelocity: number = 0;
	public forwardVelocity: number = 0;
	public rightVelocity: number = 0;

	public followMode: boolean = false;

	public characterCaller: Character;

	constructor(world: World, camera: THREE.Camera, sensitivityX: number = 1, sensitivityY: number = sensitivityX * 0.8)
	{
		this.world = world;
		this.camera = camera;
		this.target = new THREE.Vector3();
		this.sensitivity = new THREE.Vector2(sensitivityX, sensitivityY);

		this.movementSpeed = 0.06;
		this.radius = 3;
		this.theta = 0;
		this.phi = 0;

		this.onMouseDownPosition = new THREE.Vector2();
		this.onMouseDownTheta = this.theta;
		this.onMouseDownPhi = this.phi;

		this.actions = {
			'forward': new KeyBinding('KeyW'),
			'back': new KeyBinding('KeyS'),
			'left': new KeyBinding('KeyA'),
			'right': new KeyBinding('KeyD'),
			'up': new KeyBinding('KeyE'),
			'down': new KeyBinding('KeyQ'),
			'fast': new KeyBinding('ShiftLeft'),
		};

		world.registerUpdatable(this);
	}

	public setSensitivity(sensitivityX: number, sensitivityY: number = sensitivityX): void
	{
		this.sensitivity = new THREE.Vector2(sensitivityX, sensitivityY);
	}

	public setRadius(value: number, instantly: boolean = false): void
	{
		this.targetRadius = Math.max(0.001, value);
		if (instantly === true)
		{
			this.radius = value;
		}
	}

	public move(deltaX: number, deltaY: number): void
	{
		this.theta -= deltaX * (this.sensitivity.x / 2);
		this.theta %= 360;
		this.phi += deltaY * (this.sensitivity.y / 2);
	}

	public update(timeScale: number): void
	{
		if (this.followMode === true)
		{
			// Continuously update the target to the character's position + camera height offset
			if (this.characterCaller)
			{
				// Log character position
				if (isNaN(this.characterCaller.position.x) || isNaN(this.characterCaller.position.y) || isNaN(this.characterCaller.position.z)) {
					console.error(`[CameraOperator] CRITICAL: characterCaller.position is NaN before copying to target: (${this.characterCaller.position.x}, ${this.characterCaller.position.y}, ${this.characterCaller.position.z})`);
				}
				this.target.copy(this.characterCaller.position);
				const cameraHeightOffset = (this.characterCaller as any).cameraHeight !== undefined ? (this.characterCaller as any).cameraHeight : 1.6;
				
				if (isNaN(cameraHeightOffset)) {
					console.error(`[CameraOperator] CRITICAL: cameraHeightOffset is NaN. Defaulting to 1.6.`);
					this.target.y += 1.6;
				} else {
					this.target.y += cameraHeightOffset;
				}

				if (isNaN(this.target.x) || isNaN(this.target.y) || isNaN(this.target.z)) {
					console.error(`[CameraOperator] CRITICAL: this.target became NaN: (${this.target.x}, ${this.target.y}, ${this.target.z}). Resetting to origin.`);
					this.target.set(0,1.6,0); // Reset to a safe default
				}
			} else {
				console.warn("[CameraOperator] Follow mode is true, but characterCaller is undefined. Camera may not update target correctly.");
				// Keep current target or reset if it's bad
				if (isNaN(this.target.x) || isNaN(this.target.y) || isNaN(this.target.z)) {
					 this.target.set(0,1.6,0); // Reset to a safe default if characterCaller is missing and target is bad
				}
			}

			this.radius = THREE.MathUtils.lerp(this.radius, this.targetRadius, 0.1);
			if (isNaN(this.radius)) {
				console.error(`[CameraOperator] CRITICAL: this.radius became NaN. Resetting to ${this.targetRadius}.`);
				this.radius = this.targetRadius; // Reset to targetRadius or a sensible default if targetRadius is also bad
				if (isNaN(this.radius)) this.radius = 3; // Absolute fallback for radius
			}

			// Log theta and phi
			if (isNaN(this.theta) || isNaN(this.phi)) {
				console.error(`[CameraOperator] CRITICAL: theta (${this.theta}) or phi (${this.phi}) is NaN. Resetting theta=0, phi=0.`);
				this.theta = 0;
				this.phi = 0;
			}

			// Calculate new camera position
			const newX = this.target.x + this.radius * Math.sin(this.theta * Math.PI / 180) * Math.cos(this.phi * Math.PI / 180);
			const newY = this.target.y + this.radius * Math.sin(this.phi * Math.PI / 180);
			const newZ = this.target.z + this.radius * Math.cos(this.theta * Math.PI / 180) * Math.cos(this.phi * Math.PI / 180);

			try {
				const logFunc = (window as any).appendToCustomLog || console.log;
				logFunc(
					`[CameraOperator Update] Phi: ${this.phi.toFixed(2)}, Radius: ${this.radius.toFixed(2)}, TargetY: ${this.target.y.toFixed(2)}, Calc newY: ${newY.toFixed(2)}`,
					'log', 'CO_Phi_NewY', 500, undefined, 'normal'
				);
			} catch (e) {
				console.log(`[CameraOperator Update] Phi: ${this.phi.toFixed(2)}, Radius: ${this.radius.toFixed(2)}, TargetY: ${this.target.y.toFixed(2)}, Calc newY: ${newY.toFixed(2)}`);
			}

			if (isNaN(newX) || isNaN(newY) || isNaN(newZ)) {
				console.error(`[CameraOperator] CRITICAL: Calculated new camera position would be NaN: (X:${newX}, Y:${newY}, Z:${newZ}). Preventing update. Current cam pos: (${this.camera.position.x}, ${this.camera.position.y}, ${this.camera.position.z}).`);
				// Optionally, reset camera to a very safe state if its current state is also NaN
				if (isNaN(this.camera.position.x) || isNaN(this.camera.position.y) || isNaN(this.camera.position.z)) {
					this.camera.position.set(0, 1.6, 5); // Absolute fallback position
					console.error(`[CameraOperator] Camera current position was also NaN. Reset to default.`);
				}
			} else {
				this.camera.position.set(newX, newY, newZ);
			}
			
			this.camera.updateMatrix(); // Update local matrix based on new position

			// Before lookAt, ensure camera position and target are valid
			if (isNaN(this.camera.position.x) || isNaN(this.camera.position.y) || isNaN(this.camera.position.z)) {
				console.error(`[CameraOperator] CRITICAL: camera.position is NaN before lookAt. Forcing reset of camera position.`);
				this.camera.position.set(this.target.x, this.target.y + 1.6, this.target.z + 5); // A default safe position relative to target
				if (isNaN(this.camera.position.x)) this.camera.position.set(0, 1.6, 5); // Absolute fallback
				this.camera.updateMatrix(); // Re-update matrix if position was forced
			}
			if (isNaN(this.target.x) || isNaN(this.target.y) || isNaN(this.target.z)) {
				 console.error(`[CameraOperator] CRITICAL: this.target is NaN before lookAt. Forcing reset of target.`);
				 this.target.set(0,0,0); // Absolute fallback for target
			}
			
			// Check if camera position and target are numerically too close (can cause issues with lookAt's normalization)
			if (this.camera.position.distanceToSquared(this.target) < 0.0001) {
				console.warn(`[CameraOperator] Camera position and target are nearly identical before lookAt. Nudging camera position slightly to prevent potential NaN quaternion. CamPos: ${this.camera.position.toArray().join(',')}, Target: ${this.target.toArray().join(',')}`);
				this.camera.position.z += 0.01; // Nudge slightly along Z to ensure lookAt can form a direction vector
				this.camera.updateMatrix(); // Re-update matrix
			}

			// console.log(`[CameraOperator] Pre-lookAt: Cam Pos: (${this.camera.position.x.toFixed(2)},${this.camera.position.y.toFixed(2)},${this.camera.position.z.toFixed(2)}), Target: (${this.target.x.toFixed(2)},${this.target.y.toFixed(2)},${this.target.z.toFixed(2)})`);
			try {
				const logFunc = (window as any).appendToCustomLog || console.log;
				logFunc(
					`[CameraOperator] Pre-lookAt: Cam Pos: (${this.camera.position.x.toFixed(2)},${this.camera.position.y.toFixed(2)},${this.camera.position.z.toFixed(2)}), Target: (${this.target.x.toFixed(2)},${this.target.y.toFixed(2)},${this.target.z.toFixed(2)})`,
					'log', // type
					'CO_PreLookAt', // throttleKey
					10000, // throttleMs (10 seconds)
					undefined, // typeThrottleMs
					'normal' // importance
				);
			} catch (e) {
				// Fallback if appendToCustomLog is not available or errors
				console.log(`[CameraOperator] Pre-lookAt (fallback): Cam Pos: (${this.camera.position.x.toFixed(2)},${this.camera.position.y.toFixed(2)},${this.camera.position.z.toFixed(2)}), Target: (${this.target.x.toFixed(2)},${this.target.y.toFixed(2)},${this.target.z.toFixed(2)})`);
			}
			this.camera.lookAt(this.target); // This updates the camera's quaternion

			// Log quaternion after lookAt
			const q = this.camera.quaternion;
			if (isNaN(q.x) || isNaN(q.y) || isNaN(q.z) || isNaN(q.w)) {
				console.error(`[CameraOperator] CRITICAL: camera.quaternion became NaN after lookAt. Q: (${q.x}, ${q.y}, ${q.z}, ${q.w}). Attempting reset of quaternion.`);
				this.camera.quaternion.set(0,0,0,1); // Reset to identity quaternion
				this.camera.updateMatrixWorld(true); // Force update of matrices
			}
		}
		else 
		{
			this.radius = THREE.MathUtils.lerp(this.radius, this.targetRadius, 0.1);
	
			this.camera.position.x = this.target.x + this.radius * Math.sin(this.theta * Math.PI / 180) * Math.cos(this.phi * Math.PI / 180);
			this.camera.position.y = this.target.y + this.radius * Math.sin(this.phi * Math.PI / 180);
			this.camera.position.z = this.target.z + this.radius * Math.cos(this.theta * Math.PI / 180) * Math.cos(this.phi * Math.PI / 180);
			
			try {
				const logFunc = (window as any).appendToCustomLog || console.log;
				logFunc(
					`[CameraOperator Update - NO FOLLOW] Phi: ${this.phi.toFixed(2)}, Radius: ${this.radius.toFixed(2)}, TargetY: ${this.target.y.toFixed(2)}, CamY directly set: ${this.camera.position.y.toFixed(2)}`,
					'log', 'CO_Phi_NoFollow', 500, undefined, 'normal'
				);
			} catch (e) {
				console.log(`[CameraOperator Update - NO FOLLOW] Phi: ${this.phi.toFixed(2)}, Radius: ${this.radius.toFixed(2)}, TargetY: ${this.target.y.toFixed(2)}, CamY directly set: ${this.camera.position.y.toFixed(2)}`);
			}
			
			this.camera.updateMatrix();
			this.camera.lookAt(this.target);
		}
	}

	public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void
	{
		// Free camera
		if (code === 'KeyC' && pressed === true && event.shiftKey === true)
		{
			if (this.characterCaller !== undefined)
			{
				this.world.inputManager.setInputReceiver(this.characterCaller);
				this.characterCaller = undefined;
			}
		}
		else
		{
			for (const action in this.actions) {
				if (this.actions.hasOwnProperty(action)) {
					const binding = this.actions[action];
	
					if (_.includes(binding.eventCodes, code))
					{
						binding.isPressed = pressed;
					}
				}
			}
		}
	}

	public handleMouseWheel(event: WheelEvent, value: number): void
	{
		this.world.scrollTheTimeScale(value);
	}

	public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
	{
		for (const action in this.actions) {
			if (this.actions.hasOwnProperty(action)) {
				const binding = this.actions[action];

				if (_.includes(binding.eventCodes, code))
				{
					binding.isPressed = pressed;
				}
			}
		}
	}

	public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
	{
		if (isNaN(deltaX) || isNaN(deltaY)) {
			console.warn(`[CameraOperator] handleMouseMove received NaN deltaX or deltaY. dx:${deltaX}, dy:${deltaY}. Skipping move.`);
			return;
		}
		this.move(deltaX, deltaY);
	}

	public inputReceiverInit(): void
	{
		this.target.copy(this.camera.position);
		this.setRadius(0, true);
		// this.world.dirLight.target = this.world.camera;

		this.world.updateControls([
			{
				keys: ['W', 'S', 'A', 'D'],
				desc: 'Move around'
			},
			{
				keys: ['E', 'Q'],
				desc: 'Move up / down'
			},
			{
				keys: ['Shift'],
				desc: 'Speed up'
			},
			{
				keys: ['Shift', '+', 'C'],
				desc: 'Exit free camera mode'
			},
		]);
	}

	public inputReceiverUpdate(timeStep: number): void
	{
		// Set fly speed
		let speed = this.movementSpeed * (this.actions.fast.isPressed ? timeStep * 600 : timeStep * 60);

		const up = Utils.getUp(this.camera);
		const right = Utils.getRight(this.camera);
		const forward = Utils.getBack(this.camera); // Note: getBack is -Z

		this.upVelocity = THREE.MathUtils.lerp(this.upVelocity, +this.actions.up.isPressed - +this.actions.down.isPressed, 0.3);
		this.forwardVelocity = THREE.MathUtils.lerp(this.forwardVelocity, +this.actions.forward.isPressed - +this.actions.back.isPressed, 0.3);
		this.rightVelocity = THREE.MathUtils.lerp(this.rightVelocity, +this.actions.right.isPressed - +this.actions.left.isPressed, 0.3);

		this.target.add(up.multiplyScalar(speed * this.upVelocity));
		this.target.add(forward.multiplyScalar(speed * this.forwardVelocity));
		this.target.add(right.multiplyScalar(speed * this.rightVelocity));
	}
}
