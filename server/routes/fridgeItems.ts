import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import FridgeItem from '../models/FridgeItem.js'

const router = express.Router()

// Helper to check MongoDB connection
const checkConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

// Get all fridge items for a specific user
router.get('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const userId = req.query.userId as string
    
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    const items = await FridgeItem.find({ userId }).sort({ createdAt: -1 })
    res.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    res.status(500).json({ message: 'Error fetching items', error: String(error) })
  }
})

// Create a new fridge item
router.post('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { name, expiryDate, userId, isOpened, openedDate } = req.body
    
    if (!name || !expiryDate || !userId) {
      return res.status(400).json({ message: 'Name, expiry date, and userId are required' })
    }

    const newItem = new FridgeItem({
      name,
      expiryDate: new Date(expiryDate),
      userId,
      isOpened: isOpened || false,
      openedDate: isOpened && openedDate ? new Date(openedDate) : null
    })

    const savedItem = await newItem.save()
    console.log('Item saved to database:', savedItem)
    res.status(201).json(savedItem)
  } catch (error) {
    console.error('Error saving item to database:', error)
    res.status(500).json({ message: 'Error creating item', error: String(error) })
  }
})

// Update a fridge item
router.put('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const { name, expiryDate, userId, isOpened, openedDate } = req.body
    
    if (!name || !expiryDate || !userId) {
      return res.status(400).json({ message: 'Name, expiry date, and userId are required' })
    }

    const updateData: any = {
      name,
      expiryDate: new Date(expiryDate),
      isOpened: isOpened || false
    }

    // Set openedDate if item is opened, otherwise clear it
    if (isOpened && openedDate) {
      updateData.openedDate = new Date(openedDate)
    } else {
      updateData.openedDate = null
    }

    const updatedItem = await FridgeItem.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true, runValidators: true }
    )
    
    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' })
    }

    console.log('Item updated in database:', updatedItem)
    res.json(updatedItem)
  } catch (error) {
    console.error('Error updating item:', error)
    res.status(500).json({ message: 'Error updating item', error: String(error) })
  }
})

// Delete a fridge item
router.delete('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const userId = req.query.userId as string
    
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }
    
    const deletedItem = await FridgeItem.findOneAndDelete({ _id: id, userId })
    
    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found' })
    }

    res.json({ message: 'Item deleted successfully', item: deletedItem })
  } catch (error) {
    console.error('Error deleting item:', error)
    res.status(500).json({ message: 'Error deleting item', error: String(error) })
  }
})

// Clear all fridge items for a specific user
router.delete('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const userId = req.query.userId as string
    
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    const result = await FridgeItem.deleteMany({ userId })
    console.log(`Cleared ${result.deletedCount} items from database for user ${userId}`)
    res.json({ message: 'All items cleared successfully', deletedCount: result.deletedCount })
  } catch (error) {
    console.error('Error clearing items:', error)
    res.status(500).json({ message: 'Error clearing items', error: String(error) })
  }
})

export default router

