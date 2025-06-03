// Basic vertex shader for text labels
varying vec2 vUv; // Pass UVs if needed for effects later

void main() {
  vUv = uv; 
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
} 