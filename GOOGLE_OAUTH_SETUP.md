# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for Darragh's Fridge app.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click **"New Project"**
4. Enter a project name (e.g., "Fridge App")
5. Click **"Create"**

## Step 2: Configure OAuth Consent Screen

1. In the Google Cloud Console, go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: Darragh's Fridge
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **"Save and Continue"**
5. On the **Scopes** page, click **"Save and Continue"** (no need to add scopes for basic profile)
6. On the **Test users** page (if in testing mode), add your Google account email
7. Click **"Save and Continue"**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Choose **"Web application"** as the application type
4. Give it a name (e.g., "Fridge App Web Client")
5. Add **Authorized JavaScript origins**:
   - For development: `http://localhost:5173`
   - For production: Your production URL (e.g., `https://dazhaze.github.io`)
6. Add **Authorized redirect URIs**:
   - For development: `http://localhost:5173`
   - For production: Your production URL (e.g., `https://dazhaze.github.io/fridge-app/`)
7. Click **"Create"**
8. Copy the **Client ID** (you'll need this in the next step)

## Step 4: Configure Environment Variables

### For Local Development

1. Create a `.env` file in the root of your project:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```

2. Replace `your-client-id-here.apps.googleusercontent.com` with your actual Client ID from Step 3

### For Production (GitHub Pages)

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Name: `VITE_GOOGLE_CLIENT_ID`
5. Value: Your Client ID from Step 3
6. Click **"Add secret"**

The GitHub Actions workflow will automatically use this secret when building your app.

## Step 5: Test the Login

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173`
3. You should see the login page
4. Click the "Sign in with Google" button
5. Select your Google account
6. You should be redirected to the main app

## Troubleshooting

### Issue: "VITE_GOOGLE_CLIENT_ID is not set"
- Make sure you've created a `.env` file in the root directory
- Make sure the variable name is exactly `VITE_GOOGLE_CLIENT_ID`
- Restart your development server after creating/updating the `.env` file

### Issue: "Error 400: redirect_uri_mismatch"
- Make sure your redirect URI in Google Cloud Console matches exactly:
  - Development: `http://localhost:5173`
  - Production: Your full production URL including the base path

### Issue: "This app isn't verified"
- If you're in testing mode, make sure your Google account is added as a test user
- To publish the app (remove the warning), you'll need to submit it for verification in the OAuth consent screen

### Issue: Login button doesn't appear
- Check the browser console for errors
- Make sure the Google Identity Services script is loaded (check Network tab)
- Verify your Client ID is correct

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- For production, always use GitHub Secrets, never hardcode credentials

