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

    let profile = await UserProfile.findOne({ userId })

    if (!profile) {
      const fridge = await Fridge.create({
        members: [userId],
        name: name ? `${name}'s Fridge` : undefined
      })

      profile = await UserProfile.create({
        userId,
        email,
        name,
        fridgeId: fridge._id
      })
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

export default router


