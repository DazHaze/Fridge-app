import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import Invite from '../models/Invite.js'
import UserProfile from '../models/UserProfile.js'
import Fridge from '../models/Fridge.js'
import FridgeItem from '../models/FridgeItem.js'
import { createFridgeInviteNotification } from '../utils/notificationHelper.js'

const router = express.Router()

const ensureMongoConnected = () => {
  if (mongoose.connection.readyState !== 1) {
    return { connected: false, message: 'Database not connected. Please check your MONGODB_URI in .env file' }
  }
  return { connected: true }
}

// Format personal fridge name: "[name]'s" or "[name]'" if name ends with 's'
const formatPersonalFridgeName = (name: string): string => {
  const trimmedName = name.trim()
  if (trimmedName.toLowerCase().endsWith('s')) {
    return `${trimmedName}' Fridge`
  }
  return `${trimmedName}'s Fridge`
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

// Helper function to check if user has an account
const checkUserHasAccount = async (userId: string): Promise<boolean> => {
  const profile = await UserProfile.findOne({ userId })
  if (profile) return true
  
  const User = (await import('../models/User.js')).default
  const user = await User.findById(userId)
  return !!user
}

// Helper function to check if email has an account
const checkEmailHasAccount = async (email: string): Promise<{ hasAccount: boolean; hasGmailAccount?: boolean }> => {
  const normalizedEmail = email.toLowerCase().trim()
  
  // Check if email exists in UserProfile (Gmail accounts)
  const profile = await UserProfile.findOne({ email: normalizedEmail })
  if (profile) {
    return { hasAccount: true, hasGmailAccount: true }
  }

  // Check if email exists in User (email/password accounts)
  const User = (await import('../models/User.js')).default
  const user = await User.findOne({ email: normalizedEmail })
  if (user) {
    return { hasAccount: true, hasGmailAccount: false }
  }

  return { hasAccount: false }
}

// Check if email has an account
router.get('/check-email/:email', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { email } = req.params
    const result = await checkEmailHasAccount(email)
    res.json(result)
  } catch (error) {
    console.error('Error checking email:', error)
    res.status(500).json({ message: 'Error checking email', error: String(error) })
  }
})

// Check if user has an account
router.get('/check-user/:userId', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { userId } = req.params
    const hasAccount = await checkUserHasAccount(userId)
    res.json({ hasAccount })
  } catch (error) {
    console.error('Error checking user:', error)
    res.status(500).json({ message: 'Error checking user', error: String(error) })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { inviterId, inviteeEmail, fridgeName } = req.body as { inviterId?: string; inviteeEmail?: string; fridgeName?: string }

    if (!inviterId || !inviteeEmail) {
      return res.status(400).json({ message: 'inviterId and inviteeEmail are required' })
    }

    // Verify inviter has an account
    const inviterHasAccount = await checkUserHasAccount(inviterId)
    if (!inviterHasAccount) {
      return res.status(403).json({ message: 'You must have an account to send invites' })
    }

    const inviterProfile = await UserProfile.findOne({ userId: inviterId })
    if (!inviterProfile) {
      return res.status(404).json({ message: 'Inviter profile not found' })
    }

    // Check if email has an account
    const normalizedEmail = inviteeEmail.toLowerCase().trim()
    const emailCheck = await checkEmailHasAccount(normalizedEmail)
    
    if (!emailCheck.hasAccount) {
      // Email doesn't have an account - return info so frontend can ask about account creation invite
      return res.status(200).json({ 
        hasAccount: false,
        message: 'This email does not have an account. Would you like to send them an invite to create one?'
      })
    }

    // fridgeName is required when creating a shared fridge
    if (!fridgeName || !fridgeName.trim()) {
      return res.status(400).json({ message: 'fridgeName is required when creating a shared fridge' })
    }

    // Don't create the fridge yet - store the name in the invite
    // The fridge will be created when the invite is accepted
    const token = crypto.randomUUID()
    const expiryHours = Number(process.env.INVITE_EXPIRY_HOURS || 72)
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    const invite = await Invite.create({
      fridgeName: fridgeName.trim(),
      inviterId,
      inviteeEmail: normalizedEmail,
      token,
      inviteType: 'fridge',
      expiresAt
    })

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    // Ensure baseUrl ends with /Fridge-app/ for GitHub Pages
    // If FRONTEND_URL doesn't include the base path, append it
    let finalBaseUrl = baseUrl.replace(/\/+$/, '')
    if (!finalBaseUrl.includes('/Fridge-app') && !finalBaseUrl.includes('/fridge-app')) {
      finalBaseUrl = finalBaseUrl + '/Fridge-app'
    }
    const acceptLink = `${finalBaseUrl}/invite/accept?token=${token}`

    if (transporter) {
      // For Gmail, the "from" address must match the authenticated account
      // For SMTP, use the inviter's email or configured address
      const fromAddress = process.env.GMAIL_USER
        ? process.env.GMAIL_USER
        : inviterProfile.email ||
          process.env.MAIL_FROM ||
          process.env.SMTP_USER ||
          'no-reply@bia.app'
      
      const fromName = inviterProfile.name || 'Bia Fridge'
      const displayFrom = process.env.GMAIL_USER
        ? `${fromName} <${fromAddress}>`
        : fromAddress
      
      try {
        const fridgeDisplayName = invite.fridgeName || 'a shared fridge'
        await transporter.sendMail({
          from: displayFrom,
          to: inviteeEmail,
          subject: 'Bia Fridge Invitation',
          html: `
            <p>You have been invited to share "${fridgeDisplayName}" on Bia by ${inviterProfile.name || 'a user'}.</p>
            <p>Click the link below to join:</p>
            <p><a href="${acceptLink}">${acceptLink}</a></p>
            <p>This invitation will expire in ${expiryHours} hours.</p>
          `
        })
      } catch (emailError) {
        console.error('Error sending invite email:', emailError)
        // If email fails, keep invite but notify client
        return res.status(201).json({
          message: 'Invite created but email could not be sent. Please check email configuration.',
          inviteId: invite._id,
          acceptLink
        })
      }
    } else {
      console.info(`Invite link (email not sent): ${acceptLink}`)
    }

    // Create notification for invitee if they have an account
    if (emailCheck.hasAccount) {
      // Find the invitee's user profile to get their userId
      const inviteeProfile = await UserProfile.findOne({ email: normalizedEmail })
      if (inviteeProfile) {
        await createFridgeInviteNotification(
          inviteeProfile.userId,
          (invite._id as mongoose.Types.ObjectId).toString(),
          token,
          fridgeName.trim(),
          inviterProfile.name || 'Someone'
        )
      }
    }

    res.status(201).json({ message: 'Invite sent successfully', inviteId: invite._id })
  } catch (error) {
    console.error('Error creating invite:', error)
    res.status(500).json({ message: 'Error creating invite', error: String(error) })
  }
})

// Create account creation invite
router.post('/account-invite', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { inviterId, inviteeEmail, fridgeName } = req.body as { inviterId?: string; inviteeEmail?: string; fridgeName?: string }

    if (!inviterId || !inviteeEmail) {
      return res.status(400).json({ message: 'inviterId and inviteeEmail are required' })
    }

    // Verify inviter has an account
    const inviterHasAccount = await checkUserHasAccount(inviterId)
    if (!inviterHasAccount) {
      return res.status(403).json({ message: 'You must have an account to send invites' })
    }

    const inviterProfile = await UserProfile.findOne({ userId: inviterId })
    if (!inviterProfile) {
      return res.status(404).json({ message: 'Inviter profile not found' })
    }

    // Check if email already has an account
    const normalizedEmail = inviteeEmail.toLowerCase().trim()
    const emailCheck = await checkEmailHasAccount(normalizedEmail)
    
    if (emailCheck.hasAccount) {
      return res.status(400).json({ message: 'This email already has an account' })
    }

    // Create account creation invite
    const token = crypto.randomUUID()
    const expiryHours = Number(process.env.INVITE_EXPIRY_HOURS || 72)
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)

    const invite = await Invite.create({
      fridgeName: fridgeName?.trim(),
      inviterId,
      inviteeEmail: normalizedEmail,
      token,
      inviteType: 'account',
      expiresAt
    })

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    let finalBaseUrl = baseUrl.replace(/\/+$/, '')
    if (!finalBaseUrl.includes('/Fridge-app') && !finalBaseUrl.includes('/fridge-app')) {
      finalBaseUrl = finalBaseUrl + '/Fridge-app'
    }
    const signupLink = `${finalBaseUrl}/login?signup=true&inviteToken=${token}`

    if (transporter) {
      const fromAddress = process.env.GMAIL_USER
        ? process.env.GMAIL_USER
        : inviterProfile.email ||
          process.env.MAIL_FROM ||
          process.env.SMTP_USER ||
          'no-reply@bia.app'
      
      const fromName = inviterProfile.name || 'Bia Fridge'
      const displayFrom = process.env.GMAIL_USER
        ? `${fromName} <${fromAddress}>`
        : fromAddress
      
      try {
        await transporter.sendMail({
          from: displayFrom,
          to: normalizedEmail,
          subject: 'Join Bia Fridge',
          html: `
            <p>Hi there!</p>
            <p>${inviterProfile.name || 'Someone'} has invited you to join Bia Fridge${fridgeName ? ` and share "${fridgeName}"` : ''}.</p>
            <p>To get started, please create an account by clicking the link below:</p>
            <p><a href="${signupLink}">${signupLink}</a></p>
            <p>This invitation will expire in ${expiryHours} hours.</p>
          `
        })
      } catch (emailError) {
        console.error('Error sending account invite email:', emailError)
        return res.status(201).json({
          message: 'Account invite created but email could not be sent. Please check email configuration.',
          inviteId: invite._id,
          signupLink
        })
      }
    } else {
      console.info(`Account invite link (email not sent): ${signupLink}`)
    }

    res.status(201).json({ message: 'Account invite sent successfully', inviteId: invite._id })
  } catch (error) {
    console.error('Error creating account invite:', error)
    res.status(500).json({ message: 'Error creating account invite', error: String(error) })
  }
})

// Get invite info (for pre-filling email in signup form)
router.get('/info/:token', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { token } = req.params
    const invite = await Invite.findOne({ token })
    
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' })
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      return res.status(410).json({ message: 'Invite has expired' })
    }

    res.json({
      email: invite.inviteeEmail,
      inviteType: invite.inviteType,
      fridgeName: invite.fridgeName
    })
  } catch (error) {
    console.error('Error fetching invite info:', error)
    res.status(500).json({ message: 'Error fetching invite info', error: String(error) })
  }
})

// Accept account creation invite (called after user signs up)
router.post('/accept-account-invite', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { token, userId, email, name } = req.body as { token?: string; userId?: string; email?: string; name?: string }

    if (!token || !userId) {
      return res.status(400).json({ message: 'token and userId are required' })
    }

    // Verify user has an account
    const userHasAccount = await checkUserHasAccount(userId)
    if (!userHasAccount) {
      return res.status(403).json({ message: 'Account not found. Please complete signup first.' })
    }

    const invite = await Invite.findOne({ token, inviteType: 'account' })
    if (!invite) {
      return res.status(404).json({ message: 'Account invite not found' })
    }

    if (invite.status === 'accepted') {
      return res.json({ message: 'Account invite already accepted' })
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = 'expired'
      await invite.save()
      return res.status(410).json({ message: 'Account invite has expired' })
    }

    // Verify email matches
    if (invite.inviteeEmail.toLowerCase() !== email?.toLowerCase()) {
      return res.status(400).json({ message: 'Email does not match the invite' })
    }

    // If there's a fridgeName, create a fridge invite for the user
    if (invite.fridgeName) {
      const inviterProfile = await UserProfile.findOne({ userId: invite.inviterId })
      if (!inviterProfile) {
        return res.status(404).json({ message: 'Inviter profile not found' })
      }

      const inviterPersonalFridgeId = inviterProfile.fridgeId

      // Create the shared fridge
      const fridge = await Fridge.create({
        members: [invite.inviterId, userId],
        name: invite.fridgeName.trim()
      })

      // Move inviter's items from their personal fridge to the new shared fridge
      await FridgeItem.updateMany(
        { fridgeId: inviterPersonalFridgeId },
        { fridgeId: fridge._id }
      )

      // Update inviter's profile to point to the new shared fridge
      inviterProfile.fridgeId = fridge._id as mongoose.Types.ObjectId
      await inviterProfile.save()

      // Update user's profile to point to the shared fridge
      const userProfile = await UserProfile.findOne({ userId })
      if (userProfile) {
        userProfile.fridgeId = fridge._id as mongoose.Types.ObjectId
        await userProfile.save()
      }

      // Mark account invite as accepted
      invite.status = 'accepted'
      invite.fridgeId = fridge._id as mongoose.Types.ObjectId
      await invite.save()

      return res.json({
        message: 'Account invite accepted and shared fridge created successfully',
        fridgeId: (fridge._id as mongoose.Types.ObjectId).toString()
      })
    }

    // No fridge name - just mark invite as accepted
    invite.status = 'accepted'
    await invite.save()

    res.json({
      message: 'Account invite accepted successfully'
    })
  } catch (error) {
    console.error('Error accepting account invite:', error)
    res.status(500).json({ message: 'Error accepting account invite', error: String(error) })
  }
})

router.post('/accept', async (req: Request, res: Response) => {
  const connectionCheck = ensureMongoConnected()
  if (!connectionCheck.connected) {
    return res.status(503).json({ message: connectionCheck.message })
  }

  try {
    const { token, userId, email, name } = req.body as { token?: string; userId?: string; email?: string; name?: string }

    if (!token || !userId) {
      return res.status(400).json({ message: 'token and userId are required' })
    }

    // Verify user has an account
    const userHasAccount = await checkUserHasAccount(userId)
    if (!userHasAccount) {
      return res.status(403).json({ message: 'You must have an account to accept invites. Please sign up first.' })
    }

    const invite = await Invite.findOne({ token, inviteType: 'fridge' })
    if (!invite) {
      return res.status(404).json({ message: 'Fridge invite not found' })
    }

    if (invite.status === 'accepted') {
      const fridgeId = invite.fridgeId ? invite.fridgeId.toString() : null
      return res.json({ message: 'Invite already accepted', fridgeId })
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      invite.status = 'expired'
      await invite.save()
      return res.status(410).json({ message: 'Invite has expired' })
    }

    // Check if fridge already exists (for backward compatibility with old invites)
    let fridge = invite.fridgeId ? await Fridge.findById(invite.fridgeId) : null
    
    // If fridge doesn't exist yet, create it now with the stored name
    if (!fridge) {
      if (!invite.fridgeName) {
        return res.status(400).json({ message: 'Fridge name not found in invite' })
      }

      const inviterProfile = await UserProfile.findOne({ userId: invite.inviterId })
      if (!inviterProfile) {
        return res.status(404).json({ message: 'Inviter profile not found' })
      }

      // Create the shared fridge with the stored name
      // Both inviter and invitee will be members, but they keep their personal fridges
      fridge = await Fridge.create({
        members: [invite.inviterId, userId],
        name: invite.fridgeName.trim()
      })

      // Update invite with the created fridge ID
      invite.fridgeId = fridge._id as mongoose.Types.ObjectId
    } else {
      // Fridge already exists (old invite format), just add the user as a member
      if (!fridge.members.includes(userId)) {
        fridge.members.push(userId)
        await fridge.save()
      }
    }

    const fridgeId = fridge._id as mongoose.Types.ObjectId

    let profile = await UserProfile.findOne({ userId })
    const originalFridgeId = profile?.fridgeId

    if (!profile) {
      // New user - create profile with a personal fridge
      const personalFridge = await Fridge.create({
        members: [userId],
        name: name ? formatPersonalFridgeName(name) : undefined
      })
      profile = await UserProfile.create({
        userId,
        email,
        name,
        fridgeId: personalFridge._id as mongoose.Types.ObjectId
      })
    } else {
      // Existing user - update email/name if provided, but keep their personal fridge
      if (email) {
        profile.email = email
      }
      if (name) {
        profile.name = name
      }
      await profile.save()
    }

    invite.status = 'accepted'
    await invite.save()

    res.json({
      message: 'Invite accepted successfully',
      fridgeId: fridgeId.toString()
    })
  } catch (error) {
    console.error('Error accepting invite:', error)
    res.status(500).json({ message: 'Error accepting invite', error: String(error) })
  }
})

export default router


