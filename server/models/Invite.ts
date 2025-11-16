import mongoose, { Schema, Document } from 'mongoose'

export interface IInvite extends Document {
  fridgeId?: mongoose.Types.ObjectId
  fridgeName?: string
  inviterId: string
  inviteeEmail: string
  token: string
  inviteType: 'fridge' | 'account'
  status: 'pending' | 'accepted' | 'expired'
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const InviteSchema: Schema = new Schema(
  {
    fridgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Fridge',
      required: false,
      index: true
    },
    fridgeName: {
      type: String,
      trim: true
    },
    inviterId: {
      type: String,
      required: true
    },
    inviteeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    inviteType: {
      type: String,
      enum: ['fridge', 'account'],
      default: 'fridge'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending'
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
)

InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.model<IInvite>('Invite', InviteSchema)


