import { useState, useEffect } from 'react'
import './App.css'
import { getApiUrl } from './config'

interface FridgeItem {
  _id: string
  name: string
  expiryDate: string
  createdAt?: string
}

function App() {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [items, setItems] = useState<FridgeItem[]>([])
  const [binItems, setBinItems] = useState<FridgeItem[]>([])
  const [loading, setLoading] = useState(true)

  // Check if an item is expired
  const isExpired = (expiryDateString: string): boolean => {
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day
    const expiryDate = new Date(expiryDateString)
    expiryDate.setHours(0, 0, 0, 0)
    return expiryDate < today
  }

  // Separate items into active and expired (bin) items
  const separateItems = (allItems: FridgeItem[]) => {
    const active: FridgeItem[] = []
    const expired: FridgeItem[] = []
    
    allItems.forEach(item => {
      if (isExpired(item.expiryDate)) {
        expired.push(item)
      } else {
        active.push(item)
      }
    })
    
    return { active, expired }
  }

  // Fetch items from API on component mount
  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const response = await fetch(getApiUrl('fridge-items'))
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
  }

  const handlePlusClick = () => {
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setItemName('')
    setExpiryDate('')
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
          name: itemName,
          expiryDate: expiryDate
        })
      })

      if (response.ok) {
        const newItem = await response.json()
        console.log('Item successfully saved to database:', newItem)
        
        // Check if the new item is expired and add to appropriate list
        if (isExpired(newItem.expiryDate)) {
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
      const response = await fetch(getApiUrl(`fridge-items/${id}`), {
        method: 'DELETE'
      })

      if (response.ok) {
        // Remove from both lists in case it's in either one
        setItems(items.filter(item => item._id !== id))
        setBinItems(binItems.filter(item => item._id !== id))
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
      const response = await fetch(getApiUrl('fridge-items'), {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`Cleared ${result.deletedCount} items from database`)
        setItems([])
        setBinItems([])
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
        justifyContent: 'center',
        width: '100%',
        height: '100vh',
        margin: 0,
        padding: '20px',
        gap: '20px'
      }}
    >
      <div 
        className="fridge-items"
        style={{
          width: '300px',
          height: '300px',
          backgroundColor: '#000000',
          border: '2px solid #ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          position: 'relative',
          padding: '20px',
          flexShrink: 0
        }}
      >
        <button
          onClick={handlePlusClick}
          className="plus-button"
          style={{
            backgroundColor: 'transparent',
            border: '2px solid #ffffff',
            color: '#ffffff',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            fontSize: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '10px',
            marginBottom: '15px',
            transition: 'all 0.3s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff'
            e.currentTarget.style.color = '#000000'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#ffffff'
          }}
        >
          +
        </button>

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
            <p style={{ color: '#ffffff', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              Loading...
            </p>
          ) : items.length === 0 ? (
            <p style={{ color: '#ffffff', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              No items yet. Click + to add.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item._id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #ffffff',
                  borderRadius: '4px',
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#cccccc' }}>
                    Expires: {new Date(item.expiryDate).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteItem(item._id)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ff4444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#ffffff'
                  }}
                  title="Delete item"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        {isFormOpen && (
          <div 
            className="input-form"
            style={{
              position: 'absolute',
              top: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#ffffff',
              padding: '20px',
              borderRadius: '8px',
              width: '250px',
              zIndex: 10,
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
            }}
          >
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label 
                  htmlFor="itemName"
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#000000',
                    fontWeight: 'bold'
                  }}
                >
                  Item Name:
                </label>
                <input
                  type="text"
                  id="itemName"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label 
                  htmlFor="expiryDate"
                  style={{
                    display: 'block',
                    marginBottom: '5px',
                    color: '#000000',
                    fontWeight: 'bold'
                  }}
                >
                  Expiry Date:
                </label>
                <input
                  type="date"
                  id="expiryDate"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ccc',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div 
        className="bin"
        style={{
          width: '300px',
          height: '300px',
          backgroundColor: '#000000',
          border: '2px solid #ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          position: 'relative',
          padding: '20px',
          flexShrink: 0
        }}
      >
        <h2
          style={{
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 'bold',
            margin: '10px 0 15px 0',
            textAlign: 'center'
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
            <p style={{ color: '#ffffff', fontSize: '14px', textAlign: 'center', marginTop: '20px' }}>
              No items in bin.
            </p>
          ) : (
            binItems.map((item) => (
              <div
                key={item._id}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #ffffff',
                  borderRadius: '4px',
                  padding: '10px',
                  color: '#ffffff',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#ff4444' }}>
                    Expired: {new Date(item.expiryDate).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteItem(item._id)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ff4444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#ffffff'
                  }}
                  title="Delete item"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={handleClearFridge}
        style={{
          width: '300px',
          padding: '12px 24px',
          backgroundColor: '#ff4444',
          color: '#ffffff',
          border: '2px solid #ffffff',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginTop: '10px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#cc0000'
          e.currentTarget.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ff4444'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        Clear Fridge
      </button>
    </div>
  )
}

export default App

