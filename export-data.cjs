#!/usr/bin/env node

/**
 * Database Export Script
 * 
 * This script exports all essential data from the database to a JSON file
 * for easy transfer between environments (development to production).
 * 
 * Usage: node export-data.cjs
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const exportFileName = 'database-export.json';

console.log('==================================================');
console.log('Starting database export...');
console.log('==================================================');

// Start the export process
startExport().catch(error => {
  console.error('Export failed:', error);
  process.exit(1);
});

async function startExport() {
  try {
    console.log('Connecting to database...');
    
    const client = await pool.connect();
    console.log('Database connected successfully.');
    
    try {
      // Create an object to hold all exported data
      const exportData = {
        exportedAt: new Date().toISOString(),
        products: [],
        stats: [],
        shopify_logs: [],
        notifications: []
      };
      
      // Export products
      console.log('Exporting products...');
      const productsResult = await client.query('SELECT * FROM products ORDER BY id');
      exportData.products = productsResult.rows;
      console.log(`Exported ${exportData.products.length} products.`);
      
      // Export stats
      try {
        console.log('Exporting stats...');
        const statsResult = await client.query('SELECT * FROM stats ORDER BY id');
        exportData.stats = statsResult.rows;
        console.log(`Exported ${exportData.stats.length} stats records.`);
      } catch (error) {
        console.error('Error exporting stats:', error.message);
      }
      
      // Export shopify logs (limited to last 1000)
      try {
        console.log('Exporting shopify logs (last 1000 records)...');
        const logsResult = await client.query('SELECT * FROM shopify_logs ORDER BY id DESC LIMIT 1000');
        exportData.shopify_logs = logsResult.rows;
        console.log(`Exported ${exportData.shopify_logs.length} shopify log records.`);
      } catch (error) {
        console.error('Error exporting shopify logs:', error.message);
      }
      
      // Export notifications
      try {
        console.log('Exporting notifications...');
        const notificationsResult = await client.query('SELECT * FROM notifications ORDER BY id');
        exportData.notifications = notificationsResult.rows;
        console.log(`Exported ${exportData.notifications.length} notification records.`);
      } catch (error) {
        console.error('Error exporting notifications:', error.message);
      }
      
      // Write the export file
      const exportPath = path.join(__dirname, exportFileName);
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      
      console.log('==================================================');
      console.log(`Export completed successfully to ${exportFileName}`);
      console.log(`Total data size: ${(JSON.stringify(exportData).length / 1024 / 1024).toFixed(2)} MB`);
      console.log('==================================================');
      console.log('\nExport Summary:');
      console.log(`- ${exportData.products.length} products`);
      console.log(`- ${exportData.stats.length} stat records`);
      console.log(`- ${exportData.shopify_logs.length} shopify log records`);
      console.log(`- ${exportData.notifications.length} notification records`);
      console.log('\nNext Steps:');
      console.log('1. Download the database-export.json file');
      console.log('2. Upload it to your deployment environment');
      console.log('3. Run node import-data.cjs to import the data');
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error during export:', error);
    throw error;
  } finally {
    pool.end();
  }
}