import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import FridgeItem from '../models/FridgeItem.js'
import UserProfile from '../models/UserProfile.js'
import Fridge from '../models/Fridge.js'

const router = express.Router()

const checkConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

const resolveFridgeContext = async (userId?: string, fridgeId?: string) => {
  if (fridgeId) {
    return fridgeId
  }

  if (!userId) {
    throw new Error('userId or fridgeId must be provided')
  }

  const profile = await UserProfile.findOne({ userId })
  if (!profile) {
    throw new Error('User profile not found')
  }

  return profile.fridgeId.toString()
}

const ensureMembership = async (userId: string, fridgeId: string) => {
  const fridge = await Fridge.findById(fridgeId)
  if (!fridge) {
    throw new Error('Fridge not found')
  }

  if (!fridge.members.includes(userId)) {
    throw new Error('User is not a member of this fridge')
  }
}

router.get('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const userId = req.query.userId as string | undefined
    const fridgeIdParam = req.query.fridgeId as string | undefined

    if (!userId && !fridgeIdParam) {
      return res.status(400).json({ message: 'userId or fridgeId is required' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdParam)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const items = await FridgeItem.find({ fridgeId }).sort({ createdAt: -1 })
    res.json(items)
  } catch (error) {
    console.error('Error fetching items:', error)
    res.status(500).json({ message: 'Error fetching items', error: String(error) })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { name, expiryDate, userId, fridgeId: fridgeIdInput, isOpened, openedDate } = req.body as {
      name?: string
      expiryDate?: string
      userId?: string
      fridgeId?: string
      isOpened?: boolean
      openedDate?: string
    }

    if (!name || !expiryDate || (!userId && !fridgeIdInput)) {
      return res.status(400).json({ message: 'Name, expiry date, and userId or fridgeId are required' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const newItem = new FridgeItem({
      name,
      expiryDate: new Date(expiryDate),
      userId: userId || fridgeId,
      fridgeId,
      isOpened: isOpened || false,
      openedDate: isOpened && openedDate ? new Date(openedDate) : null
    })

    const savedItem = await newItem.save()
    res.status(201).json(savedItem)
  } catch (error) {
    console.error('Error saving item to database:', error)
    res.status(500).json({ message: 'Error creating item', error: String(error) })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const { name, expiryDate, userId, fridgeId: fridgeIdInput, isOpened, openedDate } = req.body as {
      name?: string
      expiryDate?: string
      userId?: string
      fridgeId?: string
      isOpened?: boolean
      openedDate?: string
    }

    if (!name || !expiryDate || (!userId && !fridgeIdInput)) {
      return res.status(400).json({ message: 'Name, expiry date, and userId or fridgeId are required' })
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const updateData: Record<string, unknown> = {
      name,
      expiryDate: new Date(expiryDate),
      isOpened: isOpened || false,
      fridgeId
    }

    updateData.openedDate = isOpened && openedDate ? new Date(openedDate) : null

    const updatedItem = await FridgeItem.findOneAndUpdate(
      { _id: id, fridgeId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found in fridge' })
    }

    res.json(updatedItem)
  } catch (error) {
    console.error('Error updating item:', error)
    res.status(500).json({ message: 'Error updating item', error: String(error) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const userId = req.query.userId as string | undefined
    const fridgeIdInput = req.query.fridgeId as string | undefined

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid item ID format' })
    }

    if (!userId && !fridgeIdInput) {
      return res.status(400).json({ message: 'userId or fridgeId is required' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const deletedItem = await FridgeItem.findOneAndDelete({ _id: id, fridgeId })

    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found in fridge' })
    }

    res.json({ message: 'Item deleted successfully', item: deletedItem })
  } catch (error) {
    console.error('Error deleting item:', error)
    res.status(500).json({ message: 'Error deleting item', error: String(error) })
  }
})

router.delete('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const userId = req.query.userId as string | undefined
    const fridgeIdInput = req.query.fridgeId as string | undefined

    if (!userId && !fridgeIdInput) {
      return res.status(400).json({ message: 'userId or fridgeId is required' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const result = await FridgeItem.deleteMany({ fridgeId })
    res.json({ message: 'All items cleared successfully', deletedCount: result.deletedCount })
  } catch (error) {
    console.error('Error clearing items:', error)
    res.status(500).json({ message: 'Error clearing items', error: String(error) })
  }
})

export default router

