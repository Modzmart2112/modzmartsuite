#!/usr/bin/env node

/**
 * Complete Deployment Script
 * 
 * This script handles the entire deployment process including:
 * 1. Building the frontend
 * 2. Starting the server with proper database and Shopify connectivity
 * 3. Automatically detecting and importing data if needed
 * 
 * Usage: node complete-deploy.cjs
 */

// Set to production mode
process.env.NODE_ENV = 'production';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('Starting complete deployment process...');
console.log('======================================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 3000);

// Verify environment variables
checkEnvironment();

// Connect to the database
console.log('\n[1/4] Connecting to database...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Start the deployment process
startDeployment().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});

// Main deployment function
async function startDeployment() {
  try {
    // Check database connection
    await checkDatabaseConnection();
    
    // Verify tables and import data if needed
    await checkAndImportData();
    
    // Set up Express app and start server
    setupExpressApp();
    
  } catch (error) {
    console.error('Deployment process failed:', error);
    throw error;
  }
}

// Check if all environment variables are set
function checkEnvironment() {
  console.log('\n[0/4] Checking environment variables...');
  
  const requiredVars = [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_STORE_URL'
  ];
  
  let allVarsSet = true;
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`Missing environment variable: ${varName}`);
      allVarsSet = false;
    } else {
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        console.log(`✅ ${varName}: ${process.env[varName].substring(0, 4)}...${process.env[varName].substring(process.env[varName].length - 4)}`);
      } else {
        console.log(`✅ ${varName}: ${process.env[varName]}`);
      }
    }
  });
  
  if (!allVarsSet) {
    throw new Error('Required environment variables are missing. Please set them and try again.');
  }
  
  console.log('All required environment variables are set.');
}

// Check database connection
async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    console.log(`✅ Database connected successfully. Database time: ${result.rows[0].time}`);
    client.release();
  } catch (error) {
    console.error('Error connecting to database:', error.message);
    throw error;
  }
}

// Check tables and import data if needed
async function checkAndImportData() {
  console.log('\n[2/4] Checking database tables and data...');
  const client = await pool.connect();
  
  try {
    // Check if products table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      );
    `);
    
    const productsTableExists = tableCheck.rows[0].exists;
    
    if (!productsTableExists) {
      console.log('Products table does not exist. Creating tables...');
      // Table doesn't exist, we need to create the schema
      await createSchema(client);
    } else {
      // Table exists, check if it has data
      const countResult = await client.query('SELECT COUNT(*) FROM products');
      const productCount = parseInt(countResult.rows[0].count);
      
      console.log(`Found ${productCount} products in database.`);
      
      if (productCount === 0) {
        // No products, check if we have an export file to import
        if (fs.existsSync(path.join(__dirname, 'database-export.json'))) {
          console.log('Found database export file. Importing data...');
          await importDataFromFile(client);
        } else {
          console.log('No data to import. The application will start with an empty database.');
          console.log('You can import data later using the migrate-data.cjs script.');
        }
      } else {
        console.log('Database already contains data. Skipping import.');
      }
    }
  } catch (error) {
    console.error('Error checking/importing data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Create database schema
async function createSchema(client) {
  console.log('Creating database schema...');
  
  // Try running db:push to create the schema
  try {
    console.log('Running npm run db:push...');
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log('Schema created successfully');
  } catch (error) {
    console.error('Error creating schema with drizzle:push:', error);
    console.log('Falling back to manual schema creation...');
    
    // Fallback to manual schema creation for basic tables
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
      try {
        await client.query(tableSql);
        console.log('Created table successfully');
      } catch (tableError) {
        console.error('Error creating table:', tableError);
      }
    }
  }
}

// Import data from file
async function importDataFromFile(client) {
  try {
    console.log('\n[3/4] Importing data from database-export.json...');
    
    const importPath = path.join(__dirname, 'database-export.json');
    const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    
    console.log(`Import file found with data from ${importData.exportedAt}`);
    console.log(`Found ${importData.products.length} products to import`);
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Import products
    if (importData.products && importData.products.length > 0) {
      console.log(`Importing ${importData.products.length} products...`);
      let successCount = 0;
      
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
          successCount++;
          
          // Show progress every 100 products
          if (successCount % 100 === 0) {
            console.log(`Imported ${successCount}/${importData.products.length} products...`);
          }
        } catch (error) {
          console.error(`Error importing product ${product.id}:`, error.message);
        }
      }
      
      console.log(`Successfully imported ${successCount}/${importData.products.length} products.`);
    }
    
    // Import stats
    if (importData.stats && importData.stats.length > 0) {
      console.log(`Importing ${importData.stats.length} stats records...`);
      for (const stat of importData.stats) {
        try {
          await client.query(
            `INSERT INTO stats(
              id, key, value, created_at, updated_at
            ) VALUES($1, $2, $3, $4, $5)`,
            [
              stat.id, stat.key, stat.value, stat.created_at, stat.updated_at
            ]
          );
        } catch (error) {
          console.error(`Error importing stat ${stat.id}:`, error.message);
        }
      }
    }
    
    // Import shopify logs if they exist
    if (importData.shopify_logs && importData.shopify_logs.length > 0) {
      console.log(`Importing ${importData.shopify_logs.length} shopify log records...`);
      let logsSuccess = 0;
      
      for (const log of importData.shopify_logs) {
        try {
          await client.query(
            `INSERT INTO shopify_logs(
              id, sync_id, sku, message, created_at
            ) VALUES($1, $2, $3, $4, $5)`,
            [
              log.id, log.sync_id, log.sku, log.message, log.created_at
            ]
          );
          logsSuccess++;
        } catch (error) {
          // Ignore duplicate key errors, just continue
          if (!error.message.includes('duplicate key')) {
            console.error(`Error importing shopify log ${log.id}:`, error.message);
          }
        }
      }
      
      console.log(`Successfully imported ${logsSuccess} shopify log records`);
    }
    
    // Import notifications if they exist
    if (importData.notifications && importData.notifications.length > 0) {
      console.log(`Importing ${importData.notifications.length} notification records...`);
      let notifSuccess = 0;
      
      for (const notification of importData.notifications) {
        try {
          await client.query(
            `INSERT INTO notifications(
              id, product_id, message, status, created_at, updated_at
            ) VALUES($1, $2, $3, $4, $5, $6)`,
            [
              notification.id, notification.product_id, notification.message,
              notification.status, notification.created_at, notification.updated_at
            ]
          );
          notifSuccess++;
        } catch (error) {
          // Ignore duplicate key errors, just continue
          if (!error.message.includes('duplicate key')) {
            console.error(`Error importing notification ${notification.id}:`, error.message);
          }
        }
      }
      
      console.log(`Successfully imported ${notifSuccess} notification records`);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('Data import completed successfully!');
    
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
    throw error;
  }
}

// Setup Express app and start server
function setupExpressApp() {
  console.log('\n[4/4] Setting up Express app and starting server...');
  
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
  
  // Function to make a request to the Shopify API
  async function requestShopify(endpoint, method = 'GET', data = null) {
    try {
      // Use the URL without embedding credentials
      const url = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2022-10/${endpoint}`;
      
      // Create a basic auth string from the API key and password
      const authString = Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_SECRET}`).toString('base64');
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Basic ${authString}`
        }
      };
      
      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }
      
      console.log(`Making Shopify API request to: ${endpoint}`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        console.error(`Shopify API error: ${response.status} ${response.statusText}`);
        if (response.status === 401) {
          console.error('Authentication failed. Please check your Shopify API credentials.');
        }
        return null;
      }
      
      console.log(`Shopify API request to ${endpoint} successful`);
      return await response.json();
    } catch (error) {
      console.error('Error making Shopify API request:', error.message);
      return null;
    }
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
  
  // Shopify status endpoint - with actual connection test
  app.get('/api/shopify/status', async (req, res) => {
    try {
      // Check if environment variables are set
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
      
      // Test the actual connection
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
      console.error('Shopify connection error:', error);
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
  
  // Shopify connection test endpoint
  app.get('/api/shopify/connection-test', requireAuth, async (req, res) => {
    try {
      console.log('Testing Shopify connection...');
      
      // Step 1: Check if environment variables are set
      if (!process.env.SHOPIFY_API_KEY) {
        return res.status(400).json({ error: 'SHOPIFY_API_KEY is not set' });
      }
      
      if (!process.env.SHOPIFY_API_SECRET) {
        return res.status(400).json({ error: 'SHOPIFY_API_SECRET is not set' });
      }
      
      if (!process.env.SHOPIFY_STORE_URL) {
        return res.status(400).json({ error: 'SHOPIFY_STORE_URL is not set' });
      }
      
      // Step 2: Test the connection
      try {
        const shopData = await requestShopify('shop.json');
        
        if (!shopData || !shopData.shop) {
          return res.status(500).json({ 
            error: 'Failed to connect to Shopify API', 
            details: 'Could not retrieve shop data'
          });
        }
        
        // Success
        return res.json({
          success: true,
          shop: {
            name: shopData.shop.name,
            email: shopData.shop.email,
            domain: shopData.shop.domain,
            country: shopData.shop.country_name,
            created_at: shopData.shop.created_at
          },
          message: 'Successfully connected to Shopify API'
        });
      } catch (connectionError) {
        console.error('Shopify connection test error:', connectionError);
        return res.status(500).json({ 
          error: 'Failed to connect to Shopify API', 
          details: connectionError.message 
        });
      }
    } catch (error) {
      console.error('Shopify connection test error:', error);
      res.status(500).json({ error: error.message });
    }
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
  
  // Dashboard activity endpoint
  app.get('/api/dashboard/activity', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          sync_id AS "syncId", 
          sku, 
          message, 
          created_at AS "createdAt" 
        FROM shopify_logs 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      res.json({
        events: result.rows
      });
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({
        error: 'Failed to fetch activity',
        message: error.message
      });
    }
  });
  
  // Get notifications
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status || 'all';
      
      let query = `
        SELECT 
          n.id, 
          n.product_id AS "productId", 
          n.message, 
          n.status, 
          n.created_at AS "createdAt", 
          n.updated_at AS "updatedAt",
          p.sku,
          p.title
        FROM notifications n
        LEFT JOIN products p ON n.product_id = p.id
      `;
      
      if (status !== 'all') {
        query += ` WHERE n.status = $1`;
      }
      
      query += ` ORDER BY n.created_at DESC LIMIT $${status !== 'all' ? '2' : '1'}`;
      
      const result = status !== 'all' 
        ? await pool.query(query, [status, limit])
        : await pool.query(query, [limit]);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get products with price discrepancies
  app.get('/api/products/discrepancies', requireAuth, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          sku, 
          title, 
          shopify_price AS "shopifyPrice", 
          cost_price AS "costPrice",
          supplier_price AS "supplierPrice",
          supplier_url AS "supplierUrl",
          last_checked AS "lastChecked"
        FROM products 
        WHERE has_price_discrepancy = true
        ORDER BY updated_at DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching price discrepancies:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get shopify sync progress
  app.get('/api/scheduler/shopify-sync-progress', async (req, res) => {
    try {
      // Get the latest sync ID
      const syncResult = await pool.query(`
        SELECT 
          MAX(sync_id) AS "syncId" 
        FROM shopify_logs
      `);
      
      const syncId = syncResult.rows[0].syncId || 0;
      
      if (syncId === 0) {
        return res.json({
          id: 0,
          type: 'shopify-sync',
          status: 'idle',
          message: 'No sync in progress',
          progress: 0,
          total: 0,
          startTime: null,
          endTime: null
        });
      }
      
      // Get the start and end times for this sync
      const timeResult = await pool.query(`
        SELECT 
          MIN(created_at) AS "startTime",
          MAX(created_at) AS "endTime"
        FROM shopify_logs
        WHERE sync_id = $1
      `, [syncId]);
      
      const startTime = timeResult.rows[0].startTime;
      const endTime = timeResult.rows[0].endTime;
      
      // Calculate if the sync is still in progress
      const elapsedMinutes = startTime ? Math.round((Date.now() - new Date(startTime).getTime()) / 60000) : 0;
      const isActive = elapsedMinutes < 60; // If it's been less than 60 minutes, consider it active
      
      // Count the number of products processed
      const countResult = await pool.query(`
        SELECT COUNT(DISTINCT sku) AS "processed"
        FROM shopify_logs
        WHERE sync_id = $1
      `, [syncId]);
      
      const processed = parseInt(countResult.rows[0].processed) || 0;
      
      // Get total products
      const totalResult = await pool.query(`
        SELECT COUNT(*) AS "total"
        FROM products
      `);
      
      const total = parseInt(totalResult.rows[0].total) || 0;
      
      res.json({
        id: syncId,
        type: 'shopify-sync',
        status: isActive ? 'running' : 'completed',
        message: isActive ? `Processing products (${processed}/${total})` : 'Sync completed',
        progress: processed,
        total: total,
        startTime: startTime,
        endTime: isActive ? null : endTime
      });
    } catch (error) {
      console.error('Error fetching sync progress:', error);
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get scheduler status
  app.get('/api/scheduler/status', (req, res) => {
    // Simple mock response to satisfy the UI
    res.json({
      activeJobs: ["daily-price-check", "shopify-sync"],
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lastRun: new Date().toISOString()
    });
  });
  
  // All other routes serve the index.html for the SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'public', 'index.html'));
  });
  
  // Start the server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`======================================================`);
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
}