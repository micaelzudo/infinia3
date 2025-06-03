precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeed;

// --- 3D Noise Functions (rand, noise, fbm) ---
// [Include the same rand, noise, fbm functions as in planet.frag]
// ... (noise functions omitted for brevity) ...
float rand(vec3 co){ return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453); }
float noise(vec3 p) { vec3 ip = floor(p); vec3 fp = fract(p); fp = fp*fp*(3.0-2.0*fp); float v000=rand(ip+vec3(0.,0.,0.)); float v100=rand(ip+vec3(1.,0.,0.)); float v010=rand(ip+vec3(0.,1.,0.)); float v110=rand(ip+vec3(1.,1.,0.)); float v001=rand(ip+vec3(0.,0.,1.)); float v101=rand(ip+vec3(1.,0.,1.)); float v011=rand(ip+vec3(0.,1.,1.)); float v111=rand(ip+vec3(1.,1.,1.)); return mix(mix(mix(v000,v100,fp.x),mix(v010,v110,fp.x),fp.y),mix(mix(v001,v101,fp.x),mix(v011,v111,fp.x),fp.y),fp.z); }
float fbm(vec3 p, int octaves) { float v=0.; float a=0.5; for (int i=0; i<octaves; i++){v+=a*noise(p); p=p*2.1; a*=0.5;} return v;}
// --- End Noise ---

// Distorted FBM for lava flow effect
float fbm_distorted(vec3 p, int octaves, float distortion) {
    vec3 q = vec3( fbm(p + vec3(0.0,0.0,0.0), octaves),
                   fbm(p + vec3(5.2,1.3,0.0), octaves),
                   fbm(p + vec3(0.0,5.2,1.3), octaves) );
    return fbm(p + distortion * q, octaves);
}

void main() {
    vec3 seedOffset = vec3(uSeed * 77.7, uSeed * 88.8, uSeed * 99.9);
    float baseScale = 1.8 + fract(uSeed * 7.0) * 0.5;
    float distortionAmount = 0.8 + fract(uSeed * 8.0) * 0.4;
    float flowSpeed = 0.04 + fract(uSeed * 9.0) * 0.02;

    // --- Lava Flow Noise ---
    vec3 p1 = vWorldPos * baseScale + seedOffset;
    p1.xy += uTime * flowSpeed; // Animate the distortion field
    float lavaNoise = fbm_distorted(p1, 5, distortionAmount);

    // --- Color Palette (Lava) ---
    vec3 colorRock = vec3(0.1, 0.05, 0.03);
    vec3 colorMid = vec3(0.8, 0.2, 0.0); // Orange
    vec3 colorHot = vec3(1.0, 0.9, 0.2); // Yellow/White hot

    vec3 baseColor = mix(colorRock, colorMid, smoothstep(0.4, 0.55, lavaNoise));
    baseColor = mix(baseColor, colorHot, smoothstep(0.55, 0.7, lavaNoise));

    // --- Basic Lighting ---
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = 0.1 * baseColor; // Dark ambient for lava
    vec3 diffuseColor = 0.6 * diffuse * baseColor;

    // --- Emission for Hot Areas ---
    float emissionStrength = smoothstep(0.5, 0.75, lavaNoise);
    vec3 emissionColor = mix(colorMid, colorHot, smoothstep(0.55, 0.7, lavaNoise)) * emissionStrength * 1.5;

    // --- Optional Dim Rim ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 3.0);
    vec3 rimColor = rimFactor * colorRock * 0.5; // Very subtle dark rock rim

    vec3 finalColor = ambient + diffuseColor + emissionColor + rimColor;

    gl_FragColor = vec4(finalColor, 1.0);
} 