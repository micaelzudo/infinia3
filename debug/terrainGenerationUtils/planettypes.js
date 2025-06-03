export const planetTypes = {
  'alkali_metal_clouds_gas_giant': {
    category: 'gas_giant',
    description: 'Gas giant with alkali metal clouds',
    composition: {
      H: { min: 0.60, max: 0.75 },
      He: { min: 0.20, max: 0.30 },
      Na: { min: 0.01, max: 0.05 },
      K: { min: 0.005, max: 0.03 },
      C: { min: 0.01, max: 0.03 },
      O: { min: 0.02, max: 0.05 },
      Si: { min: 0.001, max: 0.005 },
      Fe: { min: 0.0005, max: 0.003 },
      N: { min: 0.001, max: 0.005 },
      S: { min: 0.0005, max: 0.002 },
      P: { min: 0.0001, max: 0.001 },
      Ar: { min: 0.0001, max: 0.001 },
    },
  },
  'ammonia_clouds_gas_giant': {
    category: 'gas_giant',
    description: 'Gas giant with ammonia clouds',
    composition: {
      H: { min: 0.70, max: 0.80 },
      He: { min: 0.15, max: 0.25 },
      N: { min: 0.01, max: 0.05 },
      C: { min: 0.005, max: 0.02 },
      O: { min: 0.005, max: 0.02 },
      S: { min: 0.0001, max: 0.001 },
      P: { min: 0.00005, max: 0.0005 },
      Ne: { min: 0.0001, max: 0.0005 },
      Ar: { min: 0.0001, max: 0.0005 }
      // Core components (optional for atmospheric focus, but good for overall)
      // Si: { min: 0.001, max: 0.005 },
      // Mg: { min: 0.0005, max: 0.002 },
      // Fe: { min: 0.0005, max: 0.002 },
    },
  },
  'ammonia_planet': {
    category: 'ice_giant',
    description: 'Planet with ammonia-dominated atmosphere',
    composition: {
      N: { min: 0.40, max: 0.60 },
      H: { min: 0.15, max: 0.25 },
      O: { min: 0.10, max: 0.20 },
      C: { min: 0.05, max: 0.15 },
      Si: { min: 0.05, max: 0.10 },
      Fe: { min: 0.02, max: 0.05 },
      Mg: { min: 0.01, max: 0.03 },
      S: { min: 0.005, max: 0.02 },
      Ar: { min: 0.001, max: 0.005 },
      Ne: { min: 0.0005, max: 0.002 }
      // Potentially other ices like N2, CO
    },
  },
  'barren_planet': {
    category: 'terrestrial_planet',
    description: 'Rocky planet with little to no atmosphere, similar to Mercury or Mars.',
    composition: {
      O: { min: 0.40, max: 0.50 },   // Bound in silicates and oxides
      Si: { min: 0.20, max: 0.30 },  // Silicates
      Fe: { min: 0.10, max: 0.25 },  // Core and crustal iron
      Mg: { min: 0.05, max: 0.15 },  // Silicates (e.g., olivine, pyroxene)
      Al: { min: 0.03, max: 0.08 },  // Feldspars, clays
      Ca: { min: 0.02, max: 0.06 },  // Feldspars, carbonates (if any)
      S: { min: 0.005, max: 0.02 },   // Sulfides, sulfates
      Ni: { min: 0.001, max: 0.01 },  // Often associated with iron
      Na: { min: 0.001, max: 0.01 },  // Feldspars
      K: { min: 0.0005, max: 0.005 }, // Feldspars
      Ti: { min: 0.0005, max: 0.005 }, // Ilmenite and other oxides
      // Very trace atmospheric components or surface ices if any
      // C: { min: 0.0001, max: 0.001 }, // e.g. CO2
      // N: { min: 0.0001, max: 0.0005 }, // e.g. N2
      // Ar: { min: 0.0001, max: 0.0005 }
    },
  },
  'brown_dwarf': {
    category: 'brown_dwarf',
    description: 'Substellar object between gas giant and star',
    composition: {
      H: { min: 0.7, max: 0.8 },
      He: { min: 0.15, max: 0.25 },
      D: { min: 0.03, max: 0.07 },
      Li: { min: 0.005, max: 0.02 },
      C: { min: 0.001, max: 0.01 },
      N: { min: 0.001, max: 0.01 },
      O: { min: 0.001, max: 0.01 },
      Ne: { min: 0.0005, max: 0.003 },
      Ar: { min: 0.0001, max: 0.001 },
    },
  },
  'carbon_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with a carbon-rich composition, potentially with graphite/diamond layers and hydrocarbon seas.',
    composition: {
      C: { min: 0.50, max: 0.75 },    // Dominant element, forming graphite, diamond, carbides
      Si: { min: 0.10, max: 0.20 },   // Primarily as Silicon Carbide (SiC)
      Fe: { min: 0.05, max: 0.15 },   // Iron/Steel core
      Ti: { min: 0.005, max: 0.02 },  // Titanium Carbide (TiC)
      O: { min: 0.01, max: 0.05 },    // Mostly as CO, very little free O or H2O
      S: { min: 0.005, max: 0.02 },   // Sulfur compounds, potentially thiophenes in tar
      N: { min: 0.001, max: 0.01 },   // Trace nitrogen compounds, possibly in atmosphere
      H: { min: 0.01, max: 0.05 },    // Bound in hydrocarbons (methane, ethane, tar)
      // Other refractory carbides could be present in trace amounts
      // Mo: { min: 0.0001, max: 0.001 }, // Molybdenum Carbide
      // W: { min: 0.0001, max: 0.001 },  // Tungsten Carbide
    },
  },
  'chlorine_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with chlorine-rich atmosphere',
    composition: {
      Cl: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      Na: { min: 0.03, max: 0.08 },
      K: { min: 0.01, max: 0.05 },
      Si: { min: 0.01, max: 0.05 },
      Fe: { min: 0.005, max: 0.02 },
      Mg: { min: 0.001, max: 0.01 },
      S: { min: 0.001, max: 0.01 },
    },
  },
  'chthonian_planet': {
    category: 'gas_giant_core',
    description: 'Remnant core of a gas giant that has lost its H/He atmosphere, leaving a dense rocky/metallic body.',
    composition: {
      Fe: { min: 0.35, max: 0.55 },  // Dense iron-nickel core
      Ni: { min: 0.03, max: 0.08 },  // Alloyed with iron in the core
      Si: { min: 0.15, max: 0.25 },  // Silicate rock (mantle)
      O: { min: 0.15, max: 0.25 },   // Bound in silicates and oxides
      Mg: { min: 0.05, max: 0.15 },  // Silicates (e.g., perovskite, olivine under pressure)
      S: { min: 0.01, max: 0.05 },   // Iron sulfide (FeS) in core or mantle
      Ca: { min: 0.005, max: 0.02 }, // Trace rock-forming element
      Al: { min: 0.005, max: 0.02 }, // Trace rock-forming element
      // Negligible H, He, C, N unless trace atmospheric remnants or later accretion
      // C: { min: 0.0001, max: 0.005 },
      // H: { min: 0.0001, max: 0.001 }
    },
  },
  'cloudless_gas_giant': {
    category: 'gas_giant',
    description: 'Gas giant without cloud cover',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.1, max: 0.2 },
      C: { min: 0.03, max: 0.07 },
      N: { min: 0.01, max: 0.03 },
      O: { min: 0.005, max: 0.02 },
      Ne: { min: 0.001, max: 0.005 },
      S: { min: 0.0005, max: 0.002 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'cold_eyeball_planet': {
    category: 'terrestrial_planet',
    description: 'Tidally locked planet with liquid on star-facing side',
    composition: {
      H: { min: 0.35, max: 0.45 },
      O: { min: 0.35, max: 0.45 },
      Si: { min: 0.15, max: 0.25 },
      Fe: { min: 0.03, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Al: { min: 0.003, max: 0.01 },
      Na: { min: 0.001, max: 0.005 },
      K: { min: 0.0005, max: 0.003 },
      C: { min: 0.001, max: 0.01 },
    },
  },
  'coreless_planet': {
    category: 'terrestrial_planet',
    description: 'Planet without a metallic core',
    composition: {
      Si: { min: 0.75, max: 0.85 },
      Mg: { min: 0.15, max: 0.25 },
      Al: { min: 0.03, max: 0.08 },
      Ca: { min: 0.01, max: 0.05 },
      Na: { min: 0.005, max: 0.02 },
      K: { min: 0.001, max: 0.01 },
      O: { min: 0.03, max: 0.08 },
      Ti: { min: 0.0005, max: 0.002 },
    },
  },
  'crater_planet': {
    category: 'terrestrial_planet',
    description: 'Planet heavily pockmarked with impact craters',
    composition: {
      Si: { min: 0.55, max: 0.65 },
      Al: { min: 0.25, max: 0.35 },
      Fe: { min: 0.05, max: 0.15 },
      Mg: { min: 0.03, max: 0.08 },
      Ca: { min: 0.01, max: 0.05 },
      Ti: { min: 0.001, max: 0.01 },
      O: { min: 0.02, max: 0.06 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.005 },
    },
  },
  'desert_planet': {
    category: 'terrestrial_planet',
    description: 'Arid planet with vast deserts, minimal surface water, and a thin atmosphere, like Mars.',
    composition: {
      O: { min: 0.45, max: 0.55 },  // Bound in silicates and iron oxides
      Si: { min: 0.20, max: 0.30 },  // Silicates (e.g., feldspar, pyroxene, olivine)
      Fe: { min: 0.10, max: 0.20 },  // Iron oxides (rust), core, silicates
      Mg: { min: 0.05, max: 0.10 },  // Silicates (olivine, pyroxene)
      Al: { min: 0.03, max: 0.08 },  // Feldspars, clays
      Ca: { min: 0.03, max: 0.07 },  // Feldspars, carbonates, sulfates
      S: { min: 0.01, max: 0.05 },   // Sulfates (e.g., gypsum), sulfides
      Na: { min: 0.005, max: 0.02 }, // Feldspars, salts
      K: { min: 0.001, max: 0.01 },  // Feldspars
      Cl: { min: 0.001, max: 0.005 }, // Chlorides, perchlorates
      C: { min: 0.001, max: 0.005 },   // Trace carbonates, atmospheric CO2
      H: { min: 0.0001, max: 0.002 }  // Water ice (polar caps, subsurface), hydrated minerals
      // Ar: { min: 0.0001, max: 0.001 } // Atmospheric argon (if considering atmosphere in bulk)
      // N: { min: 0.00005, max: 0.0005} // Atmospheric nitrogen (if considering atmosphere in bulk)
    },
  },
  'diamond_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with diamond-rich composition',
    composition: {
      C: { min: 0.85, max: 0.95 },
      Si: { min: 0.05, max: 0.15 },
      Fe: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.005 },
      O: { min: 0.001, max: 0.01 },
      N: { min: 0.0005, max: 0.005 },
      H: { min: 0.0001, max: 0.001 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'disrupted_planet': {
    category: 'terrestrial_planet',
    description: 'Planet that has been disrupted by a nearby astronomical body',
    composition: {
      Si: { min: 0.55, max: 0.65 },
      Fe: { min: 0.25, max: 0.35 },
      Mg: { min: 0.05, max: 0.15 },
      Al: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.03 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.005 },
      Ti: { min: 0.0001, max: 0.001 },
      O: { min: 0.01, max: 0.05 },
    },
  },
  'dwarf_planet': {
    category: 'dwarf_planet',
    description: 'Smaller planetary body, often icy or rocky, like Pluto or Ceres.',
    composition: {
      O: { min: 0.30, max: 0.50 },  // In H2O ice, silicates, CO, CO2
      H: { min: 0.10, max: 0.30 },  // In H2O ice, CH4, NH3, organics
      Si: { min: 0.10, max: 0.25 }, // Silicate rock core/mantle
      C: { min: 0.05, max: 0.20 },  // In CH4, CO, CO2, carbonates, tholins
      N: { min: 0.01, max: 0.15 },  // In N2 ice, NH3, tholins
      Fe: { min: 0.05, max: 0.15 }, // Rocky core, metallic component
      Mg: { min: 0.03, max: 0.10 }, // Silicates in core/mantle
      S: { min: 0.005, max: 0.02 }, // Sulfides, sulfates
      Al: { min: 0.01, max: 0.05 },  // Silicates in core/mantle
      Ca: { min: 0.005, max: 0.03 }, // Carbonates, silicates
      Na: { min: 0.001, max: 0.01 }, // Salts, trace in silicates
      K: { min: 0.0005, max: 0.005 } // Salts, trace in silicates
    },
  },
  'earth_analog_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with environmental conditions similar to Earth',
    composition: {
      O: { min: 0.45, max: 0.50 },
      Si: { min: 0.25, max: 0.30 },
      Fe: { min: 0.10, max: 0.15 },
      Mg: { min: 0.05, max: 0.08 },
      Ca: { min: 0.02, max: 0.04 },
      Al: { min: 0.01, max: 0.03 },
      Na: { min: 0.002, max: 0.01 },
      K: { min: 0.001, max: 0.005 },
      Ti: { min: 0.0005, max: 0.002 },
      H: { min: 0.001, max: 0.005 },
      C: { min: 0.001, max: 0.005 },
      N: { min: 0.0005, max: 0.003 },
      P: { min: 0.0001, max: 0.001 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'earth_like_planet': {
    category: 'terrestrial_planet',
    description: 'Planet similar to Earth, with liquid water, continents, and a dynamic atmosphere.',
    composition: {
      Fe: { min: 0.30, max: 0.35 },  // Core primarily
      O: { min: 0.28, max: 0.32 },   // Crust, mantle (silicates, oxides), atmosphere, water
      Si: { min: 0.14, max: 0.18 },  // Crust, mantle (silicates)
      Mg: { min: 0.12, max: 0.15 },  // Mantle, crust (silicates)
      Ni: { min: 0.015, max: 0.025 },// Core
      S: { min: 0.01, max: 0.03 },   // Core, mantle
      Ca: { min: 0.01, max: 0.02 },  // Crust, mantle
      Al: { min: 0.01, max: 0.02 },  // Crust, mantle
      Na: { min: 0.002, max: 0.005 },// Crust, oceans
      K: { min: 0.0001, max: 0.0003 },// Crust
      H: { min: 0.001, max: 0.01 },  // Water, atmosphere, biomass
      C: { min: 0.0005, max: 0.005 }, // Biomass, atmosphere (CO2), carbonates
      N: { min: 0.0001, max: 0.001 }  // Atmosphere (N2), biomass
      // Other trace elements like Ti, P, Cr, Mn etc.
    },
  },
  'ecumenopolis_planet': {
    category: 'terrestrial_planet',
    description: 'Planetwide city',
    composition: {
      Si: { min: 0.65, max: 0.75 },
      Al: { min: 0.15, max: 0.25 },
      Fe: { min: 0.05, max: 0.15 },
      Mg: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.03 },
      Ti: { min: 0.001, max: 0.01 },
      Cu: { min: 0.001, max: 0.01 },
      O: { min: 0.01, max: 0.05 },
      C: { min: 0.005, max: 0.02 },
    },
  },
  'ellipsoid_planet': {
    category: 'gas_giant',
    description: 'Planet with oval shape due to tidal forces',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.1, max: 0.2 },
      C: { min: 0.03, max: 0.07 },
      N: { min: 0.01, max: 0.03 },
      O: { min: 0.005, max: 0.02 },
      Ne: { min: 0.001, max: 0.01 },
      Ar: { min: 0.0005, max: 0.003 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'exoplanet': {
    category: 'exoplanet',
    description: 'Planet outside the Solar System',
    composition: {
      H: { min: 0.65, max: 0.75 },
      He: { min: 0.15, max: 0.25 },
      C: { min: 0.05, max: 0.15 },
      O: { min: 0.01, max: 0.05 },
      N: { min: 0.01, max: 0.03 },
      Si: { min: 0.005, max: 0.03 },
      Fe: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'eyeball_planet': {
    category: 'terrestrial_planet',
    description: 'Tidally locked planet with one side perpetually facing its star (hot) and the other in darkness (cold).',
    composition: {
      O: { min: 0.35, max: 0.45 },   // Silicates, oxides
      Si: { min: 0.18, max: 0.28 },  // Silicates
      Fe: { min: 0.15, max: 0.25 },  // Core, crustal iron/oxides
      Mg: { min: 0.10, max: 0.20 },  // Silicates (e.g., olivine, pyroxene)
      Al: { min: 0.04, max: 0.08 },  // Feldspars, refractory oxides
      Ca: { min: 0.03, max: 0.07 },  // Feldspars, refractory minerals
      Ti: { min: 0.001, max: 0.005}, // Refractory oxides like ilmenite
      S: { min: 0.005, max: 0.03 },  // Sulfides, potential for SO2 in atmosphere (volcanic/hot side)
      Na: { min: 0.001, max: 0.01 }, // Feldspars, salts
      K: { min: 0.0005, max: 0.005}, // Feldspars
      // Volatiles for potential thin/transient atmosphere or night-side ice
      C: { min: 0.0001, max: 0.005 }, // CO2 (thin atm, or ice)
      N: { min: 0.0001, max: 0.002 }  // N2 (thin atm, or ice)
    },
  },
  'fluorine_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with fluorine-rich atmosphere',
    composition: {
      F: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      Si: { min: 0.05, max: 0.15 },
      Al: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.01 },
      Fe: { min: 0.0005, max: 0.005 },
    },
  },
  'forest_planet': {
    category: 'terrestrial_planet',
    description: 'Lush planet covered in dense forests and diverse ecosystems, vibrant with life.',
    composition: {
      O: { min: 0.28, max: 0.35 },  // Atmosphere, water, silicates, biomass
      Fe: { min: 0.25, max: 0.32 },  // Core primarily, trace in biomass
      Si: { min: 0.14, max: 0.18 },  // Crust, mantle (silicates)
      Mg: { min: 0.10, max: 0.15 },  // Mantle, crust (silicates), essential for chlorophyll
      C: { min: 0.02, max: 0.08 },   // Biomass, atmospheric CO2, carbonates, soil organic matter
      H: { min: 0.01, max: 0.05 },   // Water, biomass
      N: { min: 0.005, max: 0.02 },  // Atmosphere (N2), biomass (proteins, nucleic acids)
      S: { min: 0.005, max: 0.02 },  // Proteins, volcanic gases, sulfates
      Ca: { min: 0.01, max: 0.02 },  // Cell walls, bones (if fauna), silicates
      Al: { min: 0.01, max: 0.02 },  // Crust, mantle
      K: { min: 0.001, max: 0.003 }, // Essential for plant life, clays
      P: { min: 0.0005, max: 0.002 } // Crucial for DNA, ATP, cell membranes (often a limiting nutrient)
      // Other trace elements essential for life: Na, Cl, Mn, Zn, Cu, Mo etc.
    },
  },
  'gas_giant': {
    category: 'gas_giant',
    description: 'Large planet composed mainly of hydrogen and helium',
    composition: {
      H: { min: 0.85, max: 0.95 },
      He: { min: 0.05, max: 0.15 },
      C: { min: 0.01, max: 0.05 },
      N: { min: 0.005, max: 0.02 },
      O: { min: 0.001, max: 0.01 },
      Ne: { min: 0.0005, max: 0.003 },
      Ar: { min: 0.0001, max: 0.001 },
      S: { min: 0.0001, max: 0.001 },
      P: { min: 0.00005, max: 0.0005 },
    },
  },
  'giant_planet': {
    category: 'gas_giant',
    description: 'Very large planet, typically gas or ice giant',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.1, max: 0.2 },
      C: { min: 0.03, max: 0.07 },
      N: { min: 0.01, max: 0.03 },
      O: { min: 0.005, max: 0.02 },
      Ne: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'helium_3_planet': {
    category: 'gas_giant',
    description: 'Planet rich in helium-3 isotope',
    composition: {
      He: { min: 0.75, max: 0.85 },
      H: { min: 0.15, max: 0.25 },
      Ne: { min: 0.01, max: 0.05 },
      Ar: { min: 0.005, max: 0.02 },
      C: { min: 0.001, max: 0.01 },
      N: { min: 0.0005, max: 0.005 },
      O: { min: 0.0001, max: 0.001 },
    },
  },
  'helium_planet': {
    category: 'exotic_gas_giant',
    description: 'Hypothetical gas giant whose hydrogen envelope has been stripped, leaving a helium-dominated atmosphere.',
    composition: {
      He: { min: 0.80, max: 0.98 },   // Dominant element
      C: { min: 0.005, max: 0.05 },   // Primarily as CO, CO2 due to H depletion
      O: { min: 0.005, max: 0.05 },   // Bound with Carbon as CO, CO2
      N: { min: 0.001, max: 0.02 },   // Molecular Nitrogen (N2) if present
      Ne: { min: 0.001, max: 0.01 },   // Neon, enriched relative to H-dominated giants
      Ar: { min: 0.0005, max: 0.005 }, // Argon
      H: { min: 0.001, max: 0.02 },  // Very depleted Hydrogen
      // Core components expected below the helium atmosphere
      // Si: { min: 0.01, max: 0.05 }, // Silicate core
      // Fe: { min: 0.01, max: 0.05 }  // Iron in core
    },
  },
  'hot_eyeball_planet': {
    category: 'terrestrial_planet',
    description: 'Tidally locked planet with liquid on night side',
    composition: {
      H: { min: 0.45, max: 0.55 },
      O: { min: 0.25, max: 0.35 },
      Si: { min: 0.15, max: 0.25 },
      Fe: { min: 0.03, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Al: { min: 0.003, max: 0.01 },
      Na: { min: 0.001, max: 0.005 },
      K: { min: 0.0005, max: 0.003 },
    },
  },
  'hot_jupiter': {
    category: 'gas_giant',
    description: 'Gas giant close to its star',
    composition: {
      H: { min: 0.8, max: 0.9 },
      He: { min: 0.05, max: 0.15 },
      Na: { min: 0.03, max: 0.07 },
      K: { min: 0.01, max: 0.03 },
      Fe: { min: 0.001, max: 0.01 },
      O: { min: 0.001, max: 0.01 },
      Si: { min: 0.0005, max: 0.005 },
      Ti: { min: 0.0001, max: 0.001 },
    },
  },
  'hot_neptune': {
    category: 'ice_giant',
    description: 'Ice giant close to its star',
    composition: {
      H: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.05, max: 0.15 },
      N: { min: 0.02, max: 0.06 },
      He: { min: 0.01, max: 0.05 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.005 },
    },
  },
  'hydrogen_sulfide_planet': {
    category: 'gas_giant',
    description: 'Planet with hydrogen sulfide atmosphere',
    composition: {
      H: { min: 0.65, max: 0.75 },
      S: { min: 0.25, max: 0.35 },
      He: { min: 0.01, max: 0.05 },
      C: { min: 0.005, max: 0.02 },
      N: { min: 0.001, max: 0.01 },
      O: { min: 0.001, max: 0.01 },
      Fe: { min: 0.0001, max: 0.001 },
    },
  },
  'hycean_planet': {
    category: 'gas_giant',
    description: 'Planet with hydrogen-rich atmosphere and water ocean',
    composition: {
      H: { min: 0.65, max: 0.75 },
      O: { min: 0.15, max: 0.25 },
      C: { min: 0.05, max: 0.15 },
      N: { min: 0.01, max: 0.05 },
      He: { min: 0.005, max: 0.02 },
      P: { min: 0.001, max: 0.01 },
      S: { min: 0.001, max: 0.01 },
      Fe: { min: 0.0005, max: 0.005 },
      Ca: { min: 0.0001, max: 0.001 },
    },
  },
  'ice_giant': {
    category: 'ice_giant',
    description: 'Planet composed mainly of ice and volatiles',
    composition: {
      H: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.05, max: 0.15 },
      N: { min: 0.02, max: 0.06 },
      He: { min: 0.01, max: 0.04 },
      S: { min: 0.005, max: 0.02 },
      P: { min: 0.001, max: 0.005 },
      Ne: { min: 0.0005, max: 0.002 },
      Ar: { min: 0.0001, max: 0.001 },
    },
  },
  'ice_planet': {
    category: 'ice_giant',
    description: 'Planet with surface covered in ice',
    composition: {
      H: { min: 0.45, max: 0.55 },
      O: { min: 0.35, max: 0.45 },
      C: { min: 0.03, max: 0.08 },
      N: { min: 0.01, max: 0.05 },
      Si: { min: 0.001, max: 0.01 },
      Fe: { min: 0.0005, max: 0.005 },
      Mg: { min: 0.0001, max: 0.001 },
    },
  },
  'iron_oxide_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with iron oxide-rich composition',
    composition: {
      Fe: { min: 0.75, max: 0.85 },
      O: { min: 0.15, max: 0.25 },
      Si: { min: 0.01, max: 0.05 },
      Mg: { min: 0.005, max: 0.02 },
      Al: { min: 0.001, max: 0.01 },
      Ca: { min: 0.0005, max: 0.005 },
      Ti: { min: 0.0001, max: 0.001 },
    },
  },
  'iron_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with iron-rich composition',
    composition: {
      Fe: { min: 0.85, max: 0.95 },
      Ni: { min: 0.05, max: 0.15 },
      Co: { min: 0.01, max: 0.05 },
      Cr: { min: 0.005, max: 0.02 },
      Mn: { min: 0.001, max: 0.01 },
      Si: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.005 },
      C: { min: 0.0001, max: 0.001 },
    },
  },
  'jungle_planet': {
    category: 'terrestrial_planet',
    description: 'Planet covered in dense jungle vegetation',
    composition: {
      C: { min: 0.40, max: 0.50 },
      H: { min: 0.20, max: 0.30 },
      O: { min: 0.15, max: 0.25 },
      N: { min: 0.05, max: 0.15 },
      Si: { min: 0.03, max: 0.08 },
      Fe: { min: 0.01, max: 0.03 },
      P: { min: 0.005, max: 0.02 },
      S: { min: 0.003, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      Ca: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.01 },
    },
  },
  'krypton_planet': {
    category: 'gas_giant',
    description: 'Planet with krypton-dominated atmosphere',
    composition: {
      Kr: { min: 0.85, max: 0.95 },
      Xe: { min: 0.05, max: 0.15 },
      Ar: { min: 0.01, max: 0.05 },
      Ne: { min: 0.001, max: 0.01 },
      He: { min: 0.0005, max: 0.005 },
      Rn: { min: 0.00001, max: 0.0001 },
    },
  },
  'lava_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with surface covered in molten lava',
    composition: {
      Si: { min: 0.75, max: 0.85 },
      Fe: { min: 0.15, max: 0.25 },
      Mg: { min: 0.05, max: 0.10 },
      Al: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      Ti: { min: 0.0005, max: 0.005 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'mega_earth': {
    category: 'terrestrial_planet',
    description: 'Very large terrestrial planet',
    composition: {
      Si: { min: 0.45, max: 0.55 },
      O: { min: 0.25, max: 0.35 },
      Fe: { min: 0.10, max: 0.20 },
      Mg: { min: 0.05, max: 0.10 },
      Al: { min: 0.01, max: 0.05 },
      Ca: { min: 0.01, max: 0.03 },
      Ni: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.005 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'mesoplanet': {
    category: 'terrestrial_planet',
    description: 'Planet between Earth and Mars in size',
    composition: {
      Si: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      Fe: { min: 0.05, max: 0.15 },
      Mg: { min: 0.03, max: 0.08 },
      Al: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.005 },
      Ti: { min: 0.0001, max: 0.001 },
    },
  },
  'methane_planet': {
    category: 'gas_giant',
    description: 'Planet with methane-dominated atmosphere',
    composition: {
      C: { min: 0.45, max: 0.55 },
      H: { min: 0.35, max: 0.45 },
      N: { min: 0.05, max: 0.15 },
      O: { min: 0.01, max: 0.05 },
      S: { min: 0.001, max: 0.01 },
      He: { min: 0.001, max: 0.01 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'mini_jupiter': {
    category: 'gas_giant',
    description: 'Small gas giant',
    composition: {
      H: { min: 0.8, max: 0.9 },
      He: { min: 0.1, max: 0.2 },
      C: { min: 0.01, max: 0.05 },
      N: { min: 0.005, max: 0.02 },
      O: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'mini_neptune': {
    category: 'ice_giant',
    description: 'Small ice giant',
    composition: {
      H: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.03, max: 0.08 },
      N: { min: 0.01, max: 0.05 },
      He: { min: 0.01, max: 0.03 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.003 },
      Si: { min: 0.0001, max: 0.001 },
    },
  },
  'mountain_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with extreme topography',
    composition: {
      Si: { min: 0.85, max: 0.95 },
      O: { min: 0.05, max: 0.15 },
      Al: { min: 0.03, max: 0.08 },
      Fe: { min: 0.01, max: 0.05 },
      Mg: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.003 },
      Ti: { min: 0.0001, max: 0.001 },
    },
  },
  'neon_planet': {
    category: 'gas_giant',
    description: 'Planet with neon-dominated atmosphere',
    composition: {
      Ne: { min: 0.85, max: 0.95 },
      He: { min: 0.05, max: 0.15 },
      Ar: { min: 0.01, max: 0.05 },
      Kr: { min: 0.001, max: 0.01 },
      Xe: { min: 0.0005, max: 0.003 },
      H: { min: 0.0001, max: 0.001 },
    },
  },
  'nitrogen_oxide_planet': {
    category: 'gas_giant',
    description: 'Planet with nitrogen oxide atmosphere',
    composition: {
      N: { min: 0.55, max: 0.65 },
      O: { min: 0.35, max: 0.45 },
      Ar: { min: 0.01, max: 0.05 },
      C: { min: 0.001, max: 0.01 },
      H: { min: 0.001, max: 0.01 },
      Ne: { min: 0.0005, max: 0.003 },
      He: { min: 0.0001, max: 0.001 },
    },
  },
  'nitrogen_planet': {
    category: 'gas_giant',
    description: 'Planet with nitrogen-dominated atmosphere',
    composition: {
      N: { min: 0.85, max: 0.95 },
      O: { min: 0.05, max: 0.15 },
      Ar: { min: 0.01, max: 0.05 },
      C: { min: 0.001, max: 0.01 },
      He: { min: 0.0005, max: 0.003 },
      Ne: { min: 0.0001, max: 0.001 },
    },
  },
  'ocean_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with surface covered in water',
    composition: {
      H: { min: 0.45, max: 0.55 },
      O: { min: 0.35, max: 0.45 },
      Si: { min: 0.05, max: 0.12 },
      Fe: { min: 0.01, max: 0.05 },
      Mg: { min: 0.01, max: 0.04 },
      Na: { min: 0.005, max: 0.02 },
      Cl: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      C: { min: 0.001, max: 0.01 },
      N: { min: 0.0005, max: 0.005 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'oxygen_planet': {
    category: 'gas_giant',
    description: 'Planet with oxygen-dominated atmosphere',
    composition: {
      O: { min: 0.85, max: 0.95 },
      N: { min: 0.05, max: 0.15 },
      Ar: { min: 0.01, max: 0.03 },
      C: { min: 0.002, max: 0.01 },
      Ne: { min: 0.001, max: 0.01 },
      He: { min: 0.0005, max: 0.003 },
      H: { min: 0.0001, max: 0.001 },
      Kr: { min: 0.0001, max: 0.001 },
    },
  },
  'phosphorus_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with phosphorus-rich composition',
    composition: {
      P: { min: 0.55, max: 0.65 },
      Si: { min: 0.25, max: 0.35 },
      O: { min: 0.05, max: 0.15 },
      Fe: { min: 0.01, max: 0.05 },
      Ca: { min: 0.005, max: 0.02 },
      Al: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.01 },
      Na: { min: 0.0005, max: 0.005 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'planetesimal': {
    category: 'terrestrial_planet',
    description: 'Small body from which planets form',
    composition: {
      Si: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      Fe: { min: 0.03, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Al: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      Ni: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
      C: { min: 0.0001, max: 0.001 },
    },
  },
  'protoplanet': {
    category: 'terrestrial_planet',
    description: 'Large planetary embryo',
    composition: {
      Si: { min: 0.55, max: 0.65 },
      O: { min: 0.35, max: 0.45 },
      Fe: { min: 0.05, max: 0.10 },
      Mg: { min: 0.02, max: 0.07 },
      Al: { min: 0.01, max: 0.03 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.005 },
      C: { min: 0.0005, max: 0.005 },
    },
  },
  'puffy_planet': {
    category: 'gas_giant',
    description: 'Low-density gas giant',
    composition: {
      H: { min: 0.9, max: 0.98 },
      He: { min: 0.02, max: 0.1 },
      C: { min: 0.002, max: 0.01 },
      N: { min: 0.001, max: 0.005 },
      O: { min: 0.0005, max: 0.003 },
      Ne: { min: 0.0001, max: 0.001 },
      Ar: { min: 0.00005, max: 0.0005 },
    },
  },
  'radon_planet': {
    category: 'gas_giant',
    description: 'Planet with radon-dominated atmosphere',
    composition: {
      Rn: { min: 0.85, max: 0.95 },
      Xe: { min: 0.05, max: 0.15 },
      Kr: { min: 0.01, max: 0.05 },
      Ar: { min: 0.001, max: 0.01 },
      He: { min: 0.0005, max: 0.003 },
      Ne: { min: 0.0001, max: 0.001 },
      Po: { min: 0.00001, max: 0.0001 },
    },
  },
  'ringed_planet': {
    category: 'gas_giant',
    description: 'Planet with prominent ring system',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.1, max: 0.2 },
      C: { min: 0.03, max: 0.07 },
      N: { min: 0.01, max: 0.04 },
      O: { min: 0.005, max: 0.02 },
      Si: { min: 0.001, max: 0.01 },
      Fe: { min: 0.001, max: 0.005 },
      S: { min: 0.0005, max: 0.002 },
      P: { min: 0.0001, max: 0.001 },
    },
  },
  'rogue_planet': {
    category: 'gas_giant',
    description: 'Planet not orbiting any star',
    composition: {
      H: { min: 0.65, max: 0.75 },
      He: { min: 0.15, max: 0.25 },
      O: { min: 0.05, max: 0.15 },
      C: { min: 0.01, max: 0.05 },
      N: { min: 0.005, max: 0.02 },
      Ne: { min: 0.001, max: 0.01 },
      Ar: { min: 0.0005, max: 0.003 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'silicate_clouds_gas_giant': {
    category: 'gas_giant',
    description: 'Gas giant with silicate clouds',
    composition: {
      H: { min: 0.65, max: 0.75 },
      He: { min: 0.15, max: 0.25 },
      Si: { min: 0.05, max: 0.15 },
      O: { min: 0.02, max: 0.08 },
      Mg: { min: 0.005, max: 0.02 },
      Fe: { min: 0.001, max: 0.01 },
      Al: { min: 0.001, max: 0.01 },
      Ca: { min: 0.0005, max: 0.003 },
      Na: { min: 0.0001, max: 0.001 },
    },
  },
  'silicate_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with silicate-rich composition',
    composition: {
      Si: { min: 0.85, max: 0.95 },
      O: { min: 0.05, max: 0.15 },
      Al: { min: 0.02, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Fe: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      Na: { min: 0.0005, max: 0.005 },
      K: { min: 0.0001, max: 0.001 },
      Ti: { min: 0.0001, max: 0.001 },
    },
  },
  'silicon_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with silicon-rich composition',
    composition: {
      Si: { min: 0.75, max: 0.85 },
      O: { min: 0.15, max: 0.25 },
      Fe: { min: 0.02, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Al: { min: 0.005, max: 0.03 },
      Ca: { min: 0.001, max: 0.01 },
      Na: { min: 0.0005, max: 0.005 },
      K: { min: 0.0001, max: 0.001 },
      C: { min: 0.0001, max: 0.001 },
    },
  },
  'sub_brown_dwarf': {
    category: 'brown_dwarf',
    description: 'Object between giant planet and brown dwarf',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.15, max: 0.25 },
      Li: { min: 0.001, max: 0.01 },
      D: { min: 0.0005, max: 0.005 },
      C: { min: 0.001, max: 0.01 },
      N: { min: 0.0005, max: 0.005 },
      O: { min: 0.0005, max: 0.005 },
      Ne: { min: 0.0001, max: 0.001 },
    },
  },
  'sub_earth': {
    category: 'terrestrial_planet',
    description: 'Planet smaller than Earth',
    composition: {
      Si: { min: 0.40, max: 0.50 },
      O: { min: 0.35, max: 0.45 },
      Fe: { min: 0.05, max: 0.15 },
      Mg: { min: 0.02, max: 0.07 },
      Al: { min: 0.01, max: 0.03 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.005 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'sub_neptune': {
    category: 'ice_giant',
    description: 'Planet between Earth and Neptune in size',
    composition: {
      H: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.05, max: 0.15 },
      N: { min: 0.02, max: 0.06 },
      He: { min: 0.01, max: 0.03 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.003 },
      Si: { min: 0.0001, max: 0.001 },
    },
  },
  'subsurface_ocean_planet': {
    category: 'ice_giant',
    description: 'Planet with ocean beneath ice layer',
    composition: {
      H: { min: 0.45, max: 0.55 },
      O: { min: 0.35, max: 0.45 },
      C: { min: 0.03, max: 0.08 },
      N: { min: 0.01, max: 0.05 },
      Si: { min: 0.005, max: 0.02 },
      Na: { min: 0.002, max: 0.01 },
      Cl: { min: 0.002, max: 0.01 },
      Fe: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
      K: { min: 0.0001, max: 0.001 },
    },
  },
  'sulfur_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with sulfur-rich composition',
    composition: {
      S: { min: 0.55, max: 0.65 },
      Si: { min: 0.25, max: 0.35 },
      O: { min: 0.05, max: 0.15 },
      Fe: { min: 0.02, max: 0.07 },
      Mg: { min: 0.01, max: 0.05 },
      Al: { min: 0.001, max: 0.01 },
      Ca: { min: 0.001, max: 0.01 },
      Na: { min: 0.0005, max: 0.005 },
      C: { min: 0.0001, max: 0.001 },
    },
  },
  'super_earth': {
    category: 'terrestrial_planet',
    description: 'Planet larger than Earth but smaller than Neptune',
    composition: {
      O: { min: 0.40, max: 0.50 },
      Si: { min: 0.25, max: 0.35 },
      Fe: { min: 0.10, max: 0.20 },
      Mg: { min: 0.05, max: 0.10 },
      Ca: { min: 0.01, max: 0.04 },
      Al: { min: 0.01, max: 0.04 },
      Ni: { min: 0.005, max: 0.02 },
      Na: { min: 0.002, max: 0.01 },
      K: { min: 0.001, max: 0.005 },
      S: { min: 0.0005, max: 0.003 },
      H: { min: 0.0001, max: 0.001 },
      C: { min: 0.0001, max: 0.001 },
    },
  },
  'super_jupiter': {
    category: 'gas_giant',
    description: 'Very large gas giant',
    composition: {
      H: { min: 0.85, max: 0.95 },
      He: { min: 0.05, max: 0.15 },
      C: { min: 0.005, max: 0.03 },
      N: { min: 0.001, max: 0.01 },
      O: { min: 0.001, max: 0.01 },
      Ne: { min: 0.0005, max: 0.003 },
      Ar: { min: 0.0001, max: 0.001 },
      S: { min: 0.0001, max: 0.001 },
    },
  },
  'super_neptune': {
    category: 'ice_giant',
    description: 'Very large ice giant',
    composition: {
      H: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.03, max: 0.07 },
      N: { min: 0.01, max: 0.05 },
      He: { min: 0.01, max: 0.04 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.005 },
      Si: { min: 0.0001, max: 0.001 },
      Fe: { min: 0.0001, max: 0.001 },
    },
  },
  'super_puff_planet': {
    category: 'gas_giant',
    description: 'Extremely low-density gas giant',
    composition: {
      H: { min: 0.95, max: 0.99 },
      He: { min: 0.01, max: 0.05 },
      C: { min: 0.001, max: 0.005 },
      N: { min: 0.0005, max: 0.003 },
      O: { min: 0.0001, max: 0.001 },
      Ne: { min: 0.00005, max: 0.0005 },
    },
  },
  'superhabitable_planet': {
    category: 'terrestrial_planet',
    description: 'Planet more suitable for life than Earth',
    composition: {
      O: { min: 0.45, max: 0.55 },
      Si: { min: 0.20, max: 0.28 },
      C: { min: 0.08, max: 0.15 },
      H: { min: 0.05, max: 0.10 },
      N: { min: 0.03, max: 0.08 },
      Fe: { min: 0.03, max: 0.08 },
      Mg: { min: 0.02, max: 0.05 },
      Ca: { min: 0.01, max: 0.03 },
      P: { min: 0.005, max: 0.015 },
      S: { min: 0.005, max: 0.015 },
      K: { min: 0.001, max: 0.01 },
      Na: { min: 0.001, max: 0.01 },
    },
  },
  'supermassive_terrestrial_planet': {
    category: 'terrestrial_planet',
    description: 'Very large terrestrial planet',
    composition: {
      Si: { min: 0.85, max: 0.95 },
      O: { min: 0.05, max: 0.15 },
      Fe: { min: 0.03, max: 0.08 },
      Mg: { min: 0.01, max: 0.05 },
      Al: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      Na: { min: 0.0005, max: 0.005 },
      K: { min: 0.0001, max: 0.001 },
      Ni: { min: 0.001, max: 0.01 },
    },
  },
  'swamp_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with extensive wetlands',
    composition: {
      H: { min: 0.40, max: 0.48 },
      O: { min: 0.35, max: 0.45 },
      C: { min: 0.15, max: 0.25 },
      N: { min: 0.05, max: 0.10 },
      Si: { min: 0.02, max: 0.07 },
      S: { min: 0.01, max: 0.03 },
      P: { min: 0.005, max: 0.015 },
      Fe: { min: 0.001, max: 0.01 },
      Ca: { min: 0.001, max: 0.01 },
      Mg: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.003 },
    },
  },
  'terrestrial_planet': {
    category: 'terrestrial_planet',
    description: 'Rocky planet similar to Earth',
    composition: {
      O: { min: 0.45, max: 0.52 },
      Si: { min: 0.25, max: 0.35 },
      Fe: { min: 0.05, max: 0.15 },
      Mg: { min: 0.03, max: 0.08 },
      Ca: { min: 0.01, max: 0.04 },
      Al: { min: 0.01, max: 0.04 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.0005, max: 0.005 },
      Ti: { min: 0.0001, max: 0.001 },
      H: { min: 0.0001, max: 0.001 },
    },
  },
  'titanium_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with titanium-rich composition',
    composition: {
      Ti: { min: 0.65, max: 0.75 },
      O: { min: 0.25, max: 0.35 },
      Fe: { min: 0.03, max: 0.08 },
      Si: { min: 0.01, max: 0.05 },
      Al: { min: 0.01, max: 0.05 },
      Mg: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      V: { min: 0.001, max: 0.01 },
      Cr: { min: 0.0005, max: 0.005 },
    },
  },
  'toroidal_planet': {
    category: 'gas_giant',
    description: 'Planet with donut shape',
    composition: {
      H: { min: 0.65, max: 0.75 },
      He: { min: 0.15, max: 0.25 },
      Si: { min: 0.05, max: 0.15 },
      O: { min: 0.01, max: 0.05 },
      Fe: { min: 0.005, max: 0.02 },
      C: { min: 0.001, max: 0.01 },
      N: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.005 },
    },
  },
  'ultra_cool_dwarf': {
    category: 'brown_dwarf',
    description: 'Very cool star or brown dwarf',
    composition: {
      H: { min: 0.75, max: 0.85 },
      He: { min: 0.15, max: 0.25 },
      Li: { min: 0.005, max: 0.02 },
      D: { min: 0.001, max: 0.01 },
      C: { min: 0.001, max: 0.005 },
      O: { min: 0.0005, max: 0.003 },
      N: { min: 0.0005, max: 0.003 },
      Ne: { min: 0.0001, max: 0.001 },
    },
  },
  'ultra_hot_jupiter': {
    category: 'gas_giant',
    description: 'Extremely hot gas giant',
    composition: {
      H: { min: 0.8, max: 0.9 },
      He: { min: 0.05, max: 0.15 },
      Na: { min: 0.03, max: 0.07 },
      K: { min: 0.01, max: 0.04 },
      C: { min: 0.005, max: 0.03 },
      O: { min: 0.001, max: 0.01 },
      Si: { min: 0.001, max: 0.005 },
      Fe: { min: 0.0005, max: 0.003 },
      Mg: { min: 0.0001, max: 0.001 },
    },
  },
  'ultra_hot_neptune': {
    category: 'ice_giant',
    description: 'Extremely hot ice giant',
    composition: {
      H: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      C: { min: 0.05, max: 0.15 },
      N: { min: 0.03, max: 0.08 },
      He: { min: 0.01, max: 0.05 },
      Na: { min: 0.005, max: 0.02 },
      K: { min: 0.001, max: 0.01 },
      Si: { min: 0.001, max: 0.005 },
      Fe: { min: 0.0005, max: 0.003 },
    },
  },
  'ultra_short_period_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with very short orbital period',
    composition: {
      Si: { min: 0.85, max: 0.95 },
      O: { min: 0.05, max: 0.15 },
      Fe: { min: 0.03, max: 0.10 },
      Mg: { min: 0.01, max: 0.05 },
      Al: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      Ni: { min: 0.001, max: 0.01 },
      Cr: { min: 0.0005, max: 0.003 },
      Mn: { min: 0.0001, max: 0.001 },
    },
  },
  'uranium_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with uranium-rich composition',
    composition: {
      U: { min: 0.55, max: 0.65 },
      Th: { min: 0.25, max: 0.35 },
      Pu: { min: 0.05, max: 0.15 },
      O: { min: 0.01, max: 0.05 },
      Si: { min: 0.005, max: 0.03 },
      Fe: { min: 0.001, max: 0.01 },
      Pb: { min: 0.001, max: 0.01 },
      Rn: { min: 0.0005, max: 0.003 },
      Ra: { min: 0.0001, max: 0.001 },
    },
  },
  'water_clouds_gas_giant': {
    category: 'gas_giant',
    description: 'Gas giant with water clouds',
    composition: {
      H: { min: 0.65, max: 0.75 },
      He: { min: 0.15, max: 0.25 },
      O: { min: 0.05, max: 0.15 },
      C: { min: 0.01, max: 0.05 },
      N: { min: 0.005, max: 0.02 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.003 },
      Ar: { min: 0.0001, max: 0.001 },
    },
  },
  'xenon_planet': {
    category: 'gas_giant',
    description: 'Planet with xenon-dominated atmosphere',
    composition: {
      Xe: { min: 0.85, max: 0.95 },
      Kr: { min: 0.05, max: 0.15 },
      Ar: { min: 0.01, max: 0.05 },
      Ne: { min: 0.001, max: 0.01 },
      He: { min: 0.0005, max: 0.005 },
      Rn: { min: 0.0001, max: 0.001 },
    },
  },
  'zinc_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with zinc-rich composition',
    composition: {
      Zn: { min: 0.65, max: 0.75 },
      S: { min: 0.25, max: 0.35 },
      O: { min: 0.03, max: 0.08 },
      Si: { min: 0.01, max: 0.05 },
      Fe: { min: 0.005, max: 0.02 },
      Cu: { min: 0.001, max: 0.01 },
      Cd: { min: 0.001, max: 0.01 },
      Pb: { min: 0.0005, max: 0.003 },
      Ag: { min: 0.0001, max: 0.001 },
    },
  },
  'argon_planet': {
    category: 'gas_giant',
    description: 'Planet with argon-dominated atmosphere',
    composition: {
      Ar: { min: 0.80, max: 0.90 },
      Ne: { min: 0.05, max: 0.12 },
      Kr: { min: 0.02, max: 0.06 },
      Xe: { min: 0.005, max: 0.02 },
      He: { min: 0.002, max: 0.01 },
      H: { min: 0.001, max: 0.005 },
      O: { min: 0.0001, max: 0.001 },
      N: { min: 0.0001, max: 0.001 },
    },
  },
  'boron_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with boron-rich composition',
    composition: {
      B: { min: 0.60, max: 0.70 },
      O: { min: 0.20, max: 0.30 },
      Si: { min: 0.05, max: 0.10 },
      Al: { min: 0.02, max: 0.06 },
      Mg: { min: 0.01, max: 0.03 },
      Fe: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      Ca: { min: 0.001, max: 0.01 },
      H: { min: 0.0005, max: 0.002 },
    },
  },
  'metallic_hydrogen_planet': {
    category: 'gas_giant',
    description: 'Gas giant with metallic hydrogen core due to extreme pressure',
    composition: {
      H: { min: 0.92, max: 0.96 },
      He: { min: 0.03, max: 0.07 },
      Ne: { min: 0.001, max: 0.005 },
      C: { min: 0.001, max: 0.003 },
      N: { min: 0.0005, max: 0.002 },
      O: { min: 0.0003, max: 0.001 },
      Ar: { min: 0.0001, max: 0.0005 },
      Fe: { min: 0.00005, max: 0.0002 },
    },
  },
  'trojan_planet': {
    category: 'terrestrial_planet',
    description: 'Planet sharing the same orbit as another larger planet at stable Lagrange points',
    composition: {
      Si: { min: 0.55, max: 0.65 },
      O: { min: 0.25, max: 0.35 },
      Fe: { min: 0.05, max: 0.10 },
      Mg: { min: 0.03, max: 0.08 },
      Al: { min: 0.01, max: 0.04 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.001, max: 0.01 },
      K: { min: 0.001, max: 0.01 },
      Ni: { min: 0.0005, max: 0.005 },
      S: { min: 0.0005, max: 0.003 },
    },
  },
  'lithium_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with lithium-rich composition',
    composition: {
      Li: { min: 0.60, max: 0.70 },
      O: { min: 0.20, max: 0.30 },
      Si: { min: 0.05, max: 0.10 },
      Al: { min: 0.01, max: 0.05 },
      Fe: { min: 0.005, max: 0.02 },
      Na: { min: 0.002, max: 0.01 },
      K: { min: 0.001, max: 0.005 },
      H: { min: 0.0005, max: 0.002 },
      B: { min: 0.0001, max: 0.001 },
    },
  },
  'retrograde_planet': {
    category: 'gas_giant',
    description: 'Planet that orbits in the opposite direction to the rotation of its star',
    composition: {
      H: { min: 0.70, max: 0.80 },
      He: { min: 0.15, max: 0.25 },
      C: { min: 0.02, max: 0.06 },
      N: { min: 0.01, max: 0.04 },
      O: { min: 0.005, max: 0.02 },
      S: { min: 0.001, max: 0.01 },
      Ne: { min: 0.001, max: 0.005 },
      Ar: { min: 0.0005, max: 0.002 },
      Si: { min: 0.0001, max: 0.001 },
    },
  },
  'binary_planet': {
    category: 'terrestrial_planet',
    description: 'Two planets orbiting each other as they orbit their star',
    composition: {
      Si: { min: 0.50, max: 0.60 },
      O: { min: 0.30, max: 0.40 },
      Fe: { min: 0.07, max: 0.15 },
      Mg: { min: 0.03, max: 0.08 },
      Al: { min: 0.01, max: 0.04 },
      Ca: { min: 0.005, max: 0.02 },
      Na: { min: 0.002, max: 0.01 },
      K: { min: 0.001, max: 0.005 },
      Ni: { min: 0.001, max: 0.01 },
      S: { min: 0.0005, max: 0.003 },
    },
  },
  'plutoid_planet': {
    category: 'dwarf_planet',
    description: 'Pluto-like trans-Neptunian dwarf planet',
    composition: {
      N: { min: 0.30, max: 0.40 },
      C: { min: 0.25, max: 0.35 },
      H: { min: 0.20, max: 0.30 },
      O: { min: 0.05, max: 0.15 },
      Fe: { min: 0.01, max: 0.05 },
      Si: { min: 0.01, max: 0.03 },
      Mg: { min: 0.005, max: 0.02 },
      S: { min: 0.001, max: 0.01 },
      P: { min: 0.0005, max: 0.002 },
    },
  },
  'tidally_heated_planet': {
    category: 'terrestrial_planet',
    description: 'Planet heated by tidal flexing due to gravitational interactions',
    composition: {
      Si: { min: 0.45, max: 0.55 },
      O: { min: 0.35, max: 0.45 },
      Fe: { min: 0.05, max: 0.15 },
      S: { min: 0.03, max: 0.08 },
      Mg: { min: 0.02, max: 0.06 },
      Na: { min: 0.01, max: 0.03 },
      K: { min: 0.005, max: 0.02 },
      Al: { min: 0.005, max: 0.02 },
      Ca: { min: 0.001, max: 0.01 },
      C: { min: 0.001, max: 0.01 },
    },
  },
  'magnetic_planet': {
    category: 'terrestrial_planet',
    description: 'Planet with an extremely strong magnetic field',
    composition: {
      Fe: { min: 0.60, max: 0.70 },
      Ni: { min: 0.15, max: 0.25 },
      Si: { min: 0.05, max: 0.15 },
      O: { min: 0.05, max: 0.10 },
      Co: { min: 0.01, max: 0.05 },
      Mg: { min: 0.005, max: 0.02 },
      S: { min: 0.003, max: 0.01 },
      Al: { min: 0.001, max: 0.01 },
      Cr: { min: 0.001, max: 0.005 },
      Mn: { min: 0.0005, max: 0.002 },
    },
  },
  'silicon_carbide_planet': {
    category: 'terrestrial_planet',
    description: 'Planet formed primarily of silicon carbide',
    composition: {
      Si: { min: 0.45, max: 0.55 },
      C: { min: 0.30, max: 0.40 },
      Fe: { min: 0.05, max: 0.15 },
      Al: { min: 0.02, max: 0.06 },
      Mg: { min: 0.01, max: 0.05 },
      O: { min: 0.005, max: 0.02 },
      Ti: { min: 0.001, max: 0.01 },
      N: { min: 0.001, max: 0.005 },
      S: { min: 0.0005, max: 0.002 },
    },
  },
  'city_planet': {
    category: 'artificial_planet',
    description: 'Planet-wide cityscape (ecumenopolis), entirely artificial surface and mega-structures.',
    composition: {
      Fe: { min: 0.25, max: 0.40 },  // Steel structures, ferroconcrete
      Si: { min: 0.15, max: 0.25 },  // Concrete, glass, electronics
      O: { min: 0.10, max: 0.20 },   // Oxides in concrete, glass, part of polymers, atmosphere
      Al: { min: 0.05, max: 0.15 },  // Aluminum alloys, structural components
      C: { min: 0.05, max: 0.15 },   // Steel, plastics, carbon fiber, organics
      Ca: { min: 0.03, max: 0.08 },  // Concrete (major component)
      H: { min: 0.01, max: 0.05 },   // Plastics, polymers, organic matter, water systems
      N: { min: 0.01, max: 0.03 },   // Atmosphere, plastics, organics
      Cu: { min: 0.005, max: 0.02 }, // Wiring, plumbing
      Ti: { min: 0.005, max: 0.02 }, // High-strength alloys
      // Other elements in smaller quantities: Na (glass), K (various), Cr, Mn (steel alloys), Zn (galvanizing), Pb, etc.
      // Cl: { min: 0.001, max: 0.005 }, // PVC plastics
      // Au: { min: 0.00001, max: 0.0001 } // Electronics (trace but widespread by function)
    },
  },
  'gas_giant_generic': {
    category: 'gas_giant',
    description: 'Typical gas giant, like Jupiter or Saturn.',
    composition: {
      H: { min: 0.70, max: 0.80 },    // Molecular Hydrogen
      He: { min: 0.18, max: 0.28 },    // Helium
      C: { min: 0.001, max: 0.005 },   // From Methane (CH4)
      N: { min: 0.0005, max: 0.002 },  // From Ammonia (NH3)
      O: { min: 0.001, max: 0.005 },   // From Water (H2O) ice/vapor
      S: { min: 0.0001, max: 0.0005 },  // From Hydrogen Sulfide (H2S) or other sulfur compounds
      P: { min: 0.00001, max: 0.0001 }, // From Phosphine (PH3)
      Ar: { min: 0.00005, max: 0.0002 },// Argon (noble gas)
      Ne: { min: 0.00001, max: 0.0001 },// Neon (noble gas)
      // Core components (significant but variable fraction of total mass)
      // Si: { min: 0.001, max: 0.01 }, // Silicates in core
      // Fe: { min: 0.001, max: 0.01 }, // Iron in core
      // Mg: { min: 0.001, max: 0.01 }  // Magnesium in core silicates
    },
  },
  'gas_giant_silicate_clouds': {
    category: 'gas_giant',
    description: 'Hot gas giant with silicate (rock) clouds, Sudarsky Class V.',
    composition: {
      H: { min: 0.65, max: 0.75 },    // Molecular Hydrogen
      He: { min: 0.20, max: 0.30 },    // Helium
      Si: { min: 0.005, max: 0.02 },   // Silicate clouds (e.g., enstatite, forsterite)
      O: { min: 0.01, max: 0.04 },    // In silicate clouds, CO, trace H2O deeper
      Fe: { min: 0.002, max: 0.01 },   // Iron clouds (condensed Fe)
      Mg: { min: 0.003, max: 0.015 },  // In silicate clouds (e.g., forsterite, enstatite)
      C: { min: 0.001, max: 0.005 },   // Primarily as Carbon Monoxide (CO)
      Na: { min: 0.0001, max: 0.0005 }, // Sodium vapor (alkali metal)
      K: { min: 0.00005, max: 0.0002 },// Potassium vapor (alkali metal)
      Al: { min: 0.0005, max: 0.002 }, // Aluminum in refractory condensates (e.g., Al2O3)
      Ca: { min: 0.0005, max: 0.002 }, // Calcium in refractory condensates (e.g., CaTiO3)
      Ti: { min: 0.00001, max: 0.0001}// Titanium in refractory condensates (e.g., TiO, CaTiO3)
      // Other trace elements deeper down or in core
    },
  },
  'gas_giant_water_clouds': {
    category: 'gas_giant',
    description: 'Cooler gas giant with water clouds, Sudarsky Class II.',
    composition: {
      H: { min: 0.70, max: 0.80 },    // Molecular Hydrogen
      He: { min: 0.18, max: 0.28 },    // Helium
      O: { min: 0.005, max: 0.02 },   // From Water (H2O) clouds and vapor
      C: { min: 0.001, max: 0.005 },   // From Methane (CH4)
      N: { min: 0.0002, max: 0.001 },  // From Ammonia (NH3), less than Class I
      S: { min: 0.0001, max: 0.0005 },  // Trace sulfur compounds
      P: { min: 0.00001, max: 0.0001 }, // Trace phosphorus compounds
      Ne: { min: 0.00005, max: 0.0002 }, // Neon
      Ar: { min: 0.00005, max: 0.0002 }  // Argon
      // Potentially trace amounts of other condensates deeper or in core
      // Si: { min: 0.0005, max: 0.002 }, // Silicates in core
      // Fe: { min: 0.0005, max: 0.002 }  // Iron in core
    },
  },
};
