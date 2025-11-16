import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationContext'
import { Spinner } from '@/components/ui/spinner'

interface NotificationSidebarProps {
  isOpen: boolean
  onClose: () => void
}

const NotificationSidebar = ({ isOpen, onClose }: NotificationSidebarProps) => {
  const { notifications, markAsRead, markAllAsRead, deleteNotification, clearAllNotifications } = useNotifications()
  const navigate = useNavigate()
  const [isClearing, setIsClearing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Only mark as read if it's a stored notification (not a virtual invite notification)
    if (!notification.read && !notification._id.toString().startsWith('invite_')) {
      markAsRead(notification._id)
    }

    // Handle different notification types
    if (notification.type === 'fridge_invite' && notification.metadata?.inviteToken) {
      navigate(`/invite/accept?token=${notification.metadata.inviteToken}`)
      onClose()
    } else if (notification.metadata?.fridgeId) {
      // Navigate to fridge if available
      onClose()
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'account_created':
        return '👋'
      case 'first_item_added':
        return '🎉'
      case 'item_expiring_tomorrow':
        return '⚠️'
      case 'fridge_invite':
        return '📨'
      default:
        return '🔔'
    }
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1001,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.15)',
          zIndex: 1002,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
            position: 'sticky',
            top: 0,
            zIndex: 1
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '500',
              color: 'rgba(0, 0, 0, 0.87)'
            }}
          >
            Notifications
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  setIsClearing(true)
                  await clearAllNotifications()
                  setIsClearing(false)
                }}
                disabled={isClearing}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#d32f2f',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isClearing ? 'not-allowed' : 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isClearing ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isClearing) {
                    e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isClearing) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {isClearing ? <Spinner size="sm" /> : null}
                Clear all
              </button>
            )}
            {notifications.some(n => !n.read) && (
              <button
                onClick={markAllAsRead}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6200ee',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(98, 0, 238, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'rgba(0, 0, 0, 0.54)',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'rgba(0, 0, 0, 0.6)'
              }}
            >
              <p style={{ margin: 0, fontSize: '16px' }}>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: notification.read ? '#ffffff' : '#f3e5f5',
                  border: `1px solid ${notification.read ? 'rgba(0, 0, 0, 0.12)' : '#6200ee40'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = notification.read ? '#f5f5f5' : '#e1bee7'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = notification.read ? '#ffffff' : '#f3e5f5'
                }}
              >
                {!notification.read && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#6200ee',
                      borderRadius: '50%'
                    }}
                  />
                )}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      flexShrink: 0
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: '0 0 4px 0',
                        fontSize: '16px',
                        fontWeight: notification.read ? '400' : '500',
                        color: 'rgba(0, 0, 0, 0.87)'
                      }}
                    >
                      {notification.title}
                    </h3>
                    <p
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: '14px',
                        color: 'rgba(0, 0, 0, 0.6)',
                        lineHeight: '1.4'
                      }}
                    >
                      {notification.message}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '8px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'rgba(0, 0, 0, 0.54)'
                        }}
                      >
                        {formatDate(notification.createdAt)}
                      </span>
                      {notification.type === 'fridge_invite' && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#6200ee',
                            fontWeight: '500'
                          }}
                        >
                          Click to accept →
                        </span>
                      )}
                    </div>
                  </div>
                  {!notification._id.toString().startsWith('invite_') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotification(notification._id)
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.54)',
                      cursor: 'pointer',
                      padding: '4px',
                      fontSize: '18px',
                      flexShrink: 0,
                      borderRadius: '4px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                      e.currentTarget.style.color = '#d32f2f'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.54)'
                    }}
                  >
                    ×
                  </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

export default NotificationSidebar

