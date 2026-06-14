// Design Ref: §5.2 — transaction wrapper for atomic revision writes (G1).
// Requires a replica-set MongoDB connection (session.withTransaction).
const mongoose = require('mongoose');

// Runs fn(session) inside a transaction. session.withTransaction auto-retries
// transient transaction errors and commits on success. The session is always ended.
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { withTransaction };
