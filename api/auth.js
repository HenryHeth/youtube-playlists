// Email/password auth with account creation
// Stores accounts in JSONBlob for persistence

const ACCOUNTS_BLOB_ID = process.env.ACCOUNTS_BLOB_ID || 'yt-accounts-store';
const sessions = new Map();

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Simple hash for passwords (not cryptographically secure - use bcrypt in production)
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36) + password.length;
}

async function getAccounts() {
  try {
    const resp = await fetch(`https://jsonblob.com/api/jsonBlob/${ACCOUNTS_BLOB_ID}`);
    if (resp.ok) {
      return await resp.json();
    }
  } catch (e) {}
  return { users: {} };
}

async function saveAccounts(accounts) {
  try {
    await fetch(`https://jsonblob.com/api/jsonBlob/${ACCOUNTS_BLOB_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accounts)
    });
    return true;
  } catch (e) {
    // Try to create if doesn't exist
    try {
      const resp = await fetch('https://jsonblob.com/api/jsonBlob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accounts)
      });
      return resp.ok;
    } catch (e2) {
      return false;
    }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  // Create account
  if (action === 'signup') {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    
    const emailLower = email.toLowerCase().trim();
    const accounts = await getAccounts();
    
    if (accounts.users[emailLower]) {
      return res.status(400).json({ success: false, error: 'Account already exists' });
    }
    
    accounts.users[emailLower] = {
      passwordHash: hashPassword(password),
      createdAt: Date.now()
    };
    
    const saved = await saveAccounts(accounts);
    if (!saved) {
      return res.status(500).json({ success: false, error: 'Failed to create account' });
    }
    
    // Auto-login after signup
    const token = generateToken();
    sessions.set(token, { email: emailLower, created: Date.now() });
    
    return res.status(200).json({ success: true, token, email: emailLower });
  }

  // Login
  if (action === 'login') {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }
    
    const emailLower = email.toLowerCase().trim();
    const accounts = await getAccounts();
    const user = accounts.users[emailLower];
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }
    
    if (user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }
    
    const token = generateToken();
    sessions.set(token, { email: emailLower, created: Date.now() });
    
    return res.status(200).json({ success: true, token, email: emailLower });
  }

  // Verify token
  if (action === 'verify') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token && sessions.has(token)) {
      const session = sessions.get(token);
      return res.status(200).json({ valid: true, email: session.email });
    }
    return res.status(401).json({ valid: false });
  }

  // Logout
  if (action === 'logout') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
