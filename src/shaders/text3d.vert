varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying mat4 vModelViewMatrix;
varying vec3 vOriginalPosition;
varying float vImperfection;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uDepth;

// Noise function for generating controlled imperfections
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Fractional Brownian Motion for organic-looking noise
float fbm(vec2 p) {
  float f = 0.0;
  float w = 0.5;
  for (int i = 0; i < 3; i++) {
    f += w * noise(p);
    p *= 2.0;
    w *= 0.5;
  }
  return f;
}

void main() {
  vUv = uv;
  vOriginalPosition = position;
  
  // Calculate a unique vertex identifier for consistent imperfections
  float vertexId = position.x * 12.45 + position.y * 23.67 + position.z * 45.89;
  float uniqueRandom = noise(vec2(vertexId * 0.01, 23.45));
  
  // Sample the texture to get displacement value
  vec4 texSample = texture2D(uTexture, uv);
  
  // Create actual 3D displacement based on texture alpha
  // Only displace outward toward the camera to prevent z-fighting and overlapping
  float displacementAmount = texSample.a * uDepth * 0.5;
  
  // Calculate a view-aligned displacement vector
  // This ensures text always displaces toward the viewer, not into background
  vec3 viewNormal = normalize(vec3(0.0, 0.0, 1.0));
  vec3 worldNormal = normalize((vec4(viewNormal, 0.0) * modelViewMatrix).xyz);
  
  // Add dynamic wave effect for extra dimensionality
  float waveX = sin(position.x * 4.0 + uTime * 1.5) * 0.05;
  float waveY = cos(position.y * 4.0 + uTime * 1.2) * 0.05;
  float wave = (waveX + waveY) * texSample.a * 0.5;
  
  // Calculate organic imperfections
  // Higher frequency noise for smaller details
  float organicNoise = fbm(uv * 15.0 + vec2(uTime * 0.1, 0.0)) * 0.15;
  // Lower frequency noise for larger structural variations
  float structuralNoise = fbm(uv * 3.0 + vec2(0.0, uTime * 0.05)) * 0.2;
  
  // Combine imperfections with main displacement
  // More imperfections at the edges, less in the center
  float edgeFactor = smoothstep(0.4, 0.5, abs(uv.x - 0.5)) + smoothstep(0.4, 0.5, abs(uv.y - 0.5));
  float imperfectionAmount = mix(0.02, 0.08, edgeFactor);
  
  // Generate worn/chipped effect along character edges
  float edgeNoise = noise(uv * 50.0) * noise(uv * 25.0 + uniqueRandom);
  float edgeWear = smoothstep(0.6, 0.7, edgeNoise) * texSample.a * 0.15;
  
  // Calculate final displacement with imperfections
  float finalDisplacement = displacementAmount + wave;
  // Add organic imperfections only where text exists
  finalDisplacement += (organicNoise - structuralNoise * 0.5 - edgeWear) * texSample.a;
  
  // Pass imperfection value to fragment shader
  vImperfection = (organicNoise + structuralNoise + edgeWear) * texSample.a;
  
  // Apply displacement in the direction of the viewer
  // Ensure we only displace vertices where text exists (alpha > 0)
  // This prevents background parts from being affected
  vec3 displaced = position;
  if (texSample.a > 0.01) {
    // Normal direction with slight perturbation for imperfect surface
    vec3 perturbedNormal = normal + vec3(
      noise(uv * 50.0 + uniqueRandom) * 0.1 - 0.05,
      noise(uv * 51.0 + uniqueRandom) * 0.1 - 0.05,
      0.0
    ) * texSample.a;
    
    // Normalize to ensure consistent displacement magnitude
    perturbedNormal = normalize(perturbedNormal);
    
    // Apply final displacement with imperfections
    displaced = position + perturbedNormal * finalDisplacement;
  }
  
  // Store view-space position for fragment shader
  vPosition = displaced;
  vModelViewMatrix = modelViewMatrix;
  vViewPosition = -vec3(modelViewMatrix * vec4(displaced, 1.0));
  
  // Apply projection with displacement
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
} 