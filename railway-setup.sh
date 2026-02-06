#!/bin/bash
# Railway Volume Setup Script
# Run this after deploying to Railway to automatically add the volume

set -e

echo "🚂 Gerald Railway Setup"
echo "======================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it:"
    echo "   npm i -g @railway/cli"
    echo "   or: brew install railway"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway first:"
    railway login
fi

echo "📦 Creating persistent volume..."
echo ""

# Create volume
railway volume add \
  --name "gerald-data" \
  --mount-path "/data" || {
    echo ""
    echo "⚠️  Volume creation failed. This might mean:"
    echo "   1. Volume already exists (check: railway volume list)"
    echo "   2. You need to select a service first (run: railway link)"
    echo ""
    exit 1
  }

echo ""
echo "✅ Volume created successfully!"
echo ""
echo "📊 Volume details:"
railway volume list

echo ""
echo "🎯 Next steps:"
echo "   1. Visit your Railway deployment URL"
echo "   2. Go to /setup"
echo "   3. Complete the setup wizard"
echo "   4. Configuration will now persist forever!"
echo ""
