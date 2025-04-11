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

// The emergency patch - directly modify the index.html file
// Create the patch script directly in the render-full-deploy.js file
// This is more reliable than importing from another file

// Patch the HTML directly
try {
  const publicPath = path.join(__dirname, 'dist', 'public');
  const indexHtmlPath = path.join(publicPath, 'index.html');
  
  console.log('Setting up direct HTML patching for date issues');
  
  // Read the original HTML file
  let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Create a script to inject at the beginning of the HTML
  const injectScript = `
<script>
  // Emergency Date patch - must run BEFORE any other scripts
  console.log('⚠️ Applying emergency date fix');
  
  // Store original methods
  var _originalDateToLocaleString = Date.prototype.toLocaleString;
  var _originalDateToLocaleDateString = Date.prototype.toLocaleDateString;
  var _originalDateToLocaleTimeString = Date.prototype.toLocaleTimeString;
  
  // Replace with safe versions
  Date.prototype.toLocaleString = function() {
    try {
      // Check if 'this' is valid
      if (this === undefined || this === null) return 'N/A';
      return _originalDateToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('Safe toLocaleString caught error:', e);
      return 'N/A';
    }
  };
  
  Date.prototype.toLocaleDateString = function() {
    try {
      // Check if 'this' is valid
      if (this === undefined || this === null) return 'N/A';
      return _originalDateToLocaleDateString.apply(this, arguments);
    } catch (e) {
      console.warn('Safe toLocaleDateString caught error:', e);
      return 'N/A';
    }
  };
  
  Date.prototype.toLocaleTimeString = function() {
    try {
      // Check if 'this' is valid
      if (this === undefined || this === null) return 'N/A';
      return _originalDateToLocaleTimeString.apply(this, arguments);
    } catch (e) {
      console.warn('Safe toLocaleTimeString caught error:', e);
      return 'N/A';
    }
  };
  
  // Also patch the constructor
  var OriginalDate = Date;
  window.Date = function() {
    try {
      if (arguments.length === 0) {
        return new OriginalDate();
      } else if (arguments.length === 1) {
        // Handle potentially invalid dates
        var arg = arguments[0];
        if (arg === null || arg === undefined) {
          console.warn('Date constructor received null/undefined');
          return new OriginalDate();
        }
        return new OriginalDate(arg);
      } else {
        return new OriginalDate(...arguments);
      }
    } catch (e) {
      console.warn('Date constructor error:', e);
      return new OriginalDate();
    }
  };
  
  // Maintain prototype chain and statics
  window.Date.prototype = OriginalDate.prototype;
  window.Date.now = OriginalDate.now;
  window.Date.parse = OriginalDate.parse;
  window.Date.UTC = OriginalDate.UTC;
  
  console.log('✅ Emergency date fix applied');
</script>`;
  
  // Insert it right after the opening <head> tag
  htmlContent = htmlContent.replace('<head>', '<head>' + injectScript);
  
  // Create a patched version of index.html
  const patchedHtmlPath = path.join(__dirname, 'patched-index.html');
  fs.writeFileSync(patchedHtmlPath, htmlContent);
  console.log('Created patched HTML file at:', patchedHtmlPath);
  
  // Serve static files AFTER routes to avoid conflicts
  console.log(`Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));
  
  // Replace the default index.html route to serve our patched version
  app.get('/', (req, res) => {
    console.log('Serving patched index.html');
    res.sendFile(patchedHtmlPath);
  });
  
  // Also serve it for the SPA routing
  app.get('*', (req, res) => {
    // Skip API routes 
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Serve the patched index.html for client-side routes
    console.log('Serving patched index.html for route:', req.path);
    res.sendFile(patchedHtmlPath);
  });
  
  console.log('✅ Direct HTML patching setup complete');
} catch (err) {
  console.error('❌ Error setting up HTML patching:', err);
  
  // Fallback to normal static file serving if patching fails
  const publicPath = path.join(__dirname, 'dist', 'public');
  console.log(`Falling back to normal static file serving from: ${publicPath}`);
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
}

// CRITICAL: Explicitly listen on the PORT provided by Render
// This is the port binding that Render expects
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ API routes configured: ${routesConfigured ? 'YES' : 'NO'}`);
});

// Log that we're listening
console.log(`✅ Listening on PORT ${PORT}`);

// Optional: Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
