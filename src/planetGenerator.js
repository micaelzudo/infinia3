import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';

// Import our shader code
import noiseShader from './shaders/modules/noise.glsl?raw';
import mathShader from './shaders/modules/math.glsl?raw';
import planetTerrainShader from './shaders/modules/planetTerrainGenerator.glsl?raw';

// Define terrain types enum
export const PlanetTerrainType = {
  DEFAULT: 0,
  MOUNTAINOUS: 1,
  CAVERNOUS: 2,
  FLOATING: 3,
  CRYSTALLINE: 4,
  DESERT: 5,
  OCEANIC: 6,
  VOLCANIC: 7,
  ALIEN: 8
};

// Default terrain configurations for each planet type
export const DEFAULT_TERRAIN_CONFIGS = {
  [PlanetTerrainType.DEFAULT]: {
    baseFrequency: 1.0,
    amplitude: 1.0,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    warpStrength: 0.0,
    ridgeThreshold: 0.5,
    seaLevel: 0.0,
    gravity: 1.0,
    erosion: 0.0,
    cratersAmount: 0.0,
    crystalAmount: 0.0,
    sandAmount: 0.0,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.MOUNTAINOUS]: {
    baseFrequency: 1.2,
    amplitude: 1.4,
    octaves: 6,
    persistence: 0.6,
    lacunarity: 2.5,
    warpStrength: 0.2,
    ridgeThreshold: 0.7,
    seaLevel: 0.0,
    gravity: 1.2,
    erosion: 0.3,
    cratersAmount: 0.1,
    crystalAmount: 0.0,
    sandAmount: 0.0,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.CAVERNOUS]: {
    baseFrequency: 0.8,
    amplitude: 1.2,
    octaves: 5,
    persistence: 0.55,
    lacunarity: 2.2,
    warpStrength: 0.3,
    ridgeThreshold: 0.4,
    seaLevel: 0.0,
    gravity: 0.8,
    erosion: 0.1,
    cratersAmount: 0.2,
    crystalAmount: 0.0,
    sandAmount: 0.0,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.FLOATING]: {
    baseFrequency: 1.5,
    amplitude: 1.6,
    octaves: 4,
    persistence: 0.45,
    lacunarity: 2.3,
    warpStrength: 0.7,
    ridgeThreshold: 0.6,
    seaLevel: 0.0,
    gravity: 0.4,
    erosion: 0.0,
    cratersAmount: 0.0,
    crystalAmount: 0.2,
    sandAmount: 0.0,
    lavaLevel: 0.0,
    alienFactor: 0.1
  },
  [PlanetTerrainType.CRYSTALLINE]: {
    baseFrequency: 1.3,
    amplitude: 1.1,
    octaves: 3,
    persistence: 0.4,
    lacunarity: 2.1,
    warpStrength: 0.1,
    ridgeThreshold: 0.8,
    seaLevel: 0.0,
    gravity: 1.0,
    erosion: 0.0,
    cratersAmount: 0.0,
    crystalAmount: 0.8,
    sandAmount: 0.0,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.DESERT]: {
    baseFrequency: 0.9,
    amplitude: 0.8,
    octaves: 4,
    persistence: 0.35,
    lacunarity: 1.8,
    warpStrength: 0.2,
    ridgeThreshold: 0.3,
    seaLevel: 0.0,
    gravity: 0.9,
    erosion: 0.5,
    cratersAmount: 0.3,
    crystalAmount: 0.0,
    sandAmount: 0.9,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.OCEANIC]: {
    baseFrequency: 0.7,
    amplitude: 0.9,
    octaves: 5,
    persistence: 0.45,
    lacunarity: 1.9,
    warpStrength: 0.1,
    ridgeThreshold: 0.4,
    seaLevel: 0.6,
    gravity: 1.1,
    erosion: 0.4,
    cratersAmount: 0.0,
    crystalAmount: 0.0,
    sandAmount: 0.2,
    lavaLevel: 0.0,
    alienFactor: 0.0
  },
  [PlanetTerrainType.VOLCANIC]: {
    baseFrequency: 1.1,
    amplitude: 1.3,
    octaves: 5,
    persistence: 0.5,
    lacunarity: 2.4,
    warpStrength: 0.3,
    ridgeThreshold: 0.6,
    seaLevel: 0.0,
    gravity: 1.3,
    erosion: 0.2,
    cratersAmount: 0.4,
    crystalAmount: 0.1,
    sandAmount: 0.0,
    lavaLevel: 0.5,
    alienFactor: 0.0
  },
  [PlanetTerrainType.ALIEN]: {
    baseFrequency: 1.4,
    amplitude: 1.5,
    octaves: 6,
    persistence: 0.65,
    lacunarity: 2.6,
    warpStrength: 0.8,
    ridgeThreshold: 0.5,
    seaLevel: 0.3,
    gravity: 0.7,
    erosion: 0.1,
    cratersAmount: 0.2,
    crystalAmount: 0.3,
    sandAmount: 0.1,
    lavaLevel: 0.2,
    alienFactor: 0.9
  }
};

// Planet Generator class
export class PlanetGenerator {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      resolution: 64,
      size: 50,
      planetType: PlanetTerrainType.DEFAULT
    }, options);
    
    // Set up current terrain config using defaults for the selected planet type
    this.terrainConfig = { ...DEFAULT_TERRAIN_CONFIGS[this.options.planetType] };
    
    // Set up scene, camera, and renderer
    this.setupScene();
    
    // Generate initial planet
    this.generatePlanet();
    
    // Start rendering
    this.animate();
  }
  
  // Set up Three.js scene, camera, and renderer
  setupScene() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);
    
    // Add fog for depth effect
    this.scene.fog = new THREE.FogExp2(0x050510, 0.002);
    
    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 0, this.options.size * 3);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Set up orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    
    // Add lights
    this.addLights();
    
    // Add stars
    this.addStars();
  }
  
  // Add lights to the scene
  addLights() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    this.scene.add(ambientLight);
    
    // Main directional light (sun)
    this.mainLight = new THREE.DirectionalLight(0xffffff, 2);
    this.mainLight.position.set(10, 10, 10);
    this.mainLight.castShadow = true;
    this.scene.add(this.mainLight);
    
    // Secondary light for rim lighting
    const rimLight = new THREE.DirectionalLight(0x2040ff, 0.5);
    rimLight.position.set(-10, -10, -10);
    this.scene.add(rimLight);
  }
  
  // Add stars to the background
  addStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false
    });
    
    const starsVertices = [];
    for (let i = 0; i < 5000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    
    this.stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(this.stars);
  }
  
  // Generate planet using marching cubes
  generatePlanet() {
    // Clean up previous planet if it exists
    if (this.planet) {
      this.scene.remove(this.planet);
      this.planet.geometry.dispose();
      this.planet.material.dispose();
    }
    
    // Create marching cubes instance
    this.planet = new MarchingCubes(
      this.options.resolution, 
      new THREE.MeshStandardMaterial({
        color: this.getPlanetColor(),
        flatShading: false,
        metalness: 0.0,
        roughness: 0.8
      }),
      false, // Enable wireframe?
      true // Use smooth normals?
    );
    
    // Set size
    this.planet.scale.set(this.options.size, this.options.size, this.options.size);
    
    // Generate the terrain
    this.updatePlanetTerrain();
    
    // Add to scene
    this.scene.add(this.planet);
  }
  
  // Get planet color based on terrain type
  getPlanetColor() {
    const colors = {
      [PlanetTerrainType.DEFAULT]: 0x44aa44,
      [PlanetTerrainType.MOUNTAINOUS]: 0x556677,
      [PlanetTerrainType.CAVERNOUS]: 0x7b4a12,
      [PlanetTerrainType.FLOATING]: 0x6688ff,
      [PlanetTerrainType.CRYSTALLINE]: 0x88bbff,
      [PlanetTerrainType.DESERT]: 0xddbb77,
      [PlanetTerrainType.OCEANIC]: 0x3399ff,
      [PlanetTerrainType.VOLCANIC]: 0x993322,
      [PlanetTerrainType.ALIEN]: 0x77ff99
    };
    
    return colors[this.options.planetType] || colors[PlanetTerrainType.DEFAULT];
  }
  
  // Update planet terrain based on configuration
  updatePlanetTerrain() {
    if (!this.planet) return;
    
    // Reset marching cubes data
    this.planet.reset();
    
    // Set parameters for different terrain types
    const config = this.terrainConfig;
    
    // Generate terrain based on type
    const planetType = this.options.planetType;
    
    // Generate planet surface
    const size = this.options.resolution;
    const center = size / 2;
    const radius = size * 0.4;
    
    // Loop through grid
    let tx, ty, tz, value, noiseValue, adjustedRadius;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        for (let k = 0; k < size; k++) {
          // Position relative to center (normalized to -1 to 1)
          tx = (i - center) / radius;
          ty = (j - center) / radius;
          tz = (k - center) / radius;
          
          // Distance from center (squared)
          const distSq = tx * tx + ty * ty + tz * tz;
          
          if (distSq > 4) continue; // Skip if too far from center
          
          // Generate noise value based on terrain type
          noiseValue = this.generateNoiseValue(tx, ty, tz, config);
          
          // Adjust radius based on noise and terrain type
          adjustedRadius = 1.0 + noiseValue * config.amplitude;
          
          // Sea level adjustment
          if (config.seaLevel > 0 && adjustedRadius < (1.0 + config.seaLevel * 0.3)) {
            adjustedRadius = 1.0 + config.seaLevel * 0.3;
          }
          
          // Calculate final value for marching cubes
          value = 1.0 - distSq / (adjustedRadius * adjustedRadius);
          
          // Apply erosion
          if (config.erosion > 0) {
            const erosionNoise = this.noise3D(tx * 10, ty * 10, tz * 10, 1) * config.erosion * 0.5;
            value -= erosionNoise;
          }
          
          // Add craters for certain terrain types
          if (config.cratersAmount > 0) {
            value -= this.generateCraters(tx, ty, tz, config.cratersAmount);
          }
          
          // Add crystals for crystalline terrain
          if (config.crystalAmount > 0) {
            value += this.generateCrystals(tx, ty, tz, config.crystalAmount);
          }
          
          // Add lava
          if (config.lavaLevel > 0) {
            const lavaEffect = this.noise3D(tx * 5, ty * 5, tz * 5, 1) * config.lavaLevel * 0.5;
            if (adjustedRadius < (1.0 + config.lavaLevel * 0.2)) {
              value += lavaEffect;
            }
          }
          
          // Add alien distortion
          if (config.alienFactor > 0) {
            const alienNoise = this.noise3D(tx * 8, ty * 8, tz * 8, 2) * config.alienFactor;
            value += (alienNoise - 0.5) * 0.3;
          }
          
          // Set voxel value
          if (value > 0) {
            this.planet.setVoxel(i, j, k, value);
          }
        }
      }
    }
    
    // Update planet geometry
    this.planet.update();
  }
  
  // Generate noise value based on terrain type
  generateNoiseValue(x, y, z, config) {
    let noiseValue = 0;
    
    // Base planetary noise
    switch (this.options.planetType) {
      case PlanetTerrainType.DEFAULT:
        // Simple perlin noise
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        break;
        
      case PlanetTerrainType.MOUNTAINOUS:
        // Ridge noise for mountains
        noiseValue = this.ridgeNoise(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity,
          config.ridgeThreshold
        );
        break;
        
      case PlanetTerrainType.CAVERNOUS:
        // Warped noise for caves
        const warpedCoords = this.warpedCoordinates(
          x, y, z, 
          config.warpStrength, 
          config.baseFrequency
        );
        
        noiseValue = this.noise3D(
          warpedCoords.x * config.baseFrequency, 
          warpedCoords.y * config.baseFrequency, 
          warpedCoords.z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        // Make interior more hollow
        if (Math.sqrt(x*x + y*y + z*z) < 0.7) {
          noiseValue -= (0.7 - Math.sqrt(x*x + y*y + z*z)) * 1.5;
        }
        break;
        
      case PlanetTerrainType.FLOATING:
        // Cellular noise for floating islands
        const cellNoise = this.cellularNoise(
          x * config.baseFrequency * 1.5, 
          y * config.baseFrequency * 1.5, 
          z * config.baseFrequency * 1.5
        );
        
        const baseNoise = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        noiseValue = baseNoise * 0.5 + cellNoise * 0.5;
        
        // Add gaps between islands
        noiseValue -= 0.2;
        break;
        
      case PlanetTerrainType.CRYSTALLINE:
        // Sharp noise transitions for crystals
        const crystalNoise = this.noise3D(
          x * config.baseFrequency * 2, 
          y * config.baseFrequency * 2, 
          z * config.baseFrequency * 2, 
          2, 
          0.5, 
          2.0
        );
        
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        // Make sharp transitions for crystal structures
        noiseValue = Math.pow(noiseValue, 2) * (1 + crystalNoise * config.crystalAmount);
        break;
        
      case PlanetTerrainType.DESERT:
        // Layered noise for dunes
        const duneNoise = this.noise3D(
          x * config.baseFrequency * 3, 
          y * config.baseFrequency * 3, 
          z * config.baseFrequency * 3, 
          1, 
          0.5, 
          2.0
        );
        
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        // Add erosion and dunes
        noiseValue = noiseValue * 0.7 + Math.abs(Math.sin(duneNoise * 5)) * 0.3 * config.sandAmount;
        break;
        
      case PlanetTerrainType.OCEANIC:
        // Gentle noise for oceans with islands
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        // Create more defined islands
        if (noiseValue > 0.5) {
          noiseValue = 0.5 + (noiseValue - 0.5) * 2;
        } else {
          noiseValue = noiseValue * 0.5;
        }
        break;
        
      case PlanetTerrainType.VOLCANIC:
        // Base noise
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        // Ridge noise for volcanic peaks
        const volcanicRidge = this.ridgeNoise(
          x * config.baseFrequency * 1.5, 
          y * config.baseFrequency * 1.5, 
          z * config.baseFrequency * 1.5, 
          2, 
          0.5, 
          2.0,
          0.7
        );
        
        // Combine noises
        noiseValue = noiseValue * 0.6 + volcanicRidge * 0.4;
        break;
        
      case PlanetTerrainType.ALIEN:
        // Warped coordinates for alien terrain
        const alienWarp = this.warpedCoordinates(
          x, y, z, 
          config.warpStrength * 2, 
          config.baseFrequency
        );
        
        // Multiple layers of noise
        const alienBase = this.noise3D(
          alienWarp.x * config.baseFrequency, 
          alienWarp.y * config.baseFrequency, 
          alienWarp.z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
        
        const alienDetail = this.noise3D(
          x * config.baseFrequency * 4, 
          y * config.baseFrequency * 4, 
          z * config.baseFrequency * 4, 
          2, 
          0.5, 
          2.0
        );
        
        noiseValue = alienBase * 0.7 + alienDetail * 0.3;
        
        // Apply distortion
        noiseValue = Math.sin(noiseValue * Math.PI * 2) * 0.5 + 0.5;
        break;
        
      default:
        // Default to simple perlin noise
        noiseValue = this.noise3D(
          x * config.baseFrequency, 
          y * config.baseFrequency, 
          z * config.baseFrequency, 
          config.octaves, 
          config.persistence, 
          config.lacunarity
        );
    }
    
    return noiseValue;
  }
  
  // Generate craters
  generateCraters(x, y, z, amount) {
    const craterAmount = amount * 2;
    let craterValue = 0;
    
    // Create multiple potential crater locations
    for (let i = 0; i < 5; i++) {
      // Create crater centers using noise to determine positions
      const craterX = Math.sin(i * 1.1) * 0.45;
      const craterY = Math.cos(i * 1.1) * 0.45;
      const craterZ = Math.sin(i * 2.3) * 0.45;
      
      // Distance from crater center
      const dx = x - craterX;
      const dy = y - craterY;
      const dz = z - craterZ;
      const craterDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Crater size varies
      const craterSize = 0.1 + this.noise3D(craterX, craterY, craterZ, 1) * 0.1;
      
      // Crater shape function
      if (craterDist < craterSize) {
        // Crater depth decreases from rim to center in a parabolic way
        const normalizedDist = craterDist / craterSize;
        const craterDepth = -Math.pow(normalizedDist - 1, 2) + 1; // Parabola: -(x-1)²+1
        craterValue += craterDepth * 0.2 * craterAmount;
      }
    }
    
    return craterValue;
  }
  
  // Generate crystal structures
  generateCrystals(x, y, z, amount) {
    const crystalAmount = amount * 1.5;
    let crystalValue = 0;
    
    // Create multiple potential crystal formations
    for (let i = 0; i < 8; i++) {
      // Crystal centers
      const angleOffset = i * 0.7853; // Distribute around sphere
      const heightOffset = (i % 3 - 1) * 0.4; // Distribute vertically
      const crystalX = Math.sin(angleOffset) * 0.8;
      const crystalY = heightOffset;
      const crystalZ = Math.cos(angleOffset) * 0.8;
      
      // Distance from crystal center
      const dx = x - crystalX;
      const dy = y - crystalY;
      const dz = z - crystalZ;
      const crystalDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Crystal size
      const crystalSize = 0.05 + this.noise3D(crystalX, crystalY, crystalZ, 1) * 0.05;
      
      // Crystal shape function - sharper than craters
      if (crystalDist < crystalSize) {
        // Crystal has sharp edges
        const normalizedDist = crystalDist / crystalSize;
        const crystalHeight = Math.pow(1 - normalizedDist, 1.5); // Sharper falloff
        crystalValue += crystalHeight * 0.15 * crystalAmount;
      }
    }
    
    return crystalValue;
  }
  
  // 3D Perlin noise function
  noise3D(x, y, z, octaves = 1, persistence = 0.5, lacunarity = 2.0) {
    // Simple simulation of 3D Perlin noise using 2D noise
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      // Use separate dimensions for better variation
      const nx = x * frequency;
      const ny = y * frequency;
      const nz = z * frequency;
      
      // Create variation by combining multiple dimensions
      const noiseVal = this.simpleNoise(nx, ny) * 0.5 + 
                       this.simpleNoise(ny, nz) * 0.3 + 
                       this.simpleNoise(nx, nz) * 0.2;
      
      total += noiseVal * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    
    // Return normalized result
    return total / maxValue;
  }
  
  // Simple 2D noise function
  simpleNoise(x, y) {
    // Simple 2D value noise approximation
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    
    // Interpolate between corner values
    const a = this.pseudoRandom(ix, iy);
    const b = this.pseudoRandom(ix + 1, iy);
    const c = this.pseudoRandom(ix, iy + 1);
    const d = this.pseudoRandom(ix + 1, iy + 1);
    
    // Smoothed coordinates for interpolation
    const ux = this.smootherStep(fx);
    const uy = this.smootherStep(fy);
    
    // Bilinear interpolation
    return this.mix(
      this.mix(a, b, ux),
      this.mix(c, d, ux),
      uy
    );
  }
  
  // Ridge noise function for mountains
  ridgeNoise(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0, threshold = 0.5) {
    let noise = this.noise3D(x, y, z, octaves, persistence, lacunarity);
    
    // Convert to ridge noise by folding the noise
    noise = Math.abs(noise - threshold) * 2;
    
    return noise;
  }
  
  // Cellular noise function for floating islands
  cellularNoise(x, y, z) {
    const cellCount = 10;
    let minDist = 1000;
    
    // Generate cellular noise by finding distance to closest "feature point"
    for (let i = 0; i < cellCount; i++) {
      // Pseudo-random feature point positions
      const px = this.pseudoRandom(i, 0) * 2 - 1;
      const py = this.pseudoRandom(i, 1) * 2 - 1;
      const pz = this.pseudoRandom(i, 2) * 2 - 1;
      
      // Distance to feature point
      const dx = x - px;
      const dy = y - py;
      const dz = z - pz;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      minDist = Math.min(minDist, dist);
    }
    
    // Normalize and invert
    return 1 - minDist;
  }
  
  // Warped coordinates for cavernous terrain
  warpedCoordinates(x, y, z, strength, frequency) {
    // Create warp vectors using noise
    const warpX = this.noise3D(x * frequency * 2, y * frequency * 2, z * frequency * 2, 2) * 2 - 1;
    const warpY = this.noise3D(x * frequency * 2 + 100, y * frequency * 2, z * frequency * 2, 2) * 2 - 1;
    const warpZ = this.noise3D(x * frequency * 2, y * frequency * 2 + 100, z * frequency * 2, 2) * 2 - 1;
    
    // Apply warp
    return {
      x: x + warpX * strength,
      y: y + warpY * strength,
      z: z + warpZ * strength
    };
  }
  
  // Mix/lerp function
  mix(a, b, t) {
    return a * (1 - t) + b * t;
  }
  
  // Improved smooth step function
  smootherStep(t) {
    // Smoother step: 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  // Pseudo-random function
  pseudoRandom(x, y) {
    // Simple pseudo-random function based on sine
    return (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
  }
  
  // Set planet terrain type
  setPlanetType(type) {
    if (type in PlanetTerrainType) {
      this.options.planetType = type;
      
      // Reset terrain config to defaults for this type
      this.terrainConfig = { ...DEFAULT_TERRAIN_CONFIGS[type] };
      
      // Update planet color and terrain
      if (this.planet) {
        this.planet.material.color.set(this.getPlanetColor());
        this.updatePlanetTerrain();
      }
    }
  }
  
  // Update terrain configuration
  updateTerrainConfig(config) {
    // Update current terrain config with new values
    this.terrainConfig = { ...this.terrainConfig, ...config };
    
    // Update planet terrain
    this.updatePlanetTerrain();
  }
  
  // Handle window resize
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  // Render loop
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Update controls
    if (this.controls) {
      this.controls.update();
    }
    
    // Rotate stars slowly
    if (this.stars) {
      this.stars.rotation.y += 0.0001;
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  // Clean up resources
  dispose() {
    // Stop animation
    cancelAnimationFrame(this.animationFrame);
    
    // Dispose of geometries and materials
    if (this.planet) {
      this.scene.remove(this.planet);
      this.planet.geometry.dispose();
      this.planet.material.dispose();
    }
    
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    
    // Dispose of renderer
    this.renderer.dispose();
    
    // Remove canvas from container
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
} 