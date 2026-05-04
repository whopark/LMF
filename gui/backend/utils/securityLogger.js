/**
 * Security event logger for audit trail
 * Logs authentication failures, authorization denials, and rate limits
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Format security event for logging
 */
function formatSecurityEvent(level, event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    event,
    ...details,
  };
  return JSON.stringify(logEntry);
}

/**
 * Log security event to console (structured JSON)
 */
function logSecurityEvent(level, event, details = {}) {
  const formatted = formatSecurityEvent(level, event, details);

  if (level === LOG_LEVELS.ERROR) {
    console.error(`[SECURITY] ${formatted}`);
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(`[SECURITY] ${formatted}`);
  } else {
    console.log(`[SECURITY] ${formatted}`);
  }
}

/**
 * Log authentication failure (401)
 */
function logAuthFailure(req, reason) {
  logSecurityEvent(LOG_LEVELS.WARN, 'AUTH_FAILURE', {
    reason,
    ip: req.ip || req.connection?.remoteAddress,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
  });
}

/**
 * Log authorization denial (403)
 */
function logAuthzDenied(req, reason) {
  logSecurityEvent(LOG_LEVELS.WARN, 'AUTHZ_DENIED', {
    reason,
    ip: req.ip || req.connection?.remoteAddress,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
  });
}

/**
 * Log rate limit exceeded (429)
 */
function logRateLimitExceeded(req) {
  logSecurityEvent(LOG_LEVELS.WARN, 'RATE_LIMIT_EXCEEDED', {
    ip: req.ip || req.connection?.remoteAddress,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
  });
}

/**
 * Log server configuration error
 */
function logConfigError(message) {
  logSecurityEvent(LOG_LEVELS.ERROR, 'CONFIG_ERROR', { message });
}

module.exports = {
  logAuthFailure,
  logAuthzDenied,
  logRateLimitExceeded,
  logConfigError,
  LOG_LEVELS,
};
