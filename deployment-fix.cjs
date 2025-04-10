/**
 * REPLIT DEPLOYMENT FIX SCRIPT
 * 
 * This script is specifically for fixing the deployed app on Replit.
 * It ensures data is imported to the production database before starting the server.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const https = require('https');

// Function to verify Shopify credentials
async function verifyShopifyCredentials() {
  console.log('Verifying Shopify credentials...');
  
  // Check if all required variables are set
  const shopifyApiKey = process.env.SHOPIFY_API_KEY;
  const shopifyApiSecret = process.env.SHOPIFY_API_SECRET;
  const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
  
  if (!shopifyApiKey || !shopifyApiSecret || !shopifyStoreUrl) {
    console.error('ERROR: Shopify credentials not properly set!');
    console.error('Please make sure these secrets are set in your Replit Secrets:');
    console.error('- SHOPIFY_API_KEY');
    console.error('- SHOPIFY_API_SECRET');
    console.error('- SHOPIFY_STORE_URL');
    
    // We'll proceed, but warn the user
    console.error('Proceeding with deployment, but Shopify sync will not work correctly.');
    return false;
  }
  
  // Try to make a simple request to Shopify to verify credentials
  return new Promise((resolve) => {
    console.log(`Testing connection to Shopify store: ${shopifyStoreUrl}`);
    
    // Format URL properly - remove any protocol and trailing slashes
    const normalizedUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Create auth string for basic auth
    const auth = Buffer.from(`${shopifyApiKey}:${shopifyApiSecret}`).toString('base64');
    
    const options = {
      hostname: normalizedUrl,
      path: '/admin/api/2022-10/shop.json',
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
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
          
          try {
            const errorInfo = JSON.parse(data);
            console.error('Error details:', JSON.stringify(errorInfo, null, 2));
          } catch (e) {
            console.error('Raw response:', data);
          }
          
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

async function deploymentFix() {
  console.log('\n========================================');
  console.log('REPLIT DEPLOYMENT FIX');
  console.log('========================================\n');
  
  // Verify shopify credentials first
  await verifyShopifyCredentials();
  
  // Make sure we have the DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set!');
    console.error('Please set DATABASE_URL in Replit Secrets');
    process.exit(1);
  }
  
  console.log('Database URL is set, continuing with deployment...');
  
  // First import data from database-export.json if needed
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const client = await pool.connect();
    console.log('Connected to database!');
    
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
    }
    
    // Check if we have products
    const result = await client.query('SELECT COUNT(*) FROM products');
    const productCount = parseInt(result.rows[0].count);
    
    console.log(`Found ${productCount} products in the database`);
    
    // If we don't have any products, import them
    if (productCount === 0 && fs.existsSync('./database-export.json')) {
      console.log('No products found, importing from database-export.json...');
      
      const importData = JSON.parse(fs.readFileSync('./database-export.json', 'utf8'));
      
      // Import products
      if (importData.products && importData.products.length > 0) {
        console.log(`Importing ${importData.products.length} products...`);
        
        await client.query('BEGIN');
        
        let successCount = 0;
        let errorCount = 0;
        
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
            
            if (successCount % 100 === 0) {
              console.log(`Imported ${successCount} products so far...`);
            }
          } catch (error) {
            console.error(`Error importing product ${product.id}: ${error.message}`);
            errorCount++;
          }
        }
        
        await client.query('COMMIT');
        console.log(`Products imported successfully! (${successCount} success, ${errorCount} errors)`);
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
      
      console.log('All data imported successfully!');
    }
    
    // Verify data after import
    const verifyCount = await client.query('SELECT COUNT(*) FROM products');
    console.log(`Database now has ${verifyCount.rows[0].count} products`);
    
    client.release();
    await pool.end();
    
    // Start the server using simple-deploy.cjs
    console.log('\n========================================');
    console.log('Starting server using simple-deploy.cjs...');
    console.log('========================================\n');
    
    // Use require to run the simple-deploy.cjs script
    require('./simple-deploy.cjs');
    
  } catch (error) {
    console.error('Error during deployment fix:', error);
    process.exit(1);
  }
}

// Run the deployment fix
deploymentFix().catch(error => {
  console.error('Unhandled error during deployment:', error);
  process.exit(1);
});