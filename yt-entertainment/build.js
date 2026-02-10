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
    transition: opacity 0.3s, border 0.2s;
    position: relative;
  }
  .video-card.watched {
    opacity: 0.5;
  }
  .video-card.selected {
    border: 2px solid #4a9eff;
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
  .select-checkbox {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    cursor: pointer;
    z-index: 10;
    accent-color: #4a9eff;
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
  .duration {
    background: rgba(0,0,0,0.8);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 12px;
    position: absolute;
    bottom: 6px;
    right: 6px;
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
    flex-wrap: wrap;
    align-items: center;
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
  .controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .selection-count {
    font-size: 13px;
    color: #888;
  }
  .new-videos-banner {
    background: #1a3a1a;
    border: 1px solid #2a5a2a;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
    display: none;
  }
  .new-videos-banner.visible {
    display: block;
  }
  .new-videos-banner h3 {
    color: #6c6;
    margin-bottom: 12px;
    font-size: 16px;
  }
  .new-video-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #2a4a2a;
  }
  .new-video-item:last-child {
    border-bottom: none;
  }
  .new-video-item button {
    background: #4a4;
    color: #fff;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .new-video-item button:hover {
    background: #5b5;
  }
  .updated {
    text-align: center;
    color: #555;
    font-size: 12px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #222;
  }
  .top-nav {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .top-nav a {
    color: #888;
    text-decoration: none;
    font-size: 14px;
  }
  .top-nav a:hover { color: #fff; }
  .settings-link { color: #4a9eff; }
  @media (max-width: 600px) {
    .video-header { flex-direction: column; }
    .thumb { width: 100%; height: auto; aspect-ratio: 16/9; }
  }
`;

const JS = `
  const BLOB_URL = '/api/sync?feed=entertainment';
  let userData = { watched: {}, myVideos: {}, pendingNew: [] };
  let syncTimeout = null;
  let selectedVideos = new Set();
  
  // Get page type from URL
  const pageType = location.pathname.includes('entertainment') ? 'entertainment' : 'research';
  
  async function loadUserData() {
    setStatus('syncing', 'Loading...');
    try {
      const res = await fetch(BLOB_URL);
      const data = await res.json();
      userData = {
        watched: data.watched || {},
        myVideos: data.myVideos || {},
        pendingNew: data.pendingNew || []
      };
      
      // First visit: if no myVideos for this page, add all current videos
      if (!userData.myVideos[pageType] || Object.keys(userData.myVideos[pageType]).length === 0) {
        userData.myVideos[pageType] = {};
        document.querySelectorAll('.video-card').forEach(card => {
          const videoId = card.dataset.videoId;
          const creator = card.dataset.creator;
          userData.myVideos[pageType][videoId] = { 
            added: Date.now(),
            creator: creator
          };
        });
        await saveUserData();
      }
      
      updateUI();
      showPendingNewVideos();
      setStatus('synced', 'Synced ✓');
    } catch (e) {
      console.error('Load failed:', e);
      setStatus('error', 'Sync failed');
      // Fall back to showing all videos
    }
  }
  
  async function saveUserData() {
    setStatus('syncing', 'Saving...');
    try {
      await fetch(BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      setStatus('synced', 'Synced ✓');
    } catch (e) {
      console.error('Save failed:', e);
      setStatus('error', 'Sync failed');
    }
  }
  
  function debouncedSave() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(saveUserData, 500);
  }
  
  function setStatus(cls, text) {
    const el = document.getElementById('sync-status');
    if (el) {
      el.className = 'sync-status ' + cls;
      el.textContent = text;
    }
  }
  
  function setWatched(videoId) {
    userData.watched[videoId] = Date.now();
    debouncedSave();
  }
  
  function isWatched(videoId) {
    return !!userData.watched[videoId];
  }
  
  function updateUI() {
    document.querySelectorAll('.video-card').forEach(card => {
      const videoId = card.dataset.videoId;
      
      // Update watched state
      if (isWatched(videoId)) {
        card.classList.add('watched');
      } else {
        card.classList.remove('watched');
      }
      
      // Update selection state
      if (selectedVideos.has(videoId)) {
        card.classList.add('selected');
        card.querySelector('.select-checkbox').checked = true;
      } else {
        card.classList.remove('selected');
        card.querySelector('.select-checkbox').checked = false;
      }
    });
    
    updateSelectionCount();
  }
  
  function toggleSelect(videoId, checkbox, event) {
    event.stopPropagation();
    if (checkbox.checked) {
      selectedVideos.add(videoId);
    } else {
      selectedVideos.delete(videoId);
    }
    updateUI();
  }
  
  function updateSelectionCount() {
    const countEl = document.getElementById('selection-count');
    if (countEl) {
      const count = selectedVideos.size;
      countEl.textContent = count > 0 ? count + ' selected' : '';
    }
    
    const refreshBtn = document.getElementById('refresh-selected-btn');
    if (refreshBtn) {
      refreshBtn.disabled = selectedVideos.size === 0;
    }
  }
  
  function refreshSelected() {
    if (selectedVideos.size === 0) {
      alert('Select videos to refresh by clicking their checkboxes');
      return;
    }
    // Remove selected videos from myVideos - they'll be re-added on next fetch
    selectedVideos.forEach(videoId => {
      if (userData.myVideos[pageType]) {
        delete userData.myVideos[pageType][videoId];
      }
    });
    selectedVideos.clear();
    saveUserData().then(() => {
      alert('Selected videos will be refreshed on next update. Reload to see changes.');
    });
  }
  
  function showPendingNewVideos() {
    const banner = document.getElementById('new-videos-banner');
    const list = document.getElementById('new-videos-list');
    if (!banner || !list) return;
    
    const pending = userData.pendingNew.filter(v => v.pageType === pageType);
    if (pending.length === 0) {
      banner.classList.remove('visible');
      return;
    }
    
    list.innerHTML = pending.map(v => \`
      <div class="new-video-item">
        <span><strong>\${v.creator}</strong>: \${v.title}</span>
        <button onclick="addPendingVideo('\${v.videoId}')">Add to List</button>
      </div>
    \`).join('');
    
    banner.classList.add('visible');
  }
  
  function addPendingVideo(videoId) {
    const pending = userData.pendingNew.find(v => v.videoId === videoId);
    if (!pending) return;
    
    // Add to myVideos
    if (!userData.myVideos[pageType]) userData.myVideos[pageType] = {};
    userData.myVideos[pageType][videoId] = {
      added: Date.now(),
      creator: pending.creator
    };
    
    // Remove from pending
    userData.pendingNew = userData.pendingNew.filter(v => v.videoId !== videoId);
    
    saveUserData().then(() => {
      showPendingNewVideos();
      alert('Video added! Reload page to see it.');
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
      userData.watched = {};
      await saveUserData();
      updateUI();
    }
  }
  
  function hideWatched() {
    const hidden = document.body.classList.toggle('hide-watched');
    document.querySelectorAll('.video-card.watched').forEach(card => {
      card.style.display = hidden ? 'none' : 'block';
    });
  }
  
  // Initialize on load
  document.addEventListener('DOMContentLoaded', loadUserData);
`;

function generatePage(title, subtitle, categories, pageType) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="back-link">← Home</a>
    <a href="/settings" class="settings-link">+ Add Channel</a>
  </nav>
  <h1>${title}</h1>
  <p class="subtitle">${subtitle}</p>
  <div id="sync-status" class="sync-status">Loading...</div>
  
  <div id="new-videos-banner" class="new-videos-banner">
    <h3>📺 New Videos Available</h3>
    <div id="new-videos-list"></div>
  </div>
  
  <div class="controls">
    <button onclick="hideWatched()">Hide Watched</button>
    <button onclick="clearWatched()">Clear History</button>
    <button id="refresh-selected-btn" onclick="refreshSelected()" disabled>Refresh Selected</button>
    <span id="selection-count" class="selection-count"></span>
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
        
        html += `    <div class="video-card" data-video-id="${video.videoId}" data-creator="${escapeHtml(creator.creator)}">
      <input type="checkbox" class="select-checkbox" onclick="toggleSelect('${video.videoId}', this, event)">
      <div class="video-header" onclick="togglePlayer(this.parentElement, '${video.videoId}')">
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
  data.research,
  'research'
);
fs.writeFileSync('public/research.html', researchHtml);
console.log('✅ Built public/research.html');

// Build entertainment page
const entertainmentHtml = generatePage(
  '⛵ Entertainment Feed',
  'Sailing content for leisure time • Click to play',
  data.entertainment,
  'entertainment'
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
