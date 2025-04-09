// CommonJS entrypoint for deployment
// This file is explicitly named .cjs to avoid ES module issues
// Use this with: node start.cjs

// Set to production mode
process.env.NODE_ENV = 'production';

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

console.log('Starting application in production mode via start.cjs');
console.log('Node version:', process.version);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic status endpoint for health checks
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', serverTime: new Date().toISOString() });
});

// Fallback route to serve the SPA
app.get('*', (req, res) => {
  // If it's an API request that wasn't caught, return 404
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Otherwise serve the SPA
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Listen on port 5000 (essential for Replit)
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});