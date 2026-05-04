require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/lab_accreditation';

// Log startup info
console.log('Starting server...');
console.log('PORT:', PORT);
console.log('MONGO_URI:', MONGO_URI ? MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'NOT SET');

// Connect to MongoDB and start server
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
})
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
