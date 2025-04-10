#!/usr/bin/env node

/**
 * PRODUCTION SERVER ENTRY POINT
 * 
 * This script provides a production-ready server configuration for Replit deployment:
 * 1. Properly handles port binding to 0.0.0.0 for Replit's proxy
 * 2. Uses the correct port from environment variables
 * 3. Includes a health check endpoint at the root "/"
 * 4. Provides proper error handling and shutdown procedures
 */

// Import the server with proper CommonJS syntax
const server = require('./dist/index.js');

// The port Replit will use
const PORT = process.env.PORT || 3000;

// Add health check endpoint for Replit deployment
const healthCheckHandler = (req, res) => {
  // Make sure the request is for the root path
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      deployment: 'replit'
    }));
    return true; // Signal that we handled this request
  }
  return false; // Let the regular server handle other requests
};

// Start the server with proper host binding for Replit
server.listen(PORT, '0.0.0.0', () => {
  console.log(`⚡ Production server running on port ${PORT}`);
  console.log(`Health check available at http://0.0.0.0:${PORT}/`);
});

// Add health check listener to the server
server.on('request', (req, res) => {
  // Route health checks to our handler, passing through all other requests
  if (healthCheckHandler(req, res)) {
    console.log(`Health check request at ${new Date().toISOString()}`);
  }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing server shutdown after timeout');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forcing server shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Keep the server running despite the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Keep the server running despite the rejection
});