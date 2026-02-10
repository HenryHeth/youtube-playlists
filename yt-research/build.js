const fs = require('fs');
const data = JSON.parse(fs.readFileSync('videos-data.json', 'utf8'));

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
  h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
  .subtitle { color: #aaa; font-size: 14px; margin-bottom: 30px; }
  .sync-status { font-size: 12px; color: #666; margin-bottom: 10px; }
  .sync-status.synced { color: #4a4; }
  .sync-status.syncing { color: #aa4; }
  .category { margin-bottom: 40px; }
  .category h2 { font-size: 20px; margin-bottom: 16px; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; }
  .video-card { background: #1a1a1a; border-radius: 12px; overflow: hidden; margin-bottom: 20px; transition: opacity 0.3s; }
  .video-card.watched { opacity: 0.5; }
  .video-card.watched .video-title::before { content: "✓ "; color: #4a4; }
  .video-header { display: flex; gap: 16px; padding: 16px; cursor: pointer; }
  .video-header:hover { background: #252525; }
  .thumb-container { position: relative; flex-shrink: 0; }
  .thumb { width: 200px; height: 112px; border-radius: 8px; object-fit: cover; background: #333; }
  .new-badge { position: absolute; top: 6px; left: 6px; background: #ff0000; color: #fff; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
  .unwatch-btn { background: #333; color: #aaa; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; margin-left: auto; }
  .unwatch-btn:hover { background: #444; color: #fff; }
  .video-card:not(.watched) .unwatch-btn { display: none; }
  .video-info { flex: 1; min-width: 0; }
  .creator-name { font-size: 12px; color: #888; margin-bottom: 4px; }
  .video-title { font-size: 16px; font-weight: 500; color: #fff; line-height: 1.4; margin-bottom: 8px; }
  .video-meta { display: flex; gap: 12px; font-size: 13px; color: #888; }
  .player-container { display: none; background: #000; }
  .player-container.active { display: block; }
  .player-container iframe { width: 100%; aspect-ratio: 16/9; border: none; }
  .controls { display: flex; gap: 12px; margin-bottom: 20px; }
  .controls button { background: #333; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; }
  .controls button:hover { background: #444; }
  .updated { text-align: center; color: #555; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #222; }
  @media (max-width: 600px) { .video-header { flex-direction: column; } .thumb { width: 100%; height: auto; aspect-ratio: 16/9; } }
`;

const JS = `
  const API_URL = '/api/watched';
  let watchedData = {};
  let syncTimeout = null;
  let watchTimers = {};
  
  async function loadWatched() {
    setStatus('syncing', 'Loading...');
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      watchedData = data.watched || {};
      localStorage.setItem('yt-watched', JSON.stringify(watchedData));
      updateWatchedUI();
      setStatus('synced', 'Synced ✓');
    } catch (e) {
      console.error('Load failed:', e);
      try { watchedData = JSON.parse(localStorage.getItem('yt-watched') || '{}'); updateWatchedUI(); } catch {}
      setStatus('error', 'Offline mode');
    }
  }
  
  async function saveWatched() {
    setStatus('syncing', 'Saving...');
    try {
      await fetch(API_URL, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ watched: watchedData }) 
      });
      localStorage.setItem('yt-watched', JSON.stringify(watchedData));
      setStatus('synced', 'Synced ✓');
    } catch (e) { 
      console.error('Save failed:', e);
      setStatus('error', 'Sync failed'); 
    }
  }
  
  function debouncedSave() { clearTimeout(syncTimeout); syncTimeout = setTimeout(saveWatched, 500); }
  function setStatus(cls, text) { const el = document.getElementById('sync-status'); if (el) { el.className = 'sync-status ' + cls; el.textContent = text; } }
  function setWatched(videoId, card) { 
    watchedData[videoId] = Date.now(); 
    debouncedSave(); 
    if (card) {
      card.classList.add('watched');
      const badge = card.querySelector('.new-badge');
      if (badge) badge.style.display = 'none';
    }
  }
  function setUnwatched(videoId, card, e) {
    e.stopPropagation();
    delete watchedData[videoId];
    debouncedSave();
    if (card) {
      card.classList.remove('watched');
      if (card.dataset.isNew === 'true') {
        const badge = card.querySelector('.new-badge');
        if (badge) badge.style.display = 'block';
      }
    }
  }
  function isWatched(videoId) { return !!watchedData[videoId]; }
  function updateWatchedUI() { 
    document.querySelectorAll('.video-card').forEach(card => { 
      const vid = card.dataset.videoId;
      const watched = isWatched(vid);
      card.classList.toggle('watched', watched);
      const badge = card.querySelector('.new-badge');
      if (badge && watched) badge.style.display = 'none';
    }); 
  }
  
  function togglePlayer(card, videoId) {
    const container = card.querySelector('.player-container');
    const isActive = container.classList.contains('active');
    // Clear all other players and timers
    document.querySelectorAll('.player-container.active').forEach(p => { 
      p.classList.remove('active'); 
      p.innerHTML = ''; 
    });
    Object.keys(watchTimers).forEach(id => { clearTimeout(watchTimers[id]); delete watchTimers[id]; });
    
    if (!isActive) {
      container.innerHTML = '<iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
      container.classList.add('active');
      // Mark watched after 30 seconds
      watchTimers[videoId] = setTimeout(() => {
        if (!isWatched(videoId)) {
          setWatched(videoId, card);
        }
      }, 30000);
    }
  }
  
  async function clearWatched() { if (confirm('Clear all watched markers?')) { watchedData = {}; await saveWatched(); updateWatchedUI(); } }
  function hideWatched() { document.querySelectorAll('.video-card.watched').forEach(card => { card.style.display = card.style.display === 'none' ? 'block' : 'none'; }); }
  document.addEventListener('DOMContentLoaded', loadWatched);
`;

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🔬 Research Feed</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>🔬 Research Feed</h1>
  <p class="subtitle">Curated videos from AI, Finance, and Health creators • Click to play</p>
  <div id="sync-status" class="sync-status">Loading...</div>
  <div class="controls">
    <button onclick="hideWatched()">Toggle Watched</button>
    <button onclick="clearWatched()">Clear History</button>
    <button onclick="loadWatched()">Refresh</button>
  </div>
`;

for (const [catName, creators] of Object.entries(data.research)) {
  html += `<div class="category"><h2>${catName}</h2>`;
  for (const creator of creators) {
    for (const video of creator.videos) {
      const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
      const newBadge = video.isNew ? '<span class="new-badge">NEW</span>' : '';
      html += `<div class="video-card" data-video-id="${video.videoId}" data-is-new="${video.isNew ? 'true' : 'false'}" onclick="togglePlayer(this, '${video.videoId}')">
        <div class="video-header">
          <div class="thumb-container"><img class="thumb" src="${thumb}" alt="" loading="lazy">${newBadge}</div>
          <div class="video-info">
            <div class="creator-name">${escapeHtml(creator.creator)}</div>
            <div class="video-title">${escapeHtml(video.title)}</div>
            <div class="video-meta"><span>${escapeHtml(video.dateStr || '')}</span><span>${escapeHtml(video.views || '')}</span></div>
          </div>
          <button class="unwatch-btn" onclick="setUnwatched('${video.videoId}', this.closest('.video-card'), event)">Mark Unwatched</button>
        </div>
        <div class="player-container"></div>
      </div>`;
    }
  }
  html += `</div>`;
}

const now = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' });
html += `<div class="updated">Last updated: ${now} PST</div><script>${JS}</script></body></html>`;

fs.writeFileSync('public/index.html', html);
console.log('✅ Built research page');
