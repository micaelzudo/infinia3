precision highp float;

varying vec3 vWorldDirection;
uniform float uTime;

// Pseudo-random number generator
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Simpler Noise function (based on random)
float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp); // Smoothstep
    
    float v00 = rand(ip + vec2(0.0, 0.0));
    float v10 = rand(ip + vec2(1.0, 0.0));
    float v01 = rand(ip + vec2(0.0, 1.0));
    float v11 = rand(ip + vec2(1.0, 1.0));
    
    return mix(mix(v00, v10, fp.x), mix(v01, v11, fp.x), fp.y);
}

// Fractional Brownian Motion (layered noise)
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5)); // Rotation matrix

    for (int i = 0; i < octaves; i++) { 
        value += amplitude * noise(p);
        p = rot * p * 2.0; // Rotate and scale
        amplitude *= 0.5;
    }
    return value;
}

// --- Star Generation ---
float hash(vec3 p) { // Simple hash for stars
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
// --- End Star Generation ---

// --- Planet SDF (Simplified) ---
float sphere(vec3 ro, vec3 rd, vec3 center, float radius) {
    vec3 oc = ro - center;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - radius*radius;
    float h = b*b - c;
    if(h < 0.0) return -1.0; // No intersection
    // return (-b - sqrt(h)); // Distance to intersection (use if raymarching)
    return 1.0; // Just return 1.0 if hit for simple coloring
}
// --- End Planet SDF ---

void main() {
  vec3 dir = normalize(vWorldDirection);
  vec2 uv = dir.xy; // Base UV from direction

  // --- Star Field ---
  float stars = pow(hash(dir * 800.0), 30.0) * 0.8; // Density and brightness
  stars += pow(hash(dir * 500.0), 20.0) * 0.5;
  stars *= smoothstep(0.4, 0.6, rand(dir.xy + uTime * 0.01)); // Twinkling

  // --- Nebulae / Gas Clouds ---
  // Layer 1: Slow moving, large scale clouds
  vec2 p1 = uv * 1.5 + vec2(uTime * 0.02, -uTime * 0.01);
  float noise1 = fbm(p1, 4); // Fewer octaves for larger clouds
  
  // Layer 2: Faster moving, smaller scale, distorted
  vec2 p2_offset = vec2(fbm(uv * 3.0 + uTime * 0.05, 6) * 0.3);
  vec2 p2 = uv * 4.0 + vec2(-uTime * 0.06, uTime * 0.03) + p2_offset;
  float noise2 = fbm(p2, 6);

  // Combine noise layers
  float nebulaValue = smoothstep(0.4, 0.6, noise1) + smoothstep(0.5, 0.7, noise2) * 0.5;

  // Color the nebulae
  vec3 nebulaColor = vec3(0.0); 
  nebulaColor = mix(nebulaColor, vec3(0.1, 0.0, 0.3), smoothstep(0.3, 0.8, noise1)); // Purple base
  nebulaColor = mix(nebulaColor, vec3(0.0, 0.2, 0.5), smoothstep(0.5, 0.9, noise2)); // Add blue highlights
  nebulaColor += vec3(0.8, 0.1, 0.3) * pow(noise2, 3.0) * 0.4; // Magenta cores

  // --- Planets ---
  vec3 rayOrigin = vec3(0.0); // Camera is at origin relative to skybox
  vec3 planetColor = vec3(0.0);
  
  // Planet 1 (adjust center position and radius)
  vec3 planet1_center = normalize(vec3(0.8, 0.2, -0.5)) * 500.0; // Distant
  float planet1_hit = sphere(rayOrigin, dir, planet1_center, 100.0);
  if (planet1_hit > 0.0) {
      vec3 planet_uv_approx = dir * 0.1 + 0.5; // Pseudo-UV for planet surface
      planetColor = vec3(0.6, 0.4, 0.3) * (0.5 + fbm(planet_uv_approx.xy * 10.0 + uTime * 0.01, 5) * 0.5); // Textured brown/red
  }

  // Planet 2 (adjust center position and radius)
  vec3 planet2_center = normalize(vec3(-0.5, -0.6, 0.7)) * 700.0; // More distant
  float planet2_hit = sphere(rayOrigin, dir, planet2_center, 80.0);
   if (planet2_hit > 0.0) {
      vec3 planet_uv_approx = dir * 0.15 + 0.5;
      planetColor = vec3(0.3, 0.5, 0.6) * (0.5 + fbm(planet_uv_approx.yz * 12.0 - uTime * 0.02, 5) * 0.5); // Textured blue/green
  }

  // --- Composition ---
  // Start with nebula color
  vec3 finalColor = nebulaColor * nebulaValue * 0.8; 
  
  // Add stars on top
  finalColor += vec3(stars);

  // Overlay planets (simple overlay, could be improved with masking)
  finalColor = mix(finalColor, planetColor, step(0.0, planet1_hit + planet2_hit));

  // Clamp final color
  finalColor = clamp(finalColor, 0.0, 1.0);

  gl_FragColor = vec4(finalColor, 1.0);
} 