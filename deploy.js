// Full Production Deployment for Replit - ES Module version
// This file properly imports and runs the bundled server with all database
// connections and API endpoints for a complete production deployment

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production mode
process.env.NODE_ENV = 'production';

console.log('Starting application in production mode via deploy.js');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);
console.log('Environment variables present:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));

// Check if the bundle exists
const bundlePath = path.join(__dirname, 'dist', 'index.js');
if (!fs.existsSync(bundlePath)) {
  console.error(`Error: Bundle file not found at ${bundlePath}`);
  console.error('Please run "npm run build" to create the production bundle.');
  process.exit(1);
}

// We'll first attempt to directly import the bundle
try {
  console.log(`Importing bundled server from ${bundlePath}`);
  
  // Import the bundle and start the server
  const serverModule = await import(bundlePath);
  const setupApp = serverModule.default;
  
  if (typeof setupApp === 'function') {
    // Call the setup function to get the HTTP server
    const server = await setupApp();
    
    // Start listening on port 5000
    const PORT = process.env.PORT || 5000;
    server.listen({ port: PORT, host: "0.0.0.0" }, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } else {
    throw new Error('Exported module does not contain a setupApp function');
  }
} catch (err) {
  console.error('Failed to directly import bundle:', err);
  console.error('Trying alternative approach with child process...');
  
  // Fallback: Start as a child process if direct import fails
  const PORT = process.env.PORT || 5000;
  const appProcess = spawn('node', ['--experimental-specifier-resolution=node', bundlePath], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: 'production',
      PORT: PORT.toString()
    }
  });
  
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
}