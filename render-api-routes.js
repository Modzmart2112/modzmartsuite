/**
 * Complete Render.com Deployment Script
 * Handles both static files and API routes
 */

console.log('Starting complete Render deployment script...');

// Ensure we're in production mode
process.env.NODE_ENV = 'production';

// Required - Render expects the server to bind to this port
const PORT = process.env.PORT || 10000;

// Load modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// Fix for pg import
import pkg from 'pg';
const { Pool } = pkg;

// Get current directory name (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express server
const app = express();
app.use(express.json());

// Log environment info
console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set (masked)' : 'Not set');
console.log('- SHOPIFY_STORE_URL:', process.env.SHOPIFY_STORE_URL || 'Not set');

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve the browser patch script from your file
app.get('/browser-patch.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'browser-patch.js'));
});

// Import our minimal API routes
import apiRoutes from './render-api-routes.js';
const routesConfigured = apiRoutes(app);
console.log('API routes configured:', routesConfigured ? 'YES' : 'NO');

// Inject the browser patch into the main HTML
app.use((req, res, next) => {
  // Only modify HTML responses
  const originalSend = res.send;
  
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
      // Inject our browser patch script right before the closing </head> tag
      body = body.replace('</head>', '<script src="/browser-patch.js"></script></head>');
      console.log('Injected browser patch into HTML response');
    }
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Serve static files AFTER routes to avoid conflicts
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Handle SPA routing - this should be the last middleware
app.get('*', (req, res) => {
  // API routes should 404 if they weren't handled by the routes module
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Serve index.html for client-side routes
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API routes configured: ${routesConfigured ? 'YES' : 'NO'}`);
});
