import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: "5bd8b27a9ba59fc395c819e14185d356.serveo.net"
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
