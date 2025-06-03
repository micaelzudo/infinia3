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

// Function for sharper noise, good for cracks
float ridgeNoise(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float weight = 1.0;
    for (int i = 0; i < octaves; i++) {
        float n = noise(p);
        n = 1.0 - abs(n * 2.0 - 1.0); // Create ridges
        value += n * amplitude * weight;
        weight = n * 0.8; // Modulate amplitude based on previous ridge
        p = p * 2.2; // Scale slightly differently
        amplitude *= 0.5;
    }
    return value;
}


void main() {
    vec3 seedOffset = vec3(uSeed * 44.4, uSeed * 55.5, uSeed * 66.6);
    float baseScale = 2.5 + fract(uSeed * 6.0) * 1.0;

    // --- Ice Surface (Cracks/Plains) ---
    vec3 p1 = vWorldPos * baseScale * 0.8 + seedOffset;
    p1.y += uTime * 0.005; // Very slow vertical shift
    float plains = fbm(p1, 4); // Base icy plains

    vec3 p2 = vWorldPos * baseScale * 1.5 + seedOffset;
    float cracks = ridgeNoise(p2 + vec3(0.0, 0.0, uTime * 0.01), 6); // Crack network

    // --- Color Palette (Ice) ---
    vec3 colorIce = vec3(0.8, 0.9, 1.0);
    vec3 colorDeepIce = vec3(0.4, 0.6, 0.9);
    vec3 colorCrack = vec3(0.2, 0.3, 0.5);

    vec3 baseColor = mix(colorDeepIce, colorIce, smoothstep(0.4, 0.6, plains));
    baseColor = mix(baseColor, colorCrack, smoothstep(0.1, 0.3, cracks) * 0.8); // Overlay cracks

    // --- Basic Lighting ---
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = 0.2 * baseColor;
    vec3 diffuseColor = 0.8 * diffuse * baseColor;

    // --- Strong Rim / Glint ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 5.0); // Sharp power for ice glint
    vec3 rimColor = rimFactor * vec3(1.0, 1.0, 1.0) * 0.9; // Bright white rim

    vec3 finalColor = ambient + diffuseColor + rimColor;

    gl_FragColor = vec4(finalColor, 1.0);
} 