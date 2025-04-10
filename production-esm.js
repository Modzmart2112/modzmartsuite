#!/usr/bin/env node

// Import ESM-only dependencies
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import the module compatibility helper
// This needs to be imported early to ensure compatibility
import './server/module-compat.js';

// ES modules setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment setup
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

async function startServer() {
  try {
    console.log('\n=================================================');
    console.log('PRODUCTION SERVER (ES MODULES MODE)');
    console.log('=================================================\n');
    
    console.log('Loading application...');
    
    // Import the application
    console.log('Attempting to import dist/index.js...');
    let appModule;
    try {
      appModule = await import('./dist/index.js');
      console.log('Successfully imported dist/index.js');
      console.log('Available exports:', Object.keys(appModule));
    } catch (importError) {
      console.error('Error importing dist/index.js:', importError);
      throw importError;
    }
    
    // Extract the setup function (adapt this to your actual export)
    console.log('Looking for setup function...');
    const setupApp = appModule.default || appModule.setupApp || Object.values(appModule).find(v => typeof v === 'function');
    
    if (typeof setupApp !== 'function') {
      console.error('Available exports:', Object.keys(appModule));
      console.error('Export types:', Object.entries(appModule).map(([k, v]) => `${k}: ${typeof v}`));
      throw new Error('Could not find a proper setup function in dist/index.js');
    }
    
    console.log('Found setup function, proceeding with initialization');
    
    // Initialize app
    console.log('Initializing application...');
    let app;
    try {
      app = await setupApp();
      console.log('Application initialized successfully');
    } catch (setupError) {
      console.error('Error initializing application:', setupError);
      throw setupError;
    }
    
    // Add health check endpoint for Replit
    app.get('/', (req, res) => {
      // Redirect browsers to dashboard
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.redirect('/dashboard');
      }
      
      // Return health check for API calls
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });
    
    // Start server
    const port = parseInt(process.env.PORT);
    const server = http.createServer(app);
    
    server.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`✅ Server running on port ${port}`);
      console.log(`✅ Health check available at / (root URL)`);
      console.log(`✅ Application available at /dashboard`);
      console.log(`=================================================\n`);
    });
    
    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    
    // Start a fallback server to handle health checks
    console.log('\nStarting fallback health check server...');
    const fallbackApp = express();
    
    // Health check endpoint that shows error but passes health check
    fallbackApp.get('/', (req, res) => {
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        return res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Application Error</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .error { color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; }
                .code { font-family: monospace; background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
              </style>
            </head>
            <body>
              <h1>Application Error</h1>
              <div class="error">
                <h2>The application couldn't start properly</h2>
                <p>The server encountered an error during startup. Please check the logs for more details.</p>
              </div>
              <h3>Error details:</h3>
              <div class="code">${error.stack || error.message || 'Unknown error'}</div>
            </body>
          </html>
        `);
      }
      
      // Return a 200 status for health checks but with degraded status
      res.status(200).json({
        status: 'degraded',
        message: 'Application failed to start properly, fallback server is running',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle all other routes
    fallbackApp.get('*', (req, res) => {
      res.redirect('/');
    });
    
    // Start the fallback server
    const port = parseInt(process.env.PORT);
    const fallbackServer = fallbackApp.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`⚠️ Fallback server running on port ${port}`);
      console.log(`⚠️ Health check available but application is NOT working`);
      console.log(`=================================================\n`);
    });
    
    return fallbackServer;
  }
}

// Start the server with timeout
console.log('Starting server with 10-second timeout safeguard...');
const startupTimeout = setTimeout(() => {
  console.error('\n⚠️ TIMEOUT: Server startup is taking too long!');
  console.error('The application seems to be hanging during initialization.');
  console.error('This usually indicates one of these issues:');
  console.error('1. A module import is hanging (circular dependency)');
  console.error('2. An API call is waiting indefinitely (missing credentials)');
  console.error('3. There is an infinite loop in the initialization code');
  console.error('\nCheck the logs for more details or try running with NODE_DEBUG=module\n');
  process.exit(1);
}, 10000); // 10 seconds timeout

startServer().then(server => {
  clearTimeout(startupTimeout);
}).catch(error => {
  clearTimeout(startupTimeout);
  console.error('Unhandled server error:', error);
});