const puppeteer = require('puppeteer-core');

// JSONBlob ID for channel config (same as settings page uses)
const CHANNELS_BLOB_ID = '019c516b-bbdc-7cd9-90eb-629115e8b924';

// Fallback channels if JSONBlob fails
const DEFAULT_CREATORS = {
  research: {
    'AI and Tech': [
      { name: 'Matt Wolfe', channel: '@mreflow' },
      { name: 'Matthew Berman', channel: '@matthew_berman' },
      { name: 'Nate B Jones', channel: '@NateBJones' }
    ],
    'News and Finance': [
      { name: 'Russell Matthews', channel: '@russellmatthews' },
      { name: 'Mark Mitchell', channel: '@MortgageBrokerLondonOntario' },
      { name: 'Ben Felix', channel: '@BenFelixCSI' }
    ],
    'Health': [
      { name: 'Doctor Alex', channel: '@DrAlexGeorge' },
      { name: 'Nutrition Made Simple!', channel: '@NutritionMadeSimple' },
      { name: 'Nick Norwitz', channel: '@nicknorwitzMDPhD' }
    ]
  },
  entertainment: {
    'Sailing': [
      { name: 'Practical Sailor', channel: '@practical-sailor' },
      { name: 'New Kids On The Dock', channel: '@Thenewkidsonthedock' },
      { name: 'Sailing Parlay Revival', channel: '@ParlayRevival' }
    ]
  }
};

// Load channels from JSONBlob (settings page database)
async function loadChannels() {
  try {
    const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${CHANNELS_BLOB_ID}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.channels) {
        console.log('Loaded channels from settings database');
        // Convert from JSONBlob format to fetcher format
        const creators = {};
        for (const [feed, categories] of Object.entries(data.channels)) {
          creators[feed] = {};
          for (const [cat, channels] of Object.entries(categories)) {
            creators[feed][cat] = channels.map(ch => ({
              name: ch.name,
              channel: ch.channel
            }));
          }
        }
        return creators;
      }
    }
  } catch (e) {
    console.log('Failed to load from JSONBlob, using defaults:', e.message);
  }
  return DEFAULT_CREATORS;
}

// Will be populated by loadChannels()
let CREATORS = DEFAULT_CREATORS;

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/\/watch\/([^?&]+)/);
  return match ? match[1] : null;
}

function getThumbnail(videoId) {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

async function getChannelVideos(browser, channelHandle, limit = 1) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
  
  const url = `https://www.youtube.com/${channelHandle}/videos`;
  console.log(`Fetching: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for video grid
    await page.waitForFunction(() => {
      return document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer').length > 0;
    }, { timeout: 15000 });
    
    // Extract video info including date
    const videos = await page.evaluate((limit) => {
      let items = document.querySelectorAll('ytd-rich-item-renderer');
      if (items.length === 0) {
        items = document.querySelectorAll('ytd-grid-video-renderer');
      }
      
      const results = [];
      
      for (let i = 0; i < Math.min(items.length, limit); i++) {
        const item = items[i];
        const titleEl = item.querySelector('#video-title-link, #video-title, a#video-title');
        const metaItems = item.querySelectorAll('#metadata-line span, .inline-metadata-item');
        
        if (titleEl) {
          let href = titleEl.href || titleEl.getAttribute('href');
          if (href && !href.startsWith('http')) {
            href = 'https://www.youtube.com' + href;
          }
          
          // Get views and date from meta
          let views = '';
          let dateStr = '';
          metaItems.forEach((el, idx) => {
            const text = el.textContent.trim();
            if (text.includes('view')) {
              views = text;
            } else if (text.includes('ago') || text.includes('hour') || text.includes('day') || text.includes('week') || text.includes('month') || text.includes('year')) {
              dateStr = text;
            }
          });
          
          // Get video duration from thumbnail overlay or aria-label
          let duration = '';
          const durationEl = item.querySelector('#overlays #text, ytd-thumbnail-overlay-time-status-renderer #text, span.ytd-thumbnail-overlay-time-status-renderer');
          if (durationEl) {
            duration = durationEl.textContent.trim();
          }
          // Fallback: try to get from aria-label which often contains duration
          if (!duration) {
            const ariaLabel = item.querySelector('#video-title')?.getAttribute('aria-label') || '';
            const durationMatch = ariaLabel.match(/(\d+:\d+(?::\d+)?)/);
            if (durationMatch) {
              duration = durationMatch[1];
            }
          }
          
          results.push({
            title: titleEl.textContent.trim(),
            url: href,
            views,
            dateStr,
            duration
          });
        }
      }
      return results;
    }, limit);
    
    // Post-process to add video IDs and thumbnails
    const processed = videos.map(v => {
      const videoId = extractVideoId(v.url);
      return {
        ...v,
        videoId,
        thumbnail: getThumbnail(videoId),
        isNew: isRecent(v.dateStr)
      };
    });
    
    await page.close();
    return processed;
  } catch (err) {
    console.error(`Error fetching ${channelHandle}: ${err.message}`);
    await page.close();
    return [];
  }
}

function isRecent(dateStr) {
  if (!dateStr) return false;
  const lower = dateStr.toLowerCase();
  // Consider "new" if posted within last 7 days
  if (lower.includes('hour') || lower.includes('minute') || lower.includes('second')) return true;
  if (lower.includes('day')) {
    const match = lower.match(/(\d+)\s*day/);
    if (match && parseInt(match[1]) <= 7) return true;
  }
  return false;
}

async function fetchAllVideos() {
  // Load channels from settings database
  CREATORS = await loadChannels();
  
  console.log('Connecting to browser...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800',
    defaultViewport: null
  });
  
  const results = { research: {}, entertainment: {}, news: {} };
  
  for (const [category, subcats] of Object.entries(CREATORS)) {
    results[category] = {};
    for (const [subcat, creators] of Object.entries(subcats)) {
      results[category][subcat] = [];
      for (const creator of creators) {
        console.log(`\nFetching ${creator.name}...`);
        const videos = await getChannelVideos(browser, creator.channel, 1);
        console.log(`  Got ${videos.length} videos`);
        if (videos.length > 0) {
          console.log(`  → ${videos[0].title.substring(0, 50)}... (${videos[0].dateStr})`);
        }
        results[category][subcat].push({
          creator: creator.name,
          channel: creator.channel,
          videos
        });
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  
  browser.disconnect();
  return results;
}

const JSONBLOB_ID = '019c547f-4dd8-779b-ba67-4d612b238762';
const BLOB_URL = `https://jsonblob.com/api/jsonBlob/${JSONBLOB_ID}`;

async function checkForNewVideos(results) {
  console.log('\n📡 Checking for new videos in user list...');
  
  try {
    // Fetch current user data
    const res = await fetch(BLOB_URL);
    const userData = await res.json();
    
    const myVideos = userData.myVideos || {};
    let pendingNew = userData.pendingNew || [];
    let newCount = 0;
    
    // Check each fetched video against user's list
    for (const [pageType, subcats] of Object.entries(results)) {
      const userPageVideos = myVideos[pageType] || {};
      
      for (const [subcat, creators] of Object.entries(subcats)) {
        for (const creator of creators) {
          for (const video of creator.videos) {
            // If video is not in user's list and not already pending
            if (!userPageVideos[video.videoId] && 
                !pendingNew.some(p => p.videoId === video.videoId)) {
              // Only add to pending if user has some videos (not first visit)
              if (Object.keys(userPageVideos).length > 0) {
                pendingNew.push({
                  videoId: video.videoId,
                  title: video.title,
                  creator: creator.creator,
                  channel: creator.channel,
                  pageType: pageType,
                  thumbnail: video.thumbnail,
                  dateStr: video.dateStr,
                  duration: video.duration,
                  addedAt: Date.now()
                });
                newCount++;
                console.log(`  📺 NEW: ${creator.creator} - ${video.title.substring(0, 40)}...`);
              }
            }
          }
        }
      }
    }
    
    if (newCount > 0) {
      // Save updated pending list
      userData.pendingNew = pendingNew;
      await fetch(BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      console.log(`✅ Added ${newCount} new videos to pending list`);
    } else {
      console.log('  No new videos found');
    }
  } catch (e) {
    console.error('Error checking for new videos:', e.message);
  }
}

// Run and save
fetchAllVideos().then(async (results) => {
  const fs = require('fs');
  fs.writeFileSync('videos-data.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Saved to videos-data.json');
  
  // Check for new videos and update user's pending list
  await checkForNewVideos(results);
  
  let total = 0;
  let newCount = 0;
  for (const cat of Object.values(results)) {
    for (const subcat of Object.values(cat)) {
      for (const creator of subcat) {
        for (const v of creator.videos) {
          total++;
          if (v.isNew) newCount++;
        }
      }
    }
  }
  console.log(`Total: ${total} videos (${newCount} new)`);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
