// Lu.frag - Crystalline element
precision highp float;

// Uniforms
uniform vec3 lightDirection;
uniform float time;

// Element-specific color
const vec3 baseColor = vec3(0.1176, 0.5647, 1.0000);

// Varyings
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

// Hash function for noise
float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
            f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
            f.y),
        f.z
    );
}

// Voronoi function for crystal facet structure
vec3 voronoi(vec3 p) {
    vec3 b, c;
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float distMin = 1.0;
    
    for(int i = -1; i <= 1; i++) {
        for(int j = -1; j <= 1; j++) {
            for(int k = -1; k <= 1; k++) {
                vec3 offset = vec3(float(i), float(j), float(k));
                vec3 h = offset - fp + vec3(hash(ip + offset),
                                           hash(ip + offset + 31.23),
                                           hash(ip + offset + 42.34));
                float d = length(h);
                if(d < distMin) {
                    distMin = d;
                    b = h;
                    c = offset;
                }
            }
        }
    }
    
    return vec3(distMin, b.x, b.y); // return distance and some of the cell info
}

// Crystal lattice pattern (more sharply defined than simple sine)
float lattice(vec3 p) {
    float voronoiValue = voronoi(p * 4.0).x;
    
    // Create sharper facets with step function
    float facets = smoothstep(0.1, 0.15, voronoiValue);
    
    // Add some cellular pattern
    float cells = step(0.7, noise(p * 8.0));
    
    return mix(facets, cells, 0.2);
}

// Dispersion - split light at different angles into component colors
vec3 dispersion(vec3 rayDir, vec3 normal, float power) {
    vec3 dispersed;
    vec3 rRefract = refract(rayDir, normal, 0.68); // Red
    vec3 gRefract = refract(rayDir, normal, 0.67); // Green
    vec3 bRefract = refract(rayDir, normal, 0.66); // Blue
    
    // If refraction failed, use reflection
    if(length(rRefract) < 0.5) rRefract = reflect(rayDir, normal);
    if(length(gRefract) < 0.5) gRefract = reflect(rayDir, normal);
    if(length(bRefract) < 0.5) bRefract = reflect(rayDir, normal);
    
    dispersed.r = noise(rRefract * 0.5) * power;
    dispersed.g = noise(gRefract * 0.5) * power;
    dispersed.b = noise(bRefract * 0.5) * power;
    
    return dispersed * 0.5 + 0.5; // Normalize to 0-1 range
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Time-based animation for internal sparkle
    float animTime = time * 0.2;
    
    // Create crystalline structure with facets
    float facetPattern = lattice(vWorldPosition * 1.5);
    
    // Add finer crystal structure
    float microFacets = lattice(vWorldPosition * 8.0 + normal * 2.0);
    
    // Internal structures - veins, inclusions, fracture planes
    float internalNoise = noise(vWorldPosition * 3.0 + vec3(0.0, animTime * 0.5, 0.0));
    float internalLayers = sin(vWorldPosition.y * 20.0 + cos(vWorldPosition.x * 10.0) * 2.0) * 0.5 + 0.5;
    float inclusions = smoothstep(0.75, 0.8, noise(vWorldPosition * 4.0 + vec3(animTime * 0.3)));
    
    // Combine internal structures
    float internalPattern = mix(
        mix(internalNoise, internalLayers, 0.5),
        inclusions * 2.0,
        0.3
    );
    
    // Sharp specular highlight with multiple reflective facet angles
    vec3 lightDir = normalize(lightDirection);
    vec3 reflectDir = reflect(-lightDir, normal);
    float mainSpecular = pow(max(dot(viewDir, reflectDir), 0.0), 80.0) * 2.0;
    
    // Additional highlights from facet structure
    vec3 perturbedNormal = normalize(normal + vec3(
        noise(vWorldPosition * 10.0) * 0.2,
        noise(vWorldPosition * 10.0 + 32.34) * 0.2,
        noise(vWorldPosition * 10.0 + 63.19) * 0.2
    ) * facetPattern);
    vec3 perturbedReflect = reflect(-lightDir, perturbedNormal);
    float facetSpecular = pow(max(dot(viewDir, perturbedReflect), 0.0), 50.0) * facetPattern;
    
    // Total specular is combination of main surface and facets
    float specular = mainSpecular + facetSpecular;
    
    // Internal reflections/refractions with dispersion
    vec3 refractColor = dispersion(viewDir, normal, 0.3 + 0.2 * internalPattern);
    
    // Create color shifts and rainbows along edges (dispersion/iridescence)
    float fresnelPower = 3.0;
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), fresnelPower);
    
    // Increase color shifting based on internal structure
    vec3 shiftedColor = baseColor + refractColor * internalPattern * 0.4;
    
    // Pulsating internal glow
    float glow = sin(animTime) * 0.5 + 0.5;
    vec3 glowColor = baseColor * glow * 0.2;
    
    // Combine all lighting and effects
    vec3 finalColor = 
        // Base diffuse color
        baseColor * max(dot(normal, lightDir), 0.0) * 0.5 +
        
        // Internal structure and colors
        shiftedColor * internalPattern * 0.5 +
        
        // Edge-based dispersion/prismatic effect
        refractColor * fresnel * 0.6 +
        
        // Strong specular reflections
        vec3(1.0) * specular +
        
        // Ambient component
        baseColor * 0.2 +
        
        // Small internal glow for gem-like elements
        glowColor * (1.0 - facetPattern);
    
    // Sparkling effect - small bright points that change with time and view angle
    float sparkle = pow(noise(
        vWorldPosition * 10.0 + 
        animTime * vec3(1.0, 1.5, 0.5) +
        viewDir * 2.0
    ), 20.0) * 5.0;
    
    finalColor += vec3(sparkle);
    
    // Terrain-based variation
    float slopeFactor = dot(normal, vec3(0.0, 1.0, 0.0));
    finalColor *= mix(0.9, 1.1, slopeFactor * 0.5 + 0.5);
    
    // Higher transparency near edges for realistic crystal look
    float alpha = mix(0.9, 1.0, microFacets);
    alpha = mix(alpha, 0.85, fresnel * 0.4); // More transparent at edges
    
    gl_FragColor = vec4(finalColor, alpha);
}