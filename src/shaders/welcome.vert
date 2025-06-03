uniform float uTime;
varying vec2 vUv;

void main() {
  vUv = uv; 
  vec3 pos = position;

  // Simple wave distortion REMOVED
  // pos.y += sin(pos.x * 0.5 + uTime * 1.5) * 0.1;
  // pos.x += cos(pos.y * 0.5 + uTime * 1.5) * 0.1;

  // Pass position directly through
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
} 