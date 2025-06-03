precision highp float;

uniform float uTime; // Add time for potential future effects
varying vec2 vUv;

void main() {
  // Simple initial color - slightly cyan/white
  gl_FragColor = vec4(0.8, 0.95, 1.0, 1.0); 
} 