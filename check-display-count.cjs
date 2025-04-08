/**
 * This script checks if there's a difference between the database product count
 * and what's displaying in the frontend UI by examining the sync progress records 
 * and dashboard stats endpoints.
 */

const { Pool } = require('pg');

async function checkDisplayCount() {
  try {
    console.log("Starting investigation of product count display issue...");
    
    // Setup database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    try {
      // Connect to the database
      const client = await pool.connect();
      
      try {
        // First check the product count directly from database
        const productsCountResult = await client.query('SELECT COUNT(*) as count FROM products');
        const totalProducts = parseInt(productsCountResult.rows[0].count);
        console.log(`Total products in database: ${totalProducts}`);
        
        // Check unique products by shopify_id
        const uniqueProductsResult = await client.query('SELECT COUNT(DISTINCT shopify_id) as count FROM products');
        const uniqueProducts = parseInt(uniqueProductsResult.rows[0].count);
        console.log(`Unique products (by shopify_id): ${uniqueProducts}`);
        
        // Check dashboard stats table - this is what powers the dashboard UI
        const statsResult = await client.query('SELECT * FROM stats LIMIT 1');
        if (statsResult.rows.length > 0) {
          console.log("\nDashboard stats from database:");
          const stats = statsResult.rows[0];
          
          // Check if product_count column exists
          const statsColumns = Object.keys(stats);
          if (statsColumns.includes('product_count')) {
            console.log(`- Product count in stats table: ${stats.product_count}`);
          } else {
            console.log("- No product_count column found in stats table");
          }
          
          console.log(`- Last updated: ${stats.last_updated}`);
          console.log(`- Last Shopify sync: ${stats.last_shopify_sync}`);
        } else {
          console.log("No stats record found in database");
        }
        
        // Check sync progress records
        const syncProgressResult = await client.query(`
          SELECT * FROM sync_progress 
          WHERE type = 'shopify-sync' 
          ORDER BY id DESC 
          LIMIT 1
        `);
        
        if (syncProgressResult.rows.length > 0) {
          console.log("\nLatest sync progress record:");
          const syncProgress = syncProgressResult.rows[0];
          console.log(`- ID: ${syncProgress.id}`);
          console.log(`- Status: ${syncProgress.status}`);
          console.log(`- Total items: ${syncProgress.total_items}`);
          console.log(`- Processed items: ${syncProgress.processed_items}`);
          
          if (syncProgress.details) {
            console.log(`- Details: ${JSON.stringify(syncProgress.details)}`);
            if (syncProgress.details.uniqueProductCount) {
              console.log(`- Unique product count in details: ${syncProgress.details.uniqueProductCount}`);
            }
          }
        } else {
          console.log("No sync progress records found");
        }
        
        // Check if there's a UI settings table or similar that might have display settings
        const tablesResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        console.log("\nAvailable tables in database:");
        tablesResult.rows.forEach(row => console.log(`- ${row.table_name}`));
        
        console.log("\nBased on the investigation, the correct product count should be: ${uniqueProducts}");
        
        // Suggest the right fix based on findings
        console.log("\nConclusions:");
        if (uniqueProducts !== totalProducts) {
          console.log("There's a difference between total products and unique products by shopify_id.");
          console.log("The frontend should display the unique count of ${uniqueProducts} products.");
        } else {
          console.log("Total products and unique products by shopify_id are the same (${uniqueProducts}).");
          console.log("This suggests the issue might be with how the frontend is retrieving or displaying the count.");
          console.log("Check the frontend code that calls the /api/dashboard/stats endpoint to ensure it's correctly displaying the product count.");
        }
        
      } finally {
        // Release the client back to the pool
        client.release();
      }
      
      // Close the pool
      await pool.end();
    } catch (error) {
      console.error("Database error:", error);
    }
  } catch (error) {
    console.error("Error checking display count:", error);
  }
}

// Run the function
checkDisplayCount().catch(console.error);