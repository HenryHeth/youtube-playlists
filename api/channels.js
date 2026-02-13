// User channel management API
// Stores channel lists per user in JSONBlob

const CHANNELS_BLOB_ID = process.env.CHANNELS_BLOB_ID || '019c516b-bbdc-7cd9-90eb-629115e8b924';

// Category detection based on channel content/name
function detectCategory(channelName, channelUrl) {
  const name = channelName.toLowerCase();
  const url = channelUrl.toLowerCase();
  
  // News keywords
  if (name.includes('news') || name.includes('cnn') || name.includes('bbc') || 
      name.includes('global') || name.includes('ctv') || name.includes('politics') ||
      name.includes('brian tyler cohen') || name.includes('kellerman')) {
    return { feed: 'news', category: 'News' };
  }
  
  // Sailing/Entertainment
  if (name.includes('sail') || name.includes('boat') || name.includes('yacht') ||
      name.includes('dock') || name.includes('parlay') || name.includes('cruising')) {
    return { feed: 'entertainment', category: 'Sailing' };
  }
  
  // Health
  if (name.includes('doctor') || name.includes('health') || name.includes('nutrition') ||
      name.includes('fitness') || name.includes('medical') || name.includes('norwitz')) {
    return { feed: 'research', category: 'Health' };
  }
  
  // Finance
  if (name.includes('finance') || name.includes('money') || name.includes('invest') ||
      name.includes('mortgage') || name.includes('felix') || name.includes('stock')) {
    return { feed: 'research', category: 'News and Finance' };
  }
  
  // AI/Tech
  if (name.includes('ai') || name.includes('tech') || name.includes('code') ||
      name.includes('wolfe') || name.includes('berman') || name.includes('artificial')) {
    return { feed: 'research', category: 'AI and Tech' };
  }
  
  // Default to research/general
  return { feed: 'research', category: 'General' };
}

// Extract channel handle from various URL formats
function parseChannelUrl(url) {
  const patterns = [
    /youtube\.com\/@([^\/\?]+)/,
    /youtube\.com\/channel\/([^\/\?]+)/,
    /youtube\.com\/c\/([^\/\?]+)/,
    /youtube\.com\/user\/([^\/\?]+)/,
    /youtube\.com\/watch\?v=[^&]+.*&?list=[^&]+/  // Playlist - need different handling
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const handle = match[1];
      return handle.startsWith('@') ? handle : `@${handle}`;
    }
  }
  
  // If just a handle was pasted
  if (url.startsWith('@')) return url;
  if (!url.includes('/') && !url.includes('.')) return `@${url}`;
  
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  // Get all channels
  if (action === 'list' && req.method === 'GET') {
    try {
      const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`);
      if (!resp.ok) {
        return res.status(200).json({ channels: { research: {}, entertainment: {}, news: {} } });
      }
      const data = await resp.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({ channels: { research: {}, entertainment: {}, news: {} } });
    }
  }

  // Add a channel
  if (action === 'add' && req.method === 'POST') {
    const { url, name, feed, category } = req.body || {};
    
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }
    
    const handle = parseChannelUrl(url);
    if (!handle) {
      return res.status(400).json({ error: 'Could not parse channel URL' });
    }
    
    // Auto-detect category if not provided
    const detected = detectCategory(name || handle, url);
    const finalFeed = feed || detected.feed;
    const finalCategory = category || detected.category;
    
    // Get current channels
    let channels = { research: {}, entertainment: {}, news: {} };
    try {
      const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`);
      if (resp.ok) {
        const data = await resp.json();
        channels = data.channels || channels;
      }
    } catch (e) {}
    
    // Add channel
    if (!channels[finalFeed]) channels[finalFeed] = {};
    if (!channels[finalFeed][finalCategory]) channels[finalFeed][finalCategory] = [];
    
    // Check if already exists
    const exists = channels[finalFeed][finalCategory].some(c => c.channel === handle);
    if (exists) {
      return res.status(400).json({ error: 'Channel already exists' });
    }
    
    channels[finalFeed][finalCategory].push({
      name: name || handle.replace('@', ''),
      channel: handle,
      addedAt: Date.now()
    });
    
    // Save
    await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    });
    
    return res.status(200).json({ 
      success: true, 
      channel: { name: name || handle, handle, feed: finalFeed, category: finalCategory }
    });
  }

  // Remove a channel
  if (action === 'remove' && req.method === 'DELETE') {
    const { handle, feed, category } = req.body || {};
    
    // Get and update channels
    let channels = { research: {}, entertainment: {}, news: {} };
    try {
      const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`);
      if (resp.ok) {
        const data = await resp.json();
        channels = data.channels || channels;
      }
    } catch (e) {}
    
    if (channels[feed]?.[category]) {
      channels[feed][category] = channels[feed][category].filter(c => c.channel !== handle);
    }
    
    await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels })
    });
    
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
