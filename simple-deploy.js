// Simplest possible deployment script for Replit
// This will just serve the static frontend files
const express = require('express');
const path = require('path');

// Create Express app
const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'static-only',
    time: new Date().toISOString(),
    env: Object.keys(process.env).includes('DATABASE_URL') ? 'database configured' : 'no database'
  });
});

// All other routes serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server running on port ${PORT}`);
});