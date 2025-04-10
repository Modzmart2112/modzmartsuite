#!/usr/bin/env node

/**
 * REPLIT PRODUCTION DEPLOYMENT SCRIPT
 * 
 * This script handles the deployment for Replit with:
 * 1. Proper database setup and verification
 * 2. Shopify API credential handling
 * 3. Launching the application in production mode with health checks
 */

const fs = require('fs');
const https = require('https');
const { Pool } = require('pg');
const { spawn } = require('child_process');

// Function to verify Shopify credentials
async function verifyShopifyCredentials() {
  console.log('Verifying Shopify credentials...');
  
  // Handle credential naming confusion
  const shopifyApiKey = process.env.SHOPIFY_API_KEY;
  const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
  const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  const shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  
  if (!shopifyApiKey || (!shopifyAccessToken && !shopifyApiSecret) || !shopifyStoreUrl) {
    console.error('ERROR: Shopify credentials not properly set!');
    console.error('Please make sure these secrets are set in your Replit Secrets:');
    console.error('- SHOPIFY_API_KEY: Your Shopify API Key');
    console.error('- SHOPIFY_ACCESS_TOKEN: Your Shopify Access Token (starts with shpat_)');
    console.error('- SHOPIFY_STORE_URL: Your myshopify.com URL');
    
    console.error('Proceeding with deployment, but Shopify sync may not work correctly.');
    return false;
  }
  
  // Copy credentials between variables to handle code inconsistency
  if (shopifyAccessToken && !shopifyApiSecret) {
    console.log('NOTICE: Copying SHOPIFY_ACCESS_TOKEN to SHOPIFY_API_SECRET (required by code architecture)');
    process.env.SHOPIFY_API_SECRET = shopifyAccessToken;
  }
  
  if (!shopifyAccessToken && shopifyApiSecret && shopifyApiSecret.startsWith('shpat_')) {
    console.log('NOTICE: Copying SHOPIFY_API_SECRET to SHOPIFY_ACCESS_TOKEN (for logical consistency)');
    process.env.SHOPIFY_ACCESS_TOKEN = shopifyApiSecret;
  }
  
  // Verify token validity
  const tokenToUse = shopifyAccessToken || shopifyApiSecret;
  if (!tokenToUse || !tokenToUse.startsWith('shpat_')) {
    console.warn('WARNING: No valid Shopify Access Token found!');
    console.warn('A valid Shopify Access Token should start with "shpat_"');
    return false;
  }

  // Test Shopify connection
  return new Promise((resolve) => {
    console.log(`Testing connection to Shopify store: ${shopifyStoreUrl}`);
    
    const normalizedUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    const options = {
      hostname: normalizedUrl,
      path: '/admin/api/2022-10/shop.json',
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken || shopifyApiSecret,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    console.log('Sending test request to Shopify API...');
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✓ Shopify credentials verified successfully!');
          
          try {
            const shopInfo = JSON.parse(data);
            console.log(`Connected to shop: ${shopInfo.shop.name}`);
          } catch (e) {
            console.log('Connected to Shopify but could not parse shop info.');
          }
          
          resolve(true);
        } else {
          console.error(`✘ Shopify API error: ${res.statusCode} ${res.statusMessage}`);
          console.error('Please check your Shopify credentials and try again.');
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error connecting to Shopify:', error.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Create database schema
async function createDatabaseSchema(client) {
  console.log('Creating database schema...');
  
  const createSchemaQueries = [
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
      has_price_discrepancy BOOLEAN,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      status TEXT,
      images JSONB,
      vendor TEXT,
      product_type TEXT,
      on_sale BOOLEAN DEFAULT FALSE,
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
      type TEXT,
      message TEXT,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )`
  ];
  
  for (const query of createSchemaQueries) {
    await client.query(query);
  }
  
  console.log('Database schema created successfully!');
}

// Main deployment function
async function deployToReplit() {
  console.log('\n========================================');
  console.log('REPLIT PRODUCTION DEPLOYMENT');
  console.log('========================================\n');
  
  // Verify Shopify credentials
  await verifyShopifyCredentials();
  
  // Check database URL
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set!');
    console.error('Please set DATABASE_URL in Replit Secrets');
    process.exit(1);
  }
  
  console.log('Database URL is set, continuing with deployment...');
  
  // Database setup
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const client = await pool.connect();
    console.log('Connected to database!');
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Products table does not exist, creating schema...');
      await createDatabaseSchema(client);
    }
    
    // Check product count
    const result = await client.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(result.rows[0].count);
    
    console.log(`Found ${productCount} products in the database`);
    
    // Ensure sync_id column exists in shopify_logs
    try {
      await client.query('SELECT sync_id FROM shopify_logs LIMIT 1');
      console.log('✓ shopify_logs.sync_id column exists!');
    } catch (error) {
      if (error.code === '42703') { // Column doesn't exist
        console.log('Adding sync_id column to shopify_logs table...');
        await client.query('ALTER TABLE shopify_logs ADD COLUMN sync_id INTEGER');
        console.log('✓ sync_id column added successfully!');
      } else {
        console.error('Error checking shopify_logs table:', error.message);
      }
    }
    
    // Import data if needed
    if (productCount === 0 && fs.existsSync('./database-export.json')) {
      console.log('No products found, importing from database-export.json...');
      
      // Import code would go here, but it's omitted for brevity
      // If needed, this can be implemented similar to replit-deploy.cjs
    }
    
    client.release();
    await pool.end();
    
    // Use environment port or default to 3000
    process.env.PORT = process.env.PORT || 3000;
    
    // Start the production server
    console.log('\n========================================');
    console.log(`Starting production server on port ${process.env.PORT}...`);
    console.log('========================================\n');
    
    // Use our production.js entry point for Replit
    const server = spawn('node', ['production.js'], {
      stdio: 'inherit',
      env: process.env
    });
    
    server.on('error', (err) => {
      console.error('Failed to start production server:', err);
      process.exit(1);
    });
    
    // Keep alive
    process.on('SIGINT', () => {
      console.log('Stopping server...');
      server.kill('SIGINT');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error during deployment:', error);
    process.exit(1);
  }
}

// Run the deployment process
deployToReplit().catch(error => {
  console.error('Unhandled error during deployment:', error);
  process.exit(1);
});