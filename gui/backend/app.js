const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const llmRoutes = require('./routes/llm');

const app = express();

// CORS whitelist configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:5173', 'http://127.0.0.1:5000', 'http://127.0.0.1:5173'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '32kb' }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: '2026-05-05T20:00:00Z' });
});

// API version endpoint
app.get('/api/version', (req, res) => {
  res.json({
    version: '2.0.0',
    features: ['nested-aggregation', 'flattened-items'],
    buildTime: '2026-05-05T20:00:00Z'
  });
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/llm', llmRoutes);

// Root route to serve React app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Catch-all route for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

module.exports = app;
