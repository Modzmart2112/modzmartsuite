/**
 * This script directly updates the stats table in the database with the correct product count
 * Use this if you already know the count of unique products in your Shopify store
 */

import { pool } from './server/db';

async function updateProductCount() {
  try {
    console.log("Starting direct product count update...");
    
    // Connect to the database
    const client = await pool.connect();
    
    try {
      // Hardcode the correct product count
      const CORRECT_PRODUCT_COUNT = 1604; // The actual number of unique products
      
      console.log(`Updating stats table with product count: ${CORRECT_PRODUCT_COUNT}`);
      
      // Update the stats table
      const updateResult = await client.query(
        'UPDATE stats SET product_count = $1 WHERE id = 1',
        [CORRECT_PRODUCT_COUNT]
      );
      
      if (updateResult.rowCount === 0) {
        console.log("No stats record found to update. Inserting new record...");
        
        // If no record exists, create one
        await client.query(
          'INSERT INTO stats (id, product_count) VALUES (1, $1)',
          [CORRECT_PRODUCT_COUNT]
        );
        
        console.log("Created new stats record with correct product count");
      } else {
        console.log(`Updated stats record with correct product count: ${CORRECT_PRODUCT_COUNT}`);
      }
      
      // Update any active sync progress records
      console.log("Updating shopify_sync_progress records...");
      
      const syncProgressResult = await client.query(
        'UPDATE shopify_sync_progress SET details = jsonb_set(details, \'{uniqueProductCount}\', $1::jsonb) WHERE status = \'in-progress\'',
        [JSON.stringify(CORRECT_PRODUCT_COUNT)]
      );
      
      console.log(`Updated ${syncProgressResult.rowCount} sync progress records`);
      
      console.log("Product count fix completed successfully");
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error("Error fixing product count:", error);
  }
}

// Run the function
updateProductCount().catch(console.error);