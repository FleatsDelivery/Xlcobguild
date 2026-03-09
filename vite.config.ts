import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Isolate recharts and its D3 dependencies to prevent ESM/CJS circular
          // dependency initialization races that cause TDZ errors in production
          'recharts': ['recharts'],
          'd3-vendor': ['d3-scale', 'd3-shape', 'd3-color'],
        },
      },
    },
  },
})