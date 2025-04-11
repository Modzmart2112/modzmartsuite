/**
 * Complete Render.com Deployment Script with JS Bundle Patching
 */

console.log('Starting Render deployment with direct JS patching...');

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

// Import our enhanced API routes
import apiRoutes from './render-api-routes.js';
const routesConfigured = apiRoutes(app);
console.log('API routes configured:', routesConfigured ? 'YES' : 'NO');

// Middleware to directly patch the JavaScript bundle
app.use(async (req, res, next) => {
  // Only intercept JavaScript file requests that match index-*
  if (req.path.includes('index-') && req.path.endsWith('.js')) {
    console.log('Intercepting JavaScript bundle:', req.path);
    
    const jsFilePath = path.join(__dirname, 'dist', 'public', req.path);
    
    try {
      // Check if file exists
      const fileExists = fs.existsSync(jsFilePath);
      if (!fileExists) {
        console.error('JavaScript file not found:', jsFilePath);
        return next();
      }
      
      // Read the original file
      const jsContent = fs.readFileSync(jsFilePath, 'utf8');
      
      // Direct patch to fix the ll function that's causing the error
      const patch = `
// ==== BEGIN DATE FIX PATCH ====
(function() {
  console.log('Applying direct fix for date formatting');
  
  // Get the original implementation
  var originalToLocaleString = Date.prototype.toLocaleString;
  
  // Replace with safe version
  Date.prototype.toLocaleString = function() {
    try {
      if (!this || this === undefined || this === null) {
        console.warn('toLocaleString called on undefined date');
        return 'N/A';
      }
      return originalToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('Error in toLocaleString:', e);
      return 'N/A';
    }
  };
  
  // Patch the ll function
  window._llFixed = false;
  Object.defineProperty(window, 'll', {
    configurable: true,
    enumerable: true,
    get: function() {
      return window._ll_safe || function() { return 'N/A'; };
    },
    set: function(value) {
      if (typeof value === 'function' && !window._llFixed) {
        console.log('Fixing ll function');
        window._ll_original = value;
        window._ll_safe = function() {
          try {
            if (!arguments[0]) return 'N/A';
            return window._ll_original.apply(this, arguments);
          } catch (e) {
            console.warn('Error in ll:', e);
            return 'N/A';
          }
        };
        window._llFixed = true;
      } else {
        window._ll_safe = value;
      }
    }
  });
  
  // Add global error handler
  window.addEventListener('error', function(e) {
    if (e.error && e.error.toString().includes('toLocaleString')) {
      console.warn('Caught date error:', e.error);
      e.preventDefault();
      return true;
    }
  }, true);
})();
// ==== END DATE FIX PATCH ====`;
      
      // Add the patch at the beginning of the file
      const patchedJs = patch + '\n' + jsContent;
      
      // Send the patched file
      res.set('Content-Type', 'application/javascript');
      res.send(patchedJs);
      console.log('Sent patched JavaScript bundle');
    } catch (err) {
      console.error('Error patching JavaScript:', err);
      next();
    }
  } else {
    next();
  }
});

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Handle SPA routing
app.get('*', (req, res) => {
  // API routes should 404 if they weren't handled by the routes module
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Modify the HTML to add our fix
  const indexPath = path.join(publicPath, 'index.html');
  
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    
    // Embed ll-fix script
    const modifiedHtml = html.replace('</head>', `<script>
// Direct fix for ll function
(function() {
  console.log('Setting up ll function protection');
  
  // Fix Date prototype first
  var origToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      if (!this) return 'N/A';
      return origToLocaleString.apply(this, arguments);
    } catch (e) {
      return 'N/A';
    }
  };
  
  // Global error handler
  window.addEventListener('error', function(e) {
    if (e.error && e.error.toString().includes('toLocaleString')) {
      console.warn('Caught date error');
      e.preventDefault();
      return true;
    }
  }, true);
})();
</script></head>`);
    
    res.send(modifiedHtml);
  } catch (err) {
    console.error('Error modifying HTML:', err);
    res.sendFile(indexPath);
  }
});

// CRITICAL: Explicitly listen on the PORT provided by Render
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ API routes configured: ${routesConfigured ? 'YES' : 'NO'}`);
});

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
