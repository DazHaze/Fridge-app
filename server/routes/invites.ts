import express, { Request, Response } from 'express'
import mongoose from 'mongoose'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import Invite from '../models/Invite.js'
import UserProfile from '../models/UserProfile.js'
import Fridge from '../models/Fridge.js'
import FridgeItem from '../models/FridgeItem.js'

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

    const inviterProfile = await UserProfile.findOne({ userId: inviterId })
    if (!inviterProfile) {
      return res.status(404).json({ message: 'Inviter profile not found' })
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
      inviteeEmail: inviteeEmail.toLowerCase(),
      token,
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

    res.status(201).json({ message: 'Invite sent successfully', inviteId: invite._id })
  } catch (error) {
    console.error('Error creating invite:', error)
    res.status(500).json({ message: 'Error creating invite', error: String(error) })
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

    const invite = await Invite.findOne({ token })
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' })
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


