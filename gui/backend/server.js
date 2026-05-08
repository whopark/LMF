require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

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
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
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
