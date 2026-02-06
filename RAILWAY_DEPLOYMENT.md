# Railway Deployment Guide

## Critical: Persistent Volume Required

**You MUST add a persistent volume** or your configuration will be lost on every deployment.

### Add a Volume in Railway

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Settings** → **Volumes**
4. Click **"New Volume"**
5. Configure:
   - **Mount Path:** `/data`
   - **Size:** 1 GB (minimum)
6. Click **"Add"**

Railway will restart your service automatically after adding the volume.

## Environment Variables

Add these in Railway **Variables** tab:

```bash
# Required
SETUP_PASSWORD = <your-secure-password>

# Pre-configured (from template)
DEFAULT_MODEL = moonshot/kimi-k2.5
MOONSHOT_API_KEY = sk-WSQeH5T6ZNBqxvfiONEfK5ERSLyNZrSOIoJlFSu8PAOWJP3O
GITHUB_TOKEN = github_pat_11APSQXFQ...

# Optional (but recommended)
CLIENT_DOMAIN = yourdomain.com
CLOUDFLARE_API_KEY = <your-cloudflare-key>
CLOUDFLARE_EMAIL = <your-cloudflare-email>
```

## Setup Workflow

1. **Deploy the service** from template
2. **Add persistent volume** (see above)
3. **Add environment variables** (if not already set)
4. Wait for deployment to complete
5. Visit `https://<your-service>.railway.app/setup`
6. Enter your `SETUP_PASSWORD`
7. Complete the setup wizard:
   - Auth: Should auto-select Moonshot
   - Client Domain: Enter your domain (without www.)
   - GitHub Repo: Select from dropdown
   - Branches: main (production), development (dev)
8. Click **"Run Setup"**
9. Wait for setup to complete (~2-3 minutes)
10. Visit `https://gerald.<yourdomain>.com`

## What Gets Stored in /data

The persistent volume stores:
- `/data/.openclaw/openclaw.json` - Main OpenClaw configuration
- `/data/.openclaw/illumin8.json` - Client domain and settings
- `/data/.openclaw/workspace/` - Gerald's workspace and memory
- `/data/.openclaw/dashboard/` - Gerald Dashboard files
- `/data/.openclaw/gateway.token` - Gateway authentication token
- `/data/sites/production/` - Production website build
- `/data/sites/dev/` - Development website files

**Without a volume, all of this is lost on every deploy!**

## Troubleshooting

### "I have to run setup every time I deploy"
→ You don't have a persistent volume mounted to `/data`

### "503 Service Unavailable"
→ Check Railway logs for errors
→ Visit `/setup/healthz` to see service status
→ Visit `/setup/diagnostic` for full diagnostic info

### "Gateway not starting"
→ Check `/setup/diagnostic` for openclaw.version
→ Check Railway logs for `[gateway]` errors
→ Try manual start: POST to `/setup/api/gateway/start`

### "Environment variables not working"
→ Add them in Railway Variables tab (not in code)
→ Railway will restart automatically when you change variables
→ Don't put secrets in railway.toml (it's public in git)

## Deployment Updates

When you push code changes to GitHub:

1. Railway will automatically rebuild (if you have GitHub integration)
2. OR manually trigger: Railway dashboard → "Deploy"
3. Configuration persists (because of the volume)
4. Gateway/Dashboard restart automatically
5. No need to run setup again

## Custom Domain Setup

After setup completes, you'll have these subdomains configured via Cloudflare:

- `yourdomain.com` → Production website
- `www.yourdomain.com` → Redirects to apex
- `dev.yourdomain.com` → Development site (with live reload)
- `gerald.yourdomain.com` → Gerald Dashboard

Make sure these CNAME records point to your Railway URL (setup wizard configures this automatically if you provide Cloudflare credentials).

## Support

If something's not working:
1. Check `/setup/diagnostic` (no password required)
2. Check Railway deployment logs
3. Review this guide
4. Check the main README.md for detailed documentation
