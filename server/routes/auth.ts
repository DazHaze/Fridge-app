import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import User from '../models/User.js'
import UserProfile from '../models/UserProfile.js'
import Fridge from '../models/Fridge.js'
import { createAccountCreatedNotification } from '../utils/notificationHelper.js'

const router = express.Router()

const ensureMongoConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

const createTransporter = () => {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        : undefined
    })
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    })
  }

  console.warn('No email transport configured. Set SMTP_HOST or GMAIL_USER/GMAIL_APP_PASSWORD environment variables.')
  return null
}

const transporter = createTransporter()

// Check if email exists (for Gmail accounts or regular users)
router.get('/check-email/:email', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { email } = req.params
    const normalizedEmail = email.toLowerCase().trim()

    // Check if email exists in UserProfile (Gmail accounts)
    const profile = await UserProfile.findOne({ email: normalizedEmail })
    if (profile) {
      return res.json({ exists: true, hasGmailAccount: true, message: 'This email is already linked to a Gmail account. Please sign in with Google.' })
    }

    // Check if email exists in User (email/password accounts)
    const user = await User.findOne({ email: normalizedEmail })
    if (user) {
      return res.json({ exists: true, hasGmailAccount: false, isEmailVerified: user.isEmailVerified })
    }

    return res.json({ exists: false })
  } catch (error) {
    console.error('Error checking email:', error)
    res.status(500).json({ message: 'Error checking email', error: String(error) })
  }
})

// Sign up
router.post('/signup', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string }

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered. Please sign in instead.' })
    }

    // Check if email is linked to Gmail account
    const existingGmailProfile = await UserProfile.findOne({ email: normalizedEmail })
    if (existingGmailProfile) {
      return res.status(400).json({ message: 'This email is already linked to a Gmail account. Please sign in with Google.' })
    }

    // Create user
    const user = await User.create({
      email: normalizedEmail,
      password,
      name: name.trim()
    })

    // Generate verification token
    const token = user.generateEmailVerificationToken()
    await user.save()

    // Create user profile first to check for duplicates
    const userIdString = (user._id as mongoose.Types.ObjectId).toString()
    
    // Check if profile already exists (race condition protection)
    let profile = await UserProfile.findOne({ userId: userIdString })
    if (profile) {
      return res.status(400).json({ message: 'Account already exists. Please sign in instead.' })
    }

    // Check if a personal fridge already exists for this user (race condition protection)
    // A personal fridge is one where the user is the ONLY member
    let fridge = await Fridge.findOne({ 
      members: [userIdString]
    })
    
    if (!fridge) {
      // Double-check: maybe user is member of a shared fridge but no personal fridge
      // Only create personal fridge if user has NO fridges at all
      const anyFridge = await Fridge.findOne({ members: userIdString })
      
      if (!anyFridge) {
        // No fridge exists - create personal fridge
        fridge = await Fridge.create({
          members: [userIdString],
          name: `${user.name}'s Fridge`
        })
      } else {
        // User is member of a shared fridge but no personal fridge
        // Use the shared fridge for now (this shouldn't normally happen during signup)
        fridge = anyFridge
      }
    }

    // Create user profile
    profile = await UserProfile.create({
      userId: userIdString,
      email: normalizedEmail,
      name: user.name,
      fridgeId: fridge._id
    })

    // Ensure user is in fridge members (in case fridge existed but user wasn't added)
    if (!fridge.members.includes(userIdString)) {
      fridge.members.push(userIdString)
      await fridge.save()
    }

    // Send verification email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    let finalBaseUrl = baseUrl.replace(/\/+$/, '')
    if (!finalBaseUrl.includes('/Fridge-app') && !finalBaseUrl.includes('/fridge-app')) {
      finalBaseUrl = finalBaseUrl + '/Fridge-app'
    }
    const verificationLink = `${finalBaseUrl}/verify-email?token=${token}`

    if (transporter) {
      const fromAddress = process.env.GMAIL_USER
        ? process.env.GMAIL_USER
        : process.env.MAIL_FROM ||
          process.env.SMTP_USER ||
          'no-reply@bia.app'
      
      try {
        await transporter.sendMail({
          from: `Bia Fridge <${fromAddress}>`,
          to: normalizedEmail,
          subject: 'Verify your Bia Fridge account',
          html: `
            <p>Hi ${user.name},</p>
            <p>Thank you for signing up for Bia Fridge!</p>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="${verificationLink}">${verificationLink}</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          `
        })
      } catch (emailError) {
        console.error('Error sending verification email:', emailError)
        // Still return success, but note email wasn't sent
        return res.status(201).json({
          message: 'Account created but verification email could not be sent. Please check email configuration.',
          userId: userIdString,
          verificationLink
        })
      }
    } else {
      console.info(`Verification link (email not sent): ${verificationLink}`)
    }

    res.status(201).json({
      message: 'Account created successfully. Please check your email to verify your account.',
      userId: userIdString
    })
  } catch (error) {
    console.error('Error creating account:', error)
    if ((error as any).code === 11000) {
      return res.status(400).json({ message: 'Email already registered' })
    }
    res.status(500).json({ message: 'Error creating account', error: String(error) })
  }
})

// Verify email
router.get('/verify-email', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { token } = req.query as { token?: string }

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' })
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpiry: { $gt: new Date() }
    })

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' })
    }

    user.isEmailVerified = true
    user.emailVerificationToken = undefined
    user.emailVerificationTokenExpiry = undefined
    await user.save()

    res.json({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('Error verifying email:', error)
    res.status(500).json({ message: 'Error verifying email', error: String(error) })
  }
})

// Google Signup (create account for Google users)
router.post('/google-signup', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId, email, name, picture } = req.body as { userId?: string; email?: string; name?: string; picture?: string }

    if (!userId || !email || !name) {
      return res.status(400).json({ message: 'userId, email, and name are required' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already has an account
    let profile = await UserProfile.findOne({ userId })
    if (profile) {
      return res.status(400).json({ message: 'Account already exists. Please sign in instead.' })
    }

    // Check if email is already registered with a different account type
    const User = (await import('../models/User.js')).default
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(400).json({ message: 'This email is already registered with an email/password account. Please sign in with your password instead.' })
    }

    // Check if email is already linked to a different Google account
    const existingProfile = await UserProfile.findOne({ email: normalizedEmail })
    if (existingProfile) {
      return res.status(400).json({ message: 'This email is already linked to a Google account. Please sign in with Google instead.' })
    }

    // Check if a personal fridge already exists for this user (race condition protection)
    // A personal fridge is one where the user is the ONLY member
    let fridge = await Fridge.findOne({ 
      members: [userId]
    })
    
    if (!fridge) {
      // Double-check: maybe user is member of a shared fridge but no personal fridge
      // Only create personal fridge if user has NO fridges at all
      const anyFridge = await Fridge.findOne({ members: userId })
      
      if (!anyFridge) {
        // No fridge exists - create personal fridge
        fridge = await Fridge.create({
          members: [userId],
          name: name.trim().toLowerCase().endsWith('s') 
            ? `${name.trim()}' Fridge` 
            : `${name.trim()}'s Fridge`
        })
      } else {
        // User is member of a shared fridge but no personal fridge
        // Use the shared fridge for now (this shouldn't normally happen during signup)
        fridge = anyFridge
      }
    }

    // Create user profile
    profile = await UserProfile.create({
      userId,
      email: normalizedEmail,
      name: name.trim(),
      fridgeId: fridge._id
    })

    // Create account created notification
    await createAccountCreatedNotification(userId)

    res.status(201).json({
      message: 'Google account created successfully',
      userId,
      fridgeId: (fridge._id as mongoose.Types.ObjectId).toString()
    })
  } catch (error) {
    console.error('Error creating Google account:', error)
    if ((error as any).code === 11000) {
      return res.status(400).json({ message: 'Account already exists' })
    }
    res.status(500).json({ message: 'Error creating Google account', error: String(error) })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const normalizedEmail = email.toLowerCase().trim()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email before signing in. Check your inbox for the verification link.' 
      })
    }

    // Get user profile
    const userIdString = (user._id as mongoose.Types.ObjectId).toString()
    const profile = await UserProfile.findOne({ userId: userIdString })
    
    res.json({
      user: {
        sub: userIdString,
        email: user.email,
        name: user.name,
        picture: undefined
      },
      fridgeId: profile?.fridgeId?.toString()
    })
  } catch (error) {
    console.error('Error logging in:', error)
    res.status(500).json({ message: 'Error logging in', error: String(error) })
  }
})

export default router

