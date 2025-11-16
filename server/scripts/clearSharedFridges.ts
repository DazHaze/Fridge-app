import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Fridge from '../models/Fridge.js'
import UserProfile from '../models/UserProfile.js'
import FridgeItem from '../models/FridgeItem.js'
import Invite from '../models/Invite.js'

// Load environment variables
dotenv.config()

const clearSharedFridges = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('MONGODB_URI environment variable is not set')
      process.exit(1)
    }

    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    // Get all personal fridge IDs from UserProfile
    const profiles = await UserProfile.find({})
    const personalFridgeIds = profiles.map(profile => profile.fridgeId.toString())
    console.log(`Found ${personalFridgeIds.length} personal fridges`)

    // Find all fridges that are NOT personal fridges
    const allFridges = await Fridge.find({})
    const sharedFridges = allFridges.filter(
      fridge => !personalFridgeIds.includes((fridge._id as mongoose.Types.ObjectId).toString())
    )

    console.log(`Found ${sharedFridges.length} shared fridges to delete`)

    if (sharedFridges.length === 0) {
      console.log('No shared fridges to delete')
      await mongoose.disconnect()
      return
    }

    // Delete associated data
    for (const fridge of sharedFridges) {
      const fridgeId = fridge._id as mongoose.Types.ObjectId

      // Delete fridge items
      const itemsResult = await FridgeItem.deleteMany({ fridgeId })
      console.log(`Deleted ${itemsResult.deletedCount} items from fridge ${fridgeId}`)

      // Delete invites
      const invitesResult = await Invite.deleteMany({ fridgeId })
      console.log(`Deleted ${invitesResult.deletedCount} invites for fridge ${fridgeId}`)

      // Delete the fridge
      await Fridge.deleteOne({ _id: fridgeId })
      console.log(`Deleted fridge ${fridgeId} (name: ${fridge.name || 'unnamed'})`)
    }

    console.log(`Successfully deleted ${sharedFridges.length} shared fridges`)
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error clearing shared fridges:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

clearSharedFridges()

