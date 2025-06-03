import * as THREE from 'three';
import { periodicTableElements } from './elements.js';
import { planetTypes } from './planettypes.js';

function getElementName(atomicNumber) {
  const element = periodicTableElements.find(e => e.Z === atomicNumber);
  return element ? element["Sym."] : 'Unknown';
}

// Initialize base universe abundance without trace elements
const baseUniverseAbundance = {
  // Light elements (99% of normal matter)
  "H": 0.75,
  "He": 0.23,
  
  // Cosmic nucleosynthesis products
  "O": 0.005,
  "C": 0.003,
  "Ne": 0.0015,
  "Fe": 0.001,
  "N": 0.0008,
  "Si": 0.0006,
  "Mg": 0.0005,
  "S": 0.0003,
  
  // Stellar fusion products (0.1%)
  "Li": 0.00005,
  "Be": 0.00002,
  "B": 0.00001,
  
  // Supernova-synthesized elements
  "Cu": 0.00007,
  "Zn": 0.00006,
  "Ag": 0.00003,
  "Au": 0.00002,
  "Pt": 0.000015,
  
  // Neutron star merger elements
  "U": 0.000001,
  "Th": 0.0000008,
  "Pu": 0.0000005
};

// Create the complete universe abundance including trace elements
const universeAbundance = {
  ...baseUniverseAbundance,
  // Trace elements (remaining 0.005%)
  ...Object.fromEntries(
    Array.from({length: 118}, (_,i) => getElementName(i+1))
      .filter(el => !Object.keys(baseUniverseAbundance).includes(el))
      .map(el => [el, 0.0000001])
  )
};

// Initialize base terrestrial planet abundance
const baseTerrestrialAbundance = {
  // Core elements (80%)
  "Fe": 0.45,
  "Ni": 0.15,
  "Co": 0.05,
  
  // Mantle elements (15%)
  "Si": 0.12,
  "Mg": 0.10,
  "O": 0.08,
  "Ca": 0.03,
  "Al": 0.02,
  
  // Crust elements (4%)
  "Na": 0.007,
  "K": 0.005,
  "Ti": 0.004,
  "P": 0.003,
  "Mn": 0.002,
  
  // Rare earth elements (1%)
  ...Object.fromEntries(
    ['La','Ce','Nd','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu']
      .map((el, i) => [el, 0.0003 + (0.0001 * i)])
  ),
  
  // Radioactive elements
  "U": 0.0002,
  "Th": 0.00015
};

// Composition templates


// Template blending function
export function blendCompositionTemplates(mainTemplate, secondaryTemplate, blendFactor) {
  // Validate template structures
  const validateTemplate = (template) => {
    if (!template?.elements) {
      console.error('Invalid template structure - missing elements field');
      return { elements: {} };
    }
    return template;
  };

  const safeMain = validateTemplate(mainTemplate);
  const safeSecondary = validateTemplate(secondaryTemplate);

  const blended = { elements: {} };

  // Blend element configurations
  const allElements = new Set([
    ...Object.keys(safeMain.elements),
    ...Object.keys(safeSecondary.elements)
  ]);

  allElements.forEach(element => {
    const mainConfig = safeMain.elements[element] || { min: 0, max: 0 };
    const secondaryConfig = safeSecondary.elements[element] || { min: 0, max: 0 };

    blended.elements[element] = {
      min: mainConfig.min + (secondaryConfig.min - mainConfig.min) * blendFactor,
      max: mainConfig.max + (secondaryConfig.max - mainConfig.max) * blendFactor
    };
  });

  // Calculate blended weight
  blended.weight = safeMain.weight + (safeSecondary.weight - safeMain.weight) * blendFactor;

  return blended;
}

// Create complete terrestrial planet abundance including remaining elements
const terrestrialPlanetAbundance = {
  ...baseTerrestrialAbundance,
  // Remaining elements (0.8%)
  ...Object.fromEntries(
    Array.from({length: 118}, (_,i) => getElementName(i+1))
      .filter(el => !Object.keys(baseTerrestrialAbundance).includes(el))
      .map(el => [el, 0.00001])
  )
};

const habitablePlanetAbundance = { // Abundance profile favoring habitable elements
  "O": 0.40,  // Increased Oxygen
  "Fe": 0.30, // Slightly reduced Iron
  "Si": 0.12,
  "Mg": 0.10,
  "C": 0.03,  // Added Carbon
  "H": 0.05,  // Hydrogen (including deuterium isotope)
  "N": 0.015, // Added Nitrogen
  "S": 0.01,
  "Ca": 0.005,
  "Al": 0.005,
  "other": 0.005 // Reduced other elements
};

const elementColors = {
  "other": 0x228B22,  // Forest Green - Fallback for unlisted elements
  // Primary Elements for Life
  "H": 0x00FFFF,  // Cyan - Hydrogen
  "O": 0x0077FF,  // Bright Blue - Oxygen
  "C": 0x404040,  // Dark Gray - Carbon
  "N": 0x2E8B57,  // Sea Green - Nitrogen
  
  // Metals
  "Fe": 0xA0522D, // Sienna - Iron
  "Al": 0xC0C0C0, // Silver - Aluminum
  "Mg": 0x98FB98, // Pale Green - Magnesium
  "Ca": 0xFFB6C1, // Light Pink - Calcium
  "Na": 0xFFA500, // Orange - Sodium
  "K": 0x800080,  // Purple - Potassium
  "Ti": 0x4682B4, // Steel Blue - Titanium
  "Ni": 0xBDB76B, // Dark Khaki - Nickel
  
  // Non-metals
  "Si": 0xFFD700, // Gold - Silicon
  "P": 0xFF4500,  // Orange Red - Phosphorus
  "S": 0xFFFF00,  // Yellow - Sulfur
  "Cl": 0x32CD32, // Lime Green - Chlorine
  
  // Noble Gases
  "He": 0xFFC0CB, // Pink - Helium
  "Ne": 0xFF69B4, // Hot Pink - Neon
  "Ar": 0x9370DB, // Medium Purple - Argon
  "Kr": 0x5CB8D1, // Light Blue - Krypton
  "Xe": 0x4298D4, // Light Blue - Xenon
  
  // Transition Metals
  "Cu": 0xCD7F32, // Bronze - Copper
  "Zn": 0xB8860B, // Dark Goldenrod - Zinc
  "Ag": 0xC0C0C0, // Silver - Silver
  "Au": 0xFFD700, // Gold - Gold
  "Pt": 0xE5E4E2, // Platinum - Platinum
  
  // Missing Elements
  "Li": 0xFFB6C1, // Light Pink - Lithium
  "Be": 0xA52A2A, // Brown - Beryllium
  "B": 0xFFD700,  // Gold - Boron
  "F": 0x00FF00,  // Green - Fluorine
  "Sc": 0xB0C4DE, // Light Steel Blue - Scandium
  "V": 0x8A2BE2, // Blue Violet - Vanadium
  "Cr": 0xD2691E, // Chocolate - Chromium
  "Mn": 0xA020F0, // Purple - Manganese
  "Co": 0x4682B4, // Steel Blue - Cobalt
  "Ga": 0xB0E0E6, // Powder Blue - Gallium
  "Ge": 0xB22222, // Firebrick - Germanium
  "As": 0x8B4513, // Saddle Brown - Arsenic
  "Se": 0xFF6347, // Tomato - Selenium
  "Br": 0xCD5C5C, // Indian Red - Bromine
  "Rb": 0x800080, // Purple - Rubidium
  "Sr": 0xFF6347, // Tomato - Strontium
  "Y": 0xDAA520, // Goldenrod - Yttrium
  "Zr": 0xA52A2A, // Brown - Zirconium
  "Nb": 0xD2691E, // Chocolate - Niobium
  "Mo": 0xA020F0, // Purple - Molybdenum
  "Tc": 0xB0C4DE, // Light Steel Blue - Technetium
  "Ru": 0x4682B4, // Steel Blue - Ruthenium
  "Rh": 0x8B4513, // Saddle Brown - Rhodium
  "Pd": 0xB22222, // Firebrick - Palladium
  "Cd": 0xFF6347, // Tomato - Cadmium
  "In": 0xCD5C5C, // Indian Red - Indium
  "Sn": 0xC0C0C0, // Silver - Tin
  "Sb": 0x8A2BE2, // Blue Violet - Antimony
  "Te": 0xB0C4DE, // Light Steel Blue - Tellurium
  "I": 0x4682B4, // Steel Blue - Iodine
  "Cs": 0x800080, // Purple - Cesium
  "Ba": 0xDEB887, // Burlywood - Barium
  "La": 0xB3B3B3, // Light Gray - Lanthanum
  "Ce": 0xFFFFC7, // Pale Yellow - Cerium
  "Pr": 0x8B4513, // Saddle Brown - Praseodymium
  "Nd": 0xC7FFC7, // Light Green - Neodymium
  "Pm": 0x20B2AA, // Light Sea Green - Promethium
  "Sm": 0x98FB98, // Pale Green - Samarium
  "Eu": 0x610094, // Purple - Europium
  "Gd": 0x8B0000, // Dark Red - Gadolinium
  "Tb": 0x8A2BE2, // Blue Violet - Terbium
  "Dy": 0xB0C4DE, // Light Steel Blue - Dysprosium
  "Ho": 0x4169E1, // Royal Blue - Holmium
  "Er": 0x20B2AA, // Light Sea Green - Erbium
  "Tm": 0x66CDAA, // Medium Aquamarine - Thulium
  "Yb": 0x87CEEB, // Sky Blue - Ytterbium
  "Lu": 0x1E90FF, // Dodger Blue - Lutetium
  "Hf": 0x8B0000, // Dark Red - Hafnium
  "Ta": 0x9400D3, // Dark Violet - Tantalum
  "W": 0xD2691E, // Chocolate - Tungsten
  "Re": 0xA020F0, // Purple - Rhenium
  "Os": 0x4682B4, // Steel Blue - Osmium
  "Ir": 0x8B4513, // Saddle Brown - Iridium
  "Hg": 0xCD5C5C, // Indian Red - Mercury
  "Tl": 0xA6A6AB, // Dark Gray - Thallium
  "Pb": 0x696969, // Dim Gray - Lead
  "Bi": 0x8A2BE2, // Blue Violet - Bismuth
  "Po": 0xB0C4DE, // Light Steel Blue - Polonium
  "At": 0x4682B4, // Steel Blue - Astatine
  "Rn": 0x8B4513, // Saddle Brown - Radon
  "Fr": 0x702970, // Purple - Francium
  "Ra": 0xB22222, // Firebrick - Radium
  "Ac": 0x8A2BE2, // Blue Violet - Actinium
  "Th": 0xB0C4DE, // Light Steel Blue - Thorium
  "Pa": 0x4682B4, // Steel Blue - Protactinium
  "U": 0xB22222, // Firebrick - Uranium
  "Np": 0x8B4513, // Saddle Brown - Neptunium
  "Pu": 0x94E0E0, // Light Cyan - Plutonium
  "Am": 0xB0C4DE, // Light Steel Blue - Americium
  "Cm": 0x4682B4, // Steel Blue - Curium
  "Bk": 0xB22222, // Firebrick - Berkelium
  "Cf": 0x8A2BE2, // Blue Violet - Californium
  "Es": 0x00C6B3, // Green-Blue - Einsteinium
  "Fm": 0xB0C4DE, // Light Steel Blue - Fermium
  "Md": 0x4682B4, // Steel Blue - Mendelevium
  "No": 0xB22222, // Firebrick - Nobelium
  "Lr": 0x8B4513, // Saddle Brown - Lawrencium
  "Rf": 0x668080, // Gray - Rutherfordium

// Transuranic elements
"Db": 0x666666, // Medium Gray - Dubnium
"Sg": 0x777777, // Darker Gray - Seaborgium
"Bh": 0x888888, // Gray - Bohrium
"Hs": 0x999999, // Light Gray - Hassium
"Mt": 0xAAAAAA, // Silver - Meitnerium
"Ds": 0xBBBBBB, // Light Silver - Darmstadtium
"Rg": 0xCCCCCC, // Platinum - Roentgenium
"Cn": 0xDDDDDD, // Light Platinum - Copernicium
"Nh": 0x707070, // Dark Gray - Nihonium
"Fl": 0x808080, // Medium Gray - Flerovium
"Mc": 0x909090, // Silver Gray - Moscovium
"Lv": 0xA0A0A0, // Light Gray - Livermorium
"Ts": 0xB0B0B0, // Platinum Gray - Tennessine
"Og": 0xC0C0C0, // Silver - Oganesson
};

// Element color cache
const elementColorCache = new Map();

// Preload all element colors at initialization
function preloadElementColors() {
  Object.entries(elementColors).forEach(([element, color]) => {
    elementColorCache.set(element, color);
  });
}
preloadElementColors();

function getRandomElementByAbundance(abundanceProfile) {
  let cumulativeProbability = 0;
  const randomNumber = Math.random();

  for (const element in abundanceProfile) {
    cumulativeProbability += abundanceProfile[element];
    if (randomNumber < cumulativeProbability) {
      return element;
    }
  }
  return "other";
}

export function getPlanetComposition(planetType = "terrestrial") {
    console.log(`🔍 [getPlanetComposition] Requesting composition for ${planetType} planet`);
    
    // Validate planet type
    if (!planetType || typeof planetType !== 'string') {
        console.warn('⚠️ Invalid planet type, defaulting to terrestrial');
        planetType = "terrestrial";
    }

    // Get base composition profile
    let composition = {};
    switch(planetType.toLowerCase()) {
        case "terrestrial":
            composition = terrestrialPlanetAbundance;
            break;
        case "habitable":
            composition = habitablePlanetAbundance;
            break;
        default:
            console.warn(`⚠️ Unknown planet type: ${planetType}, defaulting to terrestrial`);
            composition = terrestrialPlanetAbundance;
    }

    // Validate composition
    if (!composition || typeof composition !== 'object' || Object.keys(composition).length === 0) {
        console.error('⚠️ Invalid composition profile, applying emergency fallback');
        composition = {
            Fe: 0.45,
            Si: 0.12,
            O: 0.08,
            Mg: 0.10,
            Ni: 0.15,
            other: 0.10
        };
    }

    // Normalize composition
    const total = Object.values(composition).reduce((sum, val) => sum + val, 0);
    if (total !== 1) {
        console.log(`🔄 [getPlanetComposition] Normalizing composition (total: ${total.toFixed(4)})`);
        Object.keys(composition).forEach(key => {
            composition[key] = composition[key] / total;
        });
    }

    console.log(`📊 [getPlanetComposition] Generated composition for ${planetType}:`, composition);
    return composition;
}

export const compositionTemplates = {
  // Terrestrial Planet Types
  barren_planet: {
    category: 'terrestrial_planet',
    weight: 0.1,
    elements: planetTypes.barren_planet.composition
  },
  carbon_planet: {
    category: 'terrestrial_planet',
    weight: 0.1,
    elements: planetTypes.carbon_planet.composition
  },
  
  // Gas Giant Types
  gas_giant: {
    category: 'gas_giant',
    weight: 0.3,
    elements: planetTypes.gas_giant.composition
  },
  alkali_metal_clouds_gas_giant: {
    category: 'gas_giant',
    weight: 0.2,
    elements: planetTypes.alkali_metal_clouds_gas_giant.composition
  },
  cloudless_gas_giant: {
    category: 'gas_giant',
    weight: 0.1,
    elements: planetTypes.cloudless_gas_giant.composition
  },
  
  // Ice Giant Types
  ice_giant: {
    category: 'ice_giant',
    weight: 0.2,
    elements: planetTypes.ice_giant.composition
  },
  ammonia_planet: {
    category: 'ice_giant',
    weight: 0.1,
    elements: planetTypes.ammonia_planet.composition
  },
  
  // Brown Dwarf Types
  brown_dwarf: {
    category: 'brown_dwarf',
    weight: 0.1,
    elements: planetTypes.brown_dwarf.composition
  },
  sub_brown_dwarf: {
    category: 'brown_dwarf',
    weight: 0.05,
    elements: planetTypes.sub_brown_dwarf.composition
  },
  
  // Special Planet Types
  habitable: {
    category: 'terrestrial_planet',
    weight: 0.2,
    elements: planetTypes.earth_like_planet.composition
  },
  
  // Add more specific planet types as needed
  // Example:
  xenon_planet: {
    category: 'gas_giant',
    weight: 0.05,
    elements: planetTypes.xenon_planet.composition
  }
};

export function assignElementComposition(planet, planetType = "terrestrial") {
    console.log(`🔄 [assignElementComposition] Assigning composition for ${planetType} planet`);
    const composition = getPlanetComposition(planetType);
    const weights = Object.values(composition)
    .map(w => Number.isFinite(w) ? w : 0)
    .filter(w => w > 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    // Add color logging for each element
    Object.entries(composition).forEach(([element, abundance]) => {
        const color = getElementColor(element);
        console.log(`🎨 [assignElementComposition] Element: ${element}, Abundance: ${abundance}, Color: ${color.toString(16).padStart(6, '0')}`);
    });
    
    planet.elementComposition = {};

    // Get top 5 elements by abundance from the composition profile
    const sortedElements = Object.entries(composition)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    // Assign the elements to the planet with their original abundances
    sortedElements.forEach(([element, abundance]) => {
      planet.elementComposition[element] = abundance;
    });

    // Use the color of the most abundant element directly
    const [primaryElement] = sortedElements[0];
    const elementHexColor = elementColors[primaryElement] || 0xAAAAAA;
    planet.elementBaseColor = new THREE.Color(elementHexColor);

    console.log(`Planet Composition Assigned - Type: ${planetType}, Primary Element: ${primaryElement}, Composition:`, planet.elementComposition, "Base Color:", planet.elementBaseColor);
}

export function getElementColor(elementSymbol) {
    // Validate color existence with fallback
    if (!elementColorCache.has(elementSymbol)) {
        console.warn(`Missing color definition for ${elementSymbol}, using fallback`);
        return 0xFF00FF;
    }
    return elementColorCache.get(elementSymbol) || 0x228B22;
}

export function getElementFullName(symbol) {
    if (!symbol) return 'Unknown'; // Handle empty/null symbol
    const element = periodicTableElements.find(el => el["Sym."].toLowerCase() === symbol.toLowerCase());
    return element ? element["Element"] : symbol; // Return full name or symbol as fallback
}

export { universeAbundance, terrestrialPlanetAbundance, habitablePlanetAbundance, elementColors };
