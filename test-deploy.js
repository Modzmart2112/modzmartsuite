// Test deploy script to verify our production deployment works
// This uses port 5002 for testing

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules don't have __dirname, so create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set production mode
process.env.NODE_ENV = 'production';

console.log('Starting test deployment on port 5002...');
console.log(`Current directory: ${process.cwd()}`);
console.log(`Node version: ${process.version}`);

// Create Express app
const app = express();

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic API health endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    mode: 'test-deployment',
    serverTime: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    shopify: process.env.SHOPIFY_API_KEY ? 'configured' : 'not configured'
  });
});

// Serve frontend for all non-API routes (SPA support)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Serve the SPA
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Simple 404 handler for API routes that weren't matched
app.use('/api/', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.path} not found in test mode`
  });
});

// Start the server on port 5002
const PORT = 5002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test deployment server running on port ${PORT}`);
});