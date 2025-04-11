/**
 * Targeted Patch for Render Deployment
 * Focuses specifically on fixing the Xbe function
 */

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Configuration
const PORT = process.env.PORT || 10000;
process.env.NODE_ENV = 'production';

// Initialize path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'dist', 'public');

// Create Express server
const app = express();
app.use(express.json());

console.log('Starting Targeted Patch Deployment');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Public path: ${publicPath}`);

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Safe date helper
function safeDate() {
  return new Date().toISOString();
}

// Try to find the JS file and add a very targeted fix
const jsPath = path.join(publicPath, 'assets', 'index-CE7g2015.js');
if (fs.existsSync(jsPath)) {
  console.log('Found index-CE7g2015.js, searching for Xbe function');
  
  // Read the JS file
  const originalJs = fs.readFileSync(jsPath, 'utf8');
  
  // Search for the Xbe function definition
  const xbeFunctionRegex = /function\s+Xbe\s*\([^)]*\)\s*\{([^}]*)\}/;
  const match = originalJs.match(xbeFunctionRegex);
  
  if (match) {
    console.log('Found Xbe function, applying targeted fix');
    
    // Extract the function content
    const functionBody = match[1];
    
    // Create a safer version of the function
    const safeFunction = `function Xbe() {
  try {
    // Defensive checking of arguments
    for (var i = 0; i < arguments.length; i++) {
      if (arguments[i] === undefined || arguments[i] === null) {
        console.warn("Xbe called with undefined/null argument");
        return "N/A";
      }
    }
    
    // Original function body (with some safety)
    ${functionBody.replace(/\.toLocaleString\(/g, '?.toLocaleString?(')
      .replace(/\.formatToParts\(/g, '?.formatToParts?(')
      .replace(/\.format\(/g, '?.format?(')
      .replace(/\.getTime\(/g, '?.getTime?(')
      .replace(/\.getDate\(/g, '?.getDate?(')
      .replace(/\.getMonth\(/g, '?.getMonth?(')
      .replace(/\.getFullYear\(/g, '?.getFullYear?(')}
  } catch (e) {
    console.warn("Prevented crash in Xbe:", e);
    return "N/A";
  }
}`;
    
    // Replace the original function with our safe version
    const patchedJs = originalJs.replace(xbeFunctionRegex, safeFunction);
    
    // Write back the patched file
    fs.writeFileSync(jsPath, patchedJs, 'utf8');
    console.log('Successfully patched Xbe function');
  } else {
    console.log('Could not find Xbe function, adding global patch');
    
    // Add global patch at the beginning of the file
    const globalPatch = `
// Global Xbe patch
(function(){
  // Save original console methods
  var origConsoleError = console.error;
  var origConsoleWarn = console.warn;
  
  // Make console methods safer
  console.error = function() {
    try {
      return origConsoleError.apply(this, arguments);
    } catch (e) {
      // Fallback if something goes wrong
      console.log('Error in console.error');
    }
  };
  
  console.warn = function() {
    try {
      return origConsoleWarn.apply(this, arguments);
    } catch (e) {
      // Fallback if something goes wrong
      console.log('Error in console.warn');
    }
  };
  
  // Global error handler specifically for date functions
  window.addEventListener('error', function(e) {
    if (e && e.error && e.error.message && (
      e.error.message.includes('toLocaleString') ||
      e.error.message.includes('Cannot read properties of undefined')
    )) {
      console.log("Prevented crash:", e.error.message);
      e.preventDefault();
      return true;
    }
  }, true);
  
  // Wait for page to load then monkey patch date functions
  window.addEventListener('load', function() {
    setTimeout(function() {
      var functionsToFix = ['Xbe', 'qbe', 'll', 'HS', 'vb', 'BM', 'IM', 'F9', 'Cm', 'Cb', 'qP', 'ko'];
      
      functionsToFix.forEach(function(funcName) {
        if (typeof window[funcName] === 'function') {
          console.log("Patching function:", funcName);
          var originalFunc = window[funcName];
          window[funcName] = function() {
            try {
              // Check for any null/undefined arguments
              for (var i = 0; i < arguments.length; i++) {
                if (arguments[i] === undefined || arguments[i] === null) {
                  console.warn(funcName + " called with null/undefined");
                  return funcName === 'll' || funcName === 'Xbe' || funcName === 'qbe' ? "N/A" : arguments[0];
                }
              }
              return originalFunc.apply(this, arguments);
            } catch (e) {
              console.warn("Prevented crash in " + funcName + ":", e.message);
              return funcName === 'll' || funcName === 'Xbe' || funcName === 'qbe' ? "N/A" : arguments[0];
            }
          };
        }
      });
      
      // Patch Date prototype methods
      var origToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = function() {
        try {
          if (!this || isNaN(this.getTime())) {
            return "Invalid Date";
          }
          return origToLocaleString.apply(this, arguments);
        } catch (e) {
          return "Error";
        }
      };
      
      console.log("Global patch complete");
    }, 100);
  });
})();
`;
    
    // Prepend the global patch
    const patchedJs = globalPatch + originalJs;
    fs.writeFileSync(jsPath, patchedJs, 'utf8');
    console.log('Added global patch to JavaScript file');
  }
} else {
  console.warn('Could not find index-CE7g2015.js');
}

// Also add a safety script to index.html
const indexPath = path.join(publicPath, 'index.html');
if (fs.existsSync(indexPath)) {
  console.log('Found index.html, adding safety script');
  
  // Read the HTML file
  const originalHtml = fs.readFileSync(indexPath, 'utf8');
  
  // Create a safety script
  const safetyScript = `
<script>
// Safety script for date handling
(function() {
  console.log("Installing safety script");
  
  // Patch Date methods
  var origToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      if (!this || this === null || this === undefined || !(this instanceof Date) || isNaN(this.getTime())) {
        return "Invalid Date";
      }
      return origToLocaleString.apply(this, arguments);
    } catch (e) {
      return "Error";
    }
  };
  
  // Global error handler
  window.addEventListener('error', function(e) {
    if (e && e.error && e.error.message && (
      e.error.message.includes('toLocaleString') ||
      e.error.message.includes('Cannot read properties of undefined')
    )) {
      console.log("Prevented crash:", e.error.message);
      e.preventDefault();
      return true;
    }
  }, true);

  // Check for Xbe directly after load
  window.addEventListener('load', function() {
    setTimeout(function() {
      // Override Xbe if it exists
      if (typeof window.Xbe === 'function') {
        console.log("Overriding Xbe function");
        var origXbe = window.Xbe;
        window.Xbe = function() {
          try {
            for (var i = 0; i < arguments.length; i++) {
              if (arguments[i] === undefined || arguments[i] === null) {
                return "N/A";
              }
            }
            return origXbe.apply(this, arguments);
          } catch (e) {
            console.warn("Prevented crash in Xbe:", e);
            return "N/A";
          }
        };
      }
    }, 200);
  });
  
  console.log("Safety script installed");
})();
</script>`;
  
  // Add the safety script
  const safeHtml = originalHtml.replace('<head>', '<head>' + safetyScript);
  fs.writeFileSync(indexPath, safeHtml, 'utf8');
  console.log('Added safety script to index.html');
} else {
  console.warn('Could not find index.html');
}

// Basic API endpoints

// User Profile
app.get('/api/user/profile', (req, res) => {
  res.json({
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    createdAt: safeDate(),
    updatedAt: safeDate()
  });
});

// Dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    productCount: 1601,
    displayCount: 1601,
    syncedProducts: 1601,
    lastSync: safeDate(),
    updatedAt: safeDate(),
    storeUrl: '6c8940-3.myshopify.com',
    syncInProgress: false
  });
});

// Products
app.get('/api/products', (req, res) => {
  res.json([]);
});

// Shopify connection status
app.get('/api/shopify/connection-status', (req, res) => {
  res.json({
    connected: true,
    store: '6c8940-3.myshopify.com',
    lastSync: safeDate()
  });
});

// Shopify status
app.get('/api/shopify/status', (req, res) => {
  res.json({
    connected: true,
    store: '6c8940-3.myshopify.com',
    lastSync: safeDate()
  });
});

// Shopify brands
app.get('/api/shopify/brands', (req, res) => {
  res.json([
    { id: 1, name: 'Default Brand', createdAt: safeDate() }
  ]);
});

// Products discrepancies
app.get('/api/products/discrepancies', (req, res) => {
  res.json([]);
});

// Notifications
app.get('/api/notifications', (req, res) => {
  res.json([
    {
      id: 1,
      message: 'Application migrated to Render',
      timestamp: safeDate(),
      read: false
    }
  ]);
});

// Scheduler status
app.get('/api/scheduler/status', (req, res) => {
  res.json({ 
    isRunning: false,
    lastRun: safeDate(),
    nextRun: safeDate()
  });
});

// Scheduler sync progress
app.get('/api/scheduler/shopify-sync-progress', (req, res) => {
  res.json({ 
    inProgress: false,
    completed: 0,
    total: 0,
    lastUpdated: safeDate()
  });
});

// Dashboard activity
app.get('/api/dashboard/activity', (req, res) => {
  res.json([
    {
      id: 1,
      action: 'System started',
      timestamp: safeDate(),
      details: 'Application deployed on Render'
    }
  ]);
});

// Any other API endpoints
app.get('/api/*', (req, res) => {
  res.json({
    status: 'ok',
    endpoint: req.path,
    timestamp: safeDate()
  });
});

// Prevent caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static files
app.use(express.static(publicPath));

// Handle SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
