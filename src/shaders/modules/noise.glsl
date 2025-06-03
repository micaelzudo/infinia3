#ifndef NOISE_UTILS
#define NOISE_UTILS

#include "./math.glsl"

// Hash function for 1D input
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

// Hash function for 2D input returning 1D output
float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Hash function for 3D input returning 1D output
float hash31(vec3 p) {
    vec3 p3 = fract(p * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

// Hash function for 2D input returning 2D output
vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// Hash function for 3D input returning 3D output
vec3 hash33(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
}

// Value noise 1D
float valueNoise1D(float x) {
    float i = floor(x);
    float f = fract(x);
    
    // Cubic interpolation
    float u = f * f * (3.0 - 2.0 * f);
    
    float a = hash11(i);
    float b = hash11(i + 1.0);
    
    return mix(a, b, u);
}

// Value noise 2D
float valueNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Cubic interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, u.x),
               mix(c, d, u.x), u.y);
}

// Value noise 3D
float valueNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    
    // Cubic interpolation
    vec3 u = f * f * (3.0 - 2.0 * f);
    
    float a = hash31(i);
    float b = hash31(i + vec3(1.0, 0.0, 0.0));
    float c = hash31(i + vec3(0.0, 1.0, 0.0));
    float d = hash31(i + vec3(1.0, 1.0, 0.0));
    float e = hash31(i + vec3(0.0, 0.0, 1.0));
    float f1 = hash31(i + vec3(1.0, 0.0, 1.0));
    float g = hash31(i + vec3(0.0, 1.0, 1.0));
    float h = hash31(i + vec3(1.0, 1.0, 1.0));
    
    return mix(
        mix(mix(a, b, u.x), mix(c, d, u.x), u.y),
        mix(mix(e, f1, u.x), mix(g, h, u.x), u.y),
        u.z
    );
}

// Gradient noise (Perlin) 2D
float perlinNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    
    // Quintic interpolation
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
    
    vec2 ga = hash22(i) * 2.0 - 1.0;
    vec2 gb = hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0;
    vec2 gc = hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0;
    vec2 gd = hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0;
    
    float va = dot(ga, f);
    float vb = dot(gb, f - vec2(1.0, 0.0));
    float vc = dot(gc, f - vec2(0.0, 1.0));
    float vd = dot(gd, f - vec2(1.0, 1.0));
    
    return mix(mix(va, vb, u.x),
               mix(vc, vd, u.x), u.y);
}

// Gradient noise (Perlin) 3D
float perlinNoise3D(vec3 p) {
    return gradientNoise3D_edge(p) * 0.5 + 0.5;
}

// Simplex noise 2D
float simplexNoise2D(vec2 p) {
    const float K1 = 0.366025404; // (sqrt(3)-1)/2
    const float K2 = 0.211324865; // (3-sqrt(3))/6
    
    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    float m = step(a.y, a.x);
    vec2 o = vec2(m, 1.0 - m);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;
    
    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(
        dot(a, hash22(i) * 2.0 - 1.0),
        dot(b, hash22(i + o) * 2.0 - 1.0),
        dot(c, hash22(i + 1.0) * 2.0 - 1.0)
    );
    
    return 0.5 + 70.0 * (n.x + n.y + n.z);
}

// Simplex noise 3D
float simplexNoise3D(vec3 p) {
    const float F3 = 1.0 / 3.0;
    const float G3 = 1.0 / 6.0;
    
    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x = p - s + dot(s, vec3(G3));
    
    vec3 e = step(vec3(0.0), x - x.yzx);
    vec3 i1 = e * (1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1.0 - e);
    
    vec3 x1 = x - i1 + G3;
    vec3 x2 = x - i2 + 2.0 * G3;
    vec3 x3 = x - 1.0 + 3.0 * G3;
    
    vec4 w, d;
    
    w.x = dot(x, x);
    w.y = dot(x1, x1);
    w.z = dot(x2, x2);
    w.w = dot(x3, x3);
    
    w = max(0.6 - w, 0.0);
    
    d.x = dot(hash33(s) - 0.5, x);
    d.y = dot(hash33(s + i1) - 0.5, x1);
    d.z = dot(hash33(s + i2) - 0.5, x2);
    d.w = dot(hash33(s + 1.0) - 0.5, x3);
    
    w *= w;
    w *= w;
    d *= w;
    
    return 0.5 + 52.0 * (d.x + d.y + d.z + d.w);
}

// Fractal Brownian Motion (fBm) 1D
float fbm1D(float x, float lacunarity, float gain, int octaves) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        sum += amp * valueNoise1D(freq * x);
        freq *= lacunarity;
        amp *= gain;
    }
    
    return sum;
}

// Fractal Brownian Motion (fBm) 2D
float fbm2D(vec2 p, float lacunarity, float gain, int octaves) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        sum += amp * perlinNoise2D(freq * p);
        freq *= lacunarity;
        amp *= gain;
    }
    
    return sum;
}

// Fractal Brownian Motion (fBm) 3D
float fbm3D(vec3 p, float frequency, int octaves, float persistence, float lacunarity) {
    float total = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        total += perlinNoise3D(p * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    return total / maxValue;
}

// Ridged Multifractal Noise 3D
float ridgedNoise3D(vec3 p, float frequency, int octaves, float persistence, float lacunarity, float ridgeOffset) {
    float total = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = perlinNoise3D(p * frequency);
        n = ridgeOffset - abs(n * 2.0 - ridgeOffset);
        n = n * n;
        
        total += n * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    return total / maxValue;
}

// Warped Perlin Noise 3D
float warpedNoise3D(vec3 p, float frequency, float warpStrength) {
    vec3 q = vec3(
        perlinNoise3D(p * frequency),
        perlinNoise3D(p * frequency + vec3(5.2, 1.3, 2.8)),
        perlinNoise3D(p * frequency + vec3(3.7, 8.1, 4.5))
    );
    
    vec3 r = vec3(
        perlinNoise3D(p * frequency + warpStrength * q),
        perlinNoise3D(p * frequency + warpStrength * q + vec3(1.7, 9.2, 3.1)),
        perlinNoise3D(p * frequency + warpStrength * q + vec3(8.3, 2.4, 5.7))
    );
    
    return perlinNoise3D(p * frequency + warpStrength * r);
}

// Billow Noise 3D
float billowNoise3D(vec3 p, float lacunarity, float gain, int octaves) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = abs(2.0 * perlinNoise3D(freq * p) - 1.0);
        sum += amp * n;
        freq *= lacunarity;
        amp *= gain;
    }
    
    return sum;
}

// Worley Noise (Cellular) 2D
float worleyNoise2D(vec2 p, float jitter) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    
    float d = 1.0;
    
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 noise = hash22(ip + offset);
            vec2 cellPoint = offset + jitter * noise - fp;
            float dist = dot(cellPoint, cellPoint);
            d = min(d, dist);
        }
    }
    
    return sqrt(d);
}

// Worley Noise (Cellular) 3D
float worleyNoise3D(vec3 p, float frequency) {
    p *= frequency;
    
    vec3 baseCell = floor(p);
    
    float minDist = 1.0;
    
    // Check neighboring cells including the base cell
    for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
            for (int k = -1; k <= 1; k++) {
                vec3 cell = baseCell + vec3(i, j, k);
                vec3 cellPosition = cell + hash33(cell);
                float dist = length(p - cellPosition);
                minDist = min(minDist, dist);
            }
        }
    }
    
    return minDist;
}

// Turbulence Noise 3D
float turbulenceNoise3D(vec3 p, float frequency, int octaves, float persistence, float lacunarity) {
    float total = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for (int i = 0; i < octaves; i++) {
        float n = perlinNoise3D(p * frequency);
        n = 2.0 * abs(n - 0.5);
        
        total += n * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    
    return total / maxValue;
}

// Crater noise for planetary surfaces
float craterNoise(vec3 p, float size, float depth, float jitter, float sharpness) {
    p *= size;
    
    float dist = worleyNoise3D(p, size);
    float crater = 1.0 - smoothstep(0.0, sharpness, dist);
    
    // Creates crater floor and rim
    float rim = smoothstep(0.2, 0.4, dist) * (1.0 - smoothstep(0.4, 0.6, dist));
    
    return rim - depth * crater;
}

// Terrain noise with ridges
float ridgeTerrainNoise(vec3 p, float ridgeThreshold, float sharpness, int octaves) {
    float n = perlinNoise3D(p);
    n = abs(n);
    n = ridgeThreshold - n;
    n = n * n;
    
    // Add octaves of noise for detail
    float amp = 0.5;
    float freq = 2.0;
    
    for (int i = 1; i < octaves; i++) {
        float noise = perlinNoise3D(p * freq) * amp;
        n += noise * noise;
        amp *= 0.5;
        freq *= 2.0;
    }
    
    return pow(n, sharpness);
}

// Eroded terrain noise
float erodedTerrainNoise(vec3 p, float strength, int octaves) {
    // Base shape with fbm
    float base = fbm3D(p, 2.0, octaves, 0.5, 2.0);
    
    // Add erosion effect with turbulence
    float erode = turbulenceNoise3D(p * 2.0, 2.0, octaves/2, 0.5, 2.0) * strength;
    erode = pow(erode, 3.0) * strength;
    
    return base - erode;
}

// Stratified terrain with layers
float stratifiedTerrainNoise(vec3 p, float frequency, float layerThickness) {
    // Base shape 
    float base = fbm3D(p, 2.0, 4, 0.5, 2.0);
    
    // Add stratification
    float strata = sin(p.y * frequency * PI) * layerThickness;
    
    return base + strata;
}

// Combined noise for planet terrain
float planetTerrainNoise(vec3 p, float mountainAmount, float plainAmount, float oceanDepth) {
    // Basic shape with fbm
    float base = fbm3D(p, 2.0, 6, 0.5, 2.0);
    
    // Mountains using ridged noise
    float mountains = ridgedNoise3D(p * 1.5, 1.0, 4, 0.5, 2.0, 1.0) * mountainAmount;
    
    // Plains with smoother noise
    float plains = fbm3D(p * 0.5, 2.0, 3, 0.5, 2.0) * plainAmount;
    
    // Ocean with cellular noise for interesting shorelines
    float oceanMask = smoothstep(0.4, 0.5, base);
    float ocean = worleyNoise3D(p * 3.0, 1.0) * oceanDepth * (1.0 - oceanMask);
    
    // Combine elements 
    return base + mountains + plains - ocean;
}

// Domain warping for alien landscapes
vec3 domainWarp(vec3 p, float strength) {
    return p + strength * vec3(
        perlinNoise3D(p),
        perlinNoise3D(p + vec3(1.7, 9.2, 3.1)),
        perlinNoise3D(p + vec3(8.3, 2.8, 4.9))
    );
}

// Gradient noise helpers
vec3 gradientNoise3D_gradient(ivec3 cell) {
    // Use hash function to generate gradient
    float x = float(cell.x);
    float y = float(cell.y);
    float z = float(cell.z);
    float h = hash31(vec3(x, y, z));
    
    // Convert to direction (spherical coordinates)
    float angle1 = h * TWO_PI;
    float angle2 = h * PI;
    
    return vec3(
        sin(angle1) * cos(angle2),
        sin(angle1) * sin(angle2),
        cos(angle1)
    );
}

float gradientNoise3D_edge(vec3 p) {
    // Cell coordinates and local position
    ivec3 cell = ivec3(floor(p));
    vec3 local = fract(p);
    
    // Compute dot products for all 8 corners
    float dots[8];
    for (int i = 0; i < 8; i++) {
        ivec3 offset = ivec3(
            i & 1,
            (i >> 1) & 1,
            (i >> 2) & 1
        );
        
        vec3 gradient = gradientNoise3D_gradient(cell + offset);
        vec3 direction = local - vec3(offset);
        dots[i] = dot(gradient, direction);
    }
    
    // Compute trilinear interpolation with smoothing
    vec3 blend = quintic(local);
    
    float x0 = mix(dots[0], dots[1], blend.x);
    float x1 = mix(dots[2], dots[3], blend.x);
    float x2 = mix(dots[4], dots[5], blend.x);
    float x3 = mix(dots[6], dots[7], blend.x);
    
    float y0 = mix(x0, x1, blend.y);
    float y1 = mix(x2, x3, blend.y);
    
    return mix(y0, y1, blend.z);
}

#endif // NOISE_UTILS 