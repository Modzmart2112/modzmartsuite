const { Pool } = require('pg');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Check if the database connection works
async function checkDatabase() {
  console.log('Testing database connection...');
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('ERROR: DATABASE_URL environment variable is not set!');
      return false;
    }
    
    console.log('Database URL is set, attempting connection...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    const client = await pool.connect();
    console.log('Successfully connected to database!');
    
    // Test tables
    try {
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'products'
        );
      `);
      
      if (tableResult.rows[0].exists) {
        console.log('Products table exists');
        
        // Count products
        const countResult = await client.query('SELECT COUNT(*) FROM products');
        console.log(`There are ${countResult.rows[0].count} products in the database`);
        
        if (parseInt(countResult.rows[0].count) > 0) {
          // Sample products
          const sampleResult = await client.query('SELECT id, sku, title FROM products LIMIT 3');
          console.log('Sample products:');
          sampleResult.rows.forEach(p => console.log(`  ${p.id}: ${p.sku} - ${p.title.substring(0, 30)}...`));
        }
      } else {
        console.log('Products table does not exist!');
      }
    } catch (error) {
      console.error('Error checking tables:', error.message);
    }
    
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    return false;
  }
}

// Check if frontend is built
function checkFrontend() {
  console.log('Checking frontend build...');
  
  const distPath = path.join(process.cwd(), 'dist');
  const indexPath = path.join(distPath, 'public', 'index.html');
  
  if (!fs.existsSync(distPath)) {
    console.log('Frontend is not built (dist directory missing)');
    return false;
  }
  
  if (!fs.existsSync(indexPath)) {
    console.log('Frontend is not properly built (index.html missing)');
    return false;
  }
  
  console.log('Frontend appears to be built');
  return true;
}

// Test import data structure
function checkImportData() {
  console.log('Checking import data...');
  
  const importPath = path.join(process.cwd(), 'database-export.json');
  
  if (!fs.existsSync(importPath)) {
    console.log('Import data file not found!');
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    console.log('Successfully parsed import data');
    
    console.log('Data contains:', Object.keys(data).join(', '));
    
    if (data.products && Array.isArray(data.products)) {
      console.log(`Found ${data.products.length} products in import data`);
      return true;
    } else {
      console.log('No products array found in import data');
      return false;
    }
  } catch (error) {
    console.error('Error parsing import data:', error.message);
    return false;
  }
}

// Check if environment variables are set
function checkEnvironment() {
  console.log('Checking environment variables...');
  
  const requiredVars = [
    'DATABASE_URL',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_STORE_URL'
  ];
  
  const missing = [];
  
  for (const v of requiredVars) {
    if (!process.env[v]) {
      missing.push(v);
    }
  }
  
  if (missing.length === 0) {
    console.log('All required environment variables are set');
    return true;
  } else {
    console.error('Missing environment variables:', missing.join(', '));
    return false;
  }
}

async function runDiagnostics() {
  console.log('\n--- DEPLOYMENT DIAGNOSTICS ---\n');
  
  const envOk = checkEnvironment();
  const dbOk = await checkDatabase();
  const frontendOk = checkFrontend();
  const importOk = checkImportData();
  
  console.log('\n--- DIAGNOSTICS SUMMARY ---');
  console.log(`Environment Variables: ${envOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`Database Connection: ${dbOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`Frontend Build: ${frontendOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`Import Data: ${importOk ? '✓ OK' : '✗ FAILED'}`);
  
  if (envOk && dbOk && frontendOk && importOk) {
    console.log('\nAll systems appear to be ready for deployment!');
  } else {
    console.log('\nSome issues detected that may prevent successful deployment.');
  }
}

runDiagnostics();
