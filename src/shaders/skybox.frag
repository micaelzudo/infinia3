precision mediump float;

varying vec3 vWorldDirection;
uniform float uTime; // Optional: for twinkling

// Simple pseudo-random number generator
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

// Hash function to create pseudo-random points (stars)
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 dir = normalize(vWorldDirection);

  // Basic star field generation
  float starDensity = 0.995; // Lower value = more stars
  float starIntensity = pow(hash(dir * 500.0), 20.0); // Adjust multiplier for density, power for size/brightness
  
  // Optional: Add twinkling
  // starIntensity *= smoothstep(0.4, 0.6, rand(dir.xy + uTime * 0.1));

  // Background color
  vec3 baseColor = vec3(0.01, 0.01, 0.05); // Very dark blue

  // Combine base color and stars
  vec3 color = baseColor + vec3(starIntensity);

  gl_FragColor = vec4(color, 1.0);
} 