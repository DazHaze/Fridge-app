import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages, set the base to your repository name
// Note: GitHub Pages URLs are lowercase, so use '/fridge-app/' (lowercase)
// If deploying to root domain, use '/'
const base = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/fridge-app/' : '/')

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

