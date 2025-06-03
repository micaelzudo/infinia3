#ifndef ETHEREAL_BLOOM_TRANSFORM
#define ETHEREAL_BLOOM_TRANSFORM

// Define constants locally if needed
#define TWO_PI 6.28318530718

// Assuming noise functions (like fbm) are available from the main shader
// Uniforms expected to be passed from the main material
// REMOVED uniform float uEtherealTime;      // Declared in main shader
// REMOVED uniform float uEtherealNoiseScale; // Declared in main shader
// REMOVED uniform float uEtherealSpeed;     // Declared in main shader
// REMOVED uniform float uEtherealHueSpeed;  // Declared in main shader
// REMOVED uniform float uEtherealIntensity; // Declared in main shader

// Function to apply the transformation
// Uniforms are accessed directly as they are in the global scope of the final shader
vec3 applyEtherealBloomTransform(vec3 baseColor, vec3 samplePos, float time) {
    // --- TEMPORARY DEBUG: Return base color immediately ---
    // return baseColor;
    // --- END DEBUG ---

    // 1. Granular Noise Pattern
    // Use a higher frequency noise, perhaps multiple layers
    float granularNoiseFreq1 = uEtherealNoiseScale * 9.0; // Slightly increased freq
    float granularNoiseFreq2 = uEtherealNoiseScale * 20.0; // Slightly increased freq
    float noiseTime = time * uEtherealSpeed;

    vec3 noisePos1 = samplePos * granularNoiseFreq1 + vec3(0.0, 0.0, noiseTime * 0.7);
    vec3 noisePos2 = samplePos * granularNoiseFreq2 + vec3(0.0, 0.0, -noiseTime * 1.1);

    // Use fbm or a combination of noises if fbm is available
    // Use fbmValue3D(vec3 p) instead of fbm(vec3 p, int octaves)
    // fbmValue3D returns a value roughly in [0, 1]
    // float granularNoise = fbm(noisePos1, 4) * 0.6 + fbm(noisePos2, 5) * 0.4; // Original call
    float noise1 = fbmValue3D(noisePos1);
    float noise2 = fbmValue3D(noisePos2);
    float granularNoise = noise1 * 0.5 + noise2 * 0.5; // Combine differently

    // Threshold the noise to create sparser specular highlights
    float specularPattern = smoothstep(0.60, 0.75, granularNoise); // Adjust threshold slightly

    if (specularPattern < 0.01) {
        return baseColor; // No effect if pattern is not active
    }

    // 2. Rainbow Color Shift
    float hueTimeShift = time * uEtherealHueSpeed; // Faster hue shift via uniform
    // Use noise value and position slightly for variation in hue
    // float hueNoiseInfluence = fbm(samplePos * uEtherealNoiseScale * 0.5 + hueTimeShift * 0.1, 2); // Original call
    float hueNoiseInfluence = fbmValue3D(samplePos * uEtherealNoiseScale * 0.5 + hueTimeShift * 0.1); // Use fbmValue3D
    float rainbowHue = fract(hueTimeShift + hueNoiseInfluence * 2.5); // Increased influence slightly

    // Create a vibrant rainbow color - cycle through HSL or use sin waves
    vec3 rainbowColor = vec3(
        0.5 + 0.5 * cos(rainbowHue * TWO_PI + 0.0),
        0.5 + 0.5 * cos(rainbowHue * TWO_PI + TWO_PI / 3.0),
        0.5 + 0.5 * cos(rainbowHue * TWO_PI + 2.0 * TWO_PI / 3.0)
    );

    // Additive blending, controlled by intensity and the specular pattern
    // Reduce brightness significantly here
    // vec3 transformedColor = baseColor + rainbowColor * specularPattern * uEtherealIntensity * 0.5; // Lower multiplier
    vec3 transformedColor = baseColor + rainbowColor * specularPattern * uEtherealIntensity * 1.0; // Increased multiplier for more bloom/glow

    // Optional: Clamp or tone map if needed, but additive might bloom naturally
    // transformedColor = clamp(transformedColor, 0.0, 1.5); // Allow some HDR for bloom

    return transformedColor;
}

#endif // ETHEREAL_BLOOM_TRANSFORM 