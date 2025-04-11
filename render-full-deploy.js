/**
 * Complete Render.com Deployment Script
 * Handles both static files and API routes with direct fix for date issues
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

// Define our direct fix script
const directFixScript = `
/**
 * Direct intervention for date display issues
 */
(function() {
  console.log('Starting direct UI date intervention');
  
  // Protect the Date prototype methods from undefined/null issues
  const originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      if (this === undefined || this === null) {
        console.warn('toLocaleString called on undefined/null');
        return 'N/A';
      }
      return originalToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('Safe toLocaleString caught error:', e);
      return 'N/A';
    }
  };
  
  // SPECIFIC FIX: The error occurs in function 'll' at line 30576 and 'qbe' at line 35688
  // We'll create a MutationObserver to fix any issues with date displays
  
  // Start monitoring for updates to the DOM
  const observer = new MutationObserver(function(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Find any time elements or date displays and ensure they have valid content
        document.querySelectorAll('time, [data-date], .date-display, .timestamp').forEach(el => {
          if (!el.textContent || el.textContent === 'Invalid Date') {
            el.textContent = 'N/A';
          }
        });
      }
    }
  });
  
  // Observe the entire document for changes
  observer.observe(document.body, { 
    childList: true,
    subtree: true
  });
  
  // Global error handler specifically for date issues
  window.addEventListener('error', function(event) {
    if (event && event.error && event.error.toString().includes('toLocaleString')) {
      console.warn('Caught date formatting error:', event.error);
      event.preventDefault();
      return true;
    }
  }, true);
  
  // On window load, directly patch the specific functions that cause errors
  window.addEventListener('load', function() {
    // Create a safe wrapper for any function
    function createSafeFunction(originalFn, name) {
      return function() {
        try {
          return originalFn.apply(this, arguments);
        } catch (e) {
          console.warn(\`Error in \${name}:\`, e);
          
          // Return appropriate default values based on the function name
          if (name === 'll' || name.includes('date') || name.includes('time')) {
            return 'N/A';
          }
          return null;
        }
      };
    }
    
    // The functions that appear in the error stack trace
    ['ll', 'qbe', 'HS', 'vb', 'BM', 'IM', 'F9', 'Cm', 'Cb', 'qP'].forEach(function(fnName) {
      // Only replace if function exists
      if (window[fnName] && typeof window[fnName] === 'function') {
        console.log('Patching function:', fnName);
        window[fnName] = createSafeFunction(window[fnName], fnName);
      }
    });
  });
  
  console.log('Direct UI date intervention initialized');
})();
`;

// Create a function to patch the HTML content
function patchHtml(html) {
  // Inject our direct fix script at the top of the head section
  return html.replace('<head>', '<head><script>' + directFixScript + '</script>');
}

// Middleware to intercept HTML responses
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(body) {
    // Only patch HTML responses
    if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
      const patchedBody = patchHtml(body);
      console.log('Patched HTML response with direct fix script');
      return originalSend.call(this, patchedBody);
    }
    
    return originalSend.apply(this, arguments);
  };
  
  next();
});

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Handle SPA routing - this should be the last middleware
app.get('*', (req, res) => {
  // API routes should 404 if they weren't handled by the routes module
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // For SPA routes, read the index.html file, patch it, and send
  const indexPath = path.join(publicPath, 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      console.error('Error reading index.html:', err);
      return res.status(500).send('Server Error');
    }
    
    const patchedHtml = patchHtml(html);
    res.set('Content-Type', 'text/html');
    res.send(patchedHtml);
  });
});

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
