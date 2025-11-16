import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Fridge from '../models/Fridge.js'
import UserProfile from '../models/UserProfile.js'
import FridgeItem from '../models/FridgeItem.js'
import Invite from '../models/Invite.js'
import User from '../models/User.js'

// Load environment variables
dotenv.config()

const clearAllData = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('MONGODB_URI environment variable is not set')
      process.exit(1)
    }

    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    // Delete all data
    console.log('Clearing all data...')

    // Delete all fridge items
    const itemsResult = await FridgeItem.deleteMany({})
    console.log(`Deleted ${itemsResult.deletedCount} fridge items`)

    // Delete all invites
    const invitesResult = await Invite.deleteMany({})
    console.log(`Deleted ${invitesResult.deletedCount} invites`)

    // Delete all fridges
    const fridgesResult = await Fridge.deleteMany({})
    console.log(`Deleted ${fridgesResult.deletedCount} fridges`)

    // Delete all user profiles
    const profilesResult = await UserProfile.deleteMany({})
    console.log(`Deleted ${profilesResult.deletedCount} user profiles`)

    // Delete all users (email/password accounts)
    const usersResult = await User.deleteMany({})
    console.log(`Deleted ${usersResult.deletedCount} users`)

    console.log('Successfully cleared all data from the database')
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error clearing data:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

clearAllData()

