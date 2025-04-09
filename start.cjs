// Super Simple CommonJS Entrypoint for Replit Deployment
// This file uses the simplest possible approach to start the server
// and avoids any complex dependencies or ES module issues

// Set to production mode
process.env.NODE_ENV = 'production';

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');

console.log('Starting application in production mode via start.cjs');
console.log('Node version:', process.version);

// Create Express app
const app = express();

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic API health endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    mode: 'production',
    serverTime: new Date().toISOString() 
  });
});

// Serve frontend for all non-API routes (SPA support)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Serve the SPA
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Simple 404 handler for API routes that weren't matched
app.use('/api/', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.path} not found`
  });
});

// Start the server on port 5000
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});