# Setting Up GitHub Secrets for GitHub Pages

## Required Secret: VITE_API_BASE_URL

Your frontend needs to know where your backend API is located. Since your backend is on Heroku, you need to set this secret.

### Steps:

1. **Go to your repository secrets:**
   - Navigate to: https://github.com/DazHaze/Fridge-app/settings/secrets/actions

2. **Click "New repository secret"**

3. **Add the secret:**
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://blooming-citadel-76658-016b80a7bc16.herokuapp.com`
   - **Important:** Do NOT include a trailing slash
   - Click "Add secret"

4. **Verify the secret is set:**
   - You should see `VITE_API_BASE_URL` in your secrets list

5. **Trigger a new deployment:**
   - Go to: https://github.com/DazHaze/Fridge-app/actions
   - Click on "Deploy to GitHub Pages" workflow
   - Click "Run workflow" → "Run workflow" (to manually trigger)
   - Or just push a new commit to trigger automatically

## What This Does

When the GitHub Actions workflow builds your frontend, it will:
- Use the `VITE_API_BASE_URL` secret to set the environment variable
- Your React app will make API calls to: `https://blooming-citadel-76658-016b80a7bc16.herokuapp.com/api/fridge-items`
- Instead of trying to call: `https://dazhaze.github.io/api/fridge-items` (which doesn't exist)

## Optional: VITE_BASE_PATH

If your GitHub Pages URL doesn't match `/fridge-app/`, you can also set:
- **Name:** `VITE_BASE_PATH`
- **Value:** Your exact GitHub Pages path (e.g., `/Fridge-app/` or `/fridge-app/`)

## Testing

After setting the secret and deploying:
1. Visit your GitHub Pages site
2. Open browser console (F12)
3. Check the Network tab
4. You should see API calls going to your Heroku backend, not GitHub Pages

