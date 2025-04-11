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
  // Check for client files in both possible locations
  const clientPath = path.join(__dirname, 'dist', 'client');
  const publicPath = path.join(__dirname, 'dist', 'public');
  const clientFilesFound = fs.existsSync(clientPath) || fs.existsSync(publicPath);
  const indexHtmlFound = fs.existsSync(path.join(clientPath, 'index.html')) || 
                         fs.existsSync(path.join(publicPath, 'index.html'));
  
  res.status(200).send({
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    applicationState: {
      clientFilesFound,
      indexHtmlFound,
      apiRoutesLoaded: app._router && app._router.stack.some(r => r.route && r.route.path === '/api')
    }
  });
});

// Serve static assets if available - check both dist/client and dist/public
let clientDistPath = path.join(__dirname, 'dist', 'client');
// If dist/client doesn't exist, check dist/public
if (!fs.existsSync(clientDistPath)) {
  const publicPath = path.join(__dirname, 'dist', 'public');
  if (fs.existsSync(publicPath)) {
    clientDistPath = publicPath;
    console.log(`Using dist/public as client files location instead of dist/client`);
  }
}

if (fs.existsSync(clientDistPath)) {
  console.log(`Serving static files from ${clientDistPath}`);
  app.use(express.static(clientDistPath));
} else {
  console.warn(`No static files directory found in dist/client or dist/public`);
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
    
    // Check for client files - they could be in dist/client or dist/public
    let clientDistPath = path.join(__dirname, 'dist', 'client');
    
    // If dist/client doesn't exist, check dist/public
    if (!fs.existsSync(clientDistPath)) {
      const publicPath = path.join(__dirname, 'dist', 'public');
      if (fs.existsSync(publicPath)) {
        clientDistPath = publicPath;
        console.log(`Using dist/public as client files location instead of dist/client`);
      }
    }
    
    if (fs.existsSync(clientDistPath)) {
      console.log(`Client files found at ${clientDistPath}`);
      const files = fs.readdirSync(clientDistPath);
      console.log(`Client directory contains: ${files.join(', ')}`);
    } else {
      console.error(`ERROR: Client files not found in dist/client or dist/public`);
      console.log('Current directory structure:');
      try {
        const rootFiles = fs.readdirSync(__dirname);
        console.log(`Root directory contains: ${rootFiles.join(', ')}`);
        
        if (rootFiles.includes('dist')) {
          const distFiles = fs.readdirSync(path.join(__dirname, 'dist'));
          console.log(`Dist directory contains: ${distFiles.join(', ')}`);
          
          // Check what's in dist/public if it exists
          const publicPath = path.join(__dirname, 'dist', 'public');
          if (fs.existsSync(publicPath)) {
            const publicFiles = fs.readdirSync(publicPath);
            console.log(`Dist/public directory contains: ${publicFiles.join(', ')}`);
          }
        }
      } catch (err) {
        console.error('Error listing directory contents:', err);
      }
    }
    
    // Import routes with better error handling
    try {
      console.log('Attempting to load server routes...');
      let routes;
      
      // Try different possible routes files - .cjs has highest priority
      try {
        console.log('Trying to load ./server/routes.cjs');
        routes = require('./server/routes.cjs');
        console.log('Successfully loaded routes.cjs');
      } catch (err) {
        console.log('Failed to load routes.cjs:', err.message);
        try {
          console.log('Trying to load ./server/routes.js');
          routes = require('./server/routes.js');
          console.log('Successfully loaded routes.js');
        } catch (err) {
          console.log('Failed to load routes.js:', err.message);
          console.log('Trying to load ./server/routes (no extension)');
          routes = require('./server/routes');
          console.log('Successfully loaded routes (no extension)');
        }
      }
      
      console.log('Routes module loaded successfully');
      app.use('/api', routes);
      console.log('API routes registered successfully');
      
      // Add a simple test endpoint
      app.get('/api/test', (req, res) => {
        res.status(200).json({ message: 'API routes working' });
      });
      console.log('Test endpoint added at /api/test');
      
    } catch (error) {
      console.error('Error registering API routes:');
      console.error(error.stack || error.message || error);
      
      // Create a basic API endpoint for testing even if routes fail
      app.get('/api/status', (req, res) => {
        res.status(200).json({
          status: 'limited',
          message: 'Limited API functionality - main routes failed to load',
          error: error.message || 'Unknown error'
        });
      });
      console.log('Fallback API status endpoint added at /api/status');
    }
    
    // Fallback route for SPA with better error handling
    app.get('*', (req, res) => {
      const indexPath = path.join(clientDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        console.log(`Serving index.html for path: ${req.path}`);
        res.sendFile(indexPath);
      } else {
        console.warn(`Index.html not found, sending basic response for path: ${req.path}`);
        res.status(200).send(`
          <html>
            <head><title>Application Status</title></head>
            <body>
              <h1>Application is running</h1>
              <p>The server is operational, but the frontend files could not be found.</p>
              <p>Try visiting <a href="/api/test">/api/test</a> to verify API functionality.</p>
            </body>
          </html>
        `);
      }
    });
    
    console.log('Application initialization complete');
  } catch (error) {
    console.error('Error initializing application:');
    console.error(error.stack || error.message || error);
    // Server will continue to run even if full initialization fails
  }
}