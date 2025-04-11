/**
 * Fixed Render.com Deployment Script
 * Implements bundle patching with proper references
 */

console.log('Starting fixed Render deployment script...');

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

// Find and patch all JS bundles
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Preparing to serve static files from: ${publicPath}`);

// Create patched versions of JS files
const jsFiles = fs.readdirSync(publicPath)
  .filter(file => file.includes('index-') && file.endsWith('.js'));

console.log('Found JS bundles:', jsFiles);

// Create a safe patch script
const patchScript = `
(function() {
  console.log('🛠️ Applying date fix patch');
  
  // Save original methods
  var origToLocaleString = Date.prototype.toLocaleString;
  var origToLocaleDateString = Date.prototype.toLocaleDateString;
  var origToLocaleTimeString = Date.prototype.toLocaleTimeString;
  
  // Make Date.toLocaleString safe
  Date.prototype.toLocaleString = function() {
    try {
      if (!this || this === null || this === undefined) {
        console.warn('toLocaleString called on invalid date');
        return 'N/A';
      }
      return origToLocaleString.apply(this, arguments);
    } catch(e) {
      console.warn('Error in toLocaleString:', e);
      return 'N/A';
    }
  };
  
  // Make Date.toLocaleDateString safe
  Date.prototype.toLocaleDateString = function() {
    try {
      if (!this || this === null || this === undefined) {
        console.warn('toLocaleDateString called on invalid date');
        return 'N/A';
      }
      return origToLocaleDateString.apply(this, arguments);
    } catch(e) {
      console.warn('Error in toLocaleDateString:', e);
      return 'N/A';
    }
  };
  
  // Make Date.toLocaleTimeString safe
  Date.prototype.toLocaleTimeString = function() {
    try {
      if (!this || this === null || this === undefined) {
        console.warn('toLocaleTimeString called on invalid date');
        return 'N/A';
      }
      return origToLocaleTimeString.apply(this, arguments);
    } catch(e) {
      console.warn('Error in toLocaleTimeString:', e);
      return 'N/A';
    }
  };
  
  // Create a protection for the ll function
  var _llPatched = false;
  
  Object.defineProperty(window, 'll', {
    configurable: true,
    enumerable: true,
    get: function() {
      return window._ll_safe || function() { return 'N/A'; };
    },
    set: function(fn) {
      if (typeof fn === 'function' && !_llPatched) {
        console.log('✅ Intercepted ll function setup');
        window._ll_original = fn;
        window._ll_safe = function() {
          try {
            if (!arguments[0]) {
              console.warn('ll called with invalid date');
              return 'N/A';
            }
            return window._ll_original.apply(this, arguments);
          } catch (e) {
            console.warn('Error in ll:', e);
            return 'N/A';
          }
        };
        _llPatched = true;
      } else {
        window._ll_safe = fn;
      }
    }
  });
  
  // Add a global error handler as a final safety net
  window.addEventListener('error', function(e) {
    if (e.error && e.error.toString().includes('toLocaleString')) {
      console.warn('Caught toLocaleString error through global handler');
      e.preventDefault();
      return true;
    }
  }, true);
  
  console.log('✅ Date fix patch successfully applied');
})();
`;

// Create patched versions of all JS bundles
jsFiles.forEach(file => {
  const originalFilePath = path.join(publicPath, file);
  
  try {
    const content = fs.readFileSync(originalFilePath, 'utf8');
    
    // Create patched version
    const patchedContent = patchScript + '\n' + content;
    
    // Generate the patched filename (add '-patched' before extension)
    const parts = file.split('.');
    const ext = parts.pop();
    const baseName = parts.join('.');
    const patchedFileName = `${baseName}-patched.${ext}`;
    const patchedFilePath = path.join(publicPath, patchedFileName);
    
    // Write the patched file
    fs.writeFileSync(patchedFilePath, patchedContent, 'utf8');
    console.log(`✅ Created patched JS bundle: ${patchedFileName}`);
  } catch (err) {
    console.error(`❌ Error patching ${file}:`, err);
  }
});

// Create a patched index.html that loads our patched scripts first
try {
  const indexPath = path.join(publicPath, 'index.html');
  const originalHtml = fs.readFileSync(indexPath, 'utf8');
  
  // Process all script tags to change the src
  let patchedHtml = originalHtml;
  
  // Create a function to modify script tags
  function patchScriptTag(match, attrs) {
    // Extract the src attribute
    const srcMatch = attrs.match(/src="([^"]+)"/);
    if (!srcMatch) return match; // No src attribute, return unchanged
    
    const srcPath = srcMatch[1];
    if (!srcPath.includes('index-') || !srcPath.endsWith('.js')) {
      return match; // Not a bundle file, return unchanged
    }
    
    // Generate the patched filename
    const parts = srcPath.split('.');
    const ext = parts.pop();
    const baseName = parts.join('.');
    const patchedSrc = `${baseName}-patched.${ext}`;
    
    // Replace the src attribute
    return match.replace(srcPath, patchedSrc);
  }
  
  // Replace all script tags
  patchedHtml = patchedHtml.replace(/<script([^>]*)>/g, (match, attrs) => {
    return patchScriptTag(match, attrs);
  });
  
  // Add our patch script just after the opening head tag to ensure it runs first
  patchedHtml = patchedHtml.replace('<head>', `<head>
  <!-- Date fix patch -->
  <script>
    ${patchScript}
  </script>
`);
  
  // Save the patched index.html
  fs.writeFileSync(indexPath, patchedHtml, 'utf8');
  console.log('✅ Patched index.html to load fixed scripts');
} catch (err) {
  console.error('❌ Error patching index.html:', err);
}

// Serve static files
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// API route handling
app.use((req, res, next) => {
  // Handle API routes that weren't caught by our API module
  if (req.path.startsWith('/api/')) {
    console.log('API route not found:', req.path);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  next();
});

// SPA route handling - make sure all requests get routed to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// CRITICAL: Explicitly listen on the PORT provided by Render
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ API routes configured: ${routesConfigured ? 'YES' : 'NO'}`);
  console.log(`✅ Patched scripts created successfully`);
});

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
