import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getApiUrl } from '../config'

interface InviteUserProps {
  fridgeId: string
}

const InviteUser = ({ fridgeId }: InviteUserProps) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fridgeName, setFridgeName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [showAccountInviteDialog, setShowAccountInviteDialog] = useState(false)
  const [accountInviteLoading, setAccountInviteLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.sub) {
      setStatus('error')
      setMessage('You must be logged in to send invites.')
      return
    }

    if (!email) {
      setStatus('error')
      setMessage('Please enter an email address.')
      return
    }

    if (!fridgeName || !fridgeName.trim()) {
      setStatus('error')
      setMessage('Please enter a name for the shared fridge.')
      return
    }

    setStatus('loading')
    setMessage(null)
    setInviteLink(null)

    try {
      const response = await fetch(getApiUrl('invites'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inviterId: user.sub,
          inviteeEmail: email,
          fridgeId,
          fridgeName: fridgeName.trim()
        })
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        // Check if email doesn't have an account
        if (data.hasAccount === false) {
          setStatus('idle')
          setShowAccountInviteDialog(true)
          return
        }

        setStatus('success')
        setMessage('Invitation sent successfully!')
        if (data?.acceptLink) {
          setInviteLink(data.acceptLink)
        }
        setEmail('')
        setFridgeName('')
      } else {
        setStatus('error')
        setMessage(data?.message || 'Failed to send invitation. Please try again.')
        if (data?.acceptLink) {
          setInviteLink(data.acceptLink)
        }
      }
    } catch (error) {
      console.error('Error sending invite:', error)
      setStatus('error')
      setMessage('An unexpected error occurred. Please try again.')
    }
  }

  const handleSendAccountInvite = async () => {
    if (!user?.sub) return

    setAccountInviteLoading(true)
    setMessage(null)

    try {
      const response = await fetch(getApiUrl('invites/account-invite'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inviterId: user.sub,
          inviteeEmail: email,
          fridgeName: fridgeName.trim()
        })
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok) {
        setStatus('success')
        setMessage('Account creation invite sent successfully!')
        setShowAccountInviteDialog(false)
        setEmail('')
        setFridgeName('')
        if (data?.signupLink) {
          setInviteLink(data.signupLink)
        }
      } else {
        setMessage(data?.message || 'Failed to send account invite. Please try again.')
      }
    } catch (error) {
      console.error('Error sending account invite:', error)
      setMessage('An unexpected error occurred. Please try again.')
    } finally {
      setAccountInviteLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setMessage('Invite link copied to clipboard!')
    } catch (error) {
      console.error('Error copying invite link:', error)
      setMessage('Unable to copy the link automatically. Please copy it manually.')
    }
  }

  const isDisabled = status === 'loading' || status === 'success'
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
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2
            style={{
              margin: 0,
              color: 'rgba(0, 0, 0, 0.87)',
              fontSize: '20px',
              fontWeight: '500'
            }}
          >
            Invite Someone to Your Fridge
          </h2>
          <button
            onClick={() => navigate('/')}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6200ee',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Back
          </button>
        </div>

        <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', margin: 0 }}>
          Send an email invitation so another person can manage the same fridge. The link will let them join and stay in sync with your items.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label
            htmlFor="invite-fridge-name"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: 'rgba(0, 0, 0, 0.87)',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Shared Fridge Name
            <input
              id="invite-fridge-name"
              type="text"
              value={fridgeName}
              onChange={(event) => setFridgeName(event.target.value)}
              placeholder="e.g., Family Fridge, Roommate Fridge"
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
              onFocus={(event) => {
                event.currentTarget.style.borderColor = '#6200ee'
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
              }}
            />
          </label>

          <label
            htmlFor="invite-email"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              color: 'rgba(0, 0, 0, 0.87)',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            Email address
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="friend@example.com"
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
              onFocus={(event) => {
                event.currentTarget.style.borderColor = '#6200ee'
              }}
              onBlur={(event) => {
                event.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
              }}
            />
          </label>

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              padding: '12px 16px',
              backgroundColor: isDisabled ? 'rgba(98, 0, 238, 0.38)' : '#6200ee',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
              transition: 'all 0.2s ease',
              opacity: isDisabled ? 0.6 : 1
            }}
            aria-disabled={isDisabled}
          >
            {status === 'loading' ? 'Sending...' : status === 'success' ? 'Invite Sent' : 'Send Invite'}
          </button>
        </form>

        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '4px',
              backgroundColor: status === 'success' ? '#e8f5e9' : '#ffebee',
              color: status === 'success' ? '#2e7d32' : '#c62828',
              fontSize: '14px'
            }}
          >
            {message}
          </div>
        )}

        {inviteLink && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '4px',
              backgroundColor: '#f1f8ff',
              border: '1px solid rgba(33, 150, 243, 0.2)'
            }}
          >
            <span style={{ fontSize: '14px', color: '#0d47a1', fontWeight: 500 }}>
              Share this link manually if the email did not send:
            </span>
            <code
              style={{
                wordBreak: 'break-all',
                backgroundColor: '#e3f2fd',
                padding: '8px',
                borderRadius: '4px',
                fontSize: '13px'
              }}
            >
              {inviteLink}
            </code>
            <button
              onClick={handleCopyLink}
              style={{
                alignSelf: 'flex-start',
                padding: '8px 12px',
                backgroundColor: '#2196f3',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }}
            >
              Copy Link
            </button>
          </div>
        )}
      </div>

      {/* Account Invite Dialog */}
      {showAccountInviteDialog && (
        <>
          <div
            onClick={() => setShowAccountInviteDialog(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              backdropFilter: 'blur(2px)'
            }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '420px',
              width: '90%',
              zIndex: 1001,
              boxShadow: '0 11px 15px -7px rgba(0, 0, 0, 0.2), 0 24px 38px 3px rgba(0, 0, 0, 0.14), 0 9px 46px 8px rgba(0, 0, 0, 0.12)'
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                color: 'rgba(0, 0, 0, 0.87)',
                fontSize: '20px',
                fontWeight: '500'
              }}
            >
              Account Required
            </h3>
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', marginBottom: '24px' }}>
              This email address does not have a Bia Fridge account. Would you like to send them an invite to create one? They'll be able to join your shared fridge after signing up.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAccountInviteDialog(false)
                  setStatus('idle')
                }}
                disabled={accountInviteLoading}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'transparent',
                  color: '#6200ee',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: accountInviteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendAccountInvite}
                disabled={accountInviteLoading}
                style={{
                  padding: '10px 16px',
                  backgroundColor: accountInviteLoading ? 'rgba(98, 0, 238, 0.38)' : '#6200ee',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: accountInviteLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
                }}
              >
                {accountInviteLoading ? 'Sending...' : 'Send Account Invite'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default InviteUser


