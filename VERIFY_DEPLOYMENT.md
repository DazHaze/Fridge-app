# Verify GitHub Pages Deployment

## Current Issue
Assets are returning 404 because an old deployment might still be active, or the base path doesn't match.

## Step 1: Check GitHub Actions Status
1. Go to: https://github.com/DazHaze/Fridge-app/actions
2. Look for the latest "Deploy to GitHub Pages" workflow run
3. Check if it completed successfully (green checkmark)
4. If it's still running, wait for it to complete
5. If it failed, check the error logs

## Step 2: Manually Trigger Deployment
If the workflow hasn't run or you want to force a new deployment:

1. Go to: https://github.com/DazHaze/Fridge-app/actions
2. Click "Deploy to GitHub Pages" in the left sidebar
3. Click "Run workflow" button (top right)
4. Select "master" branch
5. Click "Run workflow"
6. Wait for it to complete (2-3 minutes)

## Step 3: Verify GitHub Pages Settings
1. Go to: https://github.com/DazHaze/Fridge-app/settings/pages
2. **Source** must be set to **"GitHub Actions"** (NOT a branch)
3. Note the exact URL shown (it will show your site URL)
4. The URL should be: `https://dazhaze.github.io/fridge-app/` or `https://dazhaze.github.io/Fridge-app/`

## Step 4: Check the Actual URL
The repository name is `Fridge-app` (capital F, capital A), but GitHub Pages URLs might be:
- Lowercase: `https://dazhaze.github.io/fridge-app/` (most common)
- Case-sensitive: `https://dazhaze.github.io/Fridge-app/` (matches repo name)

**To find out:**
1. Go to your repository Settings → Pages
2. Look at the URL shown at the top
3. Note the exact casing

## Step 5: Set Base Path Secret (If Needed)
If your URL uses capitals (`/Fridge-app/`), set a GitHub Secret:

1. Go to: https://github.com/DazHaze/Fridge-app/settings/secrets/actions
2. Click "New repository secret"
3. Name: `VITE_BASE_PATH`
4. Value: Match your exact URL:
   - If URL is `/fridge-app/` → Use `/fridge-app/`
   - If URL is `/Fridge-app/` → Use `/Fridge-app/`
5. Save
6. Manually trigger the workflow again (Step 2)

## Step 6: Clear Browser Cache
After deployment completes:
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or use incognito/private mode
- Or clear browser cache completely

## Step 7: Verify Assets Load
1. Visit your GitHub Pages site
2. Open browser console (F12)
3. Check Network tab
4. Assets should load from: `https://dazhaze.github.io/fridge-app/assets/...` (or `/Fridge-app/assets/...`)

## If Still Not Working
1. Check the exact error URLs in the browser console
2. Compare them to what's in `dist/index.html` after building locally
3. Verify the workflow build logs show the correct base path
4. Make sure `dist` folder contains `index.html`, `404.html`, and `assets/` folder

