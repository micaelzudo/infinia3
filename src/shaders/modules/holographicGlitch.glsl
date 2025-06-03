// Holographic Glitch Module
// Creates digital artifacts and distortion effects

// Random glitch value generator
float glitchRandom(vec2 co, float time) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233) + time)) * 43758.5453);
}

// Creates horizontal glitch line
float horizontalGlitchLine(vec2 uv, float time, float intensity) {
    // Calculate random glitch line positions
    float lineCount = 10.0;
    float result = 0.0;
    
    for (float i = 0.0; i < lineCount; i++) {
        // Random seed for this line
        float seed = i / lineCount;
        
        // Random line position with time variance
        float linePos = fract(seed + time * (0.1 + seed * 0.2));
        
        // Line thickness and sharpness
        float lineWidth = 0.02 * intensity * (0.5 + seed * 0.5);
        
        // Calculate line intensity at current position
        float line = smoothstep(lineWidth, 0.0, abs(uv.y - linePos));
        
        // Add to result
        result = max(result, line);
    }
    
    return result;
}

// Creates digital block artifacts
float blockArtifacts(vec2 uv, float time, float blockSize, float intensity) {
    // Divide screen into blocks
    vec2 blockUV = floor(uv * blockSize) / blockSize;
    
    // Random value for each block
    float blockNoise = glitchRandom(blockUV, floor(time * 3.0));
    
    // Only apply effect to some blocks
    if (blockNoise > 0.8) {
        // Intensity of block artifact
        return blockNoise * intensity;
    }
    
    return 0.0;
}

// Creates RGB channel split effect
vec2 rgbSplit(vec2 uv, float time, float amount) {
    // Create time-varying channel split direction
    float angle = time * 0.5;
    vec2 direction = vec2(cos(angle), sin(angle));
    
    // Apply oscillating split amount
    float splitAmount = amount * sin(time * 3.0) * 0.5 + amount * 0.5;
    
    return uv + direction * splitAmount;
}

// Generates scan lines effect
float scanLines(vec2 uv, float time, float intensity, float count) {
    // Basic scan line pattern
    float lines = sin(uv.y * count);
    
    // Apply time-based movement
    float movingLines = sin(uv.y * count * 0.5 + time * 5.0);
    
    // Combine static and moving lines
    float scanLinePattern = lines * 0.5 + movingLines * 0.5;
    
    // Apply intensity
    return scanLinePattern * intensity;
}

// Creates holographic data stream effect
vec3 dataStreamEffect(vec2 uv, float time, vec3 color) {
    // Data stream scrolling speed
    float scrollSpeed = 2.0;
    
    // Create scrolling effect on Y axis
    float scrollOffset = fract(time * scrollSpeed);
    float rowOffset = floor(time * scrollSpeed * 3.0);
    
    // Binary-like data pattern
    float pattern = 0.0;
    float columnCount = 30.0;
    float rowCount = 30.0;
    
    // Column and row indices
    float col = floor(uv.x * columnCount);
    float row = floor(uv.y * rowCount) + rowOffset;
    
    // Generate random data bits
    float dataBit = glitchRandom(vec2(col, row), 0.0);
    
    // Apply data bit intensity
    pattern = smoothstep(0.4, 0.6, dataBit);
    
    // Data stream opacity falloff
    float opacity = (1.0 - uv.y) * 0.5 + 0.1;
    
    // Data color with subtle variation
    vec3 dataColor = color * (0.8 + dataBit * 0.4);
    
    return dataColor * pattern * opacity;
}

// Main glitch effect function
vec3 applyHolographicGlitch(vec3 originalColor, vec2 uv, float time, float intensity) {
    // Apply RGB channel splitting
    vec2 rUV = rgbSplit(uv, time, 0.01 * intensity);
    vec2 gUV = uv;
    vec2 bUV = rgbSplit(uv, time + 0.5, 0.01 * intensity);
    
    // Split color channels
    vec3 splitColor;
    splitColor.r = originalColor.r * 0.8 + 0.2 * glitchRandom(rUV, time);
    splitColor.g = originalColor.g * 0.8 + 0.2 * glitchRandom(gUV, time + 0.5);
    splitColor.b = originalColor.b * 0.8 + 0.2 * glitchRandom(bUV, time + 1.0);
    
    // Apply horizontal glitch lines
    float hGlitch = horizontalGlitchLine(uv, time, intensity);
    
    // Apply block artifacts
    float blocks = blockArtifacts(uv, time, 20.0, intensity);
    
    // Apply scan lines
    float scan = scanLines(uv, time, 0.1 * intensity, 100.0);
    
    // Apply all effects
    vec3 glitchedColor = splitColor;
    glitchedColor = mix(glitchedColor, vec3(1.0), hGlitch * 0.8);
    glitchedColor = mix(glitchedColor, vec3(0.5, 0.7, 1.0), blocks * 0.5);
    glitchedColor = glitchedColor * (0.95 + scan * 0.3);
    
    // Time-based glitch intensity - make it pulse
    float timeFactor = sin(time * 5.0) * 0.5 + 0.5;
    
    // Mix between original and glitched color based on time and intensity
    return mix(originalColor, glitchedColor, intensity * timeFactor);
} 