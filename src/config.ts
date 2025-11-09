// API base URL configuration
// In production, set this to your deployed backend URL
// For GitHub Pages, you'll need to deploy the backend separately (e.g., on Railway, Render, or Heroku)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  return API_BASE_URL ? `${API_BASE_URL}/${cleanEndpoint}` : `/api/${cleanEndpoint}`
}


