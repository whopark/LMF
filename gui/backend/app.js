const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');
const llmRoutes = require('./routes/llm');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

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
