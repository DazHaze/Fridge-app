import mongoose, { Schema, Document } from 'mongoose'

export interface INotification extends Document {
  userId: string
  type: 'account_created' | 'first_item_added' | 'item_expiring_tomorrow' | 'fridge_invite'
  title: string
  message: string
  read: boolean
  metadata?: {
    fridgeId?: string
    itemId?: string
    inviteId?: string
    inviteToken?: string
  }
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: ['account_created', 'first_item_added', 'item_expiring_tomorrow', 'fridge_invite'],
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    metadata: {
      fridgeId: String,
      itemId: String,
      inviteId: String,
      inviteToken: String
    }
  },
  {
    timestamps: true
  }
)

// Index for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })

export default mongoose.model<INotification>('Notification', NotificationSchema)

