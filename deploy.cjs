#!/usr/bin/env node

/**
 * Replit Deployment Script
 */

process.env.NODE_ENV = 'production';
process.env.PORT = '3000';

console.log('Starting server in production mode...');

// Start the server
import('./dist/index.js').catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});

// Log success (Preserved from original)
console.log(`Server started in production mode on port ${process.env.PORT}`);
console.log('Health check is available at / (root)');
console.log('Application is available at /dashboard and /login');