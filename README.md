# Fridge App

A React app for managing fridge items with MongoDB Atlas integration.

## 🚀 Deployment

### Backend (Heroku)
Deploy the backend to Heroku. See [HEROKU_DEPLOYMENT.md](./HEROKU_DEPLOYMENT.md) for detailed instructions.

**Quick Start:**
```bash
# Install Heroku CLI and login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set MONGODB_URI="your_mongodb_connection_string"
heroku config:set FRONTEND_URL="https://your-username.github.io"

# Deploy
git push heroku main
```

### Frontend (GitHub Pages)
Deploy the frontend to GitHub Pages. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

**Quick Start:**
1. Deploy the backend first (see above)
2. Enable GitHub Pages in repository settings (Source: GitHub Actions)
3. Set `VITE_API_BASE_URL` in GitHub Secrets to your Heroku URL
4. Push to `main` branch - automatic deployment via GitHub Actions

## Setup Instructions

### 1. MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account or sign in
3. Create a new cluster (free tier is fine)
4. Create a database user:
   - Go to Database Access
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and password (save these!)
5. Whitelist your IP:
   - Go to Network Access
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development) or add your specific IP
6. Get your connection string:
   - Go to Database → Connect
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`)
   - Replace `<username>` and `<password>` with your database user credentials
   - Add a database name at the end: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/fridge-app?retryWrites=true&w=majority`

### 2. Environment Variables

Create a `.env` file in the root directory and add the following variables:

```
MONGODB_URI=your_mongodb_atlas_connection_string_here
PORT=5000
FRONTEND_URL=http://localhost:5173

# Email (required for invite emails)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
MAIL_FROM="Bia Fridge <invites@yourdomain.com>"

# Optional: override invite expiry (hours)
INVITE_EXPIRY_HOURS=72

# Gmail shortcut (instead of SMTP_*)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
```

- Set `FRONTEND_URL` to the public URL where the React app is served (used to build invite links).
- The SMTP values must match your email provider. If email cannot be sent, the API will still return a manual invite link that can be shared directly.
- To send mail from a Gmail account, create an App Password in Google Account settings (requires 2FA) and use `GMAIL_USER` and `GMAIL_APP_PASSWORD`. The invite email will be sent from that Gmail address.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

**Option 1: Run both server and client together**
```bash
npm run dev:all
```

**Option 2: Run separately**
```bash
# Terminal 1 - Start the backend server
npm run server

# Terminal 2 - Start the React app
npm run dev
```

The React app will be available at `http://localhost:5173`
The API server will be running at `http://localhost:5000`

## Features

- Add fridge items with name and expiry date
- View all items in a list
- Delete items
- Data persisted in MongoDB Atlas
- Invite other users to share the same fridge with real-time syncing of items

## Project Structure

```
firdge-app/
├── server/           # Backend Express server
│   ├── index.ts     # Server entry point
│   ├── models/      # MongoDB models
│   └── routes/      # API routes
├── src/             # React frontend
│   ├── App.tsx      # Main component
│   └── ...
└── .env             # Environment variables (create this)
```

