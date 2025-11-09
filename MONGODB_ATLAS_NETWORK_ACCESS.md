# How to Whitelist IP Addresses in MongoDB Atlas

## The Problem
Your Heroku app can't connect to MongoDB Atlas because Heroku's IP addresses aren't whitelisted. You need to allow access from anywhere (or specific IPs).

## Step-by-Step Guide

### Method 1: Via MongoDB Atlas Dashboard

1. **Go to MongoDB Atlas:**
   - Visit: https://cloud.mongodb.com
   - Sign in with your account

2. **Navigate to Your Project:**
   - If you see multiple projects, click on the project that contains your cluster
   - You should see your cluster name (e.g., "Cluster0")

3. **Find Network Access:**
   - Look at the **left sidebar** menu
   - You should see options like:
     - Overview
     - Database
     - **Security** ← Click this
     - **Network Access** ← Should be under Security, or click directly
   
   **Alternative locations:**
   - Sometimes it's directly in the left sidebar as "Network Access"
   - Or under "Security" → "Network Access"
   - Or click on your cluster, then look for a "Security" or "Network" tab

4. **Add IP Address:**
   - Click the green **"Add IP Address"** button (or "Add IP Entry")
   - You'll see options:
     - **"Allow Access from Anywhere"** ← Click this (recommended for Heroku)
     - Or "Add Current IP Address"
     - Or "Add IP Address" (to add specific IPs)
   
5. **Confirm:**
   - If you clicked "Allow Access from Anywhere", it will add `0.0.0.0/0`
   - Click **"Confirm"** or **"Add"**

6. **Wait a few minutes:**
   - Changes can take 1-2 minutes to propagate
   - Your Heroku app should automatically reconnect

### Method 2: Direct URL

Try going directly to:
- https://cloud.mongodb.com/v2#/security/network/list
- (You may need to select your project first)

### Method 3: If You Still Can't Find It

1. **Check your MongoDB Atlas plan:**
   - Free tier (M0) should have Network Access
   - If you're on a very old account, the UI might be different

2. **Look for these terms:**
   - "IP Access List"
   - "Network Access"
   - "IP Whitelist"
   - "Access List"
   - "Security" → "Network"

3. **Check the top navigation:**
   - Sometimes there's a "Security" menu in the top bar
   - Or a "Settings" menu

4. **Try the cluster view:**
   - Click on your cluster name
   - Look for tabs or buttons related to "Security" or "Network"

## What You Should See

Once you find Network Access, you should see:
- A list of IP addresses (or "No entries")
- A green "Add IP Address" button
- Option to "Allow Access from Anywhere"

## After Whitelisting

1. **Wait 1-2 minutes** for changes to propagate

2. **Check Heroku logs:**
   ```bash
   heroku logs --tail -a blooming-citadel-76658
   ```
   You should see: `MongoDB Connected: ...` instead of connection errors

3. **Test your API:**
   - Visit: https://blooming-citadel-76658-016b80a7bc16.herokuapp.com/api/fridge-items
   - Should return `[]` (empty array) instead of 503 error

## Security Note

"Allow Access from Anywhere" (`0.0.0.0/0`) is fine for:
- Development/testing
- Apps with proper authentication
- Free tier projects

For production with sensitive data, consider:
- Using MongoDB Atlas VPC peering
- Whitelisting only specific IP ranges
- Using MongoDB Atlas Private Endpoints

## Still Having Issues?

If you still can't find Network Access:
1. What MongoDB Atlas plan are you on? (Free, M0, M10, etc.)
2. Can you see "Database", "Clusters", "Security" in the left sidebar?
3. Take a screenshot of what you see and describe it

The Network Access feature should be available on all MongoDB Atlas accounts, including the free tier.

