import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import Fridge from '../models/Fridge.js'
import UserProfile from '../models/UserProfile.js'
import FridgeItem from '../models/FridgeItem.js'

const router = express.Router()

const ensureMongoConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

// Format personal fridge name: "[name]'s" or "[name]'" if name ends with 's'
const formatPersonalFridgeName = (name: string): string => {
  const trimmedName = name.trim()
  if (trimmedName.toLowerCase().endsWith('s')) {
    return `${trimmedName}' Fridge`
  }
  return `${trimmedName}'s Fridge`
}

// Helper function to check if user has an account
const checkUserHasAccount = async (userId: string): Promise<boolean> => {
  const profile = await UserProfile.findOne({ userId })
  if (profile) return true
  
  const User = (await import('../models/User.js')).default
  const user = await User.findById(userId)
  return !!user
}

router.post('/ensure', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId, email, name } = req.body as { userId?: string; email?: string; name?: string }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    // Check if user has an account (either Gmail or email/password)
    const hasAccount = await checkUserHasAccount(userId)
    if (!hasAccount && email) {
      // User doesn't have account but provided email - check if email exists
      const normalizedEmail = email.toLowerCase().trim()
      const profile = await UserProfile.findOne({ email: normalizedEmail })
      const User = (await import('../models/User.js')).default
      const user = await User.findOne({ email: normalizedEmail })
      
      if (!profile && !user) {
        return res.status(403).json({ 
          message: 'Account not found. Please sign up first.',
          needsSignup: true
        })
      }
    }

    let profile = await UserProfile.findOne({ userId })

    if (!profile) {
      // Check if a personal fridge already exists for this user (race condition protection)
      // A personal fridge is one where the user is the ONLY member
      const existingPersonalFridge = await Fridge.findOne({ 
        members: [userId]
      })
      
      if (existingPersonalFridge) {
        // Personal fridge exists but profile doesn't - create profile with existing fridge
        profile = await UserProfile.create({
          userId,
          email,
          name,
          fridgeId: existingPersonalFridge._id
        })
      } else {
        // Double-check: maybe there's a fridge with this user as a member (could be shared fridge)
        // But we only want to create a personal fridge if NO fridge exists for this user
        const anyFridge = await Fridge.findOne({ members: userId })
        
        if (anyFridge) {
          // A fridge exists (could be shared), but user doesn't have a profile
          // This shouldn't happen normally, but create profile pointing to this fridge
          profile = await UserProfile.create({
            userId,
            email,
            name,
            fridgeId: anyFridge._id
          })
        } else {
          // No fridge exists at all - create both personal fridge and profile
          const fridge = await Fridge.create({
            members: [userId],
            name: name ? formatPersonalFridgeName(name) : undefined
          })

          profile = await UserProfile.create({
            userId,
            email,
            name,
            fridgeId: fridge._id
          })
        }
      }
    } else {
      const updates: Partial<{ email: string; name: string }> = {}
      if (email && email !== profile.email) {
        updates.email = email
      }
      if (name && name !== profile.name) {
        updates.name = name
      }
      if (Object.keys(updates).length > 0) {
        profile.set(updates)
        await profile.save()
      }
    }

    const fridge = await Fridge.findById(profile.fridgeId)
    if (!fridge) {
      return res.status(404).json({ message: 'Fridge not found for user profile' })
    }

    const fridgeId = fridge._id as mongoose.Types.ObjectId

    // Ensure the user is listed as a member
    if (!fridge.members.includes(userId)) {
      fridge.members.push(userId)
      await fridge.save()

      // Update any existing fridge items to use the fridgeId
      await FridgeItem.updateMany(
        { userId, fridgeId: { $ne: fridgeId } },
        { fridgeId: fridgeId }
      )
    }

    res.json({
      fridgeId: fridgeId.toString(),
      members: fridge.members
    })
  } catch (error) {
    console.error('Error ensuring fridge:', error)
    res.status(500).json({ message: 'Error ensuring fridge', error: String(error) })
  }
})

router.get('/user/:userId', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    // Find all fridges where the user is a member
    const fridges = await Fridge.find({ members: userId }).select('_id name members createdAt').sort({ createdAt: -1 })

    // Get user's profile to identify their personal fridge
    const profile = await UserProfile.findOne({ userId })
    const personalFridgeId = profile?.fridgeId?.toString()

    // Format response with personal fridge marked
    const formattedFridges = fridges.map(fridge => {
      const fridgeId = fridge._id as mongoose.Types.ObjectId
      return {
        fridgeId: fridgeId.toString(),
        name: fridge.name || 'Shared Fridge',
        members: fridge.members,
        isPersonal: fridgeId.toString() === personalFridgeId,
        createdAt: fridge.createdAt
      }
    })

    // Sort to ensure personal fridge comes first
    formattedFridges.sort((a, b) => {
      if (a.isPersonal && !b.isPersonal) return -1
      if (!a.isPersonal && b.isPersonal) return 1
      return 0
    })

    // Set cache-control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    res.json({ fridges: formattedFridges })
  } catch (error) {
    console.error('Error fetching user fridges:', error)
    res.status(500).json({ message: 'Error fetching user fridges', error: String(error) })
  }
})

// Update fridge name
router.put('/:fridgeId/name', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { fridgeId } = req.params
    const { name, userId } = req.body as { name?: string; userId?: string }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Fridge name is required' })
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    // Find the fridge
    const fridge = await Fridge.findById(fridgeId)
    if (!fridge) {
      return res.status(404).json({ message: 'Fridge not found' })
    }

    // Verify user is a member
    if (!fridge.members.includes(userId)) {
      return res.status(403).json({ message: 'You are not a member of this fridge' })
    }

    // Update the fridge name
    fridge.name = name.trim()
    await fridge.save()

    res.json({ 
      message: 'Fridge name updated successfully',
      fridge: {
        fridgeId: (fridge._id as mongoose.Types.ObjectId).toString(),
        name: fridge.name,
        members: fridge.members
      }
    })
  } catch (error) {
    console.error('Error updating fridge name:', error)
    res.status(500).json({ message: 'Error updating fridge name', error: String(error) })
  }
})

export default router


