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

// Simplified Voronoi-like pattern for facets
float voronoi_ish(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float minDist = 1.0;
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 neighbor = vec3(float(x), float(y), float(z));
                float r = rand(ip + neighbor);
                vec3 point = vec3(r, r, r) * 0.5 + 0.25;
                float dist = distance(fp, neighbor + point);
                minDist = min(minDist, dist);
            }
        }
    }
    return minDist;
}

void main() {
    // --- Derive pseudo-random factors from seed (0.0 to 1.0 range) ---
    float r1 = fract(uSeed * 13.5);
    float r2 = fract(uSeed * 24.6 + r1);
    float r3 = fract(uSeed * 35.7 + r2);
    float r4 = fract(uSeed * 46.8 + r3);
    float r5 = fract(uSeed * 57.9 + r4);

    // --- Parameters controlled by seed ---
    vec3 seedOffset = vec3(uSeed * 13.5, uSeed * 24.6, uSeed * 35.7);
    float baseScale = 2.0 + r1 * 2.5; // Vary base scale more [2.0 - 4.5]
    float facetScale = 0.3 + r2 * 0.6; // Vary facet density [0.3 - 0.9]
    float facetContrast = 0.3 + r3 * 0.6; // Vary facet sharpness [0.3 - 0.9]
    float colorMixFactor = r4;
    float specularPower = 32.0 + r5 * 96.0; // Sharper/Duller highlights [32 - 128]
    float rimIntensityFactor = 0.3 + fract(uSeed * 14.0) * 0.7; // Renamed for clarity

    // --- Crystal Facets ---
    vec3 p_facet = vWorldPos * baseScale * facetScale + seedOffset;
    float facetNoise = voronoi_ish(p_facet);
    facetNoise = pow(facetNoise, facetContrast); // Use randomized contrast

    // --- Base Color (More variance) ---
    vec3 p_color = vWorldPos * baseScale * 0.5 + seedOffset;
    p_color.xy += uTime * 0.01 * (0.5 + r1); // Vary animation speed
    float colorFbm = fbm(p_color, 4);
    vec3 color1 = vec3(0.6 + r1*0.4, 0.7 + r2*0.3, 0.8 + r3*0.2); // Randomized base colors
    vec3 color2 = vec3(0.8 + r4*0.2, 0.6 + r5*0.4, 0.7 + r1*0.3);
    vec3 baseColor = mix(color1, color2, smoothstep(0.4, 0.6, colorFbm + colorMixFactor - 0.5));
    baseColor *= (0.5 + facetNoise * 0.5); // Modulate base color more strongly

    // --- Lighting & Sharp Highlights ---
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 halfVec = normalize(lightDir + viewDir);

    vec3 facetNormal = normalize(vNormal + (rand(p_facet*1.1) - 0.5) * 0.15); // Slightly stronger perturbation
    float diffuse = max(dot(facetNormal, lightDir), 0.0);
    float specular = pow(max(dot(facetNormal, halfVec), 0.0), specularPower); // Use randomized power
    
    vec3 ambient = 0.1 * baseColor; // Lower ambient for crystal
    vec3 diffuseColor = 0.4 * diffuse * baseColor;
    vec3 specularColor = (0.6 + r2*0.4) * specular * vec3(1.0); // Vary specular intensity

    // --- Rim/Edge Glow ---
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 2.0 + r3 * 3.0); // Vary rim tightness [2.0 - 5.0]
    vec3 rimColor = rimFactor * baseColor * rimIntensityFactor; // Use randomized intensity

    vec3 finalColor = ambient + diffuseColor + specularColor + rimColor;

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0); // Clamp final color
    // gl_FragColor.a = ... // Optional transparency
} 