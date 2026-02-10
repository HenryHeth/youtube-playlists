const puppeteer = require('puppeteer-core');

const CREATORS = {
  research: {
    'AI and Tech': [
      { name: 'Matt Wolfe', channel: '@mreflow' },
      { name: 'Matthew Berman', channel: '@matthew_berman' }
    ],
    'News and Finance': [
      { name: 'Claus Kellerman POV', channel: '@clauskellermanpov3004' },
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
          
          results.push({
            title: titleEl.textContent.trim(),
            url: href,
            views,
            dateStr
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
  console.log('Connecting to browser...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:18800',
    defaultViewport: null
  });
  
  const results = { research: {}, entertainment: {} };
  
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

// Run and save
fetchAllVideos().then(results => {
  const fs = require('fs');
  fs.writeFileSync('videos-data.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Saved to videos-data.json');
  
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
