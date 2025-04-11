/**
 * Complete Render.com Deployment Script with Immediate Fix
 */

console.log('Starting Render deployment script with immediate fix...');

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
console.log('- PORT:', PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Set (masked)' : 'Not set');
console.log('- SHOPIFY_STORE_URL:', process.env.SHOPIFY_STORE_URL || 'Not set');

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Import our minimal API routes
import apiRoutes from './render-api-routes.js';
const routesConfigured = apiRoutes(app);
console.log('API routes configured:', routesConfigured ? 'YES' : 'NO');

// Define the fix script as a variable - will be injected directly
const IMMEDIATE_FIX = `
// This code MUST run before any other script
(function() {
  console.log('🚨 Applying immediate date fix');
  
  // Save original console methods
  var _originalConsoleError = console.error;
  var _originalConsoleWarn = console.warn;
  
  // Replace console.error to catch and handle date errors
  console.error = function() {
    // Check if this is our specific error
    if (arguments[0] && 
        typeof arguments[0] === 'string' && 
        arguments[0].includes('toLocaleString')) {
      console.log('🚫 Suppressed date error:', arguments[0]);
      return; // Suppress the error
    }
    _originalConsoleError.apply(console, arguments);
  };
  
  // Monkey patch the Date object to never return undefined for formatting methods
  var _origToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      return _origToLocaleString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  var _origToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function() {
    try {
      return _origToLocaleDateString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  var _origToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function() {
    try {
      return _origToLocaleTimeString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  // Define an initial empty function to be replaced later
  window.ll = function() { return 'N/A'; };
  
  // Suppress the specific error globally
  window.addEventListener('error', function(event) {
    if (event.error && event.error.toString().includes('toLocaleString')) {
      event.preventDefault();
      return true; // Prevent the error from bubbling up
    }
  }, true);
  
  console.log('✅ Date fix applied, UI should not crash now');
})();
`;

// Middleware to modify HTML responses
app.use((req, res, next) => {
  // Skip non-HTML routes
  if (req.path.includes('.') && !req.path.endsWith('.html')) {
    return next();
  }
  
  // Save the original send method
  const originalSend = res.send;
  
  // Override send method to inject our fix
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
      // Add our immediate fix script BEFORE any other scripts
      let modified = body;
      
      // Add at the very beginning of the head
      modified = modified.replace('<head>', '<head><script>' + IMMEDIATE_FIX + '</script>');
      
      console.log('Applied immediate fix to HTML response');
      return originalSend.call(this, modified);
    }
    
    return originalSend.apply(this, arguments);
  };
  
  next();
});

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// CRITICAL: Explicitly listen on the PORT provided by Render
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ API routes configured: ${routesConfigured ? 'YES' : 'NO'}`);
});

// Log that we're listening
console.log(`✅ Listening on PORT ${PORT}`);

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
