#!/usr/bin/env node

/**
 * Database Import Script
 * 
 * This script imports data from database-export.json into the database.
 * It's designed to be used in a new environment to transfer data.
 * 
 * Usage: node import-data.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const importFileName = 'database-export.json';
const importPath = path.join(__dirname, importFileName);

console.log('==================================================');
console.log('Starting database import...');
console.log('==================================================');

if (!fs.existsSync(importPath)) {
  console.error(`Error: Import file '${importFileName}' not found!`);
  console.error('Please make sure the export file exists in the current directory.');
  process.exit(1);
}

// Start the import process
confirmAndStartImport().catch(error => {
  console.error('Import failed:', error);
  process.exit(1);
});

async function confirmAndStartImport() {
  try {
    // Parse the import file to show statistics
    const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    
    console.log(`Import file found with data from ${importData.exportedAt}`);
    console.log(`\nImport Summary:`);
    console.log(`- ${importData.products?.length || 0} products`);
    console.log(`- ${importData.stats?.length || 0} stat records`);
    console.log(`- ${importData.shopify_logs?.length || 0} shopify log records`);
    console.log(`- ${importData.notifications?.length || 0} notification records`);
    
    // Check database connection
    console.log('\nConnecting to database...');
    const client = await pool.connect();
    
    try {
      // Check if products table exists and has data
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
        await createSchema(client);
      } else {
        // Table exists, check if it has data
        const countResult = await client.query('SELECT COUNT(*) FROM products');
        const productCount = parseInt(countResult.rows[0].count);
        
        if (productCount > 0) {
          console.log(`\n⚠️ WARNING: Database already contains ${productCount} products!`);
          console.log('Importing will add duplicate records unless tables are cleared first.');
          
          const shouldProceed = await confirmPrompt('Do you want to clear existing data before importing? (y/n): ');
          
          if (shouldProceed) {
            console.log('Clearing existing data...');
            await clearTables(client);
          } else {
            console.log('Proceeding with import without clearing existing data...');
          }
        }
      }
      
      // Start the import
      await importData(client, importData);
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error during import setup:', error);
    throw error;
  } finally {
    pool.end();
  }
}

// Create the database schema if it doesn't exist
async function createSchema(client) {
  console.log('Creating database schema...');
  
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
    } catch (error) {
      console.error('Error creating table:', error.message);
    }
  }
}

// Clear existing data from tables
async function clearTables(client) {
  const tables = ['products', 'stats', 'shopify_logs', 'notifications'];
  
  try {
    await client.query('BEGIN');
    
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`Cleared table ${table}`);
    }
    
    await client.query('COMMIT');
    console.log('All tables cleared successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing tables:', error.message);
    throw error;
  }
}

// Import data from the export file
async function importData(client, importData) {
  try {
    console.log('\nStarting data import...');
    
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
    
    // Update sequences to avoid ID conflicts
    try {
      console.log('Updating sequences...');
      
      const tables = [
        { table: 'products', column: 'id' },
        { table: 'stats', column: 'id' },
        { table: 'shopify_logs', column: 'id' },
        { table: 'notifications', column: 'id' }
      ];
      
      for (const { table, column } of tables) {
        try {
          await client.query(`
            SELECT setval(pg_get_serial_sequence('${table}', '${column}'), 
                          (SELECT MAX(${column}) FROM ${table}), true)
          `);
        } catch (error) {
          console.error(`Error updating sequence for ${table}.${column}:`, error.message);
        }
      }
      
      console.log('Sequences updated successfully');
    } catch (error) {
      console.error('Error updating sequences:', error.message);
    }
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('\n==================================================');
    console.log('Data import completed successfully!');
    console.log('==================================================');
    
  } catch (error) {
    // Rollback in case of error
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
    throw error;
  }
}

// Helper function to prompt for confirmation
function confirmPrompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}