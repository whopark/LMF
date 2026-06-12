// Wraps 500 responses: logs full error internally, returns generic message to clients.
// Prevents internal stack traces and schema details from leaking to end users.
function serverError(res, err, route = '') {
  const caller = route || 'unknown route';
  console.error(`[${caller}]`, err.message, err.stack?.split('\n')[1]?.trim() || '');
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { serverError };
