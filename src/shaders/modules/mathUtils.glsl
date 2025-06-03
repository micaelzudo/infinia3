// Math Utilities Module
// Collection of math helper functions for procedural generation

// Linear interpolation
float lerp(float a, float b, float t) {
    return a + t * (b - a);
}

// Smooth step interpolation
float smoothstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

// Smoother step interpolation (cubic)
float smootherstep(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Bias function - adjusts the midpoint of a value range
float bias(float value, float bias) {
    return pow(value, log(bias) / log(0.5));
}

// Gain function - adjusts the transition rate around the midpoint
float gain(float value, float gain) {
    if (value < 0.5) {
        return bias(value * 2.0, 1.0 - gain) / 2.0;
    } else {
        return bias(value * 2.0 - 1.0, gain) / 2.0 + 0.5;
    }
}

// Remaps a value from one range to another
float remap(float value, float inMin, float inMax, float outMin, float outMax) {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// Returns the smallest of two values
float min(float a, float b) {
    return a < b ? a : b;
}

// Returns the largest of two values
float max(float a, float b) {
    return a > b ? a : b;
}

// Clamps a value between min and max
float clamp(float value, float minValue, float maxValue) {
    return min(max(value, minValue), maxValue);
}

// Exponential ease-in
float easeIn(float t, float exponent) {
    return pow(t, exponent);
}

// Exponential ease-out
float easeOut(float t, float exponent) {
    return 1.0 - pow(1.0 - t, exponent);
}

// Exponential ease-in-out
float easeInOut(float t, float exponent) {
    if (t < 0.5) {
        return 0.5 * pow(2.0 * t, exponent);
    } else {
        return 1.0 - 0.5 * pow(2.0 * (1.0 - t), exponent);
    }
}

// Blend a terrain noise with a mask using various blending modes
float blendTerrainWithMask(float terrain, float mask, int blendMode) {
    // Blend modes:
    // 0: Multiply
    // 1: Add
    // 2: Overlay
    // 3: Screen
    // 4: Soft Light
    
    if (blendMode == 0) {
        // Multiply
        return terrain * mask;
    } else if (blendMode == 1) {
        // Add
        return min(terrain + mask, 1.0);
    } else if (blendMode == 2) {
        // Overlay
        if (terrain < 0.5) {
            return 2.0 * terrain * mask;
        } else {
            return 1.0 - 2.0 * (1.0 - terrain) * (1.0 - mask);
        }
    } else if (blendMode == 3) {
        // Screen
        return 1.0 - (1.0 - terrain) * (1.0 - mask);
    } else if (blendMode == 4) {
        // Soft Light
        if (mask < 0.5) {
            return terrain - (1.0 - 2.0 * mask) * terrain * (1.0 - terrain);
        } else {
            float d = terrain <= 0.25 ? ((16.0 * terrain - 12.0) * terrain + 4.0) * terrain : sqrt(terrain);
            return terrain + (2.0 * mask - 1.0) * (d - terrain);
        }
    }
    
    // Default to multiply
    return terrain * mask;
}

// Gradient based on height - useful for biome transitions
vec3 heightGradient(float height, vec3 lowColor, vec3 midColor, vec3 highColor) {
    if (height < 0.5) {
        return mix(lowColor, midColor, height * 2.0);
    } else {
        return mix(midColor, highColor, (height - 0.5) * 2.0);
    }
}

// Function to apply erosion effects to terrain
float applyErosion(float height, float slope, float erosionStrength) {
    // Simple erosion model: reduce height more on steeper slopes
    return height - (slope * erosionStrength);
}

// Distance function for SDFs (Signed Distance Fields)
float sphereSDF(vec3 p, float radius) {
    return length(p) - radius;
}

// Custom transform for various terrain effects
vec3 terrainTransform(vec3 p, float twistAmount, float foldIterations) {
    // Apply twist along Y axis
    float angle = p.y * twistAmount;
    float sinAngle = sin(angle);
    float cosAngle = cos(angle);
    
    vec3 transformed = p;
    transformed.x = p.x * cosAngle - p.z * sinAngle;
    transformed.z = p.x * sinAngle + p.z * cosAngle;
    
    // Apply iterative folding for crystalline effects
    for (int i = 0; i < 3; i++) {
        if (i >= int(foldIterations)) break;
        
        // Fold space
        transformed = abs(transformed) - 0.5;
    }
    
    return transformed;
} 