/**
 * This script specifically fixes the database issues on the Replit app
 * Run this if you see data locally but not at modzmartsuite.replit.app
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Check if we have the database URL
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set!');
  console.error('Please set DATABASE_URL in Replit Secrets');
  process.exit(1);
}

async function fixReplicationDatabase() {
  console.log('Running Replit Database Fix...');
  console.log(`DATABASE_URL is ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected to database successfully!');

    // Check if products table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'products'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('Products table does not exist, creating schema...');
      
      // Schema creation
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
    } else {
      console.log('Products table already exists');
      
      // Check if we have products
      const productCount = await client.query('SELECT COUNT(*) FROM products');
      console.log(`Found ${productCount.rows[0].count} products in database`);
      
      if (parseInt(productCount.rows[0].count) === 0) {
        console.log('No products found in database, will proceed with data import');
      } else {
        console.log(`Database already has ${productCount.rows[0].count} products - these should show up in the app`);
        client.release();
        await pool.end();
        return;
      }
    }
    
    // Import data from database-export.json if it exists and we need to
    if (fs.existsSync(path.join(__dirname, 'database-export.json'))) {
      console.log('Found database export file, importing data...');
      
      const importData = JSON.parse(fs.readFileSync(path.join(__dirname, 'database-export.json'), 'utf8'));
      
      // Import products
      if (importData.products && importData.products.length > 0) {
        console.log(`Importing ${importData.products.length} products...`);
        
        await client.query('BEGIN');
        
        // We'll track progress
        let successCount = 0;
        let errorCount = 0;
        
        // Now, we use a parameterized query to avoid SQL injection
        for (const product of importData.products) {
          try {
            await client.query(
              `INSERT INTO products(
                id, sku, title, description, shopify_id, shopify_price, cost_price, 
                supplier_url, supplier_price, last_scraped, last_checked, 
                has_price_discrepancy, created_at, updated_at, status, images,
                vendor, product_type, on_sale, original_price, sale_end_date, sale_id
              ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
              ON CONFLICT (id) DO NOTHING`,
              [
                product.id, 
                product.sku, 
                product.title, 
                product.description, 
                product.shopify_id, 
                product.shopify_price,
                product.cost_price, 
                product.supplier_url, 
                product.supplier_price, 
                product.last_scraped ? new Date(product.last_scraped) : null,
                product.last_checked ? new Date(product.last_checked) : null, 
                product.has_price_discrepancy,
                product.created_at ? new Date(product.created_at) : new Date(), 
                product.updated_at ? new Date(product.updated_at) : new Date(),
                product.status, 
                product.images ? JSON.stringify(product.images) : null,
                product.vendor, 
                product.product_type,
                product.on_sale || false,
                product.original_price || null,
                product.sale_end_date ? new Date(product.sale_end_date) : null,
                product.sale_id || null
              ]
            );
            successCount++;
            
            // Show progress every 100 products
            if (successCount % 100 === 0) {
              console.log(`Imported ${successCount} products so far...`);
            }
          } catch (error) {
            console.error(`Error importing product ${product.id}: ${error.message}`);
            errorCount++;
          }
        }
        
        await client.query('COMMIT');
        console.log(`Product import completed! ${successCount} products imported successfully, ${errorCount} errors.`);
      }
      
      // Import stats
      if (importData.stats && importData.stats.length > 0) {
        console.log(`Importing ${importData.stats.length} stats...`);
        
        await client.query('BEGIN');
        
        for (const stat of importData.stats) {
          try {
            await client.query(
              `INSERT INTO stats(id, key, value, created_at, updated_at) 
               VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING`,
              [
                stat.id,
                stat.key,
                stat.value,
                stat.created_at ? new Date(stat.created_at) : new Date(),
                stat.updated_at ? new Date(stat.updated_at) : new Date()
              ]
            );
          } catch (error) {
            console.error(`Error importing stat ${stat.id}: ${error.message}`);
          }
        }
        
        await client.query('COMMIT');
        console.log('Stats import completed!');
      }
      
      // Import shopify_logs
      if (importData.shopify_logs && importData.shopify_logs.length > 0) {
        console.log(`Importing ${importData.shopify_logs.length} shopify logs...`);
        
        await client.query('BEGIN');
        
        for (const log of importData.shopify_logs) {
          try {
            await client.query(
              `INSERT INTO shopify_logs(id, sync_id, sku, message, created_at) 
               VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING`,
              [
                log.id,
                log.sync_id,
                log.sku,
                log.message,
                log.created_at ? new Date(log.created_at) : new Date()
              ]
            );
          } catch (error) {
            console.error(`Error importing shopify log ${log.id}: ${error.message}`);
          }
        }
        
        await client.query('COMMIT');
        console.log('Shopify logs import completed!');
      }
      
      // Import notifications
      if (importData.notifications && importData.notifications.length > 0) {
        console.log(`Importing ${importData.notifications.length} notifications...`);
        
        await client.query('BEGIN');
        
        for (const notification of importData.notifications) {
          try {
            await client.query(
              `INSERT INTO notifications(id, type, message, read, created_at) 
               VALUES($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO NOTHING`,
              [
                notification.id,
                notification.type,
                notification.message,
                notification.read,
                notification.created_at ? new Date(notification.created_at) : new Date()
              ]
            );
          } catch (error) {
            console.error(`Error importing notification ${notification.id}: ${error.message}`);
          }
        }
        
        await client.query('COMMIT');
        console.log('Notifications import completed!');
      }
      
      console.log('Data import completed successfully!');
    } else {
      console.error('database-export.json not found! Data import skipped.');
    }
    
    // Verify data after import
    const verifyCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`After import: ${verifyCount.rows[0].count} products in database`);
    
    client.release();
  } catch (error) {
    console.error('Database setup error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run database setup
fixReplicationDatabase().then(() => {
  console.log('\n==============================================');
  console.log('DATABASE FIX COMPLETED!');
  console.log('==============================================');
  console.log('If you had 0 products before and now have products,');
  console.log('your data should now be visible in the Replit app.');
  console.log('Restart your application to see the changes.');
  console.log('==============================================');
}).catch(error => {
  console.error('Database fix failed:', error);
});