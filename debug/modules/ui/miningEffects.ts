import * as THREE from 'three';

export function createMiningEffect(
    scene: THREE.Scene,
    position: THREE.Vector3,
    color: THREE.Color,
    amount: number = 1,
    materialSymbol?: string,
    miningEffectsContainer?: HTMLElement
) {
    // Create DOM effect element
    if (miningEffectsContainer) {
        const effectElement = document.createElement('div');
        effectElement.className = 'mining-effect';
        effectElement.style.position = 'absolute';
        effectElement.style.pointerEvents = 'none';
        effectElement.innerHTML = `+${amount}${materialSymbol ? ` ${materialSymbol}` : ''}`;
        miningEffectsContainer.appendChild(effectElement);

        // Cleanup DOM element after animation
        setTimeout(() => {
            if (effectElement.parentNode === miningEffectsContainer) {
                miningEffectsContainer.removeChild(effectElement);
            }
        }, 2000);
    }

    // Create 3D particle effect
    const particleCount = 20;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    // Initialize particle positions and velocities
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        particlePositions[i3] = position.x;
        particlePositions[i3 + 1] = position.y;
        particlePositions[i3 + 2] = position.z;

        // Random velocity in a sphere
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        particleVelocities.push(velocity);
    }

    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
        color: color,
        size: 0.2,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
    });

    // Create particle system
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.name = 'mining-particles-' + Date.now();
    scene.add(particles);

    // Animate particles
    let frame = 0;
    const maxFrames = 30;

    function animateParticles() {
        if (frame >= maxFrames || !scene) {
            // Remove particles when animation is done
            if (scene && particles.parent === scene) {
                scene.remove(particles);
                particleGeometry.dispose();
                particleMaterial.dispose();
            }
            return;
        }

        frame++;

        // Update particle positions
        const positions = particleGeometry.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] += particleVelocities[i].x;
            positions[i3 + 1] += particleVelocities[i].y;
            positions[i3 + 2] += particleVelocities[i].z;

            // Apply gravity
            particleVelocities[i].y -= 0.01;
        }

        particleGeometry.attributes.position.needsUpdate = true;

        // Fade out
        particleMaterial.opacity = 0.8 * (1 - frame / maxFrames);

        requestAnimationFrame(animateParticles);
    }

    // Start animation
    animateParticles();
}