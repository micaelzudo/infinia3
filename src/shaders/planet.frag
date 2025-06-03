precision highp float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeed;

// Simple noise function for the planets
float rand(vec3 co) {
    return fract(sin(dot(co.xyz, vec3(12.9898, 78.233, 54.53))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    
    float v000 = rand(ip + vec3(0.0, 0.0, 0.0));
    float v100 = rand(ip + vec3(1.0, 0.0, 0.0));
    float v010 = rand(ip + vec3(0.0, 1.0, 0.0));
    float v110 = rand(ip + vec3(1.0, 1.0, 0.0));
    float v001 = rand(ip + vec3(0.0, 0.0, 1.0));
    float v101 = rand(ip + vec3(1.0, 0.0, 1.0));
    float v011 = rand(ip + vec3(0.0, 1.0, 1.0));
    float v111 = rand(ip + vec3(1.0, 1.0, 1.0));
    
    return mix(
        mix(mix(v000, v100, fp.x), mix(v010, v110, fp.x), fp.y),
        mix(mix(v001, v101, fp.x), mix(v011, v111, fp.x), fp.y),
        fp.z
    );
}

float fbm(vec3 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p);
        p = p * 2.1;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec3 seedOffset = vec3(uSeed * 1.23, uSeed * 2.34, uSeed * 3.45);
    float baseScale = 1.5 + fract(uSeed * 10.0) * 0.6;
    
    // Generate base color using the seed
    vec3 baseColor = mix(
        vec3(0.2, 0.5, 0.9),  // Blue base
        vec3(0.4, 0.0, 0.6),  // Purple accent
        fract(uSeed * 7.89)
    );
    
    // Add noise patterns for planet surface features
    vec3 p_surface = vWorldPos * baseScale + seedOffset;
    float surfaceNoise = fbm(p_surface, 5);
    
    // Create terrain features based on noise
    float featureFactor = smoothstep(0.4, 0.6, surfaceNoise);
    
    // Generate feature color based on seed
    vec3 featureColor = mix(
        vec3(0.1, 0.5, 0.2),  // Green-like features
        vec3(0.5, 0.3, 0.1),  // Brown-like features
        fract(uSeed * 3.21)
    );
    
    // Mix base color with feature color
    vec3 planetColor = mix(baseColor, featureColor, featureFactor);
    
    // Add animated cloud patterns
    vec3 p_clouds = vWorldPos * baseScale * 1.2 + seedOffset;
    p_clouds.xy += uTime * 0.01;  // Slowly moving clouds
    float cloudNoise = fbm(p_clouds, 4);
    float cloudFactor = smoothstep(0.6, 0.8, cloudNoise);
    
    // Mix clouds with planet surface
    vec3 surfaceWithClouds = mix(planetColor, vec3(1.0), cloudFactor * 0.5);
    
    // Basic lighting
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    vec3 ambient = 0.3 * surfaceWithClouds;
    vec3 diffuseLight = diffuse * surfaceWithClouds;
    
    // Add atmospheric rim effect
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float rimDot = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float rimFactor = pow(rimDot, 3.0);
    vec3 rimColor = rimFactor * mix(
        vec3(0.5, 0.7, 1.0),  // Blue atmosphere
        vec3(1.0, 0.6, 0.6),  // Pink atmosphere
        fract(uSeed * 5.67)
    ) * 0.8;
    
    // Final color
    vec3 finalColor = ambient + diffuseLight + rimColor;
    
    gl_FragColor = vec4(finalColor, 1.0);
} 