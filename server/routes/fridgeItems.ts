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

// Get all fridge items
router.get('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const items = await FridgeItem.find().sort({ createdAt: -1 })
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
    const { name, expiryDate } = req.body
    
    if (!name || !expiryDate) {
      return res.status(400).json({ message: 'Name and expiry date are required' })
    }

    const newItem = new FridgeItem({
      name,
      expiryDate: new Date(expiryDate)
    })

    const savedItem = await newItem.save()
    console.log('Item saved to database:', savedItem)
    res.status(201).json(savedItem)
  } catch (error) {
    console.error('Error saving item to database:', error)
    res.status(500).json({ message: 'Error creating item', error: String(error) })
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
    
    const deletedItem = await FridgeItem.findByIdAndDelete(id)
    
    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found' })
    }

    res.json({ message: 'Item deleted successfully', item: deletedItem })
  } catch (error) {
    console.error('Error deleting item:', error)
    res.status(500).json({ message: 'Error deleting item', error: String(error) })
  }
})

// Clear all fridge items
router.delete('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const result = await FridgeItem.deleteMany({})
    console.log(`Cleared ${result.deletedCount} items from database`)
    res.json({ message: 'All items cleared successfully', deletedCount: result.deletedCount })
  } catch (error) {
    console.error('Error clearing items:', error)
    res.status(500).json({ message: 'Error clearing items', error: String(error) })
  }
})

export default router

