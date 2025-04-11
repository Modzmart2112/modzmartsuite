/**
 * Frontend UI patch to fix date formatting issues.
 * This file is served at the root path for emergency patching.
 */

const fs = require('fs');
const path = require('path');

/**
 * Provides a direct HTML fix for client-side date issues by
 * altering the HTML before it's served to the client.
 */
function injectDateFix(app, publicPath) {
  const indexHtmlPath = path.join(publicPath, 'index.html');
  
  console.log('Setting up direct HTML patching for date issues');
  
  try {
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
    
    // Replace the default index.html route to serve our patched version
    app.get('/', (req, res) => {
      console.log('Serving patched index.html');
      res.sendFile(patchedHtmlPath);
    });
    
    // Also serve it for the SPA routing
    app.get('*', (req, res, next) => {
      // Skip API routes and static assets
      if (req.path.startsWith('/api/') || 
          req.path.includes('.') || 
          req.path === '/health') {
        return next();
      }
      
      console.log('Serving patched index.html for route:', req.path);
      res.sendFile(patchedHtmlPath);
    });
    
    console.log('✅ Direct HTML patching setup complete');
    return true;
  } catch (err) {
    console.error('❌ Error setting up HTML patching:', err);
    return false;
  }
}

module.exports = { injectDateFix };
