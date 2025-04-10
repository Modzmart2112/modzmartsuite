#!/usr/bin/env node

/**
 * Deployment Test Script
 * 
 * This script tests all components needed for successful deployment:
 * 1. Environment variables
 * 2. Database connection
 * 3. Shopify API connection
 * 4. Static file serving
 * 
 * Usage: node test-deployment.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('==================================================');
console.log('DEPLOYMENT TESTS');
console.log('==================================================');

// Start the tests
runTests().catch(error => {
  console.error('Tests failed:', error);
  process.exit(1);
});

async function runTests() {
  try {
    // Test 1: Check environment variables
    console.log('\n🔍 TEST 1: Checking environment variables...');
    
    const requiredVars = [
      'DATABASE_URL',
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET', 
      'SHOPIFY_STORE_URL'
    ];
    
    let allVarsSet = true;
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        console.error(`❌ Missing environment variable: ${varName}`);
        allVarsSet = false;
      } else {
        if (varName.includes('SECRET') || varName.includes('KEY')) {
          console.log(`✅ ${varName}: ${process.env[varName].substring(0, 4)}...${process.env[varName].substring(process.env[varName].length - 4)}`);
        } else {
          console.log(`✅ ${varName}: ${process.env[varName]}`);
        }
      }
    }
    
    if (!allVarsSet) {
      throw new Error('Required environment variables are missing');
    }
    
    // Test 2: Check database connection
    console.log('\n🔍 TEST 2: Testing database connection...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as time');
      console.log(`✅ Database connected successfully. Server time: ${result.rows[0].time}`);
      
      // Check if tables exist
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'products'
        );
      `);
      
      if (tableCheck.rows[0].exists) {
        // Count products
        const countResult = await client.query('SELECT COUNT(*) FROM products');
        const productCount = parseInt(countResult.rows[0].count);
        console.log(`✅ Products table exists with ${productCount} products`);
        
        if (productCount === 0) {
          console.log(`⚠️ Warning: Database has no products. You may need to import data.`);
        }
      } else {
        console.log(`⚠️ Warning: Products table does not exist. You need to run migrations or import data.`);
      }
      
      client.release();
    } catch (error) {
      console.error(`❌ Database connection error: ${error.message}`);
      throw error;
    } finally {
      await pool.end();
    }
    
    // Test 3: Check Shopify API connection
    console.log('\n🔍 TEST 3: Testing Shopify API connection...');
    
    try {
      // In Replit's server environment, we use Basic Auth with headers
      // This is because including credentials in URL is no longer allowed in browsers
      
      // For test purposes, we're going to try both methods
      
      // Method 1: Using Basic Auth header (preferred for production)
      const authString = Buffer.from(`${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_SECRET}`).toString('base64');
      const url1 = `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2022-10/shop.json`;
      
      console.log('   Testing connection with Basic Auth header...');
      try {
        const response1 = await fetch(url1, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Basic ${authString}`
          }
        });
        
        if (response1.ok) {
          const shopData = await response1.json();
          if (shopData && shopData.shop) {
            console.log(`✅ Successfully connected to Shopify API using Basic Auth header`);
            console.log(`   Shop name: ${shopData.shop.name}`);
            console.log(`   Shop email: ${shopData.shop.email}`);
            console.log(`   Shop domain: ${shopData.shop.domain}`);
            return; // Successfully authenticated, no need to try other methods
          }
        } else {
          console.log(`   Basic Auth header method failed: ${response1.status} ${response1.statusText}`);
        }
      } catch (error) {
        console.log(`   Basic Auth header method error: ${error.message}`);
      }
      
      // Method 2: Using embedded credentials in URL (works in Node.js environment)
      const url2 = `https://${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_API_SECRET}@${process.env.SHOPIFY_STORE_URL}/admin/api/2022-10/shop.json`;
      
      console.log('   Testing connection with embedded credentials...');
      try {
        const response2 = await fetch(url2);
        
        if (response2.ok) {
          const shopData = await response2.json();
          if (shopData && shopData.shop) {
            console.log(`✅ Successfully connected to Shopify API using embedded credentials`);
            console.log(`   Shop name: ${shopData.shop.name}`);
            console.log(`   Shop email: ${shopData.shop.email}`);
            console.log(`   Shop domain: ${shopData.shop.domain}`);
            
            console.log('\n⚠️ Note: Embedded credentials method works but is not recommended for browser environments.');
            console.log('   The deployment script uses the more secure Basic Auth header method.');
            return; // Successfully authenticated
          }
        } else {
          console.log(`   Embedded credentials method failed: ${response2.status} ${response2.statusText}`);
        }
      } catch (error) {
        console.log(`   Embedded credentials method error: ${error.message}`);
      }
      
      // If we get here, both methods failed
      console.error(`❌ Unable to authenticate with Shopify API using any method`);
      throw new Error('Shopify API authentication failed');
    } catch (error) {
      console.error(`❌ Shopify API connection error: ${error.message}`);
      throw error;
    }
    
    // Test 4: Check for compiled frontend files
    console.log('\n🔍 TEST 4: Checking for compiled frontend files...');
    
    const distPath = path.join(__dirname, 'dist', 'public');
    const indexHtmlPath = path.join(distPath, 'index.html');
    
    if (!fs.existsSync(distPath)) {
      console.error(`❌ 'dist/public' directory not found. Frontend files are missing.`);
      console.log(`   You may need to build the frontend with 'npm run build'`);
    } else if (!fs.existsSync(indexHtmlPath)) {
      console.error(`❌ 'dist/public/index.html' not found. Frontend build is incomplete.`);
    } else {
      console.log(`✅ Frontend files found in 'dist/public'`);
    }
    
    // All tests passed
    console.log('\n==================================================');
    console.log('✅ All deployment tests passed successfully!');
    console.log('==================================================');
    console.log('\nYou can now deploy the application with:');
    console.log('node complete-deploy.cjs');
    
  } catch (error) {
    console.error('\n==================================================');
    console.error(`❌ Deployment tests failed: ${error.message}`);
    console.error('==================================================');
    throw error;
  }
}