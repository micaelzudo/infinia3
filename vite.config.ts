import { defineConfig } from 'vite';
import type { BuildOptions } from 'esbuild';
import bigIntPlugin from './esbuild-plugin.js';

const esbuildConfig: any = {
  target: 'es2020', // Slightly older target for better mobile compatibility
  supported: {
    'bigint': true
  },
  format: 'esm',
  platform: 'browser',
  plugins: [bigIntPlugin],
  // Add these to satisfy TypeScript
  define: {},
  minify: undefined,
  minifyWhitespace: undefined,
  minifyIdentifiers: undefined,
  minifySyntax: undefined,
  legalComments: undefined,
  sourcemap: undefined,
  jsx: undefined,
  jsxFactory: undefined,
  jsxFragment: undefined,
  jsxImportSource: undefined,
  jsxDev: undefined,
  jsxSideEffects: undefined,
  jsxOptimizeHref: undefined
};

export default defineConfig({
  base: './', // Important for mobile - use relative paths
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          yuka: ['yuka'],
          vendor: ['simplex-noise', 'lodash']
        },
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    chunkSizeWarningLimit: 1000 // Increase chunk size warning limit
  },
  optimizeDeps: {
    esbuildOptions: esbuildConfig,
    include: ['three', 'yuka', 'simplex-noise']
  },
  esbuild: esbuildConfig,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'process.env.IS_MOBILE': 'true' // Global mobile flag
  },
  server: {
    host: true // Allow mobile device access during development
  },
  // Copy all files from public to dist
  publicDir: 'public',
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.fbx', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg', '**/*.mp3', '**/*.wav', '**/*.ogg', '**/*.mp4', '**/*.webm', '**/*.json']
});