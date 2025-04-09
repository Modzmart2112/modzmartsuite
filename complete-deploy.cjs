// Complete production deployment script for Replit with backend APIs
// This serves both the frontend static files and essential backend APIs

// Set to production mode
process.env.NODE_ENV = 'production';

// Import required modules
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

console.log('Starting complete deployment with backend APIs...');
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

// Shopify API helpers
const shopifyApi = {
  async fetchShopifyAPI(endpoint, method = 'GET', data = null) {
    try {
      const url = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2022-10/${endpoint}`;
      const headers = {
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_SECRET,
        'Content-Type': 'application/json'
      };
      
      const options = {
        method,
        headers
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Shopify API error:', error.message);
      throw error;
    }
  },
  
  async getShopifyStatus() {
    try {
      // Simple status check by attempting to get the shop info
      await this.fetchShopifyAPI('shop.json');
      return { connected: true };
    } catch (error) {
      console.error('Shopify connection error:', error.message);
      return { connected: false, error: error.message };
    }
  }
};

// Session setup
if (pool) {
  app.use(session({
    store: new pgSession({
      pool,
      tableName: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'my-super-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
  }));
}

// Basic authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
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
app.get('/api/shopify/status', async (req, res) => {
  try {
    const status = await shopifyApi.getShopifyStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Hardcoded credential check - replace with database check in production
    if (username === 'Admin' && password === 'Ttiinnyy1') {
      req.session.user = { username };
      return res.json({ 
        success: true, 
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
  req.session.destroy();
  res.json({ success: true });
});

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

// Products list endpoint
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    if (!pool) {
      return res.json([]);
    }

    const result = await pool.query(`
      SELECT id, sku, title, shopify_price, cost_price, created_at, updated_at, supplier_url
      FROM products
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    
    // Transform to camelCase
    const products = result.rows.map(product => ({
      id: product.id,
      sku: product.sku,
      title: product.title,
      shopifyPrice: product.shopify_price,
      costPrice: product.cost_price,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      supplierUrl: product.supplier_url
    }));
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
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