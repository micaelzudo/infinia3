precision highp float;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vViewPosition;
varying mat4 vModelViewMatrix;
varying vec3 vOriginalPosition;
varying float vImperfection;

uniform sampler2D uTexture;  // The text texture from canvas
uniform float uTime;
uniform float uDepth;
uniform vec3 uGlowColor;
uniform float uHoloPulse;

// Constants
const float EDGE_THRESHOLD = 0.3;
const float DEPTH_SCALE = 0.15;
const float GLOW_INTENSITY = 1.2;
const float SPECULAR_POWER = 32.0;

// Noise functions for surface imperfections
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
    );
    
    return n;
}

// Fake light position that moves for dramatic effect
vec3 getLightPos() {
    float t = uTime * 0.5;
    vec3 lightPos = vec3(
        4.0 * sin(t),
        2.0 + 2.0 * cos(t * 0.7),
        -5.0 + sin(t * 0.3) * 2.0
    );
    return lightPos;
}

// Compute a fake normal based on texture derivatives
vec3 computeNormal() {
    vec3 fdx = dFdx(vPosition);
    vec3 fdy = dFdy(vPosition);
    return normalize(cross(fdx, fdy));
}

void main() {
    // Basic texture lookup
    vec4 texColor = texture2D(uTexture, vUv);
    
    // Completely discard transparent background pixels to prevent z-fighting
    if (texColor.a < 0.01) {
        discard;
    }
    
    // Only apply 3D effects to actual text pixels
    // This creates a clean separation between text and background
    float textMask = step(0.1, texColor.a);
    
    // Calculate effective depth based on displacement
    float zDepth = distance(vPosition, vOriginalPosition);
    
    // Calculate lighting with imperfections
    vec3 N = computeNormal();
    // Add subtle surface variance to normal for microdetail
    N = normalize(N + vec3(
        noise(vUv * 40.0 + uTime * 0.05) * 0.08 - 0.04,
        noise(vUv * 41.0 + uTime * 0.06) * 0.08 - 0.04,
        0.0
    ) * textMask);
    
    vec3 L = normalize(vec3(vModelViewMatrix * vec4(getLightPos(), 1.0)) - vViewPosition);
    vec3 V = normalize(-vViewPosition);
    vec3 H = normalize(L + V);
    
    // Lighting components with micro-variance
    float ambientVar = noise(vUv * 30.0 + uTime * 0.02) * 0.1;
    float ambient = 0.3 + ambientVar * textMask;
    float diffuse = max(dot(N, L), 0.0) * 0.6;
    
    // Create patchy specularity effect for worn look
    float specMask = smoothstep(0.4, 0.6, noise(vUv * 15.0));
    float specular = pow(max(dot(N, H), 0.0), SPECULAR_POWER) * texColor.a * specMask;
    
    // --- Create time-based animation effects ---
    float pulseFreq = 2.0 + sin(uTime * 0.5) * 0.5;
    float pulse = 0.8 + 0.2 * sin(uTime * pulseFreq);
    
    // Create fluctuating power effect like an unstable hologram
    float powerFlicker = 1.0 - (noise(vec2(uTime * 3.0, 0.0)) * 0.15 * pulse);
    
    // Scanline + hex grid pattern effect with imperfections
    float scanline = smoothstep(0.3, 0.7, sin(vUv.y * 30.0 + uTime * 2.0) * 0.5 + 0.5);
    // Add occasional scan glitches
    float scanGlitch = step(0.97, noise(vec2(uTime * 5.0, floor(vUv.y * 20.0)))) 
                      * noise(vec2(uTime * 50.0, vUv.y * 100.0));
    scanline += scanGlitch * pulse;
    
    // Hexagonal grid with slight distortion to look imperfect
    vec2 hexUv = vUv * 20.0;
    hexUv.x += sin(hexUv.y * 0.8 + uTime) * 0.1;
    float hexGrid = 0.05 * max(
        sin(hexUv.x + hexUv.y * 0.5 + uTime),
        sin(hexUv.y - hexUv.x * 0.5 + uTime * 0.7)
    );
    
    // Add static/noise effect
    float staticNoise = hash(vUv * 500.0 + uTime * 10.0) * 0.03 * pulse;
    
    // Edge detection for glowing outline with wear
    float isEdge = 0.0;
    float pixelSize = 1.0 / 256.0; // Assuming 256x256 texture
    
    // Simple edge detection by sampling neighboring pixels
    float n1 = texture2D(uTexture, vUv + vec2(pixelSize, 0.0)).a;
    float n2 = texture2D(uTexture, vUv + vec2(-pixelSize, 0.0)).a;
    float n3 = texture2D(uTexture, vUv + vec2(0.0, pixelSize)).a;
    float n4 = texture2D(uTexture, vUv + vec2(0.0, -pixelSize)).a;
    
    // If this pixel has alpha but neighbors don't, it's an edge
    isEdge = max(max(abs(texColor.a - n1), abs(texColor.a - n2)), 
                max(abs(texColor.a - n3), abs(texColor.a - n4)));
    isEdge = smoothstep(0.1, 0.3, isEdge);
    
    // Edge glow with imperfections - some edges glow less
    float edgeGlowVariance = noise(vUv * 10.0) * 0.4 + 0.6; // 0.6-1.0 range
    isEdge *= edgeGlowVariance;
    
    // --- Calculate final color ---
    // Base color with subtle tinting variation
    vec3 tintVar = vec3(
        noise(vUv * 5.0 + vec2(0.0, uTime * 0.1)) * 0.1 - 0.05,
        noise(vUv * 5.0 + vec2(uTime * 0.1, 0.0)) * 0.1 - 0.05,
        noise(vUv * 5.0 + vec2(uTime * 0.05, uTime * 0.05)) * 0.1 - 0.05
    );
    
    // Base is white with a tint of the glow color and imperfections
    vec3 baseColor = mix(vec3(1.0) + tintVar, uGlowColor, 0.3 + vImperfection * 0.2) * texColor.rgb;
    
    // Apply lighting with imperfections
    vec3 litColor = baseColor * (ambient + diffuse) + vec3(specular * 1.0 * edgeGlowVariance);
    
    // Add glow at the edges with imperfections
    vec3 glowColor = mix(litColor, uGlowColor, isEdge * GLOW_INTENSITY * pulse);
    
    // Add scanline and hex grid effects - only on the text, not background
    glowColor = mix(glowColor, uGlowColor, (scanline + hexGrid) * 0.15 * pulse * textMask);
    
    // Add static noise
    glowColor += vec3(staticNoise) * textMask;
    
    // Modulate brightness with pulse and imperfections
    float pulseModulation = mix(1.0, pulse, uHoloPulse * textMask);
    pulseModulation *= powerFlicker; // Add power flicker effect
    glowColor *= pulseModulation;
    
    // Add weathered look - dark patches in some areas
    float weathering = smoothstep(0.4, 0.6, noise(vUv * 8.0)) * 0.15 * textMask;
    glowColor *= 1.0 - weathering;
    
    // Add dramatic rim lighting effect - only on actual text characters
    float rim = (1.0 - max(dot(N, V), 0.0)) * texColor.a * textMask;
    // Vary rim intensity for imperfect look
    rim *= (0.8 + noise(vUv * 20.0) * 0.4);
    glowColor += uGlowColor * rim * pulse * 0.8;
    
    // Add imperfection from vertex shader to final color
    glowColor = mix(glowColor, glowColor * 0.8, vImperfection * 0.5);
    
    // Create final color with slightly higher alpha at edges for better visibility
    // Add depth-based transparency to avoid z-fighting
    float finalAlpha = texColor.a * (1.0 + isEdge * 0.5);
    
    // Make sure background pixels remain fully transparent
    finalAlpha *= textMask;
    
    gl_FragColor = vec4(glowColor, finalAlpha);
} 