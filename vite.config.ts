
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8080,
    host: '0.0.0.0',
    strictPort: true
  },
  preview: {
    port: 8080,
    host: '0.0.0.0',
    strictPort: true
  }
});
