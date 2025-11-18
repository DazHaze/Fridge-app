import mongoose, { Schema, Document } from 'mongoose'

export interface IFridgeItem extends Document {
  name: string
  expiryDate: Date
  userId: string
  fridgeId: mongoose.Types.ObjectId | string
  isOpened: boolean
  openedDate?: Date
  categoryId?: mongoose.Types.ObjectId | string
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
  fridgeId: {
    type: Schema.Types.ObjectId,
    ref: 'Fridge',
    index: true,
    default: function (this: IFridgeItem) {
      return this.userId
    }
  },
  isOpened: {
    type: Boolean,
    default: false
  },
  openedDate: {
    type: Date,
    default: null
  },
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.model<IFridgeItem>('FridgeItem', FridgeItemSchema)


