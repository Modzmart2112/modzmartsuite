/**
 * Server routes - CommonJS fallback for deployment
 * This is a functional version of routes.ts that works in the deployment environment
 */

const express = require('express');
const router = express.Router();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { eq, desc, and, asc, isNotNull, sql } = require('drizzle-orm');
const ws = require('ws');

// Configure WebSocket for Neon Serverless - this is critical for deployment
neonConfig.webSocketConstructor = ws;
neonConfig.wsProxy = process.env.WS_PROXY || undefined;
neonConfig.useSecureWebSocket = process.env.DATABASE_URL?.startsWith('postgres://') ? false : true;
neonConfig.pipelineTLS = process.env.PIPELINE_TLS !== 'false';
neonConfig.pipelineConnect = process.env.PIPELINE_CONNECT !== 'false';
const path = require('path');
const fs = require('fs');

// Check for DATABASE_URL environment variable
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set!");
}

// Database connection setup
let db, schema, storage;
try {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Dynamic import of schema (since it's a ES module)
  try {
    // Attempt to load pre-built CJS version of the schema if it exists
    schema = require('../dist/shared/schema.cjs');
  } catch (err) {
    console.error('Could not load CJS schema, falling back to minimal schema definition:', err.message);
    
    // Define minimal schema for core functionality
    schema = {
      users: {
        id: { name: 'id' },
        username: { name: 'username' },
        firstName: { name: 'first_name' },
        lastName: { name: 'last_name' },
        email: { name: 'email' },
        profilePicture: { name: 'profile_picture' },
        telegramChatId: { name: 'telegram_chat_id' },
        shopifyApiKey: { name: 'shopify_api_key' },
        shopifyApiSecret: { name: 'shopify_api_secret' },
        shopifyStoreUrl: { name: 'shopify_store_url' }
      },
      products: {
        id: { name: 'id' },
        sku: { name: 'sku' },
        title: { name: 'title' },
        shopifyId: { name: 'shopify_id' },
        shopifyPrice: { name: 'shopify_price' },
        costPrice: { name: 'cost_price' },
        supplierUrl: { name: 'supplier_url' },
        supplierPrice: { name: 'supplier_price' },
        onSale: { name: 'on_sale' }
      },
      stats: {
        id: { name: 'id' },
        productCount: { name: 'product_count' },
        lastSync: { name: 'last_sync' },
        activeSyncId: { name: 'active_sync_id' }
      }
    };
  }
  
  // Initialize drizzle with the schema
  db = drizzle(pool);
  
  console.log('Database connection established successfully');
} catch (err) {
  console.error('Database connection failed:', err);
}

// Helper function to handle controller errors
const asyncHandler = (fn) => {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error("API Error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };
};

// Health check endpoint for the API
router.get('/health', asyncHandler(async (req, res) => {
  // Check database connection
  let dbStatus = 'unknown';
  let dbConnection = false;
  
  try {
    if (db) {
      // Try a simple query
      const result = await db.execute(sql`SELECT 1 AS health_check`);
      dbConnection = result.rows && result.rows.length > 0;
      dbStatus = dbConnection ? 'connected' : 'failed';
    } else {
      dbStatus = 'not initialized';
    }
  } catch (err) {
    dbStatus = `error: ${err.message}`;
  }
  
  res.status(200).json({
    status: 'ok',
    message: 'API server is running',
    database: {
      status: dbStatus,
      connection: dbConnection,
      url: process.env.DATABASE_URL ? 'set' : 'missing'
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
}));

// Get all products
router.get('/products', asyncHandler(async (req, res) => {
  if (!db) {
    return res.status(503).json({ message: "Database connection not available" });
  }
  
  try {
    // Parse pagination parameters
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    // Execute query with proper SQL structure
    const query = `
      SELECT * FROM products
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await db.execute(query);
    const products = result.rows || [];
    
    // Get total count for pagination
    const countResult = await db.execute('SELECT COUNT(*) FROM products');
    const totalCount = parseInt(countResult.rows[0].count || '0');
    
    res.json({
      products,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Failed to fetch products', error: err.message });
  }
}));

// Get product by ID
router.get('/products/:id', asyncHandler(async (req, res) => {
  if (!db) {
    return res.status(503).json({ message: "Database connection not available" });
  }
  
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }
  
  const query = `SELECT * FROM products WHERE id = ${id}`;
  const result = await db.execute(query);
  
  if (!result.rows || result.rows.length === 0) {
    return res.status(404).json({ message: "Product not found" });
  }
  
  res.json(result.rows[0]);
}));

// Get basic stats
router.get('/stats', asyncHandler(async (req, res) => {
  if (!db) {
    return res.status(503).json({ message: "Database connection not available" });
  }
  
  try {
    const statsQuery = `SELECT * FROM stats ORDER BY id DESC LIMIT 1`;
    const statsResult = await db.execute(statsQuery);
    const stats = statsResult.rows && statsResult.rows.length > 0 
      ? statsResult.rows[0] 
      : { product_count: 0, last_sync: null };
    
    const productsWithDiscrepanciesQuery = `
      SELECT COUNT(*) FROM products 
      WHERE has_price_discrepancy = true
    `;
    const discrepanciesResult = await db.execute(productsWithDiscrepanciesQuery);
    const discrepanciesCount = parseInt(discrepanciesResult.rows[0].count || '0');
    
    const productsOnSaleQuery = `
      SELECT COUNT(*) FROM products 
      WHERE on_sale = true
    `;
    const onSaleResult = await db.execute(productsOnSaleQuery);
    const onSaleCount = parseInt(onSaleResult.rows[0].count || '0');
    
    res.json({
      productCount: parseInt(stats.product_count) || 0,
      lastSync: stats.last_sync,
      activeSyncId: stats.active_sync_id,
      priceDiscrepancies: discrepanciesCount,
      productsOnSale: onSaleCount
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
  }
}));

// Get user profile data
router.get('/user/profile', asyncHandler(async (req, res) => {
  if (!db) {
    return res.status(503).json({ message: "Database connection not available" });
  }
  
  // In a real app, we'd get the user ID from the session or token
  // For now, we'll use a hardcoded user ID of 1
  const userId = 1;
  
  try {
    const query = `SELECT * FROM users WHERE id = ${userId}`;
    const result = await db.execute(query);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      email: user.email || '',
      profilePicture: user.profile_picture || ''
    });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Failed to fetch user profile', error: err.message });
  }
}));

// Update user profile data
router.post('/user/profile', asyncHandler(async (req, res) => {
  if (!db) {
    return res.status(503).json({ message: "Database connection not available" });
  }
  
  // In a real app, we'd get the user ID from the session or token
  const userId = 1;
  let { firstName, lastName, email } = req.body;
  
  try {
    // Get existing user
    const userQuery = `SELECT * FROM users WHERE id = ${userId}`;
    const userResult = await db.execute(userQuery);
    
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const existingUser = userResult.rows[0];
    
    // Use existing values if fields are empty
    firstName = firstName?.trim() || existingUser.first_name || '';
    lastName = lastName?.trim() || existingUser.last_name || '';
    email = email?.trim() || existingUser.email || '';
    
    // Update user
    const updateQuery = `
      UPDATE users 
      SET first_name = '${firstName}', last_name = '${lastName}', email = '${email}'
      WHERE id = ${userId}
      RETURNING id, username, first_name, last_name, email, profile_picture
    `;
    
    const result = await db.execute(updateQuery);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ message: "Failed to update user" });
    }
    
    const updatedUser = result.rows[0];
    
    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      firstName: updatedUser.first_name || '',
      lastName: updatedUser.last_name || '',
      email: updatedUser.email || '',
      profilePicture: updatedUser.profile_picture || ''
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ message: 'Failed to update user profile', error: err.message });
  }
}));

// Echo endpoint for testing with POST
router.post('/echo', (req, res) => {
  res.status(200).json({
    message: 'Echo endpoint working',
    body: req.body || {},
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for diagnostics
router.get('/test', (req, res) => {
  res.status(200).json({
    message: 'API test endpoint working',
    database: db ? 'connected' : 'not connected',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    schema: schema ? 'loaded' : 'not loaded',
    schemaKeys: schema ? Object.keys(schema) : []
  });
});

// Fallback for other routes
router.all('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested API endpoint does not exist or is not available in this deployment.',
    availableEndpoints: [
      '/api/health', 
      '/api/test', 
      '/api/echo',
      '/api/products',
      '/api/products/:id',
      '/api/stats',
      '/api/user/profile'
    ],
  });
});

module.exports = router;