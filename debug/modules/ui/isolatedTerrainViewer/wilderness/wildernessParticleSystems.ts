import * as THREE from 'three';

export interface ParticleSystemConfig {
    color?: number;
    size?: number;
    count?: number;
}

export class WildernessParticleSystems {
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    createFireParticles(config: ParticleSystemConfig = {}): THREE.Points {
        const { 
            color = 0xFF6600, 
            size = 0.1, 
            count = 100 
        } = config;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            // Random position around origin
            positions[i * 3] = (Math.random() - 0.5) * 2;
            positions[i * 3 + 1] = Math.random();
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2;

            // Interpolate color from base to bright
            const r = ((color >> 16) & 255) / 255;
            const g = ((color >> 8) & 255) / 255;
            const b = (color & 255) / 255;

            colors[i * 3] = r;
            colors[i * 3 + 1] = g * Math.random();
            colors[i * 3 + 2] = b * 0.3;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({ 
            size, 
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        const fireParticles = new THREE.Points(geometry, material);
        this.scene.add(fireParticles);

        return fireParticles;
    }

    createTeleportParticles(config: ParticleSystemConfig = {}): THREE.Points {
        const { 
            color = 0x00FFFF, 
            size = 0.05, 
            count = 200 
        } = config;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            // Spherical distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - 2 * Math.random());
            const radius = Math.random();

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Random velocities
            velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({ 
            color, 
            size,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.7
        });

        const teleportParticles = new THREE.Points(geometry, material);
        this.scene.add(teleportParticles);

        return teleportParticles;
    }

    updateParticles(particles: THREE.Points, delta: number): void {
        const positions = particles.geometry.getAttribute('position');
        const positionArray = positions.array as Float32Array;

        for (let i = 0; i < positionArray.length; i += 3) {
            // Simple particle movement simulation
            positionArray[i] += Math.sin(delta) * 0.01;
            positionArray[i + 1] += Math.cos(delta) * 0.02;
            positionArray[i + 2] += Math.sin(delta) * 0.01;
        }

        positions.needsUpdate = true;
    }

    dispose(): void {
        // Remove all particle systems from the scene
        this.scene.children
            .filter(child => child instanceof THREE.Points)
            .forEach(particles => this.scene.remove(particles));
    }
}
