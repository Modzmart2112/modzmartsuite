// Full Production Deployment for Replit - CommonJS version
// This file runs the complete application with database connectivity
// and all API endpoints from the bundled server code

// Set to production mode
process.env.NODE_ENV = 'production';

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

console.log('Starting application in production mode via start.cjs');
console.log('Node version:', process.version);
console.log('Launching bundled application from dist/index.js');
console.log('Environment variables present:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));

// Check if dist/index.js exists (the compiled backend)
const bundlePath = path.join(__dirname, 'dist', 'index.js');
if (!fs.existsSync(bundlePath)) {
  console.error(`Error: Bundle file not found at ${bundlePath}`);
  console.error('Please run "npm run build" to create the production bundle.');
  process.exit(1);
}

// Start the bundled application as a separate process in NODE_ENV=production
// This ensures all database connections and API endpoints are available
const appProcess = spawn('node', ['--experimental-specifier-resolution=node', bundlePath], {
  stdio: 'inherit',
  env: { 
    ...process.env, 
    NODE_ENV: 'production',
    PORT: process.env.PORT || '5000'
  }
});

// Handle process events
appProcess.on('error', (err) => {
  console.error('Failed to start application bundle:', err);
  process.exit(1);
});

appProcess.on('exit', (code) => {
  console.log(`Application process exited with code ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT signal');
  appProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal');
  appProcess.kill('SIGTERM');
});