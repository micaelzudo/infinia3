varying vec3 vWorldDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldDirection = worldPosition.xyz - cameraPosition;

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
} 