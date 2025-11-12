# Deployment Guide for GitHub Pages

This guide will help you deploy the Fridge App frontend to GitHub Pages.

## Important Notes

⚠️ **GitHub Pages only hosts static files** - it cannot run the Node.js backend server. You'll need to deploy the backend separately to a service like:
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Heroku](https://heroku.com)
- [Vercel](https://vercel.com)
- [Fly.io](https://fly.io)

## Step 1: Deploy the Backend

1. Choose a hosting service (Railway is recommended for MongoDB apps)
2. Deploy your backend server:
   - Push your code to GitHub
   - Connect your repository to the hosting service
   - Set environment variables:
     - `MONGODB_URI` - Your MongoDB Atlas connection string
     - `PORT` - Usually set automatically by the hosting service
   - Deploy and note your backend URL (e.g., `https://your-app.railway.app`)

## Step 2: Configure Frontend for Production

1. Update `vite.config.ts`:
   - Change the `base` path to match your GitHub repository name
   - Example: If your repo is `firdge-app`, the base should be `/firdge-app/`
   - If deploying to a custom domain, use `/`

2. Create a `.env.production` file (or set in GitHub Actions secrets):
   ```
   VITE_API_BASE_URL=https://your-backend-url.railway.app
   VITE_BASE_PATH=/firdge-app/
   ```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**
4. Save the settings

## Step 4: Deploy

1. Push your code to the `main` branch:
   ```bash
   git add .
   git commit -m "Prepare for GitHub Pages deployment"
   git push origin main
   ```

2. The GitHub Actions workflow will automatically:
   - Build your React app
   - Deploy it to GitHub Pages

3. Your site will be available at:
   - `https://your-username.github.io/firdge-app/`
   - Or your custom domain if configured

## Step 5: Update API Configuration

After deployment, update the frontend to point to your deployed backend:

1. In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions**
2. Add a new secret:
   - Name: `VITE_API_BASE_URL`
   - Value: Your deployed backend URL (e.g., `https://your-app.railway.app`)

3. Update `.github/workflows/deploy.yml` to use the secret:
   ```yaml
   - name: Build
     run: npm run build
     env:
       NODE_ENV: production
       VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
   ```

## Troubleshooting

### CORS Issues
Make sure your backend has CORS enabled for your GitHub Pages domain:
```javascript
app.use(cors({
  origin: ['https://your-username.github.io', 'http://localhost:5173']
}))
```

### API Not Working
- Check that your backend is deployed and running
- Verify the `VITE_API_BASE_URL` environment variable is set correctly
- Check browser console for CORS errors
- Ensure MongoDB connection is working

### Build Fails
- Check GitHub Actions logs for errors
- Verify all dependencies are in `package.json`
- Ensure TypeScript compiles without errors

## Quick Deploy Checklist

- [ ] Backend deployed and accessible
- [ ] MongoDB Atlas connection working
- [ ] `vite.config.ts` base path updated
- [ ] GitHub Pages enabled with GitHub Actions
- [ ] Environment variables set in GitHub Secrets
- [ ] Code pushed to `main` branch
- [ ] GitHub Actions workflow completed successfully



