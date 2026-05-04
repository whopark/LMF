const crypto = require('crypto');

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against itself to maintain constant time
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * API Key authentication middleware
 * Validates x-api-key header against API_KEY environment variable
 */
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_KEY;

  if (!validKey) {
    console.error('API_KEY not configured in environment');
    return res.status(500).json({ message: 'Server authentication not configured' });
  }

  if (!apiKey) {
    return res.status(401).json({ message: 'API key required' });
  }

  if (!timingSafeCompare(apiKey, validKey)) {
    return res.status(403).json({ message: 'Invalid API key' });
  }

  next();
}

module.exports = { requireApiKey };
