/**
 * Minimal API Routes for Render Deployment
 * This provides the bare minimum API endpoints needed by the frontend
 */

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default function configureApiRoutes(app) {
  console.log('Configuring minimal API routes for Render deployment');

  // User Profile endpoint
  app.get('/api/user/profile', async (req, res) => {
    try {
      res.json({
        name: 'Admin User',
        email: 'admin@example.com',
        role: 'admin'
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products endpoint
  app.get('/api/products', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products LIMIT 100');
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const products = await pool.query('SELECT COUNT(*) FROM products');
      res.json({
        productCount: parseInt(products.rows[0].count),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard activity
  app.get('/api/dashboard/activity', async (req, res) => {
    try {
      res.json([]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Shopify status
  app.get('/api/shopify/status', (req, res) => {
    res.json({
      connected: true,
      store: process.env.SHOPIFY_STORE_URL || 'Not configured'
    });
  });

  // Shopify connection status
  app.get('/api/shopify/connection-status', (req, res) => {
    res.json({
      connected: true,
      store: process.env.SHOPIFY_STORE_URL || 'Not configured'
    });
  });

  // Shopify brands
  app.get('/api/shopify/brands', (req, res) => {
    res.json([]);
  });

  // Products discrepancies
  app.get('/api/products/discrepancies', (req, res) => {
    res.json([]);
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    res.json([]);
  });

  // Scheduler status
  app.get('/api/scheduler/status', (req, res) => {
    res.json({ isRunning: false });
  });

  // Scheduler sync progress
  app.get('/api/scheduler/shopify-sync-progress', (req, res) => {
    res.json({ 
      inProgress: false,
      completed: 0,
      total: 0
    });
  });

  console.log('API routes configured successfully');
  return true;
}