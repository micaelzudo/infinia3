import * as THREE from "three";
// Import the GLSL module content as a raw string
import importedHyperspaceLanesGLSL from './shaders/modules/hyperspaceLanes.glsl?raw';
import holographicGlitchGLSL from './shaders/modules/holographicGlitch.glsl?raw'; // Import glitch shader
// Import Atlas Generator
import { createGlyphAtlasTexture } from './glyphAtlasGenerator';
// Add import for dimensional rift
import dimensionalRiftShader from './shaders/modules/dimensionalRift.glsl?raw';
// Import the new hyperspace smoke layer creator
import { createHyperspaceSmokeLayer } from './hyperspaceSmokeLayer.js';
// Import the new ethereal bloom transform module
import etherealBloomTransformGLSL from './shaders/modules/etherealBloomTransform.glsl?raw';

// --- Modify the imported GLSL String --- 
let hyperspaceLanesGLSL = importedHyperspaceLanesGLSL;
// 1. Fix border smoothstep range
hyperspaceLanesGLSL = hyperspaceLanesGLSL.replace(
    'smoothstep(40.0, 48.0, radius)',
    'smoothstep(90.0, 98.0, radius)' // Range for radius ~100
);
// 2. Modify applyHyperspaceEffects for better blending
hyperspaceLanesGLSL = hyperspaceLanesGLSL.replace(
    'vec3 applyHyperspaceEffects(vec3 baseColor, vec3 position, vec3 viewPosition, float time, float intensity)',
    `vec3 applyHyperspaceEffects(vec3 baseColor, vec3 position, vec3 viewPosition, float time, float intensity) {
          vec3 direction = normalize(vec3(0.0, 0.0, -1.0));

      // Define WRAP_DISTANCE_Z locally within this function for clarity
      const float WRAP_DISTANCE_Z_EFFECTS = 1000.0; // Use a distinct name if needed

      // --- Streaks - Multi-Layer Waviness ---
      // Ensure wavyPosition_s calculation uses wrapped Z for consistency
      vec3 wrappedPos_s = position;
      wrappedPos_s.z = mod(position.z, WRAP_DISTANCE_Z_EFFECTS);

      vec3 displacement_s1 = vec3(
          sin(wrappedPos_s.y * 0.5 + time * 1.5) * 20.0, 
          0.0,
          cos(wrappedPos_s.y * 0.3 + time * 1.1) * 20.0
      ) * intensity;
      vec3 displacement_s2 = vec3(
          cos(wrappedPos_s.z * 0.25 + time * 0.9) * 14.0, // Use wrapped Z
          sin(wrappedPos_s.x * 0.6 + time * 1.2) * 14.0, 
          0.0
      ) * intensity;
      vec3 totalDisplacement_s = displacement_s1 + displacement_s2;
      vec3 wavyPosition_s = wrappedPos_s + totalDisplacement_s; // Apply displacement to wrapped pos
      float streaks = hyperspaceStreaks(wavyPosition_s, viewPosition, direction, time, intensity);

      // --- Neon Streak Color Calculation (uses wrappedPos_s via modPosZ) ---
      float modTime1 = fract(time * 0.5);
      float modTime2 = fract(time * 0.1);
      float modPosZ = mod(position.z, WRAP_DISTANCE_Z_EFFECTS); // Use original position for consistency with particles?
      // Let's keep using original position.z for the direct hash inputs for now.
      // float modPosZ = wrappedPos_s.z; // Alternative - Test if needed
      vec3 hashInput_s = vec3(position.y * 0.5 + modTime1, modPosZ * 0.15, modTime2);
      vec3 waveColor_s = hash33(hashInput_s); 
      waveColor_s = clamp(vec3(0.1) + waveColor_s * 1.0, 0.0, 1.0); 
      
      // --- Calculate large-scale color wave (using wrapped Z) ---
      vec3 largeScaleCoord_s = wrappedPos_s * 0.008 + vec3(0.0, fract(time * 0.05), fract(time * 0.03));
      float largeWaveNoise_s = fbmValue3D(largeScaleCoord_s); 
      vec3 largeWaveColor_s = mix(vec3(1.0, 0.1, 0.6), vec3(0.1, 0.6, 1.0), smoothstep(0.3, 0.7, largeWaveNoise_s));
      
      // --- Calculate Rainbow Layer (using wrapped Z) --- 
      vec3 ultraScaleCoord_s = wrappedPos_s * 0.002 + vec3(fract(time * 0.015), fract(-time * 0.02), 0.0); 
      float ultraWaveNoise_s = fbmValue3D(ultraScaleCoord_s); 
      vec3 rainbowColor_s = mix(vec3(1.0, 0.1, 0.1), vec3(0.1, 1.0, 0.1), smoothstep(0.0, 0.5, ultraWaveNoise_s));
      rainbowColor_s = mix(rainbowColor_s, vec3(0.1, 0.1, 1.0), smoothstep(0.5, 1.0, ultraWaveNoise_s)); 
      largeWaveColor_s = mix(largeWaveColor_s, rainbowColor_s, 0.5); 
      
      // --- Calculate EXTRA PSYCHEDELIC LAYER (Streaks) (using wrapped Z) --- 
      vec3 extraCoord_s = wrappedPos_s * 0.05 + vec3(fract(time * 0.15), fract(time * 0.2), fract(time * 0.1));
      float extraNoise_s = fbmValue3D(extraCoord_s); 
      vec3 extraColor_s = mix(vec3(2.0, 0.0, 0.0), vec3(0.0, 2.0, 2.0), smoothstep(0.2, 0.8, extraNoise_s)); 

      // --- Blend Streak Colors --- 
      // waveColor_s = mix(waveColor_s, largeWaveColor_s, 0.65); // Original static mix
      // waveColor_s = mix(waveColor_s, extraColor_s, 0.35); // Original static mix
      float blendFactor_s1 = 0.55 + 0.35 * sin(time * 0.45 + position.z * 0.01); // Time-varying blend 1
      float blendFactor_s2 = 0.30 + 0.20 * cos(time * 0.65 + position.y * 0.02); // Time-varying blend 2
      waveColor_s = mix(waveColor_s, largeWaveColor_s, clamp01(blendFactor_s1)); 
      waveColor_s = mix(waveColor_s, extraColor_s, clamp01(blendFactor_s2)); 
      
      // Apply final blended color to streaks
      vec3 streakColor = waveColor_s * streaks;

      // --- Psychedelic Particles - Multi-Layer Waviness ---
      // Ensure wavyPosition_p calculation uses wrapped Z
      vec3 wrappedPos_p = position;
      wrappedPos_p.z = mod(position.z, WRAP_DISTANCE_Z_EFFECTS);

      vec3 displacement_p1 = vec3(
          0.0,
          sin(wrappedPos_p.z * 0.4 + time * 1.8) * 12.0, // Use wrapped Z
          cos(wrappedPos_p.x * 0.6 + time * 1.3) * 12.0 
      ) * intensity;
      vec3 displacement_p2 = vec3(
          sin(wrappedPos_p.y * 0.3 + time * 0.8) * 9.0, 
          0.0,
          sin(wrappedPos_p.z * 0.4 + time * 1.0) * 9.0 // Use wrapped Z
      ) * intensity;
      vec3 totalDisplacement_p = displacement_p1 + displacement_p2;
      vec3 wavyPosition_p = wrappedPos_p + totalDisplacement_p; // Apply displacement to wrapped pos
      // NOTE: hyperspaceParticles already handles internal wrapping via a mod() call
      vec3 particles = hyperspaceParticles(wavyPosition_p, time, fract(time * 0.1)); 

      // Recalculate particle color if particle exists
      if (length(particles) > 0.01) {
        // --- Generate Base Random Color (uses modPosZ) ---
        float modTime3 = fract(time * 0.7 + 0.3); 
        float modTime4 = fract(time * 0.15 + 0.5); 
        // Keep using original modPosZ from streaks for consistency
        vec3 hashInput_p = vec3(modPosZ * 0.4 + modTime3, position.x * 0.12, modTime4 + 1.0); 
        vec3 waveColor_p = hash33(hashInput_p); 
        waveColor_p = clamp(vec3(0.1) + waveColor_p * 1.0, 0.0, 1.0); 
        
        // --- Calculate large-scale color wave (using wrapped Z) ---
        vec3 largeScaleCoord_p = wrappedPos_p * 0.01 + vec3(fract(time * 0.04), 0.0, fract(-time * 0.06) + 5.0);
        float largeWaveNoise_p = fbmValue3D(largeScaleCoord_p); 
        vec3 largeWaveColor_p = mix(vec3(0.1, 1.0, 0.2), vec3(1.0, 0.8, 0.1), smoothstep(0.3, 0.7, largeWaveNoise_p)); 
        
        // --- Calculate Rainbow Layer (using wrapped Z) --- 
        vec3 ultraScaleCoord_p = wrappedPos_p * 0.002 + vec3(fract(time * 0.015), fract(-time * 0.02), 0.0);
        float ultraWaveNoise_p = fbmValue3D(ultraScaleCoord_p); 
        vec3 rainbowColor_p = mix(vec3(1.0, 0.1, 0.1), vec3(0.1, 1.0, 0.1), smoothstep(0.0, 0.5, ultraWaveNoise_p)); 
        rainbowColor_p = mix(rainbowColor_p, vec3(0.1, 0.1, 1.0), smoothstep(0.5, 1.0, ultraWaveNoise_p)); 
        largeWaveColor_p = mix(largeWaveColor_p, rainbowColor_p, 0.5); 

        // --- Calculate EXTRA PSYCHEDELIC LAYER (Particles) (using wrapped Z) --- 
        vec3 extraCoord_p = wrappedPos_p * 0.07 + vec3(fract(time * -0.12), fract(time * 0.25), fract(time * -0.18));
        float extraNoise_p = fbmValue3D(extraCoord_p); 
        vec3 extraColor_p = mix(vec3(0.0, 2.0, 0.0), vec3(2.0, 0.0, 2.0), smoothstep(0.3, 0.7, extraNoise_p)); 

        // --- Blend Particle Colors --- 
        // waveColor_p = mix(waveColor_p, largeWaveColor_p, 0.7); // Original static mix
        // waveColor_p = mix(waveColor_p, extraColor_p, 0.4); // Original static mix
        float blendFactor_p1 = 0.6 + 0.3 * cos(time * 0.35 - position.x * 0.015); // Time-varying blend 3
        float blendFactor_p2 = 0.35 + 0.25 * sin(time * 0.55 - position.z * 0.025); // Time-varying blend 4
        waveColor_p = mix(waveColor_p, largeWaveColor_p, clamp01(blendFactor_p1)); 
        waveColor_p = mix(waveColor_p, extraColor_p, clamp01(blendFactor_p2)); 

        // Apply final blended color to particles
        particles = waveColor_p * length(particles); 
      }

      // --- Neon Border ---
          vec3 borderEffect = hyperspaceBorder(position, time, intensity * 0.7);
      if (length(borderEffect) > 0.01) {
        float borderTimePhase = fract(time * 0.8); 
        vec3 bColor1 = vec3(1.2, 0.9, 0.1); // Brighter Gold
        vec3 bColor2 = vec3(0.8, 0.2, 1.2); // Brighter Violet
        vec3 bColor3 = vec3(0.1, 1.2, 0.6); // Brighter Emerald
        vec3 borderColor = mix(bColor1, bColor2, smoothstep(0.0, 0.5, borderTimePhase));
        borderColor = mix(borderColor, bColor3, smoothstep(0.5, 1.0, borderTimePhase));
        borderEffect = borderColor * length(borderEffect); 
      }

      // --- Combine Effects --- 
          vec3 combinedEffects = vec3(0.0);
      combinedEffects += streakColor * 0.4; 
      combinedEffects += particles * 0.5; 
      combinedEffects += borderEffect * 0.35;

          // Add combined effects to base color 
          vec3 finalColor = baseColor + combinedEffects * intensity; 

      // Optional: Subtle blue shift
      finalColor = mix(finalColor, finalColor * vec3(0.85, 0.95, 1.05), intensity * 0.1);
          
          return finalColor;
      } 
      // --- The original function definition below is replaced by the code above ---
      vec3 applyHyperspaceEffects_replaced(vec3 baseColor, vec3 position, vec3 viewPosition, float time, float intensity)`
);

// --- Apply Z-Wrapping Fix using string replacement (REVISED) ---
// Define WRAP_DISTANCE_Z globally within the GLSL module string
hyperspaceLanesGLSL = `
const float WRAP_DISTANCE_Z = 1000.0; // Define a large distance for wrapping
` + hyperspaceLanesGLSL;

// Wrap Z *directly* in hyperspaceStreaks calculation (inside loop)
hyperspaceLanesGLSL = hyperspaceLanesGLSL.replace(
    'float streakPhase = mod(time * speed + position.z * 0.1, 20.0) / 20.0;', // Find original line
    'float streakPhase = mod(time * speed + mod(position.z, WRAP_DISTANCE_Z) * 0.1, 20.0) / 20.0; // Use wrapped Z directly'
);

// Wrap in hyperspaceParticles (Insert BEFORE the line defining 'id') - Keep this part the same
hyperspaceLanesGLSL = hyperspaceLanesGLSL.replace(
    '// Create particle hash',
    `
    // Wrap the Z coordinate AFTER initial calculation but BEFORE use in hash
    particlePos.z = mod(particlePos.z, WRAP_DISTANCE_Z);

    // Create particle hash`
);
// --- End Z-Wrapping Fix ---

// --- GLSL Modules Content (Prepended) ---
const mathGLSL = `
#ifndef MATH_UTILS
#define MATH_UTILS

// Constants
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679
#define INV_PI 0.31830988618
#define EPSILON 0.0001

// Ray struct for raymarching
struct Ray {
    vec3 origin;
    vec3 direction;
};

// Clamp value between min and max
float clamp01(float x) {
    return clamp(x, 0.0, 1.0);
}
vec2 clamp01(vec2 v) {
    return clamp(v, 0.0, 1.0);
}
vec3 clamp01(vec3 v) {
    return clamp(v, 0.0, 1.0);
}

// Linear interpolation
float lerp(float a, float b, float t) {
    return a + t * (b - a);
}
vec2 lerp(vec2 a, vec2 b, float t) {
    return a + t * (b - a);
}
vec3 lerp(vec3 a, vec3 b, float t) {
    return a + t * (b - a);
}

// Smooth step interpolation
float smoothstep01(float t) {
    return t * t * (3.0 - 2.0 * t);
}

// Smoother step (Ken Perlin's)
float smootherstep(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Map a value from one range to another
float map(float value, float fromMin, float fromMax, float toMin, float toMax) {
    float t = (value - fromMin) / (fromMax - fromMin);
    return lerp(toMin, toMax, t);
}

// Return the smallest component of a vector
float minComponent(vec2 v) {
    return min(v.x, v.y);
}
float minComponent(vec3 v) {
    return min(min(v.x, v.y), v.z);
}

// Return the largest component of a vector
float maxComponent(vec2 v) {
    return max(v.x, v.y);
}
float maxComponent(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

// Custom rotation functions
mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotateZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

// Create rotation matrix from Euler angles (in radians)
mat3 eulerRotation(vec3 angles) {
    return rotateZ(angles.z) * rotateY(angles.y) * rotateX(angles.x);
}

// Polynomial smooth min
float smin(float a, float b, float k) {
    float h = clamp01(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1.0 - h);
}

// Exponential smooth min
float sminExp(float a, float b, float k) {
    float res = exp(-k * a) + exp(-k * b);
    return -log(res) / k;
}

// Power smooth min
float sminPow(float a, float b, float k) {
    a = pow(a, k);
    b = pow(b, k);
    return pow((a * b) / (a + b), 1.0 / k);
}

// Creates vortex-like distortion
vec3 vortex(vec3 p, vec3 center, float strength, float radius) {
    vec3 d = p - center;
    float r = length(d.xy);

    if (r < radius) {
        float angle = strength * (1.0 - r / radius);
        float c = cos(angle);
        float s = sin(angle);
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * d.xy;
        return vec3(q.x + center.x, q.y + center.y, p.z);
    }
    return p;
}

// Function to simulate gravitational pull
vec3 gravitationalPull(vec3 p, vec3 center, float mass) {
    vec3 direction = center - p;
    float distance = length(direction);
    float force = mass / (distance * distance + 0.001);
    return normalize(direction) * force;
}

#endif // MATH_UTILS
`;

const noiseGLSL = `
#ifndef NOISE_UTILS
#define NOISE_UTILS

// Hash function for 1D input
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

// Hash function for 2D input returning 1D output
float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Hash function for 3D input returning 1D output
float hash31(vec3 p) {
    // Ensure high precision for hash input/output
    highp vec3 p_hp = vec3(p);
    p_hp = fract(p_hp * 0.1031);
    p_hp += dot(p_hp, p_hp.yzx + 19.19);
    return fract((p_hp.x + p_hp.y) * p_hp.z);
}

// Hash function for 2D input returning 2D output
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// Hash function for 3D input returning 3D output
vec3 hash33(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
}

// Value noise 1D
float valueNoise1D(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f); // Cubic interpolation
    float a = hash11(i);
    float b = hash11(i + 1.0);
    return mix(a, b, u);
}

// Value noise 2D
float valueNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f); // Cubic interpolation
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Value noise 3D - Modified hash calls
float valueNoise3D(vec3 p) {
    highp vec3 i = floor(p);
    highp vec3 f = fract(p);
    highp vec3 u = f * f * (3.0 - 2.0 * f); // Cubic interpolation

    // Pre-calculate corner points
    highp vec3 p000 = i + vec3(0.0, 0.0, 0.0);
    highp vec3 p100 = i + vec3(1.0, 0.0, 0.0);
    highp vec3 p010 = i + vec3(0.0, 1.0, 0.0);
    highp vec3 p110 = i + vec3(1.0, 1.0, 0.0);
    highp vec3 p001 = i + vec3(0.0, 0.0, 1.0);
    highp vec3 p101 = i + vec3(1.0, 0.0, 1.0);
    highp vec3 p011 = i + vec3(0.0, 1.0, 1.0);
    highp vec3 p111 = i + vec3(1.0, 1.0, 1.0);

    // Call hash on pre-calculated points
    float a = hash31(p000);
    float b = hash31(p100);
    float c = hash31(p010);
    float d = hash31(p110);
    float e = hash31(p001);
    float f1 = hash31(p101);
    float g = hash31(p011);
    float h = hash31(p111);

    return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}

// Gradient noise (Perlin) 2D
float perlinNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // Quintic interpolation
    vec2 ga = hash22(i) * 2.0 - 1.0;
    vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
    vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
    vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    return mix(mix(va, vb, u.x), mix(vc, vd, u.x), u.y);
}

// Dummy perlinNoise3D if gradientNoise3D_edge is missing
float perlinNoise3D(vec3 p) {
   return valueNoise3D(p); // Fallback to value noise
}

// Fractal Brownian Motion (fBm) 2D - using value noise
float fbmValue2D(vec2 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int i = 0; i < octaves; i++) {
        sum += amp * valueNoise2D(freq * p);
        freq *= lacunarity;
        amp *= gain;
    }
    return sum;
}

// Fractal Brownian Motion (fBm) 2D - using Perlin noise
float fbmPerlin2D(vec2 p, int octaves, float lacunarity, float gain) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    for (int i = 0; i < octaves; i++) {
        sum += amp * perlinNoise2D(freq * p);
        freq *= lacunarity;
        amp *= gain;
    }
    return sum;
}

// Modified fbmValue3D to match original inline smoke fbm logic
float fbmValue3D(vec3 p) { // Parameter-less version
    float f = 0.0;
    float amplitude = 0.5;
    int octaves = 5;
    float lacunarity = 2.02;
    float gain = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < octaves; i++) {
        f += amplitude * valueNoise3D(p * frequency);
        frequency *= lacunarity;
        amplitude *= gain;
    }
    return f;
}

// Keep original parameterized version for planet shader compatibility if needed elsewhere
// (This overload isn't strictly needed in tunnel.js, but kept for consistency with welcomeScreen.ts)
float fbmValue3D(vec3 p, float octavesF, float lacunarity, float gain) {
    float total = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    float maxValue = 0.0;
    int octaves = int(octavesF);
    for (int i = 0; i < octaves; i++) {
        if (i >= octaves) break;
        total += valueNoise3D(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return maxValue > 0.0 ? total / maxValue : 0.0;
}

#endif // NOISE_UTILS
`;
// --- End GLSL Modules ---

// --- Matrix Rain GLSL (Volumetric Noise Approach) ---
const matrixRainGLSL = `
#ifndef MATRIX_RAIN_UTILS
#define MATRIX_RAIN_UTILS

// --- Uniforms for Matrix colors ---
uniform vec3 uTrailColor;  // Color of trailing characters (default: 0.0, 0.8, 0.3)
uniform vec3 uLeadColor;   // Color of leading characters (default: 0.7, 1.0, 0.8)
// -------------------------

// Simple hash function
float hash11_m(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

// Volumetric Matrix Rain using 3D Noise
vec4 matrixRain3D(vec3 worldPos, float time) {
    // Use 3D noise to determine density/probability of rain at this point
    // Animate noise over time
    vec3 noiseCoord = worldPos * 0.05 + vec3(0.0, -time * 0.5, 0.0);
    float density = fbmValue3D(noiseCoord); // Assumes fbmValue3D(vec3) is available from noiseGLSL
    
    // Threshold the density - only show rain in denser noise areas
    float densityThreshold = 0.55;
    if (density < densityThreshold) {
        return vec4(0.0); // Not dense enough for rain here
    }
    
    // Calculate normalized density for brightness/alpha
    float normalizedDensity = smoothstep(densityThreshold, densityThreshold + 0.1, density);
    
    // Create vertical falling effect based on world Y coordinate and time
    // Use a hash based on XZ position to vary the fall speed and phase per column
    float columnSeed = hash11_m(floor(worldPos.x * 1.0) + floor(mod(worldPos.z, 1000.0) * 1.0));
    float fallSpeed = 1.5 + columnSeed * 2.5;
    float fallPhase = time * fallSpeed + columnSeed * 10.0;
    
    // Use fract to create repeating vertical pattern (the streaks)
    float verticalProg = fract(worldPos.y * 0.5 - fallPhase);
    
    // Make streaks fade out quickly - high power means sharp falloff
    float streakBrightness = pow(1.0 - verticalProg, 8.0);
    
    // Combine density and streak brightness
    float finalBrightness = streakBrightness * normalizedDensity * 1.5; // Boost overall brightness
    
    // Determine leading edge (top of the streak)
    float leadEdgeThreshold = 0.9; // Top 10% of the streak
    float isLeadingEdge = smoothstep(leadEdgeThreshold, leadEdgeThreshold + 0.05, 1.0 - verticalProg);
    
    // Define colors (ensure they are bright)
    vec3 trailColor = vec3(0.0, 1.0, 0.3); // Bright green trail
    vec3 leadColor = vec3(0.9, 1.0, 0.9);  // Very bright lead
    
    // Mix colors based on leading edge
    vec3 color = mix(trailColor, leadColor, isLeadingEdge) * finalBrightness;
    
    // Add some extra glow based on brightness
    color += vec3(0.0, 0.5, 0.1) * finalBrightness * finalBrightness;
    
    // Calculate alpha
    float alpha = min(finalBrightness * 2.0, 0.9); // Make it fairly opaque
    
    return vec4(color, alpha);
}

#endif // MATRIX_RAIN_UTILS
`;
// --- End Matrix Rain GLSL ---

// --- Placeholder Texture Generation ---
function createPlaceholderGlyphAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = 4; // Minimal size
    canvas.height = 4;
    const context = canvas.getContext('2d');
    if (!context) return null; // Handle context creation failure
    context.fillStyle = 'white'; // Fill with white (visible)
    context.fillRect(0, 0, 4, 4);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.NearestFilter; // Use nearest for sharp glyphs
    texture.magFilter = THREE.NearestFilter;
    return texture;
}
// --- End Placeholder Texture Generation ---

// --- Tunnel Segment Constants ---
const NUM_TUNNEL_SEGMENTS = 3;
const TUNNEL_SEGMENT_LENGTH = 2500; // Length of each segment
const TOTAL_TUNNEL_LENGTH = NUM_TUNNEL_SEGMENTS * TUNNEL_SEGMENT_LENGTH;

/**
 * Creates a tunnel mesh with dynamic shapes using multiple segments
 * @returns THREE.Group containing the tunnel elements
 */
export function createTunnel() {
  const tunnelGroup = new THREE.Group();
  tunnelGroup.name = 'tunnel'; 
  tunnelGroup.userData.segments = []; // Array to hold segments
  tunnelGroup.userData.segmentLength = TUNNEL_SEGMENT_LENGTH;
  tunnelGroup.userData.numSegments = NUM_TUNNEL_SEGMENTS;
  
  // --- Define Geometry and Material ONCE (Shared by Segments) ---
  const radius = 100;
  const radialSegments = 32;
  const heightSegments = 40; // Segments per segment length
  const openEnded = true; // Segments must be open-ended
  
  const segmentGeometry = new THREE.CylinderGeometry(
    radius, radius, TUNNEL_SEGMENT_LENGTH, radialSegments, heightSegments, openEnded
  );
  segmentGeometry.rotateX(Math.PI / 2); // Align length along Z
  // We will translate each instance, not the base geometry
  
  // === Define Tunnel Shaders (Same as before) ===
  const tunnelVertexShader = `
      precision highp float;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      uniform float uTime;
      uniform float uFrequency;
      uniform float uAmplitude;
      uniform float uTunnelSegmentLength;

      void main() {
        vUv = uv;

        // Calculate displacement with multiple layers
        float timeFactor1 = uTime * 2.0;
        float timeFactor2 = uTime * 1.3;
        float timeFactor3 = uTime * 0.8;

        // Layer 1: Base wave
        float waveFactor1 = position.z * uFrequency + timeFactor1;
        float dispX1 = sin(waveFactor1) * uAmplitude * 1.8; // MORE amplitude
        float dispY1 = cos(waveFactor1 * 0.8 + 0.5) * uAmplitude * 1.5; // MORE amplitude

        // Layer 2: Faster, smaller ripples
        float rippleFrequency = uFrequency * 2.5;
        float rippleAmplitude = uAmplitude * 0.6; // MORE amplitude
        float waveFactor2 = position.z * rippleFrequency + timeFactor2 * 1.5;
        float dispX2 = cos(waveFactor2 * 1.2) * rippleAmplitude;
        float dispY2 = sin(waveFactor2) * rippleAmplitude * 1.1; // MORE amplitude

        // Layer 3: Slower, wider undulation
        float undulationFrequency = uFrequency * 0.4;
        float undulationAmplitude = uAmplitude * 1.2; // MORE amplitude
        float waveFactor3 = position.z * undulationFrequency + timeFactor3 * 0.7;
        float dispX3 = sin(waveFactor3 * 0.9 + 1.0) * undulationAmplitude * 1.0;
        float dispY3 = cos(waveFactor3 + 2.5) * undulationAmplitude * 1.5; // MORE amplitude

        // Combine displacements
        float totalDisplacementX = dispX1 + dispX2 + dispX3;
        float totalDisplacementY = dispY1 + dispY2 + dispY3;

        // --- Blend displacement near segment edges ---
        // Reintroduced subtle blending to hide seams
        float halfLength = uTunnelSegmentLength * 0.5;
        float blendRange = 10.0; // VERY small blend range
        float localZ = position.z;

        float blendStart = smoothstep(-halfLength, -halfLength + blendRange, localZ);
        float blendEnd = smoothstep(halfLength, halfLength - blendRange, localZ);

        float edgeBlend = blendStart * blendEnd; 
        // --- Edge blending removed for uniform displacement ---
        // --- Subtle edge blending re-added --- 
        // --- End blend ---

        // Apply displacement
        vec3 displacedPosition = position + vec3(totalDisplacementX * edgeBlend, totalDisplacementY * edgeBlend, 0.0);

        // Use displaced position for calculations
        vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
        vWorldPos = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
      }
    `;

  const tunnelFragmentShader = `
      precision highp float;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uNebulaIntensity;
      uniform float uStarDensity;
      uniform vec3 uGlowColor;
      uniform float uGlowIntensity;
      uniform float uCurvatureStrength;
      uniform vec3 uCameraPos; // Needed for hyperspace
      uniform float uHyperspaceIntensity; // New uniform
      uniform float uGlitchIntensity; // Glitch uniform
      uniform float uTunnelRadius; // Added tunnel radius
      uniform mat4 uViewMatrix;   // Added view matrix
      uniform float uTunnelScrollSpeed; // Added for infinite scroll effect
      uniform float uEffectDistance;
      uniform float uEffectRange;
      uniform float uDimensionalRiftIntensity; // Declaration for the rift effect intensity

      // --- Prepended GLSL Code ---
      ${mathGLSL}
      ${noiseGLSL}
      ${matrixRainGLSL} // Inject the Matrix Rain code
      ${hyperspaceLanesGLSL} // Inject hyperspace lanes
      ${holographicGlitchGLSL} // Inject glitch effect
      // --- End Prepended Code ---

      // --- Inject Dimensional Rift Module ---
      ${dimensionalRiftShader}
      // --- End Dimensional Rift ---

      // --- Wormhole Distortion Module Function (Included from modules) ---
      vec3 spacetimeCurvature(vec3 position, float time, float curvatureStrength) {
          float distFromCenter = length(position.xy);
          vec3 curvatureDirection = normalize(vec3(-position.y, position.x, 0.0));
          float swirl = sin(time * 0.2 + distFromCenter * 0.5) * curvatureStrength;
          mat3 curvatureMatrix = mat3(
              cos(swirl), -sin(swirl), 0.0,
              sin(swirl), cos(swirl), 0.0,
              0.0, 0.0, 1.0
          );
          return curvatureMatrix * position;
      }
      
      // --- Star field generation (from noise module) ---
      float stars(vec2 p, float density) {
          vec2 grid = floor(p * 100.0);
          float h = hash33(vec3(grid, 1.0)).x;
          if (h > 1.0 - density) {
              vec2 jitter = hash33(vec3(grid, 2.0)).xy;
              float star = 1.0 - distance(fract(p * 100.0), jitter);
              star = smoothstep(0.95, 1.0, star) * smoothstep(h, 1.0, h * 1.2);
              return star;
          }
          return 0.0;
      }

      void main() {
          const float WRAP_DISTANCE_Z = 1000.0; // Define wrap distance locally
          vec3 wrappedWorldPos = vWorldPos;
          wrappedWorldPos.z = mod(vWorldPos.z, WRAP_DISTANCE_Z);

          // Apply spacetime curvature distortion to world position
          vec3 distortedWorldPos = spacetimeCurvature(wrappedWorldPos, uTime, uCurvatureStrength);
          
          // Calculate base surface color & mix in nebula patterns
          vec3 baseColor = mix(vec3(0.0, 0.1, 0.3), vec3(0.4, 0.0, 0.6), vUv.y);
          // vec2 nebulaCoord = distortedWorldPos.xy * 0.1 + vUv * 4.0 + vec2(uTime * 0.05, uTime * 0.03); // Original
          // vec2 nebulaCoord2 = distortedWorldPos.yx * 0.08 + vUv * 3.0 - vec2(uTime * 0.07, uTime * 0.04); // Original
          vec2 timeOffset1 = vec2(sin(uTime * 0.15), cos(uTime * 0.11)) * 0.3;
          vec2 timeOffset2 = vec2(cos(uTime * -0.09), sin(uTime * 0.13)) * 0.25;
          vec2 nebulaCoord = distortedWorldPos.xy * 0.1 + vUv * 4.0 + vec2(uTime * 0.05, uTime * 0.03) + timeOffset1;
          vec2 nebulaCoord2 = distortedWorldPos.yx * 0.08 + vUv * 3.0 - vec2(uTime * 0.07, uTime * 0.04) + timeOffset2;
          float nebulaPattern = fbmValue2D(nebulaCoord, 6, 2.0, 0.5); 
          float nebulaPattern2 = fbmValue2D(nebulaCoord2, 6, 2.0, 0.5);
          float nebulaMix = mix(nebulaPattern, nebulaPattern2, 0.5);
          vec3 nebulaColor = mix(baseColor, vec3(0.7, 0.2, 1.0), nebulaMix * uNebulaIntensity);
          float starField = stars(vUv + vec2(uTime * 0.01, 0.0), uStarDensity);
          float edgeGlow = smoothstep(0.4, 0.5, distance(vUv, vec2(0.5)));
          vec3 surfaceColor = mix(nebulaColor, uGlowColor, edgeGlow * uGlowIntensity);
          surfaceColor += vec3(starField);
          // Apply hyperspace using distorted position (it has internal wrapping)
          surfaceColor = applyHyperspaceEffects(surfaceColor, distortedWorldPos, uCameraPos, uTime, uHyperspaceIntensity);

          // === Volumetric Matrix Rain ===
          // Use wrapped world position for matrix rain
          // <<< DEBUG: Disable Matrix Rain 3D >>>
          // vec4 matrixEffect = matrixRain3D(wrappedWorldPos, uTime);
          vec4 matrixEffect = vec4(0.0); // Set to transparent black
          
          // Very strong additive blending - make it pop
          vec3 finalColor = surfaceColor; // Initialize finalColor with surfaceColor
          /* <<< DEBUG: Disable Matrix Rain 3D Blending >>>
          if (matrixEffect.a > 0.01) {
              // Add matrix effect color multiplied by its alpha and a boost factor
              float matrixBoost = 1.5; // Reduced matrix brightness
              finalColor = surfaceColor + matrixEffect.rgb * matrixEffect.a * matrixBoost;
          } else {
              finalColor = surfaceColor;
          }
          */
          // <<< END DEBUG >>>
          
          // Apply holographic glitch effect (AFTER matrix rain)
          finalColor = applyHolographicGlitch(finalColor, vUv, uTime, uGlitchIntensity);
          
          // Apply bloom (AFTER glitch)
          float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
          if (brightness > 0.85) { 
              float bloomAmount = pow(brightness - 0.85, 2.0) * 0.3; // Much less bloom amount
              finalColor += finalColor * bloomAmount * vec3(0.1, 0.5, 0.15); // Dimmer, less saturated bloom color
          }
          
          // --- Additive Infinite Scroll Layer ---
          // Add a subtle, infinitely scrolling background grid/lines
          vec2 scrolledUv = vUv;
          scrolledUv.y -= uTime * uTunnelScrollSpeed; // Scroll UVs based on time
          float gridLines = (1.0 - smoothstep(0.01, 0.03, abs(fract(scrolledUv.x * 20.0) - 0.5))) + // Vertical lines
                            (1.0 - smoothstep(0.01, 0.03, abs(fract(scrolledUv.y * 5.0) - 0.5))); // Horizontal lines
          gridLines = clamp(gridLines, 0.0, 1.0);
          vec3 gridColor = vec3(0.1, 0.3, 0.5) * gridLines * 0.15; // Subtle blue grid
          
          // Additively blend the grid (mostly visible where other effects are dark)
          finalColor += gridColor;
          // --- End Infinite Scroll Layer ---
          
          // --- Apply Dimensional Rift ---
          if (uDimensionalRiftIntensity > 0.01) { 
              vec3 dr_base_color = finalColor; // Use current finalColor as base
              vec3 dr_rift_color = vec3(0.8, 0.1, 1.0); // Define the rift color
              vec3 dr_output_effect = dimensionalRift(vUv, uTime, dr_base_color, dr_rift_color); // Calculate rift effect
              finalColor = mix(finalColor, dr_output_effect, uDimensionalRiftIntensity); // Blend based on intensity
          }
          // --- End Dimensional Rift ---
          
          // --- Calculate Effect Strength based on View Distance --- 
          // Re-introduce view distance calculation for debugging
          vec4 viewPos = uViewMatrix * vec4(vWorldPos, 1.0);
          float distanceAhead = -viewPos.z; // Distance along camera's forward axis
          // --- End View Distance Calc ---
          
          // Re-enable effect strength calculation and blend
          float effectStrength = smoothstep(uEffectDistance - uEffectRange, uEffectDistance, distanceAhead);
          effectStrength = pow(effectStrength, 2.5); 
          
          // --- Psychedelic End Effect Calculation (Simplified) ---
          vec3 effectColor = vec3(0.0);
          if (effectStrength > 0.01) { 
              // --- Original Complex Effect (Restored) ---
              vec3 neon1 = vec3(1.5, 0.0, 2.5); // Magenta
              vec3 neon2 = vec3(0.0, 2.0, 1.8); // Cyan
              vec3 neon3 = vec3(2.5, 1.5, 0.0); // Orange/Yellow
              
              float timeFactor = uTime * 2.5;
              // Use wrapped Z and distance for more complex pattern
              float patternCoord = wrappedWorldPos.z * 0.05 + distanceAhead * 0.005;
              float mix1 = 0.5 + 0.5 * sin(patternCoord + timeFactor * 1.1);
              float mix2 = 0.5 + 0.5 * cos(patternCoord * 0.8 + timeFactor * 0.9 + 1.5);
              float mix3 = 0.5 + 0.5 * sin(patternCoord * 1.2 + timeFactor * 1.3 + 3.0);
              
              effectColor = mix(neon1, neon2, mix1);
              effectColor = mix(effectColor, neon3, mix2);
              effectColor = mix(effectColor, neon1, mix3);
              
              // Add warping noise based on UV and time
              vec2 warpUv = vUv * 3.0 + vec2(cos(timeFactor*0.4), sin(timeFactor*0.4)) * 0.3;
              float warpNoise = fbmValue2D(warpUv, 4, 2.2, 0.5);
              effectColor *= (0.6 + warpNoise * 1.2); // Modulate color by warp noise
              
              // Add bright flickering
              float flickerNoiseCoord = wrappedWorldPos.x * 0.2 + wrappedWorldPos.y * 0.2 + wrappedWorldPos.z * 0.1 + uTime * 2.0;
              float flicker = fract(sin(flickerNoiseCoord * 25.3) * 41758.9);
              effectColor += vec3(1.0) * pow(flicker, 15.0) * 2.0; // Add sharp bright flashes
              
              // Apply overall effect strength
              effectColor *= effectStrength * 1.5; // Make it bright
              // --- End Original Complex Effect ---
          }
          // --- End Psychedelic Effect Calc ---
          
          // --- Conditional Blending for Opaque Cap ---
          // If effect strength is high, use effect color directly (opaque cap)
          // Otherwise, blend smoothly in the transition.
          if (distanceAhead >= uEffectDistance) { 
              // Ensure effect isn't accidentally black, force full alpha
              gl_FragColor = vec4(max(effectColor, vec3(0.01)), 1.0); 
          } else {
              // Blend in the transition zone (normalize strength for mix)
              vec3 blendedColor = mix(finalColor, effectColor, effectStrength);
              gl_FragColor = vec4(blendedColor, 1.0); 
          }
          // --- End Conditional Blending ---
      }
    `;

  // Create the main tunnel material (SHARED by all segments)
  const tunnelMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uFrequency: { value: 0.01 },
      uAmplitude: { value: 2.0 },
      uNebulaIntensity: { value: 1.5 },
      uStarDensity: { value: 0.5 },
      uGlowColor: { value: new THREE.Color(0x36f4ff) },
      uGlowIntensity: { value: 0.8 },
      uCurvatureStrength: { value: 1.0 }, 
      uCameraPos: { value: new THREE.Vector3() }, 
      uHyperspaceIntensity: { value: 1.8 }, // Increased intensity EAAAAAAA
      uGlitchIntensity: { value: 0.3 }, 
      uTunnelRadius: { value: radius }, 
      uViewMatrix: { value: new THREE.Matrix4() }, 
      uTunnelScrollSpeed: { value: 0.05 }, 
      uTunnelSegmentLength: { value: TUNNEL_SEGMENT_LENGTH },
      uTrailColor: { value: new THREE.Color(0.0, 0.75, 0.2) }, 
      uLeadColor: { value: new THREE.Color(0.8, 1.0, 0.8) }, 
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uIntensity: { value: 0.5 },
      uScrollSpeed: { value: 0.1 },
      uEffectDistance: { value: 7000.0 }, // Increased to match segment range
      uEffectRange: { value: 1000.0 },
      uDimensionalRiftIntensity: { value: 0.7 } // Enable the effect
    },
    vertexShader: tunnelVertexShader,
    fragmentShader: tunnelFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, 
    depthTest: true   
  });

  // --- Create and Position Segments ---
  for (let i = 0; i < NUM_TUNNEL_SEGMENTS; i++) {
    const segmentMesh = new THREE.Mesh(segmentGeometry, tunnelMaterial);
    // Position segments end-to-end along negative Z
    const segmentZ = - (i * TUNNEL_SEGMENT_LENGTH) - (TUNNEL_SEGMENT_LENGTH / 2) + 100; // Position center of segment
    segmentMesh.position.set(0, 0, segmentZ);
    segmentMesh.name = `tunnelSegment_${i}`;

    tunnelGroup.add(segmentMesh);
    tunnelGroup.userData.segments.push(segmentMesh);
  }

  // --- Create End Cap Geometry and Material ---
  const endCapGeometry = new THREE.CircleGeometry(radius, 32);

  const endCapVertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const endCapFragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uCameraPos; // May need for more complex effects later

    // Include necessary modules (simplified for cap)
    ${mathGLSL}
    ${noiseGLSL}

    void main() {
      // Simplified Psychedelic Effect for Cap (using UVs + Time)
      vec3 neon1 = vec3(1.5, 0.0, 2.5); // Magenta
      vec3 neon2 = vec3(0.0, 2.0, 1.8); // Cyan
      vec3 neon3 = vec3(2.5, 1.5, 0.0); // Orange/Yellow

      float timeFactor = uTime * 2.5;
      vec2 uvCentered = vUv - 0.5;
      float angle = atan(uvCentered.y, uvCentered.x);
      float radius = length(uvCentered);

      float patternCoord = angle * 3.0 + radius * 2.0;
      float mix1 = 0.5 + 0.5 * sin(patternCoord + timeFactor * 1.1);
      float mix2 = 0.5 + 0.5 * cos(patternCoord * 0.8 - timeFactor * 0.9 + 1.5);
      float mix3 = 0.5 + 0.5 * sin(patternCoord * 1.2 + timeFactor * 1.3 + 3.0);

      vec3 effectColor = mix(neon1, neon2, mix1);
      effectColor = mix(effectColor, neon3, mix2);
      effectColor = mix(effectColor, neon1, mix3);

      // Add warping noise based on UV and time
      vec2 warpUv = vUv * 3.0 + vec2(cos(timeFactor*0.4), sin(timeFactor*0.4)) * 0.3;
      float warpNoise = fbmValue2D(warpUv, 4, 2.2, 0.5);
      effectColor *= (0.6 + warpNoise * 1.2); // Modulate color by warp noise

      // Add bright flickering based on radial position and time
      float flickerNoiseCoord = radius * 10.0 + angle * 5.0 + uTime * 2.0;
      float flicker = fract(sin(flickerNoiseCoord * 25.3) * 41758.9);
      effectColor += vec3(1.0) * pow(flicker, 15.0) * 2.0; // Add sharp bright flashes

      // Ensure minimum brightness and set full opacity
      gl_FragColor = vec4(max(effectColor, vec3(0.01)), 1.0);
    }
  `;

  const endCapMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() }, // Pass camera pos just in case
    },
    vertexShader: endCapVertexShader,
    fragmentShader: endCapFragmentShader,
    side: THREE.FrontSide, // Only need front side for cap
    transparent: false, // Should be opaque
    depthTest: true, // Enable depth testing
    depthWrite: false // Keep depthWrite false for now
  });

  const endCapMesh = new THREE.Mesh(endCapGeometry, endCapMaterial);
  endCapMesh.name = 'tunnelEndCap';
  // Initial position will be updated dynamically
  endCapMesh.position.set(0, 0, -1000); // Start far away
  endCapMesh.renderOrder = 5; // Render late
  tunnelGroup.add(endCapMesh);
  tunnelGroup.userData.endCapMesh = endCapMesh;
  // --- End End Cap ---
  
  // Add rings for additional visual effect (RELATIVE positioning might need adjustment)
  /*
  const numSegments = 20;
  const segmentSpacing = 15;
  for (let i = 0; i < numSegments; i++) {
    const ring = createTunnelRing(...);
    tunnelGroup.add(ring);
  }
  */ // --> Deferring ring adjustments

  // Add the nebula smoke effect (NEEDS ADJUSTMENT - Should it also be segmented or cover all?)
  const smokeEffect = createSmokeEffect(radius, TOTAL_TUNNEL_LENGTH); // Use total length for now
  tunnelGroup.add(smokeEffect);
  // --> Deferring smoke adjustments // Removed comment
  
  // Add the NEW hyperspace smoke layer
  const hyperspaceLayer = createHyperspaceSmokeLayer(radius, TOTAL_TUNNEL_LENGTH);
  tunnelGroup.add(hyperspaceLayer);

  // Add the particle system (NEEDS ADJUSTMENT - Should particles wrap within total length?)
  // const particles = createTunnelParticles(); // Uses hardcoded length currently
  // tunnelGroup.add(particles);
  // --> Deferring particle adjustments

  return tunnelGroup;
}

/**
 * Creates a ring element for the tunnel
 */
function createTunnelRing(radius, thickness, posZ, depthFactor) {
  // Create a torus geometry for the ring
  const ringGeometry = new THREE.TorusGeometry(radius, thickness, 16, 50);
  
  // Create material with glow effect
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.4, 0.2, 1.0),
    transparent: true,
    opacity: 0.7 * (1 - depthFactor),
  });
  
  // Create ring mesh
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.z = -posZ;
  
  return ring;
}

/**
 * Creates a nebula smoke effect inside the tunnel
 * @param {number} radius The radius of the tunnel
 * @param {number} length The length of the tunnel
 * @returns {THREE.Mesh} The smoke effect mesh
 */
function createSmokeEffect(radius, length) {
  // Create a slightly smaller cylinder for the smoke
  const smokeRadius = radius * 0.95;
  const smokeGeometry = new THREE.CylinderGeometry(
    smokeRadius, smokeRadius, length, 64, 64, true // Increased height segments from 32 to 64
  );
  
  // Rotate and position similar to main tunnel
  smokeGeometry.rotateX(Math.PI / 2);
  smokeGeometry.translate(0, 0, -length / 2 + 100);
  
  const smokeVertexShader = `
    precision highp float;
    // varying vec3 vPosition; // Removed in nebulaSmoke.vert
    // varying vec3 vNormal; // Removed in nebulaSmoke.vert
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        // vNormal = normal; // Removed
        // vPosition = position; // Removed

        // Get world position for calculations in fragment shader
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const smokeFragmentShader = `
    precision highp float;

    uniform float uNoiseScale; // Explicitly declare the uniform

    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    uniform float uTime;
    uniform vec3 uCameraPos;
    uniform float uSpeed;
    uniform float uBrightness;
    uniform float uDensity;
    uniform float uSmokeRadius;
    uniform float uNumSteps;
    uniform float uStepSize;
    uniform float uBackgroundInfluenceStrength;
    // Add uniforms for ethereal bloom transform
    uniform float uEtherealNoiseScale;
    uniform float uEtherealSpeed;
    uniform float uEtherealHueSpeed;
    uniform float uEtherealIntensity;
    uniform float uHyperspaceInfluence; // New uniform for hyperspace effect strength

    // --- Prepended GLSL Code --- // REMOVED
    // ${mathGLSL} // REMOVED
    // ${noiseGLSL} // REMOVED
    // --- End Prepended Code --- // REMOVED

    // --- Re-inject Math Module (needed for TWO_PI etc.) ---
    ${mathGLSL}
    // --- End Math Module ---

    // --- Inject the new Ethereal Bloom Transform Module ---
    ${etherealBloomTransformGLSL}
    // --- End Ethereal Bloom Injection ---

    // --- Functions are now assumed to be IN the nebulaSmoke.frag file itself ---
    // hash31, valueNoise3D, fbmValue3D etc.

    // Noise functions copied directly into nebulaSmoke.frag (if needed)
    float rand(vec3 co){ return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453); }
    float noise(vec3 p){ vec3 ip=floor(p); vec3 fp=fract(p); fp=fp*fp*(3.0-2.0*fp); float v000=rand(ip+vec3(0,0,0)); float v100=rand(ip+vec3(1,0,0)); float v010=rand(ip+vec3(0,1,0)); float v110=rand(ip+vec3(1,1,0)); float v001=rand(ip+vec3(0,0,1)); float v101=rand(ip+vec3(1,0,1)); float v011=rand(ip+vec3(0,1,1)); float v111=rand(ip+vec3(1,1,1)); return mix(mix(mix(v000,v100,fp.x),mix(v010,v110,fp.x),fp.y),mix(mix(v001,v101,fp.x),mix(v011,v111,fp.x),fp.y),fp.z); }
    float fbm(vec3 p, int octaves){ float v=0.0; float a=0.5; mat3 rotX=mat3(1,0,0,0,cos(0.5),-sin(0.5),0,sin(0.5),cos(0.5)); mat3 rotY=mat3(cos(0.5),0,sin(0.5),0,1,0,-sin(0.5),0,cos(0.5)); for(int i=0;i<octaves;i++){v+=a*noise(p); p=rotX*rotY*p*2.1; a*=0.5;} return v;}
    bool isInsideSmokeCylinder(vec3 point, float radius) { return length(point.xy) < radius; }
    vec3 hueShift(vec3 color, float hue){ const vec3 k=vec3(0.57735); float c=cos(hue); return vec3(color*c+cross(k,color)*sin(hue)+k*dot(k,color)*(1.0-c));}

    // --- Simplified Hyperspace Streaks Logic (Adapted from hyperspaceLanes.glsl) ---
    const float WRAP_DISTANCE_Z_SMOKE = 1000.0; // Local wrap distance for smoke streaks

    // Need hash33 and fbmValue3D (simplified version) for streaks
    vec3 hash33_smoke(vec3 p) {
        p = vec3(
            dot(p, vec3(127.1, 311.7, 74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6))
        );
        return fract(sin(p) * 43758.5453123);
    }
    float valueNoise3D_smoke(vec3 p) {
        highp vec3 i = floor(p);
        highp vec3 f = fract(p);
        highp vec3 u = f * f * (3.0 - 2.0 * f);
        highp vec3 p000=i+vec3(0.,0.,0.);highp vec3 p100=i+vec3(1.,0.,0.);highp vec3 p010=i+vec3(0.,1.,0.);highp vec3 p110=i+vec3(1.,1.,0.);
        highp vec3 p001=i+vec3(0.,0.,1.);highp vec3 p101=i+vec3(1.,0.,1.);highp vec3 p011=i+vec3(0.,1.,1.);highp vec3 p111=i+vec3(1.,1.,1.);
        float a=hash31(p000);float b=hash31(p100);float c=hash31(p010);float d=hash31(p110);
        float e=hash31(p001);float f1=hash31(p101);float g=hash31(p011);float h=hash31(p111);
        return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y),mix(mix(e,f1,u.x),mix(g,h,u.x),u.y),u.z);
    }
    float fbmValue3D_smoke(vec3 p) {
        float f = 0.0;
        float amplitude = 0.5;
        int octaves = 3; // Fewer octaves for performance
        float lacunarity = 2.0;
        float gain = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < octaves; i++) {
            f += amplitude * valueNoise3D_smoke(p * frequency);
            frequency *= lacunarity;
            amplitude *= gain;
        }
        return f;
    }

    float hyperspaceStreaks_smoke(vec3 position, float time) {
        float intensity = 1.0; // Assume base intensity
        float totalStreak = 0.0;
        float speed = 10.0; // Base speed for streaks
        vec3 direction = vec3(0.0, 0.0, -1.0); // Assumed direction

        // Use wrapped Z coordinate
        vec3 wrappedPos = position;
        wrappedPos.z = mod(position.z, WRAP_DISTANCE_Z_SMOKE);

        for (int i = 0; i < 5; ++i) { // Fewer layers for performance
            float layerIntensity = intensity * (1.0 - float(i) / 5.0);
            vec3 hashInput = vec3(float(i) * 1.7, float(i) * 2.3, float(i) * 3.1);
            vec3 layerOffset = hash33_smoke(hashInput) * 50.0 * layerIntensity;
            float layerSpeedFactor = 0.8 + hash33_smoke(hashInput + 1.0).x * 0.7;
            vec3 layerPos = wrappedPos + layerOffset;
            
            // Use wrapped Z directly in phase calculation
            float streakPhase = mod(time * speed * layerSpeedFactor + mod(position.z, WRAP_DISTANCE_Z_SMOKE) * 0.1, 20.0) / 20.0;
            float streakNoiseCoord = layerPos.x * 0.05 + layerPos.y * 0.05;
            float streakNoise = fbmValue3D_smoke(vec3(streakNoiseCoord, time * 0.1, 0.0)); // Corrected: Provide 3rd component
            float streakShape = smoothstep(0.0, 0.1, streakPhase) * smoothstep(1.0, 0.9, streakPhase);
            streakShape *= (0.5 + streakNoise * 0.5);

            totalStreak += streakShape * layerIntensity;
        }
        
        return clamp(totalStreak, 0.0, 1.0);
    }
    // --- End Simplified Hyperspace Streaks --- 

    void main() {
        // vec3 rayDir = normalize(vWorldPosition - uCameraPos); // Original direction
        vec3 rayDir = normalize(uCameraPos - vWorldPosition);   // Reversed direction (match reference)
        vec3 rayOrigin = vWorldPosition;
        // vec4 finalColor = vec4(0.0); // Original variable
        vec3 accumulatedColor = vec3(0.0); // New variable (match reference)
        float accumulatedAlpha = 0.0;      // New variable (match reference)
        // float timeOffset = uTime * uSpeed; // Not used in reference density calc like this

        // for (int i = 0; i < 64; i++) { // Use int loop, match uNumSteps approx (now 64) // Original hardcoded loop
        for (int i = 0; i < int(uNumSteps); i++) { // Use uniform for steps
            float currentDist = float(i) * uStepSize + uStepSize * 0.1;
            // vec3 p = rayOrigin + rayDir * currentDist; // Original name
            vec3 samplePos = rayOrigin + rayDir * currentDist; // New name (match reference)

            // if (!isInsideSmokeCylinder(p, uSmokeRadius)) continue; // Original name
            if (!isInsideSmokeCylinder(samplePos, uSmokeRadius)) continue; // Use new name

            // vec3 noisePos = p * uNoiseScale + vec3(0.0, 0.0, timeOffset); // Original calculation

            // Composition Noise
            // vec3 compNoisePos = p * (uNoiseScale * 0.6) + vec3(0.0, 0.0, uTime * uSpeed * 0.25); // Original name
            vec3 compNoisePos = samplePos * (uNoiseScale * 0.6) + vec3(0.0, 0.0, uTime * uSpeed * 0.25); // Use new name
            float compNoise = fbm(compNoisePos, 3);
            float compFactor = compNoise * 0.5 + 0.5;

            // Density Calculation
            // vec3 densityNoisePos = p * (uNoiseScale * 1.0) + vec3(0.0, 0.0, uTime * uSpeed * 0.8); // Original name
            vec3 densityNoisePos = samplePos * (uNoiseScale * 1.0) + vec3(0.0, 0.0, uTime * uSpeed * 0.8); // Use new name
            // vec3 detailNoisePos = p * (uNoiseScale * 4.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.5); // Original name
            vec3 detailNoisePos = samplePos * (uNoiseScale * 4.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.5); // Use new name
            float baseDensityNoise = fbm(densityNoisePos, 5);
            float detailDensityNoise = fbm(detailNoisePos, 4);
            float combinedDensityNoise = baseDensityNoise * 0.7 + detailDensityNoise * 0.3;
            float modulatedDensityNoise = combinedDensityNoise * (0.2 + compFactor * 0.8);
            // float density = smoothstep(0.4, 0.6, modulatedDensityNoise);
            // density = pow(density, 2.0) * uDensity * (0.1 + compFactor * 1.4);
            // New Density Calculation (Smoother transition)
            // float density = smoothstep(0.3, 0.7, modulatedDensityNoise); // Widen smoothstep range
            // density = density * uDensity * (0.1 + compFactor * 1.4); // Remove pow() for less sharpness // Original modification
            // density = density * uDensity * (0.5 + compFactor * 0.8); // Reduce compFactor influence
            // Revert to Reference Density Calculation
            float density = smoothstep(0.4, 0.6, modulatedDensityNoise); // Tighter range
            // density = pow(density, 2.0) * uDensity * (0.1 + compFactor * 1.4); // Add pow() back, use reference modulation
            // TEMPORARY: Simplify density calculation for debugging
            // density = density * uDensity;
            density = density * uDensity * (0.1 + compFactor * 1.4); // REMOVED pow() for softer density contrast

            // Background Interaction
            // vec3 bgNoisePos = samplePos * (uNoiseScale * 1.2) + vec3(0.0, 0.0, uTime * uSpeed * 0.4); // Original name
            vec3 bgNoisePos = samplePos * (uNoiseScale * 1.2) + vec3(0.0, 0.0, uTime * uSpeed * 0.4); // Use new name
            float bgNoise = fbm(bgNoisePos, 3);
            float bgInfluence = smoothstep(0.45, 0.55, bgNoise);
            density *= (1.0 - bgInfluence * 0.3 * uBackgroundInfluenceStrength);

            if (density > 0.005) {
                // --- Define Multiple Color Palettes --- 
                const int NUM_PALETTES = 4;
                const vec3 palette[NUM_PALETTES * 4] = vec3[]( // Store palettes linearly
                    // Palette 1: Cool Blues/Purples
                    vec3(0.0, 0.1, 0.8), vec3(0.2, 0.0, 1.0), vec3(0.5, 0.2, 1.0), vec3(0.8, 0.5, 1.0),
                    // Palette 2: Fiery Reds/Oranges
                    vec3(0.8, 0.1, 0.0), vec3(1.0, 0.3, 0.0), vec3(1.0, 0.6, 0.1), vec3(1.0, 0.9, 0.3),
                    // Palette 3: Psychedelic Greens/Yellows
                    vec3(0.1, 0.8, 0.2), vec3(0.5, 1.0, 0.3), vec3(0.9, 1.0, 0.4), vec3(1.0, 0.8, 0.8),
                    // Palette 4: Deep Space Magenta/Cyan
                    vec3(0.6, 0.0, 0.6), vec3(1.0, 0.1, 1.0), vec3(0.3, 0.5, 1.0), vec3(0.0, 0.9, 0.9)
                );
                
                // --- Time-Based Palette Selection & Blending ---
                float paletteTimeCycle = uTime * 0.04; // Slower cycle speed
                float paletteMixFactor = paletteTimeCycle * float(NUM_PALETTES - 1); // Scale factor for blending indices
                
                int paletteIndex1 = int(floor(paletteMixFactor)) % NUM_PALETTES;
                int paletteIndex2 = (paletteIndex1 + 1) % NUM_PALETTES;
                float paletteBlend = smoothstep(0.0, 1.0, fract(paletteMixFactor)); // Smoother transition

                // Calculate dynamic base colors by blending between palettes
                vec3 dynColor1 = mix(palette[paletteIndex1 * 4 + 0], palette[paletteIndex2 * 4 + 0], paletteBlend);
                vec3 dynColor2 = mix(palette[paletteIndex1 * 4 + 1], palette[paletteIndex2 * 4 + 1], paletteBlend);
                vec3 dynColor3 = mix(palette[paletteIndex1 * 4 + 2], palette[paletteIndex2 * 4 + 2], paletteBlend);
                vec3 dynColor4 = mix(palette[paletteIndex1 * 4 + 3], palette[paletteIndex2 * 4 + 3], paletteBlend);
                // --- End Palette Blending ---
                
                // Color Calculation (Using Dynamic Colors)
                // Add more direct time variation to color noise position
                vec3 timeVaryingOffset = vec3(cos(uTime * 0.1), sin(uTime * 0.15), uTime * uSpeed * 0.7);
                vec3 colorNoiseBasePos = samplePos * (uNoiseScale * 0.9) + timeVaryingOffset;

                // vec3 warpNoisePos = p * (uNoiseScale * 3.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.3); // Original name
                vec3 warpNoisePos = samplePos * (uNoiseScale * 3.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.3); // Use new name
                vec2 warpOffset = vec2(fbm(warpNoisePos, 3), fbm(warpNoisePos + vec3(5.2, 1.3, 0.0), 3));
                float localWarpIntensity = 0.5 + compFactor * 1.5;
                vec3 warpedColorNoisePos = colorNoiseBasePos + vec3(warpOffset * localWarpIntensity, 0.0);
                float colorNoise = fbm(warpedColorNoisePos, 4);

                vec3 baseColor;
                float segment = 1.0 / 3.0;
                float mixFactor = colorNoise * 0.5 + 0.5;
                // Use pow(..., 3.0) for sharper blending between colors
                float w1 = pow(1.0 - clamp(mixFactor / segment, 0.0, 1.0), 3.0);
                float w2 = pow(1.0 - clamp(abs(mixFactor - segment) / segment, 0.0, 1.0), 3.0);
                float w3 = pow(1.0 - clamp(abs(mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 3.0);
                float w4 = pow(clamp((mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 3.0);
                // baseColor = uColor1 * w1 + uColor2 * w2 + uColor3 * w3 + uColor4 * w4; // Replace with dynamic colors
                baseColor = dynColor1 * w1 + dynColor2 * w2 + dynColor3 * w3 + dynColor4 * w4;
                baseColor /= (w1 + w2 + w3 + w4 + 0.001);

                // --- Spatial Color Modulation Noise ---
                vec3 spatialNoisePos = samplePos * (uNoiseScale * 0.7) + vec3(uTime * 0.06, uTime * 0.1, -uTime * 0.04);
                float spatialColorNoise = fbm(spatialNoisePos, 3); // Noise for spatial variation
                
                // --- Calculate Hyperspace Streak Influence ---
                float streakIntensity = hyperspaceStreaks_smoke(samplePos, uTime);
                vec3 streakInfluenceColor = vec3(1.0, 1.0, 1.5); // Cool blue/white tint for streaks

                // --- Apply Spatial Modulation & Streak Influence ---
                vec3 spatialMixColor = mix(dynColor2, dynColor4, smoothstep(0.3, 0.7, spatialColorNoise)); // Choose secondary colors to blend
                baseColor = mix(baseColor, spatialMixColor, 0.3 + spatialColorNoise * 0.4); // Blend based on spatial noise
                // Additive blend for streak influence
                baseColor += streakInfluenceColor * streakIntensity * uHyperspaceInfluence;

                // BG Interaction and Hue Shift
                vec3 simulatedBgColor = mix(vec3(0.1, 0.0, 0.4), vec3(0.4, 0.1, 0.6), bgNoise * 0.5 + 0.5);
                vec3 colorAfterBgMix = mix(baseColor, simulatedBgColor, bgInfluence * 0.5 * uBackgroundInfluenceStrength);
                // vec3 hueNoisePos = p * (uNoiseScale * 2.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.1); // Original name
                vec3 hueNoisePos = samplePos * (uNoiseScale * 2.0) + vec3(0.0, 0.0, uTime * uSpeed * 1.1); // Use new name
                float hueNoise = fbm(hueNoisePos, 3);
                // float variedHueShiftAmount = (hueNoise * 0.5 + 0.5 - 0.5) * 0.9;
                // float variedHueShiftAmount = (hueNoise * 0.5 + 0.5 - 0.5) * 1.2; // Increased hue shift range
                // Increase hue shift range further
                float variedHueShiftAmount = (hueNoise * 0.5 + 0.5 - 0.5) * 1.5; // Increased hue shift range further
                vec3 sampleColor = hueShift(colorAfterBgMix, variedHueShiftAmount);

                // --- Apply Ethereal Bloom Transformation ---
                // Pass uTime directly, assuming uEtherealTime isn't needed as a separate uniform yet
                sampleColor = applyEtherealBloomTransform(sampleColor, samplePos, uTime);
                // --- End Ethereal Bloom Transformation ---

                // Accumulation
                float alphaDensityFactor = 5.0;
                // float sampleAlpha = (1.0 - exp(-density * uStepSize * alphaDensityFactor)) * (1.0 - finalColor.a); // Original variable
                float sampleAlpha = (1.0 - exp(-density * uStepSize * alphaDensityFactor)) * (1.0 - accumulatedAlpha); // Use new variable
                sampleAlpha = clamp(sampleAlpha, 0.0, 1.0);
                // finalColor.rgb += sampleColor * sampleAlpha * uBrightness; // Original variable
                // finalColor.a += sampleAlpha; // Original variable
                accumulatedColor += sampleColor * sampleAlpha * uBrightness; // Use new variable
                accumulatedAlpha += sampleAlpha; // Use new variable

                // if (finalColor.a > 0.995) break; // Changed break condition from 0.99 to 0.995
                if (accumulatedAlpha > 0.99) break; // Revert break condition to 0.99 (match reference)
            }
        }

        // Discard fully transparent pixels
        // if (finalColor.a < 0.001) discard; // Original variable
        if (accumulatedAlpha < 0.001) discard; // Use new variable

        // gl_FragColor = finalColor; // Original variable
        gl_FragColor = vec4(accumulatedColor, accumulatedAlpha); // Use new variables
    }
  `;

  // --- Nebula Smoke Material ---
  const smokeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uCameraPos: { value: new THREE.Vector3() },
      uColor1: { value: new THREE.Color(0x222244) }, // Deep blue base
      uColor2: { value: new THREE.Color(0x3366ff) }, // Brighter blue highlights
      uColor3: { value: new THREE.Color(0xaa88ff) }, // Purple/violet tones
      uColor4: { value: new THREE.Color(0xffaabb) }, // Pinkish/Warm tones
      uNoiseScale: { value: 0.025 }, // Base scale for nebula noise // Tuned 28/05 PM
      uSpeed: { value: 0.08 },      // Base speed for nebula noise // Tuned 28/05 PM
      uBrightness: { value: 0.7 },   // Overall nebula brightness // Tuned 28/05 PM
      uDensity: { value: 0.078 },   // Overall nebula density (Reduced further by 50% from 0.156)
      uSmokeRadius: { value: radius },
      uNumSteps: { value: 128 },      // Raymarching steps (Quality) // Tuned 28/05 PM
      uStepSize: { value: 1.0 },      // Raymarching step size // Tuned 28/05 PM
      uBackgroundInfluenceStrength: { value: 0.6 }, // Strength of BG interaction // Tuned 28/05 PM
      // --- Add Hyperspace Disturbance Uniforms ---
      uHyperspaceNoiseScale: { value: 0.015 }, // Default to hyperspace layer's value
      uHyperspaceSpeed: { value: 0.25 },      // Default to hyperspace layer's value
      uDisturbanceStrength: { value: 5.0 },     // Initial strength factor for disturbance
      // --- Add Hyperspace COLOR Disturbance Uniforms ---
      uHyperspaceColor1: { value: new THREE.Color(0xff00ff) }, // Default Magenta
      uHyperspaceColor2: { value: new THREE.Color(0x00ffff) }, // Default Cyan
      uHyperspaceColor3: { value: new THREE.Color(0xffff00) }, // Default Yellow
      uHyperspaceColor4: { value: new THREE.Color(0x00ff00) }, // Default Lime
      uHyperspaceHueSpeed: { value: 0.6 }       // Default hyperspace hue speed
    },
    vertexShader: smokeVertexShader,
    fragmentShader: smokeFragmentShader, // Will load nebulaSmoke.frag content
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.NormalBlending, // Use Normal Blending for base smoke
    depthWrite: false // Important for blending multiple transparent layers
  });

  // Create the mesh
  const smokeMesh = new THREE.Mesh(smokeGeometry, smokeMaterial);
  smokeMesh.name = 'nebulaSmokeLayer';
  smokeMesh.renderOrder = 1; // Ensure it renders after the main tunnel
  
  return smokeMesh;
}

// Create a soft particle texture (from reference)
function createParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    0,
    canvas.width / 2,
    canvas.height / 2,
    canvas.width / 2
  );
  
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(120,180,255,0.8)');
  gradient.addColorStop(0.6, 'rgba(50,100,255,0.4)');
  gradient.addColorStop(1, 'rgba(0,0,64,0)');
  
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Create particle system for tunnel (from reference, needs adaptation)
function createTunnelParticles() {
  // Create particle geometry
  const particleCount = 500; // Increased count for larger tunnel
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);

  // --- ADAPTATION NEEDED for radius and length ---
  const tunnelRadius = 95; // Match approx radius of our current tunnel smoke layer
  const tunnelLength = 480; // Match approx length of our current tunnel
  // --- END ADAPTATION PLACEHOLDER ---
  
  // Set random positions for particles within the adapted dimensions
  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    
    // Random position within cylindrical shape
    const angle = Math.random() * Math.PI * 2;
    // Distribute particles throughout the radius, not just at the edge
    const radius = Math.sqrt(Math.random()) * tunnelRadius; 
    const z = (Math.random() - 0.5) * tunnelLength; // Centered around 0
    
    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius;
    positions[i3 + 2] = z;
    
    // Random particle sizes
    sizes[i] = 0.1 + Math.random() * 0.25; // Slightly larger particles maybe?
    
    // Blue to cyan color gradient (kept from reference)
    const color = new THREE.Color();
    color.setHSL(0.6 + Math.random() * 0.1, 0.8, 0.6 + Math.random() * 0.2);
    
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }
  
  // Add attributes to geometry
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  // Create particle shader (adapted from reference)
  const particleShader = {
    uniforms: {
      uTime: { value: 0 }, // Standardized to uTime
      pointTexture: { value: createParticleTexture() }
    },
    vertexShader: `
      precision highp float; // Added precision
      attribute float size;
      varying vec3 vColor;
      uniform float uTime; // Standardized to uTime
      
      // --- ADAPTATION NEEDED for animation range ---
      const float animationLength = 480.0; // Match tunnel length
      // --- END ADAPTATION PLACEHOLDER ---

      void main() {
        vColor = color; // Pass attribute color to fragment shader
        
        // Simple animation - adapt range
        vec3 pos = position;
        // Adjust animation to wrap around the tunnel length
        pos.z = mod(pos.z - uTime * 5.0, animationLength) - animationLength / 2.0; 
        
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        // Adjust point size calculation if needed
        gl_PointSize = size * (800.0 / -mvPosition.z); 
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float; // Added precision
      uniform sampler2D pointTexture;
      varying vec3 vColor;
      
      void main() {
        vec4 texColor = texture2D(pointTexture, gl_PointCoord);
        if (texColor.a < 0.1) discard; // Discard transparent pixels early

        gl_FragColor = vec4(vColor, 1.0) * texColor;
        
        // Add some glow effect (kept from reference)
        float brightness = length(gl_PointCoord - vec2(0.5)) * 2.0;
        brightness = 1.0 - brightness;
        brightness = pow(brightness, 3.0);
        
        gl_FragColor.rgb += vec3(0.2, 0.5, 1.0) * brightness * 0.5;
      }
    `
  };
  
  // Create particle material
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: particleShader.uniforms,
    vertexShader: particleShader.vertexShader,
    fragmentShader: particleShader.fragmentShader,
    blending: THREE.AdditiveBlending,
    depthTest: false, // Render particles on top
    transparent: true,
    vertexColors: true // Ensure vertex colors are used
  });
  
  // Create particle system
  const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
  particleSystem.name = 'tunnelParticles'; // Give it a name
  particleSystem.position.z = -240; // Adjust position to align with tunnel center
  particleSystem.renderOrder = 2; // Render after smoke

  return particleSystem;
}

/**
 * Updates the tunnel animation
 * @param tunnelGroup The tunnel group to update
 * @param elapsedTime The elapsed time for animation
 * @param camera Optional camera for advanced effects (from the advanced implementation)
 */
export function updateTunnel(tunnelGroup, elapsedTime, camera) {
  // --- Update Shared Material Uniforms --- 
  // Only need to update the shared material once
  if (tunnelGroup.userData.segments && tunnelGroup.userData.segments.length > 0) {
      // const material = tunnelGroup.userData.segments[0].material as THREE.ShaderMaterial; // Removed TS assertion
      const material = tunnelGroup.userData.segments[0].material;
      // Check if it's a ShaderMaterial before accessing uniforms
      if (material && material instanceof THREE.ShaderMaterial) {
          material.uniforms.uTime.value = elapsedTime;
    if (camera) {
              if (material.uniforms.uCameraPos) { 
                  material.uniforms.uCameraPos.value.copy(camera.position);
              }
              if (material.uniforms.uViewMatrix) { 
                  material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
              } 
          }
      }
  }
  
  // --- Segment Repositioning Logic --- (NEW)
  // Check necessary properties exist before proceeding
  if (camera && 
      tunnelGroup.userData.segments && 
      tunnelGroup.userData.segmentLength && 
      tunnelGroup.userData.numSegments > 0) 
  {
      // const segments = tunnelGroup.userData.segments as THREE.Mesh[]; // Removed TS assertion
      // const segmentLength = tunnelGroup.userData.segmentLength as number; // Removed TS assertion
      // const numSegments = tunnelGroup.userData.numSegments as number; // Removed TS assertion
      const segments = tunnelGroup.userData.segments; // Assume it's an array of Meshes
      const segmentLength = tunnelGroup.userData.segmentLength;
      const numSegments = tunnelGroup.userData.numSegments;
      const cameraZ = camera.position.z;
      // Increase buffer: Reposition when segment center is fully behind camera
      const cameraBuffer = segmentLength * 1.0; 
 
      // Find the segment currently furthest ahead (most negative Z)
      let furthestSegmentZ = 0.0;
      for (const segment of segments) {
        if (segment.position.z < furthestSegmentZ) {
          furthestSegmentZ = segment.position.z;
        }
      }
      
      // Iterate through segments to check if they should be moved
      for (const segment of segments) {
          const segmentFrontEdgeZ = segment.position.z + segmentLength / 2.0;
          
          // Check if the FRONT edge of the segment is behind the camera + buffer
          if (segmentFrontEdgeZ > cameraZ + cameraBuffer) { 
              // This segment is behind the camera, move it to the front
              const newZ = furthestSegmentZ - segmentLength;
              console.log(`Repositioning tunnel segment ${segment.name} from ${segment.position.z.toFixed(1)} to ${newZ.toFixed(1)} (behind camera)`);
              segment.position.z = newZ;
              furthestSegmentZ = newZ; // Update the furthest Z for subsequent moves in the same frame
           }
      }
   }
   // --- End Segment Repositioning ---
 
  // --- Update End Cap --- 
  const endCapMesh = tunnelGroup.userData.endCapMesh;
  const mainTunnelMaterial = tunnelGroup.userData.segments?.[0]?.material;
  
  if (endCapMesh && mainTunnelMaterial instanceof THREE.ShaderMaterial && camera) {
    const endCapMaterial = endCapMesh.material;
    if (endCapMaterial instanceof THREE.ShaderMaterial) {
      endCapMaterial.uniforms.uTime.value = elapsedTime;
      endCapMaterial.uniforms.uCameraPos.value.copy(camera.position);
    }

    // Calculate target Z position based on camera and main tunnel's effect distance
    const effectDistance = mainTunnelMaterial.uniforms.uEffectDistance?.value ?? 4500.0; // Default if uniform missing
    const targetZ = camera.position.z - effectDistance;
    endCapMesh.position.z = targetZ;
    // Ensure cap stays centered (X and Y = 0)
    endCapMesh.position.x = 0;
    endCapMesh.position.y = 0;
    // Ensure it faces the camera correctly (it's a CircleGeometry in XY plane)
    // No rotation needed if it stays at Z
  } 
  // --- End Update End Cap ---
  
  // Update the smoke layer (NEEDS ADJUSTMENT for segmented tunnel)
  const smokeMesh = tunnelGroup.getObjectByName('nebulaSmokeLayer');
  if (smokeMesh && smokeMesh instanceof THREE.Mesh &&
      smokeMesh.material instanceof THREE.ShaderMaterial && camera) {
    smokeMesh.material.uniforms.uTime.value = elapsedTime;
    smokeMesh.material.uniforms.uCameraPos.value.copy(camera.position);
  }
  
  // Update the NEW hyperspace smoke layer
  const hyperspaceLayerMesh = tunnelGroup.getObjectByName('hyperspaceSmokeLayer');
  if (hyperspaceLayerMesh && hyperspaceLayerMesh instanceof THREE.Mesh &&
      hyperspaceLayerMesh.material instanceof THREE.ShaderMaterial && camera) {
    hyperspaceLayerMesh.material.uniforms.uTime.value = elapsedTime;
    hyperspaceLayerMesh.material.uniforms.uCameraPos.value.copy(camera.position);
  }

  // Update the particle system (NEEDS ADJUSTMENT for segmented tunnel)
  /*
  const particleSystem = tunnelGroup.getObjectByName('tunnelParticles');
  if (particleSystem && particleSystem instanceof THREE.Points && 
      particleSystem.material instanceof THREE.ShaderMaterial) {
    particleSystem.material.uniforms.uTime.value = elapsedTime;
  }
  */
  
  // Update ring animations (NEEDS ADJUSTMENT)
  /*
  tunnelGroup.children.forEach(child => {
    if (child.name !== 'tunnelMain' && child.name !== 'nebulaSmokeLayer') {
      // ... (ring animation logic) ... 
    }
  });
  */
  
  // Add camera-based motion to the entire tunnel group (This should still work)
  if (camera) {
    const cameraOffset = new THREE.Vector3();
    cameraOffset.copy(camera.position).multiplyScalar(0.02);
    cameraOffset.x = Math.max(-1, Math.min(1, cameraOffset.x));
    cameraOffset.y = Math.max(-1, Math.min(1, cameraOffset.y));
    // --- Temporarily disable tunnel rotation based on camera offset --- 
    // tunnelGroup.rotation.x = cameraOffset.y * 0.05;
    // tunnelGroup.rotation.y = cameraOffset.x * 0.05;
    // ------------------------------------------------------------
  }
} 