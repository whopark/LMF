const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const llmRoutes = require('./routes/llm');
const { engine } = require('./config/db');

const app = express();

// Check if frontend dist exists (not in Docker)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const hasFrontend = fs.existsSync(frontendDistPath);

// CORS whitelist configuration
const defaultOrigins = [
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
  'https://whopark.github.io'
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;

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
app.use(express.json({ limit: '50mb' }));
// C2: Sanitize req.body / req.query / req.params to block NoSQL operator injection.
// allowDots:true preserves legitimate keys like 'about_item.question' in PATCH bodies.
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({ allowDots: true }));

// Serve static files from the React app (only if frontend exists)
if (hasFrontend) {
  app.use(express.static(frontendDistPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  // SPEC-DB-001 Phase 7: surface the active DB engine for cutover/rollback verification.
  res.json({ status: 'ok', version: '2.0.0', engine: engine(), timestamp: '2026-05-05T20:00:00Z' });
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

// Root and catch-all routes (only if frontend exists)
if (hasFrontend) {
  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // API-only mode
  app.get('/', (req, res) => {
    res.json({
      name: 'LMF API',
      version: '2.0.0',
      endpoints: ['/api/items', '/api/filters', '/api/items/:code', '/health']
    });
  });
}

module.exports = app;
