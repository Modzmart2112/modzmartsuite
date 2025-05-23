#!/usr/bin/env node

/**
 * Simple Deployment Script for Replit
 * 
 * This lightweight script:
 * 1. Sets up production environment
 * 2. Handles server binding for external access
 * 3. Provides health checks for Replit deployment
 * 4. Serves static files from dist/public
 */

// Import dependencies
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Set up __dirname for ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

console.log('=================================================');
console.log('SIMPLE DEPLOYMENT SCRIPT - PRODUCTION MODE');
console.log('=================================================');
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Create express app
const app = express();

// Set up static file serving
const publicPath = path.join(__dirname, 'dist', 'public');
if (fs.existsSync(publicPath)) {
  console.log(`Serving static files from ${publicPath}`);
  app.use(express.static(publicPath));
} else {
  console.log(`Warning: Public directory not found at ${publicPath}`);
}

// Add health check endpoint
app.get('/', (req, res) => {
  // Check if it's a browser request
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // If the browser is requesting the root, show a status page
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Application Deployment</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .success { color: green; }
          .box { border: 1px solid #ccc; padding: 20px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Server is running</h1>
        <p>Congratulations! Your application has been deployed successfully.</p>
        
        <div class="box">
          <h2>Server Information</h2>
          <ul>
            <li><strong>Status:</strong> <span class="success">Healthy</span></li>
            <li><strong>Environment:</strong> ${process.env.NODE_ENV}</li>
            <li><strong>Node Version:</strong> ${process.version}</li>
            <li><strong>Server Time:</strong> ${new Date().toLocaleString()}</li>
          </ul>
        </div>
      </body>
      </html>
    `);
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

// Start listening
const port = parseInt(process.env.PORT);
app.listen(port, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`✅ Server running on port ${port}`);
  console.log(`✅ Health check available at / (root URL)`);
  console.log(`✅ Static files served from ${publicPath}`);
  console.log(`=================================================\n`);
});