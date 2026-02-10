// Simple password auth - stores sessions in memory (resets on cold start)
// For production, use Vercel KV or a proper auth service

const VALID_PASSWORD = process.env.YT_APP_PASSWORD || 'ytcurated2026';
const sessions = new Map();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  if (action === 'login') {
    const { password } = req.body || {};
    if (password === VALID_PASSWORD) {
      const token = generateToken();
      sessions.set(token, { created: Date.now() });
      return res.status(200).json({ success: true, token });
    }
    return res.status(401).json({ success: false, error: 'Invalid password' });
  }

  if (action === 'verify') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && sessions.has(token)) {
      return res.status(200).json({ valid: true });
    }
    return res.status(401).json({ valid: false });
  }

  if (action === 'logout') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
