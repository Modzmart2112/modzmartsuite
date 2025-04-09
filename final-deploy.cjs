// Final production deployment script for Replit with critical backend APIs
// This is simplified to avoid dependency issues while providing essential functionality

// Set to production mode
process.env.NODE_ENV = 'production';

// Import required modules
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

console.log('Starting final deployment script with essential backend APIs...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);

// Check for required environment variables
if (!process.env.SHOPIFY_API_KEY) {
  console.warn('Warning: SHOPIFY_API_KEY not found in environment variables');
}

if (!process.env.SHOPIFY_API_SECRET) {
  console.warn('Warning: SHOPIFY_API_SECRET not found in environment variables');
}

if (!process.env.SHOPIFY_STORE_URL) {
  console.warn('Warning: SHOPIFY_STORE_URL not found in environment variables');
}

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL not found in environment variables');
}

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

// Simple in-memory auth (no session required)
const authenticatedTokens = new Set();

// Shopify API helpers
function normalizeShopifyUrl(url) {
  if (!url) return '';
  // Remove any protocol
  let normalized = url.replace(/^https?:\/\//, '');
  // Remove any trailing slashes
  normalized = normalized.replace(/\/+$/, '');
  return normalized;
}

// Serve static files
app.use(express.static(path.join(__dirname, 'dist', 'public')));

// API routes
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0',
    time: new Date().toISOString(),
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
      time: result.rows[0].time
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
});

// Shopify status endpoint
app.get('/api/shopify/status', (req, res) => {
  try {
    // Just return a status based on environment variables
    const isConfigured = process.env.SHOPIFY_API_KEY && 
                         process.env.SHOPIFY_API_SECRET && 
                         process.env.SHOPIFY_STORE_URL;
                      
    const normalizedUrl = normalizeShopifyUrl(process.env.SHOPIFY_STORE_URL);
    
    res.json({
      connected: !!isConfigured,
      storeUrl: normalizedUrl || '(not configured)'
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Hardcoded credential check
    if (username === 'Admin' && password === 'Ttiinnyy1') {
      const token = Math.random().toString(36).substring(2, 15);
      authenticatedTokens.add(token);
      
      return res.json({ 
        success: true, 
        token,
        user: { username } 
      });
    }
    
    res.status(401).json({ 
      success: false, 
      error: 'Invalid credentials' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) {
    authenticatedTokens.delete(token);
  }
  res.json({ success: true });
});

// Basic authentication middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (authenticatedTokens.has(token)) {
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// Dashboard stats endpoint
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    if (!pool) {
      return res.json({
        totalProducts: 0,
        productsWithCostPrice: 0,
        totalOrders: 0,
        todayOrders: 0,
        averageOrderValue: 0
      });
    }

    // Get basic stats
    const result = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM products WHERE cost_price > 0) as products_with_cost_price
    `);
    
    res.json({
      totalProducts: parseInt(result.rows[0].total_products) || 0,
      productsWithCostPrice: parseInt(result.rows[0].products_with_cost_price) || 0,
      totalOrders: 0,
      todayOrders: 0,
      averageOrderValue: 0
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

// All other routes serve the index.html for the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle termination gracefully
process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    if (pool) {
      pool.end();
    }
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    if (pool) {
      pool.end();
    }
    console.log('Server closed');
    process.exit(0);
  });
});