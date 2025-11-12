import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export interface IUser extends Document {
  email: string
  password: string
  name: string
  isEmailVerified: boolean
  emailVerificationToken?: string
  emailVerificationTokenExpiry?: Date
  passwordResetToken?: string
  passwordResetTokenExpiry?: Date
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
  generateEmailVerificationToken(): string
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String
    },
    emailVerificationTokenExpiry: {
      type: Date
    },
    passwordResetToken: {
      type: String
    },
    passwordResetTokenExpiry: {
      type: Date
    }
  },
  {
    timestamps: true
  }
)

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next()
  }
  
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function (): string {
  const token = crypto.randomBytes(32).toString('hex')
  this.emailVerificationToken = token
  this.emailVerificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  return token
}

export default mongoose.model<IUser>('User', UserSchema)

