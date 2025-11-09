# Fix GitHub Pages 404 Errors - Base Path Issue

## The Problem
Your assets (CSS/JS files) are returning 404 errors because the base path doesn't match your actual GitHub Pages URL.

## Solution: Set VITE_BASE_PATH Secret

GitHub Pages URLs for project pages are typically **lowercase**, even if your repository name has capitals.

### Steps:

1. **Find your exact GitHub Pages URL:**
   - Go to: https://github.com/DazHaze/Fridge-app/settings/pages
   - Look at the URL shown (it will be something like `https://dazhaze.github.io/fridge-app/` or `https://dazhaze.github.io/Fridge-app/`)
   - **Note the exact casing**

2. **Set the GitHub Secret:**
   - Go to: https://github.com/DazHaze/Fridge-app/settings/secrets/actions
   - Click "New repository secret"
   - **Name:** `VITE_BASE_PATH`
   - **Value:** Your exact GitHub Pages path:
     - If URL is `https://dazhaze.github.io/fridge-app/` → Use `/fridge-app/` (lowercase)
     - If URL is `https://dazhaze.github.io/Fridge-app/` → Use `/Fridge-app/` (with capitals)
   - Click "Add secret"

3. **Trigger a new deployment:**
   - Go to: https://github.com/DazHaze/Fridge-app/actions
   - Click "Deploy to GitHub Pages"
   - Click "Run workflow" → "Run workflow"
   - Or wait for the next push to trigger automatically

## Most Likely Solution

Based on GitHub Pages conventions, your URL is probably:
- `https://dazhaze.github.io/fridge-app/` (lowercase)

So set the secret:
- **Name:** `VITE_BASE_PATH`
- **Value:** `/fridge-app/`

This will override the default `/Fridge-app/` in the workflow.

