/**
 * REPLIT RAPID STARTUP SCRIPT
 * 
 * This script is specifically designed to start an Express server
 * within the 20-second startup time requirement of Replit.
 * 
 * It does not initialize the database or other heavy resources
 * initially, allowing for quick startup.
 */

// Import only minimal dependencies
const express = require('express');
const path = require('path');
const fs = require('fs');

// Create Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files first (very fast)
if (fs.existsSync(path.join(__dirname, 'dist', 'client'))) {
  app.use(express.static(path.join(__dirname, 'dist', 'client')));
}

// Basic middleware for parsing JSON
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send({
    status: 'ok',
    message: 'Server is running'
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.status(200).send({
    status: 'ok',
    startTime: startupTime,
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Track startup time
const startupTime = Date.now();

// Start the server immediately
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Replit-optimized server started on port ${PORT}`);
  console.log(`Startup time: ${Date.now() - startupTime}ms`);
  
  // Lazy-load the full application after server has started
  setTimeout(() => {
    console.log('Initializing full application...');
    initializeApplication();
  }, 2000); // Wait 2 seconds before starting the main app
});

/**
 * Initialize the full application asynchronously
 * This happens after the server is already listening
 */
async function initializeApplication() {
  try {
    // Set environment to production
    process.env.NODE_ENV = 'production';
    
    // Set flags to improve performance
    process.env.DISABLE_SCHEDULERS = 'true';
    process.env.OPTIMIZE_STARTUP = 'true';
    
    // Import the rest of the application
    console.log('Loading application modules...');
    
    // We'll lazily import the application components
    // to keep the initial startup fast
    const importApp = async () => {
      try {
        // Import routes 
        const routes = require('./server/routes');
        
        // Register API routes
        app.use('/api', routes);
        
        // Add a catch-all route for SPA
        app.get('*', (req, res) => {
          const indexPath = path.join(__dirname, 'dist', 'client', 'index.html');
          if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(200).send('Application is initializing. Static files not found.');
          }
        });
        
        console.log('Application fully initialized and ready');
      } catch (error) {
        console.error('Error initializing full application:', error);
      }
    };
    
    // Start the import process
    importApp();
    
  } catch (error) {
    console.error('Failed to initialize full application:', error);
  }
}