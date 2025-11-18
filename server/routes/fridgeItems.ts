import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import FridgeItem from '../models/FridgeItem.js'
import UserProfile from '../models/UserProfile.js'
import Fridge from '../models/Fridge.js'
import { createFirstItemNotification, createItemExpiringNotification } from '../utils/notificationHelper.js'
import Notification from '../models/Notification.js'

const router = express.Router()

const checkConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

// Helper function to check if user has an account
const checkUserHasAccount = async (userId: string): Promise<boolean> => {
  const UserProfile = (await import('../models/UserProfile.js')).default
  const profile = await UserProfile.findOne({ userId })
  if (profile) return true
  
  const User = (await import('../models/User.js')).default
  const user = await User.findById(userId)
  return !!user
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

    // Verify user has an account if userId is provided
    if (userId) {
      const hasAccount = await checkUserHasAccount(userId)
      if (!hasAccount) {
        return res.status(403).json({ message: 'You must have an account to access fridge items. Please sign up first.' })
      }
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
    
    // Set cache-control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
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

    // Verify user has an account if userId is provided
    if (userId) {
      const hasAccount = await checkUserHasAccount(userId)
      if (!hasAccount) {
        return res.status(403).json({ message: 'You must have an account to add items. Please sign up first.' })
      }
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
      openedDate: isOpened && openedDate ? new Date(openedDate) : null,
      categoryId: categoryId || null
    })

    const savedItem = await newItem.save()

    // Check if this is the first item for this user in this fridge
    if (userId) {
      const itemCount = await FridgeItem.countDocuments({ fridgeId, userId })
      if (itemCount === 1) {
        // This is the first item - create notification
        await createFirstItemNotification(userId, fridgeId, (savedItem._id as mongoose.Types.ObjectId).toString())
      }
    }

    // Check if this item expires tomorrow and create notifications immediately
    const itemExpiryDate = new Date(savedItem.expiryDate)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

    // If item expires tomorrow and is not opened, create notifications
    if (itemExpiryDate >= tomorrow && itemExpiryDate < dayAfterTomorrow && !savedItem.isOpened) {
      try {
        const fridge = await Fridge.findById(fridgeId)
        if (fridge) {
          const itemId = (savedItem._id as mongoose.Types.ObjectId).toString()
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)

          // Create notification for each member, but only if they don't already have one
          for (const memberId of fridge.members) {
            // Check if this specific user already has a notification for this item today
            const existingNotification = await Notification.findOne({
              userId: memberId,
              type: 'item_expiring_tomorrow',
              'metadata.itemId': itemId,
              createdAt: {
                $gte: todayStart
              }
            })

            // Skip if notification already exists for this user today
            if (!existingNotification) {
              await createItemExpiringNotification(
                memberId,
                fridgeId,
                itemId,
                savedItem.name
              )
            }
          }
        }
      } catch (notificationError) {
        // Don't fail the item creation if notification fails
        console.error('Error creating expiring item notification:', notificationError)
      }
    }

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

    // Verify user has an account if userId is provided
    if (userId) {
      const hasAccount = await checkUserHasAccount(userId)
      if (!hasAccount) {
        return res.status(403).json({ message: 'You must have an account to update items. Please sign up first.' })
      }
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
    updateData.categoryId = categoryId || null

    const updatedItem = await FridgeItem.findOneAndUpdate(
      { _id: id, fridgeId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found in fridge' })
    }

    // Check if this item expires tomorrow and create notifications immediately
    const itemExpiryDate = new Date(updatedItem.expiryDate)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

    // If item expires tomorrow and is not opened, create notifications
    if (itemExpiryDate >= tomorrow && itemExpiryDate < dayAfterTomorrow && !updatedItem.isOpened) {
      try {
        const fridge = await Fridge.findById(fridgeId)
        if (fridge) {
          const itemId = (updatedItem._id as mongoose.Types.ObjectId).toString()
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)

          // Create notification for each member, but only if they don't already have one
          for (const memberId of fridge.members) {
            // Check if this specific user already has a notification for this item today
            const existingNotification = await Notification.findOne({
              userId: memberId,
              type: 'item_expiring_tomorrow',
              'metadata.itemId': itemId,
              createdAt: {
                $gte: todayStart
              }
            })

            // Skip if notification already exists for this user today
            if (!existingNotification) {
              await createItemExpiringNotification(
                memberId,
                fridgeId,
                itemId,
                updatedItem.name
              )
            }
          }
        }
      } catch (notificationError) {
        // Don't fail the item update if notification fails
        console.error('Error creating expiring item notification:', notificationError)
      }
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

    // Verify user has an account if userId is provided
    if (userId) {
      const hasAccount = await checkUserHasAccount(userId)
      if (!hasAccount) {
        return res.status(403).json({ message: 'You must have an account to delete items. Please sign up first.' })
      }
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

    // Verify user has an account if userId is provided
    if (userId) {
      const hasAccount = await checkUserHasAccount(userId)
      if (!hasAccount) {
        return res.status(403).json({ message: 'You must have an account to clear fridge. Please sign up first.' })
      }
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

