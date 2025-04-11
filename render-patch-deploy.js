/**
 * Direct JS Patch Render Deployment Script
 * Simplifies the approach with minimal, direct patching
 */

// Import required modules
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// Configuration
const PORT = process.env.PORT || 10000;
process.env.NODE_ENV = 'production';

// Initialize path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'dist', 'public');

// Create Express app
const app = express();
app.use(express.json());

console.log('Starting Direct Patch Render deployment script');
console.log(`PORT: ${PORT}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Public path: ${publicPath}`);

// Health check endpoint (required by Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Create a direct bundle patch function
function patchBundleFile() {
  console.log('Attempting to patch JavaScript bundle...');
  
  // Define our fix patch
  const patch = `
// === Date Fix Patch ===
(function() {
  console.log('[FIX] Applying date protection patch');
  
  // Fix Date.prototype.toLocaleString
  var originalToLocaleString = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function() {
    try {
      if (!this || typeof this !== 'object') return 'N/A';
      return originalToLocaleString.apply(this, arguments);
    } catch (e) {
      console.warn('[FIX] Prevented toLocaleString error');
      return 'N/A';
    }
  };
  
  // Create a safe wrapper for the ll function
  window._safe_ll = function(date) {
    try {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString();
    } catch (e) {
      return 'N/A';
    }
  };
  
  // Override specific function if it exists in the bundle
  setTimeout(function() {
    if (typeof window.ll === 'function') {
      console.log('[FIX] Found ll function, replacing with safe version');
      window.ll = window._safe_ll;
    }
  }, 0);
  
  // Add global error handler
  window.addEventListener('error', function(e) {
    if (e.error && e.error.toString().includes('toLocaleString')) {
      console.warn('[FIX] Caught toLocaleString error');
      e.preventDefault();
      return true;
    }
  }, true);
  
  console.log('[FIX] Date protection patch applied');
})();
// === End Fix ===
`;

  try {
    // Find the index.html file
    const indexHtmlPath = path.join(publicPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      console.error('Could not find index.html');
      return false;
    }
    
    // Modify the HTML file to include our fix
    let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    
    // Insert our patch script at the beginning of head
    htmlContent = htmlContent.replace('<head>', `<head>
    <script>${patch}</script>`);
    
    // Write the patched file
    fs.writeFileSync(indexHtmlPath, htmlContent);
    console.log('✅ Successfully patched index.html with date fix');
    return true;
  } catch (error) {
    console.error('❌ Error patching bundle:', error);
    return false;
  }
}

// Run the patch
const patchResult = patchBundleFile();
console.log(`Bundle patch result: ${patchResult ? 'Success' : 'Failed'}`);

// Configure API routes (minimal)
app.get('/api/products', async (req, res) => {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query('SELECT * FROM products LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.json([]);
  }
});

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query('SELECT COUNT(*) FROM products');
    const count = parseInt(result.rows[0].count);
    
    res.json({
      productCount: count,
      displayCount: count,
      syncedProducts: count,
      lastSync: new Date().toISOString(),
      storeUrl: process.env.SHOPIFY_STORE_URL || ''
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.json({
      productCount: 0,
      displayCount: 0,
      syncedProducts: 0,
      lastSync: new Date().toISOString(),
      storeUrl: process.env.SHOPIFY_STORE_URL || ''
    });
  }
});

// Serve static files
app.use(express.static(publicPath));

// Handle SPA routes
app.get('*', (req, res) => {
  // Skip API routes that weren't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
