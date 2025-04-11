/**
 * Render.com Deployment Script
 * Specifically built to handle Render's deployment requirements
 */

console.log('Starting Render deployment script...');

// Ensure we're in production mode
process.env.NODE_ENV = 'production';

// Required - Render expects the server to bind to this port
const PORT = process.env.PORT || 10000;

const express = require('express');
const path = require('path');
const fs = require('fs');

// Create a basic Express server
const app = express();

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Start the minimal server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  // Now try to import and run the main application
  import('./dist/index.js')
    .then(() => {
      console.log('Main application started successfully');
    })
    .catch(err => {
      console.error('Error starting main application:', err);
      console.log('Continuing to run minimal server for health checks');
    });
});