import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    assetsDir: 'assets',
    optimizeDeps: {
      include: ['three', 'simplex-noise']
    },
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          game: ['./src/game/core/Engine.js']
        }
      }
    }
  }
});
