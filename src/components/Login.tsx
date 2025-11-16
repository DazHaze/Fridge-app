import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../config'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Spinner } from '@/components/ui/spinner'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            itp_support?: boolean
          }) => void
          renderButton: (element: HTMLElement, config: {
            theme: string
            size: string
            width?: number
            text?: string
            shape?: string
          }) => void
          prompt: () => void
          disableAutoSelect: () => void
          storeCredential: (credentials: { id: string; password: string }, callback: () => void) => void
        }
      }
    }
  }
}

const Login = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('inviteToken')
  const shouldSignup = searchParams.get('signup') === 'true'
  const [isSignup, setIsSignup] = useState(shouldSignup || false)
  const [buttonLoading, setButtonLoading] = useState(true)
  const [buttonError, setButtonError] = useState(false)
  // Use a ref to always have the current isSignup value in the callback
  const isSignupRef = useRef(isSignup)
  
  // Signup form state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordRetype, setSignupPasswordRetype] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)
  const [signupSuccess, setSignupSuccess] = useState(false)

  // Update ref when isSignup changes
  useEffect(() => {
    isSignupRef.current = isSignup
  }, [isSignup])

  // Fetch invite email if inviteToken is present
  useEffect(() => {
    if (inviteToken && shouldSignup) {
      // Fetch invite details to pre-fill email
      fetch(getApiUrl(`invites/info/${inviteToken}`))
        .then(res => res.json())
        .then(data => {
          if (data.email) {
            setSignupEmail(data.email)
          }
        })
        .catch(err => {
          console.error('Error fetching invite info:', err)
        })
    }
  }, [inviteToken, shouldSignup])
  
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

    // Disable auto-select immediately if Google script is already loaded
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect()
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
        
        // Check if user has an account
        try {
          const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${userData.sub}`))
          const accountCheckData = await accountCheckResponse.json().catch(() => ({}))
          
          if (!accountCheckData.hasAccount) {
            // User does not have an account
            // Use ref to get current value of isSignup
            if (isSignupRef.current) {
              // On signup page - create account for Google user
              try {
                const signupResponse = await fetch(getApiUrl('auth/google-signup'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    userId: userData.sub,
                    email: userData.email,
                    name: userData.name,
                    picture: userData.picture
                  })
                })

                const signupData = await signupResponse.json()

                if (signupResponse.ok) {
                  // Account created successfully - now log them in
                  login({
                    name: userData.name,
                    email: userData.email,
                    picture: userData.picture,
                    sub: userData.sub
                  })
                  // Redirect to invite acceptance if token exists, otherwise go home
                  if (inviteToken) {
                    navigate(`/invite/accept?token=${inviteToken}`, { replace: true })
                  }
                } else {
                  // Account creation failed
                  alert(signupData.message || 'Failed to create account. Please try again.')
                  return
                }
              } catch (signupError) {
                console.error('Error creating Google account:', signupError)
                alert('Failed to create account. Please try again.')
                return
              }
            } else {
              // On login page - require existing account
              alert('You must have an account to sign in with Google. Please sign up first using the Sign Up form.')
              return
            }
          } else {
            // User has an account - proceed with login
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
            // Redirect to invite acceptance if token exists, otherwise stay on page (App.tsx will redirect)
            if (inviteToken) {
              navigate(`/invite/accept?token=${inviteToken}`, { replace: true })
            }
          }
        } catch (checkError) {
          console.error('Error checking account:', checkError)
          alert('Unable to verify account. Please try again.')
          return
        }
      } catch (error) {
        console.error('Error decoding credential:', error)
        alert('Error processing Google sign-in. Please try again.')
      }
    }

    // Function to initialize Google Sign-In
    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id && buttonRef.current) {
        try {
          // Clear any existing button before re-rendering
          buttonRef.current.innerHTML = ''
          
          // Disable auto-select to prevent showing pre-filled account
          window.google.accounts.id.disableAutoSelect()
          
          // Initialize with auto_select disabled to prevent One Tap and auto-fill
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
            itp_support: true
          })

          // Render button without any pre-filled account information
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with', // Standard sign-in text, not personalized
            shape: 'rectangular'
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
      // Clear the button when component unmounts or dependencies change
      if (buttonRef.current) {
        buttonRef.current.innerHTML = ''
      }
    }
  }, [login, isSignup])

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
        
        // If there's an invite token, handle the account creation invite
        if (inviteToken) {
          try {
            // After account creation, accept the account invite which will create the fridge invite
            const inviteResponse = await fetch(getApiUrl('invites/accept-account-invite'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                token: inviteToken,
                userId: data.userId,
                email: signupEmail.trim(),
                name: signupName.trim()
              })
            })
            
            const inviteData = await inviteResponse.json().catch(() => ({}))
            if (inviteResponse.ok && inviteData.fridgeId) {
              // Account created and fridge invite accepted - user can now login
              setTimeout(() => {
                setIsSignup(false)
                setSignupSuccess(false)
              }, 2000)
            }
          } catch (inviteError) {
            console.error('Error accepting account invite:', inviteError)
            // Account was created successfully, but invite handling failed
            // User can still login and accept invite manually
          }
        }
        
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
        // Redirect to invite acceptance if token exists, otherwise stay on page (App.tsx will redirect)
        if (inviteToken) {
          navigate(`/invite/accept?token=${inviteToken}`, { replace: true })
        }
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
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {signupLoading ? (
                    <>
                      <Spinner size="sm" />
                      Creating Account...
                    </>
                  ) : 'Sign Up'}
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
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loginLoading ? (
                <>
                  <Spinner size="sm" />
                  Signing In...
                </>
              ) : 'Sign In'}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
            <Spinner size="sm" />
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', margin: 0 }}>Loading sign-in options...</p>
          </div>
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
