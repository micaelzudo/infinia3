import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as _ from 'lodash';
import * as Utils from '../core/FunctionLibrary';

import { KeyBinding } from '../core/KeyBinding';
import { VectorSpringSimulator } from '../physics/spring_simulation/VectorSpringSimulator';
import { RelativeSpringSimulator } from '../physics/spring_simulation/RelativeSpringSimulator';
import { Idle } from './character_states/Idle';
import { EnteringVehicle } from './character_states/vehicles/EnteringVehicle';
import { ExitingVehicle } from './character_states/vehicles/ExitingVehicle';
import { OpenVehicleDoor as OpenVehicleDoor } from './character_states/vehicles/OpenVehicleDoor';
import { Driving } from './character_states/vehicles/Driving';
import { ExitingAirplane } from './character_states/vehicles/ExitingAirplane';
import { ICharacterAI } from '../interfaces/ICharacterAI';
import { World } from '../world/World';
import { IControllable } from '../interfaces/IControllable';
import { ICharacterState } from '../interfaces/ICharacterState';
import { IWorldEntity } from '../interfaces/IWorldEntity';
import { VehicleSeat } from '../vehicles/VehicleSeat';
import { Vehicle } from '../vehicles/Vehicle';
import { CollisionGroups } from '../enums/CollisionGroups';
import { CapsuleCollider } from '../physics/colliders/CapsuleCollider';
import { VehicleEntryInstance } from './VehicleEntryInstance';
import { SeatType } from '../enums/SeatType';
import { GroundImpactData } from './GroundImpactData';
import { ClosestObjectFinder } from '../core/ClosestObjectFinder';
import { Object3D } from 'three';
import { EntityType } from '../enums/EntityType';

export class Character extends THREE.Object3D implements IWorldEntity
{
	public updateOrder: number = 1;
	public entityType: EntityType = EntityType.Character;

	public height: number = 0;
	public tiltContainer: THREE.Group;
	public modelContainer: THREE.Group;
	public materials: THREE.Material[] = [];
	public mixer: THREE.AnimationMixer | null;
	public animations: any[];

	// Movement
	public acceleration: THREE.Vector3 = new THREE.Vector3();
	public velocity: THREE.Vector3 = new THREE.Vector3();
	public arcadeVelocityInfluence: THREE.Vector3 = new THREE.Vector3();
	public velocityTarget: THREE.Vector3 = new THREE.Vector3();
	public arcadeVelocityIsAdditive: boolean = false;

	public defaultVelocitySimulatorDamping: number = 0.8;
	public defaultVelocitySimulatorMass: number = 50;
	public velocitySimulator: VectorSpringSimulator;
	public moveSpeed: number = 4;
	public angularVelocity: number = 0;
	public orientation: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
	public orientationTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
	public defaultRotationSimulatorDamping: number = 0.5;
	public defaultRotationSimulatorMass: number = 10;
	public rotationSimulator: RelativeSpringSimulator;
	public viewVector: THREE.Vector3;
	public actions: { [action: string]: KeyBinding };
	public characterCapsule: CapsuleCollider;

	// Ray casting
	public rayResult: CANNON.RaycastResult = new CANNON.RaycastResult();
	public rayHasHit: boolean = false;
	public rayCastLength: number = 0.57;
	public raySafeOffset: number = 0.03;
	public wantsToJump: boolean = false;
	public initJumpSpeed: number = -1;
	public groundImpactData: GroundImpactData = new GroundImpactData();
	public raycastBox: THREE.Mesh;

	// Grounded grace period logic
	public timeSinceLastGroundContact: number = 0;
	public readonly GROUNDED_GRACE_PERIOD: number = 0.1; // 100ms, tunable

	public world: World;
	public charState: ICharacterState | null;
	public behaviour: ICharacterAI;

	// Vehicles
	public controlledObject: IControllable;
	public occupyingSeat: VehicleSeat = null;
	public vehicleEntryInstance: VehicleEntryInstance = null;

	private physicsEnabled: boolean = true;

	constructor(gltf: any)
	{
		super();

		this.readCharacterData(gltf);
		this.setAnimations(gltf.animations);

		// The visuals group is centered for easy character tilting
		this.tiltContainer = new THREE.Group();
		this.add(this.tiltContainer);

		// Model container is used to reliably ground the character, as animation can alter the position of the model itself
		this.modelContainer = new THREE.Group();
		this.modelContainer.position.y = -0.57;
		this.tiltContainer.add(this.modelContainer);
		this.modelContainer.add(gltf.scene);

		this.mixer = new THREE.AnimationMixer(gltf.scene);

		this.velocitySimulator = new VectorSpringSimulator(60, this.defaultVelocitySimulatorMass, this.defaultVelocitySimulatorDamping);
		this.rotationSimulator = new RelativeSpringSimulator(60, this.defaultRotationSimulatorMass, this.defaultRotationSimulatorDamping);

		this.viewVector = new THREE.Vector3();

		// Actions
		this.actions = {
			'up': new KeyBinding('KeyW'),
			'down': new KeyBinding('KeyS'),
			'left': new KeyBinding('KeyD'),
			'right': new KeyBinding('KeyA'),
			'run': new KeyBinding('ShiftLeft'),
			'jump': new KeyBinding('Space'),
			'use': new KeyBinding('KeyE'),
			'enter': new KeyBinding('KeyF'),
			'enter_passenger': new KeyBinding('KeyG'),
			'seat_switch': new KeyBinding('KeyX'),
			'primary': new KeyBinding('Mouse0'),
			'secondary': new KeyBinding('Mouse1'),
		};

		// Physics
		// Player Capsule
		this.characterCapsule = new CapsuleCollider({
			mass: 1,
			position: new CANNON.Vec3(),
			height: 0.5,
			radius: 0.25,
			segments: 8,
			friction: 0.0
		});
		// capsulePhysics.physical.collisionFilterMask = ~CollisionGroups.Trimesh;
		this.characterCapsule.body.shapes.forEach((shape) => {
			// tslint:disable-next-line: no-bitwise
			shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
		});
		this.characterCapsule.body.allowSleep = false;

		// Move character to different collision group for raycasting
		this.characterCapsule.body.collisionFilterGroup = 2;

		// Disable character rotation
		this.characterCapsule.body.fixedRotation = true;
		this.characterCapsule.body.updateMassProperties();

		// Ray cast debug
		const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
		const boxMat = new THREE.MeshLambertMaterial({
			color: 0xff0000
		});
		this.raycastBox = new THREE.Mesh(boxGeo, boxMat);
		this.raycastBox.visible = false;

		// Physics pre/post step callback bindings
		(this.characterCapsule.body as any).preStep = (body: CANNON.Body) => { this.physicsPreStep(body, this); };
		(this.characterCapsule.body as any).postStep = (body: CANNON.Body) => { this.physicsPostStep(body, this); };

		// States
		this.charState = null;
		this.setState(new Idle(this));
	}

	public setAnimations(animations: []): void
	{
		this.animations = animations;
	}

	public setArcadeVelocityInfluence(x: number, y: number = x, z: number = x): void
	{
		this.arcadeVelocityInfluence.set(x, y, z);
	}

	public setViewVector(vector: THREE.Vector3): void
	{
		this.viewVector.copy(vector).normalize();
	}

	/**
	 * Set state to the player. Pass state class (function) name.
	 * @param {function} State
	 */
	public setState(state: ICharacterState): void
	{
		const oldStateName = this.charState ? this.charState.constructor.name : "None";
		const newStateName = state ? state.constructor.name : "None";
		
		// Use appendToCustomLog if available, otherwise console.log
		let logger = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        logger = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		logger(`[Character.setState] Changing from ${oldStateName} to: ${newStateName}`, 'log', `CharSetState_${newStateName}`, 0, undefined, 'verbose');

		this.charState = state;
		if (this.charState && typeof this.charState.onInputChange === 'function') { // Check if state is not null and has onInputChange
			this.charState.onInputChange(); // RE-ENABLED
		}
	}

	public setPosition(x: number, y: number, z: number): void
	{
		if (this.physicsEnabled)
		{
			(this.characterCapsule.body as any).previousPosition = new CANNON.Vec3(x, y, z);
			(this.characterCapsule.body as any).position = new CANNON.Vec3(x, y, z);
			(this.characterCapsule.body as any).interpolatedPosition = new CANNON.Vec3(x, y, z);
		}
		else
		{
			this.position.x = x;
			this.position.y = y;
			this.position.z = z;
		}
	}

	public resetVelocity(): void
	{
		this.velocity.x = 0;
		this.velocity.y = 0;
		this.velocity.z = 0;

		this.characterCapsule.body.velocity.x = 0;
		this.characterCapsule.body.velocity.y = 0;
		this.characterCapsule.body.velocity.z = 0;

		this.velocitySimulator.init();
	}

	public setArcadeVelocityTarget(velZ: number, velX: number = 0, velY: number = 0): void
	{
		this.velocityTarget.z = velZ;
		this.velocityTarget.x = velX;
		this.velocityTarget.y = velY;
	}

	public setOrientation(vector: THREE.Vector3, instantly: boolean = false): void
	{
		let lookVector = new THREE.Vector3().copy(vector).setY(0).normalize();
		this.orientationTarget.copy(lookVector);

		if (instantly)
		{
			this.orientation.copy(lookVector);
		}
	}

	public resetOrientation(): void
	{
		const forward = Utils.getForward(this);
		this.setOrientation(forward, true);
	}

	public setBehaviour(behaviour: ICharacterAI): void
	{
		behaviour.character = this;
		this.behaviour = behaviour;
	}

	public setPhysicsEnabled(value: boolean): void {
		this.physicsEnabled = value;

		if (value === true)
		{
			this.world.physicsWorld.addBody(this.characterCapsule.body as any);
		}
		else
		{
			this.world.physicsWorld.remove(this.characterCapsule.body as any);
		}
	}

	public readCharacterData(gltf: any): void
	{
		gltf.scene.traverse((child) => {

			if (child.isMesh)
			{
				Utils.setupMeshProperties(child);

				if (child.material !== undefined)
				{
					this.materials.push(child.material);
				}
			}
		});
	}

	public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleKeyboardEvent(event, code, pressed);
		}
		else
		{
			// Free camera
			if (code === 'KeyC' && pressed === true && event.shiftKey === true)
			{
				this.resetControls();
				this.world.cameraOperator.characterCaller = this;
				this.world.inputManager.setInputReceiver(this.world.cameraOperator);
			}
			else if (code === 'KeyR' && pressed === true && event.shiftKey === true)
			{
				this.world.restartScenario();
			}
			else
			{
				for (const action in this.actions) {
					if (this.actions.hasOwnProperty(action)) {
						const binding = this.actions[action];

						if (_.includes(binding.eventCodes, code))
						{
							this.triggerAction(action, pressed);
						}
					}
				}
			}
		}
	}

	public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseButton(event, code, pressed);
		}
		else
		{
			for (const action in this.actions) {
				if (this.actions.hasOwnProperty(action)) {
					const binding = this.actions[action];

					if (_.includes(binding.eventCodes, code))
					{
						this.triggerAction(action, pressed);
					}
				}
			}
		}
	}

	public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseMove(event, deltaX, deltaY);
		}
		else
		{
			this.world.cameraOperator.move(deltaX, deltaY);
		}
	}

	public handleMouseWheel(event: WheelEvent, value: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.handleMouseWheel(event, value);
		}
		else
		{
			this.world.scrollTheTimeScale(value);
		}
	}

	public triggerAction(actionName: string, value: boolean): void
	{
		// Get action and set it's parameters
		let action = this.actions[actionName];

		if (action.isPressed !== value)
		{
			// Set value
			action.isPressed = value;

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;

			// Set the 'just' attributes
			if (value) action.justPressed = true;
			else action.justReleased = true;

			// Tell player to handle states according to new input
			this.charState?.onInputChange();

			// Reset the 'just' attributes
			action.justPressed = false;
			action.justReleased = false;
		}
	}

	public takeControl(): void
	{
		if (this.world !== undefined)
		{
			this.world.inputManager.setInputReceiver(this);
		}
		else
		{
			console.warn('Attempting to take control of a character that doesn\'t belong to a world.');
		}
	}

	public resetControls(): void
	{
		for (const action in this.actions) {
			if (this.actions.hasOwnProperty(action)) {
				this.triggerAction(action, false);
			}
		}
	}

	public update(timeStep: number, unscaledTimeStep?: number): void
	{
		const charId = this.entityType === EntityType.Character ? (this as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		const unscaledDt = unscaledTimeStep !== undefined ? unscaledTimeStep : timeStep;
		appendToCustomLogBase(`[Character.update ID: ${charId}] Called. timeStep: ${timeStep.toFixed(4)}, unscaledDt: ${unscaledDt.toFixed(4)}. Pos Before: (${this.position.x.toFixed(2)},${this.position.y.toFixed(2)},${this.position.z.toFixed(2)})`, 'log', `Char_update_${charId}`, 1000, undefined, 'normal');

		this.behaviour?.update(timeStep);
		this.vehicleEntryInstance?.update(timeStep);
		// console.log(this.occupyingSeat);
		this.charState?.update(timeStep, unscaledDt);

		// this.visuals.position.copy(this.modelOffset);
		if (this.physicsEnabled) {
			const oldVel = this.velocity.clone();
			this.springMovement(timeStep);
			appendToCustomLogBase(`[Character.update ID: ${charId}] After springMovement. Vel: (${this.velocity.x.toFixed(2)},${this.velocity.y.toFixed(2)},${this.velocity.z.toFixed(2)}), Accel: (${this.acceleration.x.toFixed(2)},${this.acceleration.y.toFixed(2)},${this.acceleration.z.toFixed(2)}). OldVel: (${oldVel.x.toFixed(2)},${oldVel.y.toFixed(2)},${oldVel.z.toFixed(2)})`, 'log', `Char_springMove_${charId}`, 1000, undefined, 'normal');
		}
		if (this.physicsEnabled) {
			const oldOrient = this.orientation.clone();
			this.springRotation(timeStep);
			appendToCustomLogBase(`[Character.update ID: ${charId}] After springRotation. Orient: (${this.orientation.x.toFixed(2)},${this.orientation.z.toFixed(2)}), AngVel: ${this.angularVelocity.toFixed(3)}. OldOrient: (${oldOrient.x.toFixed(2)},${oldOrient.z.toFixed(2)})`, 'log', `Char_springRot_${charId}`, 1000, undefined, 'normal');
		}
		if (this.physicsEnabled) this.rotateModel();

		// Use unscaledTimeStep for mixer if available, otherwise timeStep
		if (this.mixer) {
			this.mixer.update(unscaledDt);
			appendToCustomLogBase(`[Character.update ID: ${charId}] Mixer updated with dt: ${unscaledDt.toFixed(4)}. Mixer time: ${this.mixer.time.toFixed(3)}`, 'log', `Char_mixerUpdate_${charId}`, 1000, undefined, 'normal');
		}

		// Sync physics/graphics
		if (this.physicsEnabled)
		{
			this.position.set(
				(this.characterCapsule.body as any).interpolatedPosition.x,
				(this.characterCapsule.body as any).interpolatedPosition.y,
				(this.characterCapsule.body as any).interpolatedPosition.z
			);
		}
		else {
			let newPos = new THREE.Vector3();
			this.getWorldPosition(newPos);

			// Cast result of Utils.cannonVector to any to satisfy copy method's type expectation
			(this.characterCapsule.body as any).position.copy(Utils.cannonVector(newPos) as any);
			(this.characterCapsule.body as any).interpolatedPosition.copy(Utils.cannonVector(newPos) as any);
		}

		this.updateMatrixWorld();
	}

	public inputReceiverInit(): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.inputReceiverInit();
			return;
		}

		this.world.cameraOperator.setRadius(1.6, true);
		this.world.cameraOperator.followMode = false;
		// this.world.dirLight.target = this;

		this.displayControls();
	}

	public displayControls(): void
	{
		this.world.updateControls([
			{
				keys: ['W', 'A', 'S', 'D'],
				desc: 'Movement'
			},
			{
				keys: ['Shift'],
				desc: 'Sprint'
			},
			{
				keys: ['Space'],
				desc: 'Jump'
			},
			{
				keys: ['F', 'or', 'G'],
				desc: 'Enter vehicle'
			},
			{
				keys: ['Shift', '+', 'R'],
				desc: 'Respawn'
			},
			{
				keys: ['Shift', '+', 'C'],
				desc: 'Free camera'
			},
		]);
	}

	public inputReceiverUpdate(timeStep: number): void
	{
		if (this.controlledObject !== undefined)
		{
			this.controlledObject.inputReceiverUpdate(timeStep);
		}
		else
		{
			// Look in camera's direction
			this.viewVector = new THREE.Vector3().subVectors(this.position, this.world.camera.position);
			this.getWorldPosition(this.world.cameraOperator.target);
		}

	}

	public setAnimation(clipName: string, fadeIn: number): number
	{
		if (this.mixer !== undefined)
		{
			console.log(`[Character Animation] Setting animation: ${clipName}`);
			// gltf
			let clip = THREE.AnimationClip.findByName( this.animations, clipName );

			// If the requested animation is not found, log available animations to help debugging
			if (!clip) {
				console.error(`Animation '${clipName}' not found! Available animations:`);
				if (this.animations && this.animations.length > 0) {
					this.animations.forEach(availableClip => {
						console.log(`  - Animation Name: '${availableClip.name}'`);
					});
				} else {
					console.error('No animations available in this character model.');
				}

				// Try to find a fallback animation
				const fallbacks = ['idle', 'walk', 'run_forward'];
				for (const fallback of fallbacks) {
					if (fallback !== clipName) {
						const fallbackClip = THREE.AnimationClip.findByName(this.animations, fallback);
						if (fallbackClip) {
							console.log(`Using '${fallback}' as fallback animation for '${clipName}'`);
							clip = fallbackClip;
							break;
						}
					}
				}

				// If still no clip found, return 0
				if (!clip) {
					return 0;
				}
			}

			let action = this.mixer.clipAction(clip);
			if (action === null)
			{
				console.error(`Failed to create action for animation ${clipName}!`);
				return 0;
			}

			this.mixer.stopAllAction();
			action.fadeIn(fadeIn);
			action.play();

			return action.getClip().duration;
		}
		return 0;
	}

	public springMovement(timeStep: number): void
	{
		// Simulator
		const charId = this.entityType === EntityType.Character ? (this as any).debugId : 'N/A';
		const oldSimPos = this.velocitySimulator.position.clone();
		const oldSimVel = this.velocitySimulator.velocity.clone();

		this.velocitySimulator.target.copy(this.velocityTarget);
		this.velocitySimulator.simulate(timeStep);

		// Update values
		this.velocity.copy(this.velocitySimulator.position);
		this.acceleration.copy(this.velocitySimulator.velocity);

		// Log if significant change
		if (oldSimPos.distanceToSquared(this.velocitySimulator.position) > 0.001 || oldSimVel.distanceToSquared(this.velocitySimulator.velocity) > 0.001) {
			let appendToCustomLogBase: any = console.log;
			try {
			    if (typeof (window as any).appendToCustomLog === 'function') {
			        appendToCustomLogBase = (window as any).appendToCustomLog;
			    }
			} catch (e) { /* ignore */ }
			appendToCustomLogBase(`[Character.springMovement ID: ${charId}] Target: (${this.velocityTarget.x.toFixed(2)},${this.velocityTarget.y.toFixed(2)},${this.velocityTarget.z.toFixed(2)}), New Simulator Pos: (${this.velocitySimulator.position.x.toFixed(2)},${this.velocitySimulator.position.y.toFixed(2)},${this.velocitySimulator.position.z.toFixed(2)}), New Sim Vel: (${this.velocitySimulator.velocity.x.toFixed(2)},${this.velocitySimulator.velocity.y.toFixed(2)},${this.velocitySimulator.velocity.z.toFixed(2)})`, 'log', `Char_simMove_${charId}`, 1000, undefined, 'normal');
		}
	}

	public springRotation(timeStep: number): void
	{
		// Spring rotation
		// Figure out angle between current and target orientation
		let angle = Utils.getSignedAngleBetweenVectors(this.orientation, this.orientationTarget);

		// Simulator
		const charId = this.entityType === EntityType.Character ? (this as any).debugId : 'N/A';
		const oldSimRotPos = this.rotationSimulator.position;
		const oldSimRotVel = this.rotationSimulator.velocity;

		this.rotationSimulator.target = angle;
		this.rotationSimulator.simulate(timeStep);
		let rot = this.rotationSimulator.position;

		// Updating values
		if (Math.abs(rot) > 0.001) {
			// console.log(`[Character Rotation] Angle: ${angle.toFixed(3)}, RotationStep: ${rot.toFixed(3)}, Target: (${this.orientationTarget.x.toFixed(2)}, ${this.orientationTarget.z.toFixed(2)})`);
		}
		this.orientation.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
		this.angularVelocity = this.rotationSimulator.velocity;

		if (Math.abs(oldSimRotPos - this.rotationSimulator.position) > 0.001 || Math.abs(oldSimRotVel - this.rotationSimulator.velocity) > 0.001){
			let appendToCustomLogBase: any = console.log;
			try {
			    if (typeof (window as any).appendToCustomLog === 'function') {
			        appendToCustomLogBase = (window as any).appendToCustomLog;
			    }
			} catch (e) { /* ignore */ }
			appendToCustomLogBase(`[Character.springRotation ID: ${charId}] Angle: ${angle.toFixed(3)}, TargetOrient: (${this.orientationTarget.x.toFixed(2)},${this.orientationTarget.z.toFixed(2)}), SimRot: ${rot.toFixed(3)}, NewOrient: (${this.orientation.x.toFixed(2)},${this.orientation.z.toFixed(2)}), NewAngVel: ${this.angularVelocity.toFixed(3)}`, 'log', `Char_simRot_${charId}`, 1000, undefined, 'normal');
		}
		// if (Math.abs(rot) > 0.001) {
		// 	console.log(`[Character Rotation] New Orientation: (${this.orientation.x.toFixed(2)}, ${this.orientation.z.toFixed(2)})`);
		// }
	}

	public getLocalMovementDirection(): THREE.Vector3
	{
		// Standard mapping: A is negative X, D is positive X
		const positiveX = this.actions.right.isPressed ? 1 : 0; // D key makes X positive
		const negativeX = this.actions.left.isPressed ? -1 : 0; // A key makes X negative
		const positiveZ = this.actions.up.isPressed ? 1 : 0;    // W key makes Z positive (forward)
		const negativeZ = this.actions.down.isPressed ? -1 : 0; // S key makes Z negative (backward)

		const localMoveDir = new THREE.Vector3(positiveX + negativeX, 0, positiveZ + negativeZ).normalize();

		const charId = this.entityType === EntityType.Character ? (this as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		appendToCustomLogBase(`[Character.getLocalMovementDirection ID: ${charId}] Actions: up=${this.actions.up.isPressed}, down=${this.actions.down.isPressed}, left=${this.actions.left.isPressed}, right=${this.actions.right.isPressed}. ResultDir: (${localMoveDir.x.toFixed(2)},${localMoveDir.z.toFixed(2)})`, 'log', `Char_getLocalMoveDir_${charId}`, 2000, undefined, 'normal');

		return localMoveDir;
	}

	public getCameraRelativeMovementVector(): THREE.Vector3
	{
		const localDirection = this.getLocalMovementDirection();
		const flatViewVector = new THREE.Vector3(this.viewVector.x, 0, this.viewVector.z).normalize();

		return Utils.appplyVectorMatrixXZ(flatViewVector, localDirection);
	}

	public setCameraRelativeOrientationTarget(): void
	{
		if (this.vehicleEntryInstance === null)
		{
			let moveVector = this.getCameraRelativeMovementVector();
			// console.log(`[Character Orientation] Target moveVector: (${moveVector.x.toFixed(2)}, ${moveVector.z.toFixed(2)})`);

			const charId = this.entityType === EntityType.Character ? (this as any).debugId : 'N/A';
			let appendToCustomLogBase: any = console.log;
			try {
			    if (typeof (window as any).appendToCustomLog === 'function') {
			        appendToCustomLogBase = (window as any).appendToCustomLog;
			    }
			} catch (e) { /* ignore */ }

			if (moveVector.x === 0 && moveVector.y === 0 && moveVector.z === 0)
			{
				appendToCustomLogBase(`[Character.setCameraRelativeOrientationTarget ID: ${charId}] Move vector is zero. Setting orientation to current: (${this.orientation.x.toFixed(2)},${this.orientation.z.toFixed(2)})`, 'log', `Char_setCamRelOrient_ZeroMove_${charId}`, 1000, undefined, 'normal');
				this.setOrientation(this.orientation);
			}
			else
			{
				appendToCustomLogBase(`[Character.setCameraRelativeOrientationTarget ID: ${charId}] Move vector: (${moveVector.x.toFixed(2)},${moveVector.z.toFixed(2)}). Setting orientation to move vector.`, 'log', `Char_setCamRelOrient_Move_${charId}`, 1000, undefined, 'normal');
				this.setOrientation(moveVector);
			}
		}
	}

	public rotateModel(): void
	{
		this.lookAt(this.position.x + this.orientation.x, this.position.y + this.orientation.y, this.position.z + this.orientation.z);
		this.tiltContainer.rotation.z = (-this.angularVelocity * 2.3 * this.velocity.length());
		this.tiltContainer.position.setY((Math.cos(Math.abs(this.angularVelocity * 2.3 * this.velocity.length())) / 2) - 0.5);
	}

	public jump(initJumpSpeed: number = -1): void
	{
		this.wantsToJump = true;
		this.initJumpSpeed = initJumpSpeed;
	}

	public findVehicleToEnter(wantsToDrive: boolean): void
	{
		// reusable world position variable
		let worldPos = new THREE.Vector3();

		// Find best vehicle
		let vehicleFinder = new ClosestObjectFinder<Vehicle>(this.position, 10);
		this.world.vehicles.forEach((vehicle) =>
		{
			vehicleFinder.consider(vehicle, vehicle.position);
		});

		if (vehicleFinder.closestObject !== undefined)
		{
			let vehicle = vehicleFinder.closestObject;
			let vehicleEntryInstance = new VehicleEntryInstance(this);
			vehicleEntryInstance.wantsToDrive = wantsToDrive;

			// Find best seat
			let seatFinder = new ClosestObjectFinder<VehicleSeat>(this.position);
			for (const seat of vehicle.seats)
			{
				if (wantsToDrive)
				{
					// Consider driver seats
					if (seat.type === SeatType.Driver)
					{
						seat.seatPointObject.getWorldPosition(worldPos);
						seatFinder.consider(seat, worldPos);
					}
					// Consider passenger seats connected to driver seats
					else if (seat.type === SeatType.Passenger)
					{
						for (const connSeat of seat.connectedSeats)
						{
							if (connSeat.type === SeatType.Driver)
							{
								seat.seatPointObject.getWorldPosition(worldPos);
								seatFinder.consider(seat, worldPos);
								break;
							}
						}
					}
				}
				else
				{
					// Consider passenger seats
					if (seat.type === SeatType.Passenger)
					{
						seat.seatPointObject.getWorldPosition(worldPos);
						seatFinder.consider(seat, worldPos);
					}
				}
			}

			if (seatFinder.closestObject !== undefined)
			{
				let targetSeat = seatFinder.closestObject;
				vehicleEntryInstance.targetSeat = targetSeat;

				let entryPointFinder = new ClosestObjectFinder<Object3D>(this.position);

				for (const point of targetSeat.entryPoints) {
					point.getWorldPosition(worldPos);
					entryPointFinder.consider(point, worldPos);
				}

				if (entryPointFinder.closestObject !== undefined)
				{
					vehicleEntryInstance.entryPoint = entryPointFinder.closestObject;
					this.triggerAction('up', true);
					this.vehicleEntryInstance = vehicleEntryInstance;
				}
			}
		}
	}

	public enterVehicle(seat: VehicleSeat, entryPoint: THREE.Object3D): void
	{
		this.resetControls();

		if (seat.door?.rotation < 0.5)
		{
			this.setState(new OpenVehicleDoor(this, seat, entryPoint));
		}
		else
		{
			this.setState(new EnteringVehicle(this, seat, entryPoint));
		}
	}

	public teleportToVehicle(vehicle: Vehicle, seat: VehicleSeat): void
	{
		this.resetVelocity();
		this.rotateModel();
		this.setPhysicsEnabled(false);
		(vehicle as unknown as THREE.Object3D).attach(this);

		this.setPosition(seat.seatPointObject.position.x, seat.seatPointObject.position.y + 0.6, seat.seatPointObject.position.z);
		this.quaternion.copy(seat.seatPointObject.quaternion);

		this.occupySeat(seat);
		this.setState(new Driving(this, seat));

		this.startControllingVehicle(vehicle, seat);
	}

	public startControllingVehicle(vehicle: IControllable, seat: VehicleSeat): void
	{
		if (this.controlledObject !== vehicle)
		{
			this.transferControls(vehicle);
			this.resetControls();

			this.controlledObject = vehicle;
			this.controlledObject.allowSleep(false);
			vehicle.inputReceiverInit();

			vehicle.controllingCharacter = this;
		}
	}

	public transferControls(entity: IControllable): void
	{
		// Currently running through all actions of this character and the vehicle,
		// comparing keycodes of actions and based on that triggering vehicle's actions
		// Maybe we should ask input manager what's the current state of the keyboard
		// and read those values... TODO
		for (const action1 in this.actions) {
			if (this.actions.hasOwnProperty(action1)) {
				for (const action2 in entity.actions) {
					if (entity.actions.hasOwnProperty(action2)) {

						let a1 = this.actions[action1];
						let a2 = entity.actions[action2];

						a1.eventCodes.forEach((code1) => {
							a2.eventCodes.forEach((code2) => {
								if (code1 === code2)
								{
									entity.triggerAction(action2, a1.isPressed);
								}
							});
						});
					}
				}
			}
		}
	}

	public stopControllingVehicle(): void
	{
		if (this.controlledObject?.controllingCharacter === this)
		{
			this.controlledObject.allowSleep(true);
			this.controlledObject.controllingCharacter = undefined;
			this.controlledObject.resetControls();
			this.controlledObject = undefined;
			this.inputReceiverInit();
		}
	}

	public exitVehicle(): void
	{
		if (this.occupyingSeat !== null)
		{
			if (this.occupyingSeat.vehicle.entityType === EntityType.Airplane)
			{
				this.setState(new ExitingAirplane(this, this.occupyingSeat));
			}
			else
			{
				this.setState(new ExitingVehicle(this, this.occupyingSeat));
			}

			this.stopControllingVehicle();
		}
	}

	public occupySeat(seat: VehicleSeat): void
	{
		this.occupyingSeat = seat;
		seat.occupiedBy = this;
	}

	public leaveSeat(): void
	{
		if (this.occupyingSeat !== null)
		{
			this.occupyingSeat.occupiedBy = null;
			this.occupyingSeat = null;
		}
	}

	public physicsPreStep(body: CANNON.Body, character: Character): void
	{
		character.feetRaycast();

		const charId = character.entityType === EntityType.Character ? (character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }
		appendToCustomLogBase(`[Character.physicsPreStep ID: ${charId}] After feetRaycast. rayHasHit: ${character.rayHasHit}, Distance: ${character.rayResult.distance.toFixed(2)}, HitNormal: (${character.rayResult.hitNormalWorld.x.toFixed(2)},${character.rayResult.hitNormalWorld.y.toFixed(2)},${character.rayResult.hitNormalWorld.z.toFixed(2)})`, 'log', `Char_physPreStep_${charId}`, 1000, undefined, 'critical');

		// Raycast debug
		if (character.rayHasHit)
		{
			if (character.raycastBox.visible) {
				character.raycastBox.position.x = character.rayResult.hitPointWorld.x;
				character.raycastBox.position.y = character.rayResult.hitPointWorld.y;
				character.raycastBox.position.z = character.rayResult.hitPointWorld.z;
			}
		}
		else
		{
			if (character.raycastBox.visible) {
				character.raycastBox.position.set(body.position.x, body.position.y - character.rayCastLength - character.raySafeOffset, body.position.z);
			}
		}
	}

	public feetRaycast(): void
	{
		// Player ray casting
		// Create ray
		let body = this.characterCapsule.body;
		const start = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
		const end = new CANNON.Vec3(body.position.x, body.position.y - this.rayCastLength - this.raySafeOffset, body.position.z);
		// Raycast options
		const rayCastOptions = {
			collisionFilterMask: CollisionGroups.Default,
			skipBackfaces: true      /* ignore back faces */
		};
		// Cast the ray
		this.rayHasHit = this.world.physicsWorld.raycastClosest(start as any, end as any, rayCastOptions, this.rayResult as any);
	}

	public physicsPostStep(body: CANNON.Body, character: Character): void
	{
		// Get velocities
		let simulatedVelocity = new THREE.Vector3((body as any).velocity.x, (body as any).velocity.y, (body as any).velocity.z);

		// Take local velocity
		let arcadeVelocity = new THREE.Vector3().copy(character.velocity).multiplyScalar(character.moveSpeed);
		// Turn local into global
		arcadeVelocity = Utils.appplyVectorMatrixXZ(character.orientation, arcadeVelocity);

		let newVelocity = new THREE.Vector3();

		const charId = character.entityType === EntityType.Character ? (character as any).debugId : 'N/A';
		let appendToCustomLogBase: any = console.log;
		try {
		    if (typeof (window as any).appendToCustomLog === 'function') {
		        appendToCustomLogBase = (window as any).appendToCustomLog;
		    }
		} catch (e) { /* ignore */ }

		appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] ENTRY. SimVel: (${simulatedVelocity.x.toFixed(2)},${simulatedVelocity.y.toFixed(2)},${simulatedVelocity.z.toFixed(2)}), ArcadeVel (global): (${arcadeVelocity.x.toFixed(2)},${arcadeVelocity.y.toFixed(2)},${arcadeVelocity.z.toFixed(2)}), char.velocity (local): (${character.velocity.x.toFixed(2)},${character.velocity.y.toFixed(2)},${character.velocity.z.toFixed(2)})`, 'log', `Char_physPostStep_Entry_${charId}`, 1000, undefined, 'critical');

		// Additive velocity mode
		if (character.arcadeVelocityIsAdditive)
		{
			newVelocity.copy(simulatedVelocity);

			let globalVelocityTarget = Utils.appplyVectorMatrixXZ(character.orientation, character.velocityTarget);
			let add = new THREE.Vector3().copy(arcadeVelocity).multiply(character.arcadeVelocityInfluence);

			if (Math.abs(simulatedVelocity.x) < Math.abs(globalVelocityTarget.x * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.x, arcadeVelocity.x)) { newVelocity.x += add.x; }
			if (Math.abs(simulatedVelocity.y) < Math.abs(globalVelocityTarget.y * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.y, arcadeVelocity.y)) { newVelocity.y += add.y; }
			if (Math.abs(simulatedVelocity.z) < Math.abs(globalVelocityTarget.z * character.moveSpeed) || Utils.haveDifferentSigns(simulatedVelocity.z, arcadeVelocity.z)) { newVelocity.z += add.z; }
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] Additive velocity mode. NewVel: (${newVelocity.x.toFixed(2)},${newVelocity.y.toFixed(2)},${newVelocity.z.toFixed(2)})`, 'log', `Char_physPostStep_AddVel_${charId}`, 1000, undefined, 'normal');
		}
		else
		{
			newVelocity = new THREE.Vector3(
				THREE.MathUtils.lerp(simulatedVelocity.x, arcadeVelocity.x, character.arcadeVelocityInfluence.x),
				THREE.MathUtils.lerp(simulatedVelocity.y, arcadeVelocity.y, character.arcadeVelocityInfluence.y),
				THREE.MathUtils.lerp(simulatedVelocity.z, arcadeVelocity.z, character.arcadeVelocityInfluence.z),
			);
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] Lerp velocity mode. NewVel: (${newVelocity.x.toFixed(2)},${newVelocity.y.toFixed(2)},${newVelocity.z.toFixed(2)})`, 'log', `Char_physPostStep_LerpVel_${charId}`, 1000, undefined, 'normal');
		}

		// If we're hitting the ground, stick to ground
		if (character.rayHasHit)
		{
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] Grounded (rayHasHit=true). Pre-ground-logic NewVelY: ${newVelocity.y.toFixed(2)}. HitPointY: ${character.rayResult.hitPointWorld.y.toFixed(2)}`, 'log', `Char_physPostStep_Grounded_${charId}`, 1000, undefined, 'critical');
			
			// --- NEW LOG FOR MOVEMENT STOP ---
			if (Math.abs(newVelocity.y) > 0.001) { // Log only if Y velocity was significant before zeroing
				appendToCustomLogBase(
					`[Character.physicsPostStep ID: ${charId}] Zeroing Y-velocity because character is grounded (rayHasHit = true). ` +
					`Original Y Vel: ${newVelocity.y.toFixed(3)}. This may stop/alter vertical movement.`,
					'info', // Type
					`Char_GroundStopVelYZero_${charId}`, // throttleKey
					1000, // throttleMs
					undefined, // typeThrottleMs
					'critical' // importance
				);
			}
			// --- END NEW LOG ---

			// Flatten velocity
			newVelocity.y = 0;

			// Move on top of moving objects
			if (character.rayResult.body.mass > 0)
			{
				let pointVelocity = new CANNON.Vec3();
				character.rayResult.body.getVelocityAtWorldPoint(character.rayResult.hitPointWorld, pointVelocity);
				newVelocity.add(Utils.threeVector(pointVelocity));
			}

			// Measure the normal vector offset from direct "up" vector
			// and transform it into a matrix
			let up = new THREE.Vector3(0, 1, 0);
			let normal = new THREE.Vector3(character.rayResult.hitNormalWorld.x, character.rayResult.hitNormalWorld.y, character.rayResult.hitNormalWorld.z);
			let q = new THREE.Quaternion().setFromUnitVectors(up, normal);
			let m = new THREE.Matrix4().makeRotationFromQuaternion(q);

			// Rotate the velocity vector
			// newVelocity.applyMatrix4(m); // COMMENTED OUT to prevent sliding on slopes when idle
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] Slope velocity adjustment (newVelocity.applyMatrix4(m)) was COMMENTED OUT. Initial NewVel after potential arcade/simulated: (${newVelocity.x.toFixed(2)},${newVelocity.y.toFixed(2)},${newVelocity.z.toFixed(2)})`, 'warn', `Char_physPostStep_SlopeAdjustDisabled_${charId}`, 5000, undefined, 'critical');

			// Compensate for gravity
			// newVelocity.y -= body.world.physicsWorld.gravity.y / body.character.world.physicsFrameRate;

			// Apply velocity
			(body as any).velocity.x = newVelocity.x;
			(body as any).velocity.y = newVelocity.y;
			(body as any).velocity.z = newVelocity.z;
			// Ground character
			(body as any).position.y = character.rayResult.hitPointWorld.y + character.rayCastLength + (newVelocity.y / character.world.physicsFrameRate);
		}
		else
		{
			// If we're in air
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] In Air (rayHasHit=false). Applying NewVel: (${newVelocity.x.toFixed(2)},${newVelocity.y.toFixed(2)},${newVelocity.z.toFixed(2)}) to body.velocity.`, 'log', `Char_physPostStep_InAir_${charId}`, 1000, undefined, 'critical');
			(body as any).velocity.x = newVelocity.x;
			(body as any).velocity.y = newVelocity.y;
			(body as any).velocity.z = newVelocity.z;

			// Save last in-air information
			character.groundImpactData.velocity.x = (body as any).velocity.x;
			character.groundImpactData.velocity.y = (body as any).velocity.y;
			character.groundImpactData.velocity.z = (body as any).velocity.z;
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] In Air. Saved groundImpactData velocity: (${character.groundImpactData.velocity.x.toFixed(2)},${character.groundImpactData.velocity.y.toFixed(2)},${character.groundImpactData.velocity.z.toFixed(2)})`, 'log', `Char_physPostStep_ImpactData_${charId}`, 1000, undefined, 'normal');
		}

		// Jumping
		if (character.wantsToJump)
		{
			appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] WantsToJump = true. InitJumpSpeed: ${character.initJumpSpeed.toFixed(2)}. Current body.vel.y: ${body.velocity.y.toFixed(2)}`, 'log', `Char_physPostStep_WantsJump_${charId}`, 0, undefined, 'critical');
			// If initJumpSpeed is set
			if (character.initJumpSpeed > -1)
			{
				// Flatten velocity
				(body as any).velocity.y = 0;
				let speed = Math.max(character.velocitySimulator.position.length() * 4, character.initJumpSpeed);
				const jumpDirection = character.orientation.clone().multiplyScalar(speed);
				((body as any).velocity as any).set(jumpDirection.x, jumpDirection.y, jumpDirection.z); // Cast velocity to any before .set()
				appendToCustomLogBase(`[Character.physicsPostStep ID: ${charId}] Jump with initJumpSpeed. BodyVel set to: (${body.velocity.x.toFixed(2)},${body.velocity.y.toFixed(2)},${body.velocity.z.toFixed(2)}) from jumpDir: (${jumpDirection.x.toFixed(2)},${jumpDirection.y.toFixed(2)},${jumpDirection.z.toFixed(2)})`, 'log', `Char_physPostStep_JumpInitSpeed_${charId}`, 0, undefined, 'critical');
			}
			else {
				// Moving objects compensation
				let add = new CANNON.Vec3();
				character.rayResult.body.getVelocityAtWorldPoint(character.rayResult.hitPointWorld, add);
				// Cast the second argument to vsub to any to handle Vec3 type mismatch
				(body as any).velocity.vsub(add, (body as any).velocity as any);
			}

			// Add positive vertical velocity
			(body as any).velocity.y += 4;
			// Move above ground by 2x safe offset value
			(body as any).position.y += character.raySafeOffset * 2;
			// Reset flag
			character.wantsToJump = false;
		}
	}

	public addToWorld(world: World): void
	{
		if (_.includes(world.characters, this))
		{
			console.warn('Adding character to a world in which it already exists.');
		}
		else
		{
			// Set world
			this.world = world;

			// Register character
			world.characters.push(this);

			// Register physics
			world.physicsWorld.addBody(this.characterCapsule.body as any);

			// Add to graphicsWorld
			world.graphicsWorld.add(this);
			world.graphicsWorld.add(this.raycastBox);

			// Shadow cascades
			this.materials.forEach((mat) =>
			{
				world.sky.csm.setupMaterial(mat);
			});
		}
	}

	public removeFromWorld(world: World): void
	{
		if (!_.includes(world.characters, this))
		{
			console.warn('Removing character from a world in which it isn\'t present.');
		}
		else
		{
			if (world.inputManager.inputReceiver === this)
			{
				world.inputManager.inputReceiver = undefined;
			}

			this.world = undefined;

			// Remove from characters
			_.pull(world.characters, this);

			// Remove physics
			world.physicsWorld.remove(this.characterCapsule.body as any);

			// Remove visuals
			world.graphicsWorld.remove(this);
			world.graphicsWorld.remove(this.raycastBox);
		}
	}
}