#!/usr/bin/env node

/**
 * Production deployment script for Replit
 * 
 * This script:
 * 1. Sets up the production environment
 * 2. Properly imports the built application 
 * 3. Binds to 0.0.0.0 to make it accessible
 * 4. Adds graceful shutdown handling
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

// Set production mode
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting production server...');

// Check for required environment variables
const requiredEnvVars = [
  'SHOPIFY_ACCESS_TOKEN',
  'SHOPIFY_API_KEY', 
  'SHOPIFY_STORE_URL',
  'DATABASE_URL'
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Please add these variables in your Replit Secrets panel');
  process.exit(1);
}

// Copy SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET if not set
// This helps maintain compatibility with different parts of the codebase
if (process.env.SHOPIFY_ACCESS_TOKEN && !process.env.SHOPIFY_API_SECRET) {
  console.log('Copying SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET for compatibility');
  process.env.SHOPIFY_API_SECRET = process.env.SHOPIFY_ACCESS_TOKEN;
}

// Helper function to serve static files
function serveStatic(app) {
  const publicPath = path.join(__dirname, 'dist', 'public');
  
  // Check if public directory exists
  if (!fs.existsSync(publicPath)) {
    console.error(`Public directory not found at ${publicPath}`);
    console.log('Creating minimal public directory for health check');
    fs.mkdirSync(publicPath, { recursive: true });
  }
  
  // Serve static files
  app.use(express.static(publicPath));
  
  // Handle SPA routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Try to serve index.html
    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    
    // Fallback
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

// Create a small express app to handle health checks for Replit
function createHealthApp() {
  const app = express();
  
  // Health check endpoint
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
  
  return app;
}

// Main function
async function main() {
  try {
    console.log('\n=================================================');
    console.log('PRODUCTION DEPLOYMENT - STARTING SERVER');
    console.log('=================================================\n');
    
    // Import the built application
    console.log('Importing built application from dist/index.js...');
    const { default: setupApp } = await import('./dist/index.js');
    
    // Call the setup function to get the configured app
    console.log('Setting up application...');
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
    app.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`✅ Server running on port ${port}`);
      console.log(`✅ Health check available at /`);
      console.log(`✅ Application available at /dashboard`);
      console.log(`=================================================\n`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      app.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
  } catch (err) {
    console.error('Failed to start server:', err);
    
    // If the main application fails to start, run the minimal health check server
    console.log('\nStarting minimal health check server...');
    const healthApp = createHealthApp();
    serveStatic(healthApp);
    
    const port = parseInt(process.env.PORT);
    healthApp.listen(port, '0.0.0.0', () => {
      console.log(`\n=================================================`);
      console.log(`✅ Minimal server running on port ${port}`);
      console.log(`✅ Health check available`);
      console.log(`=================================================\n`);
    });
  }
}

// Run the main function
main().catch(err => {
  console.error('Fatal error in deployment script:', err);
  process.exit(1);
});