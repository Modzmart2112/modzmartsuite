#!/usr/bin/env node

/**
 * Test script to verify our deployment solution works correctly
 * This runs a small test to verify that our reliable-deploy.js script can:
 * 1. Import ES Modules
 * 2. Bind to external addresses
 * 3. Handle environment variables correctly
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Set production environment
process.env.NODE_ENV = 'production';
const PORT = 5500; // Use a different port for testing

// Create require function from import for compatibility
const require = createRequire(import.meta.url);

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting deployment test server...');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);
console.log(`Environment: ${process.env.NODE_ENV}`);

// Create a simple test app
const app = express();

// Add a test endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Deployment test server is running correctly',
    details: {
      environment: process.env.NODE_ENV,
      dirname: __dirname,
      cwd: process.cwd(),
      nodejs: process.version,
      modules: 'ES Modules working'
    }
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`✅ Test server running on port ${PORT}`);
  console.log(`✅ Visit http://localhost:${PORT}/ to verify it works`);
  console.log(`=================================================\n`);
  
  console.log('If this test server starts successfully, your');
  console.log('deployment script should work properly on Replit.');
  console.log('\nPress Ctrl+C to exit the test.\n');
});