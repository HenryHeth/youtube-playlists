#!/bin/bash
# YouTube Playlists Refresh Script
# Fetches latest videos and deploys to all sites

set -e  # Exit on error
BASEDIR="/Users/henry_notabot/clawd/youtube-playlists"
cd "$BASEDIR"

echo "[$(date)] Starting refresh..."

# Fetch latest videos
echo "[$(date)] Fetching videos..."
node fetch-videos.js
if [ $? -ne 0 ]; then
  echo "[$(date)] Fetch failed"
  exit 1
fi

# Write refresh timestamp
echo "{\"lastRefresh\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > public/last-refresh.json

# Build main site pages
echo "[$(date)] Building main site pages..."
node build-pages.js

# Copy data to all sub-projects
echo "[$(date)] Copying data to sub-projects..."
cp videos-data.json yt-research/
cp videos-data.json yt-entertainment/
cp videos-data.json yt-news/
cp public/last-refresh.json yt-research/public/
cp public/last-refresh.json yt-entertainment/public/
cp public/last-refresh.json yt-news/public/

# Build and deploy Research
echo "[$(date)] Building and deploying yt-research..."
cd "$BASEDIR/yt-research"
node build.js
vercel --prod --yes

# Build and deploy Entertainment
echo "[$(date)] Building and deploying yt-entertainment..."
cd "$BASEDIR/yt-entertainment"
node build.js
vercel --prod --yes

# Build and deploy News
echo "[$(date)] Building and deploying yt-news..."
cd "$BASEDIR/yt-news"
node build.js
vercel --prod --yes

# Deploy main site
echo "[$(date)] Deploying main site..."
cd "$BASEDIR"
vercel --prod --yes

echo "[$(date)] ✅ Refresh complete - all sites updated"
echo ""
echo "URLs:"
echo "  Main: https://youtube-playlists-alpha.vercel.app/"
echo "  Research: https://yt-research-wheat.vercel.app/"
echo "  Entertainment: https://yt-entertainment.vercel.app/"
echo "  News: https://yt-news.vercel.app/"
