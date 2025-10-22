# SketchSync Deployment Guide

This guide will help you deploy SketchSync to production. The application consists of two separate services that need to be deployed independently.

## Architecture Overview

- **Frontend**: Next.js application (deploy to Vercel)
- **Backend**: WebSocket server (deploy to Render/Railway/Fly.io)

## Prerequisites

- GitHub account
- Vercel account (for frontend)
- Render/Railway/Fly.io account (for backend)

---

## Part 1: Deploy Backend (WebSocket Server)

### Option A: Deploy to Render (Recommended - Free Tier Available)

1. **Push Your Code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Create New Web Service on Render**
   - Go to [render.com](https://render.com) and sign in
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `sketchsync-server` (or your choice)
     - **Region**: Choose closest to your users
     - **Branch**: `main`
     - **Root Directory**: `server`
     - **Runtime**: `Node`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: Free (or paid for no cold starts)

3. **Set Environment Variables**
   In Render dashboard, add these environment variables:
   ```
   NODE_ENV=production
   CLIENT_URL=https://your-app.vercel.app
   ```
   (You'll update `CLIENT_URL` after deploying the frontend)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - **Copy the deployed URL** (e.g., `https://sketchsync-server-xyz.onrender.com`)

5. **Test the Health Endpoint**
   ```bash
   curl https://your-server-url.onrender.com/health
   ```
   You should see: `{"status":"ok","timestamp":"...","uptime":...,"activeRooms":0}`

### Option B: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Configure:
   - **Root Directory**: `server`
   - **Start Command**: `npm start`
5. Add environment variables in Railway dashboard:
   ```
   NODE_ENV=production
   CLIENT_URL=https://your-app.vercel.app
   ```
6. Deploy and copy the URL

### Option C: Deploy to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Navigate to server directory: `cd server`
4. Create fly.toml or use fly launch
5. Deploy: `fly deploy`

---

## Part 2: Deploy Frontend (Next.js App)

### Deploy to Vercel (Recommended)

1. **Push Your Code to GitHub** (if not already done)
   ```bash
   git push origin main
   ```

2. **Import Project to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New..." → "Project"
   - Import your GitHub repository

3. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. **Add Environment Variable**
   - In Vercel dashboard, go to Project Settings → Environment Variables
   - Add:
     ```
     Variable: NEXT_PUBLIC_WEBSOCKET_URL
     Value: https://your-server-url.onrender.com
     ```
   - **Important**: Use the URL from Step 1 (Backend deployment)

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - **Copy your Vercel URL** (e.g., `https://sketchsync.vercel.app`)

6. **Update Backend CORS**
   - Go back to Render (or your backend hosting)
   - Update the `CLIENT_URL` environment variable:
     ```
     CLIENT_URL=https://sketchsync.vercel.app
     ```
   - Redeploy the backend service

---

## Part 3: Verify Deployment

1. **Test the Frontend**
   - Visit your Vercel URL
   - You should see the SketchSync landing page
   - Click "Create New Room"
   - If a room is created successfully, WebSocket connection is working!

2. **Test Cross-Browser Collaboration**
   - Open the same room URL in two different browsers
   - Draw on one browser
   - Verify changes appear in real-time on the other browser

3. **Check Backend Health**
   ```bash
   curl https://your-server-url.onrender.com/health
   ```

---

## Environment Variables Reference

### Frontend (.env.production.local or Vercel)
```
NEXT_PUBLIC_WEBSOCKET_URL=https://your-server-url.onrender.com
```

### Backend (Render/Railway/Fly.io)
```
NODE_ENV=production
CLIENT_URL=https://your-app.vercel.app
PORT=3001  # Usually auto-set by hosting provider
```

---

## Troubleshooting

### Frontend can't connect to WebSocket

**Symptoms**: Room creation fails, no real-time updates

**Solutions**:
1. Check `NEXT_PUBLIC_WEBSOCKET_URL` is correct in Vercel
2. Ensure URL includes `https://` (not `http://`)
3. Verify backend is running: visit `/health` endpoint
4. Check browser console for CORS errors

### CORS Errors

**Symptoms**: "Access-Control-Allow-Origin" errors in browser console

**Solutions**:
1. Verify `CLIENT_URL` in backend matches your Vercel domain exactly
2. Include protocol: `https://your-app.vercel.app` (not `your-app.vercel.app`)
3. Redeploy backend after changing environment variables

### Backend Sleeping (Free Tier)

**Symptoms**: First request takes 30+ seconds, then works normally

**Solution**: This is normal for Render's free tier. The server "sleeps" after 15 minutes of inactivity. Options:
- Upgrade to paid plan ($7/month) for 24/7 uptime
- Use a service like UptimeRobot to ping your server every 10 minutes
- Accept the occasional cold start delay

### Rooms Lost on Server Restart

**Symptoms**: All active rooms disappear when server restarts

**Explanation**: The current implementation uses in-memory storage (`Map()`). This is lost on restart.

**Solutions**:
- For production use, consider adding Redis or a database
- This is acceptable for a demo/portfolio project
- Document this limitation in your README

---

## Scaling Considerations

### Current Limitations

1. **In-Memory Storage**: Rooms stored in RAM, lost on restart
2. **Single Instance**: Can't scale horizontally without Redis
3. **No Persistence**: No chat history or saved canvases

### For Production Use

Consider adding:
1. **Redis** for shared state across server instances
2. **Database** (PostgreSQL/MongoDB) for persistence
3. **Authentication** for user management
4. **Rate Limiting** to prevent abuse
5. **Logging** (Datadog, LogRocket) for monitoring

---

## Costs

### Free Tier (Good for Portfolio/Demo)
- **Vercel**: Free for personal projects
- **Render**: Free (sleeps after 15min inactivity)
- **Total**: $0/month

### Paid Tier (Production-Ready)
- **Vercel Pro**: $20/month (optional, free tier usually sufficient)
- **Render Starter**: $7/month (24/7 uptime, no sleeping)
- **Total**: ~$7-27/month

---

## Next Steps After Deployment

1. **Update README** with your live demo URL
2. **Test thoroughly** with multiple users
3. **Monitor** your Render dashboard for errors
4. **Share** your project!

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Render/Railway logs
3. Test backend health endpoint
4. Verify environment variables are set correctly

## Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Render Documentation](https://render.com/docs)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
