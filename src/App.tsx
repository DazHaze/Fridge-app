import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import './App.css'
import { getApiUrl } from './config'
import { useAuth } from './contexts/AuthContext'
import { useNotifications } from './contexts/NotificationContext'
import Login from './components/Login'
import InviteUser from './components/InviteUser'
import AcceptInvite from './components/AcceptInvite'
import VerifyEmail from './components/VerifyEmail'
import NotificationSidebar from './components/NotificationSidebar'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'

interface FridgeItem {
  _id: string
  name: string
  expiryDate: string
  isOpened?: boolean
  openedDate?: string
  createdAt?: string
}

interface FridgeAppProps {
  fridgeId: string
  allFridges: Array<{ fridgeId: string; name: string; isPersonal: boolean }>
  onFridgeChange: (fridgeId: string) => void
  onRefreshFridges?: () => void
}

function FridgeApp({ fridgeId, allFridges, onFridgeChange, onRefreshFridges }: FridgeAppProps) {
  const { user, logout } = useAuth()
  const { unreadCount, refreshNotifications } = useNotifications()
  const userId = user?.sub || ''
  const navigate = useNavigate()
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [fridgeName, setFridgeName] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameLoading, setNameLoading] = useState(false)
  const [localFridges, setLocalFridges] = useState(allFridges)

  // Format personal fridge name: "[name]'s" or "[name]'" if name ends with 's'
  const formatPersonalFridgeName = (name: string | undefined): string => {
    if (!name) return 'My Fridge'
    const trimmedName = name.trim()
    if (trimmedName.toLowerCase().endsWith('s')) {
      return `${trimmedName}' Fridge`
    }
    return `${trimmedName}'s Fridge`
  }
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditFormOpen, setIsEditFormOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [isOpened, setIsOpened] = useState(false)
  const [items, setItems] = useState<FridgeItem[]>([])
  const [binItems, setBinItems] = useState<FridgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deletedCount, setDeletedCount] = useState(0)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Capitalize item name (first letter of each word)
  const capitalizeName = (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Check if an item is expired
  const isExpired = (item: FridgeItem): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day
    
    // If item is opened, check if it's been more than 3 days since opened
    if (item.isOpened && item.openedDate) {
      const openedDate = new Date(item.openedDate)
      openedDate.setHours(0, 0, 0, 0)
      const daysSinceOpened = Math.ceil((today.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceOpened > 3
    }
    
    // Otherwise check expiry date
    const expiryDate = new Date(item.expiryDate)
    expiryDate.setHours(0, 0, 0, 0)
    return expiryDate < today
  }

  // Get priority color based on days until expiry (Material Design colors)
  const getPriorityColor = (item: FridgeItem): string => {
    // Opened items are always red
    if (item.isOpened) {
      return '#d32f2f' // Material Design Red
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiryDate = new Date(item.expiryDate)
    expiryDate.setHours(0, 0, 0, 0)
    
    // Calculate difference in days
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // Red: expired or expiring within 2 days
    if (diffDays <= 2) {
      return '#d32f2f' // Material Design Red
    }
    // Yellow/Orange: expiring within 3-7 days
    else if (diffDays <= 7) {
      return '#f57c00' // Material Design Orange
    }
    // Green: more than 7 days away
    else {
      return '#388e3c' // Material Design Green
    }
  }

  // Get priority label text
  const getPriorityLabel = (item: FridgeItem): string => {
    // For opened items, show days since opened
    if (item.isOpened && item.openedDate) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const openedDate = new Date(item.openedDate)
      openedDate.setHours(0, 0, 0, 0)
      const daysSinceOpened = Math.ceil((today.getTime() - openedDate.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysSinceOpened === 0) {
        return 'Opened today'
      } else if (daysSinceOpened === 1) {
        return 'Opened yesterday'
      } else if (daysSinceOpened <= 3) {
        return `Opened ${daysSinceOpened} days ago`
      } else {
        return `Opened ${daysSinceOpened} days ago`
      }
    }
    
    // For unopened items, show expiry info
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expiryDate = new Date(item.expiryDate)
    expiryDate.setHours(0, 0, 0, 0)
    
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return 'Expired'
    } else if (diffDays === 0) {
      return 'Expires today'
    } else if (diffDays === 1) {
      return 'Expires tomorrow'
    } else if (diffDays <= 2) {
      return `Expires in ${diffDays} days`
    } else if (diffDays <= 7) {
      return `Expires in ${diffDays} days`
    } else {
      return `Expires in ${diffDays} days`
    }
  }

  // Separate items into active and expired (bin) items
  const separateItems = (allItems: FridgeItem[]) => {
    const active: FridgeItem[] = []
    const expired: FridgeItem[] = []
    
    allItems.forEach(item => {
      if (isExpired(item)) {
        expired.push(item)
      } else {
        active.push(item)
      }
    })
    
    return { active, expired }
  }

  const fetchItems = useCallback(async () => {
    setLoading(true)
    if (!userId || !fridgeId) {
      setLoading(false)
      return
    }
    
    try {
      const params = new URLSearchParams({
        fridgeId: fridgeId,
        userId: userId
      })
      const response = await fetch(getApiUrl(`fridge-items?${params.toString()}`))
      if (response.ok) {
        const data = await response.json()
        const { active, expired } = separateItems(data)
        setItems(active)
        setBinItems(expired)
      }
      
      // Check for expiring items and create notifications
      try {
        await fetch(getApiUrl('notifications/check-expiring-items'), {
          method: 'POST'
        })
      } catch (error) {
        // Silently fail - this is a background task
        console.error('Error checking expiring items:', error)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, fridgeId])

  // Fetch items from API on component mount and when userId or fridgeId changes
  useEffect(() => {
    if (userId && fridgeId) {
      // Clear items when switching fridges to avoid showing stale data
      setItems([])
      setBinItems([])
      fetchItems()
    }
  }, [userId, fridgeId, fetchItems])

  // Refresh fridge list when window regains focus (in case fridges were added elsewhere)
  useEffect(() => {
    const handleFocus = () => {
      if (onRefreshFridges) {
        onRefreshFridges()
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [onRefreshFridges])

  // Sync local fridges state when allFridges prop changes
  useEffect(() => {
    console.log('allFridges prop changed:', allFridges)
    // Create new objects to ensure React detects the change
    const newFridges = allFridges.map(f => ({ ...f }))
    console.log('Setting localFridges to:', newFridges)
    setLocalFridges(newFridges)
  }, [allFridges])

  // Set current fridge name when fridgeId or localFridges changes
  useEffect(() => {
    if (fridgeId && localFridges.length > 0) {
      const currentFridge = localFridges.find(f => f.fridgeId === fridgeId)
      if (currentFridge) {
        setFridgeName(currentFridge.name || '')
      }
    }
  }, [fridgeId, localFridges])

  const handleUpdateFridgeName = async () => {
    console.log('handleUpdateFridgeName called', { fridgeId, userId, fridgeName: fridgeName.trim() })
    
    if (!fridgeId || !userId || !fridgeName.trim()) {
      console.log('Early return - missing required values', { fridgeId: !!fridgeId, userId: !!userId, fridgeName: fridgeName.trim() })
      alert('Missing required information. Please try again.')
      return
    }

    setNameLoading(true)
    try {
      const url = getApiUrl(`fridges/${fridgeId}/name`)
      console.log('Sending request to:', url)
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fridgeName.trim(),
          userId: userId
        })
      })

      console.log('Response status:', response.status, response.statusText)

      if (response.ok) {
        const responseData = await response.json()
        console.log('Response data:', responseData)
        const newName = responseData.fridge?.name || fridgeName.trim()
        console.log('New name:', newName)
        
        // Update local state immediately with the new name from response
        setFridgeName(newName)
        
        // Also update localFridges immediately for instant UI update
        setLocalFridges(prev => {
          const updated = prev.map(f => 
            f.fridgeId === fridgeId 
              ? { ...f, name: newName }
              : f
          )
          console.log('Updated localFridges immediately:', updated)
          return updated
        })
        
        setIsEditingName(false)
        
        // Refresh fridge list to get updated name in tabs
        if (onRefreshFridges) {
          console.log('Refreshing fridge list...')
          // Force a refresh by calling it twice with a small delay
          await onRefreshFridges()
          // Small delay to ensure the first refresh completes
          await new Promise(resolve => setTimeout(resolve, 200))
          await onRefreshFridges()
          console.log('Fridge list refreshed')
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error response:', errorData)
        alert(errorData.message || `Failed to update fridge name. Status: ${response.status}`)
      }
    } catch (error) {
      console.error('Error updating fridge name:', error)
      alert(`Failed to connect to server: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setNameLoading(false)
    }
  }

  const handlePlusClick = () => {
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setItemName('')
    setExpiryDate('')
  }

  const handleEditClick = (item: FridgeItem) => {
    // Verify item still exists in current state
    const itemExists = [...items, ...binItems].some(i => i._id === item._id)
    if (!itemExists) {
      alert('This item no longer exists. Refreshing the list...')
      fetchItems()
      return
    }
    
    setEditingItemId(item._id)
    setItemName(item.name)
    setExpiryDate(item.expiryDate.split('T')[0]) // Format date for input
    setIsOpened(item.isOpened || false)
    setIsEditFormOpen(true)
  }

  const handleCloseEditForm = () => {
    setIsEditFormOpen(false)
    setEditingItemId(null)
    setItemName('')
    setExpiryDate('')
    setIsOpened(false)
  }

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItemId) return
    if (!fridgeId) {
      alert('Fridge not ready. Please try again in a moment.')
      return
    }
    if (!userId) {
      alert('You must be signed in to update items.')
      return
    }

    // Check if user has an account before updating items
    try {
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${userId}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))
      
      if (!accountCheckData.hasAccount) {
        alert('You must have an account to update items. Please sign up first.')
        navigate('/login?signup=true')
        return
      }
    } catch (error) {
      console.error('Error checking account:', error)
    }

    try {
      const updateData: any = {
        name: capitalizeName(itemName.trim()),
        expiryDate: expiryDate,
        userId: userId,
        fridgeId: fridgeId,
        isOpened: isOpened
      }
      
      // If opening the item, set openedDate to today
      if (isOpened) {
        const currentItem = [...items, ...binItems].find(item => item._id === editingItemId)
        // Only set openedDate if it wasn't already opened
        if (!currentItem?.isOpened) {
          updateData.openedDate = new Date().toISOString()
        } else if (currentItem?.openedDate) {
          updateData.openedDate = currentItem.openedDate
        }
      } else {
        // If closing, clear openedDate
        updateData.openedDate = null
      }
      
      const params = new URLSearchParams({
        fridgeId,
        userId
      })
      const response = await fetch(getApiUrl(`fridge-items/${editingItemId}?${params.toString()}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const updatedItem = await response.json()
        console.log('Item successfully updated:', updatedItem)
        
        // Update the item in the appropriate list
        setItems(items.map(item => item._id === editingItemId ? updatedItem : item))
        setBinItems(binItems.map(item => item._id === editingItemId ? updatedItem : item))
        
        handleCloseEditForm()
        // Refresh items to ensure correct separation
        fetchItems()
      } else {
        let errorMessage = 'Failed to update item. Please try again.'
        try {
          const errorData = await response.json()
          console.error('Error updating item:', errorData)
          errorMessage = errorData.message || errorMessage
          
          // If item not found, refresh the list in case it was deleted
          if (response.status === 404) {
            console.log('Item not found, refreshing items list...')
            fetchItems()
            errorMessage = 'Item not found. It may have been deleted. The list has been refreshed.'
          }
        } catch (parseError) {
          console.error('Error response status:', response.status, response.statusText)
        }
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Failed to connect to server. Please check your connection.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fridgeId) {
      alert('Fridge not ready. Please try again in a moment.')
      return
    }
    if (!userId) {
      alert('You must be signed in to add items.')
      return
    }

    // Check if user has an account before adding items
    try {
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${userId}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))
      
      if (!accountCheckData.hasAccount) {
        alert('You must have an account to add items. Please sign up first.')
        navigate('/login?signup=true')
        return
      }
    } catch (error) {
      console.error('Error checking account:', error)
    }

    try {
      const response = await fetch(getApiUrl('fridge-items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: capitalizeName(itemName.trim()),
          expiryDate: expiryDate,
          userId: userId,
          fridgeId: fridgeId
        })
      })

      if (response.ok) {
        const newItem = await response.json()
        console.log('Item successfully saved to database:', newItem)
        
        // Check if the new item is expired and add to appropriate list
        if (isExpired(newItem)) {
          setBinItems([newItem, ...binItems])
        } else {
          setItems([newItem, ...items])
        }
        
        // Refresh notifications after adding item (with delay to allow backend to create notification)
        // Try refreshing multiple times to ensure we get the new notification
        const refreshWithRetry = async (attempts = 3, delay = 300) => {
          for (let i = 0; i < attempts; i++) {
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)))
            try {
              await refreshNotifications()
            } catch (err) {
              console.error(`Error refreshing notifications (attempt ${i + 1}):`, err)
            }
          }
        }
        refreshWithRetry().catch(err => {
          console.error('Error in notification refresh retry:', err)
        })
        
        handleCloseForm()
      } else {
        let errorMessage = 'Failed to add item. Please try again.'
        try {
          const errorData = await response.json()
          console.error('Error adding item:', errorData)
          errorMessage = errorData.message || errorMessage
        } catch (parseError) {
          console.error('Error response status:', response.status, response.statusText)
          if (response.status === 503) {
            errorMessage = 'Database not connected. Please check your server configuration.'
          } else if (response.status === 0) {
            errorMessage = 'Cannot connect to server. Make sure the server is running on port 5000.'
          }
        }
        alert(errorMessage)
      }
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Failed to connect to server. Please check your connection.')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!fridgeId) {
      alert('Fridge not ready. Please try again in a moment.')
      return
    }
    if (!userId) {
      alert('You must be signed in to delete items.')
      return
    }

    // Check if user has an account before deleting items
    try {
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${userId}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))
      
      if (!accountCheckData.hasAccount) {
        alert('You must have an account to delete items. Please sign up first.')
        navigate('/login?signup=true')
        return
      }
    } catch (error) {
      console.error('Error checking account:', error)
    }

    try {
      const params = new URLSearchParams({
        fridgeId,
        userId
      })
      const response = await fetch(getApiUrl(`fridge-items/${id}?${params.toString()}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        // Check if item was in bin before removing
        const wasInBin = binItems.some(item => item._id === id)
        
        // Remove from both lists in case it's in either one
        setItems(items.filter(item => item._id !== id))
        setBinItems(binItems.filter(item => item._id !== id))
        
        // Only increment counter if item was removed from bin
        if (wasInBin) {
          setDeletedCount(prev => prev + 1)
        }
      } else {
        console.error('Error deleting item')
      }
    } catch (error) {
      console.error('Error deleting item:', error)
    }
  }

  const handleClearFridge = async () => {
    if (!fridgeId) {
      alert('Fridge not ready. Please try again in a moment.')
      return
    }
    if (!userId) {
      alert('You must be signed in to clear the fridge.')
      return
    }
    if (!window.confirm('Are you sure you want to clear all items from the fridge? This cannot be undone.')) {
      return
    }

    // Check if user has an account before clearing fridge
    try {
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${userId}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))
      
      if (!accountCheckData.hasAccount) {
        alert('You must have an account to clear fridge. Please sign up first.')
        navigate('/login?signup=true')
        return
      }
    } catch (error) {
      console.error('Error checking account:', error)
    }

    try {
      const params = new URLSearchParams({
        fridgeId,
        userId
      })
      const response = await fetch(getApiUrl(`fridge-items?${params.toString()}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`Cleared ${result.deletedCount} items from database`)
        
        // Count how many items were in bin before clearing
        const binItemsCount = binItems.length
        
        setItems([])
        setBinItems([])
        
        // Only add bin items to deleted counter (items removed from bin)
        setDeletedCount(prev => prev + binItemsCount)
        
        alert(`Successfully cleared ${result.deletedCount} item(s) from the fridge.`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error clearing fridge:', errorData)
        alert('Failed to clear fridge. Please try again.')
      }
    } catch (error) {
      console.error('Error clearing fridge:', error)
      alert('Failed to connect to server. Please check your connection.')
    }
  }

  const handleInviteUser = () => {
    setIsMenuOpen(false)
    navigate('/invite')
  }

  return (
    <>
      {/* Navigation Menu */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 1000
        }}
      >
        <h1
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '20px',
            fontWeight: '500',
            margin: 0,
            letterSpacing: '0.15px'
          }}
        >
          Bia
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Notification Button */}
          <button
            onClick={() => setIsNotificationOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: '50%',
              transition: 'background-color 0.2s ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            aria-label="Notifications"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block' }}
            >
              <path
                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                fill="rgba(0, 0, 0, 0.87)"
              />
            </svg>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  backgroundColor: '#d32f2f',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '600',
                  border: '2px solid #ffffff'
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '40px',
            minHeight: '40px',
            borderRadius: '50%',
            transition: 'background-color 0.2s ease',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
          aria-label="Menu"
        >
          <div
            style={{
              width: '24px',
              height: '2px',
              backgroundColor: 'rgba(0, 0, 0, 0.87)',
              transition: 'all 0.3s ease',
              transform: isMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none'
            }}
          />
          <div
            style={{
              width: '24px',
              height: '2px',
              backgroundColor: 'rgba(0, 0, 0, 0.87)',
              transition: 'all 0.3s ease',
              opacity: isMenuOpen ? 0 : 1
            }}
          />
          <div
            style={{
              width: '24px',
              height: '2px',
              backgroundColor: 'rgba(0, 0, 0, 0.87)',
              transition: 'all 0.3s ease',
              transform: isMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none'
            }}
          />
        </button>
        </div>
      </nav>

      {/* Menu Dropdown */}
      {isMenuOpen && (
        <>
          <div
            onClick={() => setIsMenuOpen(false)}
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
          <div
            style={{
              position: 'fixed',
              top: '56px',
              right: '16px',
              backgroundColor: '#ffffff',
              borderRadius: '4px',
              boxShadow: '0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12), 0 5px 5px -3px rgba(0, 0, 0, 0.2)',
              minWidth: '200px',
              zIndex: 1002,
              padding: '8px 0',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
              }}
            >
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%'
                  }}
                />
              )}
              <span
                style={{
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontSize: '16px',
                  fontWeight: '500',
                  flex: 1
                }}
              >
                {user?.name}
              </span>
            </div>
          <button
            onClick={handleInviteUser}
            style={{
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color: '#6200ee',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              textAlign: 'left',
              transition: 'background-color 0.2s ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(98, 0, 238, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            aria-label="Invite user to fridge"
          >
            Invite User to Fridge
          </button>
            <button
              onClick={() => {
                setIsMenuOpen(false)
                logout()
              }}
              style={{
                padding: '12px 16px',
                backgroundColor: 'transparent',
                color: '#d32f2f',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'left',
                transition: 'background-color 0.2s ease',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Logout
            </button>
          </div>
        </>
      )}
      
      <div 
        className="App"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          minHeight: '100vh',
          margin: 0,
          padding: '16px',
          paddingTop: '72px',
          gap: '16px',
          overflowY: 'auto',
          paddingBottom: '24px',
          backgroundColor: '#f5f5f5'
        }}
      >
      {/* Fridge Tabs */}
      {localFridges.length > 0 && (
        <div
          key={`fridge-tabs-${localFridges.map(f => `${f.fridgeId}:${f.name || ''}`).join('|')}`}
          style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
            display: 'flex',
            gap: '8px',
            padding: '8px 16px',
            overflowX: 'auto',
            marginBottom: '8px'
          }}
        >
          {[...localFridges].sort((a, b) => {
            // Personal fridge always comes first
            if (a.isPersonal && !b.isPersonal) return -1
            if (!a.isPersonal && b.isPersonal) return 1
            return 0
          }).map((fridge) => {
            const isActive = fridge.fridgeId === fridgeId
            const displayName = fridge.isPersonal ? formatPersonalFridgeName(user?.name) : (fridge.name || 'Unnamed Fridge')
            return (
              <button
                key={`${fridge.fridgeId}-${fridge.name || ''}-${fridge.isPersonal}`}
                onClick={() => onFridgeChange(fridge.fridgeId)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isActive ? '#6200ee' : 'transparent',
                  color: isActive ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: isActive ? '500' : '400',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 2px 4px -1px rgba(0, 0, 0, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                {displayName}
              </button>
            )
          })}
        </div>
      )}
      <div 
        className="fridge-items"
        style={{
          width: '100%',
          maxWidth: '400px',
          minHeight: '300px',
          height: 'auto',
          maxHeight: '500px',
          backgroundColor: '#ffffff',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          position: 'relative',
          padding: '16px',
          flexShrink: 0,
          borderRadius: '8px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
        }}
      >
        {/* Header with title and settings icon */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            position: 'relative'
          }}
        >
          <h2
            style={{
              color: 'rgba(0, 0, 0, 0.87)',
              fontSize: '20px',
              fontWeight: '500',
              margin: 0,
              textAlign: 'center',
              letterSpacing: '0.15px',
              flex: 1
            }}
          >
            Fridge
          </h2>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              minHeight: '40px',
              borderRadius: '50%',
              transition: 'background-color 0.2s ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              position: 'absolute',
              right: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            aria-label="Fridge settings"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block' }}
            >
              <path
                d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
                fill="rgba(0, 0, 0, 0.54)"
              />
            </svg>
          </button>
        </div>

        {/* Settings Sheet */}
        {isSettingsOpen && (
          <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen} side="right">
            <SheetContent>
              <SheetHeader onClose={() => setIsSettingsOpen(false)}>
                <SheetTitle>Fridge Settings</SheetTitle>
                <SheetDescription>Manage your fridge options</SheetDescription>
              </SheetHeader>
            <div
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* Change Fridge Name Section */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'rgba(0, 0, 0, 0.87)',
                    marginBottom: '4px'
                  }}
                >
                  Fridge Name
                </label>
                {isEditingName ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center'
                    }}
                  >
                    <input
                      type="text"
                      value={fridgeName}
                      onChange={(e) => setFridgeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateFridgeName()
                        } else if (e.key === 'Escape') {
                          setIsEditingName(false)
                          // Reset to current fridge name
                          const currentFridge = allFridges.find(f => f.fridgeId === fridgeId)
                          if (currentFridge) {
                            setFridgeName(currentFridge.name || '')
                          }
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        border: '1px solid rgba(0, 0, 0, 0.23)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#6200ee'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        console.log('Save button clicked')
                        handleUpdateFridgeName()
                      }}
                      disabled={nameLoading || !fridgeName.trim()}
                      type="button"
                      style={{
                        padding: '8px 16px',
                        backgroundColor: nameLoading || !fridgeName.trim() ? 'rgba(0, 0, 0, 0.12)' : '#6200ee',
                        color: nameLoading || !fridgeName.trim() ? 'rgba(0, 0, 0, 0.26)' : '#ffffff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: nameLoading || !fridgeName.trim() ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        minWidth: '60px'
                      }}
                      onMouseEnter={(e) => {
                        if (!nameLoading && fridgeName.trim()) {
                          e.currentTarget.style.backgroundColor = '#5300e0'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!nameLoading && fridgeName.trim()) {
                          e.currentTarget.style.backgroundColor = '#6200ee'
                        }
                      }}
                    >
                      {nameLoading ? <Spinner size="sm" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingName(false)
                        // Reset to current fridge name
                        const currentFridge = allFridges.find(f => f.fridgeId === fridgeId)
                        if (currentFridge) {
                          setFridgeName(currentFridge.name || '')
                        }
                      }}
                      disabled={nameLoading}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        color: 'rgba(0, 0, 0, 0.54)',
                        border: '1px solid rgba(0, 0, 0, 0.23)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: nameLoading ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!nameLoading) {
                          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!nameLoading) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: 'rgba(0, 0, 0, 0.87)',
                        minHeight: '36px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {fridgeName || 'Unnamed Fridge'}
                    </span>
                    <button
                      onClick={() => setIsEditingName(true)}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: 'transparent',
                        color: '#6200ee',
                        border: '1px solid rgba(98, 0, 238, 0.5)',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(98, 0, 238, 0.08)'
                        e.currentTarget.style.borderColor = '#6200ee'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.borderColor = 'rgba(98, 0, 238, 0.5)'
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                          fill="currentColor"
                        />
                      </svg>
                      Edit
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleClearFridge}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#d32f2f',
                  border: '1px solid rgba(211, 47, 47, 0.5)',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.08)'
                  e.currentTarget.style.borderColor = '#d32f2f'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.5)'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.08)'
                }}
                onTouchEnd={(e) => {
                  setTimeout(() => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }, 150)
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    fill="#d32f2f"
                  />
                </svg>
                Clear Fridge
              </button>
            </div>
          </SheetContent>
        </Sheet>
        )}
        
        <div
          style={{
            width: '100%',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingRight: '5px'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
              <Spinner size="sm" />
              <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', margin: 0 }}>Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              No items yet. Click + to add.
            </p>
          ) : (
            items.map((item) => {
              const priorityColor = getPriorityColor(item)
              const priorityLabel = getPriorityLabel(item)
              const displayDate = item.isOpened && item.openedDate 
                ? new Date(item.openedDate).toLocaleDateString()
                : new Date(item.expiryDate).toLocaleDateString()
              const dateLabel = item.isOpened ? 'Opened' : 'Expires'
              
              return (
              <div
                key={item._id}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${priorityColor}40`,
                  borderLeft: `4px solid ${priorityColor}`,
                  borderRadius: '4px',
                  padding: '12px',
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontSize: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  width: '100%',
                  position: 'relative',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.12), 0 1px 2px 0 rgba(0, 0, 0, 0.24)',
                  transition: 'box-shadow 0.2s ease'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '15px', wordBreak: 'break-word', color: 'rgba(0, 0, 0, 0.87)' }}>
                    {capitalizeName(item.name)}
                  </div>
                  <div style={{ fontSize: '12px', color: priorityColor, fontWeight: '500' }}>
                    {priorityLabel} • {dateLabel}: {displayDate}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleEditClick(item)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.54)',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: '400',
                      padding: '8px',
                      minWidth: '36px',
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexShrink: 0,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      borderRadius: '50%',
                      lineHeight: '1',
                      letterSpacing: '2px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.54)'
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)'
                    }}
                    onTouchEnd={(e) => {
                      setTimeout(() => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(0, 0, 0, 0.54)'
                      }, 150)
                    }}
                    title="Edit item"
                    aria-label="Edit item"
                  >
                    ⋯
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item._id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#d32f2f',
                      cursor: 'pointer',
                      fontSize: '24px',
                      fontWeight: '300',
                      padding: '8px',
                      minWidth: '40px',
                      minHeight: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexShrink: 0,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      borderRadius: '50%',
                      lineHeight: '1'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.12)'
                      e.currentTarget.style.transform = 'scale(1.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.12)'
                      e.currentTarget.style.transform = 'scale(0.95)'
                    }}
                    onTouchEnd={(e) => {
                      setTimeout(() => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.transform = 'scale(1)'
                      }, 150)
                    }}
                    title="Delete item"
                    aria-label="Delete item"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
            })
          )}
        </div>

        <button
          onClick={handlePlusClick}
          className="plus-button"
          style={{
            backgroundColor: '#6200ee',
            border: 'none',
            color: '#ffffff',
            width: '56px',
            height: '56px',
            minWidth: '56px',
            minHeight: '56px',
            borderRadius: '50%',
            fontSize: '28px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '16px',
            marginBottom: '8px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            boxShadow: '0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7c4dff'
            e.currentTarget.style.boxShadow = '0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14), 0 3px 14px 2px rgba(0, 0, 0, 0.12)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#6200ee'
            e.currentTarget.style.boxShadow = '0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12)'
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.backgroundColor = '#7c4dff'
            e.currentTarget.style.transform = 'scale(0.95)'
          }}
          onTouchEnd={(e) => {
            setTimeout(() => {
              e.currentTarget.style.backgroundColor = '#6200ee'
              e.currentTarget.style.transform = 'scale(1)'
            }, 150)
          }}
        >
          +
        </button>

        {isFormOpen && (
          <>
            <div 
              className="form-backdrop"
              onClick={handleCloseForm}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 999,
                backdropFilter: 'blur(2px)'
              }}
            />
            <div 
              className="input-form"
              style={{
                position: 'fixed',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '4px',
                width: '90%',
                maxWidth: '400px',
                zIndex: 1000,
                boxShadow: '0 11px 15px -7px rgba(0, 0, 0, 0.2), 0 24px 38px 3px rgba(0, 0, 0, 0.14), 0 9px 46px 8px rgba(0, 0, 0, 0.12)',
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto'
              }}
            >
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label 
                  htmlFor="itemName"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: 'rgba(0, 0, 0, 0.87)',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Item Name
                </label>
                <input
                  type="text"
                  id="itemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid rgba(0, 0, 0, 0.23)',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    touchAction: 'manipulation',
                    backgroundColor: '#ffffff',
                    transition: 'border-color 0.2s ease',
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
              
              <div style={{ marginBottom: '20px' }}>
                <label 
                  htmlFor="expiryDate"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: 'rgba(0, 0, 0, 0.87)',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Expiry Date
                </label>
                <input
                  type="date"
                  id="expiryDate"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid rgba(0, 0, 0, 0.23)',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    touchAction: 'manipulation',
                    backgroundColor: '#ffffff',
                    transition: 'border-color 0.2s ease',
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

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    color: '#6200ee',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    minHeight: '36px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(98, 0, 238, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#6200ee',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    minHeight: '36px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7c4dff'
                    e.currentTarget.style.boxShadow = '0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6200ee'
                    e.currentTarget.style.boxShadow = '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
                  }}
                >
                  Add
                </button>
              </div>
            </form>
          </div>
          </>
        )}

        {isEditFormOpen && (
          <>
            <div 
              className="form-backdrop"
              onClick={handleCloseEditForm}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 999,
                backdropFilter: 'blur(2px)'
              }}
            />
            <div 
              className="edit-form"
              style={{
                position: 'fixed',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '4px',
                width: '90%',
                maxWidth: '400px',
                zIndex: 1000,
                boxShadow: '0 11px 15px -7px rgba(0, 0, 0, 0.2), 0 24px 38px 3px rgba(0, 0, 0, 0.14), 0 9px 46px 8px rgba(0, 0, 0, 0.12)',
                maxHeight: 'calc(100vh - 100px)',
                overflowY: 'auto'
              }}
            >
            <form onSubmit={handleUpdateItem}>
              <div style={{ marginBottom: '20px' }}>
                <label 
                  htmlFor="editItemName"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: 'rgba(0, 0, 0, 0.87)',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Item Name
                </label>
                <input
                  type="text"
                  id="editItemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid rgba(0, 0, 0, 0.23)',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    touchAction: 'manipulation',
                    backgroundColor: '#ffffff',
                    transition: 'border-color 0.2s ease',
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
              
              <div style={{ marginBottom: '20px' }}>
                <label 
                  htmlFor="editExpiryDate"
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    color: isOpened ? 'rgba(0, 0, 0, 0.38)' : 'rgba(0, 0, 0, 0.87)',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  Expiry Date
                </label>
                <input
                  type="date"
                  id="editExpiryDate"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required={!isOpened}
                  disabled={isOpened}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid rgba(0, 0, 0, 0.23)',
                    borderRadius: '4px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    touchAction: 'manipulation',
                    backgroundColor: isOpened ? 'rgba(0, 0, 0, 0.04)' : '#ffffff',
                    color: isOpened ? 'rgba(0, 0, 0, 0.38)' : 'rgba(0, 0, 0, 0.87)',
                    cursor: isOpened ? 'not-allowed' : 'text',
                    transition: 'border-color 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    if (!isOpened) {
                      e.currentTarget.style.borderColor = '#6200ee'
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.23)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'rgba(0, 0, 0, 0.87)',
                    fontWeight: '500',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isOpened}
                    onChange={(e) => setIsOpened(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#6200ee'
                    }}
                  />
                  <span>{itemName} is opened</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleCloseEditForm}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    color: '#6200ee',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    minHeight: '36px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(98, 0, 238, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#6200ee',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    minHeight: '36px',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7c4dff'
                    e.currentTarget.style.boxShadow = '0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6200ee'
                    e.currentTarget.style.boxShadow = '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
                  }}
                >
                  Update
                </button>
              </div>
            </form>
          </div>
          </>
        )}
      </div>

      <div 
        className="bin"
        style={{
          width: '100%',
          maxWidth: '400px',
          minHeight: '300px',
          height: 'auto',
          maxHeight: '500px',
          backgroundColor: '#ffffff',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          position: 'relative',
          padding: '16px',
          flexShrink: 0,
          borderRadius: '8px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
        }}
      >
        <h2
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '20px',
            fontWeight: '500',
            margin: '8px 0 16px 0',
            textAlign: 'center',
            letterSpacing: '0.15px'
          }}
        >
          Expired
        </h2>
        
        <div
          style={{
            width: '100%',
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            paddingRight: '5px'
          }}
        >
          {binItems.length === 0 ? (
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              No items in bin.
            </p>
          ) : (
            binItems.map((item) => {
              const priorityColor = '#d32f2f' // Material Design Red for expired items
              
              // For opened items, show days since opened
              let expiredLabel: string
              let displayDate: string
              let dateLabel: string
              
              if (item.isOpened && item.openedDate) {
                const daysSinceOpened = Math.ceil((new Date().getTime() - new Date(item.openedDate).getTime()) / (1000 * 60 * 60 * 24))
                expiredLabel = daysSinceOpened === 0 ? 'Opened today' : daysSinceOpened === 1 ? 'Opened yesterday' : `Opened ${daysSinceOpened} days ago`
                displayDate = new Date(item.openedDate).toLocaleDateString()
                dateLabel = 'Opened'
              } else {
                const daysSinceExpiry = Math.ceil((new Date().getTime() - new Date(item.expiryDate).getTime()) / (1000 * 60 * 60 * 24))
                expiredLabel = daysSinceExpiry === 0 ? 'Expired today' : daysSinceExpiry === 1 ? 'Expired yesterday' : `Expired ${daysSinceExpiry} days ago`
                displayDate = new Date(item.expiryDate).toLocaleDateString()
                dateLabel = 'Expired'
              }
              
              return (
                <div
                  key={item._id}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${priorityColor}40`,
                  borderLeft: `4px solid ${priorityColor}`,
                  borderRadius: '4px',
                  padding: '12px',
                  color: 'rgba(0, 0, 0, 0.87)',
                  fontSize: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  width: '100%',
                  position: 'relative',
                  opacity: 0.85,
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.12), 0 1px 2px 0 rgba(0, 0, 0, 0.24)'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px', fontSize: '15px', wordBreak: 'break-word', color: 'rgba(0, 0, 0, 0.87)' }}>
                    {capitalizeName(item.name)}
                  </div>
                  <div style={{ fontSize: '12px', color: priorityColor, fontWeight: '500' }}>
                    {expiredLabel} • {dateLabel}: {displayDate}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleEditClick(item)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.54)',
                      cursor: 'pointer',
                      fontSize: '20px',
                      fontWeight: '400',
                      padding: '8px',
                      minWidth: '36px',
                      minHeight: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      flexShrink: 0,
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      borderRadius: '50%',
                      lineHeight: '1',
                      letterSpacing: '2px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.54)'
                    }}
                    onTouchStart={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'
                      e.currentTarget.style.color = 'rgba(0, 0, 0, 0.87)'
                    }}
                    onTouchEnd={(e) => {
                      setTimeout(() => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = 'rgba(0, 0, 0, 0.54)'
                      }, 150)
                    }}
                    title="Edit item"
                    aria-label="Edit item"
                  >
                    ⋯
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item._id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#d32f2f',
                    cursor: 'pointer',
                    fontSize: '24px',
                    fontWeight: '300',
                    padding: '8px',
                    minWidth: '40px',
                    minHeight: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    flexShrink: 0,
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                    borderRadius: '50%',
                    lineHeight: '1'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.12)'
                    e.currentTarget.style.transform = 'scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(211, 47, 47, 0.12)'
                    e.currentTarget.style.transform = 'scale(0.95)'
                  }}
                  onTouchEnd={(e) => {
                    setTimeout(() => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.transform = 'scale(1)'
                    }, 150)
                  }}
                  title="Delete item"
                  aria-label="Delete item"
                >
                  ×
                </button>
                </div>
              </div>
              )
            })
          )}
        </div>
        
        <div
          style={{
            width: '100%',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(0, 0, 0, 0.12)',
            textAlign: 'center'
          }}
        >
          <p
            style={{
              color: 'rgba(0, 0, 0, 0.6)',
              fontSize: '14px',
              fontWeight: '500',
              margin: 0
            }}
          >
            Total Wasted: <span style={{ color: '#d32f2f', fontWeight: '600' }}>{deletedCount}</span>
          </p>
        </div>
      </div>

    </div>
    build
Process completed with exit code 2.
build: server/routes/auth.ts#L143
Cannot assign to 'profile' because it is a constant.
build: server/routes/auth.ts#L126
Cannot redeclare block-scoped variable 'profile'.
      {/* Notification Sidebar */}
      <NotificationSidebar
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
      />
    </>
  )
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Spinner size="lg" />
      <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '16px', margin: 0 }}>{message}</p>
    </div>
  )
}

function App() {
  const { isAuthenticated, loading, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [fridgeId, setFridgeId] = useState<string | null>(null)
  const [selectedFridgeId, setSelectedFridgeId] = useState<string | null>(null)
  const [allFridges, setAllFridges] = useState<Array<{ fridgeId: string; name: string; isPersonal: boolean }>>([])

  const ensureFridge = useCallback(async (): Promise<string | null> => {
    if (!user?.sub) {
      setFridgeId(null)
      return null
    }

    try {
      // First check if user has an account
      const accountCheckResponse = await fetch(getApiUrl(`invites/check-user/${user.sub}`))
      const accountCheckData = await accountCheckResponse.json().catch(() => ({}))

      if (!accountCheckData.hasAccount) {
        console.warn('User does not have an account')
        // Redirect to signup if account doesn't exist
        if (user.email) {
          navigate('/login?signup=true', { replace: true })
        }
        return null
      }

      const response = await fetch(getApiUrl('fridges/ensure'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.sub,
          email: user.email,
          name: user.name
        })
      })

      if (response.ok) {
        const data = await response.json()
        setFridgeId(data.fridgeId)
        return data.fridgeId
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.needsSignup) {
          navigate('/login?signup=true', { replace: true })
        }
        console.error('Failed to ensure fridge:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error ensuring fridge:', error)
    }

    return null
  }, [user?.sub, user?.email, user?.name, navigate])

  const fetchAllFridges = useCallback(async () => {
    if (!user?.sub) return

    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now()
      const response = await fetch(getApiUrl(`fridges/user/${user.sub}?t=${timestamp}`), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        console.log('fetchAllFridges response:', data)
        // Create a new array with new objects to ensure React detects the change
        const newFridges = (data.fridges || []).map((fridge: { fridgeId: string; name: string; isPersonal: boolean; members: string[]; createdAt: Date }) => ({
          fridgeId: fridge.fridgeId,
          name: fridge.name,
          isPersonal: fridge.isPersonal,
          members: [...fridge.members],
          createdAt: fridge.createdAt
        }))
        console.log('Setting allFridges to:', newFridges)
        setAllFridges(newFridges)
        // Set selected fridge to personal fridge if available, otherwise first fridge
        setSelectedFridgeId((current) => {
          if (current) return current // Don't change if already set
          const personalFridge = newFridges.find((f: { isPersonal: boolean }) => f.isPersonal)
          const firstFridge = newFridges[0]
          return personalFridge?.fridgeId || firstFridge?.fridgeId || null
        })
      }
    } catch (error) {
      console.error('Error fetching fridges:', error)
    }
  }, [user?.sub])

  useEffect(() => {
    if (isAuthenticated && user?.sub) {
      ensureFridge().then(() => {
        fetchAllFridges()
      })
    } else {
      setFridgeId(null)
      setSelectedFridgeId(null)
      setAllFridges([])
    }
  }, [isAuthenticated, user?.sub, ensureFridge, fetchAllFridges])

  // Refresh fridge list when navigating back to home page (e.g., from invite page)
  useEffect(() => {
    if (isAuthenticated && user?.sub && location.pathname === '/') {
      fetchAllFridges()
    }
  }, [location.pathname, isAuthenticated, user?.sub, fetchAllFridges])

  if (loading) {
    return <LoadingScreen message="Loading..." />
  }

  const fridgeReady = !!fridgeId && !!selectedFridgeId
  const renderFridgeLoading = <LoadingScreen message="Preparing your fridge..." />

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated
            ? fridgeReady
              ? <FridgeApp 
                  fridgeId={selectedFridgeId} 
                  allFridges={allFridges}
                  onFridgeChange={setSelectedFridgeId}
                  onRefreshFridges={fetchAllFridges}
                />
              : renderFridgeLoading
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/invite"
        element={
          isAuthenticated
            ? fridgeReady
              ? <InviteUser fridgeId={selectedFridgeId || fridgeId || ''} />
              : renderFridgeLoading
            : <Navigate to="/login" replace />
        }
      />
      <Route
        path="/invite/accept"
        element={
          <AcceptInvite
            isAuthenticated={isAuthenticated}
            ensureFridge={ensureFridge}
            onAccept={(acceptedFridgeId) => {
              setSelectedFridgeId(acceptedFridgeId)
              fetchAllFridges()
            }}
          />
        }
      />
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            (() => {
              // Check if there's an inviteToken in the URL
              const urlParams = new URLSearchParams(window.location.search)
              const inviteToken = urlParams.get('inviteToken')
              if (inviteToken) {
                return <Navigate to={`/invite/accept?token=${inviteToken}`} replace />
              }
              return <Navigate to="/" replace />
            })()
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/verify-email"
        element={<VerifyEmail />}
      />
    </Routes>
  )
}

export default App

