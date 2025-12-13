# Deployment Guide

This guide provides step-by-step instructions for deploying the Order Execution Engine to various cloud platforms.

## Prerequisites

Before deploying, ensure you have:
- A PostgreSQL database (Neon, Supabase, Railway, etc.)
- A Redis instance (Upstash, Redis Cloud, Railway, etc.)
- Your code pushed to a GitHub repository

## Option 1: Railway (Recommended)

Railway provides the easiest deployment experience with automatic PostgreSQL and Redis provisioning.

### Steps:

1. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Sign in with GitHub

2. **Create a New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Service**
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically provision a database
   - Note: The `DATABASE_URL` will be automatically set

4. **Add Redis Service**
   - Click "New" → "Database" → "Add Redis"
   - Railway will automatically provision Redis
   - Note: The `REDIS_URL` will be automatically set

5. **Configure Environment Variables**
   - Go to your web service → "Variables"
   - Add the following:
     ```
     NODE_ENV=production
     PORT=3000
     HOST=0.0.0.0
     LOG_LEVEL=warn
     ```
   - `DB_URL` and `REDIS_URL` will be automatically injected from your database services

6. **Deploy**
   - Railway will automatically detect Node.js and deploy
   - Build command: `pnpm install && pnpm build`
   - Start command: `pnpm start`

7. **Get Your URL**
   - Go to "Settings" → "Domains"
   - Click "Generate Domain"
   - Your app will be available at `your-app-name.railway.app`

### Cost
- Free tier: $5 credit/month (suitable for development/testing)
- Paid: Pay as you go

---

## Option 2: Render

Render offers a generous free tier and automatic deployments.

### Steps:

1. **Create PostgreSQL Database**
   - Sign in to [render.com](https://render.com)
   - Click "New +" → "PostgreSQL"
   - Name: `order-engine-db`
   - Plan: Free
   - Create database and copy the **Internal Database URL**

2. **Create Redis Instance**
   - Use [Upstash](https://upstash.com) for free Redis
   - Create a new database
   - Copy the Redis URL

3. **Create Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: `order-execution-engine`
     - **Environment**: Node
     - **Build Command**: `pnpm install && pnpm build`
     - **Start Command**: `pnpm start`
     - **Plan**: Free

4. **Environment Variables**
   Add these in the "Environment" section:
   ```
   NODE_ENV=production
   PORT=3000
   HOST=0.0.0.0
   LOG_LEVEL=warn
   DB_URL=<your-postgres-internal-url>
   REDIS_URL=<your-upstash-redis-url>
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Render will automatically deploy on every push to main branch
   - Your app will be available at `your-app-name.onrender.com`

### Cost
- Web Service: Free tier available (sleeps after inactivity)
- PostgreSQL: Free tier available
- Redis: Use Upstash free tier

---

## Option 3: Fly.io

Fly.io offers edge deployment and good performance.

### Steps:

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   flyctl auth login
   ```

3. **Create App**
   ```bash
   flyctl launch
   ```
   - Choose app name
   - Select region
   - Don't deploy yet

4. **Add PostgreSQL**
   ```bash
   flyctl postgres create
   ```
   - Follow prompts to create database
   - Attach to your app:
     ```bash
     flyctl postgres attach <postgres-app-name>
     ```

5. **Add Redis**
   - Use Upstash for Redis
   - Set secret:
     ```bash
     flyctl secrets set REDIS_URL=<your-upstash-redis-url>
     ```

6. **Configure fly.toml**
   ```toml
   app = "your-app-name"

   [build]
     builder = "heroku/buildpacks:20"

   [env]
     NODE_ENV = "production"
     PORT = "8080"

   [[services]]
     internal_port = 8080
     protocol = "tcp"

     [[services.ports]]
       handlers = ["http"]
       port = 80

     [[services.ports]]
       handlers = ["tls", "http"]
       port = 443
   ```

7. **Deploy**
   ```bash
   flyctl deploy
   ```

8. **Get URL**
   ```bash
   flyctl info
   ```

### Cost
- Free tier: 3 shared-cpu VMs
- Suitable for development and testing

---

## External Services for Database & Redis

### PostgreSQL Options

1. **Neon** (Recommended)
   - URL: [neon.tech](https://neon.tech)
   - Free tier: 500MB storage
   - Serverless PostgreSQL
   - Auto-scaling

2. **Supabase**
   - URL: [supabase.com](https://supabase.com)
   - Free tier: 500MB storage
   - Includes auth and storage

3. **ElephantSQL**
   - URL: [elephantsql.com](https://elephantsql.com)
   - Free tier: 20MB storage

### Redis Options

1. **Upstash** (Recommended)
   - URL: [upstash.com](https://upstash.com)
   - Free tier: 10,000 commands/day
   - Serverless Redis
   - Global edge caching

2. **Redis Cloud**
   - URL: [redis.com/try-free](https://redis.com/try-free)
   - Free tier: 30MB storage

3. **Railway Redis**
   - Included if using Railway

---

## Environment Variables Reference

Required environment variables for production:

```env
# Required
NODE_ENV=production
DB_URL=postgresql://user:password@host:port/database
REDIS_URL=redis://default:password@host:port

# Optional
PORT=3000                    # Default: 3000
HOST=0.0.0.0                # Default: 0.0.0.0
LOG_LEVEL=warn              # Options: debug, info, warn, error
```

---

## Post-Deployment Checklist

- [ ] Health endpoint responding: `GET /health`
- [ ] Database connected (check health endpoint)
- [ ] Redis connected (check health endpoint)
- [ ] Create test order via Postman
- [ ] Verify WebSocket connection
- [ ] Monitor logs for errors
- [ ] Test concurrent order processing
- [ ] Update README with deployment URL

---

## Troubleshooting

### Database Connection Issues

**Error**: `ECONNREFUSED` or `connection timeout`

**Solutions**:
1. Verify `DB_URL` is correct
2. Check if database allows connections from your deployment IP
3. Ensure SSL is enabled (most cloud databases require it)
4. Check database is running and accessible

### Redis Connection Issues

**Error**: `Redis connection failed`

**Solutions**:
1. Verify `REDIS_URL` format is correct
2. Check Redis instance is running
3. Verify credentials
4. Check firewall/network rules

### Build Failures

**Error**: `pnpm: command not found`

**Solutions**:
1. Ensure `packageManager` field is in `package.json`
2. Add build command: `npm install -g pnpm && pnpm install && pnpm build`
3. Or switch to npm: Use `npm install && npm run build`

### WebSocket Not Working

**Error**: WebSocket connections failing

**Solutions**:
1. Ensure your hosting platform supports WebSocket
2. Check that the WebSocket upgrade header is allowed
3. Verify firewall rules allow WebSocket protocol
4. Use WSS (secure WebSocket) for HTTPS deployments

### Orders Not Processing

**Error**: Orders stuck in PENDING status

**Solutions**:
1. Check Redis is connected and working
2. Verify BullMQ worker is running
3. Check logs for queue processing errors
4. Ensure sufficient memory/CPU resources

---

## Monitoring

### Recommended Tools

1. **Logs**
   - Railway: Built-in logs viewer
   - Render: Logs tab in dashboard
   - Fly.io: `flyctl logs`

2. **Metrics**
   - Use `/health` endpoint for uptime monitoring
   - Set up UptimeRobot or similar service
   - Monitor response times

3. **Alerts**
   - Configure email alerts for failed deployments
   - Set up error tracking (Sentry, LogRocket)
   - Monitor database and Redis resource usage

---

## Scaling Considerations

### Horizontal Scaling

To handle more traffic:
1. Increase worker concurrency in BullMQ (default: 10)
2. Add more dynos/instances
3. Use load balancing

### Vertical Scaling

For better performance:
1. Upgrade to larger instance size
2. Increase database connection pool
3. Allocate more memory to Redis

### Database Optimization

1. Add indexes for frequently queried columns
2. Enable connection pooling
3. Consider read replicas for high read load

---

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use platform secret management
   - Rotate credentials regularly

2. **Database**
   - Use strong passwords
   - Enable SSL/TLS
   - Restrict IP access
   - Regular backups

3. **API**
   - Add rate limiting
   - Implement authentication
   - Use CORS properly
   - Keep dependencies updated

4. **Redis**
   - Set password
   - Disable dangerous commands
   - Use TLS connection

---

## Support

For deployment issues:
- Check platform documentation
- Join platform community Discord/Slack
- Open GitHub issue for app-specific problems
