import mongoose, { Schema, Document } from 'mongoose'

export interface IFridge extends Document {
  name?: string
  members: string[]
  createdAt: Date
  updatedAt: Date
}

const FridgeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      trim: true
    },
    members: {
      type: [String],
      required: true,
      index: true,
      default: []
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model<IFridge>('Fridge', FridgeSchema)


