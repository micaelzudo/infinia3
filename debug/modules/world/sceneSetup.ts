import * as THREE from 'three';
import Stats from 'stats.js';

export function setupLighting(scene: THREE.Scene): THREE.DirectionalLight {
    const ambientLight = new THREE.AmbientLight(0x606070); // Soft ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Main directional light
    directionalLight.position.set(1, 1, 0.5).normalize(); // Set direction
    scene.add(directionalLight);
    console.log("Lighting Setup Complete");
    return directionalLight; // Return reference if needed (e.g., for updating uniforms)
}

export function setupStats(): Stats {
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.left = "";
    stats.dom.style.right = "0";
    document.body.appendChild(stats.dom);
    console.log("Stats Setup Complete");
    return stats;
}

export function setupSkybox(scene: THREE.Scene): THREE.Mesh {
    const skyboxPaths = [
        "skybox/front.png",
        "skybox/back.png",
        "skybox/top.png",
        "skybox/bottom.png",
        "skybox/left.png",
        "skybox/right.png",
    ];

    const materialArray = skyboxPaths.map((path) => {
        const texture = new THREE.TextureLoader().load(path);
        return new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide,
        });
    });
    const skyboxGeom = new THREE.BoxGeometry(10000, 10000, 10000);
    const skybox = new THREE.Mesh(skyboxGeom, materialArray);
    scene.add(skybox);
    console.log("Skybox Setup Complete");
    return skybox;
} 