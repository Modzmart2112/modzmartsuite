#!/usr/bin/env node

/**
 * Replit Deployment Script - CommonJS Version
 * 
 * This script:
 * 1. Sets up the production environment
 * 2. Runs the proper ES Module deployment script
 */

console.log('=================================================');
console.log('REPLIT DEPLOYMENT SCRIPT - PRODUCTION MODE');
console.log('=================================================');
console.log(`Node version: ${process.version}`);

// Set production environment
process.env.NODE_ENV = 'production';

// Use exec to run the ESM deployment script
const { execSync } = require('child_process');
try {
  console.log('Starting ES Module deployment script...');
  execSync('node simple-deploy.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Error running deployment script:', error);
  process.exit(1);
}