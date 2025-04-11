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
import { Pool } from 'pg';

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

// Diagnostic database endpoint
app.get('/api/debug/database', async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Test connection
    const result = await pool.query('SELECT NOW() as time');

    // Get tables
    const tables = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    // Sample product data
    let productSample = { error: 'No products table' };
    try {
      const productQuery = await pool.query('SELECT COUNT(*) as count FROM products');
      productSample = {
        count: productQuery.rows[0].count,
        message: 'Found products in database'
      };

      // Get a sample product
      if (productQuery.rows[0].count > 0) {
        const sample = await pool.query('SELECT * FROM products LIMIT 1');
        productSample.sample = sample.rows[0];
      }
    } catch (e) {
      productSample = { error: e.message };
    }

    await pool.end();

    res.json({
      success: true,
      time: result.rows[0].time,
      tables: tables.rows,
      products: productSample
    });
  } catch (err) {
    console.error('Database test failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import and use server routes
let serverRoutesLoaded = false;

// Attempt to load server routes from various possible locations
async function loadServerRoutes() {
  const possibleRouteFiles = [
    './dist/server/routes.js',
    './server/routes.js',
    './dist/server/routes.cjs',
    './server/routes.cjs'
  ];

  for (const routeFile of possibleRouteFiles) {
    try {
      console.log(`Attempting to load routes from ${routeFile}...`);

      if (routeFile.endsWith('.js')) {
        // ESM approach
        const routes = await import(routeFile);
        if (routes.default && typeof routes.default === 'function') {
          console.log(`Routes loaded from ${routeFile}`);
          routes.default(app);
          serverRoutesLoaded = true;
          return true;
        }
      } else {
        // CommonJS approach
        // Need to use dynamic import with require
        const commonJsRequire = eval('require');
        const routes = commonJsRequire(routeFile);
        if (typeof routes === 'function') {
          console.log(`Routes loaded from ${routeFile}`);
          routes(app);
          serverRoutesLoaded = true;
          return true;
        }
      }
    } catch (err) {
      console.log(`Could not load routes from ${routeFile}:`, err.message);
    }
  }

  return false;
}

// Load server routes
loadServerRoutes().then(success => {
  if (!success) {
    console.warn('WARNING: Could not load server routes from any expected location');
  }

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
    console.log(`Server routes loaded: ${serverRoutesLoaded ? 'YES' : 'NO'}`);
  });
});