const fs = require('fs');

const data = JSON.parse(fs.readFileSync('videos-data.json', 'utf8'));

// JSONBlob ID for cross-device sync
const JSONBLOB_ID = '019c48c6-b141-7c1f-a893-5de4c2335f8e';

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f0f0f;
    color: #fff;
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  h1 { 
    font-size: 28px; 
    margin-bottom: 8px;
    color: #fff;
  }
  .subtitle {
    color: #aaa;
    font-size: 14px;
    margin-bottom: 30px;
  }
  .sync-status {
    font-size: 12px;
    color: #666;
    margin-bottom: 10px;
  }
  .sync-status.synced { color: #4a4; }
  .sync-status.syncing { color: #aa4; }
  .sync-status.error { color: #a44; }
  .category { margin-bottom: 40px; }
  .category h2 { 
    font-size: 20px; 
    margin-bottom: 16px;
    color: #fff;
    border-bottom: 1px solid #333;
    padding-bottom: 8px;
  }
  .video-card {
    background: #1a1a1a;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 20px;
    transition: opacity 0.3s;
  }
  .video-card.watched {
    opacity: 0.5;
  }
  .video-card.watched .video-title::before {
    content: "✓ ";
    color: #4a4;
  }
  .video-header {
    display: flex;
    gap: 16px;
    padding: 16px;
    cursor: pointer;
  }
  .video-header:hover {
    background: #252525;
  }
  .video-card.watched .video-header:hover {
    opacity: 1;
  }
  .thumb-container {
    position: relative;
    flex-shrink: 0;
  }
  .thumb {
    width: 200px;
    height: 112px;
    border-radius: 8px;
    object-fit: cover;
    background: #333;
  }
  .new-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    background: #ff0000;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .video-info {
    flex: 1;
    min-width: 0;
  }
  .creator-name {
    font-size: 12px;
    color: #888;
    margin-bottom: 4px;
  }
  .creator-name a {
    color: #aaa;
    text-decoration: none;
  }
  .creator-name a:hover {
    color: #fff;
    text-decoration: underline;
  }
  .duration {
    background: rgba(0,0,0,0.8);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;
    position: absolute;
    bottom: 6px;
    right: 6px;
  }
  .video-title {
    font-size: 16px;
    font-weight: 500;
    color: #fff;
    line-height: 1.4;
    margin-bottom: 8px;
  }
  .video-meta {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #888;
  }
  .video-date {
    color: #aaa;
  }
  .player-container {
    display: none;
    background: #000;
  }
  .player-container.active {
    display: block;
  }
  .player-container iframe {
    width: 100%;
    aspect-ratio: 16/9;
    border: none;
  }
  .controls {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  .controls button {
    background: #333;
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }
  .controls button:hover {
    background: #444;
  }
  .updated {
    text-align: center;
    color: #555;
    font-size: 12px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #222;
  }
  @media (max-width: 600px) {
    .video-header { flex-direction: column; }
    .thumb { width: 100%; height: auto; aspect-ratio: 16/9; }
  }
`;

const JS = `
  const BLOB_URL = 'https://jsonblob.com/api/jsonBlob/${JSONBLOB_ID}';
  let watchedData = {};
  let syncTimeout = null;
  
  async function loadWatched() {
    setStatus('syncing', 'Loading...');
    try {
      const res = await fetch(BLOB_URL);
      const data = await res.json();
      watchedData = data.watched || {};
      updateWatchedUI();
      setStatus('synced', 'Synced ✓');
    } catch (e) {
      console.error('Load failed:', e);
      setStatus('error', 'Sync failed');
      // Fall back to localStorage
      try {
        watchedData = JSON.parse(localStorage.getItem('yt-watched') || '{}');
        updateWatchedUI();
      } catch {}
    }
  }
  
  async function saveWatched() {
    setStatus('syncing', 'Saving...');
    try {
      await fetch(BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched: watchedData })
      });
      // Also save to localStorage as backup
      localStorage.setItem('yt-watched', JSON.stringify(watchedData));
      setStatus('synced', 'Synced ✓');
    } catch (e) {
      console.error('Save failed:', e);
      setStatus('error', 'Sync failed');
    }
  }
  
  function debouncedSave() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(saveWatched, 500);
  }
  
  function setStatus(cls, text) {
    const el = document.getElementById('sync-status');
    if (el) {
      el.className = 'sync-status ' + cls;
      el.textContent = text;
    }
  }
  
  function setWatched(videoId) {
    watchedData[videoId] = Date.now();
    debouncedSave();
  }
  
  function isWatched(videoId) {
    return !!watchedData[videoId];
  }
  
  function updateWatchedUI() {
    document.querySelectorAll('.video-card').forEach(card => {
      const videoId = card.dataset.videoId;
      if (isWatched(videoId)) {
        card.classList.add('watched');
      } else {
        card.classList.remove('watched');
      }
    });
  }
  
  function togglePlayer(card, videoId) {
    const container = card.querySelector('.player-container');
    const isActive = container.classList.contains('active');
    
    // Close all other players
    document.querySelectorAll('.player-container.active').forEach(p => {
      p.classList.remove('active');
      p.innerHTML = '';
    });
    
    if (!isActive) {
      container.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
      container.classList.add('active');
      
      // Mark as watched
      setWatched(videoId);
      card.classList.add('watched');
    }
  }
  
  async function clearWatched() {
    if (confirm('Clear all watched markers across all devices?')) {
      watchedData = {};
      await saveWatched();
      updateWatchedUI();
    }
  }
  
  function hideWatched() {
    const hidden = document.body.classList.toggle('hide-watched');
    document.querySelectorAll('.video-card.watched').forEach(card => {
      card.style.display = hidden ? 'none' : 'block';
    });
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', loadWatched);
`;

function generatePage(title, subtitle, categories) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>${title}</h1>
  <p class="subtitle">${subtitle}</p>
  <div id="sync-status" class="sync-status">Loading...</div>
  <div class="controls">
    <button onclick="hideWatched()">Hide Watched</button>
    <button onclick="clearWatched()">Clear History</button>
    <button onclick="loadWatched()">Refresh</button>
  </div>
`;

  for (const [catName, creators] of Object.entries(categories)) {
    html += `  <div class="category">
    <h2>${catName}</h2>
`;
    for (const creator of creators) {
      const channelUrl = `https://www.youtube.com/${creator.channel}`;
      for (const video of creator.videos) {
        const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
        const newBadge = video.isNew ? '<span class="new-badge">NEW</span>' : '';
        const durationBadge = video.duration ? `<span class="duration">${escapeHtml(video.duration)}</span>` : '';
        
        html += `    <div class="video-card" data-video-id="${video.videoId}" onclick="togglePlayer(this, '${video.videoId}')">
      <div class="video-header">
        <div class="thumb-container">
          <img class="thumb" src="${thumb}" alt="" loading="lazy">
          ${newBadge}
          ${durationBadge}
        </div>
        <div class="video-info">
          <div class="creator-name"><a href="${channelUrl}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(creator.creator)}</a></div>
          <div class="video-title">${escapeHtml(video.title)}</div>
          <div class="video-meta">
            <span class="video-date">${escapeHtml(video.dateStr || '')}</span>
            <span>${escapeHtml(video.views || '')}</span>
          </div>
        </div>
      </div>
      <div class="player-container"></div>
    </div>
`;
      }
    }
    html += `  </div>
`;
  }

  const now = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  html += `  <div class="updated">Last updated: ${now} PST</div>
  <script>${JS}</script>
</body>
</html>`;

  return html;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Create public directory
fs.mkdirSync('public', { recursive: true });

// Build research page
const researchHtml = generatePage(
  '🔬 Research Feed',
  'Curated videos from AI, Finance, and Health creators • Click to play',
  data.research
);
fs.writeFileSync('public/research.html', researchHtml);
console.log('✅ Built public/research.html');

// Build entertainment page
const entertainmentHtml = generatePage(
  '⛵ Entertainment Feed',
  'Sailing content for leisure time • Click to play',
  data.entertainment
);
fs.writeFileSync('public/entertainment.html', entertainmentHtml);
console.log('✅ Built public/entertainment.html');

// Build index
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube Curated</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0f0f0f; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; gap: 20px; }
    a { color: #fff; text-decoration: none; font-size: 24px; padding: 20px 40px; background: #1a1a1a; border-radius: 12px; }
    a:hover { background: #333; }
  </style>
</head>
<body>
  <a href="/research.html">🔬 Research</a>
  <a href="/entertainment.html">⛵ Entertainment</a>
</body>
</html>`;
fs.writeFileSync('public/index.html', indexHtml);
console.log('✅ Built public/index.html');

console.log('\\nDone!');
