#!/usr/bin/env node

/**
 * One-Click Deployment Script
 * 
 * This script provides a simple, guided deployment process by:
 * 1. Checking for required environment variables
 * 2. Testing database connection
 * 3. Checking if data import is needed
 * 4. Starting the server
 * 
 * Usage: node deploy.cjs
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { execSync, spawn } = require('child_process');

console.log('==================================================');
console.log('SHOPIFY INTEGRATION PLATFORM - ONE-CLICK DEPLOYMENT');
console.log('==================================================');

// Start the deployment process
startDeployment().catch(error => {
  console.error('Deployment failed:', error);
  process.exit(1);
});

async function startDeployment() {
  try {
    // Step 1: Check environment variables
    console.log('\n🔍 Step 1: Checking environment variables...');
    checkEnvironmentVariables();
    
    // Step 2: Test database connection
    console.log('\n🔍 Step 2: Testing database connection...');
    await testDatabaseConnection();
    
    // Step 3: Check if data import is needed
    console.log('\n🔍 Step 3: Checking database data...');
    await checkAndImportData();
    
    // Step 4: Start the server
    console.log('\n🔍 Step 4: Starting the server...');
    await startServer();
    
  } catch (error) {
    console.error(`❌ Deployment error: ${error.message}`);
    throw error;
  }
}

function checkEnvironmentVariables() {
  const requiredVars = [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_STORE_URL'
  ];
  
  let missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    } else {
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        console.log(`✅ ${varName}: ${process.env[varName].substring(0, 4)}...${process.env[varName].substring(process.env[varName].length - 4)}`);
      } else {
        console.log(`✅ ${varName}: ${process.env[varName]}`);
      }
    }
  }
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing environment variables: ${missingVars.join(', ')}`);
    console.error('Please set these environment variables and try again.');
    throw new Error('Missing environment variables');
  }
  
  console.log('✅ All required environment variables are set');
}

async function testDatabaseConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW() as time');
      console.log(`✅ Database connected successfully. Server time: ${result.rows[0].time}`);
      
      return client;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    console.error('Please check your DATABASE_URL environment variable and try again.');
    throw error;
  } finally {
    await pool.end();
  }
}

async function checkAndImportData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
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
      
      if (!tableCheck.rows[0].exists) {
        console.log('❌ Database tables do not exist');
        console.log('Creating database schema and importing data...');
        
        // Run the import script
        if (fs.existsSync(path.join(__dirname, 'database-export.json'))) {
          console.log('Found database-export.json, importing data...');
          execSync('node import-data.cjs', { stdio: 'inherit' });
          console.log('✅ Database schema created and data imported successfully');
        } else {
          console.log('⚠️ No database-export.json found, creating empty schema...');
          // Create empty schema
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
          
          console.log('✅ Empty database schema created');
          console.log('⚠️ Warning: Your database is empty. You can import data later with the import-data.cjs script.');
        }
      } else {
        // Count products
        const countResult = await client.query('SELECT COUNT(*) FROM products');
        const productCount = parseInt(countResult.rows[0].count);
        
        if (productCount === 0) {
          console.log('⚠️ Database tables exist but contain no products');
          
          if (fs.existsSync(path.join(__dirname, 'database-export.json'))) {
            console.log('Found database-export.json, importing data...');
            execSync('node import-data.cjs', { stdio: 'inherit' });
            console.log('✅ Data imported successfully');
          } else {
            console.log('⚠️ No database-export.json found, continuing with empty database.');
            console.log('⚠️ You may need to import data later or sync with Shopify to populate the database.');
          }
        } else {
          console.log(`✅ Database contains ${productCount} products`);
        }
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Error checking/importing data: ${error.message}`);
    throw error;
  } finally {
    await pool.end();
  }
}

async function startServer() {
  console.log('\n🚀 Starting the application server...');
  
  // Use the complete-deploy.cjs script to start the server
  const serverProcess = spawn('node', ['complete-deploy.cjs'], { 
    stdio: 'inherit',
    env: process.env
  });
  
  // Handle server process events
  serverProcess.on('error', (error) => {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  });
  
  console.log('\n✅ Application is now running!');
  console.log(`\n💡 Access your application at: http://localhost:${process.env.PORT || 3000}`);
  console.log(`\n💡 Login with username: Admin and password: Ttiinnyy1`);
  console.log('\n==================================================');
  console.log('Press Ctrl+C to stop the server');
  console.log('==================================================');
}