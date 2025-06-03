precision mediump float; 
uniform float uTime;
varying vec2 vUv;

// Color definitions
vec3 colorA = vec3(0.1, 0.2, 0.8); // Deep Blue
vec3 colorB = vec3(0.5, 0.2, 1.0); // Purple
vec3 colorC = vec3(0.2, 0.8, 1.0); // Cyan

// --- Hex Grid Function ---
// Reference: https://www.shadertoy.com/view/Xd2GR3
const vec2 H = vec2(1.0, 1.73205);

float hexDist(vec2 p) {
    p = abs(p);
    float c = dot(p, H * 0.5);
    c = max(c, p.x);
    return c;
}

// Returns distance to nearest hex edge
float hexGrid(vec2 uv, float scale, float lineWidth) {
    vec2 p = uv * scale;
    vec2 i = floor(p + 0.5 * H);
    vec2 f = p - i + 0.5 * H;
    
    vec2 id = (mod(i.x + i.y, 2.0) == 0.0) ? i : i + vec2(1.0, 0.0);
    
    vec2 center = (id - 0.5 * H);
    float dist = hexDist(f - 0.5 * H);
    
    // Create lines - smoothstep for anti-aliasing
    float line = smoothstep(0.5 - lineWidth, 0.5 + lineWidth, dist);
    return line;
}
// --- End Hex Grid Function ---

void main() {
    // Base color gradient
    vec3 baseColor = mix(colorA, colorB, smoothstep(0.3, 0.7, sin(vUv.y * 2.0 + uTime * 0.5)));
    baseColor = mix(baseColor, colorC, smoothstep(0.3, 0.7, cos(vUv.x * 2.0 + uTime * 0.7)));

    // Calculate hexagonal grid pattern
    float scale = 25.0; // Adjust scale for hexagon size
    float lineWidth = 0.03; // Adjust line thickness
    float hexPattern = hexGrid(vUv, scale, lineWidth);

    // Make hex lines glow slightly based on time
    vec3 hexColor = vec3(0.8, 0.8, 1.0) * (0.5 + 0.5 * sin(uTime * 2.0)); // Pulsing white/cyan
    
    // Combine base color with hex grid lines (darken base color where lines are)
    vec3 finalColor = mix(baseColor, hexColor, 1.0 - hexPattern); 

    gl_FragColor = vec4(finalColor, 1.0);
} 