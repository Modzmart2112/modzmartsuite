/**
 * Render.com Deployment Script
 * Specifically built to handle Render's deployment requirements
 */

console.log('Starting Render deployment script...');

// Ensure we're in production mode
process.env.NODE_ENV = 'production';

// Required - Render expects the server to bind to this port
const PORT = process.env.PORT || 10000;

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get current directory name (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a basic Express server
const app = express();

// Add JSON parsing middleware
app.use(express.json());

// Log important environment variables (masking sensitive parts)
console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 
  process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@') : 'Not set');
console.log('- SHOPIFY_STORE_URL:', process.env.SHOPIFY_STORE_URL || 'Not set');
console.log('- SHOPIFY_API_KEY:', process.env.SHOPIFY_API_KEY ? 'Set' : 'Not set');
console.log('- SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? 'Set' : 'Not set');

// Serve static files
const publicPath = path.join(__dirname, 'dist', 'public');
console.log(`Serving static files from: ${publicPath}`);
app.use(express.static(publicPath));

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Diagnostic endpoint to check database connection
app.get('/api/debug/database', async (req, res) => {
  try {
    // Create a simple PostgreSQL client to test the connection
    const { Pool } = await import('pg');

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        error: 'DATABASE_URL environment variable is not set' 
      });
    }

    // Create a new pool for this test
    const testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Required for some PostgreSQL providers
      }
    });

    // Test the connection
    const result = await testPool.query('SELECT NOW() as time');

    // Get table information to verify data exists
    const tables = await testPool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    // Sample some product data if available
    let productSample = { error: 'No products table found' };
    try {
      const productQuery = await testPool.query(`
        SELECT COUNT(*) as count FROM products
      `);
      productSample = {
        count: productQuery.rows[0].count,
        message: 'Found products in database'
      };
    } catch (e) {
      productSample = { error: e.message };
    }

    // Close the pool
    await testPool.end();

    res.json({ 
      success: true, 
      time: result.rows[0].time,
      tables: tables.rows,
      products: productSample,
      message: 'Database connection successful' 
    });
  } catch (err) {
    console.error('Database connection test failed:', err);
    res.status(500).json({ 
      error: err.message, 
      stack: process.env.NODE_ENV === 'production' ? null : err.stack 
    });
  }
});

// Diagnostic endpoint to check environment
app.get('/api/debug/environment', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    databaseUrl: process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set',
    shopifyStoreUrl: process.env.SHOPIFY_STORE_URL || 'Not set',
    shopifyApiKey: process.env.SHOPIFY_API_KEY ? 'Set (hidden)' : 'Not set',
    shopifyAccessToken: process.env.SHOPIFY_ACCESS_TOKEN ? 'Set (hidden)' : 'Not set',
    dirname: __dirname,
    publicPath
  });
});

// Handle SPA routing - this should come after API routes
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Serve the SPA's index.html for client-side routing
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start the minimal server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  // Now try to import and run the main application
  import('./dist/index.js')
    .then(() => {
      console.log('Main application started successfully');
    })
    .catch(err => {
      console.error('Error starting main application:');
      console.error(err.stack || err); // Log the full stack trace

      // If it's a database error, print more details
      if (err.message && err.message.includes('database')) {
        console.error('This appears to be a database connection issue.');
        console.error('DATABASE_URL format:', process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.replace(/:.+@/, ':****@') : 'Not set');
      }

      console.log('Continuing to run minimal server for health checks and diagnostics');
    });
});