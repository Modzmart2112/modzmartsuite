#!/usr/bin/env node

/**
 * Replit Deployment Script
 */

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';

// Use child_process to run ES Module code from CommonJS
const { spawn } = require('child_process');

console.log('Starting server in production mode...');

// Use node directly to run the server
const nodeProcess = spawn('node', ['index.js'], {
  stdio: 'inherit', // Pass all IO through to the parent process
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: process.env.PORT || '3000'
  }
});

// Handle process exit
nodeProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`Server process exited with code ${code}`);
    process.exit(code);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  nodeProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  nodeProcess.kill('SIGINT');
});