// Centralized Character Imports

// Primary Character Implementation
import { Character as SketchbookCharacter } from '../../Sketchbook-master/src/ts/characters/Character';

// Placeholder Character Type for local use
import { Character as PlaceholderCharacter } from '../ui/placeholderTypes';

// Combine types to ensure compatibility
export type Character = SketchbookCharacter & PlaceholderCharacter;

// Export original and placeholder implementations
export { SketchbookCharacter, PlaceholderCharacter };

// Additional related imports
export { 
    ICharacterState 
} from '../../Sketchbook-master/src/ts/interfaces/ICharacterState';

export { 
    EntityType 
} from '../../Sketchbook-master/src/ts/enums/EntityType';
