#!/usr/bin/env node

/**
 * REPLIT PRODUCTION DEPLOYMENT SCRIPT
 * 
 * This is a CommonJS script that handles deployment on Replit
 * by starting a basic Express server that serves the built files
 * and provides a health check endpoint.
 */

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// CommonJS imports
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');

// Create Express app
const app = express();

// Serve static files from dist/public
const publicPath = path.join(process.cwd(), 'dist', 'public');
app.use(express.static(publicPath));

// Add health check endpoint
app.get('/', (req, res) => {
  // Browser detection for redirect
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html')) {
    return res.redirect('/dashboard');
  }
  
  // API health check response
  res.status(200).json({
    status: 'healthy',
    message: 'Shopify Integration Service is running',
    timestamp: new Date().toISOString()
  });
});

// For all other routes, serve the SPA index.html
app.get('*', (req, res) => {
  // API routes should return 404 if not handled elsewhere
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `API endpoint ${req.path} not found`
    });
  }
  
  // For all other routes, serve the SPA index.html
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Create HTTP server
const server = createServer(app);

// Start the server
const port = process.env.PORT;
server.listen(port, '0.0.0.0', () => {
  console.log(`\n===========================================`);
  console.log(`Server running in production mode on port ${port}`);
  console.log(`Health check is available at / (root)`);
  console.log(`Application is available at /dashboard and /login`);
  console.log(`===========================================\n`);
});