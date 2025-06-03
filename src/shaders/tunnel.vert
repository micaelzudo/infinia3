// Basic vertex shader for the tunnel - now with wavy deformation!
varying vec2 vUv;
varying vec3 vWorldPos; // Pass world position

uniform float uTime;
uniform float uFrequency; // Controls the density of waves
uniform float uAmplitude; // Controls the intensity of the wave/shake

void main() {
  vUv = uv;
  
  // Calculate displacement with multiple layers
  float timeFactor1 = uTime * 2.0;
  float timeFactor2 = uTime * 1.3;
  float timeFactor3 = uTime * 0.8;

  // Layer 1: Base wave
  float waveFactor1 = position.z * uFrequency + timeFactor1;
  float dispX1 = sin(waveFactor1) * uAmplitude;
  float dispY1 = cos(waveFactor1 * 0.8 + 0.5) * uAmplitude * 0.7;

  // Layer 2: Faster, smaller ripples
  float rippleFrequency = uFrequency * 2.5;
  float rippleAmplitude = uAmplitude * 0.3;
  float waveFactor2 = position.z * rippleFrequency + timeFactor2 * 1.5;
  float dispX2 = cos(waveFactor2 * 1.2) * rippleAmplitude;
  float dispY2 = sin(waveFactor2) * rippleAmplitude * 0.8;

  // Layer 3: Slower, wider undulation
  float undulationFrequency = uFrequency * 0.4;
  float undulationAmplitude = uAmplitude * 0.6;
  float waveFactor3 = position.z * undulationFrequency + timeFactor3 * 0.7;
  float dispX3 = sin(waveFactor3 * 0.9 + 1.0) * undulationAmplitude * 0.5;
  float dispY3 = cos(waveFactor3 + 2.5) * undulationAmplitude;

  // Combine displacements
  float totalDisplacementX = dispX1 + dispX2 + dispX3;
  float totalDisplacementY = dispY1 + dispY2 + dispY3;

  // Apply displacement
  vec3 displacedPosition = position + vec3(totalDisplacementX, totalDisplacementY, 0.0);
  
  // Use displaced position for calculations
  vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
  vWorldPos = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
} 