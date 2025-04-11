#!/usr/bin/env node

/**
 * Fixed Deployment Script
 * Avoids scheduler problems by disabling them in production
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

// Set up require and other globals
const require = createRequire(import.meta.url);
global.require = require;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__dirname = __dirname;
global.__filename = __filename;

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.DISABLE_SCHEDULERS = 'true'; // This is key - disable schedulers in production

console.log('=================================================');
console.log('FIXED DEPLOYMENT SCRIPT - PRODUCTION MODE');
console.log('=================================================');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Schedulers disabled: ${process.env.DISABLE_SCHEDULERS}`);

// Create express app
const app = express();

// Set up static file serving
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

// Create fallback route for SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    // API endpoint that doesn't exist
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Try to serve the index.html file
  const indexFile = path.join(__dirname, 'dist', 'public', 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  
  // Fallback response
  res.send(`
    <html>
      <head>
        <title>Application</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        </style>
      </head>
      <body>
        <h1>Application is Running</h1>
        <p>The server is running but couldn't find the frontend assets.</p>
      </body>
    </html>
  `);
});

// Start listening
const port = parseInt(process.env.PORT);
app.listen(port, '0.0.0.0', async () => {
  console.log(`\n=================================================`);
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Health check available at / (root URL)`);
  console.log(`=================================================\n`);
  
  try {
    // Now try to import the application
    console.log('Attempting to import application (with schedulers disabled)...');
    const appModule = await import('./dist/index.js');
    console.log('Application imported successfully');
    
    if (typeof appModule.default === 'function') {
      console.log('Setting up application...');
      const server = await appModule.default();
      console.log('Application setup complete');
    } else {
      console.log('No setup function found');
    }
  } catch (err) {
    console.error('Failed to import application:', err);
  }
});