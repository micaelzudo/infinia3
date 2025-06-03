// {elementSymbol}.frag
precision mediump float;

// Color for element: {elementSymbol}
const vec3 elementColor = vec3({r}, {g}, {b});

void main() {
    // Optionally add basic lighting or other effects here
    gl_FragColor = vec4(elementColor, 1.0);
}