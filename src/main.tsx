import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'

// Get base path from import.meta.env or default to '/'
const basePath = import.meta.env.BASE_URL || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basePath}>
      <AuthProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)


