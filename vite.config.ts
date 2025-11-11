import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages, set the base to your repository name
// Note: GitHub Pages URLs match repository name exactly: /Fridge-app/
// If your URL uses lowercase, set VITE_BASE_PATH secret to '/fridge-app/'
// If deploying to root domain, set VITE_BASE_PATH secret to '/'
const base = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/Fridge-app/' : '/')

export default defineConfig({
  plugins: [react()],
  base: base,
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})

