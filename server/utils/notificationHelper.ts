import Notification from '../models/Notification.js'

export interface CreateNotificationParams {
  userId: string
  type: 'account_created' | 'first_item_added' | 'item_expiring_tomorrow' | 'fridge_invite'
  title: string
  message: string
  metadata?: {
    fridgeId?: string
    itemId?: string
    inviteId?: string
    inviteToken?: string
  }
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const notification = await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || {},
      read: false
    })
    return notification
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

// Helper to create account created notification
export const createAccountCreatedNotification = async (userId: string) => {
  const now = new Date()
  const formattedDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  const formattedTime = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })

  return createNotification({
    userId,
    type: 'account_created',
    title: 'Welcome to Bia!',
    message: `Your account was created on ${formattedDate} at ${formattedTime}. Start adding items to your fridge!`,
  })
}

// Helper to create first item added notification
export const createFirstItemNotification = async (userId: string, fridgeId: string, itemId: string) => {
  return createNotification({
    userId,
    type: 'first_item_added',
    title: 'First Item Added! 🎉',
    message: 'Congratulations! You\'ve added your first item to your fridge.',
    metadata: {
      fridgeId,
      itemId
    }
  })
}

// Helper to create item expiring tomorrow notification
export const createItemExpiringNotification = async (
  userId: string, 
  fridgeId: string, 
  itemId: string, 
  itemName: string
) => {
  return createNotification({
    userId,
    type: 'item_expiring_tomorrow',
    title: `"${itemName}" expires tomorrow`,
    message: `Don't forget! "${itemName}" expires tomorrow. Consider using it soon!`,
    metadata: {
      fridgeId,
      itemId
    }
  })
}

// Helper to create fridge invite notification
export const createFridgeInviteNotification = async (
  userId: string,
  inviteId: string,
  inviteToken: string,
  fridgeName: string,
  inviterName: string
) => {
  return createNotification({
    userId,
    type: 'fridge_invite',
    title: `Invitation to "${fridgeName}"`,
    message: `${inviterName} invited you to join "${fridgeName}". Click to accept!`,
    metadata: {
      inviteId,
      inviteToken
    }
  })
}

