#!/usr/bin/env node

/**
 * Simple One-Command Deployment Script
 * 
 * This script handles everything automatically:
 * 1. Connects to the database
 * 2. Creates tables if needed
 * 3. Imports data if available
 * 4. Starts the server
 * 
 * Usage: node simple-deploy.cjs
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Set to production mode
process.env.NODE_ENV = 'production';

console.log('Starting simplified deployment...');
console.log('Checking environment...');

// Check for essential environment variables
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET || !process.env.SHOPIFY_STORE_URL) {
  console.error('Warning: Some Shopify API environment variables are missing');
  console.error('Shopify integration features may not work properly');
}

// Connect to the database
console.log('Connecting to database...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Simple in-memory auth
const authenticatedTokens = new Set();

// Shopify API helpers
function normalizeShopifyUrl(url) {
  if (!url) return '';
  let normalized = url.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/\/+$/, '');
  return normalized;
}

// Function to make a request to the Shopify API
async function requestShopify(endpoint, method = 'GET', data = null) {
  try {
    // Use the URL without embedding credentials
    const url = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2022-10/${endpoint}`;
    
    // Use X-Shopify-Access-Token header for authentication, consistent with our main API code
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_API_SECRET
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`Shopify API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error making Shopify API request:', error.message);
    return null;
  }
}

// Build the frontend
async function buildFrontend() {
  try {
    console.log('\nBuilding frontend...');
    // Check if the dist directory exists
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
      console.log('Building frontend with npm run build...');
      require('child_process').execSync('npm run build', { stdio: 'inherit' });
      console.log('Frontend built successfully');
    } else {
      console.log('Frontend already built (dist directory exists)');
    }
    return true;
  } catch (error) {
    console.error('Error building frontend:', error.message);
    return false;
  }
}

// Initialize and start the server
async function startServer() {
  try {
    // Check database connection
    const client = await pool.connect();
    console.log('Database connected successfully');
    
    try {
      // Check if products table exists
      const tablesExist = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'products'
        );
      `);
      
      if (!tablesExist.rows[0].exists) {
        console.log('Creating database tables...');
        // Create necessary tables
        const tables = [
          `CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            sku TEXT,
            title TEXT,
            description TEXT,
            shopify_id TEXT,
            shopify_price DECIMAL,
            cost_price DECIMAL,
            supplier_url TEXT,
            supplier_price DECIMAL,
            last_scraped TIMESTAMP,
            last_checked TIMESTAMP,
            has_price_discrepancy BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            status TEXT,
            images JSONB,
            vendor TEXT,
            product_type TEXT,
            on_sale BOOLEAN DEFAULT false,
            original_price DECIMAL,
            sale_end_date TIMESTAMP,
            sale_id INTEGER
          )`,
          
          `CREATE TABLE IF NOT EXISTS stats (
            id SERIAL PRIMARY KEY,
            key TEXT,
            value TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )`,
          
          `CREATE TABLE IF NOT EXISTS shopify_logs (
            id SERIAL PRIMARY KEY,
            sync_id INTEGER,
            sku TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )`,
          
          `CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            product_id INTEGER,
            message TEXT,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )`
        ];
        
        for (const tableSql of tables) {
          await client.query(tableSql);
        }
        
        console.log('Database tables created successfully');
        
        // Check if we have a data file to import
        if (fs.existsSync(path.join(__dirname, 'database-export.json'))) {
          console.log('Found database export file, importing data...');
          const importData = JSON.parse(fs.readFileSync(path.join(__dirname, 'database-export.json'), 'utf8'));
          
          // Import products
          if (importData.products && importData.products.length > 0) {
            console.log(`Importing ${importData.products.length} products...`);
            
            await client.query('BEGIN');
            
            for (const product of importData.products) {
              try {
                await client.query(
                  `INSERT INTO products(
                    id, sku, title, description, shopify_id, shopify_price, cost_price, 
                    supplier_url, supplier_price, last_scraped, last_checked, 
                    has_price_discrepancy, created_at, updated_at, status, images,
                    vendor, product_type, on_sale, original_price, sale_end_date, sale_id
                  ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
                  [
                    product.id, product.sku, product.title, product.description, 
                    product.shopify_id, product.shopify_price, product.cost_price,
                    product.supplier_url, product.supplier_price, product.last_scraped, 
                    product.last_checked, product.has_price_discrepancy, 
                    product.created_at, product.updated_at, product.status, product.images,
                    product.vendor, product.product_type, product.on_sale,
                    product.original_price, product.sale_end_date, product.sale_id
                  ]
                );
              } catch (error) {
                // Ignore errors to keep the process going
              }
            }
            
            await client.query('COMMIT');
            console.log('Data import completed');
          }
        }
      } else {
        // Count products
        const countResult = await client.query('SELECT COUNT(*) FROM products');
        console.log(`Database ready with ${countResult.rows[0].count} products`);
      }
    } catch (error) {
      console.error('Database setup error:', error);
    } finally {
      client.release();
    }
    
    // Set up Express app
    const app = express();
    app.use(express.json());
    
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
        const isConfigured = process.env.SHOPIFY_API_KEY && 
                            process.env.SHOPIFY_API_SECRET && 
                            process.env.SHOPIFY_STORE_URL;
                          
        if (!isConfigured) {
          return res.json({
            connected: false,
            storeUrl: '(not configured)',
            error: 'Missing Shopify configuration'
          });
        }
        
        const shopData = await requestShopify('shop.json');
        const normalizedUrl = normalizeShopifyUrl(process.env.SHOPIFY_STORE_URL);
        
        if (shopData && shopData.shop) {
          res.json({
            connected: true,
            storeUrl: normalizedUrl,
            shopName: shopData.shop.name,
            shopEmail: shopData.shop.email
          });
        } else {
          res.json({
            connected: false,
            storeUrl: normalizedUrl,
            error: 'Failed to connect to Shopify API'
          });
        }
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
        res.status(500).json({
          error: 'Failed to fetch stats',
          message: error.message
        });
      }
    });
    
    // Products list endpoint
    app.get('/api/products', requireAuth, async (req, res) => {
      try {
        const { page = 1, limit = 50, search = '', sort = 'id', order = 'asc' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let queryParams = [];
        let searchCondition = '';
        
        if (search) {
          searchCondition = 'WHERE sku ILIKE $1 OR title ILIKE $1';
          queryParams.push(`%${search}%`);
        }
        
        // Make sure sort field exists to prevent SQL injection
        const validSortFields = ['id', 'sku', 'title', 'cost_price', 'shopify_price', 'created_at', 'updated_at'];
        const sortField = validSortFields.includes(sort) ? sort : 'id';
        
        // Make sure order is valid
        const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
        
        // Add additional parameters for pagination
        const limitParam = parseInt(limit);
        const offsetParam = parseInt(offset);
        
        queryParams.push(limitParam, offsetParam);
        
        const queryText = `
          SELECT * FROM products 
          ${searchCondition}
          ORDER BY ${sortField} ${sortOrder}
          LIMIT $${queryParams.length - 1} 
          OFFSET $${queryParams.length}
        `;
        
        const countText = `
          SELECT COUNT(*) FROM products ${searchCondition}
        `;
        
        const productsResult = await pool.query(queryText, queryParams);
        const countResult = await pool.query(countText, search ? [`%${search}%`] : []);
        
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limitParam);
        
        res.json({
          products: productsResult.rows.map(product => ({
            id: product.id,
            sku: product.sku,
            title: product.title,
            description: product.description,
            shopifyId: product.shopify_id,
            shopifyPrice: parseFloat(product.shopify_price) || 0,
            costPrice: parseFloat(product.cost_price) || 0,
            supplierUrl: product.supplier_url,
            supplierPrice: parseFloat(product.supplier_price) || 0,
            lastScraped: product.last_scraped,
            lastChecked: product.last_checked,
            hasPriceDiscrepancy: product.has_price_discrepancy,
            createdAt: product.created_at,
            updatedAt: product.updated_at,
            status: product.status,
            images: product.images,
            vendor: product.vendor,
            productType: product.product_type,
            onSale: product.on_sale,
            originalPrice: parseFloat(product.original_price) || 0,
            saleEndDate: product.sale_end_date,
            saleId: product.sale_id
          })),
          pagination: {
            totalItems: totalCount,
            totalPages,
            currentPage: parseInt(page),
            pageSize: limitParam
          }
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to fetch products',
          message: error.message
        });
      }
    });
    
    // Shopify sync status endpoint
    app.get('/api/shopify/sync/status', requireAuth, async (req, res) => {
      try {
        // Get the most recent sync ID
        const syncIdResult = await pool.query(`
          SELECT MAX(sync_id) as current_sync_id 
          FROM shopify_logs
        `);
        
        const currentSyncId = syncIdResult.rows[0].current_sync_id || 0;
        
        // Get latest log entries for this sync
        const logsResult = await pool.query(`
          SELECT * FROM shopify_logs 
          WHERE sync_id = $1 
          ORDER BY created_at DESC 
          LIMIT 20
        `, [currentSyncId]);
        
        // Get syncing products count from stats
        const statsResult = await pool.query(`
          SELECT value FROM stats WHERE key = 'syncing'
        `);
        
        const isSyncing = statsResult.rows.length > 0 && statsResult.rows[0].value === 'true';
        
        res.json({
          status: isSyncing ? 'syncing' : 'idle',
          currentSyncId,
          recentLogs: logsResult.rows.map(log => ({
            id: log.id,
            syncId: log.sync_id,
            sku: log.sku,
            message: log.message,
            createdAt: log.created_at
          })),
          progress: {
            current: 0,
            total: 0,
            percentage: 0
          }
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to fetch sync status',
          message: error.message
        });
      }
    });
    
    // Single product endpoint
    app.get('/api/products/:id', requireAuth, async (req, res) => {
      try {
        const productId = parseInt(req.params.id);
        
        if (isNaN(productId)) {
          return res.status(400).json({ error: 'Invalid product ID' });
        }
        
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = result.rows[0];
        
        res.json({
          id: product.id,
          sku: product.sku,
          title: product.title,
          description: product.description,
          shopifyId: product.shopify_id,
          shopifyPrice: parseFloat(product.shopify_price) || 0,
          costPrice: parseFloat(product.cost_price) || 0,
          supplierUrl: product.supplier_url,
          supplierPrice: parseFloat(product.supplier_price) || 0,
          lastScraped: product.last_scraped,
          lastChecked: product.last_checked,
          hasPriceDiscrepancy: product.has_price_discrepancy,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          status: product.status,
          images: product.images,
          vendor: product.vendor,
          productType: product.product_type,
          onSale: product.on_sale,
          originalPrice: parseFloat(product.original_price) || 0,
          saleEndDate: product.sale_end_date,
          saleId: product.sale_id
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to fetch product',
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
      console.log(`\n==================================================`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`==================================================`);
      console.log(`\nYour application is now running! You can access it at:`);
      console.log(`http://localhost:${PORT}`);
      console.log(`\nLogin with username: Admin and password: Ttiinnyy1`);
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
    
  } catch (error) {
    console.error('Server initialization error:', error);
    process.exit(1);
  }
}

// Build the frontend and start the server
async function deploy() {
  try {
    // First build the frontend
    await buildFrontend();
    
    // Then start the server
    await startServer();
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

// Run the deployment
deploy();