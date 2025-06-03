precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeed; // Still useful for variation within type

// --- 3D Noise Functions (rand, noise, fbm) ---
// [Include the same rand, noise, fbm functions as in planet.frag]
// ... (noise functions omitted for brevity) ...
float rand(vec3 co){ return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453); }
float noise(vec3 p) { vec3 ip = floor(p); vec3 fp = fract(p); fp = fp*fp*(3.0-2.0*fp); float v000=rand(ip+vec3(0.,0.,0.)); float v100=rand(ip+vec3(1.,0.,0.)); float v010=rand(ip+vec3(0.,1.,0.)); float v110=rand(ip+vec3(1.,1.,0.)); float v001=rand(ip+vec3(0.,0.,1.)); float v101=rand(ip+vec3(1.,0.,1.)); float v011=rand(ip+vec3(0.,1.,1.)); float v111=rand(ip+vec3(1.,1.,1.)); return mix(mix(mix(v000,v100,fp.x),mix(v010,v110,fp.x),fp.y),mix(mix(v001,v101,fp.x),mix(v011,v111,fp.x),fp.y),fp.z); }
float fbm(vec3 p, int octaves) { float v=0.; float a=0.5; for (int i=0; i<octaves; i++){v+=a*noise(p); p=p*2.1; a*=0.5;} return v;}
// --- End Noise ---

void main() {
    vec3 seedOffset = vec3(uSeed * 11.1, uSeed * 22.2, uSeed * 33.3);
    float baseScale = 1.2 + fract(uSeed * 5.0) * 0.8; 
    float stormScale = baseScale * 2.5; // Storms are larger features
    float stormSpeed = 0.1 + fract(uSeed * 6.1) * 0.1;
    float stormIntensity = 0.1 + fract(uSeed * 7.2) * 0.2;

    // --- Storm Distortion Field ---
    vec3 p_storm = vWorldPos * stormScale + seedOffset * 0.5;
    p_storm.xy += uTime * stormSpeed;
    vec3 stormDistortion = vec3( fbm(p_storm, 3) - 0.5, 
                                 fbm(p_storm + vec3(10.0), 3) - 0.5, 
                                 fbm(p_storm + vec3(-10.0), 3) - 0.5 ) * stormIntensity;

    // --- Swirling Layers (Apply Distortion) ---
    vec3 p1 = vWorldPos * baseScale + seedOffset + stormDistortion; // Add distortion
    p1.xz += uTime * 0.03; 
    p1.y += uTime * 0.01; 
    float layer1 = fbm(p1, 5);

    vec3 p2 = vWorldPos * baseScale * 0.6 + seedOffset - stormDistortion; // Add inverse distortion
    p2.xy -= uTime * 0.02; 
    float layer2 = fbm(p2 + vec3(5.0, 0.0, 0.0), 6);

    // --- Color Palette (Gas Giant) ---
    vec3 colorA = vec3(0.8, 0.6, 0.4); // Light brown/orange
    vec3 colorB = vec3(0.4, 0.3, 0.5); // Dusky purple/blue
    vec3 colorC = vec3(0.9, 0.85, 0.8); // White/Cream
    
    vec3 baseColor = mix(colorA, colorB, smoothstep(0.4, 0.6, layer1));
    baseColor = mix(baseColor, colorC, smoothstep(0.55, 0.7, layer2) * 0.6); // Add bands/highlights
    baseColor += (layer1 * layer1 * 0.1); // Add subtle self-coloring

    // --- Simple Lighting (Less pronounced surface) ---
     vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5; // Softer diffuse
    vec3 ambient = 0.3 * baseColor;

    // --- Atmospheric Haze (Rim Lighting) ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 2.0); // Softer rim power for gas
    vec3 rimColor = rimFactor * baseColor * 0.8 + rimFactor * vec3(0.5, 0.6, 0.8) * 0.5; // Tinted haze

    vec3 finalColor = ambient + diffuse * baseColor + rimColor;

    gl_FragColor = vec4(finalColor, 1.0);
} 