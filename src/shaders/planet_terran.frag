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

void main() {
    vec3 seedOffset = vec3(uSeed * 1.23, uSeed * 2.34, uSeed * 3.45);
    float baseScale = 1.5 + fract(uSeed * 10.0) * 0.6;
    float cloudSpeed = 0.02 + fract(uSeed * 11.0) * 0.01;

    // --- Continents/Oceans ---
    vec3 p_continent = vWorldPos * baseScale + seedOffset;
    float continentNoise = fbm(p_continent, 5);
    float landFactor = smoothstep(0.5, 0.55, continentNoise); // Sharp transition for land edges

    // --- Land Color Variation ---
    vec3 p_landColor = vWorldPos * baseScale * 3.0 + seedOffset * 1.5;
    float landColorNoise = fbm(p_landColor, 4);
    vec3 colorGreen = vec3(0.2, 0.5, 0.1);
    vec3 colorBrown = vec3(0.4, 0.3, 0.1);
    vec3 colorSnow = vec3(0.9, 0.9, 0.95);
    float snowFactor = smoothstep(0.65, 0.75, continentNoise); // Higher noise = snow caps

    vec3 landColor = mix(colorBrown, colorGreen, smoothstep(0.4, 0.6, landColorNoise));
    landColor = mix(landColor, colorSnow, snowFactor);

    // --- Ocean Color ---
    vec3 colorShallow = vec3(0.1, 0.4, 0.7);
    vec3 colorDeep = vec3(0.0, 0.1, 0.4);
    vec3 oceanColor = mix(colorDeep, colorShallow, smoothstep(0.45, 0.5, continentNoise)); // Brighter near coast

    // --- Mix Land/Ocean ---
    vec3 surfaceColor = mix(oceanColor, landColor, landFactor);

    // --- Define Light Direction Early (Defensive Fix) ---
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    // ---------------------------------------------------

    // --- Simple Clouds ---
    vec3 p_clouds = vWorldPos * baseScale * 1.2 + seedOffset;
    p_clouds.xz += uTime * cloudSpeed; // Clouds drift
    float cloudNoise = fbm(p_clouds + vec3(0.0, 10.0, 0.0), 6); // Offset cloud layer slightly
    float cloudFactor = smoothstep(0.55, 0.7, cloudNoise);
    cloudFactor *= (1.0 - snowFactor); // Fewer clouds over snow caps

    // --- Cloud Shadows --- 
    // Estimate shadow by sampling cloud noise again slightly offset towards light source
    float shadowOffsetScale = 0.05; // How far to shift for shadow sampling
    vec3 p_shadow = p_clouds + normalize(lightDir) * shadowOffsetScale; 
    float shadowCloudNoise = fbm(p_shadow + vec3(0.0, 10.0, 0.0), 6);
    float shadowFactor = smoothstep(0.55, 0.7, shadowCloudNoise);
    shadowFactor *= (1.0 - snowFactor);
    float surfaceShadow = mix(1.0, 0.6, shadowFactor); // 1.0 = no shadow, 0.6 = full shadow darkness

    // --- Blend Clouds over Surface & Apply Shadow ---
    vec3 baseColor = mix(surfaceColor * surfaceShadow, vec3(1.0), cloudFactor * 0.8); // Apply shadow BEFORE mixing clouds

    // --- Basic Lighting ---
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = 0.2 * baseColor;
    // Modulate diffuse slightly by land/ocean for simple bump
    float bumpFactor = mix(0.8, 1.0, landFactor); 
    vec3 diffuseColor = 0.7 * diffuse * baseColor * bumpFactor;

    // --- Atmospheric Rim ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 2.5);
    vec3 rimColor = rimFactor * vec3(0.5, 0.7, 1.0) * 0.6; // Blueish atmosphere

    vec3 finalColor = ambient + diffuseColor + rimColor;

    gl_FragColor = vec4(finalColor, 1.0);
} 