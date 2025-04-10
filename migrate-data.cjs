// Database Migration Helper for Deployment
// This script provides a simple command-line interface for exporting and importing data

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main menu function
function showMainMenu() {
  console.log('\n===== DATABASE MIGRATION HELPER =====');
  console.log('1. Export data from local database to JSON');
  console.log('2. Import data from JSON to database');
  console.log('3. Show database information');
  console.log('4. Complete Migration (Export + Import)');
  console.log('0. Exit');
  
  rl.question('\nSelect an option: ', async (answer) => {
    switch (answer) {
      case '1':
        await exportData();
        showMainMenu();
        break;
      case '2':
        await importData();
        showMainMenu();
        break;
      case '3':
        await showDatabaseInfo();
        showMainMenu();
        break;
      case '4':
        await completeMigration();
        showMainMenu();
        break;
      case '0':
        console.log('Exiting...');
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid option. Please try again.');
        showMainMenu();
    }
  });
}

// Database information
async function showDatabaseInfo() {
  console.log('\n===== DATABASE INFORMATION =====');
  
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable not found');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Show database connection info
    console.log(`Database URL: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
    
    // Check connection
    const client = await pool.connect();
    console.log('Successfully connected to database');
    
    // Get database name
    const dbResult = await client.query('SELECT current_database()');
    console.log(`Database name: ${dbResult.rows[0].current_database}`);
    
    // Get table counts
    const tables = [
      'products', 'suppliers', 'schedules', 'stats', 'shopify_logs', 'sessions', 
      'notifications', 'jobs', 'events', 'sales_campaigns'
    ];
    
    console.log('\nTable counts:');
    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`- ${table}: ${countResult.rows[0].count} rows`);
      } catch (e) {
        console.log(`- ${table}: Table not found or error: ${e.message}`);
      }
    }
    
    client.release();
  } catch (error) {
    console.error('Error connecting to database:', error.message);
  } finally {
    await pool.end();
  }
}

// Mask database URL for security
function maskDatabaseUrl(url) {
  try {
    // Simple mask for database URL
    if (!url) return 'undefined';
    return url.replace(/\/\/([^:]+):([^@]+)@/, '//******:******@');
  } catch (e) {
    return 'Error masking URL';
  }
}

// Export data function
async function exportData() {
  console.log('\n===== EXPORTING DATA =====');
  
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable not found');
    return;
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    console.log('Connected to database');
    
    // Initialize the export data structure
    const exportData = {
      products: [],
      schedules: [],
      stats: [],
      suppliers: [],
      shopify_logs: [],
      jobs: [],
      events: [],
      notifications: [],
      sales_campaigns: [],
      exportedAt: new Date().toISOString()
    };
    
    // Helper function to safely query a table
    async function safeQueryTable(tableName) {
      try {
        console.log(`Exporting ${tableName}...`);
        const result = await pool.query(`SELECT * FROM ${tableName}`);
        console.log(`Found ${result.rows.length} ${tableName} records`);
        return result.rows;
      } catch (error) {
        console.log(`Note: Table '${tableName}' does not exist or could not be accessed`);
        return [];
      }
    }
    
    // Export each table with error handling
    exportData.products = await safeQueryTable('products');
    exportData.schedules = await safeQueryTable('schedules');
    exportData.stats = await safeQueryTable('stats');
    exportData.suppliers = await safeQueryTable('suppliers');
    exportData.shopify_logs = await safeQueryTable('shopify_logs');
    exportData.jobs = await safeQueryTable('jobs');
    exportData.events = await safeQueryTable('events');
    exportData.notifications = await safeQueryTable('notifications');
    exportData.sales_campaigns = await safeQueryTable('sales_campaigns');
    
    // Write to a JSON file
    const exportPath = path.join(__dirname, 'database-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    
    console.log(`\nData successfully exported to ${exportPath}`);
    console.log(`Total record counts:`);
    Object.keys(exportData).forEach(key => {
      if (Array.isArray(exportData[key])) {
        console.log(`- ${key}: ${exportData[key].length} records`);
      }
    });
    
    console.log('\nYou can now transfer this file to your deployment environment');
    
    return exportData;
  } catch (error) {
    console.error('Error exporting data:', error);
    return null;
  } finally {
    await pool.end();
  }
}

// Import data function
async function importData(confirmOverride = false) {
  console.log('\n===== IMPORTING DATA =====');
  
  // Check if import file exists
  const importPath = path.join(__dirname, 'database-export.json');
  if (!fs.existsSync(importPath)) {
    console.error(`Error: Import file not found at ${importPath}`);
    return false;
  }
  
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable not found');
    return false;
  }
  
  // Ask for confirmation if not already confirmed
  if (!confirmOverride) {
    return new Promise((resolve) => {
      rl.question('\nWARNING: This will replace all current data in the database.\nAre you sure you want to continue? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() !== 'yes') {
          console.log('Import cancelled.');
          resolve(false);
          return;
        }
        
        const result = await performImport();
        resolve(result);
      });
    });
  } else {
    return await performImport();
  }
  
  async function performImport() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    try {
      console.log('Connected to database');
      
      // Read the export file
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
        return false;
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
        return true;
        
      } catch (error) {
        // Rollback in case of error
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    } finally {
      await pool.end();
    }
  }
}

// Complete migration workflow
async function completeMigration() {
  console.log('\n===== COMPLETE MIGRATION WORKFLOW =====');
  console.log('This will export data from the current database and then import it.');
  
  // Ask for confirmation
  rl.question('\nAre you sure you want to proceed with the complete migration? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log('Migration cancelled.');
      return;
    }
    
    console.log('\nStep 1: Exporting data from current database...');
    const exportResult = await exportData();
    
    if (!exportResult) {
      console.error('Export failed, cannot continue with import.');
      return;
    }
    
    console.log('\nStep 2: Importing data to current database...');
    const importResult = await importData(true);
    
    if (importResult) {
      console.log('\nComplete migration workflow finished successfully!');
    } else {
      console.error('\nMigration workflow failed during import phase.');
    }
  });
}

// Start the application
console.log('Starting data migration helper...');
showMainMenu();