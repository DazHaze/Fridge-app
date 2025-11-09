import mongoose, { Schema, Document } from 'mongoose'

export interface IFridgeItem extends Document {
  name: string
  expiryDate: Date
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
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model<IFridgeItem>('FridgeItem', FridgeItemSchema)


