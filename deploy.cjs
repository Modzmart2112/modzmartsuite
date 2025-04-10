#!/usr/bin/env node

/**
 * REPLIT DEPLOYMENT REDIRECT
 * 
 * This is the main entry point for Replit's deployment system.
 * It simply redirects to our fixed deployment script.
 */

console.log('Redirecting to fixed deployment script...');

// Use child_process to spawn fixed-deploy.cjs
const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.NODE_ENV = 'production';

// Get the path to the fixed deployment script
const fixedDeployPath = path.join(__dirname, 'fixed-deploy.cjs');

// Execute the fixed deployment script
const child = spawn('node', [fixedDeployPath], {
  stdio: 'inherit',
  env: process.env
});

// Handle process exit
child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Fixed deployment script exited with code ${code}`);
    process.exit(code);
  } else {
    console.log('Deployment completed successfully');
    process.exit(0);
  }
});

// Handle process errors
child.on('error', (err) => {
  console.error('Failed to start fixed deployment script:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  child.kill('SIGINT');
});