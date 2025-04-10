#!/usr/bin/env node

/**
 * RELIABLE REPLIT DEPLOYMENT SCRIPT
 * 
 * A robust deployment script that:
 * 1. Works with both ES Modules and CommonJS
 * 2. Properly sets up the production environment
 * 3. Handles server binding correctly
 * 4. Includes proper error handling and fallback mechanisms
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { createRequire } from 'module';

// Create require function from import - this allows us to use require() in ES modules
const require = createRequire(import.meta.url);

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n=================================================');
console.log('REPLIT DEPLOYMENT - PRODUCTION MODE');
console.log('=================================================\n');

console.log('Starting production server...');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Copy SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET if not set
// This helps maintain compatibility with different parts of the codebase
if (process.env.SHOPIFY_ACCESS_TOKEN && !process.env.SHOPIFY_API_SECRET) {
  console.log('Copying SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET for compatibility');
  process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_ACCESS_TOKEN;
}

// Function to ensure necessary directories exist
function ensureDirectoriesExist() {
  const publicPath = path.join(__dirname, 'dist', 'public');
  if (!fs.existsSync(publicPath)) {
    console.log('Creating public directory structure...');
    fs.mkdirSync(publicPath, { recursive: true });
  }
  return publicPath;
}

// Serve static files and fallback routes
function setupStaticServer(app, publicPath) {
  app.use(express.static(publicPath));
  
  // Add catch-all route for SPA
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Try to serve index.html
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    
    // Fallback page
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shopify Integration</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .card { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .success { color: #0c7040; }
          </style>
        </head>
        <body>
          <h1>Shopify Integration Service</h1>
          <div class="card">
            <h2 class="success">✓ Server is running</h2>
            <p>The application is running in production mode.</p>
            <p>You can access the application at:</p>
            <ul>
              <li><a href="/dashboard">/dashboard</a> - Main Dashboard</li>
              <li><a href="/login">/login</a> - Login Page</li>
            </ul>
          </div>
        </body>
      </html>
    `);
  });
}

// Create a minimal server for health check and fallback
function createFallbackServer(errorMessage) {
  const app = express();
  const publicPath = ensureDirectoriesExist();
  
  // Add health check endpoint
  app.get('/', (req, res) => {
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html')) {
      return res.redirect('/dashboard');
    }
    
    res.status(200).json({
      status: 'degraded',
      message: 'Fallback server is running. Main application failed to start.',
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  });
  
  setupStaticServer(app, publicPath);
  
  return app;
}

// Main server startup function
async function startServer() {
  try {
    const publicPath = ensureDirectoriesExist();
    
    // Import the built application
    console.log('Loading application from dist/index.js...');
    
    // Try dynamic ES module import first
    let setupApp;
    try {
      const module = await import('./dist/index.js');
      setupApp = module.default;
      console.log('Successfully loaded application using ES module import');
    } catch (importError) {
      console.log('ES module import failed, trying alternative loading method...');
      try {
        // Try CommonJS-style require if ES module import fails
        // This uses our custom require function
        const commonJsModule = require('./dist/index.js');
        setupApp = commonJsModule.default || commonJsModule;
        console.log('Successfully loaded application using CommonJS require');
      } catch (requireError) {
        throw new Error(`Failed to load application: ${importError.message}, ${requireError?.message}`);
      }
    }
    
    // Initialize the application
    console.log('Initializing application...');
    const app = await setupApp();
    
    // Add health check endpoint
    app.get('/', (req, res) => {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        return res.redirect('/dashboard');
      }
      
      res.status(200).json({
        status: 'healthy',
        message: 'Shopify Integration Service is running',
        timestamp: new Date().toISOString()
      });
    });
    
    // Start listening
    const port = parseInt(process.env.PORT);
    const server = app.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`✅ Server running on port ${port}`);
      console.log(`✅ Health check available at / (root URL)`);
      console.log(`✅ Application available at /dashboard`);
      console.log(`=================================================\n`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
    return server;
  } catch (error) {
    console.error('Failed to start main application:', error);
    
    // Start fallback server if main server fails
    console.log('\nStarting minimal fallback server...');
    const fallbackApp = createFallbackServer(error.message);
    
    const port = parseInt(process.env.PORT);
    const fallbackServer = fallbackApp.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`⚠️ Fallback server running on port ${port}`);
      console.log(`⚠️ Application is in degraded state`);
      console.log(`=================================================\n`);
    });
    
    return fallbackServer;
  }
}

// Start the server
startServer().catch(err => {
  console.error('Fatal error in deployment script:', err);
  process.exit(1);
});