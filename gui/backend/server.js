require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');
const { engine, knex } = require('./config/db');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lab_accreditation';

// MongoDB connection with caching for serverless
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    });
    isConnected = true;
    console.log('Connected to MongoDB');

    // SPEC-DB-001 Phase 7: cutover read/write paths use PostgreSQL when DB_ENGINE=pg
    // (non-cutover paths stay on MongoDB — hybrid). Verify PG at startup (fail-fast) and
    // log the active engine. Rollback = unset DB_ENGINE (defaults to mongo).
    if (engine() === 'pg') {
      await knex().raw('select 1');
      console.log('DB_ENGINE=pg — cutover paths on PostgreSQL, non-cutover paths on MongoDB');
    } else {
      console.log('DB_ENGINE=mongo — all paths on MongoDB');
    }
  } catch (err) {
    console.error('DB connection error:', err.message);
    throw err;
  }
};

// For Vercel serverless
if (process.env.VERCEL) {
  // Connect on first request
  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (_err) {
      res.status(500).json({ error: 'Database connection failed' });
    }
  });
} else {
  // Traditional server mode
  console.log('Starting server...');
  console.log('PORT:', PORT);
  console.log('MONGO_URI:', MONGO_URI ? MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'NOT SET');

  connectDB()
    .then(() => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch(_err => {
      process.exit(1);
    });
}

// Export for Vercel
module.exports = app;
