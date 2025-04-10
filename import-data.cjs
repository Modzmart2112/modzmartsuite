// Database Import Script - Imports data from a JSON file into the database
// This allows transferring data between environments

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('Starting database import process...');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function importData() {
  try {
    console.log('Connected to database');
    
    // Read the export file
    const importPath = path.join(__dirname, 'database-export.json');
    if (!fs.existsSync(importPath)) {
      throw new Error(`Import file not found at ${importPath}`);
    }
    
    const importData = JSON.parse(fs.readFileSync(importPath, 'utf8'));
    console.log(`Import file found with data from ${importData.exportedAt}`);
    
    // Check if there's any data to import
    const totalRecords = Object.keys(importData).reduce((total, key) => {
      if (Array.isArray(importData[key])) {
        return total + importData[key].length;
      }
      return total;
    }, 0);
    
    console.log(`Total records to import: ${totalRecords}`);
    
    if (totalRecords === 0) {
      console.log('No data to import. Aborting.');
      return;
    }
    
    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Helper function to safely check if a table exists
      async function tableExists(tableName) {
        try {
          const result = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            );
          `, [tableName]);
          return result.rows[0].exists;
        } catch (error) {
          console.error(`Error checking if table ${tableName} exists:`, error);
          return false;
        }
      }
      
      // Helper function to safely truncate a table
      async function safeTruncateTable(tableName) {
        try {
          if (await tableExists(tableName)) {
            console.log(`Truncating table: ${tableName}`);
            await client.query(`TRUNCATE ${tableName} RESTART IDENTITY CASCADE`);
            return true;
          } else {
            console.log(`Table ${tableName} does not exist, skipping truncate.`);
            return false;
          }
        } catch (error) {
          console.log(`Error truncating table ${tableName}:`, error.message);
          return false;
        }
      }
      
      // Helper function to import data into a table
      async function importTableData(tableName, data, insertSqlFn) {
        if (!data || data.length === 0) {
          console.log(`No ${tableName} data to import.`);
          return 0;
        }
        
        if (!(await tableExists(tableName))) {
          console.log(`Table ${tableName} does not exist, skipping import.`);
          return 0;
        }
        
        console.log(`Importing ${data.length} ${tableName} records...`);
        let successCount = 0;
        
        for (const item of data) {
          try {
            await insertSqlFn(item);
            successCount++;
          } catch (error) {
            console.error(`Error importing ${tableName} record:`, error.message);
          }
        }
        
        console.log(`Successfully imported ${successCount}/${data.length} ${tableName} records.`);
        return successCount;
      }
      
      // Clear existing data (with safe checks)
      console.log('Clearing existing data...');
      await safeTruncateTable('products');
      await safeTruncateTable('schedules');
      await safeTruncateTable('stats');
      await safeTruncateTable('suppliers');
      await safeTruncateTable('shopify_logs');
      await safeTruncateTable('jobs');
      await safeTruncateTable('events');
      await safeTruncateTable('notifications');
      await safeTruncateTable('sales_campaigns');
      
      // Import products
      await importTableData('products', importData.products, async (product) => {
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
      });
      
      // Import schedules
      await importTableData('schedules', importData.schedules, async (schedule) => {
        await client.query(
          `INSERT INTO schedules(
            id, name, type, status, next_run, last_run, interval, created_at, updated_at
          ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            schedule.id, schedule.name, schedule.type, schedule.status, 
            schedule.next_run, schedule.last_run, schedule.interval, 
            schedule.created_at, schedule.updated_at
          ]
        );
      });
      
      // Import stats
      await importTableData('stats', importData.stats, async (stat) => {
        await client.query(
          `INSERT INTO stats(
            id, key, value, created_at, updated_at
          ) VALUES($1, $2, $3, $4, $5)`,
          [
            stat.id, stat.key, stat.value, stat.created_at, stat.updated_at
          ]
        );
      });
      
      // Import suppliers
      await importTableData('suppliers', importData.suppliers, async (supplier) => {
        await client.query(
          `INSERT INTO suppliers(
            id, name, url, created_at, updated_at
          ) VALUES($1, $2, $3, $4, $5)`,
          [
            supplier.id, supplier.name, supplier.url, 
            supplier.created_at, supplier.updated_at
          ]
        );
      });
      
      // Import shopify logs if they exist
      await importTableData('shopify_logs', importData.shopify_logs, async (log) => {
        await client.query(
          `INSERT INTO shopify_logs(
            id, sync_id, sku, message, created_at
          ) VALUES($1, $2, $3, $4, $5)`,
          [
            log.id, log.sync_id, log.sku, log.message, log.created_at
          ]
        );
      });
      
      // Import notifications if they exist
      await importTableData('notifications', importData.notifications, async (notification) => {
        await client.query(
          `INSERT INTO notifications(
            id, product_id, message, status, created_at, updated_at
          ) VALUES($1, $2, $3, $4, $5, $6)`,
          [
            notification.id, notification.product_id, notification.message,
            notification.status, notification.created_at, notification.updated_at
          ]
        );
      });
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('\nData import completed successfully!');
      
    } catch (error) {
      // Rollback in case of error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error importing data:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the import
importData().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});