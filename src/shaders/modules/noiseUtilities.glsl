// Noise Utilities Module
// Collection of optimized noise functions for procedural generation

// Classic Perlin noise implementation
float perlinNoise(vec3 p) {
    vec3 pi = floor(p);
    vec3 pf = p - pi;
    
    vec3 pf_min1 = pf - 1.0;
    
    pi.x = mod(pi.x, 256.0);
    pi.y = mod(pi.y, 256.0);
    pi.z = mod(pi.z, 256.0);
    
    // Calculate gradients
    vec3 g000 = random3(pi + vec3(0.0, 0.0, 0.0)) * 2.0 - 1.0;
    vec3 g100 = random3(pi + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0;
    vec3 g010 = random3(pi + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0;
    vec3 g110 = random3(pi + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0;
    vec3 g001 = random3(pi + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0;
    vec3 g101 = random3(pi + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0;
    vec3 g011 = random3(pi + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0;
    vec3 g111 = random3(pi + vec3(1.0, 1.0, 1.0)) * 2.0 - 1.0;
    
    // Calculate dot products
    float v000 = dot(g000, pf);
    float v100 = dot(g100, pf - vec3(1.0, 0.0, 0.0));
    float v010 = dot(g010, pf - vec3(0.0, 1.0, 0.0));
    float v110 = dot(g110, pf - vec3(1.0, 1.0, 0.0));
    float v001 = dot(g001, pf - vec3(0.0, 0.0, 1.0));
    float v101 = dot(g101, pf - vec3(1.0, 0.0, 1.0));
    float v011 = dot(g011, pf - vec3(0.0, 1.0, 1.0));
    float v111 = dot(g111, pf - vec3(1.0, 1.0, 1.0));
    
    // Smoothing function
    vec3 u = smoothstep(0.0, 1.0, pf);
    
    // Mix along x
    float x00 = mix(v000, v100, u.x);
    float x10 = mix(v010, v110, u.x);
    float x01 = mix(v001, v101, u.x);
    float x11 = mix(v011, v111, u.x);
    
    // Mix along y
    float y0 = mix(x00, x10, u.y);
    float y1 = mix(x01, x11, u.y);
    
    // Mix along z and scale to [-1, 1]
    return mix(y0, y1, u.z);
}

// Optimized Simplex Noise - faster than Perlin for many applications
// Based on the work by Ashima Arts and Stefan Gustavson
//
// Description : Array and textureless GLSL 2D/3D/4D simplex 
//               noise functions.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
// 

vec4 permute(vec4 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) { 
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    // First corner
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    
    // Permutations
    i = mod(i, 289.0); 
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0)) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
           
    // Gradients
    // ( N*N points uniformly over a square, mapped onto an octahedron.)
    float n_ = 1.0/7.0; // N=7
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);    // mod(j,N)
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// Voronoi Noise (cellular noise)
float voronoiNoise(vec3 x, float scale, float jitter) {
    x *= scale;
    
    vec3 p = floor(x);
    vec3 f = fract(x);
    
    float minDist = 1.0;
    
    for(int k=-1; k<=1; k++) {
        for(int j=-1; j<=1; j++) {
            for(int i=-1; i<=1; i++) {
                vec3 offset = vec3(float(i), float(j), float(k));
                vec3 r = offset - f + jitter * (random3(p + offset) - 0.5);
                float d = dot(r, r);
                
                minDist = min(minDist, d);
            }
        }
    }
    
    return sqrt(minDist);
}

// 3D Value Noise (faster than Perlin but less natural looking)
float valueNoise(vec3 p) {
    vec3 pi = floor(p);
    vec3 pf = fract(p);
    
    // Smooth interpolation
    vec3 u = pf * pf * (3.0 - 2.0 * pf);
    
    // 8 corners of the cube
    float a = random1(pi + vec3(0.0, 0.0, 0.0));
    float b = random1(pi + vec3(1.0, 0.0, 0.0));
    float c = random1(pi + vec3(0.0, 1.0, 0.0));
    float d = random1(pi + vec3(1.0, 1.0, 0.0));
    float e = random1(pi + vec3(0.0, 0.0, 1.0));
    float f = random1(pi + vec3(1.0, 0.0, 1.0));
    float g = random1(pi + vec3(0.0, 1.0, 1.0));
    float h = random1(pi + vec3(1.0, 1.0, 1.0));
    
    // Interpolate
    float k0 = a;
    float k1 = b - a;
    float k2 = c - a;
    float k3 = e - a;
    float k4 = a - b - c + d;
    float k5 = a - c - e + g;
    float k6 = a - b - e + f;
    float k7 = -a + b + c - d + e - f - g + h;
    
    return k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
}

// Optimized random functions 
vec3 random3(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float random1(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
}

// Specialized Noise Functions for Terrain Features
float turbulentNoise(vec3 p, float freq, int octaves) {
    float sum = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for(int i = 0; i < octaves; i++) {
        // Take absolute value to create sharp ridges
        sum += amplitude * abs(snoise(p * freq));
        maxValue += amplitude;
        amplitude *= 0.5;
        freq *= 2.0;
    }
    
    return sum / maxValue;
}

float craterNoise(vec3 p, float freq, float threshold) {
    // Start with base simplex noise
    float n = snoise(p * freq);
    
    // Transform to create crater-like features
    n = smoothstep(threshold, threshold + 0.1, n) - smoothstep(threshold + 0.2, threshold + 0.3, n);
    
    return n;
}

// Specialized erosion simulation
float erosionNoise(vec3 p, float freq, float time) {
    // Base noise
    float n1 = snoise(p * freq);
    
    // Flow direction based on the gradient of the noise
    vec3 flowDir = vec3(
        snoise(p * freq + vec3(0.01, 0.0, 0.0)) - n1,
        snoise(p * freq + vec3(0.0, 0.01, 0.0)) - n1,
        snoise(p * freq + vec3(0.0, 0.0, 0.01)) - n1
    );
    
    // Time-based evolution
    float flowIntensity = 0.05 * time;
    
    // Sediment deposition noise
    float sediment = snoise(p * freq * 2.0 + flowDir * flowIntensity);
    
    // Combine for erosion effect
    return n1 - flowIntensity * sediment;
}

// Cloud-like noise with billowing effect
float cloudNoise(vec3 p, float freq, int octaves) {
    float sum = 0.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    
    for(int i = 0; i < octaves; i++) {
        // Use absolute value and invert to get billowy effect
        sum += amplitude * (1.0 - abs(snoise(p * freq)));
        maxValue += amplitude;
        amplitude *= 0.5;
        freq *= 2.0;
    }
    
    // Sharpen the clouds
    float result = sum / maxValue;
    result = smoothstep(0.2, 0.6, result);
    
    return result;
} 