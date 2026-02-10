#!/bin/bash
# YouTube Playlists Refresh Script
# Fetches latest videos and deploys to both Research and Entertainment sites

cd /Users/henry_notabot/clawd/youtube-playlists

echo "[$(date)] Starting refresh..."

# Fetch latest videos
node fetch-videos.js
if [ $? -ne 0 ]; then
  echo "[$(date)] Fetch failed"
  exit 1
fi

# Copy data to both projects
cp videos-data.json ../yt-research/
cp videos-data.json ../yt-entertainment/

# Build and deploy Research
cd /Users/henry_notabot/clawd/yt-research
node build.js
vercel --prod --yes

# Build and deploy Entertainment
cd /Users/henry_notabot/clawd/yt-entertainment
node build.js
vercel --prod --yes

echo "[$(date)] Refresh complete - both sites updated"
