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

// Import our minimal API routes
import apiRoutes from './render-api-routes.js';
const routesConfigured = apiRoutes(app);
console.log('API routes configured:', routesConfigured ? 'YES' : 'NO');

// Intercept the JS bundle to add date protection
app.use((req, res, next) => {
  // Only intercept the main JS bundle
  if (req.path.includes('index-') && req.path.includes('.js')) {
    console.log('Intercepting JS bundle:', req.path);
    
    // Get the original path
    const originalPath = path.join(__dirname, 'dist', 'public', req.path);
    
    // Function to serve the patched bundle
    const servePatched = () => {
      // Read the file
      fs.readFile(originalPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading JS bundle:', err);
          return next(); // Continue to normal handling
        }
        
        try {
          // Create a patch function at the beginning of the file
          const patch = `
// ==== START EMERGENCY DATE PATCH ====
(function() {
  console.log('Applying emergency date patches');
  
  // Create fallback Date methods
  var originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      if (!this || this === undefined || this === null) {
        console.warn('toLocaleString called on undefined/null date');
        return 'N/A';
      }
      return originalToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('Date.toLocaleString error:', e);
      return 'N/A';
    }
  };
  
  var originalToLocaleDateString = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function() {
    try {
      if (!this || this === undefined || this === null) {
        console.warn('toLocaleDateString called on undefined/null date');
        return 'N/A';
      }
      return originalToLocaleDateString.apply(this, arguments);
    } catch (e) {
      console.warn('Date.toLocaleDateString error:', e);
      return 'N/A';
    }
  };
  
  var originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleTimeString = function() {
    try {
      if (!this || this === undefined || this === null) {
        console.warn('toLocaleTimeString called on undefined/null date');
        return 'N/A';
      }
      return originalToLocaleTimeString.apply(this, arguments);
    } catch (e) {
      console.warn('Date.toLocaleTimeString error:', e);
      return 'N/A';
    }
  };
  
  // Add global error handler for unhandled exceptions
  window.addEventListener('error', function(event) {
    if (event && event.error && event.error.toString().includes('toLocaleString')) {
      console.warn('Caught date formatting error:', event.error);
      event.preventDefault();
      return true;
    }
  });
  
  console.log('Date patches applied successfully');
})();
// ==== END EMERGENCY DATE PATCH ====
`;
          
          // Add the patch at the beginning of the file
          const patchedData = patch + data;
          
          // Send the modified bundle
          res.set('Content-Type', 'application/javascript');
          res.send(patchedData);
          console.log('Served patched JS bundle');
        } catch (error) {
          console.error('Error patching bundle:', error);
          next(); // Continue to normal handling
        }
      });
    };
    
    // Serve the patched version
    servePatched();
  } else {
    next(); // Continue to normal handling for other files
  }
});

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Handle
