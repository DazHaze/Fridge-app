import mongoose, { Schema, Document } from 'mongoose'

export interface IFridgeItem extends Document {
  name: string
  expiryDate: Date
  userId: string
  isOpened: boolean
  openedDate?: Date
  createdAt: Date
}

const FridgeItemSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  isOpened: {
    type: Boolean,
    default: false
  },
  openedDate: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model<IFridgeItem>('FridgeItem', FridgeItemSchema)


