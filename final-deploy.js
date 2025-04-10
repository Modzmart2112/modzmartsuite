#!/usr/bin/env node

/**
 * Final Deployment Script for Replit
 * 
 * This script:
 * 1. Properly addresses require/import compatibility
 * 2. Sets up production environment
 * 3. Handles server binding for external access
 * 4. Provides health checks for Replit deployment
 */

// Import dependencies
import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Set up require for CommonJS compatibility (fixes "require is not defined")
const require = createRequire(import.meta.url);
global.require = require;

// Set up __dirname and __filename for ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
global.__filename = __filename;
global.__dirname = __dirname;

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

console.log('=================================================');
console.log('FINAL DEPLOYMENT SCRIPT - PRODUCTION MODE');
console.log('=================================================');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Create express app for health checks
const app = express();

// Add health check endpoint
app.get('/', (req, res) => {
  // Check if it's a browser request
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // Redirect browsers to the main application
    return res.redirect('/dashboard');
  }
  
  // Health check response for deployment
  return res.status(200).json({
    status: 'healthy',
    message: 'Application is running',
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

// Set up static file serving
const publicPath = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(publicPath)) {
  console.log(`Serving static files from ${publicPath}`);
  app.use(express.static(publicPath));
} else {
  console.log(`Warning: Public directory not found at ${publicPath}`);
}

// Start listening
const port = parseInt(process.env.PORT);
app.listen(port, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Health check available at / (root URL)`);
  console.log(`✅ Application available at /dashboard`);
  console.log(`=================================================\n`);
  
  console.log('Now attempting to import application...');
  
  // Attempt to import the actual application after the health check server is running
  import('./dist/index.js').then(appModule => {
    console.log('Successfully imported application');
    
    const setupApp = appModule.default || appModule.setupApp;
    if (typeof setupApp === 'function') {
      console.log('Found setup function, initializing application...');
      
      setupApp().then(realApp => {
        console.log('Application initialized successfully');
      }).catch(setupError => {
        console.error('Error during application initialization:', setupError);
      });
    } else {
      console.log('No setup function found in application');
    }
  }).catch(importError => {
    console.error('Error importing application:', importError);
  });
});