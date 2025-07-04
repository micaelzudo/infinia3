// varying vec3 vPosition;
// varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    // vNormal = normal;
    // vPosition = position;
    
    // Get world position for calculations in fragment shader
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
} 