import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    proxy: {
      '/captures': { target: 'http://localhost:4000', changeOrigin: true },
      '/stubs':    { target: 'http://localhost:4000', changeOrigin: true },
      '/events':   { target: 'http://localhost:4000', changeOrigin: true },
      '/health':   { target: 'http://localhost:4000', changeOrigin: true },
      '/reset':    { target: 'http://localhost:4000', changeOrigin: true },
      '/save':     { target: 'http://localhost:4000', changeOrigin: true },
      '/load':     { target: 'http://localhost:4000', changeOrigin: true },
      '/resolve':  { target: 'http://localhost:4000', changeOrigin: true },
      '/settings': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
