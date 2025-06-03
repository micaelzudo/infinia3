precision highp float;

varying vec2 vUv;
varying vec3 vWorldPos;
uniform float uTime;
uniform float uNebulaIntensity;
uniform float uStarDensity;
uniform float uQuantumEffectStrength;
uniform float uEtherealPulseSpeed;
uniform float uRayIntensity;
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
uniform float uQuantumSeed;

// Hash function for pseudo-random generation
vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    
    return fract(sin(p) * 43758.5453123);
}

// Simple noise function
float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    
    float v00 = fract(sin(dot(ip + vec2(0.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
    float v10 = fract(sin(dot(ip + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
    float v01 = fract(sin(dot(ip + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
    float v11 = fract(sin(dot(ip + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
    
    return mix(mix(v00, v10, fp.x), mix(v01, v11, fp.x), fp.y);
}

// Fractal Brownian Motion for more complex patterns
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

// Star field generation
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

// Simplified quantum noise function
float quantumNoise(vec3 position) {
    // Simple noise based on position
    vec3 p = floor(position * 10.0);
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// Simple FBM for quantum effects
vec3 quantumFBM(vec3 position) {
    // Create simple fbm effect manually
    float f1 = quantumNoise(position);
    float f2 = quantumNoise(position * 2.0);
    float f3 = quantumNoise(position * 4.0);
    
    return vec3(f1, f2, f3) * 0.5 + 0.5;
}

// Simplified point glow function
float pointGlow(vec3 samplePos, vec3 glowCenter, float radius) {
    float dist = length(samplePos - glowCenter);
    float normalizedDist = dist / radius;
    
    // Hard cutoff at radius
    if (normalizedDist > 1.0) return 0.0;
    
    // Apply falloff
    float falloff = pow(1.0 - normalizedDist, 2.0);
    
    return falloff;
}

// Simplified volumetric light rays
float volumetricLightRays(vec3 samplePos, vec3 lightPos, vec3 direction, float radius, float density) {
    // Create synthetic viewpoint
    vec3 viewPos = lightPos - direction * radius;
    
    // Direction vectors
    vec3 viewToSample = normalize(samplePos - viewPos);
    vec3 viewToLight = normalize(lightPos - viewPos);
    
    // Calculate ray effect
    float angle = dot(viewToSample, viewToLight);
    float angleContribution = pow(max(0.0, angle), 32.0);
    
    // Distance calculation
    float t = dot(samplePos - viewPos, viewToLight) / dot(viewToLight, viewToLight);
    t = clamp(t, 0.0, 1.0);
    vec3 closestPoint = viewPos + viewToLight * t;
    float rayDist = length(samplePos - closestPoint);
    
    // Ray intensity
    float rayThickness = mix(0.5, 0.1, t);
    float rayIntensity = smoothstep(rayThickness, 0.0, rayDist);
    
    // Final calculation
    rayIntensity *= angleContribution * density;
    return rayIntensity / (1.0 + rayDist * rayDist * 2.0);
}

// Simplified pulsing glow
float pulsingGlow(vec3 position, float time, float speed, float intensity) {
    float phaseShift = dot(position, vec3(0.1, 0.2, 0.3));
    float pulse = 0.5 + 0.5 * sin(time * speed + phaseShift);
    return pulse * intensity;
}

// Simplified quantum probability cloud (might be complex to integrate fully)
vec3 quantumProbabilityCloud(vec3 position, float seed) {
    // Create a virtual center based on seed
    vec3 center = vec3(
        sin(seed * 12.456) * 10.0,
        cos(seed * 45.789) * 10.0,
        sin(seed * 78.123) * 10.0
    );
    
    // Distance calculations
    float dist = length(position - center);
    float normDist = min(dist / 15.0, 1.0);
    
    // Create quantum effect
    float effect = (1.0 - normDist) * exp(-normDist * 3.0);
    
    // Create color based on position and seed
    float hue = fract(seed + position.x * 0.01 + position.y * 0.02 + position.z * 0.03);
    
    // Simple hue to RGB conversion
    vec3 color;
    float h = hue * 6.0;
    float i = floor(h);
    float f = h - i;
    
    if (i < 1.0) color = vec3(1.0, f, 0.0);
    else if (i < 2.0) color = vec3(1.0-f, 1.0, 0.0);
    else if (i < 3.0) color = vec3(0.0, 1.0, f);
    else if (i < 4.0) color = vec3(0.0, 1.0-f, 1.0);
    else if (i < 5.0) color = vec3(f, 0.0, 1.0);
    else color = vec3(1.0, 0.0, 1.0-f);
    
    return color * effect;
}

// Apply ethereal glow effects
vec3 applyEtherealGlowEffects(vec3 baseColor, vec3 glowColors, float glowIntensity) {
    return baseColor + glowColors * glowIntensity;
}

// 2D Noise and FBM from reference (replaces the simple 2D noise if preferred)
float rand_ref(vec2 co){ // Renamed to avoid conflict
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float noise_ref2d(vec2 p) { // Renamed to avoid conflict
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    float v00 = rand_ref(ip + vec2(0.0, 0.0));
    float v10 = rand_ref(ip + vec2(1.0, 0.0));
    float v01 = rand_ref(ip + vec2(0.0, 1.0));
    float v11 = rand_ref(ip + vec2(1.0, 1.0));
    return mix(mix(v00, v10, fp.x), mix(v01, v11, fp.x), fp.y);
}

mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

float fbm_ref2d(vec2 p, int octaves) { // Renamed to avoid conflict
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise_ref2d(p);
        p = rot * p * 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// 3D Noise Functions (from Reference)
float rand_ref3d(vec3 co){ // Renamed to avoid conflict
    return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453);
}

float noise_ref3d(vec3 p) { // Renamed to avoid conflict
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);

    float v000 = rand_ref3d(ip + vec3(0.0, 0.0, 0.0));
    float v100 = rand_ref3d(ip + vec3(1.0, 0.0, 0.0));
    float v010 = rand_ref3d(ip + vec3(0.0, 1.0, 0.0));
    float v110 = rand_ref3d(ip + vec3(1.0, 1.0, 0.0));
    float v001 = rand_ref3d(ip + vec3(0.0, 0.0, 1.0));
    float v101 = rand_ref3d(ip + vec3(1.0, 0.0, 1.0));
    float v011 = rand_ref3d(ip + vec3(0.0, 1.0, 1.0));
    float v111 = rand_ref3d(ip + vec3(1.0, 1.0, 1.0));

    return mix(
        mix(mix(v000, v100, fp.x), mix(v010, v110, fp.x), fp.y),
        mix(mix(v001, v101, fp.x), mix(v011, v111, fp.x), fp.y),
        fp.z
    );
}

float fbm_ref3d(vec3 p, int octaves) { // Renamed to avoid conflict
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < octaves; i++) {
        value += amplitude * noise_ref3d(p); // Use renamed 3D noise
        p = p * 2.1; // Consistent scaling
        amplitude *= 0.5;
    }
    return value;
}

const float PI = 3.14159265;
const float TWO_PI = 2.0 * PI;

void main() {
    // Coordinates & Time (from Reference)
    float angle = atan(vWorldPos.y, vWorldPos.x); 
    float angularCoord = (angle + PI) / TWO_PI; 
    float tunnelSpeed = 0.03; 
    float timeBasedDistance = uTime * tunnelSpeed;

    // Nebula Calculation (from Reference)
    vec2 nebulaCoords = vec2(vWorldPos.x * 0.05, vWorldPos.y * 0.05 + mod(timeBasedDistance, 100.0));
    vec2 p1 = nebulaCoords * 1.5; 
    float noise1 = fbm_ref2d(p1, 5); // Use renamed reference 2D fbm
    vec2 p2_offset_coord = nebulaCoords * 3.0 + mod(uTime * 0.005, 100.0); 
    float offset_fbm = fbm_ref2d(p2_offset_coord, 6); // Use renamed reference 2D fbm
    vec2 p2_offset = vec2(offset_fbm * 0.2);
    vec2 p2 = nebulaCoords * 2.5 + vec2(-mod(uTime * 0.01, 50.0), 0.0) + p2_offset;
    float noise2 = fbm_ref2d(p2, 6); // Use renamed reference 2D fbm
    float nebulaValue = smoothstep(0.4, 0.7, noise1) + smoothstep(0.5, 0.8, noise2) * 0.6;
    vec3 nebulaColor = vec3(0.0);
    nebulaColor = mix(nebulaColor, vec3(0.1, 0.0, 0.3), smoothstep(0.3, 0.8, noise1));
    nebulaColor = mix(nebulaColor, vec3(0.0, 0.2, 0.5), smoothstep(0.5, 0.9, noise2));
    nebulaColor += vec3(0.9, 0.2, 0.4) * pow(noise2, 3.0) * 0.5;

    // Apply quantum effects to enhance the nebula (from Reference)
    vec3 quantumPos = vWorldPos * 0.01 + vec3(uTime * 0.01, uTime * 0.02, uTime * 0.015);
    float qNoiseValue = quantumNoise(quantumPos); // Use added quantumNoise
    vec3 qFBMValue = quantumFBM(quantumPos);    // Use added quantumFBM
    nebulaColor = mix(nebulaColor, nebulaColor * qFBMValue, 0.3 * uQuantumEffectStrength);
    nebulaValue = mix(nebulaValue, nebulaValue + qNoiseValue * 0.2, 0.4 * uQuantumEffectStrength);
    // Apply Nebula Intensity (Adjust multiplier as needed)
    nebulaColor *= uNebulaIntensity; 

    // Abstract Planets/Structures (3D - from Reference)
    vec3 blobColor = vec3(0.0);
    float blobScale = 0.04; 
    vec3 blobAnimSpeed = vec3(0.01, 0.005, -0.03);
    vec3 blobPos = vWorldPos * blobScale + vec3(
        mod(blobAnimSpeed.x * uTime, 50.0),
        mod(blobAnimSpeed.y * uTime, 50.0),
        mod(blobAnimSpeed.z * uTime, 50.0)
    );
    float blobPresenceNoise = fbm_ref3d(blobPos, 4); // Use renamed 3D fbm
    float sizeNoise = fbm_ref3d(blobPos * 0.7 + vec3(10.0, 20.0, 30.0), 3); // Use renamed 3D fbm
    float baseSizeThreshold = 0.6;
    float dynamicSizeThreshold = baseSizeThreshold + sizeNoise * 0.2 - 0.1;
    
    if (blobPresenceNoise > dynamicSizeThreshold) {
        float blobIntensity = smoothstep(dynamicSizeThreshold, dynamicSizeThreshold + 0.1, blobPresenceNoise);
        vec3 detailNoisePos = blobPos * 3.0 + vec3(5.0, -10.0, 15.0);
        float detailNoise = fbm_ref3d(detailNoisePos, 5); // Use renamed 3D fbm
        
        vec3 baseBlobColor = vec3(0.8, 0.3, 0.1); // Example orange
        vec3 detailColor = vec3(0.2, 0.7, 0.9); // Example cyan
        
        blobColor = mix(baseBlobColor, detailColor, smoothstep(0.4, 0.6, detailNoise));
        blobColor *= blobIntensity;
        
        // Add some self-illumination based on noise
        float illuminationNoise = fbm_ref3d(blobPos * 2.0 + vec3(-20.0, 5.0, -10.0), 4); // Use renamed 3D fbm
        blobColor += blobColor * smoothstep(0.5, 0.7, illuminationNoise) * 0.5;
    }

    // Star Field (from Existing)
    float starField = stars(vUv, uStarDensity * 0.1); 
    vec3 starColor = vec3(1.0) * starField;

    // Glows and Lights (Integrate from Reference)
    // Pulsing Glow
    float pulseGlowValue = pulsingGlow(vWorldPos * 0.1, uTime, uEtherealPulseSpeed, 0.5); // Intensity can be adjusted
    vec3 pulseGlowColor = uGlowColor * pulseGlowValue * uGlowIntensity; // Modulate main glow

    // Volumetric Rays (Example: Emanating from tunnel center along Z)
    // Center needs definition, assume 0,0,Z for simplicity
    vec3 rayOrigin = vec3(0.0, 0.0, vWorldPos.z - 5.0); // Example origin behind viewer
    vec3 rayDirection = normalize(vec3(0.0, 0.0, 1.0)); // Along Z axis
    float rayValue = volumetricLightRays(vWorldPos, rayOrigin, rayDirection, 20.0, uRayIntensity); // Radius, Density
    vec3 rayColor = vec3(1.0, 0.8, 0.5) * rayValue; // Example ray color

    // Quantum Probability Cloud (Example integration - might need tweaking)
    //vec3 qCloudColor = quantumProbabilityCloud(vWorldPos * 0.05, uQuantumSeed);

    // Final Color Mixing
    vec3 finalColor = nebulaColor;
    finalColor += blobColor; // Add blob structures
    finalColor += starColor; // Add stars

    // Apply Glows
    // Option 1: Use applyEtherealGlowEffects for overall glow
    // finalColor = applyEtherealGlowEffects(finalColor, pulseGlowColor + rayColor, 1.0); 

    // Option 2: Additive glow
    finalColor += pulseGlowColor;
    finalColor += rayColor;
    //finalColor += qCloudColor * 0.5; // Add quantum cloud if desired

    // Ensure we don't clip bright stars/effects
    finalColor = min(finalColor, 1.5); // Allow slightly higher values for HDR/bloom later
    
    gl_FragColor = vec4(finalColor, 1.0);
} 