precision highp float;

// Varyings declared to match vertex shader, but not used in this simplified version
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUv;

// Uniforms declared but not used in this simplified version
// uniform vec3 uCameraPos;
// uniform float uTime;
// uniform float uSeed;
// uniform vec3 uPlanetCenter;
// uniform float uPlanetRadius;

// Re-enable Uniforms
uniform vec3 uCameraPos;
uniform float uTime;
uniform float uSeed;
uniform vec3 uPlanetCenter; // World position of the planet center
uniform float uPlanetRadius; // Actual radius of the planet inside

const float PI = 3.141592653589793;

// --- Noise Functions (Simplified - only need rand for this) ---
float rand(vec3 co){ return fract(sin(dot(co.xyz ,vec3(12.9898,78.233, 54.53))) * 43758.5453); }
// --- End Noise ---

// Re-enable Hexagon Intensity Function
float getHexIntensity(vec3 posRelCenter, float scale, float thickness) {
    // Project onto XY plane (like looking down the pole) for primary hex shape
    vec2 xyPos = posRelCenter.xy * scale;
    
    // Hexagon distance field approximation (simplified)
    // Rotate coordinates by 30 degrees to align axes with hex vertices
    float angle = atan(xyPos.y, xyPos.x) + PI/6.0; // Add PI/6 = 30 degrees
    float radius = length(xyPos);
    vec2 rotatedPos = vec2(cos(angle), sin(angle)) * radius;
    
    // Use absolute values and max for hex distance approx
    vec2 absPos = abs(rotatedPos);
    float hexDist = max(absPos.x * 0.866025 + absPos.y * 0.5, absPos.y); // Approx distance to edge
    
    // Add some 3D variation using Z
    hexDist = mix(hexDist, length(posRelCenter.xz * scale) * 0.8, 0.3); // Blend with XZ plane projection
    hexDist = mix(hexDist, length(posRelCenter.yz * scale) * 0.8, 0.3); // Blend with YZ plane projection
    
    // Calculate line intensity based on distance
    return smoothstep(thickness, thickness * 0.8, hexDist); // Sharp falloff
}

void main() {
    // --- Re-enable Random Factors & Parameters ---
    float r1 = fract(uSeed * 91.23);
    float r2 = fract(uSeed * 82.34 + r1);
    float r3 = fract(uSeed * 73.45 + r2);
    float r4 = fract(uSeed * 64.56 + r3);

    float hexScale = 1.0 / (uPlanetRadius * (1.0 + r1 * 0.2)); 
    float lineThickness = 0.05 + r2 * 0.1; 
    float pulseSpeed = 0.8 + r3 * 1.5; 
    float pulseMagnitude = 0.5 + r4 * 0.5; 
    vec3 hexColor = mix(vec3(0.1, 1.0, 0.8), vec3(1.0, 0.8, 0.1), r1); 
    hexColor = mix(hexColor, vec3(1.0, 0.3, 1.0), r2*r3); 

    // --- Re-enable Hex Intensity Calculation ---
    vec3 posRelCenter = vWorldPos - uPlanetCenter;
    float hexIntensity = getHexIntensity(posRelCenter, hexScale, lineThickness);

    // Re-enable Noise Distortion
    float distortionNoise = rand(vWorldPos * 5.0 + uTime * 0.1) - 0.5;
    hexIntensity *= (1.0 + distortionNoise * 0.2 * r4); 
    hexIntensity = clamp(hexIntensity, 0.0, 1.0);

    // --- Re-enable Pulsing Effect ---
    float pulse = (1.0 - pulseMagnitude) + pulseMagnitude * (0.5 + 0.5 * sin(uTime * pulseSpeed + uSeed * 20.0 + length(posRelCenter)*0.1));
    
    // --- Re-enable Edge Fade (Fresnel) ---
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 3.0); 

    // --- Re-enable Final Color & Alpha ---
    vec3 finalColor = hexColor * hexIntensity * pulse * (1.0 + fresnel * 1.5); // Make edges brighter
    float finalAlpha = hexIntensity * fresnel * (0.5 + r3*0.5); // Fade based on hex, view angle, and seed

    gl_FragColor = vec4(finalColor, finalAlpha);
} 