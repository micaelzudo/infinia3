precision highp float;

// Include Common Utilities
#include ./modules/math.glsl
#include ./modules/noise.glsl
#include ./modules/raymarching.glsl
#include ./modules/wormholeDistortion.glsl

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform mat4 uCameraMatrix;

const float FOV = 0.8;
const int MAX_STEPS = 100;
const float MAX_DIST = 100.0;
const float SURF_DIST = 0.01;

// Scene configuration
const float WORMHOLE_RADIUS = 2.0;
const float WORMHOLE_LENGTH = 10.0;
const vec3 WORMHOLE_CENTER = vec3(0.0, 0.0, 0.0);

// SDF for a torus shape forming the wormhole ring
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// SDF for the wormhole tunnel
float sdWormholeTunnel(vec3 p) {
    // Distort space as approaching wormhole
    vec3 distortedPos = p;
    
    // Apply throat effect to create the tunnel structure
    distortedPos = wormholeThroatEffect(distortedPos, uTime, WORMHOLE_RADIUS);
    
    // Core tunnel structure (hollow cylinder along z-axis)
    float cylinderRadius = WORMHOLE_RADIUS * 1.5;
    float tunnelThickness = 0.2;
    
    // Calculate distance to the tunnel walls
    float distToTunnel = abs(length(distortedPos.xy) - cylinderRadius) - tunnelThickness;
    
    // Limit the tunnel length
    float zLimit = clamp(abs(distortedPos.z), 0.0, WORMHOLE_LENGTH);
    if (zLimit == WORMHOLE_LENGTH) {
        distToTunnel = max(distToTunnel, abs(distortedPos.z) - WORMHOLE_LENGTH);
    }
    
    return distToTunnel;
}

// Full scene SDF
float sceneSDF(vec3 p) {
    // Apply space-time curvature to the entire scene
    vec3 distortedPos = spacetimeCurvature(p, uTime, 0.2);
    
    // The wormhole tunnel
    float wormhole = sdWormholeTunnel(distortedPos);
    
    // Add some detail to the wormhole structure
    float detail = 0.0;
    
    // Add ripple details to the tunnel using FBM noise
    float noise = fbm(vec3(distortedPos.xy * 2.0, uTime * 0.1));
    detail = noise * 0.05;
    
    // Combine with the main shape
    return wormhole + detail;
}

// Calculate normal at a point
vec3 getNormal(vec3 p) {
    float d = sceneSDF(p);
    vec2 e = vec2(0.01, 0.0);
    
    vec3 n = d - vec3(
        sceneSDF(p - e.xyy),
        sceneSDF(p - e.yxy),
        sceneSDF(p - e.yyx)
    );
    
    return normalize(n);
}

// Rendering the scene
vec3 render(Ray ray) {
    vec3 color = vec3(0.0);
    
    // Raymarch the scene
    float dist = rayMarch(ray, MAX_STEPS, MAX_DIST, SURF_DIST);
    
    if (dist < MAX_DIST) {
        // Hit point
        vec3 p = ray.origin + ray.direction * dist;
        
        // Surface normal
        vec3 normal = getNormal(p);
        
        // Basic lighting
        vec3 lightDir = normalize(vec3(1.0, 2.0, 3.0));
        float diffuse = max(0.0, dot(normal, lightDir));
        
        // Base material color with position-based variation
        vec3 baseColor = mix(
            vec3(0.1, 0.2, 0.5),  // Dark blue
            vec3(0.5, 0.1, 0.5),  // Purple
            length(p.xy) / WORMHOLE_RADIUS
        );
        
        // Add glow based on proximity to wormhole center
        float distToCenter = length(p - WORMHOLE_CENTER);
        float glow = 1.0 - min(1.0, distToCenter / (WORMHOLE_RADIUS * 2.0));
        glow = pow(glow, 2.0);
        
        // Apply colors
        color = baseColor * (diffuse * 0.5 + 0.5);
        
        // Add event horizon glow effect
        color += eventHorizonGlow(p, uTime, ray.origin) * 2.0;
        
        // Energy streaks along the tunnel
        float streak = sin(p.z * 2.0 + uTime * 3.0) * 0.5 + 0.5;
        streak = pow(streak, 8.0) * smoothstep(0.0, 1.0, glow);
        color += vec3(0.8, 0.9, 1.0) * streak;
        
        // Atmospheric fog/depth effect
        float depth = smoothstep(0.0, MAX_DIST * 0.5, dist);
        color = mix(color, vec3(0.0, 0.0, 0.1), depth);
    } else {
        // Background space with stars
        vec3 background = vec3(0.0, 0.0, 0.05); // Dark space background
        
        // Add distant stars
        vec3 starDir = ray.direction;
        float stars = pow(noise3D(starDir * 100.0), 20.0);
        background += vec3(stars);
        
        // Apply gravitational lensing to the background
        vec2 uv = ray.direction.xy;
        vec2 lensedUV = gravitationalLensing(uv, vec2(0.0), 2.0, 0.4);
        
        // Add a subtle nebula in the background
        float nebula = fbm(vec3(lensedUV * 5.0, uTime * 0.05));
        background += vec3(0.1, 0.05, 0.2) * nebula;
        
        color = background;
    }
    
    return color;
}

void main() {
    // Set up the ray from camera
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
    
    // Apply gravitational lensing to the UV coordinates
    uv = gravitationalLensing(uv, vec2(0.0), 0.5, 0.8);
    
    // Create ray from camera
    Ray ray;
    ray.origin = uCameraPosition;
    
    // Calculate ray direction with proper view matrix
    vec3 rayDir = normalize(vec3(uv * FOV, 1.0));
    ray.direction = (uCameraMatrix * vec4(rayDir, 0.0)).xyz;
    
    // Render the scene
    vec3 color = render(ray);
    
    // Apply basic tone mapping and gamma correction
    color = color / (1.0 + color); // Simple Reinhard tone mapping
    color = pow(color, vec3(0.4545)); // Gamma correction (1/2.2)
    
    gl_FragColor = vec4(color, 1.0);
} 