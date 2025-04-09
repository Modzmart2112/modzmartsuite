// Ultra-reliable production deployment script for Replit (CommonJS version)
// This combines both frontend and backend in the simplest way possible

// Set to production mode
process.env.NODE_ENV = 'production';

// Import required modules
const express = require('express');
const path = require('path');
const fs = require('fs');

// Connect to database
const { Pool } = require('pg');

console.log('Starting application in production mode via replit-deploy.cjs');
console.log('Node version:', process.version);
console.log('Environment variables present:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).join(', '));

// Database connection
let pool;
try {
  console.log('Connecting to database...');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log('Database connection successful');
} catch (error) {
  console.error('Database connection error:', error.message);
}

// Create Express app
const app = express();
app.use(express.json());

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// Basic API health endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    mode: 'production',
    serverTime: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    shopify: process.env.SHOPIFY_API_KEY ? 'configured' : 'not configured'
  });
});

// Database status endpoint
app.get('/api/database/status', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const result = await pool.query('SELECT NOW() as time');
    res.json({ 
      status: 'connected', 
      time: result.rows[0].time,
      connectionString: process.env.DATABASE_URL ? '(configured)' : '(missing)'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Simple dashboard stats endpoint
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    if (!pool) {
      return res.json({ 
        totalProducts: 0,
        productsWithCostPrice: 0,
        totalOrders: 0,
        todayOrders: 0,
        averageOrderValue: 0,
        message: "Database not connected"
      });
    }

    // Get some basic stats from the database
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM products WHERE cost_price > 0) as products_with_cost_price,
        (SELECT COUNT(*) FROM stats WHERE key = 'product_count') as stat_count
    `);
    
    res.json({
      totalProducts: parseInt(result.rows[0].total_products) || 0,
      productsWithCostPrice: parseInt(result.rows[0].products_with_cost_price) || 0,
      totalOrders: 0,
      todayOrders: 0,
      averageOrderValue: 0,
      statCount: parseInt(result.rows[0].stat_count) || 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      message: error.message 
    });
  }
});

// Serve frontend for all other non-API routes (SPA support)
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Serve the SPA
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Simple 404 handler for API routes that weren't matched
app.use('/api/', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.path} not found`
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});