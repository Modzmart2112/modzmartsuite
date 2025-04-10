#!/usr/bin/env node

/**
 * REPLIT PRODUCTION DEPLOYMENT SCRIPT
 * 
 * This is the main entry point for Replit deployment.
 * - It initializes the environment for production
 * - Loads the properly built application from the dist directory
 * - Ensures the server binds to 0.0.0.0 for external access
 * - Provides fallback functionality if the main app fails
 * - Includes health checks for Replit deployment
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Define constants for ES modules (which don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting Replit production deployment...');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);

// Ensure we have a public directory for static files
const publicPath = path.join(__dirname, 'dist', 'public');
if (!fs.existsSync(publicPath)) {
  console.log('Creating public directory structure...');
  fs.mkdirSync(publicPath, { recursive: true });
}

// Main server boot function
async function startServer() {
  try {
    // Load the built application
    console.log('Loading application from dist/index.js...');
    const { default: setupApp } = await import('./dist/index.js');
    
    console.log('Initializing application...');
    const app = await setupApp();
    
    // Add root health check endpoint
    app.get('/', (req, res) => {
      // Check if it's a browser request 
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        return res.redirect('/dashboard');
      }
      
      // Return health check response
      res.status(200).json({
        status: 'healthy',
        env: 'production',
        message: 'Shopify Integration service is running',
        timestamp: new Date().toISOString()
      });
    });
    
    // Start listening on proper host and port
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
    
    // If the main application fails, start a minimal server that just serves static
    // files and provides a health check endpoint for Replit
    console.log('\nStarting minimal fallback server...');
    const fallbackApp = express();
    
    // Serve static files
    fallbackApp.use(express.static(publicPath));
    
    // Health check endpoint
    fallbackApp.get('/', (req, res) => {
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        return res.redirect('/dashboard');
      }
      
      res.status(200).json({
        status: 'degraded',
        message: 'Fallback server is running. Main application failed to start.',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
    
    // Catch-all route for SPA
    fallbackApp.get('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        return res.status(503).json({ 
          error: 'Service Unavailable', 
          message: 'API is currently unavailable. The application is running in fallback mode.'
        });
      }
      
      // Try to serve index.html
      const indexPath = path.join(publicPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      
      // Emergency fallback page
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Shopify Integration</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
              .card { border: 1px solid #e1e1e1; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .warning { color: #856404; background-color: #fff3cd; border: 1px solid #ffeeba; }
            </style>
          </head>
          <body>
            <h1>Shopify Integration Service</h1>
            <div class="card warning">
              <h2>⚠️ Fallback Mode</h2>
              <p>The application is running in fallback mode due to an error:</p>
              <pre>${error.message}</pre>
              <p>Please check the server logs for more information.</p>
            </div>
          </body>
        </html>
      `);
    });
    
    // Start the fallback server
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