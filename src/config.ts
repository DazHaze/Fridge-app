// API base URL configuration
// In production, set this to your deployed backend URL
// For GitHub Pages, you'll need to deploy the backend separately (e.g., on Railway, Render, or Heroku)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  // Always include /api prefix
  if (API_BASE_URL) {
    // Remove trailing slash from API_BASE_URL if present
    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
    return `${baseUrl}/api/${cleanEndpoint}`
  }
  return `/api/${cleanEndpoint}`
}


