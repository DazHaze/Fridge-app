import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../config'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [isSignup, setIsSignup] = useState(false)
  const [buttonLoading, setButtonLoading] = useState(true)
  const [buttonError, setButtonError] = useState(false)
  
  // Signup form state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordRetype, setSignupPasswordRetype] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID is not set in environment variables')
      setButtonError(true)
      setButtonLoading(false)
      return
    }

    const handleCredentialResponse = async (response: { credential: string }) => {
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
        
        // Check if email exists in User model (email/password accounts)
        try {
          const checkResponse = await fetch(getApiUrl(`auth/check-email/${encodeURIComponent(userData.email)}`))
          const checkData = await checkResponse.json()
          
          if (checkData.exists && !checkData.hasGmailAccount) {
            // Email exists but is not a Gmail account - it's an email/password account
            alert('This email is already registered with an email/password account. Please sign in with your password instead.')
            return
          }
        } catch (checkError) {
          console.error('Error checking email:', checkError)
          // Continue with Google login if check fails
        }
        
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
    let checkInterval: ReturnType<typeof setInterval> | null = null
    
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setSignupError(null)
    setSignupSuccess(false)

    // Validation
    if (!signupName.trim()) {
      setSignupError('Name is required')
      return
    }

    if (!signupEmail.trim()) {
      setSignupError('Email is required')
      return
    }

    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters long')
      return
    }

    if (signupPassword !== signupPasswordRetype) {
      setSignupError('Passwords do not match')
      return
    }

    setSignupLoading(true)

    try {
      // Check if email exists and is linked to Gmail
      const checkResponse = await fetch(getApiUrl(`auth/check-email/${encodeURIComponent(signupEmail.trim())}`))
      const checkData = await checkResponse.json()

      if (checkData.exists && checkData.hasGmailAccount) {
        setSignupError('This email is already linked to a Gmail account. Please sign in with Google instead.')
        setSignupLoading(false)
        setIsSignup(false)
        return
      }

      if (checkData.exists) {
        setSignupError('This email is already registered. Please sign in instead.')
        setSignupLoading(false)
        setIsSignup(false)
        return
      }

      // Create account
      const response = await fetch(getApiUrl('auth/signup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: signupEmail.trim(),
          password: signupPassword,
          name: signupName.trim()
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSignupSuccess(true)
        setSignupName('')
        setSignupEmail('')
        setSignupPassword('')
        setSignupPasswordRetype('')
      } else {
        setSignupError(data.message || 'Failed to create account. Please try again.')
      }
    } catch (error) {
      console.error('Error signing up:', error)
      setSignupError('Failed to connect to server. Please check your connection.')
    } finally {
      setSignupLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError('Email and password are required')
      return
    }

    setLoginLoading(true)

    try {
      const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        login(data.user)
      } else {
        setLoginError(data.message || 'Invalid email or password')
      }
    } catch (error) {
      console.error('Error logging in:', error)
      setLoginError('Failed to connect to server. Please check your connection.')
    } finally {
      setLoginLoading(false)
    }
  }

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
          padding: '48px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
          width: '100%',
          maxWidth: '420px',
          boxSizing: 'border-box'
        }}
      >
        <h1
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '36px',
            fontWeight: '500',
            marginBottom: '12px',
            letterSpacing: '0.15px',
            textAlign: 'center'
          }}
        >
          Bia
        </h1>

        {/* Toggle between Login and Signup */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '32px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
          }}
        >
          <button
            onClick={() => {
              setIsSignup(false)
              setSignupError(null)
              setLoginError(null)
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: isSignup ? 'none' : '2px solid #6200ee',
              color: isSignup ? 'rgba(0, 0, 0, 0.6)' : '#6200ee',
              fontSize: '16px',
              fontWeight: isSignup ? '400' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsSignup(true)
              setSignupError(null)
              setLoginError(null)
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: !isSignup ? 'none' : '2px solid #6200ee',
              color: !isSignup ? 'rgba(0, 0, 0, 0.6)' : '#6200ee',
              fontSize: '16px',
              fontWeight: !isSignup ? '400' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign Up
          </button>
        </div>

        {isSignup ? (
          // Signup Form
          <>
            {signupSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ color: '#2e7d32', fontSize: '16px', marginBottom: '16px', fontWeight: '500' }}>
                  Account created successfully!
                </p>
                <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', marginBottom: '24px' }}>
                  Please check your email to verify your account before signing in.
                </p>
                <button
                  onClick={() => {
                    setIsSignup(false)
                    setSignupSuccess(false)
                  }}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#6200ee',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Go to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label
                    htmlFor="signup-name"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Name
                  </label>
                  <input
                    id="signup-name"
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid rgba(0, 0, 0, 0.23)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6200ee'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-email"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Email
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid rgba(0, 0, 0, 0.23)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6200ee'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Password
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '1px solid rgba(0, 0, 0, 0.23)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6200ee'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-password-retype"
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: 'rgba(0, 0, 0, 0.87)',
                      fontWeight: '500',
                      fontSize: '14px'
                    }}
                  >
                    Re-type Password
                  </label>
                  <input
                    id="signup-password-retype"
                    type="password"
                    value={signupPasswordRetype}
                    onChange={(e) => setSignupPasswordRetype(e.target.value)}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: signupPasswordRetype && signupPassword !== signupPasswordRetype
                        ? '1px solid #d32f2f'
                        : '1px solid rgba(0, 0, 0, 0.23)',
                      borderRadius: '4px',
                      fontSize: '16px',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6200ee'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = signupPasswordRetype && signupPassword !== signupPasswordRetype
                        ? '#d32f2f'
                        : 'rgba(0, 0, 0, 0.23)'
                    }}
                  />
                  {signupPasswordRetype && signupPassword !== signupPasswordRetype && (
                    <p style={{ color: '#d32f2f', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                {signupError && (
                  <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                    <p style={{ color: '#c62828', fontSize: '14px', margin: 0 }}>{signupError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={signupLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: signupLoading ? 'rgba(98, 0, 238, 0.38)' : '#6200ee',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: signupLoading ? 'not-allowed' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: signupLoading ? 'none' : '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {signupLoading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>
            )}
          </>
        ) : (
          // Login Form
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="login-email"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6200ee'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontWeight: '500',
                  fontSize: '14px'
                }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: '4px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#6200ee'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                }}
              />
            </div>

            {loginError && (
              <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
                <p style={{ color: '#c62828', fontSize: '14px', margin: 0 }}>{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              style={{
                padding: '12px 24px',
                backgroundColor: loginLoading ? 'rgba(98, 0, 238, 0.38)' : '#6200ee',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loginLoading ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: loginLoading ? 'none' : '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
                transition: 'all 0.2s ease'
              }}
            >
              {loginLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '16px' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.12)' }} />
          <span style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.12)' }} />
        </div>

        {/* Google Sign-In Button */}
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
          <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', marginTop: '16px', textAlign: 'center' }}>
            Loading sign-in options...
          </p>
        )}
        {buttonError && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
            <p style={{ color: '#c62828', fontSize: '14px', margin: 0, textAlign: 'center' }}>
              Unable to load Google Sign-In. Please check your connection and try refreshing the page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
