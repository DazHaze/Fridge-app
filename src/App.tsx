import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import { getApiUrl } from './config'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'

interface FridgeItem {
  _id: string
  name: string
  expiryDate: string
  isOpened?: boolean
  openedDate?: string
  createdAt?: string
}

function FridgeApp() {
  const { user, logout } = useAuth()
  const userId = user?.sub || ''
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
    if (!userId) {
      setLoading(false)
      return
    }
    
    try {
      const response = await fetch(getApiUrl(`fridge-items?userId=${encodeURIComponent(userId)}`))
      if (response.ok) {
        const data = await response.json()
        const { active, expired } = separateItems(data)
        setItems(active)
        setBinItems(expired)
      }
    } catch (error) {
      console.error('Error fetching items:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Fetch items from API on component mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchItems()
    }
  }, [userId, fetchItems])

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

    try {
      const updateData: any = {
        name: capitalizeName(itemName.trim()),
        expiryDate: expiryDate,
        userId: userId,
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
      
      const response = await fetch(getApiUrl(`fridge-items/${editingItemId}?userId=${encodeURIComponent(userId)}`), {
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
    try {
      const response = await fetch(getApiUrl('fridge-items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: capitalizeName(itemName.trim()),
          expiryDate: expiryDate,
          userId: userId
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
    try {
      const response = await fetch(getApiUrl(`fridge-items/${id}?userId=${encodeURIComponent(userId)}`), {
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
    if (!window.confirm('Are you sure you want to clear all items from the fridge? This cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(getApiUrl(`fridge-items?userId=${encodeURIComponent(userId)}`), {
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

  return (
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
        gap: '16px',
        overflowY: 'auto',
        paddingBottom: '24px',
        backgroundColor: '#f5f5f5'
      }}
    >
      {/* User info and logout button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '8px 16px',
          borderRadius: '24px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)',
          marginBottom: '8px'
        }}
      >
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%'
            }}
          />
        )}
        <span
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {user?.name}
        </span>
        <button
          onClick={logout}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            color: '#d32f2f',
            border: '1px solid #d32f2f',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#d32f2f'
            e.currentTarget.style.color = '#ffffff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#d32f2f'
          }}
        >
          Logout
        </button>
      </div>
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
        <h2
          style={{
            color: 'rgba(0, 0, 0, 0.87)',
            fontSize: '20px',
            fontWeight: '500',
            margin: '0 0 16px 0',
            textAlign: 'center',
            letterSpacing: '0.15px'
          }}
        >
          {user?.name 
            ? `${user.name}${user.name.endsWith('s') || user.name.endsWith('S') ? "'" : "'s"} Fridge`
            : 'Fridge'}
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
          {loading ? (
            <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              Loading...
            </p>
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
          Bin
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

      <button
        onClick={handleClearFridge}
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '12px 24px',
          backgroundColor: '#d32f2f',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          marginTop: '8px',
          minHeight: '36px',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#c62828'
          e.currentTarget.style.boxShadow = '0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14), 0 1px 18px 0 rgba(0, 0, 0, 0.12)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#d32f2f'
          e.currentTarget.style.boxShadow = '0 2px 4px -1px rgba(0, 0, 0, 0.2), 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12)'
        }}
        onTouchStart={(e) => {
          e.currentTarget.style.backgroundColor = '#c62828'
          e.currentTarget.style.transform = 'scale(0.98)'
        }}
        onTouchEnd={(e) => {
          setTimeout(() => {
            e.currentTarget.style.backgroundColor = '#d32f2f'
            e.currentTarget.style.transform = 'scale(1)'
          }, 150)
        }}
      >
        Clear Fridge
      </button>
    </div>
  )
}

function App() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5'
        }}
      >
        <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '16px' }}>Loading...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <FridgeApp /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
    </Routes>
  )
}

export default App

