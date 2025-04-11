#!/usr/bin/env node

/**
 * Incremental Deployment Script
 * Gradually adds functionality to identify what's causing failures
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

// Set up require for the built application
const require = createRequire(import.meta.url);
global.require = require; // Make require available globally for compatibility

// Set up dirname/filename for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__dirname = __dirname;
global.__filename = __filename;

// Set environment to production
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Create express app
const app = express();

// Static files
const publicPath = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(publicPath)) {
  console.log(`Serving static files from ${publicPath}`);
  app.use(express.static(publicPath));
}

// Health check endpoint
app.get('/', (req, res) => {
  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Fallback route
app.get('*', (req, res) => {
  res.send('App is running');
});

// Start server
const port = parseInt(process.env.PORT);
app.listen(port, '0.0.0.0', async () => {
  console.log(`Incremental server running on port ${port}`);
  
  try {
    // Try to import the dist/index.js file WITHOUT executing it
    console.log('Attempting to load application code (but not executing it)...');
    const appModule = await import('./dist/index.js');
    console.log('Application code loaded successfully!');
    console.log('Available exports:', Object.keys(appModule));
  } catch (err) {
    console.error('Failed to load application:', err);
  }
});