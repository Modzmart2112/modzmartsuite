// Database Export Script - Exports data from the local database to a JSON file
// This allows transferring data between environments

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('Starting database export process...');

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function exportData() {
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
    
  } catch (error) {
    console.error('Error exporting data:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the export
exportData().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});