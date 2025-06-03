import * as THREE from 'three';

// Camera
export const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  1,
  20000
);
camera.position.y = 50; 