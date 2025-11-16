import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getApiUrl } from '../config'

export interface Notification {
  _id: string
  userId: string
  type: 'account_created' | 'first_item_added' | 'item_expiring_tomorrow' | 'fridge_invite'
  title: string
  message: string
  read: boolean
  metadata?: {
    fridgeId?: string
    itemId?: string
    inviteId?: string
    inviteToken?: string
  }
  createdAt: string
  updatedAt: string
}

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refreshNotifications: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user?.sub) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now()
      const [notificationsResponse, countResponse] = await Promise.all([
        fetch(getApiUrl(`notifications/user/${user.sub}?t=${timestamp}`), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }),
        fetch(getApiUrl(`notifications/user/${user.sub}/unread-count?t=${timestamp}`), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
      ])

      if (notificationsResponse.ok) {
        const data = await notificationsResponse.json()
        setNotifications(data.notifications || [])
      }

      if (countResponse.ok) {
        const countData = await countResponse.json()
        setUnreadCount(countData.count || 0)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.sub])

  const refreshNotifications = useCallback(async () => {
    await fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(getApiUrl(`notifications/${notificationId}/read`), {
        method: 'PATCH'
      })

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!user?.sub) return

    try {
      const response = await fetch(getApiUrl(`notifications/user/${user.sub}/read-all`), {
        method: 'PATCH'
      })

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [user?.sub])

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(getApiUrl(`notifications/${notificationId}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        const notification = notifications.find(n => n._id === notificationId)
        setNotifications(prev => prev.filter(n => n._id !== notificationId))
        if (notification && !notification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [notifications])

  const clearAllNotifications = useCallback(async () => {
    if (!user?.sub) return

    try {
      const response = await fetch(getApiUrl(`notifications/user/${user.sub}/all`), {
        method: 'DELETE'
      })

      if (response.ok) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error)
    }
  }, [user?.sub])

  useEffect(() => {
    fetchNotifications()
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchNotifications])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

