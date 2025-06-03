precision highp float;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

uniform float uTime;
uniform float uSeed;
uniform vec3 uColor;

// Constants
const float PI = 3.141592653589793;
const float EDGE_THRESHOLD = 0.6; // Threshold for edge detection

void main() {
    // --- Random factors from seed ---
    float r1 = fract(uSeed * 123.456);
    float r2 = fract(uSeed * 789.123 + r1);
    float r3 = fract(uSeed * 456.789 + r2);
    
    // --- Base color from uniform ---
    vec3 baseColor = uColor;
    
    // --- Edge detection using normals ---
    // Calculate how parallel the normal is to the view direction (camera)
    // When the normal is perpendicular to view, we're looking at an edge
    float edgeFactor = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    
    // Apply smoothstep to create a sharp edge effect
    float edge = smoothstep(EDGE_THRESHOLD, EDGE_THRESHOLD + 0.2, edgeFactor);
    
    // --- Pulsing effect ---
    float pulseSpeed = 0.5 + r2 * 1.5;
    float pulseMagnitude = 0.3 + r3 * 0.4;
    float pulse = (1.0 - pulseMagnitude) + pulseMagnitude * (0.5 + 0.5 * sin(uTime * pulseSpeed + uSeed * 10.0));
    
    // --- Combine edge and pulse effects ---
    vec3 glowColor = baseColor * 1.5; // Brighter color for the glow
    vec3 fillColor = baseColor * 0.4; // Darker color for the fill
    
    // Mix between fill and glow based on edge factor
    vec3 finalColor = mix(fillColor, glowColor, edge * pulse);
    
    // --- Alpha calculation ---
    // More transparent in the center, more opaque at the edges
    float alpha = 0.2 + edge * 0.6 * pulse;
    
    gl_FragColor = vec4(finalColor, alpha);
} 