import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// For GitHub Pages, set the base to your repository name
// Note: GitHub Pages URLs are typically lowercase: /fridge-app/
// If your URL uses capitals, set VITE_BASE_PATH secret to override
// If deploying to root domain, use '/'
const base = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/' : '/')

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

