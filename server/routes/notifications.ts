import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import Notification from '../models/Notification.js'
import FridgeItem from '../models/FridgeItem.js'
import UserProfile from '../models/UserProfile.js'
import Invite from '../models/Invite.js'
import { createItemExpiringNotification, createFridgeInviteNotification } from '../utils/notificationHelper.js'

const router = express.Router()

const ensureMongoConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

// Get all notifications for a user (including pending invites)
router.get('/user/:userId', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId } = req.params
    const { read } = req.query

    const query: any = { userId }
    if (read !== undefined) {
      query.read = read === 'true'
    }

    // Get stored notifications
    const storedNotifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(100)

    // Get user profile to find their email
    const userProfile = await UserProfile.findOne({ userId })
    if (!userProfile) {
      return res.json({ notifications: storedNotifications })
    }

    // Get pending fridge invites for this user
    const pendingInvites = await Invite.find({
      inviteeEmail: userProfile.email?.toLowerCase(),
      inviteType: 'fridge',
      status: { $ne: 'accepted' },
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 })

    // Convert invites to notification format and merge with stored notifications
    const inviteNotifications = await Promise.all(
      pendingInvites.map(async (invite) => {
        // Check if notification already exists for this invite
        const existing = await Notification.findOne({
          userId,
          type: 'fridge_invite',
          'metadata.inviteToken': invite.token
        })

        if (existing) {
          return existing.toObject()
        }

        // Get inviter profile
        const inviterProfile = await UserProfile.findOne({ userId: invite.inviterId })
        
        return {
          _id: `invite_${invite._id}`,
          userId,
          type: 'fridge_invite' as const,
          title: `Invitation to "${invite.fridgeName}"`,
          message: `${inviterProfile?.name || 'Someone'} invited you to join "${invite.fridgeName}". Click to accept!`,
          read: false,
          metadata: {
            inviteId: (invite._id as mongoose.Types.ObjectId).toString(),
            inviteToken: invite.token
          },
          createdAt: invite.createdAt,
          updatedAt: invite.updatedAt
        }
      })
    )

    // Merge and deduplicate
    const allNotifications = [...storedNotifications.map(n => n.toObject()), ...inviteNotifications]
    const uniqueNotifications = allNotifications.filter((notification, index, self) =>
      index === self.findIndex((n) => {
        const notificationId = typeof notification._id === 'string' ? notification._id : (notification._id as mongoose.Types.ObjectId).toString()
        const nId = typeof n._id === 'string' ? n._id : (n._id as mongoose.Types.ObjectId).toString()
        if (notificationId.startsWith('invite_')) {
          return n.metadata?.inviteToken === notification.metadata?.inviteToken
        }
        return nId === notificationId
      })
    )

    // Sort by creation date
    uniqueNotifications.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateB - dateA
    })

    res.json({ notifications: uniqueNotifications.slice(0, 100) })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    res.status(500).json({ message: 'Error fetching notifications', error: String(error) })
  }
})

// Get unread count (including pending invites)
router.get('/user/:userId/unread-count', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId } = req.params
    
    // Count unread stored notifications
    const notificationCount = await Notification.countDocuments({ userId, read: false })
    
    // Get user profile to find their email
    const userProfile = await UserProfile.findOne({ userId })
    let inviteCount = 0
    
    if (userProfile?.email) {
      // Count pending invites
      inviteCount = await Invite.countDocuments({
        inviteeEmail: userProfile.email.toLowerCase(),
        inviteType: 'fridge',
        status: { $ne: 'accepted' },
        expiresAt: { $gt: new Date() }
      })
    }
    
    res.json({ count: notificationCount + inviteCount })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ message: 'Error fetching unread count', error: String(error) })
  }
})

// Check for expiring items and create notifications
router.post('/check-expiring-items', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)

    // Find items expiring tomorrow (not opened)
    const expiringItems = await FridgeItem.find({
      expiryDate: {
        $gte: tomorrow,
        $lt: dayAfterTomorrow
      },
      isOpened: { $ne: true }
    })

    let notificationsCreated = 0

    for (const item of expiringItems) {
      // Get all members of the fridge
      const fridge = await mongoose.model('Fridge').findById(item.fridgeId)
      if (!fridge) continue

      // Check if notification already exists for this item
      const existingNotification = await Notification.findOne({
        userId: { $in: fridge.members },
        type: 'item_expiring_tomorrow',
        'metadata.itemId': (item._id as mongoose.Types.ObjectId).toString(),
        createdAt: {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
        }
      })

      if (existingNotification) continue

      // Create notification for each member
      for (const memberId of fridge.members) {
        await createItemExpiringNotification(
          memberId,
          (item.fridgeId as mongoose.Types.ObjectId).toString(),
          (item._id as mongoose.Types.ObjectId).toString(),
          item.name
        )
        notificationsCreated++
      }
    }

    res.json({ 
      message: 'Expiring items checked',
      notificationsCreated,
      itemsChecked: expiringItems.length
    })
  } catch (error) {
    console.error('Error checking expiring items:', error)
    res.status(500).json({ message: 'Error checking expiring items', error: String(error) })
  }
})

// Mark notification as read
router.patch('/:notificationId/read', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { notificationId } = req.params
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    res.json({ notification })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ message: 'Error marking notification as read', error: String(error) })
  }
})

// Mark all notifications as read
router.patch('/user/:userId/read-all', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId } = req.params
    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    )

    res.json({ updatedCount: result.modifiedCount })
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    res.status(500).json({ message: 'Error marking all notifications as read', error: String(error) })
  }
})

// Delete notification
router.delete('/:notificationId', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { notificationId } = req.params
    const notification = await Notification.findByIdAndDelete(notificationId)

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' })
    }

    res.json({ message: 'Notification deleted successfully' })
  } catch (error) {
    console.error('Error deleting notification:', error)
    res.status(500).json({ message: 'Error deleting notification', error: String(error) })
  }
})

export default router
