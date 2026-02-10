// Vercel API route - proxies to JSONBlob to bypass CORS
const BLOB_IDS = {
  research: '019c48c6-b141-7c1f-a893-5de4c2335f8e',
  entertainment: '019c48c7-1234-7c1f-a893-entertainment',
  news: '019c48c7-5678-7c1f-a893-news'
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { feed } = req.query;
  const blobId = BLOB_IDS[feed] || BLOB_IDS.research;
  const url = `https://jsonblob.com/api/jsonBlob/${blobId}`;

  try {
    if (req.method === 'GET') {
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(200).json({ watched: {} });
      }
      const data = await response.json();
      return res.status(200).json(data);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      if (!response.ok) {
        // Create new blob if doesn't exist
        const createResp = await fetch('https://jsonblob.com/api/jsonBlob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.body)
        });
        const newUrl = createResp.headers.get('location');
        return res.status(200).json({ success: true, url: newUrl });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
}
