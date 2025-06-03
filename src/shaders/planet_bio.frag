precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeed;

// --- 3D Noise Functions (rand, noise, fbm) ---
// [Include the same rand, noise, fbm functions as in planet.frag]
float rand(vec3 co){ return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453); }
float noise(vec3 p) { vec3 ip = floor(p); vec3 fp = fract(p); fp = fp*fp*(3.0-2.0*fp); float v000=rand(ip+vec3(0.,0.,0.)); float v100=rand(ip+vec3(1.,0.,0.)); float v010=rand(ip+vec3(0.,1.,0.)); float v110=rand(ip+vec3(1.,1.,0.)); float v001=rand(ip+vec3(0.,0.,1.)); float v101=rand(ip+vec3(1.,0.,1.)); float v011=rand(ip+vec3(0.,1.,1.)); float v111=rand(ip+vec3(1.,1.,1.)); return mix(mix(mix(v000,v100,fp.x),mix(v010,v110,fp.x),fp.y),mix(mix(v001,v101,fp.x),mix(v011,v111,fp.x),fp.y),fp.z); }
float fbm(vec3 p, int octaves) { float v=0.; float a=0.5; for (int i=0; i<octaves; i++){v+=a*noise(p); p=p*2.1; a*=0.5;} return v;}
// --- End Noise ---

// Ridge noise for vein-like structures
float ridgeNoise(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float weight = 1.0;
    for (int i = 0; i < octaves; i++) {
        float n = noise(p);
        n = 1.0 - abs(n * 2.0 - 1.0); // Create ridges
        value += n * amplitude * weight;
        weight = n * 0.8;
        p = p * 2.2;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    // --- Derive pseudo-random factors from seed (0.0 to 1.0 range) ---
    float r1 = fract(uSeed * 5.67);
    float r2 = fract(uSeed * 6.78 + r1);
    float r3 = fract(uSeed * 7.89 + r2);
    float r4 = fract(uSeed * 8.90 + r3);
    float r5 = fract(uSeed * 9.01 + r4);

    // --- Parameters controlled by seed ---
    vec3 seedOffset = vec3(uSeed * 5.67, uSeed * 6.78, uSeed * 7.89);
    float baseScale = 1.5 + r1 * 1.5; // [1.5 - 3.0]
    float veinScale = 2.0 + r2 * 2.5; // [2.0 - 4.5]
    float pulseSpeed = 0.3 + r3 * 1.7; // [0.3 - 2.0]
    float baseDarkness = 0.3 + r4 * 0.5; // [0.3 - 0.8] How dark the base surface is
    float veinCoverage = 0.15 + r5 * 0.25; // [0.15 - 0.4] Threshold start for veins
    float veinBrightness = 1.5 + r1 * 2.0; // [1.5 - 3.5]
    float pulseMagnitude = 0.3 + r2 * 0.5; // [0.3 - 0.8]

    // --- Dark Base Surface ---
    vec3 p_base = vWorldPos * baseScale + seedOffset;
    float baseNoise = fbm(p_base, 4);
    vec3 baseColor = vec3(0.05, 0.02, 0.1) * mix(0.1, 1.0, baseNoise) * baseDarkness; // Vary darkness

    // --- Glowing Veins --- 
    vec3 p_veins = vWorldPos * veinScale + seedOffset * 1.5;
    float veinNoise = ridgeNoise(p_veins, 5);
    float veinFactor = smoothstep(veinCoverage, veinCoverage + 0.15, veinNoise); // Use random threshold

    // --- Vein Color & Pulsing Emission --- 
    // More color options based on seed
    vec3 veinColor1 = vec3(0.1, 1.0, 0.8); // Cyan/Green
    vec3 veinColor2 = vec3(1.0, 0.5, 0.1); // Orange/Yellow
    vec3 veinColor3 = vec3(0.8, 0.1, 1.0); // Magenta/Purple
    vec3 veinColorBase = mix(mix(veinColor1, veinColor2, r3), veinColor3, r4 * r5); // Mix between 3

    float pulse = (1.0 - pulseMagnitude) + pulseMagnitude * sin(uTime * pulseSpeed + uSeed * 10.0 + veinNoise * 5.0); // Use random pulse magnitude
    vec3 emissionColor = veinColorBase * veinFactor * pulse * veinBrightness; // Use random brightness

    // --- Lighting (mostly ambient + emission) ---
     vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = 0.05 * baseColor; // Very low ambient
    vec3 diffuseColor = 0.2 * diffuse * baseColor; // Very dim diffuse

    // --- Subtle Rim for Shape Definition ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 3.0 + r1 * 3.0); // Random rim power [3.0 - 6.0]
    vec3 rimColor = rimFactor * baseColor * (0.3 + r2*0.4); // Vary rim intensity

    vec3 finalColor = ambient + diffuseColor + emissionColor + rimColor;

    gl_FragColor = vec4(clamp(finalColor, 0.0, 2.0), 1.0); // Allow brighter emission (clamp > 1)
} 