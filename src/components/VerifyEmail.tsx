import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getApiUrl } from '../config'
import { Spinner } from '@/components/ui/spinner'

const VerifyEmail = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')

    if (!token) {
      setStatus('error')
      setMessage('No verification token provided.')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(getApiUrl(`auth/verify-email?token=${encodeURIComponent(token)}`))
        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage('Email verified successfully! You can now sign in.')
        } else {
          setStatus('error')
          setMessage(data.message || 'Failed to verify email. The link may have expired.')
        }
      } catch (error) {
        console.error('Error verifying email:', error)
        setStatus('error')
        setMessage('Failed to connect to server. Please check your connection.')
      }
    }

    verifyEmail()
  }, [searchParams])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '16px'
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
          textAlign: 'center'
        }}
      >
        <h1
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '36px',
            fontWeight: '500',
            marginBottom: '24px',
            letterSpacing: '0.15px'
          }}
        >
          Bia
        </h1>

        {status === 'loading' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <Spinner size="lg" />
              <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '16px', margin: 0 }}>
                Verifying your email...
              </p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#e8f5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: '32px'
              }}
            >
              ✓
            </div>
            <p style={{ color: '#2e7d32', fontSize: '16px', marginBottom: '24px', fontWeight: '500' }}>
              {message}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6200ee',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
              }}
            >
              Go to Sign In
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: '#ffebee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                fontSize: '32px',
                color: '#c62828'
              }}
            >
              ✕
            </div>
            <p style={{ color: '#c62828', fontSize: '16px', marginBottom: '24px', fontWeight: '500' }}>
              {message}
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6200ee',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
              }}
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default VerifyEmail

