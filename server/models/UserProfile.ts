import mongoose, { Schema, Document } from 'mongoose'

export interface IUserProfile extends Document {
  userId: string
  email?: string
  name?: string
  fridgeId: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const UserProfileSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      trim: true
    },
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Fridge',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.model<IUserProfile>('UserProfile', UserProfileSchema)


