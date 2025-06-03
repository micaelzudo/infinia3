import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  base: './',
  server: {
    open: 'chrome',
  },
  publicDir: ['public', 'debug/public', 'debug/skybox'],
  define: {
    // Define __DEFINES__ to prevent worker errors
    '__DEFINES__': JSON.stringify({})
  },
  resolve: {
    alias: {
      '@Sketchbook-master': resolve(__dirname, './debug/Sketchbook-master/src/ts'),
      '@Sketchbook-assets': resolve(__dirname, './debug/Sketchbook-master/build/assets')
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        noiseEditor: resolve(__dirname, "noise-editor.html"),
        firstPerson: resolve(__dirname, "first-person.html"),
      },
    },
  },
});
