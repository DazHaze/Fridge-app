import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fridgeItemRoutes from './routes/fridgeItems.js'
import fridgeRoutes from './routes/fridges.js'
import inviteRoutes from './routes/invites.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
// CORS configuration - allow GitHub Pages and local development
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.GITHUB_PAGES_URL
].filter(Boolean) // Remove undefined values

// Extract base domain from FRONTEND_URL (e.g., https://dazhaze.github.io/Fridge-app -> https://dazhaze.github.io)
if (process.env.FRONTEND_URL) {
  try {
    const url = new URL(process.env.FRONTEND_URL)
    const baseOrigin = `${url.protocol}//${url.host}`
    if (!allowedOrigins.includes(baseOrigin)) {
      allowedOrigins.push(baseOrigin)
    }
  } catch (e) {
    // Invalid URL, skip
  }
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    // Check if origin matches any allowed origin
    const isAllowed = allowedOrigins.some(allowed => {
      if (!allowed) return false
      // Exact match
      if (origin === allowed) return true
      // Check if origin is the base domain of an allowed URL
      try {
        const originUrl = new URL(origin)
        const allowedUrl = new URL(allowed)
        return originUrl.origin === allowedUrl.origin
      } catch {
        return false
      }
    })
    
    if (allowedOrigins.length === 0 || isAllowed) {
      callback(null, true)
    } else {
      // For development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true)
      } else {
        console.log(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`)
        callback(new Error('Not allowed by CORS'))
      }
    }
  },
  credentials: true
}))
app.use(express.json())

// Routes
app.use('/api/fridge-items', fridgeItemRoutes)
app.use('/api/fridges', fridgeRoutes)
app.use('/api/invites', inviteRoutes)

// MongoDB connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not set in .env file')
      console.log('Server will start but database operations will fail')
      return
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI)
    console.log(`MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    console.log('Server will start but database operations will fail')
    console.log('Please check your MONGODB_URI in .env file')
  }
}

// Start server regardless of MongoDB connection
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`API available at http://localhost:${PORT}/api/fridge-items`)
})

// Connect to database
connectDB()

export default app

