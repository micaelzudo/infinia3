varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv; // Pass UVs in case needed later

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  
  // Transform normal to world space
  vNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
  
  vUv = uv; // Pass UVs

  gl_Position = projectionMatrix * viewMatrix * worldPosition; 
} 