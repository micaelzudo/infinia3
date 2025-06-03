precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos; // World position on the cylinder surface

uniform float uTime;
uniform vec3 uCameraPos;    // Camera world position
uniform vec3 uColor1;       // Neon color 1
uniform vec3 uColor2;       // Neon color 2
uniform vec3 uColor3;       // Neon color 3
uniform vec3 uColor4;       // Added color
uniform float uNoiseScale;   // Noise detail scale
uniform float uSpeed;        // Noise animation speed
uniform float uBrightness;   // Overall brightness
uniform float uDensity;      // Controls how much noise contributes to density
uniform float uSmokeRadius;  // The radius of the smoke cylinder volume
uniform int uNumSteps;       // Max ray marching steps
uniform float uStepSize;     // Step size along the ray
uniform float uBackgroundInfluenceStrength; // Added uniform

// --- Add Hyperspace Disturbance Uniforms ---
uniform float uHyperspaceNoiseScale;
uniform float uHyperspaceSpeed;
uniform float uDisturbanceStrength;

// --- Add Hyperspace COLOR Disturbance Uniforms ---
uniform vec3 uHyperspaceColor1;
uniform vec3 uHyperspaceColor2;
uniform vec3 uHyperspaceColor3;
uniform vec3 uHyperspaceColor4;
uniform float uHyperspaceHueSpeed;

// --- Noise Functions (copied from tunnel.frag for self-containment) ---
float rand(vec3 co){ // Use 3D rand
    return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp); // Smoothstep interpolation

    // Sample 8 corners of the cube
    float v000 = rand(ip + vec3(0.0, 0.0, 0.0));
    float v100 = rand(ip + vec3(1.0, 0.0, 0.0));
    float v010 = rand(ip + vec3(0.0, 1.0, 0.0));
    float v110 = rand(ip + vec3(1.0, 1.0, 0.0));
    float v001 = rand(ip + vec3(0.0, 0.0, 1.0));
    float v101 = rand(ip + vec3(1.0, 0.0, 1.0));
    float v011 = rand(ip + vec3(0.0, 1.0, 1.0));
    float v111 = rand(ip + vec3(1.0, 1.0, 1.0));

    // Trilinear interpolation
    return mix(
        mix(mix(v000, v100, fp.x), mix(v010, v110, fp.x), fp.y),
        mix(mix(v001, v101, fp.x), mix(v011, v111, fp.x), fp.y),
        fp.z
    );
}

// 3D Fractional Brownian Motion (FBM)
float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    // Define rotation matrices (can be simplified if needed)
    mat3 rotX = mat3(1.0, 0.0, 0.0, 0.0, cos(0.5), -sin(0.5), 0.0, sin(0.5), cos(0.5));
    mat3 rotY = mat3(cos(0.5), 0.0, sin(0.5), 0.0, 1.0, 0.0, -sin(0.5), 0.0, cos(0.5));
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise(p);
        p = rotX * rotY * p * 2.1; // Rotate and scale for each octave
        amplitude *= 0.5;
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
    vec3 rayDir = normalize(vWorldPos - uCameraPos);
    vec3 accumulatedColor = vec3(0.0);
    float accumulatedAlpha = 0.0;
    vec3 rayOrigin = vWorldPos;
    rayDir = normalize(uCameraPos - vWorldPos);

    // Define base scales and speeds from uniforms
    float baseNoiseScale = uNoiseScale;
    float baseSpeed = uSpeed;

    // --- Define Scales and Speeds for Different Layers ---
    // Density Layers
    float densityBaseScale = baseNoiseScale * 1.0;
    float densityDetailScale = baseNoiseScale * 4.0;
    float densityBaseSpeed = baseSpeed * 0.8;
    float densityDetailSpeed = baseSpeed * 1.5;
    // Composition Layer (controls local variations)
    float compScale = baseNoiseScale * 0.6; // Slightly finer composition noise
    float compSpeed = baseSpeed * 0.25;
    // Color Layers
    float colorBaseScale = baseNoiseScale * 0.9;
    float colorWarpScale = baseNoiseScale * 3.0; // Increased warp scale
    float colorBaseSpeed = baseSpeed * 0.7;
    float colorWarpSpeed = baseSpeed * 1.3; // Increased warp speed
    // Background Sim Layer
    float bgScale = baseNoiseScale * 1.2;
    float bgSpeed = baseSpeed * 0.4;
    float hueNoiseScale = uNoiseScale * 2.0; 
    float hueSpeedFactor = 1.1;

    for (int i = 0; i < uNumSteps; i++) {
        float currentDist = float(i) * uStepSize + uStepSize * 0.1;
        vec3 samplePos = rayOrigin + rayDir * currentDist;

        if (isInsideSmokeCylinder(samplePos, uSmokeRadius)) {
            
            // --- Calculate Hyperspace Disturbance Offset & Value ---
            float hyperspaceTimeX = uTime * uHyperspaceSpeed * 0.4;
            float hyperspaceTimeY = uTime * uHyperspaceSpeed * 0.6;
            float hyperspaceTimeZ = uTime * uHyperspaceSpeed * 0.9;
            vec3 hyperspaceNoisePos = samplePos * uHyperspaceNoiseScale + vec3(hyperspaceTimeX, hyperspaceTimeY, hyperspaceTimeZ);
            float largeWave = sin(samplePos.z * uHyperspaceNoiseScale * 0.1 + hyperspaceTimeZ * 0.2) * 0.5 + 0.5;
            float disturbanceValue = fbmWavy(hyperspaceNoisePos) * largeWave;
            vec3 disturbanceOffset = vec3(disturbanceValue * 0.6, disturbanceValue * 0.6, disturbanceValue * 0.3) * uDisturbanceStrength;
            vec3 disturbedPos = samplePos + disturbanceOffset;

            // --- Calculate Local Hyperspace COLOR Properties --- (Used for coordinate disturbance)
            vec3 hsColorNoisePos = disturbedPos * uHyperspaceNoiseScale * 1.5 + vec3(-hyperspaceTimeY, -hyperspaceTimeZ, hyperspaceTimeX); // Use disturbedPos
            vec2 hsWarpOffset = vec2(fbmWavy(hsColorNoisePos + 10.0), fbmWavy(hsColorNoisePos + 20.0)) * 0.5;
            float hsColorNoise = fbmWavy(hsColorNoisePos + vec3(hsWarpOffset, 0.0));

            vec3 hsBaseColor; // Calculate the base hyperspace color mix
            float hsSegment = 1.0 / 3.0;
            float hsMixFactor = hsColorNoise * 0.5 + 0.5;
            float hs_w1 = pow(1.0 - clamp(hsMixFactor / hsSegment, 0.0, 1.0), 2.0);
            float hs_w2 = pow(1.0 - clamp(abs(hsMixFactor - hsSegment) / hsSegment, 0.0, 1.0), 2.0);
            float hs_w3 = pow(1.0 - clamp(abs(hsMixFactor - 2.0 * hsSegment) / hsSegment, 0.0, 1.0), 2.0);
            float hs_w4 = pow(clamp((hsMixFactor - 2.0 * hsSegment) / hsSegment, 0.0, 1.0), 2.0);
            hsBaseColor = uHyperspaceColor1 * hs_w1 + uHyperspaceColor2 * hs_w2 + uHyperspaceColor3 * hs_w3 + uHyperspaceColor4 * hs_w4;
            hsBaseColor /= (hs_w1 + hs_w2 + hs_w3 + hs_w4 + 0.001);

            float hsGlobalHueShift = uTime * uHyperspaceHueSpeed + disturbedPos.z * 0.005;
            // vec3 finalHyperspaceColor = hueShift(hsBaseColor, hsGlobalHueShift); // We mainly need the shift amount and disturbance value

            // --- Use disturbedPos for NEBULA DENSITY calculations ---
            // --- Composition Noise --- // Controls local behavior
            vec3 compNoisePos = disturbedPos * compScale + vec3(0.0, 0.0, uTime * compSpeed);
            float compNoise = fbm(compNoisePos, 3); // Value range roughly -0.5 to 0.5
            float compFactor = compNoise * 0.5 + 0.5; // Map to 0-1 range

            // --- Density Calculation (Heavily modulated by composition) ---
            vec3 densityNoisePos = disturbedPos * densityBaseScale + vec3(0.0, 0.0, uTime * densityBaseSpeed);
            vec3 detailNoisePos = disturbedPos * densityDetailScale + vec3(0.0, 0.0, uTime * densityDetailSpeed);
            float baseDensityNoise = fbm(densityNoisePos, 5);
            float detailDensityNoise = fbm(detailNoisePos, 4);
            float combinedDensityNoise = baseDensityNoise * 0.7 + detailDensityNoise * 0.3; // Mix base and detail

            // Use composition noise to create strong variations, including near-zero density areas
            float modulatedDensityNoise = combinedDensityNoise * (0.2 + compFactor * 0.8); // Scale noise based on comp
            float density = smoothstep(0.4, 0.6, modulatedDensityNoise); // Apply smoothstep
            density = pow(density, 2.0) * uDensity * (0.1 + compFactor * 1.4); // Heavily modulate final density by comp factor

            // --- Background Interaction Simulation ---
            vec3 bgNoisePos = disturbedPos * bgScale + vec3(0.0, 0.0, uTime * bgSpeed);
            float bgNoise = fbm(bgNoisePos, 3);
            float bgInfluence = smoothstep(0.45, 0.55, bgNoise); // Sharper influence transition
            
            // Slightly reduce density based on bg simulation
            density *= (1.0 - bgInfluence * 0.3 * uBackgroundInfluenceStrength); 

            if (density > 0.005) { 
                // --- Create COLOR Coordinate Disturbance based on Hyperspace Pattern ---
                float colorDisturbanceMagnitude = hsColorNoise * disturbanceValue * 2.0; // Example scaling
                vec3 colorCoordOffset = normalize(hsBaseColor - 0.5) * colorDisturbanceMagnitude; // Offset direction based on hsColor
                vec3 disturbedColorPos = disturbedPos + colorCoordOffset;

                // --- NEBULA Color Calculation (Using DISTURBED Color Coordinates) ---
                vec3 colorNoiseBasePos = disturbedColorPos * colorBaseScale + vec3(0.0, 0.0, uTime * colorBaseSpeed);
                vec3 warpNoisePos = disturbedColorPos * colorWarpScale + vec3(0.0, 0.0, uTime * colorWarpSpeed);
                vec2 warpOffset = vec2(fbm(warpNoisePos, 3), fbm(warpNoisePos + vec3(5.2, 1.3, 0.0), 3));
                float localWarpIntensity = 0.5 + compFactor * 1.5; // Stronger warp intensity, varied by comp
                vec3 warpedColorNoisePos = colorNoiseBasePos + vec3(warpOffset * localWarpIntensity, 0.0);
                float colorNoise = fbm(warpedColorNoisePos, 4);

                // Mix nebula base colors (using disturbed pattern via colorNoise)
                vec3 baseColor; 
                float segment = 1.0 / 3.0;
                float mixFactor = colorNoise * 0.5 + 0.5;
                float w1 = pow(1.0 - clamp(mixFactor / segment, 0.0, 1.0), 3.0);
                float w2 = pow(1.0 - clamp(abs(mixFactor - segment) / segment, 0.0, 1.0), 3.0);
                float w3 = pow(1.0 - clamp(abs(mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 3.0);
                float w4 = pow(clamp((mixFactor - 2.0 * segment) / segment, 0.0, 1.0), 3.0);
                baseColor = uColor1 * w1 + uColor2 * w2 + uColor3 * w3 + uColor4 * w4;
                baseColor /= (w1 + w2 + w3 + w4 + 0.001);

                // --- Background Interaction and Nebula's Local Hue Shift --- 
                vec3 simulatedBgColor = mix(vec3(0.1, 0.0, 0.4), vec3(0.4, 0.1, 0.6), bgNoise * 0.5 + 0.5);
                vec3 colorAfterBgMix = mix(baseColor, simulatedBgColor, bgInfluence * 0.5 * uBackgroundInfluenceStrength);
                // Calculate Nebula's own hue shift amount (using original disturbedPos for this)
                vec3 hueNoisePos = disturbedPos * hueNoiseScale + vec3(0.0, 0.0, uTime * hueSpeedFactor);
                float hueNoise = fbm(hueNoisePos, 3);
                float variedHueShiftAmount = (hueNoise * 0.5 + 0.5 - 0.5) * 0.9; // Nebula's local shift
                // Apply Nebula's local hue shift
                vec3 sampleColor = hueShift(colorAfterBgMix, variedHueShiftAmount); 
                // --- End Nebula Color Calculation ---
                
                // --- Accumulation (Normal Blending) ---
                float alphaDensityFactor = 5.0; // Increase factor for alpha calculation
                float sampleAlpha = (1.0 - exp(-density * uStepSize * alphaDensityFactor)) * (1.0 - accumulatedAlpha);
                sampleAlpha = clamp(sampleAlpha, 0.0, 1.0);

                accumulatedColor += sampleColor * sampleAlpha * uBrightness; // Use the final nebula color
                accumulatedAlpha += sampleAlpha;

                if (accumulatedAlpha > 0.99) break;
            }
        }

        if (currentDist > uSmokeRadius * 3.5) break;
    }

    gl_FragColor = vec4(accumulatedColor, accumulatedAlpha);

    if (accumulatedAlpha < 0.001) {
       discard;
    }
} 