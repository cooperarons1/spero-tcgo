import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Web builds publish to Firebase Hosting and need root-absolute asset paths
// (`/assets/...`) so they resolve against the host. Electron builds load
// index.html via file:// and need RELATIVE paths (`./assets/...`) so the
// scripts resolve against the bundled location inside the asar — otherwise
// the renderer is a black screen because every chunk 404s.
//
// VITE_BASE_PATH=./ is set by the build:electron-* scripts in package.json.
// Default '/' covers web + Capacitor iOS (which serves from https://localhost).
const BASE_PATH = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3002',
        ws: true,
      },
    },
  },
  build: {
    // Split vendor libraries so the app bundle isn't a 1 MB monolith.
    // Vite v8 uses Rolldown — manualChunks takes a function-form per chunk.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/firebase')) return 'firebase';
          if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) return 'socketio';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
