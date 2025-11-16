import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../config'

interface AcceptInviteProps {
  isAuthenticated: boolean
  ensureFridge: () => Promise<string | null>
  onAccept?: (fridgeId: string) => void
}

const AcceptInvite = ({ isAuthenticated, ensureFridge, onAccept }: AcceptInviteProps) => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const acceptInvite = useCallback(async () => {
    if (!token || !user?.sub) {
      return
    }

    setStatus('loading')
    setMessage('Accepting your invitation...')

    try {
      // First check if user has an account
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${user.sub}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))

      if (!accountCheckData.hasAccount) {
        setStatus('error')
        setMessage('You must have an account to accept invites. Please sign up first.')
        setTimeout(() => {
          navigate('/login?signup=true', { replace: true })
        }, 2000)
        return
      }

      const response = await fetch(getApiUrl('invites/accept'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          userId: user.sub,
          email: user.email,
          name: user.name
        })
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setStatus('success')
        const acceptedFridgeId = data?.fridgeId
        setMessage('Invite accepted successfully! Redirecting to your shared fridge...')
        await ensureFridge()
        if (acceptedFridgeId && onAccept) {
          onAccept(acceptedFridgeId)
        }
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 1500)
      } else {
        setStatus('error')
        setMessage(data?.message || 'Unable to accept invite. Please try again or contact the inviter.')
      }
    } catch (error) {
      console.error('Error accepting invite:', error)
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again later.')
    }
  }, [token, user?.sub, user?.email, user?.name, ensureFridge, navigate, onAccept])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invite token is missing. Please use the link from your email.')
      return
    }

    if (isAuthenticated && user?.sub) {
      acceptInvite()
    }
  }, [token, isAuthenticated, user?.sub, acceptInvite])

  if (!token) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          padding: '16px'
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
          }}
        >
          <p style={{ color: '#c62828', fontSize: '16px', margin: 0 }}>
            Invite token is missing. Please open the invite link from your email again.
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
          padding: '16px'
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <h2 style={{ margin: 0, color: 'rgba(0, 0, 0, 0.87)', fontSize: '20px', fontWeight: '500' }}>
            Log in to accept your invite
          </h2>
          <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', margin: 0 }}>
            You need to sign in with Google before you can join the shared fridge.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 16px',
              backgroundColor: '#6200ee',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '16px'
      }}
    >
      <div
        style={{
          maxWidth: '420px',
          width: '100%',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
        }}
      >
        <h2 style={{ margin: '0 0 12px', color: 'rgba(0, 0, 0, 0.87)', fontSize: '20px', fontWeight: '500' }}>
          Joining Shared Fridge
        </h2>
        <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', margin: '0 0 16px' }}>
          {status === 'loading'
            ? 'We are connecting you to the shared fridge. This should only take a moment.'
            : message}
        </p>
        {status === 'error' && (
          <button
            onClick={acceptInvite}
            style={{
              padding: '12px 16px',
              backgroundColor: '#6200ee',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
            }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

export default AcceptInvite


