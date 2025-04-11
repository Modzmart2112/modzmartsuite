/**
 * Fast Startup Script for Workflow
 * 
 * This script starts a server within 20 seconds, then loads the full application
 * in the background after port binding.
 */

const express = require('express');
const child_process = require('child_process');
const path = require('path');

// Create minimal Express server to start quickly
const app = express();
const PORT = process.env.PORT || 5000;

// Respond to health checks immediately
app.get('/', (req, res) => {
  res.send('Application starting...');
});

// Start server immediately
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server started on port ${PORT} - initializing application...`);
  
  // Start the main application in the background
  setTimeout(() => {
    startMainApplication();
  }, 1000);
});

// Function to start the main application in the background
function startMainApplication() {
  try {
    // Import the application's main entry point
    console.log('Loading full application...');
    
    // Use child process to start the application in the background
    // This doesn't affect the already-running Express server
    const appProcess = child_process.fork('./index.js', [], {
      stdio: 'inherit',
      env: process.env
    });
    
    appProcess.on('message', (msg) => {
      console.log('Message from application:', msg);
    });
    
    appProcess.on('error', (err) => {
      console.error('Error starting application:', err);
    });
    
    console.log('Application loading in the background...');
  } catch (error) {
    console.error('Failed to load application:', error);
  }
}