// Alternative CommonJS entrypoint for deployment
// This file should be used with: node start.js
// It avoids problems with ES modules

const express = require('express');
const path = require('path');
const app = express();
const fs = require('fs');

// Set to production mode
process.env.NODE_ENV = 'production';

console.log('Starting application in production mode via start.js');
console.log('Node version:', process.version);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic status endpoint for health checks
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', serverTime: new Date().toISOString() });
});

// API endpoint to check DB connection
app.get('/api/db-status', async (req, res) => {
  try {
    // Try to dynamically import the DB module
    const { pool } = await import('./server/db.js');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({ 
      status: 'connected', 
      timestamp: result.rows[0].now,
      message: 'Database connection successful' 
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: err.message
    });
  }
});

// Catch-all route for SPA
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