precision highp float;

varying vec2 vUv;
varying vec3 vWorldPosition; // World position on the cylinder surface

uniform float uTime;
uniform vec3 uCameraPos;    // Camera world position
uniform vec3 uColor1;       // Neon color 1 (e.g., Magenta)
uniform vec3 uColor2;       // Neon color 2 (e.g., Cyan)
uniform vec3 uColor3;       // Neon color 3 (e.g., Yellow)
uniform vec3 uColor4;       // Neon color 4 (e.g., Lime Green)
uniform float uNoiseScale;   // Noise detail scale (controls wave size)
uniform float uSpeed;        // Noise animation speed
uniform float uBrightness;   // Overall brightness
uniform float uDensity;      // Controls how much noise contributes to density
uniform float uSmokeRadius;  // The radius of the smoke cylinder volume
uniform int uNumSteps;       // Max ray marching steps
uniform float uStepSize;     // Step size along the ray
uniform float uHueSpeed;     // Speed of rainbow hue shift

// --- Noise Functions (Simplified FBM for wavy effect) ---
// Hash function (basic)
float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Value Noise (simpler than reference FBM for broader waves)
float valueNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    float v000 = hash(i + vec3(0,0,0));
    float v100 = hash(i + vec3(1,0,0));
    float v010 = hash(i + vec3(0,1,0));
    float v110 = hash(i + vec3(1,1,0));
    float v001 = hash(i + vec3(0,0,1));
    float v101 = hash(i + vec3(1,0,1));
    float v011 = hash(i + vec3(0,1,1));
    float v111 = hash(i + vec3(1,1,1));

    return mix(mix(mix(v000, v100, f.x), mix(v010, v110, f.x), f.y),
               mix(mix(v001, v101, f.x), mix(v011, v111, f.x), f.y), f.z);
}

// Simple FBM for wavy patterns
float fbmWavy(vec3 p) {
    float value = 0.0;
    float amplitude = 0.6; // Start with higher amplitude
    float frequency = 1.0;
    int octaves = 3; // Fewer octaves for broader waves

    for (int i = 0; i < octaves; i++) {
        value += amplitude * valueNoise(p * frequency);
        frequency *= 1.8; // Lower lacunarity
        amplitude *= 0.4; // Higher gain drop-off
    }
    return value;
}
// --- End Noise Functions ---

// Function to check if a point is inside the smoke cylinder
bool isInsideSmokeCylinder(vec3 point, float radius) {
    return length(point.xy) < radius;
}

// Simple Hue Shift function
vec3 hueShift( vec3 color, float hue )
{
    const vec3 k = vec3( 0.57735, 0.57735, 0.57735 );
    float cosAngle = cos( hue );
    return vec3( color * cosAngle + cross( k, color ) * sin( hue ) + k * dot( k, color ) * ( 1.0 - cosAngle ) );
}

void main() {
    vec3 rayDir = normalize(uCameraPos - vWorldPosition); // March towards camera
    vec3 rayOrigin = vWorldPosition;
    vec3 accumulatedColor = vec3(0.0);
    float accumulatedAlpha = 0.0;

    // Time-based offsets for wavy motion
    float timeX = uTime * uSpeed * 0.4;
    float timeY = uTime * uSpeed * 0.6;
    float timeZ = uTime * uSpeed * 0.9; // Main scroll direction
    float hueTime = uTime * uHueSpeed;

    for (int i = 0; i < uNumSteps; i++) {
        float currentDist = float(i) * uStepSize + uStepSize * 0.05; // Add small jitter
        vec3 samplePos = rayOrigin + rayDir * currentDist;

        if (!isInsideSmokeCylinder(samplePos, uSmokeRadius)) {
             // Optimization: if we exit the cylinder near the start, we can likely break early
            // if (i > 5 && accumulatedAlpha < 0.01) break;
            continue; // Skip samples outside the volume
        }

        // --- Wavy Density Calculation ---
        vec3 densityNoisePos = samplePos * uNoiseScale + vec3(timeX, timeY, timeZ);
        // Add a secondary, slower, larger-scale wave modulation
        float largeWave = sin(samplePos.z * uNoiseScale * 0.1 + timeZ * 0.2) * 0.5 + 0.5; // Slow Z-wave
        float densityNoise = fbmWavy(densityNoisePos) * largeWave; // Use wavy fbm, modulated by large wave

        // Map noise to density (0-1 range, smooth transition)
        // Make it wispy: noise value needs to be relatively high to contribute density
        float density = smoothstep(0.65, 0.75, densityNoise); // Increase lower bound for more selectivity
        density *= uDensity; // Apply overall density uniform


        if (density > 0.001) {
            // --- Hyperspace Rainbow Color Calculation ---
            vec3 colorNoisePos = samplePos * uNoiseScale * 1.5 + vec3(-timeY, -timeZ, timeX); // Different time offsets
             // Use domain warping for more swirling colors
            vec2 warpOffset = vec2(fbmWavy(colorNoisePos + 10.0), fbmWavy(colorNoisePos + 20.0)) * 0.5;
            float colorNoise = fbmWavy(colorNoisePos + vec3(warpOffset, 0.0)); // Apply warp

            // Mix between 4 bright neon colors based on noise
            vec3 baseColor;
            float segment = 1.0 / 3.0; // For 4 colors
            float mixFactor = colorNoise * 0.5 + 0.5; // Map noise to 0-1

            float w1 = pow(1.0 - clamp(mixFactor / segment, 0.0, 1.0), 2.0); // Softer transition power
            float w2 = pow(1.0 - clamp(abs(mixFactor - segment) / segment, 0.0, 1.0), 2.0);
            float w3 = pow(1.0 - clamp(abs(mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 2.0);
            float w4 = pow(clamp((mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 2.0);

            baseColor = uColor1 * w1 + uColor2 * w2 + uColor3 * w3 + uColor4 * w4;
            baseColor /= (w1 + w2 + w3 + w4 + 0.001); // Normalize weights

            // Apply global rainbow hue shift over time
            float globalHueShift = hueTime + samplePos.z * 0.005; // Add slight depth-based hue shift
            vec3 sampleColor = hueShift(baseColor, globalHueShift);


            // --- Accumulation ---
             // Adjust alpha factor for desired opacity, make this layer potentially less dense than the base
            float alphaDensityFactor = 2.0;
            float sampleAlpha = (1.0 - exp(-density * uStepSize * alphaDensityFactor)) * (1.0 - accumulatedAlpha);
            sampleAlpha = clamp(sampleAlpha, 0.0, 1.0);

            accumulatedColor += sampleColor * sampleAlpha * uBrightness;
            accumulatedAlpha += sampleAlpha;

            // Break early if opaque enough
            if (accumulatedAlpha > 0.98) break;
        }

        // Optional: Break if ray goes too far without hitting much
        // if (currentDist > uSmokeRadius * 4.0 && accumulatedAlpha < 0.05) break;
    }

    // Discard fully transparent pixels
    if (accumulatedAlpha < 0.001) {
       discard;
    }

    // Output final color and alpha
    gl_FragColor = vec4(accumulatedColor, accumulatedAlpha);
} 