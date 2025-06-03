// Nh.frag - Metallic element
precision highp float;

// Uniforms
uniform vec3 lightDirection;
uniform float time;

// Element-specific color
const vec3 baseColor = vec3(0.4392, 0.4392, 0.4392);

// Varyings
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vViewDirection;

// Noise functions for metal detail
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

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 3; ++i) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

// Anisotropic specular highlight
float anisotropicSpecular(vec3 normal, vec3 tangent, vec3 viewDir, vec3 lightDir, float roughness) {
    vec3 halfVec = normalize(viewDir + lightDir);
    float NdotH = max(dot(normal, halfVec), 0.0);
    float TdotH = dot(tangent, halfVec);
    float aniso = max(0.0, sin(atan(TdotH, NdotH) * 8.0));
    return pow(aniso, 1.0/roughness) * pow(NdotH, 20.0);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewDirection);
    
    // Generate tangent for anisotropic effect based on world position
    vec3 worldDeriv = normalize(vec3(
        noise(vWorldPosition + vec3(0.1, 0.0, 0.0)) - noise(vWorldPosition - vec3(0.1, 0.0, 0.0)),
        noise(vWorldPosition + vec3(0.0, 0.1, 0.0)) - noise(vWorldPosition - vec3(0.0, 0.1, 0.0)),
        noise(vWorldPosition + vec3(0.0, 0.0, 0.1)) - noise(vWorldPosition - vec3(0.0, 0.0, 0.1))
    ));
    vec3 tangent = normalize(cross(normal, worldDeriv));
    
    // Multi-scale surface details
    // Fine grain (scratches, micro-structure)
    float microDetail = noise(vWorldPosition * 50.0) * 0.03;
    
    // Medium grain (small imperfections, dents)
    float mediumDetail = noise(vWorldPosition * 15.0) * 0.08;
    
    // Large grain (brushed patterns, significant imperfections)
    float largeDetail = noise(vWorldPosition * 3.0) * 0.15;
    
    // Oxidation/tarnish pattern
    float oxidation = fbm(vWorldPosition * 2.0 + normal * 0.5);
    float oxidationAmount = smoothstep(0.6, 1.0, oxidation) * 0.4;
    
    // Time-based subtle shimmer
    float shimmer = sin(vWorldPosition.x * 20.0 + time * 0.5) 
                  * sin(vWorldPosition.z * 20.0 + time * 0.3) * 0.03;
    
    // Advanced metallic specular
    vec3 lightDir = normalize(lightDirection);
    vec3 halfVector = normalize(lightDir + viewDir);
    
    // Multiple specular components for more realistic look
    float mainSpec = pow(max(dot(normal, halfVector), 0.0), 80.0) * 2.0;
    float wideSpec = pow(max(dot(normal, halfVector), 0.0), 8.0) * 0.3;
    
    // Anisotropic highlight (brushed metal effect)
    float aniso = anisotropicSpecular(normal, tangent, viewDir, lightDir, 0.2) * 0.7;
    
    // Diffuse lighting
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    // Fresnel effect - much stronger for metals
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
    
    // Environment reflection (approximated)
    vec3 reflection = reflect(-viewDir, normal);
    float envReflection = (
        noise(reflection * 0.3) * 0.5 + 
        noise(reflection * 0.1) * 0.3 + 
        noise(reflection * 0.03) * 0.2
    );
    
    // Terrain-based variation
    float slopeFactor = dot(normal, vec3(0.0, 1.0, 0.0));
    
    // Weathering on exposed vs. protected areas
    float weathering = mix(0.2, 0.0, slopeFactor);
    
    // Combine detail maps
    float detailMap = microDetail + mediumDetail + largeDetail + shimmer;
    
    // Base metal color with tarnish
    vec3 metalBase = mix(baseColor, baseColor * 0.6, oxidationAmount);
    
    // Specular color - brighter metals have whiter specular
    float brightness = (baseColor.r + baseColor.g + baseColor.b) / 3.0;
    vec3 specColor = mix(baseColor, vec3(1.0), brightness * 0.7);
    
    // Combine all effects
    vec3 finalColor = 
        metalBase * (0.3 + diffuse * 0.4) +  // Base metal color with diffuse
        specColor * mainSpec +  // Sharp specular highlight
        specColor * wideSpec +  // Wider specular highlight
        specColor * aniso +     // Anisotropic highlight
        mix(baseColor, vec3(1.0), brightness * 0.5) * fresnel * (0.8 - oxidationAmount * 0.6) +  // Edge reflection, reduced by oxidation
        baseColor * envReflection * (0.3 - oxidationAmount * 0.2) +  // Environment reflection
        baseColor * detailMap;  // Surface details
    
    // Final adjustment based on terrain & time
    finalColor *= mix(0.7, 1.3, slopeFactor * 0.5 + 0.5); // Variation based on slope
    finalColor *= (0.98 + 0.04 * sin(time * 0.1)); // Subtle time-based variation
    
    gl_FragColor = vec4(finalColor, 1.0); // Metals are opaque
}