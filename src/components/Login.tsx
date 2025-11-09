import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables')
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

    if (window.google && buttonRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse
      })

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large'
      })
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
        <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center', width: '100%' }} />
      </div>
    </div>
  )
}

export default Login

