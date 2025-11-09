# GitHub Pages 404 Error Troubleshooting

## Quick Fixes

### 1. Verify GitHub Pages is Enabled
- Go to: https://github.com/DazHaze/Fridge-app/settings/pages
- **Source** must be set to **"GitHub Actions"** (NOT a branch)
- If it's set to a branch, change it to "GitHub Actions" and save

### 2. Check Your Actual GitHub Pages URL
Your site should be accessible at one of these URLs:
- `https://dazhaze.github.io/fridge-app/` (lowercase)
- `https://dazhaze.github.io/Fridge-app/` (with capitals)

**To find your exact URL:**
1. Go to your repository Settings → Pages
2. Look at the URL shown at the top (it will show your site URL)
3. Note the exact casing used

### 3. Verify the Base Path Matches
The base path in `vite.config.ts` must match your GitHub Pages URL exactly.

**Current setting:** `/fridge-app/` (lowercase)

**If your URL is `/Fridge-app/` (with capitals):**
- Set GitHub Secret: `VITE_BASE_PATH` = `/Fridge-app/`
- Or update `vite.config.ts` directly

### 4. Check GitHub Actions Workflow
1. Go to: https://github.com/DazHaze/Fridge-app/actions
2. Check if the "Deploy to GitHub Pages" workflow has run
3. Verify it completed successfully (green checkmark)
4. If it failed, check the error logs

### 5. Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or try incognito/private mode

### 6. Check Browser Console
1. Open your GitHub Pages site
2. Press F12 to open Developer Tools
3. Go to the Console tab
4. Look for 404 errors and note which files are failing
5. Check the Network tab to see failed requests

## Common Issues

### Issue: Assets (JS/CSS) returning 404
**Solution:** The base path is incorrect. Update it to match your GitHub Pages URL exactly.

### Issue: Page loads but shows blank
**Solution:** Check browser console for JavaScript errors. The API might not be configured.

### Issue: Workflow not running
**Solution:** 
1. Verify GitHub Pages is set to "GitHub Actions" source
2. Check repository permissions
3. Manually trigger workflow: Actions → "Deploy to GitHub Pages" → Run workflow

## Setting the Correct Base Path

### Option 1: Via GitHub Secrets (Recommended)
1. Go to: https://github.com/DazHaze/Fridge-app/settings/secrets/actions
2. Click "New repository secret"
3. Name: `VITE_BASE_PATH`
4. Value: Your exact GitHub Pages path (e.g., `/Fridge-app/` or `/fridge-app/`)
5. Save

### Option 2: Update vite.config.ts
Edit `vite.config.ts` and change:
```typescript
const base = process.env.VITE_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/YOUR-EXACT-PATH/' : '/')
```

Replace `YOUR-EXACT-PATH` with your actual GitHub Pages path.

## Testing Locally

To test with the production base path locally:
```bash
npm run build:frontend
npm run preview
```

Then visit: `http://localhost:4173/fridge-app/` (or your path)

## Still Not Working?

1. Check the exact error in browser console
2. Verify the workflow completed successfully
3. Wait 5-10 minutes after pushing changes (GitHub Pages can be slow)
4. Try accessing the site in an incognito window
5. Check if the `dist` folder contains `index.html` and `404.html`

