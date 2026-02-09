
import { defineConfig } from 'vite';

export default defineConfig({
  // Set base to './' so it works on any subfolder (like GitHub Pages)
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize for PICO-8 pixel art
    minify: 'terser',
  },
  server: {
    port: 3000,
    open: true,
  }
});
