#!/usr/bin/env node

/**
 * Replit Deployment Script
 * 
 * This is a simplified version that just sets NODE_ENV to production
 * and runs the main index.js file.
 * 
 * For Replit deployment, we need to:
 * 1. Set production mode
 * 2. Make sure routing works correctly
 * 3. Pass along all environment variables
 */

process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Start the server
require('./index.js');

// Log success
console.log(`Server started in production mode on port ${process.env.PORT}`);
console.log('Health check is available at / (root)');
console.log('Application is available at /dashboard and /login');