// Zr.vert - Transition Metal type element
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

void main() {
    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Calculate world normal
    vec3 objectNormal = normalize(normal);
    vNormal = normalize(mat3(modelMatrix) * objectNormal);
    
    // Calculate view direction
    vViewDirection = normalize(cameraPosition - worldPosition.xyz);
    
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}