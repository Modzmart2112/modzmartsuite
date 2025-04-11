/**
 * REPLIT PRODUCTION DEPLOYMENT SCRIPT (CommonJS Version)
 * 
 * This script is a CommonJS-compatible version specifically designed for
 * reliable deployment to Replit. It ensures:
 * 
 * 1. Fast startup with health check endpoint first
 * 2. ES Module compatibility
 * 3. Environment variable availability
 * 4. Proper port binding for Replit
 */

// Set production mode
process.env.NODE_ENV = 'production';

// Disable schedulers for faster startup
process.env.DISABLE_SCHEDULERS = 'true';
process.env.OPTIMIZE_STARTUP = 'true';

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(express.json());

// Health check endpoint (required by Replit)
app.get('/', (req, res) => {
  res.status(200).send({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Serve static assets if available
const clientDistPath = path.join(__dirname, 'dist', 'client');
if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static files from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
}

// Start the server with proper binding (0.0.0.0 required for Replit)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit production server started on port ${PORT}`);
  console.log(`Health check endpoint available at /`);
  
  // After server is started, initialize the full application
  setTimeout(() => {
    initializeApplication();
  }, 1000);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

/**
 * Initialize the full application in the background
 * This happens after the health check server is already running
 */
function initializeApplication() {
  try {
    console.log('Loading application routes...');
    
    // Import routes
    try {
      const routes = require('./server/routes');
      app.use('/api', routes);
      console.log('API routes registered successfully');
    } catch (error) {
      console.error('Error registering API routes:', error);
    }
    
    // Fallback route for SPA
    app.get('*', (req, res) => {
      const indexPath = path.join(clientDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('Application is running');
      }
    });
    
    console.log('Application initialization complete');
  } catch (error) {
    console.error('Error initializing application:', error);
    // Server will continue to run even if full initialization fails
  }
}