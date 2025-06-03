#ifndef MATH_UTILS
#define MATH_UTILS

// Constants
#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define HALF_PI 1.57079632679
#define INV_PI 0.31830988618
#define EPSILON 0.0001

// Ray struct for raymarching
struct Ray {
    vec3 origin;
    vec3 direction;
};

// Converts degrees to radians
float radians(float degrees) {
    return degrees * PI / 180.0;
}

// Converts radians to degrees
float degrees(float radians) {
    return radians * 180.0 / PI;
}

// Clamp value between min and max
// Clamps value between min and max
float clamp01(float x) {
    return clamp(x, 0.0, 1.0);
}

vec2 clamp01(vec2 v) {
    return clamp(v, 0.0, 1.0);
}

vec3 clamp01(vec3 v) {
    return clamp(v, 0.0, 1.0);
}

// Linear interpolation
float lerp(float a, float b, float t) {
    return a + t * (b - a);
}

vec2 lerp(vec2 a, vec2 b, float t) {
    return a + t * (b - a);
}

vec3 lerp(vec3 a, vec3 b, float t) {
    return a + t * (b - a);
}

// Smooth step interpolation
float smoothstep01(float t) {
    return t * t * (3.0 - 2.0 * t);
}

// Smoother step (Ken Perlin's)
float smootherstep(float t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Map a value from one range to another
float map(float value, float fromMin, float fromMax, float toMin, float toMax) {
    float t = (value - fromMin) / (fromMax - fromMin);
    return lerp(toMin, toMax, t);
}

// Return the smallest component of a vector
float minComponent(vec2 v) {
    return min(v.x, v.y);
}

float minComponent(vec3 v) {
    return min(min(v.x, v.y), v.z);
}

// Return the largest component of a vector
float maxComponent(vec2 v) {
    return max(v.x, v.y);
}

float maxComponent(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

// Custom rotation functions
mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotateZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

// Create rotation matrix from Euler angles (in radians)
mat3 eulerRotation(vec3 angles) {
    return rotateZ(angles.z) * rotateY(angles.y) * rotateX(angles.x);
}

// Apply a twist effect along an axis
vec3 twist(vec3 p, float strength, float axis) {
    float c = cos(strength * p[axis]);
    float s = sin(strength * p[axis]);
    
    if (axis == 0.0) { // X-axis
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * p.yz;
        return vec3(p.x, q);
    } else if (axis == 1.0) { // Y-axis
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * p.xz;
        return vec3(q.x, p.y, q.y);
    } else { // Z-axis
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * p.xy;
        return vec3(q, p.z);
    }
}

// Apply a bend effect along an axis
vec3 bend(vec3 p, float strength, float axis) {
    if (axis == 0.0) { // X-axis
        float c = cos(strength * p.x);
        float s = sin(strength * p.x);
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * vec2(p.y, p.z);
        return vec3(p.x, q.x, q.y);
    } else if (axis == 1.0) { // Y-axis
        float c = cos(strength * p.y);
        float s = sin(strength * p.y);
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * vec2(p.x, p.z);
        return vec3(q.x, p.y, q.y);
    } else { // Z-axis
        float c = cos(strength * p.z);
        float s = sin(strength * p.z);
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * vec2(p.x, p.y);
        return vec3(q.x, q.y, p.z);
    }
}

// Polynomial smooth min
float smin(float a, float b, float k) {
    float h = clamp01(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1.0 - h);
}

// Exponential smooth min
float sminExp(float a, float b, float k) {
    float res = exp(-k * a) + exp(-k * b);
    return -log(res) / k;
}

// Power smooth min
float sminPow(float a, float b, float k) {
    a = pow(a, k);
    b = pow(b, k);
    return pow((a * b) / (a + b), 1.0 / k);
}

// Creates vortex-like distortion
vec3 vortex(vec3 p, vec3 center, float strength, float radius) {
    vec3 d = p - center;
    float r = length(d.xy);
    
    if (r < radius) {
        float angle = strength * (1.0 - r / radius);
        float c = cos(angle);
        float s = sin(angle);
        mat2 m = mat2(c, -s, s, c);
        vec2 q = m * d.xy;
        return vec3(q.x + center.x, q.y + center.y, p.z);
    }
    return p;
}

// Function to simulate gravitational pull
vec3 gravitationalPull(vec3 p, vec3 center, float mass) {
    vec3 direction = center - p;
    float distance = length(direction);
    float force = mass / (distance * distance + 0.001);
    return normalize(direction) * force;
}

#endif // MATH_UTILS 