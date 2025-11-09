# Deploy Backend to Heroku

This guide will help you deploy the Fridge App backend to Heroku.

## Prerequisites

1. [Heroku account](https://www.heroku.com) (free tier available)
2. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
3. MongoDB Atlas connection string ready

## Step 1: Install Heroku CLI

If you haven't already, install the Heroku CLI:

**Windows:**
- Download from [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
- Or use: `winget install Heroku.CLI`

**Mac:**
```bash
brew tap heroku/brew && brew install heroku
```

**Linux:**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

## Step 2: Login to Heroku

```bash
heroku login
```

This will open a browser window for authentication.

## Step 3: Create Heroku App

```bash
# Navigate to your project directory
cd firdge-app

# Create a new Heroku app
heroku create your-app-name

# Or let Heroku generate a name
heroku create
```

**Note:** Replace `your-app-name` with your desired app name (must be unique). If the name is taken, Heroku will suggest alternatives.

## Step 4: Set Environment Variables

Set your MongoDB connection string and other environment variables:

```bash
# Set MongoDB URI
heroku config:set MONGODB_URI="your_mongodb_atlas_connection_string"

# Set frontend URL (for CORS) - update with your GitHub Pages URL
heroku config:set FRONTEND_URL="https://your-username.github.io"

# Set GitHub Pages URL (if different from FRONTEND_URL)
heroku config:set GITHUB_PAGES_URL="https://your-username.github.io/firdge-app"

# Set Node environment
heroku config:set NODE_ENV="production"
```

**To view all config variables:**
```bash
heroku config
```

## Step 5: Update MongoDB Atlas Network Access

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. Click **Allow Access from Anywhere** (or add Heroku's IP ranges)
5. Save

## Step 6: Deploy to Heroku

```bash
# Make sure you're on the main branch
git checkout main

# Add and commit any changes
git add .
git commit -m "Prepare for Heroku deployment"

# Deploy to Heroku
git push heroku main
```

**Note:** If this is your first time, you may need to add Heroku as a remote:
```bash
heroku git:remote -a your-app-name
```

## Step 7: Verify Deployment

```bash
# Check if the app is running
heroku ps

# View logs
heroku logs --tail

# Open your app in browser
heroku open
```

Your API will be available at: `https://your-app-name.herokuapp.com/api/fridge-items`

## Step 8: Update Frontend Configuration

Update your frontend to use the Heroku backend URL:

1. In GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**
2. Update or add `VITE_API_BASE_URL`:
   - Value: `https://your-app-name.herokuapp.com`

3. Re-deploy your frontend (push to main branch)

## Troubleshooting

### Build Fails

If the build fails, check the logs:
```bash
heroku logs --tail
```

Common issues:
- **TypeScript errors**: Make sure `server/tsconfig.json` is correct
- **Missing dependencies**: Check `package.json` includes all server dependencies
- **Port issues**: Heroku sets `PORT` automatically, don't hardcode it

### Database Connection Fails

1. Verify `MONGODB_URI` is set correctly:
   ```bash
   heroku config:get MONGODB_URI
   ```

2. Check MongoDB Atlas:
   - Network Access allows Heroku IPs
   - Database user has correct permissions
   - Connection string is correct

3. Check logs for connection errors:
   ```bash
   heroku logs --tail
   ```

### CORS Errors

If you see CORS errors:
1. Verify `FRONTEND_URL` is set correctly
2. Check the allowed origins in `server/index.ts`
3. Make sure your frontend URL matches exactly (including https/http)

### App Crashes

```bash
# Check what's wrong
heroku logs --tail

# Restart the app
heroku restart

# Check dyno status
heroku ps
```

## Useful Heroku Commands

```bash
# View logs
heroku logs --tail

# Restart the app
heroku restart

# Scale dynos (free tier: 1 web dyno)
heroku ps:scale web=1

# Open app in browser
heroku open

# Run commands in Heroku environment
heroku run node dist/server/index.js

# View config variables
heroku config

# Set config variable
heroku config:set KEY=value

# Remove config variable
heroku config:unset KEY
```

## Free Tier Limitations

Heroku's free tier (Eco dynos) has some limitations:
- Apps sleep after 30 minutes of inactivity
- 550-1000 free dyno hours per month
- Slower cold starts

For production, consider upgrading to a paid plan.

## Next Steps

After deploying:
1. ✅ Test your API endpoints
2. ✅ Update frontend with Heroku URL
3. ✅ Test the full application
4. ✅ Monitor logs for any issues

Your backend is now live at: `https://your-app-name.herokuapp.com`


