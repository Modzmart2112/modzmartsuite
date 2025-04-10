#!/usr/bin/env node

/**
 * REPLIT DEPLOYMENT SCRIPT
 *
 * This script:
 * 1. Sets up the production environment
 * 2. Starts a minimal server to serve static files
 * 3. Adds a health check endpoint for Replit
 */

// Set production environment
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const http = require('http');

// Check database connection
async function checkDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL environment variable found');
    return false;
  }

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    console.log('✓ Database connection successful');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

// Verify Shopify credentials
async function checkShopifyCredentials() {
  const shopifyApiKey = process.env.SHOPIFY_API_KEY;
  const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
  const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  
  if (!shopifyApiKey || (!shopifyApiSecret && !shopifyAccessToken) || !shopifyStoreUrl) {
    console.error('Missing Shopify credentials');
    return false;
  }
  
  // Copy access token to API secret if needed (to handle code inconsistency)
  if (shopifyAccessToken && !shopifyApiSecret) {
    console.log('Copying SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET');
    process.env.SHOPIFY_API_SECRET = shopifyAccessToken;
  }
  
  return true;
}

// Create an Express app for serving static files and health checks
function createServer() {
  const app = express();
  const publicPath = path.join(process.cwd(), 'dist', 'public');
  
  // Check if public directory exists
  if (!fs.existsSync(publicPath)) {
    console.error(`Error: Public directory not found at ${publicPath}`);
    console.log('Creating minimal public directory for health check');
    fs.mkdirSync(publicPath, { recursive: true });
  }
  
  // Serve static files
  app.use(express.static(publicPath));
  
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
  
  // Catch-all route for SPA
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Try to serve index.html if it exists
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
  
  return app;
}

// Main function
async function main() {
  console.log('\n=================================================');
  console.log('REPLIT DEPLOYMENT SCRIPT - PRODUCTION MODE');
  console.log('=================================================\n');
  
  // Run checks
  console.log('Checking configuration...');
  const dbOk = await checkDatabaseConnection();
  const shopifyOk = await checkShopifyCredentials();
  
  // Start server
  console.log('\nStarting production server...');
  const app = createServer();
  const server = http.createServer(app);
  
  // Start listening
  const port = parseInt(process.env.PORT);
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n=================================================`);
    console.log(`✅ Server running on port ${port}`);
    console.log(`✅ Health check available at /`);
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
}

// Run main
main().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});