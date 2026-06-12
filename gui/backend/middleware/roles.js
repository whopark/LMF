const jwt = require('jsonwebtoken');
const crypto = require('crypto');

if (!process.env.JWT_SECRET) {
  console.warn('[roles] WARNING: JWT_SECRET env var not set — using dev-secret, UNSAFE for production!');
}

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY = { viewer: 0, editor: 1, approver: 2, admin: 3 };

function hasRole(userRole, minRole) {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? 99);
}

/**
 * Middleware: require JWT auth with optional minimum role.
 * Falls back to API key (treated as admin) for backward compatibility
 * with existing test suite and CLI tools.
 *
 * @param {string} [minRole='viewer'] - minimum required role
 */
function requireAuth(minRole = 'viewer') {
  return (req, res, next) => {
    const secret = process.env.JWT_SECRET || 'dev-secret';

    // Try JWT Bearer token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, secret);
        req.user = payload;
        if (!hasRole(payload.role, minRole)) {
          return res.status(403).json({
            message: 'Insufficient permissions',
            required: minRole,
            actual: payload.role,
          });
        }
        return next();
      } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    }

    // Legacy API key fallback — treated as admin for backward compat
    // x-user header (URL-encoded) provides human identity when API key is used
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;
    const validKey = process.env.API_KEY;
    if (apiKey && validKey && timingSafeEqual(apiKey, validKey)) {
      const rawXUser = req.headers['x-user'] || '';
      const xUserName = rawXUser ? decodeURIComponent(rawXUser) : 'api-key-user';
      req.user = { name: xUserName, role: 'admin' };
      return next();
    }

    return res.status(401).json({ message: 'Authentication required' });
  };
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // dummy compare to maintain timing
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = { requireAuth, hasRole, ROLE_HIERARCHY };
