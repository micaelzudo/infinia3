import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Character as OriginalCharacterForOverride } from '../../../Sketchbook-master/src/ts/characters/Character';
import { CollisionGroups } from '../../../Sketchbook-master/src/ts/enums/CollisionGroups';
import { appendToCustomLog } from '../../ui/customLogger'; // Adjusted path
// import { InventorySystem } from '../../wilderness/inventorySystem'; // Assuming path, uncomment if used
// import { HungerThirstSystem } from '../../wilderness/hungerThirstSystem'; // Assuming path, uncomment if used

// Note: The following imports were present in the context of isolatedThirdPerson.ts
// and might be needed here if the character directly uses them.
// For now, they are commented out to keep this module focused.
// import { Idle } from '../../../Sketchbook-master/src/ts/characters/character_states/Idle';
// import { Falling } from '../../../Sketchbook-master/src/ts/characters/character_states/Falling';
// import { Jump } from '../../../Sketchbook-master/src/ts/characters/character_states/Jump';
// import { Walk } from '../../../Sketchbook-master/src/ts/characters/character_states/Walk';
// import { DropIdle } from '../../../Sketchbook-master/src/ts/characters/character_states/DropIdle';
// import { StartWalkForward } from '../../../Sketchbook-master/src/ts/characters/character_states/StartWalkForward';
// import { EndWalk } from '../../../Sketchbook-master/src/ts/characters/character_states/EndWalk';
// import { StartWalkRight } from '../../../Sketchbook-master/src/ts/characters/character_states/StartWalkRight';
// import { StartWalkLeft } from '../../../Sketchbook-master/src/ts/characters/character_states/StartWalkLeft';
// import { Sprint } from '../../../Sketchbook-master/src/ts/characters/character_states/Sprint';

export class AdaptedSketchbookCharacter_Engine extends OriginalCharacterForOverride {
    public debugId: number;
    public slopeLimit: number;
    public readonly GROUNDED_GRACE_PERIOD: number;
    private _currentAnimation: string | null = null;

    public threeGroundRaycaster: THREE.Raycaster;
    public threeRayHit: boolean = false;
    public threeRayHitPoint: THREE.Vector3 = new THREE.Vector3();
    public threeRayHitNormal: THREE.Vector3 = new THREE.Vector3();
    public threeRayHitDistance: number = 0;

    public walkSpeed: number = 2.5;
    public runSpeed: number = 5.0;
    public staminaRegenRate: number = 1.0;
    private _baseWalkSpeed: number = 2.5;
    private _baseRunSpeed: number = 5.0;
    private _baseStaminaRegenRate: number = 1.0;

    // public inventorySystem: InventorySystem | null = null; // Uncomment if InventorySystem is used
    // public hungerThirstSystem: HungerThirstSystem | null = null; // Uncomment if HungerThirstSystem is used
    private _lastHungerUpdate: number = 0;
    private _hungerUpdateInterval: number = 1.0;
    private _isRunning: boolean = false;

    private _miningSystem: any = null;
    private _miningLevel: number = 1;
    private _miningExperience: number = 0;
    private _experienceToNextLevel: number = 100;
    private _miningRange: number = 5;
    private _miningCooldown: number = 1000;
    private _lastMineTime: number = 0;
    private _currentMiningTool: string = 'hand';
    private _isMining: boolean = false;

    constructor(gltf: any, spawnPosition: THREE.Vector3, characterMaterial: CANNON.Material) { // Added characterMaterial parameter
        appendToCustomLog("[AdaptedSKB Constructor] Entered. GLTF object received.", 'log', undefined, undefined, undefined, 'critical');
        appendToCustomLog(`[AdaptedSKB Constructor] SPAWN POSITION received: (${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'critical');
        if (!gltf) {
            appendToCustomLog("[AdaptedSKB Constructor] GLTF object is null or undefined before super()!", 'error', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF scene exists: ${!!gltf.scene}`, 'log', undefined, undefined, undefined, 'critical');
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF animations exist: ${!!gltf.animations}`, 'log', undefined, undefined, undefined, 'critical');
            appendToCustomLog(`[AdaptedSKB Constructor] GLTF userData exists: ${!!gltf.userData}`, 'log', undefined, undefined, undefined, 'critical');
            if (gltf.userData) {
                appendToCustomLog(`[AdaptedSKB Constructor] GLTF userData.character exists: ${!!gltf.userData.character}`, 'log', undefined, undefined, undefined, 'critical');
            }
        }
        try {
            super(gltf);
            appendToCustomLog("[AdaptedSKB Constructor] SUCCESSFULLY returned from super(gltf).", 'log', undefined, undefined, undefined, 'critical');
        } catch (e: any) {
            appendToCustomLog(`[AdaptedSKB Constructor] ERROR during super(gltf) call: ${e.message}`, 'error', undefined, undefined, undefined, 'critical');
            throw e;
        }
        this.debugId = Math.random();
        appendToCustomLog(`[AdaptedSKB Constructor] Instance created with debugId: ${this.debugId}`, 'log', undefined, undefined, undefined, 'critical');
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Value of this.rayCastLength IMMEDIATELY AFTER super(): ${this.rayCastLength}`, 'log', undefined, undefined, undefined, 'critical');

        this.rayResult = new CANNON.RaycastResult();
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Re-initialized this.rayResult with new CANNON.RaycastResult().`, 'log', undefined, undefined, undefined, 'critical');

        this.raySafeOffset = 0.03;
        this.rayCastLength = 1.2;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Set raySafeOffset=${this.raySafeOffset}, rayCastLength=${this.rayCastLength}`, 'warn', undefined, undefined, undefined, 'critical');

        if (this.modelContainer) {
            this.modelContainer.position.y = -this.rayCastLength;
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Set modelContainer.position.y = ${this.modelContainer.position.y.toFixed(2)} (to -this.rayCastLength)`, 'warn', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CRITICAL WARNING: this.modelContainer is null or undefined. Cannot set its Y position. Character visuals will be misaligned.`, 'error', undefined, undefined, undefined, 'critical');
        }

        this.slopeLimit = 0.0;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Slope limit disabled (this.slopeLimit = ${this.slopeLimit.toFixed(2)})`, 'warn', undefined, undefined, undefined, 'critical');

        this.GROUNDED_GRACE_PERIOD = 0.3;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CUSTOM OVERRIDE: Grounded grace period set to ${this.GROUNDED_GRACE_PERIOD}s`, 'warn', undefined, undefined, undefined, 'critical');

        const originalBody = this.characterCapsule.body as any;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Original body type: ${originalBody.constructor.name}. Mass: ${originalBody.mass}, Original Pos from base constructor: (${originalBody.position.x.toFixed(2)}, ${originalBody.position.y.toFixed(2)}, ${originalBody.position.z.toFixed(2)})`, 'log', undefined, undefined, undefined, 'critical');

        if (!characterMaterial) { // Use passed in material
            const errorMsg = `[AdaptedSKB Constructor ID: ${this.debugId}] ERROR: characterMaterial not provided! This is critical.`;
            appendToCustomLog(errorMsg, 'error', undefined, undefined, undefined, 'critical');
            throw new Error(errorMsg);
        }

        const newEsBody = new CANNON.Body({
            mass: originalBody.mass,
            material: characterMaterial, // Use passed in material
            position: new CANNON.Vec3(spawnPosition.x, spawnPosition.y, spawnPosition.z),
            quaternion: new CANNON.Quaternion().copy(originalBody.quaternion),
            velocity: new CANNON.Vec3().copy(originalBody.velocity),
            angularVelocity: new CANNON.Vec3().copy(originalBody.angularVelocity),
            linearDamping: originalBody.linearDamping,
            angularDamping: originalBody.angularDamping,
            fixedRotation: originalBody.fixedRotation,
            allowSleep: originalBody.allowSleep,
            angularFactor: new CANNON.Vec3().copy(originalBody.angularFactor),
        });
        (newEsBody as any).isCharacterBody = true;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Created new CANNON.Body (cannon-es). Mass: ${newEsBody.mass}, Material: ${newEsBody.material ? newEsBody.material.name : 'null'}. Tagged as character.`, 'log', undefined, undefined, undefined, 'critical');

        const charOptions = (this as any).options as any;
        let shapeRadius = 0.25;
        let shapeHeight = 0.5;

        if (charOptions && typeof charOptions.radius === 'number' && typeof charOptions.height === 'number') {
            shapeRadius = charOptions.radius;
            shapeHeight = charOptions.height;
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Using shape params from this.options: radius=${shapeRadius}, height=${shapeHeight}`, 'log', undefined, undefined, undefined, 'critical');
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] WARNING: charOptions or its radius/height is undefined/invalid. Using default capsule: radius=${shapeRadius}, height=${shapeHeight}. charOptions was: ${JSON.stringify(charOptions)}`, 'warn', undefined, undefined, undefined, 'critical');
        }

        const esSphere = new CANNON.Sphere(shapeRadius);
        newEsBody.addShape(esSphere, new CANNON.Vec3(0, shapeHeight / 2, 0));
        newEsBody.addShape(esSphere, new CANNON.Vec3(0, -shapeHeight / 2, 0));
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Added 2 Sphere shapes to new cannon-es body. Shape count: ${newEsBody.shapes.length}`, 'log', undefined, undefined, undefined, 'critical');

        if (newEsBody.shapes.length === 0) {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] CRITICAL WARNING: New cannon-es body has NO shapes! Physics will fail.`, 'error', undefined, undefined, undefined, 'critical');
        }

        newEsBody.collisionFilterGroup = CollisionGroups.Characters;
        newEsBody.shapes.forEach(shape => {
            shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
        });
        newEsBody.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Set newEsBody collisionFilterGroup=${newEsBody.collisionFilterGroup}, shape/body mask=${newEsBody.collisionFilterMask} (original SKB logic)`, 'log', undefined, undefined, undefined, 'critical');

        this.characterCapsule.body = newEsBody;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Replaced characterCapsule.body with new cannon-es body. New body's world: ${newEsBody.world || 'null'}`, 'log', undefined, undefined, undefined, 'critical');

        if (newEsBody) {
            (newEsBody as any).preStep = this.physicsPreStep.bind(this);
            (newEsBody as any).postStep = this.physicsPostStep.bind(this);
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Directly assigned this.physicsPreStep/PostStep to newEsBody.preStep/postStep.`, 'log', undefined, undefined, undefined, 'critical');
            if ((newEsBody as any).preStep) {
                appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Confirmed: newEsBody.preStep is now assigned.`, 'log', undefined, undefined, undefined, 'critical');
            }
            if ((newEsBody as any).postStep) {
                appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Confirmed: newEsBody.postStep is now assigned.`, 'log', undefined, undefined, undefined, 'critical');
            }
        } else {
            appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] ERROR: newEsBody is null, cannot assign preStep/postStep!`, 'error', undefined, undefined, undefined, 'critical');
        }

        this.threeGroundRaycaster = new THREE.Raycaster();
        this.threeGroundRaycaster.ray.direction.set(0, -1, 0);
        this.threeGroundRaycaster.far = this.rayCastLength + 10.0;
        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Initialized THREE.Raycaster. Direction: (0, -1, 0), Far: ${this.threeGroundRaycaster.far.toFixed(2)}`, 'log', undefined, undefined, undefined, 'critical');

        appendToCustomLog(`[AdaptedSKB Constructor ID: ${this.debugId}] Inheriting actions from super(). Original Sketchbook actions: up=${this.actions.up.eventCodes.join(',')}, down=${this.actions.down.eventCodes.join(',')}, left=${this.actions.left.eventCodes.join(',')}, right=${this.actions.right.eventCodes.join(',')}`, 'warn', undefined, undefined, undefined, 'critical');
    }

    // ... (rest of the methods from the original AdaptedSketchbookCharacter_Engine would go here if any)
    // For example: update, setState, etc. if they have custom logic.
    // For now, they will be inherited from OriginalCharacterForOverride.
} 