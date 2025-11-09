import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (element: HTMLElement, config: {
            theme: string
            size: string
            width?: number
          }) => void
          prompt: () => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

const Login = () => {
  const { login } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [buttonLoading, setButtonLoading] = useState(true)
  const [buttonError, setButtonError] = useState(false)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables')
      setButtonError(true)
      setButtonLoading(false)
      return
    }

    const handleCredentialResponse = (response: { credential: string }) => {
      // Decode the JWT token to get user info
      try {
        const base64Url = response.credential.split('.')[1]
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )

        const userData = JSON.parse(jsonPayload)
        login({
          name: userData.name,
          email: userData.email,
          picture: userData.picture,
          sub: userData.sub
        })
      } catch (error) {
        console.error('Error decoding credential:', error)
      }
    }

    // Function to initialize Google Sign-In
    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse
          })

          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large'
          })
          
          setButtonLoading(false)
          setButtonError(false)
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error)
          setButtonError(true)
          setButtonLoading(false)
        }
      } else if (!window.google) {
        // Google script not loaded yet, wait and retry
        setTimeout(initializeGoogleSignIn, 100)
      } else if (!buttonRef.current) {
        // Button ref not ready yet
        setTimeout(initializeGoogleSignIn, 100)
      }
    }

    // Wait for Google script to load
    let checkInterval: NodeJS.Timeout | null = null
    
    if (window.google) {
      initializeGoogleSignIn()
    } else {
      // Poll for Google script to load (max 5 seconds)
      let attempts = 0
      const maxAttempts = 50
      checkInterval = setInterval(() => {
        attempts++
        if (window.google) {
          if (checkInterval) clearInterval(checkInterval)
          initializeGoogleSignIn()
        } else if (attempts >= maxAttempts) {
          if (checkInterval) clearInterval(checkInterval)
          console.error('Google Identity Services script failed to load')
          setButtonError(true)
          setButtonLoading(false)
        }
      }, 100)
    }

    // Cleanup function
    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
  }, [login])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '8px',
        paddingTop: '40px'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '64px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
          width: '100%',
          maxWidth: 'none',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}
      >
        <h1
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '36px',
            fontWeight: '500',
            marginBottom: '12px',
            letterSpacing: '0.15px'
          }}
        >
          Bia
        </h1>
        <p
          style={{
            color: 'rgba(0, 0, 0, 0.6)',
            fontSize: '16px',
            marginBottom: '48px',
            marginTop: '12px'
          }}
        >
          Sign in with your Google account to continue
        </p>
        <div 
          ref={buttonRef} 
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            width: '100%',
            minHeight: '40px',
            alignItems: 'center'
          }} 
        />
        {buttonLoading && (
          <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', marginTop: '16px' }}>
            Loading sign-in options...
          </p>
        )}
        {buttonError && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            <p style={{ color: '#c62828', fontSize: '14px', margin: 0 }}>
              Unable to load Google Sign-In. Please check your connection and try refreshing the page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login

