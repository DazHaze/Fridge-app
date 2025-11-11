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

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      // For development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true)
      } else {
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

