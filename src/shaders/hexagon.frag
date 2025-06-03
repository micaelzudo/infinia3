precision highp float;

varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying float vDistance;

uniform vec3 uColor;         // Base color
uniform vec3 uGlowColor;     // Glow color (can be made dynamic)
uniform float uTime;
uniform float uOpacity;
uniform float uBorderWidth;
uniform float uGlowIntensity;

// Hash function for pseudo-random values
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Line segment SDF for hexagon pattern
float lineSDF(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    vec2 pt = a + t * ba;
    return length(p - pt);
}

// Hexagon pattern generator
float hexPattern(vec2 p, float scale, float lineWidth) {
    p *= scale;
    vec2 grid = floor(p);
    vec2 local = fract(p) * 2.0 - 1.0;
    float angle = 3.14159 / 3.0;
    float value = 1.0;
    for (int i = 0; i < 6; i++) {
        float a1 = float(i) * angle;
        float a2 = float(i+1) * angle;
        vec2 p1 = vec2(cos(a1), sin(a1)) * 0.5;
        vec2 p2 = vec2(cos(a2), sin(a2)) * 0.5;
        float lineDist = lineSDF(local, p1, p2);
        value = min(value, smoothstep(0.0, lineWidth, lineDist));
    }
    return 1.0 - value;
}

// Function to get color with chromatic aberration
vec3 getColorAberration(vec2 uv_offset, float time_offset, float intensity) {
    float hexScale = 10.0;
    float hexLineWidth = 0.05 + 0.02 * sin(uTime + time_offset);
    float hexPattern1 = hexPattern(vUv + uv_offset, hexScale, hexLineWidth);
    float hexPattern2 = hexPattern(vUv + vec2(0.5, 0.5) + uv_offset, hexScale * 2.0, hexLineWidth * 0.5);
    float hexFactor = hexPattern1 * 0.7 + hexPattern2 * 0.3;
    hexFactor *= (0.7 + 0.3 * sin((uTime + time_offset) * 0.5 + (vUv.x + uv_offset.x) * 4.0));

    float edgeFactor = smoothstep(1.0 - uBorderWidth, 1.0, vDistance);
    float pulsingEdge = edgeFactor * (0.6 + 0.4 * sin((uTime + time_offset) * 2.0));

    float scanline = smoothstep(0.4, 0.6, sin((vUv.y + uv_offset.y) * 30.0 + (uTime + time_offset) * 2.0) * 0.5 + 0.5) * 0.1;
    float staticNoise = hash((vUv + uv_offset) * 100.0 + vec2((uTime + time_offset) * 10.0, 0.0)) * 0.05;

    // Dynamic glow color
    vec3 dynamicGlow = mix(uGlowColor, vec3(1.0, 0.5, 0.8), 0.5 + 0.5 * sin(uTime * 0.7 + time_offset));

    vec3 color = mix(uColor, dynamicGlow, pulsingEdge * uGlowIntensity);
    color = mix(color, dynamicGlow, hexFactor * 0.3);
    color += dynamicGlow * scanline;
    color += staticNoise * dynamicGlow;

    return color;
}

void main() {
    // Chromatic Aberration Settings
    float aberrationIntensity = 0.005; // Controls the separation distance
    vec2 offsetR = vec2(aberrationIntensity * (0.5 + 0.5*sin(uTime * 1.1)), 0.0);
    vec2 offsetG = vec2(0.0, aberrationIntensity * (0.5 + 0.5*cos(uTime * 1.3)));
    vec2 offsetB = vec2(-aberrationIntensity * (0.5 + 0.5*sin(uTime * 0.9)), -aberrationIntensity * (0.5 + 0.5*cos(uTime * 1.2)));

    // Sample colors with offsets
    vec3 colorR = getColorAberration(offsetR, 0.0, aberrationIntensity);
    vec3 colorG = getColorAberration(offsetG, 0.1, aberrationIntensity);
    vec3 colorB = getColorAberration(offsetB, 0.2, aberrationIntensity);

    // Combine channels
    vec3 finalColor = vec3(colorR.r, colorG.g, colorB.b);
    
    // --- Base Hex Subpattern ---
    // Subtle underlying hex grid
    float basePattern = hexPattern(vUv, 6.0, 0.12);
    finalColor = mix(finalColor, uColor * 0.5, basePattern * 0.2);

    // --- Hyperverse Holographic Layers ---
    // Wavy hologram overlay (more pronounced)
    float waveAmt = sin((vPosition.x + vPosition.y) * 6.0 + uTime * 4.0) * 0.04;
    vec2 waveUV = vUv + vec2(waveAmt);
    float holoLayer = hexPattern(waveUV, 12.0, 0.08);
    finalColor = mix(finalColor, uGlowColor * 1.5, holoLayer * 0.6);
    // Dynamic grid lines overlay (softened, less frequent)
    float fx = fract(vUv.x * 4.0 + uTime * 0.2);
    float fy = fract(vUv.y * 4.0 + uTime * 0.2);
    float gridX = smoothstep(0.95, 0.98, fx);
    float gridY = smoothstep(0.95, 0.98, fy);
    float gridLines = (gridX + gridY) * 0.5;
    // Lowered intensity for subtler effect
    finalColor += gridLines * 0.15 * uGlowColor;
    // Enhanced flicker noise
    float flick = hash(vUv * 150.0 + floor(uTime * 15.0)) * 0.1;
    finalColor += flick * 0.4 * uGlowColor;
    
    // --- Calculate Opacity (using center sample for simplicity) ---
    float hexScale = 10.0;
    float hexLineWidth = 0.05 + 0.02 * sin(uTime);
    float hexPattern1 = hexPattern(vUv, hexScale, hexLineWidth);
    float hexPattern2 = hexPattern(vUv + vec2(0.5, 0.5), hexScale * 2.0, hexLineWidth * 0.5);
    float hexFactor = hexPattern1 * 0.7 + hexPattern2 * 0.3;
    hexFactor *= (0.7 + 0.3 * sin(uTime * 0.5 + vUv.x * 4.0));
    float edgeFactor = smoothstep(1.0 - uBorderWidth, 1.0, vDistance);
    float pulsingEdge = edgeFactor * (0.6 + 0.4 * sin(uTime * 2.0));

    float finalOpacity = uOpacity;
    finalOpacity = max(finalOpacity, pulsingEdge * 0.8);
    finalOpacity = max(finalOpacity, hexFactor * 0.2);
    // --------------------------------------------------------------

    gl_FragColor = vec4(finalColor, finalOpacity);
} 