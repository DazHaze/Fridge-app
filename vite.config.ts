import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// For GitHub Pages, set the base to your repository name
// Note: GitHub Pages URLs match repository name exactly: /Fridge-app/
// If your URL uses lowercase, set VITE_BASE_PATH secret to '/fridge-app/'
// If deploying to root domain, set VITE_BASE_PATH secret to '/'
const base = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/Fridge-app/' : '/')

export default defineConfig({
  plugins: [react()],
  base: base,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

