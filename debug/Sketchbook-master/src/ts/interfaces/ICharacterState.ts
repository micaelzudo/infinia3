import { Character } from "../characters/Character";

export interface ICharacterState {
	character: Character;
	canFindVehiclesToEnter: boolean; // Find a suitable car and run towards it
	canEnterVehicles: boolean; // Actually get into the vehicle
	canLeaveVehicles: boolean;

	update: (timeStep: number, unscaledTimeStep?: number) => void;
	handleAction?: (action: string, value: boolean) => void;
	onInputChange?: () => void;
	enter?: (oldState: ICharacterState) => void;
	exit?: () => void;
}