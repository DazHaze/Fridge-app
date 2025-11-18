import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import Category from '../models/Category.js'
import Fridge from '../models/Fridge.js'
import UserProfile from '../models/UserProfile.js'

const router = express.Router()

const checkConnection = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

const resolveFridgeContext = async (userId: string | undefined, fridgeId: string | undefined): Promise<string> => {
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

// Get all categories for a fridge
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

    const categories = await Category.find({ fridgeId }).sort({ name: 1 })
    res.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({ message: 'Error fetching categories', error: String(error) })
  }
})

// Create a new category
router.post('/', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { name, fridgeId: fridgeIdInput, userId, color } = req.body as {
      name?: string
      fridgeId?: string
      userId?: string
      color?: string
    }

    if (!name || (!userId && !fridgeIdInput)) {
      return res.status(400).json({ message: 'Name and userId or fridgeId are required' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ fridgeId, name: name.trim() })
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' })
    }

    const newCategory = new Category({
      name: name.trim(),
      fridgeId,
      color: color || '#6200ee'
    })

    const savedCategory = await newCategory.save()
    res.status(201).json(savedCategory)
  } catch (error) {
    if ((error as any).code === 11000) {
      return res.status(400).json({ message: 'Category with this name already exists' })
    }
    console.error('Error creating category:', error)
    res.status(500).json({ message: 'Error creating category', error: String(error) })
  }
})

// Update a category
router.put('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const { name, userId, fridgeId: fridgeIdInput, color } = req.body as {
      name?: string
      userId?: string
      fridgeId?: string
      color?: string
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdInput)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name) updateData.name = name.trim()
    if (color) updateData.color = color

    const updatedCategory = await Category.findOneAndUpdate(
      { _id: id, fridgeId },
      updateData,
      { new: true, runValidators: true }
    )

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found in fridge' })
    }

    res.json(updatedCategory)
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({ message: 'Error updating category', error: String(error) })
  }
})

// Delete a category
router.delete('/:id', async (req: Request, res: Response) => {
  const connectionCheck = checkConnection()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { id } = req.params
    const userId = req.query.userId as string | undefined
    const fridgeIdParam = req.query.fridgeId as string | undefined

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid category ID format' })
    }

    const fridgeId = await resolveFridgeContext(userId, fridgeIdParam)

    if (userId) {
      try {
        await ensureMembership(userId, fridgeId)
      } catch (membershipError) {
        return res.status(403).json({ message: (membershipError as Error).message })
      }
    }

    const deletedCategory = await Category.findOneAndDelete({ _id: id, fridgeId })

    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found in fridge' })
    }

    // Remove category from all items that use it
    const FridgeItem = (await import('../models/FridgeItem.js')).default
    await FridgeItem.updateMany(
      { fridgeId, categoryId: id },
      { $unset: { categoryId: '' } }
    )

    res.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({ message: 'Error deleting category', error: String(error) })
  }
})

export default router

