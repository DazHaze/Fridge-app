import mongoose, { Schema, Document } from 'mongoose'

export interface ICategory extends Document {
  name: string
  fridgeId: mongoose.Types.ObjectId | string
  color?: string
  createdAt: Date
  updatedAt: Date
}

const CategorySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Fridge',
      required: true,
      index: true
    },
    color: {
      type: String,
      default: '#6200ee' // Material Design Purple
    }
  },
  {
    timestamps: true
  }
)

// Ensure unique category names per fridge
CategorySchema.index({ fridgeId: 1, name: 1 }, { unique: true })

export default mongoose.model<ICategory>('Category', CategorySchema)

